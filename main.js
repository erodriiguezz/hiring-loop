// Hiring Loop: boot, game loop and state machine (title -> play -> pause / clear -> finish).
// Everything is local and procedural; nothing loads from the network.
import { VIEW_W, VIEW_H, STEP, MAX_FRAME, RESPAWN_DELAY, TOUCH, COLORS as C, setTheme } from "./src/config.js";
import { LEVELS } from "./src/levels.js";
import { createRun, stepRun } from "./src/sim.js";
import { makeCanvas, drawWorld, spawnBurst, updateParticles } from "./src/render.js";
import { drawHud, drawBanner, drawDialog, drawTaunt, drawTitle, drawPause, drawClear, drawFinish, drawRotate } from "./src/ui.js";
import { createInput } from "./src/input.js";
import { createTouch } from "./src/touch.js";
import { unlockAudio, sfx, setMuted, isMuted, listenForArcadeMute } from "./src/audio.js";
import { loadSave, writeSave as realWriteSave } from "./src/save.js";
let writeSaveMaybe = realWriteSave;
const writeSave = (s) => writeSaveMaybe(s);
import { pickTaunt, verdict } from "./src/taunts.js";
import { REPLAYS } from "./tools/replays.mjs";

export const TITLE = "Hiring Loop";

// ?autopilot plays the recorded replays (a naive run that gets rejected, then a clean one) for demo
// capture. ?autopilot&level=8 starts at a given round. It never touches the player's save.
const params = new URLSearchParams(location.search);
const AUTO = params.has("autopilot");
const AUTO_LEVEL = Math.max(0, (Number(params.get("level")) || 1) - 1);
const auto = { inputs: [], step: 0 };
function pickReplay(levelNo, deaths) {
  const all = REPLAYS[levelNo] || [];
  const naive = all.find((r) => r.expect === "death");
  if (deaths === 0 && naive) return naive;
  const sols = all.filter((r) => r.expect !== "death");
  return sols.find((r) => r.deaths === deaths) || sols.filter((r) => r.deaths <= deaths).at(-1) || sols[0];
}
// Expand a replay into one input per physics step, segmenting time exactly as tools/verify-levels.mjs
// does, so autopilot plays the very runs the verifier proved.
function expand(replay) {
  const out = [];
  let t = 0;
  for (const [secs, keys] of replay?.inputs || []) {
    const inp = { left: keys.includes("L"), right: keys.includes("R"), jump: keys.includes("J") };
    const end = t + secs;
    while (t < end - 1e-9) { out.push(inp); t += STEP; }
  }
  return out;
}
const IDLE = { left: false, right: false, jump: false };
function autoSample() { return auto.inputs[auto.step++] || IDLE; }

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d");
const view = makeCanvas(VIEW_W, VIEW_H);
const vctx = view.getContext("2d");

const save = AUTO ? { v: 1, next: AUTO_LEVEL, totalDeaths: 0, totalTime: 0, best: {} } : loadSave();
if (AUTO) writeSaveMaybe = () => {};
const fx = { particles: [], shake: 0 };
const game = {
  mode: "title", modeT: 0,
  index: 0, deaths: 0, time: 0,
  run: null, respawn: 0, taunt: null,
  sel: 0, buttons: [], summary: null,
};

const touch = createTouch(canvas, { onTap, onAction: (a) => input.push(a) });
const input = createInput(touch);
listenForArcadeMute();
addEventListener("pointerdown", unlockAudio, true);
addEventListener("keydown", unlockAudio, true);

// ---------- layout ----------
const L = { w: 0, h: 0, dpr: 1, gx: 0, gy: 0, gw: 0, gh: 0, scale: 1, touch: null };
function layout() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(2, devicePixelRatio || 1);
  if (w === L.w && h === L.h && dpr === L.dpr && touch.active === L.touch) return;
  Object.assign(L, { w, h, dpr, touch: touch.active });
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  // On touch, keep side gutters for the buttons so they never cover the level.
  const gutter = touch.active ? Math.min(w * 0.25, Math.max(TOUCH.GUTTER_MIN, Math.min(TOUCH.GUTTER_MAX, w * TOUCH.GUTTER_FRAC))) : 0;
  L.scale = Math.max(0.05, Math.min((w - 2 * gutter) / VIEW_W, h / VIEW_H));
  L.gw = VIEW_W * L.scale; L.gh = VIEW_H * L.scale;
  L.gx = (w - L.gw) / 2; L.gy = (h - L.gh) / 2;
  touch.layout(w, h, L.gx);
}

