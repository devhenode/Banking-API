import { Injectable } from '@nestjs/common';
import { NotificationSender } from './notification-sender.interface.js';

@Injectable()
export class NotificationsService {
    constructor(private readonly sender: NotificationSender) {}

    async sendOtp(to: string, code: string, purpose: string): Promise<void> {
        const message = `Your verification code is ${code}. It expires in 10 minutes. (Purpose: ${purpose})`;
        await this.sender.send(to, message)
    }
}
