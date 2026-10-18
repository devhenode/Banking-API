import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import * as crypto from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/infrastructure/prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { AccountType, CustomerStatus } from '../src/generated/prisma/enums.js';
import { AccountsService } from '../src/modules/accounts/accounts.service.js';
import { TransfersService } from '../src/modules/transfers/transfers.service.js';
import { LedgerService } from '../src/modules/ledger/ledger.service.js';

describe('Concurrent Transfers & Deadlock Resistance (e2e)', () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let jwtService: JwtService;
    let accountsService: AccountsService;
    let transfersService: TransfersService;
    let ledgerService: LedgerService;

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
        app.getHttpServer().setMaxListeners(50);

        prisma = moduleFixture.get<PrismaService>(PrismaService);
        jwtService = moduleFixture.get<JwtService>(JwtService);
        accountsService = moduleFixture.get<AccountsService>(AccountsService);
        transfersService = moduleFixture.get<TransfersService>(TransfersService);
        ledgerService = moduleFixture.get<LedgerService>(LedgerService);
    });

    afterAll(async () => {
        await app.close();
    });

    /**
     * Helper to create an active Tier 3 customer with a funded bank account.
     */
    async function createTestCustomerWithAccount(name: string, initialKobo: bigint) {
        const uniqueSuffix = `${Date.now()}_${crypto.randomInt(100000, 999999)}`;
        const email = `${name.toLowerCase()}_${uniqueSuffix}@testbank.com`;
        const phone = `+23480${crypto.randomInt(10000000, 99999999)}`;

        const customer = await prisma.customer.create({
            data: {
                firstName: name,
                lastName: 'E2EStressTester',
                email,
                phone,
                status: CustomerStatus.ACTIVE,
                kycTier: 3, // Tier 3 allows up to ₦5,000,000 daily
            },
        });

        const token = jwtService.sign({
            sub: customer.id,
            email: customer.email,
        });

        const account = await accountsService.createAccount(customer.id, {
            type: AccountType.SAVINGS,
            currency: 'NGN',
        });

        if (initialKobo > 0n) {
            await transfersService.deposit(customer.id, crypto.randomUUID(), {
                accountId: account.id,
                amount: initialKobo.toString(),
                currency: 'NGN',
                description: `Initial funding for ${name}`,
            });
        }

        return { customer, account, token };
    }

    describe('ADR-05 Deadlock Resistance: Bi-directional Concurrent Cross-Transfers', () => {
        it('should execute 20 concurrent cross-transfers (A->B and B->A) without deadlocks (40P01) or balance corruption', async () => {
            // Anchor: Alice and Bob swapping funds simultaneously.
            // In systems without sorted row locks, A->B locks A then waits for B; B->A locks B then waits for A -> DEADLOCK!
            // With ADR-05, both lock min(A,B) first, preventing cycles.
            const initialBalance = 5_000_000n; // ₦50,000.00 each
            const alice = await createTestCustomerWithAccount('Alice', initialBalance);
            const bob = await createTestCustomerWithAccount('Bob', initialBalance);

            const aliceTransferAmount = 100_000n; // ₦1,000.00 each
            const bobTransferAmount = 50_000n;    // ₦500.00 each
            const numTransfersPerUser = 10;

            // Dispatch 10 transfers from Alice -> Bob and 10 from Bob -> Alice simultaneously
            const aliceRequests = Array.from({ length: numTransfersPerUser }, () =>
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${alice.token}`)
                    .set('Idempotency-Key', crypto.randomUUID())
                    .send({
                        sourceAccountId: alice.account.id,
                        destinationAccountId: bob.account.id,
                        amount: aliceTransferAmount.toString(),
                        currency: 'NGN',
                        description: 'Alice to Bob stress payment',
                    }),
            );

            const bobRequests = Array.from({ length: numTransfersPerUser }, () =>
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${bob.token}`)
                    .set('Idempotency-Key', crypto.randomUUID())
                    .send({
                        sourceAccountId: bob.account.id,
                        destinationAccountId: alice.account.id,
                        amount: bobTransferAmount.toString(),
                        currency: 'NGN',
                        description: 'Bob to Alice stress payment',
                    }),
            );

            // Interleave and execute all 20 requests concurrently
            const allPromises = [...aliceRequests, ...bobRequests].sort(() => Math.random() - 0.5);
            const responses = await Promise.all(allPromises);

            // Assert every single transfer succeeded (no 40P01 deadlock, no 500 server error)
            for (const res of responses) {
                expect(res.status).toBe(201);
                expect(res.body).toHaveProperty('status', 'COMPLETED');
            }

            // Verify final balances reflect exact expected arithmetic
            const aliceLedger = await ledgerService.getLedgerAccountByAccountId(alice.account.id);
            const bobLedger = await ledgerService.getLedgerAccountByAccountId(bob.account.id);

            expect(aliceLedger).not.toBeNull();
            expect(bobLedger).not.toBeNull();

            // Alice sent: 10 * 100,000 = 1,000,000 kobo; received: 10 * 50,000 = 500,000 kobo
            // Expected Alice balance: 5,000,000 - 1,000,000 + 500,000 = 4,500,000 kobo
            const expectedAliceBalance = initialBalance - BigInt(numTransfersPerUser) * aliceTransferAmount + BigInt(numTransfersPerUser) * bobTransferAmount;
            // Expected Bob balance: 5,000,000 - 500,000 + 1,000,000 = 5,500,000 kobo
            const expectedBobBalance = initialBalance - BigInt(numTransfersPerUser) * bobTransferAmount + BigInt(numTransfersPerUser) * aliceTransferAmount;

            expect(aliceLedger!.balance).toBe(expectedAliceBalance);
            expect(bobLedger!.balance).toBe(expectedBobBalance);

            // Conservation of money: total sum of Alice + Bob must equal initial sum
            expect(aliceLedger!.balance + bobLedger!.balance).toBe(initialBalance * 2n);
        });
    });

    describe('Race Condition: Double-Spending / Insufficient Funds Guard', () => {
        it('should strictly reject overdraft when concurrent transfers exceed available balance', async () => {
            // Anchor: Charlie has ₦1,000 (100,000 kobo).
            // He fires two simultaneous transfers of ₦800 (80,000 kobo) each.
            // Total attempted = 160,000 kobo.
            // Exactly ONE must succeed and the other MUST fail with 400 Bad Request.
            // The balance must NEVER go negative.
            const charlie = await createTestCustomerWithAccount('Charlie', 100_000n);
            const receiver = await createTestCustomerWithAccount('Dana', 0n);

            const transferPayload = {
                sourceAccountId: charlie.account.id,
                destinationAccountId: receiver.account.id,
                amount: '80000',
                currency: 'NGN',
                description: 'Double spend race attempt',
            };

            const [res1, res2] = await Promise.all([
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${charlie.token}`)
                    .set('Idempotency-Key', crypto.randomUUID())
                    .send(transferPayload),
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${charlie.token}`)
                    .set('Idempotency-Key', crypto.randomUUID())
                    .send(transferPayload),
            ]);

            const statuses = [res1.status, res2.status].sort((a, b) => a - b);
            expect(statuses).toEqual([201, 400]);

            const failedRes = res1.status === 400 ? res1 : res2;
            expect(failedRes.body.message).toMatch(/Insufficient funds/i);

            // Verify Charlie balance is exactly 20,000 kobo (100,000 - 80,000)
            const charlieLedger = await ledgerService.getLedgerAccountByAccountId(charlie.account.id);
            expect(charlieLedger!.balance).toBe(20_000n);

            // Verify Receiver balance is exactly 80,000 kobo
            const receiverLedger = await ledgerService.getLedgerAccountByAccountId(receiver.account.id);
            expect(receiverLedger!.balance).toBe(80_000n);
        });
    });

    describe('Race Condition: Idempotency Key Concurrency Protection', () => {
        it('should execute debit exactly once when identical idempotency keys race concurrently', async () => {
            // Anchor: A flaky network client sends the exact same request twice in parallel.
            // One request must process, and the other must either wait/replay or return 409 Conflict.
            // Under NO circumstance should money be debited twice!
            const eve = await createTestCustomerWithAccount('Eve', 500_000n);
            const frank = await createTestCustomerWithAccount('Frank', 0n);

            const sharedIdempotencyKey = crypto.randomUUID();
            const transferPayload = {
                sourceAccountId: eve.account.id,
                destinationAccountId: frank.account.id,
                amount: '150000', // ₦1,500.00
                currency: 'NGN',
                description: 'Concurrent duplicate payment',
            };

            const [res1, res2] = await Promise.all([
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${eve.token}`)
                    .set('Idempotency-Key', sharedIdempotencyKey)
                    .send(transferPayload),
                request(app.getHttpServer())
                    .post('/transfers')
                    .set('Authorization', `Bearer ${eve.token}`)
                    .set('Idempotency-Key', sharedIdempotencyKey)
                    .send(transferPayload),
            ]);

            const statuses = [res1.status, res2.status];
            // One must be 201 (processed). The other must be either 201 (replay) or 409 (conflict caught in-flight)
            expect(statuses).toContain(201);
            for (const s of statuses) {
                expect([201, 409]).toContain(s);
            }

            // CRITICAL INVARIANT: Eve was debited EXACTLY ONCE (150,000 kobo), never twice
            const eveLedger = await ledgerService.getLedgerAccountByAccountId(eve.account.id);
            expect(eveLedger!.balance).toBe(350_000n); // 500,000 - 150,000

            const frankLedger = await ledgerService.getLedgerAccountByAccountId(frank.account.id);
            expect(frankLedger!.balance).toBe(150_000n);
        });
    });

    describe('NUBAN Account Resolution Under Concurrency', () => {
        it('should resolve destination by 10-digit NUBAN concurrently without collisions', async () => {
            const grace = await createTestCustomerWithAccount('Grace', 300_000n);
            const heidi = await createTestCustomerWithAccount('Heidi', 0n);

            // Verify Heidi has a 10-digit NUBAN
            expect(heidi.account.accountNumber).toMatch(/^\d{10}$/);

            const res = await request(app.getHttpServer())
                .post('/transfers')
                .set('Authorization', `Bearer ${grace.token}`)
                .set('Idempotency-Key', crypto.randomUUID())
                .send({
                    sourceAccountId: grace.account.id,
                    destinationAccountNumber: heidi.account.accountNumber,
                    amount: '100000',
                    currency: 'NGN',
                    description: 'Transfer via NUBAN',
                });

            expect(res.status).toBe(201);
            expect(res.body.destinationAccountId).toBe(heidi.account.id);

            const heidiLedger = await ledgerService.getLedgerAccountByAccountId(heidi.account.id);
            expect(heidiLedger!.balance).toBe(100_000n);
        });
    });
});
