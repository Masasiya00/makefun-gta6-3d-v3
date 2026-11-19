// Police and the wanted system for Solmar Bay 3D: pursuit cars, the
// helicopter with its searchlight, roadblocks, line of sight, the search
// zone, and escaping the heat.
import * as THREE from 'three';
import { clamp, dist2d, angleTo, wrapAngle } from './random.js';
import { addRespect } from './config.js';
import { makeCarMesh } from './vehicles.js';

const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'VIPER-07', 'FALCON-32', 'SHARK-19', 'COBRA-03'];

export function createPolice(scene) {
  const meshes = new Map();
  // Helicopter: body, tail, rotor, spotlight cone.
  const heli = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  body.castShadow = true; heli.add(body);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 1.6), new THREE.MeshLambertMaterial({ color: 0x9fd8f2 }));
  glass.position.set(0, 0.3, -2.2); heli.add(glass);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.5), new THREE.MeshLambertMaterial({ color: 0x1d3557 }));
  tail.position.set(0, 0.3, 4); heli.add(tail);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.15, 0.7), new THREE.MeshLambertMaterial({ color: 0x222222 }));
  rotor.position.y = 1.2; heli.add(rotor);
  const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  skidL.position.set(-1.2, -1, 0); heli.add(skidL);
  const skidR = skidL.clone(); skidR.position.x = 1.2; heli.add(skidR);
  const coneGeo = new THREE.ConeGeometry(5, 42, 14, 1, true);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }));
  cone.rotation.x = Math.PI; cone.position.y = -22; heli.add(cone);
  const spot = new THREE.SpotLight(0xfff2a8, 60, 120, 0.35, 0.5);
  spot.position.set(0, -1, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -40, 0);
  heli.add(spotTarget); spot.target = spotTarget; heli.add(spot);
  heli.visible = false;
  scene.add(heli);
  meshes.set('heli', heli);
  meshes.set('heliRotor', rotor);
  meshes.set('heliCone', cone);
  return meshes;
}

export function spawnPoliceCar(state, scene, meshes, id) {
  const model = { id: 'police', name: 'SBPD Interceptor', top: 46, accel: 22, grip: 3.2, colors: [0x1d3557] };
  const car = {
    id, model, color: 0xffffff, x: state.player.x + 60, z: state.player.z + 40,
    angle: 0, speed: 0, condition: 100, driver: true, parked: false, smoke: 0,
    callsign: CALLSIGNS[state.police.length % CALLSIGNS.length], state: 'PURSUIT',
  };
  state.police.push(car);
  const mesh = makeCarMesh(model, 0xffffff);
  // Police livery: dark blue body with white doors is approximated by a blue roof bar.
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  bar.position.set(0, 1.7, -0.2); mesh.add(bar);
  const bar2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
  bar2.position.set(0, 1.7, 0.3); mesh.add(bar2);
  scene.add(mesh); meshes.set(id, mesh);
  return car;
}

