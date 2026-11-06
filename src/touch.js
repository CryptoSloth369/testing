// Phone / tablet controls: a floating joystick on the left half of the screen,
// drag on the right half to look around, pinch to zoom, and on-screen buttons.

export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;

const RADIUS = 56;        // how far the knob can travel, in CSS pixels
const DEADZONE = 0.15;
const RUN_AT = 0.85;      // push the stick almost to the edge to run

export function createTouchControls({ follow, onSit, onDance, onSound }) {
  if (!IS_TOUCH) return null;
  document.body.classList.add('touch');

  const layer = document.getElementById('touch');
  const base = document.getElementById('stick');
  const knob = document.getElementById('knob');
  const state = { forward: 0, right: 0, mag: 0, active: false };
  const stick = { id: null, ox: 0, oy: 0 };
  const looks = new Map();
  let pinch = 0;

  const showStick = (x, y) => {
    base.style.left = `${x}px`; base.style.top = `${y}px`;
    base.classList.add('on');
    knob.style.transform = 'translate(-50%, -50%)';
  };

  layer.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    layer.setPointerCapture(e.pointerId);
    if (e.clientX < innerWidth * 0.45 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
      showStick(e.clientX, e.clientY);
      document.querySelector('.stick-hint')?.classList.add('used');
      state.active = true;
    } else {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (looks.size === 2) { const [a, b] = [...looks.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    }
  });

  layer.addEventListener('pointermove', (e) => {
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const mag = Math.min(1, d / RADIUS);
      state.mag = mag < DEADZONE ? 0 : mag;
      state.right = state.mag ? dx / RADIUS : 0;
      state.forward = state.mag ? -dy / RADIUS : 0;
      return;
    }
    const p = looks.get(e.pointerId);
    if (!p) return;
    if (looks.size >= 2) {
      p.x = e.clientX; p.y = e.clientY;
      const [a, b] = [...looks.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      follow.zoom((pinch - d) * 0.03);
      pinch = d;
    } else {
      follow.look((e.clientX - p.x) * 1.7, (e.clientY - p.y) * 1.7);
      p.x = e.clientX; p.y = e.clientY;
    }
  });

  const end = (e) => {
    if (e.pointerId === stick.id) {
      stick.id = null;
      Object.assign(state, { forward: 0, right: 0, mag: 0, active: false });
      base.classList.remove('on');
    }
    looks.delete(e.pointerId);
  };
  layer.addEventListener('pointerup', end);
  layer.addEventListener('pointercancel', end);

  const tap = (id, fn) => document.getElementById(id).addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
  tap('btn-sit', onSit);
  tap('btn-dance', onDance);
  tap('btn-sound', () => { document.getElementById('btn-sound').classList.toggle('off', onSound()); });

  const sitBtn = document.getElementById('btn-sit');
  return {
    state,
    get run() { return state.mag >= RUN_AT; },
    // label: 'Sit', 'Stand' or null to hide
    setSit(label) {
      sitBtn.classList.toggle('show', !!label);
      if (label) sitBtn.textContent = label;
    }
  };
}
