// Solmar Bay 3D — police: pursuit cars, roadblocks, helicopter, sirens.
// Rewritten fresh for Fix Round 2 (spotlight cone scaled to altitude).
import * as THREE from 'three';
import { clamp, dist2d, angleTo, wrapAngle } from './random.js';
import { addRespect } from './config.js';
import { makeCarMesh } from './vehicles.js';

const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'VIPER-07', 'FALCON-32', 'SHARK-19', 'COBRA-03'];

let sirenCounter = 0;

const POLICE_MODEL = { id: 'police', name: 'SBPD Interceptor', top: 46, accel: 22, grip: 3.2, colors: [0x1d3557] };
const ROADBLOCK_MODEL = { id: 'police', name: 'SBPD Interceptor', top: 40, accel: 20, grip: 3, colors: [0x1d3557] };

function addSiren(mesh) {
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.7), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  bar.position.set(0, 1.62, 0);
  mesh.add(bar);
  const domeGeo = new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const red = new THREE.Mesh(domeGeo, redMat);
  red.position.set(-0.38, 1.7, 0);
  mesh.add(red);
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
  const blue = new THREE.Mesh(domeGeo, blueMat);
  blue.position.set(0.38, 1.7, 0);
  mesh.add(blue);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 4.2), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 1.95, 0);
  mesh.add(glow);
  mesh.userData.siren = { red: redMat, blue: blueMat, glow: glowMat, phase: (sirenCounter++ % 2) };
}

function makePoliceMesh(model) {
  const mesh = makeCarMesh(model, 0xffffff);
  addSiren(mesh);
  return mesh;
}

export function createPolice(scene) {
  const meshes = new Map();

  const heli = new THREE.Group();
  heli.visible = false;

  // Rounded cabin (horizontal cylinder, axis front-to-back).
  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 12), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  cabin.rotation.x = Math.PI / 2;
  cabin.position.set(0, 0, 0);
  heli.add(cabin);
  // Glass cockpit nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), new THREE.MeshBasicMaterial({ color: 0x9fd8f2 }));
  nose.scale.set(1, 0.75, 1.1);
  nose.position.set(0, 0.2, -2.6);
  heli.add(nose);
  // Tail boom + fin.
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 5, 8), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.3, 4.2);
  heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  fin.position.set(0, 0.9, 6.4);
  heli.add(fin);
  // Tail rotor (spins around X).
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0, 0.3, 6.9);
  const tailHub = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  tailRotor.add(tailHub);
  const tailBladeGeo = new THREE.BoxGeometry(0.12, 2.2, 0.3);
  const tailBladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const tb1 = new THREE.Mesh(tailBladeGeo, tailBladeMat);
  tb1.position.set(0, 1.1, 0);
  tailRotor.add(tb1);
  const tb2 = new THREE.Mesh(tailBladeGeo, tailBladeMat);
  tb2.position.set(0, -1.1, 0);
  tailRotor.add(tb2);
  heli.add(tailRotor);
  // Main rotor (spins around Y): mast + hub + 4 blades.
  const rotor = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.set(0, 1.4, 0);
  rotor.add(mast);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  hub.position.set(0, 1.85, 0);
  rotor.add(hub);
  const bladeGeo = new THREE.BoxGeometry(5.5, 0.08, 0.5);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const bladePos = [[2.75, 0], [-2.75, 0], [0, 2.75], [0, -2.75]];
  for (const [bx, bz] of bladePos) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(bx, 1.85, bz);
    if (bz !== 0) blade.rotation.y = Math.PI / 2;
    rotor.add(blade);
  }
  heli.add(rotor);
  // Skids + struts.
  const skidGeo = new THREE.BoxGeometry(0.25, 0.25, 4);
  const skidMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (const sx of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(skidGeo, skidMat);
    skid.position.set(sx, -1, 0);
    heli.add(skid);
    for (const sz of [-1.2, 1.2]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), skidMat);
      strut.position.set(sx, -0.6, sz);
      heli.add(strut);
    }
  }
  // Searchlight housing + lens.
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  housing.position.set(0, -1.1, -2.0);
  heli.add(housing);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -1.42, -2.0);
  heli.add(lens);
  // Spotlight cone: apex at +y by default, NO rotation — apex near the heli.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 40, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.set(0, -21, 0);
  heli.add(cone);
  // SpotLight + target.
  const spot = new THREE.SpotLight(0xfff2a8, 80, 120, 0.35, 0.5);
  spot.position.set(0, -1, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -40, 0);
  heli.add(spotTarget);
  spot.target = spotTarget;
  heli.add(spot);
  // Nav lights.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-1.6, 0, 0.5);
  heli.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(1.6, 0, 0.5);
  heli.add(navR);
  const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), strobeMat);
  strobe.position.set(0, 0.3, 5.5);
  heli.add(strobe);

  scene.add(heli);

  // Ground light pool (separate mesh, not a child of the heli).
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.visible = false;
  scene.add(pool);

  meshes.set('heli', heli);
  meshes.set('heliRotor', rotor);
  meshes.set('heliTailRotor', tailRotor);
  meshes.set('heliCone', cone);
  meshes.set('heliPool', pool);
  meshes.set('heliStrobe', strobeMat);
  return meshes;
}

