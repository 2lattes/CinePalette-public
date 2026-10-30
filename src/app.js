/**
 * Entry point / composition root.
 * The locale is declared by the HTML shell (<html lang="fr|en">); each shell
 * loads this same entry, and only the matching locale bundle (strings + film
 * dataset) is fetched thanks to the dynamic import (code splitting).
 */
import './styles/main.css';
import { GameController } from './controller.js';

const lang = document.documentElement.lang === 'en' ? 'en' : 'fr';

import(`./i18n/${lang}.js`).then(({ default: locale }) => {
  new GameController(locale).init();
});
