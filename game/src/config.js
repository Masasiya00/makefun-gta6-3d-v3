// Shared game data and the single mutable game state for Solmar Bay 3D.
// Every module reads and writes this one state object; rendering only reads it.
import { makeRng, clamp } from './random.js';

export const WORLD = { halfX: 360, halfZ: 260, beachX: -300, oceanX: -420 };

export const DISTRICTS = [
  { name: 'Palm Beach', x: -300, z: 40, color: 0xf2d8a0, style: 'beach' },
  { name: 'Old Town', x: -170, z: 140, color: 0xe8a06a, style: 'oldtown' },
  { name: 'Dockside', x: -220, z: -190, color: 0x8a94a6, style: 'docks' },
  { name: 'Downtown', x: 20, z: -10, color: 0x9fb8d8, style: 'downtown' },
  { name: 'Marina', x: -280, z: -120, color: 0x7fd4c8, style: 'marina' },
  { name: 'Coral Heights', x: 180, z: -180, color: 0xc9a0d8, style: 'hills' },
  { name: 'Airfield', x: 240, z: 140, color: 0xb8b8b0, style: 'airfield' },
  { name: 'Bayview', x: 120, z: 180, color: 0x9fd89a, style: 'suburb' },
  { name: 'Fairground', x: -60, z: 200, color: 0xf28ab2, style: 'fair' },
  { name: 'University', x: 200, z: 40, color: 0x8ab2f2, style: 'campus' },
  { name: 'Stadium', x: 60, z: -200, color: 0xd8d8d8, style: 'stadium' },
  { name: 'Lighthouse Point', x: -330, z: 220, color: 0xf2e6c8, style: 'cliff' },
];

export function districtAt(x, z) {
  let best = DISTRICTS[0], bestD = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.x, dz = z - d.z, dd = dx * dx + dz * dz;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export const CAR_MODELS = [
  { id: 'hatch', name: 'Pip Squeak', top: 34, accel: 16, grip: 2.6, colors: [0xf2c14e, 0x7ec8e3, 0xe26d5a] },
  { id: 'sedan', name: 'Solmar Regent', top: 40, accel: 18, grip: 2.8, colors: [0x3a6ea5, 0x8a8f98, 0x222831] },
  { id: 'coupe', name: 'Veloz Comet RS', top: 52, accel: 26, grip: 3.4, colors: [0xe63946, 0xff8c00, 0x1d3557] },
  { id: 'suv', name: 'Bayside Titan', top: 38, accel: 15, grip: 2.4, colors: [0x2f5233, 0x6b705c, 0xdde5b6] },
  { id: 'pickup', name: 'Coral Hauler', top: 36, accel: 15, grip: 2.5, colors: [0x7a3b2e, 0x4a6fa5, 0xc9c9c9] },
  { id: 'taxi', name: 'Bay Cab', top: 38, accel: 17, grip: 2.7, colors: [0xffc300, 0xffc300, 0xffc300] },
  { id: 'convertible', name: 'Sunset Spyder', top: 48, accel: 23, grip: 3.1, colors: [0xff5d8f, 0xffffff, 0x00b4d8] },
  { id: 'lowrider', name: 'Palm Low', top: 42, accel: 19, grip: 2.9, colors: [0x6a0dad, 0x00a896, 0xf3722c] },
];

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', price: 0, damage: 12, rate: 2.2, range: 2.2, ammo: Infinity, mag: Infinity, auto: false },
  { id: 'pistol', name: 'VESPER', price: 350, damage: 22, rate: 3.5, range: 55, ammo: 72, mag: 12, auto: false },
  { id: 'smg', name: 'MAKO', price: 1200, damage: 14, rate: 9, range: 48, ammo: 150, mag: 30, auto: true },
  { id: 'shotgun', name: 'BREAKER', price: 2600, damage: 70, rate: 1.1, range: 26, ammo: 24, mag: 6, auto: false },
  { id: 'rifle', name: 'KESTREL', price: 5200, damage: 45, rate: 6, range: 90, ammo: 60, mag: 30, auto: true },
];

export const RESPECT_RANKS = [
  { name: 'ROOKIE', need: 0 },
  { name: 'WHEELMAN', need: 150 },
  { name: 'SHOT CALLER', need: 550 },
  { name: 'KING OF THE BAY', need: 1200 },
];

