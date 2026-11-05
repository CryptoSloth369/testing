// Melting clocks: a flat clock built from subdivided parts, then bent with a drape function.
import * as THREE from 'three';
import { noise3, smoothstep, deform, tripify, clockFaceTexture, handTexture } from './shared.js';

const goldMat = tripify(new THREE.MeshStandardMaterial({ color: 0xc49a45, metalness: 0.75, roughness: 0.35 }), { strength: 0.8 });
const backMat = tripify(new THREE.MeshStandardMaterial({ color: 0x9c7a3a, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }), { strength: 0.8 });
let faceMat;

/**
 * Returns a function that bends a point of a flat clock (lying in XZ, thickness along Y).
 *  edgeR / edgeL: x where the clock starts bending down over an edge (right / left), or null
 *  bend: radius of the bend, stretch: how much the hanging part elongates
 *  melt: elongates the +z half (for clocks hung on walls), sag: surface wobble
 */
export function drapeFn({ r, edgeR = null, edgeL = null, bend = 0.12, stretch = 1.25, melt = 0, meltStart = 0, sag = 0.02, seed = 0 }) {
  return (p) => {
    let { x, y, z } = p;
    y += sag * noise3(x * 1.7 / r + seed, z * 1.7 / r, seed);

    if (melt > 0 && z > meltStart) {
      const d = z - meltStart;
      z += d * d * melt;
      x *= 1 - 0.35 * smoothstep(0, r * 1.6, d);
      x += Math.sin(d * 3 / r + seed) * 0.08 * d;
    }

    let side = 0, s = 0, edge = 0;
    if (edgeR !== null && x > edgeR) { side = 1; s = x - edgeR; edge = edgeR; }
    else if (edgeL !== null && x < edgeL) { side = -1; s = edgeL - x; edge = edgeL; }
    if (side) {
      s *= stretch;
      const R = bend, rr = R + y, th = s / R;
      let nx, ny;
      if (th <= Math.PI / 2) { nx = rr * Math.sin(th); ny = -R + rr * Math.cos(th); }
      else {
        const extra = s - (R * Math.PI) / 2;
        nx = rr + extra * 0.06; ny = -R - extra;
        z *= 1 - 0.32 * smoothstep(0, r * 1.1, extra);   // drip narrows as it hangs
        z += Math.sin(extra * 4 / r + seed) * 0.04 * extra;
      }
      x = edge + side * nx; y = ny;
    }
    p.set(x, y, z);
  };
}

/** Build a melting clock. Returns { group, update(dt, trip) }. */
export function makeClock({ r = 1, t = 0.08, speed = 1, ...drape }) {
  if (!faceMat) {
    faceMat = tripify(new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.55, side: THREE.DoubleSide }), { strength: 0.45 });
  }
  const fn = drapeFn({ r, ...drape });
  const group = new THREE.Group();

  const faceGeo = () => new THREE.RingGeometry(0.0001, r, 72, 26).rotateX(-Math.PI / 2);
  const face = deform(faceGeo().translate(0, t / 2, 0), fn);
  const back = deform(new THREE.RingGeometry(0.0001, r, 72, 26).rotateX(Math.PI / 2).translate(0, -t / 2, 0), fn);
  const rim = deform(new THREE.CylinderGeometry(r, r, t, 96, 2, true), fn);
  const bezel = deform(new THREE.TorusGeometry(r, t * 0.55, 8, 96).rotateX(Math.PI / 2).translate(0, t / 2, 0), fn);

  group.add(new THREE.Mesh(face, faceMat));
  group.add(new THREE.Mesh(back, backMat));
  group.add(new THREE.Mesh(rim, goldMat));
  group.add(new THREE.Mesh(bezel, goldMat));

  // Hands: same bent geometry, a rotating transparent texture each.
  const hands = ['hour', 'minute'].map((kind, i) => {
    const map = handTexture(kind);
    const m = new THREE.MeshStandardMaterial({
      map, transparent: true, alphaTest: 0.5, roughness: 0.6,
      polygonOffset: true, polygonOffsetFactor: -2 - i, polygonOffsetUnits: -2 - i, side: THREE.DoubleSide
    });
    group.add(new THREE.Mesh(deform(faceGeo().translate(0, t / 2 + 0.002, 0), fn), m));
    map.rotation = Math.random() * Math.PI * 2;
    return { map, rate: kind === 'hour' ? 0.04 : 0.5 };
  });

  group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.children.slice(4).forEach((m) => (m.castShadow = false));

  return {
    group,
    update(dt, trip) {
      // Time runs backwards, and much faster while tripping.
      for (const h of hands) h.map.rotation += dt * h.rate * speed * (1 + trip * 10);
    }
  };
}
