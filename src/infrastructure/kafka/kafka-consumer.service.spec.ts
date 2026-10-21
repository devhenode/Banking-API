import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KafkaConsumerService } from './kafka-consumer.service.js';

describe('KafkaConsumerService', () => {
    let service: KafkaConsumerService;
    let mockKafkaService: any;
    let mockConsumer: any;

    beforeEach(() => {
        mockConsumer = {
            connect: vi.fn().mockResolvedValue(undefined),
            subscribe: vi.fn().mockResolvedValue(undefined),
            run: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
        };

        mockKafkaService = {
            getClient: vi.fn().mockReturnValue({
                consumer: vi.fn().mockReturnValue(mockConsumer),
            }),
        };

        service = new KafkaConsumerService(mockKafkaService);
    });

    it('connects, subscribes to topics, and starts message runner on init', async () => {
        await service.onModuleInit();

        expect(mockConsumer.connect).toHaveBeenCalled();
        expect(mockConsumer.subscribe).toHaveBeenCalledWith({
            topics: ['banking.transfers', 'banking.accounts'],
            fromBeginning: false,
        });
        expect(mockConsumer.run).toHaveBeenCalledWith(
            expect.objectContaining({
                eachMessage: expect.any(Function),
            }),
        );
    });

    it('disconnects on module destroy if running', async () => {
        await service.onModuleInit();
        await service.onModuleDestroy();

        expect(mockConsumer.disconnect).toHaveBeenCalled();
    });

    it('correctly processes and parses incoming Kafka message', async () => {
        await service.onModuleInit();

        const runnerArg = mockConsumer.run.mock.calls[0][0];
        const spyHandleEvent = vi.spyOn(service, 'handleEvent');

        const testEvent = {
            eventId: 'event-uuid-1',
            eventType: 'banking.transfers.completed',
            aggregateId: 'transfer-1',
        };

        await runnerArg.eachMessage({
            topic: 'banking.transfers',
            partition: 0,
            message: {
                key: Buffer.from('transfer-1'),
                value: Buffer.from(JSON.stringify(testEvent)),
            },
        });

        expect(spyHandleEvent).toHaveBeenCalledWith(
            'banking.transfers',
            0,
            'transfer-1',
            testEvent,
        );
    });
});
