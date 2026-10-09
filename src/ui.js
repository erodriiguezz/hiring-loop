// HUD, overlays, taunts and menus, drawn in the logical view. Menus return their buttons as
// rects so taps and clicks can hit them.
import { TILE, VIEW_W, VIEW_H, COLORS as C } from "./config.js";
import { FONT, drawCandidate, drawWallTile, drawSpikes, drawDoor } from "./render.js";

const fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;

function panel(ctx, x, y, w, h, fill = C.panel, stroke = C.ecto) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = stroke;
  ctx.fillRect(x, y, w, 4); ctx.fillRect(x, y + h - 4, w, 4);
  ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
}

function text(ctx, s, x, y, size, color = C.text, align = "center", weight = "bold") {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillText(s, x + 2, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// 7x5 pixel envelope for the rejection counter.
const ENVELOPE = ["ooooooo", "oo...oo", "o.o.o.o", "o..o..o", "ooooooo"];
function drawEnvelope(ctx, x, y, px = 4) {
  ctx.fillStyle = C.danger;
  ENVELOPE.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === "o") ctx.fillRect(x + c * px, y + r * px, px, px); }));
}

export function drawHud(ctx, { index, total, name, deaths, time }) {
  ctx.fillStyle = "rgba(13,19,32,0.8)";
  ctx.fillRect(0, 0, VIEW_W, 36);
  text(ctx, `ROUND ${index + 1}/${total}`, 16, 18, 16, C.ecto, "left");
  text(ctx, name.toUpperCase(), 156, 18, 16, C.text, "left");
  const label = String(deaths);
  ctx.font = `bold 28px ${FONT}`;
  const w = ctx.measureText(label).width;
  drawEnvelope(ctx, VIEW_W - 26 - w - 34, 8);
  text(ctx, label, VIEW_W - 18, 19, 28, C.text, "right");
  text(ctx, `rejections · ${fmtTime(time)}`, VIEW_W - 18, 48, 12, C.dim, "right", "normal");
}

export function drawBanner(ctx, s) {
  ctx.font = `bold 22px ${FONT}`;
  const w = ctx.measureText(s).width + 48;
  panel(ctx, (VIEW_W - w) / 2, 70, w, 48, C.panel, C.danger);
  text(ctx, s, VIEW_W / 2, 95, 22, C.text);
}

export function drawDialog(ctx, d) {
  const [tx, ty, tw, th] = d.rect;
  const x = tx * TILE, y = ty * TILE, w = tw * TILE, h = th * TILE;
  ctx.fillStyle = "#1a212c";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#c93a4f";
  ctx.fillRect(x, y, w, 36);
  ctx.fillStyle = "#3a4656";
  ctx.fillRect(x, y + h - 4, w, 4); ctx.fillRect(x, y, 4, h); ctx.fillRect(x + w - 4, y, 4, h);
  text(ctx, `/!\\ ${d.title}`, x + 16, y + 18, 18, "#fff", "left");
  text(ctx, "x", x + w - 22, y + 18, 18, "#fff");
  d.lines.forEach((line, i) => text(ctx, line, x + 24, y + 70 + i * 28, 18, C.text, "left", "normal"));
  const k = 1 - d.t / d.total;
  const bx = x + 24, by = y + h - 56, bw = w - 48;
  ctx.fillStyle = "#0b1016";
  ctx.fillRect(bx, by, bw, 20);
  ctx.fillStyle = C.ecto;
  ctx.fillRect(bx + 4, by + 4, Math.floor(((bw - 8) * k) / 8) * 8, 12);
  text(ctx, `${Math.floor(k * 100)}%`, bx + bw - 6, by + 10, 11, C.text, "right");
}

export function drawTaunt(ctx, s, x, y) {
  ctx.font = `bold 15px ${FONT}`;
  const w = Math.min(ctx.measureText(s).width + 24, 560);
  const bx = Math.max(8, Math.min(VIEW_W - w - 8, x - w / 2)), by = y - 64;
  ctx.fillStyle = C.text;
  ctx.fillRect(bx, by, w, 32);
  ctx.fillRect(Math.max(bx + 8, Math.min(bx + w - 16, x - 4)), by + 32, 8, 8);
  ctx.fillStyle = "#0d1320";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(s, bx + w / 2, by + 17);
}

function button(ctx, b, selected) {
  panel(ctx, b.x, b.y, b.w, b.h, selected ? "#16294a" : C.panel, selected ? C.ecto : C.wallEdge);
  text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, 20, selected ? C.ecto : C.text);
}

