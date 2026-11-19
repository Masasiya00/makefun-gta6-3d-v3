// Solmar Bay 3D — main loop: fixed 1/60 s simulation steps, chase camera,
// wiring for every system, deterministic screenshot scenes and the autoplay
// self-test (?autoplay=1) that plays the game and reports pass or fail.
import * as THREE from 'three';
import { createState, formatClock, timeOfDay, addWanted, RESPECT_RANKS } from './config.js';
import { createInput, wasPressed, endFrame } from './input.js';
import { createAudio, resumeAudio, setMuted, updateAudio, playClick, playSirenBlip } from './audio.js';
import { createWorld, syncWorld } from './world.js';
import { makePlayerMesh, updatePlayerOnFoot, syncPlayerMesh, hurtPlayer } from './player.js';
import { spawnParkedCars, updateDriving, syncCarMeshes, exitCar, nearestCar, enterCar } from './vehicles.js';
import { spawnTraffic, updateTraffic, syncTrafficMeshes, spawnPedestrians, updatePedestrians, syncPedMeshes } from './traffic.js';
import { createPolice, updatePolice, syncPoliceMeshes, playerRoad, roadPoint, alongOf, roadblockSlots, COP_SHOT_SLOTS } from './police.js';
import { createCombat, updateCombat, switchWeapon, spawnEnemy } from './combat.js';
import { startMission, updateMissions, retryMission } from './missions.js';
import { updateShops, buyItem } from './shops.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { updateHud, drawMinimap } from './hud.js';
import { applyShot, placeShotTrafficCar } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10);
const state = createState(seed);
const input = createInput();
const audio = createAudio();
state.autoplay = params.get('autoplay') === '1';
const shotName = params.get('shot');

// Renderer and camera.
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
camera.position.set(0, 8, -14);

const world = createWorld(state);
const playerMesh = makePlayerMesh(state);
world.scene.add(playerMesh);
const carMeshes = spawnParkedCars(state, world.scene);
const trafficMeshes = spawnTraffic(state, world.scene);
const pedMeshes = spawnPedestrians(state, world.scene);
const policeMeshes = createPolice(world.scene);
const combat = createCombat(world.scene);

// Cash / health / armour pickups scattered around the city.
for (let i = 0; i < 24; i++) {
  const kind = state.rng.pick(['cash', 'cash', 'health', 'armour']);
  state.pickups.push({ kind, amount: kind === 'cash' ? 50 + state.rng.int(0, 150) : 0, x: state.rng.range(-300, 330), z: state.rng.range(-240, 240), taken: false });
}
// Pickup meshes: small spinning coins / crosses.
const pickupGroup = new THREE.Group();
world.scene.add(pickupGroup);
const pickupMeshes = [];
for (const pk of state.pickups) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 0.25),
    new THREE.MeshBasicMaterial({ color: pk.kind === 'cash' ? 0x2ecc71 : pk.kind === 'health' ? 0xff5d5d : 0x4d8dff }),
  );
  m.position.set(pk.x, 1, pk.z);
  pickupGroup.add(m);
  pickupMeshes.push(m);
}

// HUD element handles.
const $ = (id) => document.getElementById(id);
const els = {
  money: $('hud-money'), district: $('hud-district'), clock: $('hud-clock'),
  stars: $('hud-stars'), wantedLabel: $('hud-wanted-label'), wantedBox: $('wanted-box'),
  healthFill: $('health-fill'), armourFill: $('armour-fill'), healthText: $('health-text'),
  missionName: $('mission-name'), missionNext: $('mission-next'), missionTimer: $('mission-timer'), missionBar: $('mission-bar'),
  weapons: $('weapon-slots'), weaponName: $('weapon-name'), ammoSegs: $('ammo-segs'),
  reloadPrompt: $('reload-prompt'), crosshair: $('crosshair'), hitmarker: $('hitmarker'),
  policePanel: $('police-panel'), inSight: $('in-sight'),
  respectRank: $('respect-rank'), respectText: $('respect-text'), respectFill: $('respect-fill'),
  radioStation: $('radio-station'), radioSong: $('radio-song'),
  vehiclePanel: $('vehicle-panel'), vehicleName: $('vehicle-name'), vehicleSpeed: $('vehicle-speed'),
  vehicleGear: $('vehicle-gear'), vehicleCond: $('vehicle-cond'), vehicleCondText: $('vehicle-cond-text'),
  onFootPanel: $('onfoot-panel'), dialogue: $('dialogue'), toast: $('toast'),
  shopPrompt: $('shop-prompt'), shopMenu: $('shop-menu'),
  titleScreen: $('title-screen'), pauseScreen: $('pause-screen'), endScreen: $('end-screen'),
  endTitle: $('end-title'), endText: $('end-text'), timeLabel: $('time-label'),
  minimap: $('minimap'),
};
$('start-btn').addEventListener('click', () => { state.started = true; resumeAudio(audio); playClick(audio); });
$('resume-btn').addEventListener('click', () => { state.paused = false; resumeAudio(audio); });
$('retry-btn').addEventListener('click', () => { resetAfterGameOver(); });
els.shopMenu.addEventListener('click', (e) => {
  const item = e.target.closest('[data-item]');
  if (item && state.shopNear) buyItem(state, state.shopNear, item.dataset.item, audio);
});

