/**
 * Scoring rules. Pure functions of (streak, time, level) — trivially unit-testable.
 */
import { CONFIG } from '../config.js';

/** Streak multiplier: ×1.0, ×1.1, … capped at ×2.0. */
export function streakMultiplier(streak) {
  return 1 + Math.min(streak - 1, CONFIG.maxStreakSteps) * CONFIG.streakStep;
}

/**
 * Points for a correct answer.
 * @param streak      current streak
 * @param timeLeftMs  remaining time (feeds the speed bonus)
 * @param roundMs     round duration
 * @param scoreMult   per-level multiplier (1 for daily / medium-equivalent)
 */
export function roundPoints(streak, timeLeftMs, roundMs = CONFIG.roundMs, scoreMult = 1) {
  const timeBonus = Math.round(CONFIG.maxTimeBonus * (timeLeftMs / roundMs));
  return Math.round((CONFIG.basePoints + timeBonus) * streakMultiplier(streak) * scoreMult);
}
