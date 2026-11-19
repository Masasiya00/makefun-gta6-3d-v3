// The twelve story missions. Each mission is a small state machine over
// stages — drive to a marker, survive a timed chase, rob a store, win a race
// through checkpoints, ram a roadblock — with dialogue lines, a HUD tracker
// (objective + stage progress + NEXT step), a timer where it fits, a reward
// and a clear end state. Missions unlock in order and save on completion.
import { MISSIONS, DIALOGUE } from './config.js';

const RACE_POINTS = {
  8: [
    { x: -600, z: 800 }, { x: -200, z: 600 }, { x: -600, z: 200 },
    { x: -200, z: 200 }, { x: -600, z: 600 }, { x: -600, z: 1000 },
  ],
  9: [
    { x: 200, z: 600 }, { x: 600, z: 600 }, { x: 600, z: 200 },
    { x: 200, z: 200 }, { x: 1000, z: 600 }, { x: 200, z: 600 },
  ],
};

const DIALOGUE_LINES = {
  1: [
    ['rosa', 'Mara! You made it. Solmar Bay eats slow drivers alive.'],
    ['mara', 'Then it is a good thing I drive fast. What is the job?'],
    ['rosa', 'Take the Coral Sedan by the door. Bring it back here. No scratches.'],
  ],
  2: [
    ['rosa', 'Two stars on you already? Lose them. Stay out of sight — the heat fades.'],
    ['mara', 'I know how to disappear. Watch me.'],
  ],
  3: [
    ['cop', 'All units: suspect vehicle, Downtown. Air One is overhead.'],
    ['rosa', 'Forty-five seconds, Mara. Survive that and the bay is yours.'],
  ],
  4: [
    ['rosa', 'Package goes to the docks. Quiet roads, no sirens. Do not get seen.'],
    ['mara', 'Quiet is my middle name.'],
  ],
  5: [
    ['rosa', 'Night delivery through Downtown. Traffic is thick — keep your cool.'],
    ['sal', 'DJ Sal here: night owls, the avenues are jammed. Good luck out there.'],
  ],
  6: [
    ['rosa', 'The Marina store is fat with cash. Take it — but the guards are armed.'],
    ['mara', 'Then I will be faster than their aim.'],
  ],
  7: [
    ['rosa', 'Four districts, one hideout. Drive like the whole bay is behind you.'],
    ['mara', 'Because it is.'],
  ],
  8: [
    ['sal', 'Race night at the Fairground! Six checkpoints, dusk light, one winner.'],
    ['mara', 'Tell the others to enjoy second place.'],
  ],
  9: [
    ['rosa', 'Timed drops: University, then the Stadium. Seventy-five seconds.'],
    ['mara', 'My watch is already running.'],
  ],
  10: [
    ['cop', 'Five stars. Every unit in the bay is rolling. Do not let her reach the Point.'],
    ['rosa', 'Coast road, Mara. Do not stop for anything.'],
  ],
  11: [
    ['cop', 'Roadblock on the causeway. She does not get through.'],
    ['mara', 'Watch me go straight through it.'],
  ],
  12: [
    ['rosa', 'Last one, Mara. Five stars, the whole bay hunting you. Reach the marina.'],
    ['mara', 'Then I am King of the Bay.'],
  ],
};

