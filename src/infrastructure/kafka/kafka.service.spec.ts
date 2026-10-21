import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KafkaService } from './kafka.service.js';
import { ConfigService } from '@nestjs/config';

describe('KafkaService', () => {
    let service: KafkaService;
    let mockConfigService: any;
    let mockProducer: any;

    beforeEach(() => {
        mockConfigService = {
            get: vi.fn().mockReturnValue('localhost:9094'),
        };

        service = new KafkaService(mockConfigService as unknown as ConfigService);

        mockProducer = {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            send: vi.fn().mockResolvedValue([{ topicName: 'banking.transfers', partition: 0 }]),
        };

        (service as any).producer = mockProducer;
    });

    it('connects to Kafka on module init', async () => {
        await service.onModuleInit();
        expect(mockProducer.connect).toHaveBeenCalled();
    });

    it('disconnects on module destroy if connected', async () => {
        await service.onModuleInit();
        await service.onModuleDestroy();
        expect(mockProducer.disconnect).toHaveBeenCalled();
    });

    it('sends messages with topic, partition key, and serialized payload', async () => {
        await service.onModuleInit();

        const payload = { test: 'data' };
        await service.send('banking.transfers', 'aggregate-key-1', payload);

        expect(mockProducer.send).toHaveBeenCalledWith({
            topic: 'banking.transfers',
            messages: [
                {
                    key: 'aggregate-key-1',
                    value: JSON.stringify(payload),
                    headers: undefined,
                },
            ],
        });
    });
});
