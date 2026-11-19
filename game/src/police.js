// Police, roadblocks and the news helicopter for Solmar Bay 3D.
//
// The chase reads only when every police unit stays on the asphalt: pursuit
// cars spawn on the road the player is driving on, chase along that road,
// and the roadblock parks across the lanes facing the same way as traffic.
// The helicopter keeps its spotlight on the chased car, never on the ground
// underneath itself.
import * as THREE from 'three';
import { clamp, dist2d, angleTo, wrapAngle } from './random.js';
import { addRespect } from './config.js';
import { makeCarMesh } from './vehicles.js';

const CALLSIGNS = ['PELICAN-11', 'GECKO-25', 'BARRACUDA-18', 'TAC-45', 'VIPER-07', 'FALCON-32', 'SHARK-19', 'COBRA-03'];
const PURSUIT_MODEL = { id: 'police', name: 'SBPD Interceptor', top: 46, accel: 22, grip: 3.2, colors: [0x1d3557] };
const ROADBLOCK_MODEL = { id: 'police', name: 'SBPD Interceptor', top: 40, accel: 20, grip: 3, colors: [0x1d3557] };
const ROAD_STEP = 60;

// Chase formation used only while a deterministic screenshot scene is
// staged: the camera sits ~12 m behind the player car, so a cop trailing
// far back would be behind the lens, and one hugging the bumper would fill
// the frame with its roof. These three slots hug the player car on the
// same road instead — one just behind in the right lane, one pulling
// alongside on the left, one just ahead in the right lane — so the pack
// reads as a chase from the chase camera without crowding the lens.
export const COP_SHOT_SLOTS = [
  { along: -2, lane: 2.5 },
  { along: 2, lane: -2.5 },
  { along: 6, lane: 2.5 },
  { along: -6, lane: -2.5 },
  { along: 10, lane: -2.5 },
];

let sirenCounter = 0;

// --- Road geometry ------------------------------------------------------
// Roads run on a 60 m grid: vertical roads at x = k*60, horizontal roads
// at z = k*60, asphalt 10 m wide. A car moves as x += sin(angle)*v*dt,
// z += cos(angle)*v*dt, so angle 0 is +z, PI/2 is +x.

function nearestLine(value) {
  return Math.round(value / ROAD_STEP) * ROAD_STEP;
}

// The road the player is travelling on, snapped from the player's heading:
// the dominant heading component picks the axis, the nearest grid line
// picks the centreline, and the heading sign picks the direction of travel.
export function playerRoad(state) {
  const a = state.player.angle;
  const sx = Math.sin(a);
  const cz = Math.cos(a);
  if (Math.abs(sx) >= Math.abs(cz)) {
    const dir = sx >= 0 ? 1 : -1;
    return { axis: 'x', line: nearestLine(state.player.z), dir, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const dir = cz >= 0 ? 1 : -1;
  return { axis: 'z', line: nearestLine(state.player.x), dir, angle: dir > 0 ? 0 : Math.PI };
}

// Split a world position into the along-road and across-road coordinates of
// a road frame, and rebuild a world position from them.
export function alongOf(road, x, z) {
  return road.axis === 'x' ? x : z;
}

export function crossOf(road, x, z) {
  return road.axis === 'x' ? z - road.line : x - road.line;
}

export function roadPoint(road, along, cross) {
  if (road.axis === 'x') return { x: along, z: road.line + cross };
  return { x: road.line + cross, z: along };
}

// The three roadblock parking spots, `ahead` metres in front of the player
// on the player's own road: spread at most +/-2.5 m from the centreline so
// every car sits on the 10 m asphalt, all facing along the road.
export function roadblockSlots(state, ahead) {
  const road = playerRoad(state);
  const pAlong = alongOf(road, state.player.x, state.player.z);
  const centre = pAlong + ahead * road.dir;
  return [-2.5, 0, 2.5].map((lane) => {
    const p = roadPoint(road, centre, lane);
    return { x: p.x, z: p.z, angle: road.angle };
  });
}

// --- Meshes --------------------------------------------------------------

function addSiren(mesh) {
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.18, 0.7),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  bar.position.set(0, 1.62, 0);
  mesh.add(bar);
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  const red = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), redMat);
  red.position.set(-0.38, 1.7, 0);
  mesh.add(red);
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
  const blue = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), blueMat);
  blue.position.set(0.38, 1.7, 0);
  mesh.add(blue);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xff2222, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 1.95, 0);
  mesh.add(glow);
  mesh.userData.siren = { red: redMat, blue: blueMat, glow: glowMat, phase: sirenCounter++ % 2 };
}

