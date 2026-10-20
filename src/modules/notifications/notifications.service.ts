import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NOTIFICATIONS_QUEUE,
  SEND_OTP_JOB,
  SEND_TRANSACTION_ALERT_JOB,
  type SendOtpJobPayload,
  type SendTransactionAlertJobPayload,
} from './notifications.constants.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<SendOtpJobPayload | SendTransactionAlertJobPayload>,
  ) {}

  async sendOtp(to: string, code: string, purpose: string): Promise<void> {
    await this.queue.add(
      SEND_OTP_JOB,
      { to, code, purpose },
      {
        attempts: 3, // Retry up to 3 times if external gateway fails
        backoff: {
          type: 'exponential',
          delay: 1000, // 1st retry: 1s, 2nd: 2s, 3rd: 4s
        },
        removeOnComplete: true, // Auto-cleanup successful jobs from Redis
        removeOnFail: false,   // Preserve failed jobs in Redis for auditing
      },
    );
  }

  async sendTransferAlert(payload: SendTransactionAlertJobPayload): Promise<void> {
    await this.queue.add(
      SEND_TRANSACTION_ALERT_JOB,
      payload,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }
}
