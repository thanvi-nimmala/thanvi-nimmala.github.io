// Landing — a rail of type beside a grid of project cards, after jennwchoi.com.
//
// The left rail says who she is and where to go and stays put; the work scrolls
// past it as two staggered columns of cards. Clicking a cover morphs it into the
// case-study hero (View Transitions), and coming back shrinks it into the card it
// came from, with the grid scrolled where you left it.
//
// This owns its DOM outright, and lives OUTSIDE <x-dc>, because the runtime is
// React: DOM injected into a React-managed subtree left the reconciler trying to
// removeChild nodes it no longer owned, which blanked the page on view changes.
// `#stage-root` is a sibling of <x-dc>, so React never sees it.
//
// index.html renders an empty `#stage-root`; everything below builds it, and
// shows it only while the home view is up.
(() => {
  'use strict';
  if (window.__showcaseInit) return;   // the runtime executes helmet scripts twice
  window.__showcaseInit = true;

  const PROJECTS = [
    // Each card shows the thing itself rather than a cover: the ones that are
    // better in motion play, the one that is about a composed page holds still.
    { title: 'New Craft Society', blurb: 'a tool that makes design process visible. 100+ beta signups',
      accent: '#456525', year: '2026', page: 'ncs', tags: ['Design tooling', '0\u21921'],
      media: { kind: 'video', ar: 1.5, src: './deck/card-ncs.mp4?v=2', poster: './deck/card-ncs-poster.webp?v=2' } },
    { title: 'EcoBites', blurb: 'food delivery pointed at food insecurity in New Jersey',
      accent: '#0d7049', year: '2024', page: 'eco', tags: ['Civic tech', 'Two-sided service'],
      media: { kind: 'video', ar: 1.55, src: './eco/card-ecobites.mp4?v=1', poster: './eco/card-ecobites-poster.webp?v=1' } },
    { title: 'Catalogue', blurb: 'online shopping as editorial storytelling',
      accent: '#382565', year: '2025', page: 'cat', tags: ['Commerce', 'Editorial'],
      media: { kind: 'image', ar: 0.95, src: './cat/card-catalogue.webp' } },
    { title: 'TruePay', blurb: 'an AI fraud layer that explains itself',
      accent: '#254a65', year: '2023', page: 'pay', tags: ['Fintech', 'AI trust'],
      media: { kind: 'video', ar: 0.653, src: './pay/card-truepay.mp4', poster: './pay/card-truepay-poster.webp' } }
  ];

  const SECTIONS = [
    { t: 'Work', href: '#top', here: true },
    { t: 'About', href: '#about' }
  ];
  const LINKS = [
    { t: 'Email', href: 'mailto:thanvi.nimmala@gmail.com' },
    { t: 'LinkedIn', href: 'https://www.linkedin.com/in/thanvi-nimmala/', ext: true }
  ];

  const st = { i: 0, el: null, accent: null, scroll: 0 };
  window.__stage = st;

  // The hash is the authority, not a DOM marker: hashchange fires before the
  // runtime has re-rendered, so reading the DOM there still reports the old view
  // and the landing would sit over the next one until the next frame. These are
  // the same values the page component treats as home.
  const HOME = ['', '#', '#top', '#work'];

  // ---- build ---------------------------------------------------------------

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  function build(stage) {
    stage.innerHTML = '';

    const clock = el('div', 'lx-clock');

    const rail = el('div', 'lx-rail');
    rail.append(
      el('div', 'lx-name', 'Thanvi Nimmala'),
      el('div', 'lx-line', 'Product designer who prototypes in code'),
      el('div', 'lx-bio', 'I work 0&#8594;1, most recently as Product Design Lead on ' +
        'New Craft Society at CoCreate. Currently looking for full-time design work.'),
      el('div', 'lx-lbl', 'SECTIONS')
    );

    let n = 0;
    const row = (item, arrow) => {
      const a = el('a', item.here ? 'on' : '',
        '<span class="n">' + String(++n).padStart(2, '0') + '.</span>' +
        '<span class="t"></span><span class="x">' + arrow + '</span>');
      a.querySelector('.t').textContent = item.t;
      a.href = item.href;
      if (item.ext) { a.target = '_blank'; a.rel = 'noopener'; }
      rail.appendChild(a);
    };
    SECTIONS.forEach((x) => row(x, '&#8594;'));
    rail.appendChild(el('div', 'lx-lbl', 'LINKS'));
    LINKS.forEach((x) => row(x, '&#8599;'));
    rail.appendChild(el('div', 'lx-sig', '&copy;2026 Designed and coded by Thanvi'));

    // two columns, each as tall as its own cards: 1 and 3 on the left, 2 and 4 on
    // the right, the way a masonry of mixed heights falls
    const grid = el('div', 'lx-grid');
    const cols = [el('div', 'lx-col'), el('div', 'lx-col')];
    grid.append(cols[0], cols[1]);
    const cards = PROJECTS.map((p, i) => {
      const m = p.media;
      const inner = m.kind === 'video'
        ? '<video src="' + m.src + '" poster="' + m.poster + '" autoplay muted="true" ' +
          'loop="true" playsinline preload="metadata"></video>'
        : '<img src="' + m.src + '" alt="" loading="lazy">';
      const pills = '<span class="lx-pills">' +
        p.tags.map((t) => '<span></span>').join('') + '</span>';
      const a = el('a', 'lx-card',
        '<span class="gi-cover" style="aspect-ratio:' + m.ar + '">' + inner + pills + '</span>' +
        '<span class="lx-foot"><span class="lx-title"></span><span class="lx-year"></span></span>');
      a.href = '#' + p.page;
      a.dataset.i = i;
      a.querySelectorAll('.lx-pills span').forEach((el2, n) => { el2.textContent = p.tags[n]; });
      a.querySelector('.lx-title').textContent = p.title + ': ' + p.blurb;
      a.querySelector('.lx-year').textContent = p.year;
      // the page's accent follows whichever project is under the pointer
      // Safari wants the property as well as the attribute before it will autoplay,
      // and a card below the fold is left paused until it is scrolled into view
      const v = a.querySelector('video');
      if (v) { v.muted = true; playWhenSeen(v); }
      a.addEventListener('pointerenter', () => { st.i = i; syncAccent(true); });
      cols[i % 2].appendChild(a);
      return a;
    });

    const wrap = el('div', 'lx');
    wrap.append(rail, grid);
    stage.append(clock, wrap);

    st.el = { stage, wrap, rail, grid, cards, clock };
    stage.__built = true;
    tickClock();
  }

  const seen = window.IntersectionObserver && new IntersectionObserver((rows) => {
    rows.forEach((r) => {
      if (!r.isIntersecting) return;
      const go = r.target.play();
      if (go && go.catch) go.catch(() => {});
    });
  }, { rootMargin: '200px' });
  function playWhenSeen(v) {
    if (seen) seen.observe(v);
    const go = v.play();
    if (go && go.catch) go.catch(() => {});
  }

  // the local time, top right, as on jennwchoi.com
  function tickClock() {
    const c = st.el && st.el.clock;
    if (!c) return;
    // motion.js decodes mono text under the pointer; writing the time mid-decode
    // would fight it, and the next tick catches up anyway
    if (c.matches(':hover')) return;
    c.textContent = 'New York, ' + new Date().toLocaleTimeString('en-US', {
      timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit'
    });
  }
  setInterval(tickClock, 1000);

  // ---- accent ---------------------------------------------------------------

  // Each project carries its own accent, and the page takes it: the case study
  // uses it, and on the landing it follows the card under the pointer. Hues are
  // hand-spread to stay at least 53 degrees apart; the raw dominants put EcoBites
  // and Catalogue only 15 apart, which read as the same colour.
  //
  // The scroll-spy rewrites the hash to #s1, #s2 … while you read a case study, so
  // an unrecognised hash leaves the accent where it was rather than resetting it.
  function syncAccent(force) {
    const h = location.hash.replace('#', '');
    const byPage = PROJECTS.find((x) => x.page === h);
    const p = byPage || (force || HOME.includes(location.hash) ? PROJECTS[st.i] : null);
    if (!p || p.accent === st.accent) return;
    st.accent = p.accent;
    document.documentElement.style.setProperty('--accent', p.accent);
    // --accent-rgb has to move with it, or any rgba() tint keeps the previous
    // project's hue. It drifted out of sync once already.
    document.documentElement.style.setProperty('--accent-rgb',
      [1, 3, 5].map((i) => parseInt(p.accent.substr(i, 2), 16)).join(','));
  }

  function sync() {
    syncAccent();
    document.documentElement.classList.toggle('on-landing', HOME.includes(location.hash));
    const root = document.getElementById('stage-root');
    if (!root) return null;
    const onHome = HOME.includes(location.hash);

    if (onHome && root.hidden) {
      root.hidden = false;
      if (!root.__built) build(root);
      root.scrollTop = st.scroll;     // back where the grid was left
    } else if (!onHome && !root.hidden) {
      root.hidden = true;             // another view is up
      window.scrollTo(0, 0);          // the landing scrolls inside itself; the page does not
    }
    return root;
  }

  window.addEventListener('hashchange', sync);

  // Clicking a card is a plain hash navigation; all this does is remember where
  // the grid was so the way back lands in the same place.
  const stageRoot = document.getElementById('stage-root');
  stageRoot.addEventListener('click', (e) => {
    const a = e.target.closest('.lx-card');
    if (a) { st.scroll = stageRoot.scrollTop; st.i = +a.dataset.i || 0; }
  });

  // The runtime rewrites the hash itself (the case-study scroll-spy), and those
  // writes do not always arrive as a hashchange, so the hash is re-read on a
  // frame clock. sync() is a few property reads when nothing has moved.
  const loop = () => { sync(); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);

  // Build once up front rather than waiting on the first animation frame — a tab
  // loaded in the background gets no frames until it is focused, and the landing
  // should not depend on that to exist.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();
})();
