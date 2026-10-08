import math, sys
import numpy as np
from PIL import Image
from stipple import *

FRONT = (13.0, 25.0, 14.5, 0.10, -0.70, 0.00)
BACK  = (38.5, 20.0,  8.4, -0.50, -2.30, 0.22)
TOP   = (33.5,  7.5)

def head(X, Y, cov, tone, mat, cx, cy, L, turn, face, lift, wf=0.62, sr=1.0, seed=1):
    darken(cov, tone, blob_mask(X, Y, cx, cy, L*1.18), 0.26)
    order = sorted(range(6), key=lambda i: -math.sin(turn + math.pi/2 + i*math.pi/3))
    for n, i in enumerate(order):
        a = turn + math.pi/2 + i*math.pi/3
        Wd = L*wf
        darken(cov, tone, tepal_mask(X, Y, cx, cy, a, L*1.02, Wd*1.45, u0=0.10), 0.22)
        put(cov, tone, mat, tepal_mask(X, Y, cx, cy, a, L, Wd, u0=0.06),
            tepal_tone(X, Y, cx, cy, a, L, Wd, lift, seed=seed*10+n), PETAL)
    put(cov, tone, mat, blob_mask(X, Y, cx, cy, L*0.17), 0.02 + lift*0.5, DARK)
    # the stamens stay a cluster at the throat: six fine filaments and the small
    # dark anthers on the ends, reaching about half way out rather than past the
    # petals, which is where they actually sit
    for off, r in [(-.78,.46), (-.46,.56), (-.14,.62), (.18,.60), (.5,.52), (.82,.44)]:
        a = turn + face + off
        ax, ay = cx + math.cos(a)*L*r*sr, cy - math.sin(a)*L*r*sr
        put(cov, tone, mat, seg_mask(X, Y, cx, cy, ax, ay, L*0.022), 0.46 + lift, PETAL)
        put(cov, tone, mat, blob_mask(X, Y, ax, ay, L*0.052, L*0.034), 0.05 + lift, DARK)

def leaf(X, Y, cov, tone, mat, x0, y0, x1, y1, w, lift=0.0):
    a = math.atan2(-(y1-y0), x1-x0); L = math.hypot(x1-x0, y1-y0)
    put(cov, tone, mat, tepal_mask(X, Y, x0, y0, a, L, w),
        leaf_tone(X, Y, x0, y0, a, L, w, lift), LEAF)

def stem(X, Y, cov, tone, mat, x0, y0, x1, y1, w, lift=0.0):
    put(cov, tone, mat, seg_mask(X, Y, x0, y0, x1, y1, w), 0.40 + lift, LEAF)

def stalk(X, Y, cov, tone, mat):
    # The stalk comes in from the bottom right and leans across, so the plant
    # rises out of the corner rather than standing in the middle of the box; the
    # bottom of this canvas is cropped by the rail, which is what puts the root
    # of it off the page. The two stems behind run clear of the front flower's
    # face — a stem showing through the gap between two tepals reads as in front.
    stem(X, Y, cov, tone, mat, 48.5, 79.0, 33.0, 55.0, 1.7)
    stem(X, Y, cov, tone, mat, 33.0, 55.0, 24.5, 37.5, 1.4)
    stem(X, Y, cov, tone, mat, 25.0, 39.0, 15.0, 29.0, 1.2)
    stem(X, Y, cov, tone, mat, 25.6, 40.0, 36.5, 23.0, 1.1, 0.10)
    stem(X, Y, cov, tone, mat, 25.2, 38.5, 33.4, 10.0, 1.1, 0.06)
    leaf(X, Y, cov, tone, mat, 33.5, 56.0, 18.0, 50.0, 3.7)
    leaf(X, Y, cov, tone, mat, 35.5, 60.0, 49.5, 54.0, 3.1, 0.10)
    leaf(X, Y, cov, tone, mat, 41.0, 69.0, 26.0, 64.0, 3.4)
    leaf(X, Y, cov, tone, mat, 44.0, 74.0, 53.0, 68.5, 2.7, 0.10)

def bud(X, Y, cov, tone, mat, x, y, ang, L, w, lift):
    darken(cov, tone, blob_mask(X, Y, x, y, w*0.9, L*0.65), 0.18)
    put(cov, tone, mat, spindle_mask(X, Y, x, y, ang, L, w),
        spindle_tone(X, Y, x, y, ang, L, w, lift), PETAL)

def scene(open_):
    X, Y, cov, tone, mat = canvas()
    stalk(X, Y, cov, tone, mat)
    bud(X, Y, cov, tone, mat, TOP[0], TOP[1]+0.5, math.pi/2+0.10, 10.2, 4.7, 0.26)
    if open_:
        head(X, Y, cov, tone, mat, BACK[0], BACK[1], BACK[2], BACK[3], BACK[4], BACK[5], seed=2)
        head(X, Y, cov, tone, mat, FRONT[0], FRONT[1], FRONT[2], FRONT[3], FRONT[4], FRONT[5], seed=5)
    else:
        # the stems carry on to where the flowers would have been
        stem(X, Y, cov, tone, mat, 15.0, 29.0, 14.2, 23.5, 1.1)
        stem(X, Y, cov, tone, mat, 36.5, 23.0, 37.4, 19.5, 1.0, 0.10)
        bud(X, Y, cov, tone, mat, 37.6, 17.5, math.pi/2-0.30, 10.4, 4.5, 0.18)
        bud(X, Y, cov, tone, mat, 14.4, 21.0, math.pi/2+0.24, 15.0, 6.2, 0.0)
    return downsample(cov), downsample(tone), mat[::SS, ::SS]

# tinting: the dots are coloured by what they are and how dark it is there
INK = {
    PETAL: ((0x5c, 0x12, 0x43), (0xd4, 0x6b, 0xa8)),
    LEAF:  ((0x2b, 0x3d, 0x25), (0x86, 0x9c, 0x62)),
    DARK:  ((0x3d, 0x0b, 0x2c), (0x7a, 0x1c, 0x5c)),
}

def to_png(cov, tone, mat, path, scale=2, grain=0.10, seed=7):
    value = 1.0 - cov * (1.0 - np.clip(tone, 0, 1))      # white where nothing is
    dots = floyd_steinberg(value, grain=grain, seed=seed)
    h, w = dots.shape
    rgba = np.zeros((h, w, 4), np.uint8)
    t = np.clip(tone, 0, 1)
    for m, (lo, hi) in INK.items():
        sel = (mat == m) & (dots == 1)
        if not sel.any(): continue
        k = np.clip((t[sel] - 0.1) / 0.75, 0, 1)[:, None]
        rgba[sel, :3] = (np.array(lo) * (1 - k) + np.array(hi) * k).astype(np.uint8)
        rgba[sel, 3] = 255
    img = Image.fromarray(rgba, 'RGBA')
    img = img.resize((w * scale, h * scale), Image.NEAREST)
    img.save(path)
    return img.size, int((dots == 1).sum())

if __name__ == '__main__':
    for name, op in (('lily-open', True), ('lily-buds', False)):
        c, t, m = scene(op)
        print(name, to_png(c, t, m, name + '.png'))
