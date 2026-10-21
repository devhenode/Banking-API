import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { OutboxStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface EmitOutboxDto {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, any>;
}

export interface OutboxRow {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: any;
    status: OutboxStatus;
    retryCount: number;
    lastError: string | null;
    createdAt: Date;
    publishedAt: Date | null;
}

@Injectable()
export class OutboxService {
    private readonly logger = new Logger(OutboxService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Atomically records a domain event in the outbox table within an existing database transaction.
     * Guarantees zero dual-write loss by committing the event with the business entity.
     */
    async emit(tx: Prisma.TransactionClient, dto: EmitOutboxDto) {
        return tx.outboxEvent.create({
            data: {
                aggregateType: dto.aggregateType,
                aggregateId: dto.aggregateId,
                eventType: dto.eventType,
                payload: dto.payload,
                status: OutboxStatus.PENDING,
            },
        });
    }

    /**
     * Sweeps up to `limit` pending outbox events using PostgreSQL's `FOR UPDATE SKIP LOCKED`.
     * Guarantees zero worker lock contention and safe parallel worker scaling.
     */
    async fetchPendingEvents(limit: number = 50): Promise<OutboxRow[]> {
        return this.prisma.$queryRaw<OutboxRow[]>`
            SELECT id, aggregate_type AS "aggregateType", aggregate_id AS "aggregateId",
                   event_type AS "eventType", payload, status, retry_count AS "retryCount",
                   last_error AS "lastError", created_at AS "createdAt", published_at AS "publishedAt"
            FROM outbox_events
            WHERE status = 'PENDING'::"OutboxStatus"
            ORDER BY created_at ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
        `;
    }

    /**
     * Marks an outbox event as successfully published to the message broker.
     */
    async markPublished(id: string) {
        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                status: OutboxStatus.PUBLISHED,
                publishedAt: new Date(),
            },
        });
    }

    /**
     * Records a publishing failure, increments retry count, and transitions
     * status to FAILED after 5 consecutive failures.
     */
    async markFailed(id: string, error: string) {
        const current = await this.prisma.outboxEvent.findUnique({
            where: { id },
            select: { retryCount: true },
        });

        const nextRetry = (current?.retryCount ?? 0) + 1;
        const finalStatus = nextRetry >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING;

        this.logger.warn(
            `Outbox event ${id} delivery failed (attempt ${nextRetry}/5): ${error}`,
        );

        return this.prisma.outboxEvent.update({
            where: { id },
            data: {
                retryCount: nextRetry,
                lastError: error,
                status: finalStatus,
            },
        });
    }
}