// ---------- flow ----------
function setMode(m) { game.mode = m; game.modeT = 0; game.sel = 0; touch.reset(); }

function begin() {
  startLevel(save.next < LEVELS.length ? save.next : 0);
}

function startLevel(i) {
  game.index = i; game.deaths = 0; game.time = 0; game.taunt = null;
  spawn();
  setMode("play");
}

function spawn() {
  const level = LEVELS[game.index];
  game.run = createRun(level, game.deaths);
  game.respawn = 0;
  if (game.run.alt && game.deaths === (level.altAfter ?? 1)) game.run.banner = { text: level.altBanner || "SPEC CHANGED", t: 2.2 };
  if (AUTO) { auto.inputs = expand(pickReplay(game.index + 1, game.deaths)); auto.step = 0; }
}

function die(cause, x, y) {
  game.deaths++;
  save.totalDeaths++;
  writeSave(save);
  game.respawn = RESPAWN_DELAY;
  game.taunt = { text: pickTaunt(game.deaths, cause), t: 2 };
  spawnBurst(fx.particles, x, y, 26, C.shirt, 320);
  spawnBurst(fx.particles, x, y, 8, C.danger, 200);
  fx.shake = 10;
  sfx("death");
}

function restart() {
  const p = game.run.player;
  if (game.run.dead || game.run.cleared) return;
  game.run.dead = "restart";
  die("restart", p.x + p.w / 2, p.y + p.h / 2);
}

function cleared() {
  sfx("clear");
  const id = String(game.index + 1);
  const prev = save.best[id];
  const best = {
    deaths: Math.min(prev?.deaths ?? Infinity, game.deaths),
    time: Math.min(prev?.time ?? Infinity, game.time),
  };
  save.best[id] = best;
  save.next = Math.max(save.next, game.index + 1);
  save.totalTime += game.time;
  writeSave(save);
  const nextLevel = LEVELS[game.index + 1];
  game.summary = {
    deaths: game.deaths, time: game.time,
    next: nextLevel ? `next round: ${nextLevel.name}` : "final round: passed",
    best: prev ? `best: ${best.deaths} deaths, ${best.time.toFixed(1)}s` : "first clear!",
  };
  const p = game.run.player;
  spawnBurst(fx.particles, p.x + p.w / 2, p.y, 30, C.ecto, 260);
  setMode("clear");
}

function next() {
  if (game.index + 1 < LEVELS.length) startLevel(game.index + 1);
  else setMode("finish");
}

function choosePause(i) {
  sfx("click");
  if (i === 0) setMode("play");
  else if (i === 1) { setMode("play"); restart(); }
  else setMode("title");
}

// ---------- input ----------
function onTap(x, y) {
  if (rotated()) return;
  unlockAudio();
  const lx = (x - L.gx) / L.scale, ly = (y - L.gy) / L.scale;
  if (game.mode === "title") begin();
  else if (game.mode === "pause") {
    const b = game.buttons.find((b) => lx >= b.x && lx < b.x + b.w && ly >= b.y && ly < b.y + b.h);
    if (b) choosePause(b.i);
  } else if (game.mode === "clear" && game.modeT > 0.4) next();
  else if (game.mode === "finish" && game.modeT > 1) setMode("title");
}

function handleActions(actions) {
  for (const a of actions) {
    if (a === "mute") { setMuted(!isMuted()); continue; }
    switch (game.mode) {
      case "title": if (a === "any") begin(); break;
      case "play":
        if (a === "restart") restart();
        else if (a === "pause") setMode("pause");
        break;
      case "pause":
        if (a === "up") game.sel = (game.sel + 2) % 3;
        else if (a === "down") game.sel = (game.sel + 1) % 3;
        else if (a === "confirm") choosePause(game.sel);
        else if (a === "pause") setMode("play");
        break;
      case "clear": if (a === "any" && game.modeT > 0.4) next(); break;
      case "finish": if (a === "any" && game.modeT > 1) setMode("title"); break;
    }
  }
}

