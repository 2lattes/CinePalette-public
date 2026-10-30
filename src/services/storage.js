/**
 * Persistence — the only module allowed to touch localStorage.
 * The key is locale-scoped ('cinepalette' / 'cinepalette-en'), unchanged from
 * the original app so existing player records and streaks are preserved.
 */
import { CONFIG } from '../config.js';

export function createPlayerStore(key) {
  return {
    load() {
      try { return withDefaults(JSON.parse(localStorage.getItem(key)) || {}); }
      catch { return withDefaults({}); }
    },
    save(state) {
      localStorage.setItem(key, JSON.stringify(state));
    },
  };
}

/**
 * Daily progress deliberately lives outside the locale-scoped player saves.
 * A player can switch languages without receiving a second daily attempt.
 */
export function createDailyStore() {
  const key = 'cinepalette-daily';
  return {
    load(legacy = {}) {
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if (saved) return withDailyDefaults(saved);
      } catch { /* start from legacy data below */ }
      return withDailyDefaults({
        lastDaily: legacy.lastDaily,
        dailyStreak: legacy.dailyStreak,
      });
    },
    save(state) {
      localStorage.setItem(key, JSON.stringify(withDailyDefaults(state)));
    },
  };
}

function withDefaults(s) {
  s.best = s.best || 0;          // overall best (all levels) — header pill
  s.games = s.games || 0;
  s.dailyStreak = s.dailyStreak || 0;
  // Valeur lue dans le stockage : uniquement un niveau connu (bloque aussi
  // '__proto__' ou une chaîne qui casserait le sélecteur des réglages).
  s.lastLevel = typeof s.lastLevel === 'string' && Object.hasOwn(CONFIG.levels, s.lastLevel)
    ? s.lastLevel : CONFIG.defaultLevel;
  s.relaxed = Boolean(s.relaxed);   // timer preference, kept between sessions
  s.lastCollection = s.lastCollection || null;
  s.seenIntro = Boolean(s.seenIntro);
  // Single catalogue best. `scoreMult` already equalises the levels (a perfect
  // game scores 2320 / 3480 / 4640 on easy / medium / hard, exactly 1 / 1.5 / 2),
  // so one record is fair and three were only noise. Migration: absorb any
  // per-level bests left by older saves, then drop the field.
  const bl = s.bestByLevel || {};
  s.best = Math.max(s.best, bl.easy || 0, bl.medium || 0, bl.hard || 0);
  delete s.bestByLevel;
  s.bestByCollection = s.bestByCollection || {};
  return s;
}

function withDailyDefaults(s) {
  return {
    lastDaily: typeof s.lastDaily === 'string' ? s.lastDaily : null,
    dailyStreak: Number.isFinite(s.dailyStreak) ? s.dailyStreak : 0,
  };
}
