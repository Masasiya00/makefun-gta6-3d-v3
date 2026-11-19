// City building for Solmar Bay 3D: ground, ocean, roads, district buildings,
// palms, lighthouse, ferris wheel, stadium, airfield, street lights and sky.
import * as THREE from 'three';
import { DISTRICTS, WORLD } from './config.js';
import { makeRng } from './random.js';

export function createWorld(state) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb36b, 180, 900);
  const bg = new THREE.Color(0xffb36b);
  scene.background = bg;
  const rng = makeRng(state.seed * 7 + 3);
  const group = new THREE.Group();
  scene.add(group);
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-120, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffc890, 0.75);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x5a4632, 0.55);
  scene.add(hemi);

  const mat = (c, rough) => new THREE.MeshLambertMaterial({ color: c, roughness: rough ?? 0.9 });
  const box = (w, h, d, c, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  };

  // Ground: grass/urban base, sand strip on the beach, ocean plane to the west.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.halfX * 2 + 260, WORLD.halfZ * 2 + 120), mat(0x5f8f5a));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-40, 0, 0); ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(70, WORLD.halfZ * 2 + 120), mat(0xf2d8a0));
  sand.rotation.x = -Math.PI / 2; sand.position.set(-325, 0.05, 0); sand.receiveShadow = true;
  group.add(sand);
  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({ color: 0x1e7fa8 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-490, 0.02, 0);
  group.add(ocean);

  // Roads: grid avenues every 60 units plus two diagonals.
  const roadMat = mat(0x33363d);
  const roads = [];
  for (let x = -300; x <= 300; x += 60) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(10, WORLD.halfZ * 2), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.08, 0); group.add(r); roads.push(r);
  }
  for (let z = -240; z <= 240; z += 60) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.halfX * 2, 10), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.08, z); group.add(r); roads.push(r);
  }
  // Centre dashes.
  const dashMat = mat(0xf2f2c8);
  for (let x = -300; x <= 300; x += 60) {
    for (let z = -240; z <= 240; z += 12) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 4), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(x, 0.1, z); group.add(d);
    }
  }

  // Buildings per district, seeded and varied by style.
  const buildings = [];
  const winMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 });
  const windows = [];
  for (const d of DISTRICTS) {
    const count = d.style === 'downtown' ? 26 : d.style === 'beach' ? 10 : d.style === 'airfield' ? 6 : d.style === 'cliff' ? 4 : 16;
    for (let i = 0; i < count; i++) {
      const bx = d.x + rng.range(-70, 70);
      const bz = d.z + rng.range(-55, 55);
      if (Math.abs(bx % 60) < 9 || Math.abs(bz % 60) < 9) continue;
      if (bx < WORLD.beachX + 12) continue;
      let h = 8 + rng.range(0, 14);
      let c = d.color;
      if (d.style === 'downtown') { h = 22 + rng.range(0, 55); c = rng.pick([0x8fb8d8, 0xd8c8a8, 0x7a9cc8, 0xc8a0b8, 0x9fb8d8]); }
      if (d.style === 'docks') { h = 7 + rng.range(0, 6); c = rng.pick([0x8a94a6, 0x6a7a8a, 0xa67a5a]); }
      if (d.style === 'oldtown') { c = rng.pick([0xe8a06a, 0xd88a8a, 0xf2c14e, 0x7ec8a0, 0xc88ad8]); }
      if (d.style === 'suburb') { h = 5 + rng.range(0, 4); c = rng.pick([0xf2e6c8, 0xd8e6f2, 0xe6d8c8, 0xc8e6c8]); }
      const w = rng.range(8, 18), dep = rng.range(8, 16);
      const b = box(w, h, dep, c, bx, h / 2, bz);
      b.castShadow = true; buildings.push(b);
      // Lit windows: small emissive planes on the face.
      const rows = Math.max(1, Math.floor(h / 6));
      for (let r = 0; r < rows; r++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), winMat);
        win.position.set(bx - w / 2 + 2 + rng.range(0, w - 4), 3 + r * 5, bz + dep / 2 + 0.06);
        group.add(win); windows.push(win);
      }
      if (d.style === 'downtown' && rng.chance(0.4)) {
        const neon = box(w * 0.7, 1, 0.4, rng.pick([0xff2d78, 0x00e5ff, 0xffc300]), bx, h + 0.6, bz + dep / 2);
        neon.material = new THREE.MeshBasicMaterial({ color: neon.material.color });
      }
    }
  }

  // Palm trees along the beach and avenues.
  const palms = [];
  const trunkMat = mat(0x8a6a42), leafMat = mat(0x2f9e44);
  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), trunkMat);
    trunk.position.y = 3.5; g.add(trunk);
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), leafMat);
      const a = (k / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.4, 7.2, Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = -Math.sin(a) * 0.9;
      g.add(leaf);
    }
    g.position.set(px, 0, pz);
    group.add(g); palms.push(g);
  }

  // Lighthouse at Lighthouse Point with a rotating beam.
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), mat(0xffffff));
  tower.position.y = 13; lh.add(tower);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 5, 10), mat(0xe63946));
  stripe.position.y = 18; lh.add(stripe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.y = 27; lh.add(lamp);
  const beamGeo = new THREE.ConeGeometry(6, 60, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2; beam.position.set(30, 27, 0); lh.add(beam);
  lh.position.set(-330, 4, 220);
  group.add(lh);

  // Ferris wheel at the Fairground.
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), mat(0xff5d8f));
  wheel.add(rim);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), mat(rng.pick([0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3])));
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cab);
  }
  const support = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 20, 6), mat(0x8a8f98));
  support.position.y = -10; wheel.add(support);
  wheel.position.set(-60, 20, 200);
  group.add(wheel);

  // Stadium bowl.
  const stadium = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 10, 18, 1, true), mat(0xd8d8d8));
  bowl.position.y = 5; stadium.add(bowl);
  const field = new THREE.Mesh(new THREE.CircleGeometry(26, 18), mat(0x3f9e4a));
  field.rotation.x = -Math.PI / 2; field.position.y = 0.3; stadium.add(field);
  const flood = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), mat(0x33363d));
  flood.position.set(30, 12, 0); stadium.add(flood);
  stadium.position.set(60, 0, -200);
  group.add(stadium);

  // Airfield runway + hangars + parked plane.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(140, 14), mat(0x2a2d33));
  runway.rotation.x = -Math.PI / 2; runway.position.set(240, 0.07, 140);
  group.add(runway);
  for (let i = 0; i < 3; i++) box(18, 8, 14, 0x9aa5b1, 200 + i * 26, 4, 108);
  const plane = new THREE.Group();
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xf2f2f2));
  fus.rotation.z = Math.PI / 2; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0xd8d8d8));
  plane.add(wing);
  plane.position.set(240, 2, 128); group.add(plane);

  // Dockside containers and cranes.
  for (let i = 0; i < 18; i++) {
    box(8, 3, 3, rng.pick([0xe63946, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261]), -250 + rng.range(-30, 30), 1.5, -210 + rng.range(-25, 25));
  }
  for (let i = 0; i < 2; i++) {
    const crane = new THREE.Group();
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2, 22, 2), mat(0xf2c14e));
    leg.position.y = 11; crane.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), mat(0xf2c14e));
    arm.position.set(10, 21, 0); crane.add(arm);
    crane.position.set(-262 + i * 24, 0, -170);
    group.add(crane);
  }

  // Marina yachts.
  for (let i = 0; i < 5; i++) {
    const y = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3), mat(0xffffff));
    hull.position.y = 0.5; y.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.4), mat(0xd8e6f2));
    cab.position.y = 2.2; y.add(cab);
    y.position.set(-352 + rng.range(-6, 6), 0.4, -150 + i * 16);
    group.add(y);
  }

  // Street lights along avenues.
  const lampHeads = [];
  for (let x = -300; x <= 300; x += 60) {
    for (let z = -240; z <= 240; z += 120) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 6), mat(0x33363d));
      pole.position.set(x + 7, 4, z); group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      head.position.set(x + 7, 8.2, z); group.add(head); lampHeads.push(head);
    }
  }

  // Clouds: flat white blobs drifting slowly.
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 12), 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-3, 3));
      puff.scale.y = 0.45; c.add(puff);
    }
    c.position.set(rng.range(-350, 350), rng.range(70, 110), rng.range(-250, 250));
    scene.add(c); clouds.push(c);
  }

  // Shop markers: coloured awning boxes at each shop.
  const shopGroup = new THREE.Group();
  scene.add(shopGroup);

  return { scene, bg, sun, amb, hemi, ocean, oceanGeo, wheel, beam, lampHeads, windows, clouds, group, shopGroup };
}

