import * as THREE from 'three';
import { CAR_MODELS } from './config.js';
import { dist2d } from './random.js';
import { makeCarMesh } from './vehicles.js';

const X_ROADS = [-300, -240, -180, -120, -60, 0, 60, 120, 180, 240, 300];
const Z_ROADS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
const PED_COLORS = [0xe63946, 0x2a9d8f, 0xf2c14e, 0x7b2fbe, 0x1d3557, 0xe26d5a, 0x6a994e, 0xef476f];
const SKINS = [0xe8b98a, 0xc98a5a, 0xf2c9a0, 0x8a5a3a];

function lanePos(p) {
  if (p.vertical) return { x: p.road + p.side * 6.5, z: p.along };
  return { x: p.along, z: p.road + p.side * 6.5 };
}

export function spawnTraffic(state, scene) {
  const meshes = new Map();
  state.traffic = [];
  const rng = state.rng;
  for (let i = 0; i < 30; i++) {
    const model = rng.pick(CAR_MODELS);
    const color = rng.pick(model.colors);
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(X_ROADS) : rng.pick(Z_ROADS);
    const dir = rng.chance(0.5) ? 1 : -1;
    const along = rng.range(-240, 240);
    const car = {
      id: 't' + i, model, color, road, along, vertical, dir,
      speed: rng.range(9, 15), lightWait: 0, condition: 100,
      x: vertical ? road : along, z: vertical ? along : road,
      angle: vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
    };
    state.traffic.push(car);
    const mesh = makeCarMesh(model, color);
    mesh.position.set(car.x, 0, car.z); mesh.rotation.y = car.angle;
    scene.add(mesh); meshes.set(car.id, mesh);
  }
  return meshes;
}

export function updateTraffic(state, dt) {
  for (const car of state.traffic) {
    if (car.vertical) {
      if (!X_ROADS.includes(car.road)) car.road = Math.max(-300, Math.min(300, Math.round(car.road / 60) * 60));
    } else if (!Z_ROADS.includes(car.road)) {
      car.road = Math.max(-240, Math.min(240, Math.round(car.road / 60) * 60));
    }
    if (car.lightWait > 0) {
      car.lightWait -= dt;
    } else {
      if (Math.abs(car.along % 60) < 0.6 && state.rng.chance(0.02)) car.lightWait = state.rng.range(1, 2);
      else {
        const near = dist2d(car.x, car.z, state.player.x, state.player.z) < 15;
        const sp = near ? car.speed * 0.4 : car.speed;
        car.along += car.dir * sp * dt;
      }
    }
    if (car.along > 250) car.along = -250;
    if (car.along < -250) car.along = 250;
    if (car.vertical) {
      car.x = car.road; car.z = car.along;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    } else {
      car.x = car.along; car.z = car.road;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
}

export function syncTrafficMeshes(meshes, state) {
  for (const car of state.traffic) {
    const m = meshes.get(car.id);
    if (!m) continue;
    m.position.set(car.x, 0, car.z);
    m.rotation.y = car.angle;
  }
}

export function spawnPedestrians(state, scene) {
  const meshes = new Map();
  state.peds = [];
  const rng = state.rng;
  for (let i = 0; i < 55; i++) {
    const vertical = rng.chance(0.5);
    const road = vertical ? rng.pick(X_ROADS) : rng.pick(Z_ROADS);
    const side = rng.chance(0.5) ? 1 : -1;
    const along = vertical ? rng.range(-240, 240) : rng.range(-300, 300);
    const dir = rng.chance(0.5) ? 1 : -1;
    const color = rng.pick(PED_COLORS);
    const skin = rng.pick(SKINS);
    const p = {
      id: 'ped' + i, x: 0, z: 0, angle: 0,
      speed: rng.range(1.2, 2.4), panic: 0, color,
      phase: rng.next() * 6, targetX: 0, targetZ: 0, wait: 0,
      vertical, road, side, along, dir,
    };
    const pos = lanePos(p);
    p.x = pos.x; p.z = pos.z; p.targetX = p.x; p.targetZ = p.z;
    p.angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    state.peds.push(p);
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color });
    const skinMat = new THREE.MeshLambertMaterial({ color: skin });
    const dark = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), shirt);
    body.position.set(0, 1.3, 0); g.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.45), skinMat);
    head.position.set(0, 2.05, 0); g.add(head);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), dark);
    legL.position.set(-0.2, 0.4, 0); g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.8, 0.32), dark);
    legR.position.set(0.2, 0.4, 0); g.add(legR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), shirt);
    armL.position.set(-0.52, 1.35, 0); g.add(armL);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), shirt);
    armR.position.set(0.52, 1.35, 0); g.add(armR);
    g.userData = { legL, legR, armL, armR };
    g.position.set(p.x, 0, p.z); g.rotation.y = p.angle;
    scene.add(g); meshes.set(p.id, g);
  }
  return meshes;
}

export function updatePedestrians(state, dt) {
  for (const p of state.peds) {
    const d = dist2d(p.x, p.z, state.player.x, state.player.z);
    const gunfire = state.flags && state.flags.gunfireT > 0;
    if (d < 8 || (gunfire && d < 40)) p.panic = 3;
    if (p.panic > 0) {
      p.panic -= dt;
      const away = Math.atan2(p.x - state.player.x, p.z - state.player.z);
      p.angle = away;
      p.x += Math.sin(away) * 5.5 * dt;
      p.z += Math.cos(away) * 5.5 * dt;
      p.phase += dt * 12;
      continue;
    }
    if (p.wait > 0) { p.wait -= dt; }
    else {
      p.along += p.dir * p.speed * dt;
      const limit = p.vertical ? 240 : 300;
      if (p.along > limit) { p.along = limit; p.dir = -1; }
      if (p.along < -limit) { p.along = -limit; p.dir = 1; }
      if (Math.abs(p.along % 60) < 3 && state.rng.chance(0.002)) {
        if (p.vertical) {
          const cross = Math.round(p.along / 60) * 60;
          if (cross >= -240 && cross <= 240) {
            p.vertical = false; p.road = cross;
            p.along = Math.max(-300, Math.min(300, p.x));
          }
        } else {
          const cross = Math.round(p.along / 60) * 60;
          if (cross >= -300 && cross <= 300) {
            p.vertical = true; p.road = cross;
            p.along = Math.max(-240, Math.min(240, p.z));
          }
        }
      }
      p.phase += dt * 7;
    }
    const pos = lanePos(p);
    p.x = pos.x; p.z = pos.z;
    p.angle = p.vertical ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
}

export function syncPedMeshes(meshes, state) {
  for (const p of state.peds) {
    const m = meshes.get(p.id);
    if (!m) continue;
    m.position.set(p.x, 0, p.z);
    m.rotation.y = p.angle;
    const ud = m.userData;
    if (!ud) continue;
    const s = Math.sin(p.phase);
    if (ud.legL) ud.legL.rotation.x = s * 0.5;
    if (ud.legR) ud.legR.rotation.x = -s * 0.5;
    if (ud.armL) ud.armL.rotation.x = -s * 0.4;
    if (ud.armR) ud.armR.rotation.x = s * 0.4;
  }
}
