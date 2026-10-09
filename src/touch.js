// On-screen controls for phones: a left/right pad in the left gutter, JUMP in the right gutter,
// pause and restart up top. Multi-touch through pointer events; each finger tracks its own button.
import { TOUCH, COLORS as C } from "./config.js";
import { FONT } from "./render.js";

export function createTouch(canvas, { onTap, onAction }) {
  const t = {
    active: matchMedia("(pointer: coarse)").matches,
    held: { left: false, right: false, jump: false },
    zones: null, // set by layout(), CSS px
    reversed: false,
    enabled: false, // only while playing
  };
  const fingers = new Map(); // pointerId -> { zone, x }
  let jumpTap = false;

  t.layout = (w, h, gutter) => {
    const top = h * TOUCH.TOP_FRAC;
    t.zones = {
      pad: { x: 0, y: top, w: gutter, h: h - top },
      jump: { x: w - gutter, y: top, w: gutter, h: h - top },
      pause: { x: gutter / 2 - TOUCH.SMALL / 2, y: 12, w: TOUCH.SMALL, h: TOUCH.SMALL },
      restart: { x: w - gutter / 2 - TOUCH.SMALL / 2, y: 12, w: TOUCH.SMALL, h: TOUCH.SMALL },
    };
  };

  const inside = (z, x, y) => z && x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
  function hit(x, y) {
    if (!t.active || !t.enabled || !t.zones) return null;
    for (const k of ["pause", "restart", "pad", "jump"]) if (inside(t.zones[k], x, y)) return k;
    return null;
  }

  function recompute() {
    t.held.left = t.held.right = t.held.jump = false;
    for (const f of fingers.values()) {
      if (f.zone === "jump") t.held.jump = true;
      else if (f.zone === "pad") {
        const mid = t.zones.pad.x + t.zones.pad.w / 2;
        if (f.x < mid) t.held.left = true; else t.held.right = true;
      }
    }
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (e.pointerType === "touch" || e.pointerType === "pen") t.active = true;
    const [x, y] = pos(e);
    const zone = hit(x, y);
    if (zone === "pause" || zone === "restart") { onAction(zone); return; }
    if (zone === "pad" || zone === "jump") {
      fingers.set(e.pointerId, { zone, x });
      if (zone === "jump") jumpTap = true;
      canvas.setPointerCapture?.(e.pointerId);
      recompute();
      return;
    }
    onTap(x, y);
  });
  canvas.addEventListener("pointermove", (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    f.x = pos(e)[0];
    recompute();
  });
  const release = (e) => { if (fingers.delete(e.pointerId)) recompute(); };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  t.consumeJumpTap = () => { const j = jumpTap; jumpTap = false; return j; };
  t.reset = () => { fingers.clear(); recompute(); jumpTap = false; };

  t.draw = (ctx, dpr) => {
    if (!t.active || !t.enabled || !t.zones) return;
    const z = t.zones;
    ctx.save();
    ctx.scale(dpr, dpr);
    const half = z.pad.w / 2;
    const l = t.reversed ? "▶" : "◀", r = t.reversed ? "◀" : "▶";
    pad(ctx, z.pad.x + 6, z.pad.y + 6, half - 9, z.pad.h - 18, l, t.held.left, t.reversed);
    pad(ctx, z.pad.x + half + 3, z.pad.y + 6, half - 9, z.pad.h - 18, r, t.held.right, t.reversed);
    pad(ctx, z.jump.x + 6, z.jump.y + 6, z.jump.w - 12, z.jump.h - 18, "JUMP", t.held.jump, false);
    pad(ctx, z.pause.x, z.pause.y, z.pause.w, z.pause.h, "II", false, false);
    pad(ctx, z.restart.x, z.restart.y, z.restart.w, z.restart.h, "R", false, false);
    ctx.restore();
  };

  return t;
}

function pad(ctx, x, y, w, h, label, on, warn) {
  ctx.fillStyle = on ? "rgba(138,240,198,0.35)" : "rgba(234,242,248,0.08)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = warn ? C.danger : on ? C.ecto : "rgba(234,242,248,0.25)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.fillStyle = on ? C.ecto : "rgba(234,242,248,0.7)";
  ctx.font = `bold ${Math.min(28, Math.max(14, w / 3))}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2);
}
