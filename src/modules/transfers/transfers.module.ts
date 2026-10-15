import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service.js';
import { TransfersController } from './transfers.controller.js';

@Module({
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
