#!/usr/bin/env python3
"""
Add films to CinéPalette: video file -> palette WebP -> both datasets -> nb/fb.

This is the one command to run when growing the catalogue. It reads a CSV
describing the films to add, and for each row:

  1. builds the palette WebP with make-palette.py (skipped if it already exists),
  2. appends the film to src/data/films.fr.js and src/data/films.en.js,
  3. once every film is in, runs gen-neighbours.py to recompute nb/fb
     for the WHOLE catalogue (adding films changes everyone's neighbours).
  4. runs scripts/check-datasets.mjs to confirm both datasets still share
     the same films, order, nb/fb and collections (the Daily depends on it).

New films are APPENDED at the end of the datasets, never inserted in the
middle: that keeps every existing index stable, so the diff stays readable
and nothing silently reshuffles.

CSV format (header required, UTF-8, comma-separated)
----------------------------------------------------
    video,slug,year,title_fr,title_en,trim_start,trim_end

    video       path to the video file (absolute, or relative to the CSV)
    slug        palette filename stem, e.g. dune-part-two -> dune-part-two.webp
                (optional: derived from title_en when left empty)
    year        release year, e.g. 2024
    title_fr    French display title, e.g. "Dune, deuxième partie"
    title_en    English / original title, e.g. "Dune: Part Two"
    trim_start  optional, seconds to skip at the start
    trim_end    optional, seconds to skip at the end

If title_fr equals title_en the French dataset omits the `o` field, exactly
like the existing entries.

Usage
-----
    python3 scripts/add-films.py new-films.csv
    python3 scripts/add-films.py new-films.csv --dry-run
    python3 scripts/add-films.py new-films.csv --skip-neighbours
    python3 scripts/add-films.py --template > new-films.csv
"""
import argparse
import csv
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
IMAGES = ROOT / "public" / "images"
FR = ROOT / "src" / "data" / "films.fr.js"
EN = ROOT / "src" / "data" / "films.en.js"

TEMPLATE = (
    "video,slug,year,title_fr,title_en,trim_start,trim_end\n"
    "/Volumes/Films/Dune Part Two.mkv,dune-part-two,2024,"
    '"Dune, deuxième partie","Dune: Part Two",,\n'
)


def slugify(title):
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s


def read_films(path):
    """Existing palette filenames, in dataset order."""
    return re.findall(r'"f":"([^"]+\.webp)"', path.read_text(encoding="utf-8"))


def current_topn(path, default=10):
    """How many neighbours the dataset already stores per film."""
    lists = re.findall(r'"nb":\[([0-9,]*)\]', path.read_text(encoding="utf-8"))
    depths = {len(x.split(",")) for x in lists if x}
    return max(depths) if depths else default


def json_entry(film, locale):
    """One dataset line, matching the existing formatting byte for byte."""
    d = {"f": film["slug"] + ".webp", "y": film["year"], "nb": [], "fb": []}
    if locale == "fr":
        d["t"] = film["title_fr"]
        if film["title_fr"] != film["title_en"]:
            d["o"] = film["title_en"]
    else:
        d["t"] = film["title_en"]
    return json.dumps(d, ensure_ascii=False, separators=(",", ":"))


def append_to_dataset(path, films, locale):
    text = path.read_text(encoding="utf-8")
    # The array always ends with the last entry, then a line holding "];".
    m = re.search(r"\n\];\s*$", text)
    if not m:
        sys.exit("ERROR: %s does not end with the expected '];'" % path.name)
    head = text[: m.start()]
    lines = ",\n".join("  " + json_entry(f, locale) for f in films)
    path.write_text(head + ",\n" + lines + "\n];\n", encoding="utf-8")


def build_palette(film, dry_run):
    out = IMAGES / (film["slug"] + ".webp")
    if out.exists():
        print("  palette already there, skipping: %s" % out.name)
        return True
    video = Path(film["video"]).expanduser()
    if not video.exists():
        print("  ERROR: video not found: %s" % video)
        return False
    cmd = [sys.executable, str(SCRIPTS / "make-palette.py"), str(video),
           "--slug", film["slug"]]
    if film.get("trim_start"):
        cmd += ["--trim-start", film["trim_start"]]
    if film.get("trim_end"):
        cmd += ["--trim-end", film["trim_end"]]
    if dry_run:
        print("  would run: %s" % " ".join(cmd))
        return True
    return subprocess.run(cmd).returncode == 0


