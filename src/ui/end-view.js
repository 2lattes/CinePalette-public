/** End-of-game card, for both classic and daily outcomes. */
import { $ } from './dom.js';
import { untilTomorrow } from '../core/date.js';

export function renderClassicEnd(snap, player, t, collectionId = null) {
  const collection = collectionId && t.collections[collectionId];
  $('endTitle').textContent = collection
    ? t.end.collectionTitle(collection.name)
    : (snap.lives <= 0 ? t.end.outOfLives : t.end.finished);
  $('endScore').textContent = snap.score;
  const sub = $('endSub');
  if (sub) sub.textContent = collection
    ? t.end.collectionBest(collection.name, player.bestByCollection[collectionId] || 0)
    : t.end.best(player.best);
  $('endRank').textContent = collection
    ? t.end.collectionRank(snap.goodCount, snap.totalRounds, collection.name)
    : t.end.classicRank(snap.goodCount, snap.totalRounds);
  $('endStreakLabel').textContent = t.end.bestStreak;
  $('shareBox').hidden = true;
  $('shareBtn').hidden = true;
  $('replayBtn').style.display = '';
  $('endReplay').hidden = false;
  renderEndStats(snap);
}

export function renderDailyEnd(snap, daily, shareText, t) {
  $('endTitle').textContent = snap.dailyOutcome ? t.end.dailyWin : t.end.dailyLoss;
  $('endScore').textContent = snap.dailyOutcome ? snap.score : '✗';
  const sub = $('endSub');
  if (sub) sub.textContent = t.end.dailyRank(snap.dailyOutcome);
  $('endRank').textContent = t.end.streak(daily.dailyStreak);
  $('endStreakLabel').textContent = t.end.dailyStreak;
  const countdown = untilTomorrow();
  $('shareBox').innerHTML = t.end.dailySummary({
    ok: snap.dailyOutcome,
    score: snap.score,
    streak: daily.dailyStreak,
    hours: countdown.hours,
    minutes: countdown.minutes,
  });
  $('shareBox').hidden = false;
  $('shareBtn').hidden = false;
  $('replayBtn').style.display = 'none';
  $('endReplay').hidden = true;
  renderEndStats(snap);
}

function renderEndStats(snap) {
  $('endGood').textContent = snap.goodCount;
  $('endStreak').textContent = snap.bestStreakGame;
}
