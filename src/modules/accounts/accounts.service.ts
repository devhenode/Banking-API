import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, AccountType, CustomerStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';
import { NubanService } from './nuban.service.js';

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly nubanService: NubanService,
  ) {}

  /**
   * Opens a new bank account for an active customer.
   * Atomically generates NUBAN, creates the account row, and instructs
   * LedgerService to create the corresponding ledger wallet in one transaction.
   */
  async createAccount(customerId: string, dto: CreateAccountDto) {
    // 1. Verify customer exists and is ACTIVE
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found.');
    }

    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new BadRequestException(
        'Account opening requires an active customer profile. Please verify your OTP first.',
      );
    }

    const currency = dto.currency ?? 'NGN';

    // 2. Open Account and LedgerAccount atomically in one transaction
    return this.prisma.$transaction(async (tx) => {
      // Generate a unique 10-digit NUBAN with collision retry
      let accountNumber = '';
      let attempts = 0;
      while (attempts < 5) {
        accountNumber = this.nubanService.generate();
        const existing = await tx.account.findUnique({
          where: { accountNumber },
        });
        if (!existing) break;
        attempts++;
      }

      if (attempts >= 5) {
        throw new ConflictException(
          'Failed to generate a unique account number. Please try again.',
        );
      }

      // Create account row
      const account = await tx.account.create({
        data: {
          customerId: customer.id,
          accountNumber,
          type: dto.type ?? AccountType.SAVINGS,
          currency,
          status: AccountStatus.ACTIVE,
        },
      });

      // Instruct LedgerService to create the ledger wallet (ADR-09: single owner)
      await this.ledgerService.createCustomerAccount(tx, {
        accountId: account.id,
        currency,
      });

      return account;
    });
  }

  /**
   * Retrieves all bank accounts belonging to a customer.
   */
  async getCustomerAccounts(customerId: string) {
    return this.prisma.account.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves a single account by ID, verifying customer ownership if customerId is provided.
   */
  async getAccountById(accountId: string, customerId?: string) {
    const account = await this.prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException('Account not found.');
    }

    if (customerId && account.customerId !== customerId) {
      throw new ForbiddenException('Access to this account is denied.');
    }

    return account;
  }

  /**
   * Retrieves an account by its 10-digit NUBAN number.
   */
  async getAccountByNumber(accountNumber: string) {
    const account = await this.prisma.account.findUnique({
      where: { accountNumber },
    });

    if (!account) {
      throw new NotFoundException(`Account with number ${accountNumber} not found.`);
    }

    return account;
  }

  /**
   * Reads account balance via LedgerService (ADR-13 & ADR-10).
   */
  async getAccountBalance(accountId: string, customerId?: string) {
    await this.getAccountById(accountId, customerId);
    const balance = await this.ledgerService.getAccountBalance(accountId);

    if (!balance) {
      throw new NotFoundException('Ledger account not found.');
    }

    return balance;
  }

  /**
   * Reads account transaction history via LedgerService.
   */
  async getAccountHistory(accountId: string, customerId?: string) {
    await this.getAccountById(accountId, customerId);
    return this.ledgerService.getAccountHistory(accountId);
  }
}