def check_datasets():
    """fr and en must stay identical except for titles (see check-datasets.mjs)."""
    r = subprocess.run(["node", str(SCRIPTS / "check-datasets.mjs")], cwd=ROOT)
    if r.returncode != 0:
        sys.exit("ABORT: films.fr.js and films.en.js disagree -- the fr and en "
                 "Daily would no longer draw the same films. Fix them before playing.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv", nargs="?", type=Path, help="CSV of films to add")
    ap.add_argument("--template", action="store_true",
                    help="print a starter CSV and exit")
    ap.add_argument("--dry-run", action="store_true",
                    help="validate and report, change nothing")
    ap.add_argument("--skip-neighbours", action="store_true",
                    help="do not run gen-neighbours.py at the end")
    args = ap.parse_args()

    # Keep our own output interleaved correctly with the subprocesses'.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except AttributeError:
        pass

    if args.template:
        print(TEMPLATE, end="")
        return
    if not args.csv:
        sys.exit("ERROR: pass a CSV file (or --template to get one).")

    rows = list(csv.DictReader(args.csv.open(encoding="utf-8-sig")))
    if not rows:
        sys.exit("ERROR: the CSV has no rows.")

    existing = read_films(FR)
    if read_films(EN) != existing:
        sys.exit("ERROR: films.fr.js and films.en.js are out of sync. Fix that first.")
    print("catalogue: %d films" % len(existing))

    films, seen, problems = [], set(existing), []
    for i, row in enumerate(rows, 2):  # line 2 = first data row
        f = {k: (v or "").strip() for k, v in row.items() if k}
        if not f.get("title_en"):
            problems.append("line %d: title_en is required" % i)
            continue
        f.setdefault("title_fr", "")
        if not f["title_fr"]:
            f["title_fr"] = f["title_en"]
        if re.search(r"[<>]", f["title_fr"] + f["title_en"]):
            problems.append("line %d: titles must not contain < or >" % i)
            continue
        if not f.get("slug"):
            f["slug"] = slugify(f["title_en"])
        if not re.fullmatch(r"[a-z0-9-]+", f["slug"]):
            problems.append("line %d: bad slug %r" % (i, f["slug"]))
            continue
        if not re.fullmatch(r"\d{4}", f.get("year", "")):
            problems.append("line %d: year must be 4 digits, got %r"
                            % (i, f.get("year")))
            continue
        name = f["slug"] + ".webp"
        if name in seen:
            problems.append("line %d: %s is already in the catalogue" % (i, name))
            continue
        seen.add(name)
        films.append(f)

    if problems:
        print("\n".join("  " + p for p in problems), file=sys.stderr)
        sys.exit("ABORT: %d row(s) rejected, nothing was changed." % len(problems))

    print("to add: %d film(s)" % len(films))
    for f in films:
        print("  %-40s %s (%s)" % (f["slug"] + ".webp", f["title_en"], f["year"]))

    ok = [f for f in films if build_palette(f, args.dry_run)]
    if len(ok) != len(films):
        sys.exit("ABORT: %d palette(s) failed, datasets left untouched."
                 % (len(films) - len(ok)))

    if args.dry_run:
        print("dry run: datasets and neighbours untouched.")
        return

    append_to_dataset(FR, films, "fr")
    append_to_dataset(EN, films, "en")
    print("appended %d film(s) -> films.fr.js, films.en.js (now %d)"
          % (len(films), len(existing) + len(films)))

    if args.skip_neighbours:
        print("NOTE: nb/fb are still empty for the new films. "
              "Run scripts/gen-neighbours.py before playing.")
        check_datasets()
        return

    # Preserve the depth already in use. gen-neighbours.py defaults to 10, so
    # calling it bare after the catalogue was regenerated with --topn 30 would
    # silently truncate every list -- and category play depends on that depth
    # (a small pool finds almost no neighbours in a top-10 list).
    topn = current_topn(FR)
    print("recomputing nb/fb for the whole catalogue (top %d)..." % topn)
    r = subprocess.run([sys.executable, str(SCRIPTS / "gen-neighbours.py"),
                        "--topn", str(topn)])
    if r.returncode != 0:
        sys.exit("ABORT: gen-neighbours.py failed. The films are in the datasets "
                 "but their nb/fb are empty -- fix the metric, then rerun it.")
    check_datasets()
    print("done.")


if __name__ == "__main__":
    main()
