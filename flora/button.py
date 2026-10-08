import math, sys
import numpy as np
import stipple, draw
from stipple import SS

def setup(cells, dots):
    stipple.CELLS_W = stipple.CELLS_H = float(cells)
    stipple.DOTS_W = stipple.DOTS_H = dots
    stipple.S = dots / float(cells)

def render(cells, dots, fn, path, scale, grain=0.08):
    setup(cells, dots)
    X, Y, cov, tone, mat = stipple.canvas()
    fn(X, Y, cov, tone, mat, cells)
    c = stipple.downsample(cov); t = stipple.downsample(tone)
    return draw.to_png(c, t, mat[::SS, ::SS], path, scale=scale, grain=grain)

def bloom(X, Y, cov, tone, mat, n):
    draw.head(X, Y, cov, tone, mat, n*0.50, n*0.50, n*0.42, 0.10, -0.78, 0.0)

def closed(X, Y, cov, tone, mat, n):
    draw.stem(X, Y, cov, tone, mat, n*0.54, n*1.02, n*0.52, n*0.58, n*0.045)
    draw.bud(X, Y, cov, tone, mat, n*0.52, n*0.50, math.pi/2 + 0.08, n*0.50, n*0.21, 0.0)

# The switch is the same lily seen head on, at the one density that still reads
# at 54px: 96 dots across the drawing, which puts a dot at roughly half a CSS
# pixel — the same dot size the big one in the rail ends up at.
if __name__ == '__main__':
    print('open', render(22, 96, bloom,  'lily-btn-open.png', 3))
    print('buds', render(22, 96, closed, 'lily-btn-buds.png', 3))
