import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import * as crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { AccountType, CustomerStatus, OutboxStatus } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { AccountsService } from '../src/modules/accounts/accounts.service.js';
import { OutboxRelayService } from '../src/modules/outbox/outbox-relay.service.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';

describe('Transactional Outbox & Apache Kafka Streaming (e2e)', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let jwtService: JwtService;
    let accountsService: AccountsService;
    let outboxRelay: OutboxRelayService;
    let customerAToken: string;
    let _customerBToken: string;
    let customerAAccount: any;
    let customerBAccount: any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalFilters(new GlobalExceptionFilter());
        app.useGlobalPipes(
            new ValidationPipe({
                whitelist: true,
                transform: true,
            }),
        );
        await app.init();

        prisma = moduleFixture.get<PrismaService>(PrismaService);
        jwtService = moduleFixture.get<JwtService>(JwtService);
        accountsService = moduleFixture.get<AccountsService>(AccountsService);
        outboxRelay = moduleFixture.get<OutboxRelayService>(OutboxRelayService);

        // 1. Create Customer A
        const custA = await prisma.customer.create({
            data: {
                firstName: 'Alice',
                lastName: 'Outbox',
                email: `alice_outbox_${Date.now()}@bank.com`,
                phone: `+23480${crypto.randomInt(10000000, 99999999)}`,
                status: CustomerStatus.ACTIVE,
                kycTier: 3,
            },
        });
        customerAToken = jwtService.sign({ sub: custA.id, email: custA.email });
        customerAAccount = await accountsService.createAccount(custA.id, {
            type: AccountType.SAVINGS,
            currency: 'NGN',
        });

        // 2. Create Customer B
        const custB = await prisma.customer.create({
            data: {
                firstName: 'Bob',
                lastName: 'Outbox',
                email: `bob_outbox_${Date.now()}@bank.com`,
                phone: `+23480${crypto.randomInt(10000000, 99999999)}`,
                status: CustomerStatus.ACTIVE,
                kycTier: 3,
            },
        });
        _customerBToken = jwtService.sign({ sub: custB.id, email: custB.email });
        customerBAccount = await accountsService.createAccount(custB.id, {
            type: AccountType.SAVINGS,
            currency: 'NGN',
        });
    }, 30000);

    afterAll(async () => {
        await app.close();
    });

    it('ADR-13 Outbox Atomicity: generates a pending outbox row inside the deposit ACID transaction', async () => {
        const depositRes = await request(app.getHttpServer())
            .post('/transfers/deposit')
            .set('Authorization', `Bearer ${customerAToken}`)
            .set('Idempotency-Key', `deposit-outbox-${Date.now()}`)
            .send({
                accountId: customerAAccount.id,
                amount: '250000', // 2,500.00 NGN
                currency: 'NGN',
                description: 'Initial funding for outbox proof',
            })
            .expect(201);

        const transferId = depositRes.body.id;
        expect(transferId).toBeDefined();

        // Query the outbox table directly in PostgreSQL
        const outboxEntry = await prisma.outboxEvent.findFirst({
            where: {
                aggregateId: transferId,
                eventType: 'banking.transfers.deposited',
            },
        });

        expect(outboxEntry).toBeDefined();
        expect(outboxEntry?.aggregateType).toBe('Transfer');
        expect(outboxEntry?.payload).toHaveProperty('amount', '250000');
        expect(outboxEntry?.payload).toHaveProperty('currency', 'NGN');
    });

    it('ADR-14 Kafka Streaming: sweeps outbox events to Kafka and transitions status to PUBLISHED', async () => {
        const transferKey = `transfer-outbox-${Date.now()}`;
        const transferRes = await request(app.getHttpServer())
            .post('/transfers')
            .set('Authorization', `Bearer ${customerAToken}`)
            .set('Idempotency-Key', transferKey)
            .send({
                sourceAccountId: customerAAccount.id,
                destinationAccountId: customerBAccount.id,
                amount: '75000', // 750.00 NGN
                description: 'Kafka stream test payment',
            })
            .expect(201);

        const transferId = transferRes.body.id;

        // Trigger relay sweep manually to confirm deterministic processing
        await outboxRelay.sweepOutbox();

        // Verify outbox entry transitioned to PUBLISHED
        const outboxEntry = await prisma.outboxEvent.findFirst({
            where: {
                aggregateId: transferId,
                eventType: 'banking.transfers.completed',
            },
        });

        expect(outboxEntry).toBeDefined();
        expect(outboxEntry?.status).toBe(OutboxStatus.PUBLISHED);
        expect(outboxEntry?.publishedAt).toBeInstanceOf(Date);
        expect(outboxEntry?.retryCount).toBe(0);
        expect(outboxEntry?.lastError).toBeNull();
    });
});
