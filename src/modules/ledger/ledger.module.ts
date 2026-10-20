import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';
import { LedgerReconciliationService } from './ledger-reconciliation.service.js';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [LedgerService, LedgerReconciliationService],
  exports: [LedgerService, LedgerReconciliationService],
})
export class LedgerModule {}
