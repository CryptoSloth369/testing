// The three buildings (Drawer Tower, Clock House, Flesh Bloom) and the melting bench.
import * as THREE from 'three';
import { noise3, fbm3, smoothstep, deform, taperedTube, tripify, std, shadowAll } from './shared.js';
import { makeClock, drapeFn } from './clocks.js';

export const PLAYER_SCALE = 0.5;
export const SEAT_H = 0.74 * PLAYER_SCALE;      // matches the robot's "Sitting" pose
const SIT_BACK = 0.66 * PLAYER_SCALE;           // the pose shifts the body this far back

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const facing = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const BENCH_POS = V(0, 0, -16);

function vertexColors(geo, fn) {
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color(), p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); fn(p, c); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// A Dalí crutch: pole, fork and curved pad. Height = top of pad.
const crutchMat = tripify(std(0xb89a66, { roughness: 0.7 }));
function makeCrutch(h, scale = 1) {
  const g = new THREE.Group(), r = 0.07 * scale, fork = 0.9 * scale;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.2, h - fork, 8).translate(0, (h - fork) / 2, 0), crutchMat);
  g.add(pole);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(taperedTube([V(0, h - fork, 0), V(s * 0.22 * scale, h - fork * 0.5, 0), V(s * 0.3 * scale, h - 0.12 * scale, 0)], () => r * 0.8, 10, 6), crutchMat);
    g.add(arm);
  }
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.42 * scale, 0.07 * scale, 6, 16, Math.PI * 0.55).rotateZ(Math.PI * 1.225), crutchMat);
  pad.position.y = h + 0.3 * scale; g.add(pad);
  return shadowAll(g);
}

