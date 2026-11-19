// Solmar Bay 3D — world: terrain, roads, buildings, landmarks, sky.
// Fresh rewrite for the Fix Round 1 visual pass (maps, buildings, grass).
import * as THREE from 'three';
import { DISTRICTS, WORLD } from './config.js';
import { makeRng } from './random.js';

export function createWorld(state) {
  const rng = makeRng(state.seed * 7 + 3);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffb36b, 180, 900);
  const bg = new THREE.Color(0xffb36b);
  scene.background = bg;
  const group = new THREE.Group();
  scene.add(group);

  // Lights.
  const sun = new THREE.DirectionalLight(0xffd9a0, 1.6);
  sun.position.set(-120, 160, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffc890, 0.75);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x5a4632, 0.55);
  scene.add(hemi);

  // Small helpers.
  function mat(c, rough) {
    return new THREE.MeshLambertMaterial({ color: c, roughness: rough ?? 0.9 });
  }
  function box(w, h, d, c, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  }
  function flat(w, d, c, x, y, z) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(c));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }

  // Procedural speckle texture: a base colour with soft blotches + speckles.
  // Seeded rng only, so the world is identical on every load.
  function makeSpeckleTexture(base, shades, size, blobs, seedOffset) {
    for (let i = 0; i < seedOffset; i++) rng.next();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < blobs; i++) {
      ctx.globalAlpha = rng.range(0.25, 0.5);
      ctx.fillStyle = shades[Math.floor(rng.next() * shades.length)];
      ctx.beginPath();
      ctx.arc(rng.range(0, size), rng.range(0, size), rng.range(4, 18), 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 1500; i++) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = shades[Math.floor(rng.next() * shades.length)];
      ctx.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 2), rng.range(1, 2));
    }
    ctx.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Ground: textured grass instead of a flat green plane.
  const grassTex = makeSpeckleTexture('#5f8f5a', ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'], 512, 900, 0);
  grassTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfX * 2 + 260, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: grassTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Sand strip, also textured.
  const sandTex = makeSpeckleTexture('#f2d8a0', ['#e8c888', '#fff2c8', '#d8b878'], 512, 900, 17);
  sandTex.repeat.set(2, 8);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: sandTex })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-325, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  // Ocean.
  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, mat(0x1e7fa8));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-490, 0.02, 0);
  group.add(ocean);

  // Roads: asphalt planes, sidewalks, edge lines, centre dashes, crosswalks.
  const dashGeoX = new THREE.PlaneGeometry(0.7, 4);
  const dashGeoZ = new THREE.PlaneGeometry(4, 0.7);
  const dashMat = mat(0xf2f2c8);
  for (let x = -300; x <= 300; x += 60) {
    flat(10, WORLD.halfZ * 2, 0x33363d, x, 0.08, 0);
    flat(3, WORLD.halfZ * 2, 0x8f959c, x - 6.5, 0.05, 0);
    flat(3, WORLD.halfZ * 2, 0x8f959c, x + 6.5, 0.05, 0);
    flat(0.35, WORLD.halfZ * 2, 0xf2f2c8, x - 4.6, 0.09, 0);
    flat(0.35, WORLD.halfZ * 2, 0xf2f2c8, x + 4.6, 0.09, 0);
    for (let z = -260; z <= 260; z += 12) {
      const dash = new THREE.Mesh(dashGeoX, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.1, z);
      group.add(dash);
    }
  }
  for (let z = -240; z <= 240; z += 60) {
    flat(WORLD.halfX * 2, 10, 0x33363d, 0, 0.08, z);
    flat(WORLD.halfX * 2, 3, 0x8f959c, 0, 0.05, z - 6.5);
    flat(WORLD.halfX * 2, 3, 0x8f959c, 0, 0.05, z + 6.5);
    flat(WORLD.halfX * 2, 0.35, 0xf2f2c8, 0, 0.09, z - 4.6);
    flat(WORLD.halfX * 2, 0.35, 0xf2f2c8, 0, 0.09, z + 4.6);
    for (let x = -360; x <= 360; x += 12) {
      const dash = new THREE.Mesh(dashGeoZ, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.1, z);
      group.add(dash);
    }
  }
  // Crosswalk stripes: one shared texture, 6 white bars on transparency.
  const crossCanvas = document.createElement('canvas');
  crossCanvas.width = 128;
  crossCanvas.height = 64;
  const crossCtx = crossCanvas.getContext('2d');
  crossCtx.clearRect(0, 0, 128, 64);
  crossCtx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) crossCtx.fillRect(4 + i * 22, 0, 14, 64);
  const crossTex = new THREE.CanvasTexture(crossCanvas);
  const crossMat = new THREE.MeshBasicMaterial({ map: crossTex, transparent: true, depthWrite: false });
  const crossGeoX = new THREE.PlaneGeometry(3.2, 10);
  crossGeoX.rotateX(-Math.PI / 2);
  const crossGeoZ = crossGeoX.clone();
  crossGeoZ.rotateY(Math.PI / 2);
  for (const ix of [-240, -120, 0, 120, 240]) {
    for (const iz of [-240, -120, 0, 120, 240]) {
      const cwX = new THREE.Mesh(crossGeoX, crossMat);
      cwX.position.set(ix + 8, 0.09, iz);
      group.add(cwX);
      const cwZ = new THREE.Mesh(crossGeoZ, crossMat);
      cwZ.position.set(ix, 0.09, iz + 8);
      group.add(cwZ);
    }
  }

  // Facade textures: 4 style families, built once. Near-white base so the
  // per-building wall colour (material.color) tints the walls; the window
  // glass colours are drawn into the texture itself.
  function makeFacadeTexture(glassPalette) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ededed';
    ctx.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 4; col++) {
        const wx = col * 32 + 6;
        const wy = Math.floor((row * 256) / 6) + 7;
        ctx.fillStyle = '#20242a';
        ctx.fillRect(wx - 2, wy - 2, 24, 30);
        ctx.fillStyle = glassPalette[Math.floor(rng.next() * glassPalette.length)];
        ctx.fillRect(wx, wy, 20, 26);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 238, 128, 18);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  const facadeTex = {
    downtown: makeFacadeTexture(['#9fd8f2', '#9fd8f2', '#ffd27a', '#2a3a4a', '#2a3a4a']),
    oldtown: makeFacadeTexture(['#ffd27a', '#ffd27a', '#9fd8f2', '#2a3a4a']),
    suburb: makeFacadeTexture(['#2a3a4a', '#2a3a4a', '#9fd8f2', '#ffd27a']),
    generic: makeFacadeTexture(['#ffd27a', '#9fd8f2', '#2a3a4a', '#2a3a4a']),
  };
  // One shared facade material per (variant, repeat, wall colour).
  const facadeCache = new Map();
  const facades = [];
  function facadeMaterial(variant, w, h, color) {
    const rx = Math.max(1, Math.min(4, Math.round(w / 8)));
    const ry = Math.max(1, Math.min(6, Math.round(h / 10)));
    const key = variant + '|' + rx + '|' + ry + '|' + color;
    let m = facadeCache.get(key);
    if (!m) {
      const tex = facadeTex[variant].clone();
      tex.repeat.set(rx, ry);
      tex.needsUpdate = true;
      m = new THREE.MeshLambertMaterial({ map: tex, color, emissive: 0xffc27a, emissiveMap: tex, emissiveIntensity: 0.12 });
      facadeCache.set(key, m);
      facades.push(m);
    }
    return m;
  }
  function pickRoof(style) {
    if (style === 'downtown') return rng.pick(['parapet', 'parapet', 'flat-ac', 'flat-ac', 'pitched']);
    if (style === 'suburb') return rng.pick(['pitched', 'pitched', 'pitched', 'flat-ac', 'parapet']);
    if (style === 'oldtown') return rng.pick(['pitched', 'pitched', 'dome', 'parapet', 'flat-ac']);
    return rng.pick(['parapet', 'pitched', 'dome', 'flat-ac']);
  }

  // Buildings, one per district.
  if (!state.buildings) state.buildings = [];
  for (const d of DISTRICTS) {
    const count = d.style === 'downtown' ? 26 : d.style === 'beach' ? 10 : d.style === 'airfield' ? 6 : d.style === 'cliff' ? 4 : 16;
    for (let i = 0; i < count; i++) {
      const bx = d.x + rng.range(-70, 70);
      const bz = d.z + rng.range(-55, 55);
      if (Math.abs(bx % 60) < 9 || Math.abs(bz % 60) < 9 || bx < WORLD.beachX + 12) continue;
      let h = 8 + rng.range(0, 14);
      if (d.style === 'downtown') h = 22 + rng.range(0, 55);
      else if (d.style === 'docks') h = 7 + rng.range(0, 6);
      else if (d.style === 'suburb') h = 5 + rng.range(0, 4);
      let c = d.color;
      if (d.style === 'downtown') c = rng.pick([0x8fb8d8, 0xd8c8a8, 0x7a9cc8, 0xc8a0b8, 0x9fb8d8]);
      else if (d.style === 'docks') c = rng.pick([0x8a94a6, 0x6a7a8a, 0xa67a5a]);
      else if (d.style === 'oldtown') c = rng.pick([0xe8a06a, 0xd88a8a, 0xf2c14e, 0x7ec8a0, 0xc88ad8]);
      else if (d.style === 'suburb') c = rng.pick([0xf2e6c8, 0xd8e6f2, 0xe6d8c8, 0xc8e6c8]);
      const w = rng.range(8, 18);
      const dep = rng.range(8, 16);
      const variant = d.style === 'downtown' ? 'downtown' : d.style === 'oldtown' ? 'oldtown' : d.style === 'suburb' ? 'suburb' : 'generic';
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), facadeMaterial(variant, w, h, c));
      walls.position.set(bx, h / 2, bz);
      walls.castShadow = true;
      group.add(walls);
      // Door (+z face) + step; towers get a wide glass lobby door.
      if (h > 20) {
        box(3, 3, 0.25, 0x9fd8f2, bx, 1.5, bz + dep / 2 + 0.13);
      } else {
        box(1.6, 2.6, 0.25, 0x2a2a33, bx, 1.3, bz + dep / 2 + 0.13);
        box(2.2, 0.25, 0.8, 0x8f959c, bx, 0.12, bz + dep / 2 + 0.4);
      }
      if (d.style === 'oldtown' || d.style === 'suburb' || d.style === 'beach') {
        box(2.6, 0.15, 1.2, rng.pick([0xe63946, 0x2a9d8f, 0xf2c14e]), bx, 3.1, bz + dep / 2 + 0.6);
      }
      // Shaped roof.
      const roofColor = rng.chance(0.6) ? new THREE.Color(c).multiplyScalar(0.6).getHex() : rng.pick([0x4a4a55, 0x6a3a2a, 0x3a5a6a]);
      const roof = pickRoof(d.style);
      if (roof === 'parapet') {
        box(w, 0.7, 0.4, roofColor, bx, h + 0.35, bz - dep / 2 + 0.2);
        box(w, 0.7, 0.4, roofColor, bx, h + 0.35, bz + dep / 2 - 0.2);
        box(0.4, 0.7, dep, roofColor, bx - w / 2 + 0.2, h + 0.35, bz);
        box(0.4, 0.7, dep, roofColor, bx + w / 2 - 0.2, h + 0.35, bz);
        box(w - 0.8, 0.2, dep - 0.8, roofColor, bx, h + 0.1, bz);
      } else if (roof === 'pitched') {
        const peak = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(roofColor));
        peak.rotation.y = Math.PI / 4;
        peak.scale.set(w * 0.75, h * 0.28, dep * 0.75);
        peak.position.set(bx, h + h * 0.14, bz);
        group.add(peak);
      } else if (roof === 'dome') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8d8d8));
        dome.scale.set(w * 0.45, h * 0.22, dep * 0.45);
        dome.position.set(bx, h, bz);
        group.add(dome);
      } else {
        box(w - 0.8, 0.2, dep - 0.8, roofColor, bx, h + 0.1, bz);
        box(1.2, 0.8, 1, 0x8a8f98, bx - w / 4, h + 0.6, bz);
        box(1.2, 0.8, 1, 0x8a8f98, bx + w / 4, h + 0.6, bz);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 8), mat(0x6a7a8a));
        tank.position.set(bx, h + 1.0, bz - dep / 4);
        group.add(tank);
      }
      // Downtown neon sign, 40%.
      if (d.style === 'downtown' && rng.chance(0.4)) {
        const signColor = rng.pick([0xff2d78, 0x00e5ff, 0xffc300]);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.4), new THREE.MeshBasicMaterial({ color: signColor }));
        sign.position.set(bx, h + 0.6, bz + dep / 2);
        group.add(sign);
      }
      state.buildings.push({ x: bx, z: bz, w, d: dep, h, color: c });
    }
  }

  // Grass patches: flat tinted circles off the roads, breaking up the lawn.
  const grassShades = ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'];
  for (let i = 0; i < 45; i++) {
    const px = rng.range(-340, 340);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) <= 10 || Math.abs(pz % 60) <= 10) continue;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rng.range(6, 14), 12),
      new THREE.MeshLambertMaterial({ color: rng.pick(grassShades), transparent: true, opacity: 0.35 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(px, 0.02, pz);
    group.add(patch);
  }

  // Palm trees.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = mat(0x8a6a42);
  const leafGeo = new THREE.ConeGeometry(1.1, 4.5, 4);
  const leafMat = mat(0x2f9e44);
  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4);
      leaf.quaternion.setFromAxisAngle(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)), 0.85);
      group.add(leaf);
    }
  }

  // Lighthouse at (-330, 4, 220).
  const lighthouse = new THREE.Group();
  lighthouse.position.set(-330, 4, 220);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), mat(0xffffff));
  tower.position.y = 13;
  lighthouse.add(tower);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 5, 10), mat(0xe63946));
  stripe.position.y = 18;
  lighthouse.add(stripe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.y = 27;
  lighthouse.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(30, 27, 0);
  lighthouse.add(beam);
  group.add(lighthouse);

  // Ferris wheel at (-60, 20, 200).
  const wheel = new THREE.Group();
  wheel.position.set(-60, 20, 200);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), mat(0xff5d8f));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), mat(rng.pick([0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3])));
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cab);
  }
  const support = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 20, 6), mat(0x8a8f98));
  support.position.y = -10;
  wheel.add(support);
  group.add(wheel);

  // Stadium at (60, 0, -200).
  const stadium = new THREE.Group();
  stadium.position.set(60, 0, -200);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 10, 18, 1, true), mat(0xd8d8d8));
  bowl.position.y = 5;
  stadium.add(bowl);
  const field = new THREE.Mesh(new THREE.CircleGeometry(26, 18), mat(0x3f9e4a));
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.3;
  stadium.add(field);
  const flood = new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), mat(0x33363d));
  flood.position.set(30, 12, 0);
  stadium.add(flood);
  group.add(stadium);

  // Airfield: runway, hangars, parked plane.
  flat(140, 14, 0x2a2d33, 240, 0.07, 140);
  for (let i = 0; i < 3; i++) box(18, 8, 14, 0x9aa5b1, 200 + i * 26, 4, 108);
  const plane = new THREE.Group();
  plane.position.set(240, 2, 128);
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xd8d8d8));
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0x8a8f98));
  plane.add(wing);
  group.add(plane);

  // Dockside: containers + cranes.
  for (let i = 0; i < 18; i++) {
    box(8, 3, 3, rng.pick([0xe63946, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261]), -250 + rng.range(-30, 30), 1.5, -210 + rng.range(-25, 25));
  }
  for (let i = 0; i < 2; i++) {
    const crane = new THREE.Group();
    crane.position.set(-262 + i * 24, 0, -170);
    box(2, 22, 2, 0xf2c14e, 0, 11, 0, crane);
    box(26, 1.6, 1.6, 0xf2c14e, 10, 21, 0, crane);
    group.add(crane);
  }

  // Marina: yachts.
  for (let i = 0; i < 5; i++) {
    const yacht = new THREE.Group();
    yacht.position.set(-352 + rng.range(-6, 6), 0.4, -150 + i * 16);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3), mat(0xffffff));
    hull.position.y = 0.5;
    yacht.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.4), mat(0xd8e6f2));
    cabin.position.y = 2.2;
    yacht.add(cabin);
    group.add(yacht);
  }

  // Street lights.
  const lampHeads = [];
  const poleGeo = new THREE.CylinderGeometry(0.25, 0.25, 8, 6);
  const poleMat = mat(0x33363d);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  for (let x = -300; x <= 300; x += 60) {
    for (let z = -240; z <= 240; z += 120) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + 7, 4, z);
      group.add(pole);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2a8 });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(x + 7, 8.2, z);
      group.add(head);
      lampHeads.push(headMat);
    }
  }

  // Clouds.
  const clouds = [];
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(6, 12), 8, 6), puffMat);
      puff.scale.y = 0.45;
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-3, 3));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-350, 350), rng.range(70, 110), rng.range(-250, 250));
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Shops fill this at runtime.
  const shopGroup = new THREE.Group();
  scene.add(shopGroup);

  return { scene, bg, sun, amb, hemi, ocean, oceanGeo, wheel, beam, lampHeads, windows: facades, facades, clouds, group, shopGroup };
}

