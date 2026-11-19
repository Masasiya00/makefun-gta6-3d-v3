// HUD and minimap for Solmar Bay 3D: money, stars, mission tracker, police
// response panel, weapon slots, respect meter, radio strip, vehicle panel,
// dialogue box with portrait, and the circular minimap.
import { WEAPONS, RESPECT_RANKS, RADIO_STATIONS, districtAt, formatClock, timeOfDay } from './config.js';
import { policePanelRows } from './police.js';
import { missionTarget } from './missions.js';
import { shopItems } from './shops.js';

export function moneyStr(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

export function portraitHtml(speaker, color) {
  // A simple CSS-drawn portrait: face, hair, shoulders — no image files.
  const initial = (speaker || '?')[0];
  return '<div class="portrait" style="background:' + color + '"><div class="p-face"><div class="p-hair"></div><div class="p-eyes"><span></span><span></span></div><div class="p-smile"></div></div><div class="p-initial">' + initial + '</div></div>';
}

export function updateHud(state, els, combat) {
  const d = districtAt(state.player.x, state.player.z);
  els.money.textContent = moneyStr(state.money);
  els.district.textContent = d.name;
  els.clock.textContent = formatClock(state.clockMin) + ' · DAY ' + state.day;
  // Wanted stars.
  let stars = '';
  for (let i = 0; i < 5; i++) stars += '<span class="star' + (i < state.wanted ? ' on' : '') + '">★</span>';
  els.stars.innerHTML = stars;
  els.wantedLabel.textContent = state.wanted > 0 ? 'WANTED' : '';
  // Health / armour.
  els.healthFill.style.width = state.health + '%';
  els.armourFill.style.width = state.armour + '%';
  els.healthText.textContent = Math.round(state.health);
  // Mission tracker.
  els.missionName.textContent = state.missionActive
    ? 'JOB ' + (state.missionIndex + 1) + '/12 · ' + state.missionText
    : (state.missionDone.length >= 12 ? 'ALL MISSIONS COMPLETE' : 'FREE ROAM — press M for mission ' + (state.missionIndex + 1));
  els.missionNext.textContent = 'NEXT ▸ ' + (state.missionNext || 'Explore Solmar Bay');
  els.missionTimer.textContent = state.missionActive && state.missionTimer > 0 && state.missionIndex !== 1
    ? '⏱ ' + Math.ceil(state.missionTimer) + 's' : '';
  els.missionBar.style.width = Math.round((state.missionActive ? state.missionProgress : 0) * 100) + '%';
  // Weapon slots.
  let slots = '';
  for (let i = 0; i < 5; i++) {
    const w = WEAPONS[i];
    const owned = state.weaponsOwned[i];
    const ammo = owned ? (w.ammo === Infinity ? '∞' : state.ammo[i]) : '$' + w.price;
    slots += '<div class="wslot' + (i === state.weaponIndex ? ' active' : '') + (owned ? '' : ' locked') + '"><b>' + (i + 1) + '</b><span>' + w.name + '</span><em>' + ammo + '</em></div>';
  }
  els.weapons.innerHTML = slots;
  els.weaponName.textContent = WEAPONS[state.weaponIndex].name + (WEAPONS[state.weaponIndex].ammo === Infinity ? '' : ' · ' + state.ammo[state.weaponIndex] + ' ammo');
  // Police response panel.
  const rows = policePanelRows(state);
  els.policePanel.style.display = state.wanted > 0 ? 'block' : 'none';
  if (state.wanted > 0) {
    let html = '<div class="pp-head">● SBPD RESPONSE &nbsp; <span>' + rows.length + ' UNITS · CODE ' + state.wanted + '</span></div>';
    for (const r of rows) {
      html += '<div class="pp-row"><span class="pp-call">' + r.callsign + '</span><span class="pp-dist">' + r.dist + ' m</span><span class="pp-state ' + r.state.toLowerCase() + '">' + r.state + '</span></div>';
    }
    if (state.roadblocks.length > 0) html += '<div class="pp-note">+ roadblocks on the boulevard</div>';
    els.policePanel.innerHTML = html;
  }
  // IN SIGHT indicator.
  els.inSight.style.display = state.wanted > 0 ? 'block' : 'none';
  els.inSight.className = 'hud insight' + (state.inSight ? ' seen' : ' hidden');
  els.inSight.textContent = state.inSight ? '◉ IN SIGHT — break line of sight' : '○ HIDDEN — stay out of sight';
  // Respect.
  const rank = RESPECT_RANKS[state.respectRank];
  const next = RESPECT_RANKS[state.respectRank + 1];
  els.respectRank.textContent = rank.name;
  els.respectText.textContent = state.respect + (next ? ' / ' + next.need : ' MAX');
  els.respectFill.style.width = next ? Math.min(100, (state.respect / next.need) * 100) + '%' : '100%';
  // Radio.
  const st = RADIO_STATIONS[state.radio];
  els.radioStation.textContent = '♪ ' + st.name;
  els.radioSong.textContent = st.song;
  // Vehicle panel.
  const car = state.cars.find((c) => c.id === state.player.carId);
  els.vehiclePanel.style.display = state.player.inCar && car ? 'block' : 'none';
  if (car) {
    els.vehicleName.textContent = car.model.name.toUpperCase();
    els.vehicleSpeed.textContent = Math.round(state.speedKmh);
    els.vehicleGear.textContent = 'G' + state.gear;
    els.vehicleCond.style.width = car.condition + '%';
    els.vehicleCondText.textContent = Math.round(car.condition) + '%';
  }
  // On-foot hint.
  els.onFootPanel.style.display = !state.player.inCar ? 'block' : 'none';
  els.onFootPanel.textContent = state.player.onFoot ? 'ON FOOT · E near a car to drive · F interact' : '';
  // Dialogue.
  if (state.dialogue && state.dialogueT > 0) {
    els.dialogue.style.display = 'flex';
    els.dialogue.innerHTML = portraitHtml(state.dialogue.speaker, state.dialogue.color)
      + '<div class="dlg-body"><div class="dlg-name">' + state.dialogue.speaker + ' <span>' + state.dialogue.role + ' · ' + RESPECT_RANKS[state.respectRank].name + '</span></div><div class="dlg-text">' + state.dialogue.text + '</div></div>';
  } else els.dialogue.style.display = 'none';
  // Message toast.
  els.toast.style.display = state.messageT > 0 ? 'block' : 'none';
  els.toast.textContent = state.message;
  // Shop prompt + menu.
  els.shopPrompt.style.display = state.shopNear && !state.shopOpen ? 'block' : 'none';
  if (state.shopNear) els.shopPrompt.textContent = 'F — ' + state.shopNear.name + ' · ' + state.shopNear.blurb;
  if (state.shopOpen && state.shopNear) {
    els.shopMenu.style.display = 'block';
    let html = '<div class="shop-title">' + state.shopNear.name + ' <span>' + moneyStr(state.money) + '</span></div>';
    for (const item of shopItems(state, state.shopNear)) {
      html += '<div class="shop-item" data-item="' + item.id + '"><b>' + item.name + '</b><span>' + item.desc + '</span><em>$' + item.price + '</em></div>';
    }
    html += '<div class="shop-hint">Click an item to buy · F or Esc to close</div>';
    els.shopMenu.innerHTML = html;
  } else els.shopMenu.style.display = 'none';
  // Screens.
  els.titleScreen.style.display = !state.started ? 'flex' : 'none';
  els.pauseScreen.style.display = state.started && state.paused && !state.gameOver ? 'flex' : 'none';
  els.endScreen.style.display = state.gameOver ? 'flex' : 'none';
  if (state.gameOver) {
    els.endTitle.textContent = state.victory ? 'KING OF THE BAY' : state.busted ? 'BUSTED' : 'WASTED';
    els.endText.textContent = state.victory
      ? 'Mara owns the bay. All 12 missions complete — $' + Math.floor(state.money) + ' in the pocket.'
      : (state.busted ? 'The SBPD caught you on foot.' : 'Mara went down.') + ' You lost $' + Math.floor(state.money * 0.1) + '. Press R to retry.';
  }
  els.timeLabel.textContent = timeOfDay(state) === 'golden' ? 'GOLDEN HOUR' : timeOfDay(state) === 'night' ? 'NIGHT' : 'DAYTIME';
}

export function drawMinimap(state, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2, scale = W / 760;
  ctx.clearRect(0, 0, W, H);
  // Land base.
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(0, 0, W, H);
  // Sea to the west of the beach line.
  const beachSx = cx + (WORLD_BEACH - state.player.x) * scale;
  ctx.fillStyle = '#1e7fa8';
  if (beachSx > 0) ctx.fillRect(0, 0, Math.min(W, beachSx), H);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, W / 2 - 4, 0, Math.PI * 2); ctx.clip();
  // Roads.
  ctx.strokeStyle = '#5a6068'; ctx.lineWidth = 3;
  for (let x = -300; x <= 300; x += 60) {
    const sx = cx + (x - state.player.x) * scale;
    ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); ctx.stroke();
  }
  for (let z = -240; z <= 240; z += 60) {
    const sy = cy + (z - state.player.z) * scale;
    ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(W, sy); ctx.stroke();
  }
  // Search zone circle.
  if (state.wanted > 0) {
    ctx.strokeStyle = 'rgba(255,60,60,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx + (state.searchZone.x - state.player.x) * scale, cy + (state.searchZone.z - state.player.z) * scale, state.searchZone.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,60,60,0.12)';
    ctx.fill();
  }
  // Shops.
  ctx.fillStyle = '#ffc300';
  for (const s of SHOP_POSITIONS) {
    const sx = cx + (s.x - state.player.x) * scale, sy = cy + (s.z - state.player.z) * scale;
    if (sx > 0 && sx < W && sy > 0 && sy < H) { ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // Mission marker.
  const mt = missionTarget(state);
  if (mt) {
    const mx = cx + (mt.x - state.player.x) * scale, my = cy + (mt.z - state.player.z) * scale;
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  // Police blips.
  ctx.fillStyle = '#4d8dff';
  for (const cop of state.police) {
    const px = cx + (cop.x - state.player.x) * scale, py = cy + (cop.z - state.player.z) * scale;
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (state.heli && state.wanted >= 3) {
    ctx.fillStyle = '#ff5d8f';
    const hx = cx + (state.heli.x - state.player.x) * scale, hy = cy + (state.heli.z - state.player.z) * scale;
    ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', cx, 14);
}

const WORLD_BEACH = -300;
import { SHOPS as SHOP_POSITIONS } from './config.js';
