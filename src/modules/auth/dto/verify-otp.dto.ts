import { IsEnum, IsNotEmpty, IsString, IsUUID, Length } from "class-validator";
import { OtpPurpose } from "../../../generated/prisma/enums.js";

export class VerifyOtpDto {
    @IsUUID('7', { message: 'Invalid customer id format' })
    @IsNotEmpty()
    customerId: string;

    @IsString()
    @Length(6, 6, {message: 'OTP code must be 6 digits'})
    @IsNotEmpty()
    otpCode: string;

    @IsEnum(OtpPurpose, { message: 'purpose must be REGISTRATION, PASSWORD_RESET, or LOGIN'})
    purpose: OtpPurpose;
}