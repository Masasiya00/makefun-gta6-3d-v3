// Combat for Solmar Bay 3D: fists, pistol, SMG, shotgun and rifle, weapon
// wheel slots with ammo, muzzle flash, tracers, hit markers and enemies.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { dist2d, angleTo, wrapAngle } from './random.js';
import { playGunshot, playPunch } from './audio.js';

export function createCombat(scene) {
  const group = new THREE.Group();
  scene.add(group);
  return { group, tracers: [], flash: null, flashT: 0, cooldown: 0, hitMarkerT: 0, damageNumbers: [] };
}

export function spawnEnemy(state, scene, x, z, kind) {
  const e = { id: 'enemy' + state.enemies.length + '_' + Math.floor(state.time), x, z, angle: 0, health: kind === 'heavy' ? 120 : 60, kind: kind || 'goon', shootT: 1 + state.rng.next() * 2 };
  state.enemies.push(e);
  return e;
}

export function updateCombat(state, input, combat, dt, audio, cameraYaw) {
  combat.cooldown -= dt;
  combat.flashT -= dt;
  combat.hitMarkerT -= dt;
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
    } else {
      if (state.ammo[state.weaponIndex] <= 0) { combat.cooldown = 0.4; state.message = 'No ammo — visit Ironworks Arms'; state.messageT = 2; return; }
      state.ammo[state.weaponIndex]--;
      state.stats.shotsFired++;
      combat.cooldown = 1 / w.rate;
      state.flags.gunfireT = 1.5;
      playGunshot(audio);
      combat.flashT = 0.07;
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
  state.weaponIndex = index;
}
