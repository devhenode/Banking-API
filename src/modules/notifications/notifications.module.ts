import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationSender } from './notification-sender.interface.js';
import { ConsoleNotificationSender } from './console-notification-sender.js';

@Module({
  providers: [
    NotificationsService,
    {
      provide: NotificationSender,
      useClass: ConsoleNotificationSender
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule { }
