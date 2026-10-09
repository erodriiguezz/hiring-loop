// Player movement and AABB collision. Browser-free so tools/verify-levels.mjs can run it in Node.
import { TILE, PHYS } from "./config.js";

export function makePlayer(x, y) {
  return {
    x, y, w: PHYS.W, h: PHYS.H,
    vx: 0, vy: 0,
    face: 1,
    gdir: 1, // 1 = gravity down, -1 = flipped
    onGround: false,
    coyote: 0,
    buffer: 0,
    jumping: false,
    prevJump: false,
  };
}

const approach = (v, target, d) => (v < target ? Math.min(v + d, target) : Math.max(v - d, target));

export const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// world.solid(tx, ty) answers for tiles; world.rects holds moving solid boxes.
const boxes = [];
const pool = [];
function gatherBoxes(p, world) {
  boxes.length = 0;
  let n = 0;
  const x0 = Math.floor(p.x / TILE) - 1, x1 = Math.floor((p.x + p.w) / TILE) + 1;
  const y0 = Math.floor(p.y / TILE) - 1, y1 = Math.floor((p.y + p.h) / TILE) + 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!world.solid(tx, ty)) continue;
      const b = pool[n] || (pool[n] = { x: 0, y: 0, w: TILE, h: TILE });
      b.x = tx * TILE; b.y = ty * TILE;
      boxes.push(b); n++;
    }
  }
  for (const r of world.rects) if (r.solid) boxes.push(r);
  return boxes;
}

// inp: { left, right, jump } as held booleans. Returns flags for sound and effects.
export function stepPlayer(p, inp, world, dt) {
  let dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (world.reversed) dir = -dir;

  if (dir) {
    p.face = dir;
    p.vx = approach(p.vx, dir * PHYS.RUN, (p.onGround ? PHYS.ACCEL : PHYS.AIR_ACCEL) * dt);
  } else {
    p.vx = approach(p.vx, 0, (p.onGround ? PHYS.FRICTION : PHYS.AIR_FRICTION) * dt);
  }

  const pressed = inp.jump && !p.prevJump;
  p.prevJump = inp.jump;
  p.buffer = pressed ? PHYS.BUFFER : Math.max(0, p.buffer - dt);
  p.coyote = p.onGround ? PHYS.COYOTE : Math.max(0, p.coyote - dt);

  let jumped = false;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -PHYS.JUMP * p.gdir;
    p.buffer = 0; p.coyote = 0;
    p.onGround = false; p.jumping = true;
    jumped = true;
  }
  const rising = p.vy * p.gdir < 0;
  if (p.jumping && !inp.jump && rising) { p.vy *= PHYS.JUMP_CUT; p.jumping = false; }
  if (!rising) p.jumping = false;

  p.vy += PHYS.GRAVITY * p.gdir * dt;
  if (p.vy > PHYS.MAX_FALL) p.vy = PHYS.MAX_FALL;
  if (p.vy < -PHYS.MAX_FALL) p.vy = -PHYS.MAX_FALL;

  // X axis
  p.x += p.vx * dt;
  for (const b of gatherBoxes(p, world)) {
    if (!overlaps(p, b)) continue;
    if (p.vx > 0) p.x = b.x - p.w;
    else if (p.vx < 0) p.x = b.x + b.w;
    p.vx = 0;
  }

  // Y axis
  const wasGround = p.onGround;
  const fallSpeed = p.vy * p.gdir;
  p.y += p.vy * dt;
  let landed = false, bonked = false;
  for (const b of gatherBoxes(p, world)) {
    if (!overlaps(p, b)) continue;
    if (p.vy > 0) p.y = b.y - p.h;
    else if (p.vy < 0) p.y = b.y + b.h;
    if (p.vy * p.gdir > 0) landed = true;
    else bonked = true;
    p.vy = 0;
  }
  p.onGround = landed;

  return { jumped, bonked, landed: landed && !wasGround, impact: fallSpeed };
}

// Tiles directly under the player's feet (or over its head when gravity is flipped).
export function standingTiles(p, out) {
  out.length = 0;
  if (!p.onGround) return out;
  const ty = p.gdir > 0 ? Math.floor((p.y + p.h + 1) / TILE) : Math.floor((p.y - 1) / TILE);
  const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w - 0.001) / TILE);
  for (let tx = x0; tx <= x1; tx++) out.push(tx, ty);
  return out;
}