export function syncWorld(world, state, dt) {
  const h = (state.clockMin / 60) % 24;
  const golden = h >= 17 && h < 19.5;
  const night = h >= 19.5 || h < 6;
  const dayFrac = night ? 0 : golden ? 0.55 : 1;
  if (night) {
    world.sun.intensity = 0.25;
    world.sun.color.setHex(0x8aa8ff);
    world.amb.intensity = 0.45;
    world.amb.color.setHex(0x8899cc);
    world.hemi.intensity = 0.32;
    world.scene.fog.color.setHex(0x0e1a2e);
    world.bg.setHex(0x0e1a2e);
  } else if (golden) {
    world.sun.intensity = 1.5;
    world.sun.color.setHex(0xff8c42);
    world.sun.position.set(-200, 55, 60);
    world.amb.intensity = 0.7;
    world.amb.color.setHex(0xffb36b);
    world.hemi.intensity = 0.5;
    world.scene.fog.color.setHex(0xff9a5c);
    world.bg.setHex(0xff7a3c);
  } else {
    world.sun.intensity = 1.7;
    world.sun.color.setHex(0xfff2d8);
    world.sun.position.set(-120, 180, 80);
    world.amb.intensity = 0.8;
    world.amb.color.setHex(0xffe8c8);
    world.hemi.intensity = 0.6;
    world.scene.fog.color.setHex(0xbfd8e8);
    world.bg.setHex(0x7ec8f2);
  }
  world.scene.background = world.bg;
  // Ocean waves.
  const pos = world.oceanGeo.attributes.position;
  const t = state.time;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.08 + t * 1.2) * 0.35 + Math.cos(y * 0.06 + t * 0.9) * 0.35);
  }
  pos.needsUpdate = true;
  world.oceanGeo.computeVertexNormals();
  world.wheel.rotation.z += dt * 0.25;
  world.beam.parent.rotation.y += dt * 0.6;
  for (const c of world.clouds) {
    c.position.x += dt * 1.2;
    if (c.position.x > 380) c.position.x = -380;
  }
  for (const m of world.lampHeads) m.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  const glow = night ? 1 : golden ? 0.45 : 0.12;
  for (const m of world.windows) m.emissiveIntensity = glow;
  return dayFrac;
}
