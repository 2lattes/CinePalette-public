#!/usr/bin/env python3
"""
Build a CinéPalette palette (lossless WebP) from a video file.

A palette is the average colour of every frame of the movie, stacked
left->right in chronological order, rendered as a 1600x1 lossless WebP.
That is exactly the format of the palettes already in public/images/
(1600 columns of 1px, a single row, fully opaque). The CSS stretches it to
whatever height it is shown at: a taller image would only repeat that row.

How it works
------------
  1. ffprobe reads the duration.
  2. (default on) letterbox bars are detected with ffmpeg's cropdetect and
     removed -- black bars belong to the *file*, not to the *film*, so
     leaving them in would make the palette depend on which rip you own.
  3. ffmpeg decodes every frame, converts it to RGB and area-resamples it to
     a 32x18 thumbnail; numpy then averages that thumbnail into one colour.
     (Two details matter here. The conversion to RGB must happen BEFORE the
     resampling, otherwise the average is taken in YUV space and comes out
     too bright. And the resampling must NOT go all the way to 1x1: swscale
     caps its filter size, so `scale=1:1` returns 218 where the true mean is
     188. Stopping at 32x18 and finishing in numpy is accurate to ~0.03/255.)
  4. The stream of per-frame colours is split into 1600 equal bins; each
     bin's mean becomes one 1px-wide column.

Speed: the cost is video decoding, roughly 5-20 minutes per feature film in
software. --hwaccel auto (the default on macOS) uses VideoToolbox and is
typically several times faster.

Usage
-----
    python3 scripts/make-palette.py movie.mkv --slug dune-part-two
    python3 scripts/make-palette.py movie.mkv --slug dune -o /tmp/test.webp
    python3 scripts/make-palette.py movie.mkv --slug x --compare public/images/dune.webp
    python3 scripts/make-palette.py movie.mkv --slug x --no-crop --trim-end 180
"""
import argparse
import json
import platform
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"

WIDTH = 1600       # one column per 1/1600th of the running time
HEIGHT = 1         # the palette is a flat strip: one row, stretched by the CSS
CROP_SAMPLES = 12  # timestamps probed when auto-detecting letterboxing
SAMPLE_W = 32      # per-frame thumbnail handed to numpy -- see the module
SAMPLE_H = 18      # docstring for why this is not 1x1
FRAME_BYTES = SAMPLE_W * SAMPLE_H * 3


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe_video(path):
    r = run(["ffprobe", "-v", "error", "-print_format", "json",
             "-show_entries", "format=duration:stream=width,height",
             "-select_streams", "v:0", str(path)])
    if r.returncode != 0:
        sys.exit("ffprobe failed on %s:\n%s" % (path, r.stderr.strip()))
    info = json.loads(r.stdout)
    if not info.get("streams"):
        sys.exit("ERROR: no video stream in %s" % path)
    dur = float(info["format"]["duration"])
    st = info["streams"][0]
    return dur, int(st["width"]), int(st["height"])


def detect_crop(path, duration, w, h):
    """Union of the content boxes cropdetect finds at several timestamps."""
    rects = []
    for i in range(CROP_SAMPLES):
        t = duration * (0.08 + 0.84 * i / max(CROP_SAMPLES - 1, 1))
        r = run(["ffmpeg", "-v", "info", "-ss", "%.2f" % t, "-i", str(path),
                 "-frames:v", "25", "-vf", "cropdetect=limit=24:round=2:reset=0",
                 "-f", "null", "-"])
        found = re.findall(r"crop=(\d+):(\d+):(\d+):(\d+)", r.stderr)
        if found:
            rects.append(tuple(int(x) for x in found[-1]))
    if not rects:
        return None
    x0 = min(x for _, _, x, _ in rects)
    y0 = min(y for _, _, _, y in rects)
    x1 = max(x + cw for cw, _, x, _ in rects)
    y1 = max(y + ch for _, ch, _, y in rects)
    cw, ch = min(x1 - x0, w), min(y1 - y0, h)
    if cw >= w * 0.995 and ch >= h * 0.995:
        return None  # nothing meaningful to crop
    return cw, ch, x0, y0


