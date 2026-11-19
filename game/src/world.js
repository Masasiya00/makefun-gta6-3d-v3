// Solmar Bay 3D — world: terrain, roads, buildings, landmarks, sky.
// Rewritten fresh for Fix Round 2 (doors legible + facade base #ededed).
import * as THREE from 'three';
import { DISTRICTS, WORLD } from './config.js';
import { makeRng } from './random.js';

const clampN = (v, a, b) => Math.min(b, Math.max(a, v));

function makeSpeckleTexture(base, shades, size, blobs, rng) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < blobs; i++) {
    const shade = rng.pick(shades);
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    const r = rng.range(4, 18);
    ctx.globalAlpha = rng.range(0.25, 0.5);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 1500; i++) {
    const shade = rng.pick(shades);
    const x = rng.range(0, size);
    const y = rng.range(0, size);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, rng.range(1, 2), rng.range(1, 2));
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFacadeTexture(variant, rng) {
  const W = 128, H = 256;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  // Near-white base: the wall colour comes from material.color, not the texture.
  ctx.fillStyle = '#ededed';
  ctx.fillRect(0, 0, W, H);
  const litChance = variant === 'oldtown' ? 0.4 : variant === 'downtown' ? 0.35 : variant === 'suburb' ? 0.25 : 0.33;
  const cols = 4, rows = 6;
  const cw = W / cols, ch = H / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw, y = r * ch;
      ctx.fillStyle = '#1a222c';
      ctx.fillRect(x + 3, y + 4, cw - 6, ch - 8);
      let glass;
      const roll = rng.range(0, 1);
      if (roll < litChance) {
        glass = variant === 'oldtown' ? '#ffd27a' : rng.chance(0.6) ? '#ffd27a' : '#9fd8f2';
      } else if (roll < litChance + 0.35) {
        glass = '#9fd8f2';
      } else {
        glass = '#2a3a4a';
      }
      ctx.fillStyle = glass;
      ctx.fillRect(x + 6, y + 7, cw - 12, ch - 14);
    }
  }
  // Darker ground-floor band.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(0, H - 22, W, 22);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeCrosswalkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(4 + i * 22, 4, 14, 56);
  }
  return new THREE.CanvasTexture(canvas);
}

