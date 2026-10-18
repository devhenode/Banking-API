import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

describe('TransfersController', () => {
    let controller: TransfersController;
    let mockService: {
        deposit: ReturnType<typeof vi.fn>;
        transfer: ReturnType<typeof vi.fn>;
        getTransferById: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        mockService = {
            deposit: vi.fn(),
            transfer: vi.fn(),
            getTransferById: vi.fn(),
        };

        controller = new TransfersController(mockService as unknown as TransfersService);
    });

    it('deposit delegates to transfersService.deposit', async () => {
        mockService.deposit.mockResolvedValue({ id: 'tx-1', status: 'COMPLETED' });

        const dto = { accountId: 'acc-1', amount: '5000' };
        const result = await controller.deposit({ sub: 'cust-1' }, 'key-1', dto);

        expect(mockService.deposit).toHaveBeenCalledWith('cust-1', 'key-1', dto);
        expect(result).toEqual({ id: 'tx-1', status: 'COMPLETED' });
    });

    it('transfer delegates to transfersService.transfer', async () => {
        mockService.transfer.mockResolvedValue({ id: 'tx-2', status: 'COMPLETED' });

        const dto = { sourceAccountId: 'acc-1', destinationAccountId: 'acc-2', amount: '1000' };
        const result = await controller.transfer({ sub: 'cust-1' }, 'key-2', dto);

        expect(mockService.transfer).toHaveBeenCalledWith('cust-1', 'key-2', dto);
        expect(result).toEqual({ id: 'tx-2', status: 'COMPLETED' });
    });

    it('getTransfer delegates to transfersService.getTransferById', async () => {
        mockService.getTransferById.mockResolvedValue({ id: 'tx-3', amount: '500' });

        const result = await controller.getTransfer({ sub: 'cust-1' }, 'tx-3');

        expect(mockService.getTransferById).toHaveBeenCalledWith('tx-3', 'cust-1');
        expect(result).toEqual({ id: 'tx-3', amount: '500' });
    });
});
