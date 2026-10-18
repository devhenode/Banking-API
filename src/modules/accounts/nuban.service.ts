import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';

@Injectable()
export class NubanService {

    private readonly bankCode = '999';

    /**
     * Calculates the NUBAN check digit according to CBN specification.
     * Algorithm:
     * 1. Weights: [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
     * 2. Multiply each digit of (bankCode + serial) by its weight and sum them up
     * 3. checkDigit = (10 - (sum % 10)) % 10
    */
    calculateCheckDigit(serial9: string): number {
        const fullCode = this.bankCode + serial9; // 12 digits total
        const weights = [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3];

        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += Number.parseInt(fullCode[i]!, 10) * weights[i]!;
        }

        const remainder = sum % 10;
        return (10 - remainder) % 10;
    }

    /**
     * Generates a 10-digit NUBAN: 9 random serial digits + 1 calculated check digit.
    */
    generate(): string {
        const serial = crypto.randomInt(1, 1000000000).toString().padStart(9, '0');
        const checkDigit = this.calculateCheckDigit(serial);
        return `${serial}${checkDigit}`;
    }
}
