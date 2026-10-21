import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    AccountStatus,
    EntryDirection,
    JournalEntryType,
    LedgerAccountType,
    TransferStatus,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { KycService } from '../kyc/kyc.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { OutboxService } from '../outbox/outbox.service.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { DepositDto } from './dto/deposit.dto.js';

@Injectable()
export class TransfersService {
    private readonly logger = new Logger(TransfersService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly accountsService: AccountsService,
        private readonly ledgerService: LedgerService,
        private readonly idempotencyService: IdempotencyService,
        private readonly kycService: KycService,
        private readonly notificationsService: NotificationsService,
        private readonly outboxService: OutboxService,
    ) { }

    /**
     * Executes an external deposit into a customer account.
     * Enforces:
     * - Idempotency lookup and replay.
     * - Account ownership and ACTIVE status verification.
     * - Single atomic transaction:
     *   1. Idempotency recorded as IN_PROGRESS.
     *   2. Bank clearing account (Asset) debited.
     *   3. Customer wallet (Liability) credited via LedgerService.post().
     *   4. Transfer recorded and marked COMPLETED.
     *   5. Idempotency updated to COMPLETED with cached response.
     */
    async deposit(customerId: string, idempotencyKey: string, dto: DepositDto) {
        if (!idempotencyKey) {
            throw new BadRequestException('Idempotency-Key header is required.');
        }

        const requestHash = this.idempotencyService.computeHash('POST', '/transfers/deposit', dto);
        const check = await this.idempotencyService.checkOrReplay(customerId, idempotencyKey, requestHash);

        if (check.isReplay) {
            return check.responseBody;
        }

        const account = await this.accountsService.getAccountById(dto.accountId, customerId);
        if (account.status !== AccountStatus.ACTIVE) {
            throw new BadRequestException('Destination account is not active.');
        }

        const currency = dto.currency ?? account.currency;
        if (currency !== account.currency) {
            throw new BadRequestException(
                `Currency mismatch: deposit currency (${currency}) does not match account currency (${account.currency}).`,
            );
        }

        const amountBigInt = BigInt(dto.amount);
        const customerLedger = await this.ledgerService.getLedgerAccountByAccountId(account.id);
        if (!customerLedger) {
            throw new NotFoundException('Customer ledger wallet not found.');
        }

        return this.prisma.$transaction(async (tx) => {
            await this.idempotencyService.recordInProgress(tx, {
                customerId,
                key: idempotencyKey,
                requestHash,
            });


            const clearingAccount = await this.ledgerService.getOrCreateSystemAccount(tx, {
                code: `CLEARING_${currency}`,
                type: LedgerAccountType.ASSET,
                currency,
            });

            const journalEntry = await this.ledgerService.post(tx, {
                type: JournalEntryType.DEPOSIT,
                description: dto.description ?? 'Account deposit',
                lines: [
                    {
                        ledgerAccountId: clearingAccount.id,
                        direction: EntryDirection.DEBIT,
                        amount: amountBigInt,
                        currency,
                    },
                    {
                        ledgerAccountId: customerLedger.id,
                        direction: EntryDirection.CREDIT,
                        amount: amountBigInt,
                        currency,
                    },
                ],
            });

            const transfer = await tx.transfer.create({
                data: {
                    destinationAccountId: account.id,
                    amount: amountBigInt,
                    currency,
                    status: TransferStatus.COMPLETED,
                    journalEntryId: journalEntry.id,
                    description: dto.description ?? 'Account deposit',
                },
            });

            // Transactional Outbox: atomically persist event alongside the transfer
            await this.outboxService.emit(tx, {
                aggregateType: 'Transfer',
                aggregateId: transfer.id,
                eventType: 'banking.transfers.deposited',
                payload: {
                    transferId: transfer.id,
                    destinationAccountId: account.id,
                    amount: transfer.amount.toString(),
                    currency: transfer.currency,
                    customerId,
                    journalEntryId: journalEntry.id,
                    description: dto.description ?? 'Account deposit',
                    createdAt: transfer.createdAt.toISOString(),
                },
            });

            const responsePayload = {
                id: transfer.id,
                type: 'DEPOSIT',
                destinationAccountId: account.id,
                amount: transfer.amount.toString(),
                currency: transfer.currency,
                status: transfer.status,
                journalEntryId: transfer.journalEntryId,
                createdAt: transfer.createdAt,
            };

            await this.idempotencyService.recordCompleted(tx, {
                customerId,
                key: idempotencyKey,
                responseCode: 201,
                responseBody: responsePayload,
            });

            return responsePayload;
        });
    }

