#!/usr/bin/env python3
"""
Remettre catalogue.csv en accord avec les datasets.

catalogue.csv est la reference editable : c'est la qu'on ajoute une ligne avant
d'importer un film, et c'est la qu'on remplit notoriete, categorie et
collections. Les datasets, eux, font autorite sur l'ordre des films, les titres
et l'annee.

Ce script reconcilie les deux :

  - reordonne les lignes dans l'ordre des datasets et renumerote `index`
  - recopie `titre_fr`, `titre_vo` et `annee` depuis les datasets
  - fusionne `collections` dans les deux sens : ce que tu as tape dans le CSV et
    ce qui est deja dans le champ `c` des datasets
  - laisse en fin de fichier, index vide, les lignes dont le film n'est pas
    encore importe (elles servent de manifeste d'import)
  - signale les films presents dans les datasets mais absents du CSV

Il ne touche jamais a notoriete, categorie, genre_* ni realisateur : ce sont tes
colonnes.

Usage :
    python3 scripts/sync-catalogue.py
    python3 scripts/sync-catalogue.py --check     # rapporte, n'ecrit rien
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "catalogue.csv"
FR = ROOT / "src" / "data" / "films.fr.js"
EN = ROOT / "src" / "data" / "films.en.js"
ENTRY = re.compile(r"^\s*(\{.*\}),?$", re.MULTILINE)


def load(path):
    return [json.loads(m.rstrip(",")) for m in ENTRY.findall(path.read_text(encoding="utf-8"))]


def split_tags(s):
    return [x for x in re.split(r"[,\s]+", (s or "").strip()) if x]


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="rapporte, n'ecrit rien")
    args = ap.parse_args()

    fr, en = load(FR), load(EN)
    if [f["f"] for f in fr] != [f["f"] for f in en]:
        sys.exit("ABANDON : films.fr.js et films.en.js n'ont pas le meme ordre.")

    rows = list(csv.DictReader(CSV.open(encoding="utf-8-sig")))
    cols = list(rows[0].keys())
    by_slug = {r["slug"]: r for r in rows}
    if len(by_slug) != len(rows):
        seen, dups = set(), []
        for r in rows:
            if r["slug"] in seen:
                dups.append(r["slug"])
            seen.add(r["slug"])
        sys.exit("ABANDON : slugs en double dans catalogue.csv : %s" % dups[:5])

    ordered, changes, absents = [], 0, []
    for i, (a, b) in enumerate(zip(fr, en)):
        slug = a["f"].rsplit(".", 1)[0]
        row = by_slug.pop(slug, None)
        if row is None:
            absents.append(slug)
            continue
        before = dict(row)
        row["index"] = str(i)
        row["titre_fr"] = a["t"]
        row["titre_vo"] = a.get("o") or b["t"]
        row["annee"] = a["y"]
        tags = sorted(set(split_tags(row.get("collections"))) | set(a.get("c", [])))
        row["collections"] = ",".join(tags)
        if any(before[k] != row[k] for k in row):
            changes += 1
        ordered.append(row)

    # Les lignes restantes decrivent des films pas encore importes.
    en_attente = sorted(by_slug.values(), key=lambda r: r["slug"])
    for r in en_attente:
        r["index"] = ""

    print("datasets : %d films | catalogue.csv : %d lignes" % (len(fr), len(rows)))
    print("  %d ligne(s) mise(s) a jour" % changes)
    print("  %d ligne(s) en attente d'import (index vide)" % len(en_attente))
    if en_attente:
        print("     " + ", ".join(r["slug"] for r in en_attente[:6])
              + (" ..." if len(en_attente) > 6 else ""))
    if absents:
        print("  ATTENTION : %d film(s) du dataset absent(s) du CSV : %s"
              % (len(absents), ", ".join(absents[:6])))

    if args.check:
        print("--check : rien ecrit.")
        return 1 if absents else 0

    with CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(ordered + en_attente)
    print("catalogue.csv reecrit.")
    return 1 if absents else 0


if __name__ == "__main__":
    sys.exit(main())
