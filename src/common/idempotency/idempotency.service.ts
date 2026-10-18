import {
    ConflictException,
    Injectable,
    UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma/client.js';
import { IdempotencyStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface IdempotencyCheckResult {
    isReplay: boolean;
    responseCode?: number;
    responseBody?: unknown;
}

@Injectable()
export class IdempotencyService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Computes a SHA-256 hash of the HTTP method, path, and request body.
     */
    computeHash(method: string, path: string, body: unknown): string {
        const normalizedMethod = method.toUpperCase();
        const serializedBody = typeof body === 'string' ? body : JSON.stringify(body ?? {});
        return createHash('sha256')
            .update(`${normalizedMethod}:${path}:${serializedBody}`)
            .digest('hex');
    }

    /**
     * Checks if a request with this idempotency key was already processed or is in flight.
     * Enforces:
     * - Replays cached response on matching completed requests (no money moves twice).
     * - Rejects concurrent duplicate requests with 409 Conflict.
     * - Rejects mismatched payloads with 422 Unprocessable Entity.
     * - Treats expired keys (>24 hours) as new keys.
     */
    async checkOrReplay(
        customerId: string,
        key: string,
        requestHash: string,
    ): Promise<IdempotencyCheckResult> {
        const existing = await this.prisma.idempotencyKey.findUnique({
            where: {
                customerId_key: {
                    customerId,
                    key,
                },
            },
        });

        if (!existing) {
            return { isReplay: false };
        }

        const isExpired = existing.expiresAt.getTime() <= Date.now();
        if (isExpired) {
            return { isReplay: false };
        }

        if (existing.status === IdempotencyStatus.IN_PROGRESS) {
            throw new ConflictException(
                'A request with this idempotency key is currently in progress. Please retry shortly.',
            );
        }

        if (existing.status === IdempotencyStatus.COMPLETED) {
            if (existing.requestHash !== requestHash) {
                throw new UnprocessableEntityException(
                    'Idempotency key has already been used with a different request payload.',
                );
            }

            return {
                isReplay: true,
                responseCode: existing.responseCode ?? 200,
                responseBody: existing.responseBody,
            };
        }

        return { isReplay: false };
    }

    /**
     * Records the initial IN_PROGRESS state within the caller's atomic transaction.
     */
    async recordInProgress(
        tx: Prisma.TransactionClient,
        data: {
            customerId: string;
            key: string;
            requestHash: string;
            ttlSeconds?: number;
        },
    ) {
        const ttlSeconds = data.ttlSeconds ?? 86400; // 24 hours
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

        // 1. Check if a record already exists within this transaction
        const existing = await tx.idempotencyKey.findUnique({
            where: {
                customerId_key: {
                    customerId: data.customerId,
                    key: data.key,
                },
            },
        });

        if (existing) {
            const isExpired = existing.expiresAt.getTime() <= Date.now();
            if (!isExpired) {
                if (existing.status === IdempotencyStatus.IN_PROGRESS) {
                    throw new ConflictException(
                        'A request with this idempotency key is currently in progress. Please retry shortly.',
                    );
                }
                if (existing.status === IdempotencyStatus.COMPLETED) {
                    if (existing.requestHash !== data.requestHash) {
                        throw new UnprocessableEntityException(
                            'Idempotency key has already been used with a different request payload.',
                        );
                    }
                    throw new ConflictException(
                        'A request with this idempotency key has already been completed.',
                    );
                }
            }

            // Expired key: recycle and set back to IN_PROGRESS
            return tx.idempotencyKey.update({
                where: {
                    customerId_key: {
                        customerId: data.customerId,
                        key: data.key,
                    },
                },
                data: {
                    requestHash: data.requestHash,
                    status: IdempotencyStatus.IN_PROGRESS,
                    responseCode: null,
                    responseBody: Prisma.DbNull,
                    expiresAt,
                },
            });
        }

        // 2. Insert new IN_PROGRESS row; catch unique constraint collision under race condition (P2002)
        try {
            return await tx.idempotencyKey.create({
                data: {
                    customerId: data.customerId,
                    key: data.key,
                    requestHash: data.requestHash,
                    status: IdempotencyStatus.IN_PROGRESS,
                    expiresAt,
                },
            });
        } catch (err: any) {
            if (err?.code === 'P2002') {
                throw new ConflictException(
                    'A request with this idempotency key is currently in progress. Please retry shortly.',
                );
            }
            throw err;
        }
    }

    /**
     * Updates the idempotency record to COMPLETED with the final response payload.
     */
    async recordCompleted(
        tx: Prisma.TransactionClient,
        data: {
            customerId: string;
            key: string;
            responseCode: number;
            responseBody: unknown;
        },
    ) {
        return tx.idempotencyKey.update({
            where: {
                customerId_key: {
                    customerId: data.customerId,
                    key: data.key,
                },
            },
            data: {
                status: IdempotencyStatus.COMPLETED,
                responseCode: data.responseCode,
                responseBody: data.responseBody as Prisma.InputJsonValue,
            },
        });
    }
}
