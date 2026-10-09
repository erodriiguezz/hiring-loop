// Level data. Each map is 30x17 tiles, built with a tiny builder so it stays readable and easy to fork.
//
// Tile legend
//   #  wall          .  empty         S  spawn        E  exit door
//   ^  floor spikes  v  ceiling spikes
//   a-z  a trap group: those tiles belong to the trap in `traps` with the same `tiles` letter
//
// Trap fields shared by every type: `zone: [x0, y0, x1, y1]` (tiles, inclusive) triggers it when
// the candidate's center enters; `delay` seconds; `minDeaths` / `maxDeaths` limit it to certain attempts.
// Trap types live in src/traps.js.
//
// Level fields: `name` (the interview round), `theme` ("office" or "outdoor"), `door` (the exit label),
// `flaky` (labels for the on / warn / off states of flaky platforms), `alt*` (the map after a death).
import { COLS, ROWS } from "./config.js";

const GROUND = 12; // top row of the default floor

function build(fn) {
  const g = Array.from({ length: ROWS }, () => Array(COLS).fill("."));
  const b = {
    set(x, y, ch) { g[y][x] = ch; return b; },
    rect(x0, y0, x1, y1, ch) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = ch;
      return b;
    },
    frame() { return b.rect(0, 0, COLS - 1, 0, "#").rect(0, 0, 0, ROWS - 1, "#").rect(COLS - 1, 0, COLS - 1, ROWS - 1, "#"); },
    ground(y = GROUND) { return b.rect(0, y, COLS - 1, ROWS - 1, "#"); },
    pit(x0, x1, y = GROUND) { return b.rect(x0, y, x1, ROWS - 1, "."); },
  };
  b.frame().ground();
  fn(b);
  return g.map((r) => r.join(""));
}

