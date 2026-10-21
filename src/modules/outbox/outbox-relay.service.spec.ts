import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxRelayService } from './outbox-relay.service.js';
import { OutboxStatus } from '../../generated/prisma/enums.js';

describe('OutboxRelayService', () => {
    let service: OutboxRelayService;
    let mockOutboxService: any;
    let mockKafkaService: any;

    beforeEach(() => {
        mockOutboxService = {
            fetchPendingEvents: vi.fn(),
            markPublished: vi.fn().mockResolvedValue({}),
            markFailed: vi.fn().mockResolvedValue({}),
        };

        mockKafkaService = {
            send: vi.fn().mockResolvedValue({}),
        };

        service = new OutboxRelayService(mockOutboxService, mockKafkaService);
    });

    describe('sweepOutbox', () => {
        it('returns 0 if no pending events found', async () => {
            mockOutboxService.fetchPendingEvents.mockResolvedValue([]);

            const count = await service.sweepOutbox();

            expect(count).toBe(0);
            expect(mockKafkaService.send).not.toHaveBeenCalled();
        });

        it('dispatches pending events to Kafka and marks them published', async () => {
            const mockEvents = [
                {
                    id: 'event-1',
                    aggregateType: 'Transfer',
                    aggregateId: 'tx-123',
                    eventType: 'banking.transfers.completed',
                    payload: { amount: '1000' },
                    status: OutboxStatus.PENDING,
                    retryCount: 0,
                    lastError: null,
                    createdAt: new Date('2026-10-21T12:00:00Z'),
                    publishedAt: null,
                },
            ];

            mockOutboxService.fetchPendingEvents.mockResolvedValue(mockEvents);

            const count = await service.sweepOutbox();

            expect(count).toBe(1);
            expect(mockKafkaService.send).toHaveBeenCalledWith(
                'banking.transfers',
                'tx-123',
                expect.objectContaining({
                    eventId: 'event-1',
                    eventType: 'banking.transfers.completed',
                    aggregateId: 'tx-123',
                }),
            );
            expect(mockOutboxService.markPublished).toHaveBeenCalledWith('event-1');
            expect(mockOutboxService.markFailed).not.toHaveBeenCalled();
        });

        it('handles Kafka send errors by marking the event failed', async () => {
            const mockEvents = [
                {
                    id: 'event-2',
                    aggregateType: 'Transfer',
                    aggregateId: 'tx-456',
                    eventType: 'banking.transfers.deposited',
                    payload: { amount: '5000' },
                    status: OutboxStatus.PENDING,
                    retryCount: 0,
                    lastError: null,
                    createdAt: new Date('2026-10-21T12:00:00Z'),
                    publishedAt: null,
                },
            ];

            mockOutboxService.fetchPendingEvents.mockResolvedValue(mockEvents);
            mockKafkaService.send.mockRejectedValueOnce(new Error('Broker unreachable'));

            const count = await service.sweepOutbox();

            expect(count).toBe(0);
            expect(mockOutboxService.markPublished).not.toHaveBeenCalled();
            expect(mockOutboxService.markFailed).toHaveBeenCalledWith(
                'event-2',
                'Broker unreachable',
            );
        });

        it('prevents overlapping sweep cycles via mutex flag', async () => {
            mockOutboxService.fetchPendingEvents.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve([]), 50)),
            );

            const promise1 = service.sweepOutbox();
            const promise2 = service.sweepOutbox();

            const [, result2] = await Promise.all([promise1, promise2]);

            expect(result2).toBe(0);
            expect(mockOutboxService.fetchPendingEvents).toHaveBeenCalledTimes(1);
        });
    });

    describe('resolveTopic', () => {
        it('routes transfer events to banking.transfers', () => {
            expect(service.resolveTopic('banking.transfers.completed')).toBe('banking.transfers');
            expect(service.resolveTopic('banking.transfers.deposited')).toBe('banking.transfers');
        });

        it('routes account events to banking.accounts', () => {
            expect(service.resolveTopic('banking.accounts.opened')).toBe('banking.accounts');
        });

        it('defaults to banking.events for generic events', () => {
            expect(service.resolveTopic('unknown.event')).toBe('banking.events');
        });
    });
});
