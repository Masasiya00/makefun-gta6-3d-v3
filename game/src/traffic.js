// Traffic cars and pedestrians for Solmar Bay 3D: cars circulate the road
// grid and stop at lights, pedestrians walk sidewalks and panic near danger.
import * as THREE from 'three';
import { CAR_MODELS } from './config.js';
import { dist2d } from './random.js';
import { makeCarMesh } from './vehicles.js';

export function spawnTraffic(state, scene) {
  const rng = state.rng;
  const meshes = new Map();
  for (let i = 0; i < 30; i++) {
    const model = rng.pick(CAR_MODELS);
    const car = {
      id: 'traf' + i, model, color: rng.pick(model.colors),
      road: rng.pick([-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300]),
      along: rng.range(-240, 240), vertical: rng.chance(0.5),
      dir: rng.chance(0.5) ? 1 : -1, speed: rng.range(9, 15),
      x: 0, z: 0, angle: 0, condition: 100, lightWait: 0,
    };
    state.traffic.push(car);
    const mesh = makeCarMesh(model, car.color);
    scene.add(mesh); meshes.set(car.id, mesh);
  }
  return meshes;
}

export function updateTraffic(state, dt) {
  for (const t of state.traffic) {
    // Traffic light pause: cars near an intersection sometimes wait.
    if (t.lightWait > 0) { t.lightWait -= dt; continue; }
    if (Math.abs(t.along % 60) < 2 && state.rng.chance(0.002)) t.lightWait = 2 + state.rng.next() * 2;
    t.along += t.dir * t.speed * dt;
    if (t.along > 250) { t.along = -250; }
    if (t.along < -250) { t.along = 250; }
    if (t.vertical) { t.x = t.road; t.z = t.along; t.angle = t.dir > 0 ? 0 : Math.PI; }
    else { t.z = t.road; t.x = t.along; t.angle = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    // Slow down if the player blocks the road ahead.
    if (dist2d(t.x, t.z, state.player.x, state.player.z) < 10) t.speed = Math.max(4, t.speed - dt * 8);
    else t.speed = Math.min(15, t.speed + dt * 2);
  }
}

export function syncTrafficMeshes(meshes, state) {
  for (const t of state.traffic) {
    const m = meshes.get(t.id);
    if (!m) continue;
    m.position.set(t.x, 0, t.z);
    m.rotation.y = t.angle;
  }
}

const PED_COLORS = [0xe63946, 0x2a9d8f, 0xf2c14e, 0x7b2fbe, 0x1d3557, 0xe26d5a, 0x6a994e, 0xef476f];

export function spawnPedestrians(state, scene) {
  const rng = state.rng;
  const meshes = new Map();
  for (let i = 0; i < 55; i++) {
    const ped = {
      id: 'ped' + i,
      x: rng.range(-300, 330), z: rng.range(-240, 240),
      angle: rng.next() * Math.PI * 2, speed: rng.range(1.2, 2.4),
      panic: 0, color: rng.pick(PED_COLORS), phase: rng.next() * 6,
      targetX: 0, targetZ: 0, wait: 0,
    };
    ped.targetX = ped.x; ped.targetZ = ped.z;
    state.peds.push(ped);
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: ped.color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), shirt);
    body.position.y = 1.25; g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.4), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
    head.position.y = 1.95; g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), new THREE.MeshLambertMaterial({ color: 0x2b2d42 }));
    legL.position.set(-0.18, 0.4, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);
    g.userData = { legL, legR };
    g.position.set(ped.x, 0, ped.z);
    scene.add(g); meshes.set(ped.id, g);
  }
  return meshes;
}

export function updatePedestrians(state, dt) {
  for (const p of state.peds) {
    const danger = dist2d(p.x, p.z, state.player.x, state.player.z);
    const gunfire = state.flags.gunfireT > 0 && danger < 40;
    if (danger < 8 || gunfire) p.panic = 3;
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.x - state.player.x, p.z - state.player.z);
      p.x += Math.sin(away) * 5.5 * dt;
      p.z += Math.cos(away) * 5.5 * dt;
      p.angle = away;
      p.phase += dt * 12;
    } else {
      if (p.wait > 0) { p.wait -= dt; continue; }
      const d = dist2d(p.x, p.z, p.targetX, p.targetZ);
      if (d < 2) {
        p.targetX = Math.max(-330, Math.min(330, p.x + (state.rng.next() - 0.5) * 80));
        p.targetZ = Math.max(-240, Math.min(240, p.z + (state.rng.next() - 0.5) * 80));
        if (state.rng.chance(0.25)) p.wait = 2 + state.rng.next() * 4;
        continue;
      }
      const a = Math.atan2(p.targetX - p.x, p.targetZ - p.z);
      p.angle += (a - p.angle) * Math.min(1, dt * 4);
      p.x += Math.sin(p.angle) * p.speed * dt;
      p.z += Math.cos(p.angle) * p.speed * dt;
      p.phase += dt * 7;
    }
    p.x = Math.max(-340, Math.min(340, p.x));
    p.z = Math.max(-245, Math.min(245, p.z));
  }
}

export function syncPedMeshes(meshes, state) {
  for (const p of state.peds) {
    const m = meshes.get(p.id);
    if (!m) continue;
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.angle;
    const swing = Math.sin(p.phase) * 0.5;
    m.userData.legL.rotation.x = swing;
    m.userData.legR.rotation.x = -swing;
  }
}
