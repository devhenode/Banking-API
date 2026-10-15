import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { TransfersModule } from './modules/transfers/transfers.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LedgerModule,
    AuthModule,
    CustomersModule,
    KycModule,
    TransfersModule,
    PrismaModule,
    AccountsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
