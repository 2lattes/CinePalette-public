# AGENTS.md — consignes pour les agents

CinéPalette : deviner un film à sa palette de couleurs. JS vanilla + Vite, sans
framework. L'architecture détaillée est dans [README.md](README.md). Ce fichier résume ce
qu'il ne faut pas casser.

## Commandes

```bash
npm ci            # installer (respecte package-lock.json)
npm run dev       # serveur de dev
npm run build     # build de production → dist/ ; doit réussir avant tout commit
npm test          # contrôle FR/EN des données puis Vitest (test d'or du Daily)
```

## Invariants — ne pas casser

- **Déterminisme du Daily.** Le film du jour, ses distracteurs et l'ordre A/B/C
  viennent d'un seul flux RNG semé par `CONFIG.dailySeedPrefix` + date
  (`cinepalette-YYYY-MM-DD`), consommé dans un ordre fixe : film → distracteurs
  → mélange des réponses (`src/core/game.js`, `src/core/rng.js`). Ne change ni
  le préfixe, ni l'ordre des tirages, ni `CONFIG.daily`.
- **Clés localStorage.** `cinepalette` (fr), `cinepalette-en` (en) et
  `cinepalette-daily` (progression du jour, commune aux langues). Les renommer
  efface les records et les séries des joueurs.
- **Datasets.** `src/data/films.fr.js` et `films.en.js` ont le même ordre de
  films ; `nb` (voisins les plus proches) et `fb` (les plus éloignés) sont des
  index dans ce tableau. Ne réordonne pas, ne supprime pas de film, et n'ajoute
  des films qu'en fin de tableau via `scripts/add-films.py` (voir
  [ADDING-FILMS.md](ADDING-FILMS.md)), qui met à jour les deux langues.

## Couches

Les dépendances vont vers l'intérieur : `ui/` → `controller.js` → `services/`
et `core/`.

- `src/core/` : logique pure, sans DOM ni stockage, testable seule.
- `localStorage` n'est lu et écrit que dans `src/services/storage.js`.
- `src/i18n/` ne doit pas importer de `ui/` (exception actuelle :
  `ui/icons.js`, corrigée par la branche audit/p-20261024-couches-nettoyage).
- Tout texte produit par le JS passe par `src/i18n/` (fr et en).
- Les constantes de réglage du jeu sont dans `src/config.js` (objet gelé).

## Flux de travail

- Une branche `audit/<id>` par proposition de la Régie, dans un worktree
  séparé. Jamais de commit ni de push direct sur `main` : le propriétaire relit
  et fusionne lui-même.
- Messages de commit en français, qui citent l'id de la proposition.
- Reste dans le périmètre de la proposition ; respecte le style du code voisin.
