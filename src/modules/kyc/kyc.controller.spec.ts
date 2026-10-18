import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KycController } from './kyc.controller.js';
import { KycService } from './kyc.service.js';

describe('KycController', () => {
    let controller: KycController;
    let mockService: {
        getKycStatus: ReturnType<typeof vi.fn>;
        upgradeTier1: ReturnType<typeof vi.fn>;
        upgradeTier2: ReturnType<typeof vi.fn>;
        upgradeTier3: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockService = {
            getKycStatus: vi.fn(),
            upgradeTier1: vi.fn(),
            upgradeTier2: vi.fn(),
            upgradeTier3: vi.fn(),
        };

        controller = new KycController(mockService as unknown as KycService);
    });

    it('getStatus delegates to kycService.getKycStatus', async () => {
        mockService.getKycStatus.mockResolvedValue({ kycTier: 1, dailyLimit: '5000000' });

        const result = await controller.getStatus({ sub: 'cust-1' });

        expect(mockService.getKycStatus).toHaveBeenCalledWith('cust-1');
        expect(result).toEqual({ kycTier: 1, dailyLimit: '5000000' });
    });

    it('upgradeTier1 delegates to kycService.upgradeTier1', async () => {
        mockService.upgradeTier1.mockResolvedValue({ kycTier: 1 });

        const dto = { nin: '12345678901' };
        const result = await controller.upgradeTier1({ sub: 'cust-1' }, dto);

        expect(mockService.upgradeTier1).toHaveBeenCalledWith('cust-1', dto);
        expect(result).toEqual({ kycTier: 1 });
    });

    it('upgradeTier2 delegates to kycService.upgradeTier2', async () => {
        mockService.upgradeTier2.mockResolvedValue({ kycTier: 2 });

        const dto = { bvn: '12345678901', proofOfAddressUrl: 'https://bill.pdf' };
        const result = await controller.upgradeTier2({ sub: 'cust-1' }, dto);

        expect(mockService.upgradeTier2).toHaveBeenCalledWith('cust-1', dto);
        expect(result).toEqual({ kycTier: 2 });
    });

    it('upgradeTier3 delegates to kycService.upgradeTier3', async () => {
        mockService.upgradeTier3.mockResolvedValue({ kycTier: 3 });

        const dto = { livenessToken: 'valid-token-123' };
        const result = await controller.upgradeTier3({ sub: 'cust-1' }, dto);

        expect(mockService.upgradeTier3).toHaveBeenCalledWith('cust-1', dto);
        expect(result).toEqual({ kycTier: 3 });
    });
});
