import { describe, it, expect } from 'vitest';
import { RARITIES } from './rarities.js';

describe('RARITIES', () => {
    it('contient 11 raretés', () => {
        expect(RARITIES).toHaveLength(11);
    });

    it('commence par la plus rare (SE)', () => {
        expect(RARITIES[0]).toBe('SE');
    });

    it('finit par la plus commune (R)', () => {
        expect(RARITIES.at(-1)).toBe('R');
    });

    it("n'a pas de doublons", () => {
        expect(new Set(RARITIES).size).toBe(RARITIES.length);
    });

    // Même ordre que le CHECK de db/init.sql : si un des deux change, ce test le signale
    it('est dans le bon ordre', () => {
        expect(RARITIES).toEqual(['SE', 'ACE', 'CHR', 'UTR', 'TQR', 'SAR', 'QR', 'SSR', 'SR', 'RRR', 'R']);
    });

    it('ne peut pas être modifié', () => {
        expect(Object.isFrozen(RARITIES)).toBe(true);
    });
});
