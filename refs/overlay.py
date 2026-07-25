#!/usr/bin/env python3
"""Overlay reference-matte silhouette vs render silhouette to see IoU mismatch.
red = reference only, cyan = render only, white = overlap (good). Stretches both to a
common canvas the same way diagnose_render (load_mask) compares (whole-image resize)."""
import struct, sys, zlib
from pathlib import Path
sys.path.insert(0, "/Users/shashwat/img2threejs/forge/stage1_intake")
from extract_pbr_evidence import build_foreground_mask, load_image

CW, CH = 900, 300


def mask_of(path):
    w, h, px, _ = load_image(Path(path))
    m, _, _ = build_foreground_mask(w, h, px)
    out = bytearray(CW * CH)
    for y in range(CH):
        sy = min(h - 1, y * h // CH)
        for x in range(CW):
            sx = min(w - 1, x * w // CW)
            out[y * CW + x] = 1 if m[sy * w + sx] else 0
    return out


ref = mask_of(sys.argv[1])
ren = mask_of(sys.argv[2])
inter = sum(1 for i in range(CW * CH) if ref[i] and ren[i])
union = sum(1 for i in range(CW * CH) if ref[i] or ren[i])
print(f"IoU(overlay grid)={inter/union:.4f}")
rgb = bytearray()
for i in range(CW * CH):
    a, b = ref[i], ren[i]
    if a and b:
        rgb += bytes((245, 245, 245))
    elif a:
        rgb += bytes((220, 40, 40))     # reference only (I'm MISSING here)
    elif b:
        rgb += bytes((40, 190, 220))    # render only (I'm OVER here)
    else:
        rgb += bytes((25, 25, 30))


def chunk(t, d):
    return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)


raw = bytearray()
for y in range(CH):
    raw.append(0)
    raw += rgb[y * CW * 3:(y + 1) * CW * 3]
Path(sys.argv[3]).write_bytes(b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", CW, CH, 8, 2, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))
print("wrote", sys.argv[3])