// ---------------------------------------------------------------- Drawer Tower
function drawerTower(scene, ctx) {
  const g = new THREE.Group();
  g.position.set(-22, 0, -30);
  g.rotation.y = facing(g.position, BENCH_POS);

  const prof = [[0, 0], [4.3, 0], [4.0, 0.8], [3.4, 2.5], [2.9, 4.5], [2.4, 6.5], [2.0, 8.0], [2.3, 9.5], [2.7, 10.8], [2.3, 12.0],
    [1.4, 13.0], [1.0, 13.8], [1.1, 14.6], [1.6, 15.4], [1.4, 16.4], [0.7, 17.0], [0.0, 17.2]].map(([r, y]) => new THREE.Vector2(r, y));
  const curve = new THREE.SplineCurve(prof);
  const pts = curve.getPoints(90);
  const radiusAt = (h) => { let best = pts[0]; for (const p of pts) if (Math.abs(p.y - h) < Math.abs(best.y - h)) best = p; return best.x; };
  const sway = (y) => Math.sin(y * 0.28) * 0.55;
  const lean = (y) => 0.0035 * y * y;

  const body = deform(new THREE.LatheGeometry(pts, 72), (p) => {
    const ang = Math.atan2(p.z, p.x), rr = Math.hypot(p.x, p.z);
    const n = fbm3(Math.cos(ang) * 1.2, p.y * 0.18, Math.sin(ang) * 1.2, 3);
    const r2 = rr * (1 + 0.12 * n);
    p.set(Math.cos(ang) * r2 + sway(p.y), p.y, Math.sin(ang) * r2 - lean(p.y));
  });
  const ca = new THREE.Color(0x3c6b5e), cb = new THREE.Color(0x9cc2a9), cs = new THREE.Color(0x4f79a8);
  vertexColors(body, (p, c) => {
    const n = noise3(p.x * 0.4, p.y * 0.35, p.z * 0.4) * 0.5 + 0.5;
    c.copy(ca).lerp(cb, n);
    const streak = Math.max(0, Math.sin(p.y * 1.7 + noise3(p.x, p.y * 0.2, p.z) * 4));
    c.lerp(cs, streak * streak * 0.35);
  });
  g.add(new THREE.Mesh(body, tripify(std(0xffffff, { vertexColors: true, roughness: 0.7 }))));

  // drawers sliding in and out of the body
  const trayMat = tripify(std(0xd9902f, { roughness: 0.6 })), panelMat = tripify(std(0xe8ac45, { roughness: 0.5 }));
  const darkMat = std(0x140c08, { roughness: 1 }), knobMat = std(0x6b3b12, { metalness: 0.4, roughness: 0.4 });
  const drawers = [];
  [2.6, 4.2, 5.8, 7.3, 8.8, 10.2, 11.5].forEach((h, i) => {
    const R = radiusAt(h), xo = (i % 2 ? 0.35 : -0.35);
    const dg = new THREE.Group();
    dg.position.set(sway(h) + xo, h, R - lean(h));
    dg.rotation.y = xo * 0.25;
    const cavity = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.78, 0.6), darkMat); cavity.position.z = -0.2;
    const tray = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.62, 1.6), trayMat); box.position.z = -0.75;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.76, 0.08), panelMat);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), knobMat); knob.position.z = 0.07;
    tray.add(box, panel, knob);
    dg.add(cavity, tray); g.add(dg);
    drawers.push({ tray, phase: i * 1.7 });
  });

  // soft arms propped up by crutches, and a soft tongue trailing behind
  const flesh = tripify(std(0x7fa592, { roughness: 0.65 }));
  const limbs = [
    { p: [[1.5, 12.4, 0], [4, 12.9, 0.4], [6.5, 12.3, 0.8], [9, 11.4, 1.0], [10.6, 11.8, 1.0]], r: [0.85, 0.35], crutch: [6.5, 12.3 - 0.55, 0.8] },
    { p: [[-1.5, 11.8, 0], [-3.6, 11.0, -0.3], [-5.6, 9.2, -0.6], [-6.6, 7.0, -0.8], [-7.0, 5.0, -0.6]], r: [0.8, 0.3], crutch: [-5.6, 9.2 - 0.5, -0.6] },
    { p: [[0, 4.5, -2.4], [0, 4.2, -5], [0.3, 3.6, -7.5], [0.5, 3.5, -9.2]], r: [1.0, 0.45], crutch: [0.3, 3.6 - 0.7, -7.5] },
  ];
  for (const L of limbs) {
    const pts3 = L.p.map(([x, y, z]) => V(x + sway(y), y, z - lean(y)));
    g.add(new THREE.Mesh(taperedTube(pts3, (t) => L.r[0] + (L.r[1] - L.r[0]) * t, 48, 12), flesh));
    const end = new THREE.Mesh(new THREE.SphereGeometry(L.r[1] * 1.5, 16, 12), flesh); end.position.copy(pts3[pts3.length - 1]); g.add(end);
    const [cx, cy, cz] = L.crutch;
    const cr = makeCrutch(cy - 0.3); cr.position.set(cx + sway(cy), 0, cz - lean(cy)); g.add(cr);
    ctx.circleLocal(g, cr.position, 0.35);
  }

  // a dark doorway, and a burning head on top
  const door = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), std(0x0a0503, { emissive: 0x401505, emissiveIntensity: 0.6 }));
  door.scale.set(1.0, 1.7, 0.7); door.position.set(sway(1.2), 1.2, radiusAt(1.2) - 0.35); g.add(door);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.0, 24, 16), tripify(std(0xc0392b, { emissive: 0x5a1205, roughness: 0.5 })));
  head.position.set(sway(17.2), 17.6, -lean(17.2)); g.add(head);
  const flames = [];
  const flameMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff5a00, emissiveIntensity: 2.2, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 8).translate(0, 0.8, 0), flameMat);
    const a = (i / 6) * Math.PI * 2;
    f.position.copy(head.position).add(V(Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.5));
    f.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(f); flames.push(f);
  }

  shadowAll(g);
  flames.forEach((f) => (f.castShadow = false));
  scene.add(g);
  ctx.colliders.push({ type: 'circle', x: g.position.x, z: g.position.z, r: 4.5 });
  ctx.eyesLocal(g, [V(1.6, 14.2, 0.9), V(-1.4, 9.5, 1.6), V(2.4, 6.0, 2.2), V(-2.8, 3.5, 2.5), V(0, 15.6, 1.4)]);

  const base = g.scale.clone();
  return (dt, t, trip) => {
    drawers.forEach((d) => { d.tray.position.z = 0.15 + (0.5 + 0.5 * Math.sin(t * (0.6 + trip * 1.5) + d.phase)) * (0.9 + trip * 1.2); });
    flames.forEach((f, i) => { f.scale.y = 0.8 + 0.35 * Math.sin(t * 9 + i * 2.1) + 0.2 * Math.sin(t * 23 + i); });
    const b = 1 + trip * 0.03 * Math.sin(t * 1.3);
    g.scale.set(base.x * b, base.y * (2 - b), base.z * b);
  };
}

