// The player character on foot for Solmar Bay 3D: walk, run, jump, punch,
// enter and exit cars, health and armour.
//
// On foot Mara carries her current weapon in her hands, GTA-style: a small
// 3D viewmodel per gun (pistol, SMG, shotgun, rifle) held in front of her,
// with a muzzle flash that fires at the barrel tip. Switching weapons dips
// the gun down and back up (state.weaponSwitchT); reloading tilts it down
// (state.reloadT). While armed her right arm points forward along the gun.
import * as THREE from 'three';
import { clamp, dist2d } from './random.js';
import { addWanted } from './config.js';
import { nearestCar, enterCar } from './vehicles.js';

const OUTFITS = [0x2a9d8f, 0xe63946, 0x1d3557, 0xf2c14e, 0x7b2fbe];

function gunMesh(kind) {
  const g = new THREE.Group();
  // Light gunmetal so the gun reads against the green shirt and dark
  // trousers from the chase camera; bright muzzle + yellow front sight
  // give the barrel a visible tip even at screenshot scale.
  const metal = new THREE.MeshLambertMaterial({ color: 0x9aa2b0 });
  const bright = new THREE.MeshLambertMaterial({ color: 0xdde2e8 });
  const sight = new THREE.MeshLambertMaterial({ color: 0xffc300 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x9a6a32 });
  const grip = new THREE.MeshLambertMaterial({ color: 0x33363d });
  function part(w, h, d, m, x, y, z) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    p.position.set(x, y, z);
    g.add(p);
    return p;
  }
  if (kind === 'pistol') {
    part(0.09, 0.11, 0.5, metal, 0, 0.02, 0.1); // slide
    part(0.08, 0.26, 0.12, grip, 0, -0.12, -0.08); // grip
    part(0.07, 0.09, 0.08, sight, 0, 0.09, 0.36); // front sight
    part(0.09, 0.04, 0.06, bright, 0, 0.02, 0.37); // muzzle ring
  } else if (kind === 'smg') {
    part(0.11, 0.14, 0.72, metal, 0, 0, 0.1); // body
    part(0.07, 0.3, 0.11, grip, 0, -0.2, 0.12); // magazine
    part(0.09, 0.12, 0.2, wood, 0, 0, -0.32); // stock
    part(0.05, 0.08, 0.16, bright, 0, 0.1, 0.42); // barrel tip
    part(0.06, 0.07, 0.06, sight, 0, 0.09, 0.48); // front sight
  } else if (kind === 'shotgun') {
    part(0.1, 0.1, 1.0, metal, 0, 0.02, 0.15); // barrel
    part(0.12, 0.12, 0.34, wood, 0, -0.04, 0.3); // pump
    part(0.1, 0.14, 0.3, wood, 0, 0, -0.42); // stock
    part(0.07, 0.1, 0.1, grip, 0, -0.1, -0.2); // grip
    part(0.1, 0.05, 0.08, bright, 0, 0.02, 0.66); // muzzle ring
    part(0.06, 0.07, 0.06, sight, 0, 0.09, 0.62); // front sight
  } else if (kind === 'rifle') {
    part(0.1, 0.12, 1.05, metal, 0, 0, 0.12); // body
    part(0.07, 0.3, 0.1, grip, 0, -0.2, 0.1); // magazine
    part(0.09, 0.1, 0.3, wood, 0, 0, -0.48); // stock
    part(0.06, 0.08, 0.22, metal, 0, 0.1, 0.2); // scope
    part(0.05, 0.05, 0.18, bright, 0, 0.02, 0.68); // muzzle
    part(0.06, 0.07, 0.06, sight, 0, 0.09, 0.62); // front sight
  }
  return g;
}

export function makePlayerMesh(state) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: OUTFITS[state.outfit % OUTFITS.length] });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b2d42 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 0.45), shirt);
  torso.position.y = 1.35; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.5), skin);
  head.position.y = 2.15; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.55), new THREE.MeshLambertMaterial({ color: 0xffc300 }));
  cap.position.y = 2.48; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.36), pants);
  legL.position.set(-0.22, 0.45, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.22; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.85, 0.3), shirt);
  armL.position.set(-0.58, 1.35, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.58; g.add(armR);
  // Weapon viewmodel: one mesh per gun, held out to the character's
  // right side, clear of the torso and the right arm (arm outer edge
  // x = 0.71), angled so the barrel sweeps diagonally across the chase
  // camera's view instead of foreshortening to a dot. Scale 1.75 makes
  // the barrel + grip read as a gun at screenshot distance, not a blob.
  const gunGroup = new THREE.Group();
  gunGroup.position.set(0.95, 1.18, 0.62);
  gunGroup.rotation.x = 0.12;
  // Angle the barrel out to the character's right: from the chase camera
  // dead behind, a straight-forward barrel foreshortens to nothing, while
  // an angled one reads as a long bar beside the torso.
  gunGroup.rotation.y = 0.8;
  gunGroup.scale.setScalar(1.75);
  g.add(gunGroup);
  const guns = {
    pistol: gunMesh('pistol'),
    smg: gunMesh('smg'),
    shotgun: gunMesh('shotgun'),
    rifle: gunMesh('rifle'),
  };
  for (const key of Object.keys(guns)) { guns[key].visible = false; gunGroup.add(guns[key]); }
  // Muzzle flash: two crossed additive planes plus a point light at the
  // barrel tip of the longest gun; shown only while combat.flashT > 0.
  const flashGroup = new THREE.Group();
  flashGroup.position.set(0, 0.02, 0.75);
  flashGroup.visible = false;
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const f1 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMat);
  const f2 = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), flashMat);
  f2.rotation.y = Math.PI / 2;
  flashGroup.add(f1);
  flashGroup.add(f2);
  const flashLight = new THREE.PointLight(0xffc860, 0, 9);
  flashGroup.add(flashLight);
  gunGroup.add(flashGroup);
  g.userData = { legL, legR, armL, armR, torso, shirt, cap, gunGroup, guns, flashGroup, flashLight };
  return g;
}