export function spawnPoliceCar(state, scene, meshes, id) {
  const car = {
    id, model: POLICE_MODEL, color: 0xffffff,
    x: state.player.x + 60, z: state.player.z + 40, angle: 0, speed: 0,
    condition: 100, driver: true, parked: false, smoke: 0,
    callsign: CALLSIGNS[state.police.length % CALLSIGNS.length], state: 'PURSUIT',
  };
  state.police.push(car);
  const mesh = makePoliceMesh(POLICE_MODEL);
  scene.add(mesh);
  meshes.set(id, mesh);
  return car;
}

export function updatePolice(state, dt, meshes, scene) {
  const wanted = state.wanted;
  const desired = wanted === 0 ? 0 : wanted;
  while (state.police.length < desired) {
    const id = 'cop' + state.police.length + '_' + Math.floor(state.time * 10);
    spawnPoliceCar(state, scene, meshes, id);
  }
  while (state.police.length > desired) {
    const cop = state.police.pop();
    const m = meshes.get(cop.id);
    if (m) scene.remove(m);
    meshes.delete(cop.id);
  }

  let seen = false;
  const px = state.player.x, pz = state.player.z;
  for (const cop of state.police) {
    const d = dist2d(cop.x, cop.z, px, pz);
    cop.dist = d;
    if (d < 90) seen = true;
    const tx = seen ? px : state.lastSeen.x;
    const tz = seen ? pz : state.lastSeen.z;
    const wantAngle = angleTo(cop.x, cop.z, tx, tz);
    cop.angle += clamp(wrapAngle(wantAngle - cop.angle), -2.4 * dt, 2.4 * dt);
    const top = 30 + wanted * 4;
    cop.speed += (top - cop.speed) * Math.min(1, dt * 0.8);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, -355, 355);
    cop.z = clamp(cop.z, -255, 255);
    if (d < 4.5) {
      cop.state = 'RAMMING';
      cop.speed *= 0.7;
      if (state.player.inCar) {
        const car = state.cars.find((c) => c.id === state.player.carId);
        if (car) {
          car.condition = Math.max(0, car.condition - 0.6 * dt);
          car.speed *= 0.995;
        }
      }
    } else {
      cop.state = 'PURSUIT';
    }
    if (!state.player.inCar && d < 2.5 && wanted > 0) {
      state.busted = true;
      state.gameOver = true;
    }
  }
  state.inSight = seen;
  if (seen) {
    state.lastSeen = { x: px, z: pz };
    state.searchZone = { x: px, z: pz, r: 60 };
    state.heat = Math.max(state.heat, wanted * 20);
  } else {
    state.heat -= dt * 6;
    if (state.heat <= 0 && wanted > 0) {
      state.wanted -= 1;
      state.heat = state.wanted > 0 ? 18 : 0;
      if (state.wanted === 0) {
        state.stats.escapes++;
        addRespect(state, 25);
        state.message = 'You lost them — +25 respect';
        state.messageT = 3;
      }
    }
  }

  // Roadblocks.
  if (wanted >= 3 && state.roadblocks.length === 0) {
    const a = state.player.angle;
    const bx = px + Math.sin(a) * 55;
    const bz = pz + Math.cos(a) * 55;
    for (let i = -1; i <= 1; i++) {
      const rb = {
        id: 'rb' + i,
        x: bx + Math.cos(a) * i * 7,
        z: bz - Math.sin(a) * i * 7,
        angle: a + Math.PI / 2,
        broken: false,
      };
      state.roadblocks.push(rb);
      const mesh = makePoliceMesh(ROADBLOCK_MODEL);
      mesh.position.set(rb.x, 0, rb.z);
      mesh.rotation.y = rb.angle;
      scene.add(mesh);
      meshes.set(rb.id, mesh);
    }
  }
  if (wanted < 3) {
    for (const rb of state.roadblocks) {
      const m = meshes.get(rb.id);
      if (m) scene.remove(m);
      meshes.delete(rb.id);
    }
    state.roadblocks = [];
  }
  for (const rb of state.roadblocks) {
    if (rb.broken) continue;
    if (dist2d(px, pz, rb.x, rb.z) < 5 && Math.abs(state.player.speed) > 14) {
      rb.broken = true;
      const m = meshes.get(rb.id);
      if (m) {
        m.rotation.z = 0.5;
        m.position.y = 0.4;
      }
      addRespect(state, 40);
      state.message = 'Roadblock smashed! +40 respect';
      state.messageT = 3;
      state.flags.roadblockBroken = true;
      if (state.missionActive && (state.missionIndex === 10 || state.missionIndex === 2)) {
        state.flags.missionRoadblock = true;
      }
    }
  }

  // Helicopter (wanted >= 3).
  const heli = meshes.get('heli');
  const pool = meshes.get('heliPool');
  const rotor = meshes.get('heliRotor');
  const tailRotor = meshes.get('heliTailRotor');
  if (wanted >= 3 && heli) {
    heli.visible = true;
    state.heliAngle += dt * 0.35;
    const dist = state.heliDist ?? 26;
    const alt = state.heliAlt ?? 22;
    const hx = px + Math.cos(state.heliAngle) * dist;
    const hz = pz + Math.sin(state.heliAngle) * dist;
    heli.position.set(hx, alt, hz);
    heli.rotation.y = Math.atan2(px - hx, pz - hz);
    if (rotor) rotor.rotation.y += dt * 18;
    if (tailRotor) tailRotor.rotation.x += dt * 30;
    // Scale the spotlight cone to the staged altitude: apex at the heli,
    // base exactly at the ground.
    const cone = meshes.get('heliCone');
    if (cone) {
      const len = alt - 0.1;
      cone.position.y = -len / 2;
      cone.scale.y = len / 40;
    }
    if (pool) {
      pool.position.set(hx, 0.1, hz);
      pool.visible = heli.visible;
    }
    if (state.heli) {
      state.heli.x = hx;
      state.heli.z = hz;
    } else {
      state.heli = { x: hx, z: hz };
    }
  } else {
    if (heli) heli.visible = false;
    if (pool) pool.visible = false;
  }
}

