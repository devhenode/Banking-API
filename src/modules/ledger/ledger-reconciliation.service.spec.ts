import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LedgerReconciliationService } from './ledger-reconciliation.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { EntryDirection } from '../../generated/prisma/enums.js';

describe('LedgerReconciliationService', () => {
  let service: LedgerReconciliationService;
  let mockPrisma: {
    ledgerLine: {
      aggregate: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      ledgerLine: {
        aggregate: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LedgerReconciliationService>(LedgerReconciliationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should pass audit when total debits equal total credits (drift = 0)', async () => {
    mockPrisma.ledgerLine.aggregate.mockImplementation(async ({ where }) => {
      if (where.direction === EntryDirection.DEBIT) {
        return { _sum: { amount: 500000n } };
      }
      if (where.direction === EntryDirection.CREDIT) {
        return { _sum: { amount: 500000n } };
      }
      return { _sum: { amount: 0n } };
    });

    const report = await service.reconcile();

    expect(report.balanced).toBe(true);
    expect(report.drift).toBe('0');
    expect(report.totalDebits).toBe('500000');
    expect(report.totalCredits).toBe('500000');
  });

  it('should throw an error and alert when debits do not match credits (drift detected)', async () => {
    mockPrisma.ledgerLine.aggregate.mockImplementation(async ({ where }) => {
      if (where.direction === EntryDirection.DEBIT) {
        return { _sum: { amount: 500000n } };
      }
      if (where.direction === EntryDirection.CREDIT) {
        return { _sum: { amount: 499900n } }; // 100 kobo imbalance!
      }
      return { _sum: { amount: 0n } };
    });

    await expect(service.reconcile()).rejects.toThrow('CRITICAL_LEDGER_IMBALANCE');
  });
});
