// Checks every level's data and proves each one can be beaten by replaying recorded inputs
// through the game's own sim. Usage: node tools/verify-levels.mjs [--trace <level>]
import { LEVELS } from "../src/levels.js";
import { createRun, stepRun } from "../src/sim.js";
import { COLS, ROWS, STEP, TILE } from "../src/config.js";
import { TRAP_TYPES } from "../src/traps.js";
import { REPLAYS } from "./replays.mjs";

const traceLevel = process.argv.includes("--trace") ? Number(process.argv[process.argv.indexOf("--trace") + 1]) : 0;
let failures = 0;
const fail = (msg) => { failures++; console.log(`  FAIL ${msg}`); };

function checkMap(name, map, traps) {
  if (map.length !== ROWS) fail(`${name}: ${map.length} rows, expected ${ROWS}`);
  map.forEach((row, y) => { if (row.length !== COLS) fail(`${name}: row ${y} has ${row.length} cols`); });
  const all = map.join("");
  for (const ch of ["S", "E"]) {
    const n = all.split(ch).length - 1;
    if (n !== 1) fail(`${name}: ${n} '${ch}' tiles, expected 1`);
  }
  for (const t of traps || []) {
    if (!TRAP_TYPES.includes(t.type)) fail(`${name}: unknown trap ${t.type}`);
    if (t.tiles && !all.includes(t.tiles)) fail(`${name}: trap ${t.type} uses group '${t.tiles}' not in the map`);
  }
  const bad = all.match(/[^#.SE^va-z]/g);
  if (bad) fail(`${name}: unknown tile chars ${[...new Set(bad)].join("")}`);
}

function play(level, replay, trace) {
  const run = createRun(level, replay.deaths);
  const inp = { left: false, right: false, jump: false };
  let t = 0;
  for (const [secs, keys] of replay.inputs) {
    inp.left = keys.includes("L"); inp.right = keys.includes("R"); inp.jump = keys.includes("J");
    const end = t + secs;
    while (t < end - 1e-9) {
      stepRun(run, inp, STEP);
      t += STEP;
      const p = run.player;
      if (trace && Math.round(t / STEP) % 6 === 0) {
        console.log(`    t=${t.toFixed(2)} tile=(${((p.x + p.w / 2) / TILE).toFixed(1)}, ${((p.y + p.h / 2) / TILE).toFixed(1)}) v=(${p.vx.toFixed(0)}, ${p.vy.toFixed(0)}) ${keys}`);
      }
      for (const e of run.events.splice(0)) if (trace && e.type !== "jump") console.log(`    t=${t.toFixed(2)} event ${e.type} ${e.kind || e.cause || ""}`);
      if (run.dead || run.cleared) break;
    }
    if (run.dead || run.cleared) break;
  }
  const p = run.player;
  return { run, at: `(${((p.x + p.w / 2) / TILE).toFixed(1)}, ${((p.y + p.h / 2) / TILE).toFixed(1)})`, t };
}

LEVELS.forEach((level, i) => {
  const id = i + 1;
  console.log(`Level ${id}: ${level.name}`);
  checkMap(`level ${id}`, level.map, level.traps);
  if (level.alt) checkMap(`level ${id} alt`, level.alt, level.altTraps);
  const replays = REPLAYS[id];
  if (!replays?.length) return fail(`level ${id}: no replay`);
  for (const rp of replays) {
    const { run, at, t } = play(level, rp, traceLevel === id);
    const label = `${rp.expect === "death" ? "naive run" : "replay"} (deaths=${rp.deaths})`;
    if (rp.expect === "death") {
      if (run.dead) console.log(`  ok   ${label} gets trolled: ${run.dead} at tile ${at}`);
      else fail(`level ${id} ${label}: expected the trap to kill, but ${run.cleared ? "it cleared" : "it survived"}`);
    } else if (run.cleared) console.log(`  ok   ${label} cleared in ${t.toFixed(2)}s`);
    else fail(`level ${id} ${label}: ${run.dead ? `died (${run.dead})` : "did not reach the exit"} at tile ${at}, t=${t.toFixed(2)}s`);
  }
});

console.log(failures ? `\n${failures} problem(s)` : "\nAll levels valid and beatable.");
process.exit(failures ? 1 : 0);