export function updatePolice(state, dt, meshes, scene) {
  const wanted = state.wanted;
  // Desired unit count grows with stars.
  const wantUnits = wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
  while (state.police.length < wantUnits) spawnPoliceCar(state, scene, meshes, 'cop' + state.police.length + '_' + Math.floor(state.time * 10));
  while (state.police.length > wantUnits) {
    const gone = state.police.pop();
    const m = meshes.get(gone.id);
    if (m) { scene.remove(m); meshes.delete(gone.id); }
  }
  // Line of sight: police see the player when close and roughly in front of a unit.
  let seen = false;
  for (const cop of state.police) {
    const d = dist2d(cop.x, cop.z, state.player.x, state.player.z);
    cop.dist = Math.round(d);
    if (d < 90) seen = true;
    // Chase: steer toward the player's last seen position.
    const target = seen ? { x: state.player.x, z: state.player.z } : state.lastSeen;
    const wantAngle = angleTo(cop.x, cop.z, target.x, target.z);
    const diff = wrapAngle(wantAngle - cop.angle);
    cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const top = 30 + wanted * 4;
    cop.speed += (top - cop.speed) * Math.min(1, dt * 0.8);
    cop.x += Math.sin(cop.angle) * cop.speed * dt;
    cop.z += Math.cos(cop.angle) * cop.speed * dt;
    cop.x = clamp(cop.x, -355, 355); cop.z = clamp(cop.z, -255, 255);
    // Ramming: if very close, shove the player's car and damage it.
    if (d < 4.5) {
      cop.state = 'RAMMING';
      cop.speed *= 0.7;
      if (state.player.inCar) {
        const car = state.cars.find((c) => c.id === state.player.carId);
        if (car) { car.condition = Math.max(0, car.condition - 0.6 * dt); car.speed *= 0.995; }
      }
    } else if (d < 25) cop.state = 'PURSUIT';
    else cop.state = 'PURSUIT';
    // Busted: caught on foot at close range.
    if (!state.player.inCar && d < 2.5 && wanted > 0) {
      state.busted = true; state.gameOver = true;
    }
  }
  state.inSight = seen;
  if (seen) {
    state.lastSeen.x = state.player.x; state.lastSeen.z = state.player.z;
    state.searchZone.x = state.player.x; state.searchZone.z = state.player.z;
    state.heat = Math.max(state.heat, wanted * 20);
  } else {
    // Out of sight: heat fades, then stars drop one by one.
    state.heat -= dt * 6;
    if (state.heat <= 0 && wanted > 0) {
      state.wanted -= 1; state.heat = state.wanted > 0 ? 18 : 0;
      if (state.wanted === 0) { state.stats.escapes++; addRespect(state, 25); state.message = 'You lost them — +25 respect'; state.messageT = 3; }
    }
  }
  // Helicopter from 3 stars.
  const heli = meshes.get('heli');
  if (heli) {
    heli.visible = wanted >= 3;
    if (wanted >= 3) {
      state.heliAngle += dt * 0.35;
      const hx = state.player.x + Math.cos(state.heliAngle) * 26;
      const hz = state.player.z + Math.sin(state.heliAngle) * 26;
      heli.position.set(hx, 22, hz);
      heli.rotation.y = Math.atan2(state.player.x - hx, state.player.z - hz);
      const rotor = meshes.get('heliRotor');
      if (rotor) rotor.rotation.y += dt * 18;
      if (state.heli) { state.heli.x = hx; state.heli.z = hz; }
      else state.heli = { x: hx, z: hz };
    }
  }
  // Roadblocks from 3 stars: a line of police cars ahead of the player.
  if (wanted >= 3 && state.roadblocks.length === 0) {
    const a = state.player.angle;
    const bx = state.player.x + Math.sin(a) * 55;
    const bz = state.player.z + Math.cos(a) * 55;
    for (let i = -1; i <= 1; i++) {
      const rb = { id: 'rb' + i, x: bx + Math.cos(a) * i * 7, z: bz - Math.sin(a) * i * 7, angle: a + Math.PI / 2, broken: false };
      state.roadblocks.push(rb);
      const mesh = makeCarMesh({ id: 'police', name: 'SBPD Interceptor', top: 40, accel: 20, grip: 3, colors: [0x1d3557] }, 0xffffff);
      mesh.position.set(rb.x, 0, rb.z); mesh.rotation.y = rb.angle;
      scene.add(mesh); meshes.set(rb.id, mesh);
    }
  }
  if (wanted < 3) {
    for (const rb of state.roadblocks) { const m = meshes.get(rb.id); if (m) { scene.remove(m); meshes.delete(rb.id); } }
    state.roadblocks = [];
  }
  // Ram a roadblock: driving through it at speed breaks it.
  for (const rb of state.roadblocks) {
    if (!rb.broken && dist2d(state.player.x, state.player.z, rb.x, rb.z) < 5) {
      if (Math.abs(state.player.speed || 0) > 14) {
        rb.broken = true;
        const m = meshes.get(rb.id);
        if (m) { m.rotation.z = 0.5; m.position.y = 0.4; }
        addRespect(state, 40);
        state.message = 'Roadblock smashed! +40 respect'; state.messageT = 3;
        state.flags.roadblockBroken = true;
        if (state.missionActive && (state.missionIndex === 10 || state.missionIndex === 2)) {
          state.flags.missionRoadblock = true;
        }
      }
    }
  }
}

export function syncPoliceMeshes(meshes, state) {
  for (const cop of state.police) {
    const m = meshes.get(cop.id);
    if (!m) continue;
    m.position.set(cop.x, 0, cop.z);
    m.rotation.y = cop.angle;
  }
  for (const rb of state.roadblocks) {
    const m = meshes.get(rb.id);
    if (!m) continue;
    if (!rb.broken) { m.position.set(rb.x, 0, rb.z); m.rotation.y = rb.angle; }
  }
}

export function policePanelRows(state) {
  const rows = state.police.slice(0, 5).map((c) => ({
    callsign: c.callsign, dist: c.dist ?? 0, state: c.state,
  }));
  if (state.heli && state.wanted >= 3) rows.push({ callsign: 'AIR-1', dist: Math.round(dist2d(state.heli.x, state.heli.z, state.player.x, state.player.z)), state: 'SPOTLIGHT' });
  const rb = state.roadblocks.filter((r) => !r.broken).length;
  if (rb > 0) rows.push({ callsign: 'TAC-45', dist: 70, state: 'ROADBLOCK' });
  return rows;
}
