import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CreateTransferDto } from './dto/create-transfer.dto.js';
import { DepositDto } from './dto/deposit.dto.js';
import { TransfersService } from './transfers.service.js';

@Controller('transfers')
@UseGuards(AuthGuard)
export class TransfersController {
    constructor(private readonly transfersService: TransfersService) { }

    /**
     * Deposits external funds into a customer bank account.
     */
    @Post('deposit')
    @HttpCode(HttpStatus.CREATED)
    async deposit(
        @CurrentUser() user: { sub: string },
        @Headers('idempotency-key') idempotencyKey: string,
        @Body() dto: DepositDto,
    ) {
        return this.transfersService.deposit(user.sub, idempotencyKey, dto);
    }

    /**
     * Executes an internal money transfer between accounts.
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async transfer(
        @CurrentUser() user: { sub: string },
        @Headers('idempotency-key') idempotencyKey: string,
        @Body() dto: CreateTransferDto,
    ) {
        return this.transfersService.transfer(user.sub, idempotencyKey, dto);
    }

    /**
     * Retrieves transfer receipt and status by ID.
     */
    @Get(':id')
    async getTransfer(
        @CurrentUser() user: { sub: string },
        @Param('id') id: string,
    ) {
        return this.transfersService.getTransferById(id, user.sub);
    }
}
