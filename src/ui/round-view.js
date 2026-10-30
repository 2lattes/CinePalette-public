/** Round rendering: palette strip + shuffled answer buttons + reveal panel. */
import { $, reduced } from './dom.js';
import { escapeHtml } from '../core/html.js';

const KEYS = ['A', 'B', 'C', 'D'];

/** Matches the .46s settle in game.css. Kept here so one number moves both. */
const SETTLE_MS = 460;
/* The settle eases out, so the palette is legible well before it finishes: at
   60% of the curve the blur is under 2px. The clock starts there rather than at
   the very end — waiting for the last pixel of sharpness would hand the player
   half a second of a timed round for a flourish they have already read past. */
const READY_MS = 280;

const src = f => 'images/' + encodeURIComponent(f);

/* A swap owns two timers. If the player answers and moves on before the last
   one has fired — fast, but a key-masher gets there — the stale cleanup would
   strip .swapping and blank the ghost in the middle of the NEXT swap, cutting
   it back to the hard change this whole thing exists to remove. So a new swap
   cancels the old one's pending work first. */
let pending = [];
const cancelPending = () => { pending.forEach(clearTimeout); pending = []; };

/**
 * Hold the images of a game in the browser's cache before the first one is even
 * answered. Each palette is about 13 kB, so a whole ten-round plan costs less
 * than one photograph, and the swap then never waits on the network — which is
 * the difference between a focus pull and a card that sits blurred for a beat
 * on a bad connection.
 */
export function preloadPalettes(files) {
  for (const f of files) { const im = new Image(); im.src = src(f); }
}

/**
 * Swap the palette with a rack focus, and resolve once the new one is sharp.
 *
 * The outgoing frame is copied to the ghost layer and frozen on top, so the card
 * never shows a hole while the next file decodes — however long that takes, the
 * player keeps looking at the palette they were just shown. Only once the new
 * image is decoded do the two layers start moving.
 */
function swapPalette(file, tint) {
  const img = $('stripImg');
  const ghost = $('stripGhost');
  const card = $('stripCard');
  const previous = img.getAttribute('src');
  const next = src(file);

  if (previous === next) return Promise.resolve();
  cancelPending();

  if (reduced()) {
    img.src = next;
    return (img.decode ? img.decode().catch(() => {}) : Promise.resolve());
  }

  if (previous) {
    // The outgoing palette leaves still wearing its verdict — the desaturated
    // one you got wrong blurs away desaturated. Dropping the tint on the frame
    // of the swap was a second, competing change nobody asked for.
    ghost.src = previous;
    ghost.classList.add('hold');
    if (tint) ghost.classList.add(tint);
  }
  card.classList.add('swap-start');
  img.src = next;

  return (img.decode ? img.decode() : Promise.resolve())
    .catch(() => {})
    .then(() => new Promise(resolve => {
      card.classList.add('swapping');
      // Two frames: the first commits the start state after a decode that may
      // itself have cost a frame, the second lets the transition see a change.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        card.classList.remove('swap-start');
        ghost.classList.remove('hold');
        pending = [
          setTimeout(resolve, READY_MS),
          setTimeout(() => {
            card.classList.remove('swapping');
            ghost.classList.remove('tint-correct', 'tint-wrong');
            ghost.removeAttribute('src');   // stop holding a decoded copy
          }, SETTLE_MS),
        ];
      }));
    }));
}

/**
 * Paint a round. Resolves when the palette is legible — the caller starts the
 * clock on that, never while the image is still out of focus.
 */
export function renderRound(round, films, hint) {
  const f = films[round.idx];
  const card = $('stripCard');
  const tint = card.classList.contains('answer-correct') ? 'tint-correct'
    : card.classList.contains('answer-wrong') ? 'tint-wrong' : null;
  $('answers').innerHTML = round.options.map((j, i) =>
    `<button class="ans" data-idx="${j}"><span class="key">${KEYS[i]}</span>${escapeHtml(films[j].t)}</button>`,
  ).join('');
  $('reveal').className = 'reveal';
  $('verdict').innerHTML = $('revealTxt').innerHTML = '';
  $('nextRow').hidden = true;
  card.classList.remove('answer-correct', 'answer-wrong');
  $('qhint').textContent = hint;
  return swapPalette(f.f, tint);
}

/** Drop the last game's palette, so a new one never cross-fades out of it. */
export function resetPalette() {
  cancelPending();
  const ghost = $('stripGhost');
  $('stripImg').removeAttribute('src');
  ghost.removeAttribute('src');
  ghost.classList.remove('hold', 'tint-correct', 'tint-wrong');
  $('stripCard').classList.remove('swap-start', 'swapping');
}

/** Lock the answer buttons and color them after a guess. */
export function markAnswers(correctIdx, clickedBtn) {
  document.querySelectorAll('.ans').forEach(b => {
    b.disabled = true;
    if (+b.dataset.idx === correctIdx) b.classList.add('correct');
    else if (b === clickedBtn) b.classList.add('wrong');
    else b.classList.add('dim');
  });
}

export function renderReveal(result, clickedBtn, t) {
  const v = $('verdict');
  const reveal = $('reveal');
  v.className = 'verdict ' + (result.ok ? 'ok' : 'ko');
  // #reveal is an aria-live region: a screen reader only announces text that
  // lands in it once it is rendered, so show it first and fill it next frame.
  reveal.className = 'reveal show';
  requestAnimationFrame(() => {
    if (!reveal.classList.contains('show')) return;
    v.innerHTML = result.ok
      ? (clickedBtn ? t.verdict.okClick : t.verdict.okAuto)
      : (clickedBtn ? t.verdict.wrong : t.verdict.timeout);
    $('revealTxt').innerHTML = t.reveal.answer(result.film) +
      (result.ok ? t.reveal.points(result.points, result.streak, result.multiplier) : '');
  });
  $('nextBtn').innerHTML = result.isLast ? t.next.seeResult : t.next.nextRound;
  $('nextRow').hidden = false;
  $('stripCard').classList.add(result.ok ? 'answer-correct' : 'answer-wrong');
  $('nextBtn').focus();
}
