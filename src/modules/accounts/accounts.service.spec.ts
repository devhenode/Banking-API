import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service.js';
import { NubanService } from './nuban.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

describe('AccountsService', () => {
  let service: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: {} },
        { provide: LedgerService, useValue: { createCustomerAccount: vi.fn(), getAccountBalance: vi.fn(), getAccountHistory: vi.fn() } },
        { provide: NubanService, useValue: { generate: vi.fn().mockReturnValue('0000000017') } },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
