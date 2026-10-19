// Props for the scenes: animals, plants, shelters and objects, drawn as silhouettes.
import { TAU, lerp, hash, alpha, mix } from './art.js';

// lion seen from the side, facing right; phase animates the walk
export function lion(ctx, x, y, s, color, phase = 0, walking = 1) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  // body
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.5, s * 0.55, s * 0.2, 0, 0, TAU); ctx.fill();
  // legs
  ctx.lineWidth = s * 0.1;
  for (const [lx, ph] of [[-0.42, 0], [-0.3, Math.PI], [0.32, Math.PI], [0.44, 0]]) {
    const sw = Math.sin(phase + ph) * 0.12 * walking;
    ctx.beginPath(); ctx.moveTo(x + s * lx, y - s * 0.45); ctx.lineTo(x + s * (lx + sw), y - s * 0.03); ctx.stroke();
  }
  // tail
  ctx.lineWidth = s * 0.035; ctx.beginPath(); ctx.moveTo(x - s * 0.52, y - s * 0.56);
  ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.5 + Math.sin(phase * 0.7) * s * 0.06, x - s * 0.82, y - s * 0.28); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - s * 0.82, y - s * 0.26, s * 0.05, 0, TAU); ctx.fill();
  // mane and head
  ctx.beginPath(); ctx.ellipse(x + s * 0.5, y - s * 0.66, s * 0.22, s * 0.25, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + s * 0.7, y - s * 0.62, s * 0.13, s * 0.1, 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + s * 0.5, y - s * 0.88, s * 0.05, 0, TAU); ctx.fill();
}

// a broad fruit tree with round fruits; fruits: array of {dx, dy, on}
export function fruitTree(ctx, x, y, s, color, fruitColor, fruits = []) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.04, y - s * 0.4, x, y - s * 0.62); ctx.stroke();
  ctx.lineWidth = s * 0.045;
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x, y - s * 0.55); ctx.quadraticCurveTo(x + d * s * 0.18, y - s * 0.7, x + d * s * 0.3, y - s * 0.78); ctx.stroke(); }
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI;
    const cx = x + Math.cos(a) * s * 0.36, cy = y - s * 0.86 - Math.sin(a) * s * 0.2, r = s * (0.2 + hash(i * 3.3) * 0.08);
    ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU);
  }
  ctx.fill();
  for (const f of fruits) { if (!f.on) continue; ctx.fillStyle = fruitColor; ctx.beginPath(); ctx.arc(x + f.dx * s, y + f.dy * s, s * 0.045, 0, TAU); ctx.fill(); }
}

// a dome hut of grass and branches
export function hut(ctx, x, y, w, color, light = null) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x - w / 2, y); ctx.bezierCurveTo(x - w / 2, y - w * 0.62, x + w / 2, y - w * 0.62, x + w / 2, y); ctx.closePath(); ctx.fill();
  if (light) { ctx.fillStyle = light; ctx.beginPath(); ctx.moveTo(x - w * 0.09, y); ctx.bezierCurveTo(x - w * 0.09, y - w * 0.2, x + w * 0.09, y - w * 0.2, x + w * 0.09, y); ctx.fill(); }
}

// a camp fire: flickering flames with a warm glow
export function fire(ctx, x, y, s, t, glowColor = '#FFB24A') {
  const g = ctx.createRadialGradient(x, y - s * 0.3, 0, x, y - s * 0.3, s * 4);
  g.addColorStop(0, alpha(glowColor, 0.55)); g.addColorStop(0.4, alpha(glowColor, 0.16)); g.addColorStop(1, alpha(glowColor, 0));
  ctx.fillStyle = g; ctx.fillRect(x - s * 4, y - s * 4.3, s * 8, s * 8);
  for (const [dx, k, c] of [[-0.25, 0.85, '#E8641E'], [0.22, 0.75, '#E8641E'], [0, 1.15, '#FF9F2E'], [-0.05, 0.7, '#FFD36B']]) {
    const fl = 1 + Math.sin(t * 9 + dx * 20) * 0.12 + Math.sin(t * 14.3 + dx * 7) * 0.08;
    const hh = s * k * fl;
    ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(x + dx * s - s * 0.28, y);
    ctx.quadraticCurveTo(x + dx * s - s * 0.3, y - hh * 0.55, x + dx * s + Math.sin(t * 6 + dx) * s * 0.08, y - hh);
    ctx.quadraticCurveTo(x + dx * s + s * 0.3, y - hh * 0.55, x + dx * s + s * 0.28, y);
    ctx.fill();
  }
  ctx.strokeStyle = '#2A1E18'; ctx.lineWidth = s * 0.12; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.45, y + s * 0.02); ctx.lineTo(x + s * 0.4, y - s * 0.08); ctx.moveTo(x - s * 0.35, y - s * 0.08); ctx.lineTo(x + s * 0.45, y + s * 0.02); ctx.stroke();
}

