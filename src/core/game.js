/**
 * GameEngine — the whole game as a pure state machine.
 *
 * Knows nothing about the DOM, timers, storage or language. The UI drives it
 * (start / answer / advance) and renders from the snapshots it returns.
 *
 * Determinism note: the daily round is seeded from the date, so every player
 * sees the same film, the same wrong answers and the same A/B/C layout on a
 * given day. That seed does not survive a catalogue change -- `startDaily`
 * indexes into `films`, so adding films moves the daily film for every past
 * date. It has already happened (257 -> 334 -> 409 films), which is why the
 * daily now uses a plain fixed setting (CONFIG.daily) instead of mirroring the
 * classic parameters to preserve a byte-identical RNG stream.
 */
import { CONFIG } from '../config.js';
import { mulberry32, hashStr, shuffle } from './rng.js';
import { pickDistractors } from './distractors.js';
import { roundPoints, streakMultiplier } from './scoring.js';

export class GameEngine {
  /** @param {Array} films Film dataset for the active locale. */
  constructor(films) {
    this.films = films;
    this._reset('classic');
  }

  _reset(mode, lives) {
    this.mode = mode;
    this.level = mode === 'daily' ? 'daily' : CONFIG.defaultLevel;
    this.round = 0;
    this.score = 0;
    this.lives = lives ?? CONFIG.classicLives;
    this.streak = 0;
    this.bestStreakGame = 0;
    this.goodCount = 0;
    this.plan = [];
    this.current = null;
    this.answered = false;
    this.dailyOutcome = null;
  }

  /**
   * Start a 10-round classic game; the distractor window tightens as it goes.
   * @param {'easy'|'medium'|'hard'} levelId
   */
  startClassic(levelId = CONFIG.defaultLevel, allowIdx = null) {
    this._reset('classic', CONFIG.classicLives);
    this.level = Object.hasOwn(CONFIG.levels, levelId ?? '') ? levelId : CONFIG.defaultLevel;
    const dist = CONFIG.levels[this.level];
    const source = allowIdx ?? [...this.films.keys()];
    if (source.length < CONFIG.classicRounds) {
      throw new RangeError('Not enough films for a classic game.');
    }
    const allow = allowIdx ? new Set(allowIdx) : null;
    const order = shuffle([...source]).slice(0, CONFIG.classicRounds);
    this.plan = order.map((idx, i) => this._makeRound(
      idx, i / (CONFIG.classicRounds - 1), Math.random, dist, allow,
    ));
    this.current = this.plan[0];
    return this.current;
  }

  /** Start the seeded one-shot daily game for the given date key. */
  startDaily(dateKey) {
    this._reset('daily', CONFIG.dailyLives);
    const rnd = mulberry32(hashStr(CONFIG.dailySeedPrefix + dateKey));
    const idx = Math.floor(rnd() * this.films.length);
    this.current = this._makeRound(idx, 1, rnd, CONFIG.daily);
    this.plan = [this.current];
    return this.current;
  }

  _makeRound(idx, difficulty, rnd, dist, allow = null) {
    const distractors = pickDistractors(this.films, idx, { ...dist, difficulty, allow }, rnd);
    // Answer order is fixed at round creation, from the same RNG stream.
    const options = shuffle([idx, ...distractors], rnd);
    return { idx, options };
  }

  /**
   * Resolve the player's answer for the current round.
   * @param {number} choice Film index chosen (-1 = timeout).
   * @param {number} timeLeftMs Remaining time, feeds the speed bonus.
   */
  answer(choice, timeLeftMs) {
    if (this.answered) return null;
    this.answered = true;
    const ok = choice === this.current.idx;
    let points = 0;
    if (ok) {
      this.goodCount++;
      this.streak++;
      this.bestStreakGame = Math.max(this.bestStreakGame, this.streak);
      const scoreMult = this.mode === 'classic' ? CONFIG.levels[this.level].scoreMult : 1;
      points = roundPoints(this.streak, timeLeftMs, CONFIG.roundMs, scoreMult);
      this.score += points;
    } else {
      this.streak = 0;
      if (this.mode === 'classic') this.lives--;
    }
    if (this.mode === 'daily') this.dailyOutcome = ok;
    return {
      ok,
      points,
      film: this.films[this.current.idx],
      correctIdx: this.current.idx,
      streak: this.streak,
      multiplier: streakMultiplier(Math.max(this.streak, 1)),
      isLast: this.isLastRound(),
    };
  }

  isLastRound() {
    return this.mode === 'daily'
      || this.round + 1 >= this.plan.length
      || (this.mode === 'classic' && this.lives <= 0);
  }

  /** Move to the next round; returns it, or null when the game is over. */
  advance() {
    if (this.isLastRound()) return null;
    this.round++;
    this.current = this.plan[this.round];
    this.answered = false;
    return this.current;
  }

  /** Immutable view of the state, for rendering. */
  get snapshot() {
    return {
      mode: this.mode,
      level: this.level,
      round: this.round,
      totalRounds: CONFIG.classicRounds,
      score: this.score,
      lives: this.lives,
      maxLives: CONFIG.classicLives,
      streak: this.streak,
      bestStreakGame: this.bestStreakGame,
      goodCount: this.goodCount,
      dailyOutcome: this.dailyOutcome,
    };
  }
}