addEventListener("visibilitychange", () => { if (document.hidden && game.mode === "play") setMode("pause"); });

const rotated = () => touch.active && innerHeight > innerWidth;

// ---------- simulation ----------
function tick(dt) {
  if (game.respawn > 0) {
    game.respawn -= dt;
    if (game.respawn <= 0) spawn();
    return;
  }
  const run = game.run;
  game.time += dt;
  stepRun(run, AUTO ? autoSample() : input.sample(), dt);
  for (const e of run.events.splice(0)) {
    if (e.type === "jump") sfx("jump");
    else if (e.type === "land") { sfx("land"); spawnBurst(fx.particles, e.x, e.y, 4, C.suitShade, 60); }
    else if (e.type === "trap") {
      sfx(e.kind === "flee" || e.kind === "teleport" ? "poof" : "trap");
      if (e.x != null) spawnBurst(fx.particles, e.x, e.y, 16, C.ecto, 200);
    } else if (e.type === "thud") { sfx("thud"); fx.shake = 8; }
    else if (e.type === "death") die(e.cause, e.x, e.y);
    else if (e.type === "clear") cleared();
  }
}

// ---------- render ----------
function render(t) {
  const run = game.run;
  if (game.mode === "title") {
    setTheme("office");
    const sub = save.next > 0 && save.next < LEVELS.length
      ? `continue at round ${save.next + 1}: ${LEVELS[save.next].name}  ·  ${save.totalDeaths} rejections so far`
      : touch.active ? "" : "←/→ or A/D move  ·  Space jump  ·  R restart  ·  P pause  ·  M mute";
    drawTitle(vctx, t, { title: TITLE, prompt: touch.active ? "TAP TO PLAY" : "CLICK OR PRESS ANY KEY", sub });
  } else {
    vctx.fillStyle = "#05080b";
    vctx.fillRect(0, 0, VIEW_W, VIEW_H);
    vctx.save();
    if (fx.shake > 0.5) vctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    drawWorld(vctx, run, fx, t);
    vctx.restore();
    if (run.dialog) drawDialog(vctx, run.dialog);
    if (run.banner) drawBanner(vctx, run.banner.text);
    if (game.taunt && !run.dead) {
      const p = run.player;
      drawTaunt(vctx, game.taunt.text, p.x + p.w / 2, p.y);
    }
    const level = LEVELS[game.index];
    drawHud(vctx, { index: game.index, total: LEVELS.length, name: level.name, deaths: game.deaths, time: game.time });
    if (game.mode === "pause") game.buttons = drawPause(vctx, game.sel);
    else if (game.mode === "clear") {
      drawClear(vctx, { ...game.summary, ready: game.modeT > 0.4, prompt: touch.active ? "tap for the next level" : "press any key" });
    } else if (game.mode === "finish") {
      drawFinish(vctx, {
        deaths: save.totalDeaths, time: save.totalTime, verdict: verdict(save.totalDeaths),
        ready: game.modeT > 1, prompt: touch.active ? "tap to return" : "press any key",
      }, t);
    }
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05080b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (rotated()) {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    drawRotate(ctx, L.w, L.h, t);
    return;
  }
  ctx.imageSmoothingEnabled = L.scale * L.dpr < 1; // crisp pixels when scaling up, smooth when down
  ctx.drawImage(view, L.gx * L.dpr, L.gy * L.dpr, L.gw * L.dpr, L.gh * L.dpr);
  touch.reversed = !!run?.reversed;
  touch.draw(ctx, L.dpr);
}

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  layout();
  handleActions(input.drain());
  const paused = rotated();
  game.modeT += dt;
  touch.enabled = game.mode === "play" && !paused;
  if (AUTO) { // demo capture: skip the menus
    if (game.mode === "title" && game.modeT > 1.2) begin();
    else if (game.mode === "clear" && game.modeT > 1.6) next();
  }
  if (game.mode === "play" && !paused) {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; tick(STEP); }
  } else acc = 0;
  if (game.taunt && (game.taunt.t -= dt) <= 0) game.taunt = null;
  updateParticles(fx.particles, dt);
  fx.shake *= Math.pow(0.002, dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}
window.focus();
requestAnimationFrame(frame);
