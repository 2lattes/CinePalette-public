import { $ } from './dom.js';

let hideTimer = null;
let fillFrame = 0;

/** Transient notification (accepts trusted HTML for inline icons). */
export function toast(msg, ms = 2200) {
  const t = $('toast');
  // #toast is role="status": empty it, then refill next frame, so a repeated
  // message still counts as a change and gets announced again.
  t.innerHTML = '';
  cancelAnimationFrame(fillFrame);
  clearTimeout(hideTimer);
  fillFrame = requestAnimationFrame(() => {
    t.innerHTML = msg;
    t.classList.add('show');
    hideTimer = setTimeout(() => t.classList.remove('show'), ms);
  });
}
