/**
 * Game tuning constants. Pure data — no logic.
 * Values are identical to the original implementation.
 */
export const CONFIG = Object.freeze({
  /** Rounds per classic game. */
  classicRounds: 10,
  /** Lives in classic mode. */
  classicLives: 3,
  /** Lives in daily mode. */
  dailyLives: 1,
  /** Time allowed per round, in ms. */
  roundMs: 20000,
  /** Base points for a correct answer. */
  basePoints: 100,
  /** Max time bonus (linear with remaining time). */
  maxTimeBonus: 100,
  /** Per-step streak multiplier increment, capped at maxStreakSteps. */
  streakStep: 0.1,
  maxStreakSteps: 10,
  /** Seed prefix for the daily RNG — shared across locales so everyone
   *  gets the same film on a given day. Do not change: it would reshuffle
   *  the daily palette for all players. */
  dailySeedPrefix: 'cinepalette-',

  /**
   * Classic-mode difficulty levels. One dial carries the difficulty: how deep
   * into the palette-similarity ranking the wrong answers are drawn from.
   *
   *   end    'nb' = the nearest palettes (hard to tell apart)
   *          'fb' = the farthest (easy)
   *   depth  how far down that ranking we may draw. Shallow on 'nb' means the
   *          very nearest neighbours, so the hardest. A [start, end] pair is
   *          interpolated across the game: the window tightens round by round.
   *          A width wider than the stored list (30 entries) leaves the
   *          remainder to the random fallback -- that is what keeps the first
   *          medium rounds forgiving, and it replaces the old `ramp` flag.
   *   options total answer buttons. The distractor count is always options - 1,
   *          so it is never stored twice.
   *   scoreMult per-level points multiplier. It is what makes a single best
   *          score fair across levels, so levels need not share `options`.
   */
  levels: {
    easy:   { end: 'fb', depth: 10,      options: 3, scoreMult: 1 },
    medium: { end: 'nb', depth: [60, 8], options: 3, scoreMult: 1.5 },
    hard:   { end: 'nb', depth: 6,       options: 4, scoreMult: 2 },
  },

  /** The daily round is a game like any other, with one fixed setting. */
  daily: { end: 'nb', depth: 12, options: 3, scoreMult: 1 },

  defaultLevel: 'easy',
});