export function createWorld(state) {
  const scene = new THREE.Scene();
  const bg = new THREE.Color(0xffb36b);
  scene.background = bg;
  scene.fog = new THREE.Fog(0xffb36b, 180, 900);
  const rng = makeRng(state.seed * 7 + 3);
  const group = new THREE.Group();
  scene.add(group);

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

  const mat = (c, rough) => new THREE.MeshLambertMaterial({ color: c, roughness: rough ?? 0.9 });
  const box = (w, h, d, c, x, y, z, parent) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  };

  // --- Ground: textured grass + sand ---
  const grassTex = makeSpeckleTexture('#5f8f5a', ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'], 512, 900, makeRng(state.seed * 31 + 11));
  grassTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfX * 2 + 260, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sandTex = makeSpeckleTexture('#f2d8a0', ['#e8c888', '#fff2c8', '#d8b878'], 512, 900, makeRng(state.seed * 31 + 23));
  sandTex.repeat.set(2, 8);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-325, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  // --- Ocean ---
  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, mat(0x1e7fa8));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-490, 0.02, 0);
  group.add(ocean);

  // --- Roads ---
  const roadMat = mat(0x33363d);
  const dashMat = mat(0xf2f2c8);
  const dashGeoX = new THREE.PlaneGeometry(0.7, 4);
  const dashGeoZ = new THREE.PlaneGeometry(4, 0.7);
  const walkMat = mat(0x8f959c);
  const edgeMat = mat(0xf2f2c8);
  const addFlat = (geo, material, x, y, z) => {
    const m = new THREE.Mesh(geo, material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  const xRoads = [];
  for (let x = -300; x <= 300; x += 60) xRoads.push(x);
  const zRoads = [];
  for (let z = -240; z <= 240; z += 60) zRoads.push(z);
  for (const x of xRoads) {
    addFlat(new THREE.PlaneGeometry(10, WORLD.halfZ * 2), roadMat, x, 0.08, 0);
    addFlat(new THREE.PlaneGeometry(3, WORLD.halfZ * 2), walkMat, x - 6.5, 0.05, 0);
    addFlat(new THREE.PlaneGeometry(3, WORLD.halfZ * 2), walkMat, x + 6.5, 0.05, 0);
    addFlat(new THREE.PlaneGeometry(0.35, WORLD.halfZ * 2), edgeMat, x - 4.6, 0.09, 0);
    addFlat(new THREE.PlaneGeometry(0.35, WORLD.halfZ * 2), edgeMat, x + 4.6, 0.09, 0);
    for (let z = -240; z <= 240; z += 12) {
      addFlat(dashGeoX, dashMat, x, 0.1, z);
    }
  }
  for (const z of zRoads) {
    addFlat(new THREE.PlaneGeometry(WORLD.halfX * 2, 10), roadMat, 0, 0.08, z);
    addFlat(new THREE.PlaneGeometry(WORLD.halfX * 2, 3), walkMat, 0, 0.05, z - 6.5);
    addFlat(new THREE.PlaneGeometry(WORLD.halfX * 2, 3), walkMat, 0, 0.05, z + 6.5);
    addFlat(new THREE.PlaneGeometry(WORLD.halfX * 2, 0.35), edgeMat, 0, 0.09, z - 4.6);
    addFlat(new THREE.PlaneGeometry(WORLD.halfX * 2, 0.35), edgeMat, 0, 0.09, z + 4.6);
    for (let x = -360; x <= 360; x += 12) {
      addFlat(dashGeoZ, dashMat, x, 0.1, z);
    }
  }
  // Crosswalks at major intersections (+x arm and +z arm only).
  const crossTex = makeCrosswalkTexture();
  const crossMat = new THREE.MeshBasicMaterial({ map: crossTex, transparent: true, depthWrite: false });
  const crossGeoX = new THREE.PlaneGeometry(10, 3.2);
  const crossGeoZ = new THREE.PlaneGeometry(3.2, 10);
  for (const ix of [-240, -120, 0, 120, 240]) {
    for (const iz of [-240, -120, 0, 120, 240]) {
      addFlat(crossGeoX, crossMat, ix + 8, 0.09, iz);
      addFlat(crossGeoZ, crossMat, ix, 0.09, iz + 8);
    }
  }

  // --- Grass patches (off-road only) ---
  const patchShades = ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'];
  const patchRng = makeRng(state.seed * 17 + 3);
  let patches = 0;
  for (let tries = 0; tries < 300 && patches < 45; tries++) {
    const px = patchRng.range(-340, 340);
    const pz = patchRng.range(-250, 250);
    if (Math.abs(px % 60) <= 10 || Math.abs(pz % 60) <= 10) continue;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(patchRng.range(6, 14), 12),
      new THREE.MeshLambertMaterial({ color: patchRng.pick(patchShades), transparent: true, opacity: 0.35 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(px, 0.02, pz);
    group.add(patch);
    patches++;
  }

  // --- Buildings ---
  if (!state.buildings) state.buildings = [];
  const facadeRng = makeRng(state.seed * 13 + 5);
  const facadeBase = {
    downtown: makeFacadeTexture('downtown', facadeRng),
    oldtown: makeFacadeTexture('oldtown', facadeRng),
    suburb: makeFacadeTexture('suburb', facadeRng),
    generic: makeFacadeTexture('generic', facadeRng),
  };
  const facadeCache = new Map();
  const facades = [];
  const facadeMatFor = (variant, w, h, c) => {
    const rx = clampN(Math.round(w / 8), 1, 4);
    const ry = clampN(Math.round(h / 10), 1, 6);
    const key = variant + '|' + rx + '|' + ry + '|' + c;
    let m = facadeCache.get(key);
    if (!m) {
      const tex = facadeBase[variant].clone();
      tex.needsUpdate = true;
      tex.repeat.set(rx, ry);
      m = new THREE.MeshLambertMaterial({ map: tex, color: c, emissive: 0xffc27a, emissiveMap: tex, emissiveIntensity: 0.12 });
      facadeCache.set(key, m);
      facades.push(m);
    }
    return m;
  };
  const roofPalette = [0x4a4a55, 0x6a3a2a, 0x3a5a6a];
  const awningPalette = [0xe63946, 0x2a9d8f, 0xf2c14e];
  const neonPalette = [0xff2d78, 0x00e5ff, 0xffc300];

  for (const d of DISTRICTS) {
    const count = d.style === 'downtown' ? 26 : d.style === 'beach' ? 10 : d.style === 'airfield' ? 6 : d.style === 'cliff' ? 4 : 16;
    for (let i = 0; i < count; i++) {
      const bx = d.x + rng.range(-70, 70);
      const bz = d.z + rng.range(-55, 55);
      if (Math.abs(bx % 60) < 9 || Math.abs(bz % 60) < 9) continue;
      if (bx < WORLD.beachX + 12) continue;
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
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), facadeMatFor(variant, w, h, c));
      wall.position.set(bx, h / 2, bz);
      wall.castShadow = true;
      group.add(wall);

      // Door (+z face only): dark frame, door, warm lit transom, step.
      const lobby = h > 20;
      const fz = bz + dep / 2;
      if (lobby) {
        box(3.8, 3.6, 0.15, 0x14141c, bx, 1.8, fz + 0.06);
        box(3.4, 3.2, 0.25, 0x9fd8f2, bx, 1.6, fz + 0.13);
        const transom = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        transom.position.set(bx, 3.45, fz + 0.14);
        group.add(transom);
      } else {
        box(2.6, 3.2, 0.15, 0x14141c, bx, 1.6, fz + 0.06);
        box(2.2, 2.8, 0.25, 0x2a2a33, bx, 1.4, fz + 0.13);
        const transom = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
        transom.position.set(bx, 3.05, fz + 0.14);
        group.add(transom);
      }
      box(2.2, 0.25, 0.8, 0x8a8f98, bx, 0.12, fz + 0.4);
      if (d.style === 'oldtown' || d.style === 'suburb' || d.style === 'beach') {
        box(2.6, 0.15, 1.2, rng.pick(awningPalette), bx, 3.1, fz + 0.6);
      }

      // Roof (weighted by style).
      let roofType;
      if (d.style === 'downtown') roofType = rng.chance(0.5) ? 'parapet' : 'flat-ac';
      else if (d.style === 'suburb') roofType = rng.chance(0.7) ? 'pitched' : rng.pick(['parapet', 'flat-ac', 'dome']);
      else if (d.style === 'oldtown') roofType = rng.chance(0.5) ? 'pitched' : 'dome';
      else roofType = rng.pick(['parapet', 'pitched', 'dome', 'flat-ac']);
      const roofCol = new THREE.Color(c).multiplyScalar(0.6).getHex();
      const roofMat = mat(roofCol);
      if (roofType === 'parapet') {
        box(w, 0.7, 0.4, roofCol, bx, h + 0.35, bz - dep / 2 + 0.2);
        box(w, 0.7, 0.4, roofCol, bx, h + 0.35, bz + dep / 2 - 0.2);
        box(0.4, 0.7, dep, roofCol, bx - w / 2 + 0.2, h + 0.35, bz);
        box(0.4, 0.7, dep, roofCol, bx + w / 2 - 0.2, h + 0.35, bz);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.2, dep - 0.8), roofMat);
        cap.position.set(bx, h + 0.1, bz);
        group.add(cap);
      } else if (roofType === 'pitched') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(rng.pick(roofPalette)));
        cone.rotation.y = Math.PI / 4;
        cone.scale.set(w * 0.75, h * 0.28, dep * 0.75);
        cone.position.set(bx, h + (h * 0.28) / 2, bz);
        group.add(cone);
      } else if (roofType === 'dome') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8d8d8));
        dome.scale.set(w * 0.45, h * 0.22, dep * 0.45);
        dome.position.set(bx, h, bz);
        group.add(dome);
      } else {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.2, dep - 0.8), roofMat);
        cap.position.set(bx, h + 0.1, bz);
        group.add(cap);
        box(1.2, 0.8, 1, 0x8a8f98, bx - w / 4, h + 0.5, bz);
        box(1.2, 0.8, 1, 0x8a8f98, bx + w / 4, h + 0.5, bz);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), mat(0x6a7a8a));
        tank.position.set(bx, h + 0.9, bz - dep / 4);
        group.add(tank);
      }

      // Downtown neon sign (40%).
      if (d.style === 'downtown' && rng.chance(0.4)) {
        const signCol = rng.pick(neonPalette);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.4), new THREE.MeshBasicMaterial({ color: signCol }));
        sign.position.set(bx, h + 0.6, bz + dep / 2);
        group.add(sign);
      }

      state.buildings.push({ x: bx, z: bz, w, d: dep, h, color: c });
    }
  }

  // --- Palm trees ---
  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), mat(0x8a6a42));
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), mat(0x2f9e44));
      leaf.position.set(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.6;
      leaf.rotation.x = -Math.sin(a) * 0.6;
      group.add(leaf);
    }
  }

  // --- Lighthouse ---
  const lightGroup = new THREE.Group();
  lightGroup.position.set(-330, 4, 220);
  group.add(lightGroup);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), mat(0xffffff));
  tower.position.set(0, 13, 0);
  lightGroup.add(tower);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 5, 10), mat(0xe63946));
  stripe.position.set(0, 18, 0);
  lightGroup.add(stripe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.set(0, 27, 0);
  lightGroup.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2;
  beam.position.set(30, 27, 0);
  lightGroup.add(beam);

  // --- Ferris wheel ---
  const wheel = new THREE.Group();
  wheel.position.set(-60, 20, 200);
  group.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), mat(0xff5d8f));
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), mat(rng.pick([0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3])));
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cab);
  }
  const support = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 20, 6), mat(0x8a8f98));
  support.position.set(-60, 10, 200);
  group.add(support);

  // --- Stadium ---
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 10, 18, 1, true), mat(0xd8d8d8));
  bowl.position.set(60, 5, -200);
  group.add(bowl);
  const field = new THREE.Mesh(new THREE.CircleGeometry(26, 18), mat(0x3f9e4a));
  field.rotation.x = -Math.PI / 2;
  field.position.set(60, 0.3, -200);
  group.add(field);
  box(2, 8, 2, 0x33363d, 90, 12, -200);

  // --- Airfield ---
  addFlat(new THREE.PlaneGeometry(140, 14), mat(0x2a2d33), 240, 0.07, 140);
  for (let i = 0; i < 3; i++) {
    box(18, 8, 14, 0x9aa5b1, 200 + i * 26, 4, 108);
  }
  const plane = new THREE.Group();
  plane.position.set(240, 2, 128);
  group.add(plane);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xd8d8d8));
  fus.rotation.z = Math.PI / 2;
  plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0xd8d8d8));
  plane.add(wing);

  // --- Dockside ---
  for (let i = 0; i < 18; i++) {
    box(8, 3, 3, rng.pick([0xe63946, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261]), -250 + rng.range(-30, 30), 1.5, -210 + rng.range(-25, 25));
  }
  for (let i = 0; i < 2; i++) {
    const cx = -262 + i * 24;
    box(2, 22, 2, 0xf2c14e, cx, 11, -170);
    box(26, 1.6, 1.6, 0xf2c14e, cx + 10, 21, -170);
  }

  // --- Marina yachts ---
  for (let i = 0; i < 5; i++) {
    const yx = -352 + rng.range(-6, 6);
    const yz = -150 + i * 16;
    box(10, 2, 3, 0xffffff, yx, 0.5, yz);
    box(5, 2, 2.4, 0xd8e6f2, yx, 2.2, yz);
  }

  // --- Street lights ---
  const lampHeads = [];
  for (let x = -300; x <= 300; x += 60) {
    for (let z = -240; z <= 240; z += 120) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 6), mat(0x33363d));
      pole.position.set(x + 7, 4, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
      head.position.set(x + 7, 8.2, z);
      group.add(head);
      lampHeads.push(head);
    }
  }

  // --- Clouds ---
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cg = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(rng.range(6, 12), 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      puff.scale.y = 0.45;
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-3, 3));
      cg.add(puff);
    }
    cg.position.set(rng.range(-350, 350), rng.range(70, 110), rng.range(-250, 250));
    scene.add(cg);
    clouds.push(cg);
  }

  const shopGroup = new THREE.Group();
  scene.add(shopGroup);

  return { scene, bg, sun, amb, hemi, ocean, oceanGeo, wheel, beam, lampHeads, windows: facades, facades, clouds, group, shopGroup };
}

