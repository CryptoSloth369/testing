// The Dalí desert: sky, ground, sea, cliffs, light, the ledge with its tree and clocks, spider elephants.
import * as THREE from 'three';
import { U, GLSL_NOISE, noise3, fbm3, smoothstep, deform, taperedTube, tripify, std, shadowAll, antsTexture } from './shared.js';
import { makeClock } from './clocks.js';

export const SUN_DIR = new THREE.Vector3(-0.72, 0.3, -0.6).normalize();
export const EYE_DIR = new THREE.Vector3(0.12, 0.42, -1).normalize();
export const SHORE_Z = -72;

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */`
uniform float uTime; uniform float uTrip; uniform vec3 uSunDir; uniform vec3 uEyeDir;
varying vec3 vDir;
${GLSL_NOISE}
vec3 calmSky(vec3 d){
  float h = d.y;
  vec3 horizon = vec3(0.99,0.88,0.60);
  vec3 mid = vec3(0.55,0.74,0.74);
  vec3 top = vec3(0.13,0.33,0.48);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.2, h));
  col = mix(col, top, smoothstep(0.2, 0.75, h));
  // long thin clouds near the horizon
  float az = atan(d.z, d.x);
  float n = snoise(vec3(az*3.0, h*22.0, uTime*0.01)) * 0.6 + snoise(vec3(az*9.0, h*60.0, 2.0)) * 0.4;
  float clouds = smoothstep(0.35, 0.85, n) * smoothstep(0.03, 0.1, h) * smoothstep(0.4, 0.12, h);
  col = mix(col, vec3(1.0,0.96,0.88), clouds * 0.55);
  float sd = max(dot(d, uSunDir), 0.0);
  col += vec3(1.0,0.82,0.52) * (pow(sd, 400.0) * 3.0 + pow(sd, 24.0) * 0.35 + pow(sd, 4.0) * 0.08);
  return col;
}
vec3 tripSky(vec3 d){
  float el = acos(clamp(d.y, -1.0, 1.0));
  float a = atan(d.z, d.x) + uTime*0.05;
  float fa = abs(mod(a*10.0/6.28318, 2.0) - 1.0);
  vec2 kp = vec2(cos(fa*0.6), sin(fa*0.6)) * el * 3.0;
  float n = snoise(vec3(kp*1.6, uTime*0.15));
  float rings = sin(el*32.0 - uTime*2.0 + n*3.0);
  vec3 m = psyPal(el*1.2 + n*0.45 - uTime*0.1 + fa*0.25);
  m *= 0.45 + 0.55*smoothstep(-0.3, 0.8, rings);
  float petals = smoothstep(0.0, 0.08, sin(fa*6.28318 + el*14.0 - uTime*1.3));
  m = mix(m, psyPal(el*2.0 + 0.5 - uTime*0.13), 0.35*petals);
  m += pow(max(snoise(d*90.0 + uTime*0.2), 0.0), 10.0) * 3.0;        // sparkles

  // a giant eye opening over the sea
  vec3 ed = normalize(uEyeDir);
  vec3 ex = normalize(cross(vec3(0.0,1.0,0.0), ed));
  vec3 ey = cross(ed, ex);
  float fwd = dot(d, ed);
  if (fwd > 0.0) {
    vec2 ep = vec2(dot(d, ex), dot(d, ey)) / fwd / 0.3;
    float open = smoothstep(0.55, 1.0, uTrip) * (1.0 - pow(abs(sin(uTime*0.35)), 60.0));
    float lid = 0.55 * open * (1.0 - ep.x*ep.x);
    float inside = step(abs(ep.y), lid) * step(abs(ep.x), 1.0);
    float ir = length(ep);
    float ang = atan(ep.y, ep.x);
    vec3 eye = vec3(0.86,0.8,0.74);
    vec3 iris = psyPal(ir*3.5 - uTime*0.3) * (0.65 + 0.35*sin(ang*48.0 + ir*10.0));
    eye = mix(eye, iris, smoothstep(0.34, 0.32, ir));
    eye = mix(eye, vec3(0.01), smoothstep(0.14, 0.12, ir + 0.02*sin(uTime*2.0)));
    eye += vec3(1.0) * smoothstep(0.05, 0.0, length(ep - vec2(-0.08, 0.08))) * 0.8;
    m = mix(m, eye, inside);
    float edge = smoothstep(0.05, 0.0, abs(abs(ep.y) - lid)) * step(abs(ep.x), 1.0) * open;
    m = mix(m, vec3(0.06,0.0,0.12), edge);
  }
  return m;
}
void main(){
  vec3 d = normalize(vDir);
  vec3 dd = vec3(d.x, abs(d.y), d.z);                 // below the horizon: mirror (seen through the sea)
  vec3 col = calmSky(dd);
  if (uTrip > 0.001) col = mix(col, tripSky(dd), uTrip);
  if (d.y < 0.0) col *= 0.82;
  gl_FragColor = vec4(pow(col, vec3(2.2)), 1.0);
}`;

function makeSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.uTime, uTrip: U.uTrip, uSunDir: { value: SUN_DIR }, uEyeDir: { value: EYE_DIR } }
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 64, 32), mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

// A long eroded headland, rising from left to right.
function rockFormation(len, height, depth, seed) {
  const geo = new THREE.BoxGeometry(len, height, depth, 90, 18, 12).translate(0, height / 2, 0);
  deform(geo, (p) => {
    const u = p.x / len + 0.5, hy = p.y / height;
    const profile = 0.12 + 0.88 * smoothstep(0.0, 0.5, u) * (0.82 + 0.18 * Math.sin(u * 11 + seed));
    const n = fbm3(p.x * 0.06, p.y * 0.12, seed + p.z * 0.05, 4);
    p.y = p.y * profile * (1 + 0.15 * n) + hy * fbm3(p.x * 0.05, seed, 0, 3) * 1.6;
    p.z = p.z * (1 - 0.45 * hy) + fbm3(p.x * 0.09, p.y * 0.15, seed + 7, 3) * 4.5 * (0.4 + hy);
    p.x += fbm3(p.y * 0.2, p.z * 0.1, seed + 3, 3) * 2.5;
  });
  return geo;
}

function makeCliffs(scene) {
  const rockMat = tripify(std(0xc99457, { flatShading: true, roughness: 1 }), { strength: 0.9 });
  const mirrorMat = tripify(std(0x7e6a4c, { flatShading: true, roughness: 1, side: THREE.DoubleSide }), { strength: 0.9 });
  const specs = [
    { len: 130, h: 22, d: 34, x: 95, z: -165, ry: 0.12, seed: 1.3 },
    { len: 70, h: 9, d: 18, x: -120, z: -210, ry: -0.2, seed: 4.1 },
  ];
  for (const s of specs) {
    const geo = rockFormation(s.len, s.h, s.d, s.seed);
    const rock = new THREE.Mesh(geo, rockMat);
    rock.position.set(s.x, -2, s.z); rock.rotation.y = s.ry;
    rock.castShadow = false; rock.receiveShadow = true;
    scene.add(rock);
    const mirror = new THREE.Mesh(geo, mirrorMat);          // fake reflection under the glassy sea
    mirror.position.set(s.x, 2.04, s.z); mirror.rotation.y = s.ry; mirror.scale.y = -1;
    scene.add(mirror);
  }
}