export function syncPoliceMeshes(meshes, state) {
  for (const cop of state.police) {
    const m = meshes.get(cop.id);
    if (!m) continue;
    m.position.set(cop.x, 0, cop.z);
    m.rotation.y = cop.angle;
    const siren = m.userData.siren;
    if (siren) {
      const on = Math.floor(state.time * 6 + siren.phase) % 2 === 0;
      siren.red.color.setHex(on ? 0xff2a2a : 0x551111);
      siren.blue.color.setHex(on ? 0x141448 : 0x2a5cff);
      siren.glow.color.setHex(on ? 0xff2a2a : 0x2a5cff);
      siren.glow.opacity = 0.5;
    }
  }
  for (const rb of state.roadblocks) {
    if (rb.broken) continue;
    const m = meshes.get(rb.id);
    if (!m) continue;
    m.position.set(rb.x, 0, rb.z);
    m.rotation.y = rb.angle;
    const siren = m.userData.siren;
    if (siren) {
      const on = Math.floor(state.time * 6 + siren.phase) % 2 === 0;
      siren.red.color.setHex(on ? 0xff2a2a : 0x551111);
      siren.blue.color.setHex(on ? 0x141448 : 0x2a5cff);
      siren.glow.color.setHex(on ? 0xff2a2a : 0x2a5cff);
      siren.glow.opacity = 0.5;
    }
  }
  const strobe = meshes.get('heliStrobe');
  if (strobe) strobe.color.setHex(Math.floor(state.time * 2) % 2 === 0 ? 0xffffff : 0x333333);
}

export function policePanelRows(state) {
  const rows = [];
  for (let i = 0; i < Math.min(5, state.police.length); i++) {
    const c = state.police[i];
    rows.push({ callsign: c.callsign, dist: Math.round(c.dist ?? 0), state: c.state });
  }
  if (state.heli && state.wanted >= 3) {
    rows.push({ callsign: 'AIR-1', dist: Math.round(dist2d(state.heli.x, state.heli.z, state.player.x, state.player.z)), state: 'SPOTLIGHT' });
  }
  const unbroken = state.roadblocks.filter((rb) => !rb.broken).length;
  if (unbroken > 0) {
    rows.push({ callsign: 'TAC-45', dist: 70, state: 'ROADBLOCK' });
  }
  return rows;
}
