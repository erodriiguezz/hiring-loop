// Everything drawn in the 960x544 logical view: level, traps, the candidate, particles, overlays.
// All art is procedural, chunky 4px "pixels" on canvas.
import { TILE, COLS, ROWS, VIEW_W, VIEW_H, COLORS as C, setTheme, currentTheme } from "./config.js";

export const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// ---------- the candidate ----------
// 7x8 sprite at 4px: h hair, f face, s suit, S suit shade, w shirt, t tie, p pants.
const BODY = ["..hhh..", ".hhhhh.", ".fffff.", "..fff..", "Sswtwss", "Sswtwss", ".sssss."];
const LEGS = [".pp.pp.", ".p...p."];
const PAL = { h: "hair", f: "skin", s: "suit", S: "suitShade", w: "shirt", t: "tie", p: "pants" };

export function drawCandidate(ctx, x, y, { face = 1, t = 0, flip = false, angry = false, scale = 1, walking = false } = {}) {
  const px = 4 * scale;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) { ctx.translate(0, 8 * px); ctx.scale(1, -1); }
  if (face < 0) { ctx.translate(7 * px, 0); ctx.scale(-1, 1); }
  const rows = [...BODY, LEGS[walking ? Math.floor(t * 10) % 2 : 0]];
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < 7; c++) {
      const ch = rows[r][c];
      if (ch === ".") continue;
      ctx.fillStyle = C[PAL[ch]];
      ctx.fillRect(c * px, r * px, px, px);
    }
  }
  const blink = (t % 3.2) < 0.12;
  ctx.fillStyle = angry ? C.danger : C.eye;
  ctx.fillRect(3 * px, 2 * px, px, blink ? px / 2 : px);
  ctx.fillRect(5 * px, 2 * px, px, blink ? px / 2 : px);
  if (angry) { // sweat drop
    ctx.fillStyle = "#8fd3ff";
    ctx.fillRect(0, 2 * px, px / 2, px);
  }
  ctx.restore();
}

// ---------- tiles ----------
const isWallish = (grid, groups, tx, ty) => {
  if (tx < 0 || tx >= COLS) return true;
  if (ty < 0 || ty >= ROWS) return false;
  const c = grid[ty][tx];
  return c === "#" || (groups[c] && groups[c].look === "wall");
};

function hash(x, y) { return ((x * 73856093) ^ (y * 19349663)) >>> 0; }

export function drawWallTile(ctx, x, y, tx, ty, open) {
  ctx.fillStyle = C.wall;
  ctx.fillRect(x, y, TILE, TILE);
  const h = hash(tx, ty);
  ctx.fillStyle = C.wallDark; // speckle texture
  for (let i = 0; i < 3; i++) {
    const v = (h >> (i * 7)) & 0x3f;
    ctx.fillRect(x + (v & 7) * 4, y + ((v >> 3) & 7) * 4, 4, 4);
  }
  ctx.fillStyle = C.wallEdge;
  if (open.left) ctx.fillRect(x, y, 4, TILE);
  if (open.right) ctx.fillRect(x + TILE - 4, y, 4, TILE);
  if (open.down) ctx.fillRect(x, y + TILE - 4, TILE, 4);
  if (open.up) {
    ctx.fillStyle = C.ecto;
    ctx.fillRect(x, y, TILE, 4);
    if (h & 1) ctx.fillRect(x + 4 + (h % 5) * 4, y + 4, 4, 4 + (h % 3) * 4); // drip
  }
}

const open = { up: false, down: false, left: false, right: false };
function tileOpen(grid, groups, tx, ty) {
  open.up = !isWallish(grid, groups, tx, ty - 1);
  open.down = !isWallish(grid, groups, tx, ty + 1);
  open.left = !isWallish(grid, groups, tx - 1, ty);
  open.right = !isWallish(grid, groups, tx + 1, ty);
  return open;
}

export function drawSpikes(ctx, x, y, dir, k = 1) {
  const h = 18 * k;
  if (h < 1) return;
  for (let i = 0; i < 2; i++) {
    const sx = x + 2 + i * 14;
    ctx.fillStyle = C.spike;
    ctx.beginPath();
    if (dir === "up") { ctx.moveTo(sx, y + TILE); ctx.lineTo(sx + 7, y + TILE - h); ctx.lineTo(sx + 14, y + TILE); }
    else { ctx.moveTo(sx, y); ctx.lineTo(sx + 7, y + h); ctx.lineTo(sx + 14, y); }
    ctx.fill();
    ctx.fillStyle = C.spikeDark;
    if (dir === "up") ctx.fillRect(sx + 7, y + TILE - h * 0.6, 3, h * 0.6);
    else ctx.fillRect(sx + 7, y, 3, h * 0.6);
  }
}

function drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (currentTheme() === "outdoor") return drawOutdoor(ctx);
  // The tower across the street, still lit at 11pm. Somebody got the job.
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(560, 60, 300, 484);
  ctx.fillRect(120, 140, 200, 404);
  for (let y = 76; y < 520; y += 20) {
    for (let x = 576; x < 850; x += 20) {
      if (hash(x, y) % 5 < 2) { ctx.fillStyle = C.window; ctx.fillRect(x, y, 8, 8); }
    }
    for (let x = 136; x < 310; x += 20) {
      if (y > 150 && hash(x, y + 3) % 7 < 2) { ctx.fillStyle = C.window; ctx.fillRect(x, y, 8, 8); }
    }
  }
}

function drawOutdoor(ctx) {
  // Sun, in 4px steps.
  ctx.fillStyle = "#fff3b0";
  for (let y = -28; y < 28; y += 4) for (let x = -28; x < 28; x += 4) if (x * x + y * y < 28 * 28) ctx.fillRect(820 + x, 96 + y, 4, 4);
  // Clouds.
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const [cx, cy, w] of [[140, 90, 120], [420, 60, 90], [600, 130, 140]]) {
    ctx.fillRect(cx, cy, w, 16); ctx.fillRect(cx + 16, cy - 12, w - 40, 12); ctx.fillRect(cx + 8, cy + 16, w - 24, 8);
  }
  // The HQ on the horizon, and the city around it.
  ctx.fillStyle = "rgba(60,90,130,0.35)";
  for (const [bx, bw, bh] of [[40, 70, 120], [130, 50, 170], [200, 90, 100], [330, 60, 150], [700, 80, 130], [800, 60, 90]]) ctx.fillRect(bx, 380 - bh, bw, bh);
  ctx.fillStyle = "rgba(40,70,110,0.55)";
  ctx.fillRect(470, 150, 120, 230);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let y = 166; y < 370; y += 16) for (let x = 482; x < 580; x += 16) ctx.fillRect(x, y, 6, 6);
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("HQ", 530, 142);
  // Trees.
  for (const tx of [60, 300, 640, 900]) {
    ctx.fillStyle = "#6b4a2f"; ctx.fillRect(tx, 330, 8, 54);
    ctx.fillStyle = "#3f9a46"; ctx.fillRect(tx - 20, 290, 48, 44); ctx.fillRect(tx - 12, 274, 32, 16);
  }
}

// Static layer (background, walls, static spikes, signs), cached per map.
const bakeCache = new Map();
export function bakeLevel(run) {
  setTheme(run.level.theme || "office");
  const key = run.grid;
  let cv = bakeCache.get(key);
  if (cv) return cv;
  cv = makeCanvas(VIEW_W, VIEW_H);
  const ctx = cv.getContext("2d");
  drawBackground(ctx);
  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = run.grid[ty][tx];
      const x = tx * TILE, y = ty * TILE;
      if (c === "#") drawWallTile(ctx, x, y, tx, ty, tileOpen(run.grid, run.groups, tx, ty));
      else if (c === "^") drawSpikes(ctx, x, y, "up");
      else if (c === "v") drawSpikes(ctx, x, y, "down");
    }
  }
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = "center";
  for (const s of run.signs) {
    ctx.fillStyle = C.sign;
    ctx.fillText(s.text, s.x * TILE + TILE / 2, s.y * TILE + TILE / 2);
  }
  bakeCache.set(key, cv);
  return cv;
}

export function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

