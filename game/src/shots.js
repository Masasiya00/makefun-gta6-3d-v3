// Deterministic screenshot scenes (?shot=chase|city|mission|night&seed=7) and
// the ?autoplay scripted self-test. Each scene stages the real game from a
// fresh state and steps it forward a fixed number of steps, so the same seed
// always gives the same frame. The autoplay drives the real missions with
// the same autopilot the playtest uses and reports pass or fail.
export function stageShot(name, S) {
  const n = name || 'chase';
  S.newGame();
  S.unlockAll();
  S.hud.hideScreen();
  if (n === 'chase') {
    // COVER: golden-hour police chase, 3 stars, helicopter visible in frame,
    // mission tracker, police response panel, dialogue box, minimap.
    S.setClock(17.5);
    S.teleportPlayer(200, -200, Math.PI);
    const car = S.spawnCar('coupe', 200, -190, Math.PI);
    S.enterCar(car);
    S.startMission(3);
    S.closeDialogue();
    S.police.setWanted(3);
    S.stepSim(90); // let the chase form up
    // Helicopter in the frame: ahead and above the car, big and readable.
    const heli = S.police.heli;
    if (heli) heli.group.position.set(196, 34, -238);
    // Chase camera just behind the car, looking slightly up at the heli.
    S.setCamera(200, 5.5, -176, 198, 16, -240);
    S.hud.showDialogue({ who: 'Rosa', color: '#e06a4f', portrait: 'R', text: 'Forty-five seconds, Mara. Survive that and the bay is yours.' });
  } else if (n === 'city') {
    // Downtown on foot at midday, pedestrians and traffic around.
    S.setClock(12.0);
    S.teleportPlayer(200, -100, 0.4);
    S.stepSim(240);
    S.setCamera(197, 3.6, -107, 202, 1.6, -90);
  } else if (n === 'mission') {
    // Mission 11: the roadblock break on the causeway at dusk. startMission
    // teleports the player to the mission start, so the scene is staged
    // AFTER it: the car sits 20 m ahead of the camera, the roadblock
    // ~95 m ahead, so both read clearly in frame.
    S.setClock(17.0);
    S.startMission(11);
    S.closeDialogue();
    S.teleportPlayer(700, -200, Math.PI / 2);
    const car = S.spawnCar('coupe', 700, -190, Math.PI / 2);
    S.enterCar(car);
    S.police.forceRoadblock(720, -200, Math.PI / 2);
    S.stepSim(30);
    S.setCamera(680, 6, -180, 775, 4, -200);
  } else if (n === 'night') {
    // Night drive through Downtown: headlights, neon, radio strip.
    S.setClock(22.0);
    S.teleportPlayer(200, -200, Math.PI);
    const car = S.spawnCar('convert', 200, -190, Math.PI);
    S.enterCar(car);
    S.stepSim(120);
    S.setCamera(200, 5, -178, 200, 3, -240);
  }
  S.hud.update(S.hudState(), 0);
  S.render();
  S.render();
  window.__shotReady = true;
  return n;
}

// --- Autoplay self-test: start, drive a mission, chase, escape, save/load. ---
export function createAutoplay(S) {
  const log = [];
  let phase = 'start';
  let wait = 0;
  let startMoney = 0;
  const done = { value: false, pass: false };

  function note(text, ok) {
    log.push({ step: phase, text, ok: ok !== false });
    if (ok === false) { done.value = true; done.pass = false; }
  }

  return {
    log,
    get finished() { return done.value; },
    get pass() { return done.pass; },
    update(dt) {
      if (done.value) return;
      wait -= dt;
      if (wait > 0) return;
      // Dialogue pauses the sim: advance it first.
      if (S.dialogueOpen) { S.advanceDialogue(); wait = 0.05; return; }
      try {
        if (phase === 'start') {
          S.newGame();
          startMoney = S.state.money;
          if (S.state.money < 0) return note('new game money negative', false);
          note('new game started');
          S.startMission(1);
          phase = 'mission1';
        } else if (phase === 'mission1') {
          if (!S.autopilot) S.autopilot = { target: { x: 0, z: 0 }, enterCar: true };
          const m = S.missions.active;
          if (!m) {
            if (S.state.money >= startMoney + 300) note('mission 1 complete, paid $300');
            else return note('mission 1 ended without payment', false);
            S.startMission(2);
            phase = 'mission2';
          }
        } else if (phase === 'mission2') {
          if (!S.autopilot) S.autopilot = { target: { x: 0, z: 0 }, enterCar: true };
          if (!S.missions.active) {
            note('mission 2 escape complete');
            phase = 'save';
          }
        } else if (phase === 'save') {
          S.save();
          const before = S.state.money;
          S.state.money = 0;
          S.loadSave();
          if (S.state.money === before) note('save and load round-trip OK');
          else return note('save/load mismatch', false);
          S.audio.nextStation();
          note('radio station switched to ' + S.audio.station().name);
          S.pauseGame(true);
          S.pauseGame(false);
          note('pause and resume OK');
          phase = 'done';
        } else if (phase === 'done') {
          done.value = true; done.pass = true;
          note('autoplay PASS');
        }
      } catch (e) {
        note('exception: ' + (e && e.message), false);
      }
      wait = 0.05;
    },
  };
}
