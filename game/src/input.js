// Keyboard and mouse input for Solmar Bay 3D.
export function createInput() {
  const input = {
    keys: {}, pressed: {}, mouseX: 0, mouseY: 0, mouseDown: false, mouseClicked: false,
    lookDX: 0, lookDY: 0, anyKey: false,
  };
  const down = (e) => {
    input.keys[e.code] = true; input.pressed[e.code] = true; input.anyKey = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => { input.keys[e.code] = false; };
  const move = (e) => {
    input.mouseX = e.clientX; input.mouseY = e.clientY;
    input.lookDX += e.movementX || 0; input.lookDY += e.movementY || 0;
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('mousemove', move);
  window.addEventListener('mousedown', (e) => { input.mouseDown = true; input.mouseClicked = true; });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('blur', () => { input.keys = {}; });
  return input;
}

export function wasPressed(input, code) {
  if (input.pressed[code]) { input.pressed[code] = false; return true; }
  return false;
}

export function endFrame(input) {
  input.pressed = {};
  input.mouseClicked = false;
  input.lookDX = 0; input.lookDY = 0;
}

export function axis(input, neg, pos) {
  return (input.keys[pos] ? 1 : 0) - (input.keys[neg] ? 1 : 0);
}
