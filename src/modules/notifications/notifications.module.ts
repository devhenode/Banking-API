import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service.js';
import { NotificationSender } from './notification-sender.interface.js';
import { ConsoleNotificationSender } from './console-notification-sender.js';
import { NotificationProcessor } from './notification.processor.js';
import { NOTIFICATIONS_QUEUE } from './notifications.constants.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  providers: [
    NotificationsService,
    NotificationProcessor,
    {
      provide: NotificationSender,
      useClass: ConsoleNotificationSender,
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
