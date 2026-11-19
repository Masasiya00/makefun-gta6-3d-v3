// Shops and economy for Solmar Bay 3D: Rosa's Garage, Ironworks Arms,
// Tico Tacos, Neon Threads and Marina Motors, plus garage upgrades.
import { SHOPS, GARAGE_UPGRADES, WEAPONS, CAR_MODELS, RESPECT_RANKS, respectRankFor } from './config.js';
import { dist2d } from './random.js';
import { playCash, playClick } from './audio.js';

export function nearestShop(state) {
  for (const s of SHOPS) {
    if (dist2d(state.player.x, state.player.z, s.x, s.z) < 14) return s;
  }
  return null;
}

export function shopItems(state, shop) {
  if (!shop) return [];
  if (shop.kind === 'garage') {
    const items = [{ id: 'repair', name: 'Repair current car', price: 150, desc: 'Condition back to 100%' }];
    items.push({ id: 'armour', name: 'Body armour', price: 200, desc: '+50 armour' });
    for (const u of GARAGE_UPGRADES) {
      items.push({ id: 'upg_' + u.id, name: u.name, price: u.price, desc: u.desc + (state.upgrades[u.id] ? ' — OWNED' : '') });
    }
    return items;
  }
  if (shop.kind === 'arms') {
    return WEAPONS.slice(1).map((w, i) => ({
      id: 'w' + (i + 1), name: w.name + (state.weaponsOwned[i + 1] ? ' — ammo refill' : ''), price: state.weaponsOwned[i + 1] ? 150 : w.price,
      desc: w.damage + ' dmg · ' + w.range + 'm range',
    }));
  }
  if (shop.kind === 'food') {
    return [
      { id: 'taco', name: 'Tico Taco', price: 25, desc: '+30 health' },
      { id: 'burrito', name: 'Bay Burrito', price: 60, desc: '+70 health' },
      { id: 'feast', name: 'Coral Feast', price: 120, desc: 'Full health' },
    ];
  }
  if (shop.kind === 'clothes') {
    return [
      { id: 'outfit1', name: 'Sunset Tee', price: 80, desc: 'New colours for Mara' },
      { id: 'outfit2', name: 'Neon Jacket', price: 220, desc: 'New colours for Mara' },
      { id: 'outfit3', name: 'Bay Royal', price: 450, desc: 'New colours for Mara' },
    ];
  }
  if (shop.kind === 'motors') {
    return CAR_MODELS.map((c, i) => ({
      id: 'car_' + c.id, name: c.name, price: 1500 + i * 700,
      desc: 'Top ' + Math.round(c.top * 3.6) + ' km/h · ' + (respectRankFor(state.respect) >= Math.min(3, Math.floor(i / 3)) ? 'available' : 'needs ' + RESPECT_RANKS[Math.min(3, Math.floor(i / 3))].name),
    }));
  }
  return [];
}

export function buyItem(state, shop, itemId, audio) {
  const item = shopItems(state, shop).find((i) => i.id === itemId);
  if (!item) return false;
  if (state.money < item.price) { state.message = 'Not enough cash — $' + item.price + ' needed'; state.messageT = 2; return false; }
  // Respect gates for Marina Motors.
  if (shop.kind === 'motors') {
    const idx = CAR_MODELS.findIndex((c) => 'car_' + c.id === itemId);
    const need = Math.min(3, Math.floor(idx / 3));
    if (respectRankFor(state.respect) < need) { state.message = 'Needs respect rank ' + RESPECT_RANKS[need].name; state.messageT = 2; return false; }
  }
  state.money -= item.price;
  if (shop.kind === 'garage') {
    if (itemId === 'repair') {
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (car) { car.condition = 100; car.smoke = 0; }
    }
    if (itemId === 'armour') state.armour = Math.min(100, state.armour + 50);
    if (itemId.startsWith('upg_')) state.upgrades[itemId.slice(4)] = true;
  }
  if (shop.kind === 'arms') {
    const wi = parseInt(itemId.slice(1), 10);
    if (!state.weaponsOwned[wi]) { state.weaponsOwned[wi] = true; state.ammo[wi] = WEAPONS[wi].ammo; }
    else state.ammo[wi] += WEAPONS[wi].ammo;
    state.weaponIndex = wi;
  }
  if (shop.kind === 'food') {
    if (itemId === 'taco') state.health = Math.min(100, state.health + 30);
    if (itemId === 'burrito') state.health = Math.min(100, state.health + 70);
    if (itemId === 'feast') state.health = 100;
  }
  if (shop.kind === 'clothes') {
    state.outfit = (state.outfit + 1) % 5;
  }
  if (shop.kind === 'motors') {
    const idx = CAR_MODELS.findIndex((c) => 'car_' + c.id === itemId);
    state.ownedCars.push(CAR_MODELS[idx].id);
    state.message = CAR_MODELS[idx].name + ' is yours — parked at the Marina';
  }
  if (audio) playCash(audio);
  state.message = 'Bought: ' + item.name + ' (-$' + item.price + ')'; state.messageT = 2.5;
  return true;
}

export function updateShops(state, input, audio) {
  state.shopNear = nearestShop(state);
  if (input.pressed.KeyF && state.shopNear && !state.player.inCar) {
    state.shopOpen = !state.shopOpen;
    if (audio) playClick(audio);
  }
}
