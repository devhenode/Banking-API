import type { DomainEvent } from './domain-event.interface.js';

export interface TransferCompletedPayload {
    transferId: string;
    sourceAccountId: string;
    destinationAccountId: string;
    amount: string; // Minor units in string format to preserve BigInt precision
    currency: string;
    customerId: string;
    journalEntryId: string;
    description?: string;
    createdAt: string;
}

export type TransferCompletedEvent = DomainEvent<TransferCompletedPayload>;
