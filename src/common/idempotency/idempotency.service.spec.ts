import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdempotencyStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { IdempotencyService } from './idempotency.service.js';

describe('IdempotencyService', () => {
    let service: IdempotencyService;
    let mockPrisma: {
        idempotencyKey: {
            findUnique: ReturnType<typeof vi.fn>;
            upsert: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        mockPrisma = {
            idempotencyKey: {
                findUnique: vi.fn(),
                upsert: vi.fn(),
                update: vi.fn(),
            },
        };

        service = new IdempotencyService(mockPrisma as unknown as PrismaService);
    });

    it('computes consistent sha-256 hash', () => {
        const hash1 = service.computeHash('POST', '/transfers', { amount: '100' });
        const hash2 = service.computeHash('post', '/transfers', { amount: '100' });
        const hash3 = service.computeHash('POST', '/transfers', { amount: '200' });

        expect(hash1).toBe(hash2);
        expect(hash1).not.toBe(hash3);
    });

    it('returns isReplay: false when key does not exist', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue(null);

        const result = await service.checkOrReplay('cust-1', 'key-1', 'hash-1');

        expect(result.isReplay).toBe(false);
    });

    it('returns isReplay: false when key has expired', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            status: IdempotencyStatus.COMPLETED,
            requestHash: 'hash-1',
            expiresAt: new Date(Date.now() - 1000), // in the past
        });

        const result = await service.checkOrReplay('cust-1', 'key-1', 'hash-1');

        expect(result.isReplay).toBe(false);
    });

    it('throws ConflictException (409) when key status is IN_PROGRESS', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            status: IdempotencyStatus.IN_PROGRESS,
            requestHash: 'hash-1',
            expiresAt: new Date(Date.now() + 60000),
        });

        await expect(
            service.checkOrReplay('cust-1', 'key-1', 'hash-1'),
        ).rejects.toThrow(ConflictException);
    });

    it('throws UnprocessableEntityException (422) when completed key has different request hash', async () => {
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            status: IdempotencyStatus.COMPLETED,
            requestHash: 'original-hash',
            expiresAt: new Date(Date.now() + 60000),
        });

        await expect(
            service.checkOrReplay('cust-1', 'key-1', 'different-hash'),
        ).rejects.toThrow(UnprocessableEntityException);
    });

    it('returns isReplay: true with cached body and code when matching key completed', async () => {
        const cachedBody = { id: 'transfer-1', status: 'COMPLETED' };
        mockPrisma.idempotencyKey.findUnique.mockResolvedValue({
            status: IdempotencyStatus.COMPLETED,
            requestHash: 'matching-hash',
            responseCode: 201,
            responseBody: cachedBody,
            expiresAt: new Date(Date.now() + 60000),
        });

        const result = await service.checkOrReplay('cust-1', 'key-1', 'matching-hash');

        expect(result.isReplay).toBe(true);
        expect(result.responseCode).toBe(201);
        expect(result.responseBody).toEqual(cachedBody);
    });

    it('recordInProgress calls tx.idempotencyKey.upsert', async () => {
        const mockTx = {
            idempotencyKey: {
                upsert: vi.fn().mockResolvedValue({}),
            },
        };

        await service.recordInProgress(mockTx as any, {
            customerId: 'cust-1',
            key: 'key-1',
            requestHash: 'hash-1',
        });

        expect(mockTx.idempotencyKey.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { customerId_key: { customerId: 'cust-1', key: 'key-1' } },
                create: expect.objectContaining({
                    customerId: 'cust-1',
                    key: 'key-1',
                    status: IdempotencyStatus.IN_PROGRESS,
                }),
            }),
        );
    });

    it('recordCompleted calls tx.idempotencyKey.update', async () => {
        const mockTx = {
            idempotencyKey: {
                update: vi.fn().mockResolvedValue({}),
            },
        };

        await service.recordCompleted(mockTx as any, {
            customerId: 'cust-1',
            key: 'key-1',
            responseCode: 201,
            responseBody: { success: true },
        });

        expect(mockTx.idempotencyKey.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { customerId_key: { customerId: 'cust-1', key: 'key-1' } },
                data: expect.objectContaining({
                    status: IdempotencyStatus.COMPLETED,
                    responseCode: 201,
                }),
            }),
        );
    });
});