// ---------------------------------------------------------------- Clock House
function clockHouse(scene, ctx) {
  const g = new THREE.Group();
  g.position.set(25, 0, -28);
  g.rotation.y = facing(g.position, BENCH_POS);
  const W = 10, H = 8, D = 8;
  const leanAt = (y) => Math.sin(y * 0.45) * 0.25 + (y / H) * (y / H) * 0.6;

  const walls = deform(new THREE.BoxGeometry(W, H, D, 30, 24, 24).translate(0, H / 2, 0), (p) => {
    const hy = p.y / H, bulge = 1 + 0.06 * Math.sin(Math.PI * hy);
    p.x = p.x * bulge + leanAt(p.y); p.z *= bulge;
  });
  const wa = new THREE.Color(0xcfa66c), wb = new THREE.Color(0xf0d7a6), wd = new THREE.Color(0x8c6438);
  vertexColors(walls, (p, c) => {
    c.copy(wa).lerp(wb, noise3(p.x * 0.3, p.y * 0.3, p.z * 0.3) * 0.5 + 0.5);
    c.lerp(wd, (1 - smoothstep(0, 2.5, p.y)) * 0.6);
  });
  g.add(new THREE.Mesh(walls, tripify(std(0xffffff, { vertexColors: true, roughness: 0.9 }))));

  // the roof slab melts over the walls in long drips
  const l8 = leanAt(H);
  const roof = deform(new THREE.BoxGeometry(W + 2.4, 0.7, D + 2.4, 64, 2, 54).translate(l8, H + 0.3, 0), (p) => {
    const dx = Math.abs(p.x - l8) - W / 2, dz = Math.abs(p.z) - D / 2;
    const dOut = Math.max(dx, dz, 0);
    const alongX = dx > dz;
    const along = alongX ? p.z : p.x, sideSeed = alongX ? (p.x > l8 ? 1 : 2) : (p.z > 0 ? 3 : 4);
    const drip = Math.pow(Math.max(0, noise3(along * 0.8, sideSeed * 7.1, 0) * 1.4 + 0.15), 3) * 3.4;
    p.y -= dOut * dOut * 0.9 + drip * smoothstep(0.1, 0.9, dOut);
    p.y -= 0.25 * Math.max(0, 1 - Math.hypot((p.x - l8) / 5, p.z / 4));
  });
  g.add(new THREE.Mesh(roof, tripify(std(0xb5532f, { roughness: 0.8 }))));

  // a chimney that has gone soft
  const chim = taperedTube([V(2.5 + l8, H, -1.5), V(2.6 + l8, H + 2.4, -1.5), V(3.4 + l8, H + 3.8, -1.0), V(4.6 + l8, H + 4.0, -0.6), V(5.4 + l8, H + 3.0, -0.4)], (t) => 0.55 - t * 0.2, 40, 12);
  g.add(new THREE.Mesh(chim, tripify(std(0x8e3b24, { roughness: 0.9 }))));

  // door & glowing windows on the front (+z) face
  const dark = std(0x1a0f08, { roughness: 1 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.8, 0.2), dark); door.position.set(-3 + leanAt(1.4), 1.4, D / 2 + 0.12); g.add(door);
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 24, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2), dark);
  arch.position.set(-3 + leanAt(2.8), 2.8, D / 2 + 0.12); g.add(arch);
  const winMat = new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffb347, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  for (const [x, y] of [[3.2, 2.4], [-3.0, 5.8], [3.4, 6.2]]) {
    const geo = deform(new THREE.PlaneGeometry(1.3, 1.5, 12, 12), (p) => { if (p.y < 0) p.y -= (0.5 + 0.5 * Math.sin(p.x * 6 + x)) * 0.35 * -p.y; });
    const w = new THREE.Mesh(geo, winMat); w.position.set(x + leanAt(y), y, D / 2 + 0.3); g.add(w);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.25), dark); frame.position.set(x + leanAt(y), y + 0.8, D / 2 + 0.3); g.add(frame);
  }

  // a big clock on the wall, melting downward, and clocks sliding off the roof
  const clocks = [];
  const wc = makeClock({ r: 1.5, t: 0.12, melt: 0.35, meltStart: 0.1, seed: 3, speed: 0.6 });
  wc.group.rotation.x = Math.PI / 2; wc.group.position.set(0.6 + leanAt(5), 5.0, D / 2 + 0.36);
  g.add(wc.group); clocks.push(wc);
  const rc1 = makeClock({ r: 1.0, edgeR: 0.6, bend: 0.16, stretch: 1.5, seed: 7 });
  rc1.group.position.set(3.3 + l8, H + 0.66, D / 2 - 0.6); rc1.group.rotation.y = -Math.PI / 2;
  g.add(rc1.group); clocks.push(rc1);
  const rc2 = makeClock({ r: 0.9, edgeR: 0.5, bend: 0.16, stretch: 1.5, seed: 9, speed: 1.6 });
  rc2.group.position.set(-W / 2 + 0.5 + l8, H + 0.66, -1.0); rc2.group.rotation.y = Math.PI;
  g.add(rc2.group); clocks.push(rc2);

  shadowAll(g);
  scene.add(g);
  ctx.colliders.push({ type: 'box', x: g.position.x, z: g.position.z, hw: W / 2 + 0.7, hd: D / 2 + 0.7, rot: g.rotation.y });
  ctx.eyesLocal(g, [V(-1.5, 7.0, D / 2 + 0.6), V(W / 2 + 1.2, 4.5, 1.5), V(2.0, H + 1.6, 1.0), V(-W / 2 - 0.4, 3.5, -1.5)]);

  return (dt, t, trip) => {
    clocks.forEach((c) => c.update(dt, trip));
    winMat.emissiveIntensity = 0.9 + trip * (1.5 + Math.sin(t * 4));
  };
}

