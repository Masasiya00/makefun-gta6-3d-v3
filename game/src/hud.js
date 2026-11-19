// Solmar Bay 3D — HUD: readouts, dialogue, shop menu, minimap.
//
// Weapon HUD is GTA-style: a weapon band of five slots, each with a white
// silhouette of the gun, the name and the ammo as magazine / reserve
// (magazine in white, reserve in grey). Under the active weapon a row of
// ammo segments shows the magazine bullet by bullet — green on a fresh
// magazine, red and blinking when it runs low — plus a RELOADING prompt.
// The wanted stars pop when a star is gained; at five stars they turn red
// and pulse with a MAXIMUM RESPONSE label. On foot with a gun out, a
// crosshair sits at screen centre and kicks on recoil, with a hitmarker
// on every hit.
import { WEAPONS, RESPECT_RANKS, RADIO_STATIONS, districtAt, formatClock, timeOfDay } from './config.js';
import { policePanelRows } from './police.js';
import { missionTarget } from './missions.js';
import { shopItems } from './shops.js';

export function moneyStr(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function portraitHtml(speaker, color) {
  return '<div class="portrait" style="background:' + color + '"><div class="p-face"></div><div class="p-hair"></div><div class="p-eyes"><span></span><span></span></div><div class="p-smile"></div><div class="p-initial">' + speaker.charAt(0) + '</div></div>';
}

// White weapon silhouettes for the weapon band, one per gun.
const WEAPON_ICONS = {
  fists: '<svg viewBox="0 0 24 12"><rect x="2" y="3" width="9" height="7" rx="2"/><rect x="13" y="3" width="9" height="7" rx="2"/></svg>',
  pistol: '<svg viewBox="0 0 24 12"><path d="M2 2h15v3H9v5H6V5H2z"/></svg>',
  smg: '<svg viewBox="0 0 24 12"><path d="M1 3h19v3h-9l-1 4H8l1-4H1z"/></svg>',
  shotgun: '<svg viewBox="0 0 24 12"><path d="M1 4h21v2h-12v3H8V6H1z"/></svg>',
  rifle: '<svg viewBox="0 0 24 12"><path d="M1 4h21v2h-8v2h-2V6h-3v3H7V6H1z"/></svg>',
};

function ammoHtml(state, i) {
  const w = WEAPONS[i];
  if (!state.weaponsOwned[i]) return '$' + w.price;
  if (w.mag === Infinity) return '∞';
  const mag = state.magAmmo[i];
  const reserve = state.ammo[i];
  const low = mag <= Math.max(1, Math.floor(w.mag * 0.25));
  return '<b class="mag' + (low ? ' low' : '') + '">' + mag + '</b> / <span class="reserve">' + reserve + '</span>';
}

export function updateHud(state, els, combat) {
  const d = districtAt(state.player.x, state.player.z);
  els.money.textContent = moneyStr(state.money);
  els.district.textContent = d.name;
  els.clock.textContent = formatClock(state.clockMin) + ' · DAY ' + state.day;

  // Wanted stars: rebuild only when the level changes, so the pop
  // animation plays once per gained star instead of every frame.
  if (els._starsWanted !== state.wanted) {
    let stars = '';
    for (let i = 0; i < 5; i++) stars += '<span class="star' + (i < state.wanted ? ' on' : '') + '">' + (i < state.wanted ? '★' : '☆') + '</span>';
    els.stars.innerHTML = stars;
    els._starsWanted = state.wanted;
  }
  if (els.wantedBox) els.wantedBox.classList.toggle('max', state.wanted >= 5);
  els.wantedLabel.textContent = state.wanted >= 5 ? 'WANTED — MAXIMUM RESPONSE' : state.wanted > 0 ? 'WANTED' : '';

  els.healthFill.style.width = state.health + '%';
  els.armourFill.style.width = state.armour + '%';
  els.healthText.textContent = Math.round(state.health);

  els.missionName.textContent = state.missionActive ? 'JOB ' + (state.missionIndex + 1) + '/12 · ' + state.missionText : (state.missionDone.length >= 12 ? 'ALL MISSIONS COMPLETE' : 'FREE ROAM — press M for mission ' + (state.missionIndex + 1));
  els.missionNext.textContent = 'NEXT ▸ ' + (state.missionNext || 'Explore Solmar Bay');
  els.missionTimer.textContent = state.missionActive && state.missionTimer > 0 && state.missionIndex !== 1 ? '⏱ ' + Math.ceil(state.missionTimer) + 's' : '';
  els.missionBar.style.width = Math.round((state.missionActive ? state.missionProgress : 0) * 100) + '%';

  // Weapon band: silhouette + name + mag / reserve per slot.
  let slots = '';
  for (let i = 0; i < 5; i++) {
    const w = WEAPONS[i];
    const owned = state.weaponsOwned[i];
    slots += '<div class="wslot' + (i === state.weaponIndex ? ' active' : '') + (owned ? '' : ' locked') + '"><b>' + (i + 1) + '</b><span class="wicon">' + WEAPON_ICONS[w.id] + '</span><span>' + w.name + '</span><em>' + ammoHtml(state, i) + '</em></div>';
  }
  els.weapons.innerHTML = slots;
  const cw = WEAPONS[state.weaponIndex];
  if (cw.mag === Infinity) {
    els.weaponName.textContent = cw.name;
  } else {
    const low = state.magAmmo[state.weaponIndex] <= Math.max(1, Math.floor(cw.mag * 0.25));
    els.weaponName.innerHTML = cw.name + ' · <b class="mag' + (low ? ' low' : '') + '">' + state.magAmmo[state.weaponIndex] + '</b> / <span class="reserve">' + state.ammo[state.weaponIndex] + '</span>';
  }
  // Ammo segments: one per bullet in the magazine.
  if (els.ammoSegs) {
    if (cw.mag === Infinity) {
      els.ammoSegs.innerHTML = '';
    } else {
      const low = state.magAmmo[state.weaponIndex] <= Math.max(1, Math.floor(cw.mag * 0.25));
      let segs = '';
      for (let i = 0; i < cw.mag; i++) {
        segs += '<span class="seg' + (i < state.magAmmo[state.weaponIndex] ? ' on' : '') + (low ? ' low' : '') + '"></span>';
      }
      els.ammoSegs.innerHTML = segs;
    }
  }
  // Reload prompt.
  if (els.reloadPrompt) {
    if (state.reloadT > 0) {
      els.reloadPrompt.style.display = 'block';
      els.reloadPrompt.textContent = '⟳ RELOADING ' + cw.name + '…';
    } else if (cw.mag !== Infinity && state.magAmmo[state.weaponIndex] <= 0 && state.ammo[state.weaponIndex] <= 0) {
      els.reloadPrompt.style.display = 'block';
      els.reloadPrompt.textContent = 'MAG EMPTY — NO RESERVE AMMO';
    } else {
      els.reloadPrompt.style.display = 'none';
    }
  }
  // Crosshair (on foot, gun out) kicks on recoil; hitmarker on every hit.
  if (els.crosshair) {
    const show = state.started && !state.paused && !state.gameOver && state.player.onFoot && state.weaponIndex > 0;
    els.crosshair.style.display = show ? 'block' : 'none';
    if (show) els.crosshair.classList.toggle('kick', !!(combat && combat.flashT > 0));
  }
  if (els.hitmarker) {
    els.hitmarker.style.display = combat && combat.hitMarkerT > 0 ? 'block' : 'none';
  }

  const rows = policePanelRows(state);
  els.policePanel.style.display = state.wanted > 0 ? 'block' : 'none';
  if (state.wanted > 0) {
    let html = '<div class="pp-head">● SBPD RESPONSE &nbsp; <span>' + rows.length + ' UNITS · CODE ' + state.wanted + '</span></div>';
    for (const r of rows) {
      html += '<div class="pp-row"><span class="pp-call">' + r.callsign + '</span><span class="pp-dist">' + r.dist + ' m</span><span class="pp-state ' + r.state.toLowerCase() + '">' + r.state + '</span></div>';
    }
    if (state.roadblocks.length > 0) html += '<div class="pp-note">+ roadblocks on the boulevard</div>';
    if (state.roadblocks.length > 3) html += '<div class="pp-note">+ second roadblock line — maximum response</div>';
    els.policePanel.innerHTML = html;
  }

  els.inSight.style.display = state.wanted > 0 ? 'block' : 'none';
  els.inSight.className = 'hud insight' + (state.inSight ? ' seen' : ' hidden');
  els.inSight.textContent = state.inSight ? '◉ IN SIGHT — break line of sight' : '○ HIDDEN — stay out of sight';

  const rank = RESPECT_RANKS[state.respectRank];
  const next = RESPECT_RANKS[state.respectRank + 1];
  els.respectRank.textContent = rank.name;
  els.respectText.textContent = state.respect + (next ? ' / ' + next.need : ' MAX');
  els.respectFill.style.width = next ? Math.min(100, (state.respect / next.need) * 100) + '%' : '100%';

  const st = RADIO_STATIONS[state.radio];
  els.radioStation.textContent = '♪ ' + st.name;
  els.radioSong.textContent = st.song;

  const car = state.cars.find((c) => c.id === state.player.carId);
  els.vehiclePanel.style.display = state.player.inCar && car ? 'block' : 'none';
  if (car) {
    els.vehicleName.textContent = car.model.name.toUpperCase();
    els.vehicleSpeed.textContent = Math.round(state.speedKmh);
    els.vehicleGear.textContent = 'G' + state.gear;
    els.vehicleCond.style.width = car.condition + '%';
    els.vehicleCondText.textContent = Math.round(car.condition) + '%';
  }

  els.onFootPanel.style.display = !state.player.inCar ? 'block' : 'none';
  els.onFootPanel.textContent = state.player.onFoot ? 'ON FOOT · E near a car to drive · F interact' : '';

  if (state.dialogue && state.dialogueT > 0) {
    els.dialogue.style.display = 'flex';
    els.dialogue.innerHTML = portraitHtml(state.dialogue.speaker, state.dialogue.color) + '<div class="dlg-body"><div class="dlg-name">' + state.dialogue.speaker + ' <span>' + state.dialogue.role + ' · ' + RESPECT_RANKS[state.respectRank].name + '</span></div><div class="dlg-text">' + state.dialogue.text + '</div></div>';
  } else {
    els.dialogue.style.display = 'none';
  }

  els.toast.style.display = state.messageT > 0 ? 'block' : 'none';
  els.toast.textContent = state.message;

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
  } else {
    els.shopMenu.style.display = 'none';
  }

  els.titleScreen.style.display = !state.started ? 'flex' : 'none';
  els.pauseScreen.style.display = state.started && state.paused && !state.gameOver ? 'flex' : 'none';
  els.endScreen.style.display = state.gameOver ? 'flex' : 'none';
  if (state.gameOver) {
    els.endTitle.textContent = state.victory ? 'KING OF THE BAY' : state.busted ? 'BUSTED' : 'WASTED';
    els.endText.textContent = state.victory ? 'Mara owns the bay. All 12 missions complete — $' + Math.floor(state.money) + ' in the pocket.' : (state.busted ? 'The SBPD caught you on foot.' : 'Mara went down.') + ' You lost $' + Math.floor(state.money * 0.1) + '. Press R to retry.';
  }
  els.timeLabel.textContent = timeOfDay(state) === 'golden' ? 'GOLDEN HOUR' : timeOfDay(state) === 'night' ? 'NIGHT' : 'DAYTIME';
}

