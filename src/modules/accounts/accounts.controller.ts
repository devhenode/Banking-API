import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator.js';
import { AccountsService } from './accounts.service.js';
import { CreateAccountDto } from './dto/create-account.dto.js';

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createAccount(user.sub, dto);
  }

  @Get()
  async getMyAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getCustomerAccounts(user.sub);
  }

  @Get(':id')
  async getAccountById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.getAccountById(id, user.sub);
  }

  @Get(':id/balance')
  async getAccountBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.getAccountBalance(id, user.sub);
  }

  @Get(':id/history')
  async getAccountHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.accountsService.getAccountHistory(id, user.sub);
  }
}