// a carcass with circling flies
export function carcass(ctx, x, y, s, color, t) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y - s * 0.12, s * 0.5, s * 0.14, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = s * 0.05; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - s * 0.3 + i * s * 0.2, y - s * 0.2); ctx.lineTo(x - s * 0.25 + i * s * 0.2, y - s * 0.36); ctx.stroke(); }
  ctx.fillStyle = alpha(color, 0.9);
  for (let i = 0; i < 6; i++) { const a = t * (2 + i * 0.3) + i; ctx.beginPath(); ctx.arc(x + Math.cos(a) * s * (0.3 + i * 0.04), y - s * 0.45 + Math.sin(a * 1.3) * s * 0.15, Math.max(0.8, s * 0.025), 0, TAU); ctx.fill(); }
}

// a stone that can be rolled
export function stone(ctx, x, y, r, color, rot = 0) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i <= 10; i++) { const a = rot + (i / 10) * TAU; const rr = r * (0.88 + hash(i * 2.3) * 0.18); ctx.lineTo(x + Math.cos(a) * rr, y - r + Math.sin(a) * rr); }
  ctx.fill();
}

// pulsing rings: a signal that is on
export function signal(ctx, x, y, r, t, on, color = '#FFB13B') {
  if (on <= 0) return;
  for (let k = 0; k < 3; k++) {
    const u = ((t * 0.9 + k / 3) % 1);
    const rr = r * (0.35 + u * 1.1);
    ctx.strokeStyle = alpha(color, on * (1 - u) * 0.85); ctx.lineWidth = Math.max(1.2, r * 0.06 * (1 - u * 0.5));
    ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.55);
  g.addColorStop(0, alpha(color, 0.45 * on)); g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, TAU); ctx.fill();
}

