import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AccountStatus,
    EntryDirection,
    JournalEntryType,
    TransferStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { TransfersService } from './transfers.service.js';

describe('TransfersService', () => {
    let service: TransfersService;
    let mockPrisma: any;
    let mockAccountsService: any;
    let mockLedgerService: any;
    let mockIdempotencyService: any;

    beforeEach(() => {
        mockPrisma = {
            $transaction: vi.fn((callback) => callback(mockTx)),
            transfer: {
                findUnique: vi.fn(),
                create: vi.fn(),
            },
        };

        mockAccountsService = {
            getAccountById: vi.fn(),
            getAccountByNumber: vi.fn(),
        };

        mockLedgerService = {
            getLedgerAccountByAccountId: vi.fn(),
            getOrCreateSystemAccount: vi.fn(),
            post: vi.fn(),
        };

        mockIdempotencyService = {
            computeHash: vi.fn().mockReturnValue('mock-hash'),
            checkOrReplay: vi.fn().mockResolvedValue({ isReplay: false }),
            recordInProgress: vi.fn().mockResolvedValue({}),
            recordCompleted: vi.fn().mockResolvedValue({}),
        };

        service = new TransfersService(
            mockPrisma as unknown as PrismaService,
            mockAccountsService as unknown as AccountsService,
            mockLedgerService as unknown as LedgerService,
            mockIdempotencyService as unknown as IdempotencyService,
        );
    });

    const mockTx = {
        transfer: {
            create: vi.fn().mockImplementation(({ data }) => ({
                id: 'transfer-uuid-1',
                ...data,
                createdAt: new Date(),
            })),
        },
    };

    describe('deposit', () => {
        it('throws if idempotencyKey is missing', async () => {
            await expect(
                service.deposit('cust-1', '', { accountId: 'acc-1', amount: '5000' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('replays saved response without running transaction when isReplay is true', async () => {
            const cachedResponse = { id: 'cached-tx-1', status: 'COMPLETED' };
            mockIdempotencyService.checkOrReplay.mockResolvedValue({
                isReplay: true,
                responseBody: cachedResponse,
            });

            const result = await service.deposit('cust-1', 'key-1', {
                accountId: 'acc-1',
                amount: '5000',
            });

            expect(result).toEqual(cachedResponse);
            expect(mockPrisma.$transaction).not.toHaveBeenCalled();
        });

        it('throws if destination account is not active', async () => {
            mockAccountsService.getAccountById.mockResolvedValue({
                id: 'acc-1',
                status: AccountStatus.SUSPENDED,
                currency: 'NGN',
            });

            await expect(
                service.deposit('cust-1', 'key-1', { accountId: 'acc-1', amount: '5000' }),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws if currency mismatches account currency', async () => {
            mockAccountsService.getAccountById.mockResolvedValue({
                id: 'acc-1',
                status: AccountStatus.ACTIVE,
                currency: 'NGN',
            });

            await expect(
                service.deposit('cust-1', 'key-1', {
                    accountId: 'acc-1',
                    amount: '5000',
                    currency: 'USD',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('executes atomic deposit debiting clearing account and crediting customer', async () => {
            mockAccountsService.getAccountById.mockResolvedValue({
                id: 'acc-1',
                status: AccountStatus.ACTIVE,
                currency: 'NGN',
            });
            mockLedgerService.getLedgerAccountByAccountId.mockResolvedValue({
                id: 'cust-ledger-1',
                currency: 'NGN',
            });
            mockLedgerService.getOrCreateSystemAccount.mockResolvedValue({
                id: 'clearing-ledger-1',
            });
            mockLedgerService.post.mockResolvedValue({ id: 'journal-entry-1' });

            const result = await service.deposit('cust-1', 'key-1', {
                accountId: 'acc-1',
                amount: '5000',
                description: 'Initial deposit',
            });

            expect(result.status).toBe(TransferStatus.COMPLETED);
            expect(result.amount).toBe('5000');
            expect(mockLedgerService.post).toHaveBeenCalledWith(
                mockTx,
                expect.objectContaining({
                    type: JournalEntryType.DEPOSIT,
                    lines: [
                        {
                            ledgerAccountId: 'clearing-ledger-1',
                            direction: EntryDirection.DEBIT,
                            amount: 5000n,
                            currency: 'NGN',
                        },
                        {
                            ledgerAccountId: 'cust-ledger-1',
                            direction: EntryDirection.CREDIT,
                            amount: 5000n,
                            currency: 'NGN',
                        },
                    ],
                }),
            );
            expect(mockIdempotencyService.recordCompleted).toHaveBeenCalledWith(
                mockTx,
                expect.objectContaining({
                    customerId: 'cust-1',
                    key: 'key-1',
                    responseCode: 201,
                }),
            );
        });
    });

    describe('transfer', () => {
        it('throws if source account is not active', async () => {
            mockAccountsService.getAccountById.mockResolvedValue({
                id: 'src-1',
                status: AccountStatus.CLOSED,
            });

            await expect(
                service.transfer('cust-1', 'key-1', {
                    sourceAccountId: 'src-1',
                    destinationAccountId: 'dest-1',
                    amount: '1000',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws if transferring to the same account', async () => {
            mockAccountsService.getAccountById.mockImplementation((id: string) => ({
                id,
                status: AccountStatus.ACTIVE,
                currency: 'NGN',
            }));

            await expect(
                service.transfer('cust-1', 'key-1', {
                    sourceAccountId: 'acc-1',
                    destinationAccountId: 'acc-1',
                    amount: '1000',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('throws if destination account is not active', async () => {
            mockAccountsService.getAccountById
                .mockResolvedValueOnce({ id: 'src-1', status: AccountStatus.ACTIVE, currency: 'NGN' })
                .mockResolvedValueOnce({ id: 'dest-1', status: AccountStatus.SUSPENDED, currency: 'NGN' });

            await expect(
                service.transfer('cust-1', 'key-1', {
                    sourceAccountId: 'src-1',
                    destinationAccountId: 'dest-1',
                    amount: '1000',
                }),
            ).rejects.toThrow(BadRequestException);
        });

        it('resolves destination account by 10-digit NUBAN if provided', async () => {
            mockAccountsService.getAccountById.mockResolvedValueOnce({
                id: 'src-1',
                status: AccountStatus.ACTIVE,
                currency: 'NGN',
            });
            mockAccountsService.getAccountByNumber.mockResolvedValueOnce({
                id: 'dest-2',
                status: AccountStatus.ACTIVE,
                currency: 'NGN',
            });
            mockLedgerService.getLedgerAccountByAccountId
                .mockResolvedValueOnce({ id: 'src-ledger-1' })
                .mockResolvedValueOnce({ id: 'dest-ledger-2' });
            mockLedgerService.post.mockResolvedValue({ id: 'journal-entry-transfer' });

            const result = await service.transfer('cust-1', 'key-1', {
                sourceAccountId: 'src-1',
                destinationAccountNumber: '0123456789',
                amount: '2500',
            });

            expect(mockAccountsService.getAccountByNumber).toHaveBeenCalledWith('0123456789');
            expect(result.status).toBe(TransferStatus.COMPLETED);
            expect(result.amount).toBe('2500');
        });

        it('executes atomic transfer debiting source and crediting destination', async () => {
            mockAccountsService.getAccountById
                .mockResolvedValueOnce({ id: 'src-1', status: AccountStatus.ACTIVE, currency: 'NGN' })
                .mockResolvedValueOnce({ id: 'dest-1', status: AccountStatus.ACTIVE, currency: 'NGN' });
            mockLedgerService.getLedgerAccountByAccountId
                .mockResolvedValueOnce({ id: 'src-ledger-1' })
                .mockResolvedValueOnce({ id: 'dest-ledger-1' });
            mockLedgerService.post.mockResolvedValue({ id: 'journal-entry-transfer' });

            const result = await service.transfer('cust-1', 'key-1', {
                sourceAccountId: 'src-1',
                destinationAccountId: 'dest-1',
                amount: '3000',
            });

            expect(mockLedgerService.post).toHaveBeenCalledWith(
                mockTx,
                expect.objectContaining({
                    type: JournalEntryType.TRANSFER,
                    lines: [
                        {
                            ledgerAccountId: 'src-ledger-1',
                            direction: EntryDirection.DEBIT,
                            amount: 3000n,
                            currency: 'NGN',
                        },
                        {
                            ledgerAccountId: 'dest-ledger-1',
                            direction: EntryDirection.CREDIT,
                            amount: 3000n,
                            currency: 'NGN',
                        },
                    ],
                }),
            );
            expect(result.status).toBe(TransferStatus.COMPLETED);
            expect(result.amount).toBe('3000');
        });
    });

    describe('getTransferById', () => {
        it('throws NotFoundException if transfer not found', async () => {
            mockPrisma.transfer.findUnique.mockResolvedValue(null);

            await expect(service.getTransferById('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('throws ForbiddenException if customer does not own source or destination', async () => {
            mockPrisma.transfer.findUnique.mockResolvedValue({
                id: 'tx-1',
                amount: 1000n,
                currency: 'NGN',
                status: TransferStatus.COMPLETED,
                sourceAccount: { customerId: 'other-cust-1' },
                destinationAccount: { customerId: 'other-cust-2' },
            });

            await expect(service.getTransferById('tx-1', 'cust-1')).rejects.toThrow(
                ForbiddenException,
            );
        });

        it('returns transfer details if customer owns source account', async () => {
            mockPrisma.transfer.findUnique.mockResolvedValue({
                id: 'tx-1',
                sourceAccountId: 'src-1',
                destinationAccountId: 'dest-1',
                amount: 1000n,
                currency: 'NGN',
                status: TransferStatus.COMPLETED,
                sourceAccount: { customerId: 'cust-1' },
                destinationAccount: { customerId: 'other-cust' },
                createdAt: new Date(),
            });

            const result = await service.getTransferById('tx-1', 'cust-1');
            expect(result.id).toBe('tx-1');
            expect(result.amount).toBe('1000');
        });
    });
});
