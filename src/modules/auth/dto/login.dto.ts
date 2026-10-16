import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsNotEmpty({message: 'Email or phone number is required '})
    identifier: string;

    @IsString()
    @IsNotEmpty({message: 'Password is required '})
    password: string;
}