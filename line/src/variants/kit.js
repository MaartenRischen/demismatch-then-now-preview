// Shared kit for the variants gallery: the line prototype's own drawing code, plus a few helpers.
import { TAU, clamp, lerp, smooth, easeInOut, mix, alpha, hash, fbm, glow, acacia, bush, grass, ridge, mountains, offscreen, sun, bird } from '../../../v4/src/art.js';
import { drawFigure, drawLying, POSES, body, walkPose } from '../../../v4/src/figure.js';
import { fire, signal, lion, hut } from '../../../v4/src/props.js';
import { drawFrameScene } from '../frame.js';
import { createScene } from '../scene.js';

export { TAU, clamp, lerp, smooth, easeInOut, mix, alpha, hash, fbm, glow, acacia, bush, grass, ridge, mountains, offscreen, sun, bird };
export { drawFigure, drawLying, POSES, body, walkPose, fire, signal, lion, hut, drawFrameScene, createScene };

export const C = {
  oxblood: '#3a1218', deep: '#2a0c11', oxInk: '#4a1e26', parch: '#ece0c4', parchSoft: '#f2e8cf', tan: '#c4b894',
  ink: '#1a0608', teal: '#2d6b6b', gold: '#c4962c', muted: '#8a7d5e', you: '#C41A14', youB: '#E0201A', sig: '#E2A93A', fig: '#16141c',
  night: '#0b0d1a', screen: '#BFD8FF', fireGlow: '#FF9A3C',
};
export const G = { hero: 5953, ice: 3180, lake: 5597, coast: 1094, wood: 3980, lakeDusk: 2187, village: 378, dusk: 5891 };
export const HEAD = ['Being pushed out of the group used to be deadly.', 'Being left out still hurts, even by strangers.'];
export const SRC = 'Williams et al. 2000; Hartgerink et al. 2015';
export const ANC = 'His people were around him every day.';
export const YOU = 'You see yours when agendas allow.';
export const yearsAgo = (g) => { const y = g * 27; return (y >= 10000 ? Math.round(y / 1000) * 1000 : Math.round(y / 100) * 100).toLocaleString('en-US') + ' years ago'; };

// The prototype's scene for one person (g > 0: an ancestor's world, g = 0: yours), drawn to cover a box.
// Scenes are composed for roughly 16:9, so they render at that shape off screen and get cropped to the box.
export function sceneCover(S, slot, c, x, y, w, h, g, t, { aspect = 1.78, u = 0.5, mr = null, ax = 0.5, ay = 0.5, beat = 'lonely' } = {}) {
  const dpr = c.getTransform().a;
  let sw = w, sh = w / aspect;
  if (sh < h) { sh = h; sw = h * aspect; }
  sw = Math.round(sw); sh = Math.round(sh);
  const key = 'sc:' + slot, b = S[key];
  if (!b || b.w !== sw || b.h !== sh || b.dpr !== dpr) S[key] = { ...offscreen(sw, sh, dpr), w: sw, h: sh, dpr };
  const B = S[key];
  B.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); B.ctx.clearRect(0, 0, sw, sh);
  drawFrameScene(B.ctx, sw, sh, beat, g, t, u, false, mr);
  if (typeof ax === 'function') ax = ax(null, sw, w);
  const ox = (sw - w) * ax, oy = (sh - h) * ay;
  c.drawImage(B.c, ox * dpr, oy * dpr, w * dpr, h * dpr, x, y, w, h);
  return B;
}

// Any painter, drawn to cover a box the same way: paint(ctx, w, h) at a 16:9-ish size, cropped to the box.
export function coverWith(S, slot, c, x, y, w, h, paint, { aspect = 1.78, ax = 0.5, ay = 0.5 } = {}) {
  const dpr = c.getTransform().a;
  let sw = w, sh = w / aspect;
  if (sh < h) { sh = h; sw = h * aspect; }
  sw = Math.round(sw); sh = Math.round(sh);
  const key = 'cw:' + slot, b = S[key];
  if (!b || b.w !== sw || b.h !== sh || b.dpr !== dpr) S[key] = { ...offscreen(sw, sh, dpr), w: sw, h: sh, dpr };
  const B = S[key];
  B.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); B.ctx.clearRect(0, 0, sw, sh);
  const r = paint(B.ctx, sw, sh);
  if (typeof ax === 'function') ax = ax(r, sw, w);
  c.drawImage(B.c, (sw - w) * ax * dpr, (sh - h) * ay * dpr, w * dpr, h * dpr, x, y, w, h);
}

