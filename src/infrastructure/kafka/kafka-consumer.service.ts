import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Consumer } from 'kafkajs';
import { KafkaService } from './kafka.service.js';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KafkaConsumerService.name);
    private consumer: Consumer;
    private isRunning = false;

    constructor(private readonly kafkaService: KafkaService) {
        this.consumer = this.kafkaService.getClient().consumer({
            groupId: 'banking-audit-consumer-group',
        });
    }

    async onModuleInit() {
        try {
            await this.consumer.connect();
            await this.consumer.subscribe({
                topics: ['banking.transfers', 'banking.accounts'],
                fromBeginning: false,
            });

            await this.consumer.run({
                eachMessage: async ({ topic, partition, message }) => {
                    const key = message.key?.toString();
                    const rawValue = message.value?.toString();
                    if (!rawValue) return;

                    try {
                        const event = JSON.parse(rawValue);
                        this.handleEvent(topic, partition, key, event);
                    } catch (err) {
                        this.logger.error(
                            `Failed to parse message on topic '${topic}': ${(err as Error).message}`,
                        );
                    }
                },
            });

            this.isRunning = true;
            this.logger.log(
                'Kafka Consumer subscribed to [banking.transfers, banking.accounts]',
            );
        } catch (error) {
            this.logger.warn(
                `Deferred Kafka Consumer start (broker not ready or offline): ${(error as Error).message}`,
            );
        }
    }

    async onModuleDestroy() {
        if (this.isRunning) {
            await this.consumer.disconnect();
            this.logger.log('Kafka Consumer disconnected.');
        }
    }

    handleEvent(topic: string, partition: number, key: string | undefined, event: any) {
        this.logger.log(
            `[AUDIT_EVENT_CONSUMED] Topic: ${topic} | Partition: ${partition} | Key: ${key} | EventType: ${event.eventType} | AggregateId: ${event.aggregateId}`,
        );
    }
}
