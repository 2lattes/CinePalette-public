#!/usr/bin/env python3
"""
Regenerate the palette-similarity neighbour lists (nb / fb) for both datasets.

Each film has a colour palette WebP (public/images/<f>) that stacks the average
colour of every frame of the movie, left->right in chronological order.

Similarity metric (reverse-engineered from the original `nb` lists -- it
reproduces them at 100%, exact order included):

    feature(film) = image.resize((32, 1), LANCZOS) flattened to a 96-value RGB vector
    distance(a, b) = Euclidean distance between feature vectors

From that single distance matrix we derive, for every film:
  - nb : the 10 NEAREST palettes  (nearest->farthest)  -> hard distractors
  - fb : the 10 FARTHEST palettes (farthest->nearest)  -> easy distractors

Safety guard
------------
scripts/metric-reference.json freezes the neighbour lists of the original
catalogue. Before writing anything, this script recomputes those lists FROM
THE IMAGES, restricted to the frozen films only, and refuses to continue
unless they match exactly. That proves the metric and the images have not
drifted -- while still allowing the catalogue to grow, which the old
"recomputed nb must equal the nb currently in the dataset" check could not
(adding one film legitimately changes every other film's neighbours).

Usage
-----
    python3 scripts/gen-neighbours.py              # verify + rewrite nb/fb
    python3 scripts/gen-neighbours.py --check      # verify only, write nothing
    python3 scripts/gen-neighbours.py --preview    # verify + print a sample
    python3 scripts/gen-neighbours.py --freeze     # (re)create the reference file
"""
import re
import sys
import json
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"
DATASETS = [ROOT / "src" / "data" / "films.fr.js", ROOT / "src" / "data" / "films.en.js"]
REFERENCE = Path(__file__).resolve().parent / "metric-reference.json"

TOPN = 10          # neighbours stored per film, same count for nb and fb
RESIZE_W = 32      # metric parameters -- do not change without re-verifying
RESAMPLE = Image.LANCZOS

FILM_RE = re.compile(r'\{"f":"(?P<f>[^"]+\.webp)"[^}]*?"nb":\[(?P<nb>[0-9,]*)\][^}]*\}')


def parse_dataset(text):
    out = []
    for m in FILM_RE.finditer(text):
        nb = [int(x) for x in m.group("nb").split(",")] if m.group("nb") else []
        out.append((m.group("f"), nb))
    return out


def feature_vectors(filenames):
    vecs = []
    for f in filenames:
        im = Image.open(IMAGES / f).convert("RGB")
        vecs.append(np.asarray(im.resize((RESIZE_W, 1), RESAMPLE), float)[0].flatten())
    return np.array(vecs)


def distance_matrix(vecs):
    d = np.linalg.norm(vecs[:, None, :] - vecs[None, :, :], axis=-1)
    np.fill_diagonal(d, np.nan)
    return d


def nearest(d, i, n):
    order = np.argsort(np.where(np.isnan(d[i]), np.inf, d[i]))
    return [int(j) for j in order[:n]]


def farthest(d, i, n):
    order = np.argsort(np.where(np.isnan(d[i]), -np.inf, d[i]))[::-1]
    return [int(j) for j in order[:n]]


def verify_metric(topn):
    """Recompute the frozen catalogue's neighbours and compare. Exits on drift."""
    if not REFERENCE.exists():
        print("WARNING: %s is missing -- the metric cannot be verified.\n"
              "         Run --freeze once on a known-good checkout to create it."
              % REFERENCE.name)
        return
    ref = json.loads(REFERENCE.read_text())
    files, ref_nb, ref_topn = ref["films"], ref["nb"], ref["topn"]

    missing = [f for f in files if not (IMAGES / f).exists()]
    if missing:
        sys.exit("ABORT: %d reference palette(s) missing from public/images, "
                 "e.g. %s" % (len(missing), missing[:3]))

    d = distance_matrix(feature_vectors(files))
    n = min(topn, ref_topn)
    recomputed = [nearest(d, i, n) for i in range(len(files))]
    bad = [i for i in range(len(files)) if recomputed[i] != ref_nb[i][:n]]
    hit = sum(len(set(recomputed[i]) & set(ref_nb[i][:n])) for i in range(len(files)))
    recall = hit / (len(files) * n)
    print("metric check on %d frozen films: recall@%d=%.3f  order mismatches=%d"
          % (len(files), n, recall, len(bad)))
    if bad:
        sys.exit("ABORT: the metric no longer reproduces the frozen neighbour "
                 "lists (first offender: %s). Either a palette image changed, "
                 "or a metric parameter was edited. Output would be untrusted."
                 % files[bad[0]])