def frame_colours(path, crop, trim_start, trim_end, duration, hwaccel, progress=True):
    """Decode the video, return an (n_frames, 3) float array of mean colours.

    Frames are streamed as 32x18 RGB thumbnails and reduced to one colour each
    as they arrive, so memory stays flat whatever the running time.
    """
    filters = []
    if crop:
        filters.append("crop=%d:%d:%d:%d" % crop)
    filters.append("format=rgb24")
    filters.append("scale=%d:%d:flags=area" % (SAMPLE_W, SAMPLE_H))

    cmd = ["ffmpeg", "-v", "error"]
    if hwaccel:
        cmd += ["-hwaccel", hwaccel]
    if trim_start:
        cmd += ["-ss", str(trim_start)]
    cmd += ["-i", str(path)]
    if trim_end:
        length = duration - trim_start - trim_end
        if length <= 0:
            sys.exit("ERROR: --trim-start/--trim-end leave no video.")
        cmd += ["-t", "%.3f" % length]
    cmd += ["-an", "-sn", "-dn", "-vf", ",".join(filters),
            "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]

    chunk = FRAME_BYTES * 512
    means, leftover, shown = [], b"", False
    progress = progress and sys.stdout.isatty()
    with tempfile.TemporaryFile() as errfile:
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=errfile)
        while True:
            data = proc.stdout.read(chunk)
            if not data:
                break
            data = leftover + data
            n = len(data) // FRAME_BYTES
            if n:
                block = np.frombuffer(data[: n * FRAME_BYTES], np.uint8)
                means.append(block.reshape(n, -1, 3).mean(axis=1))
            leftover = data[n * FRAME_BYTES:]
            if progress and len(means) % 20 == 0:
                done = sum(len(m) for m in means)
                sys.stdout.write("\r    %d frames..." % done)
                sys.stdout.flush()
                shown = True
        proc.stdout.close()
        rc = proc.wait()
        if shown:
            sys.stdout.write("\r" + " " * 30 + "\r")
        if rc != 0:
            errfile.seek(0)
            sys.exit("ffmpeg failed:\n%s"
                     % errfile.read().decode(errors="replace").strip())
    if not means:
        sys.exit("ERROR: ffmpeg produced no frames.")
    return np.concatenate(means)


def to_columns(colours, width=WIDTH):
    """Average the per-frame colours into `width` chronological bins."""
    n = len(colours)
    if n < width:
        idx = np.minimum(np.arange(width) * n // width, n - 1)
        return colours[idx]
    edges = np.linspace(0, n, width + 1).astype(int)
    sums = np.add.reduceat(colours, edges[:-1], axis=0)
    counts = np.diff(edges).reshape(-1, 1)
    return sums / counts


def write_palette(columns, out_path):
    row = np.rint(columns).clip(0, 255).astype(np.uint8)       # (1600, 3)
    strip = np.repeat(row[None, :, :], HEIGHT, axis=0)         # (1, 1600, 3)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(strip, "RGB").save(out_path, "WEBP", lossless=True, quality=100, method=6)


def _metric_vector(row_uint8):
    """The 96-value feature vector used by gen-neighbours.py."""
    im = Image.fromarray(row_uint8[None, :, :], "RGB").resize((32, 1), Image.LANCZOS)
    return np.asarray(im, float)[0].flatten()


def compare(columns, reference):
    """Report how close a freshly built palette is to an existing one."""
    ref_row = np.asarray(Image.open(reference).convert("RGB"))[0]
    new_row = np.rint(columns).clip(0, 255).astype(np.uint8)
    delta = np.abs(new_row.astype(float) - ref_row.astype(float))
    dist = np.linalg.norm(_metric_vector(new_row) - _metric_vector(ref_row))
    print("  vs %s" % Path(reference).name)
    print("    mean |dRGB| per channel  : %.2f / 255" % delta.mean())
    print("    max  |dRGB|              : %d / 255" % delta.max())
    print("    distance in the nb metric: %.1f" % dist)
    print("    (two *different* films in this catalogue sit 150-400 apart, so")
    print("     anything under ~60 means your source matches the original well)")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", type=Path, help="source video file")
    ap.add_argument("--slug", help="output filename stem, e.g. dune-part-two")
    ap.add_argument("-o", "--out", type=Path,
                    help="explicit output path (overrides --slug)")
    ap.add_argument("--no-crop", action="store_true",
                    help="keep letterbox bars instead of detecting and removing them")
    ap.add_argument("--trim-start", type=float, default=0,
                    help="seconds to skip at the start (studio logos)")
    ap.add_argument("--trim-end", type=float, default=0,
                    help="seconds to skip at the end (end credits)")
    ap.add_argument("--hwaccel", default=None,
                    help="ffmpeg -hwaccel value; defaults to 'auto' on macOS")
    ap.add_argument("--compare", type=Path,
                    help="compare the result to an existing palette")
    ap.add_argument("--force", action="store_true", help="overwrite an existing palette")
    args = ap.parse_args()

    if not args.video.exists():
        sys.exit("ERROR: no such file: %s" % args.video)
    if args.out:
        out = args.out
    elif args.slug:
        out = IMAGES / ("%s.webp" % args.slug)
    else:
        sys.exit("ERROR: pass --slug or --out.")
    if out.exists() and not args.force:
        sys.exit("ERROR: %s already exists (use --force to overwrite)." % out)

    hwaccel = args.hwaccel
    if hwaccel is None and platform.system() == "Darwin":
        hwaccel = "auto"

    duration, w, h = probe_video(args.video)
    print("%s: %.1f min, %dx%d" % (args.video.name, duration / 60, w, h))

    crop = None
    if not args.no_crop:
        crop = detect_crop(args.video, duration, w, h)
        print("  crop: %s" % ("%d:%d:%d:%d" % crop if crop else "none needed"))

    print("  decoding (this is the slow part)...")
    colours = frame_colours(args.video, crop, args.trim_start, args.trim_end,
                            duration, hwaccel)
    print("  %d frames averaged -> %d columns" % (len(colours), WIDTH))

    columns = to_columns(colours)
    write_palette(columns, out)
    print("  wrote %s" % out)

    if args.compare:
        compare(columns, args.compare)


if __name__ == "__main__":
    main()
