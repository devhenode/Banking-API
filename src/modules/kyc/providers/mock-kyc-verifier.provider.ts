import { Injectable, Logger } from '@nestjs/common';
import { KycVerifierProvider, VerificationResult } from './kyc-verifier.provider.js';

@Injectable()
export class MockKycVerifierProvider implements KycVerifierProvider {
    private readonly logger = new Logger(MockKycVerifierProvider.name);

    async verifyNin(nin: string): Promise<VerificationResult> {
        this.logger.log(`[MockKYC] Verifying NIN: ${nin}`);
        if (!/^[0-9]{11}$/.test(nin)) {
            return {
                valid: false,
                error: 'National Identification Number (NIN) must be exactly 11 numeric digits.',
            };
        }

        return {
            valid: true,
            metadata: {
                provider: 'MOCK_SANDBOX',
                verifiedAt: new Date().toISOString(),
                nin,
            },
        };
    }

    async verifyBvn(bvn: string): Promise<VerificationResult> {
        this.logger.log(`[MockKYC] Verifying BVN: ${bvn}`);
        if (!/^[0-9]{11}$/.test(bvn)) {
            return {
                valid: false,
                error: 'Bank Verification Number (BVN) must be exactly 11 numeric digits.',
            };
        }

        return {
            valid: true,
            metadata: {
                provider: 'MOCK_SANDBOX',
                verifiedAt: new Date().toISOString(),
                bvn,
            },
        };
    }

    async verifyProofOfAddress(documentUrl: string): Promise<VerificationResult> {
        this.logger.log(`[MockKYC] Verifying Proof of Address: ${documentUrl}`);
        if (!documentUrl || documentUrl.trim().length === 0) {
            return {
                valid: false,
                error: 'Proof of address document is required.',
            };
        }

        return {
            valid: true,
            metadata: {
                provider: 'MOCK_SANDBOX',
                verifiedAt: new Date().toISOString(),
                documentUrl,
            },
        };
    }

    async verifyLiveness(token: string): Promise<VerificationResult> {
        this.logger.log(`[MockKYC] Verifying biometric liveness session`);
        if (!token || token.trim().length < 8) {
            return {
                valid: false,
                error: 'Biometric liveness token is invalid or expired.',
            };
        }

        return {
            valid: true,
            metadata: {
                provider: 'MOCK_SANDBOX',
                confidenceScore: 0.99,
                verifiedAt: new Date().toISOString(),
            },
        };
    }
}