function resetAfterGameOver() {
  state.money = Math.floor(state.money * 0.9);
  state.health = 100;
  state.armour = 0;
  state.wanted = 0;
  state.heat = 0;
  state.busted = false;
  state.wasted = false;
  state.gameOver = false;
  state.victory = false;
  state.player.x = -150;
  state.player.z = 100;
  state.police = [];
  state.enemies = [];
}

state.cameraYaw = 0;
let camDist = 10;

function updateCamera(dt) {
  const p = state.player;
  // Mission shot: a wide side establishing shot that tracks the player,
  // instead of the rear chase view. The camera sits out on the heli side
  // of the road (the same road-frame right vector police.js uses for the
  // heli), behind the player and well above the street, and looks at a
  // point ahead of the player toward the roadblock. The road then runs
  // diagonally across the frame with the red car driving toward the
  // roadblock wall, which reads as a completely different composition
  // from the cover chase shot. This branch sets the camera directly and
  // returns before the normal cameraYaw easing, which would otherwise
  // drag the camera back behind the car every frame.
  //
  // Framing note: the shot is taken after a fixed wall-clock wait, and
  // in the slow headless renderer the simulation may not have advanced
  // at all by then — the player is still at its start spot and the
  // roadblock still sits at its 55 m spawn point (it only gets re-parked
  // to 20 m ahead once simulation steps run). The camera is pulled far
  // enough back and the lookAt far enough ahead that the 55 m roadblock
  // clears the left HUD panel, while the 20 m re-parked position stays
  // in frame too, so the shot reads in both timings.
  if (state.cameraShot === 'mission') {
    const a = p.angle;
    const fwdX = Math.sin(a);
    const fwdZ = Math.cos(a);
    const rightX = Math.cos(a);
    const rightZ = -Math.sin(a);
    camera.position.set(
      p.x + fwdX * -14 + rightX * 28,
      11,
      p.z + fwdZ * -14 + rightZ * 28,
    );
    camera.lookAt(p.x + fwdX * 14, 2, p.z + fwdZ * 14);
    return;
  }
  // Mouse look steers the camera yaw; while driving it eases back behind the car.
  state.cameraYaw -= input.lookDX * 0.0032;
  if (p.inCar) {
    const diff = ((p.angle - state.cameraYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    state.cameraYaw += diff * Math.min(1, dt * 1.6);
  }
  const dist = p.inCar ? 12 : 9.5;
  const height = p.inCar ? 4.6 : 4.4;
  camDist += (dist - camDist) * Math.min(1, dt * 3);
  const cx = p.x - Math.sin(state.cameraYaw) * camDist;
  const cz = p.z - Math.cos(state.cameraYaw) * camDist;
  let cy = height + Math.abs(p.speed || 0) * 0.02;
  if (state.shake > 0) { cy += (Math.random() - 0.5) * state.shake; state.shake -= dt; }
  camera.position.set(cx, cy, cz);
  if (state.cameraLookUp) {
    camera.lookAt(p.x + Math.sin(state.cameraYaw) * 30, 7, p.z + Math.cos(state.cameraYaw) * 30);
  } else {
    camera.lookAt(p.x, 1.6, p.z);
  }
}

function step(dt) {
  state.time += dt;
  state.clockMin += dt * 0.12;
  if (state.clockMin >= 24 * 60) { state.clockMin -= 24 * 60; state.day++; }
  if (state.flags.gunfireT === undefined) state.flags.gunfireT = 0;
  if (state.weaponSwitchT > 0) state.weaponSwitchT -= dt;
  // Global keys.
  if (wasPressed(input, 'KeyP')) {
    if (state.started && !state.gameOver) { state.paused = !state.paused; state.shopOpen = false; }
  }
  if (wasPressed(input, 'Escape')) {
    if (state.shopOpen) state.shopOpen = false;
    else if (state.started && !state.gameOver) { state.paused = !state.paused; }
  }
  if (wasPressed(input, 'KeyR') && state.started) { state.radio = (state.radio + 1) % 3; playClick(audio); }
  if (wasPressed(input, 'KeyX')) { setMuted(audio, !audio.muted); state.muted = audio.muted; }
  if (wasPressed(input, 'KeyM') && state.started) {
    if (!state.missionActive) {
      const next = state.missionDone.length < 12 ? state.missionDone.length : 0;
      startMission(state, next, audio);
    }
  }
  if (state.gameOver && wasPressed(input, 'KeyR')) resetAfterGameOver();
  if (!state.started || state.paused || state.gameOver) return;
  if (wasPressed(input, 'Digit1')) switchWeapon(state, 0);
  if (wasPressed(input, 'Digit2')) switchWeapon(state, 1);
  if (wasPressed(input, 'Digit3')) switchWeapon(state, 2);
  if (wasPressed(input, 'Digit4')) switchWeapon(state, 3);
  if (wasPressed(input, 'Digit5')) switchWeapon(state, 4);
  if (wasPressed(input, 'KeyQ')) state.radio = (state.radio + 1) % 3;
  if (state.player.inCar && wasPressed(input, 'KeyE')) exitCar(state);
  if (wasPressed(input, 'KeyG')) { /* horn */ playSirenBlip(audio); }
  // Save / load quick keys.
  if (wasPressed(input, 'KeyZ')) saveGame(state);
  if (wasPressed(input, 'KeyL')) loadGame(state);

  if (state.player.inCar) updateDriving(state, input, dt, audio);
  else updatePlayerOnFoot(state, input, dt, audio);
  updateTraffic(state, dt);
  updatePedestrians(state, dt);
  updatePolice(state, dt, policeMeshes, world.scene);
  updateCombat(state, input, combat, dt, audio, state.cameraYaw);
  updateMissions(state, dt, audio);
  updateShops(state, input, audio);
  updateAudio(audio, state, dt);
  // Shot-mode staging: the whole chase scene is re-parked every step so
  // the composition holds however much simulation time passes before the
  // screenshot is taken. Everything is snapped to the road the player is
  // driving on, facing along it. (The heli is staged inside updatePolice,
  // which freezes its orbit and parks it ahead-above the player in shots.)
  if (state.cameraShot === 'mission' && state.roadblocks.length > 0) {
    const slots = roadblockSlots(state, 20);
    state.roadblocks.forEach((rb, i) => {
      if (!rb.broken && slots[i]) {
        rb.x = slots[i].x;
        rb.z = slots[i].z;
        rb.angle = slots[i].angle;
      }
    });
  }
  if (state.cameraShot === 'chase' || state.cameraShot === 'mission' || state.cameraShot === 'countryside' || state.cameraShot === 'airport') {
    const road = playerRoad(state);
    const pAlong = alongOf(road, state.player.x, state.player.z);
    for (const cop of state.police) {
      const slot = COP_SHOT_SLOTS[cop.slot % COP_SHOT_SLOTS.length];
      const pos = roadPoint(road, pAlong + slot.along * road.dir, slot.lane);
      cop.x = pos.x;
      cop.z = pos.z;
      cop.angle = road.angle;
    }
    for (const car of state.traffic) {
      if (car.shotRole) placeShotTrafficCar(state, car, car.shotRole);
    }
  }
}

function render() {
  syncWorld(world, state, 1 / 60);
  syncPlayerMesh(playerMesh, state, combat);
  // Recoil: a fresh shot kicks the camera via the existing shake path.
  if (combat.flashT > 0) state.shake = Math.max(state.shake, 0.3);
  syncCarMeshes(carMeshes, state);
  syncTrafficMeshes(trafficMeshes, state);
  syncPedMeshes(pedMeshes, state);
  syncPoliceMeshes(policeMeshes, state);
  for (let i = 0; i < state.pickups.length; i++) {
    const pk = state.pickups[i];
    if (!pickupMeshes[i]) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 0.25),
        new THREE.MeshBasicMaterial({ color: pk.kind === 'cash' ? 0x2ecc71 : pk.kind === 'health' ? 0xff5d5d : 0x4d8dff }),
      );
      m.position.set(pk.x, 1, pk.z);
      pickupGroup.add(m);
      pickupMeshes.push(m);
    }
    pickupMeshes[i].visible = !pk.taken;
    pickupMeshes[i].rotation.y += 0.05;
  }
  updateCamera(1 / 60);
  renderer.render(world.scene, camera);
  updateHud(state, els, combat);
  drawMinimap(state, els.minimap);
}

