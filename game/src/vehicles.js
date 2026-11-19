// Car meshes for Solmar Bay 3D: builds every drivable / parked car from
// boxes, keeps the headlights on the travelling side and the tail lights
// behind, and syncs the meshes with the simulation state each frame.
//
// Orientation note: a car's forward travel direction is the direction its
// local +Z ends up pointing once the outer group is rotated by car.angle
// (movement is x += sin(angle) * speed, z += cos(angle) * speed). The body
// parts below are laid out with the nose toward local -Z, so they all live
// inside a flipped inner group (rotation.y = PI). The outer group is the
// one the rest of the game rotates; add-ons such as the police siren bar
// attach to the outer group, outside this flip.
import * as THREE from 'three';
import { CAR_MODELS, WORLD } from './config.js';
import { clamp, dist2d } from './random.js';
import { playCrash } from './audio.js';

export function makeCarMesh(model, color) {
  const outer = new THREE.Group();

  // Everything that belongs to the car body sits in this flipped shell, so
  // that after the outer group's rotation.y = car.angle the nose points
  // along the direction of travel instead of backwards.
  const shell = new THREE.Group();
  shell.rotation.y = Math.PI;
  outer.add(shell);

  const paint = new THREE.MeshPhongMaterial({ color, shininess: 60, specular: 0x888888 });
  const paleGlass = new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 80, specular: 0xffffff });
  const tintedGlass = new THREE.MeshPhongMaterial({ color: 0x1a2530, shininess: 70, specular: 0xaaaaaa });
  const trim = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const lampFront = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
  const lampRear = new THREE.MeshBasicMaterial({ color: 0xff2222 });

  const lowered = model.id === 'lowrider' ? 0.12 : 0;
  const tyreR = model.id === 'lowrider' ? 0.36 : 0.42;
  const tallBody = model.id === 'suv' || model.id === 'lowrider';
  const cabinZ = model.id === 'pickup' ? -0.9 : -0.15;
  const cabinH = tallBody ? 0.75 : 0.55;
  const cabinY = (tallBody ? 1.25 : 1.15) - lowered;
  const roofY = (tallBody ? 1.65 : 1.45) - lowered;

  // Box helper: every panel lands in the flipped shell.
  function panel(w, h, d, material, x, y, z, shadow) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    if (shadow) mesh.castShadow = true;
    shell.add(mesh);
    return mesh;
  }

  // Main body, bonnet / boot lips, cabin, roof and glass.
  panel(2.0, 0.55, 4.4, paint, 0, 0.55 - lowered, 0, true);
  panel(1.9, 0.28, 1.3, paint, 0, 0.9 - lowered, -1.55, true);
  panel(1.9, 0.28, 0.9, paint, 0, 0.9 - lowered, 1.75, true);
  panel(1.7, cabinH, 2.0, tintedGlass, 0, cabinY, cabinZ, true);
  panel(1.75, 0.1, 1.9, paint, 0, roofY, cabinZ, true);
  const windscreen = panel(1.6, 0.06, 0.9, paleGlass, 0, 1.25 - lowered, cabinZ - 1.1, false);
  windscreen.rotation.x = -0.5;
  const backGlass = panel(1.6, 0.06, 0.9, paleGlass, 0, 1.25 - lowered, cabinZ + 1.1, false);
  backGlass.rotation.x = 0.5;

  // Four wheels plus their arches.
  const wheels = [];
  for (const [wx, wz] of [[-1.0, -1.45], [1.0, -1.45], [-1.0, 1.45], [1.0, 1.45]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(tyreR, tyreR, 0.3, 10), rubber);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, tyreR, wz);
    shell.add(wheel);
    wheels.push(wheel);
    panel(0.12, 0.18, 1.1, rubber, wx > 0 ? 1.02 : -1.02, 0.72 - lowered, wz, false);
  }

  // Lights: yellow headlights on the nose (-Z in shell space, which the
  // flip turns into the travel direction), red tail lights at the rear.
  panel(0.45, 0.22, 0.1, lampFront, -0.65, 0.62 - lowered, -2.22, false);
  panel(0.45, 0.22, 0.1, lampFront, 0.65, 0.62 - lowered, -2.22, false);
  panel(0.9, 0.18, 0.08, trim, 0, 0.62 - lowered, -2.22, false);
  panel(2.05, 0.22, 0.25, trim, 0, 0.38 - lowered, -2.25, false);
  panel(2.05, 0.22, 0.25, trim, 0, 0.38 - lowered, 2.25, false);
  panel(0.45, 0.2, 0.1, lampRear, -0.65, 0.62 - lowered, 2.22, false);
  panel(0.45, 0.2, 0.1, lampRear, 0.65, 0.62 - lowered, 2.22, false);
  panel(0.18, 0.12, 0.08, trim, -1.08, 1.15 - lowered, -0.9, false);
  panel(0.18, 0.12, 0.08, trim, 1.08, 1.15 - lowered, -0.9, false);

  // Model extras: open pickup bed, taxi roof sign.
  if (model.id === 'pickup') {
    panel(1.9, 0.5, 1.6, paint, 0, 0.95 - lowered, 1.2, true);
    panel(0.1, 0.5, 1.6, paint, -0.9, 1.1 - lowered, 1.2, false);
    panel(0.1, 0.5, 1.6, paint, 0.9, 1.1 - lowered, 1.2, false);
  }
  if (model.id === 'taxi') {
    panel(0.7, 0.3, 0.5, new THREE.MeshLambertMaterial({ color: 0xffc300 }), 0, 1.7 - lowered, -0.15, false);
  }

  // Night headlight beam: a translucent cone stretching forward from the
  // nose. It lives in the shell too, so it points along the travel
  // direction and away from a chase camera sitting behind the car.
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 9, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.rotation.x = Math.PI / 2 + 0.1;
  beam.position.set(0, 0.5, -6.5);
  beam.visible = false;
  shell.add(beam);

  outer.userData = { wheels, headMat: lampFront, tailMat: lampRear, bodyMat: paint, model, beam };
  return outer;
}

