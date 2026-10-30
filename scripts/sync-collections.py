#!/usr/bin/env python3
"""Sync collection tags from metadata CSV files into both film datasets.

Usage:
    python3 scripts/sync-collections.py a24-metadonnees.csv
    python3 scripts/sync-collections.py a24-metadonnees.csv --check

Rows may list several collection ids separated by commas. Dataset indexes never
move: this script only adds or replaces each film's compact `c` array.
"""
import argparse
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASETS = [ROOT / "src" / "data" / "films.fr.js", ROOT / "src" / "data" / "films.en.js"]
LINE = re.compile(r'^(?P<indent>\s*)(?P<entry>\{.*\})(?P<comma>,?)$', re.MULTILINE)


def read_collections(paths):
    tags = {}
    for path in paths:
        for row in csv.DictReader(path.open(encoding="utf-8-sig")):
            slug = (row.get("slug") or "").strip()
            collections = [x.strip() for x in (row.get("collections") or "").split(",") if x.strip()]
            if slug and collections:
                tags[slug + ".webp"] = collections
    return tags


def sync(path, tags, check):
    seen, changes = set(), 0

    def replace(match):
        nonlocal changes
        film = json.loads(match.group("entry"))
        filename = film.get("f")
        if filename not in tags:
            return match.group(0)
        seen.add(filename)
        if film.get("c") == tags[filename]:
            return match.group(0)
        changes += 1
        if check:
            return match.group(0)
        film["c"] = tags[filename]
        entry = json.dumps(film, ensure_ascii=False, separators=(",", ":"))
        return match.group("indent") + entry + match.group("comma")

    text = path.read_text(encoding="utf-8")
    updated = LINE.sub(replace, text)
    missing = sorted(set(tags) - seen)
    if missing:
        sys.exit("ABORT: %s references missing film(s): %s" % (path.name, ", ".join(missing[:5])))
    if not check and changes:
        path.write_text(updated, encoding="utf-8")
    print("%s: %d tag(s) %s" % (path.relative_to(ROOT), changes, "need syncing" if check else "synced"))
    return changes


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv", nargs="+", type=Path, help="metadata CSV file(s) with slug and collections columns")
    parser.add_argument("--check", action="store_true", help="report drift without writing")
    args = parser.parse_args()

    paths = [p.resolve() for p in args.csv]
    missing = [p for p in paths if not p.exists()]
    if missing:
        sys.exit("ERROR: metadata file(s) not found: %s" % ", ".join(map(str, missing)))
    tags = read_collections(paths)
    if not tags:
        sys.exit("ERROR: no collection tags found in the supplied CSV file(s)")
    print("collections: %d film(s)" % len(tags))
    for dataset in DATASETS:
        sync(dataset, tags, args.check)


if __name__ == "__main__":
    main()
