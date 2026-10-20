import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service.js';
import { NOTIFICATIONS_QUEUE, SEND_OTP_JOB, SEND_TRANSACTION_ALERT_JOB } from './notifications.constants.js';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockQueue: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockQueue = {
      add: vi.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getQueueToken(NOTIFICATIONS_QUEUE),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enqueue send-otp job with backoff retries', async () => {
    await service.sendOtp('+2348012345678', '123456', 'REGISTRATION');

    expect(mockQueue.add).toHaveBeenCalledWith(
      SEND_OTP_JOB,
      {
        to: '+2348012345678',
        code: '123456',
        purpose: 'REGISTRATION',
      },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }),
    );
  });

  it('should enqueue send-transaction-alert job with backoff retries', async () => {
    await service.sendTransferAlert({
      to: '+2348012345678',
      accountNumber: '0123456789',
      type: 'DEBIT',
      amount: '500000',
      currency: 'NGN',
      counterparty: 'Jane Doe',
      reference: 'tx-123',
    });

    expect(mockQueue.add).toHaveBeenCalledWith(
      SEND_TRANSACTION_ALERT_JOB,
      {
        to: '+2348012345678',
        accountNumber: '0123456789',
        type: 'DEBIT',
        amount: '500000',
        currency: 'NGN',
        counterparty: 'Jane Doe',
        reference: 'tx-123',
      },
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }),
    );
  });
});
