import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { CustomerStatus, OtpPurpose } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  // 1. Register: Creates customer, credentials, and generates a 6-digit OTP
  async register(dto: RegisterDto) {
    const phone = dto.phone ?? (dto as any).phoneNumber;
    if (!dto.email && !phone) {
      throw new BadRequestException('Either email or phone number is required.');
    }

    // Check if customer already exists
    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [
          ...(dto.email ? [{ email: dto.email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
    });

    if (existing) {
      throw new ConflictException('A customer with this email or phone already exists.');
    }

    // Hash the password with bcrypt (12 rounds)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate secure 6-digit numeric OTP and hash it with SHA-256
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Atomically create Customer + Credential + OtpCode
    const customer = await this.prisma.$transaction(async (tx) => {
      const newCustomer = await tx.customer.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone,
          status: CustomerStatus.PENDING_VERIFICATION,
        },
      });

      await tx.credential.create({
        data: {
          customerId: newCustomer.id,
          passwordHash,
        },
      });

      await tx.otpCode.create({
        data: {
          customerId: newCustomer.id,
          codeHash,
          purpose: OtpPurpose.REGISTRATION,
          expiresAt,
        },
      });

      return newCustomer;
    });

    // Send unhashed OTP via NotificationsService
    const recipient = customer.phone ?? customer.email!;
    await this.notifications.sendOtp(recipient, rawOtp, OtpPurpose.REGISTRATION);

    return {
      message: 'Registration successful. Please verify the OTP sent to activate your account.',
      customerId: customer.id,
    };
  }

  // 2. Verify OTP: Checks the code, marks it used, and activates the customer
  async verifyOtp(dto: VerifyOtpDto) {

    // Find the latest unused OTP for this customer & purpose
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        customerId: dto.customerId,
        purpose: dto.purpose,
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No active OTP found for this customer.');
    }

    // Check if expired
    if (otpRecord.expiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    // Check attempt limits
    if (otpRecord.attempts >= 5) {
      throw new BadRequestException('Too many failed attempts. This code is locked. Please request a new one.');
    }

    // Verify code hash
    const inputHash = crypto.createHash('sha256').update(dto.otpCode).digest('hex');
    if (inputHash !== otpRecord.codeHash) {
      
        // Increment failed attempts
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP code.');
    }

    // Success: mark used and activate customer
    await this.prisma.$transaction(async (tx) => {
      await tx.otpCode.update({
        where: { id: otpRecord.id },
        data: { usedAt: new Date() },
      });

      if (dto.purpose === OtpPurpose.REGISTRATION) {
        await tx.customer.update({
          where: { id: dto.customerId },
          data: { status: CustomerStatus.ACTIVE },
        });
      }
    });

    return {
      message: 'Verification successful. Your account is now active.',
    };
  }

  
   // 3. Login: Verifies credentials and issues a signed JWT
  async login(dto: LoginDto) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
      },
      include: {
        credential: true,
      },
    });

    if (!customer || !customer.credential) {
      throw new UnauthorizedException('Invalid email/phone or password.');
    }

    if (customer.status === CustomerStatus.PENDING_VERIFICATION) {
      throw new UnauthorizedException('Account not verified. Please verify your OTP first.');
    }

    if (customer.status !== CustomerStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive or suspended.');
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(dto.password, customer.credential.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email/phone or password.');
    }

    // Generate JWT token
    const payload = {
      sub: customer.id,
      email: customer.email,
      phone: customer.phone,
      kycTier: customer.kycTier,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        kycTier: customer.kycTier,
      },
    };
  }
}
