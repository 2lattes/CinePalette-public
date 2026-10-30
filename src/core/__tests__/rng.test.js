import { describe, expect, it } from 'vitest';
import { hashStr, mulberry32, shuffle } from '../rng.js';

describe('mulberry32', () => {
  it('replays the same stream for the same seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });

  it('stays in [0, 1)', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const x = rnd();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('hashStr', () => {
  it('matches the FNV-1a reference values', () => {
    expect(hashStr('')).toBe(2166136261);
    expect(hashStr('a')).toBe(0xe40c292c);
    expect(hashStr('foobar')).toBe(0xbf9cf968);
  });
});

describe('shuffle', () => {
  it('is deterministic with an injected rng', () => {
    const items = [...Array(20).keys()];
    expect(shuffle(items, mulberry32(1))).toEqual(shuffle(items, mulberry32(1)));
  });

  it('returns a permutation and leaves the input untouched', () => {
    const items = [...Array(20).keys()];
    const out = shuffle(items, mulberry32(3));
    expect(out).not.toBe(items);
    expect([...out].sort((x, y) => x - y)).toEqual(items);
    expect(items).toEqual([...Array(20).keys()]);
  });
});
