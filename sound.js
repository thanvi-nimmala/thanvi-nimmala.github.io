// Sound design for the portfolio: a flower rendered at 8-bit.
//
// The reference is her own mood board — lilies and blossom pushed through
// halftone dots, dither grids, ASCII mosaics and CRT scanlines. The subject is
// organic and pretty; the rendering is low-res and synthetic. So the sound is
// built the same way round: a bell-like bloom, then a screen put over it.
//
//   the flower   six inharmonic partials, glass ratios rather than a harmonic
//                series, each one detuned a few cents so the note shimmers
//                instead of sitting still. Slow attack, very long decay.
//   the screen   a waveshaper that quantises the signal to a handful of steps,
//                mixed under the clean tone — the audible equivalent of posterising
//                an image. You hear the grid, you do not lose the picture.
//   the dither   a scatter of tiny high-passed grains across the first third of
//                the note, the halftone dots of the thing.
//   the glow     a diffuse multi-tap delay, because every one of those images is
//                lit from behind.
//
// Everything is synthesized live through the Web Audio API — no files, same as
// the Cyberfem Networks exhibition. Two rules from that project hold here: the
// context is built on the first gesture, because browsers will not make a sound
// before one, and nothing plays until the visitor asks for it.
(() => {
  'use strict';
  if (window.__soundInit) return;   // the runtime executes helmet scripts twice
  window.__soundInit = true;

  const KEY = 'tn-sound';
  const GAIN = 0.09;
  // How much of the quantised copy you hear under the clean tone, and how coarse
  // it is. Low and fine: the screen should be a texture over the note, not a
  // distortion of it. SCREEN 0.4 / STEPS 7 is the harsh end.
  const SCREEN = 0.13;
  const STEPS = 44;
  // the cover notes play on hover, so they are passing by rather than asked for:
  // kept well under the tick, which is the level that feels right
  const COVER = 0.34;
  // D major pentatonic, up where a chime lives. Any two of these are consonant,
  // so running a pointer across the grid cannot play a wrong chord.
  const NOTES = [587.33, 659.25, 739.99, 880.00];
  // glass, not brass: the partials are deliberately not whole multiples
  const PARTIALS = [[1, 1], [2.01, 0.42], [3.04, 0.2], [4.22, 0.1], [5.41, 0.05], [7.13, 0.018]];

  let on = false;
  try { on = localStorage.getItem(KEY) === 'on'; } catch (e) { /* private window */ }

  let ac = null, bus = null, crusher = null, dry = null, wet = null;

  // the posterising curve: round the waveform to `steps` levels
  function crushCurve(steps) {
    const n = 2048, c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.round(x * steps) / steps;
    }
    return c;
  }

  function wake() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();

    bus = ac.createGain(); bus.gain.value = 1;

    // the screen: the clean tone and its quantised copy, summed
    // a limiter on the end, so overlapping notes cannot add up into clipping
    const out = ac.createDynamicsCompressor();
    out.threshold.value = -10; out.knee.value = 12; out.ratio.value = 6;
    out.attack.value = 0.004; out.release.value = 0.2;
    out.connect(ac.destination);

    crusher = ac.createWaveShaper();
    crusher.curve = crushCurve(STEPS);
    crusher.oversample = '4x';              // no aliasing: grain, not grit
    // the quantised copy is rolled off at both ends — what is left is the
    // texture of the steps, not the harshness of them
    const crushHi = ac.createBiquadFilter();
    crushHi.type = 'lowpass'; crushHi.frequency.value = 3200; crushHi.Q.value = 0.5;
    const crushLo = ac.createBiquadFilter();
    crushLo.type = 'highpass'; crushLo.frequency.value = 400;
    wet = ac.createGain(); wet.gain.value = SCREEN;
    dry = ac.createGain(); dry.gain.value = 1;
    bus.connect(dry); dry.connect(out);
    bus.connect(crusher); crusher.connect(crushLo); crushLo.connect(crushHi); crushHi.connect(wet); wet.connect(out);

    // the glow: three taps at prime-ish spacings so they never line up
    [[0.071, 0.2], [0.113, 0.15], [0.197, 0.1]].forEach(([t, g]) => {
      const d = ac.createDelay(0.5); d.delayTime.value = t;
      const dg = ac.createGain(); dg.gain.value = g;
      const dt = ac.createBiquadFilter(); dt.type = 'lowpass'; dt.frequency.value = 2600;
      bus.connect(d); d.connect(dt); dt.connect(dg); dg.connect(out);
    });
    return ac;
  }

  // a scatter of tiny grains — the halftone dots over the note
  function dither(at, dur, level) {
    const count = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < count; i++) {
      const t = at + Math.random() * dur * 0.34;
      const len = 0.004 + Math.random() * 0.01;
      const n = Math.max(2, Math.floor(ac.sampleRate * len));
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let j = 0; j < n; j++) d[j] = (Math.random() * 2 - 1);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 2600; f.Q.value = 9;
      const g = ac.createGain();
      g.gain.setValueAtTime(GAIN * level * 0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.02);
      src.connect(f); f.connect(g); g.connect(bus);
      src.start(t); src.stop(t + len + 0.03);
    }
  }

  // one bloom: the flower, then the dots over it
  function bloom(freq, { dur = 2.8, level = 1, at = 0, attack = 0.035 } = {}) {
    if (!on || !wake()) return;
    const t = ac.currentTime + at;
    const voice = ac.createGain(); voice.gain.value = 1;
    const tone = ac.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 5200; tone.Q.value = 0.4;
    voice.connect(tone); tone.connect(bus);

    PARTIALS.forEach(([ratio, amp]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      o.detune.value = (Math.random() * 12) - 6;        // the shimmer
      const peak = GAIN * level * amp;
      const life = dur * (0.45 + 0.55 / ratio);          // highs fade first, as glass does
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + life);
      o.connect(g); g.connect(voice);
      o.start(t); o.stop(t + life + 0.05);
    });
    dither(t, dur, level);
  }

  const S = {
    note: (i) => bloom(NOTES[i % NOTES.length], { dur: 2.9, level: COVER }),
    // a chord opening out, lowest first
    enter: () => { bloom(587.33, { dur: 3.4, level: 0.6 }); bloom(880.00, { dur: 3.0, level: 0.42, at: 0.09 }); bloom(1174.66, { dur: 2.6, level: 0.26, at: 0.19 }); },
    back: () => { bloom(880.00, { dur: 2.2, level: 0.4 }); bloom(587.33, { dur: 3.0, level: 0.5, at: 0.09 }); },
    // one dot of the halftone, alone
    tick: () => { if (on && wake()) dither(ac.currentTime, 0.1, 1.5); },
    lift: () => bloom(1318.51, { dur: 0.9, level: 0.3, attack: 0.006 }),
    drop: () => bloom(293.66, { dur: 1.8, level: 0.5, attack: 0.008 })
  };
  window.__sound = S;

  // ---- what makes a sound ---------------------------------------------------
  // Everything is delegated, because the runtime rebuilds its own DOM on every
  // view change and listeners bound to those nodes would not survive it.

  let lastCard = -1;
  document.addEventListener('pointerover', (e) => {
    if (!on || !e.target.closest) return;
    const card = e.target.closest('.lx-card');
    if (card) {
      const i = +card.dataset.i || 0;
      if (i !== lastCard) { lastCard = i; S.note(i); }
      return;
    }
    lastCard = -1;
    if (e.target.closest('.jc-nav a, .lx-rail a, .ab-links a')) S.tick();
  }, { passive: true });

  document.addEventListener('click', (e) => {
    if (!on || !e.target.closest) return;
    if (e.target.closest('.lx-card') || e.target.closest('.jc-next a')) S.enter();
    else if (e.target.closest('a[href="#top"]')) S.back();
  }, true);

  document.addEventListener('pointerdown', (e) => {
    if (on && e.target.closest && e.target.closest('.pile-card')) S.lift();
  }, { passive: true });
  document.addEventListener('pointerup', (e) => {
    if (on && e.target.closest && e.target.closest('.pile-card')) S.drop();
  }, { passive: true });

  // ---- the lilies -----------------------------------------------------------
  // A lily: buds while the sound is off, open while it is on, in three places —
  // the switch, the work page's rail and the about page's bottom right corner.
  //
  // None of it is drawn here. The art is a set of images under flora/, a lily
  // rendered in continuous tone — veins, speckles, a dark throat, the stamens
  // clustered at the throat, the long pointed spindles lilies carry before they
  // open — and then run through Floyd-Steinberg, so it is a field of dots that
  // thickens where the flower is dark, tinted by what it is: magenta through the
  // tepals, green down the stem. flora/draw.py and flora/button.py are the source.
  //
  // Swapping the two states is a cross-fade driven by one class on <html>, so
  // nothing has to be wired between the switch and the flowers it opens.
  // Two plantings, facing opposite ways: the work page's rail wants the stalk
  // entering from the left, the about page's bottom right corner from the right.
  // The art is mirrored in the generator rather than flipped in CSS, so the light
  // still falls from the upper left in both.
  const BEDS = [
    // where it goes,  the box,      which way the stalk leans
    ['.lx-rail',       'lx-garden',  'left'],
    ['.ab-flora',      null,         'right']     // this one is in the markup
  ];
  const SIZES = { left: [400, 862], right: [400, 862], btn: [96, 96] };
  const STATES = [['shut', 'buds'], ['open', 'open']];

  // The lilies are decoration, and on the switch the label is the switch's own,
  // so they are silent to a screen reader either way.
  function fill(box, side) {
    STATES.forEach(([cls, state]) => {
      const img = document.createElement('img');
      img.className = cls;
      img.src = './flora/lily-' + side + '-' + state + '.png';
      img.alt = '';
      const [w, h] = SIZES[side];
      img.width = w; img.height = h;         // reserve the space before it loads
      img.decoding = 'async';
      box.appendChild(img);
    });
  }

  // The runtime rebuilds its own DOM on every view change, so a bed planted on
  // the about page is gone the next time you come back to it: this keeps
  // watching rather than planting once. Mutations are coalesced onto a frame,
  // because the clock and the text decode touch the DOM constantly and this
  // would otherwise be asked on every one of them.
  function plant() {
    BEDS.forEach(([host, cls, side]) => {
      const el = document.querySelector(host);
      if (!el) return;
      if (!cls) {                        // the box is already in the markup
        if (!el.firstChild) { el.setAttribute('aria-hidden', 'true'); fill(el, side); }
        return;
      }
      if (el.querySelector('.' + cls)) return;
      const box = document.createElement('div');
      box.className = cls;
      box.setAttribute('aria-hidden', 'true');
      fill(box, side);
      el.appendChild(box);
    });
  }
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; plant(); });
  }).observe(document.body, { childList: true, subtree: true });

  const btn = document.createElement('button');
  btn.className = 'snd';
  btn.type = 'button';
  fill(btn, 'btn');                        // the same lily, seen head on
  const label = document.createElement('span');
  label.className = 'snd-sr';
  btn.appendChild(label);

  const paint = () => {
    // one class drives the button and every flower in the bed
    document.documentElement.classList.toggle('sound-on', on);
    const t = on ? 'Sound on. Turn sound off.' : 'Sound off. Turn sound on.';
    label.textContent = t;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('title', on ? 'Sound on' : 'Sound off');
    btn.classList.toggle('on', on);
  };
  btn.addEventListener('click', () => {
    on = !on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* private window */ }
    paint();
    if (on) { wake(); S.enter(); }   // the gesture that unlocks audio, and a sample of it
  });
  paint();
  document.body.appendChild(btn);
  plant();
})();
