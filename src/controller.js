/**
 * GameController — the composition root's orchestrator.
 * Owns the wiring between domain (GameEngine), services (storage, clipboard)
 * and the view modules. No game rules live here; no DOM queries live outside ui/.
 */
import { CONFIG } from './config.js';
import { GameEngine } from './core/game.js';
import { isYesterday, todayKey } from './core/date.js';
import { poolFor } from './core/pool.js';
import { createDailyStore, createPlayerStore } from './services/storage.js';
import { shareOrCopy } from './services/clipboard.js';
import { $ } from './ui/dom.js';
import { show } from './ui/screens.js';
import { toast } from './ui/toast.js';
import { RoundTimer } from './ui/timer.js';
import { flashScoreGain, renderHud } from './ui/hud.js';
import { renderRound, markAnswers, renderReveal, resetPalette, preloadPalettes }
  from './ui/round-view.js';
import { renderClassicEnd, renderDailyEnd } from './ui/end-view.js';
import { renderHome } from './ui/home-view.js';
import { bindKeyboard } from './ui/keyboard.js';
import { initHall } from './ui/hall.js';
import { dropOnboard, initOnboard } from './ui/onboard.js';

export class GameController {
  /** @param {object} t Locale dictionary (strings + films + storageKey). */
  constructor(t) {
    this.t = t;
    this.engine = new GameEngine(t.films);
    this.store = createPlayerStore(t.storageKey);
    this.player = this.store.load();
    this.dailyStore = createDailyStore();
    this.daily = this.dailyStore.load(this.player);
    this.currentLevel = this.player.lastLevel || CONFIG.defaultLevel;
    // The home screen is always the full catalogue. A collection scopes the
    // pool of a classic game and nothing else: same rounds, same lives, same
    // difficulty as everywhere. One difficulty concept for the whole game.
    this.currentCollection = null;
    this.timer = new RoundTimer(() => this.answer(-1, null));
    this.shareText = '';
    this.relaxedMode = Boolean(this.player.relaxed);
    this.timedRound = true;
    // Bumped on every round and on every way out of a game, so a palette that
    // finishes settling after the player has left can't start a clock.
    this._roundToken = 0;
    // True while the one history entry pushed on entering a game is still
    // ours: the game and end screens share it, so Back always lands on home.
    this._inHistory = false;
  }

  init() {
    this._bindActions();
    this._bindAnswers();
    bindKeyboard({
      isAnswered: () => this.engine.answered,
      onNext: () => this.nextRound(),
    });
    this._bindSettings();
    this._bindHistory();
    this._syncSettings();
    this.refreshHome();
    // The introduction is shown once: the daily player comes back every day
    // and goes straight to the home screen. Settings can replay it.
    if (this.player.seenIntro) {
      dropOnboard();
      this.onboard = null;
      return;
    }
    initHall();
    // The introduction owns its fixed layer until it enters the home screen.
    this.onboard = initOnboard();
  }

  /* ---------- event wiring (declarative data-action hooks) ---------- */

  _bindActions() {
    const actions = {
      'start-classic': el => this.startClassic(el?.dataset.level, el?.dataset.collection),
      'start-daily': () => this.startDaily(),
      'next-round': () => this.nextRound(),
      'copy-share': () => this.copyShare(),
      'toggle-relaxed': () => this.toggleRelaxed(),
      'open-settings': () => this.openSettings(),
      'replay-intro': () => this.replayIntro(),
      'go-home': () => { this._leaveHistory(); this.goHome(); },
      'quit': () => { this._leaveHistory(); this.quitGame(); },
    };
    document.querySelectorAll('[data-action]').forEach(el => {
      const fn = actions[el.dataset.action];
      if (fn) el.addEventListener('click', () => fn(el));
    });
  }

  /**
   * The phone's Back gesture leaves a game for the home screen instead of the
   * site. Leaving a daily this way records nothing, exactly like the quit button.
   */
  _bindHistory() {
    window.addEventListener('popstate', () => {
      // Our own history.back() (see _leaveHistory) has already cleared the flag.
      if (!this._inHistory) return;
      this._inHistory = false;
      if ($('scr-game').classList.contains('active')) this.quitGame();
      else if ($('scr-end').classList.contains('active')) this.goHome();
    });
  }

