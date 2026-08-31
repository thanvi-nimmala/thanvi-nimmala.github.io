// Opening sequence — the name decodes itself.
//
// The same character-scramble the site uses on hover (motion.js), but fired on a
// clock instead of a cursor: every letter starts as a random glyph and resolves
// left to right. Nothing else on screen, on the same paper the site sits on, so
// when it clears there is no cut — the landing is simply already there.
//
// The glyph vocabulary is motion.js's, deliberately: this should read as the
// site's own motion arriving early, not as a separate loading screen.
//
// Plays on every load. Skips entirely under prefers-reduced-motion, and can be
// dismissed with a click or any key. ?intro=hold builds it paused so it can be
// scrubbed via window.__intro.frame(ms).
(() => {
  'use strict';
  if (window.__introInit) return;   // the runtime executes helmet scripts twice
  window.__introInit = true;

  const NAME = 'THANVI NIMMALA';
  const GLYPHS = '·:;+*≡#%@<>/=!?-';        // motion.js's set

  const hold = /[?&]intro=hold/.test(location.search);
  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // ---- timeline (ms) -------------------------------------------------------
  const STAGGER = 52;    // gap between one letter resolving and the next
  const JITTER = 90;     // random slack per letter, so it does not march
  const GLYPH_MS = 40;   // how often an unresolved letter picks a new glyph
  const HOLD = 520;      // beat on the resolved name before it clears
  const FADE = 420;

  const letters = Array.from(NAME);
  // when each letter settles; spaces are never scrambled so they settle at once
  const settleAt = letters.map((c, i) =>
    c === ' ' ? 0 : Math.round(i * STAGGER + Math.random() * JITTER));
  const DECODED = Math.max(...settleAt) + 120;
  const END = DECODED + HOLD + FADE;

  const clamp = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // ---- build ---------------------------------------------------------------

  const root = document.createElement('div');
  root.className = 'intro';
  const word = document.createElement('div');
  word.className = 'intro-name';
  root.appendChild(word);
  const spans = letters.map((c) => {
    const s = document.createElement('span');
    if (c === ' ') s.className = 'sp';
    word.appendChild(s);
    return s;
  });
  root.appendChild(Object.assign(document.createElement('div'),
    { className: 'intro-skip', textContent: 'CLICK TO SKIP' }));
  document.body.appendChild(root);

  let lastGlyph = -1, cache = letters.map(() => '');

  function frame(t) {
    // refresh the random glyphs on their own slower clock, so unresolved letters
    // flicker at a readable rate rather than once per animation frame
    const roll = t - lastGlyph >= GLYPH_MS;
    if (roll) lastGlyph = t;

    for (let i = 0; i < letters.length; i++) {
      const c = letters[i];
      if (c === ' ') { spans[i].textContent = ' '; continue; }
      if (t >= settleAt[i]) {
        if (cache[i] !== c) { spans[i].textContent = c; cache[i] = c; }
        continue;
      }
      // `cache[i] === c` catches scrubbing backwards: the letter had settled, so
      // without this it would stay settled at an earlier time than it should
      if (roll || !cache[i] || cache[i] === c) {
        const g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        spans[i].textContent = g;
        cache[i] = g;
      }
    }
    root.style.opacity = (1 - clamp((t - DECODED - HOLD) / FADE)).toFixed(3);
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
  window.__intro = { frame, finish: () => finish(), settleAt, DECODED, END, NAME };

  frame(0);
  root.addEventListener('click', finish);
  window.addEventListener('keydown', function onKey() {
    if (done) { window.removeEventListener('keydown', onKey); return; }
    finish();
  });
  if (!hold) requestAnimationFrame(step);
})();
