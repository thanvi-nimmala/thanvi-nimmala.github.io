// The two drawn diagrams in the NCS case study assemble themselves as you
// reach them: the prioritisation matrix builds its axes and then pops its
// items onto it, and the onboarding flow runs its line down from Start with
// each dot lighting as the line arrives. Both take a little over a second, so
// they read as the diagram being made rather than as an animation to sit
// through.
//
// Two things shape how this is written.
//
//  1. Nothing is held on the element. The runtime is React and it resyncs class
//     and style on every re-render, so a class added here is gone by the next
//     tick of the clock in the corner. Everything therefore lives in one
//     stylesheet injected into the head, keyed off nth-of-type rather than off
//     anything this script would have to keep writing back onto the DOM.
//  2. The flow's delays are measured, not guessed. Its steps are not the same
//     height — Permissions is three times the height of "User signs in" — so a
//     flat stagger drifts away from the line almost immediately. Each dot's
//     centre is read as a fraction of the line's own span and turned into its
//     delay, which is why the line arrives exactly as the dot lights. The line
//     animates linearly for the same reason: easing it would break the
//     correspondence.
//
// If this never runs, no rule is injected and both diagrams are simply visible,
// which is the right failure.
(() => {
  'use strict';
  if (window.__diagramsInit) return;   // the runtime executes helmet scripts twice
  window.__diagramsInit = true;

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const EASE = 'cubic-bezier(.2,.7,.2,1)';
  const POP = 'cubic-bezier(.34,1.56,.64,1)';

  // ---- the prioritisation matrix ------------------------------------------
  // Items are in the markup from highest impact to lowest, so staggering them
  // in document order reads down the chart and lands on Auto capture last,
  // which is the one the exercise cut. It gets an extra beat to itself.
  const MX = 'figure.jc-mx';
  const MX_BASE = 500, MX_STEP = 95, MX_BEAT = 150;

  const matrix = {
    sel: MX,
    armed:
      MX + ' .mx-plot{background-size:1px 0%,0% 1px}\n' +
      MX + ' .mx-plot::before{transform:scaleY(0);transform-origin:top}\n' +
      MX + ' .mx-plot::after{transform:scaleX(0);transform-origin:left}\n' +
      MX + ' .mx-i,' + MX + ' .mx-e,' + MX + ' .mx-y,' + MX + ' .mx-x{opacity:0}\n',
    run() {
      let css =
        MX + ' .mx-plot{animation:mx-axes .46s ease-out forwards}\n' +
        MX + ' .mx-plot::before{transform-origin:top;animation:mx-vl .4s ease-out .28s forwards}\n' +
        MX + ' .mx-plot::after{transform-origin:left;animation:mx-hl .4s ease-out .28s forwards}\n' +
        MX + ' .mx-y,' + MX + ' .mx-x,' + MX + ' .mx-e{opacity:0;animation:fl-in .36s ' + EASE + ' .12s forwards}\n';
      for (let i = 1; i <= 5; i++) {
        const d = MX_BASE + (i - 1) * MX_STEP + (i === 5 ? MX_BEAT : 0);
        css += MX + ' .mx-i:nth-of-type(' + i + '){animation:mx-pop .34s ' + POP + ' ' + d + 'ms both}\n';
      }
      return css;
    }
  };

  // ---- the onboarding flow -------------------------------------------------
  const FL = 'figure.jc-flow';
  const LINE = 860;     // ms for the line to travel from the Start dot to Exit
  const INSET = 8;      // .fl::before is inset by this much top and bottom
  const DOT = 12 + 5.5; // li::before top offset, plus half its height

  const flow = {
    sel: FL,
    armed:
      FL + ' .fl::before{transform:scaleY(0);transform-origin:top}\n' +
      FL + ' .fl li::before,' + FL + ' .fl-b,' +
      FL + ' .fl-side,' + FL + ' .fl-lg{opacity:0}\n',
    run(fig) {
      const list = fig.querySelector('.fl');
      if (!list) return this.armed;
      const r = list.getBoundingClientRect();
      const top = r.top + INSET;
      const span = Math.max(1, r.height - INSET * 2);
      let css = FL + ' .fl::before{transform-origin:top;animation:fl-line .86s linear forwards}\n' +
                FL + ' .fl-lg{opacity:0;animation:fl-in .4s ' + EASE + ' 1s forwards}\n';
      Array.prototype.forEach.call(list.children, (li, i) => {
        const f = (li.getBoundingClientRect().top + DOT - top) / span;
        const d = Math.round(Math.min(1, Math.max(0, f)) * LINE);
        const n = FL + ' .fl li:nth-child(' + (i + 1) + ')';
        css += n + '::before{opacity:0;animation:fl-dot .26s ' + EASE + ' ' + d + 'ms forwards}\n' +
               n + ' .fl-b{opacity:0;animation:fl-in .36s ' + EASE + ' ' + (d + 40) + 'ms forwards}\n' +
               n + ' .fl-side{opacity:0;animation:fl-in .36s ' + EASE + ' ' + (d + 160) + 'ms forwards}\n';
      });
      return css;
    }
  };

  const DIAGRAMS = [matrix, flow];
  const parts = DIAGRAMS.map((d) => d.armed);

  // Held off-DOM and re-attached by scan() if anything ever takes it out.
  const sheet = document.createElement('style');
  sheet.id = 'ncs-diagrams';
  const paint = () => { sheet.textContent = parts.join(''); };

  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = e.target.__dgm;
          parts[i] = DIAGRAMS[i].run(e.target);
          DIAGRAMS[i].played = true;
          paint();
          obs.unobserve(e.target);
        }
      }, { threshold: 0.08, rootMargin: '0px 0px -10% 0px' })
    : null;

  const seen = new WeakSet();

  // Coalesced onto a frame for the same reason flora.js is: the clock and the
  // text decode touch the DOM constantly, and a case study is rebuilt from
  // scratch every time you re-enter it.
  function scan() {
    if (!sheet.isConnected) (document.head || document.documentElement).appendChild(sheet);
    DIAGRAMS.forEach((d, i) => {
      if (d.played) return;
      const el = document.querySelector(d.sel);
      if (!el || seen.has(el)) return;
      seen.add(el);
      el.__dgm = i;
      if (io) io.observe(el);
      else { parts[i] = d.run(el); d.played = true; paint(); }
    });
  }

  paint();
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
