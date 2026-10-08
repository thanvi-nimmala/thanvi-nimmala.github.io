"""A lily drawn as a continuous tonal image, then error-diffused into dots.

Same plant as before, but nothing is quantised to a grid while it is being
drawn: petals carry veins, the speckles a stargazer lily has, a dark throat and
recurved tips that catch the light. Only at the very end is the greyscale run
through Floyd-Steinberg, which is what turns a smooth gradient into a field of
dots that gets denser where the flower is darker.

The dots are then tinted by the tone underneath them — deep magenta in the
throat, pink at the tips, green down the stem — so it reads as a coloured
drawing made of dots rather than a halftone of a photograph.
"""
import math
import numpy as np

CELLS_W, CELLS_H = 52.0, 112.0
DOTS_W = 400                      # the dither grid: one cell of this is one dot
SS = 2                            # supersampling while drawing
S = DOTS_W / CELLS_W
DOTS_H = int(round(CELLS_H * S))

LIGHT = (-0.68, 0.73)
PETAL, LEAF, DARK = 1, 2, 3

def canvas():
    h, w = DOTS_H * SS, DOTS_W * SS
    y, x = np.mgrid[0:h, 0:w]
    X = (x + 0.5) / (S * SS)
    Y = (y + 0.5) / (S * SS)
    cov = np.zeros((h, w), np.float32)
    tone = np.ones((h, w), np.float32)
    mat = np.zeros((h, w), np.uint8)
    return X, Y, cov, tone, mat

def put(cov, tone, mat, m, t, material):
    """paint on top: the thing stamped last is the thing in front"""
    cov[m] = 1.0
    tone[m] = np.clip(t[m] if isinstance(t, np.ndarray) else t, 0.0, 1.0)
    mat[m] = material

def darken(cov, tone, m, amount):
    """a contact shadow: only touches what is already there"""
    sel = m & (cov > 0)
    tone[sel] = np.clip(tone[sel] - amount, 0.0, 1.0)

# ---- shapes, in cell coordinates ------------------------------------------

def local(X, Y, cx, cy, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    dx, dy = X - cx, -(Y - cy)
    return dx * ca + dy * sa, -dx * sa + dy * ca      # along, across

def tepal_mask(X, Y, cx, cy, ang, L, W, u0=0.0):
    u, v = local(X, Y, cx, cy, ang)
    t = np.clip((u - u0 * L) / (L * (1 - u0)), 0, 1)
    w = W * np.sin(np.pi * t) ** 0.72 * np.minimum(1.0, (1 - t) * 3.4)
    return (u >= u0 * L) & (u <= L) & (np.abs(v) <= w / 2)

def spindle_mask(X, Y, cx, cy, ang, L, W):
    u, v = local(X, Y, cx, cy, ang)
    t = np.clip((u + L * .12) / (L * 1.12), 0, 1)
    w = W * np.sin(np.pi * t ** 0.72) ** 0.5 * np.minimum(1.0, (1 - t) * 4.0)
    return (u >= -L * .12) & (u <= L) & (np.abs(v) <= w / 2)

def blob_mask(X, Y, cx, cy, rx, ry=None):
    ry = rx if ry is None else ry
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1

def seg_mask(X, Y, x0, y0, x1, y1, w):
    dx, dy = x1 - x0, y1 - y0
    n = dx * dx + dy * dy
    t = np.clip(((X - x0) * dx + (Y - y0) * dy) / (n if n else 1), 0, 1)
    return np.hypot(X - (x0 + t * dx), Y - (y0 + t * dy)) <= w / 2

# ---- tone ------------------------------------------------------------------

def tepal_tone(X, Y, cx, cy, ang, L, W, lift=0.0, u0=0.0, seed=0):
    u, v = local(X, Y, cx, cy, ang)
    uu = np.clip(u / L, 0, 1)
    vv = v / max(W, 1e-6)
    face = math.cos(ang) * LIGHT[0] + math.sin(ang) * LIGHT[1]
    t = 0.26 + 0.44 * uu ** 0.8                       # pale toward the tip
    t -= 0.30 * np.exp(-(vv / 0.14) ** 2)             # the midrib
    t -= 0.07 * (0.5 + 0.5 * np.cos(vv * 7 * np.pi)) * np.clip(uu * 2, 0, 1)   # veins
    t += 0.15 * face + 0.13 * (1 - np.abs(vv) / 0.5)  # turned toward the light
    t += 0.22 * np.clip((uu - 0.82) / 0.18, 0, 1)     # the recurved tip catches it
    # the speckles a stargazer carries, thrown over the inner half of the petal
    rng = np.random.default_rng(seed)
    for _ in range(14):
        su = rng.uniform(0.18, 0.68); sv = rng.uniform(-0.26, 0.26)
        r = rng.uniform(0.020, 0.042)
        d = np.hypot(u / L - su, v / max(W, 1e-6) - sv)
        t = np.where(d < r, t - 0.55, t)
    return t + lift

def spindle_tone(X, Y, cx, cy, ang, L, W, lift=0.0):
    u, v = local(X, Y, cx, cy, ang)
    ca, sa = math.cos(ang), math.sin(ang)
    side = (-sa) * LIGHT[0] + ca * LIGHT[1]
    vv = np.clip(v / max(W / 2, 1e-6), -1, 1)
    t = 0.50 + 0.42 * side * vv + 0.12 * np.clip(u / L, 0, 1)
    t -= 0.22 * np.exp(-((vv - 0.12) / 0.07) ** 2)    # the seam between tepals
    t -= 0.10 * np.exp(-((vv + 0.46) / 0.08) ** 2)
    return t + lift

def leaf_tone(X, Y, x0, y0, ang, L, W, lift=0.0):
    u, v = local(X, Y, x0, y0, ang)
    uu = np.clip(u / L, 0, 1); vv = v / max(W, 1e-6)
    face = math.cos(ang) * LIGHT[0] + math.sin(ang) * LIGHT[1]
    t = 0.34 + 0.16 * uu
    t -= 0.26 * np.exp(-(vv / 0.10) ** 2)
    t += 0.14 * face + 0.10 * (1 - np.abs(vv) / 0.5)
    return t + lift

# ---- dithering -------------------------------------------------------------

def downsample(a):
    h, w = a.shape
    return a.reshape(h // SS, SS, w // SS, SS).mean(axis=(1, 3))

def floyd_steinberg(v, grain=0.10, seed=7):
    """classic error diffusion, with a little grain on the threshold so the
       flat areas break up the way they do in the reference"""
    rng = np.random.default_rng(seed)
    v = v.astype(np.float64) + rng.normal(0, grain, v.shape)
    h, w = v.shape
    out = np.zeros((h, w), np.uint8)
    for y in range(h):
        row = v[y]
        for x in range(w):
            old = row[x]
            new = 1.0 if old >= 0.5 else 0.0
            out[y, x] = 0 if new else 1          # 1 = a dot
            err = old - new
            if x + 1 < w: row[x + 1] += err * 7 / 16
            if y + 1 < h:
                nxt = v[y + 1]
                if x: nxt[x - 1] += err * 3 / 16
                nxt[x] += err * 5 / 16
                if x + 1 < w: nxt[x + 1] += err * 1 / 16
    return out
