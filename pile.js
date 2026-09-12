// Draggable photo pile on the About page.
//
// A handful of photos scattered in a loose stack, each tilted a few degrees. Any
// card can be picked up and thrown: it follows the pointer exactly, comes to the
// front, keeps its momentum for a moment after release, and stays wherever it
// lands. Modelled on the careers page at granola.ai.
//
// Layout is data-driven — each card carries its resting position, size and tilt
// as data attributes, so adding a photo is one more <div class="pile-card"> in
// the markup and nothing here changes.
//
// The About view is React-rendered (the runtime rebuilds it on every entry), so
// cards are set up lazily from a rAF loop rather than once at load: any card
// without a __pile marker gets initialised, which handles first paint and every
// re-entry alike. Cards carry no {{ }} bindings, so the inline transforms set
// here are never overwritten by the runtime.
(() => {
  'use strict';
  if (window.__pileInit) return;   // the runtime executes helmet scripts twice
  window.__pileInit = true;

  const FRICTION = 0.90;   // per-frame velocity decay after release
  const STOP = 0.15;       // px/frame below which a thrown card is at rest
  const SLACK = 0.35;      // how far past the pile's edge a card may come to rest
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let zTop = 10;
  const live = new Set();  // cards currently coasting

  function setup(card) {
    const pile = card.parentElement;
    const st = {
      x: +card.dataset.x || 0, y: +card.dataset.y || 0,
      rot: +card.dataset.rot || 0,
      vx: 0, vy: 0, drag: null
    };
    card.__pile = st;
    card.style.width = (card.dataset.w || '58') + '%';
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

  // a thrown card slows to a stop, and is nudged back if it has left the pile
  function coast() {
    for (const card of live) {
      const st = card.__pile, pile = card.parentElement;
      st.x += st.vx; st.y += st.vy;
      st.vx *= FRICTION; st.vy *= FRICTION;
      const pw = pile.clientWidth, ph = pile.clientHeight;
      const cw = card.offsetWidth, ch = card.offsetHeight;
      const rest = +card.dataset.x || 0, resty = +card.dataset.y || 0;
      const minX = -cw * SLACK - rest, maxX = pw - cw * (1 - SLACK) - rest;
      const minY = -ch * SLACK - resty, maxY = ph - ch * (1 - SLACK) - resty;
      if (st.x < minX) { st.x = minX; st.vx *= -0.4; }
      if (st.x > maxX) { st.x = maxX; st.vx *= -0.4; }
      if (st.y < minY) { st.y = minY; st.vy *= -0.4; }
      if (st.y > maxY) { st.y = maxY; st.vy *= -0.4; }
      paint(card);
      if (Math.abs(st.vx) < STOP && Math.abs(st.vy) < STOP) live.delete(card);
    }
  }

  function tick() {
    document.querySelectorAll('.pile-card').forEach((c) => {
      if (!c.__pile) { setup(c); return; }
      // During the initial mount the runtime can rewrite a card's style attribute
      // after setup has run, dropping the width while leaving the transform. Rather
      // than depend on the order those two settle in, re-assert it whenever it is gone.
      if (!c.style.width) { c.style.width = (c.dataset.w || '58') + '%'; paint(c); }
    });
    coast();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
