// Landing showcase — an Obys-style focal slot. A column of project covers scrolls
// vertically through a fixed slot at the centre of the screen; whichever cover is
// nearest that slot is the active project, and the index, metadata, number and
// blurred ground all follow it. The focal cover reads in full colour while the
// rest fall back to grey, which is what marks it.
//
// The column loops: the four covers are repeated so scrolling never runs out.
//
// This owns its DOM outright, and lives OUTSIDE <x-dc>, for two reasons:
//
//  1. The runtime is React. Injecting nodes into a React-managed subtree left the
//     reconciler trying to removeChild nodes it no longer owned, which blanked the
//     whole page on view changes. `#stage-root` is a sibling of <x-dc>, so React
//     never sees it.
//  2. Every setState in the page component re-evaluates the whole ~130KB template.
//     That is fine at the 55ms clock tick and hopeless at 60fps, which is what the
//     thread animation needs.
//
// index.html renders an empty `#stage-root`; everything below builds and animates
// it, and shows it only while the home view (`[data-home]`) is mounted.
(() => {
  'use strict';
  if (window.__showcaseInit) return;   // the runtime executes helmet scripts twice
  window.__showcaseInit = true;

  const PROJECTS = [
    { num: '(001)', title: 'New Craft Society', accent: '#456525', year: '2026', sector: 'DESIGN TOOLS, SOFTWARE', role: 'Product design · Research · 0→1', page: 'ncs', cover: './deck/ncs-cover.webp',
      meta: 'COCREATE — MACOS + WEB — 2026',
      desc: 'A capture tool that gives your design process memory. I led design 0→1, with 30+ user testing sessions behind it.' },
    { num: '(002)', title: 'EcoBites', accent: '#653a25', year: '2024', sector: 'FOOD ACCESS, CIVIC', role: 'Product design · Research', page: 'eco', cover: './eco/cover-mockup.webp?v=4',
      meta: 'ACADEMIC — WEB + iOS',
      desc: 'A food-delivery model pointed at food insecurity in New Jersey — a client site, and a driver app for the volunteers.' },
    { num: '(003)', title: 'Catalogue', accent: '#382565', year: '2025', sector: 'COMMERCE, EDITORIAL', role: 'Product design · UI', page: 'cat', cover: './cat/magazines.webp',
      meta: 'SELF-DIRECTED — WEB + EXTENSION',
      desc: 'Online shopping as editorial storytelling. Save products from anywhere on the web, then compose them into issues.' },
    { num: '(004)', title: 'TruePay', accent: '#254a65', year: '2023', sector: 'FINTECH, SECURITY', role: 'Product design · UI', page: 'pay', cover: './pay/cover-card.webp',
      meta: 'FINTECH CONCEPT — iOS + ANDROID',
      desc: 'An AI fraud layer that stays invisible when you are safe and explains itself when it stops you.' }
  ];

  const NAV = 72;            // the fixed masthead
  const GUTTER = 78;         // left margin for the quiet type column
  const TYPE_COL = 300;      // room the index needs before the cover may start
  const COVER_RATIO = 1.783; // 1676/940, the aspect every cover is cropped to
  const REPEATS = 5;         // the cover list is repeated so the column can loop
  const GAP_RATIO = 0.62;    // vertical gap between covers, as a share of one height
  const SCROLL_K = 0.9;      // how far a wheel notch moves the column
  const NARROW = 1024;       // below this the pinch composition has no room
  const IDX_ROW = 34;        // px per name in the index window
  const IDX_SLOTS = 3;       // how many names are visible at once

  // `y` is the column's scroll offset in px; `i` is whichever cover is nearest
  // the focal slot, derived from it
  const st = { i: 0, y: 0, shown: 0, el: null, pitch: 0, cycle: 0, view: 'vertical',
               accent: null };
  window.__stage = st;

  const narrow = () => window.innerWidth < NARROW;

  // The hash is the authority, not a DOM marker: hashchange fires before the
  // runtime has re-rendered, so reading the DOM there still reports the old view
  // and the landing would sit over the next one until the next frame. These are
  // the same values the page component treats as home.
  const HOME = ['', '#', '#top', '#work'];

  // ---- build ---------------------------------------------------------------

  function build(stage) {
    stage.innerHTML = '';

    // the column: the four covers repeated, so scrolling never runs out
    const col = document.createElement('div');
    col.className = 'stage-col';
    const items = [];
    for (let r = 0; r < REPEATS; r++) {
      PROJECTS.forEach((p, n) => {
        const a = document.createElement('a');
        a.className = 'col-item';
        a.href = '#' + p.page;
        a.dataset.i = n;
        a.style.backgroundImage = 'url("' + p.cover + '")';
        col.appendChild(a);
        items.push(a);
      });
    }

    // The index is a three-row window onto a looping track: the active project
    // sits in the middle slot with its neighbours faded above and below, and the
    // whole track slides as the covers scroll. The names are repeated the same
    // number of times as the covers so it never runs out either way.
    const idx = document.createElement('div');
    idx.className = 'stage-idx';
    const track = document.createElement('div');
    track.className = 'stage-idx-track';
    idx.appendChild(track);
    const buttons = [];
    for (let r = 0; r < REPEATS; r++) {
      PROJECTS.forEach((p, n) => {
        const b = document.createElement('button');
        b.textContent = p.title;
        b.dataset.scramble = '';      // opt in to motion.js's hover decode
        b.dataset.i = n;
        b.addEventListener('click', () => pick(n));
        track.appendChild(b);
        buttons.push(b);
      });
    }

    const info = document.createElement('div');
    info.className = 'stage-info';
    info.innerHTML =
      '<div class="s-sector"></div><div class="s-meta"></div>' +
      '<div class="s-desc"></div><a class="s-cta">READ THE CASE STUDY →</a>';

    // the ground: the cover blurred to fog, two layers so a swap cross-fades
    const bgs = [0, 1].map(() => {
      const d = document.createElement('div');
      d.className = 'stage-bg';
      return d;
    });
    const veil = document.createElement('div');
    veil.className = 'stage-veil';

    const count = document.createElement('div');
    count.className = 'stage-count';

    const bignum = document.createElement('div');
    bignum.className = 'stage-bignum';

    // grid: the four covers at size, in colour — nothing like the thumbnail wall,
    // because four large covers read where fifty small ones did not
    const grid = document.createElement('div');
    grid.className = 'stage-grid';
    PROJECTS.forEach((p, n) => {
      const a = document.createElement('a');
      a.className = 'grid-item';
      a.href = '#' + p.page;
      a.innerHTML = '<span class="gi-cover" style="background-image:url(&quot;' + p.cover +
        '&quot;)"></span><span class="gi-name"></span><span class="gi-meta"></span>';
      a.querySelector('.gi-name').textContent = p.title;
      a.querySelector('.gi-meta').textContent = p.sector;
      a.addEventListener('click', () => { st.i = n; });
      grid.appendChild(a);
    });

    // list: a typographic index. Four rows is thin next to Aino's thirty-nine, so
    // each row carries more — sector, role and year, under a column header.
    const list = document.createElement('div');
    list.className = 'stage-list';
    const head = document.createElement('div');
    head.className = 'list-head';
    head.innerHTML = '<span>NO.</span><span>PROJECT</span><span>SECTOR</span>' +
      '<span>ROLE</span><span>YEAR</span>';
    list.appendChild(head);
    PROJECTS.forEach((p, n) => {
      const a = document.createElement('a');
      a.className = 'list-row';
      a.href = '#' + p.page;
      a.innerHTML = '<span class="lr-n"></span><span class="lr-t"></span>' +
        '<span class="lr-s"></span><span class="lr-r"></span><span class="lr-y"></span>';
      a.querySelector('.lr-n').textContent = String(n + 1).padStart(3, '0');
      a.querySelector('.lr-t').textContent = p.title;
      a.querySelector('.lr-s').textContent = p.sector;
      a.querySelector('.lr-r').textContent = p.role;
      a.querySelector('.lr-y').textContent = p.year;
      a.addEventListener('click', () => { st.i = n; });
      list.appendChild(a);
    });

    const views = document.createElement('div');
    views.className = 'stage-views';
    const vBtns = ['vertical', 'grid', 'list'].map((v) => {
      const b = document.createElement('button');
      b.textContent = v.toUpperCase();
      b.dataset.view = v;
      b.addEventListener('click', () => setView(v));
      views.appendChild(b);
      return b;
    });


    stage.append(bgs[0], bgs[1], veil, col, idx, info, count, bignum, grid, list, views);
    st.el = {
      stage, col, items, buttons, count, bgs, info, idxEl: idx, track, bignum,
      grid, list, views, vBtns,
      sector: info.querySelector('.s-sector'),
      meta: info.querySelector('.s-meta'), desc: info.querySelector('.s-desc'),
      cta: info.querySelector('.s-cta')
    };
    stage.__built = true;

    setView(st.view);
    paintContent();
    layout();
  }

  // ---- content (changes once per transition) --------------------------------

  // The caption lines (sector, meta, the big number) do not swap — the old
  // ones leave in the direction of travel and the new ones arrive from the
  // other side, one after another, resolving from a blur the way the
  // case-study headings do (reveal.js). Scrolling down, text leaves upward.
  const CAP_OUT = 200, CAP_IN = 480, CAP_STAGGER = 55, CAP_BLUR = 7, CAP_RISE = 16;
  const noCaptionMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let capToken = 0;
  function swapCaption(lines, dir) {
    const token = ++capToken;
    const set = () => lines.forEach(([el, text]) => { el.textContent = text; });
    if (noCaptionMotion || !st.painted || st.instant) { set(); st.painted = true; return; }
    const ease = 'cubic-bezier(.2,.7,.2,1)';
    const outs = lines.map(([el], i) => {
      el.getAnimations().forEach((a) => a.cancel());
      return el.animate([
        { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' },
        { opacity: 0, filter: 'blur(' + CAP_BLUR + 'px)', transform: 'translateY(' + (-CAP_RISE * 0.6 * dir) + 'px)' }
      ], { duration: CAP_OUT, delay: i * CAP_STAGGER * 0.6, easing: 'ease-in', fill: 'both' }).finished;
    });
    Promise.allSettled(outs).then(() => {
      if (token !== capToken) return;        // a newer swap took over
      set();
      lines.forEach(([el], i) => {
        el.getAnimations().forEach((a) => a.cancel());
        el.animate([
          { opacity: 0, filter: 'blur(' + CAP_BLUR + 'px)', transform: 'translateY(' + (CAP_RISE * dir) + 'px)' },
          { opacity: 1, filter: 'blur(0)', transform: 'translateY(0)' }
        ], { duration: CAP_IN, delay: i * CAP_STAGGER, easing: ease, fill: 'backwards' });
      });
    });
  }

  function paintContent() {
    const e = st.el, p = PROJECTS[st.i];
    // direction of travel: the next project in order means we scrolled down
    const dir = st.last === undefined || (st.last + 1) % PROJECTS.length === st.i ? 1 : -1;
    st.last = st.i;
    e.cta.href = '#' + p.page;
    e.desc.textContent = p.desc;
    swapCaption([
      [e.sector, p.sector],
      [e.meta, p.meta],
      [e.bignum, String(st.i + 1).padStart(2, '0')]
    ], dir);
    e.count.textContent =
      String(st.i + 1).padStart(2, '0') + ' / ' + String(PROJECTS.length).padStart(2, '0');

    const showing = e.bgs.findIndex((b) => b.classList.contains('on'));
    const next = showing === 0 ? 1 : 0;
    e.bgs[next].style.backgroundImage = 'url("' + p.cover + '")';
    e.bgs[next].classList.add('on');
    if (showing >= 0) e.bgs[showing].classList.remove('on');
  }

  // ---- views -----------------------------------------------------------------

  function setView(v) {
    st.view = v;
    const e = st.el;
    if (!e) return;
    e.stage.dataset.view = v;
    e.vBtns.forEach((b) => b.classList.toggle('on', b.dataset.view === v));
    if (v === 'vertical') layout();     // the column needs re-placing on return
  }

  // ---- geometry (changes every frame) --------------------------------------

  function layout() {
    const e = st.el;
    if (!e) return;


    if (narrow()) {
      // stacked: the CSS lays the covers out in flow, so clear the inline
      // positioning the wide layout puts on the column and its items
      e.col.style.cssText = '';
      e.items.forEach((it) => { it.style.top = ''; it.style.height = ''; });
      return;
    }

    // the stage scrolls internally at narrow widths; coming back to the wide
    // composition it must not stay parked partway down
    if (e.stage.scrollTop) e.stage.scrollTop = 0;

    const vw = window.innerWidth, vh = window.innerHeight;

    // The focal slot: a fixed rectangle at the centre that covers scroll through.
    const slotW = Math.max(340, Math.min(620, vw * 0.42));
    const slotH = slotW / COVER_RATIO;
    const cx = vw * 0.54, cy = NAV + (vh - NAV) / 2;
    const sx = cx - slotW / 2, sy = cy - slotH / 2;

    st.pitch = slotH * (1 + GAP_RATIO);
    st.cycle = st.pitch * PROJECTS.length;

    // lay the column out; each item is one slot-sized cover, pitch apart
    e.col.style.left = sx.toFixed(1) + 'px';
    e.col.style.width = slotW.toFixed(1) + 'px';
    e.items.forEach((it, n) => {
      it.style.height = slotH.toFixed(1) + 'px';
      it.style.top = (n * st.pitch).toFixed(1) + 'px';
    });

    placeColumn(sy, slotH);

    // the type column on the left, the number out on the focal row
    e.idxEl.style.left = GUTTER + 'px';
    e.idxEl.style.top = (cy - (IDX_SLOTS * IDX_ROW) / 2).toFixed(1) + 'px';
    e.idxEl.style.height = (IDX_SLOTS * IDX_ROW) + 'px';
    e.track.style.setProperty('--row', IDX_ROW + 'px');
    e.info.style.left = GUTTER + 'px';
    // clear of the index window, which is now centred on the focal slot
    e.info.style.top =
      Math.max(cy + (IDX_SLOTS * IDX_ROW) / 2 + 44, vh - 372).toFixed(1) + 'px';
    e.info.style.width = Math.max(220, Math.min(320, sx - GUTTER - 48)) + 'px';
    e.bignum.style.right = GUTTER + 'px';
    e.bignum.style.top = (cy - 8) + 'px';
  }

  // Position the looping column for the current scroll offset and work out which
  // cover is sitting in the slot. The offset is wrapped so the four covers repeat
  // forever; the middle repeat is kept under the slot so there is always another
  // cover above and below.
  function placeColumn(sy, slotH) {
    const e = st.el;
    if (!e || !st.cycle) return;
    const mid = Math.floor(REPEATS / 2) * st.cycle;
    const wrapped = ((st.shown % st.cycle) + st.cycle) % st.cycle;
    e.col.style.top = (sy - mid - wrapped).toFixed(1) + 'px';

    const active = Math.round(wrapped / st.pitch) % PROJECTS.length;
    placeIndex(wrapped / st.pitch);

    // the focal cover reads in full; the rest fall back to grey, as Obys does
    e.items.forEach((it) => {
      const off = Math.abs(parseFloat(it.style.top) - (mid + wrapped));
      const near = off < st.pitch * 0.5;
      it.classList.toggle('on', near);
    });

    if (active !== st.i) { st.i = active; paintContent(); }
  }

  // Slide the name track so the current project sits in the middle slot, and fade
  // each name by how far it is from that slot. `frac` is the column's position in
  // projects — 1.5 means halfway between the second and third — so the names move
  // continuously with the covers rather than snapping.
  function placeIndex(frac) {
    const e = st.el;
    if (!e || !e.track) return;
    const mid = Math.floor(REPEATS / 2) * PROJECTS.length;
    e.track.style.transform =
      'translateY(' + (-(mid + frac - 1) * IDX_ROW).toFixed(2) + 'px)';
    for (let i = 0; i < e.buttons.length; i++) {
      const d = Math.abs(i - (mid + frac));         // distance from the middle slot
      const b = e.buttons[i];
      if (d > 2.2) { if (b.style.opacity !== '0') b.style.opacity = '0'; continue; }
      // 1 in the middle, fading out by one row either side
      const t = Math.max(0, 1 - d);
      b.style.opacity = (0.18 + 0.82 * t).toFixed(3);
      b.style.color = 'var(--ink)';
    }
  }

  // ---- scroll ---------------------------------------------------------------

  // Jump straight to a project when its name is clicked: move the offset to that
  // cover's position by the shortest way round the loop.
  function pick(next) {
    if (!st.cycle || next === st.i) return;
    const cur = ((st.y % st.cycle) + st.cycle) % st.cycle;
    let want = next * st.pitch;
    let d = want - cur;
    if (d > st.cycle / 2) d -= st.cycle;
    if (d < -st.cycle / 2) d += st.cycle;
    st.y += d;
  }

  // ---- loop ----------------------------------------------------------------

  let lastW = window.innerWidth, lastH = window.innerHeight;

  // Keep the landing's visibility in step with the routed view. The loop calls
  // this every frame, and hashchange calls it too so a route change hides the
  // stage immediately instead of leaving it over the next view for a frame.
  // The accent follows whichever project you are looking at, because the ground
  // does too — a fixed hue cannot sit against four different grounds. Hues are
  // hand-spread to stay at least 53 degrees apart; the raw dominants put EcoBites
  // and Catalogue only 15 apart, which read as the same colour.
  //
  // The scroll-spy rewrites the hash to #s1, #s2 … while you read a case study, so
  // an unrecognised hash leaves the accent where it was rather than resetting it.
  function syncAccent() {
    const h = location.hash.replace('#', '');
    const byPage = PROJECTS.find((x) => x.page === h);
    const p = byPage || (HOME.includes(location.hash) ? PROJECTS[st.i] : null);
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
    // the masthead drops its paper backing on the landing — see .site-nav
    document.documentElement.classList.toggle('on-landing', HOME.includes(location.hash));
    const root = document.getElementById('stage-root');
    if (!root) return null;
    const onHome = HOME.includes(location.hash);

    if (onHome && root.hidden) {
      // entering the landing: show it and rewind the column to the first project
      root.hidden = false;
      if (!root.__built) build(root);
      st.y = 0; st.shown = 0;
      layout();
    } else if (!onHome && !root.hidden) {
      root.hidden = true;                       // another view is up
    }
    return root;
  }

  window.addEventListener('hashchange', sync);

  // ---- shared-element transition into and out of a case study ---------------
  // The cover you click and the hero of the case study you land on are the same
  // image, so the browser is told they are the same element (view-transition-name)
  // and morphs one into the other — the cover grows out of its slot to become
  // the hero, and shrinks back into it on the way out. Rendering is paused while
  // the case study mounts, so the morph starts from the exact frame you clicked.
  // Browsers without the API, and anyone with reduced motion set, just navigate.
  const PAGES = new Set(PROJECTS.map((p) => p.page));
  const noMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canMorph = () => !!document.startViewTransition && !noMotion;

  // resolve once `test` returns something truthy, or give up after `ms`
  const until = (test, ms) => new Promise((res) => {
    const t0 = performance.now();
    (function poll() {
      const v = test();
      if (v || performance.now() - t0 > ms) return res(v);
      setTimeout(poll, 16);
    })();
  });
  const waitFor = (sel, ms) => until(() => document.querySelector(sel), ms);
  // only one element may carry the name at a time, so the old view must be gone
  const waitGone = (sel, ms) => until(() => !document.querySelector(sel), ms);

  let morphing = false;
  async function morphTo(visual, hash) {
    if (!canMorph() || !visual) { location.hash = hash; return; }
    if (morphing) return;
    morphing = true;
    // a hero from the case study we just left can still be unmounting; two
    // elements with one name abort the transition, so take its name away first
    document.querySelectorAll('.cs-hero').forEach((h) => { h.style.viewTransitionName = 'none'; });
    visual.style.viewTransitionName = 'cover';
    const vt = document.startViewTransition(async () => {
      location.hash = hash;
      sync();
      window.scrollTo(0, 0);
      await waitFor('.cs-hero', 1500);
      // The old snapshot is already taken by now. The cover sits inside the hidden
      // stage, but Chromium still counts its name in the new state and aborts on
      // the duplicate — so hand the name over to the hero before that capture.
      visual.style.viewTransitionName = '';
    });
    vt.finished.finally(() => { visual.style.viewTransitionName = ''; morphing = false; });
  }

  // landing -> case study: any project link on the stage
  const stageRoot = document.getElementById('stage-root');
  stageRoot.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const hash = a.getAttribute('href');
    if (!PAGES.has(hash.slice(1))) return;
    e.preventDefault();
    const visual = a.classList.contains('col-item') ? a
      : a.querySelector('.gi-cover') || stageRoot.querySelector('.col-item.on');
    morphTo(visual, hash);
  });

  // case study -> landing: WORK in the masthead, "<- ALL WORK", the footer
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href="#top"]');
    if (!a || !document.querySelector('.cs-hero') || !canMorph()) return;
    e.preventDefault();
    e.stopPropagation();   // the runtime's own handler would navigate a second time
    // sync() rewinds the column to the first project whenever the landing returns;
    // for the morph to land on the cover we came from, put that project in the slot
    const from = PROJECTS.findIndex((p) => '#' + p.page === location.hash);
    if (morphing) return;
    morphing = true;
    // no hands on the way out — leaving is a plain morph
    let target = null;
    const vt = document.startViewTransition(async () => {
      location.hash = 'top';
      sync();                                   // shows the stage; layout() sets st.pitch
      window.scrollTo(0, 0);
      if (from >= 0 && st.pitch) {
        st.y = st.shown = from * st.pitch;
        st.i = -1;                              // force paintContent for this project
        st.instant = true;                      // caption lands with the cover, no swap motion
        layout();                               // .on lands on its cover, no easing
        st.instant = false;
      }
      await waitGone('.cs-hero', 1500);            // the runtime unmounts it a frame later
      target = await until(() =>
        stageRoot.querySelector('.col-item.on') ||
        [...stageRoot.querySelectorAll('.col-item[data-i="' + from + '"]')]
          .find((c) => c.offsetParent !== null), 1500);
      if (target) target.style.viewTransitionName = 'cover';
    });
    vt.finished.finally(() => { if (target) target.style.viewTransitionName = ''; morphing = false; });
  }, true);

  const loop = (ts) => {
    const root = sync();
    if (root && !root.hidden && st.el) {
      const resized = window.innerWidth !== lastW || window.innerHeight !== lastH;
      if (resized) { lastW = window.innerWidth; lastH = window.innerHeight; layout(); }
      // ease the column toward wherever the wheel has pushed it
      if (st.view === 'vertical' && Math.abs(st.y - st.shown) > 0.2) {
        st.shown += (st.y - st.shown) * 0.12;
        layout();
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Build once up front rather than waiting on the first animation frame — a tab
  // loaded in the background gets no frames until it is focused, and the landing
  // should not depend on that to exist.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  else sync();

  // ---- input ---------------------------------------------------------------

  window.addEventListener('wheel', (e) => {
    if (!st.el || narrow() || st.view !== 'vertical') return;
    if (!HOME.includes(location.hash)) return;
    st.y += e.deltaY * SCROLL_K;
  }, { passive: true });


  // arrow keys step a whole project, so the landing works without a wheel
  window.addEventListener('keydown', (e) => {
    if (!st.el || narrow() || st.view !== 'vertical') return;
    if (!HOME.includes(location.hash)) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') st.y += st.pitch;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') st.y -= st.pitch;
  });
})();
