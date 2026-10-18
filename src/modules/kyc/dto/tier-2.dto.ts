import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class UpgradeTier2Dto {
    @IsNotEmpty()
    @Matches(/^[0-9]{11}$/, {
        message: 'Bank Verification Number (BVN) must be exactly 11 numeric digits.',
    })
    bvn: string;

    @IsNotEmpty()
    @IsString()
    @MaxLength(500)
    proofOfAddressUrl: string;
}
