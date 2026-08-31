// Hover scramble — Aino-style character decode on mono UI text.
// Applies to DM Mono labels, nav, index links and buttons.
// Deliberately NOT applied to display type (Archivo) — project names and headings stay still.
(() => {
  'use strict';

  // Same vocabulary as the hero ASCII field, plus Aino's punctuation set.
  const GLYPHS = '·:;+*≡#%@<>/=!?-';
  const FRAME_MS = 32;
  const MAX_STAGGER_FRAMES = 14;

  const busy = new WeakSet();
  const lastRun = new WeakMap();
  const COOLDOWN_MS = 600;
  const rand = (n) => (Math.random() * n) | 0;
  const glyph = () => GLYPHS[rand(GLYPHS.length)];

  function isTarget(el) {
    if (!el || el.nodeType !== 1 || busy.has(el)) return false;
    if (performance.now() - (lastRun.get(el) || -Infinity) < COOLDOWN_MS) return false;
    if (el.tagName === 'PRE') return false;              // the hero ascii field
    if (el.childNodes.length !== 1) return false;         // leaf text only
    if (el.childNodes[0].nodeType !== 3) return false;
    const txt = el.textContent;
    if (!txt) return false;
    const trimmed = txt.trim();
    if (trimmed.length === 0 || txt.length > 64) return false;
    if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) return false; // live clock
    // explicit opt-in, for text that should decode regardless of its typeface —
    // the landing's project names are Archivo, which the font check would skip
    if (el.hasAttribute('data-scramble')) return true;
    return /dm mono/i.test(getComputedStyle(el).fontFamily || '');
  }

  function scramble(el) {
    const original = el.textContent;
    const chars = Array.from(original);
    const span = Math.min(0.9, MAX_STAGGER_FRAMES / Math.max(1, chars.length));

    const plan = chars.map((c, i) => ({
      c,
      fixed: !c.trim(),                                   // spaces never scramble
      end: Math.round(i * span) + 3 + rand(3)
    }));
    const total = plan.reduce((m, p) => Math.max(m, p.end), 0) + 1;

    busy.add(el);
    let frame = 0;
    let last = 0;

    const step = (ts) => {
      if (!el.isConnected) { busy.delete(el); return; }
      if (ts - last >= FRAME_MS) {
        last = ts;
        let out = '';
        for (const p of plan) out += (p.fixed || frame >= p.end) ? p.c : glyph();
        el.textContent = out;
        frame++;
      }
      if (frame <= total) {
        requestAnimationFrame(step);
      } else {
        el.textContent = original;                        // always restore exactly
        busy.delete(el);
        lastRun.set(el, performance.now());
      }
    };
    requestAnimationFrame(step);
  }

  // Delegated so it survives the runtime re-rendering the tree.
  document.addEventListener('mouseover', (e) => {
    let el = e.target;
    if (el && el.nodeType === 3) el = el.parentElement;
    if (isTarget(el)) scramble(el);
  }, { passive: true });
})();
