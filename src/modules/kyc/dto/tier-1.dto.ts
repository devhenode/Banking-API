import { IsNotEmpty, Matches } from 'class-validator';

export class UpgradeTier1Dto {
    @IsNotEmpty()
    @Matches(/^[0-9]{11}$/, {
        message: 'National Identification Number (NIN) must be exactly 11 numeric digits.',
    })
    nin: string;
}
