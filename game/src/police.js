// The wanted system: 1–5 stars, police cars that spawn and chase with a
// last-seen-position pursuit, a line-of-sight check (the IN SIGHT indicator),
// a search-zone circle on the minimap while hunted, a helicopter from 3 stars
// (with a searchlight cone at night), roadblocks from 3 stars, and the data
// behind the HUD police response panel. Getting caught on foot is busted;
// losing all health is wasted.
import { createCar, stepCar, syncCarMesh } from './vehicles.js';

const CALLSIGNS = ['UNIT 12', 'UNIT 27', 'UNIT 33', 'UNIT 41', 'UNIT 58', 'UNIT 63', 'UNIT 70', 'UNIT 88'];

export function createPolice(THREE, rng, world) {
  const group = new THREE.Group();
  const units = []; // police cars
  let heli = null;
  let roadblocks = [];
  let wanted = 0;
  let heat = 0; // 0..1, rises while seen, falls while hidden
  let lastSeen = { x: 0, z: 0 };
  let seenNow = false;
  let hiddenTime = 0;
  let escapeTimer = 0;
  let bustedTimer = 0;
  let hideSpots = []; // "under cover" points where the police lose sight

  function spawnUnit(x, z) {
    const car = createCar(THREE, 'sedan', 0x111111, x, z, 0);
    // Police livery: a light bar on the roof.
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
    bar.position.set(0, 1.5, -0.2);
    car.mesh.group.add(bar);
    car.isPolice = true;
    car.callsign = CALLSIGNS[units.length % CALLSIGNS.length];
    car.state = 'PURSUIT';
    car.stuck = 0;
    group.add(car.mesh.group);
    units.push(car);
    return car;
  }

  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.6, 7), new THREE.MeshLambertMaterial({ color: 0x4a6a8a }));
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.4, 7.1), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = -0.2; g.add(stripe);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 2.6), new THREE.MeshLambertMaterial({ color: 0x335577 }));
    cabin.position.set(0, 0.4, 2.2); g.add(cabin);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    rotor.position.y = 1.3; g.add(rotor);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 5), new THREE.MeshLambertMaterial({ color: 0x1a2530 }));
    tail.position.set(0, 0.3, -5); g.add(tail);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 55, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.rotation.x = Math.PI; cone.position.y = -28; g.add(cone);
    group.add(g);
    return { group: g, rotor, cone, angle: 0 };
  }

  function losBlocked(ax, az, bx, bz) {
    // Sample the segment for a building collider in the way.
    for (let t = 0.1; t < 1; t += 0.1) {
      const x = ax + (bx - ax) * t; const z = az + (bz - az) * t;
      if (world.colliderAt(x, z)) return true;
    }
    return false;
  }

  function setRoadblock(px, pz, heading) {
    // Two police cars + barriers across the road ahead of the player.
    clearRoadblocks();
    const fx = Math.sin(heading); const fz = Math.cos(heading);
    const bx = px + fx * 55; const bz = pz + fz * 55;
    const px2 = -fz; const pz2 = fx;
    for (const off of [-5, 5]) {
      const car = spawnUnit(bx + px2 * off, bz + pz2 * off);
      car.state = 'ROADBLOCK';
      car.heading = heading + Math.PI / 2;
      car.speed = 0;
      roadblocks.push(car);
    }
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 0.6), new THREE.MeshLambertMaterial({ color: 0xf2c94c }));
    barrier.position.set(bx, 0.8, bz);
    barrier.rotation.y = heading + Math.PI / 2;
    group.add(barrier);
    roadblocks.push({ barrier, x: bx, z: bz, state: 'ROADBLOCK', callsign: 'BLOCKADE', isBarrier: true });
  }

  function clearRoadblocks() {
    for (const r of roadblocks) {
      if (r.isBarrier) group.remove(r.barrier);
      else { group.remove(r.mesh.group); const i = units.indexOf(r); if (i >= 0) units.splice(i, 1); }
    }
    roadblocks = [];
  }

  return {
    group,
    get wanted() { return wanted; },
    get seen() { return seenNow; },
    get heat() { return heat; },
    get units() { return units; },
    get heli() { return heli; },
    get roadblocks() { return roadblocks; },
    get lastSeen() { return lastSeen; },
    get hiddenTime() { return hiddenTime; },
    addWanted(n, reason) {
      wanted = Math.max(0, Math.min(5, wanted + n));
      heat = Math.min(1, heat + 0.35);
      return wanted;
    },
    setWanted(n) {
      wanted = Math.max(0, Math.min(5, n));
      if (n > 0) heat = 0.8;
      return wanted;
    },
    clearWanted() { wanted = 0; heat = 0; hiddenTime = 0; this.clearAll(); },
    forceRoadblock: setRoadblock,
    setHideSpots(spots) { hideSpots = spots; },
    clearAll() {
      for (const u of units) group.remove(u.mesh.group);
      units.length = 0;
      clearRoadblocks();
      if (heli) { group.remove(heli.group); heli = null; }
    },
    panelData(px, pz) {
      const rows = units.map((u) => ({
        callsign: u.callsign, dist: Math.round(Math.hypot(u.x - px, u.z - pz)),
        state: u.state || 'PURSUIT',
      }));
      if (heli) rows.push({ callsign: 'AIR 1', dist: Math.round(Math.hypot(heli.group.position.x - px, heli.group.position.z - pz)), state: 'SPOTLIGHT' });
      for (const r of roadblocks) if (r.isBarrier) rows.push({ callsign: 'BLOCKADE', dist: Math.round(Math.hypot(r.x - px, r.z - pz)), state: 'ROADBLOCK' });
      return { count: rows.length, code: wanted >= 4 ? 'CODE 3' : wanted >= 2 ? 'CODE 2' : 'CODE 1', rows };
    },
    step(dt, player, inCar, night, worldRef) {
      const px = player.x; const pz = player.z;
      // Spawn / despawn police cars to match the wanted level.
      const wantUnits = wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
      while (units.filter((u) => !roadblocks.includes(u)).length < wantUnits) {
        const a = rng.range(0, Math.PI * 2);
        spawnUnit(px + Math.cos(a) * 90, pz + Math.sin(a) * 90);
      }
      while (units.filter((u) => !roadblocks.includes(u)).length > wantUnits) {
        const u = units.find((x) => !roadblocks.includes(x));
        if (!u) break;
        group.remove(u.mesh.group);
        units.splice(units.indexOf(u), 1);
      }
      // Helicopter from 3 stars.
      if (wanted >= 3 && !heli) { heli = makeHeli(); }
      if (wanted < 3 && heli) { group.remove(heli.group); heli = null; }
      // Roadblocks from 3 stars, refreshed ahead of the player.
      if (wanted >= 3 && roadblocks.length === 0 && rng.chance(dt * 0.25)) {
        setRoadblock(px, pz, player.heading || 0);
      }
      if (wanted < 3 && roadblocks.length) clearRoadblocks();

      // Line of sight: the nearest unit decides whether the player is seen.
      // At a hide spot the player is under cover — neither the ground units
      // nor the helicopter can see them, so the heat can finally fade even
      // at four and five stars. (Without this, a 4-star escape could never
      // complete: the heli sees you forever.)
      const speed = inCar ? Math.abs(inCar.speed) : 0;
      const hidden = hideSpots.some((s) => Math.hypot(s.x - px, s.z - pz) < 18) && (!inCar || speed < 5);
      seenNow = false;
      if (!hidden) {
        for (const u of units) {
          const d = Math.hypot(u.x - px, u.z - pz);
          if (d < 120 && !losBlocked(u.x, u.z, px, pz)) { seenNow = true; break; }
        }
      }
      if (heli && !hidden) seenNow = true; // the eye in the sky always sees you
      if (seenNow) {
        lastSeen = { x: px, z: pz };
        heat = Math.min(1, heat + dt * 0.25);
        hiddenTime = 0;
      } else {
        hiddenTime += dt;
        heat = Math.max(0, heat - dt * 0.12);
      }
      // Stars fade one by one after staying hidden.
      if (wanted > 0 && !seenNow) {
        escapeTimer += dt;
        if (escapeTimer > 14) { wanted -= 1; escapeTimer = 0; heat = 0.6; }
      } else escapeTimer = 0;

      // Chase each unit toward the last seen position.
      for (const u of units) {
        if (roadblocks.includes(u)) { syncCarMesh(u, night); continue; }
        const tx = seenNow ? px : lastSeen.x;
        const tz = seenNow ? pz : lastSeen.z;
        const dx = tx - u.x; const dz = tz - u.z;
        const d = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz);
        let diff = want - u.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const steer = Math.max(-1, Math.min(1, diff * 2));
        const throttle = d > 6 ? 1 : 0.2;
        u.state = d < 10 ? 'RAMMING' : 'PURSUIT';
        const before = { x: u.x, z: u.z };
        stepCar(u, { throttle, steer, handbrake: false }, dt, worldRef, inCar ? [...units, inCar] : units);
        if (Math.hypot(u.x - before.x, u.z - before.z) < 0.05 && d > 8) {
          u.stuck += dt;
          if (u.stuck > 2) { u.heading += Math.PI / 2; u.stuck = 0; }
        } else u.stuck = 0;
        // Ramming damage to the player's car (only when actually moving fast).
        if (d < 4.5 && inCar && Math.abs(u.speed) > 5) inCar.health -= 3 * dt;
        syncCarMesh(u, night);
      }

      // Helicopter circles above the player.
      if (heli) {
        heli.angle += dt * 0.35;
        const hx = px + Math.cos(heli.angle) * 42;
        const hz = pz + Math.sin(heli.angle) * 42;
        heli.group.position.set(hx, 62, hz);
        heli.group.rotation.y = Math.atan2(px - hx, pz - hz);
        heli.rotor.rotation.y += dt * 22;
        heli.cone.material.opacity = night ? 0.22 : 0.08;
      }

      // Busted: on foot, a police car sits on you while you are slow.
      let near = false;
      if (wanted > 0 && !inCar) {
        for (const u of units) {
          if (Math.hypot(u.x - px, u.z - pz) < 3.5) { near = true; break; }
        }
      }
      bustedTimer = near ? bustedTimer + dt : 0;
      return { busted: bustedTimer > 1.6 };
    },
  };
}