// The ledge from the painting: a dark block holding a dead tree and two clocks.
function makeLedge(scene, clocks, colliders) {
  const g = new THREE.Group();
  g.position.set(17, 0, 4); g.rotation.y = 0.35;
  const W = 7, H = 1.8, D = 3.6;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), tripify(std(0x5e3f22, { roughness: 0.95 })));
  block.position.y = H / 2; g.add(block);

  // a clock sliding off the front edge
  const c1 = makeClock({ r: 1.05, edgeR: 0.55, bend: 0.1, stretch: 1.35, seed: 2 });
  c1.group.position.set(1.4, H + 0.04, D / 2 - 0.55); c1.group.rotation.y = -Math.PI / 2;
  g.add(c1.group); clocks.push(c1);

  // the closed orange watch covered in ants
  const watch = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 40),
    [tripify(std(0xc0601f, { metalness: 0.5, roughness: 0.4 })), tripify(std(0xd8732a, { map: antsTexture(), roughness: 0.5 })), std(0x8a3e12)]);
  watch.position.set(-0.6, H + 0.06, 0.6); g.add(watch);

  // dead tree growing out of the block, its branch bent sideways
  const B = new THREE.Vector3(-2.7, H, -0.9);
  const pts = [[0, 0, 0], [0.15, 1.2, 0], [-0.1, 2.4, 0.05], [0.2, 3.4, 0], [0.9, 4.1, 0.05], [2.2, 4.4, 0.1], [3.6, 4.3, 0.15]]
    .map(([x, y, z]) => new THREE.Vector3(x, y, z).add(B));
  const wood = tripify(std(0x8a7560, { roughness: 1 }), { strength: 0.9 });
  g.add(new THREE.Mesh(taperedTube(pts, (t) => 0.24 * (1 - t) + 0.035, 64, 10), wood));
  const twig = [[0.2, 3.4, 0], [-0.3, 4.1, 0.05], [-0.7, 4.8, 0.1], [-0.6, 5.3, 0.1]].map(([x, y, z]) => new THREE.Vector3(x, y, z).add(B));
  g.add(new THREE.Mesh(taperedTube(twig, (t) => 0.09 * (1 - t) + 0.02, 24, 8), wood));

  // a clock hanging over the branch, one side longer than the other
  const hang = new THREE.Group();
  hang.position.copy(B).add(new THREE.Vector3(2.2, 4.4 + 0.09, 0.1)); hang.rotation.y = Math.PI / 2;
  const c2 = makeClock({ r: 0.75, edgeR: -0.2, edgeL: -0.34, bend: 0.07, stretch: 1.3, seed: 5 });
  c2.group.position.x = 0.27;
  hang.add(c2.group); g.add(hang); clocks.push(c2);

  shadowAll(g);
  scene.add(g);
  colliders.push({ type: 'box', x: g.position.x, z: g.position.z, hw: W / 2, hd: D / 2, rot: g.rotation.y });
}

// Elephants on impossibly long spider legs, wandering the horizon.
function makeElephant(scene) {
  const mat = tripify(std(0x9b8a84, { roughness: 0.8 }), { strength: 1 });
  const dark = tripify(std(0x5a4a44, { roughness: 0.8 }));
  const e = new THREE.Group();
  const legH = 30;
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat); body.scale.set(3.2, 2.4, 5.2); body.position.y = legH + 1; e.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1.7, 24, 16), mat); head.position.set(0, legH + 2.2, 5.6); e.add(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), mat); ear.scale.set(0.25, 1.8, 1.4);
    ear.position.set(sx * 1.6, legH + 2.4, 5.0); ear.rotation.y = sx * 0.4; e.add(ear);
  }
  const trunk = taperedTube([[0, 0, 0], [0, -1.2, 1.2], [0, -3.5, 1.6], [0, -6, 1.2], [0, -7.5, 1.8]].map(([x, y, z]) => new THREE.Vector3(x, y + legH + 1.8, z + 6.6)), (t) => 0.55 - t * 0.35, 32, 8);
  e.add(new THREE.Mesh(trunk, mat));
  // an obelisk carried on a saddle
  const saddle = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.2, 0.6, 24), tripify(std(0xb2342b)));
  saddle.position.y = legH + 3.3; e.add(saddle);
  const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.9, 7, 4), tripify(std(0xd6c7a4)));
  obelisk.position.y = legH + 7; obelisk.rotation.y = Math.PI / 4; e.add(obelisk);
  const legs = [];
  for (const [lx, lz] of [[-1.8, 2.8], [1.8, 2.8], [-1.8, -2.8], [1.8, -2.8]]) {
    const pivot = new THREE.Group(); pivot.position.set(lx, legH + 0.5, lz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.1, legH, 8).translate(0, -legH / 2, 0), dark);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), dark); knee.position.y = -legH * 0.55;
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), dark); foot.position.y = -legH;
    pivot.add(leg, knee, foot); e.add(pivot); legs.push(pivot);
  }
  scene.add(e);
  return { e, legs, body };
}

