// The living city: ~60 pedestrians walking the sidewalks (they wait at
// crossings, chat in pairs, and panic-run from gunfire or fast cars) and ~35
// traffic cars circulating on the road grid, pausing at intersections. Both
// use pooled meshes and cheap steering so the frame rate stays up.
import { createCar, stepCar, syncCarMesh } from './vehicles.js';
import { CARS } from './config.js';

function makePedMesh(THREE, shirtColor) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const add = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); g.add(m); return m;
  };
  const legL = add(0.16, 0.6, 0.16, pants, -0.12, 0.32, 0);
  const legR = add(0.16, 0.6, 0.16, pants, 0.12, 0.32, 0);
  add(0.55, 0.65, 0.3, shirt, 0, 0.95, 0);
  add(0.36, 0.36, 0.34, skin, 0, 1.48, 0);
  const armL = add(0.13, 0.55, 0.13, shirt, -0.34, 0.95, 0);
  const armR = add(0.13, 0.55, 0.13, shirt, 0.34, 0.95, 0);
  return { group: g, legL, legR, armL, armR };
}

export function createCrowd(THREE, rng, world, count) {
  const peds = [];
  const group = new THREE.Group();
  const shirts = [0xe06a4f, 0x4fa8c8, 0xf2c94c, 0x7fb069, 0x8a6fc8, 0xe8e8e8, 0xd43d2a];
  for (let i = 0; i < count; i += 1) {
    const mesh = makePedMesh(THREE, shirts[i % shirts.length]);
    group.add(mesh.group);
    const x = rng.range(-1400, 1700);
    const z = rng.range(-1200, 1200);
    peds.push({
      mesh, x, z, heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.1, 1.9), target: null, wait: rng.range(0, 4),
      panic: 0, phase: rng.range(0, 6), alive: true,
    });
  }
  function pickTarget(p) {
    // Walk along a nearby road's sidewalk, or to a random nearby point.
    const rx = world.roadPoints[Math.floor(rng.next() * world.roadPoints.length)];
    return { x: rx.x + 8.5 + rng.range(-2, 2), z: rx.z + rng.range(-180, 180) };
  }
  return {
    group, peds,
    step(dt, danger) {
      for (const p of peds) {
        if (!p.alive) continue;
        // Panic: gunfire or a fast car nearby.
        if (danger && Math.hypot(danger.x - p.x, danger.z - p.z) < 26) p.panic = 3;
        if (p.panic > 0) {
          p.panic -= dt;
          const dx = p.x - (danger ? danger.x : 0);
          const dz = p.z - (danger ? danger.z : 0);
          const len = Math.hypot(dx, dz) || 1;
          p.x += (dx / len) * 5.5 * dt;
          p.z += (dz / len) * 5.5 * dt;
          p.heading = Math.atan2(dx, dz);
        } else if (p.wait > 0) {
          p.wait -= dt;
          if (p.wait <= 0) p.target = pickTarget(p);
        } else {
          if (!p.target) p.target = pickTarget(p);
          const dx = p.target.x - p.x; const dz = p.target.z - p.z;
          const d = Math.hypot(dx, dz);
          if (d < 3) { p.wait = rng.range(1, 6); p.target = null; }
          else {
            p.x += (dx / d) * p.speed * dt;
            p.z += (dz / d) * p.speed * dt;
            p.heading = Math.atan2(dx, dz);
          }
        }
        p.phase += dt * (p.panic > 0 ? 14 : 7);
        const cl = world.clampToWorld(p.x, p.z);
        p.x = cl.x; p.z = cl.z;
        p.mesh.group.position.set(p.x, 0, p.z);
        p.mesh.group.rotation.y = p.heading;
        const swing = Math.sin(p.phase) * 0.55;
        p.mesh.legL.rotation.x = swing;
        p.mesh.legR.rotation.x = -swing;
        p.mesh.armL.rotation.x = -swing * 0.7;
        p.mesh.armR.rotation.x = swing * 0.7;
      }
    },
    runOverCheck(x, z, r) {
      // Returns the pedestrians inside radius r (for the wanted system).
      const hit = [];
      for (const p of peds) {
        if (p.alive && Math.hypot(p.x - x, p.z - z) < r) hit.push(p);
      }
      return hit;
    },
    knockDown(p) { p.alive = false; p.mesh.group.visible = false; },
  };
}

export function createTraffic(THREE, rng, world, count) {
  const cars = [];
  const group = new THREE.Group();
  for (let i = 0; i < count; i += 1) {
    const def = CARS[Math.floor(rng.next() * CARS.length)];
    const rp = world.roadPoints[Math.floor(rng.next() * world.roadPoints.length)];
    const car = createCar(THREE, def.id, def.colors[Math.floor(rng.next() * def.colors.length)], rp.x, rp.z, rng.range(0, Math.PI * 2));
    car.hasDriver = true;
    car.cruise = rng.range(9, 14);
    car.target = null;
    car.wait = rng.range(0, 3);
    group.add(car.mesh.group);
    cars.push(car);
  }
  function pickTarget(car) {
    // Drive to a random intersection, preferring one along the current road.
    return world.roadPoints[Math.floor(rng.next() * world.roadPoints.length)];
  }
  return {
    group, cars,
    step(dt, world, night, playerPos) {
      for (const car of cars) {
        if (car.wrecked) { syncCarMesh(car, night); continue; }
        if (car.wait > 0) { car.wait -= dt; syncCarMesh(car, night); continue; }
        if (!car.target) car.target = pickTarget(car);
        const dx = car.target.x - car.x; const dz = car.target.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 8) {
          car.target = pickTarget(car);
          if (rng.chance(0.25)) car.wait = rng.range(1, 3); // red light
          continue;
        }
        const want = Math.atan2(dx, dz);
        let diff = want - car.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 1.5));
        // Slow down for the player ahead.
        let throttle = 0.55;
        if (playerPos && Math.hypot(playerPos.x - car.x, playerPos.z - car.z) < 14) throttle = -0.4;
        stepCar(car, { throttle, steer, handbrake: false }, dt, world, cars);
        // Keep traffic cars at cruise speed.
        if (car.speed > car.cruise) car.speed = car.cruise;
        syncCarMesh(car, night);
      }
    },
  };
}
