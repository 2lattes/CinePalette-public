/** Home screen stats: best score, games played, daily streak, collection records. */
import { $ } from './dom.js';

export function renderHome(player, daily, filmCount, dailyPlayedToday, t, collectionId = null) {
  $('bestScore').textContent = player.best;
  $('statGames').textContent = player.games;
  $('dailyStreak').textContent = daily.dailyStreak || 0;
  const collection = collectionId && t.collections[collectionId];
  $('statFilms').textContent = collection ? collection.count : filmCount;
  $('statFilmsLabel').textContent = collection ? collection.statLabel : t.home.filmLabel;
  $('dailyBadge').innerHTML = dailyPlayedToday ? t.badge.played : t.badge.available;
  // One record per collection — never one per collection × level, which would be
  // 34 × 3 unreadable numbers. Missing nodes are simply collections the current
  // programme does not show yet.
  for (const id of Object.keys(t.collections)) {
    const node = $('best-' + id);
    if (node) node.textContent = player.bestByCollection[id] || 0;
  }
}
