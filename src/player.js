// The controllable robot: loading, animation states, movement, collision, sitting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { tripify } from './shared.js';
import { PLAYER_SCALE } from './buildings.js';
import { SHORE_Z } from './world.js';

const WALK = 2.4, RUN = 5.2, RADIUS = 0.45, WORLD_R = 90;

export function loadPlayer(scene, onProgress) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load('assets/RobotExpressive.glb', (gltf) => resolve(new Player(scene, gltf)),
      (e) => onProgress && e.total && onProgress(e.loaded / e.total), reject);
  });
}

function shortAngle(a, b) { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

class Player {
  constructor(scene, gltf) {
    this.root = gltf.scene;
    this.root.scale.setScalar(PLAYER_SCALE);
    this.root.position.set(0, 0, 8);
    this.root.rotation.y = Math.PI;
    this.root.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        tripify(o.material, { strength: 0.55, calm: 0.5, glow: 0.2 });
      }
    });
    scene.add(this.root);

    this.mixer = new THREE.AnimationMixer(this.root);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (['Sitting', 'Standing', 'Wave'].includes(clip.name)) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; }
      this.actions[clip.name] = a;
    }
    this.current = null;
    this.play('Idle', 0);

    this.state = 'free';       // free | sitting | seated | standing
    this.timer = 0;
    this.heading = Math.PI;
    this.dancing = false;
    this.from = { pos: new THREE.Vector3(), rot: 0 };
    this.headPos = new THREE.Vector3();
  }

  get position() { return this.root.position; }
  get seated() { return this.state === 'seated' || this.state === 'sitting'; }

  play(name, fade = 0.25) {
    const next = this.actions[name];
    if (!next || this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }

  canSit(bench) { return this.state === 'free' && this.position.distanceTo(bench.sitPos) < 1.7; }

  sit(bench) {
    if (this.state !== 'free') return;
    this.state = 'sitting'; this.timer = 0; this.dancing = false;
    this.from.pos.copy(this.position); this.from.rot = this.root.rotation.y;
    this.bench = bench;
    this.play('Walking', 0.15);
  }

  stand() {
    if (this.state !== 'seated') return;
    this.state = 'standing'; this.timer = 0;
    this.play('Standing', 0.15);
  }

  update(dt, input, camYaw, colliders) {
    this.mixer.update(dt);
    this.timer += dt;

    if (this.state === 'sitting') {
      // shuffle onto the seat, turn around, then sit
      const k = Math.min(1, this.timer / 0.6), e = k * k * (3 - 2 * k);
      this.position.lerpVectors(this.from.pos, this.bench.sitPos, e);
      this.root.rotation.y = this.from.rot + shortAngle(this.from.rot, this.bench.sitRot) * e;
      if (k >= 1 && this.current !== this.actions.Sitting) this.play('Sitting', 0.2);
      if (this.timer > 1.1) { this.state = 'seated'; this.heading = this.bench.sitRot; }
    } else if (this.state === 'seated') {
      if (input.moving) this.stand();
    } else if (this.state === 'standing') {
      // step forward off the bench while getting up
      const step = Math.min(dt, Math.max(0, 0.5 - (this.timer - dt))) * 1.1;
      this.position.x += Math.sin(this.heading) * step;
      this.position.z += Math.cos(this.heading) * step;
      if (this.timer > 0.5) { this.state = 'free'; this.play('Idle', 0.3); }
    } else {
      this.move(dt, input, camYaw, colliders);
    }
    this.root.getWorldPosition(this.headPos).y += 1.8;
  }

  move(dt, input, camYaw, colliders) {
    const f = input.forward, r = input.right;
    const len = Math.hypot(f, r);
    if (len > 0.01) {
      this.dancing = false;
      const run = input.run;
      const speed = run ? RUN : WALK;
      // camera-relative direction
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = (fx * f + rx * r) / len, dz = (fz * f + rz * r) / len;
      this.position.x += dx * speed * dt;
      this.position.z += dz * speed * dt;
      this.heading += shortAngle(this.heading, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
      this.root.rotation.y = this.heading;
      this.play(run ? 'Running' : 'Walking', 0.2);
      this.actions.Walking.timeScale = 1.05; this.actions.Running.timeScale = 0.95;
    } else {
      this.play(this.dancing ? 'Dance' : 'Idle', 0.3);
    }
    this.collide(colliders);
  }

  collide(colliders) {
    const p = this.position;
    for (const c of colliders) {
      if (c.type === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + RADIUS;
        if (d < min && d > 1e-6) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; }
      } else {
        // oriented box in the XZ plane
        const cos = Math.cos(-c.rot), sin = Math.sin(-c.rot);
        const lx0 = p.x - c.x, lz0 = p.z - c.z;
        const lx = lx0 * Math.cos(c.rot) - lz0 * Math.sin(c.rot);
        const lz = lx0 * Math.sin(c.rot) + lz0 * Math.cos(c.rot);
        const cx = Math.max(-c.hw, Math.min(c.hw, lx)), cz = Math.max(-c.hd, Math.min(c.hd, lz));
        let ox = lx - cx, oz = lz - cz, d = Math.hypot(ox, oz);
        let nx = lx, nz = lz;
        if (d < 1e-6) {
          // inside the box: push out along the shallowest axis
          const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
          if (px < pz) nx = Math.sign(lx || 1) * (c.hw + RADIUS); else nz = Math.sign(lz || 1) * (c.hd + RADIUS);
        } else if (d < RADIUS) {
          nx = cx + (ox / d) * RADIUS; nz = cz + (oz / d) * RADIUS;
        } else continue;
        // back to world space
        p.x = c.x + nx * cos - nz * sin;
        p.z = c.z + nx * sin + nz * cos;
      }
    }
    const d = Math.hypot(p.x, p.z + 10);
    if (d > WORLD_R) { p.x *= WORLD_R / d; p.z = (p.z + 10) * (WORLD_R / d) - 10; }
    if (p.z < SHORE_Z + 1.5) p.z = SHORE_Z + 1.5;
  }
}
