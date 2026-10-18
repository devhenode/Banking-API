import {
    ArgumentsHost,
    HttpStatus,
    NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';

describe('GlobalExceptionFilter', () => {
    let filter: GlobalExceptionFilter;
    let mockResponse: {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
    };
    let mockHost: ArgumentsHost;

    beforeEach(() => {
        filter = new GlobalExceptionFilter();
        mockResponse = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
        };

        const mockRequest = {
            url: '/api/v1/test',
        };

        mockHost = {
            switchToHttp: vi.fn().mockReturnValue({
                getResponse: () => mockResponse,
                getRequest: () => mockRequest,
            }),
        } as unknown as ArgumentsHost;
    });

    it('formats standard HttpException cleanly', () => {
        const exception = new NotFoundException('Account not found');

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                error: 'Not Found',
                message: 'Account not found',
                path: '/api/v1/test',
                timestamp: expect.any(String),
            }),
        );
    });

    it('translates Prisma P2002 (Unique constraint) into 409 Conflict', () => {
        const exception = new Prisma.PrismaClientKnownRequestError(
            'Unique constraint failed',
            {
                code: 'P2002',
                clientVersion: '7.10.1',
                meta: { target: ['email'] },
            },
        );

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 409,
                error: 'Conflict',
                message: 'A record with this email already exists.',
                path: '/api/v1/test',
            }),
        );
    });

    it('translates Prisma P2025 (Record not found) into 404 Not Found', () => {
        const exception = new Prisma.PrismaClientKnownRequestError(
            'Record to update not found',
            {
                code: 'P2025',
                clientVersion: '7.10.1',
                meta: { cause: 'Customer record was not found' },
            },
        );

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 404,
                error: 'Not Found',
                message: 'Customer record was not found',
            }),
        );
    });

    it('translates Prisma P2003 (Foreign key failed) into 400 Bad Request', () => {
        const exception = new Prisma.PrismaClientKnownRequestError(
            'Foreign key constraint failed',
            {
                code: 'P2003',
                clientVersion: '7.10.1',
                meta: { field_name: 'customer_id' },
            },
        );

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                error: 'Bad Request',
                message: 'Foreign key constraint failed on field: customer_id.',
            }),
        );
    });

    it('translates Postgres trigger immutable append-only exception into 400 Bad Request', () => {
        const exception = new Error('Ledger entries and lines are append-only and cannot be mutated');

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 400,
                error: 'Immutable Ledger Invariant',
                message: 'Ledger entries and lines are append-only and cannot be mutated.',
            }),
        );
    });

    it('sanitizes unknown internal server errors to 500 without leaking stack trace', () => {
        const exception = new Error('Database password was incorrect in connection string');

        filter.catch(exception, mockHost);

        expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
                statusCode: 500,
                error: 'Internal Server Error',
                message: 'An unexpected error occurred.',
                path: '/api/v1/test',
            }),
        );
    });
});