export function drawMinimap(state, canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2;
  const scale = W / 760;
  const px = state.player.x;
  const pz = state.player.z;
  const sx = (wx) => cx + (wx - px) * scale;
  const sy = (wz) => cy + (wz - pz) * scale;

  // 1. Land base.
  ctx.fillStyle = '#3a4a3a';
  ctx.fillRect(0, 0, W, H);
  // 2. Sea (west of the beach).
  const beachSx = cx + (WORLD_BEACH - px) * scale;
  if (beachSx > 0) {
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(0, 0, Math.min(W, beachSx), H);
  }
  // 3. Sand strip.
  if (beachSx - 16 < W && beachSx > 0) {
    ctx.fillStyle = '#c8b078';
    ctx.fillRect(beachSx - 16, 0, 16, H);
  }
  // 4. Clip to the circle.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, W / 2 - 4, 0, Math.PI * 2);
  ctx.clip();
  // 5. Buildings as coloured blocks.
  const blds = state.buildings || [];
  ctx.globalAlpha = 0.9;
  for (const b of blds) {
    ctx.fillStyle = '#' + b.color.toString(16).padStart(6, '0');
    ctx.fillRect(sx(b.x) - (b.w * scale) / 2, sy(b.z) - (b.d * scale) / 2, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
  }
  ctx.globalAlpha = 1;
  // 6. Roads: dark casing, asphalt, centre dashes, crosswalk bars.
  ctx.lineCap = 'butt';
  for (let x = -300; x <= 300; x += 60) {
    const X = sx(x);
    ctx.strokeStyle = '#20242a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke();
    ctx.strokeStyle = '#4a5058';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(X, 0); ctx.lineTo(X, H); ctx.stroke();
    ctx.strokeStyle = '#d8d8a8';
    ctx.lineWidth = 1;
    for (let z = -260; z <= 260; z += 12) {
      ctx.beginPath(); ctx.moveTo(X, sy(z)); ctx.lineTo(X, sy(z + 5)); ctx.stroke();
    }
  }
  for (let z = -240; z <= 240; z += 60) {
    const Y = sy(z);
    ctx.strokeStyle = '#20242a';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(W, Y); ctx.stroke();
    ctx.strokeStyle = '#4a5058';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(W, Y); ctx.stroke();
    ctx.strokeStyle = '#d8d8a8';
    ctx.lineWidth = 1;
    for (let x = -360; x <= 360; x += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x), Y); ctx.lineTo(sx(x + 5), Y); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  for (const ix of [-240, -120, 0, 120, 240]) {
    for (const iz of [-240, -120, 0, 120, 240]) {
      const half = (10 * scale) / 2;
      ctx.beginPath(); ctx.moveTo(sx(ix + 6), sy(iz) - half); ctx.lineTo(sx(ix + 6), sy(iz) + half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(ix - 6), sy(iz) - half); ctx.lineTo(sx(ix - 6), sy(iz) + half); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(ix) - half, sy(iz + 6)); ctx.lineTo(sx(ix) + half, sy(iz + 6)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx(ix) - half, sy(iz - 6)); ctx.lineTo(sx(ix) + half, sy(iz - 6)); ctx.stroke();
    }
  }
  // 7. Search zone.
  if (state.wanted > 0) {
    ctx.strokeStyle = 'rgba(255,60,60,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx(state.searchZone.x), sy(state.searchZone.z), state.searchZone.r * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,60,60,0.12)';
    ctx.fill();
  }
  // 8. Shops.
  ctx.fillStyle = '#ffc300';
  for (const s of SHOP_POSITIONS) {
    const X = sx(s.x);
    const Y = sy(s.z);
    if (X < 0 || X > W || Y < 0 || Y > H) continue;
    ctx.beginPath();
    ctx.arc(X, Y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 9. Mission marker.
  const target = missionTarget(state);
  if (target) {
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(sx(target.x), sy(target.z), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // 10. Police blips + heli blip.
  ctx.fillStyle = '#4d8dff';
  for (const cop of state.police) {
    ctx.beginPath();
    ctx.arc(sx(cop.x), sy(cop.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (state.heli && state.wanted >= 3) {
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(sx(state.heli.x), sy(state.heli.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 11. Player arrow.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 12. North indicator.
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', cx, 14);
}

const WORLD_BEACH = -300;
import { SHOPS as SHOP_POSITIONS } from './config.js';
