import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { KycController } from './kyc.controller.js';
import { KycService } from './kyc.service.js';
import { KycVerifierProvider } from './providers/kyc-verifier.provider.js';
import { MockKycVerifierProvider } from './providers/mock-kyc-verifier.provider.js';

@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [KycController],
    providers: [
        KycService,
        {
            provide: KycVerifierProvider,
            useClass: MockKycVerifierProvider,
        },
    ],
    exports: [KycService, KycVerifierProvider],
})
export class KycModule { }
