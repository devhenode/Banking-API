import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntryDirection } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface ReconciliationReport {
  balanced: boolean;
  totalDebits: string;
  totalCredits: string;
  drift: string;
  timestamp: string;
}

@Injectable()
export class LedgerReconciliationService {
  private readonly logger = new Logger(LedgerReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates mathematical balance across the entire chart of accounts:
   * Assert SUM(DEBITS) === SUM(CREDITS)
   */
  async reconcile(): Promise<ReconciliationReport> {
    const [debitAgg, creditAgg] = await Promise.all([
      this.prisma.ledgerLine.aggregate({
        _sum: { amount: true },
        where: { direction: EntryDirection.DEBIT },
      }),
      this.prisma.ledgerLine.aggregate({
        _sum: { amount: true },
        where: { direction: EntryDirection.CREDIT },
      }),
    ]);

    const totalDebits = debitAgg._sum.amount ?? 0n;
    const totalCredits = creditAgg._sum.amount ?? 0n;
    const drift = totalDebits - totalCredits;

    if (drift !== 0n) {
      this.logger.error(
        `🚨 [CRITICAL_LEDGER_IMBALANCE] System ledger has drifted! Total debits: ${totalDebits}, Total credits: ${totalCredits}, Drift: ${drift} minor units.`,
      );
      throw new Error(`CRITICAL_LEDGER_IMBALANCE: Drift of ${drift} minor units detected.`);
    }

    this.logger.log(
      `✅ [LedgerReconciliation] System balanced. Total debits: ${totalDebits}, Total credits: ${totalCredits}, Drift: 0`,
    );

    return {
      balanced: true,
      totalDebits: totalDebits.toString(),
      totalCredits: totalCredits.toString(),
      drift: '0',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Autonomous Cron Worker scheduled to trigger at 00:00:00 UTC daily.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'daily-ledger-reconciliation',
    timeZone: 'UTC',
  })
  async handleMidnightAudit() {
    this.logger.log('⏰ Starting automated midnight ledger reconciliation audit...');
    try {
      await this.reconcile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Automated audit failed: ${message}`);
    }
  }
}
