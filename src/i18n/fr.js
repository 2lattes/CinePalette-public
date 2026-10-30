/**
 * French locale — every player-facing string produced by JS, plus the
 * locale-scoped storage key and film dataset (French titles).
 * The HTML shell (index.html) carries its own static copy.
 */
import { FILMS } from '../data/films.fr.js';
import { icon } from '../icons.js';
import { escapeHtml } from '../core/html.js';

export default {
  storageKey: 'cinepalette',
  films: FILMS,

  levels: { easy: 'Facile', medium: 'Moyen', hard: 'Difficile' },

  home: { filmLabel: 'films' },

  programme: {
    title: 'Au programme',
    note: 'Trois collections, jouables comme une partie classique. D’autres suivront.',
    bestLabel: 'Record',
  },

  collections: {
    a24: {
      name: 'A24',
      count: 77,
      statLabel: 'films · A24',
    },
    marvel: {
      name: 'Marvel',
      count: 73,
      statLabel: 'films · Marvel',
    },
    'star-wars': {
      name: 'Star Wars',
      count: 11,
      statLabel: 'films · Star Wars',
    },
  },


  relaxed: {
    on: 'Sans chrono · sans bonus',
    off: 'Chrono actif · bonus de rapidité',
  },

  roundHint: {
    timed: 'Réponds vite : le bonus de temps fond à chaque seconde.',
    relaxed: 'Prends ton temps : aucun bonus de rapidité dans ce mode.',
  },

  hud: {
    roundPill: (r, total) => `Manche <b>${r}</b>/${total}`,
    dailyPill: 'Palette du <b>jour</b>',
    dailyLives: icon('target') + ' une seule chance',
  },

  verdict: {
    okClick: icon('checkCircle', 'icn-good') + ' Bien vu !',
    okAuto: icon('checkCircle', 'icn-good'),
    wrong: icon('xCircle') + ' Raté !',
    timeout: icon('stopwatch') + ' Temps écoulé !',
  },

  reveal: {
    answer: f => `C'était <b>${escapeHtml(f.t)}</b>${f.y ? ' (' + escapeHtml(f.y) + ')' : ''}` +
      `${f.o ? ', titre original : <i>' + escapeHtml(f.o) + '</i>' : ''}.`,
    points: (pts, streak, mult) =>
      ` <span class="pts">+${pts} pts</span>` +
      (streak > 1 ? ` · série ×${mult.toFixed(1)}` : ''),
  },

  next: {
    nextRound: 'Manche suivante ' + icon('arrowRight'),
    seeResult: 'Voir le résultat ' + icon('arrowRight'),
  },

  end: {
    outOfLives: 'Plus de vies !',
    finished: 'Partie terminée',
    dailyWin: 'Palette du jour réussie !',
    dailyLoss: 'Pas cette fois…',
    bestStreak: 'Meilleure série :',
    dailyStreak: 'Série quotidienne :',
    collectionTitle: name => `Séance ${name} terminée`,
    collectionBest: (name, best) => `${name} · record de séance : ${best} pts`,
    collectionRank: (good, total, name) => good >= 7
      ? `Très belle séance ${name} — tu connais déjà son empreinte visuelle.`
      : `La prochaine séance ${name} révélera d’autres couleurs.`,
    best: best => `Record du catalogue · ${best} pts`,
    classicRank: (good, total) => {
      if (good === total) return 'Œil absolu — tu lis les films comme une pellicule.';
      if (good >= 7) return 'Œil affûté — la prochaine série est à ta portée.';
      if (good >= 4) return 'Cinéphile curieux — les palettes commencent à parler.';
      return 'Éclaireur de pellicule — une revanche révélera davantage de couleurs.';
    },
    dailyRank: ok => ok ? 'Une palette de plus dans ta collection.' : 'Demain, une nouvelle palette t’attend.',
    streak: days => days > 1 ? `Série en cours : ${days} jours` : 'Premier jour de ta nouvelle série.',
    dailySummary: ({ ok, score, streak, hours, minutes }) => `
      <span class="share-kicker">PALETTE DU JOUR</span>
      <strong>${ok ? 'Trouvée !' : 'À demain.'}</strong>
      <span class="share-score">${ok ? `+${score} pts` : 'Une autre chance arrive bientôt'}</span>
      <span class="share-meta">Série ${streak} · nouveau défi dans ${hours} h ${String(minutes).padStart(2, '0')}</span>`,
  },

  toasts: {
    dailyPlayed: 'Palette du jour déjà jouée, reviens demain !',
    newBest: icon('trophy', 'icn-gold') + ' Nouveau record !',
    shared: 'Résultat partagé !',
    copied: 'Résultat copié !',
    copyFailed: 'Copie impossible',
  },

  badge: {
    played: 'JOUÉ ' + icon('checkCircle'),
    available: '1 / JOUR',
  },

  shareText: (d, ok, score, streakDays) =>
    `CinéPalette du ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}\n` +
    (ok ? `🟩 Trouvé ! +${score} pts` : `🟥 Raté…`) +
    `\n🔥 Série : ${streakDays} jour${streakDays > 1 ? 's' : ''}`,
};