def freeze(filenames, topn):
    d = distance_matrix(feature_vectors(filenames))
    nb = [nearest(d, i, topn) for i in range(len(filenames))]
    REFERENCE.write_text(json.dumps(
        {"films": filenames, "nb": nb, "topn": topn,
         "note": "Frozen reference for the palette-similarity metric. "
                 "Recomputed and checked by gen-neighbours.py before every write. "
                 "Do not edit by hand."},
        indent=1))
    print("froze %d films -> %s" % (len(filenames), REFERENCE.name))


def inject(path, filenames, nb, fb):
    text = path.read_text(encoding="utf-8")
    ds = parse_dataset(text)
    if [f for f, _ in ds] != filenames:
        sys.exit("ABORT: %s lists different films (or a different order) than "
                 "films.fr.js. The two datasets must stay in lockstep." % path.name)

    idx = {"i": 0}

    def repl(m):
        i = idx["i"]
        idx["i"] += 1
        block = m.group(0)
        nb_str = "[" + ",".join(str(j) for j in nb[i]) + "]"
        fb_str = "[" + ",".join(str(j) for j in fb[i]) + "]"
        block = re.sub(r'"nb":\[[0-9,]*\]', '"nb":' + nb_str, block, count=1)
        if re.search(r'"fb":\[[0-9,]*\]', block):
            block = re.sub(r'"fb":\[[0-9,]*\]', '"fb":' + fb_str, block, count=1)
        else:
            block = re.sub(r'("nb":\[[0-9,]*\])', r"\1" + ',"fb":' + fb_str,
                           block, count=1)
        return block

    path.write_text(FILM_RE.sub(repl, text), encoding="utf-8")
    print("wrote nb+fb (%d/film) -> %s" % (len(nb[0]), path.relative_to(ROOT)))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="verify only, write nothing")
    ap.add_argument("--preview", action="store_true", help="print a readable sample")
    ap.add_argument("--freeze", action="store_true",
                    help="(re)create metric-reference.json from the current catalogue")
    ap.add_argument("--topn", type=int, default=TOPN,
                    help="neighbours stored per film (default %d)" % TOPN)
    args = ap.parse_args()

    films = parse_dataset(DATASETS[0].read_text(encoding="utf-8"))
    filenames = [f for f, _ in films]
    n = len(films)
    if n == 0:
        sys.exit("ERROR: no films parsed from films.fr.js")

    missing = [f for f in filenames if not (IMAGES / f).exists()]
    if missing:
        sys.exit("ERROR: %d palette image(s) missing, e.g. %s"
                 % (len(missing), missing[:3]))
    if args.topn >= n:
        sys.exit("ERROR: --topn (%d) must be smaller than the catalogue (%d)."
                 % (args.topn, n))

    if args.freeze:
        freeze(filenames, args.topn)
        return

    verify_metric(args.topn)

    print("computing neighbours for %d films..." % n)
    d = distance_matrix(feature_vectors(filenames))
    nb = [nearest(d, i, args.topn) for i in range(n)]
    fb = [farthest(d, i, args.topn) for i in range(n)]

    if args.preview:
        name = lambda j: filenames[j].replace(".webp", "")
        for probe in ["the-godfather.webp", "spirited-away.webp", "sin-city.webp"]:
            if probe not in filenames:
                continue
            i = filenames.index(probe)
            print("\n%s" % name(i))
            print("  nearest :", ", ".join(name(j) for j in nb[i][:5]))
            print("  farthest:", ", ".join(name(j) for j in fb[i][:5]))

    if args.check or args.preview:
        return

    for path in DATASETS:
        inject(path, filenames, nb, fb)


if __name__ == "__main__":
    main()
