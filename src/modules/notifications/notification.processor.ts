import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  SEND_OTP_JOB,
  SEND_TRANSACTION_ALERT_JOB,
  type SendOtpJobPayload,
  type SendTransactionAlertJobPayload,
} from './notifications.constants.js';
import { NotificationSender } from './notification-sender.interface.js';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly sender: NotificationSender) {
    super();
  }

  async process(
    job: Job<SendOtpJobPayload | SendTransactionAlertJobPayload, void, string>,
  ): Promise<void> {
    if (job.name === SEND_OTP_JOB) {
      const { to, code, purpose } = job.data as SendOtpJobPayload;
      const message = `Your verification code is ${code}. It expires in 10 minutes. (Purpose: ${purpose})`;

      this.logger.log(`Processing ${job.name} job #${job.id} for recipient: ${to}`);
      await this.sender.send(to, message);
    } else if (job.name === SEND_TRANSACTION_ALERT_JOB) {
      const { to, accountNumber, type, amount, currency, counterparty, reference } =
        job.data as SendTransactionAlertJobPayload;

      const formattedAmount = (BigInt(amount) / 100n).toLocaleString();
      const maskedAccount = accountNumber.length >= 4 ? `...${accountNumber.slice(-4)}` : accountNumber;
      const message = `[ALERT] ${type} of ${currency} ${formattedAmount} on account ${maskedAccount} (${type === 'DEBIT' ? 'to' : 'from'} ${counterparty}). Ref: ${reference}`;

      this.logger.log(`Processing ${job.name} job #${job.id} for recipient: ${to}`);
      await this.sender.send(to, message);
    }
  }
}
