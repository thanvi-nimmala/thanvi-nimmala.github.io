// Makes the hero bust a turntable you can grab and spin.
//
// The 60 ASCII frames in bust.js are a real 360° photographic rotation, so
// mapping pointer movement to frame index gives genuine 3D scrubbing rather
// than a simulated effect. Idle -> drifts on its own; drag -> you steer it;
// release -> spins on with inertia, then hands back to the drift.
(() => {
  'use strict';
  if (window.__bustCtlInit) return;   // the runtime executes helmet scripts twice
  window.__bustCtlInit = true;

  const DRIFT = 1;        // frames advanced per tick when idle
  const SENS = 0.22;      // frames per pixel dragged (~270px = one full turn)
  const FRICTION = 0.93;  // inertia decay after release

  const st = { angle: 0, vel: 0, dir: 1, dragging: false, lastX: 0 };
  window.__bust = st;

  // called by field(t) in the page component, once per animation tick
  window.bustFrame = function () {
    const F = window.BUST_FRAMES;
    if (!F || !F.length) return '';
    if (!st.dragging) {
      if (Math.abs(st.vel) > DRIFT) {
        // still coasting faster than the idle drift
        st.angle += st.vel;
        st.vel *= FRICTION;
      } else {
        // coast has decayed to drift speed, so the hand-off is seamless;
        // keep spinning whichever way it was last pushed
        st.vel = 0;
        st.angle += DRIFT * st.dir;
      }
    }
    const n = F.length;
    return F[((Math.round(st.angle) % n) + n) % n];
  };

  const target = (e) => e.target && e.target.closest && e.target.closest('[data-bust]');

  document.addEventListener('pointerdown', (e) => {
    const el = target(e);
    if (!el) return;
    st.dragging = true; st.vel = 0; st.lastX = e.clientX;
    el.setPointerCapture && el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
    e.preventDefault();
  });

  document.addEventListener('pointermove', (e) => {
    if (!st.dragging) return;
    const dx = e.clientX - st.lastX;
    st.lastX = e.clientX;
    st.angle += dx * SENS;
    st.vel = dx * SENS;          // carried into the release
    if (dx) st.dir = dx > 0 ? 1 : -1;
  });

  const end = (e) => {
    if (!st.dragging) return;
    st.dragging = false;
    const el = target(e) || document.querySelector('[data-bust]');
    if (el) el.style.cursor = 'grab';
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', end);
})();
