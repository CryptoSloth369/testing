// The trip: its intensity curve, the floating eyes, and the post-processing stack.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { eyeTexture, smoothstep } from './shared.js';

export class Trip {
  constructor() { this.raw = 0; this.target = 0; this.value = 0; }
  update(dt) {
    // ~5s to fully come up, ~6s to come down
    const rate = this.target > this.raw ? 1 / 5 : 1 / 6;
    this.raw += Math.sign(this.target - this.raw) * Math.min(Math.abs(this.target - this.raw), rate * dt);
    this.value = smoothstep(0, 1, this.raw);
    return this.value;
  }
}

// ---------------------------------------------------------------- eyes
export function createEyes(scene, anchors) {
  const tex = eyeTexture();
  const white = new THREE.MeshStandardMaterial({ color: 0xf6f0e8, roughness: 0.25, emissive: 0x3a2a30, emissiveIntensity: 0.1 });
  const irisMat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.2 });
  const ballGeo = new THREE.SphereGeometry(1, 32, 20);
  const irisGeo = new THREE.SphereGeometry(1.012, 32, 12, 0, Math.PI * 2, 0, 0.62).rotateX(Math.PI / 2);

  const eyes = [];
  const make = (size) => {
    const pivot = new THREE.Group();
    const ball = new THREE.Group();
    ball.add(new THREE.Mesh(ballGeo, white), new THREE.Mesh(irisGeo, irisMat));
    pivot.add(ball);
    pivot.visible = false;
    scene.add(pivot);
    return { pivot, ball, size };
  };
  // eyes that open on the buildings
  anchors.forEach((a, i) => eyes.push({ ...make(0.6 + (i % 3) * 0.25), home: a.clone(), orbit: 0, th: 0.2 + (i % 5) * 0.1, phase: i * 1.3 }));
  // eyes that drift through the air
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996, r = 13 + (i * 13) % 30;
    eyes.push({
      ...make(0.5 + (i % 4) * 0.35),
      home: new THREE.Vector3(Math.cos(a) * r, 5 + (i * 7) % 12, Math.sin(a) * r - 16),
      orbit: 1.5 + (i % 3) * 1.5, th: 0.3 + (i % 6) * 0.1, phase: i * 0.77
    });
  }

  return (dt, t, trip, look) => {
    for (const e of eyes) {
      const s = smoothstep(e.th, e.th + 0.2, trip) * e.size;
      e.pivot.visible = s > 0.01;
      if (!e.pivot.visible) continue;
      e.pivot.position.copy(e.home);
      if (e.orbit) {
        e.pivot.position.x += Math.cos(t * 0.3 + e.phase) * e.orbit;
        e.pivot.position.z += Math.sin(t * 0.3 + e.phase) * e.orbit;
        e.pivot.position.y += Math.sin(t * 0.8 + e.phase) * 0.6;
      }
      e.pivot.scale.setScalar(s);
      const blink = 1 - Math.pow(Math.max(0, Math.sin(t * 0.6 + e.phase * 3)), 120);
      e.ball.scale.set(1, Math.max(0.08, blink), 1);
      e.pivot.lookAt(look);
    }
  };
}