function makePoliceMesh(model) {
  const mesh = makeCarMesh(model || PURSUIT_MODEL, 0xffffff);
  addSiren(mesh);
  return mesh;
}

export function createPolice(scene) {
  const meshes = new Map();
  const heli = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d3557 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.5, 12), navy);
  body.rotation.x = Math.PI / 2;
  heli.add(body);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 80, specular: 0xffffff }));
  glass.scale.set(1, 0.75, 1.1);
  glass.position.set(0, 0.2, -2.6);
  heli.add(glass);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 5, 8), navy);
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.3, 4.2);
  heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), navy);
  fin.position.set(0, 0.9, 6.4);
  heli.add(fin);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0, 0.3, 6.9);
  tailRotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshLambertMaterial({ color: 0x222222 })));
  for (const by of [1.1, -1.1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    blade.position.set(0, by, 0);
    tailRotor.add(blade);
  }
  heli.add(tailRotor);
  const rotor = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  mast.position.set(0, 1.4, 0);
  rotor.add(mast);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  hub.position.set(0, 1.85, 0);
  rotor.add(hub);
  for (const [bx, bz, bw, bd] of [[2.75, 0, 5.5, 0.5], [-2.75, 0, 5.5, 0.5], [0, 2.75, 0.5, 5.5], [0, -2.75, 0.5, 5.5]]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.08, bd), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    blade.position.set(bx, 1.85, bz);
    rotor.add(blade);
  }
  heli.add(rotor);
  for (const sx of [-1.2, 1.2]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    skid.position.set(sx, -1, 0);
    heli.add(skid);
    for (const sz of [-1.2, 1.2]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), new THREE.MeshLambertMaterial({ color: 0x333333 }));
      strut.position.set(sx, -0.6, sz);
      heli.add(strut);
    }
  }
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  housing.position.set(0, -1.1, -2.0);
  heli.add(housing);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.45, 12), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -1.42, -2.0);
  heli.add(lens);
  // Searchlight beam: a cone whose apex sits at the helicopter and whose
  // base lands on the target. Its tilt and length are set every frame in
  // updatePolice so the beam connects the heli to the player car.
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(4.5, 40, 14, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.position.set(0, -21, 0);
  heli.add(cone);
  const spot = new THREE.SpotLight(0xfff2a8, 80, 120, 0.35, 0.5);
  spot.position.set(0, -1, 0);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -40, 0);
  heli.add(spotTarget);
  spot.target = spotTarget;
  heli.add(spot);
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
  heli.visible = false;
  scene.add(heli);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(5, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.visible = false;
  scene.add(pool);
  meshes.set('heli', heli);
  meshes.set('heliRotor', rotor);
  meshes.set('heliTailRotor', tailRotor);
  meshes.set('heliCone', cone);
  meshes.set('heliPool', pool);
  meshes.set('heliSpotTarget', spotTarget);
  meshes.set('heliStrobe', strobeMat);
  return meshes;
}

// --- Spawning ------------------------------------------------------------

