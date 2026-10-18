export interface VerificationResult {
    valid: boolean;
    error?: string;
    metadata?: Record<string, unknown>;
}

/**
 * Abstract Adapter contract for KYC identity verification providers.
 * Allows swapping between mock sandbox in development and real third-party providers
 * (e.g. SmileID, Prembly, Dojeh, Seamfix) in production via NestJS dependency injection.
 */
export abstract class KycVerifierProvider {
    abstract verifyNin(nin: string): Promise<VerificationResult>;
    abstract verifyBvn(bvn: string): Promise<VerificationResult>;
    abstract verifyProofOfAddress(documentUrl: string): Promise<VerificationResult>;
    abstract verifyLiveness(token: string): Promise<VerificationResult>;
}
