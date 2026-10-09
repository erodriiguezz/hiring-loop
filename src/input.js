// One action layer for keyboard and touch. Held actions: left, right, jump.
// One-shot actions are queued: restart, pause, confirm, up, down, mute, any.
const BIND = {
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
  Space: "jump", ArrowUp: "jump", KeyW: "jump", KeyZ: "jump",
};
const ONE_SHOT = {
  KeyR: "restart", KeyP: "pause", Escape: "pause", KeyM: "mute",
  Enter: "confirm", Space: "confirm", ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
};
const NO_SCROLL = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

export function createInput(touch) {
  const held = { left: false, right: false, jump: false };
  const queue = [];
  let jumpLatch = false; // a tap shorter than one physics step still jumps
  const onKeyboard = new Set();

  addEventListener("keydown", (e) => {
    if (NO_SCROLL.has(e.code)) e.preventDefault();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const b = BIND[e.code];
    if (b) { if (b === "jump" && !onKeyboard.has(e.code)) jumpLatch = true; onKeyboard.add(e.code); }
    if (!e.repeat) {
      if (ONE_SHOT[e.code]) queue.push(ONE_SHOT[e.code]);
      queue.push("any");
    }
    touch.active = false; // keyboard player: hide the on-screen buttons
  });
  addEventListener("keyup", (e) => onKeyboard.delete(e.code));
  addEventListener("blur", () => onKeyboard.clear());

  function keyHeld(action) {
    for (const code of onKeyboard) if (BIND[code] === action) return true;
    return false;
  }

  return {
    // Snapshot for one physics step.
    sample() {
      held.left = keyHeld("left") || touch.held.left;
      held.right = keyHeld("right") || touch.held.right;
      held.jump = keyHeld("jump") || touch.held.jump || jumpLatch || touch.consumeJumpTap();
      jumpLatch = false;
      return held;
    },
    push(action) { queue.push(action); },
    drain() { return queue.splice(0); },
  };
}