  /** Called after showing the game screen; replays reuse the same entry. */
  _enterHistory() {
    if (this._inHistory) return;
    history.pushState({ screen: 'game' }, '');
    this._inHistory = true;
  }

  /** Leaving through a button: drop our entry so entries never pile up. */
  _leaveHistory() {
    if (!this._inHistory) return;
    this._inHistory = false;
    history.back();
  }

  /**
   * Difficulty and timer are settings, not a choice re-made before every game.
   * Radio inputs and a checkbox carry their own keyboard behaviour, so there is
   * no roving-tabindex or aria-checked bookkeeping to get wrong here.
   */
  _bindSettings() {
    document.querySelectorAll('#settingsDialog input[name="level"]').forEach(input => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        this.currentLevel = input.value;
        this.player.lastLevel = this.currentLevel;
        this.store.save(this.player);
        this._syncSettings();
      });
    });
    $('relaxedInput').addEventListener('change', e => this.setRelaxed(e.target.checked));
  }

  /** Push the current settings into every place that shows them. */
  _syncSettings() {
    const { currentLevel: level, relaxedMode: relaxed } = this;
    const radio = document.querySelector(
      `#settingsDialog input[name="level"][value="${CSS.escape(level)}"]`);
    if (radio) radio.checked = true;
    $('relaxedInput').checked = relaxed;
    const state = relaxed ? this.t.relaxed.on : this.t.relaxed.off;
    $('relaxedState').textContent = state;
    $('endRelaxedState').textContent = state;
    $('endRelaxed').setAttribute('aria-pressed', String(relaxed));
    document.querySelectorAll('.end-level').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.level === level));
    });
  }

  openSettings() {
    this._syncSettings();
    $('settingsDialog').showModal();
  }

  _bindAnswers() {
    $('answers').addEventListener('click', e => {
      const btn = e.target.closest('.ans');
      if (btn && !btn.disabled) this.answer(+btn.dataset.idx, btn);
    });
  }

  /* ---------- game flow ---------- */

  startClassic(level, collectionId = 'all') {
    this._leaveWalk();
    this.currentCollection = collectionId === 'resume' ? this.currentCollection : (collectionId || null);
    if (this.currentCollection && !this.t.collections[this.currentCollection]) this.currentCollection = null;
    this.currentLevel = Object.hasOwn(CONFIG.levels, level ?? '') ? level : this.currentLevel;
    this.player.lastLevel = this.currentLevel;
    this.player.lastCollection = this.currentCollection;
    this.store.save(this.player);
    this._syncSettings();
    const pool = poolFor(this.t.films, this.currentCollection);
    this.engine.startClassic(this.currentLevel, pool);
    this.timedRound = !this.relaxedMode;
    show('scr-game');
    this._enterHistory();
    this._startRounds();
  }

  startDaily() {
    this._leaveWalk();
    if (this.daily.lastDaily === todayKey()) {
      toast(this.t.toasts.dailyPlayed);
      return;
    }
    this.engine.startDaily(todayKey());
    this.timedRound = true;
    show('scr-game');
    this._enterHistory();
    this._startRounds();
  }

  /**
   * Open a game. The first palette has nothing to dissolve out of, so the last
   * game's image is dropped first; and the whole plan is warmed now, while the
   * player is still reading the first question.
   */
  _startRounds() {
    resetPalette();
    preloadPalettes(this.engine.plan.map(r => this.t.films[r.idx].f));
    this._renderCurrentRound();
  }

  _renderCurrentRound() {
    const hint = this.timedRound ? this.t.roundHint.timed : this.t.roundHint.relaxed;
    const token = ++this._roundToken;
    const landed = renderRound(this.engine.current, this.t.films, hint);
    renderHud(this.engine.snapshot, this.t, this.currentCollection);
    $('timerbar').hidden = !this.timedRound;
    this.timer.stop();
    this.timer.timeLeft = 0;
    if (!this.timedRound) return;
    // The clock starts when the palette is readable, not while it is still out
    // of focus — those 460 ms are the game's, not the player's. The token
    // drops the callback if the player has already moved on (quit, new game).
    landed.then(() => {
      if (token === this._roundToken && this.timedRound) this.timer.start();
    });
  }

  answer(choice, btn) {
    const result = this.engine.answer(choice, this.timer.timeLeft);
    if (!result) return; // already answered
    this.timer.stop();
    markAnswers(result.correctIdx, btn);
    renderHud(this.engine.snapshot, this.t, this.currentCollection);
    if (result.ok) flashScoreGain(result.points);
    renderReveal(result, btn, this.t);
  }

  nextRound() {
    // Idempotent: a keyboard shortcut and the focused button's native click can
    // both land here, and once endGame() has run the round stays "answered".
    if (!this.engine.answered || !$('scr-game').classList.contains('active')) return;
    if (this.engine.advance()) this._renderCurrentRound();
    else this.endGame();
  }

  endGame() {
    this._roundToken++;
    this.timer.stop();
    const snap = this.engine.snapshot;
    if (snap.mode === 'classic') {
      this.player.games++;
      const collection = this.currentCollection;
      const prevBest = collection
        ? (this.player.bestByCollection[collection] || 0)
        : this.player.best;
      if (snap.score > prevBest) {
        if (collection) this.player.bestByCollection[collection] = snap.score;
        toast(this.t.toasts.newBest);
      }
      if (!collection) this.player.best = Math.max(this.player.best, snap.score);
      this.store.save(this.player);
      renderClassicEnd(snap, this.player, this.t, collection);
    } else {
      const today = todayKey();
      this.daily.dailyStreak = snap.dailyOutcome
        ? (isYesterday(this.daily.lastDaily) ? this.daily.dailyStreak + 1 : 1)
        : 0;
      this.daily.lastDaily = today;
      this.dailyStore.save(this.daily);
      // Keep the legacy fields in sync for a seamless upgrade from older saves.
      this.player.lastDaily = today;
      this.player.dailyStreak = this.daily.dailyStreak;
      this.store.save(this.player);
      this.shareText = this.t.shareText(new Date(), snap.dailyOutcome, snap.score, this.player.dailyStreak);
      renderDailyEnd(snap, this.daily, this.shareText, this.t);
    }
    this.refreshHome();
    show('scr-end');
  }

  async copyShare() {
    const outcome = await shareOrCopy(this.shareText || '');
    if (outcome === 'shared') toast(this.t.toasts.shared);
    else if (outcome === 'copied') toast(this.t.toasts.copied);
    else if (outcome !== 'cancelled') toast(this.t.toasts.copyFailed);
  }

  /**
   * Entering a game ensures the introduction has been retired and records that
   * the player has reached the main experience.
   */
  _leaveWalk() {
    if (!this.onboard) return;
    // retire() is idempotent: the home transition normally calls it first.
    this.onboard.retire();
    if (this.player.seenIntro) return;
    this.player.seenIntro = true;
    this.store.save(this.player);
  }

  /** The introduction only plays on a fresh page load, so replaying it reloads. */
  replayIntro() {
    this.player.seenIntro = false;
    this.store.save(this.player);
    location.reload();
  }

  setRelaxed(on) {
    this.relaxedMode = on;
    this.player.relaxed = on;
    this.store.save(this.player);
    this._syncSettings();
  }

  toggleRelaxed() {
    this.setRelaxed(!this.relaxedMode);
  }

  goHome() {
    this._roundToken++;
    this.currentCollection = null;
    this.refreshHome();
    show('scr-home');
  }

  quitGame() {
    this.timer.stop();
    this.goHome();
  }

  refreshHome() {
    renderHome(
      this.player,
      this.daily,
      this.t.films.length,
      this.daily.lastDaily === todayKey(),
      this.t,
      this.currentCollection,
    );
  }
}
