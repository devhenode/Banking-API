import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
    CustomerStatus,
    AccountStatus,
    AccountType,
    LedgerAccountType,
    EntryDirection,
    JournalEntryType,
} from '../src/generated/prisma/enums.js';
import { NubanService } from '../src/modules/accounts/nuban.service.js';

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
    }),
});

const jwtService = new JwtService({
    secret: process.env.JWT_SECRET || 'fallback-secret-for-tests',
});

const nubanService = new NubanService();

const SENDER_COUNT = 50;
const INITIAL_DEPOSIT_KOBO = 100_000_000n; // ₦1,000,000.00 in minor units

async function main() {
    console.log('🚀 Starting Load Test Data Seeder...');

    const defaultPasswordHash = await bcrypt.hash('LoadTest123!', 10);
    const currency = 'NGN';

    // 1. Ensure System Asset Clearing Account exists
    let clearingAccount = await prisma.ledgerAccount.findFirst({
        where: { code: `CLEARING_${currency}` },
    });

    if (!clearingAccount) {
        clearingAccount = await prisma.ledgerAccount.create({
            data: {
                code: `CLEARING_${currency}`,
                type: LedgerAccountType.ASSET,
                currency,
                balance: 0n,
            },
        });
        console.log(` Created System Asset Account: ${clearingAccount.code}`);
    }

    // 2. Seed / Upsert the "Hot Merchant" Account
    console.log(' Seeding Hot Merchant account...');
    let merchantCustomer = await prisma.customer.findUnique({
        where: { email: 'hot.merchant@loadtest.local' },
        include: { accounts: { include: { ledgerAccount: true } } },
    });

    if (!merchantCustomer) {
        merchantCustomer = await prisma.customer.create({
            data: {
                email: 'hot.merchant@loadtest.local',
                phone: '+2348000000000',
                firstName: 'Hot',
                lastName: 'Merchant',
                status: CustomerStatus.ACTIVE,
                kycTier: 3,
                credential: {
                    create: {
                        passwordHash: defaultPasswordHash,
                    },
                },
            },
            include: { accounts: { include: { ledgerAccount: true } } },
        });
    }

    let merchantAccount = merchantCustomer.accounts[0];
    if (!merchantAccount) {
        const accountNumber = nubanService.generate();
        merchantAccount = await prisma.account.create({
            data: {
                customerId: merchantCustomer.id,
                accountNumber,
                currency,
                type: AccountType.CURRENT,
                status: AccountStatus.ACTIVE,
                ledgerAccount: {
                    create: {
                        type: LedgerAccountType.LIABILITY,
                        currency,
                        balance: 0n,
                    },
                },
            },
            include: { ledgerAccount: true },
        });
        console.log(` Created Hot Merchant Account: ${merchantAccount.accountNumber}`);
    }

    // 3. Seed 50 Pre-Funded Senders with Signed JWTs
    console.log(` Seeding ${SENDER_COUNT} pre-funded sender accounts...`);
    const sendersData: Array<{
        index: number;
        customerId: string;
        accountId: string;
        accountNumber: string;
        token: string;
    }> = [];

    for (let i = 1; i <= SENDER_COUNT; i++) {
        const paddedIndex = i.toString().padStart(2, '0');
        const email = `sender_${paddedIndex}@loadtest.local`;
        const phone = `+23480000000${paddedIndex}`;

        let customer = await prisma.customer.findUnique({
            where: { email },
            include: { accounts: { include: { ledgerAccount: true } } },
        });

        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    email,
                    phone,
                    firstName: 'Sender',
                    lastName: paddedIndex,
                    status: CustomerStatus.ACTIVE,
                    kycTier: 3, // Unlimited/high transfer limits
                    credential: {
                        create: {
                            passwordHash: defaultPasswordHash,
                        },
                    },
                },
                include: { accounts: { include: { ledgerAccount: true } } },
            });
        }

        let account = customer.accounts[0];
        if (!account) {
            const accountNumber = nubanService.generate();
            account = await prisma.account.create({
                data: {
                    customerId: customer.id,
                    accountNumber,
                    currency,
                    type: AccountType.SAVINGS,
                    status: AccountStatus.ACTIVE,
                    ledgerAccount: {
                        create: {
                            type: LedgerAccountType.LIABILITY,
                            currency,
                            balance: 0n,
                        },
                    },
                },
                include: { ledgerAccount: true },
            });
        }

        const customerLedger = account.ledgerAccount!;

        // Check if wallet needs funding
        if (customerLedger.balance < INITIAL_DEPOSIT_KOBO / 2n) {
            // Post an atomic double-entry deposit
            await prisma.$transaction(async (tx) => {
                await tx.journalEntry.create({
                    data: {
                        type: JournalEntryType.DEPOSIT,
                        description: `Initial Load Test Funding for ${email}`,
                        lines: {
                            create: [
                                {
                                    ledgerAccountId: clearingAccount!.id,
                                    direction: EntryDirection.DEBIT,
                                    amount: INITIAL_DEPOSIT_KOBO,
                                    currency,
                                },
                                {
                                    ledgerAccountId: customerLedger.id,
                                    direction: EntryDirection.CREDIT,
                                    amount: INITIAL_DEPOSIT_KOBO,
                                    currency,
                                },
                            ],
                        },
                    },
                });

                // Update ledger account balance
                await tx.ledgerAccount.update({
                    where: { id: customerLedger.id },
                    data: { balance: { increment: INITIAL_DEPOSIT_KOBO } },
                });

                // Update asset clearing account balance
                await tx.ledgerAccount.update({
                    where: { id: clearingAccount!.id },
                    data: { balance: { increment: INITIAL_DEPOSIT_KOBO } },
                });
            });
        }

        // Generate signed JWT
        const token = await jwtService.signAsync({
            sub: customer.id,
            email: customer.email,
            phone: customer.phone,
            kycTier: customer.kycTier,
        });

        sendersData.push({
            index: i,
            customerId: customer.id,
            accountId: account.id,
            accountNumber: account.accountNumber,
            token,
        });
    }

    // 4. Export test data to load-tests/test-data.json
    const outputDir = path.resolve(process.cwd(), 'load-tests');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const testDataPayload = {
        generatedAt: new Date().toISOString(),
        merchant: {
            customerId: merchantCustomer.id,
            accountId: merchantAccount.id,
            accountNumber: merchantAccount.accountNumber,
        },
        senders: sendersData,
    };

    const outputPath = path.join(outputDir, 'test-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(testDataPayload, null, 2), 'utf-8');

    console.log(`✅ Seeding complete! Exported ${sendersData.length} sender accounts to: ${outputPath}`);
}

main()
    .catch((err) => {
        console.error('❌ Seeder failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
