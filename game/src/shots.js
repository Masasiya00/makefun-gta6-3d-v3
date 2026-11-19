// Solmar Bay 3D — staged screenshot scenes for the four cover shots.
// Fresh rewrite for the Fix Round 1 visual pass (cover composition, beams).
import { addWanted } from './config.js';
import { startMission } from './missions.js';

export const SHOT_DEFS = [
  { name: '1-cover.jpg', query: '?shot=chase&seed=7' },
  { name: '2-city.jpg', query: '?shot=city&seed=7' },
  { name: '3-mission.jpg', query: '?shot=mission&seed=7' },
  { name: '4-night.jpg', query: '?shot=night&seed=7' },
];

export function applyShot(state, shotName, audio) {
  state.started = true;
  state.paused = false;

  if (shotName === 'chase') {
    // Golden-hour chase, the cover: 3-star pursuit, heli overhead, Rosa talks.
    state.clockMin = 18 * 60 + 32;
    state.player.x = 0;
    state.player.z = -60;
    state.player.angle = 0;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    const rosa = state.cars.find((c) => c.id === 'rosa');
    if (rosa) {
      rosa.x = 0;
      rosa.z = -60;
      rosa.angle = 0;
      rosa.speed = 34;
      rosa.condition = 82;
      rosa.parked = false;
    }
    state.money = 86250;
    state.respect = 290;
    state.cameraYaw = 0;
    state.cameraLookUp = false;
    state.heliDist = 24;
    state.heliAlt = 9;
    startMission(state, 2, audio);
    state.missionTimer = 45;
    state.dialogue = { speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: 'The chopper is on you, Mara — shake it and get to the hideout!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, false, false];
    state.ammo = [Infinity, 72, 150, 0, 0];
    state.weaponIndex = 2;
    state.radio = 0;
    state.health = 88;
    state.armour = 45;
  } else if (shotName === 'city') {
    // Downtown on foot, midday.
    state.clockMin = 12 * 60 + 20;
    state.player.x = 24;
    state.player.z = 6;
    state.player.angle = Math.PI;
    state.player.onFoot = true;
    state.player.inCar = false;
    state.cameraYaw = Math.PI;
    state.money = 1240;
    state.respect = 60;
    state.wanted = 0;
    state.heat = 0;
    state.weaponsOwned = [true, true, false, false, false];
    state.ammo = [Infinity, 36, 0, 0, 0];
    state.dialogue = null;
    state.health = 100;
    state.armour = 20;
  } else if (shotName === 'mission') {
    // Mission 11 roadblock: full speed straight through it.
    state.clockMin = 17 * 60 + 10;
    state.player.x = -180;
    state.player.z = -60;
    state.player.angle = Math.PI / 2;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    const rosa = state.cars.find((c) => c.id === 'rosa');
    if (rosa) {
      rosa.x = -180;
      rosa.z = -60;
      rosa.angle = Math.PI / 2;
      rosa.speed = 36;
      rosa.condition = 76;
      rosa.parked = false;
    }
    state.cameraYaw = Math.PI / 2;
    state.money = 5400;
    state.respect = 640;
    state.heliDist = 22;
    state.heliAlt = 15;
    state.heliAngle = -2.4;
    startMission(state, 10, audio);
    state.missionStage = 0;
    state.roadblocks = [];
    state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Full speed, Mara — straight through that roadblock!' };
    state.dialogueT = 999;
    state.weaponsOwned = [true, true, true, true, false];
    state.ammo = [Infinity, 48, 120, 12, 0];
    state.weaponIndex = 1;
    state.health = 92;
    state.armour = 60;
  } else if (shotName === 'night') {
    // Night drive downtown: headlights on, lamps glowing.
    state.clockMin = 22 * 60 + 15;
    state.player.x = 0;
    state.player.z = -40;
    state.player.angle = 0;
    state.player.inCar = true;
    state.player.onFoot = false;
    state.player.carId = 'rosa';
    const rosa = state.cars.find((c) => c.id === 'rosa');
    if (rosa) {
      rosa.x = 0;
      rosa.z = -40;
      rosa.angle = 0;
      rosa.speed = 32;
      rosa.condition = 94;
      rosa.parked = false;
    }
    state.cameraYaw = 0;
    state.money = 3120;
    state.respect = 180;
    state.wanted = 0;
    state.heat = 0;
    state.radio = 1;
    state.dialogue = null;
    state.weaponsOwned = [true, true, false, false, false];
    state.ammo = [Infinity, 60, 0, 0, 0];
    state.health = 100;
    state.armour = 0;
  }

  state.cameraShot = shotName;
}

