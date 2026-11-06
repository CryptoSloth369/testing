import * as THREE from 'three';
import { U } from './shared.js';
import { createWorld } from './world.js';
import { createBuildings } from './buildings.js';
import { loadPlayer } from './player.js';
import { FollowCamera } from './camera.js';
import { Trip, createEyes, createPost } from './trip.js';
import { Soundscape } from './audio.js';
import { createTouchControls, IS_TOUCH } from './touch.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
const fitCamera = () => {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 72 : 55;   // wider view when a phone is held upright
  camera.updateProjectionMatrix();
};
fitCamera();

const world = createWorld(scene, renderer, { shadowSize: IS_TOUCH ? 2048 : 4096 });
const buildings = createBuildings(scene);
const colliders = [...world.colliders, ...buildings.colliders];
U.uCenter.value.set(buildings.bench.seat.x, buildings.bench.seat.z);
const updateEyes = createEyes(scene, buildings.eyeAnchors);

const post = createPost(renderer, scene, camera, { paintRadius: IS_TOUCH ? 2 : 3 });
post.setSize(innerWidth, innerHeight);
const follow = new FollowCamera(camera, renderer.domElement);
const trip = new Trip();
const sound = new Soundscape();

// ---------- input ----------
const keys = new Set();
const input = { forward: 0, right: 0, run: false, moving: false };
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
let player = null;

function toggleSit() {
  if (!player) return;
  if (player.state === 'seated') player.stand();
  else if (player.canSit(buildings.bench)) player.sit(buildings.bench);
}
function toggleDance() {
  if (player && player.state === 'free') player.dancing = !player.dancing;
}
const touch = createTouchControls({ follow, onSit: toggleSit, onDance: toggleDance, onSound: () => sound.toggleMute() });

addEventListener('keydown', (e) => {
  if (MOVE_KEYS.includes(e.code) || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (!player) return;
  if (e.code === 'KeyE') toggleSit();
  if (e.code === 'KeyQ') toggleDance();
  if (e.code === 'KeyM') toast(sound.toggleMute() ? 'Sound off' : 'Sound on');
  if (e.code === 'KeyP') toast(post.togglePaint() ? 'Oil paint filter on' : 'Oil paint filter off');
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function readInput() {
  const k = (...c) => c.some((x) => keys.has(x));
  input.forward = (k('KeyW', 'ArrowUp') ? 1 : 0) - (k('KeyS', 'ArrowDown') ? 1 : 0);
  input.right = (k('KeyD', 'ArrowRight') ? 1 : 0) - (k('KeyA', 'ArrowLeft') ? 1 : 0);
  input.run = k('ShiftLeft', 'ShiftRight');
  if (touch && touch.state.mag > 0) {
    input.forward = touch.state.forward;
    input.right = touch.state.right;
    input.run = touch.run;
  }
  input.moving = input.forward !== 0 || input.right !== 0;
}

// ---------- UI ----------
let toastTimer;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

$('enter').addEventListener('click', () => {
  $('intro').classList.add('hidden');
  $('hud').classList.remove('hidden');
  sound.start();
  if (IS_TOUCH) document.documentElement.requestFullscreen?.()?.catch(() => {});
  else renderer.domElement.requestPointerLock?.();
});
renderer.domElement.addEventListener('click', () => {
  if (!IS_TOUCH && $('intro').classList.contains('hidden') && document.pointerLockElement !== renderer.domElement) renderer.domElement.requestPointerLock?.();
});

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});

// ---------- loop ----------
const clock = new THREE.Clock();
let t = 0;
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  t += dt;
  U.uTime.value = t;
  readInput();

  if (player) {
    trip.target = player.state === 'seated' || player.state === 'sitting' ? 1 : 0;
    if (params.has('trip')) trip.target = parseFloat(params.get('trip')) || 0;
  }
  const tv = trip.update(dt);
  U.uTrip.value = tv;

  world.update(dt, t, tv, camera);
  buildings.update(dt, t, tv);
  if (player) {
    player.update(dt, input, follow.yaw, colliders);
    follow.update(dt, player.position, player.seated, tv);
    updateEyes(dt, t, tv, player.headPos);
    $('prompt').className = player.canSit(buildings.bench) ? 'show' : player.state === 'seated' ? 'show seated' : '';
    $('prompt').textContent = IS_TOUCH
      ? (player.state === 'seated' ? 'Tap Stand (or move) to get up' : 'Tap Sit to sit on the bench')
      : (player.state === 'seated' ? 'Press E (or move) to stand up' : 'Press E to sit on the bench');
    touch?.setSit(player.state === 'seated' ? 'Stand' : player.canSit(buildings.bench) ? 'Sit' : null);
  }
  sound.update(tv);
  post.render(t, tv);
  requestAnimationFrame(frame);
}

loadPlayer(scene, (p) => ($('loadbar').style.width = `${Math.round(p * 100)}%`)).then((p) => {
  player = p;
  follow.snap(player.position);
  $('loading').classList.add('hidden');
  $('enter').classList.remove('hidden');
  if (params.has('trip')) trip.raw = parseFloat(params.get('trip')) || 0;
  window.__dream = { player, trip, follow, buildings, keys, camera, renderer };
}).catch((err) => {
  console.error(err);
  $('loading').textContent = `Could not load the dreamer: ${err?.message || err}`;
});

frame();
