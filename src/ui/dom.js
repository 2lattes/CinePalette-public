/** Tiny DOM helpers — the only place querying the document. */
export const $ = id => document.getElementById(id);
export const $$ = sel => document.querySelectorAll(sel);

/** True when the player asked the OS for reduced motion. */
export const reduced = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
