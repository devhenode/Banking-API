import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service.js';
import { NotificationSender } from './notification-sender.interface.js';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: NotificationSender,
          useValue: { send: vi.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
