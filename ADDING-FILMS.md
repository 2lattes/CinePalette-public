# Adding films to the catalogue

Palettes cannot be drawn or invented: a palette is a *measurement* of the film
itself — the average colour of every frame, left to right. So the one thing the
pipeline needs from you is a video file. Everything after that is automated.

## Once, before the first run

```bash
brew install ffmpeg                 # the only external dependency
pip3 install pillow numpy           # already needed by gen-neighbours.py
```

## Every time

1. Write a CSV describing the films:

   ```bash
   python3 scripts/add-films.py --template > new-films.csv
   ```

   | column | meaning |
   |---|---|
   | `video` | path to the video file |
   | `slug` | palette filename stem (`dune-part-two` → `dune-part-two.webp`). Leave empty to derive it from `title_en` |
   | `year` | four digits |
   | `title_fr` | French display title |
   | `title_en` | English / original title |
   | `trim_start`, `trim_end` | optional, seconds to cut off each end |

2. Check it, then run it:

   ```bash
   python3 scripts/add-films.py new-films.csv --dry-run   # validates, changes nothing
   python3 scripts/add-films.py new-films.csv
   ```

That single command builds each palette, appends the films to
`films.fr.js` **and** `films.en.js`, and recomputes `nb`/`fb` for the whole
catalogue. Budget roughly 2–10 minutes of decoding per film; it is unattended,
so a batch of thirty can run overnight.

## What the scripts do

| script | role |
|---|---|
| `make-palette.py` | one video → one `public/images/<slug>.webp` |
| `add-films.py` | the batch orchestrator — the only one you normally call |
| `gen-neighbours.py` | recomputes `nb`/`fb` for every film |

### make-palette.py, in detail

ffmpeg decodes every frame, converts it to RGB and area-resamples it to a
32×18 thumbnail; numpy averages that into one colour; the stream of per-frame
colours is split into 1600 equal bins, one per output column. The result is a
1600×1 lossless WebP, the same format as the existing palettes: one row of
colour, which the CSS stretches to the height it is shown at.

Two details are load-bearing, and both were found by measuring rather than
assuming:

- **Convert to RGB before resampling.** Averaging in YUV and converting
  afterwards makes every palette too bright.
- **Never resample straight to 1×1.** swscale caps its filter size, so
  `scale=1:1` is not a true mean: on a test clip whose real average is 188 it
  returns 218. Stopping at 32×18 and finishing in numpy is accurate to
  ~0.03/255.

Letterbox bars are detected and cropped by default, because black bars are a
property of *your file*, not of the film — leaving them in would make the
palette depend on which rip you happen to own. Use `--no-crop` to keep them.

### Checking a source against the originals

Before trusting a new batch, regenerate a film that is *already* in the
catalogue and compare:

```bash
python3 scripts/make-palette.py ~/Movies/Sin\ City.mkv \
    -o /tmp/check.webp --compare public/images/sin-city.webp
```

Two different films in this catalogue sit 150–400 apart in the neighbour
metric. Under ~60 means your source matches the original closely. A large gap
usually means a different cut, a different transfer, or credits included on one
side and not the other.

### The metric guard

`scripts/metric-reference.json` freezes the neighbour lists of the original 257
films. `gen-neighbours.py` recomputes them from the images before every write
and refuses to continue unless they match exactly — proof that neither the
metric nor the palettes have drifted, while still letting the catalogue grow.
(The previous guard compared against the `nb` currently in the dataset, which
by construction breaks the moment you add a single film.)

Regenerate the reference only on a checkout you know is good:

```bash
python3 scripts/gen-neighbours.py --freeze
```

## Things worth knowing

- **New films are appended, never inserted.** Every existing index keeps its
  position, so the diff stays readable and nothing silently reshuffles.
- **Adding films changes the daily game.** The daily film is drawn with
  `Math.floor(rnd() * films.length)`, so a longer catalogue means a different
  film on every past and future date. Expected and accepted.
- **`nb`/`fb` change for existing films too.** A new palette can legitimately
  enter another film's top ten. That is the point.
- **Both datasets must stay in lockstep.** Same films, same order. The scripts
  refuse to run if they drift apart.
