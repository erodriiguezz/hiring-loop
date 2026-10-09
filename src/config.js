// Every tuning constant lives here. Units: pixels and seconds in the 960x544 logical view.

export const SLUG = "hiring-loop";

export const TILE = 32;
export const COLS = 30;
export const ROWS = 17;
export const VIEW_W = COLS * TILE; // 960
export const VIEW_H = ROWS * TILE; // 544

export const STEP = 1 / 120; // fixed physics step
export const MAX_FRAME = 0.1; // clamp long frames so a stall never teleports anything

export const PHYS = {
  W: 20, // player hitbox
  H: 24,
  RUN: 250,
  ACCEL: 2600,
  FRICTION: 3000,
  AIR_ACCEL: 1800,
  AIR_FRICTION: 700,
  GRAVITY: 2400,
  JUMP: 690, // apex ~99 px: clears a 2-tile ledge, not a 3-tile one
  JUMP_CUT: 0.45, // velocity kept when jump is released early
  MAX_FALL: 820,
  COYOTE: 0.09,
  BUFFER: 0.12,
};

export const RESPAWN_DELAY = 0.3;

// On-screen touch controls, in CSS pixels.
export const TOUCH = {
  GUTTER_MIN: 120, // side columns that hold the buttons, so they never cover play
  GUTTER_FRAC: 0.15,
  GUTTER_MAX: 200,
  TOP_FRAC: 0.3, // the upper part of each gutter holds pause / restart
  SMALL: 56, // pause and restart buttons
};

// Two looks: the office (rounds 1-7) and the outdoor commute to the on-site (round 8).
// COLORS is mutated in place by setTheme() so every drawing module picks up the current look.
export const THEMES = {
  office: {
    bgTop: "#0d1320",
    bgBottom: "#1b2333",
    window: "rgba(255,214,120,0.10)", // lit windows in the tower across the street
    wall: "#2a3142",
    wallDark: "#222838",
    wallEdge: "#3d4760",
    ecto: "#4ea1ff", // the corporate-blue lip on walkable tops
    spike: "#e6edf5",
    spikeDark: "#7d8a99",
    sign: "#7f93a8",
  },
  outdoor: {
    bgTop: "#5fb4e8",
    bgBottom: "#cfeaf7",
    window: "rgba(255,255,255,0.0)",
    wall: "#6b4a2f", // dirt
    wallDark: "#5a3d26",
    wallEdge: "#7d5a3b",
    ecto: "#5cc15a", // grass
    spike: "#ff8a2a", // traffic cones
    spikeDark: "#ffffff",
    sign: "#123049",
  },
};

export const COLORS = {
  ...THEMES.office,
  skin: "#f1c49b",
  hair: "#3b2618",
  suit: "#2f3f63",
  suitShade: "#24314d",
  shirt: "#f4f7fb",
  tie: "#e0384f",
  pants: "#1c2436",
  eye: "#0d1b26",
  danger: "#ff4d6d",
  door: "#f2a65a",
  doorDark: "#5a3a1e",
  text: "#eaf2f8",
  dim: "#7f93a8",
  pass: "#5be38f",
  fail: "#ff5c6c",
  panel: "rgba(13,19,32,0.92)",
};

let theme = "office";
export function setTheme(name) {
  if (name === theme || !THEMES[name]) return;
  theme = name;
  Object.assign(COLORS, THEMES[name]);
}
export const currentTheme = () => theme;
