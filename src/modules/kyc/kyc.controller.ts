import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { UpgradeTier1Dto } from './dto/tier-1.dto.js';
import { UpgradeTier2Dto } from './dto/tier-2.dto.js';
import { UpgradeTier3Dto } from './dto/tier-3.dto.js';
import { KycService } from './kyc.service.js';

@Controller('kyc')
@UseGuards(AuthGuard)
export class KycController {
    constructor(private readonly kycService: KycService) { }

    /**
     * Retrieves current customer's KYC tier, daily limit, and remaining allowance.
     */
    @Get('status')
    async getStatus(@CurrentUser() user: { sub: string }) {
        return this.kycService.getKycStatus(user.sub);
    }

    /**
     * Upgrades customer to KYC Tier 1 (NIN).
     */
    @Post('tier-1')
    @HttpCode(HttpStatus.OK)
    async upgradeTier1(
        @CurrentUser() user: { sub: string },
        @Body() dto: UpgradeTier1Dto,
    ) {
        return this.kycService.upgradeTier1(user.sub, dto);
    }

    /**
     * Upgrades customer to KYC Tier 2 (BVN + Proof of Address).
     */
    @Post('tier-2')
    @HttpCode(HttpStatus.OK)
    async upgradeTier2(
        @CurrentUser() user: { sub: string },
        @Body() dto: UpgradeTier2Dto,
    ) {
        return this.kycService.upgradeTier2(user.sub, dto);
    }

    /**
     * Upgrades customer to KYC Tier 3 (Biometric Liveness).
     */
    @Post('tier-3')
    @HttpCode(HttpStatus.OK)
    async upgradeTier3(
        @CurrentUser() user: { sub: string },
        @Body() dto: UpgradeTier3Dto,
    ) {
        return this.kycService.upgradeTier3(user.sub, dto);
    }
}