// ---------- dynamic world ----------
export function drawDoor(ctx, tx, ty, t, label = "NEXT ROUND") {
  const x = tx * TILE + 4, y = ty * TILE - 12;
  const glow = 0.25 + 0.15 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(242,166,90,${glow})`;
  ctx.fillRect(x - 4, y - 4, 32, 52);
  ctx.fillStyle = C.door;
  ctx.fillRect(x, y, 24, 44);
  ctx.fillStyle = C.doorDark;
  ctx.fillRect(x + 4, y + 4, 16, 40);
  ctx.fillStyle = C.door;
  ctx.fillRect(x + 14, y + 24, 4, 4);
  ctx.fillStyle = C.pass;
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(label, x + 12, y - 6);
}

function drawGroups(ctx, run, t) {
  for (const k in run.groups) {
    const g = run.groups[k];
    if (!g.visible) continue;
    for (const [tx, ty] of g.tiles) {
      const x = tx * TILE, y = ty * TILE + g.offY;
      if (g.spike) { drawSpikes(ctx, x, y, g.spike, g.anim); continue; }
      if (g.look === "flaky") { drawFlaky(ctx, x, y, g, t); continue; }
      drawWallTile(ctx, x, y, tx, ty, tileOpen(run.grid, run.groups, tx, ty));
    }
    if (g.look === "flaky") {
      // Label centered over the top row of the group, whether it's laid flat or stood up as a pillar.
      const ty = Math.min(...g.tiles.map((t) => t[1]));
      const top = g.tiles.filter((t) => t[1] === ty).map((t) => t[0]);
      const tx = Math.min(...top), n = Math.max(...top) - tx + 1;
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = "center";
      const [on, warn, off] = run.level.flaky || ["PASS", "FLAKY", "FAIL"];
      ctx.fillStyle = g.solid ? (g.warn && Math.floor(t * 12) % 2 ? C.fail : C.pass) : C.fail;
      ctx.fillText(g.solid ? (g.warn ? warn : on) : off, (tx + n / 2) * TILE, ty * TILE + 20);
    }
  }
}

function drawFlaky(ctx, x, y, g, t) {
  if (g.solid) {
    const blink = g.warn && Math.floor(t * 12) % 2;
    ctx.fillStyle = blink ? "#3a2230" : "#1d3a2e";
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = blink ? C.fail : C.pass;
    ctx.fillRect(x, y, TILE, 4);
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
  } else {
    ctx.fillStyle = "rgba(255,92,108,0.35)";
    for (let i = 0; i < TILE; i += 8) { ctx.fillRect(x + i, y, 4, 4); ctx.fillRect(x + i, y + TILE - 4, 4, 4); }
  }
}

function drawRects(ctx, run, t) {
  for (const r of run.rects) {
    if (r.hidden) continue;
    if (r.look === "deadline") { drawDeadline(ctx, r, t); continue; }
    for (let y = 0; y < r.h; y += TILE) {
      for (let x = 0; x < r.w; x += TILE) {
        open.up = y === 0 && !r.deadly && r.y > TILE; open.down = y + TILE >= r.h;
        open.left = x === 0; open.right = x + TILE >= r.w;
        drawWallTile(ctx, r.x + x, r.y + y, (r.x + x) / TILE, Math.round((r.y + y) / TILE), open);
      }
    }
  }
}

// The deadline: a red wall that slides in from the left and never stops.
function drawDeadline(ctx, r, t) {
  const pulse = 0.55 + 0.2 * Math.sin(t * 8);
  ctx.fillStyle = `rgba(255,77,109,${pulse * 0.5})`;
  ctx.fillRect(r.x - 24, 0, 24, VIEW_H);
  ctx.fillStyle = "#7a1426";
  ctx.fillRect(r.x, 0, r.w, VIEW_H);
  ctx.fillStyle = C.danger;
  for (let y = (t * 120) % 32 - 32; y < VIEW_H; y += 32) ctx.fillRect(r.x + r.w - 8, y, 8, 16);
  ctx.save();
  ctx.translate(r.x + r.w / 2 - 4, VIEW_H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#fff";
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(r.label || "DEADLINE", 0, 0);
  ctx.restore();
}

export function drawWorld(ctx, run, fx, t) {
  ctx.drawImage(bakeLevel(run), 0, 0);
  drawGroups(ctx, run, t);
  drawDoor(ctx, run.exit.tx, run.exit.ty, t, run.level.door);
  if (!run.dead) {
    const p = run.player;
    drawCandidate(ctx, p.x - 4, p.y - 8, { face: p.face, t, flip: p.gdir < 0, walking: p.onGround && Math.abs(p.vx) > 30 });
  }
  drawRects(ctx, run, t);
  drawParticles(ctx, fx.particles);
}

// ---------- particles ----------
export function spawnBurst(particles, x, y, n, color, speed = 260) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 220) particles.shift();
    const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 4 });
  }
}

export function updateParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.life -= dt;
    if (q.life <= 0) { particles.splice(i, 1); continue; }
    q.vy += 900 * dt;
    q.x += q.vx * dt; q.y += q.vy * dt;
  }
}

function drawParticles(ctx, particles) {
  for (const q of particles) {
    ctx.globalAlpha = Math.min(1, q.life / 0.3);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x & ~1, q.y & ~1, q.size, q.size);
  }
  ctx.globalAlpha = 1;
}
