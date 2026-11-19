// The player character on foot for Solmar Bay 3D: walk, run, jump, punch,
// enter and exit cars, health and armour.
import * as THREE from 'three';
import { clamp, dist2d } from './random.js';
import { addWanted } from './config.js';
import { nearestCar, enterCar } from './vehicles.js';

const OUTFITS = [0x2a9d8f, 0xe63946, 0x1d3557, 0xf2c14e, 0x7b2fbe];

export function makePlayerMesh(state) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: OUTFITS[state.outfit % OUTFITS.length] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  torso.position.y = 1.35; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
  head.position.y = 2.15; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.55), new THREE.MeshLambertMaterial({ color: 0xffc300 }));
  cap.position.y = 2.48; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
  armL.position.set(-0.58, 1.35, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.58; g.add(armR);
  g.userData = { legL, legR, armL, armR, torso, shirt };
  return g;
}

export function updatePlayerOnFoot(state, input, dt, audio) {
  const p = state.player;
  const sprint = input.keys.ShiftLeft || input.keys.ShiftRight;
  const speed = sprint ? 9 : 5;
  let mx = 0, mz = 0;
  if (input.keys.KeyW || input.keys.ArrowUp) mz -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) mz += 1;
  if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    // Movement is camera-relative: forward is the camera yaw.
    const yaw = state.cameraYaw || 0;
    const wx = mx * Math.cos(yaw) - mz * Math.sin(yaw);
    const wz = mx * Math.sin(yaw) + mz * Math.cos(yaw);
    p.x += wx * speed * dt;
    p.z += wz * speed * dt;
    p.angle = Math.atan2(wx, wz);
    p.walkPhase += dt * (sprint ? 13 : 9);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, -355, 355);
  p.z = clamp(p.z, -255, 255);
  // Enter a nearby car.
  if (input.pressed.KeyE) {
    const car = nearestCar(state, p.x, p.z, 5);
    if (car) {
      enterCar(state, car);
      if (car.parked) addWanted(state, 1);
      state.message = car.model.name + ' — yours now'; state.messageT = 2;
    }
  }
  // Pickups.
  for (const pk of state.pickups) {
    if (!pk.taken && dist2d(p.x, p.z, pk.x, pk.z) < 2.2) {
      pk.taken = true;
      if (pk.kind === 'cash') { state.money += pk.amount; state.message = '+$' + pk.amount; }
      if (pk.kind === 'health') state.health = clamp(state.health + 40, 0, 100);
      if (pk.kind === 'armour') state.armour = clamp(state.armour + 50, 0, 100);
      state.messageT = 2;
    }
  }
}

export function syncPlayerMesh(mesh, state) {
  const p = state.player;
  mesh.visible = p.onFoot;
  if (!p.onFoot) return;
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.angle;
  const swing = p.speed > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  mesh.userData.legL.rotation.x = swing;
  mesh.userData.legR.rotation.x = -swing;
  mesh.userData.armL.rotation.x = -swing * 0.8;
  mesh.userData.armR.rotation.x = swing * 0.8;
  mesh.userData.shirt.color.setHex(OUTFITS[state.outfit % OUTFITS.length]);
}

export function hurtPlayer(state, amount) {
  let left = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, left);
    state.armour -= absorbed; left -= absorbed;
  }
  state.health = Math.max(0, state.health - left);
  if (state.health <= 0) { state.wasted = true; state.gameOver = true; }
}
