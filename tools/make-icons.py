#!/usr/bin/env python3
"""Generate the extension icons: a white shuttlecock on a rounded purple tile.

    python3 tools/make-icons.py

Writes extension/icons/icon-{16,32,48,128}.png. No dependency: the PNG is
assembled by hand (zlib + CRC), and rendering uses 4x supersampling for
smooth edges.

The generated icons are versioned; this script only needs re-running when the
drawing changes.
"""

import math
import pathlib
import struct
import zlib

ACCENT = (147, 32, 121)  # #932079, the BadAsso brand purple
WHITE = (255, 255, 255)
SUPERSAMPLE = 4

OUTPUT = pathlib.Path(__file__).resolve().parent.parent / "extension" / "icons"
SIZES = (16, 32, 48, 128)


def in_rounded_rect(x, y, radius):
    """x, y within [0, 1]. Filled rectangle with rounded corners."""
    cx = min(max(x, radius), 1 - radius)
    cy = min(max(y, radius), 1 - radius)
    dx, dy = x - cx, y - cy
    if dx == 0 or dy == 0:
        return True
    return dx * dx + dy * dy <= radius * radius


def in_polygon(x, y, vertices):
    inside = False
    count = len(vertices)
    for i in range(count):
        x1, y1 = vertices[i]
        x2, y2 = vertices[(i + 1) % count]
        if (y1 > y) != (y2 > y):
            crossing = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < crossing:
                inside = not inside
    return inside


def in_circle(x, y, cx, cy, radius):
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius


# The shuttlecock in normalized coordinates: a trapezoidal skirt flaring
# upwards, and the cork as a half-sphere at the bottom.
SKIRT = [(0.19, 0.13), (0.81, 0.13), (0.655, 0.62), (0.345, 0.62)]
CORK = (0.5, 0.665, 0.165)

# Skirt ribs, drawn in the background color. Dropped below 32 px, where they
# would only blur the drawing.
RIBS = [((0.5, 0.62), (0.5, 0.13)), ((0.42, 0.62), (0.30, 0.13)), ((0.58, 0.62), (0.70, 0.13))]
RIB_WIDTH = 0.022


def distance_to_segment(px, py, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    length = dx * dx + dy * dy
    if length == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / length))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def color_at(x, y, with_ribs):
    """Return (r, g, b, a) for a normalized point, without antialiasing."""
    if not in_rounded_rect(x, y, 0.22):
        return (0, 0, 0, 0)

    on_shuttlecock = in_polygon(x, y, SKIRT) or in_circle(x, y, *CORK)
    if not on_shuttlecock:
        return ACCENT + (255,)

    if with_ribs and not in_circle(x, y, *CORK):
        for a, b in RIBS:
            if distance_to_segment(x, y, a, b) < RIB_WIDTH / 2:
                return ACCENT + (255,)

    return WHITE + (255,)


def render(size, inset=0.0):
    """Render at `size` px. `inset` is the transparent margin on each side, as
    a fraction of the canvas: the Web Store listing icon wants 96x96 of artwork
    centered in 128x128, i.e. an inset of 16/128."""
    with_ribs = size * (1 - 2 * inset) >= 32
    span = 1 - 2 * inset
    rows = bytearray()
    for py in range(size):
        rows.append(0)  # PNG filter type: none
        for px in range(size):
            # Average of the SUPERSAMPLE x SUPERSAMPLE subsamples.
            red = green = blue = alpha = 0
            for sy in range(SUPERSAMPLE):
                for sx in range(SUPERSAMPLE):
                    nx = ((px + (sx + 0.5) / SUPERSAMPLE) / size - inset) / span
                    ny = ((py + (sy + 0.5) / SUPERSAMPLE) / size - inset) / span
                    if not (0 <= nx <= 1 and 0 <= ny <= 1):
                        continue  # transparent padding
                    cr, cg, cb, ca = color_at(nx, ny, with_ribs)
                    # Premultiplied: without it, transparent (black) pixels
                    # would darken the rim of the rounded corners.
                    red += cr * ca
                    green += cg * ca
                    blue += cb * ca
                    alpha += ca
            total = SUPERSAMPLE * SUPERSAMPLE
            if alpha == 0:
                rows += bytes((0, 0, 0, 0))
            else:
                rows += bytes(
                    (round(red / alpha), round(green / alpha), round(blue / alpha), round(alpha / total))
                )
    return bytes(rows)


def chunk(name, data):
    block = name + data
    return struct.pack(">I", len(data)) + block + struct.pack(">I", zlib.crc32(block))


def write_png(path, size, pixels):
    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    path.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(pixels, 9))
        + chunk(b"IEND", b"")
    )


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in SIZES:
        path = OUTPUT / f"icon-{size}.png"
        write_png(path, size, render(size))
        print(f"  {path.relative_to(OUTPUT.parent.parent)}  ({path.stat().st_size} bytes)")

    # Store listing icon: the Web Store asks for 96x96 of artwork centered in a
    # 128x128 canvas, the remaining 16 px per side left transparent. The
    # toolbar icons, by contrast, fill their canvas edge to edge.
    store = OUTPUT.parent.parent / "dist" / "store"
    store.mkdir(parents=True, exist_ok=True)
    path = store / "icon-store-128.png"
    write_png(path, 128, render(128, inset=16 / 128))
    print(f"  {path.relative_to(OUTPUT.parent.parent)}  ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