function menu(ctx, labels, sel, top) {
  const w = 300, h = 52, gap = 14;
  return labels.map((label, i) => {
    const b = { x: (VIEW_W - w) / 2, y: top + i * (h + gap), w, h, label, i };
    button(ctx, b, i === sel);
    return b;
  });
}

// Title: a little live scene, not a flat card.
export function drawTitle(ctx, t, info) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, C.bgTop); g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const ground = 13;
  const dropping = (t % 4) > 2.4; // a floor tile that keeps falling away, of course
  const drop = dropping ? Math.min(400, ((t % 4) - 2.4) ** 2 * 900) : 0;
  for (let tx = 0; tx < 30; tx++) {
    for (let ty = ground; ty < 17; ty++) {
      const isTrap = tx === 20 && ty === ground;
      const o = { up: ty === ground, down: false, left: false, right: false };
      drawWallTile(ctx, tx * TILE, ty * TILE + (isTrap ? drop : 0), tx, ty, o);
    }
  }
  drawSpikes(ctx, 7 * TILE, (ground - 1) * TILE, "up");
  drawDoor(ctx, 26, ground - 1, t);
  const gx = 14 * TILE + Math.sin(t * 0.9) * 120;
  drawCandidate(ctx, gx, (ground - 2) * TILE - 0, { face: Math.cos(t * 0.9) > 0 ? 1 : -1, t, scale: 2, walking: true });

  text(ctx, info.title.toUpperCase(), VIEW_W / 2, 118, 72, C.ecto);
  text(ctx, "8 interview rounds. 1 open role. 4,000 applicants.", VIEW_W / 2, 178, 16, C.dim, "center", "normal");
  if (Math.floor(t * 2) % 2 === 0) text(ctx, info.prompt, VIEW_W / 2, 236, 20, C.text);
  if (info.sub) text(ctx, info.sub, VIEW_W / 2, 268, 14, C.dim, "center", "normal");
}

export function drawPause(ctx, sel) {
  ctx.fillStyle = "rgba(5,10,15,0.7)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, "PAUSED", VIEW_W / 2, 140, 44, C.ecto);
  return menu(ctx, ["Resume", "Restart round", "Withdraw application"], sel, 200);
}

export function drawClear(ctx, s) {
  ctx.fillStyle = "rgba(5,10,15,0.6)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(ctx, 240, 120, 480, 280);
  text(ctx, "MOVING FORWARD", VIEW_W / 2, 164, 40, C.pass);
  text(ctx, s.next, VIEW_W / 2, 200, 14, C.dim, "center", "normal");
  text(ctx, `rejections  ${s.deaths}`, VIEW_W / 2, 236, 22);
  text(ctx, `time        ${fmtTime(s.time)}`, VIEW_W / 2, 268, 22);
  text(ctx, s.best, VIEW_W / 2, 304, 14, C.dim, "center", "normal");
  if (s.ready) text(ctx, s.prompt, VIEW_W / 2, 360, 18, C.text);
}

export function drawFinish(ctx, s, t) {
  ctx.fillStyle = "rgba(5,10,15,0.85)";
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  text(ctx, "YOU'RE HIRED!", VIEW_W / 2, 112, 56, C.pass);
  text(ctx, "offer letter attached. start date: TBD. 90-day probation.", VIEW_W / 2, 166, 16, C.text, "center", "normal");
  text(ctx, `total rejections  ${s.deaths}`, VIEW_W / 2, 230, 24);
  text(ctx, `total time        ${fmtTime(s.time)}`, VIEW_W / 2, 266, 24);
  text(ctx, s.verdict, VIEW_W / 2, 320, 16, C.dim, "center", "normal");
  drawCandidate(ctx, VIEW_W / 2 - 28, 362 + Math.abs(Math.sin(t * 6)) * -14, { t, scale: 2 });
  if (s.ready) text(ctx, s.prompt, VIEW_W / 2, 480, 18, C.text);
}

// Drawn on the screen canvas in CSS pixels, not the logical view.
export function drawRotate(ctx, w, h, t) {
  ctx.fillStyle = C.bgTop;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2 - 40);
  ctx.rotate(-Math.PI / 2 * Math.min(1, Math.max(0, Math.sin(t * 2) * 1.2)));
  ctx.strokeStyle = C.ecto; ctx.lineWidth = 6;
  ctx.strokeRect(-30, -50, 60, 100);
  ctx.restore();
  ctx.fillStyle = C.text;
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.fillText("Turn your phone sideways", w / 2, h / 2 + 60);
  ctx.fillStyle = C.dim;
  ctx.font = `14px ${FONT}`;
  ctx.fillText("the job market is narrow enough.", w / 2, h / 2 + 88);
}
