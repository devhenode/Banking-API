export abstract class NotificationSender {
  abstract send(to: string, message: string): Promise<void>;
}
