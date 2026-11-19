// Mara's story arc in Solmar Bay: twelve missions handed out by Rosa and
// the crew, played in order. Each one carries its own briefing, a chain of
// stages, a timer when the job is timed, and a payout at the end.
import { MISSIONS, addWanted, addRespect, districtAt } from './config.js';
import { dist2d } from './random.js';
import { playMissionDone } from './audio.js';
import { spawnEnemy } from './combat.js';
import { roadblockSlots } from './police.js';

export function missionDef(state) { return MISSIONS[state.missionIndex]; }

// What each mission needs the moment it starts: a heat level, a countdown
// (0 means untimed), and — for the store robbery — the two goons guarding it.
const OPENING = {
  1: { wanted: 2 },
  2: { wanted: 3, timer: 45 },
  3: { timer: 0 },
  4: { timer: 150 },
  5: { wanted: 4, goons: [[-250, -120], [-245, -112]] },
  6: { wanted: 3, timer: 240 },
  7: { timer: 0 },
  8: { timer: 120 },
  9: { wanted: 5 },
  10: { wanted: 3 },
  11: { wanted: 5 },
};

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
  const opening = OPENING[index];
  if (opening) {
    if (opening.wanted) addWanted(state, opening.wanted);
    if (opening.timer !== undefined) state.missionTimer = opening.timer;
    if (opening.goons) for (const [gx, gz] of opening.goons) spawnEnemy(state, null, gx, gz, 'goon');
  }
  state.message = 'Mission ' + (index + 1) + '/12 — ' + def.name;
  state.messageT = 3;
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
  if (state.missionIndex === 11) state.victory = true;
  if (audio) playMissionDone(audio);
  // A little bonus cash dropped where the job ended.
  state.pickups.push({ kind: 'cash', amount: 100, x: state.player.x + 4, z: state.player.z + 4, taken: false });
}

// The destination for every stage of every mission, in stage order.
function waypointsFor(index) {
  return [
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
  ][index];
}

export function missionTarget(state) {
  if (!state.missionActive) return null;
  const stops = waypointsFor(state.missionIndex);
  return stops[Math.min(state.missionStage, stops.length - 1)];
}

