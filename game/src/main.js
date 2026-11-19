// SOLMAR BAY 3D — boot, the fixed-step loop, screens and the glue between
// every system. The simulation advances in fixed 1/60 s steps; rendering,
// the HUD and audio only read the state, never change it.
// ?shot=chase|city|mission|night&seed=7 stages a deterministic screenshot
// scene. ?autoplay runs a scripted self-test and reports pass or fail.
import * as THREE from 'three';
import { STEP, WORLD, ROADS_X, ROADS_Z, MISSIONS, SHOPS, WEAPONS, CARS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createPlayer, stepPlayer, syncPlayerMesh } from './player.js';
import { createCar, stepCar, syncCarMesh } from './vehicles.js';
import { createCrowd, createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createShops, rankFor } from './shops.js';
import { createHud } from './hud.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { stageShot, createAutoplay } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;
const autoplayOn = params.has('autoplay');
const rng = createRandom(seed);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 6000);

const audio = createAudio();
const input = createInput(canvas);
const hud = createHud();
const world = createWorld(THREE, rng);
scene.add(world.group);
scene.fog = world.fog;

const player = createPlayer(THREE);
scene.add(player.group);
const crowd = createCrowd(THREE, rng, world, 60);
scene.add(crowd.group);
const traffic = createTraffic(THREE, rng, world, 35);
scene.add(traffic.group);
const police = createPolice(THREE, rng, world);
scene.add(police.group);
const combat = createCombat(THREE, scene, rng);
const missions = createMissions(rng);
const shops = createShops();

// --- The single game state object. ---
const S = {
  scene, camera, renderer, world, player, police, missions, combat, hud, audio,
  money: 500, respect: 0, health: 100, armour: 0,
  weaponsOwned: ['fists'], ammo: {}, weaponId: 'fists',
  ownedCars: [], car: null, inCar: false,
  clock: 17.5, day: 1, screen: 'title',
  camYaw: 0, camPitch: 0.32, camDist: 10,
  dialogueOpen: false, shopOpen: false, wheelOpen: false,
  time: 0, frame: 0, fps: 0, fpsCount: 0, fpsTime: 0,
  autopilot: null, // {target:{x,z}, enterCar:bool, hide:bool, circuit:bool}
  lastPoliceContact: -99, bustedLoss: 0, victoryShown: false,
  parked: [],
};
S.state = S; // the state object is its own snapshot handle

function announce(msg) { statusEl.textContent = msg; }

// --- Cars parked around the city (stealable) and the mission cars. ---
function spawnParked() {
  for (const [x, z] of [[-1150, -380], [-1120, -460], [180, -180], [220, -230], [620, -180], [980, -940], [-1420, 300], [420, 160], [1020, 620], [-580, 980]]) {
    const def = CARS[Math.floor(rng.next() * CARS.length)];
    const car = createCar(THREE, def.id, def.colors[0], x, z, rng.range(0, Math.PI * 2));
    car.hasDriver = false;
    scene.add(car.mesh.group);
    S.parked.push(car);
  }
}
spawnParked();

// Cash / health / armour pickups scattered on the sidewalks.
function spawnPickups() {
  for (let i = 0; i < 22; i += 1) {
    const rp = world.roadPoints[Math.floor(rng.next() * world.roadPoints.length)];
    const kind = i % 3 === 0 ? 'health' : i % 3 === 1 ? 'armour' : 'cash';
    combat.spawnPickup(kind, rp.x + 9 + rng.range(-2, 2), rp.z + rng.range(-160, 160), kind === 'cash' ? rng.int(20, 80) : 25);
  }
}
spawnPickups();

function allCars() {
  const list = [...traffic.cars, ...S.parked, ...police.units];
  if (S.car) list.push(S.car);
  return list;
}

function nearestEnterableCar(maxD) {
  let best = null; let bd = maxD;
  for (const c of [...traffic.cars, ...S.parked]) {
    if (c.wrecked || c === S.car) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  if (!car) return false;
  if (car.hasDriver) {
    car.hasDriver = false;
    police.addWanted(1, 'carjacking');
    hud.toast('Car stolen — wanted level up!');
  } else if (!S.parked.includes(car) || !car.ownedByPlayer) {
    police.addWanted(1, 'stolen car');
    hud.toast('Stolen car — wanted level up!');
  }
  S.car = car;
  S.inCar = true;
  car.isPlayer = true;
  player.group.visible = false;
  audio.click();
  return true;
}

function exitCar() {
  if (!S.car) return;
  const car = S.car;
  car.isPlayer = false;
  const sx = Math.cos(car.heading); const sz = -Math.sin(car.heading);
  player.x = car.x + sx * 2.4; player.z = car.z + sz * 2.4;
  player.y = 0; player.heading = car.heading;
  player.group.visible = true;
  if (!S.parked.includes(car)) S.parked.push(car);
  S.car = null; S.inCar = false;
  audio.click();
}

// --- Missions: start, briefing, completion. ---
function startMission(id) {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return false;
  if (id > missions.unlocked) { hud.toast('Finish the previous mission first.'); return false; }
  // A fresh attempt starts clean: back to play, full health.
  S.screen = 'play';
  S.dialogueOpen = false;
  hud.hideDialogue();
  if (S.health <= 0) { S.health = 100; S.armour = 0; }
  combat.clearEnemies();
  missions.cancel();
  // Exit any current car first, then place the player at the mission start
  // and give them a car to drive.
  if (S.car) { exitCar(); }
  // Spawn on the shop's front (+z) side, outside its walls, so the player
  // and the mission car start on the same side of the building.
  player.x = def.start.x; player.z = def.start.z + 14; player.y = 0;
  player.heading = 0;
  const pc = world.collideCircle(player.x, player.z, 1);
  player.x = pc.x; player.z = pc.z;
  S.missionCar = null;
  if (def.type === 'drive' || def.type === 'deliver' || def.type === 'race' || def.type === 'ram' || def.type === 'rob' || def.type === 'escape' || def.type === 'survive') {
    const kind = (id === 10 || id === 12) ? 'coupe' : (id === 8 || id === 9) ? 'coupe' : 'sedan';
    const car = createCar(THREE, kind, CARS.find((c) => c.id === kind).colors[0], def.start.x + 8, def.start.z + 14, 0);
    car.ownedByPlayer = true;
    const cc = world.collideCircle(car.x, car.z, 2);
    car.x = cc.x; car.z = cc.z;
    scene.add(car.mesh.group);
    S.parked.push(car);
    S.missionCar = car;
  }
  missions.start(id, S);
  S.screen = 'dialogue';
  S.dialogueOpen = true;
  const line = missions.nextDialogue();
  if (line) hud.showDialogue(line);
  announce(`Mission ${id}: ${def.name}. ${def.brief}`);
  return true;
}

function finishMission() {
  const reward = missions.complete(S);
  if (!reward) return;
  audio.missionDone();
  hud.toast(`Mission complete: ${reward.name} — $${reward.money} + ${reward.respect} respect`);
  announce(`Mission complete: ${reward.name}. $${reward.money}.`);
  saveGame(S);
  if (reward.id === 12 && !S.victoryShown) {
    S.victoryShown = true;
    showVictory();
  }
}

function failMission(reason) {
  const m = missions.active;
  if (!m) return;
  hud.toast(`Mission failed: ${reason}`);
  missions.cancel();
  S.screen = 'play';
}

function showVictory() {
  S.screen = 'victory';
  hud.showScreen('KING OF THE BAY', 'You did it, Mara. The whole bay is yours.',
    `<p>All twelve missions complete. Final payout <b>$${S.money.toLocaleString('en-US')}</b>, respect rank <b>${rankFor(S.respect).rank.name}</b>.</p><p>Free roam continues — the city never sleeps.</p>`,
    [{ label: 'Keep playing', onClick: () => { hud.hideScreen(); S.screen = 'play'; } },
     { label: 'Back to title', onClick: () => showTitle() }]);
}

// --- Screens. ---
function showTitle() {
  S.screen = 'title';
  const save = loadGame();
  const buttons = [
    { label: 'New Game', onClick: () => { clearSave(); newGame(); hud.hideScreen(); S.screen = 'play'; } },
  ];
  if (save) buttons.push({ label: 'Continue', onClick: () => { applySave(save); hud.hideScreen(); S.screen = 'play'; } });
  buttons.push({ label: 'Missions', onClick: () => showMissionSelect() });
  hud.showScreen('SOLMAR BAY 3D', 'Mara is new in town. Rosa runs the garage. Twelve jobs stand between you and King of the Bay.',
    `<p><b>WASD</b> walk / drive · <b>Mouse</b> look · <b>E</b> enter car / shop · <b>Space</b> jump / handbrake<br><b>F</b> punch · <b>Click</b> shoot · <b>1–5</b> weapons · <b>Tab</b> weapon wheel<br><b>R</b> radio · <b>M</b> mute · <b>P</b> pause</p><p>Stealing cars, shooting and running people over raises your wanted level. Stay out of sight and the heat fades.</p>`,
    buttons);
}

function showMissionSelect() {
  S.screen = 'missions';
  const rows = MISSIONS.map((m) => {
    const done = missions.completed.includes(m.id);
    const locked = m.id > missions.unlocked;
    return `<div style="padding:4px 0;border-top:1px solid rgba(255,255,255,.12)">${locked ? '🔒' : done ? '✅' : '▸'} <b>${m.id}. ${m.name}</b> — $${m.reward}${done ? ' (done)' : ''}</div>`;
  }).join('');
  const buttons = MISSIONS.filter((m) => m.id <= missions.unlocked).map((m) => ({
    label: `Start ${m.id}. ${m.name}`,
    onClick: () => { hud.hideScreen(); S.screen = 'play'; startMission(m.id); },
  }));
  buttons.push({ label: 'Back', onClick: () => showTitle() });
  hud.showScreen('MISSIONS', 'Unlocked in order. Complete one to open the next.',
    rows, buttons);
}

function showPause() {
  S.screen = 'paused';
  hud.showScreen('PAUSED', 'Solmar Bay waits for no one — except right now.',
    `<p>Money <b>$${S.money.toLocaleString('en-US')}</b> · Respect <b>${rankFor(S.respect).rank.name}</b> (${S.respect})<br>Missions complete: <b>${missions.completed.length} / 12</b></p>`,
    [
      { label: 'Resume', onClick: () => { hud.hideScreen(); S.screen = 'play'; } },
      { label: 'Missions', onClick: () => showMissionSelect() },
      { label: 'Save game', onClick: () => { saveGame(S); hud.toast('Game saved.'); } },
      { label: 'Quit to title', onClick: () => showTitle() },
    ]);
}

function showBustedOrWasted(kind) {
  const loss = Math.floor(S.money * 0.1);
  S.bustedLoss = loss;
  S.money -= loss;
  police.clearWanted();
  missions.cancel(); // being caught or going down fails the active mission
  S.screen = kind;
  audio.busted();
  hud.showScreen(kind === 'busted' ? 'BUSTED' : 'WASTED',
    kind === 'busted' ? 'The police caught up with you on foot.' : 'Mara is down. The bay keeps moving.',
    `<p>You lost <b>$${loss.toLocaleString('en-US')}</b>. Your car was impounded; you wake up at Rosa's garage.</p>`,
    [{ label: 'Retry', onClick: () => {
      hud.hideScreen();
      player.x = -1180; player.z = -420; player.y = 0;
      player.health = 100;
      S.health = 100; S.armour = 0;
      if (S.car) { exitCar(); }
      S.screen = 'play';
    } }]);
}

// --- New game / save apply. ---
function newGame() {
  S.money = 500; S.respect = 0; S.health = 100; S.armour = 0;
  S.weaponsOwned = ['fists']; S.ammo = {}; S.weaponId = 'fists';
  S.ownedCars = [];
  S.clock = 17.5; S.day = 1;
  player.x = -1180; player.z = -380; player.heading = 0; player.y = 0;
  player.group.visible = true;
  if (S.car) exitCar();
  police.clearWanted();
  combat.clearEnemies();
  missions.cancel();
  missions.load({ completed: [], unlocked: 1 });
  S.victoryShown = false;
  S.screen = 'play';
}

function applySave(save) {
  newGame();
  S.money = save.money ?? 500;
  S.respect = save.respect ?? 0;
  S.health = save.health ?? 100;
  S.armour = save.armour ?? 0;
  S.weaponsOwned = save.weaponsOwned || ['fists'];
  S.ammo = save.ammo || {};
  S.ownedCars = save.ownedCars || [];
  missions.load({ completed: save.completed || [], unlocked: save.unlocked || 1 });
  S.clock = save.clock ?? 17.5;
  if (save.shirtColor) player.setShirt(save.shirtColor);
  player.x = save.x ?? -1180; player.z = save.z ?? -380;
  if (save.station !== undefined) audio.setStation(save.station);
}

// --- Camera. ---
function updateCamera(dt) {
  const focus = S.inCar && S.car ? { x: S.car.x, z: S.car.z, heading: S.car.heading } : { x: player.x, z: player.z, heading: player.heading };
  // Chase camera: behind the heading, blended toward it when driving.
  let targetYaw = focus.heading + Math.PI;
  if (S.inCar) {
    let diff = targetYaw - S.camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    S.camYaw += diff * Math.min(1, dt * 2.2);
  }
  const dist = S.inCar ? 11 : 8;
  const h = S.inCar ? 4.2 : 3.4;
  const cx = focus.x + Math.sin(S.camYaw) * dist;
  const cz = focus.z + Math.cos(S.camYaw) * dist;
  const cy = h + Math.sin(S.camPitch) * 4;
  camera.position.set(cx, cy, cz);
  camera.lookAt(focus.x, 1.6, focus.z);
  camera.position.y = Math.max(camera.position.y, 1.2);
}

// --- Road routing: drive intersection to intersection instead of beelining
// through city blocks. A beeline slides along building faces for hundreds of
// metres (the car keeps moving, so the stall detector never fires) and can
// never turn through a building row. The route is: step onto the nearest
// road line, follow the grid to the intersection nearest the target, then a
// short final hop to the target itself. ---
function nearestRoadX(x) { let best = ROADS_X[0]; for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx; return best; }
function nearestRoadZ(z) { let best = ROADS_Z[0]; for (const rz of ROADS_Z) if (Math.abs(rz - z) < Math.abs(best - z)) best = rz; return best; }
function routeWaypoints(sx, sz, tx, tz) {
  const rx1 = nearestRoadX(tx); const rz1 = nearestRoadZ(tz);
  const dedupe = (wps) => {
    const out = [];
    for (const p of wps) {
      const last = out[out.length - 1];
      if (!last || Math.hypot(last.x - p.x, last.z - p.z) > 4) out.push(p);
    }
    return out;
  };
  const totalLen = (wps) => {
    let L = 0; let px = sx; let pz = sz;
    for (const w of wps) { L += Math.hypot(w.x - px, w.z - pz); px = w.x; pz = w.z; }
    return L + Math.hypot(tx - px, tz - pz);
  };
  // Entry: the nearest road in each direction from the start. A hop across
  // a city block can run straight into a building (the garage's east hop
  // hits one at x≈-986), so a blocked entry is heavily penalised and the
  // route enters the road grid from a clear side instead.
  const cands = [];
  const rxE = ROADS_X.find((r) => r > sx);
  const rxW = [...ROADS_X].reverse().find((r) => r < sx);
  const rzN = ROADS_Z.find((r) => r > sz);
  const rzS = [...ROADS_Z].reverse().find((r) => r < sz);
  if (rxE !== undefined) cands.push({ x: rxE, z: sz, along: 'x' });
  if (rxW !== undefined) cands.push({ x: rxW, z: sz, along: 'x' });
  if (rzN !== undefined) cands.push({ x: sx, z: rzN, along: 'z' });
  if (rzS !== undefined) cands.push({ x: sx, z: rzS, along: 'z' });
  let best = null;
  for (const c of cands) {
    const wps = c.along === 'x'
      ? dedupe([{ x: c.x, z: sz }, { x: c.x, z: rz1 }, { x: rx1, z: rz1 }])
      : dedupe([{ x: sx, z: c.z }, { x: rx1, z: c.z }, { x: rx1, z: rz1 }]);
    const clear = pathClear(sx, sz, c.x, c.z);
    const score = (clear ? 0 : 10000) + totalLen(wps);
    if (!best || score < best.score) best = { wps, score };
  }
  return best ? best.wps : [];
}

// Is the straight line clear of buildings? Sampled every 4 m.
function pathClear(x0, z0, x1, z1) {
  const d = Math.hypot(x1 - x0, z1 - z0);
  const steps = Math.max(1, Math.ceil(d / 4));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    if (world.colliderAt(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false;
  }
  return true;
}

// The autopilot's current waypoint: the next point on the road route to
// ap.target, or ap.target itself when the route is done. A specific car
// (mission car, moving) is chased directly, never routed — and a target
// within 60 m is a plain beeline, since routing a 10 m hop sends the car
// on a road detour around the block. A waypoint counts as reached at 30 m
// when driving (at 38 m/s a 14 m circle is easy to miss and the car then
// orbits it forever) or when the car has passed it.
function apTarget(ap) {
  const tx = ap.target.x; const tz = ap.target.z;
  if (ap.targetCar) return ap.target;
  const cx = S.car ? S.car.x : player.x;
  const cz = S.car ? S.car.z : player.z;
  if (Math.hypot(tx - cx, tz - cz) < 150) { ap.route = []; return ap.target; }
  if (!ap._routeFor || Math.hypot(ap._routeFor.x - tx, ap._routeFor.z - tz) > 25) {
    ap.route = routeWaypoints(cx, cz, tx, tz);
    ap._routeFor = { x: tx, z: tz };
  }
  const driving = !!S.car;
  const radius = driving ? 30 : 14;
  while (ap.route && ap.route.length > 0) {
    const w = ap.route[0];
    const dx = w.x - cx; const dz = w.z - cz;
    const d = Math.hypot(dx, dz);
    let passed = false;
    if (driving && d < 80) {
      const fx = Math.sin(S.car.heading); const fz = Math.cos(S.car.heading);
      passed = (dx * fx + dz * fz) < 0; // waypoint is behind the car now
    }
    if (d < radius || passed) ap.route.shift();
    else break;
  }
  // Stale route: the car cut a corner and the current waypoint is now far
  // behind it — turn around for it is a waste; recompute from here instead.
  if (ap.route && ap.route.length > 0 && S.car) {
    const w = ap.route[0];
    const dx = w.x - cx; const dz = w.z - cz;
    const d = Math.hypot(dx, dz);
    const fx = Math.sin(S.car.heading); const fz = Math.cos(S.car.heading);
    if (d > 60 && (dx * fx + dz * fz) < 0) {
      ap.route = routeWaypoints(cx, cz, tx, tz);
      ap._routeFor = { x: tx, z: tz };
      if (ap.route && ap.route.length > 0) return ap.route[0];
      return ap.target;
    }
  }
  if (ap.route && ap.route.length > 0) return ap.route[0];
  return ap.target;
}

// --- Autopilot: drives the real inputs toward a target (used by shots,
// autoplay and the playtest). Returns true when it has arrived. ---
function autopilotStep(dt) {
  const ap = S.autopilot;
  if (!ap) return true;
  // Hold: stand still (the robbery) without tripping the stall detector.
  if (ap.hold) { ap.stall = 0; return true; }
  // Stall recovery: measure real progress over half-second windows (a single
  // step only moves ~0.15 m, so a per-step check would fire while driving
  // fine). If the car or player is wedged against a building, detour
  // sideways around it for a few seconds, then resume.
  const now = S.time;
  const cx = S.car ? S.car.x : player.x;
  const cz = S.car ? S.car.z : player.z;
  const wp0 = apTarget(ap);
  if (ap.checkAt === undefined) { ap.checkAt = now; ap.checkX = cx; ap.checkZ = cz; }
  if (now - ap.checkAt >= 0.5) {
    const moved = Math.hypot(cx - ap.checkX, cz - ap.checkZ);
    // A car braking to a stop near its target barely moves — that is not
    // being stuck, so the stall clock only runs far from the waypoint.
    const dWp = Math.hypot(wp0.x - cx, wp0.z - cz);
    if (moved < 1.5 && dWp > 40) ap.stall = (ap.stall || 0) + (now - ap.checkAt);
    else if (moved >= 1.5) ap.stall = 0;
    ap.checkAt = now; ap.checkX = cx; ap.checkZ = cz;
  }
  // Progress check: wall-sliding along a building face moves the car, so the
  // movement check above never fires — but if the distance to the waypoint
  // has not shrunk in 3 s, the car is wedged and needs a detour too.
  // A new waypoint restarts the progress clock (its distance is not
  // comparable with the previous waypoint's).
  if (!ap._lastWp || Math.hypot(ap._lastWp.x - wp0.x, ap._lastWp.z - wp0.z) > 5) {
    ap._lastWp = { x: wp0.x, z: wp0.z };
    ap.progAt = now; ap.progD = Math.hypot(wp0.x - cx, wp0.z - cz);
  }
  if (ap.progAt === undefined) { ap.progAt = now; ap.progD = Math.hypot(wp0.x - cx, wp0.z - cz); }
  if (now - ap.progAt >= 3) {
    const dNow = Math.hypot(wp0.x - cx, wp0.z - cz);
    if (ap.progD - dNow < 5) ap.stall = (ap.stall || 0) + 3;
    ap.progD = dNow; ap.progAt = now;
  }
  let tx = wp0.x; let tz = wp0.z;
  if (ap.stall > 2 && (!ap.detourUntil || now > ap.detourUntil)) {
    // Pick the perpendicular side that is not inside a building.
    const dx = tx - cx; const dz = tz - cz;
    const len = Math.hypot(dx, dz) || 1;
    const ux = dx / len; const uz = dz / len;
    const cands = [
      { x: cx + -uz * 35, z: cz + ux * 35 },
      { x: cx + uz * 35, z: cz + -ux * 35 },
    ];
    ap.detour = world.colliderAt(cands[0].x, cands[0].z) ? cands[1] : cands[0];
    ap.detourUntil = now + 5;
    ap.stall = 0;
    // Back out of the wedge first: a car pressed against a wall creeps
    // into it at 0.05 m/s — too gentle to count as a hard hit, so the
    // reverse never triggers — and it cannot drive to the detour point
    // until it has reversed clear of the wall.
    ap.reverseUntil = now + 0.8;
  }
  if (ap.detourUntil && now < ap.detourUntil && ap.detour) { tx = ap.detour.x; tz = ap.detour.z; }
  if (S.inCar && S.car) {
    const dx = tx - S.car.x; const dz = tz - S.car.z;
    const d = Math.hypot(dx, dz);
    if (d < (ap.arriveDist || 10)) {
      // Arrived — but brake to a stop first. Returning immediately leaves
      // the car coasting at 13 m/s straight past the target, so it never
      // counts as hidden at a hide spot and never settles on a marker.
      if (Math.abs(S.car.speed) > 1) {
        stepCar(S.car, { throttle: -0.5, steer: 0, handbrake: false }, dt, world, allCars());
        return false;
      }
      return true;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - S.car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    // Brake as the final target gets close so the car settles on it instead
    // of blowing past at 38 m/s and orbiting it forever. The target speed
    // shrinks with distance; a fixed 0.6/0.3 throttle still accelerates,
    // so it must be a real speed comparison, not a smaller positive number.
    const isFinal = !(ap.route && ap.route.length > 0);
    let throttle;
    if (Math.abs(diff) > 1.2) throttle = 0.4;
    else if (isFinal) {
      // The final approach creeps in: wantSpeed falls to the 3 m/s floor
      // 10 m out, so the car can turn tightly and stop ON the point
      // instead of blowing past it at 15+ m/s and orbiting forever.
      // (A car at 38 m/s has a ~110 m turning radius; at 4 m/s it is ~12 m.)
      let wantSpeed = Math.min(S.car.topSpeed(), Math.max(3, (d - 10) * 0.35));
      // A sharp turn needs a slow car: the turning radius grows with speed,
      // so a fast car cannot turn onto a nearby target and orbits it
      // instead (the M6 hide-spot circle). Cap speed by heading error.
      if (Math.abs(diff) > 1.2) wantSpeed = Math.min(wantSpeed, 4);
      else if (Math.abs(diff) > 0.6) wantSpeed = Math.min(wantSpeed, 8);
      else if (Math.abs(diff) > 0.3) wantSpeed = Math.min(wantSpeed, 14);
      if (S.car.speed > wantSpeed + 3) throttle = -0.5;
      else if (S.car.speed < wantSpeed - 1) throttle = 1;
      else throttle = 0;
    } else throttle = 1;
    const handbrake = false;
    if (ap.reverseUntil && S.time < ap.reverseUntil) { throttle = -0.7; }
    else ap.reverseUntil = 0;
    const hit = stepCar(S.car, { throttle, steer, handbrake }, dt, world, allCars());
    if (hit && Math.abs(S.car.speed) < 8) ap.reverseUntil = S.time + 0.9;
    S._dbg = { speed: S.car.speed, heading: S.car.heading, want, diff, throttle, steer, hit, detour: ap.detour || null, stall: ap.stall || 0, target: { x: tx, z: tz } };
    return false;
  }
  // On foot: entering a nearby car comes before the "arrived" check, so the
  // pilot never stands next to a car calling itself arrived.
  if (ap.enterCar) {
    // A specific car (the mission car) takes priority over the nearest one.
    if (ap.targetCar && !ap.targetCar.wrecked) {
      const cd = Math.hypot(ap.targetCar.x - player.x, ap.targetCar.z - player.z);
      if (cd < 5.5) { enterCar(ap.targetCar); return false; }
      ap.target = { x: ap.targetCar.x, z: ap.targetCar.z };
    } else {
      const car = nearestEnterableCar(5.5);
      if (car) { enterCar(car); return false; }
    }
  }
  const dx = tx - player.x; const dz = tz - player.z;
  const d = Math.hypot(dx, dz);
  // When the goal is a specific car, walk right up to it (2 m) instead of
  // stopping 6 m away and calling it arrived.
  const arrive = ap.targetCar ? 2 : (ap.arriveDist || 6);
  if (d < arrive) return true;
  if (ap.enterCar && !ap.targetCar) {
    const near = nearestEnterableCar(60);
    if (near) { ap.target = { x: near.x, z: near.z }; }
  }
  const want = Math.atan2(dx, dz);
  S.camYaw = want + Math.PI;
  stepPlayer(player, { x: 0, y: 1, jump: false, sprint: true }, S.camYaw, dt, world);
  return false;
}

const HIDE_SPOTS = [
  { x: 1090, z: 690 }, { x: -1150, z: 500 }, { x: -1300, z: -900 },
  { x: 1300, z: 900 }, { x: -200, z: 1150 }, { x: 1600, z: -900 },
];
police.setHideSpots(HIDE_SPOTS);

function hideTarget() {
  let best = HIDE_SPOTS[0]; let bd = 1e9;
  for (const s of HIDE_SPOTS) {
    const dd = Math.hypot(s.x - player.x, s.z - player.z);
    if (dd < bd) { bd = dd; best = s; }
  }
  return best;
}

function farthestHideSpot() {
  let far = HIDE_SPOTS[0]; let fd = -1;
  for (const s of HIDE_SPOTS) {
    let md = 1e9;
    for (const u of police.units) md = Math.min(md, Math.hypot(s.x - u.x, s.z - u.z));
    if (md > fd) { fd = md; far = s; }
  }
  return far;
}

// Mission-aware autopilot: picks the right target for the current stage.
function missionAutopilot(dt) {
  const m = missions.active;
  if (!m) return;
  const d = m.def;
  if (!S.autopilot) S.autopilot = { target: { x: 0, z: 0 }, enterCar: true };
  const ap = S.autopilot;
  ap.hold = false;
  ap.targetCar = null;
  if (d.type === 'drive' || d.type === 'deliver') {
    if (d.id === 1 && m.stage === 0) {
      // Stage 0: get in the mission sedan by the garage door.
      if (S.inCar) { m.stage = 1; }
      else {
        ap.targetCar = S.missionCar;
        if (S.missionCar) ap.target = { x: S.missionCar.x, z: S.missionCar.z };
        ap.enterCar = true;
      }
    } else if (d.id === 1 && m.stage === 1) {
      ap.target = { x: -1450, z: 400 }; ap.enterCar = true;
      if (Math.hypot(player.x + 1450, player.z - 400) < 14) m.stage = 2;
    } else if (d.id === 1 && m.stage === 2) {
      ap.target = { x: d.target.x, z: d.target.z }; ap.enterCar = true;
    } else {
      ap.target = { x: d.target.x, z: d.target.z }; ap.enterCar = true;
    }
  } else if (d.type === 'race') {
    const cp = m.checkpoints[m.cpIndex];
    if (cp) { ap.target = { x: cp.x, z: cp.z }; ap.enterCar = true; }
  } else if (d.type === 'survive' || d.type === 'escape') {
    // Keep moving in a circuit, then hide when the heat is the goal.
    if (d.type === 'escape' && police.wanted > 0) {
      const best = hideTarget();
      if (Math.hypot(best.x - player.x, best.z - player.z) < 12) {
        // Parked and hidden: stop the car and wait — unless actually seen,
        // in which case drive to the farthest hide spot. (A unit merely
        // being nearby does not count: units always converge on lastSeen,
        // so fleeing on proximity alone flees every hide spot forever.)
        if (police.seen) { ap.target = farthestHideSpot(); ap.enterCar = true; }
        else {
          if (S.inCar && S.car) S.car.speed = 0;
          ap.hold = true;
          return;
        }
      } else ap.target = best; ap.enterCar = true;
    } else {
      const circuit = [{ x: 200, z: -600 }, { x: 600, z: -600 }, { x: 600, z: 200 }, { x: 200, z: 200 }];
      const idx = Math.floor(S.time / 12) % circuit.length;
      ap.target = circuit[idx]; ap.enterCar = true;
    }
  } else if (d.type === 'rob') {
    if (m.stage === 0) { ap.target = { x: d.target.x, z: d.target.z }; ap.enterCar = true; }
    else if (m.stage === 1) { ap.hold = true; return; } // stand and rob
    else {
      const best = hideTarget();
      if (Math.hypot(best.x - player.x, best.z - player.z) < 12) {
        if (police.seen) { ap.target = farthestHideSpot(); ap.enterCar = true; }
        else {
          if (S.inCar && S.car) S.car.speed = 0;
          ap.hold = true;
          return;
        }
      } else ap.target = best; ap.enterCar = true;
    }
  } else if (d.type === 'ram') {
    if (m.stage === 0) { ap.target = { x: 1000, z: -200 }; ap.enterCar = true; }
    else {
      const blocks = police.roadblocks.filter((r) => r.isBarrier);
      if (blocks.length) { ap.target = { x: blocks[0].x, z: blocks[0].z }; ap.enterCar = true; }
      else { ap.target = { x: d.target.x, z: d.target.z }; ap.enterCar = true; }
    }
  }
  autopilotStep(dt);
}

// --- One fixed simulation step. ---
let prevDigits = new Set();
function step(dt) {
  // The sim only runs on the play screens. (stepSim callers and the live
  // loop both go through here, so a busted/wasted screen can never drain
  // money or health once per step.)
  if (S.screen !== 'play' && S.screen !== 'dialogue' && S.screen !== 'shop') return;
  S.time += dt;
  S.clock += dt / 150; // one game hour per 2.5 minutes
  if (S.clock >= 24) { S.clock -= 24; S.day += 1; }

  const look = input.takeLook();
  S.camYaw -= look.dx * 0.0035;
  S.camPitch = Math.max(-0.15, Math.min(0.6, S.camPitch + look.dy * 0.002));

  // Dialogue advances.
  if (S.dialogueOpen) {
    const actions = input.takeActions();
    if (actions & (ACTION.ENTER | ACTION.CONFIRM | ACTION.SHOOT)) {
      if (missions.hasMoreDialogue()) {
        const line = missions.nextDialogue();
        if (line) hud.showDialogue(line);
      } else {
        hud.hideDialogue();
        S.dialogueOpen = false;
        S.screen = 'play';
      }
    }
    return; // sim paused during dialogue
  }

  const actions = input.takeActions();
  if (actions & ACTION.PAUSE) {
    if (S.screen === 'play') showPause();
    else if (S.screen === 'paused') { hud.hideScreen(); S.screen = 'play'; }
    return;
  }
  if (actions & ACTION.RADIO) { const st = audio.nextStation(); hud.toast(`${st.name} — ${st.song}`); }
  if (actions & ACTION.MUTE) { hud.toast(audio.toggleMute() ? 'Muted' : 'Sound on'); }

  // Weapon switching with number keys.
  for (let i = 0; i < 5; i += 1) {
    const code = `Digit${i + 1}`;
    const down = input.down(code);
    if (down && !prevDigits.has(code)) {
      const def = WEAPONS[i] || null;
      if (def && (def.id === 'fists' || S.weaponsOwned.includes(def.id))) {
        S.weaponId = def.id;
        player.armed = def.id !== 'fists';
        audio.click();
      } else if (def) hud.toast(`${def.name} is locked — buy it at Ironworks Arms.`);
    }
    if (down) prevDigits.add(code); else prevDigits.delete(code);
  }
  if (input.down('Tab')) {
    if (!S.wheelOpen) { S.wheelOpen = true; hud.showWheel(S); }
  } else if (S.wheelOpen) { S.wheelOpen = false; hud.hideWheel(); }

  // Shop interaction.
  if (S.shopOpen) {
    if (actions & ACTION.ENTER) { hud.hideShop(); S.shopOpen = false; S.screen = 'play'; }
    return;
  }
  const nearShop = shops.nearestShop(player.x, player.z);
  if (nearShop && (actions & ACTION.INTERACT) && !S.inCar) {
    S.shopOpen = true; S.screen = 'shop';
    hud.showShop(nearShop.shop, shops.itemsFor(nearShop.shop.id, S), (itemId) => {
      const res = shops.buy(S, nearShop.shop.id, itemId);
      if (res.ok) { audio.cash(); hud.toast(`Bought ${res.name} for $${res.price}.`); saveGame(S); hud.showShop(nearShop.shop, shops.itemsFor(nearShop.shop.id, S), () => {}); }
      else hud.toast(res.reason);
    });
    return;
  }

  const axis = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const jump = !!(actions & ACTION.JUMP);

  // Enter / exit car.
  if (actions & ACTION.ENTER) {
    if (S.inCar) exitCar();
    else {
      const car = nearestEnterableCar(4.5);
      if (car) enterCar(car);
    }
  }

  // Driving or walking.
  if (S.inCar && S.car) {
    const handbrake = input.down('Space');
    let hit = false;
    // When the autopilot drives, its own stepCar call (at the end of step())
    // is the only physics step — a second call here with zero input would
    // drag the speed back to zero every step and the car would never move.
    if (!S.autopilot) {
      hit = stepCar(S.car, { throttle: axis.y, steer: -axis.x, handbrake }, dt, world, allCars());
    }
    if (hit) audio.skid();
    // While driving, the player's position IS the car's, so every system
    // that reads player.x/z (missions, police, HUD, shops) stays correct.
    player.x = S.car.x; player.z = S.car.z; player.heading = S.car.heading;
    if (S.car.wrecked) {
      hud.toast('Your car is wrecked!');
      exitCar();
    }
    // Slow health regen when the police have not touched the car lately.
    if (S.time - S.lastPoliceContact > 3 && S.car && S.car.health < 100) S.car.health = Math.min(100, S.car.health + 1.5 * dt);
    // Running over pedestrians. (S.car may be null here: a wrecked car
    // exits the player above, so guard every use after that point.)
    if (S.car && Math.abs(S.car.speed) > 6) {
      const victims = crowd.runOverCheck(S.car.x, S.car.z, 2.6);
      for (const v of victims) {
        crowd.knockDown(v);
        police.addWanted(1, 'hit and run');
        hud.toast('You ran someone over — wanted level up!');
      }
    }
    audio.engine(S.car ? Math.abs(S.car.speed) / S.car.topSpeed() : 0, !!S.car);
  } else {
    stepPlayer(player, { x: axis.x, y: axis.y, jump, sprint }, S.camYaw, dt, world);
    audio.engine(0, false);
    // Punch.
    if (actions & ACTION.PUNCH) {
      player.punching = 0.35;
      audio.punch();
      const fx = Math.sin(player.heading); const fz = Math.cos(player.heading);
      for (const e of combat.enemies) {
        if (e.alive && Math.hypot(e.x - player.x, e.z - player.z) < 2.4) {
          e.health -= 12;
          if (e.health <= 0) { e.alive = false; e.mesh.group.visible = false; }
          hud.hitmark();
        }
      }
      const near = crowd.runOverCheck(player.x + fx * 1.5, player.z + fz * 1.5, 1.6);
      for (const v of near) { crowd.knockDown(v); police.addWanted(1, 'assault'); }
    }
    // Shooting.
    const weapon = WEAPONS.find((w) => w.id === S.weaponId) || WEAPONS[0];
    const armed = weapon.id !== 'fists';
    if (armed && (actions & ACTION.SHOOT || (weapon.auto && input.mouseHeld()))) {
      if ((S.ammo[weapon.id] ?? 0) > 0) {
        S.ammo[weapon.id] -= 1;
        audio.gunshot(weapon.id);
        const dir = { x: Math.sin(S.camYaw + Math.PI), z: Math.cos(S.camYaw + Math.PI) };
        const targets = [];
        for (const e of combat.enemies) {
          if (e.alive) {
            e.onDeath = () => { e.mesh.group.visible = false; };
            targets.push(e);
          }
        }
        for (const p of crowd.peds) {
          if (p.alive) {
            if (p.health === undefined) p.health = 20;
            p.onDeath = () => crowd.knockDown(p);
            targets.push(p);
          }
        }
        const res = combat.shoot(weapon, { x: player.x, y: 1.3, z: player.z }, dir, targets);
        if (res.hit) { hud.hitmark(); if (!res.target.alive) { combat.spawnPickup('cash', res.target.x, res.target.z, 60); } }
        police.addWanted(1, 'gunfire');
        crowd.step(0, { x: player.x, z: player.z });
      } else hud.toast('Out of ammo — buy more at Ironworks Arms.');
    }
  }

  // Enemies shoot back.
  const enemyHit = combat.step(dt, { x: player.x, z: player.z }, S.time);
  if (enemyHit) applyDamage(enemyHit.damage);

  // Pickups.
  const pk = combat.pickupAt(player.x, player.z);
  if (pk) {
    if (pk.kind === 'health') { S.health = Math.min(100, S.health + 25); audio.pickup(); hud.toast('+25 health'); }
    else if (pk.kind === 'armour') { S.armour = Math.min(100, S.armour + 25); audio.pickup(); hud.toast('+25 armour'); }
    else { S.money += pk.amount; audio.cash(); hud.toast(`+$${pk.amount}`); }
  }

  // World life.
  const danger = (S.inCar && S.car && Math.abs(S.car.speed) > 12) ? { x: S.car.x, z: S.car.z } : null;
  crowd.step(dt, danger);
  const nightInfo = world.setTimeOfDay(S.clock);
  traffic.step(dt, world, nightInfo.night, { x: player.x, z: player.z });
  for (const c of [...traffic.cars, ...S.parked]) if (c !== S.car) syncCarMesh(c, nightInfo.night);
  if (S.car) syncCarMesh(S.car, nightInfo.night);
  syncPlayerMesh(player);
  world.update(dt, S.time);
  audio.siren(police.wanted > 0);
  audio.waveLevel(Math.abs(player.x + 1500) < 120);

  // Police.
  const res = police.step(dt, player, S.inCar ? S.car : null, nightInfo.night, world);
  if (S.inCar && S.car) {
    for (const u of police.units) {
      if (Math.hypot(u.x - S.car.x, u.z - S.car.z) < 4.5) S.lastPoliceContact = S.time;
    }
  }
  if (res.busted) { showBustedOrWasted('busted'); return; }
  if (S.health <= 0) { showBustedOrWasted('wasted'); return; }

  // Missions.
  const ev = missions.step(dt, S);
  if (ev === 'complete') finishMission();
  else if (ev === 'fail') failMission(missions.active ? missions.active.reason : 'Failed.');

  // Autopilot (shots / autoplay / playtest only).
  if (S.autopilot) {
    if (missions.active) missionAutopilot(dt);
    else autopilotStep(dt);
  }

  updateCamera(dt);
}

function applyDamage(n) {
  if (S.armour > 0) {
    const absorbed = Math.min(S.armour, n);
    S.armour -= absorbed; n -= absorbed;
  }
  S.health -= n;
}

// --- HUD view for this frame. ---
function hudState() {
  const m = missions.active;
  const panel = police.wanted > 0 ? police.panelData(player.x, player.z) : null;
  let marker = null;
  if (m) {
    if (m.def.type === 'race' && m.checkpoints[m.cpIndex]) marker = m.checkpoints[m.cpIndex];
    else if (m.def.target) marker = m.def.target;
    else if (m.def.type === 'rob' && m.stage === 2) marker = { x: -1180, z: -420 };
  }
  return {
    money: S.money, health: S.health, armour: S.armour,
    district: world.districtAt(player.x, player.z),
    clock: S.clock, day: S.day, wanted: police.wanted,
    inSight: police.seen, respect: S.respect,
    weaponId: S.weaponId, ammo: S.ammo, weaponsOwned: S.weaponsOwned,
    car: S.car, armed: S.weaponId !== 'fists',
    audio, mission: m, missionObjective: m ? missions.objectiveText() : null,
    panel, marker,
    playerX: player.x, playerZ: player.z, playerHeading: player.heading,
    policeBlips: police.units.map((u) => ({ x: u.x, z: u.z })),
    searchZone: police.wanted > 0 ? police.lastSeen : null,
    roadsX: ROADS_X, roadsZ: ROADS_Z,
    interactHint: !S.inCar && shops.nearestShop(player.x, player.z) ? `Press E — ${shops.nearestShop(player.x, player.z).shop.name}` : (nearestEnterableCar(4.5) ? 'Press E — get in car' : ''),
  };
}

function render() {
  const w = window.innerWidth; const h = window.innerHeight;
  if (renderer.domElement.width !== w || renderer.domElement.height !== h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.render(scene, camera);
}

// --- Public helpers used by shots.js, autoplay and the playtest. ---
S.hudState = hudState;
S.render = render;
S.newGame = newGame;
S.startMission = startMission;
S.unlockAll = () => missions.load({ completed: [], unlocked: 12 });
S.missionAutopilot = missionAutopilot;
S.pauseGame = (on) => {
  if (on) showPause();
  else { hud.hideScreen(); S.screen = 'play'; }
};
S.save = () => saveGame(S);
S.loadSave = () => { const s = loadGame(); if (s) applySave(s); };
S.setClock = (h) => { S.clock = h; world.setTimeOfDay(h); };
S.teleportPlayer = (x, z, heading) => {
  player.x = x; player.z = z; player.y = 0;
  if (heading !== undefined) { player.heading = heading; S.camYaw = heading + Math.PI; }
};
S.spawnCar = (defId, x, z, heading) => {
  const def = CARS.find((c) => c.id === defId) || CARS[0];
  const car = createCar(THREE, defId, def.colors[0], x, z, heading);
  car.ownedByPlayer = true;
  scene.add(car.mesh.group);
  S.parked.push(car);
  return car;
};
S.enterCar = enterCar;
S.setCamera = (x, y, z, lx, ly, lz) => {
  camera.position.set(x, y, z);
  camera.lookAt(lx, ly, lz);
  S.camYaw = Math.atan2(x - lx, z - lz);
};
S.stepSim = (n) => { for (let i = 0; i < n; i += 1) step(STEP); };
S.advanceDialogue = () => input.press('KeyE');
S.closeDialogue = () => { for (let i = 0; i < 12 && S.dialogueOpen; i += 1) { input.press('KeyE'); step(STEP); } };
S.autoplay = null;

// Debug / test API for the playtest harness.
window.__sb = {
  S,
  state: () => ({
    money: S.money, respect: S.respect, health: S.health, armour: S.armour,
    wanted: police.wanted, screen: S.screen, inCar: S.inCar,
    player: { x: player.x, z: player.z },
    car: S.car ? { x: S.car.x, z: S.car.z, health: S.car.health, speed: S.car.speed } : null,
    mission: missions.active ? { id: missions.active.def.id, name: missions.active.def.name, stage: missions.active.stage, timer: missions.active.timer } : null,
    completed: [...missions.completed], unlocked: missions.unlocked,
    weaponsOwned: [...S.weaponsOwned], ammo: { ...S.ammo },
    policeUnits: police.units.length, heli: !!police.heli,
    fps: S.fps,
  }),
  newGame, startMission,
  pauseLoop: (on) => { S.loopPaused = !!on; },
  unlockAll: () => missions.load({ completed: [], unlocked: 12 }),
  step: (n) => S.stepSim(n),
  render,
  teleport: (x, z, h) => S.teleportPlayer(x, z, h),
  setWanted: (n) => police.setWanted(n),
  giveMoney: (n) => { S.money += n; },
  autopilotTo: (x, z, opts = {}) => { S.autopilot = { target: { x, z }, enterCar: opts.enterCar !== false, arriveDist: opts.arriveDist || 10 }; },
  missionAutopilot: () => { S.autopilot = { target: { x: 0, z: 0 }, enterCar: true }; },
  clearAutopilot: () => { S.autopilot = null; },
  enterNearestCar: () => { const c = nearestEnterableCar(6); return c ? enterCar(c) : false; },
  pressKey: (code) => input.press(code),
  setKey: (code, on) => input.setKey(code, on),
  click: () => input.press('MouseClick'),
  buy: (shopId, itemId) => shops.buy(S, shopId, itemId),
  shopItems: (shopId) => shops.itemsFor(shopId, S),
  save: () => saveGame(S),
  load: () => S.loadSave(),
  setWeapon: (id) => { if (S.weaponsOwned.includes(id) || id === 'fists') { S.weaponId = id; player.armed = id !== 'fists'; } },
  setClock: (h) => S.setClock(h),
  dialogueOpen: () => S.dialogueOpen,
  advanceDialogue: () => { input.press('KeyE'); S.stepSim(1); },
  dbg: () => ({
    autopilot: S._dbg || null,
    car: S.car ? { x: S.car.x, z: S.car.z, speed: S.car.speed, heading: S.car.heading } : null,
    colliderAtCar: S.car ? world.colliderAt(S.car.x, S.car.z) : null,
    nearbyCars: S.car ? allCars().filter((c) => c !== S.car && Math.hypot(c.x - S.car.x, c.z - S.car.z) < 8).map((c) => ({ x: Math.round(c.x), z: Math.round(c.z), police: !!c.isPolice })) : [],
    policeUnits: police.units.map((u) => ({ x: Math.round(u.x), z: Math.round(u.z) })),
  }),
};

// --- Main loop. ---
let last = performance.now();
let accumulator = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = now - last;
  last = now;
  S.fpsCount += 1; S.fpsTime += dtMs;
  if (S.fpsTime >= 1000) { S.fps = Math.round((S.fpsCount * 1000) / S.fpsTime); S.fpsCount = 0; S.fpsTime = 0; }
  if (shotName) return; // shot mode renders on demand
  if (S.loopPaused) { render(); return; } // test hook: __sb.step() is the only sim driver
  if (autoplayOn && !S.autoplay) S.autoplay = createAutoplay(S);
  if (S.autoplay) S.autoplay.update(dtMs / 1000);
  if (S.screen === 'title' || S.screen === 'missions') {
    // Idle attract mode: slow camera orbit over the city.
    const t = now / 1000;
    camera.position.set(Math.cos(t * 0.02) * 900, 320, Math.sin(t * 0.02) * 700);
    camera.lookAt(0, 0, 0);
    world.update(dtMs / 1000, S.time);
    render();
    return;
  }
  if (S.screen === 'play' || S.screen === 'dialogue' || S.screen === 'shop') {
    accumulator += Math.min(dtMs / 1000, 0.25);
    while (accumulator >= STEP) { step(STEP); accumulator -= STEP; }
    if (S.screen !== 'paused' && S.screen !== 'busted' && S.screen !== 'wasted' && S.screen !== 'victory') {
      hud.update(hudState(), dtMs / 1000);
    }
    render();
  } else {
    render();
  }
  if (S.autoplay && S.autoplay.finished) {
    window.__autoplayResult = { pass: S.autoplay.pass, log: S.autoplay.log };
  }
}

window.addEventListener('resize', () => render());
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.screen === 'play') showPause();
});
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });

// Boot.
world.setTimeOfDay(S.clock);
if (shotName) {
  stageShot(shotName, S);
} else {
  const save = loadGame();
  showTitle();
  if (autoplayOn) { hud.hideScreen(); S.screen = 'play'; newGame(); }
  requestAnimationFrame(frame);
}
