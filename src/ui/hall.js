/**
 * The auditorium dolly.
 *
 * Nine plates cut from one photograph, each carrying the depth it was measured
 * at (in row pitches, nearest row = 1). Moving the camera forward by `t` scales
 * a plate by d / (d - t) about the vanishing point. That single relation is
 * what makes the rows separate at the rate a real walk would produce, and it is
 * also what makes the logo — parked at the back wall's depth — hold still while
 * the front row sweeps up past it.
 *
 * Two additions let the walk run the length of the room instead of stopping
 * three rows in, which is what the onboarding needs:
 *
 * 1. A plate dissolves as the camera reaches it. Geometry alone caps the move
 *    at t ≈ 0.55: past that the nearest row grows more than twofold and the
 *    velvet turns to mush. But a row the camera has walked THROUGH is not
 *    behind the lens in a photograph, it is still painted across the bottom of
 *    the frame. Fading each plate out over the last third of a pitch before the
 *    camera arrives is what a real row does as it leaves the field of view, and
 *    it buys the move another half-room.
 *
 * 2. The last stretch is a push, not a dolly. Once the rows are gone there is
 *    only the back wall left, so the whole world scales about the screen's own
 *    centre (50% / 32%). Nine plates cannot carry the camera the remaining nine
 *    pitches to the screen — that would take nine more photographs — but a
 *    uniform push into a wall that is nothing but screen by then is what the
 *    last steps down the aisle look like, and it lands the fade to black as an
 *    arrival rather than a cut.
 */
import { reduced } from './dom.js';

/* A camera starts from rest and comes to rest. Ease-out is right for something
   arriving on screen, but on a dolly it puts peak speed on the very first frame
   — measured at 3x the average — so the move reads as a lurch followed by a
   crawl. Quintic smoothstep accelerates and decelerates symmetrically and peaks
   at only 1.9x average, which is what makes it look filmed rather than snapped. */
export const SMOOTH = t => t * t * t * (t * (t * 6 - 15) + 10);

/** A plate holds full strength until the camera is this close, and is gone this close. */
const PASS_FADE = 0.62;
const PASS_GONE = 0.30;
/** A row is already fading as it approaches the camera. Past this scale it
    adds GPU pressure without adding useful visible depth. */
const ROW_SCALE_LIMIT = 2.4;
/** Extra world scale at the far end of the screen approach.
    Measured rather than guessed: at 0.92 the back wall is blown up past the
    proscenium arch and the arrival frame is a formless dark field, which also
    leaves the fade to black nothing to fade FROM. At 0.62 the arch frames the
    viewport edge to edge and the screen carries the copy at a size worth
    reading, which is the framing the walk exists to arrive at. */
const PUSH = 0.62;
/** Plates past this depth are the back wall and the screen it carries. */
const BACK_DEPTH = 8;

export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/* The plates ship as data-src so a returning player, who never sees the
   room, never downloads it. Vite cannot rewrite a data attribute, so the
   hashed URLs come from here instead of from the HTML. */
const PLATE_URLS = import.meta.glob('../assets/salle/*.webp',
  { eager: true, query: '?url', import: 'default' });

let plates = [];
let world = null;
let hall = null;

/** Only called when the introduction is about to play: this is what fetches the room. */
export function initHall() {
  hall = document.querySelector('.hall');
  if (!hall) return;
  world = hall.querySelector('.hall-world');
  hall.querySelectorAll('img[data-src]').forEach(img => {
    img.src = PLATE_URLS[`../assets/salle/${img.dataset.src}`];
  });
  plates = [...hall.querySelectorAll('.hall-layer')].map(el => ({
    el, depth: parseFloat(el.dataset.depth),
  }));
  place(0, 0);
}

/* The room's opacity has two owners and they must not fight over it: the
   reveal tween, which runs once when the plates decode, and the walk, which
   writes the handover to the menu on every frame. They are kept as separate
   factors and multiplied, because sharing the property directly meant a reader
   who scrolled during the first half second saw the two writers flicker. */
