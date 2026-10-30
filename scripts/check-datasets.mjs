#!/usr/bin/env node
/**
 * Vérifier que films.fr.js et films.en.js décrivent le même catalogue.
 *
 * Le Daily tire un film et ses distracteurs par INDEX dans FILMS, en suivant
 * `nb` / `fb` (README, « Invariants »). Si les deux langues divergent sur
 * l'ordre, le fichier palette, l'année, les voisins ou les collections, un
 * joueur FR et un joueur EN n'ont plus la même partie du jour, sans aucune
 * erreur visible. Seuls `t` (titre affiché) et `o` (titre original, fr) ont
 * le droit de différer.
 *
 *     node scripts/check-datasets.mjs      (ou : npm test)
 *
 * Lancé avant chaque build (prebuild) et à la fin de scripts/add-films.py.
 * Lecture seule : ne modifie rien. Code de sortie 1 au premier écart.
 */
import { FILMS as FR } from '../src/data/films.fr.js';
import { FILMS as EN } from '../src/data/films.en.js';

// Champs partagés par toutes les langues ; t et o sont traduits.
const SHARED = ['f', 'y', 'nb', 'fb', 'c'];
const MAX_REPORTED = 20;

const problems = [];

if (FR.length !== EN.length) {
  problems.push(`longueur : fr ${FR.length} films, en ${EN.length} films`);
}

const n = Math.min(FR.length, EN.length);
for (let i = 0; i < n; i++) {
  for (const key of SHARED) {
    const a = JSON.stringify(FR[i][key]);
    const b = JSON.stringify(EN[i][key]);
    if (a !== b) {
      problems.push(`film ${i} (${FR[i].f}) : « ${key} » diffère\n    fr ${a}\n    en ${b}`);
    }
  }
}

// t et o finissent dans du HTML (boutons de réponse, révélation) : pas de balise.
for (const [lang, films] of [['fr', FR], ['en', EN]]) {
  films.forEach((film, i) => {
    for (const key of ['t', 'o']) {
      if (typeof film[key] === 'string' && /[<>]/.test(film[key])) {
        problems.push(`film ${i} (${film.f}, ${lang}) : « ${key} » contient < ou >`);
      }
    }
  });
}

if (problems.length) {
  console.error(`check-datasets : ${problems.length} écart(s) entre films.fr.js et films.en.js`);
  for (const p of problems.slice(0, MAX_REPORTED)) console.error('  ' + p);
  if (problems.length > MAX_REPORTED) {
    console.error(`  … et ${problems.length - MAX_REPORTED} autre(s).`);
  }
  process.exit(1);
}

console.log(`check-datasets : ok, ${FR.length} films identiques en fr et en (${SHARED.join(', ')}).`);
