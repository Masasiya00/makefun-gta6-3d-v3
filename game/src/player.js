// Mara, the player character on foot: a low-poly person with a walk/run
// animation (swinging arms and legs), jump, punch, and a simple aim pose.
// The mesh is a group of boxes; the simulation moves the state, the renderer
// only reads it.
export function createPlayer(THREE) {
  const g = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x4fa8c8 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3040 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const parts = {};
  const add = (name, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.castShadow = true;
    g.add(m); parts[name] = m; return m;
  };
  add('torso', 0.62, 0.75, 0.34, shirt, 0, 1.15, 0);
  add('head', 0.42, 0.42, 0.4, skin, 0, 1.78, 0);
  add('hair', 0.44, 0.16, 0.42, hair, 0, 2.0, 0);
  add('armL', 0.16, 0.68, 0.16, shirt, -0.4, 1.15, 0);
  add('armR', 0.16, 0.68, 0.16, shirt, 0.4, 1.15, 0);
  add('legL', 0.2, 0.72, 0.2, pants, -0.16, 0.42, 0);
  add('legR', 0.2, 0.72, 0.2, pants, 0.16, 0.42, 0);
  // A simple gun held in the right hand when armed.
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.4, 1.05, 0.25); gun.visible = false;
  g.add(gun); parts.gun = gun;
  return {
    group: g, parts,
    x: 0, z: 0, y: 0, heading: 0, vy: 0, grounded: true,
    walkPhase: 0, moving: false, speed: 0, punching: 0, armed: false,
    shirtColor: 0x4fa8c8,
    setShirt(colorHex) {
      this.shirtColor = colorHex;
      parts.torso.material = new THREE.MeshLambertMaterial({ color: colorHex });
      parts.armL.material = parts.torso.material;
      parts.armR.material = parts.torso.material;
    },
  };
}

// One fixed-step update for on-foot movement. `input` is {x:-1..1, y:-1..1,
// jump, sprint, lookDX}. Camera yaw steers the movement direction.
export function stepPlayer(p, input, camYaw, dt, world) {
  const runSpeed = input.sprint ? 9 : 5;
  const mx = input.x; const mz = input.y;
  const moving = mx !== 0 || mz !== 0;
  p.moving = moving;
  if (moving) {
    // Move relative to the camera yaw.
    const sin = Math.sin(camYaw); const cos = Math.cos(camYaw);
    const dx = (mx * cos - mz * sin);
    const dz = (mx * sin - mz * cos);
    const len = Math.hypot(dx, dz) || 1;
    const nx = p.x + (dx / len) * runSpeed * dt;
    const nz = p.z + (dz / len) * runSpeed * dt;
    const col = world.collideCircle(nx, nz, 0.6);
    const cl = world.clampToWorld(col.x, col.z);
    p.x = cl.x; p.z = cl.z;
    p.heading = Math.atan2(dx, dz);
    p.speed = runSpeed;
    p.walkPhase += dt * runSpeed * 1.6;
  } else {
    p.speed = 0;
  }
  if (input.jump && p.grounded) { p.vy = 7; p.grounded = false; }
  if (!p.grounded) {
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
  }
  if (p.punching > 0) p.punching -= dt;
}

export function syncPlayerMesh(p) {
  p.group.position.set(p.x, p.y, p.z);
  p.group.rotation.y = p.heading;
  const swing = p.moving ? Math.sin(p.walkPhase) * 0.7 : 0;
  p.parts.legL.rotation.x = swing;
  p.parts.legR.rotation.x = -swing;
  p.parts.armL.rotation.x = -swing * 0.8;
  p.parts.armR.rotation.x = p.punching > 0 ? -1.6 : swing * 0.8;
  p.parts.gun.visible = p.armed;
  if (p.armed) p.parts.armR.rotation.x = -1.2;
}
