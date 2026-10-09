// One attempt ("run") at a level: map, traps, player, hazards. Browser-free and deterministic,
// so tools/verify-levels.mjs can replay inputs through exactly what players get.
import { TILE, COLS, ROWS, VIEW_H } from "./config.js";
import { makePlayer, stepPlayer, overlaps } from "./physics.js";
import { makeTrap } from "./traps.js";

export function createRun(level, deaths) {
  const alt = !!level.alt && deaths >= (level.altAfter ?? 1);
  const grid = alt ? level.alt : level.map;
  const run = {
    level, deaths, alt, grid,
    groups: {}, rects: [], traps: [],
    signs: (alt ? level.altSigns : level.signs) || [],
    time: 0, reversed: false,
    dead: null, cleared: false,
    dialog: null, banner: null,
    events: [],
  };
  run.emit = (type, data) => run.events.push({ type, ...data });
  run.group = (ch) => run.groups[ch];
  run.solid = (tx, ty) => {
    if (tx < 0 || tx >= COLS) return true;
    if (ty < 0 || ty >= ROWS) return false;
    const c = grid[ty][tx];
    if (c === "#") return true;
    const g = run.groups[c];
    return g ? g.solid : false;
  };

  for (let ty = 0; ty < ROWS; ty++) {
    for (let tx = 0; tx < COLS; tx++) {
      const c = grid[ty][tx];
      if (c === "S") run.spawnTile = [tx, ty];
      else if (c === "E") run.exit = { tx, ty };
      else if (c >= "a" && c <= "z") {
        const g = (run.groups[c] ||= {
          ch: c, tiles: [], solid: true, visible: true, look: "wall",
          spike: null, deadly: false, anim: 1, offY: 0, vy: 0, falling: false, warn: false,
        });
        g.tiles.push([tx, ty]);
      }
    }
  }
  const [sx, sy] = run.spawnTile;
  const p = (run.player = makePlayer(0, 0));
  run.spawn = { x: sx * TILE + (TILE - p.w) / 2, y: sy * TILE + TILE - p.h };
  p.x = run.spawn.x; p.y = run.spawn.y;

  const defs = (alt ? level.altTraps : level.traps) || [];
  for (const d of defs) {
    if (deaths < (d.minDeaths ?? 0) || deaths > (d.maxDeaths ?? Infinity)) continue;
    run.traps.push(makeTrap(d, run));
  }
  return run;
}

const spikeBox = { x: 0, y: 0, w: 0, h: 0 };
function spikeHit(p, tx, ty, dir, anim = 1) {
  const h = 18 * anim;
  spikeBox.x = tx * TILE + 5; spikeBox.w = TILE - 10; spikeBox.h = h;
  spikeBox.y = dir === "up" ? ty * TILE + TILE - h : ty * TILE;
  return h > 4 && overlaps(p, spikeBox);
}

function hazard(run) {
  const p = run.player;
  if (p.y > VIEW_H + 48 || p.y + p.h < -48) return "fell";
  const x0 = Math.floor(p.x / TILE), x1 = Math.floor((p.x + p.w) / TILE);
  const y0 = Math.floor(p.y / TILE), y1 = Math.floor((p.y + p.h) / TILE);
  for (let ty = Math.max(0, y0); ty <= Math.min(ROWS - 1, y1); ty++) {
    for (let tx = Math.max(0, x0); tx <= Math.min(COLS - 1, x1); tx++) {
      const c = run.grid[ty][tx];
      if (c === "^" && spikeHit(p, tx, ty, "up")) return "spikes";
      if (c === "v" && spikeHit(p, tx, ty, "down")) return "spikes";
      const g = run.groups[c];
      if (g && g.deadly && g.spike && spikeHit(p, tx, ty, g.spike, g.anim)) return "spikes";
    }
  }
  for (const r of run.rects) if (r.deadly && overlaps(p, r)) return r.cause || "crushed";
  return null;
}

const doorBox = { x: 0, y: 0, w: 20, h: 28 };

// inp: { left, right, jump } held booleans for this step.
export function stepRun(run, inp, dt) {
  if (run.dead || run.cleared) return;
  run.time += dt;
  const p = run.player;
  const r = stepPlayer(p, inp, run, dt);
  if (r.jumped) run.emit("jump");
  if (r.landed && r.impact > 250) run.emit("land", { x: p.x + p.w / 2, y: p.gdir > 0 ? p.y + p.h : p.y });

  for (const t of run.traps) t.update(dt);

  const cause = hazard(run);
  if (cause) {
    run.dead = cause;
    run.emit("death", { cause, x: p.x + p.w / 2, y: p.y + p.h / 2 });
    return;
  }

  const e = run.exit;
  doorBox.x = e.tx * TILE + 6; doorBox.y = e.ty * TILE + 4;
  if (overlaps(p, doorBox)) { run.cleared = true; run.emit("clear"); }

  if (run.banner && (run.banner.t -= dt) <= 0) run.banner = null;
  if (run.dialog && (run.dialog.t -= dt) <= 0) run.dialog = null;
}
