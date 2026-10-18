import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { LedgerAccountType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';


@Injectable()
export class LedgerService {
    constructor(private readonly prisma: PrismaService) {}

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
