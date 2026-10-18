import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    CustomerStatus,
    KycDocumentType,
    KycVerificationStatus,
    TransferStatus,
} from '../../generated/prisma/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { UpgradeTier1Dto } from './dto/tier-1.dto.js';
import { UpgradeTier2Dto } from './dto/tier-2.dto.js';
import { UpgradeTier3Dto } from './dto/tier-3.dto.js';
import { KycVerifierProvider } from './providers/kyc-verifier.provider.js';

export const KYC_TIER_LIMITS: Record<number, bigint> = {
    0: 0n, // Tier 0: ₦0 (Cannot transfer money)
    1: 5_000_000n, // Tier 1: ₦50,000.00 / day
    2: 20_000_000n, // Tier 2: ₦200,000.00 / day
    3: 500_000_000n, // Tier 3: ₦5,000,000.00 / day
};

@Injectable()
export class KycService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly kycVerifier: KycVerifierProvider,
    ) { }

    /**
     * Retrieves current customer's KYC tier, daily limit, and remaining allowance today.
     */
    async getKycStatus(customerId: string) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found.');
        }

        const tier = customer.kycTier;
        const dailyLimit = KYC_TIER_LIMITS[tier] ?? 0n;

        const todayMidnight = new Date();
        todayMidnight.setUTCHours(0, 0, 0, 0);

        const todayTransfers = await this.prisma.transfer.findMany({
            where: {
                sourceAccount: { customerId },
                status: TransferStatus.COMPLETED,
                createdAt: { gte: todayMidnight },
            },
            select: { amount: true },
        });

        const totalSpentToday = todayTransfers.reduce(
            (sum, t) => sum + t.amount,
            0n,
        );

        const remainingLimit = dailyLimit > totalSpentToday ? dailyLimit - totalSpentToday : 0n;

        return {
            customerId,
            kycTier: tier,
            dailyLimit: dailyLimit.toString(),
            totalSpentToday: totalSpentToday.toString(),
            remainingLimit: remainingLimit.toString(),
        };
    }

    /**
     * Upgrades customer to KYC Tier 1 using an 11-digit NIN.
     */
    async upgradeTier1(customerId: string, dto: UpgradeTier1Dto) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found.');
        }

        if (customer.status !== CustomerStatus.ACTIVE) {
            throw new BadRequestException('Customer profile is not active.');
        }

        const result = await this.kycVerifier.verifyNin(dto.nin);
        if (!result.valid) {
            throw new BadRequestException(result.error ?? 'NIN verification failed.');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.kycVerification.create({
                data: {
                    customerId: customer.id,
                    tier: 1,
                    documentType: KycDocumentType.NIN,
                    documentNumber: dto.nin,
                    status: KycVerificationStatus.VERIFIED,
                    metadata: (result.metadata ?? {}) as Prisma.InputJsonValue,
                },
            });

            const newTier = Math.max(customer.kycTier, 1);
            await tx.customer.update({
                where: { id: customer.id },
                data: { kycTier: newTier },
            });

            return {
                message: 'Successfully upgraded to KYC Tier 1.',
                kycTier: newTier,
                dailyLimit: (KYC_TIER_LIMITS[newTier] ?? 0n).toString(),
            };
        });
    }

    /**
     * Upgrades customer to KYC Tier 2 using BVN and Proof of Address.
     * Prerequisite: Must already be at least Tier 1.
     */
    async upgradeTier2(customerId: string, dto: UpgradeTier2Dto) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found.');
        }

        if (customer.status !== CustomerStatus.ACTIVE) {
            throw new BadRequestException('Customer profile is not active.');
        }

        if (customer.kycTier < 1) {
            throw new BadRequestException(
                'Must complete Tier 1 verification (NIN) before upgrading to Tier 2.',
            );
        }

        const bvnResult = await this.kycVerifier.verifyBvn(dto.bvn);
        if (!bvnResult.valid) {
            throw new BadRequestException(bvnResult.error ?? 'BVN verification failed.');
        }

        const addressResult = await this.kycVerifier.verifyProofOfAddress(dto.proofOfAddressUrl);
        if (!addressResult.valid) {
            throw new BadRequestException(addressResult.error ?? 'Proof of address verification failed.');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.kycVerification.create({
                data: {
                    customerId: customer.id,
                    tier: 2,
                    documentType: KycDocumentType.BVN,
                    documentNumber: dto.bvn,
                    status: KycVerificationStatus.VERIFIED,
                    metadata: (bvnResult.metadata ?? {}) as Prisma.InputJsonValue,
                },
            });

            await tx.kycVerification.create({
                data: {
                    customerId: customer.id,
                    tier: 2,
                    documentType: KycDocumentType.PROOF_OF_ADDRESS,
                    documentNumber: dto.proofOfAddressUrl,
                    status: KycVerificationStatus.VERIFIED,
                    metadata: (addressResult.metadata ?? {}) as Prisma.InputJsonValue,
                },
            });

            const newTier = Math.max(customer.kycTier, 2);
            await tx.customer.update({
                where: { id: customer.id },
                data: { kycTier: newTier },
            });

            return {
                message: 'Successfully upgraded to KYC Tier 2.',
                kycTier: newTier,
                dailyLimit: (KYC_TIER_LIMITS[newTier] ?? 0n).toString(),
            };
        });
    }

    /**
     * Upgrades customer to KYC Tier 3 using Biometric Liveness verification.
     * Prerequisite: Must already be at least Tier 2.
     */
    async upgradeTier3(customerId: string, dto: UpgradeTier3Dto) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found.');
        }

        if (customer.status !== CustomerStatus.ACTIVE) {
            throw new BadRequestException('Customer profile is not active.');
        }

        if (customer.kycTier < 2) {
            throw new BadRequestException(
                'Must complete Tier 2 verification (BVN + Address) before upgrading to Tier 3.',
            );
        }

        const livenessResult = await this.kycVerifier.verifyLiveness(dto.livenessToken);
        if (!livenessResult.valid) {
            throw new BadRequestException(livenessResult.error ?? 'Biometric liveness verification failed.');
        }

        return this.prisma.$transaction(async (tx) => {
            await tx.kycVerification.create({
                data: {
                    customerId: customer.id,
                    tier: 3,
                    documentType: KycDocumentType.LIVENESS,
                    status: KycVerificationStatus.VERIFIED,
                    metadata: (livenessResult.metadata ?? {}) as Prisma.InputJsonValue,
                },
            });

            const newTier = 3;
            await tx.customer.update({
                where: { id: customer.id },
                data: { kycTier: newTier },
            });

            return {
                message: 'Successfully upgraded to KYC Tier 3.',
                kycTier: newTier,
                dailyLimit: (KYC_TIER_LIMITS[newTier] ?? 0n).toString(),
            };
        });
    }

    /**
     * Enforces the customer's daily transfer limit policy before a transfer is committed.
     * Throws BadRequestException (400) if the transfer would exceed the daily allowance.
     */
    async checkTransferLimit(customerId: string, amount: bigint): Promise<void> {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
        });

        if (!customer) {
            throw new NotFoundException('Customer not found.');
        }

        const tier = customer.kycTier;
        const dailyLimit = KYC_TIER_LIMITS[tier] ?? 0n;

        if (dailyLimit === 0n) {
            throw new BadRequestException(
                'Transfers are disabled for KYC Tier 0. Please verify your NIN to upgrade to Tier 1.',
            );
        }

        const todayMidnight = new Date();
        todayMidnight.setUTCHours(0, 0, 0, 0);

        const todayTransfers = await this.prisma.transfer.findMany({
            where: {
                sourceAccount: { customerId },
                status: TransferStatus.COMPLETED,
                createdAt: { gte: todayMidnight },
            },
            select: { amount: true },
        });

        const totalSpentToday = todayTransfers.reduce(
            (sum, t) => sum + t.amount,
            0n,
        );

        if (totalSpentToday + amount > dailyLimit) {
            const limitInNaira = (dailyLimit / 100n).toLocaleString();
            const spentInNaira = (totalSpentToday / 100n).toLocaleString();
            throw new BadRequestException(
                `Daily transfer limit of ₦${limitInNaira} exceeded for KYC Tier ${tier}. You have spent ₦${spentInNaira} today. Upgrade your KYC tier to increase your limit.`,
            );
        }
    }
}
