"""A photograph put through the same treatment as the lilies.

Greyscale, a little blur to take the sensor noise out, then the levels pulled
so the picture is light enough to survive being reduced to dots — a dark frame
dithers into a solid mass. Floyd-Steinberg after that.

The dots are the page's ink rather than its magenta: the dither is what ties
this to the lilies, not the colour, and keeping the photograph neutral leaves
the flower as the one coloured thing on the page.
"""
import numpy as np
from PIL import Image, ImageFilter

def dither(src, out, grid_w, black=0.00, white=0.86, gamma=0.62,
           blur=1.2, grain=0.055, scale=2, ink=(0x1a, 0x18, 0x15), seed=11):
    im = Image.open(src).convert('L')
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur * im.width / 900))
    gh = int(round(grid_w * im.height / im.width))
    im = im.resize((grid_w, gh), Image.LANCZOS)
    v = np.asarray(im, np.float64) / 255.0
    v = np.clip((v - black) / (white - black), 0, 1) ** gamma
    rng = np.random.default_rng(seed)
    v = v + rng.normal(0, grain, v.shape)

    h, w = v.shape
    dots = np.zeros((h, w), bool)
    for y in range(h):
        row = v[y]
        for x in range(w):
            old = row[x]
            new = 1.0 if old >= 0.5 else 0.0
            dots[y, x] = new == 0.0
            err = old - new
            if x + 1 < w: row[x + 1] += err * 7 / 16
            if y + 1 < h:
                nxt = v[y + 1]
                if x: nxt[x - 1] += err * 3 / 16
                nxt[x] += err * 5 / 16
                if x + 1 < w: nxt[x + 1] += err * 1 / 16

    rgba = np.zeros((h, w, 4), np.uint8)
    rgba[dots, :3] = ink
    rgba[dots, 3] = 255
    img = Image.fromarray(rgba).resize((w * scale, h * scale), Image.NEAREST)
    img.save(out)
    return img.size, int(dots.sum())

# 300 dots across a picture shown at 230px puts a dot near three quarters of a
# CSS pixel, the size they come out at in the lilies.
if __name__ == '__main__':
    print(dither('selfie.webp', 'selfie-dots.png', 300))
