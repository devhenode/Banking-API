import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import {
    EntryDirection,
    JournalEntryType,
    LedgerAccountType,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface LedgerPostingLine {
    ledgerAccountId: string;
    direction: EntryDirection;
    amount: bigint;
    currency: string;
}

export interface PostLedgerEntryDto {
    type: JournalEntryType;
    description?: string;
    reversesId?: string;
    lines: LedgerPostingLine[];
}

@Injectable()
export class LedgerService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Creates the money wallet for a customer bank account.
     * Customer accounts are LIABILITIES for the bank (the bank owes that money).
     */
    async createCustomerAccount(
        tx: Prisma.TransactionClient,
        data: { accountId: string; currency: string },
    ) {
        return tx.ledgerAccount.create({
            data: {
                accountId: data.accountId,
                currency: data.currency,
                type: LedgerAccountType.LIABILITY,
                balance: 0n,
            },
        });
    }

    /**
     * Retrieves or creates an internal bank ledger account (e.g. CLEARING_NGN, FEE_INCOME_NGN).
     * Internal accounts use the unique 'code' column (accountId is NULL).
     */
    async getOrCreateSystemAccount(
        tx: Prisma.TransactionClient,
        data: { code: string; type: LedgerAccountType; currency?: string },
    ) {
        const currency = data.currency ?? 'NGN';
        const existing = await tx.ledgerAccount.findUnique({
            where: { code: data.code },
        });

        if (existing) {
            return existing;
        }

        return tx.ledgerAccount.create({
            data: {
                code: data.code,
                type: data.type,
                currency,
                balance: 0n,
            },
        });
    }

    /**
     * Retrieves the ledger account associated with a customer account ID.
     */
    async getLedgerAccountByAccountId(accountId: string) {
        return this.prisma.ledgerAccount.findUnique({
            where: { accountId },
        });
    }

    /**
     * The core double-entry posting engine.
     * Enforces:
     * 1. Minimum 2 lines (debit & credit)
     * 2. Positive amounts (amount > 0)
     * 3. Currency matching
     * 4. Double-entry invariant: Sum(Debits) === Sum(Credits)
     * 5. Deadlock prevention: Pessimistic row locking (FOR UPDATE) in sorted ID order
     * 6. Overdraft invariant: Customer accounts (LIABILITY) cannot have negative balances
     */
    async post(tx: Prisma.TransactionClient, entry: PostLedgerEntryDto) {
        if (!entry.lines || entry.lines.length < 2) {
            throw new BadRequestException('A journal entry must contain at least 2 lines.');
        }

        // 1. Verify positive amounts and calculate debits/credits
        let totalDebits = 0n;
        let totalCredits = 0n;

        for (const line of entry.lines) {
            if (line.amount <= 0n) {
                throw new BadRequestException('Each ledger line amount must be greater than zero.');
            }

            if (line.direction === EntryDirection.DEBIT) {
                totalDebits += line.amount;
            } else if (line.direction === EntryDirection.CREDIT) {
                totalCredits += line.amount;
            } else {
                throw new BadRequestException('Invalid entry direction.');
            }
        }

        // 2. Double-entry invariant: Debits must balance Credits
        if (totalDebits !== totalCredits) {
            throw new BadRequestException(
                `Unbalanced entry: debits (${totalDebits}) do not equal credits (${totalCredits}).`,
            );
        }

        // 3. Acquire pessimistic row locks in SORTED ID order to prevent deadlocks (ADR-05)
        const uniqueIds = [...new Set(entry.lines.map((l) => l.ledgerAccountId))].sort();

        const lockedAccounts = await tx.$queryRaw<
            Array<{
                id: string;
                balance: bigint;
                currency: string;
                type: LedgerAccountType;
            }>
        >`
      SELECT id, balance, currency, type
      FROM ledger_accounts
      WHERE id = ANY(${uniqueIds}::uuid[])
      ORDER BY id ASC
      FOR UPDATE
    `;

        if (lockedAccounts.length !== uniqueIds.length) {
            throw new NotFoundException('One or more ledger accounts not found.');
        }

        const accountsMap = new Map<string, { balance: bigint; currency: string; type: LedgerAccountType }>();
        for (const acc of lockedAccounts) {
            accountsMap.set(acc.id, {
                balance: BigInt(acc.balance),
                currency: acc.currency,
                type: acc.type,
            });
        }

        // 4. Calculate updated balances & enforce accounting invariants
        const newBalances = new Map<string, bigint>();

        for (const line of entry.lines) {
            const current = accountsMap.get(line.ledgerAccountId)!;

            if (current.currency !== line.currency) {
                throw new BadRequestException(
                    `Currency mismatch: line currency (${line.currency}) does not match account currency (${current.currency}).`,
                );
            }

            let runningBalance = newBalances.get(line.ledgerAccountId) ?? current.balance;

            // Normal balance sign rules:
            // LIABILITY (Customer deposits): Credit increases, Debit decreases
            // ASSET (Cash/Clearing): Debit increases, Credit decreases
            // REVENUE (Fee income): Credit increases, Debit decreases
            // EXPENSE: Debit increases, Credit decreases
            if (current.type === LedgerAccountType.LIABILITY) {
                if (line.direction === EntryDirection.CREDIT) {
                    runningBalance += line.amount;
                } else {
                    runningBalance -= line.amount;
                    // Invariant: Customer cannot spend money they do not have (no overdraft)
                    if (runningBalance < 0n) {
                        throw new BadRequestException('Insufficient funds in account.');
                    }
                }
            } else if (current.type === LedgerAccountType.ASSET) {
                if (line.direction === EntryDirection.DEBIT) {
                    runningBalance += line.amount;
                } else {
                    runningBalance -= line.amount;
                }
            } else if (current.type === LedgerAccountType.REVENUE) {
                if (line.direction === EntryDirection.CREDIT) {
                    runningBalance += line.amount;
                } else {
                    runningBalance -= line.amount;
                }
            } else if (current.type === LedgerAccountType.EXPENSE) {
                if (line.direction === EntryDirection.DEBIT) {
                    runningBalance += line.amount;
                } else {
                    runningBalance -= line.amount;
                }
            } else {
                // EQUITY
                if (line.direction === EntryDirection.CREDIT) {
                    runningBalance += line.amount;
                } else {
                    runningBalance -= line.amount;
                }
            }

            newBalances.set(line.ledgerAccountId, runningBalance);
        }

        // 5. Create immutable journal entry + ledger lines
        const journalEntry = await tx.journalEntry.create({
            data: {
                type: entry.type,
                description: entry.description,
                reversesId: entry.reversesId,
                lines: {
                    create: entry.lines.map((l) => ({
                        ledgerAccountId: l.ledgerAccountId,
                        direction: l.direction,
                        amount: l.amount,
                        currency: l.currency,
                    })),
                },
            },
            include: {
                lines: true,
            },
        });

        // 6. Update cached balance on each touched ledger account
        for (const [id, balance] of newBalances.entries()) {
            await tx.ledgerAccount.update({
                where: { id },
                data: { balance },
            });
        }

        return journalEntry;
    }

    /**
     * Retrieves the current balance for an account from the ledger.
     */
    async getAccountBalance(accountId: string) {
        const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
            where: { accountId },
        });

        if (!ledgerAccount) {
            return null;
        }

        return {
            accountId,
            currency: ledgerAccount.currency,
            balance: ledgerAccount.balance.toString(),
            updatedAt: ledgerAccount.updatedAt,
        };
    }

    /**
     * Retrieves the transaction history lines posted to this account's ledger wallet.
     */
    async getAccountHistory(accountId: string, limit = 50) {
        const ledgerAccount = await this.prisma.ledgerAccount.findUnique({
            where: { accountId },
        });

        if (!ledgerAccount) {
            return [];
        }

        const lines = await this.prisma.ledgerLine.findMany({
            where: { ledgerAccountId: ledgerAccount.id },
            include: {
                journalEntry: {
                    select: {
                        id: true,
                        type: true,
                        description: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return lines.map((line) => ({
            id: line.id,
            journalEntryId: line.journalEntryId,
            type: line.journalEntry.type,
            description: line.journalEntry.description,
            direction: line.direction,
            amount: line.amount.toString(),
            currency: line.currency,
            createdAt: line.createdAt,
        }));
    }
}
