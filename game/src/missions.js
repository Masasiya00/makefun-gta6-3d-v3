// Story missions for Solmar Bay 3D: 12 missions for Mara, given by Rosa and
// the crew, each with a briefing dialogue, stages, a timer where it fits,
// a reward and a clear end state. Missions unlock in order.
import { MISSIONS, addWanted, addRespect, districtAt } from './config.js';
import { dist2d } from './random.js';
import { playMissionDone } from './audio.js';
import { spawnEnemy } from './combat.js';

export function missionDef(state) { return MISSIONS[state.missionIndex]; }

export function startMission(state, index, audio) {
  const def = MISSIONS[index];
  if (!def) return;
  state.missionIndex = index;
  state.missionActive = true;
  state.missionStage = 0;
  state.missionTimer = 0;
  state.flags = {};
  state.dialogue = { speaker: def.speaker, role: def.role, color: def.color, text: def.text };
  state.dialogueT = 6;
  state.missionText = def.objective;
  state.missionNext = def.next;
  state.missionProgress = 0;
  // Per-mission setup: wanted levels, timers, targets, enemies.
  if (index === 1) { addWanted(state, 2); state.missionTimer = 0; }
  if (index === 2) { addWanted(state, 3); state.missionTimer = 45; }
  if (index === 3) { state.missionTimer = 0; }
  if (index === 4) { state.missionTimer = 150; }
  if (index === 5) { addWanted(state, 4); spawnEnemy(state, null, -250, -120, 'goon'); spawnEnemy(state, null, -245, -112, 'goon'); }
  if (index === 6) { addWanted(state, 3); state.missionTimer = 240; }
  if (index === 7) { state.missionTimer = 0; }
  if (index === 8) { state.missionTimer = 120; }
  if (index === 9) { addWanted(state, 5); state.missionTimer = 0; }
  if (index === 10) { addWanted(state, 3); state.missionTimer = 0; }
  if (index === 11) { addWanted(state, 5); state.missionTimer = 0; }
  state.message = 'Mission ' + (index + 1) + '/12 — ' + def.name; state.messageT = 3;
}

export function completeMission(state, audio) {
  const def = MISSIONS[state.missionIndex];
  state.money += def.reward;
  addRespect(state, 60 + state.missionIndex * 10);
  state.missionDone.push(state.missionIndex);
  state.stats.missionsDone++;
  state.missionActive = false;
  state.enemies = [];
  state.missionText = 'Mission complete — ' + def.name;
  state.missionNext = state.missionIndex + 1 < 12 ? 'Next: ' + MISSIONS[state.missionIndex + 1].name : 'All missions done!';
  state.missionProgress = 1;
  state.dialogue = { speaker: def.speaker, role: def.role, color: def.color, text: 'Done. $' + def.reward + ' is yours, Mara. The bay is starting to notice you.' };
  state.dialogueT = 5;
  if (state.missionIndex === 11) { state.victory = true; }
  if (audio) playMissionDone(audio);
  // Cash pickup as a bonus at the finish spot.
  state.pickups.push({ kind: 'cash', amount: 100, x: state.player.x + 4, z: state.player.z + 4, taken: false });
}

function gotoTarget(state) {
  // Each mission's stage targets, in order.
  const targets = [
    [{ x: -168, z: 118 }, { x: -168, z: 118 }],
    [{ x: -300, z: 40 }],
    [{ x: -60, z: 200 }],
    [{ x: -220, z: -190 }],
    [{ x: 20, z: -10 }],
    [{ x: -262, z: -138 }],
    [{ x: -60, z: 200 }],
    [{ x: -60, z: 200 }],
    [{ x: 200, z: 40 }, { x: 60, z: -200 }, { x: 200, z: 40 }],
    [{ x: -330, z: 220 }],
    [{ x: -280, z: -120 }, { x: -262, z: -138 }],
    [{ x: -262, z: -138 }],
  ];
  return targets[state.missionIndex][Math.min(state.missionStage, targets[state.missionIndex].length - 1)];
}

export function missionTarget(state) {
  if (!state.missionActive) return null;
  return gotoTarget(state);
}

