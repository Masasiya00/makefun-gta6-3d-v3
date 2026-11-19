import * as THREE from 'three';
import { DISTRICTS, WORLD } from './config.js';
import { makeRng } from './random.js';

function clampNum(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function makeSpeckleTexture(base, shades, size, blobs, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  const rng = makeRng(seed);
  for (let i = 0; i < blobs; i++) {
    ctx.globalAlpha = 0.25 + rng.next() * 0.25;
    ctx.fillStyle = shades[Math.floor(rng.next() * shades.length)];
    const r = 4 + rng.next() * 14;
    ctx.beginPath(); ctx.arc(rng.next() * size, rng.next() * size, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 1500; i++) {
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = shades[Math.floor(rng.next() * shades.length)];
    ctx.fillRect(rng.next() * size, rng.next() * size, 1 + rng.next() * 2, 1 + rng.next() * 2);
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFacadeTexture(base, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const rng = makeRng(seed);
  ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 256);
  const cols = 4, rows = 6;
  const cw = 128 / cols, ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 5, y = r * ch + 6, w = cw - 10, h = ch - 12;
      ctx.fillStyle = '#10141a'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      const roll = rng.next();
      let top, bottom;
      if (roll < 0.34) { top = '#3a2a1a'; bottom = '#ffd27a'; }
      else if (roll < 0.72) { top = '#1a2a3a'; bottom = '#6fb8d8'; }
      else { top = '#141c24'; bottom = '#2a3a4a'; }
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, top); grad.addColorStop(1, bottom);
      ctx.fillStyle = grad; ctx.fillRect(x, y, w, h);
      if (rng.next() < 0.4) {
        ctx.save();
        ctx.globalAlpha = 0.22 + rng.next() * 0.08;
        ctx.fillStyle = '#ffffff';
        ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-0.5);
        ctx.fillRect(-w * 0.7, -2, w * 1.4, 4);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x, y, w, 2);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 256 - 18, 128, 18);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
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
  sun.position.set(-120, 160, 80); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffc890, 0.75); scene.add(amb);
  const hemi = new THREE.HemisphereLight(0x9db8ff, 0x5a4632, 0.55); scene.add(hemi);

  function mat(c, rough) {
    return new THREE.MeshLambertMaterial({ color: c, roughness: rough ?? 0.9 });
  }
  function box(w, h, d, c, x, y, z, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z);
    (parent || group).add(m);
    return m;
  }

  const grassTex = makeSpeckleTexture('#5f8f5a', ['#4a7a45', '#6aa065', '#557f4f', '#7ab06a', '#3f6a3a'], 512, 900, state.seed * 11 + 5);
  grassTex.repeat.set(8, 6);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.halfX * 2 + 260, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: grassTex }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(-40, 0, 0); ground.receiveShadow = true;
  scene.add(ground);

  const sandTex = makeSpeckleTexture('#f2d8a0', ['#e8c888', '#fff2c8', '#d8b878'], 512, 900, state.seed * 13 + 9);
  sandTex.repeat.set(2, 8);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(70, WORLD.halfZ * 2 + 120),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(-325, 0.05, 0); sand.receiveShadow = true;
  scene.add(sand);

  const oceanGeo = new THREE.PlaneGeometry(260, WORLD.halfZ * 2 + 400, 24, 24);
  const ocean = new THREE.Mesh(oceanGeo, mat(0x1e7fa8));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-490, 0.02, 0);
  scene.add(ocean);

  for (let i = 0; i < 45; i++) {
    const px = rng.range(-340, 340), pz = rng.range(-250, 250);
    if (Math.abs(px % 60) <= 10 || Math.abs(pz % 60) <= 10) continue;
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(rng.range(6, 14), 12),
      new THREE.MeshLambertMaterial({ color: rng.pick([0x4a7a45, 0x6aa065, 0x557f4f, 0x7ab06a]), transparent: true, opacity: 0.35 }),
    );
    patch.rotation.x = -Math.PI / 2; patch.position.set(px, 0.02, pz);
    scene.add(patch);
  }

  const roadMat = mat(0x33363d);
  const sideMat = mat(0x8f959c);
  const lineMat = mat(0xf2f2c8);
  function flatPlane(w, d, material, x, y, z) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    p.rotation.x = -Math.PI / 2; p.position.set(x, y, z);
    scene.add(p); return p;
  }
  const xRoads = [];
  for (let x = -300; x <= 300; x += 60) {
    xRoads.push(x);
    flatPlane(10, WORLD.halfZ * 2, roadMat, x, 0.08, 0);
    flatPlane(3, WORLD.halfZ * 2, sideMat, x - 6.5, 0.05, 0);
    flatPlane(3, WORLD.halfZ * 2, sideMat, x + 6.5, 0.05, 0);
    flatPlane(0.35, WORLD.halfZ * 2, lineMat, x - 4.6, 0.09, 0);
    flatPlane(0.35, WORLD.halfZ * 2, lineMat, x + 4.6, 0.09, 0);
    for (let z = -250; z <= 250; z += 12) flatPlane(0.7, 4, lineMat, x, 0.1, z);
  }
  const zRoads = [];
  for (let z = -240; z <= 240; z += 60) {
    zRoads.push(z);
    flatPlane(WORLD.halfX * 2, 10, roadMat, 0, 0.08, z);
    flatPlane(WORLD.halfX * 2, 3, sideMat, 0, 0.05, z - 6.5);
    flatPlane(WORLD.halfX * 2, 3, sideMat, 0, 0.05, z + 6.5);
    flatPlane(WORLD.halfX * 2, 0.35, lineMat, 0, 0.09, z - 4.6);
    flatPlane(WORLD.halfX * 2, 0.35, lineMat, 0, 0.09, z + 4.6);
    for (let x = -360; x <= 360; x += 12) flatPlane(4, 0.7, lineMat, x, 0.1, z);
  }

  const stripeCanvas = document.createElement('canvas');
  stripeCanvas.width = 128; stripeCanvas.height = 64;
  const sctx = stripeCanvas.getContext('2d');
  sctx.clearRect(0, 0, 128, 64);
  sctx.fillStyle = '#ffffff';
  for (let i = 0; i < 6; i++) sctx.fillRect(6 + i * 21, 4, 14, 56);
  const stripeTex = new THREE.CanvasTexture(stripeCanvas);
  const stripeMat = new THREE.MeshBasicMaterial({ map: stripeTex, transparent: true, depthWrite: false });
  for (const cx of [-240, -120, 0, 120, 240]) {
    for (const cz of [-240, -120, 0, 120, 240]) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), stripeMat);
      a.rotation.x = -Math.PI / 2; a.position.set(cx + 8, 0.09, cz); scene.add(a);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.2), stripeMat);
      b.rotation.x = -Math.PI / 2; b.rotation.z = Math.PI / 2; b.position.set(cx, 0.09, cz + 8); scene.add(b);
    }
  }

  flatPlane(36, 24, roadMat, -163, 0.06, 108);
  flatPlane(20, 10, roadMat, -190, 0.06, 108);
  flatPlane(36, 0.3, lineMat, -163, 0.07, 96);
  flatPlane(36, 0.3, lineMat, -163, 0.07, 120);

  const facadeBases = ['#7a9cc8', '#e8a06a', '#f2e6c8', '#9fb8d8'];
  const facadeTexs = facadeBases.map((b, i) => makeFacadeTexture(b, state.seed * 17 + i * 31 + 7));
  const facades = [];
  const facadeCache = new Map();
  function facadeMaterial(variant, w, h) {
    const rx = clampNum(Math.round(w / 8), 1, 4);
    const ry = clampNum(Math.round(h / 10), 1, 6);
    const key = variant + '_' + rx + '_' + ry;
    if (facadeCache.has(key)) return facadeCache.get(key);
    const tex = facadeTexs[variant].clone();
    tex.needsUpdate = true; tex.repeat.set(rx, ry);
    const m = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffc27a, emissiveMap: tex, emissiveIntensity: 0.12 });
    facadeCache.set(key, m); facades.push(m);
    return m;
  }

  if (!state.buildings) state.buildings = [];
  const roofPalette = [0x4a4a55, 0x6a3a2a, 0x3a5a6a];
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
      const w = rng.range(8, 18), dep = rng.range(8, 16);
      const variant = d.style === 'downtown' ? 0 : d.style === 'oldtown' || d.style === 'beach' ? 1 : d.style === 'suburb' || d.style === 'hills' || d.style === 'campus' ? 2 : 3;
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), facadeMaterial(variant, w, h));
      wall.position.set(bx, h / 2, bz); wall.castShadow = true;
      group.add(wall);
      const fz = bz + dep / 2;
      const storeMat = new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 90, specular: 0xffffff, transparent: true, opacity: 0.7 });
      const store = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 2.8, 0.15), storeMat);
      store.position.set(bx, 1.4, fz + 0.08); group.add(store);
      for (const mx of [-w * 0.2, w * 0.2]) {
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 0.05), mat(0x1a1a22));
        mull.position.set(bx + mx, 1.4, fz + 0.17); group.add(mull);
      }
      const transomBar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, 0.12, 0.05), mat(0x1a1a22));
      transomBar.position.set(bx, 2.6, fz + 0.17); group.add(transomBar);
      const postL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.3), mat(0x1a1a22));
      postL.position.set(bx - 0.85, 1.4, fz + 0.15); group.add(postL);
      const postR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.8, 0.3), mat(0x1a1a22));
      postR.position.set(bx + 0.85, 1.4, fz + 0.15); group.add(postR);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.3), mat(0x1a1a22));
      lintel.position.set(bx, 2.85, fz + 0.15); group.add(lintel);
      if (h > 20) {
        const lobby = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.25), new THREE.MeshPhongMaterial({ color: 0x9fd8f2, shininess: 90, specular: 0xffffff }));
        lobby.position.set(bx, 1.5, fz + 0.13); group.add(lobby);
        for (const hx of [-0.55, 0.55]) {
          const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mat(0xd8b25a));
          handle.position.set(bx + hx, 1.1, fz + 0.28); group.add(handle);
        }
      } else {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.25), mat(0x2a2a33));
        slab.position.set(bx, 1.3, fz + 0.13); group.add(slab);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.4, 0.05), mat(0x111118));
        seam.position.set(bx, 1.3, fz + 0.27); group.add(seam);
        for (const px of [-0.4, 0.4]) {
          const panel = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.05), mat(0x3a3a48));
          panel.position.set(bx + px, 0.9, fz + 0.27); group.add(panel);
        }
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), mat(0xd8b25a));
        handle.position.set(bx + 0.55, 1.1, fz + 0.28); group.add(handle);
      }
      const transom = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
      transom.position.set(bx, 3.1, fz + 0.14); group.add(transom);
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.8), mat(0x8f959c));
      step.position.set(bx, 0.12, fz + 0.4); group.add(step);
      if (d.style === 'oldtown' || d.style === 'suburb' || d.style === 'beach') {
        const awn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 1.2), mat(rng.pick([0xe63946, 0x2a9d8f, 0xf2c14e])));
        awn.position.set(bx, 3.1, fz + 0.6); group.add(awn);
      }
      const roofKind = d.style === 'downtown' ? rng.pick(['parapet', 'parapet', 'flat-ac', 'flat-ac', 'dome'])
        : d.style === 'suburb' ? rng.pick(['pitched', 'pitched', 'parapet', 'flat-ac'])
        : d.style === 'oldtown' ? rng.pick(['pitched', 'pitched', 'dome', 'parapet'])
        : rng.pick(['parapet', 'pitched', 'dome', 'flat-ac']);
      const rc = rng.pick(roofPalette);
      if (roofKind === 'parapet') {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.2, dep - 0.8), mat(rc));
        cap.position.set(bx, h + 0.1, bz); group.add(cap);
        for (const [rw, rd, rx, rz] of [[w, 0.4, 0, dep / 2 - 0.2], [w, 0.4, 0, -dep / 2 + 0.2], [0.4, dep, w / 2 - 0.2, 0], [0.4, dep, -w / 2 + 0.2, 0]]) {
          const rim = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.7, rd), mat(rc));
          rim.position.set(bx + rx, h + 0.35, bz + rz); group.add(rim);
        }
      } else if (roofKind === 'pitched') {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(rc));
        cone.rotation.y = Math.PI / 4;
        cone.scale.set(w * 0.75, h * 0.28, dep * 0.75);
        cone.position.set(bx, h + (h * 0.28) / 2, bz); group.add(cone);
      } else if (roofKind === 'dome') {
        const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8d8d8));
        dome.scale.set(w * 0.45, h * 0.22, dep * 0.45);
        dome.position.set(bx, h, bz); group.add(dome);
      } else {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w - 0.8, 0.2, dep - 0.8), mat(rc));
        cap.position.set(bx, h + 0.1, bz); group.add(cap);
        for (const ax of [-w / 4, w / 4]) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1), mat(0x8a8f98));
          ac.position.set(bx + ax, h + 0.5, bz); group.add(ac);
        }
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 10), mat(0x6a7a8a));
        tank.position.set(bx, h + 0.9, bz + dep / 4); group.add(tank);
      }
      if (d.style === 'downtown' && rng.chance(0.4)) {
        const neon = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 1, 0.4),
          new THREE.MeshBasicMaterial({ color: rng.pick([0xff2d78, 0x00e5ff, 0xffc300]) }),
        );
        neon.position.set(bx, h + 0.6, bz + dep / 2); group.add(neon);
      }
      state.buildings.push({ x: bx, z: bz, w, d: dep, h, color: c });
    }
  }

  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 7, 6), mat(0x8a6a42));
    trunk.position.set(px, 3.5, pz); group.add(trunk);
    for (let l = 0; l < 5; l++) {
      const a = (l / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 4.5, 4), mat(0x2f9e44));
      leaf.position.set(px + Math.cos(a) * 1.4, 7.2, pz + Math.sin(a) * 1.4);
      leaf.rotation.z = Math.cos(a) * 0.9; leaf.rotation.x = -Math.sin(a) * 0.9;
      group.add(leaf);
    }
  }

  const lightGroup = new THREE.Group();
  lightGroup.position.set(-330, 0, 220); scene.add(lightGroup);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10), mat(0xffffff));
  tower.position.set(0, 13, 0); lightGroup.add(tower);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 5, 10), mat(0xe63946));
  stripe.position.set(0, 18, 0); lightGroup.add(stripe);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2a8 }));
  lamp.position.set(0, 27, 0); lightGroup.add(lamp);
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
  );
  beam.rotation.z = Math.PI / 2; beam.position.set(30, 27, 0); lightGroup.add(beam);

  const wheelGroup = new THREE.Group();
  wheelGroup.position.set(-60, 20, 200); scene.add(wheelGroup);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(16, 0.7, 8, 24), mat(0xff5d8f));
  wheelGroup.add(rim);
  const wheel = wheelGroup;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), mat(rng.pick([0xffc300, 0x00e5ff, 0xff2d78, 0x7ec8e3])));
    cab.position.set(Math.cos(a) * 16, Math.sin(a) * 16, 0); wheelGroup.add(cab);
  }
  const support = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 20, 6), mat(0x8a8f98));
  support.position.set(0, -10, 0); wheelGroup.add(support);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 10, 18, 1, true), mat(0xd8d8d8));
  bowl.position.set(60, 5, -200); group.add(bowl);
  const field = new THREE.Mesh(new THREE.CircleGeometry(26, 18), mat(0x3f9e4a));
  field.rotation.x = -Math.PI / 2; field.position.set(60, 0.3, -200); group.add(field);
  box(2, 8, 2, 0x33363d, 90, 12, -200);

  flatPlane(140, 14, mat(0x2a2d33), 240, 0.07, 140);
  for (let i = 0; i < 3; i++) box(18, 8, 14, 0x9aa5b1, 200 + i * 26, 4, 108);
  const plane = new THREE.Group(); plane.position.set(240, 2, 128); scene.add(plane);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 16, 8), mat(0xffffff));
  fus.rotation.z = Math.PI / 2; plane.add(fus);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 18), mat(0xffffff));
  plane.add(wing);

  for (let i = 0; i < 18; i++) {
    box(8, 3, 3, rng.pick([0xe63946, 0x2a9d8f, 0xe9c46a, 0x264653, 0xf4a261]), -250 + rng.range(-30, 30), 1.5, -210 + rng.range(-25, 25));
  }
  for (let i = 0; i < 2; i++) {
    box(2, 22, 2, 0xf2c14e, -262 + i * 24, 11, -170);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 1.6), mat(0xf2c14e));
    arm.position.set(-262 + i * 24 + 10, 21, -170); group.add(arm);
  }

  for (let i = 0; i < 5; i++) {
    const yx = -352 + rng.range(-6, 6), yz = -150 + i * 16;
    box(10, 2, 3, 0xffffff, yx, 0.5, yz);
    box(5, 2, 2.4, 0xd8e6f2, yx, 2.2, yz);
  }

  const poleGeo = new THREE.CylinderGeometry(0.25, 0.25, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x33363d });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, 99);
  const headGeo = new THREE.SphereGeometry(0.45, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0x8a8f98 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, 99);
  const dummy = new THREE.Object3D();
  let li = 0;
  for (let ix = 0; ix < 11; ix++) {
    for (let iz = 0; iz < 9; iz++) {
      const x = -300 + ix * 60, z = -240 + iz * 60;
      const px = (ix + iz) % 2 === 0 ? x + 7 : x - 7;
      const pz = (ix + iz) % 2 === 0 ? z + 7 : z - 7;
      dummy.position.set(px, 4, pz); dummy.updateMatrix(); poles.setMatrixAt(li, dummy.matrix);
      dummy.position.set(px, 8.2, pz); dummy.updateMatrix(); heads.setMatrixAt(li, dummy.matrix);
      li++;
    }
  }
  poles.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true;
  scene.add(poles); scene.add(heads);
  const lampHeads = [headMat];

  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cg = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(rng.range(6, 12), 8, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }),
      );
      puff.scale.y = 0.45;
      puff.position.set(k * 8 - 8, rng.range(-1, 1), rng.range(-3, 3));
      cg.add(puff);
    }
    cg.position.set(rng.range(-350, 350), rng.range(70, 110), rng.range(-250, 250));
    scene.add(cg); clouds.push(cg);
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
  if (night) {
    world.sun.intensity = 0.25; world.sun.color.setHex(0x8aa8ff);
    world.amb.intensity = 0.45; world.amb.color.setHex(0x8899cc);
    world.hemi.intensity = 0.32; world.bg.setHex(0x0e1a2e);
    world.scene.fog.color.setHex(0x0e1a2e);
  } else if (golden) {
    world.sun.intensity = 1.5; world.sun.color.setHex(0xff8c42);
    world.sun.position.set(-200, 55, 60);
    world.amb.intensity = 0.7; world.amb.color.setHex(0xffb36b);
    world.hemi.intensity = 0.5; world.bg.setHex(0xff7a3c);
    world.scene.fog.color.setHex(0xff9a5c);
  } else {
    world.sun.intensity = 1.7; world.sun.color.setHex(0xfff2d8);
    world.sun.position.set(-120, 180, 80);
    world.amb.intensity = 0.8; world.amb.color.setHex(0xffe8c8);
    world.hemi.intensity = 0.6; world.bg.setHex(0x7ec8f2);
    world.scene.fog.color.setHex(0xbfd8e8);
  }
  world.scene.background = world.bg;
  const t = state.time;
  const pos = world.oceanGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
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
