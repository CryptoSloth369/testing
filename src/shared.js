// Shared uniforms, noise, shader chunks and geometry helpers.
import * as THREE from 'three';

// Global uniforms shared by every "tripified" material.
export const U = {
  uTime: { value: 0 },
  uTrip: { value: 0 },                       // 0 = calm Dalí desert, 1 = full trip
  uCenter: { value: new THREE.Vector2(0, 0) } // where the trip wave starts (the bench)
};

// ---------- JS noise (value noise, good enough for shaping geometry) ----------
function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
export function noise3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(ix + dx, iy + dy, iz + dz);
  const v = lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), ux), lerp(c(0, 1, 0), c(1, 1, 0), ux), uy),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), ux), lerp(c(0, 1, 1), c(1, 1, 1), ux), uy),
    uz
  );
  return v * 2 - 1;
}
export function fbm3(x, y, z, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise3(x * f, y * f, z * f); f *= 2.03; a *= 0.5; }
  return s;
}
export const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- GLSL chunks ----------
export const GLSL_NOISE = /* glsl */`
vec3 sn_mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 sn_mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 sn_permute(vec4 x){return sn_mod289(((x*34.0)+1.0)*x);}
vec4 sn_tis(vec4 r){return 1.79284291400159 - 0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = sn_mod289(i);
  vec4 p = sn_permute(sn_permute(sn_permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = sn_tis(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
vec3 psyPal(float t){ return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0, 0.33, 0.67))); }
`;

// ---------- "Tripify": patch a standard material so it reacts to uTrip ----------
// mode: 'surface' (rainbow bands), 'swirl' (pastel paint swirl), 'ground' (mandala floor)
// strength: how strongly the trip recolours it. calm: iridescent rim even when calm.
export function tripify(mat, { mode = 'surface', strength = 1, calm = 0, glow = 0.15 } = {}) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.uniforms.uTrip = U.uTrip;
    sh.uniforms.uCenter = U.uCenter;
    sh.uniforms.uStrength = { value: strength };
    sh.uniforms.uCalm = { value: calm };
    sh.uniforms.uGlow = { value: glow };

    sh.vertexShader = 'varying vec3 vTripW;\nvarying vec3 vTripO;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vTripO = transformed;
       vTripW = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    let colorCode = '';
    if (mode === 'swirl') {
      colorCode = `
        vec3 sp = vTripO * 0.13;
        vec3 sq = vec3(snoise(sp + uTime*0.02), snoise(sp + vec3(5.2,1.3,2.1) - uTime*0.017), snoise(sp + vec3(1.7,9.2,3.3)));
        vec3 sr = vec3(snoise(sp*1.7 + sq*1.5 + vec3(3.1)), snoise(sp*1.7 + sq*1.5 + vec3(8.4)), 0.0);
        float sn = snoise(sp*1.2 + vec3(sr.xy, 0.0)*1.4 + sq*0.8);
        float streak = sin(sn*38.0 + sr.x*9.0);
        float st = fract(sn*0.8 + sq.y*0.6 + 0.5);
        vec3 c1 = vec3(0.98,0.92,0.84), c2 = vec3(0.96,0.55,0.68), c3 = vec3(0.66,0.58,0.95);
        vec3 c4 = vec3(1.0,0.86,0.45), c5 = vec3(0.45,0.78,0.95), c6 = vec3(0.88,0.25,0.35);
        vec3 scol = mix(c1, c2, smoothstep(0.05,0.2,st));
        scol = mix(scol, c3, smoothstep(0.22,0.36,st));
        scol = mix(scol, c4, smoothstep(0.4,0.52,st));
        scol = mix(scol, c6, smoothstep(0.55,0.6,st) * (1.0 - smoothstep(0.62,0.68,st)));
        scol = mix(scol, c5, smoothstep(0.66,0.78,st));
        scol = mix(scol, c1, smoothstep(0.84,0.98,st));
        scol *= 0.86 + 0.14*streak;
        diffuseColor.rgb = pow(scol, vec3(2.2));
      `;
    } else if (mode === 'ground') {
      colorCode = `
        vec2 gp = vTripW.xz;
        float gn = snoise(vec3(gp*0.045, 0.0))*0.5 + snoise(vec3(gp*0.35, 1.0))*0.12 + snoise(vec3(gp*2.5, 3.0))*0.05;
        vec3 sandA = vec3(0.42,0.28,0.15), sandB = vec3(0.74,0.55,0.32);
        float far = smoothstep(20.0, 90.0, length(gp - vec2(0.0,-10.0)));
        vec3 gcol = mix(sandA, sandB, clamp(gn*0.6 + 0.5 + far*0.25, 0.0, 1.0));
        diffuseColor.rgb = pow(gcol, vec3(2.2));
      `;
    }

    const tripCode = mode === 'ground' ? `
        vec2 gd = vTripW.xz - uCenter;
        float gr = length(gd);
        float ga = atan(gd.y, gd.x + 1e-4) + uTime*0.04;
        float gfa = abs(mod(ga*12.0/6.28318, 2.0) - 1.0);
        float gpat = sin(gr*1.1 - uTime*2.5 + gfa*5.0) * cos(gfa*7.0 + gr*0.35 - uTime*0.8);
        float chk = step(0.0, sin(gr*2.0 - uTime*1.5) * sin(gfa*9.42));
        tripPsy = psyPal(gr*0.025 + gpat*0.18 - uTime*0.18 + gfa*0.25);
        tripPsy *= 0.45 + 0.4*smoothstep(-0.2,0.7,gpat) + 0.15*chk;
    ` : `
        float tb = dot(vTripW, vec3(0.035,0.06,0.03)) + snoise(vTripW*0.12 + uTime*0.08)*0.7 - uTime*0.14;
        tripPsy = psyPal(tb);
        tripPsy *= 0.6 + 0.4*(0.5 + 0.5*sin(length(vTripW.xz - uCenter)*1.4 - uTime*2.2 + vTripW.y*0.8));
    `;

    sh.fragmentShader = `
      uniform float uTime; uniform float uTrip; uniform vec2 uCenter;
      uniform float uStrength; uniform float uCalm; uniform float uGlow;
      varying vec3 vTripW; varying vec3 vTripO;
      ${GLSL_NOISE}
    ` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${colorCode}
        vec3 tripPsy = vec3(0.0);
        float tripK = 0.0;
        if (uTrip > 0.001) {
          ${tripCode}
          tripPsy = pow(max(tripPsy, vec3(0.0)), vec3(1.8));
          float front = uTrip * 120.0;
          float reveal = 1.0 - smoothstep(front - 14.0, front, length(vTripW.xz - uCenter));
          tripK = clamp(uTrip * uStrength, 0.0, 1.0) * reveal;
          diffuseColor.rgb = mix(diffuseColor.rgb, tripPsy, tripK * 0.85);
        }
      `)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += tripPsy * tripK * uGlow;
        if (uCalm > 0.0) {
          float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
          totalEmissiveRadiance += psyPal(fr*1.4 + uTime*0.12 + vTripO.y*0.25) * fr * uCalm * (0.35 + uTrip);
        }
      `);
  };
  mat.customProgramCacheKey = () => 'trip-' + mode;
  return mat;
}