// ---------------------------------------------------------------- Flesh Bloom
function fleshBloom(scene, ctx) {
  const g = new THREE.Group();
  g.position.set(-32, 0, 6);
  g.rotation.y = facing(g.position, V(0, 0, -3));
  const swirl = tripify(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.3 }), { mode: 'swirl', strength: 0.9 });

  const stalkProf = [[0, 0], [2.6, 0], [2.2, 0.6], [1.5, 2.0], [1.4, 3.2], [1.8, 4.4], [2.6, 5.4], [0, 5.8]].map(([r, y]) => new THREE.Vector2(r, y));
  const stalk = deform(new THREE.LatheGeometry(new THREE.SplineCurve(stalkProf).getPoints(40), 48), (p) => {
    p.x += Math.sin(p.y * 0.8) * 0.25; p.multiplyScalar(1 + 0.08 * noise3(p.x, p.y, p.z));
  });
  g.add(new THREE.Mesh(stalk, swirl));

  // the blob: a lumpy sphere of swirling pastel paint
  const lumps = [];
  for (let i = 0; i < 9; i++) {
    const a = i * 2.39996, y = 1 - (i / 8) * 1.6;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    lumps.push({ d: V(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize(), amp: 0.5 + (i % 3) * 0.45, k: 6 + (i % 4) * 3 });
  }
  const C = V(0, 10, 0), BASE_R = 5;
  const radius = (d) => {
    let r = BASE_R * (1 + 0.2 * fbm3(d.x * 1.4, d.y * 1.4, d.z * 1.4, 4) + 0.08 * fbm3(d.x * 3.3 + 5, d.y * 3.3, d.z * 3.3, 3));
    for (const L of lumps) r += L.amp * Math.exp(-(1 - d.dot(L.d)) * L.k);
    return r;
  };
  const surf = (d) => d.clone().multiplyScalar(radius(d)).multiply(V(1, 1.12, 1)).add(C);
  const blob = deform(new THREE.SphereGeometry(1, 180, 120), (p) => { const d = p.clone().normalize(); p.copy(surf(d)); });
  const blobMesh = new THREE.Mesh(blob, swirl);
  g.add(blobMesh);

  // the mouth/doorway: a dark hole glowing deep red
  const md = V(0, -0.15, 1).normalize();
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), std(0x050102, { emissive: 0x600010, emissiveIntensity: 0.8 }));
  mouth.scale.set(1.1, 1.4, 0.8); mouth.position.copy(surf(md)).addScaledVector(md, -0.35); g.add(mouth);

  // tendrils ending in little flowers, plus two spiral horns
  const tendrils = [];
  const bulbCols = [0xd8323c, 0xe05a8a, 0x6fb7e0, 0xf2d14b, 0x9b6bd8];
  const stemMat = tripify(std(0x5a2d2d, { roughness: 0.6 }));
  for (let i = 0; i < 11; i++) {
    const a = i * 1.7 + 0.4, y = 0.85 - (i % 6) * 0.28;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const d = V(Math.cos(a) * rr, y, Math.sin(a) * rr).normalize();
    const start = surf(d).addScaledVector(d, -0.2);
    const pivot = new THREE.Group(); pivot.position.copy(start);
    const side = V(-d.z, 0, d.x).normalize();
    const len = 2.2 + (i % 3) * 1.1;
    const pts = [V(0, 0, 0), d.clone().multiplyScalar(len * 0.4).addScaledVector(side, 0.4), d.clone().multiplyScalar(len * 0.75).add(V(0, 0.6, 0)), d.clone().multiplyScalar(len).addScaledVector(side, -0.5).add(V(0, 0.9, 0))];
    pivot.add(new THREE.Mesh(taperedTube(pts, (t) => 0.11 - t * 0.07, 24, 6), stemMat));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (i % 2) * 0.12, 14, 10), tripify(std(bulbCols[i % 5], { roughness: 0.4, emissive: bulbCols[i % 5], emissiveIntensity: 0.15 })));
    bulb.position.copy(pts[3]); bulb.scale.y = 0.8; pivot.add(bulb);
    g.add(pivot); tendrils.push({ pivot, phase: i * 0.9 });
  }
  for (const s of [-1, 1]) {
    const d = V(s * 0.75, 0.6, -0.2).normalize(), o = surf(d).addScaledVector(d, -0.6);
    const side = V(-d.z, 0, d.x).normalize(), up = new THREE.Vector3().crossVectors(d, side).normalize();
    const pts = [];
    for (let k = 0; k <= 24; k++) {
      const f = k / 24, ang = f * Math.PI * 3.5 * s, rad = 1.3 * (1 - f * 0.8);
      pts.push(o.clone().addScaledVector(d, f * 3.2).addScaledVector(side, Math.cos(ang) * rad).addScaledVector(up, Math.sin(ang) * rad));
    }
    g.add(new THREE.Mesh(taperedTube(pts, (t) => 0.75 * (1 - t) + 0.08, 80, 12), swirl));
  }

  shadowAll(g);
  scene.add(g);
  ctx.colliders.push({ type: 'circle', x: g.position.x, z: g.position.z, r: 2.9 });
  ctx.eyesLocal(g, [surf(V(0.6, 0.3, 0.75).normalize()), surf(V(-0.7, 0.1, 0.7).normalize()), surf(V(0.1, 0.8, 0.5).normalize()), surf(V(0.9, -0.2, -0.3).normalize()), surf(V(-0.5, 0.5, -0.7).normalize())]);

  return (dt, t, trip) => {
    const b = 1 + (0.025 + trip * 0.06) * Math.sin(t * (0.8 + trip));
    blobMesh.scale.setScalar(b);
    blobMesh.position.copy(C).multiplyScalar(1 - b);   // breathe around the blob centre
    tendrils.forEach((td) => {
      td.pivot.rotation.x = Math.sin(t * 0.9 + td.phase) * (0.08 + trip * 0.2);
      td.pivot.rotation.z = Math.cos(t * 0.7 + td.phase) * (0.08 + trip * 0.2);
    });
  };
}

