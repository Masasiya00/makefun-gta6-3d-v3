// Drivable cars: eight models built from boxes, cylinders and cones, each with
// its own shape, top speed and handling. Driving is arcade physics —
// acceleration, braking, steering that scales with speed, a handbrake that
// breaks grip — plus collision with buildings and other cars, damage, smoke
// when wrecked, headlights at night and brake lights.
import { CARS } from './config.js';

function box(THREE, w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

export function buildCarMesh(THREE, def, colorHex) {
  const g = new THREE.Group();
  const c = colorHex;
  const kind = def.kind;
  // Body dimensions per kind.
  let body = { w: 1.9, h: 0.62, d: 4.3, y: 0.55 };
  let cabin = { w: 1.7, h: 0.55, d: 2.1, y: 1.12, z: -0.2 };
  if (kind === 'suv') { body = { w: 2.1, h: 0.85, d: 4.8, y: 0.65 }; cabin = { w: 1.9, h: 0.7, d: 2.9, y: 1.4, z: -0.2 }; }
  if (kind === 'pickup') { body = { w: 2.0, h: 0.7, d: 5.0, y: 0.6 }; cabin = { w: 1.8, h: 0.6, d: 1.6, y: 1.25, z: 0.9 }; }
  if (kind === 'coupe' || kind === 'convertible') { body = { w: 1.9, h: 0.5, d: 4.4, y: 0.5 }; cabin = { w: 1.6, h: 0.45, d: 1.8, y: 0.95, z: -0.3 }; }
  if (kind === 'taxi') { body = { w: 1.9, h: 0.62, d: 4.3, y: 0.55 }; cabin = { w: 1.7, h: 0.55, d: 2.1, y: 1.12, z: -0.2 }; }
  if (kind === 'lowrider') { body = { w: 2.0, h: 0.5, d: 4.7, y: 0.45 }; cabin = { w: 1.7, h: 0.5, d: 2.2, y: 0.95, z: -0.2 }; }
  const bodyMesh = box(THREE, body.w, body.h, body.d, c, 0, body.y, 0);
  g.add(bodyMesh);
  if (kind !== 'convertible') {
    const cab = box(THREE, cabin.w, cabin.h, cabin.d, 0x1a2530, 0, cabin.y, cabin.z);
    g.add(cab);
  } else {
    const seat = box(THREE, 1.5, 0.25, 1.6, 0x2a2a2a, 0, 0.85, -0.3);
    g.add(seat);
  }
  if (kind === 'pickup') {
    const bed = box(THREE, 1.8, 0.25, 1.8, 0x222831, 0, 0.95, -1.4);
    g.add(bed);
  }
  if (kind === 'taxi') {
    const sign = box(THREE, 0.9, 0.25, 0.5, 0xf2c94c, 0, 1.5, -0.2);
    g.add(sign);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w); wheels.push(w);
  }
  // Headlights and brake lights (emissive so they glow at night).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
  const hl = [];
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(hx, 0.55, body.d / 2 + 0.02); g.add(h); hl.push(h);
  }
  const bl = [];
  for (const bx of [-0.6, 0.6]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), brakeMat);
    b.position.set(bx, 0.55, -body.d / 2 - 0.02); g.add(b); bl.push(b);
  }
  // Headlight beams (visible cones at night).
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
  const beams = [];
  for (const bx of [-0.6, 0.6]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 14, 8, 1, true), beamMat);
    cone.rotation.x = Math.PI / 2 + 0.12;
    cone.position.set(bx, 0.5, body.d / 2 + 7);
    g.add(cone); beams.push(cone);
  }
  // Smoke puff when wrecked.
  const smoke = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0 }),
  );
  smoke.position.set(0, 1.6, 1.2);
  g.add(smoke);
  return { group: g, wheels, headlights: hl, brakelights: bl, beams, smoke, beamMat, brakeMat };
}

export function createCar(THREE, defId, colorHex, x, z, heading) {
  const def = CARS.find((c) => c.id === defId) || CARS[0];
  const color = colorHex ?? def.colors[0];
  const mesh = buildCarMesh(THREE, def, color);
  mesh.group.position.set(x, 0, z);
  mesh.group.rotation.y = heading;
  return {
    def, color, x, z, heading, speed: 0, steer: 0,
    health: 100, wrecked: false, isPlayer: false, hasDriver: false,
    mesh, upgrades: { engine: false, brakes: false, plating: false },
    topSpeed() { return this.def.top * (this.upgrades.engine ? 1.15 : 1); },
  };
}

