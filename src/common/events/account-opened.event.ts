import type { DomainEvent } from './domain-event.interface.js';

export interface AccountOpenedPayload {
    accountId: string;
    customerId: string;
    accountNumber: string;
    currency: string;
    type: string;
    createdAt: string;
}

export type AccountOpenedEvent = DomainEvent<AccountOpenedPayload>;
