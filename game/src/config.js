// Every tuning number, name and colour in one place. The city is a fixed
// 3600 x 2600 metre map; the ocean lies west of x = -1500.
export const STEP = 1 / 60;
export const WORLD = { minX: -1800, maxX: 1800, minZ: -1300, maxZ: 1300, beachX: -1500, waterX: -1560 };
export const SAVE_KEY = 'solmar-bay.save.v3';

// Roads: vertical avenues and horizontal streets, 12 m wide.
export const ROADS_X = [-1400, -1000, -600, -200, 200, 600, 1000, 1400];
export const ROADS_Z = [-1000, -600, -200, 200, 600, 1000];
export const ROAD_W = 12;

export const DISTRICTS = [
  { name: 'Palm Beach', x0: -1800, z0: -1300, x1: -1400, z1: 1300, color: 0xe8d8a0 },
  { name: 'Old Town', x0: -1400, z0: -1300, x1: -1000, z1: -200, color: 0xd98a5f },
  { name: 'Dockside', x0: -1400, z0: -200, x1: -1000, z1: 600, color: 0x8a94a0 },
  { name: 'Airfield', x0: -1400, z0: 600, x1: -1000, z1: 1300, color: 0x9aa5a0 },
  { name: 'Downtown', x0: -200, z0: -600, x1: 1000, z1: 200, color: 0x5f7fb0 },
  { name: 'Marina', x0: 600, z0: -1300, x1: 1400, z1: -600, color: 0x4fa8c8 },
  { name: 'Coral Heights', x0: 1000, z0: -600, x1: 1800, z1: 200, color: 0xc88a9a },
  { name: 'Bayview', x0: -1000, z0: -1300, x1: -200, z1: -600, color: 0x7fb069 },
  { name: 'Fairground', x0: -1000, z0: 600, x1: -200, z1: 1300, color: 0xe06a9a },
  { name: 'University', x0: -200, z0: 200, x1: 600, z1: 1000, color: 0x8a6fc8 },
  { name: 'Stadium', x0: 600, z0: 200, x1: 1400, z1: 1000, color: 0xd0a03c },
  { name: 'Lighthouse Point', x0: 1400, z0: -600, x1: 1800, z1: 1300, color: 0x6a8a9a },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
  }
  return 'Solmar Bay';
}

