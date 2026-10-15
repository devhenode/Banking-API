import { Module } from '@nestjs/common';
import { KycService } from './kyc.service.js';
import { KycController } from './kyc.controller.js';

@Module({
  providers: [KycService],
  controllers: [KycController]
})
export class KycModule {}