// ---------- geometry helpers ----------
const _v = new THREE.Vector3();
export function deform(geo, fn) {
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    _v.fromBufferAttribute(pos, i);
    fn(_v, i);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// Tube along a curve whose radius follows radiusFn(t), t in [0,1].
export function taperedTube(points, radiusFn, tubular = 48, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = geo.attributes.position;
  const c = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / (radial + 1));
    const t = seg / tubular;
    curve.getPointAt(t, c);
    _v.fromBufferAttribute(pos, i).sub(c).multiplyScalar(radiusFn(t)).add(c);
    pos.setXYZ(i, _v.x, _v.y, _v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
}

export function shadowAll(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// ---------- canvas textures ----------
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

let _clockFace;
export function clockFaceTexture() {
  if (_clockFace) return _clockFace;
  const [c, g] = canvas(512, 512);
  const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, '#eef3f0'); grd.addColorStop(0.75, '#c9dcdc'); grd.addColorStop(1, '#8fb2b8');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#b08a3e'; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 246, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#2b2b2b'; g.font = 'bold 54px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    g.fillText(String(i), 256 + Math.cos(a) * 185, 256 + Math.sin(a) * 185);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 212 : 222;
    g.lineWidth = i % 5 === 0 ? 5 : 2;
    g.beginPath(); g.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
    g.lineTo(256 + Math.cos(a) * 234, 256 + Math.sin(a) * 234); g.stroke();
  }
  return (_clockFace = tex(c));
}

let _hands = {};
export function handTexture(kind) {
  if (!_hands[kind]) {
    const [c, g] = canvas(256, 256);
    g.fillStyle = '#1d1d1d';
    const len = kind === 'hour' ? 62 : 96, w = kind === 'hour' ? 9 : 5;
    g.beginPath(); g.moveTo(128 - w, 132); g.lineTo(128, 128 - len); g.lineTo(128 + w, 132); g.closePath(); g.fill();
    g.beginPath(); g.arc(128, 128, 9, 0, Math.PI * 2); g.fill();
    _hands[kind] = c;
  }
  const t = tex(_hands[kind]);
  t.center.set(0.5, 0.5);
  return t;
}

let _eye;
export function eyeTexture() {
  // Drawn in polar form: top of canvas = pupil (pole of the sphere cap), going down = outward rings.
  if (_eye) return _eye;
  const [c, g] = canvas(256, 256);
  const bands = ['#050208', '#050208', '#3b0a5e', '#7b2cbf', '#e0329b', '#ff8a00', '#ffe14d', '#33d17a', '#1fb6ff', '#3b0a5e', '#f4efe6'];
  const h = 256 / bands.length;
  bands.forEach((b, i) => { g.fillStyle = b; g.fillRect(0, i * h, 256, h + 1); });
  // radial streaks in the iris
  for (let x = 0; x < 256; x += 4) {
    g.fillStyle = `rgba(255,255,255,${0.1 + 0.2 * Math.random()})`;
    g.fillRect(x, h * 2, 1.5, h * 7);
  }
  return (_eye = tex(c));
}

let _ants;
export function antsTexture() {
  if (_ants) return _ants;
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#d8732a'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#8a3e12'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#120a06';
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 105;
    const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r, ang = Math.random() * Math.PI;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.ellipse(0, 0, 4, 2, 0, 0, Math.PI * 2); g.ellipse(6, 0, 3, 2, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  return (_ants = tex(c));
}
