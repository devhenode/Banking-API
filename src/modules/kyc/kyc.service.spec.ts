import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { KycService } from './kyc.service.js';
import { MockKycVerifierProvider } from './providers/mock-kyc-verifier.provider.js';

describe('KycService', () => {
    let service: KycService;
    let mockPrisma: any;
    let mockVerifier: MockKycVerifierProvider;

    beforeEach(() => {
        mockPrisma = {
            $transaction: vi.fn((callback) => callback(mockTx)),
            customer: {
                findUnique: vi.fn(),
                update: vi.fn(),
            },
            transfer: {
                findMany: vi.fn(),
            },
            kycVerification: {
                create: vi.fn(),
            },
        };

        mockVerifier = new MockKycVerifierProvider();
        service = new KycService(mockPrisma as unknown as PrismaService, mockVerifier);
    });

    const mockTx = {
        kycVerification: {
            create: vi.fn().mockResolvedValue({ id: 'kyc-1' }),
        },
        customer: {
            update: vi.fn().mockResolvedValue({ id: 'cust-1' }),
        },
    };

    describe('getKycStatus', () => {
        it('throws NotFoundException if customer does not exist', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue(null);

            await expect(service.getKycStatus('missing-cust')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('calculates remaining daily limit correctly based on today transfers', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                kycTier: 1, // Limit: 5,000,000 minor units (₦50,000)
            });
            mockPrisma.transfer.findMany.mockResolvedValue([
                { amount: 1_000_000n }, // ₦10,000 spent
                { amount: 1_500_000n }, // ₦15,000 spent
            ]);

            const status = await service.getKycStatus('cust-1');

            expect(status.kycTier).toBe(1);
            expect(status.dailyLimit).toBe('5000000');
            expect(status.totalSpentToday).toBe('2500000');
            expect(status.remainingLimit).toBe('2500000');
        });
    });

    describe('upgradeTier1', () => {
        it('rejects if customer profile is not active', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.PENDING_VERIFICATION,
                kycTier: 0,
            });

            await expect(
                service.upgradeTier1('cust-1', { nin: '12345678901' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('rejects if NIN is not 11 numeric digits', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 0,
            });

            await expect(
                service.upgradeTier1('cust-1', { nin: '12345' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('upgrades active customer to Tier 1 upon valid NIN', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 0,
            });

            const result = await service.upgradeTier1('cust-1', { nin: '12345678901' });

            expect(result.kycTier).toBe(1);
            expect(result.dailyLimit).toBe('5000000');
            expect(mockTx.kycVerification.create).toHaveBeenCalled();
            expect(mockTx.customer.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'cust-1' },
                    data: { kycTier: 1 },
                }),
            );
        });
    });

    describe('upgradeTier2', () => {
        it('rejects if customer has not completed Tier 1', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 0, // not tier 1 yet
            });

            await expect(
                service.upgradeTier2('cust-1', {
                    bvn: '12345678901',
                    proofOfAddressUrl: 'https://docs.bank.com/bill.pdf',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('upgrades Tier 1 customer to Tier 2 upon valid BVN and address', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 1,
            });

            const result = await service.upgradeTier2('cust-1', {
                bvn: '12345678901',
                proofOfAddressUrl: 'https://docs.bank.com/bill.pdf',
            });

            expect(result.kycTier).toBe(2);
            expect(result.dailyLimit).toBe('20000000');
        });
    });

    describe('upgradeTier3', () => {
        it('rejects if customer has not completed Tier 2', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 1, // only tier 1
            });

            await expect(
                service.upgradeTier3('cust-1', {
                    livenessToken: 'valid-liveness-token-1234',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('upgrades Tier 2 customer to Tier 3 upon valid liveness token', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                status: CustomerStatus.ACTIVE,
                kycTier: 2,
            });

            const result = await service.upgradeTier3('cust-1', {
                livenessToken: 'valid-liveness-token-1234',
            });

            expect(result.kycTier).toBe(3);
            expect(result.dailyLimit).toBe('500000000');
        });
    });

    describe('checkTransferLimit', () => {
        it('throws BadRequestException if customer is Tier 0', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                kycTier: 0,
            });

            await expect(
                service.checkTransferLimit('cust-1', 1000n),
            ).rejects.toThrow(BadRequestException);
        });

        it('allows transfer if daily limit is not exceeded', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                kycTier: 1, // Limit: 5,000,000 minor units
            });
            mockPrisma.transfer.findMany.mockResolvedValue([
                { amount: 2_000_000n }, // ₦20,000 spent today
            ]);

            // Attempt ₦20,000 more (Total: ₦40,000 < ₦50,000 limit)
            await expect(
                service.checkTransferLimit('cust-1', 2_000_000n),
            ).resolves.not.toThrow();
        });

        it('throws BadRequestException if daily limit would be exceeded', async () => {
            mockPrisma.customer.findUnique.mockResolvedValue({
                id: 'cust-1',
                kycTier: 1, // Limit: 5,000,000 minor units (₦50,000)
            });
            mockPrisma.transfer.findMany.mockResolvedValue([
                { amount: 4_000_000n }, // ₦40,000 spent today
            ]);

            // Attempt ₦15,000 more (Total: ₦55,000 > ₦50,000 limit)
            await expect(
                service.checkTransferLimit('cust-1', 1_500_000n),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
