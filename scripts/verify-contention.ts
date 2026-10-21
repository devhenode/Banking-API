import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
    }),
});

async function main() {
    console.log('🔍 Running Post-Load Accounting Audit & Concurrency Verification...\n');

    // 1. Check Hot Merchant Balance
    const merchant = await prisma.customer.findUnique({
        where: { email: 'hot.merchant@loadtest.local' },
        include: { accounts: { include: { ledgerAccount: true } } },
    });

    const merchantAccount = merchant?.accounts[0];
    const merchantBalance = merchantAccount?.ledgerAccount?.balance ?? 0n;

    // 2. Count total transfers received by the merchant
    const transferCount = await prisma.transfer.count({
        where: {
            destinationAccountId: merchantAccount?.id,
            status: 'COMPLETED',
        },
    });

    const expectedBalance = BigInt(transferCount) * 100n; // 100 kobo per transfer

    console.log(`📊 Merchant Account: ${merchantAccount?.accountNumber}`);
    console.log(`📥 Completed Transfers Received: ${transferCount}`);
    console.log(`💰 Merchant Ledger Balance: ${merchantBalance.toString()} kobo (₦${(Number(merchantBalance) / 100).toFixed(2)})`);
    console.log(`🎯 Expected Balance:         ${expectedBalance.toString()} kobo`);

    const balanceMatches = merchantBalance === expectedBalance;
    if (balanceMatches) {
        console.log('✅ Merchant Balance Integrity: PERFECT (0 balance drift under load!)\n');
    } else {
        console.error(`❌ BALANCE DRIFT DETECTED: Difference = ${(merchantBalance - expectedBalance).toString()} kobo\n`);
    }

    // 3. System-wide Double-Entry Equation Audit
    const lines = await prisma.ledgerLine.findMany({
        select: { direction: true, amount: true },
    });

    let totalDebits = 0n;
    let totalCredits = 0n;

    for (const line of lines) {
        if (line.direction === 'DEBIT') totalDebits += line.amount;
        else if (line.direction === 'CREDIT') totalCredits += line.amount;
    }

    console.log(`⚖️  System-Wide Total Debits:  ${totalDebits.toString()}`);
    console.log(`⚖️  System-Wide Total Credits: ${totalCredits.toString()}`);
    console.log(`⚖️  Net Ledger Drift:         ${(totalDebits - totalCredits).toString()}`);

    if (totalDebits === totalCredits) {
        console.log('✅ Double-Entry Invariant: SATISFIED (Debits === Credits)\n');
    } else {
        console.error('❌ CRITICAL: Double-entry equation violated!\n');
        process.exit(1);
    }
}

main()
    .catch((err) => {
        console.error('Audit failed:', err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