export function syncWorld(world, state, dt) {
  const h = (state.clockMin / 60) % 24;
  const golden = h >= 17 && h < 19.5;
  const night = h >= 19.5 || h < 6;
  const dayFrac = night ? 0 : golden ? 0.55 : 1;
  let sky;
  if (night) {
    world.sun.intensity = 0.25;
    world.sun.color.setHex(0x8aa8ff);
    world.amb.intensity = 0.45;
    world.amb.color.setHex(0x8899cc);
    world.hemi.intensity = 0.32;
    world.scene.fog.color.setHex(0x0e1a2e);
    sky = 0x0e1a2e;
  } else if (golden) {
    world.sun.intensity = 1.5;
    world.sun.color.setHex(0xff8c42);
    world.sun.position.set(-200, 55, 60);
    world.amb.intensity = 0.7;
    world.amb.color.setHex(0xffb36b);
    world.hemi.intensity = 0.5;
    world.scene.fog.color.setHex(0xff9a5c);
    sky = 0xff7a3c;
  } else {
    world.sun.intensity = 1.7;
    world.sun.color.setHex(0xfff2d8);
    world.sun.position.set(-120, 180, 80);
    world.amb.intensity = 0.8;
    world.amb.color.setHex(0xffe8c8);
    world.hemi.intensity = 0.6;
    world.scene.fog.color.setHex(0xbfd8e8);
    sky = 0x7ec8f2;
  }
  world.bg.setHex(sky);
  world.scene.background = world.bg;

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
  for (const head of world.lampHeads) {
    head.material.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  }
  const glow = night ? 1 : golden ? 0.45 : 0.12;
  for (const m of world.windows) m.emissiveIntensity = glow;
  return dayFrac;
}
