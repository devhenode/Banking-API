import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
    Length,
    Matches,
    MaxLength,
} from 'class-validator';

export class CreateTransferDto {
    @IsNotEmpty()
    @IsUUID()
    sourceAccountId: string;

    @IsOptional()
    @IsUUID()
    destinationAccountId?: string;

    @IsOptional()
    @Matches(/^[0-9]{10}$/, {
        message: 'destinationAccountNumber must be a 10-digit NUBAN number',
    })
    destinationAccountNumber?: string;

    @IsNotEmpty()
    @Matches(/^[1-9][0-9]*$/, {
        message: 'amount must be a positive integer string in minor units (e.g. "5000" for ₦50.00)',
    })
    amount: string;

    @IsOptional()
    @IsString()
    @Length(3, 3, { message: 'currency must be a 3-letter ISO code' })
    currency?: string;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    description?: string;
}
