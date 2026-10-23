// The lilies — one in the work page's rail, two in the about page's corners.
//
// None of them is drawn here. The art is a set of images under flora/: a lily
// rendered in continuous tone — veins, speckles, a dark throat, the stamens
// clustered at the throat — and then run through Floyd-Steinberg, so it is a
// field of dots that thickens where the flower is dark, tinted by what it is:
// magenta through the tepals, green down the stem. flora/draw.py is the source.
//
// They are injected rather than written into the markup, because the runtime
// rebuilds its own DOM on every view change and a bed planted on the about page
// is gone the next time you come back to it.
(() => {
  'use strict';
  if (window.__floraInit) return;   // the runtime executes helmet scripts twice
  window.__floraInit = true;

  // The work page's rail wants the stalk entering from the left, the about
  // page's bottom right corner from the right, and its bottom left a second,
  // younger bunch — one flower open where the other has two. The art is
  // mirrored in the generator rather than flipped in CSS, so the light still
  // falls from the upper left in all of them.
  const BEDS = [
    // where it goes,   the box to make,  which drawing
    ['.lx-rail',        'lx-garden',      'lily-left'],
    ['.ab-flora',       null,             'lily-right'],   // these two are in
    ['.ab-flora-l',     null,             'sprig-left']    // the markup already
  ];
  const SIZE = [400, 862];            // the art's own pixels, to reserve the box

  // decoration, so silent to a screen reader
  function fill(box, art) {
    box.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = './flora/' + art + '-open.png';
    img.alt = '';
    img.width = SIZE[0]; img.height = SIZE[1];
    img.decoding = 'async';
    box.appendChild(img);
  }

  // Mutations are coalesced onto a frame: the clock and the text decode touch
  // the DOM constantly, and this would otherwise be asked on every one of them.
  function plant() {
    BEDS.forEach(([host, cls, art]) => {
      const el = document.querySelector(host);
      if (!el) return;
      if (!cls) {                       // the box is already in the markup
        if (!el.firstChild) fill(el, art);
        return;
      }
      if (el.querySelector('.' + cls)) return;
      const box = document.createElement('div');
      box.className = cls;
      fill(box, art);
      el.appendChild(box);
    });
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; plant(); });
  }).observe(document.body, { childList: true, subtree: true });
  plant();
})();