export function updateMissions(state, dt, audio) {
  if (state.dialogueT > 0) state.dialogueT -= dt;
  if (state.messageT > 0) state.messageT -= dt;
  if (!state.missionActive) return;
  const def = MISSIONS[state.missionIndex];
  const stops = waypointsFor(state.missionIndex);
  const target = stops[Math.min(state.missionStage, stops.length - 1)];
  const range = dist2d(state.player.x, state.player.z, target.x, target.z);
  state.missionProgress = Math.max(0, Math.min(1, 1 - range / 400));

  // 1 — Pick up the coupe at the garage and bring it home to Rosa.
  if (state.missionIndex === 0) {
    if (state.missionStage === 0 && range < 10) {
      state.missionStage = 1;
      state.missionText = 'Take the red coupe out front';
      state.missionNext = 'Drive it back to Rosa';
    } else if (state.missionStage === 1 && state.player.inCar && state.player.carId === 'rosa') {
      state.missionStage = 2;
      state.missionText = 'Drive the coupe back to Rosa';
      state.missionNext = 'Park at the garage';
    } else if (state.missionStage === 2 && range < 10 && state.player.inCar) {
      completeMission(state, audio);
      return;
    }
    return;
  }

  // 2 — Shake a 2-star tail: twelve seconds out of sight.
  if (state.missionIndex === 1) {
    if (!state.inSight && state.wanted > 0) state.missionTimer += dt;
    state.missionText = 'Lose the 2-star pursuit — stay unseen ' + Math.max(0, Math.ceil(12 - state.missionTimer)) + 's';
    state.missionProgress = Math.min(1, state.missionTimer / 12);
    if (state.missionTimer >= 12 || state.wanted === 0) { completeMission(state, audio); return; }
    return;
  }

  // 3 — Ride out 45 seconds under three stars.
  if (state.missionIndex === 2) {
    state.missionTimer -= dt;
    state.missionText = 'Survive the 3-star chase';
    state.missionProgress = Math.min(1, 1 - state.missionTimer / 45);
    if (state.missionTimer <= 0) { completeMission(state, audio); return; }
    return;
  }

  // 4 — Carry the package over to Dockside.
  if (state.missionIndex === 3) {
    if (range < 12) { completeMission(state, audio); return; }
    return;
  }

  // 5 — Night run through Downtown, on the clock.
  if (state.missionIndex === 4) {
    state.missionTimer -= dt;
    state.missionText = 'Night delivery through Downtown';
    if (range < 12) { completeMission(state, audio); return; }
    if (state.missionTimer <= 0) { failMission(state, 'The delivery went cold.'); return; }
    return;
  }

  // 6 — Hit the store, then disappear with four stars on the tail.
  if (state.missionIndex === 5) {
    if (state.missionStage === 0 && range < 12) {
      state.missionStage = 1;
      state.money += 500;
      state.missionText = 'Grabbed the cash — now lose 4 stars';
      state.missionNext = 'Stay out of sight';
      state.dialogue = { speaker: 'Lupe', role: 'CREW LEAD', color: '#e8416f', text: 'Cash in hand. Now vanish, Mara — four stars on your tail.' };
      state.dialogueT = 5;
    } else if (state.missionStage === 1 && state.wanted === 0) {
      completeMission(state, audio);
      return;
    }
    return;
  }

  // 7 — Cross four districts on the way to the Fairground hideout.
  if (state.missionIndex === 6) {
    state.missionTimer += dt;
    const visited = state.flags.districtsVisited || (state.flags.districtsVisited = new Set());
    visited.add(districtAt(state.player.x, state.player.z).name);
    state.missionText = 'Reach the Fairground hideout — ' + visited.size + '/4 districts crossed';
    state.missionProgress = visited.size / 4;
    if (range < 12 && visited.size >= 4) { completeMission(state, audio); return; }
    if (range < 12) state.missionText = 'Hideout reached — cross more districts first!';
    return;
  }

  // 8 — Beat the pack to the Fairground before the clock runs out.
  if (state.missionIndex === 7) {
    state.missionTimer -= dt;
    state.missionText = 'Fairground Rush — beat the clock';
    if (range < 12) { completeMission(state, audio); return; }
    if (state.missionTimer <= 0) { failMission(state, 'The pack beat you to the wheel.'); return; }
    return;
  }

  // 9 — Three drops, in order, against the clock.
  if (state.missionIndex === 8) {
    if (range < 12) {
      state.missionStage++;
      if (state.missionStage >= 3) { completeMission(state, audio); return; }
      state.missionText = 'Drop ' + (state.missionStage + 1) + '/3 — next stop marked';
    }
    return;
  }

  // 10 — Five-star escape all the way to the lighthouse.
  if (state.missionIndex === 9) {
    if (range < 14) { completeMission(state, audio); return; }
    return;
  }

  // 11 — Smash through the causeway roadblock, then reach the Marina.
  if (state.missionIndex === 10) {
    // While the blockade is still far off, keep it parked ahead of the
    // player on the player's own road, using the same road-snapped slots
    // the police spawn uses: every car on the asphalt, all facing along
    // the road. Once it is close, leave it where it is so the ram is fair.
    const slots = roadblockSlots(state, 30);
    state.roadblocks.forEach((rb, i) => {
      if (!rb.broken && slots[i] && dist2d(state.player.x, state.player.z, rb.x, rb.z) > 45) {
        rb.x = slots[i].x;
        rb.z = slots[i].z;
        rb.angle = slots[i].angle;
      }
    });
    if (state.missionStage === 0 && state.flags.missionRoadblock) {
      state.missionStage = 1;
      state.missionText = 'Roadblock broken — reach the Marina';
      state.missionNext = 'Drive to Marina Motors';
    } else if (state.missionStage === 1 && range < 14) {
      completeMission(state, audio);
      return;
    } else if (state.missionStage === 0) {
      state.missionText = 'Ram the causeway roadblock at full speed';
      // Keep the heat on while the blockade still stands.
      if (state.wanted < 3) addWanted(state, 3);
    }
    return;
  }

  // 12 — Finale: survive five stars and make the Marina.
  if (state.missionIndex === 11) {
    if (range < 14) { completeMission(state, audio); return; }
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
