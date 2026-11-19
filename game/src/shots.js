// Deterministic screenshot scenes for Solmar Bay 3D.
//
// Each shot pins the player, the clock, the money and the mission so the
// four screenshots are reproducible from `?shot=<name>&seed=7`. The chase
// shots are staged as one chase scene: traffic passing on the player's
// road, the chased car in the middle, police on the same road, and the
// helicopter above. Shot traffic is placed relative to the player here
// and re-placed every frame by the main loop (placeShotTrafficCar), so the
// composition survives however much simulation time passes before the
// screenshot is taken.
//
// Round 6 shots (four themes): beach (5-star chase on the coast road),
// city (on foot downtown, pistol out), countryside (farm run on the
// country road) and airport (on foot on the runway, 5 stars, rifle out).
import { startMission } from './missions.js';
import { playerRoad, alongOf, crossOf } from './police.js';

export const SHOT_DEFS = [
  { name: '1-beach.jpg', query: '?shot=beach&seed=7' },
  { name: '2-city.jpg', query: '?shot=city&seed=7' },
  { name: '3-countryside.jpg', query: '?shot=countryside&seed=7' },
  { name: '4-airport.jpg', query: '?shot=airport&seed=7' },
];

// Five extra traffic cars for the chase shots, relative to the player:
// three on the player's own road (two oncoming in the far lane, one
// same-direction in the near lane, all ahead so the chase camera sees them)
// and two crossing on the next cross street ahead. `offset` is measured in
// metres along the player's direction of travel from the player car, or,
// for cross-street cars, sideways from the player's road.
export const SHOT_TRAFFIC_ROLES = [
  { kind: 'along', offset: 30, lane: 2.5, dir: -1, speed: 12 },
  { kind: 'along', offset: 42, lane: 2.5, dir: -1, speed: 12 },
  { kind: 'along', offset: 38, lane: -2.5, dir: 1, speed: 12 },
  { kind: 'cross', offset: -11, lane: 2.5, dir: 1, speed: 10 },
  { kind: 'cross', offset: 11, lane: -2.5, dir: -1, speed: 10 },
];

function stagePed(p, vertical, road, side, along, dir, i) {
  p.vertical = vertical;
  p.road = road;
  p.side = side;
  p.along = along;
  p.dir = dir;
  p.speed = 1.5 + (i % 3) * 0.3;
  p.panic = 0;
  p.wait = 0;
  p.x = vertical ? road + side * 6.5 : along;
  p.z = vertical ? along : road + side * 6.5;
  p.angle = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  p.phase = i * 0.7;
}