// Scatter the parked fleet (26 random cars plus Rosa's red coupe) and
// return the id -> mesh map. The RNG call order is load-bearing: the
// deterministic screenshots depend on the same cars landing in the same
// spots, so do not reorder the picks below.
export function spawnParkedCars(state, scene) {
  const meshes = new Map();
  state.cars = [];
  const rng = state.rng;
  for (let i = 0; i < 26; i++) {
    const model = rng.pick(CAR_MODELS);
    const color = rng.pick(model.colors);
    const car = {
      id: 'car' + i, model, color,
      x: Math.round(rng.range(-300, 300) / 60) * 60 + (rng.chance(0.5) ? 4.2 : -4.2),
      z: rng.range(-240, 240),
      angle: rng.chance(0.5) ? 0 : Math.PI,
      speed: 0, condition: 85 + rng.int(0, 15),
      driver: false, parked: true, smoke: 0,
    };
    state.cars.push(car);
    const mesh = makeCarMesh(model, color);
    mesh.position.set(car.x, 0, car.z);
    mesh.rotation.y = car.angle;
    scene.add(mesh);
    meshes.set(car.id, mesh);
  }
  const rosaModel = CAR_MODELS[2];
  const rosa = {
    id: 'rosa', model: rosaModel, color: 0xe63946,
    x: -160, z: 108, angle: Math.PI / 2,
    speed: 0, condition: 100, driver: false, parked: true, smoke: 0,
  };
  state.cars.push(rosa);
  const rosaMesh = makeCarMesh(rosaModel, 0xe63946);
  rosaMesh.position.set(rosa.x, 0, rosa.z);
  rosaMesh.rotation.y = rosa.angle;
  scene.add(rosaMesh);
  meshes.set(rosa.id, rosaMesh);
  return meshes;
}

