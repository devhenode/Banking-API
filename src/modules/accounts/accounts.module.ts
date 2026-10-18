import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { NubanService } from './nuban.service.js';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [PrismaModule, LedgerModule, AuthModule],
  controllers: [AccountsController],
  providers: [AccountsService, NubanService],
  exports: [AccountsService],
})
export class AccountsModule {}
