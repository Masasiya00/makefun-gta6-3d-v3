// The city of Solmar Bay: 12 districts, a road grid, an ocean to the west, a
// beach, a harbour, an airfield, a fairground ferris wheel and a lighthouse.
// Buildings, palms and lamps are instanced meshes so the draw-call count stays
// low; every building also registers an axis-aligned collider the simulation
// uses. The sky, sun and lamps follow the in-game clock.
import { DISTRICTS, ROADS_X, ROADS_Z, ROAD_W, WORLD, PALETTE, SHOPS } from './config.js';

function mat(color, opts = {}) {
  const THREE = window.__THREE__;
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export function createWorld(THREE, rng) {
  window.__THREE__ = THREE;
  const group = new THREE.Group();
  const colliders = [];
  const anim = { ocean: null, wheel: null, beam: null, lamps: [], sun: null, hemi: null, skyMesh: null };
  const roadPoints = [];

  // --- Ground: grass base, sand beach strip, ocean plane to the west. ---
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3600, 2600), mat(PALETTE.grass));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); ground.receiveShadow = true;
  group.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(140, 2600), mat(PALETTE.sand));
  beach.rotation.x = -Math.PI / 2; beach.position.set(-1470, 0.05, 0); beach.receiveShadow = true;
  group.add(beach);
  const oceanGeo = new THREE.PlaneGeometry(500, 2600, 24, 48);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshLambertMaterial({ color: PALETTE.water, transparent: true, opacity: 0.92 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-1820, 0.1, 0);
  group.add(ocean);
  anim.ocean = ocean;

  // --- Sky dome and sun. ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4200, 16, 12),
    new THREE.MeshBasicMaterial({ color: PALETTE.skySunset, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  anim.skyMesh = sky;
  const sun = new THREE.DirectionalLight(PALETTE.sunSunset, 1.1);
  sun.position.set(-800, 500, 600);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -400; sun.shadow.camera.right = 400;
  sun.shadow.camera.top = 400; sun.shadow.camera.bottom = -400;
  sun.shadow.camera.far = 3000;
  group.add(sun);
  anim.sun = sun;
  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a5a3a, 0.75);
  group.add(hemi);
  anim.hemi = hemi;
  const nightAmbient = new THREE.AmbientLight(0x334466, 0.25);
  group.add(nightAmbient);
  const fog = new THREE.Fog(0xffc890, 500, 3200);

  // --- Roads and sidewalks. ---
  const roadMat = mat(PALETTE.road);
  const walkMat = mat(PALETTE.sidewalk);
  for (const x of ROADS_X) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, 2600), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.06, 0); r.receiveShadow = true; group.add(r);
    for (const z of [-1250, -750, -350, 50, 450, 850, 1250]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3, 90), walkMat);
      w.rotation.x = -Math.PI / 2; w.position.set(x + 8.5, 0.07, z); group.add(w);
    }
  }
  for (const z of ROADS_Z) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(3600, ROAD_W), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.06, z); r.receiveShadow = true; group.add(r);
  }
  // Diagonal avenues: two long thin road planes, rotated.
  for (const [x, z, ang] of [[-400, 0, 0.6], [800, 400, -0.5]]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(2600, ROAD_W), roadMat);
    r.rotation.x = -Math.PI / 2; r.rotation.z = ang; r.position.set(x, 0.06, z); group.add(r);
  }
  // Centre dashes, laid flat on the road.
  const dashGeo = new THREE.PlaneGeometry(0.6, 8);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 900);
  {
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    let i = 0;
    for (const x of ROADS_X) for (let z = -1250; z <= 1250 && i < 900; z += 20) {
      m.copy(rot); m.setPosition(x, 0.08, z); dashes.setMatrixAt(i, m); i += 1;
    }
    dashes.count = i;
  }
  group.add(dashes);

  // Road network points for traffic and pedestrians: every intersection.
  for (const x of ROADS_X) for (const z of ROADS_Z) roadPoints.push({ x, z });

  // --- Buildings: one instanced box, per-instance colour and height. ---
  const buildingSpots = [];
  for (let gx = 0; gx < ROADS_X.length - 1; gx += 1) {
    for (let gz = 0; gz < ROADS_Z.length - 1; gz += 1) {
      const x0 = ROADS_X[gx] + 14, x1 = ROADS_X[gx + 1] - 14;
      const z0 = ROADS_Z[gz] + 14, z1 = ROADS_Z[gz + 1] - 14;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const d = DISTRICTS.find((dd) => cx >= dd.x0 && cx < dd.x1 && cz >= dd.z0 && cz < dd.z1);
      const isDowntown = d && d.name === 'Downtown';
      const isBeach = d && d.name === 'Palm Beach';
      const n = isDowntown ? 6 : rng.int(2, 4);
      for (let k = 0; k < n; k += 1) {
        const bx = rng.range(x0 + 20, x1 - 20);
        const bz = rng.range(z0 + 20, z1 - 20);
        const w = rng.range(16, isDowntown ? 30 : 24);
        const dep = rng.range(16, 24);
        const h = isDowntown ? rng.range(40, 130) : isBeach ? rng.range(10, 22) : rng.range(8, 26);
        buildingSpots.push({ x: bx, z: bz, w, d: dep, h, district: d ? d.name : '' });
      }
    }
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  const bMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const buildings = new THREE.InstancedMesh(bGeo, bMat, buildingSpots.length);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    buildingSpots.forEach((b, i) => {
      p.set(b.x, b.h / 2, b.z); s.set(b.w, b.h, b.d); q.identity();
      m.compose(p, q, s); buildings.setMatrixAt(i, m);
      const base = b.district === 'Downtown' ? new THREE.Color().setHSL(0.6, 0.25, rng.range(0.35, 0.7))
        : b.district === 'Old Town' ? new THREE.Color().setHSL(rng.range(0.02, 0.12), 0.55, rng.range(0.5, 0.68))
        : new THREE.Color().setHSL(rng.next(), 0.25, rng.range(0.45, 0.65));
      c.copy(base); buildings.setColorAt(i, c);
      colliders.push({ x0: b.x - b.w / 2, z0: b.z - b.d / 2, x1: b.x + b.w / 2, z1: b.z + b.d / 2 });
    });
  }
  buildings.castShadow = true; buildings.receiveShadow = true;
  group.add(buildings);

  // Windows on downtown towers: small emissive planes, lit at night.
  const winGeo = new THREE.PlaneGeometry(3, 2);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a });
  const windows = new THREE.InstancedMesh(winGeo, winMat, 600);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (const b of buildingSpots) {
      if (b.district !== 'Downtown' || i >= 600) continue;
      for (let k = 0; k < 6 && i < 600; k += 1) {
        m.makeTranslation(b.x - b.w / 2 - 0.1, rng.range(6, b.h - 4), b.z + rng.range(-b.d / 2 + 2, b.d / 2 - 2));
        m.multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
        windows.setMatrixAt(i, m); i += 1;
      }
    }
    windows.count = i;
  }
  windows.visible = false;
  group.add(windows);
  anim.windows = windows;

  // --- Palm trees along the beach and parks; park trees inland. ---
  const palmTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 5), mat(0x7a5a34), 160);
  const palmCrown = new THREE.InstancedMesh(new THREE.ConeGeometry(3.2, 4, 6), mat(0x2a7a3a), 160);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (let k = 0; k < 160; k += 1) {
      const beachPalm = k < 90;
      const x = beachPalm ? rng.range(-1490, -1420) : rng.range(-1300, 1700);
      const z = beachPalm ? rng.range(-1250, 1250) : rng.range(-1250, 1250);
      if (!beachPalm && ROADS_X.some((rx) => Math.abs(x - rx) < 12)) continue;
      m.makeTranslation(x, 4.5, z); palmTrunk.setMatrixAt(i, m);
      m.makeTranslation(x, 10.5, z); palmCrown.setMatrixAt(i, m);
      i += 1;
    }
    palmTrunk.count = i; palmCrown.count = i;
  }
  palmTrunk.castShadow = true;
  group.add(palmTrunk); group.add(palmCrown);

  // --- Street lamps along the avenues. ---
  const lampPole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 5), mat(0x222831), 220);
  const lampHead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), 220);
  {
    const m = new THREE.Matrix4();
    let i = 0;
    for (const x of ROADS_X) {
      for (let z = -1200; z <= 1200; z += 200) {
        if (i >= 220) break;
        m.makeTranslation(x + 8, 3.5, z); lampPole.setMatrixAt(i, m);
        m.makeTranslation(x + 8, 7.1, z); lampHead.setMatrixAt(i, m);
        i += 1;
      }
    }
    lampPole.count = i; lampHead.count = i;
  }
  lampHead.visible = false;
  group.add(lampPole); group.add(lampHead);
  anim.lamps = lampHead;

  // --- District landmarks. ---
  // Lighthouse at Lighthouse Point with a rotating beam.
  const lh = new THREE.Group();
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 42, 10), mat(0xf2f2f2));
  tower.position.y = 21; tower.castShadow = true; lh.add(tower);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 6, 10), mat(0xd43d2a));
  band.position.y = 30; lh.add(band);
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lampRoom.position.y = 44; lh.add(lampRoom);
  const beamGeo = new THREE.ConeGeometry(6, 90, 12, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2; beam.position.set(45, 44, 0);
  const beamPivot = new THREE.Group(); beamPivot.add(beam); beamPivot.position.y = 0;
  lh.add(beamPivot);
  lh.position.set(1650, 0, 1050);
  group.add(lh);
  anim.beam = beamPivot;
  colliders.push({ x0: 1643, z0: 1043, x1: 1657, z1: 1057 });

  // Ferris wheel at the Fairground.
  const fw = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(26, 1.2, 6, 28), mat(0xe06a9a));
  rim.position.y = 32; fw.add(rim);
  for (let k = 0; k < 8; k += 1) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 52, 5), mat(0xf2f2f2));
    spoke.rotation.z = (k * Math.PI) / 8; spoke.position.y = 32; fw.add(spoke);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), mat(0xf2c94c));
    const a = (k * Math.PI) / 4;
    cab.position.set(Math.cos(a) * 26, 32 + Math.sin(a) * 26, 0); fw.add(cab);
  }
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 34, 6), mat(0x8a94a0));
  legL.position.set(-8, 16, 0); legL.rotation.z = 0.25; fw.add(legL);
  const legR = legL.clone(); legR.position.x = 8; legR.rotation.z = -0.25; fw.add(legR);
  fw.position.set(-600, 0, 1000);
  group.add(fw);
  anim.wheel = fw;
  colliders.push({ x0: -616, z0: 984, x1: -584, z1: 1016 });

  // Stadium bowl.
  const stadium = new THREE.Mesh(new THREE.CylinderGeometry(90, 100, 24, 20, 1, true), mat(0xd0a03c));
  stadium.position.set(1000, 12, 600); stadium.castShadow = true; group.add(stadium);
  colliders.push({ x0: 910, z0: 510, x1: 1090, z1: 690 });
  // Floodlight poles.
  for (const [fx, fz] of [[920, 520], [1080, 520], [920, 680], [1080, 680]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 40, 6), mat(0x222831));
    pole.position.set(fx, 20, fz); group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    head.position.set(fx, 41, fz); group.add(head);
  }

  // Dockside: containers and cranes.
  const contColors = [0xd43d2a, 0x2a7ac8, 0x2a8a4a, 0xf2c94c];
  for (let k = 0; k < 26; k += 1) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 3), mat(contColors[k % 4]));
    c.position.set(rng.range(-1380, -1040), 1.5 + (k % 3) * 3.1, rng.range(-160, 560));
    c.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
    c.castShadow = true; group.add(c);
    colliders.push({ x0: c.position.x - 6, z0: c.position.z - 2, x1: c.position.x + 6, z1: c.position.z + 2 });
  }
  for (const [cx, cz] of [[-1100, 0], [-1300, 400]]) {
    const crane = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.BoxGeometry(4, 50, 4), mat(0xf2c94c));
    mast.position.y = 25; crane.add(mast);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(50, 3, 3), mat(0xf2c94c));
    arm.position.set(20, 48, 0); crane.add(arm);
    crane.position.set(cx, 0, cz); group.add(crane);
    colliders.push({ x0: cx - 3, z0: cz - 3, x1: cx + 3, z1: cz + 3 });
  }

  // Marina yachts.
  for (let k = 0; k < 8; k += 1) {
    const y = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 4), mat(0xf2f2f2));
    hull.position.y = 1; y.add(hull);
    const cabM = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 3.4), mat(0x4fa8c8));
    cabM.position.set(-1, 3.4, 0); y.add(cabM);
    y.position.set(1500 + k * 18, 0, -1150 + (k % 2) * 40);
    y.rotation.y = rng.range(-0.3, 0.3);
    group.add(y);
  }
  // Airfield planes.
  for (let k = 0; k < 3; k += 1) {
    const p = new THREE.Group();
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 26, 8), mat(0xe8e8e8));
    fus.rotation.x = Math.PI / 2; p.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 24), mat(0x4fa8c8));
    p.add(wing);
    p.position.set(-1200 + k * 60, 2, 1100 - k * 40);
    p.rotation.y = 0.4;
    group.add(p);
  }
  // Runway strip.
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(60, 500), mat(0x3a3f46));
  runway.rotation.x = -Math.PI / 2; runway.position.set(-1200, 0.07, 1000); group.add(runway);

  // Shop buildings: a small coloured front with a sign box at each shop door.
  for (const s of SHOPS) {
    const front = new THREE.Mesh(new THREE.BoxGeometry(22, 9, 14), mat(0xd8cfc0));
    front.position.set(s.x, 4.5, s.z); front.castShadow = true; group.add(front);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(20, 2.4, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(s.color) }));
    sign.position.set(s.x, 9.5, s.z + 7.2); group.add(sign);
    colliders.push({ x0: s.x - 11, z0: s.z - 7, x1: s.x + 11, z1: s.z + 7 });
  }

  // Clouds: a few flat white blobs drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, fog: false });
  const clouds = [];
  for (let k = 0; k < 10; k += 1) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rng.range(18, 34), 8, 6), cloudMat);
      puff.position.set(j * 22 - 22, rng.range(-2, 2), rng.range(-6, 6));
      puff.scale.y = 0.45; cl.add(puff);
    }
    cl.position.set(rng.range(-1600, 1600), rng.range(220, 320), rng.range(-1200, 1200));
    group.add(cl); clouds.push(cl);
  }
  anim.clouds = clouds;

  // --- Time of day. ---
  function setTimeOfDay(hours) {
    const t = ((hours % 24) + 24) % 24;
    const dayF = t >= 6 && t < 18 ? Math.sin(((t - 6) / 12) * Math.PI) : 0;
    const sunsetF = t >= 16 && t < 19 ? 1 - Math.abs(t - 17.5) / 1.5 : 0;
    const night = t >= 19 || t < 6;
    const skyColor = night ? PALETTE.skyNight : sunsetF > 0.4 ? PALETTE.skySunset : PALETTE.skyDay;
    anim.skyMesh.material.color.setHex(skyColor);
    fog.color.setHex(skyColor);
    const sunCol = night ? PALETTE.sunNight : sunsetF > 0.4 ? PALETTE.sunSunset : PALETTE.sunDay;
    anim.sun.color.setHex(sunCol);
    anim.sun.intensity = night ? 0.25 : 0.7 + dayF * 0.5;
    anim.hemi.intensity = night ? 0.25 : 0.6 + dayF * 0.3;
    const ang = ((t - 6) / 12) * Math.PI;
    anim.sun.position.set(Math.cos(ang) * -1400, Math.max(120, Math.sin(ang) * 900), 500);
    anim.lamps.visible = night;
    anim.windows.visible = night;
    return { night, sunset: sunsetF > 0.4 };
  }

  function update(dt, time) {
    // Ocean swell.
    const pos = anim.ocean.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i); const y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.05 + time * 1.2) * 0.6 + Math.cos(y * 0.04 + time * 0.9) * 0.6);
    }
    pos.needsUpdate = true;
    anim.wheel.rotation.z += dt * 0.05;
    anim.beam.rotation.y += dt * 0.5;
    for (const c of anim.clouds) c.position.x += dt * 2;
  }

  function districtAt(x, z) {
    for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
    return 'Solmar Bay';
  }

  // Spatial hash over the colliders so collision checks stay cheap even
  // with hundreds of buildings: only the colliders in nearby cells are read.
  const grid = new Map();
  const CELL = 50;
  for (const c of colliders) {
    const x0 = Math.floor(c.x0 / CELL), x1 = Math.floor(c.x1 / CELL);
    const z0 = Math.floor(c.z0 / CELL), z1 = Math.floor(c.z1 / CELL);
    for (let cx = x0; cx <= x1; cx += 1) for (let cz = z0; cz <= z1; cz += 1) {
      const k = cx + ',' + cz;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
  }
  function colliderAt(x, z) {
    const list = grid.get(Math.floor(x / CELL) + ',' + Math.floor(z / CELL));
    if (!list) return null;
    for (const c of list) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return c;
    return null;
  }

  function collideCircle(x, z, r) {
    const cx0 = Math.floor((x - r) / CELL), cx1 = Math.floor((x + r) / CELL);
    const cz0 = Math.floor((z - r) / CELL), cz1 = Math.floor((z + r) / CELL);
    for (let cx = cx0; cx <= cx1; cx += 1) for (let cz = cz0; cz <= cz1; cz += 1) {
      const list = grid.get(cx + ',' + cz);
      if (!list) continue;
      for (const c of list) {
        const nx = Math.max(c.x0, Math.min(x, c.x1));
        const nz = Math.max(c.z0, Math.min(z, c.z1));
        const dx = x - nx; const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 < 1e-9) {
            // Centre inside the box: push out through the nearest face.
            const left = x - c.x0; const right = c.x1 - x;
            const top = z - c.z0; const bottom = c.z1 - z;
            const m = Math.min(left, right, top, bottom);
            if (m === left) return { x: c.x0 - r, z, hit: true, px: -1, pz: 0 };
            if (m === right) return { x: c.x1 + r, z, hit: true, px: 1, pz: 0 };
            if (m === top) return { x, z: c.z0 - r, hit: true, px: 0, pz: -1 };
            return { x, z: c.z1 + r, hit: true, px: 0, pz: 1 };
          }
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          return { x: x + dx * push, z: z + dz * push, hit: true, px: dx / d, pz: dz / d };
        }
      }
    }
    return { x, z, hit: false };
  }

  return {
    group, colliders, roadPoints, anim, fog,
    setTimeOfDay, update, districtAt, collideCircle, colliderAt,
    clampToWorld(x, z) {
      return {
        x: Math.max(WORLD.minX + 10, Math.min(WORLD.maxX - 10, x)),
        z: Math.max(WORLD.minZ + 10, Math.min(WORLD.maxZ - 10, z)),
      };
    },
  };
}