let revealT = 0;
let handover = 1;
const REVEAL_MS = 360;
const ROWS_IN_MS = 240;

const applyOpacity = () => {
  if (!hall) return;
  const v = revealT * handover;
  hall.style.opacity = v.toFixed(3);
  // Ten large plates held on the GPU for the rest of the session is memory
  // spent on something that is no longer on screen.
  if (v <= 0.001) hall.style.willChange = 'auto';
};

/**
 * Bring the room up immediately, then let the seats join once the full stack
 * has decoded. The fallback is a deliberately lit cinema-black surface, so a
 * slow decoder never leaves the visitor staring at an empty black page.
 *
 * Run here rather than as a CSS transition because from this point on the walk
 * writes the hall's opacity every frame, and a transition still attached to the
 * property would smear each of those writes across half a second: the room
 * would lag the scroll by exactly 0.55s and feel broken.
 */
export function revealHall() {
  if (!hall) return;
  const images = [...hall.querySelectorAll('img')];
  const rows = [...hall.querySelectorAll('img.hall-layer:not([data-depth="10.183"])')];

  // The atmosphere is ready before photography is. Hide only the row plates
  // while they decode; the backdrop, screen and projection can establish the
  // first frame without waiting for all nine large textures.
  document.body.classList.add('hall-loading');
  hall.style.visibility = 'visible';
  if (reduced()) {
    revealT = 1;
    applyOpacity();
  } else {
    // A visible first frame straight away avoids a black flash between the
    // hidden menu and the auditorium. It then settles over one short beat.
    revealT = 0.28;
    applyOpacity();
    const start = performance.now();
    const step = now => {
      revealT = 0.28 + 0.72 * Math.min(1, (now - start) / REVEAL_MS);
      applyOpacity();
      if (revealT < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  Promise.all(images.map(im => (im.decode ? im.decode() : Promise.resolve()).catch(() => {})))
    .then(() => {
      document.body.classList.remove('hall-loading');
      if (reduced()) return;
      // Rows enter together, rather than popping in as individual image decodes
      // finish. This is a bounded opacity pass — no image filter or extra layer.
      rows.forEach(row => {
        const opacity = Number(row.style.opacity || 1);
        if (opacity > 0.001 && row.animate) {
          row.animate([{ opacity: 0 }, { opacity }], {
            duration: ROWS_IN_MS,
            easing: 'cubic-bezier(.16,1,.3,1)',
          });
        }
      });
    });
}

/** The room's only say in the handover: the menu rises through it. */
export function setHallOpacity(v) {
  handover = v;
  applyOpacity();
}

/**
 * Put the camera `t` row-pitches into the room, `approach` (0..1) of the way
 * through the final push toward the screen.
 */
export function place(t, approach = 0) {
  if (!world) return;
  world.style.transform =
    `translate(-50%,-50%) scale(${(1 + approach * PUSH).toFixed(5)})`;
  for (const { el, depth } of plates) {
    // Rows dissolve twice: once because the camera reaches them, once because
    // the push has left them behind for good. The wall never dissolves — it is
    // the thing being approached.
    if (depth >= BACK_DEPTH) {
      el.style.transform = `scale(${(depth / (depth - t)).toFixed(5)})`;
      el.style.opacity = '1';
      continue;
    }
    // Not all the way out: the last rows thinning to a third keeps a floor of
    // seats under the frame. Taken to zero the bottom of the arrival shot is
    // empty ground, and the walk ends nowhere rather than at the front row.
    const passed = clamp01((depth - t - PASS_GONE) / (PASS_FADE - PASS_GONE));
    if (passed <= 0.001) {
      // An invisible plate must not retain a giant off-screen backing texture.
      // It will be restored at the right scale if the reader scrolls back.
      el.style.transform = 'scale(1)';
      el.style.opacity = '0';
      continue;
    }
    el.style.transform = `scale(${Math.min(depth / (depth - t), ROW_SCALE_LIMIT).toFixed(5)})`;
    el.style.opacity = (passed * (1 - approach * 0.62)).toFixed(3);
  }
}
