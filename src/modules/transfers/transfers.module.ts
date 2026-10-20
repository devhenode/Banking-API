import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { KycModule } from '../kyc/kyc.module.js';
import { LedgerModule } from '../ledger/ledger.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TransfersController } from './transfers.controller.js';
import { TransfersService } from './transfers.service.js';

@Module({
    imports: [
        PrismaModule,
        AccountsModule,
        LedgerModule,
        AuthModule,
        IdempotencyModule,
        KycModule,
        NotificationsModule,
    ],
    controllers: [TransfersController],
    providers: [TransfersService],
    exports: [TransfersService],
})
export class TransfersModule { }
