import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { KafkaService } from '../../infrastructure/kafka/kafka.service.js';
import { OutboxRow, OutboxService } from './outbox.service.js';

@Injectable()
export class OutboxRelayService {
    private readonly logger = new Logger(OutboxRelayService.name);
    private isProcessing = false;

    constructor(
        private readonly outboxService: OutboxService,
        private readonly kafkaService: KafkaService,
    ) { }

    /**
     * Periodically sweeps pending outbox records and publishes them to Kafka.
     * Uses PostgreSQL SKIP LOCKED under the hood to ensure multiple API instances
     * never lock the same rows or cause contention.
     */
    @Interval(500)
    async sweepOutbox(): Promise<number> {
        if (this.isProcessing) {
            return 0;
        }

        this.isProcessing = true;
        let publishedCount = 0;

        try {
            const pendingEvents = await this.outboxService.fetchPendingEvents(50);
            if (!pendingEvents || pendingEvents.length === 0) {
                return 0;
            }

            for (const event of pendingEvents) {
                const success = await this.processSingleEvent(event);
                if (success) {
                    publishedCount++;
                }
            }
        } catch (error) {
            this.logger.error(
                `Outbox sweep cycle encountered an unexpected error: ${(error as Error).message}`,
                (error as Error).stack,
            );
        } finally {
            this.isProcessing = false;
        }

        return publishedCount;
    }

    /**
     * Publishes a single outbox event to its designated Kafka topic and marks it PUBLISHED.
     * On network or broker failure, records error and increments retry counter.
     */
    async processSingleEvent(event: OutboxRow): Promise<boolean> {
        const topic = this.resolveTopic(event.eventType);

        try {
            const envelope = {
                eventId: event.id,
                eventType: event.eventType,
                aggregateType: event.aggregateType,
                aggregateId: event.aggregateId,
                payload: event.payload,
                timestamp: event.createdAt.toISOString(),
            };

            await this.kafkaService.send(topic, event.aggregateId, envelope);
            await this.outboxService.markPublished(event.id);

            this.logger.debug(
                `Outbox event ${event.id} [${event.eventType}] published to topic '${topic}'`,
            );
            return true;
        } catch (error) {
            const errorMsg = (error as Error).message || 'Kafka publishing failure';
            await this.outboxService.markFailed(event.id, errorMsg);
            return false;
        }
    }

    /**
     * Maps domain event names to Kafka topics.
     */
    resolveTopic(eventType: string): string {
        if (eventType.startsWith('banking.transfers.')) {
            return 'banking.transfers';
        }
        if (eventType.startsWith('banking.accounts.')) {
            return 'banking.accounts';
        }
        return 'banking.events';
    }
}
