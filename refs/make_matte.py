#!/usr/bin/env python3
"""Alpha-matte a gun from an ACHROMATIC studio/dark background.

Background (gray gradient + soft shadow, or flat black) is neutral: low chroma at
every luma. The gun is either chromatic (purple/red/green/pink) OR very dark
(black barrel/grip). So: foreground = chroma>CHROMA or luma<DARK. Then keep the
largest 4-connected blob and flood-fill interior holes for a solid silhouette.

Operates on a downsampled grid (matte only feeds silhouette IoU / comparison
sheets, which resize anyway) so the connected-component + hole-fill stay fast.
Color crops for material grounding come from the full-res raw separately.
"""
from __future__ import annotations

import argparse
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, "/Users/shashwat/img2threejs/forge/stage1_intake")
from extract_pbr_evidence import load_image  # noqa: E402

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def write_png(path: Path, w: int, h: int, data: bytes, color_type: int):
    chans = 4 if color_type == 6 else 3
    assert len(data) == w * h * chans, (len(data), w * h * chans)

    def chunk(tag, d):
        return struct.pack(">I", len(d)) + tag + d + struct.pack(">I", zlib.crc32(tag + d) & 0xFFFFFFFF)

    raw = bytearray()
    stride = w * chans
    for y in range(h):
        raw.append(0)
        raw += data[y * stride:(y + 1) * stride]
    ihdr = struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0)
    path.write_bytes(PNG_SIG + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


def keep_largest(mask, w, h):
    seen = bytearray(len(mask))
    best = []
    for s in range(len(mask)):
        if not mask[s] or seen[s]:
            continue
        comp = []
        st = [s]
        seen[s] = 1
        while st:
            i = st.pop()
            comp.append(i)
            x, y = i % w, i // w
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h:
                    j = ny * w + nx
                    if mask[j] and not seen[j]:
                        seen[j] = 1
                        st.append(j)
        if len(comp) > len(best):
            best = comp
    out = bytearray(len(mask))
    for i in best:
        out[i] = 1
    return out


def fill_holes(mask, w, h):
    """Mark background reachable from the border; interior unreached bg = hole -> fg."""
    outside = bytearray(len(mask))
    st = []
    for x in range(w):
        for y in (0, h - 1):
            i = y * w + x
            if not mask[i] and not outside[i]:
                outside[i] = 1
                st.append(i)
    for y in range(h):
        for x in (0, w - 1):
            i = y * w + x
            if not mask[i] and not outside[i]:
                outside[i] = 1
                st.append(i)
    while st:
        i = st.pop()
        x, y = i % w, i // w
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                j = ny * w + nx
                if not mask[j] and not outside[j]:
                    outside[j] = 1
                    st.append(j)
    out = bytearray(mask)
    for i in range(len(mask)):
        if not mask[i] and not outside[i]:
            out[i] = 1
    return out


def dilate(mask, w, h, r):
    for _ in range(r):
        nxt = bytearray(mask)
        for i in range(len(mask)):
            if mask[i]:
                continue
            x, y = i % w, i // w
            if ((x > 0 and mask[i - 1]) or (x < w - 1 and mask[i + 1])
                    or (y > 0 and mask[i - w]) or (y < h - 1 and mask[i + w])):
                nxt[i] = 1
        mask = nxt
    return mask


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--out", required=True)
    ap.add_argument("--preview", required=True)
    ap.add_argument("--grid-w", type=int, default=1600)
    ap.add_argument("--chroma", type=int, default=22)
    ap.add_argument("--dark", type=int, default=28)
    ap.add_argument("--pad", type=int, default=6)
    ap.add_argument("--half", choices=["", "top", "bottom"], default="")
    args = ap.parse_args()

    W, H, px, warns = load_image(Path(args.src))
    for wn in warns:
        print("load:", wn)
    gw = args.grid_w
    gh = max(1, round(H * gw / W))
    print(f"src {W}x{H} -> grid {gw}x{gh}")

    def lum(p):
        return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]

    grid = [(0, 0, 0)] * (gw * gh)
    mask = bytearray(gw * gh)
    ylo, yhi = (0, gh)
    if args.half:
        ylo, yhi = (0, gh // 2) if args.half == "top" else (gh // 2, gh)
    for gy in range(gh):
        sy = min(H - 1, gy * H // gh)
        for gx in range(gw):
            sx = min(W - 1, gx * W // gw)
            p = px[sy * W + sx]
            grid[gy * gw + gx] = (p[0], p[1], p[2])
            if not (ylo <= gy < yhi):
                continue
            chroma = max(p[0], p[1], p[2]) - min(p[0], p[1], p[2])
            if chroma > args.chroma or lum(p) < args.dark:
                mask[gy * gw + gx] = 1

    mask = keep_largest(mask, gw, gh)
    mask = dilate(mask, gw, gh, 2)
    mask = fill_holes(mask, gw, gh)
    mask = keep_largest(mask, gw, gh)

    xs = [i % gw for i in range(len(mask)) if mask[i]]
    ys = [i // gw for i in range(len(mask)) if mask[i]]
    x0 = max(0, min(xs) - args.pad); y0 = max(0, min(ys) - args.pad)
    x1 = min(gw, max(xs) + args.pad + 1); y1 = min(gh, max(ys) + args.pad + 1)
    cw, ch = x1 - x0, y1 - y0
    print(f"coverage(full-frame)={sum(mask)/len(mask):.4f}  crop {cw}x{ch} at ({x0},{y0})  crop-coverage={sum(mask[y*gw+x] for y in range(y0,y1) for x in range(x0,x1))/(cw*ch):.4f}")

    rgba = bytearray(); prev = bytearray()
    for y in range(y0, y1):
        for x in range(x0, x1):
            i = y * gw + x
            r, g, b = grid[i]
            on = mask[i]
            rgba += bytes((r, g, b, 255 if on else 0))
            prev += bytes((r, g, b) if on else (255, 255, 255))
    write_png(Path(args.out), cw, ch, bytes(rgba), 6)
    write_png(Path(args.preview), cw, ch, bytes(prev), 2)
    print("wrote", args.out, args.preview)


if __name__ == "__main__":
    main()
