/**
 * Distractor selection — turns palette similarity into difficulty.
 *
 * One dial: `depth`, how far down the similarity ranking the wrong answers may
 * come from. Everything else follows.
 *
 * @param {Array}  films  the active film dataset
 * @param {number} idx    index of the correct film
 * @param {object} opts
 *   @param {number}  opts.options    total answer buttons; the distractor count
 *                                    is options - 1
 *   @param {'nb'|'fb'} opts.end      which end of the ranking: 'nb' = nearest
 *                                    palettes (hard), 'fb' = farthest (easy)
 *   @param {number|number[]} opts.depth  how far down that ranking to draw
 *                                    from. A [start, end] pair is interpolated
 *                                    with `difficulty`, so the window tightens
 *                                    as the game goes on.
 *   @param {number}  opts.difficulty 0..1, progress through the game
 *   @param {Set<number>|null} opts.allow  restrict to a collection's films
 * @param {Function} rnd  injectable RNG for determinism
 *
 * A window wider than the stored list simply runs out of candidates, and the
 * remainder falls through to the random fill below. That is deliberate: it is
 * how the early rounds of `medium` stay forgiving without a separate flag.
 *
 * Small collections do need one guard. Filtering `nb` down to an 11-film pool
 * can leave a single film with only two fellow members in its ranking, and the
 * window then returns those same two every single round. That is not a ranking
 * any more, it is a fixed pair the player memorises. Exactly `count`
 * survivors is dropped, because that list can only ever return one fixed set.
 * The guard is deliberately that tight: widening it also fires on A24 and
 * Marvel, where the ranking is still meaningful, and makes the hard level easy.
 */
import { shuffle } from './rng.js';

export function pickDistractors(films, idx, opts, rnd = Math.random) {
  const { options = 3, end = 'nb', depth = 6, difficulty = 1, allow = null } = opts;
  const count = options - 1;

  const width = Array.isArray(depth)
    ? Math.round(depth[0] + (depth[1] - depth[0]) * difficulty)
    : depth;

  let src = end === 'fb' ? films[idx].fb : films[idx].nb;
  let fill = films.length;
  let allowArr = null;
  if (allow) {
    allowArr = [...allow];
    if (allowArr.length <= count) {
      throw new RangeError('A category needs more films than answer choices.');
    }
    src = src.filter(j => j !== idx && allow.has(j));
    // Exactly `count` survivors is the degenerate case: shuffling a list of
    // three and taking three returns the same three films every single round.
    // Drop it so the fill draws from the pool. Fewer than `count` already falls
    // through to the fill on its own; more than `count` still yields different
    // combinations, and widening this guard there would quietly turn the hard
    // level easy (measured: it doubles Marvel's distractor variety).
    if (src.length === count) src = [];
    fill = allowArr.length;
  }

  const out = new Set();
  for (const j of shuffle(src.slice(0, Math.max(0, width)), rnd)) {
    if (out.size < count) out.add(j);
  }
  while (out.size < count) {
    const pick = Math.floor(rnd() * fill);
    const j = allowArr ? allowArr[pick] : pick;
    if (j !== idx && !out.has(j)) out.add(j);
  }
  return [...out].slice(0, count);
}
