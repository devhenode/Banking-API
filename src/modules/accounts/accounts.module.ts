import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AccountsController } from './accounts.controller.js';

@Module({
  controllers: [AccountsController], // front desk: HTTP routes
  providers: [AccountsService],      // back office: business logic
})
export class AccountsModule {}
