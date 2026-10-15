import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { LedgerModule } from './modules/ledger/ledger.module.js';
import { AccountsController } from './modules/accounts/accounts.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CustomersService } from './modules/customers/customers.service.js';
import { CustomersController } from './modules/customers/customers.controller.js';
import { CustomersModule } from './modules/customers/customers.module.js';
import { KycModule } from './modules/kyc/kyc.module.js';
import { TransfersController } from './modules/transfers/transfers.controller.js';
import { TransfersService } from './modules/transfers/transfers.service.js';
import { TransfersModule } from './modules/transfers/transfers.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { AccountsService } from './modules/accounts/accounts.service.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { NotificationsService } from './modules/notifications/notifications.service.js';
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
