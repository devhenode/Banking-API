import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';

describe('AccountsController', () => {
  let controller: AccountsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        {
          provide: AccountsService,
          useValue: {
            createAccount: vi.fn(),
            getCustomerAccounts: vi.fn(),
            getAccountById: vi.fn(),
            getAccountBalance: vi.fn(),
            getAccountHistory: vi.fn(),
          },
        },
        { provide: JwtService, useValue: { verifyAsync: vi.fn() } },
        { provide: AuthGuard, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
