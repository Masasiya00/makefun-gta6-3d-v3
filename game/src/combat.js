// Combat for Solmar Bay 3D: fists, pistol, SMG, shotgun and rifle, weapon
// wheel slots with ammo, muzzle flash, tracers, hit markers and enemies.
//
// Ammo is GTA-style: each gun has a magazine (state.magAmmo) and a reserve
// (state.ammo). Firing drains the magazine; when it empties the gun
// auto-reloads from the reserve (state.reloadT counts the reload down) and
// the HUD shows the reload. Spent casings fly out of the gun and bounce
// on the ground for a moment.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { dist2d, angleTo, wrapAngle } from './random.js';
import { playGunshot, playPunch } from './audio.js';

const RELOAD_TIME = 1.4;

export function createCombat(scene) {
  const group = new THREE.Group();
  scene.add(group);
  return { group, tracers: [], flash: null, flashT: 0, cooldown: 0, hitMarkerT: 0, damageNumbers: [], casings: [] };
}

export function spawnEnemy(state, scene, x, z, kind) {
  const e = { id: 'enemy' + state.enemies.length + '_' + Math.floor(state.time), x, z, angle: 0, health: kind === 'heavy' ? 120 : 60, kind: kind || 'goon', shootT: 1 + state.rng.next() * 2 };
  state.enemies.push(e);
  return e;
}

function startReload(state) {
  const w = WEAPONS[state.weaponIndex];
  if (w.mag === Infinity) return;
  if (state.magAmmo[state.weaponIndex] >= w.mag) return;
  if (state.ammo[state.weaponIndex] <= 0) return;
  if (state.reloadT > 0) return;
  state.reloadT = RELOAD_TIME;
  state.message = 'Reloading ' + w.name + '…';
  state.messageT = RELOAD_TIME;
}

function finishReload(state) {
  const w = WEAPONS[state.weaponIndex];
  if (w.mag === Infinity) return;
  const need = w.mag - state.magAmmo[state.weaponIndex];
  const take = Math.min(need, state.ammo[state.weaponIndex]);
  state.magAmmo[state.weaponIndex] += take;
  state.ammo[state.weaponIndex] -= take;
}

function ejectCasing(state, combat) {
  if (combat.casings.length >= 12) return;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.03, 0.03),
    new THREE.MeshBasicMaterial({ color: 0xffd166 }),
  );
  const a = state.player.angle;
  const rx = Math.cos(a);
  const rz = -Math.sin(a);
  m.position.set(state.player.x + rx * 0.4, 1.2, state.player.z + rz * 0.4);
  m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
  combat.group.add(m);
  combat.casings.push({
    mesh: m,
    vx: rx * (1 + Math.random() * 1.5),
    vy: 1.6 + Math.random(),
    vz: rz * (1 + Math.random() * 1.5),
    t: 0.9,
  });
}

