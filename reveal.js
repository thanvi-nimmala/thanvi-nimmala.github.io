// Scroll-driven word reveal on the case-study section headings.
//
// Each heading is split into words; as the heading rises into the viewport the
// words resolve one after another — fading up, unblurring and settling from
// below. Adapted from the scroll-choreography pattern in the template Thanvi's
// coach shared, which drives the same three properties from a 0..1 progress
// value derived from the element's position.
//
// Two things about this page make it trickier than it looks:
//
//  1. The case studies live inside <x-dc>, which is React. Splitting a heading's
//     text node into spans is a structural change to a subtree React believes it
//     owns. Verified safe on unmount — but React rebuilds each heading from
//     scratch when you re-enter a case study, so the split has to be re-applied
//     on every mount rather than once.
//  2. motion.js leaves these alone: it only decodes DM Mono text, and these are
//     Archivo. No opt-in attribute is set here, so the two never collide.
(() => {
  'use strict';
  if (window.__revealInit) return;   // the runtime executes helmet scripts twice
  window.__revealInit = true;

  const SELECTOR = '.cs-main h2';
  const BLUR = 7;      // px of blur on a word that has not resolved yet
  const RISE = 16;     // px it sits below its final position
  const FLOOR = 0.08;  // opacity before it begins to resolve — never fully invisible
  const STAGGER = 0.85; // how far apart consecutive words are in progress terms

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Split a heading into one span per word. Marked on the element so a heading is
  // only split once per mount — and re-split after React rebuilds it.
  function split(el) {
    const text = el.textContent;
    if (!text || !text.trim()) return false;
    const words = text.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((word, i) => {
      const s = document.createElement('span');
      s.textContent = word;
      s.style.display = 'inline-block';
      s.style.willChange = 'opacity, filter, transform';
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    el.__revealWords = spans;
    el.__revealAt = -1;
    return true;
  }

  // 0 while the heading is still below the fold, 1 once it has risen far enough.
  // The window is deliberately generous so the reveal finishes before the heading
  // reaches the middle of the screen, rather than trailing behind the scroll.
  function progress(el) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    return clamp((vh * 0.92 - r.top) / (vh * 0.55));
  }

  function paint(el, p) {
    const spans = el.__revealWords;
    const n = spans.length;
    for (let i = 0; i < n; i++) {
      const w = clamp(p * (n + 2) - i * STAGGER);
      const s = spans[i];
      s.style.opacity = (FLOOR + (1 - FLOOR) * w).toFixed(3);
      s.style.filter = w >= 1 ? 'none' : 'blur(' + ((1 - w) * BLUR).toFixed(2) + 'px)';
      s.style.transform = w >= 1 ? 'none' : 'translateY(' + ((1 - w) * RISE).toFixed(2) + 'px)';
    }
    el.__revealAt = p;
  }

  function tick() {
    const els = document.querySelectorAll(SELECTOR);
    const vh = window.innerHeight;
    for (const el of els) {
      // React rebuilds headings on re-entry, which drops the spans — re-split.
      // A fresh split must be painted straight away even if it is far off-screen:
      // unpainted spans carry no inline opacity and so render fully resolved,
      // which would make the heading jump to blurred as it scrolled into view.
      let fresh = false;
      if (!el.__revealWords || !el.__revealWords.length || !el.firstElementChild) {
        if (!split(el)) continue;
        fresh = true;
      }
      const r = el.getBoundingClientRect();
      if (!fresh && (r.bottom < -vh || r.top > vh * 1.6)) continue;   // off-screen
      const p = progress(el);
      // nothing to do if it has not moved, or is already fully resolved
      if (Math.abs(p - el.__revealAt) < 0.004) continue;
      paint(el, p);
    }
    requestAnimationFrame(tick);
  }

  if (!reduced) requestAnimationFrame(tick);
})();
