import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class UpgradeTier3Dto {
    @IsNotEmpty()
    @IsString()
    @MinLength(8, { message: 'Biometric liveness token must be at least 8 characters.' })
    livenessToken: string;
}
