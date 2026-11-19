// Saving and loading: money, completed missions, owned weapons and cars,
// respect, garage upgrades and the player's position, in local storage.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      respect: state.respect,
      health: state.health,
      armour: state.armour,
      completed: state.missions.saveData().completed,
      unlocked: state.missions.saveData().unlocked,
      weaponsOwned: state.weaponsOwned,
      ammo: state.ammo,
      ownedCars: state.ownedCars,
      carUpgrades: state.car ? state.car.upgrades : {},
      shirtColor: state.player.shirtColor,
      x: state.player.x, z: state.player.z,
      clock: state.clock,
      station: state.audio.stationIndex(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
