import { Module } from '@nestjs/common';
import { LedgerService } from './ledger.service.js';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [LedgerService],
  exports: [LedgerService]
})
export class LedgerModule {}
