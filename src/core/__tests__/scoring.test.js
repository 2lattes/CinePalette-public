import { describe, expect, it } from 'vitest';
import { roundPoints, streakMultiplier } from '../scoring.js';
import { CONFIG } from '../../config.js';

describe('streakMultiplier', () => {
  it('starts at ×1.0 and adds 0.1 per streak step', () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBeCloseTo(1.1);
    expect(streakMultiplier(6)).toBeCloseTo(1.5);
  });

  it('caps at ×2.0', () => {
    expect(streakMultiplier(11)).toBeCloseTo(2);
    expect(streakMultiplier(50)).toBeCloseTo(2);
  });
});

describe('roundPoints', () => {
  it('gives base points plus the full time bonus when answered instantly', () => {
    expect(roundPoints(1, CONFIG.roundMs)).toBe(CONFIG.basePoints + CONFIG.maxTimeBonus);
  });

  it('gives only base points at timeout', () => {
    expect(roundPoints(1, 0)).toBe(CONFIG.basePoints);
  });

  it('scales the time bonus linearly', () => {
    expect(roundPoints(1, CONFIG.roundMs / 2)).toBe(150);
  });

  it('applies the streak and level multipliers', () => {
    expect(roundPoints(6, CONFIG.roundMs)).toBe(300);
    expect(roundPoints(1, CONFIG.roundMs, CONFIG.roundMs, 1.5)).toBe(300);
    expect(roundPoints(11, CONFIG.roundMs, CONFIG.roundMs, 2)).toBe(800);
  });
});
