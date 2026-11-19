// Vehicles for Solmar Bay 3D: eight drivable models, arcade driving,
// carjacking, damage, headlights and brake lights.
import * as THREE from 'three';
import { CAR_MODELS, WORLD } from './config.js';
import { clamp, dist2d } from './random.js';
import { playCrash } from './audio.js';

export function makeCarMesh(model, color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), darkMat);
  cabin.position.set(0, 1.25, model.id === 'pickup' ? -0.9 : -0.2);
  cabin.castShadow = true; g.add(cabin);
  if (model.id === 'pickup') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.6), bodyMat);
    bed.position.set(0, 0.95, 1.2); g.add(bed);
  }
  if (model.id === 'suv' || model.id === 'lowrider') {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 2.4), bodyMat);
    roof.position.set(0, 1.6, -0.2); g.add(roof);
  }
  if (model.id === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: 0xffc300 }));
    sign.position.set(0, 1.75, -0.2); g.add(sign);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.42, wz); g.add(w); wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  for (const hx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat);
    h.position.set(hx, 0.7, -2.22); g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const tx of [-0.7, 0.7]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.1), tailMat);
    t.position.set(tx, 0.7, 2.22); g.add(t);
  }
  // Headlight beams: translucent cones, switched on at night.
  const beamGeo = new THREE.ConeGeometry(1.6, 9, 10, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.x = Math.PI / 2 + 0.1;
  beam.position.set(0, 0.5, -6.5);
  beam.visible = false;
  g.add(beam);
  g.userData = { wheels, headMat, tailMat, bodyMat, model, beam };
  return g;
}

export function spawnParkedCars(state, scene) {
  const rng = state.rng;
  const meshes = new Map();
  for (let i = 0; i < 26; i++) {
    const model = rng.pick(CAR_MODELS);
    const color = rng.pick(model.colors);
    const x = Math.round(rng.range(-300, 300) / 60) * 60 + (rng.chance(0.5) ? 7 : -7);
    const z = rng.range(-240, 240);
    const car = {
      id: 'park' + i, model, color, x, z, angle: rng.chance(0.5) ? 0 : Math.PI,
      speed: 0, condition: 85 + rng.int(0, 15), driver: false, parked: true, smoke: 0,
    };
    state.cars.push(car);
    const mesh = makeCarMesh(model, color);
    mesh.position.set(x, 0, z); mesh.rotation.y = car.angle;
    scene.add(mesh); meshes.set(car.id, mesh);
  }
  // Rosa's coupe waiting at the garage for mission 1.
  const coupe = CAR_MODELS[2];
  const rosa = { id: 'rosa', model: coupe, color: 0xe63946, x: -160, z: 108, angle: Math.PI / 2, speed: 0, condition: 100, driver: false, parked: true, smoke: 0 };
  state.cars.push(rosa);
  const rm = makeCarMesh(coupe, 0xe63946);
  rm.position.set(-160, 0, 108); rm.rotation.y = Math.PI / 2;
  scene.add(rm); meshes.set('rosa', rosa && rm);
  return meshes;
}

export function nearestCar(state, x, z, maxD) {
  let best = null, bestD = maxD;
  for (const c of state.cars) {
    const d = dist2d(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(state, car) {
  state.player.inCar = true;
  state.player.carId = car.id;
  state.player.onFoot = false;
  car.parked = false;
  if (car.driver) { state.stats.carsStolen++; car.driver = false; }
}

export function exitCar(state) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (car) { car.speed = 0; car.x = state.player.x + Math.sin(state.player.angle + Math.PI / 2) * 3; car.z = state.player.z + Math.cos(state.player.angle + Math.PI / 2) * 3; }
  state.player.inCar = false;
  state.player.carId = null;
  state.player.onFoot = true;
  state.player.x += 3; state.player.z += 1;
}

export function updateDriving(state, input, dt, audio) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) { state.player.onFoot = true; state.player.inCar = false; return; }
  const upg = state.upgrades;
  const top = car.model.top * (upg.engine ? 1.25 : 1);
  const accel = car.model.accel * (upg.engine ? 1.15 : 1);
  const fwd = (input.keys.KeyW || input.keys.ArrowUp ? 1 : 0) - (input.keys.KeyS || input.keys.ArrowDown ? 0.7 : 0);
  const steer = (input.keys.KeyA || input.keys.ArrowLeft ? 1 : 0) - (input.keys.KeyD || input.keys.ArrowRight ? 1 : 0);
  const brake = input.keys.Space ? 1 : 0;
  car.speed += fwd * accel * dt;
  if (brake) car.speed *= Math.max(0, 1 - 3.5 * dt);
  car.speed -= car.speed * 0.55 * dt;
  car.speed = clamp(car.speed, -12, top);
  const spd = Math.abs(car.speed);
  const turnRate = steer * car.model.grip * (upg.brakes ? 1.2 : 1) * clamp(spd / 12, 0.15, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turnRate * dt * 0.9;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  // City bounds + ocean wall.
  car.x = clamp(car.x, WORLD.beachX - 2, WORLD.halfX);
  car.z = clamp(car.z, -WORLD.halfZ, WORLD.halfZ);
  // Building collision: cheap — push out of a coarse building grid is skipped;
  // crashes against other cars damage both.
  for (const other of state.cars) {
    if (other === car || other.speed === 0 && other.parked) continue;
    if (dist2d(car.x, car.z, other.x, other.z) < 3.4 && spd > 8) {
      car.condition -= 6; other.condition -= 4;
      car.speed *= 0.4; state.shake = 0.5;
      if (audio) playCrash(audio);
    }
  }
  for (const t of state.traffic) {
    if (dist2d(car.x, car.z, t.x, t.z) < 3.6 && spd > 6) {
      car.condition -= 5; t.condition = Math.max(0, (t.condition || 100) - 20);
      car.speed *= 0.45; state.shake = 0.5;
    }
  }
  if (car.condition <= 0) { car.condition = 0; car.speed = 0; car.smoke = 1; }
  state.player.x = car.x; state.player.z = car.z; state.player.angle = car.angle;
  state.player.speed = car.speed;
  state.speedKmh = Math.abs(car.speed) * 3.6;
  state.gear = Math.min(6, 1 + Math.floor(Math.abs(car.speed) / 9));
}

export function syncCarMeshes(meshes, state) {
  const h = (state.clockMin / 60) % 24;
  const night = h >= 19.5 || h < 6;
  for (const car of state.cars) {
    const m = meshes.get(car.id);
    if (!m) continue;
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.angle;
    const spinning = Math.abs(car.speed) > 0.5;
    for (const w of m.userData.wheels) w.rotation.x += car.speed * 0.016;
    m.userData.headMat.color.setHex(0xfff2a8);
    if (m.userData.beam) m.userData.beam.visible = night && !car.parked;
    if (car.smoke > 0) m.position.y = Math.sin(state.time * 20) * 0.05;
  }
}

export function damageCar(state, amount) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (car) {
    car.condition = Math.max(0, car.condition - amount * (state.upgrades.plating ? 0.5 : 1));
    if (car.condition <= 0) { car.speed = 0; car.smoke = 1; }
  }
}
