/**
 * English locale — mirrors fr.js. Note: the reveal line has no
 * "original title" clause because English titles are already original.
 */
import { FILMS } from '../data/films.en.js';
import { icon } from '../icons.js';
import { escapeHtml } from '../core/html.js';

export default {
  storageKey: 'cinepalette-en',
  films: FILMS,

  levels: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },

  home: { filmLabel: 'movies' },

  programme: {
    title: 'Now showing',
    note: 'Three collections, played like a classic game. More to come.',
    bestLabel: 'Best',
  },

  collections: {
    a24: {
      name: 'A24',
      count: 77,
      statLabel: 'movies · A24',
    },
    marvel: {
      name: 'Marvel',
      count: 73,
      statLabel: 'movies · Marvel',
    },
    'star-wars': {
      name: 'Star Wars',
      count: 11,
      statLabel: 'movies · Star Wars',
    },
  },


  relaxed: {
    on: 'No timer · no speed bonus',
    off: 'Timer on · speed bonus',
  },

  roundHint: {
    timed: 'Answer fast: the time bonus melts every second.',
    relaxed: 'Take your time: this mode has no speed bonus.',
  },

  hud: {
    roundPill: (r, total) => `Round <b>${r}</b>/${total}`,
    dailyPill: '<b>Daily</b> palette',
    dailyLives: icon('target') + ' one single chance',
  },

  verdict: {
    okClick: icon('checkCircle', 'icn-good') + ' Nice one!',
    okAuto: icon('checkCircle', 'icn-good'),
    wrong: icon('xCircle') + ' Wrong!',
    timeout: icon('stopwatch') + ' Time is up!',
  },

  reveal: {
    answer: f => `It was <b>${escapeHtml(f.t)}</b>${f.y ? ' (' + escapeHtml(f.y) + ')' : ''}.`,
    points: (pts, streak, mult) =>
      ` <span class="pts">+${pts} pts</span>` +
      (streak > 1 ? ` · streak ×${mult.toFixed(1)}` : ''),
  },

  next: {
    nextRound: 'Next round ' + icon('arrowRight'),
    seeResult: 'See the result ' + icon('arrowRight'),
  },

  end: {
    outOfLives: 'Out of lives!',
    finished: 'Game over',
    dailyWin: 'Daily palette solved!',
    dailyLoss: 'Not this time…',
    bestStreak: 'Best streak:',
    dailyStreak: 'Daily streak:',
    collectionTitle: name => `${name} screening complete`,
    collectionBest: (name, best) => `${name} · screening best: ${best} pts`,
    collectionRank: (good, total, name) => good >= 7
      ? `A great ${name} screening — you already know its visual signature.`
      : `Another ${name} screening will reveal more colour.`,
    best: best => `Catalogue best · ${best} pts`,
    classicRank: (good, total) => {
      if (good === total) return 'Absolute eye — you read films like celluloid.';
      if (good >= 7) return 'Sharp eye — the next streak is within reach.';
      if (good >= 4) return 'Curious cinephile — palettes are starting to speak.';
      return 'Film scout — a rematch will reveal more colour.';
    },
    dailyRank: ok => ok ? 'One more palette for your collection.' : 'A new palette is waiting tomorrow.',
    streak: days => days > 1 ? `Current streak: ${days} days` : 'The first day of a new streak.',
    dailySummary: ({ ok, score, streak, hours, minutes }) => `
      <span class="share-kicker">DAILY PALETTE</span>
      <strong>${ok ? 'Solved!' : 'See you tomorrow.'}</strong>
      <span class="share-score">${ok ? `+${score} pts` : 'Another chance is coming soon'}</span>
      <span class="share-meta">Streak ${streak} · new palette in ${hours}h ${String(minutes).padStart(2, '0')}</span>`,
  },

  toasts: {
    dailyPlayed: 'Daily palette already played, come back tomorrow!',
    newBest: icon('trophy', 'icn-gold') + ' New best score!',
    shared: 'Result shared!',
    copied: 'Result copied!',
    copyFailed: 'Copy failed',
  },

  badge: {
    played: 'PLAYED ' + icon('checkCircle'),
    available: '1 / DAY',
  },

  shareText: (d, ok, score, streakDays) =>
    `CinéPalette · ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\n` +
    (ok ? `🟩 Solved! +${score} pts` : `🟥 Missed…`) +
    `\n🔥 Streak: ${streakDays} day${streakDays > 1 ? 's' : ''}`,
};