    /**
     * Executes an internal transfer between two customer accounts.
     * Enforces:
     * - Idempotency lookup and replay.
     * - Source account ownership by current authenticated customer.
     * - Both source and destination accounts must be ACTIVE.
     * - Blocks self-transfers to the exact same account.
     * - Same-currency validation.
     * - Single atomic transaction:
     *   1. Idempotency recorded as IN_PROGRESS.
     *   2. LedgerService.post() executes deadlock-free row locking, balance check, and debit/credit posting.
     *   3. Transfer record inserted with status COMPLETED.
     *   4. Idempotency record updated with cached response.
     */
    async transfer(customerId: string, idempotencyKey: string, dto: CreateTransferDto) {
        if (!idempotencyKey) {
            throw new BadRequestException('Idempotency-Key header is required.');
        }

        const requestHash = this.idempotencyService.computeHash('POST', '/transfers', dto);
        const check = await this.idempotencyService.checkOrReplay(customerId, idempotencyKey, requestHash);

        if (check.isReplay) {
            return check.responseBody;
        }

        const sourceAccount = await this.accountsService.getAccountById(dto.sourceAccountId, customerId);
        if (sourceAccount.status !== AccountStatus.ACTIVE) {
            throw new BadRequestException('Source account is not active.');
        }

        let destinationAccount;
        if (dto.destinationAccountId) {
            destinationAccount = await this.accountsService.getAccountById(dto.destinationAccountId);
        } else if (dto.destinationAccountNumber) {
            destinationAccount = await this.accountsService.getAccountByNumber(dto.destinationAccountNumber);
        } else {
            throw new BadRequestException(
                'Either destinationAccountId or destinationAccountNumber must be provided.',
            );
        }

        if (sourceAccount.id === destinationAccount.id) {
            throw new BadRequestException('Cannot transfer money to the same account.');
        }

        if (destinationAccount.status !== AccountStatus.ACTIVE) {
            throw new BadRequestException('Destination account is not active.');
        }

        if (sourceAccount.currency !== destinationAccount.currency) {
            throw new BadRequestException('Cross-currency transfers are not supported in Phase 1.');
        }

        const amountBigInt = BigInt(dto.amount);

        // Enforce daily KYC spending limits (ADR-12: policy at the top)
        await this.kycService.checkTransferLimit(customerId, amountBigInt);

        const sourceLedger = await this.ledgerService.getLedgerAccountByAccountId(sourceAccount.id);
        const destLedger = await this.ledgerService.getLedgerAccountByAccountId(destinationAccount.id);

        if (!sourceLedger || !destLedger) {
            throw new NotFoundException('One or more account ledger wallets could not be found.');
        }

        const result = await this.prisma.$transaction(async (tx) => {
            await this.idempotencyService.recordInProgress(tx, {
                customerId,
                key: idempotencyKey,
                requestHash,
            });

            const journalEntry = await this.ledgerService.post(tx, {
                type: JournalEntryType.TRANSFER,
                description: dto.description ?? 'Account transfer',
                lines: [
                    {
                        ledgerAccountId: sourceLedger.id,
                        direction: EntryDirection.DEBIT,
                        amount: amountBigInt,
                        currency: sourceAccount.currency,
                    },
                    {
                        ledgerAccountId: destLedger.id,
                        direction: EntryDirection.CREDIT,
                        amount: amountBigInt,
                        currency: destinationAccount.currency,
                    },
                ],
            });

            const transfer = await tx.transfer.create({
                data: {
                    sourceAccountId: sourceAccount.id,
                    destinationAccountId: destinationAccount.id,
                    amount: amountBigInt,
                    currency: sourceAccount.currency,
                    status: TransferStatus.COMPLETED,
                    journalEntryId: journalEntry.id,
                    description: dto.description ?? 'Account transfer',
                },
            });

            // Transactional Outbox: atomically persist event alongside the transfer
            await this.outboxService.emit(tx, {
                aggregateType: 'Transfer',
                aggregateId: transfer.id,
                eventType: 'banking.transfers.completed',
                payload: {
                    transferId: transfer.id,
                    sourceAccountId: sourceAccount.id,
                    destinationAccountId: destinationAccount.id,
                    amount: transfer.amount.toString(),
                    currency: sourceAccount.currency,
                    customerId,
                    journalEntryId: journalEntry.id,
                    description: dto.description ?? 'Account transfer',
                    createdAt: transfer.createdAt.toISOString(),
                },
            });

            const responsePayload = {
                id: transfer.id,
                type: 'TRANSFER',
                sourceAccountId: sourceAccount.id,
                destinationAccountId: destinationAccount.id,
                amount: transfer.amount.toString(),
                currency: transfer.currency,
                status: transfer.status,
                journalEntryId: transfer.journalEntryId,
                createdAt: transfer.createdAt,
            };

            await this.idempotencyService.recordCompleted(tx, {
                customerId,
                key: idempotencyKey,
                responseCode: 201,
                responseBody: responsePayload,
            });

            return responsePayload;
        });

        // Enqueue background debit & credit alerts via BullMQ (non-blocking)
        this.dispatchTransferAlerts(
            customerId,
            sourceAccount,
            destinationAccount,
            dto.amount,
            result.id,
        ).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to dispatch transfer alerts: ${message}`);
        });

        return result;
    }

    private async dispatchTransferAlerts(
        senderCustomerId: string,
        sourceAccount: { id: string; accountNumber: string; currency: string },
        destinationAccount: { id: string; accountNumber: string; currency: string; customerId: string },
        amount: string,
        reference: string,
    ): Promise<void> {
        const [sender, recipient] = await Promise.all([
            this.prisma.customer.findUnique({
                where: { id: senderCustomerId },
                select: { email: true, phone: true, firstName: true, lastName: true },
            }),
            this.prisma.customer.findUnique({
                where: { id: destinationAccount.customerId },
                select: { email: true, phone: true, firstName: true, lastName: true },
            }),
        ]);

        const senderTarget = sender?.phone ?? sender?.email;
        const recipientTarget = recipient?.phone ?? recipient?.email;
        const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : sourceAccount.accountNumber;
        const recipientName = recipient ? `${recipient.firstName} ${recipient.lastName}`.trim() : destinationAccount.accountNumber;

        if (senderTarget) {
            await this.notificationsService.sendTransferAlert({
                to: senderTarget,
                accountNumber: sourceAccount.accountNumber,
                type: 'DEBIT',
                amount,
                currency: sourceAccount.currency,
                counterparty: recipientName,
                reference,
            });
        }

        if (recipientTarget) {
            await this.notificationsService.sendTransferAlert({
                to: recipientTarget,
                accountNumber: destinationAccount.accountNumber,
                type: 'CREDIT',
                amount,
                currency: destinationAccount.currency,
                counterparty: senderName,
                reference,
            });
        }
    }

    /**
     * Retrieves a single transfer by ID with customer ownership validation.
     */
    async getTransferById(transferId: string, customerId?: string) {
        const transfer = await this.prisma.transfer.findUnique({
            where: { id: transferId },
            include: {
                sourceAccount: true,
                destinationAccount: true,
            },
        });

        if (!transfer) {
            throw new NotFoundException('Transfer not found.');
        }

        if (customerId) {
            const ownsSource = transfer.sourceAccount?.customerId === customerId;
            const ownsDestination = transfer.destinationAccount.customerId === customerId;
            if (!ownsSource && !ownsDestination) {
                throw new ForbiddenException('Access to this transfer record is denied.');
            }
        }

        return {
            id: transfer.id,
            sourceAccountId: transfer.sourceAccountId,
            destinationAccountId: transfer.destinationAccountId,
            amount: transfer.amount.toString(),
            currency: transfer.currency,
            status: transfer.status,
            journalEntryId: transfer.journalEntryId,
            description: transfer.description,
            createdAt: transfer.createdAt,
        };
    }
}
