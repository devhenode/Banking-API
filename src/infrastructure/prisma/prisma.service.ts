import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';

@Injectable()
export class PrismaService
  extends PrismaClient // PrismaService IS the client: this.prisma.account.findMany() etc.
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService) {
    super({
      // Prisma 7: queries go through the pg driver adapter
      adapter: new PrismaPg({
        connectionString: config.getOrThrow<string>('DATABASE_URL'), // fail fast if missing
      }),
    });
  }

  async onModuleInit() {
    await this.$connect(); // fail at startup, not on the first customer request
  }

  async onModuleDestroy() {
    await this.$disconnect(); // release connections on shutdown
  }
}