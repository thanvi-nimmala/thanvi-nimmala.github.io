// The photos on the About page: draggable anywhere, and they distort the text.
//
// Three snapshots sit out in the margins either side of the column. Any of them
// can be picked up and thrown across the whole page — they are not confined to a
// box — and wherever one comes to rest over a paragraph, that paragraph warps
// under it, as if the picture were a lens pressed onto the page. Drag it off and
// the text settles back.
//
// The warp is an SVG displacement map, one filter per paragraph so each can be
// driven independently. The filters live on <body>, outside the runtime's React
// subtree; only the `filter` property is written onto the paragraphs themselves.
//
// The About view is React-rendered (the runtime rebuilds it on every entry), so
// cards are set up lazily from a rAF loop rather than once at load: any card
// without a __pile marker gets initialised, which handles first paint and every
// re-entry alike.
(() => {
  'use strict';
  if (window.__pileInit) return;   // the runtime executes helmet scripts twice
  window.__pileInit = true;

  const FRICTION = 0.90;   // per-frame velocity decay after release
  const STOP = 0.15;       // px/frame below which a thrown card is at rest
  const SLACK = 0.35;      // how far past the page's edge a card may come to rest
  const WARP_MAX = 15;     // px of displacement at full overlap
  const WARP_EASE = 0.18;  // how fast a paragraph warps and unwarps
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let zTop = 10;
  const live = new Set();  // cards currently coasting

  function setup(card) {
    const st = {
      x: +card.dataset.x || 0, y: +card.dataset.y || 0,
      rot: +card.dataset.rot || 0,
      vx: 0, vy: 0, drag: null
    };
    card.__pile = st;
    if (card.dataset.w) card.style.width = card.dataset.w;
    card.style.zIndex = String(++zTop);
    paint(card);

    const release = () => {
      if (!st.drag) return;
      const s = st.drag.samples;
      if (s.length && !reduced) {
        const span = Math.max(16, performance.now() - s[0].t);
        const sx = s.reduce((a, b) => a + b.dx, 0), sy = s.reduce((a, b) => a + b.dy, 0);
        st.vx = sx / span * 16; st.vy = sy / span * 16;   // per-frame at ~60fps
        live.add(card);
      }
      st.drag = null;
      card.classList.remove('grabbing');
    };
    card.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !e.isPrimary) return;
      e.preventDefault();
      card.setPointerCapture(e.pointerId);
      card.classList.add('grabbing');
      card.style.zIndex = String(++zTop);
      live.delete(card);
      st.vx = st.vy = 0;
      st.drag = { px: e.clientX, py: e.clientY, t: performance.now(), samples: [] };
    });
    card.addEventListener('pointermove', (e) => {
      if (!st.drag) return;
      // a move with no button held means the pointerup never reached us — the
      // pointer left the window, or the event came from automation. End the drag
      // rather than leave the card glued to the cursor.
      if (e.buttons === 0) { release(); return; }
      const dx = e.clientX - st.drag.px, dy = e.clientY - st.drag.py;
      st.drag.px = e.clientX; st.drag.py = e.clientY;
      st.x += dx; st.y += dy;
      // keep a short history so the release velocity reflects the last ~80ms,
      // not a single jittery event
      const now = performance.now();
      st.drag.samples.push({ dx, dy, t: now });
      st.drag.samples = st.drag.samples.filter((s) => now - s.t < 80);
      paint(card);
    });
    card.addEventListener('pointerup', release);
    card.addEventListener('pointercancel', release);
    card.addEventListener('lostpointercapture', release);
  }

  function paint(card) {
    const st = card.__pile;
    card.style.transform = 'translate(' + st.x.toFixed(1) + 'px,' + st.y.toFixed(1) + 'px) rotate(' + st.rot + 'deg)';
  }

  // a thrown card slows to a stop, and is nudged back if it has left the page
  function coast() {
    for (const card of live) {
      const st = card.__pile, layer = card.parentElement;
      st.x += st.vx; st.y += st.vy;
      st.vx *= FRICTION; st.vy *= FRICTION;
      const pw = layer.clientWidth, ph = layer.clientHeight;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const restX = card.offsetLeft, restY = card.offsetTop;
      const minX = -cw * SLACK - restX, maxX = pw - cw * (1 - SLACK) - restX;
      const minY = -ch * SLACK - restY, maxY = ph - ch * (1 - SLACK) - restY;
      if (st.x < minX) { st.x = minX; st.vx *= -0.4; }
      if (st.x > maxX) { st.x = maxX; st.vx *= -0.4; }
      if (st.y < minY) { st.y = minY; st.vy *= -0.4; }
      if (st.y > maxY) { st.y = maxY; st.vy *= -0.4; }
      paint(card);
      if (Math.abs(st.vx) < STOP && Math.abs(st.vy) < STOP) live.delete(card);
    }
  }

  // ---- the warp -------------------------------------------------------------

  // One filter per paragraph, kept on <body> so nothing is injected into the
  // runtime's own subtree. `scale` is the only thing that changes.
  let defs = null;
  const maps = [];
  function filterFor(i) {
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      defs.setAttribute('aria-hidden', 'true');
      defs.setAttribute('width', '0');
      defs.setAttribute('height', '0');
      defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.appendChild(defs);
    }
    while (maps.length <= i) {
      const n = maps.length;
      defs.insertAdjacentHTML('beforeend',
        '<filter id="pile-warp-' + n + '" x="-20%" y="-40%" width="140%" height="180%" ' +
        'color-interpolation-filters="sRGB">' +
        '<feTurbulence type="fractalNoise" baseFrequency="0.014 0.042" numOctaves="2" ' +
        'seed="' + (n * 7 + 3) + '" result="noise"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="noise" scale="0" ' +
        'xChannelSelector="R" yChannelSelector="G"/></filter>');
      maps.push(defs.lastChild.querySelector('feDisplacementMap'));
    }
    return maps[i];
  }

  // how much of `box` the cards cover, 0..1 — the deepest single overlap wins, so
  // one photo resting on a line warps it as much as three would
  function coverage(box, cards) {
    let best = 0;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const w = Math.min(r.right, box.right) - Math.max(r.left, box.left);
      const h = Math.min(r.bottom, box.bottom) - Math.max(r.top, box.top);
      if (w <= 0 || h <= 0) continue;
      best = Math.max(best, (w * h) / Math.min(r.width * r.height, box.width * box.height));
    }
    return Math.min(1, best);
  }

  function warp(cards) {
    const texts = document.querySelectorAll('.ab-warpable');
    texts.forEach((el, i) => {
      const want = reduced || !cards.length ? 0 : coverage(el.getBoundingClientRect(), cards) * WARP_MAX;
      const have = el.__warp || 0;
      const next = have + (want - have) * WARP_EASE;
      el.__warp = next;
      if (next < 0.15) {
        if (el.style.filter) el.style.filter = '';     // crisp again
        return;
      }
      filterFor(i).setAttribute('scale', next.toFixed(2));
      const want2 = 'url(#pile-warp-' + i + ')';
      if (el.style.filter !== want2) el.style.filter = want2;
    });
  }

  function tick() {
    const cards = [...document.querySelectorAll('.pile-card')];
    cards.forEach((c) => {
      if (!c.__pile) { setup(c); return; }
      // During the initial mount the runtime can rewrite a card's style attribute
      // after setup has run, dropping the width while leaving the transform. Rather
      // than depend on the order those two settle in, re-assert it whenever it is gone.
      if (c.dataset.w && !c.style.width) { c.style.width = c.dataset.w; paint(c); }
    });
    coast();
    warp(cards);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
