// Combat: fists, pistol, SMG and shotgun with their own fire rate, damage,
// range and sound; hitscan shots with a tracer line, muzzle flash, hit marker
// and damage numbers; mission enemies who take cover and shoot back; health,
// armour and cash pickups scattered around the city and dropped by enemies.
import { WEAPONS } from './config.js';

export function createCombat(THREE, scene, rng) {
  const tracers = [];
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const enemies = [];
  const pickups = [];
  const pickupGroup = new THREE.Group();
  scene.add(pickupGroup);

  function spawnTracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(geo, tracerMat.clone());
    scene.add(line);
    tracers.push({ line, life: 0.09 });
  }

  function makeEnemyMesh(shirtColor) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
    const pants = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const add = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); g.add(m); return m;
    };
    add(0.16, 0.6, 0.16, pants, -0.12, 0.32, 0);
    add(0.16, 0.6, 0.16, pants, 0.12, 0.32, 0);
    add(0.55, 0.65, 0.3, shirt, 0, 0.95, 0);
    add(0.36, 0.36, 0.34, skin, 0, 1.48, 0);
    const gun = add(0.08, 0.12, 0.45, new THREE.MeshLambertMaterial({ color: 0x111111 }), 0.3, 1.05, 0.25);
    return { group: g, gun };
  }

  function spawnEnemy(x, z) {
    const mesh = makeEnemyMesh(0x8a2a2a);
    mesh.group.position.set(x, 0, z);
    scene.add(mesh.group);
    const e = { mesh, x, z, health: 60, cooldown: rng.range(0.5, 1.5), alive: true, heading: 0 };
    enemies.push(e);
    return e;
  }

  function spawnPickup(kind, x, z, amount) {
    const color = kind === 'health' ? 0x2ac85a : kind === 'armour' ? 0x2a7ac8 : 0xf2c94c;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.MeshLambertMaterial({ color }));
    m.position.set(x, 0.7, z);
    m.rotation.y = Math.PI / 4;
    pickupGroup.add(m);
    pickups.push({ kind, mesh: m, x, z, amount, bob: rng.range(0, 6) });
  }

  function clearEnemies() {
    for (const e of enemies) scene.remove(e.mesh.group);
    enemies.length = 0;
  }

  return {
    enemies, pickups, tracerCount: () => tracers.length,
    spawnEnemy, spawnPickup, clearEnemies,
    step(dt, playerPos, time) {
      for (const t of tracers) { t.life -= dt; if (t.life <= 0) { scene.remove(t.line); t.line.geometry.dispose(); } }
      for (let i = tracers.length - 1; i >= 0; i -= 1) if (tracers[i].life <= 0) tracers.splice(i, 1);
      for (const p of pickups) {
        p.bob += dt * 2;
        p.mesh.position.y = 0.7 + Math.sin(p.bob) * 0.15;
        p.mesh.rotation.y += dt;
      }
      // Enemies shoot at the player when close and in the open.
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(playerPos.x - e.x, playerPos.z - e.z);
        e.heading = Math.atan2(playerPos.x - e.x, playerPos.z - e.z);
        e.mesh.group.rotation.y = e.heading;
        e.cooldown -= dt;
        if (d < 40 && e.cooldown <= 0) {
          e.cooldown = rng.range(0.9, 1.8);
          const hit = rng.chance(0.4);
          spawnTracer({ x: e.x, y: 1.3, z: e.z }, { x: playerPos.x, y: 1.2, z: playerPos.z });
          if (hit) return { damage: 8 };
        }
      }
      return null;
    },
    // Fire the current weapon from `from` along `dir` (unit xz). Returns the
    // hit info or null. `targets` are {x,z,health,alive,onHit} entries.
    shoot(weapon, from, dir, targets) {
      const pellets = weapon.pellets || 1;
      let best = null;
      for (let p = 0; p < pellets; p += 1) {
        const spread = (rng.next() - 0.5) * (weapon.pellets ? 0.22 : 0.03);
        const dx = dir.x + -dir.z * spread;
        const dz = dir.z + dir.x * spread;
        const len = Math.hypot(dx, dz) || 1;
        const ux = dx / len; const uz = dz / len;
        for (const t of targets) {
          if (!t.alive) continue;
          const tx = t.x - from.x; const tz = t.z - from.z;
          const along = tx * ux + tz * uz;
          if (along < 0 || along > weapon.range) continue;
          const perp = Math.abs(tx * uz - tz * ux);
          if (perp < 1.1 && (!best || along < best.along)) best = { target: t, along, ux, uz };
        }
      }
      const end = best
        ? { x: best.target.x, y: 1.2, z: best.target.z }
        : { x: from.x + dir.x * weapon.range, y: 1.2, z: from.z + dir.z * weapon.range };
      spawnTracer({ x: from.x, y: 1.3, z: from.z }, end);
      if (best) {
        best.target.health -= weapon.damage;
        if (best.target.health <= 0) {
          best.target.alive = false;
          if (best.target.onDeath) best.target.onDeath();
        }
        return { hit: true, target: best.target, damage: weapon.damage };
      }
      return { hit: false };
    },
    pickupAt(x, z) {
      for (let i = 0; i < pickups.length; i += 1) {
        const p = pickups[i];
        if (Math.hypot(p.x - x, p.z - z) < 2.2) {
          pickupGroup.remove(p.mesh);
          pickups.splice(i, 1);
          return p;
        }
      }
      return null;
    },
  };
}

export function weaponDef(id) { return WEAPONS.find((w) => w.id === id); }