// ---------- ancestors for the deep-time procession (all face right, feet or belly at y) ----------
export function worm(ctx, x, y, s, color, t) {
  ctx.strokeStyle = color; ctx.lineCap = 'round';
  const n = 14;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const px = x - s * 0.5 + u * s, py = y - s * 0.12 + Math.sin(t * 4 - u * 7) * s * 0.07;
    ctx.lineWidth = s * (0.11 - Math.abs(u - 0.55) * 0.08);
    if (i) { ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(px, py); ctx.stroke(); }
    var prev = [px, py];
  }
}
export function fish(ctx, x, y, s, color, t) {
  const w = Math.sin(t * 5) * 0.12;
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y);
  ctx.bezierCurveTo(x + s * 0.3, y - s * 0.24, x - s * 0.2, y - s * 0.22, x - s * 0.38, y + w * s * 0.3);
  ctx.bezierCurveTo(x - s * 0.2, y + s * 0.2, x + s * 0.3, y + s * 0.2, x + s * 0.5, y);
  ctx.fill();
  // tail
  ctx.beginPath(); ctx.moveTo(x - s * 0.34, y + w * s * 0.3);
  ctx.lineTo(x - s * 0.62, y - s * 0.2 + w * s); ctx.lineTo(x - s * 0.56, y + w * s * 0.4); ctx.lineTo(x - s * 0.62, y + s * 0.2 + w * s); ctx.closePath(); ctx.fill();
  // fins
  ctx.beginPath(); ctx.moveTo(x, y - s * 0.17); ctx.lineTo(x - s * 0.14, y - s * 0.33); ctx.lineTo(x - s * 0.16, y - s * 0.16); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.12); ctx.lineTo(x - s * 0.02, y + s * 0.26 + w * s * 0.2); ctx.lineTo(x - s * 0.04, y + s * 0.12); ctx.fill();
}
function quadruped(ctx, x, y, s, color, t, o) {
  const { bodyL, bodyH, legL, headR, neck, tail, sprawl = 0, gait = 6, tailUp = 0, snout = 0, thickTail = 0 } = o;
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  const by = y - legL * s - bodyH * s * 0.5;
  // legs
  ctx.lineWidth = Math.max(1, s * 0.05);
  for (const [lx, ph] of [[-0.36, 0], [-0.22, Math.PI], [0.24, Math.PI], [0.36, 0]]) {
    const sw = Math.sin(t * gait + ph) * 0.1;
    const hx = x + lx * bodyL * s, hy = by + bodyH * s * 0.25;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    if (sprawl) { ctx.lineTo(hx + sw * s, hy + legL * s * 0.4); ctx.lineTo(hx + (sw + 0.06) * s, y); }
    else ctx.lineTo(hx + sw * s, y);
    ctx.stroke();
  }
  // body
  ctx.beginPath(); ctx.ellipse(x, by, bodyL * s * 0.5, bodyH * s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // head
  const hx = x + bodyL * s * 0.5 + neck * s, hy = by - bodyH * s * 0.15;
  ctx.beginPath(); ctx.ellipse(hx, hy, headR * s * 1.25, headR * s, 0.1, 0, Math.PI * 2); ctx.fill();
  if (snout) { ctx.beginPath(); ctx.moveTo(hx + headR * s, hy - headR * s * 0.5); ctx.lineTo(hx + headR * s * 2.3, hy + headR * s * 0.2); ctx.lineTo(hx + headR * s * 0.6, hy + headR * s * 0.7); ctx.fill(); ctx.beginPath(); ctx.arc(hx - headR * s * 0.2, hy - headR * s * 0.9, headR * s * 0.35, 0, Math.PI * 2); ctx.fill(); }
  ctx.lineWidth = bodyH * s * 0.6; ctx.beginPath(); ctx.moveTo(x + bodyL * s * 0.35, by - bodyH * s * 0.05); ctx.lineTo(hx - headR * s * 0.5, hy); ctx.stroke();
  // tail
  ctx.lineWidth = Math.max(1, s * (thickTail ? 0.07 : 0.04));
  ctx.beginPath(); ctx.moveTo(x - bodyL * s * 0.48, by);
  if (thickTail) { // a primate tail: down, back and curling up
    const rx = x - bodyL * s * 0.48, sw = Math.sin(t * 1.5) * s * 0.03;
    ctx.bezierCurveTo(rx - tail * s * 0.5, by + bodyH * s * 0.9, rx - tail * s * 1.05, by + sw, rx - tail * s * 0.85, by - tailUp * s + sw);
  } else ctx.quadraticCurveTo(x - bodyL * s * 0.5 - tail * s * 0.5, by - tailUp * s + Math.sin(t * 2) * s * 0.03, x - bodyL * s * 0.5 - tail * s, by + bodyH * s * 0.2 - tailUp * s * 1.4);
  ctx.stroke();
}
export const salamander = (ctx, x, y, s, c, t) => quadruped(ctx, x, y, s, c, t, { bodyL: 0.6, bodyH: 0.11, legL: 0.05, headR: 0.065, neck: 0.03, tail: 0.45, sprawl: 1, gait: 3 });
export const lizard = (ctx, x, y, s, c, t) => quadruped(ctx, x, y, s, c, t, { bodyL: 0.5, bodyH: 0.12, legL: 0.1, headR: 0.06, neck: 0.07, tail: 0.75, sprawl: 1, gait: 7 });
export const shrew = (ctx, x, y, s, c, t) => quadruped(ctx, x, y, s, c, t, { bodyL: 0.42, bodyH: 0.24, legL: 0.07, headR: 0.085, neck: 0.02, tail: 0.3, gait: 12, snout: 1, fur: 1 });
export const lemur = (ctx, x, y, s, c, t) => quadruped(ctx, x, y, s, c, t, { bodyL: 0.46, bodyH: 0.19, legL: 0.27, headR: 0.09, neck: 0.05, tail: 0.5, tailUp: 0.45, gait: 6, thickTail: 1 });
