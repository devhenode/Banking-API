export interface DomainEvent<T = any> {
    eventId: string;
    eventType: string;
    aggregateType: string;
    aggregateId: string;
    timestamp: string;
    payload: T;
}
