// Pinned card sequence for the case studies.
//
// A tall section holds a sticky, full-height stage. A card sits centred in it and
// stays put while you scroll; media layers slide up over it one after another,
// each covering the last, with a caption swapping sides in time with them.
// Adapted from the pinned sequence in the template Thanvi's coach shared.
//
// Everything is driven from markup — pin.js reads whatever layers and captions a
// `.pin` contains, so adding one to another case study is pure HTML:
//
//   <div class="pin">
//     <div class="pin-stage">
//       <div class="pin-cap" data-side="left">…</div>   (one per layer)
//       <div class="pin-card">
//         <div class="pin-layer">…</div>                (first = the base)
//       </div>
//     </div>
//   </div>
//
// The case studies are React-rendered, but these elements carry no `{{ }}`
// bindings, so the runtime writes their style once at mount and never touches it
// again — which leaves the inline styles set here safe to persist.
(() => {
  'use strict';
  if (window.__pinInit) return;   // the runtime executes helmet scripts twice
  window.__pinInit = true;

  // Slide and caption windows are derived from how many layers a sequence has, so
  // the same component handles a three-step flow and a five-step one. With three
  // layers this lands on roughly the template's original [0.22,0.42] / [0.58,0.78].
  const SPAN = 0.72;   // the share of the scroll given over to the slides
  const START = 0.16;
  const slideWin = (i, n) => {          // i is 1..n-1
    const w = SPAN / Math.max(1, n - 1);
    const a = START + (i - 1) * w;
    return [a, a + w * 0.62];
  };
  const capWin = (i, n) => {
    const w = 1 / n;
    return [i * w, i === n - 1 ? 1.01 : (i + 1) * w - w * 0.12];
  };
  const RISE = 115;   // vh a layer travels up from
  const SCALE_IN = 0.1;  // the card settles to full size over this much progress

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const seg = (p, [a, b]) => clamp((p - a) / (b - a));
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  function paint(pin, p) {
    const card = pin.__card, layers = pin.__layers, caps = pin.__caps;

    // the card eases up to full size as the section takes over the screen
    if (card) {
      const s = 0.94 + 0.06 * ease(clamp(p / SCALE_IN));
      card.style.transform = 'translate(-50%,-50%) scale(' + s.toFixed(4) + ')';
    }

    // layer 0 is the base and never moves; the rest slide up in turn
    const n = layers.length;
    for (let i = 1; i < n; i++) {
      const y = (1 - ease(seg(p, slideWin(i, n)))) * RISE;
      layers[i].style.transform = 'translateY(' + y.toFixed(2) + 'vh)';
      layers[i].style.zIndex = String(i + 1);
    }

    const cn = caps.length;
    for (let i = 0; i < cn; i++) {
      const win = capWin(i, cn);
      caps[i].style.opacity = (p >= win[0] && p < win[1]) ? '1' : '0';
    }
    pin.__at = p;
  }

  function tick() {
    const pins = document.querySelectorAll('.pin');
    const vh = window.innerHeight;
    for (const pin of pins) {
      // React rebuilds the case study on re-entry, so re-read the parts each time
      // they go missing rather than caching them once
      if (!pin.__layers || !pin.__layers.length || !pin.contains(pin.__layers[0])) {
        pin.__card = pin.querySelector('.pin-card');
        pin.__layers = [...pin.querySelectorAll('.pin-layer')];
        pin.__caps = [...pin.querySelectorAll('.pin-cap')];
        pin.__at = -1;
        if (!pin.__layers.length) continue;
        if (reduced) { paint(pin, 1); continue; }   // show the final state, still
      }
      if (reduced) continue;

      const r = pin.getBoundingClientRect();
      if (r.bottom < 0 || r.top > vh) continue;     // off-screen
      // 0 when the section's top hits the viewport top, 1 when its bottom does
      const p = clamp(-r.top / Math.max(1, r.height - vh));
      if (Math.abs(p - pin.__at) < 0.002) continue;
      paint(pin, p);
    }
    requestAnimationFrame(tick);
  }

  // exposed so a sequence can be driven to an exact progress value and checked,
  // without depending on where the page happens to be scrolled
  window.__pin = { paint, slideWin, capWin };

  requestAnimationFrame(tick);
})();