export const SHOPS = [
  { id: 'garage', name: "Rosa's Garage", x: -168, z: 118, kind: 'garage', blurb: 'Repairs, armour & garage upgrades' },
  { id: 'arms', name: 'Ironworks Arms', x: 42, z: 18, kind: 'arms', blurb: 'Weapons & ammunition' },
  { id: 'tacos', name: 'Tico Tacos', x: -148, z: 96, kind: 'food', blurb: 'Hot food restores health' },
  { id: 'threads', name: 'Neon Threads', x: -6, z: 42, kind: 'clothes', blurb: 'Fresh threads, new colours' },
  { id: 'motors', name: 'Marina Motors', x: -262, z: -138, kind: 'motors', blurb: 'Buy cars, unlocked by respect' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Turbo Engine', price: 900, desc: '+25% top speed' },
  { id: 'brakes', name: 'Race Brakes', price: 500, desc: 'Sharper braking & grip' },
  { id: 'plating', name: 'Armour Plating', price: 1100, desc: 'Car takes half damage' },
];

export const RADIO_STATIONS = [
  { name: 'CELESTE 98.1', song: 'Malecón Mirage · Vela Roja', mood: 'chill' },
  { name: 'BAY FM 104.7', song: 'Neon Tide · DJ Coral', mood: 'dance' },
  { name: 'TALK BAY 88.3', song: 'The Rosa Hour · call-ins live', mood: 'talk' },
];

export const MISSIONS = [
  { id: 1, name: 'First Wheels', reward: 300, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: "Mara, you're new in Solmar Bay. My garage needs a driver. Take the coupe out front and bring it back to me.", objective: 'Meet Rosa at her garage', next: 'Take the coupe and drive it back' },
  { id: 2, name: 'Beach Run', reward: 450, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'The cops are sniffing around Palm Beach. Lose that two-star tail — stay out of sight and let the heat die.', objective: 'Lose the 2-star pursuit', next: 'Break line of sight until stars fade' },
  { id: 3, name: 'Hot Pursuit', reward: 600, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'Three stars now, and the chopper is up. Survive 45 seconds of this chase and get to the hideout.', objective: 'Survive the 3-star chase — 45s', next: 'Keep moving, dodge the roadblocks' },
  { id: 4, name: 'Dockside Deal', reward: 800, speaker: 'Dario', role: 'DOCK FIXER', color: '#54a0ff', text: 'A package needs to reach the docks, no questions. Carry it across town and keep the cops off your back.', objective: 'Carry the package to Dockside', next: 'Avoid police on the way' },
  { id: 5, name: 'Night Shift', reward: 1000, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'Night delivery through Downtown. Traffic is thick and patrols are out. Drive smooth, drive fast.', objective: 'Night delivery through Downtown', next: 'Reach the drop-off before dawn' },
  { id: 6, name: 'High Tide Heist', reward: 1500, speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'We hit the Marina store at high tide. Grab the cash, then shake a four-star response. No hesitation.', objective: 'Rob the Marina store & escape', next: 'Grab the cash, then lose 4 stars' },
  { id: 7, name: 'The Getaway', reward: 2000, speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Long chase, four districts, one hideout. They will throw everything at us. Drive like the bay is on fire.', objective: 'Cross 4 districts to the hideout', next: 'Stay ahead of the pursuit' },
  { id: 8, name: 'Fairground Rush', reward: 1750, speaker: 'Kiko', role: 'STREET RACER', color: '#f368e0', text: 'Street race through the Fairground at dusk. Beat the pack to the ferris wheel and the pot is yours.', objective: 'Win the Fairground street race', next: 'Beat the rival cars to the wheel' },
  { id: 9, name: 'Campus Courier', reward: 1200, speaker: 'Ana', role: 'STUDENT FIXER', color: '#1dd1a1', text: 'Timed deliveries across the University and the Stadium. Three drops, one clock. Do not be late.', objective: 'Timed deliveries: University & Stadium', next: 'Hit all three drops before the timer' },
  { id: 10, name: 'Lighthouse Run', reward: 2200, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'Five stars, Mara. Coast road to Lighthouse Point, cops everywhere. If you make it, the whole bay knows your name.', objective: 'Five-star escape to Lighthouse Point', next: 'Reach the lighthouse alive' },
  { id: 11, name: 'The Convoy', reward: 2500, speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'A police roadblock sits on the causeway. Ram straight through it and break the convoy. Full speed, no brakes.', objective: 'Ram the causeway roadblock', next: 'Smash through and keep going' },
  { id: 12, name: 'King of the Bay', reward: 3000, speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'The finale. Five stars, the whole city hunting you. Survive it all and reach the marina — then the bay is yours.', objective: 'Survive 5 stars & reach the Marina', next: 'Reach Marina Motors alive' },
];

export function createState(seed) {
  const rng = makeRng(seed);
  const s = {
    seed, rng, time: 0, clockMin: 18 * 60 + 48, day: 1,
    money: 250, health: 100, armour: 0, wanted: 0, heat: 0,
    respect: 0, respectRank: 0, inSight: false, lastSeen: { x: 0, z: 0 },
    searchZone: { x: 0, z: 0, r: 60 },
    player: { x: -150, z: 100, angle: 0, speed: 0, onFoot: true, inCar: false, carId: null, walkPhase: 0 },
    cars: [], traffic: [], peds: [], police: [], roadblocks: [], pickups: [], enemies: [],
    heli: null, heliAngle: 0,
    missionIndex: 0, missionActive: false, missionStage: 0, missionTimer: 0,
    missionDone: [], missionText: '', missionNext: '', missionProgress: 0,
    dialogue: null, dialogueT: 0,
    weaponsOwned: [true, false, false, false, false], ammo: [Infinity, 0, 0, 0, 0],
    magAmmo: [Infinity, 12, 30, 6, 30], reloadT: 0, weaponSwitchT: 0,
    weaponIndex: 0, ownedCars: [], upgrades: { engine: false, brakes: false, plating: false },
    outfit: 0, radio: 0, muted: false, paused: false, started: false,
    busted: false, wasted: false, victory: false, gameOver: false,
    shot: null, autoplay: false, autoResult: null, fps: 0, frameMs: 0,
    cameraMode: 'chase', shake: 0, speedKmh: 0, gear: 1,
    shopNear: null, shopOpen: false, message: '', messageT: 0,
    stats: { carsStolen: 0, shotsFired: 0, escapes: 0, missionsDone: 0 },
    flags: {},
  };
  return s;
}

export function respectRankFor(points) {
  let r = 0;
  for (let i = 0; i < RESPECT_RANKS.length; i++) if (points >= RESPECT_RANKS[i].need) r = i;
  return r;
}

export function addRespect(state, n) {
  state.respect += n;
  state.respectRank = respectRankFor(state.respect);
}

export function addWanted(state, n) {
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.heat = Math.max(state.heat, state.wanted * 20);
}

export function formatClock(mins) {
  const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function timeOfDay(state) {
  const h = (state.clockMin / 60) % 24;
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 19.5) return 'golden';
  return 'night';
}