// One fixed-step drive update. `input` is {throttle:-1..1, steer:-1..1, handbrake}.
// Returns true when the car hit something hard this step.
export function stepCar(car, input, dt, world, others) {
  if (car.wrecked) { car.speed *= 0.9; return false; }
  const top = car.topSpeed();
  const accel = car.def.accel;
  if (input.throttle > 0) car.speed += accel * input.throttle * dt;
  else if (input.throttle < 0) {
    car.speed -= (car.upgrades.brakes ? 34 : 24) * dt;
    if (car.speed < -top * 0.35) car.speed = -top * 0.35;
  } else {
    car.speed -= Math.sign(car.speed) * 6 * dt;
    if (Math.abs(car.speed) < 0.2) car.speed = 0;
  }
  if (car.speed > top) car.speed = top;
  const grip = input.handbrake ? car.def.grip * 0.35 : car.def.grip;
  const steerRate = 1.9 * (1 - Math.min(0.65, Math.abs(car.speed) / top * 0.8));
  car.heading += input.steer * steerRate * grip * 0.5 * dt * Math.sign(car.speed || 1) * Math.min(1, Math.abs(car.speed) / 6 + 0.45);
  const fx = Math.sin(car.heading); const fz = Math.cos(car.heading);
  let nx = car.x + fx * car.speed * dt;
  let nz = car.z + fz * car.speed * dt;
  let hitHard = false;
  const clamped = world.clampToWorld(nx, nz);
  if (clamped.x !== nx || clamped.z !== nz) {
    // World boundary: treat it like a head-on wall hit. Without this the
    // clamp holds the position but never bleeds speed, and a car driving
    // into the edge spins its wheels there forever.
    nx = clamped.x; nz = clamped.z;
    const impact = Math.abs(car.speed);
    car.speed *= 0.15;
    if (impact > 8) { car.health -= impact * 0.4; hitHard = true; }
  }
  const col = world.collideCircle(nx, nz, 1.9);
  if (col.hit) {
    const impact = Math.abs(car.speed);
    nx = col.x; nz = col.z;
    // How head-on is the hit? The push direction points out of the wall:
    // opposite the car's forward means head-on (stop), sideways means a
    // graze (keep sliding along the wall instead of bouncing to a halt).
    const fx2 = Math.sin(car.heading); const fz2 = Math.cos(car.heading);
    const facing = fx2 * (col.px || 0) + fz2 * (col.pz || 0);
    if (facing < -0.3) {
      car.speed *= 0.15;
      if (impact > 8) {
        car.health -= impact * (car.upgrades.plating ? 0.5 : 1) * 0.9;
        hitHard = true;
      }
    } else {
      car.speed *= 0.96;
      if (impact > 8) {
        car.health -= impact * (car.upgrades.plating ? 0.5 : 1) * 0.4;
        hitHard = true;
      }
    }
  }
  // Car-to-car bumps: push apart per car, but the speed penalty applies
  // once per step, not once per car (a swarm would otherwise pin the car).
  let bumped = false;
  for (const o of others) {
    if (o === car || o.wrecked) continue;
    const dx = nx - o.x; const dz = nz - o.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < 14 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const push = (3.8 - d) / d;
      nx += dx * push * 0.5; nz += dz * push * 0.5;
      if (Math.abs(car.speed) > 10) { car.health -= 4; hitHard = true; }
      bumped = true;
    }
  }
  if (bumped) car.speed *= 0.7;
  car.x = nx; car.z = nz;
  if (car.health <= 0 && !car.wrecked) {
    car.wrecked = true; car.speed = 0;
  }
  return hitHard;
}

export function syncCarMesh(car, night) {
  const m = car.mesh;
  m.group.position.set(car.x, 0, car.z);
  m.group.rotation.y = car.heading;
  const spin = car.speed * 0.5;
  for (const w of m.wheels) w.rotation.x += spin * 0.016;
  m.beamMat.opacity = night && !car.wrecked ? 0.14 : 0;
  m.smoke.material.opacity = car.wrecked ? 0.45 + Math.sin(performance.now() / 300) * 0.12 : 0;
  if (car.wrecked) m.smoke.scale.setScalar(1 + Math.sin(performance.now() / 500) * 0.2);
}