export function spawnPoliceCar(state, scene, meshes, id) {
  const road = playerRoad(state);
  const pAlong = alongOf(road, state.player.x, state.player.z);
  const n = state.police.length % 3;
  let spot;
  if (state.cameraShot) {
    // Staged chase scene: park the pack around the player car (see
    // COP_SHOT_SLOTS) so all three are inside the chase camera's frame.
    const slot = COP_SHOT_SLOTS[n];
    spot = roadPoint(road, pAlong + slot.along * road.dir, slot.lane);
  } else {
    // Live play: stagger the pursuit behind the player, in the lanes.
    const back = 12 + n * 8;
    const lane = (n - 1) * 2.2;
    spot = roadPoint(road, pAlong - back * road.dir, lane);
  }
  const car = {
    id, model: PURSUIT_MODEL, color: 0xffffff,
    x: spot.x, z: spot.z, angle: road.angle, speed: 0,
    condition: 100, driver: true, parked: false, smoke: 0,
    callsign: CALLSIGNS[state.police.length % CALLSIGNS.length],
    state: 'PURSUIT', lane: state.cameraShot ? COP_SHOT_SLOTS[n].lane : (n - 1) * 2.2, slot: n,
  };
  state.police.push(car);
  const mesh = makePoliceMesh(PURSUIT_MODEL);
  mesh.position.set(car.x, 0, car.z);
  mesh.rotation.y = car.angle;
  scene.add(mesh);
  meshes.set(id, mesh);
  return car;
}

// --- Per-frame update ----------------------------------------------------

