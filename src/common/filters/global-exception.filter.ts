import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

export interface ErrorResponseEnvelope {
    statusCode: number;
    error: string;
    message: string | string[];
    timestamp: string;
    path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let error = 'Internal Server Error';
        let message: string | string[] = 'An unexpected error occurred.';

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const res = exception.getResponse();
            if (typeof res === 'string') {
                message = res;
                error = exception.name;
            } else if (typeof res === 'object' && res !== null) {
                const resObj = res as Record<string, unknown>;
                message = (resObj.message as string | string[]) ?? exception.message;
                error = (resObj.error as string) ?? exception.name;
            }
        } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
            this.logger.error(`Prisma Client Error [${exception.code}]: ${exception.message}`, exception.stack);
            switch (exception.code) {
                case 'P2002': {
                    statusCode = HttpStatus.CONFLICT;
                    error = 'Conflict';
                    const target = (exception.meta?.target as string[])?.join(', ');
                    message = target
                        ? `A record with this ${target} already exists.`
                        : 'A record with these unique details already exists.';
                    break;
                }
                case 'P2025': {
                    statusCode = HttpStatus.NOT_FOUND;
                    error = 'Not Found';
                    message = (exception.meta?.cause as string) ?? 'Record not found.';
                    break;
                }
                case 'P2003': {
                    statusCode = HttpStatus.BAD_REQUEST;
                    error = 'Bad Request';
                    const field = exception.meta?.field_name as string;
                    message = field
                        ? `Foreign key constraint failed on field: ${field}.`
                        : 'Referenced entity does not exist.';
                    break;
                }
                default: {
                    statusCode = HttpStatus.BAD_REQUEST;
                    error = 'Database Error';
                    message = 'A database constraint violation occurred.';
                    break;
                }
            }
        } else if (exception instanceof Error) {
            if (
                exception.message.includes('append-only') ||
                exception.message.includes('immutable')
            ) {
                statusCode = HttpStatus.BAD_REQUEST;
                error = 'Immutable Ledger Invariant';
                message = 'Ledger entries and lines are append-only and cannot be mutated.';
            } else {
                this.logger.error(`Unhandled Exception: ${exception.message}`, exception.stack);
            }
        }

        const envelope: ErrorResponseEnvelope = {
            statusCode,
            error,
            message,
            timestamp: new Date().toISOString(),
            path: request?.url ?? '',
        };

        response.status(statusCode).json(envelope);
    }
}