export const LEVELS = [
  {
    name: "Resume Screening",
    map: build((b) => {
      b.set(2, 11, "S").set(27, 11, "E");
      b.set(9, 11, "#");
      b.rect(12, 1, 13, 2, "c");
      b.rect(15, 11, 17, 11, "b");
      b.pit(20, 21).rect(20, 12, 21, ROWS - 1, "a"); // full depth, so nothing hints at the pit
      b.pit(24, 25).rect(24, 12, 25, ROWS - 1, "d");
      b.set(23, 11, "e");
    }),
    traps: [
      { type: "crush", tiles: "c", zone: [11, 1, 11, 11], delay: 0.05, speed: 1200 },
      { type: "pop", tiles: "b", dir: "up", zone: [13, 1, 14, 11], duration: 1.3 },
      { type: "drop", tiles: "a" },
      { type: "drop", tiles: "d", zone: [23, 1, 23, 11] },
      // Second application? The ATS remembers you.
      { type: "pop", tiles: "e", dir: "up", zone: [22, 1, 22, 11], duration: 0.6, minDeaths: 1 },
    ],
    signs: [
      { x: 5, y: 8, text: "ATS: scanning..." },
      { x: 16, y: 8, text: "keyword filter" },
      { x: 21, y: 9, text: "apply here!" },
    ],
  },
  {
    name: "Recruiter Call",
    map: build((b) => {
      b.set(2, 11, "S").set(26, 11, "E");
      b.rect(3, 10, 5, 10, "#");
      b.pit(7, 10);
      b.rect(13, 10, 14, 10, "#");
      b.rect(18, 8, 19, 8, "#");
      b.rect(22, 11, 24, 11, "^");
      b.rect(16, 11, 17, 11, "b");
    }),
    traps: [
      { type: "flee", radius: 4, to: [[4, 9], [18, 7], [13, 9], [27, 11]] },
      {
        type: "dialog", zone: [16, 1, 20, 7], rect: [15, 3, 13, 6], duration: 2.4,
        title: "recruiter",
        lines: ["quick 15 min call!", "so... what are your", "salary expectations?"],
      },
      { type: "pop", tiles: "b", dir: "up", zone: [15, 1, 15, 11], duration: 1.2 },
    ],
    signs: [{ x: 10, y: 6, text: "\"let's connect!\"" }],
  },
  {
    name: "Online Assessment",
    map: build((b) => {
      b.set(2, 11, "S").set(26, 11, "E");
      b.pit(5, 23);
      b.set(8, 12, "f").set(12, 12, "g").set(16, 12, "h").set(20, 12, "i");
      b.rect(24, 12, 24, ROWS - 1, "a");
    }),
    traps: [
      { type: "flaky", tiles: "f", on: 1.0, off: 1.0, phase: 0.8 },
      { type: "flaky", tiles: "g", on: 1.0, off: 1.0, phase: 1.3 },
      { type: "flaky", tiles: "h", on: 1.0, off: 1.0, phase: 1.8 },
      { type: "flaky", tiles: "i", on: 1.0, off: 1.0, phase: 2.3 },
      { type: "drop", tiles: "a" },
      { type: "chase", speed: 80, delay: 1.2, label: "TIME LIMIT" },
    ],
    signs: [
      { x: 3, y: 7, text: "camera on. no tabs." },
      { x: 15, y: 5, text: "60 min test. 6 hrs of work." },
      { x: 24, y: 9, text: "submit" },
    ],
  },
  {
    name: "Live Coding",
    map: build((b) => {
      b.set(2, 11, "S").set(26, 11, "E");
      b.pit(8, 10);
      b.rect(15, 1, 16, 2, "d");
      b.rect(19, 1, 21, 2, "c");
      b.rect(23, 11, 24, 11, "b");
    }),
    traps: [
      {
        type: "dialog", zone: [5, 1, 6, 11], rect: [7, 3, 12, 6], duration: 2.0,
        title: "interviewer",
        lines: ["can you think out loud?", "...louder. and faster."],
      },
      { type: "crush", tiles: "d", zone: [13, 1, 13, 11], delay: 0.05, speed: 1300 },
      { type: "crush", tiles: "c", zone: [17, 1, 18, 11], delay: 0.1, speed: 1300 },
      { type: "pop", tiles: "b", dir: "up", zone: [22, 1, 22, 11], duration: 0.7 },
    ],
    // After the first death the interviewer changes the problem. Of course they do.
    altAfter: 1,
    altBanner: "PROBLEM CHANGED",
    alt: build((b) => {
      b.set(2, 11, "S").set(26, 11, "E");
      b.rect(11, 1, 13, 2, "c");
      b.pit(15, 17);
      b.pit(20, 22).rect(20, 12, 22, ROWS - 1, "a");
      b.set(24, 11, "b");
      b.set(19, 11, "^");
    }),
    altTraps: [
      { type: "crush", tiles: "c", zone: [9, 1, 10, 11], delay: 0.1, speed: 1300 },
      { type: "drop", tiles: "a" },
      { type: "pop", tiles: "b", dir: "up", zone: [23, 1, 23, 11], duration: 0.8 },
      { type: "reverse", zone: [14, 1, 14, 11], duration: 0.5, text: "\"USE A DIFFERENT LANGUAGE\"" },
    ],
    altSigns: [{ x: 19, y: 6, text: "now do it in O(1)" }],
  },
  {
    name: "System Design",
    map: build((b) => {
      b.set(2, 11, "S").set(27, 11, "E");
      b.pit(7, 24);
      b.rect(10, 10, 10, ROWS - 1, "#").rect(14, 10, 14, ROWS - 1, "#").rect(18, 10, 18, ROWS - 1, "#");
      b.set(21, 10, "f").rect(21, 11, 21, ROWS - 1, "f");
      b.rect(25, 1, 26, 2, "c");
    }),
    traps: [
      { type: "reverse", zone: [10, 1, 10, 9], text: "SCALE TO 1B USERS. PIVOT!" },
      { type: "flaky", tiles: "f", on: 1.2, off: 0.8, phase: 0.5 },
      { type: "crush", tiles: "c", zone: [21, 1, 21, 9], delay: 0.1, speed: 1000 },
    ],
    signs: [
      { x: 5, y: 7, text: "draw some boxes" },
      { x: 20, y: 8, text: "load balancer" },
      { x: 24, y: 4, text: "single point of failure" },
    ],
  },
  {
    name: "Hiring Manager",
    map: build((b) => {
      b.set(2, 11, "S").set(27, 11, "E");
      b.set(8, 11, "^");
      b.pit(14, 15).rect(14, 12, 15, ROWS - 1, "a");
      b.set(17, 11, "^").rect(21, 11, 22, 11, "^");
      b.rect(19, 1, 20, 2, "c");
    }),
    traps: [
      {
        type: "dialog", zone: [12, 1, 13, 11], rect: [14, 4, 15, 9], duration: 2.6,
        title: "hiring manager",
        lines: ["tell me about a time", "you failed.", "", "(take your time.)"],
      },
      { type: "teleport", zone: [25, 1, 25, 11], text: "ROLE RE-SCOPED. RE-APPLY!" },
      // It gets worse every time you come back.
      { type: "crush", tiles: "c", zone: [18, 1, 18, 11], delay: 0.1, speed: 1100, minDeaths: 1 },
      { type: "drop", tiles: "a", minDeaths: 2 },
    ],
    signs: [
      { x: 5, y: 8, text: "\"we're like a family\"" },
      { x: 15, y: 8, text: "budget review" },
    ],
  },
  {
    name: "CEO / CTO",
    map: build((b) => {
      b.set(2, 11, "S").set(27, 11, "E");
      b.pit(6, 8);
      b.rect(13, 10, 14, 11, "#");
      b.rect(16, 11, 17, 11, "b");
      b.pit(19, 21);
      b.rect(23, 1, 24, 2, "c");
    }),
    traps: [
      { type: "chase", speed: 100, delay: 0.8, label: "BOARD MEETING" },
      {
        type: "dialog", zone: [9, 1, 10, 11], rect: [8, 3, 13, 6], duration: 2.0,
        title: "CEO",
        lines: ["why should we hire you", "instead of an AI agent?"],
      },
      { type: "pop", tiles: "b", dir: "up", zone: [14, 1, 14, 11], duration: 0.5 },
      { type: "crush", tiles: "c", zone: [22, 1, 22, 11], delay: 0.05, speed: 1200 },
      { type: "reverse", zone: [25, 1, 25, 11], duration: 0.6, text: "CTO: \"ACTUALLY, USE RUST\"" },
    ],
    signs: [{ x: 18, y: 7, text: "culture fit check" }],
  },
  {
    name: "On-site Interview",
    theme: "outdoor",
    door: "OFFER",
    flaky: ["WALK", "HURRY", "STOP"],
    map: build((b) => {
      b.set(2, 11, "S").set(23, 11, "E");
      b.pit(6, 13);
      b.rect(8, 12, 9, 12, "f").rect(11, 12, 12, 12, "g");
      b.pit(16, 17).rect(16, 12, 17, ROWS - 1, "a");
      b.rect(20, 11, 21, 11, "b");
      b.rect(25, 10, 28, 10, "#");
    }),
    traps: [
      { type: "chase", speed: 105, delay: 1.2, label: "RUNNING LATE" },
      { type: "flaky", tiles: "f", on: 1.0, off: 0.8, phase: 0.4 },
      { type: "flaky", tiles: "g", on: 1.0, off: 0.8, phase: 0.9 },
      { type: "drop", tiles: "a" },
      { type: "pop", tiles: "b", dir: "up", zone: [18, 1, 19, 11], duration: 0.8 },
      { type: "flee", radius: 3, to: [[27, 9]] },
      { type: "reverse", zone: [24, 1, 25, 11], duration: 0.7, text: "MAPS: RECALCULATING..." },
    ],
    signs: [
      { x: 4, y: 7, text: "in-person. 9am sharp." },
      { x: 10, y: 8, text: "crosswalk" },
      { x: 17, y: 9, text: "construction" },
    ],
  },
];
