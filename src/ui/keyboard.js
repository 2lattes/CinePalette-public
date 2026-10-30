/** Keyboard shortcuts: A/B/C/D or 1–4 answer, Enter/Space advances. */
import { $ } from './dom.js';

const KEY_MAP = { a: 0, b: 1, c: 2, d: 3, 1: 0, 2: 1, 3: 2, 4: 3 };

export function bindKeyboard({ isAnswered, onNext }) {
  document.addEventListener('keydown', e => {
    if (!$('scr-game').classList.contains('active')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (!isAnswered()) return;
      // Stop the focused button (#nextBtn) from firing its own click as well.
      e.preventDefault();
      if (!e.repeat) onNext();
      return;
    }
    const i = KEY_MAP[e.key.toLowerCase()];
    if (i !== undefined) {
      const b = document.querySelectorAll('.ans')[i];
      if (b && !b.disabled) b.click();
    }
  });
}
