// The five shops and the economy: money earned from missions and pickups,
// spent on repairs, armour, garage upgrades that change the car's performance,
// weapons and ammunition, food that restores health, clothes that change the
// character's colours, and owned cars unlocked by respect rank.
import { SHOPS, GARAGE_UPGRADES, WEAPONS, CARS, RESPECT_RANKS } from './config.js';

export function rankFor(respect) {
  let rank = RESPECT_RANKS[0];
  let next = null;
  for (let i = 0; i < RESPECT_RANKS.length; i += 1) {
    if (respect >= RESPECT_RANKS[i].need) rank = RESPECT_RANKS[i];
    else { next = RESPECT_RANKS[i]; break; }
  }
  return { rank, next };
}

export function createShops() {
  function itemsFor(shopId, state) {
    const items = [];
    if (shopId === 'garage') {
      items.push({ id: 'repair', name: 'Repair current car', price: 150, desc: 'Restores the car to full condition', can: !!state.car, run: () => { if (state.car) state.car.health = 100; } });
      items.push({ id: 'armour', name: 'Body armour', price: 200, desc: '+50 armour', can: state.armour < 100, run: () => { state.armour = Math.min(100, state.armour + 50); } });
      for (const u of GARAGE_UPGRADES) {
        items.push({
          id: u.id, name: u.name, price: u.price, desc: u.desc,
          can: state.car && !state.car.upgrades[u.id],
          run: () => { if (state.car) state.car.upgrades[u.id] = true; },
        });
      }
    } else if (shopId === 'arms') {
      for (const w of WEAPONS) {
        if (w.id === 'fists') continue;
        items.push({
          id: 'buy-' + w.id, name: w.name, price: w.price, desc: `Damage ${w.damage} · ${w.ammo} rounds included`,
          can: !state.weaponsOwned.includes(w.id),
          run: () => { state.weaponsOwned.push(w.id); state.ammo[w.id] = w.ammo; },
        });
        items.push({
          id: 'ammo-' + w.id, name: `${w.name} ammo`, price: Math.round(w.price / 4), desc: `+${w.ammo} rounds`,
          can: state.weaponsOwned.includes(w.id),
          run: () => { state.ammo[w.id] = (state.ammo[w.id] || 0) + w.ammo; },
        });
      }
    } else if (shopId === 'tacos') {
      items.push({ id: 'taco', name: 'Tico Taco', price: 25, desc: '+25 health', can: state.health < 100, run: () => { state.health = Math.min(100, state.health + 25); } });
      items.push({ id: 'burrito', name: 'Bay Burrito', price: 60, desc: 'Full health', can: state.health < 100, run: () => { state.health = 100; } });
    } else if (shopId === 'threads') {
      const colors = [
        { name: 'Sunset Pink', hex: 0xe06a9a, price: 100 },
        { name: 'Ocean Blue', hex: 0x4fa8c8, price: 100 },
        { name: 'Palm Green', hex: 0x7fb069, price: 100 },
        { name: 'Midnight Black', hex: 0x222831, price: 150 },
      ];
      for (const c of colors) {
        items.push({
          id: 'shirt-' + c.name, name: c.name + ' outfit', price: c.price, desc: 'Changes your colours',
          can: true, run: () => { state.player.setShirt(c.hex); },
        });
      }
    } else if (shopId === 'motors') {
      for (const car of CARS) {
        if (car.price === 0) continue;
        const needRank = car.price >= 5000 ? 'Shot Caller' : car.price >= 3000 ? 'Wheelman' : 'Rookie';
        const rankOk = RESPECT_RANKS.findIndex((r) => r.name === needRank) <= RESPECT_RANKS.findIndex((r) => r.name === rankFor(state.respect).rank.name);
        items.push({
          id: 'car-' + car.id, name: `${car.name} — ${car.kind}`, price: car.price,
          desc: rankOk ? `Top speed ${Math.round(car.top * 3.6)} km/h · stored in the garage` : `Needs ${needRank} rank`,
          can: rankOk && !state.ownedCars.includes(car.id),
          run: () => { state.ownedCars.push(car.id); },
        });
      }
    }
    return items;
  }

  return {
    itemsFor,
    nearestShop(x, z) {
      let best = null; let bd = 1e9;
      for (const s of SHOPS) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d < bd) { bd = d; best = s; }
      }
      return bd < 20 ? { shop: best, dist: bd } : null;
    },
    buy(state, shopId, itemId) {
      const item = itemsFor(shopId, state).find((i) => i.id === itemId);
      if (!item) return { ok: false, reason: 'No such item.' };
      if (!item.can) return { ok: false, reason: 'Not available right now.' };
      if (state.money < item.price) return { ok: false, reason: 'Not enough cash.' };
      state.money -= item.price;
      item.run();
      return { ok: true, name: item.name, price: item.price };
    },
  };
}
