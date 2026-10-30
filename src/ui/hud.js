/** HUD rendering: round pill, level badge, score, streak, lives. */
import { $ } from './dom.js';
import { icon } from '../icons.js';

export function renderHud(snap, t, collectionId = null) {
  $('roundPill').innerHTML = snap.mode === 'daily'
    ? t.hud.dailyPill
    : t.hud.roundPill(snap.round + 1, snap.totalRounds);
  const lvlPill = $('levelPill');
  if (lvlPill) {
    if (snap.mode === 'classic') {
      lvlPill.hidden = false;
      lvlPill.dataset.level = snap.level;
      lvlPill.textContent = t.levels[snap.level];
    } else {
      lvlPill.hidden = true;
    }
  }
  const collectionPill = $('collectionPill');
  if (collectionPill) {
    const collection = collectionId && t.collections[collectionId];
    collectionPill.hidden = !collection || snap.mode !== 'classic';
    if (collection) collectionPill.textContent = collection.name;
  }
  const score = $('scoreVal');
  const previousScore = Number(score.textContent) || 0;
  score.textContent = snap.score;
  if (snap.score > previousScore) {
    score.classList.remove('score-pop');
    void score.offsetWidth;
    score.classList.add('score-pop');
  }
  $('streakVal').textContent = snap.streak;
  $('livesBox').innerHTML = snap.mode === 'daily'
    ? t.hud.dailyLives
    : Array.from({ length: snap.maxLives }, (_, i) =>
        `<span class="life ${i < snap.maxLives - snap.lives ? 'lost' : ''}">${icon('heart', 'icn-red')}</span>`,
      ).join('');
}

/** Make a scored answer feel immediate without delaying the next interaction. */
export function flashScoreGain(points) {
  if (!points) return;
  const score = $('scoreVal');
  const pill = $('scorePill');
  const delta = $('scoreDelta');
  delta.textContent = `+${points}`;
  for (const el of [score, pill, delta]) {
    el.classList.remove('score-pop', 'score-hit', 'show');
    void el.offsetWidth;
  }
  score.classList.add('score-pop');
  pill.classList.add('score-hit');
  delta.classList.add('show');
}