export function updatePolice(state, dt, meshes, scene) {
  const wanted = state.wanted;
  const desired = wanted === 0 ? 0 : wanted === 1 ? 1 : wanted === 2 ? 2 : wanted === 3 ? 3 : wanted === 4 ? 4 : 5;
  while (state.police.length < desired) {
    spawnPoliceCar(state, scene, meshes, 'cop' + state.police.length + '_' + Math.floor(state.time * 10));
  }
  while (state.police.length > desired) {
    const cop = state.police.pop();
    const m = meshes.get(cop.id);
    if (m) scene.remove(m);
    meshes.delete(cop.id);
  }
  let seen = false;
  for (const cop of state.police) {
    const d = dist2d(cop.x, cop.z, state.player.x, state.player.z);
    cop.dist = Math.round(d);
    if (d < 90) seen = true;
  }
  // In a staged screenshot scene the chase formation is placed by main.js
  // every step, so the pursuit steering below stays out of the way there.
  if (!state.cameraShot) {
    for (const cop of state.police) {
      const road = playerRoad(state);
      const pAlong = alongOf(road, state.player.x, state.player.z);
      const cAlong = alongOf(road, cop.x, cop.z);
      const cCross = crossOf(road, cop.x, cop.z);
      const top = wanted >= 5 ? 56 : 30 + wanted * 4;
      cop.speed += (top - cop.speed) * Math.min(1, dt * 0.8);
      if (Math.abs(cCross) <= 6) {
        // On the player's road: drive along it toward the player's
        // along-road position, easing back into the assigned lane. The car
        // always faces along the road, never across blocks or grass.
        const travel = pAlong - cAlong;
        const dirAlong = travel === 0 ? road.dir : Math.sign(travel);
        let stepLen = cop.speed * dt;
        if (Math.abs(travel) < stepLen) stepLen = Math.abs(travel);
        const nextAlong = cAlong + dirAlong * stepLen;
        const nextCross = cCross + (cop.lane - cCross) * Math.min(1, dt * 2.5);
        cop.angle = dirAlong === road.dir ? road.angle : road.angle + Math.PI;
        const pos = roadPoint(road, nextAlong, nextCross);
        cop.x = clamp(pos.x, -355, 355);
        cop.z = clamp(pos.z, -255, 255);
      } else {
        // Off the road (the player just turned onto a cross street): steer
        // toward a point on the player's road behind the player, so the
        // car rejoins the road instead of cutting across the block.
        const join = roadPoint(road, pAlong - 15 * road.dir, cop.lane);
        const wantAngle = angleTo(cop.x, cop.z, join.x, join.z);
        cop.angle += clamp(wrapAngle(wantAngle - cop.angle), -2.4 * dt, 2.4 * dt);
        cop.x += Math.sin(cop.angle) * cop.speed * dt;
        cop.z += Math.cos(cop.angle) * cop.speed * dt;
        cop.x = clamp(cop.x, -355, 355);
        cop.z = clamp(cop.z, -255, 255);
      }
      const d = dist2d(cop.x, cop.z, state.player.x, state.player.z);
      cop.dist = Math.round(d);
      if (d < 4.5) {
        cop.state = 'RAMMING';
        cop.speed *= 0.7;
        if (state.player.inCar) {
          const pc = state.cars.find((c) => c.id === state.player.carId);
          if (pc) { pc.condition = Math.max(0, pc.condition - 0.6 * dt); pc.speed *= 0.995; }
        }
      } else {
        cop.state = 'PURSUIT';
      }
      if (!state.player.inCar && d < 2.5 && wanted > 0) {
        state.busted = true;
        state.gameOver = true;
      }
    }
  } else {
    for (const cop of state.police) cop.state = 'PURSUIT';
  }
  state.inSight = seen;
  if (seen) {
    state.lastSeen = { x: state.player.x, z: state.player.z };
    state.searchZone = { x: state.player.x, z: state.player.z, r: 60 };
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
  if (wanted >= 3 && state.roadblocks.length === 0) {
    const slots = roadblockSlots(state, 55);
    for (let i = 0; i < slots.length; i++) {
      const rb = { id: 'rb' + (i - 1), x: slots[i].x, z: slots[i].z, angle: slots[i].angle, broken: false };
      state.roadblocks.push(rb);
      const mesh = makePoliceMesh(ROADBLOCK_MODEL);
      mesh.position.set(rb.x, 0, rb.z);
      mesh.rotation.y = rb.angle;
      scene.add(mesh);
      meshes.set(rb.id, mesh);
    }
  }
  // Five stars: maximum response — a second roadblock line further ahead,
  // so the player has to break through two walls of cars.
  if (wanted >= 5 && state.roadblocks.length === 3) {
    const slots = roadblockSlots(state, 85);
    for (let i = 0; i < slots.length; i++) {
      const rb = { id: 'rb2' + (i - 1), x: slots[i].x, z: slots[i].z, angle: slots[i].angle, broken: false };
      state.roadblocks.push(rb);
      const mesh = makePoliceMesh(ROADBLOCK_MODEL);
      mesh.position.set(rb.x, 0, rb.z);
      mesh.rotation.y = rb.angle;
      scene.add(mesh);
      meshes.set(rb.id, mesh);
    }
  }
  if (wanted < 3 && state.roadblocks.length > 0) {
    for (const rb of state.roadblocks) {
      const m = meshes.get(rb.id);
      if (m) scene.remove(m);
      meshes.delete(rb.id);
    }
    state.roadblocks = [];
  }
  // A ram only counts in live play. In a staged shot the roadblock is
  // re-parked every frame, so a break there would only tip the cars over
  // and change the shot's mission text and respect for no reason.
  if (!state.cameraShot) {
    for (const rb of state.roadblocks) {
      if (rb.broken) continue;
      if (dist2d(state.player.x, state.player.z, rb.x, rb.z) < 5 && Math.abs(state.player.speed) > 14) {
        rb.broken = true;
        const m = meshes.get(rb.id);
        if (m) { m.rotation.z = 0.5; m.position.y = 0.4; }
        addRespect(state, 40);
        state.message = 'Roadblock smashed! +40 respect';
        state.messageT = 3;
        state.flags.roadblockBroken = true;
        if (state.missionActive && (state.missionIndex === 10 || state.missionIndex === 2)) state.flags.missionRoadblock = true;
      }
    }
  }
  // --- Helicopter: spotlight tracks the chased car, every frame. ---
  const heli = meshes.get('heli');
  const pool = meshes.get('heliPool');
  const rotor = meshes.get('heliRotor');
  const tailRotor = meshes.get('heliTailRotor');
  const cone = meshes.get('heliCone');
  const spotTarget = meshes.get('heliSpotTarget');
  if (wanted >= 3 && heli) {
    // Five stars: the helicopter closes in — nearer, so the spotlight
    // stays glued to the player and escape gets much harder. Altitude is
    // untouched: in staged shots a lower heli would clip the chase cars.
    const dist = wanted >= 5 ? (state.heliDist ?? 26) * 0.85 : (state.heliDist ?? 26);
    const alt = state.heliAlt ?? 22;
    let hy = alt - 4;
    let hx;
    let hz;
    if (state.cameraShot) {
      // Frozen orbit: park the heli ahead and above the player, inside the
      // chase camera's frustum. The camera pitches down ~14 degrees, so the
      // top of the frame is only ~17 degrees above horizontal: a high, close
      // heli gets its body cropped by the top edge. Parking it farther ahead
      // and lower drops it to the upper part of the frame, body and all,
      // with its beam still slanting down onto the player car.
      const road = playerRoad(state);
      const fwdX = Math.sin(road.angle);
      const fwdZ = Math.cos(road.angle);
      const rightX = Math.cos(road.angle);
      const rightZ = -Math.sin(road.angle);
      const ahead = dist * 1.1;
      const side = 5;
      hy = alt - 7;
      hx = state.player.x + fwdX * ahead + rightX * side;
      hz = state.player.z + fwdZ * ahead + rightZ * side;
    } else {
      state.heliAngle += dt * 0.35;
      hx = state.player.x + Math.cos(state.heliAngle) * dist;
      hz = state.player.z + Math.sin(state.heliAngle) * dist;
    }
    heli.visible = true;
    heli.position.set(hx, hy, hz);
    heli.rotation.y = Math.atan2(state.player.x - hx, state.player.z - hz);
    if (rotor) rotor.rotation.y += dt * 18;
    if (tailRotor) tailRotor.rotation.x += dt * 30;
    // Aim everything at the player car: the pool lands under the car, the
    // beam tilts from the heli down to the car with its tip on the car, and
    // the spotlight target sits on the car.
    const dx = state.player.x - hx;
    const dz = state.player.z - hz;
    const horiz = Math.hypot(dx, dz);
    const slant = Math.hypot(horiz, hy);
    const tilt = Math.atan2(horiz, hy);
    if (cone) {
      cone.scale.set(1, slant / 40, 1);
      cone.rotation.x = -tilt;
      cone.position.set(0, -(slant / 2) * Math.cos(tilt), (slant / 2) * Math.sin(tilt));
    }
    if (spotTarget) spotTarget.position.set(0, -hy, horiz);
    if (pool) { pool.position.set(state.player.x, 0.1, state.player.z); pool.visible = true; }
    if (state.heli) { state.heli.x = hx; state.heli.z = hz; }
    else state.heli = { x: hx, z: hz };
  } else {
    if (heli) heli.visible = false;
    if (pool) pool.visible = false;
    state.heli = null;
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
    if (rb.broken) continue;
    const m = meshes.get(rb.id);
    if (!m) continue;
    m.position.set(rb.x, 0, rb.z);
    m.rotation.y = rb.angle;
  }
  const flash = (siren) => {
    const on = Math.floor(state.time * 6 + siren.phase) % 2 === 0;
    siren.red.color.setHex(on ? 0xff2a2a : 0x551111);
    siren.blue.color.setHex(on ? 0x141448 : 0x2a5cff);
    siren.glow.color.setHex(on ? 0xff2a2a : 0x2a5cff);
    siren.glow.opacity = 0.22;
  };
  for (const cop of state.police) {
    const m = meshes.get(cop.id);
    if (m && m.userData.siren) flash(m.userData.siren);
  }
  for (const rb of state.roadblocks) {
    const m = meshes.get(rb.id);
    if (m && m.userData.siren) flash(m.userData.siren);
  }
  const strobe = meshes.get('heliStrobe');
  if (strobe) strobe.color.setHex(Math.floor(state.time * 2) % 2 === 0 ? 0xffffff : 0x333333);
}

export function policePanelRows(state) {
  const rows = [];
  for (const c of state.police.slice(0, 5)) rows.push({ callsign: c.callsign, dist: c.dist ?? 0, state: c.state });
  if (state.heli && state.wanted >= 3) {
    rows.push({ callsign: 'AIR-1', dist: Math.round(dist2d(state.heli.x, state.heli.z, state.player.x, state.player.z)), state: 'SPOTLIGHT' });
  }
  if (state.roadblocks.filter((r) => !r.broken).length > 0) rows.push({ callsign: 'TAC-45', dist: 70, state: 'ROADBLOCK' });
  return rows;
}
