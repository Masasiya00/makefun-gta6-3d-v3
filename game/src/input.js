// Keyboard + mouse input. Keys are polled by the simulation; one-shot actions
// (press E, click to shoot) are drained each step so nothing is missed or
// repeated. Pointer lock is requested on canvas click for mouse look.
export const ACTION = {
  ENTER: 1, JUMP: 2, PUNCH: 4, SHOOT: 8, PAUSE: 16, CONFIRM: 32,
  RADIO: 64, MUTE: 128, WHEEL: 256, INTERACT: 512,
};

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let lookDX = 0;
  let lookDY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function code(e) { return e.code; }

  window.addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true; mouseClicked = true;
    if (canvas.requestPointerLock) canvas.requestPointerLock();
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      lookDX += e.movementX; lookDY += e.movementY;
    }
  });
  // Touch fallback: drag on the canvas steers the camera.
  let lastTouch = null;
  canvas.addEventListener('touchstart', (e) => { lastTouch = e.touches[0]; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (lastTouch) { lookDX += (t.clientX - lastTouch.clientX) * 2; lookDY += (t.clientY - lastTouch.clientY) * 2; }
    lastTouch = t;
  }, { passive: true });

  return {
    axis() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
    down(codeName) { return keys.has(codeName); },
    takeLook() { const d = { dx: lookDX, dy: lookDY }; lookDX = 0; lookDY = 0; return d; },
    takeMouseClick() { const c = mouseClicked; mouseClicked = false; return c; },
    mouseHeld() { return mouseDown; },
    takeActions() {
      let a = 0;
      if (pressed.has('KeyE')) a |= ACTION.ENTER | ACTION.INTERACT;
      if (pressed.has('Space')) a |= ACTION.JUMP;
      if (pressed.has('KeyF')) a |= ACTION.PUNCH;
      if (pressed.has('KeyP') || pressed.has('Escape')) a |= ACTION.PAUSE;
      if (pressed.has('Enter')) a |= ACTION.CONFIRM;
      if (pressed.has('KeyR')) a |= ACTION.RADIO;
      if (pressed.has('KeyM')) a |= ACTION.MUTE;
      if (pressed.has('Tab')) a |= ACTION.WHEEL;
      if (mouseClicked) a |= ACTION.SHOOT;
      pressed.clear();
      return a;
    },
    // Test hooks: the playtest drives the game through these.
    setKey(codeName, on) { if (on) keys.add(codeName); else keys.delete(codeName); },
    press(codeName) { pressed.add(codeName); keys.add(codeName); },
    clearKeys() { keys.clear(); pressed.clear(); },
  };
}
