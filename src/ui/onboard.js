/**
 * Three irreversible steps for this page load: the auditorium, its projected
 * explanation, then the home screen. A short swipe, wheel gesture or button
 * starts a bounded animation; the browser's scroll position never drives it.
 */
import { place, revealHall, setHallOpacity, clamp01, SMOOTH } from './hall.js';
import { reduced } from './dom.js';

const WALK_MS = 760;
const HOME_MS = 420;
const GESTURE_PX = 38;

const CAMERA = [
  [0, 0.58, 0, 0.78],
  [0.58, 1, 0.78, 0.84],
];
const PUSH = [
  [0.10, 0.58, 0, 0.84],
  [0.58, 1, 0.84, 1],
];

const curve = (legs, p) => {
  for (const [start, end, from, to] of legs) {
    if (p <= end) return from + (to - from) * SMOOTH(clamp01((p - start) / (end - start)));
  }
  return legs[legs.length - 1][3];
};

/** A player who has already seen the introduction goes straight to the home
    screen: the room and its plates leave the document unloaded. */
export function dropOnboard() {
  document.getElementById('onboard')?.remove();
  document.getElementById('hall')?.remove();
}

export function initOnboard() {
  const root = document.getElementById('onboard');
  if (!root) return { retire() {} };

  const copy = root.querySelector('.ob-copy');
  const next = root.querySelector('.ob-next');
  const skip = root.querySelector('.ob-skip');
  const logo = document.querySelector('.hall-projection img');
  const tagline = document.querySelector('.hall-tagline');
  const beam = document.querySelector('.hall-beam');
  const menu = [document.querySelector('header'), document.getElementById('scr-home')].filter(Boolean);

  let step = 0;
  let moving = false;
  let live = true;
  let frame = 0;
  let generation = 0;
  let touchStart = null;
  let wheelDistance = 0;
  let lastWheel = 0;
  let wheelArmed = true;

  document.documentElement.classList.add('onboarding-locked');
  document.body.classList.add('onboarding');
  window.scrollTo(0, 0);
  menu.forEach(el => el.setAttribute('inert', ''));
  document.body.style.setProperty('--onboard-home', '0');
  document.body.style.setProperty('--onboard-home-shift', '18px');
  copy.style.opacity = '0';
  copy.style.visibility = 'hidden';
  copy.setAttribute('aria-hidden', 'true');
  root.dataset.step = 'door';
  place(0, 0);
  setHallOpacity(1);
  revealHall();

  const paintWalk = p => {
    place(curve(CAMERA, p), curve(PUSH, p));
    const door = 1 - SMOOTH(clamp01((p - 0.04) / 0.18));
    const principle = SMOOTH(clamp01((p - 0.48) / 0.40));
    if (logo) logo.style.opacity = door.toFixed(3);
    if (tagline) tagline.style.opacity = door.toFixed(3);
    if (beam) beam.style.opacity = (door * (1 - clamp01(p / 0.08))).toFixed(3);
    copy.style.opacity = principle.toFixed(3);
    copy.style.visibility = principle < 0.01 ? 'hidden' : 'visible';
    document.body.classList.toggle('hall-principle-focus', p >= 0.48);
  };

  const animate = (duration, paint, done) => {
    const token = ++generation;
    cancelAnimationFrame(frame);
    if (reduced()) {
      paint(1);
      done();
      return;
    }
    const start = performance.now();
    const tick = now => {
      if (!live || token !== generation) return;
      const t = clamp01((now - start) / duration);
      paint(SMOOTH(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else { frame = 0; done(); }
    };
    frame = requestAnimationFrame(tick);
  };

  const retire = () => {
    if (!live) return;
    live = false;
    ++generation;
    cancelAnimationFrame(frame);
    next.removeEventListener('click', advance);
    skip.removeEventListener('click', skipToHome);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('touchstart', onTouchStart);
    root.removeEventListener('touchmove', onTouchMove);
    root.removeEventListener('touchend', onTouchEnd);
    root.removeEventListener('touchcancel', onTouchCancel);
    document.documentElement.classList.remove('onboarding-locked');
    document.body.classList.remove('onboarding', 'hall-principle-focus');
    document.body.style.removeProperty('--onboard-home');
    document.body.style.removeProperty('--onboard-home-shift');
    menu.forEach(el => el.removeAttribute('inert'));
    root.remove();
    setHallOpacity(0);
  };

  const enterHome = () => {
    if (!live || step === 2) return;
    step = 2;
    moving = true;
    root.dataset.step = 'leaving';
    next.disabled = true;
    skip.tabIndex = -1;
    const copyStart = Number(copy.style.opacity) || 0;
    const logoStart = Number(logo?.style.opacity || 1);
    const taglineStart = Number(tagline?.style.opacity || 1);
    animate(HOME_MS, progress => {
      setHallOpacity(1 - progress);
      copy.style.opacity = (copyStart * (1 - progress)).toFixed(3);
      if (logo) logo.style.opacity = (logoStart * (1 - progress)).toFixed(3);
      if (tagline) tagline.style.opacity = (taglineStart * (1 - progress)).toFixed(3);
      document.body.style.setProperty('--onboard-home', progress.toFixed(3));
      document.body.style.setProperty('--onboard-home-shift', `${((1 - progress) * 18).toFixed(1)}px`);
    }, retire);
  };

  const advance = () => {
    if (!live || moving) return;
    if (step === 1) { enterHome(); return; }
    moving = true;
    root.dataset.step = 'walking';
    next.disabled = true;
    copy.removeAttribute('aria-hidden');
    animate(WALK_MS, paintWalk, () => {
      step = 1;
      moving = false;
      root.dataset.step = 'principle';
      next.textContent = next.dataset.homeLabel;
      next.disabled = false;
    });
  };

  const skipToHome = event => { event.preventDefault(); enterHome(); };
  const onWheel = event => {
    if (!live) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 450) {
      wheelArmed = true;
      wheelDistance = 0;
    }
    lastWheel = now;
    if (event.deltaY <= 0 || moving || !wheelArmed) return;
    wheelDistance += event.deltaY;
    if (wheelDistance >= GESTURE_PX) {
      wheelArmed = false;
      wheelDistance = 0;
      advance();
    }
  };
  const onTouchStart = event => {
    touchStart = null;
    if (event.target.closest?.('button, a')) return;
    touchStart = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = event => { if (live) event.preventDefault(); };
  const onTouchEnd = event => {
    if (touchStart === null) return;
    const distance = touchStart - (event.changedTouches[0]?.clientY ?? touchStart);
    touchStart = null;
    if (distance >= GESTURE_PX) { event.preventDefault(); advance(); }
  };
  const onTouchCancel = () => { touchStart = null; };
  const onKeyDown = event => {
    if (!live) return;
    if (event.key === 'Escape') { event.preventDefault(); enterHome(); return; }
    if (event.target.closest?.('button, a')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      advance();
    }
  };

  next.addEventListener('click', advance);
  skip.addEventListener('click', skipToHome);
  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchmove', onTouchMove, { passive: false });
  root.addEventListener('touchend', onTouchEnd, { passive: false });
  root.addEventListener('touchcancel', onTouchCancel);

  return { retire };
}