// The whole line of 11,100 generations, from the prototype's scene renderer.
export function lineScene(S, W, H, ground = 0.64) {
  const dpr = 1.25;
  if (!S.line || S.lineW !== W || S.lineH !== H) { S.line = createScene({ ground }); S.line.resize(W, H, dpr); S.lineW = W; S.lineH = H; }
  return S.line;
}

// cached static layer: paint(ctx) runs once per size
export function cached(S, key, w, h, dpr, paint) {
  const k = key + ':' + w + 'x' + h + '@' + dpr;
  if (!S[k]) { const o = offscreen(w, h, dpr); paint(o.ctx, w, h); S[k] = o.c; }
  return S[k];
}

// a figure with sane defaults
export function fig(c, x, y, h, o = {}) {
  drawFigure(c, x, y, h, { pose: POSES.stand, body: body(o.seed ?? 0), color: C.fig, ...o });
}

// a seated circle around a point, side-on: back row smaller, front row larger; returns their head positions
export function ring(c, cx, gy, R, n, fh, t, { color = C.fig, skip = -1, rim = null, seed = 0 } = {}) {
  const heads = [];
  const order = [...Array(n).keys()].map((i) => ({ i, a: (i / n) * TAU + 0.3 })).sort((p, q) => Math.sin(p.a) - Math.sin(q.a));
  for (const { i, a } of order) {
    if (i === skip) continue;
    const depth = Math.sin(a), x = cx + Math.cos(a) * R, y = gy + depth * R * 0.22, s = fh * (0.86 + depth * 0.14);
    const facing = Math.cos(a) > 0.2 ? -1 : Math.cos(a) < -0.2 ? 1 : 0;
    fig(c, x, y, s, { pose: POSES.sitFire, facing: facing || (i % 2 ? 1 : -1), body: body(seed + i * 7), color });
    if (rim) glow(c, x - Math.cos(a) * s * 0.1, y - s * 0.45, s * 0.5, rim, 0.18);
    heads.push([x, y - s * 0.62]);
  }
  return heads;
}

// night sky with stars, and a ground line
export function nightLand(c, w, h, gy, { stars = 160, seed = 1, warm = 0 } = {}) {
  const g = c.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, '#060A1E'); g.addColorStop(0.7, '#121A3C'); g.addColorStop(1, mix('#28305A', '#5A3A3A', warm));
  c.fillStyle = g; c.fillRect(0, 0, w, gy + 1);
  for (let i = 0; i < stars; i++) { const a = 0.3 + hash(i * 3.3 + seed) * 0.6; c.fillStyle = alpha('#F2ECFF', a); c.fillRect(hash(i * 1.7 + seed) * w, hash(i * 5.9 + seed) * gy * 0.95, hash(i) < 0.9 ? 1 : 1.8, hash(i) < 0.9 ? 1 : 1.8); }
  ridge(c, 0, w, gy, mountains(seed * 3, w * 0.18, h * 0.07, 1.4), '#151A32');
  const gg = c.createLinearGradient(0, gy, 0, h); gg.addColorStop(0, '#2A2834'); gg.addColorStop(1, '#0C0A12');
  c.fillStyle = gg; c.fillRect(0, gy, w, h - gy);
}

// top-down person: shoulders and head, facing angle a
export function topPerson(c, x, y, s, a, color, rim = null) {
  c.save(); c.translate(x, y); c.rotate(a);
  // shoulders across, arms resting forward, a round head on top
  c.fillStyle = color;
  c.beginPath(); c.roundRect(-s * 0.16, -s * 0.46, s * 0.32, s * 0.92, s * 0.16); c.fill();
  c.beginPath(); c.roundRect(0, -s * 0.42, s * 0.34, s * 0.12, s * 0.06); c.fill();
  c.beginPath(); c.roundRect(0, s * 0.3, s * 0.34, s * 0.12, s * 0.06); c.fill();
  c.fillStyle = mix(color, '#000000', 0.35); c.beginPath(); c.arc(s * 0.02, 0, s * 0.2, 0, TAU); c.fill();
  if (rim) { c.strokeStyle = rim; c.lineWidth = Math.max(1, s * 0.05); c.beginPath(); c.arc(s * 0.02, 0, s * 0.2, -1.1, 1.1); c.stroke(); c.beginPath(); c.moveTo(s * 0.16, -s * 0.3); c.lineTo(s * 0.16, s * 0.3); c.stroke(); }
  c.restore();
}