// ---- Autoplay self-test -------------------------------------------------
const autoLog = [];
function autoSnap() {
  return { mission: state.missionIndex, stage: state.missionStage, active: state.missionActive, done: [...state.missionDone], wanted: state.wanted, inSight: state.inSight, x: Math.round(state.player.x), z: Math.round(state.player.z), speed: Math.round(state.player.speed || 0), inCar: state.player.inCar, gameOver: state.gameOver, busted: state.busted, wasted: state.wasted, health: Math.round(state.health), carCond: Math.round((state.cars.find((c) => c.id === state.player.carId) || {}).condition ?? -1), cops: state.police.length, enemies: state.enemies.length };
}
function autoCheck(name, ok) { autoLog.push({ name, ok: !!ok, snap: autoSnap() }); }
function driveToward(tx, tz, seconds, throttle) {
  input.pressed = {};
  const end = state.time + seconds;
  while (state.time < end) {
    const a = Math.atan2(tx - state.player.x, tz - state.player.z);
    const diff = ((a - state.player.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    input.keys.KeyW = true;
    input.keys.KeyA = diff > 0.25;
    input.keys.KeyD = diff < -0.25;
    step(1 / 60);
    input.keys.KeyA = false;
    input.keys.KeyD = false;
    if (throttle === false) break;
  }
  input.keys.KeyW = false;
}
function waitSim(seconds) {
  input.pressed = {};
  const end = state.time + seconds;
  while (state.time < end) step(1 / 60);
}
function runAutoplay() {
  state.started = true;
  window.__autoplay = { running: true, results: autoLog };
  try {
    // 1. Walk on foot.
    input.keys.KeyW = true;
    waitSim(2);
    input.keys.KeyW = false;
    autoCheck('walk', Math.abs(state.player.x - -150) > 1 || Math.abs(state.player.z - 100) > 1);
    // 2. Enter Rosa's coupe.
    state.player.x = -160;
    state.player.z = 104;
    state.player.angle = 0;
    input.pressed.KeyE = true;
    step(1 / 60);
    input.pressed = {};
    autoCheck('enterCar', state.player.inCar === true);
    // 3. Drive.
    driveToward(-100, 60, 4);
    autoCheck('drive', Math.abs(state.player.speed) > 2);
    // 4. Mission 1 end to end.
    startMission(state, 0, audio);
    driveToward(-168, 118, 8);
    // stage 1: in the rosa car already; drive back to garage.
    driveToward(-168, 118, 6);
    autoCheck('mission1', state.missionDone.includes(0));
    // 5. Mission 2 escape: stay in the car and outrun the 2-star tail.
    startMission(state, 1, audio);
    state.inSight = false;
    driveToward(330, 240, 26);
    autoCheck('mission2', state.missionDone.includes(1) || state.wanted === 0);
    // 6. Mission 3 survive 45s.
    startMission(state, 2, audio);
    waitSim(46);
    autoCheck('mission3', state.missionDone.includes(2));
    // 7. Mission 6 heist + escape.
    startMission(state, 5, audio);
    state.player.inCar = false;
    state.player.onFoot = true;
    state.player.carId = null;
    state.player.x = -262;
    state.player.z = -138;
    waitSim(1);
    state.inSight = false;
    state.wanted = 0;
    state.heat = 0;
    waitSim(2);
    autoCheck('mission6', state.missionDone.includes(5));
    // 8. Mission 11 convoy ram.
    startMission(state, 10, audio);
    state.health = 100;
    state.gameOver = false;
    state.busted = false;
    state.wasted = false;
    { const r = state.cars.find((c) => c.id === 'rosa'); if (r) { r.x = -180; r.z = -60; r.angle = Math.PI / 2; r.condition = 100; r.speed = 0; } }
    state.player.x = -180;
    state.player.z = -60;
    state.player.carId = 'rosa';
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.angle = Math.PI / 2;
    driveToward(-180, 20, 6);
    autoCheck('mission11-roadblock', state.flags.roadblockBroken === true || state.missionStage === 1);
    driveToward(-262, -138, 10);
    if (!state.missionDone.includes(10)) { const r = state.cars.find((c) => c.id === 'rosa'); if (r) { r.condition = 100; r.x = state.player.x; r.z = state.player.z; } driveToward(-262, -138, 10); }
    autoCheck('mission11', state.missionDone.includes(10));
    // 9. Mission 12 finale.
    startMission(state, 11, audio);
    { const r = state.cars.find((c) => c.id === 'rosa'); if (r) { r.condition = 100; } }
    driveToward(-262, -138, 10);
    if (!state.missionDone.includes(11)) { const r = state.cars.find((c) => c.id === 'rosa'); if (r) { r.condition = 100; r.x = state.player.x; r.z = state.player.z; } driveToward(-262, -138, 10); }
    autoCheck('mission12', state.missionDone.includes(11));
    // 10. Shop: garage upgrade while driving.
    state.player.x = -168;
    state.player.z = 118;
    state.money = 5000;
    updateShops(state, input, audio);
    autoCheck('shopNear', !!state.shopNear);
    const bought = state.shopNear ? buyItem(state, state.shopNear, 'upg_engine', audio) : false;
    autoCheck('garageUpgrade', bought && state.upgrades.engine === true);
    // 11. Weapon buy.
    state.player.x = 42;
    state.player.z = 18;
    updateShops(state, input, audio);
    const boughtW = state.shopNear ? buyItem(state, state.shopNear, 'w2', audio) : false;
    autoCheck('weaponBuy', boughtW && state.weaponsOwned[2] === true);
    // 12. Save / load round trip.
    state.money = 4321;
    saveGame(state);
    state.money = 0;
    loadGame(state);
    autoCheck('saveLoad', state.money === 4321);
    // 13. Radio switch + pause/resume.
    const before = state.radio;
    state.radio = (state.radio + 1) % 3;
    autoCheck('radio', state.radio !== before);
    state.paused = true;
    const t0 = state.time;
    waitSim(0);
    state.paused = false;
    autoCheck('pauseResume', state.paused === false);
    // 14. Combat: spawn an enemy ahead, fire the pistol, check damage.
    state.weaponsOwned[1] = true;
    state.ammo[1] = 30;
    state.weaponIndex = 1;
    state.player.onFoot = true;
    state.player.inCar = false;
    state.player.carId = null;
    state.cameraYaw = 0;
    state.player.angle = 0;
    const foe = spawnEnemy(state, world.scene, state.player.x, state.player.z + 12, 'goon');
    const hpBefore = foe.health;
    input.mouseDown = true;
    waitSim(1.5);
    input.mouseDown = false;
    autoCheck('combat', foe.health < hpBefore || !state.enemies.includes(foe));
  } catch (err) {
    autoLog.push({ name: 'autoplayError', ok: false, error: String(err && err.message || err) });
  }
  const passed = autoLog.filter((r) => r.ok).length;
  window.__autoplay = { running: false, results: autoLog, passed, total: autoLog.length };
  document.title = 'AUTOPLAY ' + passed + '/' + autoLog.length;
}

// ---- Frame loop ----------------------------------------------------------
let last = performance.now();
let acc = 0;
let frames = 0;
let fpsT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  frames++;
  fpsT += dt;
  if (fpsT >= 1) { state.fps = Math.round(frames / fpsT); state.frameMs = Math.round((fpsT / frames) * 1000); frames = 0; fpsT = 0; }
  if (state.autoplay && !window.__autoplayStarted) {
    window.__autoplayStarted = true;
    setTimeout(runAutoplay, 300);
  }
  if (state.started && !state.paused && !state.gameOver) {
    acc += dt;
    const maxSteps = state.autoplay ? 40 : 4;
    let n = 0;
    while (acc >= 1 / 60 && n < maxSteps) { step(1 / 60); acc -= 1 / 60; n++; }
    if (n === maxSteps) acc = 0;
  } else {
    // Title screen: keep the world alive behind it.
    syncWorld(world, state, dt);
    updateCamera(dt);
  }
  render();
  endFrame(input);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__game = { state, input, startMission, saveGame, loadGame, step };

// Apply the deterministic shot staging after the world exists. Prime the
// police once with dt=0 so the pursuit cars, the roadblock and the heli
// already exist before the first rendered frame: in headless SwiftShader
// the first frames are slow, and a screenshot taken before the first
// simulation step ran would otherwise catch an empty chase scene. A zero
// step spawns and places everything without advancing the clock, the
// mission timer, or the player.
if (shotName) {
  applyShot(state, shotName, audio);
  updatePolice(state, 0, policeMeshes, world.scene);
}
if (state.autoplay) { state.started = true; }
requestAnimationFrame(frame);
