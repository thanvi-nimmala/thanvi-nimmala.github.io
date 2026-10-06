// Opening sequence — the name fills from the bottom up.
//
// A full-screen white panel with the name set in the display serif, drawn twice:
// a faint copy underneath, and an ink copy clipped to a line that rises through
// it. When the line reaches the top the panel clears and the site is already
// there underneath.
//
// This is jennwchoi.com's intro mechanic — her logo mark is two stacked masked
// spans, the ink one a gradient that fills bottom-up as --logo-fill goes 0→100%
// — translated to type, and clipped rather than masked so it works on text.
//
// Plays on every load. Skips entirely under prefers-reduced-motion, and can be
// dismissed with a click or any key. ?intro=hold builds it paused so it can be
// scrubbed via window.__intro.frame(ms).
(() => {
  'use strict';
  if (window.__introInit) return;   // the runtime executes helmet scripts twice
  window.__introInit = true;

  const NAME = 'Thanvi Nimmala';

  const hold = /[?&]intro=hold/.test(location.search);
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // ---- timeline (ms) -------------------------------------------------------
  const FILL = 1150;     // the ink rising through the name
  const HOLD = 360;      // a beat on the filled name before it clears
  const FADE = 420;
  const END = FILL + HOLD + FADE;

  const root = document.createElement('div');
  root.className = 'intro';
  root.innerHTML = '<div class="intro-wrap"><div class="intro-name intro-base"></div>' +
    '<div class="intro-name intro-ink"></div></div>';
  const base = root.querySelector('.intro-base');
  const ink = root.querySelector('.intro-ink');
  base.textContent = NAME;
  ink.textContent = NAME;
  document.body.appendChild(root);

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // ease-out, so the fill arrives rather than stops
  const ease = (p) => 1 - Math.pow(1 - p, 3);

  function frame(t) {
    const p = ease(clamp(t / FILL));
    ink.style.clipPath = 'inset(' + ((1 - p) * 100).toFixed(2) + '% 0 0 0)';
    root.style.opacity = (1 - clamp((t - FILL - HOLD) / FADE)).toFixed(3);
  }

  // ---- run -----------------------------------------------------------------

  let t0 = null, done = false;

  function finish() {
    if (done) return;
    done = true;
    root.remove();
  }

  function step(ts) {
    if (t0 === null) t0 = ts;
    const t = ts - t0;
    frame(Math.min(t, END));
    if (t >= END) { finish(); return; }
    requestAnimationFrame(step);
  }

  // exposed so the sequence can be scrubbed and inspected frame by frame
  window.__intro = { frame, finish: () => finish(), FILL, HOLD, END, NAME };

  frame(0);
  root.addEventListener('click', finish);
  window.addEventListener('keydown', function onKey() {
    if (done) { window.removeEventListener('keydown', onKey); return; }
    finish();
  });
  if (!hold) requestAnimationFrame(step);
})();
