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
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffc890, 0.75);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x5a4632, 0.55);
  scene.add(hemi);

  function mat(c, rough) {
    return new THREE.MeshLambertMaterial({ color: c, roughness: rough ?? 0.9 });
  }
  function box(w, h, d, c, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  }
  function flat(w, d, c, x, y, z, material) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material || mat(c));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    group.add(m);
    return m;
  }
  function clampN(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function makeSpeckleTexture(base, shades, size, blobs, seedOffset) {
    const cv = document.createElement('canvas');
    cv.width = size;
    cv.height = size;
    const g = cv.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < blobs; i++) {
      const shade = shades[Math.floor(rng.next() * shades.length)];
      const px = rng.next() * size;
      const py = rng.next() * size;
      const r = 4 + rng.next() * 14;
      g.globalAlpha = 0.25 + rng.next() * 0.25;
      g.fillStyle = shade;
      g.beginPath();
      g.arc(px, py, r, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 1500; i++) {
      const shade = shades[Math.floor(rng.next() * shades.length)];
      g.globalAlpha = 0.3;
      g.fillStyle = shade;
      g.fillRect(rng.next() * size, rng.next() * size, 1 + rng.next(), 1 + rng.next());
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  const grassTex = makeSpeckleTexture('#5f8f5a', ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'], 512, 900, 0);
  grassTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfX * 2 + 260, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-40, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const sandTex = makeSpeckleTexture('#f2d8a0', ['#e8c888', '#fff2c8', '#d8b878'], 512, 900, 1);
  sandTex.repeat.set(2, 8);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-325, 0.05, 0);
  sand.receiveShadow = true;
  group.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, mat(0x1e7fa8));
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-490, 0.02, 0);
  group.add(ocean);

  const grassShades = ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'];
  for (let i = 0; i < 45; i++) {
    const px = rng.range(-340, 340);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) <= 10 || Math.abs(pz % 60) <= 10) continue;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rng.range(6, 14), 12),
      new THREE.MeshLambertMaterial({ color: grassShades[Math.floor(rng.next() * grassShades.length)], transparent: true, opacity: 0.35 }),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(px, 0.02, pz);
    group.add(patch);
  }

  for (let x = -300; x <= 300; x += 60) {
    flat(10, WORLD.halfZ * 2, 0x33363d, x, 0.08, 0);
    flat(3, WORLD.halfZ * 2, 0x8f959c, x - 6.5, 0.05, 0);
    flat(3, WORLD.halfZ * 2, 0x8f959c, x + 6.5, 0.05, 0);
    flat(0.35, WORLD.halfZ * 2, 0xf2f2c8, x - 4.6, 0.09, 0);
    flat(0.35, WORLD.halfZ * 2, 0xf2f2c8, x + 4.6, 0.09, 0);
    for (let z = -240; z <= 240; z += 12) flat(0.7, 4, 0xf2f2c8, x, 0.1, z);
  }
  for (let z = -240; z <= 240; z += 60) {
    flat(WORLD.halfX * 2, 10, 0x33363d, 0, 0.08, z);
    flat(WORLD.halfX * 2, 3, 0x8f959c, 0, 0.05, z - 6.5);
    flat(WORLD.halfX * 2, 3, 0x8f959c, 0, 0.05, z + 6.5);
    flat(WORLD.halfX * 2, 0.35, 0xf2f2c8, 0, 0.09, z - 4.6);
    flat(WORLD.halfX * 2, 0.35, 0xf2f2c8, 0, 0.09, z + 4.6);
    for (let x = -360; x <= 360; x += 12) flat(4, 0.7, 0xf2f2c8, x, 0.1, z);
  }

  const cwCanvas = document.createElement('canvas');
  cwCanvas.width = 128;
  cwCanvas.height = 64;
  const cg = cwCanvas.getContext('2d');
  cg.clearRect(0, 0, 128, 64);
  cg.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) cg.fillRect(2 + i * 22, 4, 14, 56);
  const cwTex = new THREE.CanvasTexture(cwCanvas);
  const cwMat = new THREE.MeshBasicMaterial({ map: cwTex, transparent: true, depthWrite: false });
  const crossXs = [-240, -120, 0, 120, 240];
  const crossZs = [-240, -120, 0, 120, 240];
  for (const ix of crossXs) {
    for (const iz of crossZs) {
      const armX = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 10), cwMat);
      armX.rotation.x = -Math.PI / 2;
      armX.position.set(ix + 8, 0.09, iz);
      group.add(armX);
      const armZ = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 10), cwMat);
      armZ.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      armZ.position.set(ix, 0.09, iz + 8);
      group.add(armZ);
    }
  }

  const facadeBase = [];
  const variantBase = ['#7a9cc8', '#e8a06a', '#f2e6c8', '#9fb8d8'];
  for (let v = 0; v < 4; v++) {
    const cv = document.createElement('canvas');
    cv.width = 128;
    cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = variantBase[v];
    g.fillRect(0, 0, 128, 256);
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const wx = c * 32 + 5;
        const wy = r * 42 + 6;
        const ww = 22;
        const wh = 30;
        g.fillStyle = '#1a1a22';
        g.fillRect(wx, wy, ww, wh);
        const roll = rng.next();
        let grad = null;
        if (roll < 0.33) {
          grad = g.createLinearGradient(0, wy, 0, wy + wh);
          grad.addColorStop(0, '#3a2a1a');
          grad.addColorStop(1, '#ffd27a');
        } else if (roll < 0.66) {
          grad = g.createLinearGradient(0, wy, 0, wy + wh);
          grad.addColorStop(0, '#1a2a3a');
          grad.addColorStop(1, '#6fb8d8');
        } else {
          g.fillStyle = '#2a3a4a';
          g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
        }
        if (grad) {
          g.fillStyle = grad;
          g.fillRect(wx + 2, wy + 2, ww - 4, wh - 4);
          if (rng.chance(0.4)) {
            g.save();
            g.globalAlpha = 0.25;
            g.translate(wx + ww / 2, wy + wh / 2);
            g.rotate(0.6);
            g.fillStyle = '#ffffff';
            g.fillRect(-2, -wh, 4, wh * 2);
            g.restore();
          }
        }
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 238, 128, 18);
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    facadeBase.push(tex);
  }

  const facadeCache = new Map();
  const facades = [];
  function facadeMaterial(variant, rx, ry) {
    const key = variant + ':' + rx + ':' + ry;
    let m = facadeCache.get(key);
    if (m) return m;
    const t = facadeBase[variant].clone();
    t.needsUpdate = true;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    m = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffc27a, emissiveMap: t, emissiveIntensity: 0.12 });
    facadeCache.set(key, m);
    facades.push(m);
    return m;
  }
  function variantFor(style) {
    if (style === 'downtown') return 0;
    if (style === 'oldtown') return 1;
    if (style === 'suburb') return 2;
    return 3;
  }

  const storeMat = new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.7 });
  const lobbyGlassMat = new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.85 });
  const transomMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const spillMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
  const spillGeo = new THREE.PlaneGeometry(3.0, 2.0);

  function addDoor(bx, bz, dep, isTower) {
    const fz = bz + dep / 2;
    const dw = isTower ? 3.6 : 2.4;
    const half = dw / 2;
    box(0.18, 3.3, 0.3, 0xc8c8d0, bx - half - 0.09, 1.65, fz + 0.15);
    box(0.18, 3.3, 0.3, 0xc8c8d0, bx + half + 0.09, 1.65, fz + 0.15);
    box(dw + 0.36, 0.25, 0.3, 0xc8c8d0, bx, 3.15, fz + 0.15);
    if (isTower) {
      const lobby = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.0, 0.25), lobbyGlassMat);
      lobby.position.set(bx, 1.5, fz + 0.13);
      group.add(lobby);
      box(0.08, 0.3, 0.08, 0xd8b25a, bx - 0.35, 1.1, fz + 0.28);
      box(0.08, 0.3, 0.08, 0xd8b25a, bx + 0.35, 1.1, fz + 0.28);
      box(0.06, 2.8, 0.05, 0x111118, bx, 1.5, fz + 0.27);
    } else {
      box(2.4, 3.0, 0.25, 0x2a2a33, bx, 1.5, fz + 0.13);
      box(0.06, 2.8, 0.05, 0x111118, bx, 1.5, fz + 0.27);
      box(0.85, 1.1, 0.05, 0x3a3a48, bx - 0.55, 0.85, fz + 0.27);
      box(0.85, 1.1, 0.05, 0x3a3a48, bx + 0.55, 0.85, fz + 0.27);
      box(0.08, 0.3, 0.08, 0xd8b25a, bx + 0.85, 1.1, fz + 0.28);
    }
    const tw = isTower ? 3.8 : 2.6;
    const tr = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.6, 0.1), transomMat);
    tr.position.set(bx, 3.45, fz + 0.14);
    group.add(tr);
    box(2.2, 0.25, 0.8, 0x8f959c, bx, 0.12, fz + 0.4);
    const spill = new THREE.Mesh(spillGeo, spillMat);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(bx, 0.07, fz + 1.4);
    group.add(spill);
  }

  if (!state.buildings) state.buildings = [];
  const roofPalette = [0x4a4a55, 0x6a3a2a, 0x3a5a6a];
  for (const d of DISTRICTS) {
    const count = d.style === 'downtown' ? 26 : d.style === 'beach' ? 10 : d.style === 'airfield' ? 6 : d.style === 'cliff' ? 4 : 16;
    for (let i = 0; i < count; i++) {
      const bx = d.x + rng.range(-70, 70);
      const bz = d.z + rng.range(-55, 55);
      if (Math.abs(bx % 60) < 9 || Math.abs(bz % 60) < 9 || bx < WORLD.beachX + 12) continue;
      // Keep the runway and its apron clear (airfield block) and the
      // country road east of town clear, so no building ever spawns on
      // the runway or across the farm road.
      if ((bx > 165 && bx < 315 && bz > 100 && bz < 170) || (bz > 168 && bz < 192 && bx > 180 && bx < 330)) continue;
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
      const rx = clampN(Math.round(w / 8), 1, 4);
      const ry = clampN(Math.round(h / 10), 1, 6);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), facadeMaterial(variantFor(d.style), rx, ry));
      wall.position.set(bx, h / 2, bz);
      wall.castShadow = true;
      group.add(wall);

      const fz = bz + dep / 2;
      const sf = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 2.8, 0.15), storeMat);
      sf.position.set(bx, 1.4, fz + 0.08);
      group.add(sf);
      box(0.12, 2.8, 0.18, 0x1a1a22, bx - w * 0.15, 1.4, fz + 0.08);
      box(0.12, 2.8, 0.18, 0x1a1a22, bx + w * 0.15, 1.4, fz + 0.08);
      box(w * 0.6, 0.12, 0.18, 0x1a1a22, bx, 2.6, fz + 0.08);

      const isTower = h > 20;
      addDoor(bx, bz, dep, isTower);
      if (d.style === 'oldtown' || d.style === 'suburb' || d.style === 'beach') {
        box(2.6, 0.15, 1.2, rng.pick([0xe63946, 0x2a9d8f, 0xf2c14e]), bx, 4.0, fz + 0.6);
      }

      let roofType;
      if (d.style === 'downtown') roofType = rng.pick(['parapet', 'parapet', 'flat-ac', 'flat-ac', 'pitched']);
      else if (d.style === 'suburb') roofType = rng.pick(['pitched', 'pitched', 'pitched', 'parapet', 'flat-ac']);
      else if (d.style === 'oldtown') roofType = rng.pick(['pitched', 'pitched', 'dome', 'dome', 'parapet']);
      else roofType = rng.pick(['parapet', 'pitched', 'dome', 'flat-ac']);
      const roofC = new THREE.Color(c).multiplyScalar(0.6).getHex();
      if (roofType === 'parapet') {
        box(w, 0.7, 0.4, roofC, bx, h + 0.35, bz - dep / 2 + 0.2);
        box(w, 0.7, 0.4, roofC, bx, h + 0.35, bz + dep / 2 - 0.2);
        box(0.4, 0.7, dep, roofC, bx - w / 2 + 0.2, h + 0.35, bz);
        box(0.4, 0.7, dep, roofC, bx + w / 2 - 0.2, h + 0.35, bz);
        box(w - 0.8, 0.2, dep - 0.8, roofC, bx, h + 0.1, bz);
      } else if (roofType === 'pitched') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(rng.pick(roofPalette)));
        cone.rotation.y = Math.PI / 4;
        cone.scale.set(w * 0.75, h * 0.28, dep * 0.75);
        cone.position.set(bx, h + h * 0.14, bz);
        group.add(cone);
      } else if (roofType === 'dome') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8d8d8));
        dome.scale.set(w * 0.45, h * 0.22, dep * 0.45);
        dome.position.set(bx, h, bz);
        group.add(dome);
      } else {
        box(w - 0.8, 0.2, dep - 0.8, roofC, bx, h + 0.1, bz);
        box(1.2, 0.8, 1, 0x8a8f98, bx - 2, h + 0.5, bz);
        box(1.2, 0.8, 1, 0x8a8f98, bx + 2, h + 0.5, bz);
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), mat(0x6a7a8a));
        tank.position.set(bx, h + 0.8, bz - dep / 4);
        group.add(tank);
      }

      if (d.style === 'downtown' && rng.chance(0.4)) {
        const neonC = rng.pick([0xff2d78, 0x00e5ff, 0xffc300]);
        const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1, 0.4), new THREE.MeshBasicMaterial({ color: neonC }));
        sign.position.set(bx, h + 0.6, bz + dep / 2);
        group.add(sign);
      }

      state.buildings.push({ x: bx, z: bz, w, d: dep, h, color: c });
    }
  }

  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), mat(0x8a6a42));
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), mat(0x2f9e44));
      leaf.position.set(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4);
      leaf.rotation.z = -Math.cos(a) * 0.7;
      leaf.rotation.x = Math.sin(a) * 0.7;
      group.add(leaf);
    }
  }

  // --- Palm Beach props: umbrellas, beach chairs and towels on the sand,
  // plus a few palms right by the beachfront road, so the coast reads as
  // a beach even from the chase camera on the road.
  const umbrellaColors = [0xff5d8f, 0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3];
  const umbrellaSpots = [[-348, 70], [-352, 88], [-344, 105], [-350, 120], [-346, 55]];
  umbrellaSpots.forEach(([ux, uz], ui) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6), mat(0xd8d8d8));
    pole.position.set(ux, 1.3, uz);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 8), mat(umbrellaColors[ui % umbrellaColors.length]));
    top.position.set(ux, 2.9, uz);
    group.add(top);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.25, 0.7), mat(umbrellaColors[(ui + 2) % umbrellaColors.length]));
    chair.position.set(ux + 2.2, 0.35, uz + 0.5);
    chair.rotation.y = 0.5;
    group.add(chair);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.15), mat(umbrellaColors[(ui + 2) % umbrellaColors.length]));
    back.position.set(ux + 1.9, 0.7, uz + 0.1);
    back.rotation.x = -0.6;
    back.rotation.y = 0.5;
    group.add(back);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), mat(umbrellaColors[(ui + 1) % umbrellaColors.length]));
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = 0.4;
    towel.position.set(ux - 1.5, 0.07, uz + 1.6);
    group.add(towel);
  });
  for (const [px, pz] of [[-316, 60], [-322, 95], [-314, 130], [-355, 95], [-350, 130], [-358, 60]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), mat(0x8a6a42));
    trunk.position.set(px, 3.5, pz);
    group.add(trunk);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), mat(0x2f9e44));
      leaf.position.set(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4);
      leaf.rotation.z = -Math.cos(a) * 0.7;
      leaf.rotation.x = Math.sin(a) * 0.7;
      group.add(leaf);
    }
  }

  const lightGroup = new THREE.Group();
  lightGroup.position.set(-330, 4, 220);
  scene.add(lightGroup);
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

  const wheel = new THREE.Group();
  wheel.position.set(-60, 20, 200);
  scene.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), mat(0xff5d8f));
  wheel.add(rim);
  const cabColors = [0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), mat(cabColors[i % 4]));
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0);
    wheel.add(cab);
  }
  const support = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 20, 6), mat(0x8a8f98));
  support.position.set(-60, 10, 200);
  group.add(support);

  const stadium = new THREE.Group();
  stadium.position.set(60, 0, -200);
  scene.add(stadium);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 10, 18, 1, true), mat(0xd8d8d8));
  bowl.position.set(0, 5, 0);
  stadium.add(bowl);
  const field = new THREE.Mesh(new THREE.CircleGeometry(26, 18), mat(0x3f9e4a));
  field.rotation.x = -Math.PI / 2;
  field.position.set(0, 0.3, 0);
  stadium.add(field);
  box(2, 8, 2, 0x33363d, 90, 12, -200);

  // --- Countryside: crop fields, a farmhouse, a red barn, hay bales and
  // a dirt track south-east of town, so the country road reads as rural.
  const fieldColors = [0xd8b84a, 0x6aa84f, 0xe8c85a, 0x5a9e4a];
  for (let i = 0; i < 4; i++) {
    flat(46, 11, fieldColors[i], 205, 0.06, 196 + i * 12);
    flat(46, 11, fieldColors[(i + 2) % 4], 205, 0.06, 158 + (i % 2) * 10);
  }
  for (let i = 0; i < 5; i++) {
    const bale = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 10), mat(0xd8b84a));
    bale.rotation.z = Math.PI / 2;
    bale.position.set(195 + i * 14, 1.1, 186);
    group.add(bale);
  }
  flat(70, 5, 0xc8a878, 222, 0.06, 200);
  // Farmhouse: cream walls, red pitched roof, chimney. On the north side
  // of the road, so the farmstead sits in frame left of the chase camera
  // instead of off the right edge behind the weapon HUD.
  box(10, 6, 8, 0xf2e6c8, 218, 3, 158);
  const farmRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(0xc0392b));
  farmRoof.rotation.y = Math.PI / 4;
  farmRoof.scale.set(8.5, 3.5, 7);
  farmRoof.position.set(218, 7.7, 158);
  group.add(farmRoof);
  box(1, 3, 1, 0x8a6a42, 221, 8.5, 156);
  box(2, 2.4, 0.2, 0x2a2a33, 218, 1.2, 162.1);
  // Red barn with white trim.
  box(9, 6, 7, 0xa93226, 200, 3, 152);
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(0x7b241c));
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.scale.set(7.5, 3, 6.2);
  barnRoof.position.set(200, 7.5, 152);
  group.add(barnRoof);
  box(3, 3.4, 0.2, 0xf2f2f2, 200, 1.7, 155.6);
  // Fence posts along the field edge.
  for (let x = 185; x <= 260; x += 8) box(0.25, 1.1, 0.25, 0x8a6a42, x, 0.55, 190);
  box(78, 0.15, 0.15, 0x8a6a42, 222, 0.9, 190);

  flat(140, 14, 0x2a2d33, 240, 0.07, 140);
  // Runway centreline dashes + edge lights, so the strip reads as a
  // runway from the chase camera and from the tarmac.
  for (let x = 178; x <= 302; x += 12) flat(6, 0.8, 0xf2f2f2, x, 0.09, 140);
  for (let x = 176; x <= 304; x += 16) {
    box(0.5, 0.5, 0.5, 0xffe9a0, x, 0.3, 132.5);
    box(0.5, 0.5, 0.5, 0xffe9a0, x, 0.3, 147.5);
  }
  // Second parked plane + control tower + windsock for the airfield.
  const plane2 = new THREE.Group();
  plane2.position.set(278, 2, 152);
  plane2.rotation.y = Math.PI / 2;
  group.add(plane2);
  const fus2 = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xff8c42));
  fus2.rotation.z = Math.PI / 2;
  plane2.add(fus2);
  const wing2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0xff8c42));
  plane2.add(wing2);
  const towerBase = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 18, 8), mat(0xd8d8d8));
  towerBase.position.set(255, 9, 158);
  group.add(towerBase);
  const towerCab = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.6, 3, 8), mat(0x9fd8f2));
  towerCab.position.set(255, 19.5, 158);
  group.add(towerCab);
  const sockPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), mat(0x33363d));
  sockPole.position.set(245, 2.5, 155);
  group.add(sockPole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 8), mat(0xff5d2d));
  sock.rotation.z = -Math.PI / 2;
  sock.position.set(246.2, 4.8, 155);
  group.add(sock);
  for (let i = 0; i < 3; i++) box(18, 8, 14, 0x9aa5b1, 200 + i * 26, 4, 108);
  const plane = new THREE.Group();
  plane.position.set(262, 2, 140);
  group.add(plane);
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xd8d8d8));
  fuselage.rotation.z = Math.PI / 2;
  plane.add(fuselage);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0xd8d8d8));
  plane.add(wing);
  // Tail fin + tailplane: the vertical fin is what makes the parked plane
  // read as an airplane from the runway behind it.
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.5, 2.2), mat(0xe63946));
  fin.position.set(-7.5, 3.2, 0);
  plane.add(fin);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.3, 8), mat(0xd8d8d8));
  tailplane.position.set(-7, 1.2, 0);
  plane.add(tailplane);

  const containerColors = [0xe63946, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261];
  for (let i = 0; i < 18; i++) {
    box(8, 3, 3, rng.pick(containerColors), -250 + rng.range(-30, 30), 1.5, -210 + rng.range(-25, 25));
  }
  for (let i = 0; i < 2; i++) {
    const crane = new THREE.Group();
    crane.position.set(-262 + i * 24, 0, -170);
    group.add(crane);
    box(2, 22, 2, 0xf2c14e, 0, 11, 0, crane);
    box(26, 1.6, 1.6, 0xf2c14e, 10, 21, 0, crane);
  }

  for (let i = 0; i < 5; i++) {
    const yacht = new THREE.Group();
    yacht.position.set(-352 + rng.range(-6, 6), 0.4, -150 + i * 16);
    group.add(yacht);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3), mat(0xffffff));
    hull.position.set(0, 0.5, 0);
    yacht.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2.4), mat(0xd8e6f2));
    cabin.position.set(0, 2.2, 0);
    yacht.add(cabin);
  }

  const lampSpots = [];
  let ix = 0;
  for (let x = -300; x <= 300; x += 60) {
    let iz = 0;
    for (let z = -240; z <= 240; z += 60) {
      if ((ix + iz) % 2 === 0) lampSpots.push({ x: x + 7, z: z + 7 });
      else lampSpots.push({ x: x - 7, z: z - 7 });
      iz++;
    }
    ix++;
  }
  const poleMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.25, 8, 6), mat(0x33363d), lampSpots.length);
  const headMat = new THREE.MeshBasicMaterial({ color: 0x8a8f98 });
  const headMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), headMat, lampSpots.length);
  const dummy = new THREE.Object3D();
  lampSpots.forEach((p, i) => {
    dummy.position.set(p.x, 4, p.z);
    dummy.updateMatrix();
    poleMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 8.2, p.z);
    dummy.updateMatrix();
    headMesh.setMatrixAt(i, dummy.matrix);
  });
  poleMesh.instanceMatrix.needsUpdate = true;
  headMesh.instanceMatrix.needsUpdate = true;
  group.add(poleMesh);
  group.add(headMesh);
  const lampHeads = [headMat];

  flat(36, 24, 0x33363d, -163, 0.06, 108);
  flat(20, 10, 0x33363d, -190, 0.06, 108);
  flat(36, 0.3, 0xf2f2c8, -163, 0.07, 96);
  flat(36, 0.3, 0xf2f2c8, -163, 0.07, 120);

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(rng.range(6, 12), 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      puff.scale.y = 0.45;
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-3, 3));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-350, 350), rng.range(70, 110), rng.range(-250, 250));
    scene.add(cloud);
    clouds.push(cloud);
  }

  const shopGroup = new THREE.Group();
  scene.add(shopGroup);

  return { scene, bg, sun, amb, hemi, ocean, oceanGeo, wheel, beam, lampHeads, windows: facades, clouds, group, shopGroup, facades };
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

  const pos = world.oceanGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 0.08 + state.time * 1.2) * 0.35 + Math.cos(y * 0.06 + state.time * 0.9) * 0.35);
  }
  pos.needsUpdate = true;
  world.oceanGeo.computeVertexNormals();

  world.wheel.rotation.z += dt * 0.25;
  world.beam.parent.rotation.y += dt * 0.6;
  for (const cloud of world.clouds) {
    cloud.position.x += dt * 1.2;
    if (cloud.position.x > 380) cloud.position.x = -380;
  }
  for (const m of world.lampHeads) m.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  const glow = night ? 1 : golden ? 0.45 : 0.12;
  for (const m of world.windows) m.emissiveIntensity = glow;

  return dayFrac;
}
