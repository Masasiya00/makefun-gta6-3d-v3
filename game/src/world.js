import * as THREE from 'three';
import { DISTRICTS, WORLD } from './config.js';
import { makeRng } from './random.js';

// Round 6e — TOTAL REDO after the GTA San Andreas reference photos
// (user order 2026-11-19 ~23:56 WIB). The world is rebuilt in the SA
// visual language: golden-hour orange haze, tall thin palms everywhere,
// low stucco houses with pitched shingle / tile roofs, white-framed
// windows whose glass catches the sunset, brick and stone walls, power
// poles with sagging wires, billboards, a curved concrete freeway
// overpass, a downtown skyline dissolving into the haze, birds in the
// orange sky, and a low sun ball over the bay. The four screenshot
// scenes get dedicated set dressing: a dirt alley between brick walls
// (city), beach cottages + boardwalk + lifeguard tower (beach), a farm
// with silo + fences + poles (countryside), and ONE realistic airliner
// on final approach (airport — the parked planes are gone).
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

  // Brick courses for the alley walls and garden walls.
  function makeBrickTexture(base, mortar) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = mortar;
    g.fillRect(0, 0, 256, 256);
    const bh = 16;
    const bw = 42;
    for (let row = 0; row < 256 / bh; row++) {
      const off = (row % 2) * bw * 0.5;
      for (let col = -1; col < 256 / bw + 1; col++) {
        const shade = 0.85 + rng.next() * 0.3;
        g.fillStyle = base;
        g.globalAlpha = shade;
        g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    g.globalAlpha = 0.16;
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rng.chance(0.5) ? '#000000' : '#ffffff';
      g.fillRect(rng.next() * 256, rng.next() * 256, 2, 2);
    }
    g.globalAlpha = 1;
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Rough stone blocks for wall foundations and garden walls.
  function makeStoneTexture() {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 256;
    const g = cv.getContext('2d');
    g.fillStyle = '#8a7a5a';
    g.fillRect(0, 0, 256, 256);
    const tones = ['#b8a888', '#a89878', '#c8b898', '#988868', '#b0a080'];
    for (let i = 0; i < 90; i++) {
      g.fillStyle = tones[Math.floor(rng.next() * tones.length)];
      const w = 22 + rng.next() * 30;
      const h = 14 + rng.next() * 16;
      g.beginPath();
      g.roundRect(rng.next() * 256, rng.next() * 256, w, h, 5);
      g.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeBillboardTexture(text, bgc, fgc) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = bgc;
    g.fillRect(0, 0, 256, 128);
    g.strokeStyle = fgc;
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 116);
    g.fillStyle = fgc;
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = text.split(' ');
    if (words.length > 1) {
      g.fillText(words[0], 128, 44);
      g.fillText(words.slice(1).join(' '), 128, 88);
    } else {
      g.fillText(text, 128, 64);
    }
    return new THREE.CanvasTexture(cv);
  }

  const brickTex = makeBrickTexture('#9a5a38', '#6a3a22');
  brickTex.repeat.set(6, 2);
  const brickMat = new THREE.MeshLambertMaterial({ map: brickTex });
  const stoneTex = makeStoneTexture();
  stoneTex.repeat.set(6, 1);
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });

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

  // --- San Andreas house kit -------------------------------------------
  // Low stucco house, gable roof of shingles or clay tile, white-framed
  // windows with glass that catches the sunset, a front door, a porch
  // slab and a little awning. Front face is +z of the returned group.
  const glassMat = new THREE.MeshPhongMaterial({ color: 0xffd9a0, shininess: 120, specular: 0xffffff, emissive: 0x8a5a20, emissiveIntensity: 0.35 });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  function gableRoofMesh(w, d, h, color) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const m = new THREE.Mesh(geo, mat(color));
    m.castShadow = true;
    return m;
  }
  function saWindow(parent, x, y, z, w, h) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, h + 0.24, 0.12), frameMat);
    frame.position.set(x, y, z);
    parent.add(frame);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.14), glassMat);
    glass.position.set(x, y, z + 0.01);
    parent.add(glass);
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.16), frameMat);
    mullV.position.set(x, y, z + 0.02);
    parent.add(mullV);
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.16), frameMat);
    mullH.position.set(x, y, z + 0.02);
    parent.add(mullH);
  }
  function saHouse(w, h, d, wallColor, roofColor, roofH) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(wallColor));
    wall.position.y = h / 2;
    wall.castShadow = true;
    g.add(wall);
    const roof = gableRoofMesh(w + 0.9, d + 0.9, roofH ?? 2.2, roofColor);
    roof.position.y = h;
    g.add(roof);
    // Windows + door on the front face (+z), porch slab + awning.
    const fz = d / 2;
    const nWin = Math.max(2, Math.round(w / 4));
    for (let i = 0; i < nWin; i++) {
      const wx = -w / 2 + (w * (i + 0.5)) / nWin;
      if (Math.abs(wx) < 1.2) continue; // door slot in the middle
      saWindow(g, wx, h * 0.55, fz + 0.05, 1.3, 1.5);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.14), mat(0x5a3a22));
    door.position.set(0, 1.3, fz + 0.06);
    g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshLambertMaterial({ color: 0xd8b25a }));
    knob.position.set(0.55, 1.25, fz + 0.16);
    g.add(knob);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 1.6), mat(0x8f959c));
    slab.position.set(0, 0.09, fz + 0.8);
    g.add(slab);
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 1.7), mat(roofColor));
    awn.position.set(0, 3.1, fz + 0.85);
    awn.rotation.x = 0.18;
    g.add(awn);
    for (const px of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6), mat(0x8a6a42));
      post.position.set(px, 1.5, fz + 1.55);
      g.add(post);
    }
    // Chimney for the bigger houses.
    if (w >= 9) {
      const ch = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 0.9), brickMat);
      ch.position.set(w * 0.28, h + (roofH ?? 2.2) * 0.55, 0);
      g.add(ch);
    }
    return g;
  }

  // Tall thin SA palm: skinny trunk with a lean, long drooping fronds,
  // a few coconuts. `dark` silhouettes it against the orange sky.
  function saPalm(x, z, height, dark) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.z = (rng.next() - 0.5) * 0.12;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, height, 6), mat(0x8a6a42));
    trunk.position.y = height / 2;
    g.add(trunk);
    const leafC = dark ? 0x1e5a2e : 0x2f9e44;
    const n = 7;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rng.next() * 0.4;
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.85, 5.2, 4), mat(leafC));
      leaf.scale.set(1, 1, 0.28);
      leaf.position.set(Math.cos(a) * 1.9, height + 0.4, Math.sin(a) * 1.9);
      leaf.rotation.z = -Math.cos(a) * 1.15;
      leaf.rotation.x = Math.sin(a) * 1.15;
      g.add(leaf);
    }
    for (let k = 0; k < 3; k++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), mat(0x6a4a22));
      nut.position.set(Math.cos(k * 2.1) * 0.5, height - 0.3, Math.sin(k * 2.1) * 0.5);
      g.add(nut);
    }
    group.add(g);
    return g;
  }

  // Power pole + sagging wire run between pole tops.
  function powerPole(x, z, h) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 6), mat(0x5a4632));
    pole.position.y = h / 2;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.18), mat(0x5a4632));
    arm.position.y = h - 0.4;
    g.add(arm);
    for (const s of [-1.1, 1.1]) {
      const ins = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), mat(0x222222));
      ins.position.set(s, h - 0.25, 0);
      g.add(ins);
    }
    group.add(g);
    return { x, z, top: h - 0.3 };
  }
  function sagWire(a, b) {
    const mid = new THREE.Vector3((a.x + b.x) / 2, Math.min(a.top, b.top) - 1.3, (a.z + b.z) / 2);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(a.x, a.top, a.z),
      mid,
      new THREE.Vector3(b.x, b.top, b.z),
    );
    const wire = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 12, 0.05, 5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }),
    );
    group.add(wire);
  }
  function wireRun(poles) {
    for (let i = 0; i + 1 < poles.length; i++) sagWire(poles[i], poles[i + 1]);
  }

  function billboard(x, z, rotY, text, bgc, fgc) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    for (const s of [-3.5, 3.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 7, 6), mat(0x6a6a6a));
      post.position.set(s, 3.5, 0);
      g.add(post);
    }
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(11, 5.5, 0.35),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(text, bgc, fgc) }),
    );
    face.position.set(0, 9.5, 0);
    g.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(11, 5.5, 0.2), mat(0x8a8f98));
    back.position.set(0, 9.5, -0.25);
    g.add(back);
    group.add(g);
    return g;
  }

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
      // r6e: keep the city alley + its view corridor clear (the SA
      // neighbourhood is hand-placed there), and keep the freeway
      // overpass strip clear so no tower pokes through its deck.
      if (bx > 0 && bx < 52 && bz > -135 && bz < 44) continue;
      if (bx > -72 && bx < 132 && bz > -68 && bz < -52) continue;
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

  // --- SA neighbourhood: the city shot's view ---------------------------
  // Dirt alley between tall brick walls (x = 20 / 28, z = -40..34), the
  // player walks it from behind. Past the mouth: SA houses with pitched
  // roofs, the curved freeway overpass, billboards, power poles with
  // sagging wires, palms, and the downtown skyline in the haze.
  const dirtTex = makeSpeckleTexture('#a08050', ['#8a6a42', '#b89060', '#7a5a38', '#c8a878'], 256, 500, 2);
  dirtTex.repeat.set(2, 10);
  const dirtMat = new THREE.MeshLambertMaterial({ map: dirtTex });
  const alleyDirt = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 76), dirtMat);
  alleyDirt.rotation.x = -Math.PI / 2;
  alleyDirt.position.set(24, 0.06, -3);
  group.add(alleyDirt);
  // Right wall: tall brick (6.5 m) with a stone foundation; left wall:
  // lower brick (4.5 m) with stone foundation — the reference's uneven
  // alley walls.
  const wallR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.5, 76), brickMat);
  wallR.position.set(28.4, 3.25, -3);
  wallR.castShadow = true;
  group.add(wallR);
  const wallRBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 76), stoneMat);
  wallRBase.position.set(28.4, 0.7, -3);
  group.add(wallRBase);
  const wallRCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 76), mat(0xd8c8a8));
  wallRCap.position.set(28.4, 6.6, -3);
  group.add(wallRCap);
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.5, 76), brickMat);
  wallL.position.set(19.6, 2.25, -3);
  wallL.castShadow = true;
  group.add(wallL);
  const wallLBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 76), stoneMat);
  wallLBase.position.set(19.6, 0.7, -3);
  group.add(wallLBase);
  const wallLCap = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 76), mat(0xd8c8a8));
  wallLCap.position.set(19.6, 4.6, -3);
  group.add(wallLCap);
  // Faded painted street sign on the right wall, facing south down the
  // alley toward the camera, so it reads from the shot's viewpoint.
  const groveTex = makeBillboardTexture('GROVE ST', '#3a5a3a', '#f2e6c8');
  const groveSign = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ map: groveTex, transparent: true }));
  groveSign.position.set(27.9, 4.2, -18);
  groveSign.rotation.y = 0;
  group.add(groveSign);
  // SA houses flanking the alley (rooftops in the foreground, ref 1) and
  // across the street past the mouth. Fronts face the alley / camera.
  const saHouses = [
    [8, 12, Math.PI / 2, 0xf2e6c8, 0x6a3a2a, 11, 5, 9],
    [41, 10, -Math.PI / 2, 0xe6d8c8, 0x4a4a55, 10, 5, 8],
    [6, -22, Math.PI / 2, 0xd8e6f2, 0x7a4a2a, 9, 4.5, 8],
    [43, -26, -Math.PI / 2, 0xf2e6c8, 0x6a3a2a, 12, 5.5, 9],
    [-22, -88, 0, 0xf2e6c8, 0x6a3a2a, 11, 5, 9],
    [62, -88, 0, 0xe6d8c8, 0x4a4a55, 10, 5, 8],
    [8, -112, 0, 0xd8e6f2, 0x7a4a2a, 12, 5, 9],
    [48, -116, 0, 0xf2e6c8, 0x3a5a6a, 9, 4.5, 8],
  ];
  for (const [hx, hz, rot, wc, rc, w, h, d] of saHouses) {
    const house = saHouse(w, h, d, wc, rc, 2.4);
    house.position.set(hx, 0, hz);
    house.rotation.y = rot;
    group.add(house);
    state.buildings.push({ x: hx, z: hz, w, d, h: h + 2, color: wc });
  }
  // Curved concrete freeway overpass across the view: deck + white arch
  // + pillars, the reference's centrepiece.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(200, 1.6, 11), mat(0xb8b8b0));
  deck.position.set(30, 9.5, -60);
  deck.castShadow = true;
  group.add(deck);
  for (const bz of [-65.2, -54.8]) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(200, 1.0, 0.5), mat(0xd8d8d8));
    barrier.position.set(30, 10.8, bz);
    group.add(barrier);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(26, 1.4, 8, 24, Math.PI), mat(0xf2f2f2));
  arch.position.set(30, 10.2, -60);
  group.add(arch);
  const arch2 = new THREE.Mesh(new THREE.TorusGeometry(19, 1.1, 8, 24, Math.PI), mat(0xf2f2f2));
  arch2.position.set(-38, 10.2, -60);
  group.add(arch2);
  for (const px of [-40, 30, 100]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9.5, 2.2), mat(0x9a9a92));
    pillar.position.set(px, 4.75, -60);
    group.add(pillar);
  }
  // Billboards on poles past the overpass, facing the alley.
  billboard(-32, -74, 0, 'SOLMAR BAY', '#1d3557', '#ffc300');
  billboard(72, -74, 0, 'BAY FM', '#e63946', '#ffffff');
  billboard(108, -44, -Math.PI / 2, 'TICO TACOS', '#2a9d8f', '#ffffff');
  // Power poles + sagging wires along the street past the alley mouth.
  const cityPoles = [];
  for (let x = -40; x <= 80; x += 30) cityPoles.push(powerPole(x, -48, 7.5));
  wireRun(cityPoles);
  // Downtown skyline far to the north, dissolving into the orange haze.
  const skyline = [
    [-100, -205, 16, 58, 0x8a9ab0], [-55, -215, 20, 78, 0x9a8a7a], [-10, -200, 14, 48, 0x7a8a9a],
    [35, -220, 22, 85, 0x6a9a6a], [80, -205, 16, 62, 0xa85a5a], [125, -215, 18, 70, 0x8a9ab0],
  ];
  for (const [sx, sz, sw, sh, sc] of skyline) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sw), mat(sc));
    tower.position.set(sx, sh / 2, sz);
    group.add(tower);
    state.buildings.push({ x: sx, z: sz, w: sw, d: sw, h: sh, color: sc });
  }
  // Palms framing the neighbourhood — tall, thin, some silhouetted dark.
  saPalm(-2, -30, 11, true);
  saPalm(48, -34, 10, false);
  saPalm(-14, -70, 12, true);
  saPalm(58, -66, 11, false);
  saPalm(88, -70, 10, true);
  saPalm(-48, -44, 9, false);

  for (let i = 0; i < 90; i++) {
    const px = rng.chance(0.55) ? rng.range(-310, -292) : rng.range(-290, 330);
    const pz = rng.range(-250, 250);
    if (Math.abs(px % 60) < 8 || Math.abs(pz % 60) < 8) continue;
    // Keep the alley corridor and the SA house plots free of random palms.
    if (px > 12 && px < 36 && pz > -50 && pz < 40) continue;
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
  // r6e beach set dressing: two pitched-roof beach cottages at the frame
  // edges (stucco, shingle roofs, white-framed sunset glass), a wooden
  // boardwalk spur across the sand, and a lifeguard tower. All face the
  // sea / the camera, which looks west from (-332, 85).
  const cottage1 = saHouse(9, 4.5, 7, 0xf2e6c8, 0x6a3a2a, 2.4);
  cottage1.position.set(-347, 0, 62);
  cottage1.rotation.y = Math.PI / 2;
  group.add(cottage1);
  const cottage2 = saHouse(10, 5, 8, 0xe6d8c8, 0x4a4a55, 2.6);
  cottage2.position.set(-347, 0, 108);
  cottage2.rotation.y = Math.PI / 2;
  group.add(cottage2);
  state.buildings.push({ x: -349, z: 50, w: 7, d: 9, h: 7, color: 0xf2e6c8 });
  state.buildings.push({ x: -349, z: 120, w: 8, d: 10, h: 8, color: 0xe6d8c8 });
  // Boardwalk planks across the sand south of the player.
  for (let i = 0; i < 14; i++) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 3.6), mat(i % 2 ? 0x8a6a42 : 0x9a7a52));
    plank.position.set(-340 + i * 1.8, 0.12, 76);
    group.add(plank);
  }
  // Lifeguard tower: four legs, cabin, roof, red cross flag.
  const lg = new THREE.Group();
  lg.position.set(-341, 0, 102);
  group.add(lg);
  for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 3.4, 6), mat(0xd8d8d8));
    leg.position.set(lx, 1.7, lz);
    lg.add(leg);
  }
  const lgCabin = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.0), mat(0xffffff));
  lgCabin.position.set(0, 4.4, 0);
  lg.add(lgCabin);
  const lgRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 4), mat(0xe63946));
  lgRoof.rotation.y = Math.PI / 4;
  lgRoof.position.set(0, 6.1, 0);
  lg.add(lgRoof);
  const lgGlass = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.9, 0.1), glassMat);
  lgGlass.position.set(0, 4.7, 1.55);
  lg.add(lgGlass);
  // Tall SA palms along the shore, silhouetted against the sunset sea.
  saPalm(-344, 38, 12, true);
  saPalm(-342, 138, 11, true);
  saPalm(-338, 66, 10, false);

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
  // instead of off the right edge behind the weapon HUD. r6e: rebuilt
  // with the SA kit — white-framed sunset windows, door, porch.
  const farmhouse = saHouse(10, 6, 8, 0xf2e6c8, 0xc0392b, 3.2);
  farmhouse.position.set(218, 0, 158);
  group.add(farmhouse);
  state.buildings.push({ x: 218, z: 158, w: 8, d: 10, h: 9, color: 0xf2e6c8 });
  // Red barn with white trim.
  box(9, 6, 7, 0xa93226, 200, 3, 152);
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4), mat(0x7b241c));
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.scale.set(7.5, 3, 6.2);
  barnRoof.position.set(200, 7.5, 152);
  group.add(barnRoof);
  box(3, 3.4, 0.2, 0xf2f2f2, 200, 1.7, 155.6);
  const barnWin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.14), glassMat);
  barnWin.position.set(200, 4.6, 155.6);
  group.add(barnWin);
  // Grain silo beside the barn, with a domed cap.
  const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 10, 12), mat(0xc8c8c8));
  silo.position.set(188, 5, 148);
  group.add(silo);
  const siloCap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9a9a9a));
  siloCap.position.set(188, 10, 148);
  group.add(siloCap);
  state.buildings.push({ x: 188, z: 148, w: 5, d: 5, h: 12, color: 0xc8c8c8 });
  // Fence posts along the field edge.
  for (let x = 185; x <= 260; x += 8) box(0.25, 1.1, 0.25, 0x8a6a42, x, 0.55, 190);
  box(78, 0.15, 0.15, 0x8a6a42, 222, 0.9, 190);
  // r6e: power poles with sagging wires along the country road, a low
  // brick garden wall by the dirt track, and palms at the farm gate.
  const farmPoles = [];
  for (let x = 150; x <= 330; x += 30) farmPoles.push(powerPole(x, 173.5, 7));
  wireRun(farmPoles);
  const farmWall = new THREE.Mesh(new THREE.BoxGeometry(24, 1.1, 0.6), brickMat);
  farmWall.position.set(232, 0.55, 170);
  group.add(farmWall);
  saPalm(206, 168, 10, false);
  saPalm(240, 168, 11, true);

  flat(140, 14, 0x2a2d33, 240, 0.07, 140);
  // Runway centreline dashes + edge lights, so the strip reads as a
  // runway from the chase camera and from the tarmac.
  for (let x = 178; x <= 302; x += 12) flat(6, 0.8, 0xf2f2f2, x, 0.09, 140);
  for (let x = 176; x <= 304; x += 16) {
    box(0.5, 0.5, 0.5, 0xffe9a0, x, 0.3, 132.5);
    box(0.5, 0.5, 0.5, 0xffe9a0, x, 0.3, 147.5);
  }
  // Control tower + windsock + hangars for the airfield. r6e: the two
  // parked planes are REMOVED (user: only one plane, the flying one).
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

  // Flying airliner for the airport shot (r6e rebuild): a REALISTIC
  // passenger jet on final approach — rounded nose with cockpit glass,
  // cheatline livery + window rows, swept tapered wings with winglets,
  // two under-wing engines with dark intakes, tall tail fin, stabilizers,
  // landing gear down (nose gear + two main bogies), nav lights. Built
  // once here, hidden by default; syncWorld shows it only while a shot
  // stages it (state.flyPlane), so normal gameplay never sees it.
  // Local +x is the nose; the shot stages it with rotation.y = PI so the
  // nose points at the camera.
  const flyPlane = new THREE.Group();
  const flyTilt = new THREE.Group();
  flyTilt.rotation.z = 0.06; // slight nose-up on final approach
  flyPlane.add(flyTilt);
  const jetWhite = new THREE.MeshPhongMaterial({ color: 0xf2f2f2, shininess: 70, specular: 0xaaaaaa });
  const jetTeal = new THREE.MeshLambertMaterial({ color: 0x0e7c86 });
  const jetRed = new THREE.MeshLambertMaterial({ color: 0xe63946 });
  const jetDark = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const flyFus = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 26, 16), jetWhite);
  flyFus.rotation.z = Math.PI / 2;
  flyTilt.add(flyFus);
  const flyNose = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 16), jetWhite);
  flyNose.rotation.z = -Math.PI / 2;
  flyNose.position.set(15.5, 0, 0);
  flyTilt.add(flyNose);
  const flyTailCone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 6, 16), jetWhite);
  flyTailCone.rotation.z = Math.PI / 2;
  flyTailCone.position.set(-16, 0, 0);
  flyTilt.add(flyTailCone);
  // Cockpit glass: dark band wrapping the nose.
  const cockpit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 4.0), jetDark);
  cockpit.position.set(12.6, 0.9, 0);
  cockpit.rotation.y = 0.12;
  flyTilt.add(cockpit);
  // Cheatline livery stripe along both flanks + window rows above it.
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 0.14), jetTeal);
    stripe.position.set(0, -0.4, s * 2.2);
    flyTilt.add(stripe);
    const stripe2 = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 0.14), jetRed);
    stripe2.position.set(0, 0.35, s * 2.2);
    flyTilt.add(stripe2);
    for (let wx = -10; wx <= 10; wx += 1.6) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.55, 0.12), jetDark);
      win.position.set(wx, 1.1, s * 2.18);
      flyTilt.add(win);
    }
  }
  // Swept tapered wings: inner + outer panels per side, winglets up.
  for (const s of [-1, 1]) {
    const inner = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 9), jetWhite);
    inner.position.set(1, -0.7, s * 6.5);
    inner.rotation.y = -s * 0.16;
    flyTilt.add(inner);
    const outer = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 9), jetWhite);
    outer.position.set(-0.5, -0.85, s * 14);
    outer.rotation.y = -s * 0.32;
    flyTilt.add(outer);
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.3), jetTeal);
    winglet.position.set(-1.6, 0.2, s * 18.2);
    winglet.rotation.y = -s * 0.32;
    flyTilt.add(winglet);
  }
  // Under-wing engines with dark intakes.
  for (const s of [-1, 1]) {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 4.6, 12), jetWhite);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(2, -2.4, s * 7.5);
    flyTilt.add(eng);
    const intake = new THREE.Mesh(new THREE.CircleGeometry(1.05, 12), jetDark);
    intake.position.set(4.35, -2.4, s * 7.5);
    intake.rotation.y = Math.PI / 2;
    flyTilt.add(intake);
  }
  // Tall tail fin (teal with red tip) + horizontal stabilizers.
  const flyFin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 5), jetTeal);
  flyFin.position.set(-14.5, 4.2, 0);
  flyFin.rotation.z = 0.18;
  flyTilt.add(flyFin);
  const flyFinTip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.6, 4.2), jetRed);
  flyFinTip.position.set(-15.2, 7.6, 0);
  flyFinTip.rotation.z = 0.18;
  flyTilt.add(flyFinTip);
  const flyStab = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.35, 12), jetWhite);
  flyStab.position.set(-14, 1.4, 0);
  flyTilt.add(flyStab);
  // Landing gear down: nose gear + two main bogies, struts + wheels.
  const gearMat = mat(0x22242a);
  function flyGear(x, z, bogie) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 2.2, 6), gearMat);
    strut.position.set(x, -3.1, z);
    flyTilt.add(strut);
    const n = bogie ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), gearMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x + (bogie ? (i - 0.5) * 1.1 : 0), -4.2, z);
      flyTilt.add(wheel);
    }
  }
  flyGear(10, 0, false);
  flyGear(-1, 5.5, true);
  flyGear(-1, -5.5, true);
  // Wingtip nav lights: red port, green starboard, white tail strobe.
  const flyNavL = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  flyNavL.position.set(-1, -0.6, 18.4);
  flyTilt.add(flyNavL);
  const flyNavR = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
  flyNavR.position.set(-1, -0.6, -18.4);
  flyTilt.add(flyNavR);
  const flyStrobe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  flyStrobe.position.set(-19, 0.5, 0);
  flyTilt.add(flyStrobe);
  flyPlane.visible = false;
  group.add(flyPlane);

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

  // Low sun ball over the bay (west) + halo, so the golden-hour shots
  // looking west — the beach — catch the sunset itself, not just orange fog.
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  sunDisc.position.set(-430, 48, 40);
  scene.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(22, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  sunHalo.position.set(-430, 48, 40);
  scene.add(sunHalo);

  // Two white birds in the orange sky (the reference has them).
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const [bx, by, bz] of [[-380, 90, 20], [-360, 110, 90], [-390, 75, 130], [-300, 100, -40]]) {
    const bird = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.6), birdMat);
      wing.position.set(s * 0.7, 0, 0);
      wing.rotation.x = s * 0.5;
      bird.add(wing);
    }
    bird.position.set(bx, by, bz);
    scene.add(bird);
    birds.push(bird);
  }

  const shopGroup = new THREE.Group();
  scene.add(shopGroup);

  return { scene, bg, sun, amb, hemi, ocean, oceanGeo, wheel, beam, lampHeads, windows: facades, clouds, birds, group, shopGroup, facades, flyPlane };
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
    world.scene.fog.near = 150;
    world.scene.fog.far = 700;
    world.bg.setHex(0x0e1a2e);
  } else if (golden) {
    world.sun.intensity = 1.5;
    world.sun.color.setHex(0xff8c42);
    world.sun.position.set(-200, 55, 60);
    world.amb.intensity = 0.7;
    world.amb.color.setHex(0xffb36b);
    world.hemi.intensity = 0.5;
    world.scene.fog.color.setHex(0xff9a5c);
    // r6e: closer, dustier haze at golden hour — the far skyline and the
    // overpass dissolve into orange, the way the SA reference does.
    world.scene.fog.near = 120;
    world.scene.fog.far = 650;
    world.bg.setHex(0xff7a3c);
  } else {
    world.sun.intensity = 1.7;
    world.sun.color.setHex(0xfff2d8);
    world.sun.position.set(-120, 180, 80);
    world.amb.intensity = 0.8;
    world.amb.color.setHex(0xffe8c8);
    world.hemi.intensity = 0.6;
    world.scene.fog.color.setHex(0xbfd8e8);
    world.scene.fog.near = 180;
    world.scene.fog.far = 900;
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
  for (const bird of world.birds || []) {
    bird.position.x += dt * 1.5;
    if (bird.position.x > -240) bird.position.x = -400;
  }
  for (const m of world.lampHeads) m.color.setHex(night ? 0xffe9a0 : 0x8a8f98);
  const glow = night ? 1 : golden ? 0.45 : 0.12;
  for (const m of world.windows) m.emissiveIntensity = glow;

  // Airport shot staging (r6c/r6e): a plane on final approach, gear down.
  // Only visible while a shot stages it (state.flyPlane); hidden otherwise.
  if (world.flyPlane) {
    const fp = state.flyPlane;
    if (fp) {
      world.flyPlane.visible = true;
      world.flyPlane.position.set(fp.x, fp.y, fp.z);
      world.flyPlane.rotation.y = fp.angle ?? 0;
    } else {
      world.flyPlane.visible = false;
    }
  }

  return dayFrac;
}