// ---------------------------------------------------------------- post-processing
const PaintShader = {
  // Kuwahara filter: flattens the image into brush-like patches, like oil paint.
  defines: { R: 3 },
  uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform vec2 uRes; varying vec2 vUv;
    void quad(vec2 o, inout vec3 m, inout vec3 s){
      vec2 px = 1.0 / uRes;
      for (int j = 0; j <= R; j++) for (int i = 0; i <= R; i++) {
        vec3 c = texture2D(tDiffuse, vUv + (o * vec2(float(i), float(j))) * px).rgb;
        m += c; s += c * c;
      }
    }
    void main(){
      float n = float((R + 1) * (R + 1));
      vec3 m0 = vec3(0.0), s0 = vec3(0.0), m1 = vec3(0.0), s1 = vec3(0.0), m2 = vec3(0.0), s2 = vec3(0.0), m3 = vec3(0.0), s3 = vec3(0.0);
      quad(vec2(-1.0,-1.0), m0, s0); quad(vec2(1.0,-1.0), m1, s1); quad(vec2(-1.0,1.0), m2, s2); quad(vec2(1.0,1.0), m3, s3);
      m0 /= n; m1 /= n; m2 /= n; m3 /= n;
      vec3 v0 = abs(s0 / n - m0 * m0), v1 = abs(s1 / n - m1 * m1), v2 = abs(s2 / n - m2 * m2), v3 = abs(s3 / n - m3 * m3);
      // compare variance on a compressed scale so bright HDR areas don't dominate
      float a0 = dot(v0, vec3(1.0)) / (1.0 + dot(m0, vec3(1.0)));
      float a1 = dot(v1, vec3(1.0)) / (1.0 + dot(m1, vec3(1.0)));
      float a2 = dot(v2, vec3(1.0)) / (1.0 + dot(m2, vec3(1.0)));
      float a3 = dot(v3, vec3(1.0)) / (1.0 + dot(m3, vec3(1.0)));
      vec3 col = m0; float best = a0;
      if (a1 < best) { best = a1; col = m1; }
      if (a2 < best) { best = a2; col = m2; }
      if (a3 < best) { best = a3; col = m3; }
      // never let a NaN/Inf pixel through: bloom would smear it across the whole screen
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      gl_FragColor = vec4(clamp(col, 0.0, 64.0), 1.0);
    }`
};

const TripShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uTrip: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uTrip; uniform float uAspect; varying vec2 vUv;
    vec3 hueShift(vec3 c, float a){
      const vec3 k = vec3(0.57735);
      float ca = cos(a);
      return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1.0 - ca);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      vec2 c = (uv - 0.5) * vec2(uAspect, 1.0);
      float r = length(c);
      float a = atan(c.y, c.x + 1e-5);

      // breathing ripples
      uv += (c / max(r, 1e-4)) * uTrip * 0.012 * sin(r * 24.0 - uTime * 2.2) / vec2(uAspect, 1.0);
      uv += uTrip * 0.006 * vec2(sin(uv.y * 18.0 + uTime * 1.3), cos(uv.x * 14.0 - uTime * 1.1));

      // chromatic fringing grows with the trip
      float ca = (0.0015 + uTrip * 0.012) * r;
      vec2 dir = c / max(r, 1e-4) / vec2(uAspect, 1.0);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ca).b;

      // kaleidoscope folding in around the edges of the view
      if (uTrip > 0.01) {
        float seg = 8.0;
        float fa = abs(mod(a + uTime * 0.05, 6.28318 / seg) - 3.14159 / seg);
        vec2 kc = vec2(cos(fa), sin(fa)) * r * (1.0 - 0.15 * sin(uTime * 0.4));
        vec2 kuv = kc / vec2(uAspect, 1.0) + 0.5;
        vec3 k = texture2D(tDiffuse, kuv).rgb;
        float edge = smoothstep(0.3, 0.8, r) * uTrip * 0.55;
        col = mix(col, k, edge);
        col = max(hueShift(col, uTrip * (uTime * 0.4 + r * 3.0)), vec3(0.0));
      }

      // warm painted vignette + film grain
      float vig = smoothstep(1.05, 0.35, r);
      col *= mix(vec3(0.55, 0.42, 0.32), vec3(1.0), vig);
      col += (hash(vUv * 1000.0 + uTime) - 0.5) * 0.035;
      if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`
};

export function createPost(renderer, scene, camera, { paintRadius = 3 } = {}) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const paint = new ShaderPass({ ...PaintShader, defines: { R: paintRadius } });
  composer.addPass(paint);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.25, 0.6, 0.9);
  composer.addPass(bloom);
  const tripPass = new ShaderPass(TripShader);
  composer.addPass(tripPass);
  composer.addPass(new OutputPass());

  const setSize = (w, h) => {
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    paint.uniforms.uRes.value.set(w * pr, h * pr);
    tripPass.uniforms.uAspect.value = w / h;
  };
  return {
    composer, setSize,
    togglePaint() { paint.enabled = !paint.enabled; return paint.enabled; },
    render(t, trip) {
      bloom.strength = 0.22 + trip * 0.45;
      bloom.threshold = 0.92 - trip * 0.2;
      bloom.radius = 0.5 + trip * 0.3;
      tripPass.uniforms.uTime.value = t;
      tripPass.uniforms.uTrip.value = trip;
      composer.render();
    }
  };
}
