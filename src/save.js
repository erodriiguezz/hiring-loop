// Local progress. Every version and regen of this game shares one origin, so keys are prefixed
// and versioned, and bad data falls back to a fresh save.
import { SLUG } from "./config.js";

const KEY = `${SLUG}:v1`;
const fresh = () => ({ v: 1, next: 0, totalDeaths: 0, totalTime: 0, best: {} });

export function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1 && typeof d.next === "number") return { ...fresh(), ...d, best: d.best || {} };
  } catch {}
  return fresh();
}

export function writeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
