/**
 * RoundTimer — owns the countdown and the timer-bar rendering.
 * Reports remaining ms; fires onTimeout once when time runs out.
 *
 * Time is measured against performance.now(), never by counting ticks:
 * browsers throttle timers in a hidden tab or under load, so a tick counter
 * would stretch the round and skew the time bonus. The bar is drawn on
 * requestAnimationFrame (which pauses with the tab); a deadline timeout makes
 * sure the round still ends on time while nothing is being drawn.
 */
import { CONFIG } from '../config.js';
import { $ } from './dom.js';

export class RoundTimer {
  constructor(onTimeout) {
    this.onTimeout = onTimeout;
    this.frame = null;
    this.deadline = null;
    this.startedAt = null;
    this._frozen = 0;
  }

  /** Remaining ms: live while running, frozen at the last value once stopped. */
  get timeLeft() {
    if (this.startedAt === null) return this._frozen;
    return Math.max(0, CONFIG.roundMs - (performance.now() - this.startedAt));
  }

  set timeLeft(ms) {
    this._frozen = ms;
  }

  start() {
    this.stop();
    this.startedAt = performance.now();
    const bar = $('timerbar'), fill = $('timerfill');
    bar.classList.remove('danger');
    bar.setAttribute('aria-valuenow', '20');
    fill.style.transform = 'scaleX(1)';
    let shownSeconds = 20;
    const draw = () => {
      const left = this.timeLeft;
      const r = left / CONFIG.roundMs;
      fill.style.transform = `scaleX(${r})`;
      // Screen readers only need whole seconds, not an update every frame.
      const seconds = Math.ceil(left / 1000);
      if (seconds !== shownSeconds) {
        shownSeconds = seconds;
        bar.setAttribute('aria-valuenow', String(seconds));
      }
      if (r < .30) bar.classList.add('danger');
      if (left <= 0) { this._expire(); return; }
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
    this.deadline = setTimeout(() => this._expire(), CONFIG.roundMs);
  }

  stop() {
    if (this.startedAt !== null) this._frozen = this.timeLeft;
    this.startedAt = null;
    if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
    if (this.deadline !== null) { clearTimeout(this.deadline); this.deadline = null; }
  }

  _expire() {
    if (this.startedAt === null) return;
    this.stop();
    this._frozen = 0;
    this.onTimeout();
  }
}