export function createWorld(scene, renderer) {
  const colliders = [];
  const clocks = [];

  // sky + environment lighting baked from the calm sky
  const sky = makeSky();
  scene.add(sky);
  const envScene = new THREE.Scene();
  envScene.add(makeSky());
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02, 0.1, 1000).texture;
  pmrem.dispose();

  const fogCalm = new THREE.Color(0xe9cf9c);
  scene.fog = new THREE.Fog(fogCalm.clone(), 80, 430);

  const hemi = new THREE.HemisphereLight(0xa8d4da, 0x6b4a2a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd6a0, 3.2);
  sun.position.copy(SUN_DIR).multiplyScalar(140).add(new THREE.Vector3(0, 0, -10));
  sun.target.position.set(0, 0, -10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 320 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const sunCalm = sun.color.clone(), hemiCalm = hemi.color.clone();

  // ground (stops at the shore) and the glassy sea
  const groundDepth = 500;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, groundDepth).rotateX(-Math.PI / 2),
    tripify(std(0xffffff, { roughness: 1 }), { mode: 'ground', strength: 1, glow: 0.1 }));
  ground.position.z = SHORE_Z + groundDepth / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 700).rotateX(-Math.PI / 2),
    tripify(new THREE.MeshStandardMaterial({ color: 0x6f9ea0, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, depthWrite: false }), { strength: 0.6 }));
  sea.position.set(0, 0.02, SHORE_Z - 350);
  sea.renderOrder = 5;
  scene.add(sea);

  makeCliffs(scene);
  makeLedge(scene, clocks, colliders);

  // a few strange stones scattered on the plain
  const stoneMat = tripify(std(0x6e4b2c, { roughness: 1, flatShading: true }));
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = 30 + (i * 37) % 45;
    const geo = deform(new THREE.IcosahedronGeometry(0.5 + (i % 4) * 0.35, 2), (p) => p.multiplyScalar(1 + 0.3 * noise3(p.x * 2, p.y * 2, i)));
    const s = new THREE.Mesh(geo, stoneMat);
    s.position.set(Math.cos(a) * r, 0.1, Math.max(SHORE_Z + 6, Math.sin(a) * r - 10));
    s.scale.y = 0.6;
    s.castShadow = s.receiveShadow = true;
    scene.add(s);
  }

  const elephants = [makeElephant(scene), makeElephant(scene)];
  elephants[0].angle = 2.2; elephants[0].speed = 0.012;
  elephants[1].angle = 3.9; elephants[1].speed = -0.009;

  const tmp = new THREE.Color();
  return {
    colliders,
    update(dt, t, trip, camera) {
      sky.position.copy(camera.position);
      for (const c of clocks) c.update(dt, trip);

      // light & fog drift through hue while tripping
      tmp.setHSL((t * 0.05) % 1, 0.8, 0.6);
      sun.color.copy(sunCalm).lerp(tmp, trip * 0.6);
      tmp.setHSL((t * 0.05 + 0.5) % 1, 0.7, 0.55);
      hemi.color.copy(hemiCalm).lerp(tmp, trip * 0.6);
      tmp.setHSL((t * 0.04 + 0.75) % 1, 0.6, 0.45);
      scene.fog.color.copy(fogCalm).lerp(tmp, trip);

      for (const el of elephants) {
        el.angle += el.speed * dt * (1 + trip * 1.5);
        const R = 175;
        el.e.position.set(Math.cos(el.angle) * R, 0, Math.sin(el.angle) * R - 20);
        el.e.rotation.y = -el.angle + (el.speed > 0 ? 0 : Math.PI);
        const ph = t * 1.1;
        el.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.09; });
        el.body.position.y = 31 + Math.sin(ph * 2) * 0.25;
      }
    }
  };
}