// ---------------------------------------------------------------- Bench
function bench(scene, ctx) {
  const g = new THREE.Group();
  g.position.copy(BENCH_POS);         // sitter faces -z, toward the sea
  const wood = tripify(std(0x8b5a33, { roughness: 0.75 }));
  const L = 2.4, Dp = 0.55;

  const seat = deform(new THREE.BoxGeometry(L, 0.07, Dp, 70, 2, 14), drapeFn({ r: Dp, edgeL: -0.7, bend: 0.06, stretch: 1.7, sag: 0.006, seed: 1 }));
  const seatM = new THREE.Mesh(seat, wood); seatM.position.y = SEAT_H - 0.035; g.add(seatM);

  const back = deform(new THREE.BoxGeometry(L, 0.42, 0.05, 70, 14, 2), (p) => {
    if (p.x < -0.35) { const d = -0.35 - p.x; p.y -= d * d * 0.9; p.z += Math.sin(d * 7) * 0.03; }
    p.y += Math.sin(p.x * 4) * 0.012;
  });
  const backM = new THREE.Mesh(back, wood); backM.position.set(0, SEAT_H + 0.34, 0.27); backM.rotation.x = -0.12; g.add(backM);

  for (const x of [1.05, 0.0]) {
    for (const z of [-0.2, 0.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, SEAT_H, 0.06), wood); leg.position.set(x, SEAT_H / 2, z); g.add(leg); }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.05), wood); post.position.set(x, SEAT_H + 0.2, 0.26); g.add(post);
  }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.5), wood); arm.position.set(1.18, SEAT_H + 0.11, 0); g.add(arm);
  const cr = makeCrutch(SEAT_H - 0.08, 0.3); cr.position.set(-0.62, 0, 0); g.add(cr);

  const c = makeClock({ r: 0.22, t: 0.03, edgeL: -0.03, edgeR: 0.03, bend: 0.02, stretch: 1.4, seed: 4 });
  c.group.position.set(1.18, SEAT_H + 0.235, 0.02); g.add(c.group);

  shadowAll(g);
  scene.add(g);
  ctx.colliders.push({ type: 'box', x: g.position.x, z: g.position.z, hw: L / 2 + 0.05, hd: 0.36, rot: 0, bench: true });

  const seatPoint = g.localToWorld(V(0.25, SEAT_H, 0.0));
  return {
    update: (dt) => c.update(dt, 0),
    info: {
      seat: seatPoint,
      sitPos: seatPoint.clone().setY(0).add(V(0, 0, -SIT_BACK)),   // robot origin when seated
      sitRot: Math.PI                                              // facing -z
    }
  };
}

export function createBuildings(scene) {
  const colliders = [];
  const eyeAnchors = [];
  const ctx = {
    colliders,
    circleLocal(group, local, r) {
      group.updateMatrixWorld(true);
      const w = group.localToWorld(local.clone());
      colliders.push({ type: 'circle', x: w.x, z: w.z, r });
    },
    eyesLocal(group, locals) {
      group.updateMatrixWorld(true);
      for (const l of locals) eyeAnchors.push(group.localToWorld(l.clone()));
    }
  };
  const updaters = [drawerTower(scene, ctx), clockHouse(scene, ctx), fleshBloom(scene, ctx)];
  const b = bench(scene, ctx);
  updaters.push(b.update);
  return {
    colliders, eyeAnchors, bench: b.info,
    update(dt, t, trip) { for (const u of updaters) u(dt, t, trip); }
  };
}