// a computer screen (the Cyberball ball-toss game): two players throwing only to each other
export function cyberball(c, x, y, w, h, t, { pixel = false, bg = '#F4F4F0', ink = '#2A2A30', youCol = C.you, labels = true } = {}) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.fillStyle = bg; c.fillRect(x, y, w, h);
  const P = [[x + w * 0.2, y + h * 0.36], [x + w * 0.8, y + h * 0.36], [x + w * 0.5, y + h * 0.86]];
  const s = h * 0.32;
  const player = (px, py, col, face) => {
    if (pixel) {
      const u = Math.max(2, Math.round(s / 9)); c.fillStyle = col;
      const m = ['..XXX..', '..XXX..', '...X...', 'XXXXXXX', '..XXX..', '..XXX..', '..X.X..', '.XX.XX.'];
      m.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') c.fillRect(Math.round(px - u * 3.5 + i * u), Math.round(py - s * 0.9 + j * u), u, u); }));
    } else fig(c, px, py, s, { pose: POSES.stand, facing: face, color: col, body: body(face + 3) });
  };
  player(P[0][0], P[0][1], ink, 1); player(P[1][0], P[1][1], ink, -1); player(P[2][0], P[2][1], youCol, 0);
  // the ball: back and forth between the two, never down to you
  const per = 1.3, k = (t / per) % 2, fwd = k < 1, u = easeInOut(fwd ? k : k - 1);
  const [a, b] = fwd ? [P[0], P[1]] : [P[1], P[0]];
  const bx = lerp(a[0] + (fwd ? s * 0.25 : -s * 0.25), b[0] + (fwd ? -s * 0.25 : s * 0.25), u), by = lerp(a[1], b[1], u) - s * 0.55 - Math.sin(u * Math.PI) * h * 0.16;
  c.fillStyle = pixel ? ink : '#2A2A30';
  if (pixel) { const q = Math.max(3, Math.round(s / 7)); c.fillRect(Math.round(bx - q / 2), Math.round(by - q / 2), q, q); }
  else { c.beginPath(); c.arc(bx, by, h * 0.025, 0, TAU); c.fill(); }
  if (labels) {
    const fs = Math.max(7, h * 0.05);
    c.font = pixel ? `${fs * 1.4}px VT323, monospace` : `500 ${fs}px "JetBrains Mono", monospace`; c.textAlign = 'center';
    ['Player 1', 'Player 2', 'You'].forEach((n, i) => { c.fillStyle = i === 2 ? youCol : ink; c.fillText(n, P[i][0], P[i][1] + fs * 1.3); });
    c.textAlign = 'left';
  }
  c.restore();
  return { you: P[2], s };
}

// the gold "signal" rings
export const rings = (c, x, y, r, t, on = 1) => signal(c, x, y, r, t, on, C.sig);

// film grain, light
export function grain(c, w, h, t, a = 0.05) {
  const n = Math.floor(w * h / 900);
  for (let i = 0; i < n; i++) { const v = hash(i * 1.37 + Math.floor(t * 12) * 0.71); c.fillStyle = v > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`; c.fillRect(hash(i * 2.11 + Math.floor(t * 12)) * w, hash(i * 3.73 + Math.floor(t * 12) * 1.3) * h, 1.2, 1.2); }
}

// the house card around a scene: parchment edge, teal and gold offset shadows
export function card(c, x, y, w, h, { red = false, o = 6, r = 10 } = {}) {
  c.fillStyle = '#C4962C'; c.beginPath(); c.roundRect(x - 4 + o * 2, y - 4 + o * 2, w + 8, h + 8, r + 3); c.fill();
  c.fillStyle = '#2D6B6B'; c.beginPath(); c.roundRect(x - 4 + o, y - 4 + o, w + 8, h + 8, r + 3); c.fill();
  c.fillStyle = red ? C.you : '#ECE0C4'; c.beginPath(); c.roundRect(x - 4, y - 4, w + 8, h + 8, r + 3); c.fill();
}
export function tag(c, x, y, text, red = false, size = 11) {
  c.save(); c.font = `600 ${size}px "JetBrains Mono", monospace`; c.letterSpacing = size * 0.22 + 'px';
  const tw = c.measureText(text).width;
  c.fillStyle = red ? 'rgba(196,26,20,0.92)' : 'rgba(42,12,17,0.78)'; c.beginPath(); c.roundRect(x, y, tw + size * 1.6, size * 2.1, 4); c.fill();
  c.fillStyle = '#F2E8CF'; c.fillText(text, x + size * 0.8, y + size * 1.45); c.restore();
}