// Park one staged traffic car from its role, relative to where the player
// is right now. Called once at shot setup and again every simulation step
// by the main loop, so the cars stay in frame no matter when the shot fires.
export function placeShotTrafficCar(state, car, role) {
  const road = playerRoad(state);
  const pAlong = alongOf(road, state.player.x, state.player.z);
  const pCross = crossOf(road, state.player.x, state.player.z) + road.line;
  car.speed = role.speed;
  car.lane = role.lane;
  car.dir = role.dir;
  if (role.kind === 'along') {
    car.vertical = road.axis === 'z';
    car.road = road.line;
    car.along = pAlong + role.offset * road.dir;
  } else {
    // Next cross street ahead of the player (never the one behind).
    const step = road.dir > 0 ? 1 : -1;
    const raw = step > 0 ? (Math.floor(pAlong / 60) + 1) * 60 : (Math.ceil(pAlong / 60) - 1) * 60;
    const limit = road.axis === 'x' ? 300 : 240;
    const line = Math.max(-limit, Math.min(limit, raw));
    car.vertical = road.axis === 'x';
    car.road = line;
    car.along = pCross + role.offset;
  }
  if (car.vertical) {
    car.x = car.road + car.lane;
    car.z = car.along;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  } else {
    car.x = car.along;
    car.z = car.road + car.lane;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

function stageShotTraffic(state) {
  for (let i = 0; i < SHOT_TRAFFIC_ROLES.length && i < state.traffic.length; i++) {
    const car = state.traffic[i];
    car.shotRole = SHOT_TRAFFIC_ROLES[i];
    placeShotTrafficCar(state, car, car.shotRole);
  }
}

export function applyShot(state, shotName, audio) {
  state.started = true;
  state.paused = false;
  const rosa = state.cars.find((c) => c.id === 'rosa');
  if (shotName === 'chase') {
    state.clockMin = 18 * 60 + 32;
    state.player.x = 0;
    state.player.z = -60;
    state.player.angle = 0;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    if (rosa) { rosa.x = 0; rosa.z = -60; rosa.angle = 0; rosa.speed = 34; rosa.condition = 82; rosa.parked = false; }
    state.money = 86250;
    state.respect = 290;
    state.cameraYaw = 0;
    state.cameraLookUp = false;
    state.heliDist = 19;
    state.heliAlt = 13;
    startMission(state, 2, audio);
    state.missionTimer = 45;
    state.dialogue = { speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'The chopper is on you, Mara — shake it and get to the hideout!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, false, false];
    state.ammo = [Infinity, 72, 150, 0, 0];
    state.magAmmo = [Infinity, 12, 30, 0, 0];
    state.weaponIndex = 2;
    state.radio = 0;
    state.health = 88;
    state.armour = 45;
    stageShotTraffic(state);
  } else if (shotName === 'beach') {
    // 1-beach: on foot on the sand at the water's edge at golden hour —
    // ocean ahead, palms and beach umbrellas around, five stars and the
    // helicopter over the water. The camera looks west, so the sea is in
    // the frame instead of behind it.
    state.clockMin = 17 * 60 + 35;
    state.player.x = -332;
    state.player.z = 85;
    state.player.angle = -Math.PI / 2;
    state.player.inCar = false;
    state.player.onFoot = true;
    state.player.carId = null;
    state.cameraYaw = -Math.PI / 2;
    state.cameraLookUp = false;
    state.money = 86250;
    state.respect = 640;
    state.wanted = 5;
    state.heat = 100;
    state.heliDist = 24;
    state.heliAlt = 16;
    state.dialogue = { speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'Five stars on Palm Beach, Mara — lose them on the coast road!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, true, true];
    state.ammo = [Infinity, 72, 150, 24, 60];
    state.magAmmo = [Infinity, 12, 30, 6, 30];
    state.weaponIndex = 2;
    state.radio = 0;
    state.health = 88;
    state.armour = 45;
  } else if (shotName === 'city') {
    state.clockMin = 12 * 60 + 20;
    state.player.x = 24;
    state.player.z = 6;
    state.player.angle = Math.PI;
    state.player.inCar = false;
    state.player.onFoot = true;
    state.player.carId = null;
    state.cameraYaw = Math.PI;
    state.money = 1240;
    state.respect = 60;
    state.wanted = 2;
    state.heat = 40;
    state.weaponsOwned = [true, true, false, false, false];
    state.ammo = [Infinity, 36, 0, 0, 0];
    state.magAmmo = [Infinity, 12, 0, 0, 0];
    state.weaponIndex = 1;
    state.dialogue = null;
    state.health = 100;
    state.armour = 20;
    const spots = [
      [false, 0, 1, -20, 1], [false, 0, -1, 0, -1], [false, 0, 1, 20, 1], [false, 0, -1, 40, -1],
      [true, 0, 1, -30, 1], [true, 0, -1, -10, -1], [true, 0, 1, 10, 1], [true, 0, -1, 30, -1],
    ];
    for (let i = 0; i < 8 && i < state.peds.length; i++) {
      const s = spots[i];
      stagePed(state.peds[i], s[0], s[1], s[2], s[3], s[4], i);
    }
  } else if (shotName === 'countryside') {
    // 3-countryside: farm run on the country road east of town at noon —
    // crop fields and the farmhouse to the south, hay bales by the road,
    // one star on the tail.
    state.clockMin = 12 * 60 + 5;
    state.player.x = 165;
    state.player.z = 180;
    state.player.angle = Math.PI / 2;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    if (rosa) { rosa.x = 165; rosa.z = 180; rosa.angle = Math.PI / 2; rosa.speed = 12; rosa.condition = 90; rosa.parked = false; }
    state.money = 5400;
    state.respect = 300;
    state.cameraYaw = Math.PI / 2;
    state.cameraLookUp = false;
    state.wanted = 1;
    state.heat = 20;
    state.heliDist = 26;
    state.heliAlt = 22;
    state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Country roads, Mara — the farm run pays if you keep it smooth.' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, true, false];
    state.ammo = [Infinity, 48, 120, 12, 0];
    state.magAmmo = [Infinity, 12, 30, 6, 0];
    state.weaponIndex = 3;
    state.radio = 0;
    state.health = 100;
    state.armour = 20;
    stageShotTraffic(state);
  } else if (shotName === 'airport') {
    // 4-airport: on foot on the runway at morning, rifle out — the parked
    // plane and the control tower ahead, hangars to the north, five stars
    // and the helicopter overhead for the maximum response.
    state.clockMin = 9 * 60 + 40;
    state.player.x = 222;
    state.player.z = 140;
    state.player.angle = Math.PI / 2;
    state.player.inCar = false;
    state.player.onFoot = true;
    state.player.carId = null;
    state.cameraYaw = Math.PI / 2;
    state.money = 12400;
    state.respect = 900;
    state.wanted = 5;
    state.heat = 100;
    state.heliDist = 24;
    state.heliAlt = 14;
    state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Five stars on the runway, Mara — the whole bay is watching!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, true, true];
    state.ammo = [Infinity, 72, 150, 24, 60];
    state.magAmmo = [Infinity, 12, 30, 6, 30];
    state.weaponIndex = 4;
    state.radio = 0;
    state.health = 100;
    state.armour = 60;
    // Ground crew standing by the parked plane.
    const crew = [[252, 134, 0.6], [258, 147, -0.8], [266, 138, 2.4], [250, 149, 1.8]];
    for (let i = 0; i < crew.length && i < state.peds.length; i++) {
      const p = state.peds[i];
      p.x = crew[i][0];
      p.z = crew[i][1];
      p.angle = crew[i][2];
      p.speed = 0;
      p.panic = 0;
      p.wait = 0;
      p.phase = i * 0.7;
    }
  } else if (shotName === 'mission') {
    state.clockMin = 17 * 60 + 10;
    state.player.x = -180;
    state.player.z = -60;
    state.player.angle = Math.PI / 2;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    if (rosa) { rosa.x = -180; rosa.z = -60; rosa.angle = Math.PI / 2; rosa.speed = 36; rosa.condition = 76; rosa.parked = false; }
    state.cameraYaw = Math.PI / 2;
    state.money = 5400;
    state.respect = 640;
    startMission(state, 10, audio);
    state.missionStage = 0;
    state.roadblocks = [];
    state.heliDist = 22;
    state.heliAlt = 15;
    state.heliAngle = -2.4;
    state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Full speed, Mara — straight through that roadblock!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, true, false];
    state.ammo = [Infinity, 48, 120, 12, 0];
    state.magAmmo = [Infinity, 12, 30, 6, 0];
    state.weaponIndex = 1;
    state.health = 92;
    state.armour = 60;
    const spots = [
      [true, -180, -1, -80, 1], [true, -180, 1, -70, -1], [true, -180, -1, -40, 1],
      [true, -180, 1, -80, -1], [true, -180, -1, -50, 1], [true, -180, 1, -40, -1],
    ];
    for (let i = 0; i < 6 && i < state.peds.length; i++) {
      const s = spots[i];
      stagePed(state.peds[i], s[0], s[1], s[2], s[3], s[4], i);
    }
    stageShotTraffic(state);
  } else if (shotName === 'night') {
    state.clockMin = 22 * 60 + 15;
    state.player.x = 0;
    state.player.z = -40;
    state.player.angle = 0;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    if (rosa) { rosa.x = 0; rosa.z = -40; rosa.angle = 0; rosa.speed = 32; rosa.condition = 94; rosa.parked = false; }
    state.cameraYaw = 0;
    state.money = 3120;
    state.respect = 180;
    state.wanted = 0;
    state.heat = 0;
    state.radio = 1;
    state.dialogue = null;
    state.weaponsOwned = [true, true, false, false, false];
    state.ammo = [Infinity, 60, 0, 0, 0];
    state.magAmmo = [Infinity, 12, 0, 0, 0];
    state.health = 100;
    state.armour = 0;
  }
  state.cameraShot = shotName;
}