// Eight drivable models. topSpeed in m/s, accel, grip and price shape each one.
export const CARS = [
  { id: 'hatch', name: 'Pip Hatch', kind: 'hatchback', top: 34, accel: 16, grip: 2.6, colors: [0xe8e8e8, 0x4fa8c8, 0xf2c94c], price: 0 },
  { id: 'sedan', name: 'Coral Sedan', kind: 'sedan', top: 38, accel: 18, grip: 2.4, colors: [0x2a3040, 0x8a94a0, 0x7fb069], price: 1200 },
  { id: 'coupe', name: 'Vela Coupe', kind: 'coupe', top: 48, accel: 24, grip: 2.2, colors: [0xd43d2a, 0xf2c94c, 0x111111], price: 4500 },
  { id: 'suv', name: 'Tide SUV', kind: 'suv', top: 36, accel: 15, grip: 2.8, colors: [0x3c5a78, 0xe8e8e8, 0x5a3c2a], price: 3200 },
  { id: 'pickup', name: 'Dune Pickup', kind: 'pickup', top: 35, accel: 15, grip: 2.7, colors: [0x7a4a2a, 0x4a6a3a, 0x9aa5a0], price: 2800 },
  { id: 'taxi', name: 'Bay Taxi', kind: 'taxi', top: 37, accel: 17, grip: 2.5, colors: [0xf2c94c], price: 0 },
  { id: 'convert', name: 'Sol Convertible', kind: 'convertible', top: 44, accel: 21, grip: 2.3, colors: [0xe06a9a, 0x4fa8c8, 0xffffff], price: 6000 },
  { id: 'lowrider', name: 'Palm Lowrider', kind: 'lowrider', top: 40, accel: 19, grip: 2.0, colors: [0x7a2a8a, 0x2a8a6a, 0xc8a03c], price: 5200 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', slot: 0, damage: 12, rate: 2.2, range: 2.2, ammo: Infinity, price: 0, auto: false },
  { id: 'pistol', name: 'P9 Pistol', slot: 1, damage: 22, rate: 3.5, range: 55, ammo: 120, price: 400, auto: false },
  { id: 'smg', name: 'Sting SMG', slot: 2, damage: 13, rate: 9, range: 45, ammo: 240, price: 1200, auto: true },
  { id: 'shotgun', name: 'Boomstick', slot: 3, damage: 9, rate: 1.1, range: 22, ammo: 40, price: 900, auto: false, pellets: 7 },
];
// Slot 4 is the locked "Sniper" teaser shown in the wheel.
export const LOCKED_SLOT = { id: 'sniper', name: 'Longshot', slot: 4, price: 3500 };

export const RESPECT_RANKS = [
  { name: 'Rookie', need: 0 },
  { name: 'Wheelman', need: 120 },
  { name: 'Shot Caller', need: 350 },
  { name: 'King of the Bay', need: 800 },
];

export const SHOPS = [
  { id: 'garage', name: "Rosa's Garage", x: -1180, z: -420, color: '#e06a4f', blurb: 'Repairs, armour and garage upgrades.' },
  { id: 'arms', name: 'Ironworks Arms', x: 120, z: -420, color: '#8a94a0', blurb: 'Weapons and ammunition.' },
  { id: 'tacos', name: 'Tico Tacos', x: -820, z: -820, color: '#f2c94c', blurb: 'Food that restores health.' },
  { id: 'threads', name: 'Neon Threads', x: 420, z: 120, color: '#e06a9a', blurb: 'Clothes that change your colours.' },
  { id: 'motors', name: 'Marina Motors', x: 980, z: -980, color: '#4fa8c8', blurb: 'Buy owned cars, unlocked by respect.' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Turbo Engine', price: 800, desc: '+15% top speed' },
  { id: 'brakes', name: 'Race Brakes', price: 500, desc: 'Much stronger braking' },
  { id: 'plating', name: 'Armour Plating', price: 700, desc: 'Car takes half damage' },
];

export const RADIO_STATIONS = [
  { id: 'sunset', name: 'SUNSET 88.4', song: 'Golden Hour Drift', mood: 'chill' },
  { id: 'dance', name: 'BAY FM 101', song: 'Neon Tide', mood: 'dance' },
  { id: 'talk', name: 'TALK BAY 1290', song: 'The Rosa Hour', mood: 'talk' },
];

export const TALK_LINES = [
  'Rosa: Mara, the bay never sleeps. Neither do the cops.',
  'DJ Sal: Traffic on the causeway is a nightmare, folks. Take the coast road.',
  'Rosa: You want respect in this town? Earn it behind the wheel.',
  'DJ Sal: And remember — if the helicopter is over you, you are famous.',
  'Rosa: Garage is open all night. Bring the car back in one piece, yeah?',
];

export const MISSIONS = [
  { id: 1, name: 'First Wheels', reward: 300, respect: 40, brief: 'Meet Rosa at her garage, take the Coral Sedan and drive it back to the garage.', start: { x: -1180, z: -420 }, target: { x: -1180, z: -406 }, type: 'drive' },
  { id: 2, name: 'Beach Run', reward: 450, respect: 60, brief: 'You are at two stars. Break line of sight and stay hidden until the heat fades.', start: { x: -1500, z: 200 }, target: null, type: 'escape', stars: 2 },
  { id: 3, name: 'Hot Pursuit', reward: 600, respect: 70, brief: 'Survive a 45-second three-star chase. The helicopter is already in the air.', start: { x: 200, z: -200 }, target: null, type: 'survive', seconds: 45, stars: 3 },
  { id: 4, name: 'Dockside Deal', reward: 800, respect: 80, brief: 'Carry the package across the city to the docks. Do not let the police see you.', start: { x: -1180, z: -420 }, target: { x: -1180, z: 200 }, type: 'deliver' },
  { id: 5, name: 'Night Shift', reward: 1000, respect: 90, brief: 'A night delivery through Downtown. Traffic is thick and patrols are out.', start: { x: 200, z: -200 }, target: { x: 120, z: -420 }, type: 'deliver', night: true },
  { id: 6, name: 'High Tide Heist', reward: 1500, respect: 120, brief: 'Rob the Marina store, then escape a four-star response. The guards are armed.', start: { x: 980, z: -980 }, target: { x: 980, z: -980 }, type: 'rob', stars: 4 },
  { id: 7, name: 'The Getaway', reward: 2000, respect: 140, brief: 'A long chase across four districts to the hideout in Coral Heights.', start: { x: 200, z: -200 }, target: { x: 1200, z: -200 }, type: 'drive', stars: 2 },
  { id: 8, name: 'Fairground Rush', reward: 1750, respect: 130, brief: 'Win a street race through the Fairground at dusk. Hit every checkpoint.', start: { x: -600, z: 1000 }, target: null, type: 'race', seconds: 90 },
  { id: 9, name: 'Campus Courier', reward: 1200, respect: 100, brief: 'Timed deliveries across the University and the Stadium. 75 seconds.', start: { x: 200, z: 600 }, target: null, type: 'race', seconds: 75 },
  { id: 10, name: 'Lighthouse Run', reward: 2200, respect: 160, brief: 'A five-star escape along the coast to Lighthouse Point. Do not stop.', start: { x: -1500, z: -600 }, target: { x: 1600, z: 800 }, type: 'drive', stars: 5 },
  { id: 11, name: 'The Convoy', reward: 2500, respect: 180, brief: 'Ram the police roadblock on the causeway and break through to the other side.', start: { x: 600, z: -200 }, target: { x: 1400, z: -200 }, type: 'ram', stars: 3 },
  { id: 12, name: 'King of the Bay', reward: 3000, respect: 250, brief: 'The finale: five stars, the whole bay hunting you. Reach the marina alive.', start: { x: 200, z: -200 }, target: { x: 980, z: -966 }, type: 'drive', stars: 5 },
];

export const DIALOGUE = {
  rosa: { name: 'Rosa', color: '#e06a4f', portrait: 'R' },
  mara: { name: 'Mara', color: '#4fa8c8', portrait: 'M' },
  sal: { name: 'DJ Sal', color: '#f2c94c', portrait: 'S' },
  cop: { name: 'Dispatch', color: '#8a94a0', portrait: 'D' },
};

export const PALETTE = {
  skyDay: 0x87b5d9, skySunset: 0xff9a52, skyNight: 0x0e1424,
  sunDay: 0xfff2d8, sunSunset: 0xff7a2a, sunNight: 0x8fa8d8,
  road: 0x2e3238, sidewalk: 0x9a938a, grass: 0x6a9a4f, sand: 0xe8d8a0,
  water: 0x2a7a9a, text: '#eef1f5', muted: '#9aa3ad', accent: '#ff5c8a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