export function createMissions(rng) {
  let active = null; // {def, stage, timer, stageTimer, checkpoints, cpIndex, robTimer, done, failed, reason}
  let completed = [];
  let unlocked = 1;

  function start(id, state) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def) return null;
    active = {
      def, stage: 0, timer: def.seconds || 0, robTimer: 0,
      checkpoints: RACE_POINTS[id] ? [...RACE_POINTS[id]] : [],
      cpIndex: 0, done: false, failed: false, reason: '',
      dialogue: DIALOGUE_LINES[id] || [],
      dialogueIndex: 0,
    };
    // Mission setup hooks the caller applies: wanted level, time of day, spawn.
    // A robbery starts quiet — the four-star response only begins once the
    // safe is open (stage 2 sets it).
    if (def.stars && def.type !== 'rob') state.police.setWanted(def.stars);
    if (def.night) state.clock = 22.0;
    if (id === 6) {
      state.combat.spawnEnemy(def.start.x + 8, def.start.z + 6);
      state.combat.spawnEnemy(def.start.x - 8, def.start.z + 6);
    }
    if (id === 11) state.police.setWanted(3);
    return active;
  }

  function objectiveText() {
    if (!active) return null;
    const d = active.def;
    const total = active.checkpoints.length;
    switch (d.type) {
      case 'drive': case 'deliver':
        return { title: d.name, text: 'Drive to the marker', next: 'Follow the yellow marker on the minimap', progress: null };
      case 'escape':
        return { title: d.name, text: 'Stay out of sight until the heat fades', next: 'Break line of sight — hide behind buildings', progress: null };
      case 'survive':
        return { title: d.name, text: `Survive the chase — ${Math.ceil(active.timer)}s left`, next: 'Keep moving, do not get cornered', progress: (d.seconds - active.timer) / d.seconds };
      case 'rob':
        return active.stage === 0
          ? { title: d.name, text: 'Reach the Marina store', next: 'Stand at the store door to start the robbery', progress: null }
          : active.stage === 1
            ? { title: d.name, text: `Robbing… ${Math.ceil(active.robTimer)}s`, next: 'Stay at the door until the safe is open', progress: active.robTimer / 5 }
            : { title: d.name, text: 'Escape the four-star response', next: 'Lose the police, then reach the marker', progress: null };
      case 'race':
        return { title: d.name, text: `Checkpoint ${active.cpIndex + 1} of ${total}`, next: 'Follow the checkpoints in order', progress: active.cpIndex / total };
      case 'ram':
        return active.stage === 0
          ? { title: d.name, text: 'Reach the causeway roadblock', next: 'Build speed on the straight', progress: null }
          : { title: d.name, text: 'Break through the roadblock!', next: 'Ram straight through the blockade', progress: null };
      default:
        return { title: d.name, text: d.brief, next: '', progress: null };
    }
  }

  function step(dt, state) {
    if (!active || active.done || active.failed) return null;
    const d = active.def;
    const px = state.player.x; const pz = state.player.z;
    const dist = (t) => Math.hypot(px - t.x, pz - t.z);
    let event = null;

    if (d.id === 1) {
      // First Wheels: get in the sedan, drive to the beach point, bring it back.
      if (active.stage === 0 && state.inCar) { active.stage = 1; event = 'stage'; }
      else if (active.stage === 1 && dist({ x: -1450, z: 400 }) < 14) { active.stage = 2; event = 'stage'; }
      else if (active.stage === 2 && dist(d.target) < 14) { active.done = true; event = 'complete'; }
      return event;
    }
    if (d.type === 'survive') {
      active.timer -= dt;
      if (active.timer <= 0) { active.done = true; event = 'complete'; }
    } else if (d.type === 'escape') {
      if (state.police.wanted === 0) { active.done = true; event = 'complete'; }
    } else if (d.type === 'race') {
      active.timer -= dt;
      if (active.timer <= 0) { active.failed = true; active.reason = 'Out of time.'; event = 'fail'; }
      else {
        const cp = active.checkpoints[active.cpIndex];
        if (cp && dist(cp) < 14) {
          active.cpIndex += 1;
          event = 'checkpoint';
          if (active.cpIndex >= active.checkpoints.length) { active.done = true; event = 'complete'; }
        }
      }
    } else if (d.type === 'rob') {
      if (active.stage === 0 && dist(d.target) < 10) { active.stage = 1; active.robTimer = 5; event = 'stage'; }
      else if (active.stage === 1) {
        active.robTimer -= dt;
        if (dist(d.target) > 14) { active.stage = 0; active.robTimer = 0; }
        else if (active.robTimer <= 0) {
          active.stage = 2;
          state.police.setWanted(4);
          state.money += 400; // cash from the till
          event = 'stage';
        }
      } else if (active.stage === 2) {
        if (state.police.wanted === 0) { active.done = true; event = 'complete'; }
      }
    } else if (d.type === 'ram') {
      if (active.stage === 0 && dist({ x: 1000, z: -200 }) < 30) {
        active.stage = 1;
        // Force a roadblock right ahead on the causeway.
        state.police.setWanted(3);
        state.police.forceRoadblock(1100, -200, Math.PI / 2);
        event = 'stage';
      } else if (active.stage === 1) {
        const blocks = state.police.roadblocks.filter((r) => r.isBarrier);
        const near = blocks.some((b) => dist(b) < 12);
        if (near) { active.done = true; event = 'complete'; }
        if (d.target && dist(d.target) < 16) { active.done = true; event = 'complete'; }
      }
    } else {
      // drive / deliver: reach the target marker.
      if (d.target && dist(d.target) < 14) { active.done = true; event = 'complete'; }
    }
    return event;
  }

  function complete(state) {
    if (!active) return null;
    const d = active.def;
    state.money += d.reward;
    state.respect += d.respect;
    completed = [...new Set([...completed, d.id])];
    unlocked = Math.max(unlocked, Math.min(12, d.id + 1));
    const reward = { money: d.reward, respect: d.respect, id: d.id, name: d.name };
    active = null;
    return reward;
  }

  return {
    get active() { return active; },
    get completed() { return completed; },
    get unlocked() { return unlocked; },
    start, step, complete, objectiveText,
    nextDialogue() {
      if (!active || active.dialogueIndex >= active.dialogue.length) return null;
      const [who, text] = active.dialogue[active.dialogueIndex];
      active.dialogueIndex += 1;
      const whoDef = DIALOGUE[who] || DIALOGUE.rosa;
      return { who: whoDef.name, color: whoDef.color, portrait: whoDef.portrait, text };
    },
    hasMoreDialogue() { return active && active.dialogueIndex < active.dialogue.length; },
    load(save) {
      completed = save.completed || [];
      unlocked = save.unlocked || 1;
    },
    saveData() { return { completed, unlocked }; },
    cancel() { active = null; },
  };
}
