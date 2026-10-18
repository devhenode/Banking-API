import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { AccountType } from '../../../generated/prisma/enums.js';

export class CreateAccountDto {
    @IsEnum(AccountType, { message: 'Type must be either SAVINGS or CURRENT' })
    @IsNotEmpty()
    type: AccountType;

    @IsString()
    @IsOptional()
    @Length(3, 3, { message: 'Currency must be a 3-letter code, e.g. NGN' })
    currency?: string = 'NGN';
}
