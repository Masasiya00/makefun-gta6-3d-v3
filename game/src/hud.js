// The HUD: money, district, clock, wanted stars, health and armour bars,
// weapon and ammo, weapon slots, speed and vehicle panel, the mission tracker
// (objective + stage progress + NEXT step), the police response panel, the
// IN SIGHT indicator, respect rank, the radio strip, and a circular minimap
// with roads, the player arrow, mission markers, police blips, the search
// zone and shop icons. Plus the title, pause, briefing, busted, wasted and
// victory screens, the dialogue box, the weapon wheel and the shop menu.
// All DOM; the 3D canvas sits underneath.
import { WEAPONS, LOCKED_SLOT, SHOPS, RADIO_STATIONS } from './config.js';
import { rankFor } from './shops.js';

function el(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export function createHud() {
  const root = document.getElementById('hud');
  const hud = {};

  // --- Top-left: money, district, clock, respect. ---
  const tl = el('div', 'hud-tl', root);
  hud.money = el('div', 'money', tl, '$0');
  hud.district = el('div', 'district', tl, 'Solmar Bay');
  hud.clock = el('div', 'clock', tl, '17:30 · Day 1');
  const respectBox = el('div', 'respect', tl);
  hud.respectRank = el('span', 'rank', respectBox, 'Rookie');
  hud.respectBar = el('div', 'respect-bar', respectBox);
  hud.respectFill = el('div', 'respect-fill', hud.respectBar);

  // --- Top-right: wanted stars + IN SIGHT. ---
  const tr = el('div', 'hud-tr', root);
  hud.stars = el('div', 'stars', tr, '');
  hud.inSight = el('div', 'insight', tr, 'IN SIGHT');
  hud.inSight.style.display = 'none';

  // --- Police response panel (right side, during chases). ---
  const panel = el('div', 'police-panel', root);
  el('div', 'panel-title', panel, 'POLICE RESPONSE');
  hud.panelCode = el('div', 'panel-code', panel, 'CODE 1 · 0 UNITS');
  hud.panelRows = el('div', 'panel-rows', panel);
  panel.style.display = 'none';
  hud.panel = panel;

  // --- Mission tracker (left side). ---
  const tracker = el('div', 'tracker', root);
  hud.missionTitle = el('div', 'tracker-title', tracker, 'FREE ROAM');
  hud.missionText = el('div', 'tracker-text', tracker, 'No mission active. Press M to open missions.');
  hud.missionNext = el('div', 'tracker-next', tracker, '');
  hud.missionBar = el('div', 'tracker-bar', tracker);
  hud.missionFill = el('div', 'tracker-fill', hud.missionBar);
  hud.missionTimer = el('div', 'tracker-timer', tracker, '');
  tracker.style.display = 'none';
  hud.tracker = tracker;

  // --- Bottom-left: health, armour, weapon, slots. ---
  const bl = el('div', 'hud-bl', root);
  const bars = el('div', 'bars', bl);
  hud.healthFill = el('div', 'bar-fill health', el('div', 'bar', bars));
  hud.armourFill = el('div', 'bar-fill armour', el('div', 'bar', bars));
  hud.weapon = el('div', 'weapon', bl, 'Fists');
  hud.slots = el('div', 'slots', bl);
  hud.slotEls = [];
  const slotDefs = [...WEAPONS, LOCKED_SLOT];
  for (const w of slotDefs) {
    const s = el('div', 'slot', hud.slots, `${w.slot + 1} ${w.name}`);
    hud.slotEls.push(s);
  }

  // --- Bottom-right: vehicle panel + radio strip + minimap. ---
  const br = el('div', 'hud-br', root);
  hud.vehicle = el('div', 'vehicle', br, '');
  hud.radio = el('div', 'radio', br, 'SUNSET 88.4 — Golden Hour Drift');
  hud.talk = el('div', 'talk', br, '');
  const mapWrap = el('div', 'map-wrap', br);
  const mapCanvas = el('canvas', 'minimap', mapWrap);
  mapCanvas.width = 220; mapCanvas.height = 220;
  hud.mapCtx = mapCanvas.getContext('2d');
  el('div', 'map-north', mapWrap, 'N');

  // --- Centre: crosshair, hit marker, damage numbers, toasts. ---
  hud.crosshair = el('div', 'crosshair', root, '+');
  hud.crosshair.style.display = 'none';
  hud.hitmarker = el('div', 'hitmarker', root, '✕');
  hud.hitmarker.style.display = 'none';
  hud.toast = el('div', 'toast', root, '');
  hud.toast.style.display = 'none';
  hud.interact = el('div', 'interact', root, '');
  hud.interact.style.display = 'none';

  // --- Dialogue box. ---
  const dlg = el('div', 'dialogue', root);
  hud.dlgPortrait = el('div', 'dlg-portrait', dlg, 'R');
  const dlgBody = el('div', 'dlg-body', dlg);
  hud.dlgName = el('div', 'dlg-name', dlgBody, 'Rosa');
  hud.dlgText = el('div', 'dlg-text', dlgBody, '');
  el('div', 'dlg-hint', dlgBody, 'E / click to continue');
  dlg.style.display = 'none';
  hud.dialogue = dlg;

  // --- Weapon wheel. ---
  const wheel = el('div', 'wheel', root);
  el('div', 'wheel-title', wheel, 'WEAPONS');
  hud.wheelRows = el('div', 'wheel-rows', wheel);
  wheel.style.display = 'none';
  hud.wheel = wheel;

  // --- Shop menu. ---
  const shop = el('div', 'shop', root);
  hud.shopName = el('div', 'shop-name', shop, '');
  hud.shopBlurb = el('div', 'shop-blurb', shop, '');
  hud.shopItems = el('div', 'shop-items', shop);
  el('div', 'shop-hint', shop, 'Click an item to buy · E to leave');
  shop.style.display = 'none';
  hud.shop = shop;

  // --- Full screens: title, pause, briefing, busted, wasted, victory. ---
  const screen = el('div', 'screen', root);
  hud.screenTitle = el('h1', 'screen-title', screen, 'SOLMAR BAY 3D');
  hud.screenSub = el('div', 'screen-sub', screen, '');
  hud.screenBody = el('div', 'screen-body', screen, '');
  hud.screenButtons = el('div', 'screen-buttons', screen);
  screen.style.display = 'none';
  hud.screen = screen;

  let toastTimer = 0;
  let hitTimer = 0;

  function showScreen(title, sub, bodyHtml, buttons) {
    hud.screenTitle.textContent = title;
    hud.screenSub.textContent = sub;
    hud.screenBody.innerHTML = bodyHtml;
    hud.screenButtons.innerHTML = '';
    for (const b of buttons || []) {
      const btn = el('button', 'screen-btn', hud.screenButtons, b.label);
      btn.addEventListener('click', b.onClick);
    }
    screen.style.display = 'flex';
  }

  return {
    showScreen,
    hideScreen() { screen.style.display = 'none'; },
    toast(text, ms = 2600) {
      hud.toast.textContent = text;
      hud.toast.style.display = 'block';
      toastTimer = ms / 1000;
    },
    hitmark() { hud.hitmarker.style.display = 'block'; hitTimer = 0.25; },
    showDialogue(line) {
      hud.dlgPortrait.textContent = line.portrait;
      hud.dlgPortrait.style.background = line.color;
      hud.dlgName.textContent = line.who;
      hud.dlgName.style.color = line.color;
      hud.dlgText.textContent = line.text;
      hud.dialogue.style.display = 'flex';
    },
    hideDialogue() { hud.dialogue.style.display = 'none'; },
    showWheel(state) {
      hud.wheelRows.innerHTML = '';
      const defs = [...WEAPONS, LOCKED_SLOT];
      for (const w of defs) {
        const owned = w.id === 'fists' || state.weaponsOwned.includes(w.id);
        const row = el('div', 'wheel-row' + (state.weaponId === w.id ? ' active' : ''), hud.wheelRows);
        const ammo = w.id === 'fists' ? '∞' : owned ? `${state.ammo[w.id] ?? 0}` : `$${w.price} — locked`;
        row.textContent = `${w.slot + 1} · ${w.name} — ${ammo}`;
        if (!owned) row.classList.add('locked');
      }
      hud.wheel.style.display = 'block';
    },
    hideWheel() { hud.wheel.style.display = 'none'; },
    showShop(shopDef, items, onBuy) {
      hud.shopName.textContent = shopDef.name;
      hud.shopBlurb.textContent = shopDef.blurb;
      hud.shopItems.innerHTML = '';
      for (const item of items) {
        const row = el('div', 'shop-item' + (item.can ? '' : ' disabled'), hud.shopItems);
        row.innerHTML = `<b>${item.name}</b> — $${item.price}<br><span>${item.desc}</span>`;
        if (item.can) row.addEventListener('click', () => onBuy(item.id));
      }
      hud.shop.style.display = 'block';
    },
    hideShop() { hud.shop.style.display = 'none'; },

    update(s, dt) {
      if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) hud.toast.style.display = 'none'; }
      if (hitTimer > 0) { hitTimer -= dt; if (hitTimer <= 0) hud.hitmarker.style.display = 'none'; }
      hud.money.textContent = `$${Math.floor(s.money).toLocaleString('en-US')}`;
      hud.district.textContent = s.district;
      const hh = Math.floor(s.clock) % 24;
      const mm = Math.floor((s.clock % 1) * 60);
      hud.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${s.day}`;
      const { rank, next } = rankFor(s.respect);
      hud.respectRank.textContent = rank.name;
      const span = next ? next.need - rank.need : 1;
      const prog = next ? Math.min(1, (s.respect - rank.need) / span) : 1;
      hud.respectFill.style.width = `${Math.round(prog * 100)}%`;
      hud.stars.textContent = '★'.repeat(s.wanted) + '☆'.repeat(5 - s.wanted);
      hud.stars.style.color = s.wanted > 0 ? '#ff5c5c' : '#9aa3ad';
      hud.inSight.style.display = s.inSight ? 'block' : 'none';
      hud.healthFill.style.width = `${Math.max(0, s.health)}%`;
      hud.armourFill.style.width = `${Math.max(0, s.armour)}%`;
      const w = WEAPONS.find((x) => x.id === s.weaponId) || WEAPONS[0];
      const ammoTxt = w.id === 'fists' ? '∞' : `${s.ammo[w.id] ?? 0}`;
      hud.weapon.textContent = `${w.name} · ${ammoTxt}`;
      hud.slotEls.forEach((slotEl, i) => {
        const def = slotDefs[i];
        const owned = def.id === 'fists' || s.weaponsOwned.includes(def.id);
        slotEl.classList.toggle('active', s.weaponId === def.id);
        slotEl.classList.toggle('locked', !owned);
      });
      if (s.car) {
        const kmh = Math.round(Math.abs(s.car.speed) * 3.6);
        const gear = s.car.speed > 0.5 ? Math.min(5, 1 + Math.floor(Math.abs(s.car.speed) / 10)) : s.car.speed < -0.5 ? 'R' : 'N';
        hud.vehicle.textContent = `${s.car.def.name} · ${kmh} km/h · ${gear} · ${Math.max(0, Math.round(s.car.health))}%`;
        hud.vehicle.style.display = 'block';
      } else hud.vehicle.style.display = 'none';
      hud.crosshair.style.display = s.armed && !s.car ? 'block' : 'none';
      const st = s.audio.station();
      hud.radio.textContent = `${st.name} — ${st.song}`;
      hud.talk.textContent = s.audio.talkLine() || '';
      // Mission tracker.
      if (s.mission) {
        hud.tracker.style.display = 'block';
        hud.missionTitle.textContent = `MISSION ${s.mission.def.id} — ${s.mission.def.name}`;
        const obj = s.missionObjective;
        hud.missionText.textContent = obj ? obj.text : s.mission.def.brief;
        hud.missionNext.textContent = obj && obj.next ? `NEXT: ${obj.next}` : '';
        hud.missionFill.style.width = obj && obj.progress !== null && obj.progress !== undefined ? `${Math.round(obj.progress * 100)}%` : '0%';
        hud.missionTimer.textContent = s.mission.def.seconds ? `⏱ ${Math.max(0, Math.ceil(s.mission.timer))}s` : '';
      } else {
        hud.tracker.style.display = 'none';
      }
      // Police panel.
      if (s.wanted > 0 && s.panel) {
        hud.panel.style.display = 'block';
        hud.panelCode.textContent = `${s.panel.code} · ${s.panel.count} UNITS`;
        hud.panelRows.innerHTML = s.panel.rows.map((r) => `<div>${r.callsign} · ${r.dist}m · ${r.state}</div>`).join('');
      } else hud.panel.style.display = 'none';
      hud.interact.style.display = s.interactHint ? 'block' : 'none';
      if (s.interactHint) hud.interact.textContent = s.interactHint;
      this.drawMinimap(s);
    },

    drawMinimap(s) {
      const ctx = hud.mapCtx;
      const W = 220; const H = 220;
      const scale = W / 3600;
      const toX = (x) => (x + 1800) * scale;
      const toY = (z) => (z + 1300) * scale;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(20, 28, 34, 0.92)'; ctx.fillRect(0, 0, W, H);
      // Ocean.
      ctx.fillStyle = '#2a7a9a'; ctx.fillRect(0, 0, toX(-1500), H);
      // Roads.
      ctx.strokeStyle = '#6a7078'; ctx.lineWidth = 2;
      for (const x of s.roadsX) { ctx.beginPath(); ctx.moveTo(toX(x), 0); ctx.lineTo(toX(x), H); ctx.stroke(); }
      for (const z of s.roadsZ) { ctx.beginPath(); ctx.moveTo(0, toY(z)); ctx.lineTo(W, toY(z)); ctx.stroke(); }
      // Search zone.
      if (s.wanted > 0 && s.searchZone) {
        ctx.strokeStyle = 'rgba(255, 92, 92, 0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(toX(s.searchZone.x), toY(s.searchZone.z), 90 * scale + 14, 0, Math.PI * 2); ctx.stroke();
      }
      // Shops.
      for (const sh of SHOPS) {
        ctx.fillStyle = '#f2c94c';
        ctx.fillRect(toX(sh.x) - 3, toY(sh.z) - 3, 6, 6);
      }
      // Mission marker.
      if (s.marker) {
        ctx.fillStyle = '#ffe14d';
        ctx.beginPath(); ctx.arc(toX(s.marker.x), toY(s.marker.z), 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
      }
      // Police blips.
      ctx.fillStyle = '#5c8aff';
      for (const u of s.policeBlips || []) {
        ctx.beginPath(); ctx.arc(toX(u.x), toY(u.z), 4, 0, Math.PI * 2); ctx.fill();
      }
      // Player arrow.
      ctx.save();
      ctx.translate(toX(s.playerX), toY(s.playerZ));
      ctx.rotate(-s.playerHeading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
    },
  };
}