export function nearestCar(state, x, z, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of state.cars) {
    const d = dist2d(x, z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(state, car) {
  if (!car) return;
  state.player.inCar = true;
  state.player.onFoot = false;
  state.player.carId = car.id;
  state.player.speed = car.speed || 0;
  car.parked = false;
  if (car.driver) state.stats.carsStolen++;
}

export function exitCar(state) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  state.player.inCar = false;
  state.player.onFoot = true;
  state.player.carId = null;
  state.player.x += 3;
  state.player.z += 1;
  state.player.speed = 0;
  if (car) car.speed = 0;
}

// Arcade driving: W/S throttle and brake/reverse, A/D steering that flips
// when reversing, engine/brake upgrades, crash slowdowns on car and
// traffic impacts, and a smoke flag once the car is wrecked.
export function updateDriving(state, input, dt, audio) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return;
  const fwd = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
  const steer = (input.keys.KeyA ? 1 : 0) - (input.keys.KeyD ? 1 : 0);
  const braking = !!input.keys.Space;
  if (car.crashT === undefined) car.crashT = 0;
  if (car.crashT > 0) car.crashT -= dt;
  const top = car.model.top * (state.upgrades && state.upgrades.engine ? 1.25 : 1);
  const grip = car.model.grip * (state.upgrades && state.upgrades.brakes ? 1.25 : 1);
  if (car.condition <= 0) {
    car.speed = 0;
    car.smoke = 1;
  } else if (braking) {
    car.speed -= Math.sign(car.speed) * 28 * dt;
    if (Math.abs(car.speed) < 0.6) car.speed = 0;
  } else {
    car.speed += fwd * car.model.accel * dt;
    if (fwd === 0) car.speed *= Math.max(0, 1 - 0.6 * dt);
  }
  car.speed = clamp(car.speed, -12, top);
  const turnRate = grip * Math.min(1, Math.abs(car.speed) / 8 + 0.15);
  car.angle += steer * turnRate * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  car.x = clamp(car.x, WORLD.beachX - 2, WORLD.halfX);
  car.z = clamp(car.z, -WORLD.halfZ, WORLD.halfZ);
  if (car.crashT <= 0) {
    for (const other of state.cars) {
      if (other === car) continue;
      if (dist2d(car.x, car.z, other.x, other.z) < 3.4 && Math.abs(car.speed) > 8) {
        car.speed *= 0.4;
        car.condition = Math.max(0, car.condition - 4);
        other.condition = Math.max(0, other.condition - 4);
        car.crashT = 0.8;
        if (audio) playCrash(audio);
        break;
      }
    }
    if (car.crashT <= 0) {
      for (const tr of state.traffic) {
        if (dist2d(car.x, car.z, tr.x, tr.z) < 3.6 && Math.abs(car.speed) > 6) {
          car.speed *= 0.5;
          car.condition = Math.max(0, car.condition - 3);
          car.crashT = 0.8;
          if (audio) playCrash(audio);
          break;
        }
      }
    }
  }
  if (car.condition <= 0) { car.speed = 0; car.smoke = 1; }
  state.player.x = car.x;
  state.player.z = car.z;
  state.player.angle = car.angle;
  state.player.speed = car.speed;
  state.speedKmh = Math.abs(car.speed) * 3.6;
  state.gear = car.speed < -0.5 ? 1 : Math.min(5, 1 + Math.floor(Math.abs(car.speed) / 10));
}

// Per-frame mesh sync: position + heading from the sim, wheel spin from
// speed, headlights always lit, beam only at night for cars that are not
// parked. The wheels spin in shell-local space, which the PI flip turns
// into the correct direction for the real travel direction.
export function syncCarMeshes(meshes, state) {
  const h = (state.clockMin / 60) % 24;
  const night = h >= 19.5 || h < 6;
  for (const car of state.cars) {
    const m = meshes.get(car.id);
    if (!m) continue;
    m.position.set(car.x, car.smoke ? Math.sin(state.time * 8) * 0.05 : 0, car.z);
    m.rotation.y = car.angle;
    const ud = m.userData;
    if (ud && ud.wheels) for (const w of ud.wheels) w.rotation.x += car.speed * 0.016;
    if (ud && ud.headMat) ud.headMat.color.setHex(0xfff2a8);
    if (ud && ud.beam) ud.beam.visible = night && !car.parked;
  }
}

export function damageCar(state, amount) {
  const car = state.cars.find((c) => c.id === state.player.carId);
  if (!car) return;
  let dmg = amount;
  if (state.upgrades && state.upgrades.plating) dmg *= 0.5;
  car.condition = Math.max(0, car.condition - dmg);
  if (car.condition <= 0) car.smoke = 1;
}