export function syncWorld(world, state, dt) {
  const h = (state.clockMin / 60) % 24;
  const golden = h >= 17 && h < 19.5;
  const night = h >= 19.5 || h < 6;
  const dayFrac = night ? 0 : golden ? 0.55 : 1;
  // Sun colour and height by time of day.
  if (night) {
    world.sun.intensity = 0.25; world.sun.color.setHex(0x8aa8ff);
    world.amb.intensity = 0.45; world.amb.color.setHex(0x8899cc);
    world.hemi.intensity = 0.32;
    world.scene.fog.color.setHex(0x0e1a2e);
    world.scene.background = new (world.scene.background?.constructor || Object)();
    world.scene.background = null;
  } else if (golden) {
    world.sun.intensity = 1.5; world.sun.color.setHex(0xff8c42);
    world.sun.position.set(-200, 55, 60);
    world.amb.intensity = 0.7; world.amb.color.setHex(0xffb36b);
    world.hemi.intensity = 0.5;
    world.scene.fog.color.setHex(0xff9a5c);
  } else {
    world.sun.intensity = 1.7; world.sun.color.setHex(0xfff2d8);
    world.sun.position.set(-120, 180, 80);
    world.amb.intensity = 0.8; world.amb.color.setHex(0xffe8c8);
    world.hemi.intensity = 0.6;
    world.scene.fog.color.setHex(0xbfd8e8);
  }
  // Sky background colour.
  const sky = night ? 0x0e1a2e : golden ? 0xff7a3c : 0x7ec8f2;
  world.bg.setHex(sky);
  // Ocean waves: gentle vertex bob.
  const pos = world.oceanGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.08 + state.time * 1.2) * 0.35 + Math.cos(y * 0.06 + state.time * 0.9) * 0.35);
  }
  pos.needsUpdate = true;
  world.oceanGeo.computeVertexNormals();
  world.wheel.rotation.z += dt * 0.25;
  world.beam.parent.rotation.y += dt * 0.6;
  for (const c of world.clouds) { c.position.x += dt * 1.2; if (c.position.x > 380) c.position.x = -380; }
  // Lit windows and lamps glow at night.
  const glow = night ? 1 : golden ? 0.45 : 0.12;
  for (const w of world.windows) w.material.emissiveIntensity = glow;
  for (const l of world.lampHeads) l.material.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  return dayFrac;
}
