/**
 * Screen router: exactly one .screen is active. The introductory steps have
 * their own fixed layer and finish before a game can start.
 */
import { $, $$ } from './dom.js';

export function show(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  document.body.classList.toggle('in-game', id === 'scr-game');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