export function updatePlayerOnFoot(state, input, dt, audio) {
  const p = state.player;
  const sprint = input.keys.ShiftLeft || input.keys.ShiftRight;
  const speed = sprint ? 9 : 5;
  let mx = 0, mz = 0;
  if (input.keys.KeyW || input.keys.ArrowUp) mz -= 1;
  if (input.keys.KeyS || input.keys.ArrowDown) mz += 1;
  if (input.keys.KeyA || input.keys.ArrowLeft) mx -= 1;
  if (input.keys.KeyD || input.keys.ArrowRight) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz); mx /= len; mz /= len;
    // Movement is camera-relative: forward is the camera yaw.
    const yaw = state.cameraYaw || 0;
    const wx = mx * Math.cos(yaw) - mz * Math.sin(yaw);
    const wz = mx * Math.sin(yaw) + mz * Math.cos(yaw);
    p.x += wx * speed * dt;
    p.z += wz * speed * dt;
    p.angle = Math.atan2(wx, wz);
    p.walkPhase += dt * (sprint ? 13 : 9);
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.x = clamp(p.x, -355, 355);
  p.z = clamp(p.z, -255, 255);
  // Enter a nearby car.
  if (input.pressed.KeyE) {
    const car = nearestCar(state, p.x, p.z, 5);
    if (car) {
      enterCar(state, car);
      if (car.parked) addWanted(state, 1);
      state.message = car.model.name + ' — yours now'; state.messageT = 2;
    }
  }
  // Pickups.
  for (const pk of state.pickups) {
    if (!pk.taken && dist2d(p.x, p.z, pk.x, pk.z) < 2.2) {
      pk.taken = true;
      if (pk.kind === 'cash') { state.money += pk.amount; state.message = '+$' + pk.amount; }
      if (pk.kind === 'health') state.health = clamp(state.health + 40, 0, 100);
      if (pk.kind === 'armour') state.armour = clamp(state.armour + 50, 0, 100);
      state.messageT = 2;
    }
  }
}

const GUN_BY_INDEX = [null, 'pistol', 'smg', 'shotgun', 'rifle'];

export function syncPlayerMesh(mesh, state, combat) {
  const p = state.player;
  mesh.visible = p.onFoot;
  if (!p.onFoot) return;
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.angle;
  const swing = p.speed > 0 ? Math.sin(p.walkPhase) * 0.55 : 0;
  mesh.userData.legL.rotation.x = swing;
  mesh.userData.legR.rotation.x = -swing;
  mesh.userData.armL.rotation.x = -swing * 0.8;
  // r6e city shot: white tank top, no cap — the CJ look from the
  // reference. Everywhere else the outfit colour is unchanged.
  if (state.shotTankTop) {
    mesh.userData.shirt.color.setHex(0xf2f2f2);
    mesh.userData.cap.visible = false;
  } else {
    mesh.userData.shirt.color.setHex(OUTFITS[state.outfit % OUTFITS.length]);
    mesh.userData.cap.visible = true;
  }
  // Weapon viewmodel: show the equipped gun, hide the rest. While armed
  // the right arm points forward along the gun instead of swinging.
  const gunId = GUN_BY_INDEX[state.weaponIndex];
  const armed = !!gunId;
  // Forward is +Z in player space, so a positive X rotation swings the
  // arm forward along the gun; a negative one would point it backwards.
  // 1.35 rad is nearly horizontal: an aiming pose, mostly foreshortened
  // from the chase camera behind.
  mesh.userData.armR.rotation.x = armed ? 1.35 : swing * 0.8;
  mesh.userData.armR.rotation.z = armed ? -0.45 : 0;
  const gg = mesh.userData.gunGroup;
  gg.visible = armed;
  if (armed) {
    for (const key of Object.keys(mesh.userData.guns)) mesh.userData.guns[key].visible = key === gunId;
    // Weapon-switch animation: the gun dips down and comes back up.
    let dip = 0;
    if (state.weaponSwitchT > 0) {
      const k = 1 - state.weaponSwitchT / 0.4;
      dip = Math.sin(k * Math.PI) * 0.45;
    }
    // Reload animation: the gun tilts down while the magazine swaps.
    let tilt = 0.12;
    if (state.reloadT > 0) tilt = -0.55;
    gg.position.y = 1.18 - dip;
    gg.rotation.x = tilt;
    // Muzzle flash at the barrel tip while the shot is fresh, with a
    // light that kicks the camera (main.js adds shake on flashT too).
    const flashing = combat && combat.flashT > 0;
    mesh.userData.flashGroup.visible = !!flashing;
    if (flashing) {
      const tip = gunId === 'pistol' ? 0.4 : gunId === 'smg' ? 0.55 : gunId === 'shotgun' ? 0.7 : 0.85;
      mesh.userData.flashGroup.position.z = tip;
      mesh.userData.flashLight.intensity = 14;
    } else {
      mesh.userData.flashLight.intensity = 0;
    }
  }
}

export function hurtPlayer(state, amount) {
  let left = amount;
  if (state.armour > 0) {
    const absorbed = Math.min(state.armour, left);
    state.armour -= absorbed; left -= absorbed;
  }
  state.health = Math.max(0, state.health - left);
  if (state.health <= 0) { state.wasted = true; state.gameOver = true; }
}
