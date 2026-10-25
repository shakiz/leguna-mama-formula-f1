"""Cut a vehicle illustration out of a flat backdrop and export a game-ready WebP.

    python3 -m venv .venv && .venv/bin/pip install pillow
    .venv/bin/python tools/cutout.py ~/Downloads/leguna.png src/art/leguna-side.webp \
        --clear 0,0,1476,34 --clear 1150,0,1476,44

The backdrop colour is sampled from the bottom-left corner and flood-filled inwards from the edges,
so the vehicle's own cream paint survives as long as it has an outline. --clear x0,y0,x1,y1 blanks a
rectangle first (repeatable); the leguna art uses it to drop a neighbouring vehicle's wheel and a
stray band along the top edge.
"""
import argparse
from collections import deque

from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('out')
ap.add_argument('--width', type=int, default=640)
ap.add_argument('--tolerance', type=float, default=62)
ap.add_argument('--clear', action='append', default=[], metavar='X0,Y0,X1,Y1')
args = ap.parse_args()

im = Image.open(args.src).convert('RGBA')
w, h = im.size
px = im.load()
bg = px[0, h - 1][:3]

for rect in args.clear:
    x0, y0, x1, y1 = (int(v) for v in rect.split(','))
    for y in range(max(y0, 0), min(y1, h)):
        for x in range(max(x0, 0), min(x1, w)):
            px[x, y] = (0, 0, 0, 0)

def is_bg(c):
    return c[3] and sum((a - b) ** 2 for a, b in zip(c[:3], bg)) ** 0.5 <= args.tolerance

seen = bytearray(w * h)
q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)])
q.extend((x, y) for y in range(h) for x in (0, w - 1))
while q:
    x, y = q.popleft()
    if seen[y * w + x]:
        continue
    seen[y * w + x] = 1
    if px[x, y][3] and not is_bg(px[x, y]):
        continue
    px[x, y] = (0, 0, 0, 0)
    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
        if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
            q.append((nx, ny))

# Shave and soften the cut edge so it doesn't look jaggy once scaled down
im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8)))
im = im.crop(im.getbbox())
im = im.resize((args.width, round(im.height * args.width / im.width)), Image.LANCZOS)
im.save(args.out, 'WEBP', quality=86, method=6)
print(f'{args.out}: {im.width}x{im.height}')
