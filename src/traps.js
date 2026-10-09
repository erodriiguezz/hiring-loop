// Trap types. Each one reads its def from src/levels.js and changes the run: tile groups, moving
// rects, the exit, the player, or the overlays. Browser-free so the level verifier can run it.
import { TILE, PHYS, VIEW_W, VIEW_H } from "./config.js";
import { overlaps, standingTiles } from "./physics.js";

const feet = [];

export function inZone(run, z) {
  const p = run.player;
  const cx = Math.floor((p.x + p.w / 2) / TILE), cy = Math.floor((p.y + p.h / 2) / TILE);
  return cx >= z[0] && cx <= z[2] && cy >= z[1] && cy <= z[3];
}

function standingOn(run, g) {
  const t = standingTiles(run.player, feet);
  for (let i = 0; i < t.length; i += 2) if (run.grid[t[i + 1]]?.[t[i]] === g.ch) return true;
  return false;
}

function playerInGroup(run, g) {
  const p = run.player;
  for (const [tx, ty] of g.tiles) {
    if (overlaps(p, { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE })) return true;
  }
  return false;
}

const TYPES = {
  // Floor that falls away. Fires when the candidate stands on it, or on `zone`.
  drop: {
    init(t, run) { t.g = run.group(t.def.tiles); },
    trigger(t, run) { return t.def.zone ? inZone(run, t.def.zone) : standingOn(run, t.g); },
    fire(t, run) { t.g.solid = false; t.g.falling = true; run.emit("trap", { kind: "drop" }); },
    update(t, run, dt) {
      const g = t.g;
      if (!g.falling) return;
      g.vy += PHYS.GRAVITY * dt;
      g.offY += g.vy * dt;
      if (g.offY > 700) { g.visible = false; g.falling = false; }
    },
  },

  // Hidden spikes that pop up on `zone`, then retract after `duration` (default: never).
  pop: {
    init(t, run) {
      const g = (t.g = run.group(t.def.tiles));
      g.solid = false; g.visible = false; g.spike = t.def.dir || "up"; g.anim = 0;
      g.look = "spike"; // so the floor under hidden spikes keeps its normal edge and gives nothing away
    },
    trigger(t, run) { return inZone(run, t.def.zone); },
    fire(t, run) {
      t.g.visible = true; t.g.deadly = true; t.up = true;
      t.life = t.def.duration ?? Infinity;
      run.emit("trap", { kind: "pop" });
    },
    update(t, run, dt) {
      const g = t.g;
      if (!t.up && g.anim <= 0) return;
      if (t.up) {
        g.anim = Math.min(1, g.anim + dt / 0.06);
        t.life -= dt;
        if (t.life <= 0) { t.up = false; g.deadly = false; run.emit("retract"); }
      } else {
        g.anim = Math.max(0, g.anim - dt / 0.2);
        if (g.anim === 0) g.visible = false;
      }
    },
  },

  // The exit runs away when the candidate gets within `radius` tiles, hopping through `to`.
  flee: {
    init(t) { t.idx = 0; },
    trigger() { return false; },
    update(t, run) {
      if (t.idx >= t.def.to.length) return;
      const p = run.player, e = run.exit;
      const dx = p.x + p.w / 2 - (e.tx * TILE + TILE / 2), dy = p.y + p.h / 2 - (e.ty * TILE + TILE / 2);
      if (Math.hypot(dx, dy) > t.def.radius * TILE) return;
      run.emit("trap", { kind: "flee", x: e.tx * TILE + TILE / 2, y: e.ty * TILE + TILE / 2 });
      [e.tx, e.ty] = t.def.to[t.idx++];
    },
  },

  // A block (looks like the ceiling) that drops on `zone`. Deadly while falling, solid once it lands.
  crush: {
    init(t, run) {
      const g = run.group(t.def.tiles);
      g.solid = false; g.visible = false;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [tx, ty] of g.tiles) {
        x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx); y1 = Math.max(y1, ty);
      }
      t.r = { x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, solid: true, deadly: false, look: "wall" };
      run.rects.push(t.r);
    },
    trigger(t, run) { return inZone(run, t.def.zone); },
    fire(t, run) { t.r.solid = false; t.r.deadly = true; t.falling = true; run.emit("trap", { kind: "crush" }); },
    update(t, run, dt) {
      if (!t.falling) return;
      const r = t.r;
      r.y += (t.def.speed ?? 1000) * dt;
      const row = Math.floor((r.y + r.h) / TILE);
      for (let tx = Math.floor(r.x / TILE); tx < (r.x + r.w) / TILE; tx++) {
        if (run.solid(tx, row)) {
          r.y = row * TILE - r.h;
          t.falling = false; r.deadly = false; r.solid = true;
          run.emit("thud", { x: r.x + r.w / 2, y: r.y + r.h });
          return;
        }
      }
      if (r.y > 2000) t.falling = false;
    },
  },

  // A platform that blinks on a fixed schedule: `on` seconds solid, `off` seconds gone, offset by `phase`.
  flaky: {
    init(t, run) { t.g = run.group(t.def.tiles); t.g.look = "flaky"; },
    trigger() { return false; },
    update(t, run) {
      const { on, off, phase = 0 } = t.def;
      const period = on + off;
      const local = (((run.time - phase) % period) + period) % period;
      const want = local < on;
      const g = t.g;
      if (want && !g.solid && playerInGroup(run, g)) return; // never re-appear inside the candidate
      g.solid = want;
      g.warn = want && local > on - 0.35;
    },
  },

  // An in-game error dialog that covers part of the screen. Purely visual, which is the problem.
  dialog: {
    trigger(t, run) { return inZone(run, t.def.zone); },
    fire(t, run) {
      const d = t.def;
      run.dialog = { title: d.title, lines: d.lines, rect: d.rect, t: d.duration, total: d.duration };
      run.emit("trap", { kind: "dialog" });
    },
  },

  // The deadline: a deadly wall that slides in from the left at `speed` px/s and stops at `stop` (tile).
  // Starts on `zone`, or straight away without one. Keep moving or it gets you.
  chase: {
    init(t, run) {
      t.r = { x: -TILE * 2, y: 0, w: TILE * 2, h: VIEW_H, solid: false, deadly: false, hidden: true, look: "deadline", label: t.def.label, cause: "deadline" };
      run.rects.push(t.r);
    },
    trigger(t, run) { return t.def.zone ? inZone(run, t.def.zone) : true; },
    fire(t, run) {
      t.r.hidden = false; t.r.deadly = true; t.on = true;
      if (t.def.text) run.banner = { text: t.def.text, t: 2 };
      run.emit("trap", { kind: "chase" });
    },
    update(t, run, dt) {
      if (!t.on) return;
      const stop = (t.def.stop ?? 40) * TILE;
      t.r.x = Math.min(stop - t.r.w, t.r.x + t.def.speed * dt);
      if (t.r.x > VIEW_W) t.on = false;
    },
  },

  // A pivot: left is right now. Flips the controls on `zone`, for `duration` seconds (default: the rest of the life).
  reverse: {
    trigger(t, run) { return inZone(run, t.def.zone); },
    fire(t, run) {
      run.reversed = true;
      t.life = t.def.duration ?? Infinity;
      run.banner = { text: t.def.text || "WE'RE PIVOTING", t: 2 };
      run.emit("trap", { kind: "reverse" });
    },
    update(t, run, dt) {
      if (!t.life || t.life === Infinity) return;
      t.life -= dt;
      if (t.life <= 0) { t.life = 0; run.reversed = false; run.emit("retract"); }
    },
  },

  // Sends the candidate back to spawn, once per life. Not a death. Somehow worse.
  teleport: {
    trigger(t, run) { return inZone(run, t.def.zone); },
    fire(t, run) {
      const p = run.player;
      run.emit("trap", { kind: "teleport", x: p.x + p.w / 2, y: p.y + p.h / 2 });
      p.x = run.spawn.x; p.y = run.spawn.y; p.vx = 0; p.vy = 0;
      run.banner = { text: t.def.text, t: 2 };
    },
  },
};

export function makeTrap(def, run) {
  const impl = TYPES[def.type];
  if (!impl) throw new Error(`unknown trap type "${def.type}"`);
  const t = { def, fired: false, timer: -1 };
  impl.init?.(t, run);
  t.update = (dt) => {
    if (!t.fired && impl.trigger(t, run)) { t.fired = true; t.timer = def.delay ?? 0; }
    if (t.timer >= 0) {
      t.timer -= dt;
      if (t.timer < 0) impl.fire(t, run);
    }
    impl.update?.(t, run, dt);
  };
  return t;
}

export const TRAP_TYPES = Object.keys(TYPES);
