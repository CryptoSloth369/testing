// Third-person orbit camera: mouse (pointer lock or drag) to look, wheel to zoom.
import * as THREE from 'three';

export class FollowCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.yaw = 0;            // 0 = camera behind a player facing -z
    this.pitch = 0.22;
    this.dist = 7;
    this.target = new THREE.Vector3();
    this.idle = 0;
    this.dragging = false;

    const look = (dx, dy) => {
      this.yaw -= dx * 0.0032;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0026, -0.25, 1.2);
      this.idle = 0;
    };
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === dom || this.dragging) look(e.movementX, e.movementY);
    });
    dom.addEventListener('mousedown', () => { if (document.pointerLockElement !== dom) this.dragging = true; });
    window.addEventListener('mouseup', () => (this.dragging = false));
    dom.addEventListener('wheel', (e) => {
      this.dist = THREE.MathUtils.clamp(this.dist + Math.sign(e.deltaY) * 0.6, 2.5, 16);
      e.preventDefault();
    }, { passive: false });
  }

  snap(pos) {
    this.target.copy(pos);
    this.update(1, pos, false, 1);
  }

  update(dt, playerPos, seated, trip) {
    this.idle += dt;
    // while seated, drift around behind the bench to frame the sky
    if (seated && this.idle > 2.5) {
      this.yaw += Math.sin(-this.yaw) * dt * 0.4 + dt * 0.03 * Math.sin(performance.now() * 0.0001);
      this.pitch += (0.12 - this.pitch) * dt * 0.4;
    }
    const lift = seated ? 1.0 : 1.3;
    const desired = new THREE.Vector3(playerPos.x, playerPos.y + lift, playerPos.z);
    this.target.lerp(desired, 1 - Math.exp(-dt * 10));

    const d = this.dist * (seated ? 1.15 : 1) * (1 + trip * 0.15);
    const cp = Math.cos(this.pitch);
    const pos = new THREE.Vector3(
      this.target.x + Math.sin(this.yaw) * cp * d,
      this.target.y + Math.sin(this.pitch) * d,
      this.target.z + Math.cos(this.yaw) * cp * d
    );
    pos.y = Math.max(pos.y, 0.4);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target.x, this.target.y + 0.9 + (seated ? 1.2 * trip : 0), this.target.z);
  }
}
