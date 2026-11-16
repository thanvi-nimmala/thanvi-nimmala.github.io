// The onboarding flow draws itself in.
//
// The line runs down from Start, and each dot lights as the line reaches it,
// its box unveiling just behind. A little over a second end to end, so it reads
// as the flow assembling rather than as an animation to sit through.
//
// Two things shape how this is written.
//
//  1. The delays are measured, not guessed. The steps are not the same height —
//     Permissions is three times the height of "User signs in" — so a flat
//     stagger drifts away from the line almost immediately. Each dot's centre is
//     read as a fraction of the line's own span and turned into its delay, which
//     is why the line arrives exactly as the dot lights.
//  2. None of it is held on the element. The runtime is React and it resyncs
//     class and style on re-render, so a class added here is gone by the next
//     tick of the clock. Everything therefore lives in one stylesheet injected
//     into the head, keyed off nth-child rather than off anything this script
//     would have to keep writing back onto the DOM.
//
// If this never runs, no rule is injected and the flow is simply visible, which
// is the right failure.
(() => {
  'use strict';
  if (window.__flowInit) return;   // the runtime executes helmet scripts twice
  window.__flowInit = true;

  const LINE = 860;     // ms for the line to travel from the Start dot to Exit
  const INSET = 8;      // .fl::before is inset by this much top and bottom
  const DOT = 12 + 5.5; // li::before top offset, plus half its height
  const EASE = 'cubic-bezier(.2,.7,.2,1)';
  const SEL = 'figure.jc-flow';

  const reduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  // Held off-DOM and re-attached by scan() if anything ever takes it out.
  const sheet = document.createElement('style');
  sheet.id = 'ncs-flow';

  // Applied before the case study mounts, so there is no frame in which the
  // flow is visible and then hidden again.
  const ARMED =
    SEL + ' .fl::before{transform:scaleY(0);transform-origin:top}\n' +
    SEL + ' .fl li::before,' + SEL + ' .fl-b,' +
    SEL + ' .fl-side,' + SEL + ' .fl-lg{opacity:0}\n';

  function running(delays) {
    // linear, so the line's position stays proportional to the measured delays
    let css = SEL + ' .fl::before{transform-origin:top;animation:fl-line .86s linear forwards}\n' +
              SEL + ' .fl-lg{opacity:0;animation:fl-in .4s ' + EASE + ' 1s forwards}\n';
    delays.forEach((d, i) => {
      const li = SEL + ' .fl li:nth-child(' + (i + 1) + ')';
      css += li + '::before{opacity:0;animation:fl-dot .26s ' + EASE + ' ' + d + 'ms forwards}\n' +
             li + ' .fl-b{opacity:0;animation:fl-in .36s ' + EASE + ' ' + (d + 40) + 'ms forwards}\n' +
             li + ' .fl-side{opacity:0;animation:fl-in .36s ' + EASE + ' ' + (d + 160) + 'ms forwards}\n';
    });
    return css;
  }

  function measure(list) {
    const r = list.getBoundingClientRect();
    const top = r.top + INSET;
    const span = Math.max(1, r.height - INSET * 2);
    return Array.prototype.map.call(list.children, (li) => {
      const f = (li.getBoundingClientRect().top + DOT - top) / span;
      return Math.round(Math.min(1, Math.max(0, f)) * LINE);
    });
  }

  let played = false;
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const list = e.target.querySelector('.fl');
          if (list) sheet.textContent = running(measure(list));
          played = true;
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
    if (played) return;
    const fig = document.querySelector(SEL);
    if (!fig || seen.has(fig)) return;
    seen.add(fig);
    if (io) io.observe(fig);
    else { const l = fig.querySelector('.fl'); if (l) sheet.textContent = running(measure(l)); played = true; }
  }

  sheet.textContent = ARMED;
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; scan(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
