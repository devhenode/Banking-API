import {Injectable, Logger} from '@nestjs/common';
import { NotificationSender } from './notification-sender.interface.js';


@Injectable()
export class ConsoleNotificationSender implements NotificationSender {
    private readonly logger = new Logger(ConsoleNotificationSender.name);

    async send(to: string, message: string): Promise<void> {
        this.logger.log(`📬 [MOCK NOTIFICATION] To: ${to} | Message: ${message}`);
    }
}