import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EntryDirection, JournalEntryType, LedgerAccountType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LedgerService } from './ledger.service.js';

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: PrismaService,
          useValue: {
            ledgerAccount: {
              findUnique: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            ledgerLine: {
              findMany: vi.fn(),
            },
            journalEntry: {
              create: vi.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('post()', () => {
    it('should reject entries with fewer than 2 lines', async () => {
      const tx = {} as any;
      await expect(
        service.post(tx, {
          type: JournalEntryType.DEPOSIT,
          lines: [
            {
              ledgerAccountId: '018f6e80-873b-782a-bb57-1941df5e8c14',
              direction: EntryDirection.CREDIT,
              amount: 5000n,
              currency: 'NGN',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject entries with non-positive amounts', async () => {
      const tx = {} as any;
      await expect(
        service.post(tx, {
          type: JournalEntryType.TRANSFER,
          lines: [
            {
              ledgerAccountId: '018f6e80-873b-782a-bb57-1941df5e8c14',
              direction: EntryDirection.DEBIT,
              amount: 0n,
              currency: 'NGN',
            },
            {
              ledgerAccountId: '018f6e80-873b-782a-bb57-1941df5e8c15',
              direction: EntryDirection.CREDIT,
              amount: 0n,
              currency: 'NGN',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unbalanced entries where debits != credits', async () => {
      const tx = {} as any;
      await expect(
        service.post(tx, {
          type: JournalEntryType.TRANSFER,
          lines: [
            {
              ledgerAccountId: '018f6e80-873b-782a-bb57-1941df5e8c14',
              direction: EntryDirection.DEBIT,
              amount: 5000n,
              currency: 'NGN',
            },
            {
              ledgerAccountId: '018f6e80-873b-782a-bb57-1941df5e8c15',
              direction: EntryDirection.CREDIT,
              amount: 4000n, // Unbalanced!
              currency: 'NGN',
            },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transfers that cause an overdraft (insufficient funds)', async () => {
      const accA = '018f6e80-873b-782a-bb57-1941df5e8c14';
      const accB = '018f6e80-873b-782a-bb57-1941df5e8c15';

      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: accA, balance: 1000n, currency: 'NGN', type: LedgerAccountType.LIABILITY },
          { id: accB, balance: 0n, currency: 'NGN', type: LedgerAccountType.LIABILITY },
        ]),
      } as any;

      // Trying to debit 5000n when balance is only 1000n
      await expect(
        service.post(tx, {
          type: JournalEntryType.TRANSFER,
          lines: [
            { ledgerAccountId: accA, direction: EntryDirection.DEBIT, amount: 5000n, currency: 'NGN' },
            { ledgerAccountId: accB, direction: EntryDirection.CREDIT, amount: 5000n, currency: 'NGN' },
          ],
        }),
      ).rejects.toThrow('Insufficient funds in account.');
    });

    it('should successfully post balanced entries with sufficient funds', async () => {
      const accA = '018f6e80-873b-782a-bb57-1941df5e8c14';
      const accB = '018f6e80-873b-782a-bb57-1941df5e8c15';

      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: accA, balance: 10000n, currency: 'NGN', type: LedgerAccountType.LIABILITY },
          { id: accB, balance: 2000n, currency: 'NGN', type: LedgerAccountType.LIABILITY },
        ]),
        journalEntry: {
          create: vi.fn().mockResolvedValue({
            id: 'journal-entry-1',
            type: JournalEntryType.TRANSFER,
            lines: [],
          }),
        },
        ledgerAccount: {
          update: vi.fn().mockResolvedValue({}),
        },
      } as any;

      const result = await service.post(tx, {
        type: JournalEntryType.TRANSFER,
        lines: [
          { ledgerAccountId: accA, direction: EntryDirection.DEBIT, amount: 3000n, currency: 'NGN' },
          { ledgerAccountId: accB, direction: EntryDirection.CREDIT, amount: 3000n, currency: 'NGN' },
        ],
      });

      expect(result).toBeDefined();
      expect(tx.journalEntry.create).toHaveBeenCalled();
      // Should have updated both accounts
      expect(tx.ledgerAccount.update).toHaveBeenCalledTimes(2);
      // Account A: 10,000 - 3,000 = 7,000
      expect(tx.ledgerAccount.update).toHaveBeenCalledWith({
        where: { id: accA },
        data: { balance: 7000n },
      });
      // Account B: 2,000 + 3,000 = 5,000
      expect(tx.ledgerAccount.update).toHaveBeenCalledWith({
        where: { id: accB },
        data: { balance: 5000n },
      });
    });
  });
});