export function updateMissions(state, dt, audio) {
  if (state.dialogueT > 0) state.dialogueT -= dt;
  if (state.messageT > 0) state.messageT -= dt;
  if (!state.missionActive) return;
  const def = MISSIONS[state.missionIndex];
  const target = gotoTarget(state);
  const d = dist2d(state.player.x, state.player.z, target.x, target.z);
  state.missionProgress = Math.max(0, Math.min(1, 1 - d / 400));
  // Mission 1: reach the garage, then take the coupe and drive back.
  if (state.missionIndex === 0) {
    if (state.missionStage === 0 && d < 10) {
      state.missionStage = 1; state.missionText = 'Take the red coupe out front'; state.missionNext = 'Drive it back to Rosa';
    } else if (state.missionStage === 1 && state.player.inCar && state.player.carId === 'rosa') {
      state.missionStage = 2; state.missionText = 'Drive the coupe back to Rosa'; state.missionNext = 'Park at the garage';
    } else if (state.missionStage === 2 && d < 10 && state.player.inCar) {
      completeMission(state, audio); return;
    }
    return;
  }
  // Mission 2: lose a 2-star pursuit — out of sight for 12 seconds.
  if (state.missionIndex === 1) {
    if (!state.inSight && state.wanted > 0) state.missionTimer += dt;
    state.missionText = 'Lose the 2-star pursuit — stay unseen ' + Math.max(0, Math.ceil(12 - state.missionTimer)) + 's';
    state.missionProgress = Math.min(1, state.missionTimer / 12);
    if (state.missionTimer >= 12 || state.wanted === 0) { completeMission(state, audio); return; }
    return;
  }
  // Mission 3: survive 45 seconds at 3 stars.
  if (state.missionIndex === 2) {
    state.missionTimer -= dt;
    state.missionText = 'Survive the 3-star chase';
    state.missionProgress = Math.min(1, 1 - state.missionTimer / 45);
    if (state.missionTimer <= 0) { completeMission(state, audio); return; }
    return;
  }
  // Mission 4: carry the package to Dockside.
  if (state.missionIndex === 3) {
    if (d < 12) { completeMission(state, audio); return; }
    return;
  }
  // Mission 5: night delivery through Downtown before the timer ends.
  if (state.missionIndex === 4) {
    state.missionTimer -= dt;
    state.missionText = 'Night delivery through Downtown';
    if (d < 12) { completeMission(state, audio); return; }
    if (state.missionTimer <= 0) { failMission(state, 'The delivery went cold.'); return; }
    return;
  }
  // Mission 6: rob the store (reach it, enemies down) then escape 4 stars.
  if (state.missionIndex === 5) {
    if (state.missionStage === 0 && d < 12) {
      state.missionStage = 1; state.money += 500;
      state.missionText = 'Grabbed the cash — now lose 4 stars'; state.missionNext = 'Stay out of sight';
      state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Cash in hand. Now vanish, Mara — four stars on your tail.' };
      state.dialogueT = 5;
    } else if (state.missionStage === 1 && state.wanted === 0) { completeMission(state, audio); return; }
    return;
  }
  // Mission 7: cross four districts to the hideout.
  if (state.missionIndex === 6) {
    state.missionTimer += dt;
    const visited = state.flags.districtsVisited || (state.flags.districtsVisited = new Set());
    visited.add(districtAt(state.player.x, state.player.z).name);
    state.missionText = 'Reach the Fairground hideout — ' + visited.size + '/4 districts crossed';
    state.missionProgress = visited.size / 4;
    if (d < 12 && visited.size >= 4) { completeMission(state, audio); return; }
    if (d < 12) { state.missionText = 'Hideout reached — cross more districts first!'; }
    return;
  }
  // Mission 8: race to the Fairground before the timer.
  if (state.missionIndex === 7) {
    state.missionTimer -= dt;
    state.missionText = 'Fairground Rush — beat the clock';
    if (d < 12) { completeMission(state, audio); return; }
    if (state.missionTimer <= 0) { failMission(state, 'The pack beat you to the wheel.'); return; }
    return;
  }
  // Mission 9: three timed drops.
  if (state.missionIndex === 8) {
    if (d < 12) {
      state.missionStage++;
      if (state.missionStage >= 3) { completeMission(state, audio); return; }
      state.missionText = 'Drop ' + (state.missionStage + 1) + '/3 — next stop marked';
    }
    return;
  }
  // Mission 10: five-star escape to the lighthouse.
  if (state.missionIndex === 9) {
    if (d < 14) { completeMission(state, audio); return; }
    return;
  }
  // Mission 11: ram the causeway roadblock, then reach the Marina.
  if (state.missionIndex === 10) {
    // Keep the roadblock staged ahead of the player's heading so the ram is fair,
    // but once it is close, leave it fixed so the player can actually hit it.
    const a = state.player.angle;
    state.roadblocks.forEach((rb, i) => {
      if (!rb.broken && dist2d(state.player.x, state.player.z, rb.x, rb.z) > 45) {
        rb.x = state.player.x + Math.sin(a) * 30 + Math.cos(a) * (i - 1) * 7;
        rb.z = state.player.z + Math.cos(a) * 30 - Math.sin(a) * (i - 1) * 7;
        rb.angle = a + Math.PI / 2;
      }
    });
    if (state.missionStage === 0 && state.flags.missionRoadblock) {
      state.missionStage = 1; state.missionText = 'Roadblock broken — reach the Marina'; state.missionNext = 'Drive to Marina Motors';
    } else if (state.missionStage === 1 && d < 14) { completeMission(state, audio); return; }
    else if (state.missionStage === 0) {
      state.missionText = 'Ram the causeway roadblock at full speed';
      // Keep a roadblock staged ahead of the player while wanted.
      if (state.wanted < 3) addWanted(state, 3);
    }
    return;
  }
  // Mission 12: finale — survive 5 stars and reach the Marina.
  if (state.missionIndex === 11) {
    if (d < 14) { completeMission(state, audio); return; }
    return;
  }
}

export function failMission(state, reason) {
  state.missionActive = false;
  state.missionText = 'Mission failed — ' + reason;
  state.missionNext = 'Press M to retry ' + MISSIONS[state.missionIndex].name;
  state.dialogue = { speaker: 'Rosa', role: 'GARAGE OWNER', color: '#ff9f43', text: reason + ' Shake it off and try again, Mara.' };
  state.dialogueT = 5;
}

export function retryMission(state) {
  if (!state.missionActive && state.missionIndex < 12) startMission(state, state.missionIndex);
}
