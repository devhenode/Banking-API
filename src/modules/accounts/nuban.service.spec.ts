import { describe, expect, it } from 'vitest';
import { NubanService } from './nuban.service.js';

describe('NubanService', () => {
  const service = new NubanService();

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate a 10-digit NUBAN string', () => {
    const nuban = service.generate();
    expect(nuban).toHaveLength(10);
    expect(/^\d{10}$/.test(nuban)).toBe(true);
  });

  it('should calculate valid check digits matching CBN weights', () => {
    // Generate several NUBANs and verify their check digits match
    for (let i = 0; i < 10; i++) {
      const nuban = service.generate();
      const serial9 = nuban.slice(0, 9);
      const checkDigit = Number.parseInt(nuban.slice(9), 10);
      expect(service.calculateCheckDigit(serial9)).toBe(checkDigit);
    }
  });
});
