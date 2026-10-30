/**
 * Golden test for the daily game.
 *
 * Records, for 400 consecutive dates, the daily film, its distractors and the
 * A/B/C order in both locales, then compares every run against that record.
 * One extra rnd() call, a changed seed prefix or a reordered dataset changes
 * the daily game for every player — this test is what notices.
 *
 * The snapshot is expected to change only on an explicit decision (a
 * catalogue update moves the daily film, see core/game.js). Regenerate it with
 * `npx vitest run -u` in that case, never just to make the test pass.
 */
import { describe, expect, it } from 'vitest';
import { GameEngine } from '../game.js';
import { FILMS as FILMS_FR } from '../../data/films.fr.js';
import { FILMS as FILMS_EN } from '../../data/films.en.js';
import { todayKey } from '../date.js';

const DAYS = 400;

function dateKeys(start = new Date(2026, 0, 1)) {
  return Array.from({ length: DAYS }, (_, i) =>
    todayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** One line per date: "YYYY-MM-DD film | optionA, optionB, optionC". */
function dailyRecord(films) {
  const engine = new GameEngine(films);
  return dateKeys().map(key => {
    const { idx, options } = engine.startDaily(key);
    return `${key} ${films[idx].f} | ${options.map(i => films[i].f).join(', ')}`;
  }).join('\n') + '\n';
}

describe('daily game', () => {
  it('stays identical for 400 dates (fr)', async () => {
    await expect(dailyRecord(FILMS_FR)).toMatchFileSnapshot('./__snapshots__/daily.fr.golden.txt');
  });

  it('stays identical for 400 dates (en)', async () => {
    await expect(dailyRecord(FILMS_EN)).toMatchFileSnapshot('./__snapshots__/daily.en.golden.txt');
  });

  it('gives both locales the same film on the same day', () => {
    expect(dailyRecord(FILMS_EN)).toBe(dailyRecord(FILMS_FR));
  });

  it('includes the correct film among the options', () => {
    const engine = new GameEngine(FILMS_FR);
    for (const key of dateKeys()) {
      const { idx, options } = engine.startDaily(key);
      expect(options).toContain(idx);
      expect(new Set(options).size).toBe(options.length);
    }
  });
});
