// Saving and loading for Solmar Bay 3D: progress lives in localStorage.
import { WEAPONS } from './config.js';

const KEY = 'solmar-bay-3d-save-v1';

export function saveGame(state) {
  try {
    const data = {
      money: state.money, health: state.health, armour: state.armour,
      respect: state.respect, missionIndex: state.missionIndex,
      missionDone: state.missionDone, weaponsOwned: state.weaponsOwned,
      ammo: state.ammo, magAmmo: state.magAmmo, ownedCars: state.ownedCars, upgrades: state.upgrades,
      outfit: state.outfit, radio: state.radio, clockMin: state.clockMin, day: state.day,
      x: state.player.x, z: state.player.z, wanted: state.wanted,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    state.message = 'Progress saved'; state.messageT = 2;
    return true;
  } catch (e) { return false; }
}

export function loadGame(state) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    state.money = d.money; state.health = d.health; state.armour = d.armour;
    state.respect = d.respect; state.missionIndex = d.missionIndex;
    state.missionDone = d.missionDone || [];
    state.weaponsOwned = d.weaponsOwned; state.ammo = d.ammo;
    if (d.magAmmo) state.magAmmo = d.magAmmo;
    else state.magAmmo = state.weaponsOwned.map((o, i) => (o ? WEAPONS[i].mag : 0));
    state.ownedCars = d.ownedCars || []; state.upgrades = d.upgrades || state.upgrades;
    state.outfit = d.outfit || 0; state.radio = d.radio || 0;
    state.clockMin = d.clockMin; state.day = d.day;
    state.player.x = d.x; state.player.z = d.z; state.wanted = d.wanted || 0;
    state.heat = state.wanted * 20;
    state.message = 'Save loaded'; state.messageT = 2;
    return true;
  } catch (e) { return false; }
}

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