export function updateCombat(state, input, combat, dt, audio, cameraYaw) {
  combat.cooldown -= dt;
  combat.flashT -= dt;
  combat.hitMarkerT -= dt;
  if (state.reloadT > 0) {
    state.reloadT -= dt;
    if (state.reloadT <= 0) { state.reloadT = 0; finishReload(state); }
  }
  if (state.flags.gunfireT > 0) state.flags.gunfireT -= dt;
  const w = WEAPONS[state.weaponIndex];
  const wantFire = input.mouseDown || input.keys.KeyF;
  if (wantFire && combat.cooldown <= 0 && !state.player.inCar) {
    if (w.id === 'fists') {
      combat.cooldown = 1 / w.rate;
      playPunch(audio);
      // Punch hits the nearest enemy within reach.
      for (const e of state.enemies) {
        if (dist2d(state.player.x, state.player.z, e.x, e.z) < w.range) {
          e.health -= w.damage; combat.hitMarkerT = 0.4;
          if (e.health <= 0) killEnemy(state, e);
          break;
        }
      }
    } else if (state.reloadT > 0) {
      combat.cooldown = 0.2;
    } else if (state.magAmmo[state.weaponIndex] <= 0) {
      if (state.ammo[state.weaponIndex] > 0) {
        startReload(state);
        combat.cooldown = 0.4;
      } else {
        combat.cooldown = 0.4;
        state.message = 'No ammo — visit Ironworks Arms';
        state.messageT = 2;
      }
      return;
    } else {
      state.magAmmo[state.weaponIndex]--;
      state.stats.shotsFired++;
      combat.cooldown = 1 / w.rate;
      state.flags.gunfireT = 1.5;
      playGunshot(audio);
      combat.flashT = 0.07;
      ejectCasing(state, combat);
      if (state.magAmmo[state.weaponIndex] <= 0 && state.ammo[state.weaponIndex] > 0) startReload(state);
      // Ray: nearest enemy within range and a wide aim cone.
      const aim = cameraYaw !== undefined ? cameraYaw : state.player.angle;
      let best = null, bestD = w.range;
      for (const e of state.enemies) {
        const d = dist2d(state.player.x, state.player.z, e.x, e.z);
        const a = Math.abs(wrapAngle(angleTo(state.player.x, state.player.z, e.x, e.z) - aim));
        if (d < bestD && a < 0.6) { bestD = d; best = e; }
      }
      if (best) {
        best.health -= w.damage;
        combat.hitMarkerT = 0.4;
        combat.damageNumbers.push({ x: best.x, z: best.z, text: '-' + w.damage, t: 0.8 });
        if (best.health <= 0) killEnemy(state, best);
      }
      // Tracer line from the player toward the aim direction.
      const from = new THREE.Vector3(state.player.x, 1.4, state.player.z);
      const to = new THREE.Vector3(state.player.x + Math.sin(aim) * w.range, 1.4, state.player.z + Math.cos(aim) * w.range);
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
      combat.group.add(line);
      combat.tracers.push({ line, t: 0.12 });
    }
  }
  for (const tr of combat.tracers) tr.t -= dt;
  combat.tracers = combat.tracers.filter((tr) => {
    if (tr.t <= 0) { combat.group.remove(tr.line); tr.line.geometry.dispose(); return false; }
    return true;
  });
  // Spent casings: fly out, fall, bounce once, then fade away.
  for (const c of combat.casings) {
    c.t -= dt;
    c.vy -= 9.8 * dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    c.mesh.position.z += c.vz * dt;
    if (c.mesh.position.y < 0.04) { c.mesh.position.y = 0.04; c.vy *= -0.3; c.vx *= 0.6; c.vz *= 0.6; }
    c.mesh.rotation.x += dt * 9;
    c.mesh.rotation.z += dt * 7;
  }
  combat.casings = combat.casings.filter((c) => {
    if (c.t <= 0) { combat.group.remove(c.mesh); c.mesh.geometry.dispose(); return false; }
    return true;
  });
  for (const dn of combat.damageNumbers) dn.t -= dt;
  combat.damageNumbers = combat.damageNumbers.filter((d) => d.t > 0);
  // Enemies shoot back at the player.
  for (const e of [...state.enemies]) {
    e.shootT -= dt;
    const d = dist2d(e.x, e.z, state.player.x, state.player.z);
    if (d < 40 && e.shootT <= 0) {
      e.shootT = 1.6 + state.rng.next();
      state.flags.gunfireT = 1;
      playGunshot(audio);
      if (state.armour > 0) state.armour = Math.max(0, state.armour - 6);
      else state.health = Math.max(0, state.health - 6);
      if (state.health <= 0) { state.wasted = true; state.gameOver = true; }
    }
    // Enemies shuffle toward the player.
    if (d > 12 && d < 60) {
      const a = angleTo(e.x, e.z, state.player.x, state.player.z);
      e.x += Math.sin(a) * 2.4 * dt; e.z += Math.cos(a) * 2.4 * dt; e.angle = a;
    }
  }
}

function killEnemy(state, e) {
  state.enemies = state.enemies.filter((x) => x !== e);
  state.money += 60;
  state.pickups.push({ kind: 'cash', amount: 60, x: e.x, z: e.z, taken: false });
  state.message = 'Enemy down — +$60'; state.messageT = 2;
}

export function switchWeapon(state, index) {
  if (index < 0 || index >= WEAPONS.length) return;
  if (!state.weaponsOwned[index]) { state.message = WEAPONS[index].name + ' locked — $' + WEAPONS[index].price + ' at Ironworks Arms'; state.messageT = 2; return; }
  if (index === state.weaponIndex) return;
  state.weaponIndex = index;
  state.reloadT = 0;
  state.weaponSwitchT = 0.4;
}
