// The scenes in the sky frame.
// Each ancestor shot is composed from its generation number: place and time (savanna, lake, woodland, coast, ice age,
// village; day, dusk, night), and how many people, their poses, where they stand, and what is around them.
// Your scene is a slice through a block of flats. A scan across the frame (mr.k from 0 to 1) swaps the world into yours.
import { TAU, clamp, lerp, smooth, easeInOut, mix, alpha, hash, fbm, glow, ridge, mountains, acacia, bush, poplar, grass, bird, antelope, offscreen, cloudSprite } from '../../v4/src/art.js';
import { drawFigure, drawLying, walkPose, POSES, body } from '../../v4/src/figure.js';
import { lion, hut, fire, signal, fruitTree } from '../../v4/src/props.js';

const RED = '#E0201A', RED2 = '#A0140F', SIG = '#E2A93A';
const GY = 0.885;   // where the people stand, as a fraction of frame height
const FH = 0.40;    // an adult standing, as a fraction of frame height

// ---------- the people in your world ----------
// x: fraction of width. mod: pose. mf: facing.
const STAGE = {
  lonely: [
    { x: 0.13, anc: 'carry', f: 1, mod: 'phone', mf: 1 },
    { x: 0.31, anc: 'sitFire', f: 1, focal: true, mod: 'slumpPhone', mf: 1 },
    { x: 0.56, anc: 'sitFire', f: -1, mod: 'slump', mf: -1 },
    { x: 0.71, anc: 'tell', f: -1, mod: 'phone', mf: -1 },
    { x: 0.87, anc: 'sitArm', f: -1, kind: 'child', mod: 'sitChair', mf: 1 },
  ],
  missed: [
    { x: 0.10, anc: 'walk', f: 1, torch: true, mod: 'walkPhone', mf: -1 },
    { x: 0.25, anc: 'walk', f: 1, mod: 'walkPhone', mf: -1 },
    { x: 0.40, anc: 'walk', f: 1, spear: true, mod: 'walkPhone', mf: -1 },
    { x: 0.55, anc: 'walk', f: 1, torch: true, mod: 'walkPhone', mf: -1 },
    { x: 0.82, anc: 'sitArm', f: -1, focal: true, mod: 'sitGround', mf: -1 },
  ],
  stress: [
    { x: 0.13, anc: 'look', f: 1, spear: true, mod: 'slump', mf: 1 },
    { x: 0.32, anc: 'carry', f: 1, focal: true, mod: 'slump', mf: 1 },
    { x: 0.50, anc: 'throw', f: 1, mod: 'phone', mf: 1 },
  ],
  light: [
    { x: 0.17, anc: 'hunch', f: 1, mod: 'sitChair', mf: 1 },
    { x: 0.39, anc: 'walk', f: 1, focal: true, stick: true, mod: 'sitChair', mf: 1 },
    { x: 0.61, anc: 'carry', f: -1, mod: 'sitChair', mf: -1 },
    { x: 0.83, anc: 'pick', f: 1, mod: 'eat', mf: -1 },
  ],
};

// Topics registered from outside (topics.js): their own composition, props, poses, times of day and modern scene.
const EXTRA = {}, XPOSES = {};
// A page can say who in an ancestors' shot feels the topic's emotion: FEEL(beat, people, props) returns their indexes,
// and they get the gold rings. setFeeling(null) turns it off.
let FEEL = null;
export function setFeeling(fn) { FEEL = fn; }
const poseOf = (name, t, i) => {
  if (XPOSES[name]) return XPOSES[name](t, i);
  if (name === 'walk') return walkPose(t * 4.2 + i * 1.7, { stride: 0.75, swing: 0.7 });
  if (name === 'walkPhone') return { ...walkPose(t * 3.4 + i * 1.7, { stride: 0.55, swing: 0 }), head: 0.75, lean: 0.08, arms: POSES.phone.arms, phone: true };
  return POSES[name];
};

// ---------- small tools ----------
const store = new Map();
function buf(key, w, h, dpr) {
  const k = `${key}:${w}x${h}@${dpr}`;
  if (!store.has(k)) store.set(k, offscreen(w, h, dpr));
  return store.get(k);
}
function once(key, make) { if (!store.has(key)) store.set(key, make()); return store.get(key); }

// A figure with light on one side: the lit colour, then the body colour shifted away from the light.
function lit(c, x, y, h, o, rim, side, amt = 0.011) {
  if (rim) drawFigure(c, x, y, h, { ...o, color: rim, farColor: rim });
  drawFigure(c, x - side * h * amt, y + (rim ? h * 0.004 : 0), h, o);
}
// A shadow on the ground, cast away from a light.
function shadow(c, x, y, h, o, dir, len = 0.35, a = 0.28) {
  c.save(); c.translate(x, y); c.transform(1, 0, -dir * len * 2.2, -len * 0.55, 0, 0);
  drawFigure(c, 0, 0, h, { ...o, color: `rgba(10,8,14,${a})`, farColor: `rgba(10,8,14,${a})`, screen: null });
  c.restore();
}
function stars(c, w, top, n, seed, t, a = 1) {
  for (let i = 0; i < n; i++) {
    const x = hash(i * 7.1 + seed) * w, y = hash(i * 1.9 + seed) * top, s = hash(i * 3.7) < 0.08 ? 1.9 : hash(i * 5.3) < 0.3 ? 1.3 : 0.8;
    c.fillStyle = alpha('#FFFFFF', a * (0.35 + 0.55 * hash(i * 3.3 + seed)) * (0.75 + 0.25 * Math.sin(t * 2 + i)));
    c.fillRect(x, y, s, s);
  }
}
function milkyWay(c, w, top, seed) {
  c.save(); c.translate(w * 0.5, top * 0.45); c.rotate(-0.55);
  const g = c.createLinearGradient(0, -top * 0.22, 0, top * 0.22);
  g.addColorStop(0, 'rgba(160,170,220,0)'); g.addColorStop(0.5, 'rgba(190,195,235,0.16)'); g.addColorStop(1, 'rgba(160,170,220,0)');
  c.fillStyle = g; c.fillRect(-w, -top * 0.22, w * 2, top * 0.44);
  for (let i = 0; i < 420; i++) {
    const x = (hash(i * 2.3 + seed) - 0.5) * w * 1.6, y = (hash(i * 4.1) + hash(i * 8.7) + hash(i * 1.3) - 1.5) * top * 0.16;
    c.fillStyle = alpha('#EEF0FF', 0.25 + hash(i * 6.1) * 0.5); c.fillRect(x, y, 0.8, 0.8);
  }
  c.restore();
}
function smoke(c, x, y, s, t, col = '#D8D2C8', a = 0.22) {
  for (let i = 0; i < 9; i++) {
    const p = (t * 0.22 + i / 9) % 1, r = s * (0.25 + p * 0.9);
    const sx = x + Math.sin(p * 5 + i) * s * 0.25 + p * s * 1.4, sy = y - p * s * 5.5;
    const g = c.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, alpha(col, a * (1 - p) * smooth(p, 0, 0.15))); g.addColorStop(1, alpha(col, 0));
    c.fillStyle = g; c.fillRect(sx - r, sy - r, r * 2, r * 2);
  }
}
function sparks(c, x, y, s, t) {
  for (let i = 0; i < 10; i++) {
    const p = (t * 0.6 + hash(i * 3.1)) % 1;
    c.fillStyle = alpha('#FFC266', (1 - p) * 0.9);
    c.fillRect(x + Math.sin(p * 7 + i * 2) * s * 0.6 + (hash(i) - 0.5) * s, y - p * s * 4.5, 1.5, 1.5);
  }
}
function spear(c, x, y, len, ang, col) {
  c.strokeStyle = col; c.lineWidth = Math.max(1, len * 0.018); c.lineCap = 'round';
  const ex = x + Math.sin(ang) * len, ey = y - Math.cos(ang) * len;
  c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
  c.fillStyle = col; c.beginPath(); c.ellipse(ex, ey, len * 0.022, len * 0.06, ang, 0, TAU); c.fill();
}
function bigTree(c, x, y, s, col, hi, seed) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
  c.lineWidth = s * 0.07; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + s * 0.05, y - s * 0.4, x - s * 0.02, y - s * 0.6); c.stroke();
  c.lineWidth = s * 0.035;
  for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x, y - s * 0.5); c.quadraticCurveTo(x + d * s * 0.2, y - s * 0.62, x + d * s * 0.32, y - s * 0.72); c.stroke(); }
  const blobs = [];
  for (let i = 0; i < 14; i++) { const a = hash(seed + i) * Math.PI, rr = s * (0.12 + hash(seed + i * 3) * 0.1); blobs.push([x + Math.cos(a) * s * 0.36 * hash(seed + i * 5), y - s * 0.78 - Math.sin(a) * s * 0.22, rr]); }
  c.beginPath(); for (const [bx, by, rr] of blobs) { c.moveTo(bx + rr, by); c.arc(bx, by, rr, 0, TAU); } c.fill();
  if (hi) { c.fillStyle = hi; c.beginPath(); for (const [bx, by, rr] of blobs) { c.moveTo(bx + rr * 0.7, by - rr * 0.25); c.arc(bx - rr * 0.1, by - rr * 0.3, rr * 0.7, 0, TAU); } c.fill(); }
}
function mammoth(c, x, y, s, col, ph) {
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round';
  c.beginPath(); c.ellipse(x, y - s * 0.55, s * 0.42, s * 0.27, -0.08, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(x + s * 0.32, y - s * 0.72, s * 0.2, s * 0.22, 0, 0, TAU); c.fill();
  c.beginPath(); c.ellipse(x - s * 0.08, y - s * 0.78, s * 0.22, s * 0.12, -0.3, 0, TAU); c.fill();
  c.lineWidth = s * 0.09; c.beginPath(); c.moveTo(x + s * 0.46, y - s * 0.66); c.quadraticCurveTo(x + s * 0.56, y - s * 0.4, x + s * 0.5, y - s * 0.22); c.stroke();
  c.strokeStyle = '#E9E0CC'; c.lineWidth = s * 0.03; c.beginPath(); c.moveTo(x + s * 0.42, y - s * 0.5); c.quadraticCurveTo(x + s * 0.62, y - s * 0.38, x + s * 0.6, y - s * 0.6); c.stroke();
  c.strokeStyle = col; c.lineWidth = s * 0.12;
  for (const [lx, p] of [[-0.28, 0], [-0.15, Math.PI], [0.18, Math.PI], [0.3, 0]]) { const sw = Math.sin(ph + p) * 0.06; c.beginPath(); c.moveTo(x + s * lx, y - s * 0.45); c.lineTo(x + s * (lx + sw), y - s * 0.04); c.stroke(); }
}
function leanTo(c, x, y, s, col, hi) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - s * 0.5, y); c.lineTo(x + s * 0.15, y - s * 0.62); c.lineTo(x + s * 0.55, y); c.closePath(); c.fill();
  c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.025); c.lineCap = 'round';
  for (const dx of [0.05, 0.22]) { c.beginPath(); c.moveTo(x + s * dx, y - s * 0.75); c.lineTo(x + s * (dx + 0.12), y - s * 0.5); c.stroke(); }
  if (hi) { c.strokeStyle = hi; c.lineWidth = 1; for (let i = 0; i < 9; i++) { const u = i / 9; c.beginPath(); c.moveTo(x - s * 0.5 + u * s * 0.65, y - u * s * 0.62); c.lineTo(x - s * 0.4 + u * s * 0.6, y); c.stroke(); } }
}
function rack(c, x, y, s, col, hide) {
  c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.03); c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - s * 0.3, y); c.lineTo(x - s * 0.25, y - s * 0.7); c.moveTo(x + s * 0.3, y); c.lineTo(x + s * 0.25, y - s * 0.7); c.moveTo(x - s * 0.32, y - s * 0.66); c.lineTo(x + s * 0.32, y - s * 0.66); c.stroke();
  c.fillStyle = hide; c.beginPath(); c.moveTo(x - s * 0.22, y - s * 0.66); c.quadraticCurveTo(x - s * 0.26, y - s * 0.4, x - s * 0.16, y - s * 0.3); c.lineTo(x + s * 0.18, y - s * 0.32); c.quadraticCurveTo(x + s * 0.25, y - s * 0.45, x + s * 0.2, y - s * 0.66); c.fill();
}
function basket(c, x, y, s, col, hi) {
  c.fillStyle = col; c.beginPath(); c.moveTo(x - s * 0.5, y - s); c.lineTo(x + s * 0.5, y - s); c.lineTo(x + s * 0.35, y); c.lineTo(x - s * 0.35, y); c.fill();
  if (hi) { c.strokeStyle = hi; c.lineWidth = 0.8; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - s * 0.48 + i * 0.03 * s, y - s + i * s * 0.25); c.lineTo(x + s * 0.48 - i * 0.03 * s, y - s + i * s * 0.25); c.stroke(); } }
}
function vignette(c, w, h, a = 0.5) {
  const g = c.createRadialGradient(w / 2, h * 0.55, h * 0.3, w / 2, h * 0.55, w * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(6,4,10,${a})`);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}
function grain(c, w, h, t, a = 0.07) {
  const n = once('grain', () => {
    const o = offscreen(160, 160, 1), d = o.ctx.createImageData(160, 160);
    for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    o.ctx.putImageData(d, 0, 0); return o.c;
  });
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'overlay';
  const ox = Math.floor(hash(Math.floor(t * 24)) * 160), oy = Math.floor(hash(Math.floor(t * 24) + 9) * 160);
  for (let x = -ox; x < w; x += 160) for (let y = -oy; y < h; y += 160) c.drawImage(n, x, y);
  c.restore();
}
// Darkness with holes where the lights are, then the lights' colour on top.
function lightmap(c, w, h, dark, lights) {
  const dpr = c.getTransform().a, L = buf('lm', w, h, dpr), l = L.ctx;
  l.save(); l.setTransform(dpr, 0, 0, dpr, 0, 0); l.clearRect(0, 0, w, h); l.globalCompositeOperation = 'source-over';
  l.fillStyle = dark; l.fillRect(0, 0, w, h);
  l.globalCompositeOperation = 'destination-out';
  for (const L2 of lights) {
    const g = l.createRadialGradient(L2.x, L2.y, 0, L2.x, L2.y, L2.r);
    g.addColorStop(0, `rgba(0,0,0,${L2.a ?? 0.95})`); g.addColorStop(0.45, `rgba(0,0,0,${(L2.a ?? 0.95) * 0.5})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    l.fillStyle = g; l.fillRect(L2.x - L2.r, L2.y - L2.r, L2.r * 2, L2.r * 2);
    if (L2.rect) { l.fillStyle = `rgba(0,0,0,${L2.rect.a})`; l.fillRect(L2.rect.x, L2.rect.y, L2.rect.w, L2.rect.h); }
  }
  l.restore();
  c.drawImage(L.c, 0, 0, w, h);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const L2 of lights) if (L2.col) glow(c, L2.x, L2.y, L2.r * 0.8, L2.col, L2.glow ?? 0.18);
  c.restore();
}

// ---------- the ancestors' worlds ----------
const TIMES = {
  day: { sky: ['#5B8DD0', '#A9C6E6', '#E6EEF2'], far: '#9BAACB', mid: '#7D8AA6', ground: ['#B49A62', '#8A6E3E', '#5E4A2A'], ink: '#1A1620', rim: '#FFF0C8', haze: '#DCE6EE' },
  dusk: { sky: ['#3D4F8C', '#C58A9A', '#F6C690'], far: '#8E86A8', mid: '#6A5F80', ground: ['#9C7446', '#6E4E30', '#3E2C1E'], ink: '#18121A', rim: '#FFB36A', haze: '#F2C49C' },
  night: { sky: ['#060A1E', '#121A3C', '#28305A'], far: '#1C2240', mid: '#151A32', ground: ['#2A2834', '#1C1A24', '#100E16'], ink: '#09080D', rim: '#FF9A40', haze: '#2A3058' },
};

function placeFor(g, beat) {
  const years = g * 27, r = hash(g * 1.37 + 0.5), r2 = hash(g * 3.11 + 1.7);
  const opts = ['savanna', 'lake', 'woodland', 'coast'];
  if (years < 11500) opts.push('village');
  if (years > 15000 && years < 110000) opts.push('ice', 'ice');
  const habitat = opts[Math.floor(r * opts.length)];
  let time = r2 < 0.4 ? 'dusk' : 'day';
  if ((beat === 'lonely' || beat === 'baby' || beat === 'compare') && r2 > 0.7) time = 'night';
  if (beat === 'missed') time = r2 < 0.5 ? 'dusk' : 'night';
  if (beat === 'light') time = hash(g * 7.7) < 0.5 ? 'day' : 'night';
  if (EXTRA[beat] && EXTRA[beat].times) { const T = EXTRA[beat].times; time = T[Math.floor(hash(g * 5.3 + 0.9) * T.length)]; }
  return { habitat, time };
}

function skyAnc(c, w, h, P, t, seed) {
  const T = TIMES[P.time], hz = h * 0.6, ice = P.habitat === 'ice' && P.time === 'day';
  const g = c.createLinearGradient(0, 0, 0, hz);
  const S = ice ? ['#8EA6C4', '#C7D4E2', '#EEF2F6'] : T.sky;
  g.addColorStop(0, S[0]); g.addColorStop(0.6, S[1]); g.addColorStop(1, S[2]);
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (P.time === 'night') {
    milkyWay(c, w, hz, seed); stars(c, w, hz, 170, seed, t);
    if (hash(seed * 1.3) < 0.5) { const mx = w * 0.82, my = h * 0.16, r = h * 0.035; glow(c, mx, my, r * 6, '#B8C4F0', 0.25); c.fillStyle = '#F2EEDC'; c.beginPath(); c.arc(mx, my, r, 0, TAU); c.fill(); c.fillStyle = S[0]; c.beginPath(); c.arc(mx + r * 0.45, my - r * 0.2, r * 0.9, 0, TAU); c.fill(); }
  } else if (P.time === 'day') {
    glow(c, w * 0.8, h * 0.12, h * 0.7, '#FFF6D8', 0.55); c.fillStyle = '#FFFDF2'; c.beginPath(); c.arc(w * 0.8, h * 0.12, h * 0.04, 0, TAU); c.fill();
    for (let i = 0; i < 3; i++) {
      const cw = w * (0.32 + hash(seed + i) * 0.2), ch = cw * 0.32;
      const spr = once(`cl${Math.round(cw)}:${i}:${ice ? 1 : 0}`, () => cloudSprite(cw, ch, i * 7 + 3, { top: '#FFFFFF', bottom: ice ? '#C6CCDA' : '#D2D9E6', dpr: 2, puffs: 22 }));
      const x = ((hash(seed * 3 + i) * w * 1.4 + t * (4 + i * 2)) % (w * 1.4)) - w * 0.3;
      c.globalAlpha = 0.9; c.drawImage(spr, x, h * (0.02 + i * 0.1) - ch * 0.5, cw, ch * 1.5); c.globalAlpha = 1;
    }
  } else {
    const sx = w * 0.72, sy = hz - h * 0.05;
    glow(c, sx, sy, w * 0.6, '#FFC27A', 0.55); glow(c, sx, sy, h * 0.16, '#FFE2B0', 0.9);
    c.fillStyle = '#FFF0D6'; c.beginPath(); c.arc(sx, sy, h * 0.05, 0, TAU); c.fill();
    for (let i = 0; i < 5; i++) { const y = h * (0.12 + i * 0.07), x = w * hash(seed + i * 2.1); c.fillStyle = alpha(i < 2 ? '#B87A9A' : '#F2A27A', 0.35); c.beginPath(); c.ellipse(x, y, w * (0.2 + hash(i) * 0.15), h * 0.012, 0, 0, TAU); c.fill(); }
  }
  return hz;
}

function landAnc(c, w, h, P, t, seed) {
  const T = TIMES[P.time], hz = h * 0.6, gy = h * GY, night = P.time === 'night', ice = P.habitat === 'ice';
  const far = ice && !night ? '#B9C6DA' : T.far, mid = ice && !night ? '#8A97AE' : T.mid;
  // far hills with a haze line
  ridge(c, 0, w, hz, mountains(seed, w * 0.3, h * (ice ? 0.3 : 0.14), ice ? 1.8 : 1.3), far, 2);
  if (ice) { // snowcaps
    c.save(); c.beginPath(); c.rect(0, 0, w, hz - h * 0.12); c.clip(); ridge(c, 0, w, hz, mountains(seed, w * 0.3, h * 0.3, 1.8), night ? '#4A5878' : '#F4F7FB', 2); c.restore();
  }
  const hg = c.createLinearGradient(0, hz - h * 0.08, 0, hz + h * 0.02); hg.addColorStop(0, alpha(T.haze, 0)); hg.addColorStop(1, alpha(T.haze, night ? 0.25 : 0.55));
  c.fillStyle = hg; c.fillRect(0, hz - h * 0.08, w, h * 0.1);
  ridge(c, 0, w, hz + h * 0.02, mountains(seed + 4, w * 0.12, h * 0.05, 1.2), mid, 2);
  // the habitat
  const hab = P.habitat;
  let groundTop = hz + h * 0.02;
  if (hab === 'lake' || hab === 'coast') {
    const wy = hz + h * 0.015, wh = h * (hab === 'coast' ? 0.13 : 0.1);
    const g = c.createLinearGradient(0, wy, 0, wy + wh);
    const top = night ? '#1A2244' : P.time === 'dusk' ? '#C88E86' : hab === 'coast' ? '#4F7FAE' : '#7FA2C8';
    g.addColorStop(0, top); g.addColorStop(1, mix(top, night ? '#0A0E20' : '#24405E', 0.45));
    c.fillStyle = g; c.fillRect(0, wy, w, wh);
    const sx = P.time === 'dusk' ? w * 0.72 : w * 0.8;
    for (let i = 0; i < 26; i++) {
      const y = wy + (i / 26) * wh, len = w * (0.02 + hash(i * 3.1) * 0.05) * (1 - i / 40);
      const x = sx + (hash(i * 7.7) - 0.5) * w * 0.12 + Math.sin(t * 1.2 + i) * 4;
      c.fillStyle = alpha(night ? '#9AA8E0' : '#FFF2D0', (night ? 0.25 : 0.55) * (1 - i / 30)); c.fillRect(x - len / 2, y, len, 1.2);
    }
    for (let i = 0; i < 14; i++) { const x = ((hash(i + seed) * w + t * 10 * (i % 2 ? 1 : -1)) % w + w) % w, y = wy + hash(i * 2.2) * wh; c.fillStyle = alpha('#FFFFFF', night ? 0.12 : 0.3); c.fillRect(x, y, 10 + hash(i) * 14, 1); }
    if (hab === 'coast') { // a headland, and waves on the sand
      ridge(c, w * 0.78, w * 1.02, wy + wh * 0.2, (x) => h * 0.16 * smooth((x - w * 0.78) / (w * 0.1)), mid, 2, wy + wh);
      for (let i = 0; i < 3; i++) { const p = (t * 0.25 + i / 3) % 1; c.strokeStyle = alpha('#F4F6F8', (night ? 0.2 : 0.6) * (1 - p)); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, wy + wh - 2 + p * 6); for (let x = 0; x <= w; x += 12) c.lineTo(x, wy + wh - 2 + p * 6 + Math.sin(x * 0.05 + i) * 1.5); c.stroke(); }
      for (let i = 0; i < 3; i++) bird(c, w * (0.2 + i * 0.12) + Math.sin(t * 0.5 + i) * 10, h * (0.22 + hash(i) * 0.1), 5, t * 6 + i, alpha(T.ink, 0.7));
    } else {
      for (let i = 0; i < 40; i++) { const x = hash(i * 2.9 + seed) * w, hh = h * (0.02 + hash(i * 1.7) * 0.04); c.strokeStyle = alpha(mid, 0.9); c.lineWidth = 1; c.beginPath(); c.moveTo(x, wy + wh); c.quadraticCurveTo(x + 2, wy + wh - hh * 0.6, x + 3 + Math.sin(t + i) * 1.5, wy + wh - hh); c.stroke(); }
      for (let i = 0; i < 2; i++) bird(c, w * (0.3 + i * 0.25) + t * 8 % w, h * (0.25 + i * 0.06), 6, t * 5 + i * 2, alpha(T.ink, 0.6));
    }
    groundTop = wy + wh;
  }
  if (hab === 'savanna') {
    for (let i = 0; i < 6; i++) acacia(c, w * (0.08 + hash(seed + i) * 0.84), hz + h * 0.02, h * (0.07 + hash(i * 3) * 0.05), mix(mid, T.ink, 0.15), i + seed);
    if (!night) for (let i = 0; i < 6; i++) antelope(c, w * (0.48 + i * 0.035 + hash(i) * 0.02), hz + h * 0.025, h * 0.045, mix(mid, T.ink, 0.3), t * 3 + i, 0.5 + 0.5 * Math.sin(t * 0.7 + i * 1.3));
  }
  if (hab === 'woodland') {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) bush(c, w * (i / 8) + (hash(i + row * 9) - 0.5) * w * 0.08, hz + h * (0.04 + row * 0.03), h * (0.14 + hash(i + row * 7 + seed) * 0.08 - row * 0.02), mix(mix(mid, '#2E3A30', 0.4), T.ink, row * 0.18), i + row * 10 + seed);
  }
  if (hab === 'ice') {
    for (let i = 0; i < 3; i++) mammoth(c, w * (0.5 + i * 0.09), hz + h * 0.035, h * (0.07 - i * 0.008), mix(mid, T.ink, 0.35), t * 2 + i);
    for (let i = 0; i < 5; i++) poplar(c, w * (0.04 + i * 0.035), hz + h * 0.05, h * (0.1 + hash(i + seed) * 0.06), mix(mid, T.ink, 0.25));
  }
  if (hab === 'village') {
    const hc = mix(mid, T.ink, 0.25);
    for (let i = 0; i < 4; i++) { const x = w * (0.52 + i * 0.1), s = h * (0.12 + hash(i) * 0.04); hut(c, x, hz + h * 0.05, s, hc, night ? '#FFB24A' : null); if (!night) smoke(c, x, hz + h * 0.05 - s * 0.55, s * 0.18, t + i, '#EDE6DA', 0.18); }
    for (let i = 0; i < 3; i++) poplar(c, w * (0.08 + i * 0.06), hz + h * 0.05, h * 0.16, hc);
  }
  // the ground the people stand on
  const g = c.createLinearGradient(0, groundTop, 0, h);
  const G = ice ? (night ? ['#3E4660', '#2A3044', '#181C2A'] : ['#E4EAF2', '#C4CEDC', '#9AA6B8']) : hab === 'coast' ? (night ? ['#3A3644', '#2A2632', '#16141C'] : ['#D8C49A', '#BFA676', '#8C764E']) : T.ground;
  g.addColorStop(0, G[0]); g.addColorStop(0.5, G[1]); g.addColorStop(1, G[2]);
  c.fillStyle = g; c.fillRect(0, groundTop, w, h - groundTop);
  // texture: tufts, stones, light patches
  for (let i = 0; i < 70; i++) {
    const y = groundTop + Math.pow(hash(i * 3.3 + seed), 0.8) * (h - groundTop), x = hash(i * 5.1 + seed) * w, s = 1 + (y - groundTop) / h * 6;
    c.fillStyle = alpha(i % 3 ? G[2] : G[0], 0.35); c.beginPath(); c.ellipse(x, y, s * 2.2, s * 0.5, 0, 0, TAU); c.fill();
  }
  if (!ice) grass(c, 0, w, groundTop + 3, h * 0.02, alpha(mix(G[2], T.ink, 0.4), 0.6), t, 0.4, seed);
  if (ice) for (let i = 0; i < 60; i++) { const x = (hash(i * 2.1 + seed) * w + t * 10 + Math.sin(t + i) * 6) % w, y = (hash(i * 4.7 + seed) * h + t * (16 + hash(i) * 16)) % h; c.fillStyle = alpha('#FFFFFF', night ? 0.5 : 0.85); c.beginPath(); c.arc(x, y, 0.8 + hash(i * 9) * 1.2, 0, TAU); c.fill(); }
  return { gy, hz, groundTop, G };
}
function foreground(c, w, h, P, t, seed) {
  const T = TIMES[P.time], col = mix(T.ink, TIMES[P.time].ground[2], 0.2);
  if (P.habitat !== 'ice') {
    grass(c, -10, w * 0.16, h + 2, h * 0.12, col, t, 0.5, seed); grass(c, w * 0.86, w + 10, h + 2, h * 0.11, col, t, 0.5, seed + 3);
  } else { c.fillStyle = alpha(col, 0.7); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(w * (i < 2 ? 0.04 + i * 0.06 : 0.9 + (i - 2) * 0.07), h, w * 0.06, h * 0.05, 0, Math.PI, TAU); c.fill(); } }
}

// ---------- the people in the ancestors' worlds ----------
// Every shot is composed fresh from its generation number: how many people, who they are, what they are doing,
// where they stand and how far back, and what is around them. No two shots share an arrangement.
function rng(g) { let k = 0; const R = () => hash(g * 1.6180339 + (k++) * 7.31 + 0.17); R.pick = (a) => a[Math.floor(R() * a.length)]; R.range = (lo, hi) => lo + R() * (hi - lo); return R; }
// place people along the ground without overlapping: each gets x and depth d; too close at a similar depth is rejected
function placer(R, taken = []) {
  return (lo, hi, gap = 0.075, dlo = 0, dhi = 0.8) => {
    for (let tries = 0; tries < 40; tries++) {
      const x = R.range(lo, hi), d = R.range(dlo, dhi);
      if (taken.every((o) => Math.abs(o.x - x) > gap * (1 - Math.min(o.d, d) * 0.35) || Math.abs(o.d - d) > 0.45)) { const o = { x, d }; taken.push(o); return o; }
    }
    return null;
  };
}
function compose(beat, g, night) {
  const R = rng(g), people = [], props = {}, taken = [], place = placer(R, taken);
  const add = (pos, q) => { if (pos) people.push({ ...q, x: pos.x, d: pos.d, f: q.f || (R() < 0.5 ? 1 : -1) }); };
  const kind = () => (R() < 0.18 ? 'child' : 'adult');
  if (beat === 'lonely') {
    // a fire somewhere; people around it, facing in; others busy nearby, arriving, or in pairs
    const fx = props.fire = R.range(0.22, 0.78); taken.push({ x: fx, d: 0.3 });
    const ring = 3 + Math.floor(R() * 4);
    for (let i = 0; i < ring; i++) {
      const side = i % 2 ? 1 : -1, pos = place(fx + side * 0.05, fx + side * 0.2, 0.07, 0, 0.75);
      if (pos) add(pos, { p: R.pick(['sitFire', 'sitFire', 'sitArm', 'sitGround', 'eat', 'tell']), f: pos.x < fx ? 1 : -1, kind: kind() });
    }
    const extra = Math.floor(R() * 4);
    for (let i = 0; i < extra; i++) {
      const pos = place(0.06, 0.94, 0.08, 0, 0.8); if (!pos) continue;
      const k = R.pick(['carry', 'walk', 'stand', 'tell', 'hug', 'holdHand', 'crouch', 'shoulderPole', 'look']);
      add(pos, { p: k, f: k === 'walk' || k === 'carry' ? (pos.x < fx ? 1 : -1) : undefined, kind: k === 'shoulderPole' || k === 'carry' ? 'adult' : kind() });
      if (k === 'holdHand' || k === 'hug') { const p2 = place(pos.x + 0.04, pos.x + 0.07, 0.03, pos.d, pos.d + 0.05); if (p2) add(p2, { p: k, f: -people[people.length - 1].f, kind: kind() }); }
    }
    props.shelters = []; for (let i = 0, n = Math.floor(R() * 3); i < n; i++) props.shelters.push({ x: R.range(0.05, 0.95), s: R.range(0.28, 0.42), hut: R() < 0.4, d: R.range(0.4, 1) });
    props.racks = R() < 0.4 ? [R.range(0.04, 0.96)] : [];
    props.spears = R() < 0.6 ? [{ x: R.range(0.05, 0.95), n: 1 + Math.floor(R() * 3), a: R() < 0.5 ? -1 : 1 }] : [];
    props.baskets = Array.from({ length: Math.floor(R() * 3) }, () => R.range(0.05, 0.95));
  }
  if (beat === 'missed') {
    // the one who didn't come back, somewhere; the others on their way to him, or already with him
    const lost = R() < 0.5 ? R.range(0.72, 0.92) : R.range(0.08, 0.28), dir = lost > 0.5 ? 1 : -1, dl = R.range(0, 0.6);
    props.rock = lost + dir * 0.07; props.rockD = dl; taken.push({ x: props.rock, d: dl });
    const found = R() < 0.35;
    add(place(lost - 0.01, lost + 0.01, 0.05, dl, dl + 0.01), { p: R.pick(['sitArm', 'sitGround', 'sitArm']), f: -dir });
    const n = 3 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) {
      const near = found && i < 2;
      const pos = near ? place(lost - dir * 0.13, lost - dir * 0.06, 0.06, dl - 0.1, dl + 0.1) : place(dir > 0 ? 0.04 : lost + 0.12, dir > 0 ? lost - 0.12 : 0.96, 0.07, 0, 0.8);
      if (!pos) continue;
      const k = near ? R.pick(['crouch', 'reach', 'stand']) : R.pick(['walk', 'walk', 'walk', 'wave', 'look', 'reach']);
      add(pos, { p: k, f: dir, torch: !near && (night ? R() < 0.6 : R() < 0.35), spear: R() < 0.25, kind: R() < 0.1 ? 'child' : 'adult' });
    }
  }
  if (beat === 'stress') {
    // the lion walks off on one side; on the other, a group already standing easy, some sitting back down
    const dir = R() < 0.5 ? 1 : -1, ld = R.range(0, 0.9);
    props.lion = { x: dir > 0 ? R.range(0.72, 0.88) : R.range(0.12, 0.28), s: lerp(0.26, 0.13, ld), d: ld, dir, two: R() < 0.2 };
    const n = 3 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const pos = dir > 0 ? place(0.05, 0.62, 0.075, 0, 0.8) : place(0.38, 0.95, 0.075, 0, 0.8); if (!pos) continue;
      const k = R.pick(['stand', 'look', 'look', 'throw', 'carry', 'sitGround', 'sitArm', 'eat', 'tell', 'stand', 'hug']);
      add(pos, { p: k, f: k === 'look' || k === 'throw' ? dir : undefined, spear: (k === 'stand' || k === 'look') && R() < 0.5, kind: k === 'carry' || k === 'throw' ? 'adult' : kind() });
    }
  }
  if (beat === 'light') {
    if (!night) {
      // a day's work outside: gathering, digging, carrying, picking, all over the place
      props.trees = Array.from({ length: Math.floor(R() * 3) }, () => ({ x: R.range(0.05, 0.95), s: R.range(0.38, 0.55), fruit: R() < 0.6 }));
      props.trees.forEach((tr) => taken.push({ x: tr.x, d: 0.9 }));
      for (const tr of props.trees) if (tr.fruit && R() < 0.7) add(place(tr.x - 0.05, tr.x + 0.05, 0.05, 0, 0.2), { p: 'pick', f: R() < 0.5 ? 1 : -1 });
      const n = 3 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const k = R.pick(['hunch', 'walk', 'carry', 'reach', 'sitGround', 'shoulderPole', 'crouch', 'walk', 'look']);
        add(place(0.05, 0.95, 0.08, 0, 0.8), { p: k, stick: (k === 'walk' || k === 'hunch') && R() < 0.5, kind: k === 'shoulderPole' || k === 'carry' ? 'adult' : kind() });
      }
      props.baskets = Array.from({ length: Math.floor(R() * 3) }, () => R.range(0.05, 0.95));
    } else {
      // asleep in the dark around a small fire; one or two still up
      const fx = props.fire = R.range(0.25, 0.75); taken.push({ x: fx, d: 0.3 });
      const up = Math.floor(R() * 3);
      for (let i = 0; i < up; i++) { const side = R() < 0.5 ? -1 : 1, pos = place(fx + side * 0.05, fx + side * 0.13, 0.06, 0, 0.5); if (pos) add(pos, { p: R.pick(['sitFire', 'sitArm']), f: pos.x < fx ? 1 : -1 }); }
      const n = 2 + Math.floor(R() * 5);
      for (let i = 0; i < n; i++) add(place(0.08, 0.92, 0.24, 0, 0.9), { p: 'lie', kind: kind() });
    }
  }
  if (beat === 'compare') {
    // one person showing what they can do; a few dozen people they know, watching, some better at it, some worse
    const px = R.range(0.3, 0.7), throws = R() < 0.6;
    add(place(px - 0.01, px + 0.01, 0.06, 0, 0.2), { p: throws ? 'throw' : R.pick(['tell', 'wave']), f: R() < 0.5 ? 1 : -1, spear: !throws && R() < 0.3 });
    const me = people[0];
    if (throws) { props.target = me.x + me.f * R.range(0.22, 0.35); props.target = clamp(props.target, 0.05, 0.95); taken.push({ x: props.target, d: 0.5 }); }
    const n = 4 + Math.floor(R() * 5);
    for (let i = 0; i < n; i++) {
      const pos = place(0.05, 0.95, 0.07, 0, 0.85); if (!pos) continue;
      add(pos, { p: R.pick(['look', 'stand', 'sitGround', 'sitArm', 'stand', 'holdHand', 'eat', 'wave']), f: pos.x < me.x ? 1 : -1, spear: R() < 0.2, kind: kind() });
    }
  }
  if (beat === 'baby') {
    // a baby, and many arms: the mother, her mother, sisters, the father, older children
    // one baby per shot, held by someone different each time; people close around it, reaching, looking
    const who = R.pick(['adult', 'adult', 'old', 'child']), bx = R.range(0.25, 0.75);
    add(place(bx - 0.01, bx + 0.01, 0.05, 0, 0.3), { p: 'carry', baby: 1, kind: who === 'child' ? 'child' : 'adult', old: who === 'old' ? 1 : 0, f: R() < 0.5 ? 1 : -1 });
    const near = 1 + Math.floor(R() * 3);
    for (let i = 0; i < near; i++) { const pos = place(bx - 0.17, bx + 0.17, 0.065, 0, 0.6); if (pos) add(pos, { p: R.pick(['touch', 'look', 'stand', 'sitArm', 'touch']), f: pos.x < bx ? 1 : -1, kind: kind() }); }
    const n = 1 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) add(place(0.05, 0.95, 0.07, 0, 0.85), { p: R.pick(['sitArm', 'sitGround', 'tell', 'stand', 'walk', 'eat', 'hunch']), kind: kind() });
    if (R() < 0.5) { props.fire = R.range(0.2, 0.8); }
    props.shelters = R() < 0.6 ? [{ x: R.range(0.05, 0.95), s: R.range(0.28, 0.4), hut: R() < 0.5, d: R.range(0.5, 1) }] : [];
    props.baskets = Array.from({ length: Math.floor(R() * 3) }, () => R.range(0.05, 0.95));
  }
  if (beat === 'old') {
    // an old woman or man still working, with the grandchildren around
    const ne = 1 + (R() < 0.35 ? 1 : 0);
    for (let i = 0; i < ne; i++) add(place(0.2, 0.8, 0.12, 0, 0.3), { p: R.pick(['hunch', 'hunch', 'tell', 'sitGround', 'carry']), stick: R() < 0.7, old: 1 });
    const kids = 2 + Math.floor(R() * 4);
    for (let i = 0; i < kids; i++) { const pos = place(0.05, 0.95, 0.06, 0, 0.6); if (pos) add(pos, { p: R.pick(['stand', 'walk', 'sitArm', 'crouch', 'carry', 'look', 'hunch']), kind: 'child', f: pos.x < people[0].x ? 1 : -1 }); }
    const ad = Math.floor(R() * 3);
    for (let i = 0; i < ad; i++) add(place(0.05, 0.95, 0.08, 0.3, 0.9), { p: R.pick(['shoulderPole', 'walk', 'carry', 'hunch']), stick: R() < 0.3 });
    props.baskets = Array.from({ length: 1 + Math.floor(R() * 2) }, () => R.range(0.05, 0.95));
    props.trees = R() < 0.4 ? [{ x: R.range(0.05, 0.95), s: R.range(0.4, 0.55), fruit: R() < 0.5 }] : [];
  }
  if (beat === 'food') {
    // roots dug with sticks, carried in, roasted and chewed slowly
    const fx = props.fire = R.range(0.2, 0.8); taken.push({ x: fx, d: 0.3 });
    const eat = 1 + Math.floor(R() * 3);
    for (let i = 0; i < eat; i++) { const side = i % 2 ? 1 : -1, pos = place(fx + side * 0.05, fx + side * 0.16, 0.06, 0, 0.6); if (pos) add(pos, { p: R.pick(['eat', 'sitFire', 'sitArm']), f: pos.x < fx ? 1 : -1, kind: kind() }); }
    const dig = 1 + Math.floor(R() * 3);
    for (let i = 0; i < dig; i++) add(place(0.05, 0.95, 0.09, 0, 0.85), { p: 'hunch', stick: true });
    const more = Math.floor(R() * 3);
    for (let i = 0; i < more; i++) add(place(0.05, 0.95, 0.08, 0, 0.85), { p: R.pick(['carry', 'walk', 'shoulderPole', 'sitGround']), kind: kind() });
    props.baskets = Array.from({ length: 1 + Math.floor(R() * 3) }, () => R.range(0.05, 0.95));
    props.roots = true;
  }
  if (EXTRA[beat]) EXTRA[beat].compose({ R, add, place, kind, props, people, taken, night, g });
  if (FEEL) for (const i of FEEL(beat, people, props) || []) if (people[i]) people[i].sig = 1; // who in this shot feels it
  return { people: people.sort((a, b) => b.d - a.d), props };
}

function peopleAnc(c, w, h, P, t, g, light, people) {
  const T = TIMES[P.time], fh = h * FH, night = P.time === 'night';
  people.forEach((s, i) => {
    const x = w * s.x, gy = h * GY - s.d * h * 0.08, kind = s.kind || 'adult';
    const hh = (kind === 'child' ? fh * 0.62 : fh * (0.96 + hash(g + i * 3) * 0.08)) * (1 - s.d * 0.3);
    const ink = mix(T.ink, T.mid, s.d * 0.35);
    let pose = s.p === 'lie' ? null : poseOf(s.p, t, i);
    if (s.old && pose) pose = { ...pose, lean: (pose.lean || 0) + 0.12, head: (pose.head || 0) + 0.15 };
    const o = { pose, facing: s.f, body: body(g * 0.7 + i * 11, kind), color: ink, farColor: mix(ink, '#4A4458', night ? 0.15 : 0.35), bundleColor: mix(ink, s.baby ? '#C89A78' : '#8A6A48', night ? 0.25 : s.baby ? 0.6 : 0.45) };
    if (s.p === 'lie') { // asleep by the fire, head toward it
      const lx = x - hh * 0.5; c.save(); if (light && x > light.x) { c.translate(2 * x, 0); c.scale(-1, 1); }
      if (light) drawLying(c, lx, gy - hh * 0.012, hh * 0.92, { body: o.body, color: alpha(light.rim, 0.75 * clamp(1 - Math.abs(x - light.x) / (w * 0.6))) });
      drawLying(c, lx, gy, hh * 0.92, { body: o.body, color: '#0C0A10' }); c.restore(); return;
    }
    const side = light ? Math.sign(light.x - x) || 1 : 1;
    if (!night) shadow(c, x, gy, hh, o, P.time === 'dusk' ? -1.6 : -0.5, P.time === 'dusk' ? 0.6 : 0.25, 0.22);
    lit(c, x, gy, hh, o, light ? alpha(light.rim, light.a * 0.75) : null, side, 0.013);
    if (s.sig && pose) signal(c, x + s.f * hh * 0.07, gy - hh * (pose.seat ? 0.72 : 0.9), hh * 0.42, t + i * 0.3, 1, SIG);
    // what they hold
    const hx = x + s.f * hh * 0.2;
    if (s.spear) spear(c, x + s.f * hh * 0.16, gy - hh * 0.02, hh * 1.25, s.f * 0.12, ink);
    if (s.stick) spear(c, x + s.f * hh * 0.24, gy, hh * 0.8, s.f * 0.35, ink);
    if (s.torch) { const tx = hx + s.f * hh * 0.05, ty = gy - hh * 0.98; c.strokeStyle = ink; c.lineWidth = hh * 0.025; c.beginPath(); c.moveTo(x + s.f * hh * 0.12, gy - hh * 0.55); c.lineTo(tx, ty); c.stroke(); fire(c, tx, ty, hh * 0.06, t + i, '#FFB24A'); }
  });
}

// ---------- each beat: the camp around the people ----------
// a camp with whatever this shot was composed with
function camp(beat) {
  return (c, w, h, P, t, g) => {
    const T = TIMES[P.time], night = P.time === 'night';
    skyAnc(c, w, h, P, t, g); const L = landAnc(c, w, h, P, t, g); const gy = L.gy;
    const { people, props: K } = compose(beat, g, night), prop = mix(T.ink, T.mid, night ? 0.1 : 0.3);
    for (const S of K.shelters || []) { const y = gy - S.d * h * 0.1, col = mix(prop, T.mid, S.d * 0.3); if (S.hut) hut(c, w * S.x, y, h * S.s, col, night ? '#FF9A3C' : null); else leanTo(c, w * S.x, y, h * S.s, col, alpha(T.rim, night ? 0.05 : 0.25)); }
    for (const tr of K.trees || []) fruitTree(c, w * tr.x, gy - h * 0.06, h * tr.s, mix(T.ink, T.mid, 0.3), '#D8A040', tr.fruit ? [{ dx: -0.2, dy: -0.8, on: 1 }, { dx: 0.1, dy: -0.9, on: 1 }, { dx: 0.3, dy: -0.75, on: 1 }] : []);
    if (K.target !== undefined) { const tx = w * K.target, ty = gy - h * 0.04; c.strokeStyle = prop; c.lineWidth = 2; c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx, ty - h * 0.16); c.stroke(); c.fillStyle = mix(prop, '#A88450', 0.5); c.beginPath(); c.arc(tx, ty - h * 0.17, h * 0.022, 0, TAU); c.fill(); }
    let lights = [];
    if (K.fire !== undefined) {
      const fx = w * K.fire;
      c.fillStyle = mix(T.ink, '#5A5048', 0.4); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI; c.beginPath(); c.ellipse(fx + Math.cos(a) * h * 0.06, gy - h * 0.035 + Math.sin(a) * h * 0.01, h * 0.016, h * 0.01, 0, 0, TAU); c.fill(); }
      fire(c, fx, gy - h * 0.035, h * (night ? 0.07 : P.time === 'dusk' ? 0.05 : 0.03), t);
      smoke(c, fx, gy - h * 0.1, h * 0.05, t, night ? '#6A6070' : '#E8E2D8', night ? 0.15 : 0.22);
      if (K.roots) { c.fillStyle = mix(prop, '#7A5030', 0.4); for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(fx + (i - 1.5) * h * 0.025, gy - h * 0.04, h * 0.014, h * 0.006, 0.3, 0, TAU); c.fill(); } }
      lights.push({ x: fx, y: gy - h * 0.08, r: h * 0.7, col: '#FF9A3C', glow: 0.22 });
    }
    if (K.roots) for (const s2 of people.filter((q) => q.stick)) { c.fillStyle = alpha(mix(T.ground[2], T.ink, 0.3), 0.8); c.beginPath(); c.ellipse(w * s2.x + s2.f * h * 0.1, h * GY - s2.d * h * 0.08, h * 0.04 * (1 - s2.d * 0.3), h * 0.008, 0, 0, TAU); c.fill(); }
    for (const x of K.baskets || []) basket(c, w * x, gy - hash(x * 9) * h * 0.05, h * 0.045, prop, alpha(T.rim, 0.3));
    if (EXTRA[beat] && EXTRA[beat].props) EXTRA[beat].props(c, w, h, P, t, g, K, { T, gy, prop, night, lights, HELP });
    if (night && lights.length) lightmap(c, w, h, 'rgba(4,4,12,0.35)', lights);
    const fx = K.fire !== undefined ? w * K.fire : null;
    peopleAnc(c, w, h, P, t, g, fx !== null && P.time !== 'day' ? { x: fx, rim: T.rim, a: night ? 0.95 : 0.8 } : { x: hash(g) < 0.5 ? w * 0.85 : w * 0.15, rim: T.rim, a: 0.6 }, people);
    if (night && fx !== null) sparks(c, fx, gy - h * 0.1, h * 0.04, t);
    foreground(c, w, h, P, t, g);
  };
}

const MATCH = {
  compare: camp('compare'), baby: camp('baby'), old: camp('old'), food: camp('food'),
  lonely(c, w, h, P, t, g) {
    const T = TIMES[P.time], night = P.time === 'night';
    skyAnc(c, w, h, P, t, g); const L = landAnc(c, w, h, P, t, g);
    const { people, props: K } = compose('lonely', g, night);
    const gy = L.gy, fx = w * K.fire, prop = mix(T.ink, T.mid, night ? 0.1 : 0.3);
    for (const S of K.shelters) { const y = gy - S.d * h * 0.1, col = mix(prop, T.mid, S.d * 0.3); if (S.hut) hut(c, w * S.x, y, h * S.s, col, night ? '#FF9A3C' : null); else leanTo(c, w * S.x, y, h * S.s, col, alpha(T.rim, night ? 0.05 : 0.25)); }
    for (const x of K.racks) rack(c, w * x, gy - h * 0.09, h * 0.26, prop, mix(prop, '#8A6A48', night ? 0.1 : 0.5));
    for (const S of K.spears) for (let i = 0; i < S.n; i++) spear(c, w * S.x + i * w * 0.015, gy - h * 0.08, h * (0.42 - i * 0.02), S.a * (0.18 + i * 0.06), prop);
    // the hearth
    c.fillStyle = mix(T.ink, '#5A5048', 0.4); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI; c.beginPath(); c.ellipse(fx + Math.cos(a) * h * 0.07, gy - h * 0.035 + Math.sin(a) * h * 0.012, h * 0.018, h * 0.011, 0, 0, TAU); c.fill(); }
    const light = { x: fx, rim: T.rim, a: night ? 0.95 : P.time === 'dusk' ? 0.8 : 0.55 };
    fire(c, fx, gy - h * 0.035, h * (night ? 0.075 : P.time === 'dusk' ? 0.055 : 0.03), t);
    smoke(c, fx, gy - h * 0.1, h * 0.05, t, night ? '#6A6070' : '#E8E2D8', night ? 0.15 : 0.22);
    for (const x of K.baskets) basket(c, w * x, gy - hash(x * 9) * h * 0.04, h * 0.045, prop, alpha(T.rim, 0.3));
    if (night) lightmap(c, w, h, 'rgba(4,4,12,0.35)', [{ x: fx, y: gy - h * 0.08, r: h * 0.7, col: '#FF9A3C', glow: 0.22 }]);
    peopleAnc(c, w, h, P, t, g, night || P.time === 'dusk' ? light : { x: w * 0.85, rim: T.rim, a: 0.5 }, people);
    if (night) sparks(c, fx, gy - h * 0.1, h * 0.04, t);
    foreground(c, w, h, P, t, g);
  },
  missed(c, w, h, P, t, g) {
    const T = TIMES[P.time], night = P.time === 'night';
    skyAnc(c, w, h, P, t, g); const L = landAnc(c, w, h, P, t, g); const gy = L.gy;
    const { people, props: K } = compose('missed', g, night);
    const ry = gy - K.rockD * h * 0.08, rs = 1 - K.rockD * 0.3;
    c.fillStyle = mix(mix(T.ink, T.mid, 0.25), T.mid, K.rockD * 0.3); c.beginPath(); c.ellipse(w * K.rock, ry, h * 0.12 * rs, h * 0.1 * rs, 0, Math.PI, TAU); c.fill();
    const torches = people.filter((s) => s.torch).map((s) => ({ x: w * s.x + s.f * h * FH * 0.25, y: gy - h * FH, r: h * 0.45, col: '#FF9A3C', glow: 0.2 }));
    if (night) lightmap(c, w, h, 'rgba(4,4,12,0.35)', torches);
    const mx = torches.length ? torches.reduce((a, l) => a + l.x, 0) / torches.length : w * 0.5;
    peopleAnc(c, w, h, P, t, g, { x: mx, rim: T.rim, a: night ? 0.8 : 0.6 }, people);
    foreground(c, w, h, P, t, g);
  },
  stress(c, w, h, P, t, g) {
    const T = TIMES[P.time];
    skyAnc(c, w, h, P, t, g); const L = landAnc(c, w, h, P, t, g); const gy = L.gy;
    const { people, props: K } = compose('stress', g, false), Ln = K.lion;
    // the lion goes; they stay, easy
    const ly = gy - Ln.d * h * 0.08;
    for (let j = 0; j < (Ln.two ? 2 : 1); j++) {
      const lx = w * (Ln.x + Ln.dir * ((t * 0.03) % 0.08) - Ln.dir * j * 0.12);
      c.save(); if (Ln.dir < 0) { c.translate(2 * lx, 0); c.scale(-1, 1); }
      lion(c, lx, ly, h * Ln.s * (j ? 0.85 : 1), mix(mix(T.ink, '#5A4A40', 0.25), T.mid, Ln.d * 0.35), t * 5 + j, 1);
      if (!j) for (let i = 0; i < 3; i++) { c.fillStyle = mix(T.ink, T.mid, 0.4); c.beginPath(); c.ellipse(lx - h * Ln.s * (1.4 + i * 0.5), ly, h * 0.015, h * 0.006, 0, 0, TAU); c.fill(); }
      c.restore();
    }
    peopleAnc(c, w, h, P, t, g, { x: Ln.dir > 0 ? 0 : w, rim: T.rim, a: 0.55 }, people);
    foreground(c, w, h, P, t, g);
  },
  light(c, w, h, P, t, g) {
    const T = TIMES[P.time], night = P.time === 'night';
    skyAnc(c, w, h, P, t, g); const L = landAnc(c, w, h, P, t, g); const gy = L.gy;
    const { people, props: K } = compose('light', g, night);
    if (!night) {
      for (const tr of K.trees) fruitTree(c, w * tr.x, gy - h * 0.06, h * tr.s, mix(T.ink, T.mid, 0.3), '#D8A040', tr.fruit ? [{ dx: -0.2, dy: -0.8, on: 1 }, { dx: 0.1, dy: -0.9, on: 1 }, { dx: 0.3, dy: -0.75, on: 1 }] : []);
      for (const x of K.baskets) basket(c, w * x, gy - hash(x * 9) * h * 0.05, h * 0.045, mix(T.ink, T.mid, 0.3), alpha(T.rim, 0.3));
    }
    const fx = night ? w * K.fire : w * 0.5;
    if (night) { fire(c, fx, gy - h * 0.03, h * 0.045, t); lightmap(c, w, h, 'rgba(4,4,12,0.3)', [{ x: fx, y: gy - h * 0.07, r: h * 0.7, col: '#FF8A30', glow: 0.3 }]); }
    peopleAnc(c, w, h, P, t, g, night ? { x: fx, rim: T.rim, a: 0.8 } : { x: hash(g) < 0.5 ? w * 0.85 : w * 0.15, rim: T.rim, a: 0.7 }, people);
    foreground(c, w, h, P, t, g);
  },
};

// ---------- your world ----------
// A slice through a block of flats: the same floor line, the same places. Walls go where the circle was open.
const WALLS = { lonely: [0.215, 0.475, 0.635, 0.79], missed: [0.68], stress: [0.235, 0.7], light: [], compare: [0.2, 0.82], baby: [0.27, 0.73], old: [0.25, 0.5, 0.75], food: [0.66] };
const WALLPAPER = ['#6E7688', '#80766A', '#6C7C72', '#7E7488', '#77706A', '#6A7484'];
function block(c, w, h, t, beat, { day = 0 } = {}) {
  const gy = h * GY, ceil = h * 0.31, slab = h * 0.045;
  const walls = WALLS[beat];
  const xs = [0, ...walls, 1];
  // rooms
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i] * w, x1 = xs[i + 1] * w, col = WALLPAPER[(i + beat.length) % WALLPAPER.length];
    c.fillStyle = col; c.fillRect(x0, ceil, x1 - x0, gy - ceil);
    c.fillStyle = alpha('#000000', 0.08); for (let x = x0 + 6; x < x1; x += 9) c.fillRect(x, ceil, 1, gy - ceil); // paper stripes
    c.fillStyle = mix(col, '#FFFFFF', 0.25); c.fillRect(x0, gy - h * 0.025, x1 - x0, h * 0.025); // skirting
    // a window in the back wall: other blocks, other lit rooms
    if (x1 - x0 > w * 0.13 && hash(i * 7.3 + beat.length) < 0.75) {
      const ww = Math.min((x1 - x0) * 0.5, w * 0.14), wx = x0 + (x1 - x0) * (hash(i * 2.1) < 0.5 ? 0.15 : 0.55) - (hash(i * 2.1) < 0.5 ? 0 : ww * 0.5) + 6, wy = ceil + h * 0.08, wh = h * 0.24;
      cityWindow(c, wx, wy, ww, wh, t, day, i);
    }
    if (hash(i * 4.4) < 0.6) frameOnWall(c, x0 + (x1 - x0) * 0.75, ceil + h * 0.12, h * 0.06, col);
  }
  // floor and slabs, cut through
  slabCut(c, 0, gy, w, h - gy + 2);
  slabCut(c, 0, ceil - slab, w, slab);
  for (const wx of walls) { c.fillStyle = '#4A4650'; c.fillRect(wx * w - w * 0.007, ceil, w * 0.014, gy - ceil); hatch(c, wx * w - w * 0.007, ceil, w * 0.014, gy - ceil); }
  // the floor above: legs, furniture, other people's evenings
  const up = ceil - slab;
  for (let i = 0; i < 5; i++) {
    const x0 = (i / 5) * w, x1 = ((i + 1) / 5) * w;
    c.fillStyle = mix(WALLPAPER[(i + 3) % WALLPAPER.length], '#000000', 0.15); c.fillRect(x0, 0, x1 - x0, up);
    c.fillStyle = '#4A4650'; c.fillRect(x1 - w * 0.006, 0, w * 0.012, up);
  }
  return { gy, ceil, up };
}
function slabCut(c, x, y, w, h) {
  c.fillStyle = '#5A5660'; c.fillRect(x, y, w, h);
  hatch(c, x, y, w, h);
  c.fillStyle = '#3A3640'; c.fillRect(x, y, w, 1.5);
}
function hatch(c, x, y, w, h) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.strokeStyle = 'rgba(30,26,34,0.35)'; c.lineWidth = 1;
  for (let k = -h; k < w + h; k += 7) { c.beginPath(); c.moveTo(x + k, y + h); c.lineTo(x + k + h, y); c.stroke(); }
  c.restore();
}
function cityWindow(c, x, y, w, h, t, day, seed) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mix('#0C1024', '#8FB0D8', day)); g.addColorStop(1, mix('#2A2648', '#D6DEE8', day));
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
  for (let i = 0; i < 4; i++) {
    const bx = x + i * w / 3.4 - 4, bw = w / 3.6, bh = h * (0.5 + hash(i * 3.3 + seed) * 0.45);
    c.fillStyle = mix('#14142A', '#6A7084', day); c.fillRect(bx, y + h - bh, bw, bh);
    for (let yy = y + h - bh + 3; yy < y + h - 2; yy += 5) for (let xx = bx + 2; xx < bx + bw - 2; xx += 4) {
      const k = hash(xx * 1.3 + yy * 2.7 + seed);
      if (k < 0.5) { c.fillStyle = alpha(k < 0.15 ? '#9EC4FF' : '#FFD08A', (1 - day * 0.85) * (0.6 + 0.4 * Math.sin(t * 0.5 + k * 40))); c.fillRect(xx, yy, 2, 2.5); }
    }
  }
  c.restore();
  c.strokeStyle = '#E8E4DC'; c.lineWidth = 2.5; c.strokeRect(x, y, w, h); c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.stroke();
  c.fillStyle = '#D8D2C6'; c.fillRect(x - 3, y + h, w + 6, 3);
}
function frameOnWall(c, x, y, s, col) { c.fillStyle = mix(col, '#000000', 0.35); c.fillRect(x - s * 0.5, y, s, s * 0.75); c.fillStyle = mix(col, '#FFFFFF', 0.2); c.fillRect(x - s * 0.4, y + s * 0.1, s * 0.8, s * 0.55); }

function sofa(c, x, y, s, f, col = '#3C3A48') {
  c.fillStyle = col;
  c.beginPath(); c.roundRect(x - f * s * 0.2 - (f < 0 ? s * 0.42 : 0), y - s * 0.24, s * 0.42, s * 0.16, 4); c.fill();       // seat
  c.beginPath(); c.roundRect(f > 0 ? x - s * 0.26 : x + s * 0.16, y - s * 0.54, s * 0.1, s * 0.46, 5); c.fill();          // back
  c.fillStyle = mix(col, '#000', 0.3); c.fillRect(x - s * 0.2 * f - (f < 0 ? s * 0.42 : 0) + 3, y - s * 0.08, 4, s * 0.08); c.fillRect(x + s * 0.2 * f - (f > 0 ? 4 : 0) - 3 * f, y - s * 0.08, 4, s * 0.08);
}
function chair(c, x, y, s, f, col = '#2E2C36') {
  c.fillStyle = col; c.fillRect(x - s * 0.12, y - s * 0.25, s * 0.24, s * 0.035); c.fillRect(x - f * s * 0.12 - (f > 0 ? 0 : s * 0.03), y - s * 0.55, s * 0.03, s * 0.55); c.fillRect(x + f * s * 0.1 - 1, y - s * 0.25, s * 0.025, s * 0.25);
}
function table(c, x0, x1, y, s, col = '#4A4038') { c.fillStyle = col; c.fillRect(x0, y - s * 0.38, x1 - x0, s * 0.03); c.fillRect(x0 + 3, y - s * 0.38, s * 0.025, s * 0.38); c.fillRect(x1 - 3 - s * 0.025, y - s * 0.38, s * 0.025, s * 0.38); }
function laptop(c, x, y, s, f, scr = '#CFE0FF') {
  c.fillStyle = '#1C1A22'; c.fillRect(x - s * 0.08, y - s * 0.012, s * 0.16, s * 0.012);
  c.save(); c.translate(x - f * s * 0.07, y - s * 0.01); c.rotate(-f * 0.18); c.fillStyle = '#1C1A22'; c.fillRect(-s * 0.012, -s * 0.13, s * 0.014, s * 0.13); c.restore();
  c.fillStyle = scr; c.fillRect(x - f * s * 0.07 - (f > 0 ? s * 0.004 : -s * 0.002), y - s * 0.12, s * 0.008 * f, s * 0.1);
}
function tv(c, x, y, s, t, seed) {
  const hue = (t * 40 + seed * 90) % 360, l = 55 + 15 * Math.sin(t * 7 + seed);
  c.fillStyle = '#121016'; c.fillRect(x - s * 0.17, y - s * 0.13, s * 0.34, s * 0.2);
  c.fillStyle = `hsl(${hue},55%,${l}%)`; c.fillRect(x - s * 0.155, y - s * 0.118, s * 0.31, s * 0.176);
  c.fillStyle = '#121016'; c.fillRect(x - s * 0.02, y + s * 0.07, s * 0.04, s * 0.04);
  return `hsl(${hue},70%,70%)`;
}
function sideTV(c, x, y, s, f) { c.fillStyle = '#121016'; c.fillRect(x - s * 0.015, y - s * 0.2, s * 0.03, s * 0.24); }
function lamp(c, x, y, s) { c.strokeStyle = '#2A2830'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + s * 0.12); c.stroke(); c.fillStyle = '#2A2830'; c.beginPath(); c.moveTo(x - s * 0.06, y + s * 0.18); c.lineTo(x - s * 0.03, y + s * 0.12); c.lineTo(x + s * 0.03, y + s * 0.12); c.lineTo(x + s * 0.06, y + s * 0.18); c.fill(); }
function bubbles(c, x, y, s, t) {
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.55 + i / 5) % 1, bx = x + (hash(i) - 0.3) * s * 0.5, by = y - p * s * 0.9;
    c.fillStyle = alpha(i % 2 ? '#FFFFFF' : '#CFE4FF', 0.9 * (1 - p) * smooth(p, 0, 0.1));
    c.beginPath(); c.roundRect(bx, by, s * (0.16 + hash(i * 3) * 0.1), s * 0.07, 3); c.fill();
  }
}

function personMod(c, x, gy, hh, s, i, t, { red = false, rim = null, side = 1, kind = 'adult', pose } = {}) {
  const o = { pose: pose || poseOf(s.mod, t, i), facing: s.mf, body: red ? body(0) : body(i * 13 + 5, kind), color: red ? RED : '#22202A', farColor: red ? RED2 : '#3A3844', screen: '#DDEBFF' };
  lit(c, x, gy, hh, o, rim, side, 0.012);
}
const headOf = (x, gy, hh, f, seated) => [x + f * hh * 0.08, gy - hh * (seated ? 0.78 : 0.95)];

// the feed: the best of eight billion, edited, scrolling past
function feed(c, x, y, w, h, t) {
  c.fillStyle = '#0C0B10'; c.beginPath(); c.roundRect(x - 4, y - 4, w + 8, h + 8, 10); c.fill();
  c.save(); c.beginPath(); c.roundRect(x, y, w, h, 7); c.clip();
  const th = w * 0.95, off = (t * h * 0.35) % th;
  for (let k = -1; k < h / th + 2; k++) {
    const ty = y + k * th - off, seed = Math.floor((k * th - off + t * h * 0.35) / th + 50);
    const hue = (hash(seed) * 360) | 0, g = c.createLinearGradient(0, ty, 0, ty + th);
    g.addColorStop(0, `hsl(${hue},70%,62%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360},75%,42%)`);
    c.fillStyle = g; c.fillRect(x, ty + 2, w, th - 4);
    glow(c, x + w / 2, ty + th * 0.45, th * 0.5, '#FFFFFF', 0.45);
    const pose = hash(seed * 3) < 0.5 ? { frontArms: [[2.6, 0.3], [2.6, 0.3]] } : { frontArms: [[0.5, 1.4], [0.3, 0.1]] };
    drawFigure(c, x + w / 2, ty + th * 0.88, th * 0.72, { pose, facing: 0, body: body(seed), color: hash(seed * 5) < 0.5 ? '#FFF4DC' : '#FFE08A' });
    for (let i = 0; i < 5; i++) { c.fillStyle = alpha('#FFFFFF', 0.6 + 0.4 * Math.sin(t * 6 + i + seed)); const sx = x + hash(seed + i) * w, sy = ty + hash(seed * 2 + i) * th * 0.6; c.fillRect(sx - 2, sy, 4, 1); c.fillRect(sx, sy - 2, 1, 4); }
    c.fillStyle = '#FF4D6A'; c.font = `700 ${Math.round(w * 0.09)}px sans-serif`; c.fillText('♥ ' + (1 + Math.floor(hash(seed * 7) * 98)) + 'k', x + w * 0.06, ty + th - w * 0.06);
  }
  c.restore();
}
function hearts(c, x, y, s, t) {
  for (let i = 0; i < 6; i++) { const p = (t * 0.7 + i / 6) % 1; c.fillStyle = alpha('#FF4D6A', 0.9 * (1 - p)); c.font = `${Math.round(s * (0.08 + hash(i) * 0.05))}px sans-serif`; c.fillText('♥', x + Math.sin(p * 6 + i) * s * 0.12 + (hash(i * 3) - 0.5) * s * 0.3, y - p * s * 0.7); }
}
function bed(c, x0, x1, gy, s, col = '#3A3644') { c.fillStyle = col; c.fillRect(x0, gy - s * 0.22, x1 - x0, s * 0.22); c.fillStyle = mix(col, '#FFFFFF', 0.25); c.fillRect(x0, gy - s * 0.27, x1 - x0, s * 0.07); c.fillStyle = mix(col, '#000', 0.3); c.fillRect(x1 - s * 0.05, gy - s * 0.48, s * 0.05, s * 0.48); }
function crib(c, x, gy, s) { c.strokeStyle = '#4A4452'; c.lineWidth = 2; c.strokeRect(x - s * 0.17, gy - s * 0.42, s * 0.34, s * 0.3); for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(x - s * 0.17 + i * s * 0.057, gy - s * 0.42); c.lineTo(x - s * 0.17 + i * s * 0.057, gy - s * 0.12); c.stroke(); } c.beginPath(); c.moveTo(x - s * 0.15, gy - s * 0.12); c.lineTo(x - s * 0.15, gy); c.moveTo(x + s * 0.15, gy - s * 0.12); c.lineTo(x + s * 0.15, gy); c.stroke(); }
function clock(c, x, y, r, hh, mm) { c.fillStyle = '#EDE6DA'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#16141C'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.sin(hh) * r * 0.5, y - Math.cos(hh) * r * 0.5); c.moveTo(x, y); c.lineTo(x + Math.sin(mm) * r * 0.8, y - Math.cos(mm) * r * 0.8); c.stroke(); }

const MOD = {
  // the best of eight billion, on the wall of your room
  compare(c, w, h, t, u) {
    const B = block(c, w, h, t, 'compare'), gy = B.gy, fh = h * FH, lights = []; upstairs(c, w, h, t, B.up, lights);
    const rx = w * 0.32; sofa(c, rx, gy, fh, 1);
    const fx = w * 0.47, fy = B.ceil + h * 0.03, fw = w * 0.2, fhh = gy - h * 0.06 - fy;
    feed(c, fx, fy, fw, fhh, t);
    lights.push({ x: fx + fw / 2, y: fy + fhh / 2, r: h * 0.55, col: '#FFD0E0', glow: 0.3, rect: { x: fx, y: fy, w: fw, h: fhh, a: 1 } });
    sofa(c, w * 0.1, gy, fh, 1, '#4A3E3A'); lights.push({ x: w * 0.1 + fh * 0.2, y: gy - fh * 0.6, r: h * 0.15, col: '#BFD8FF' });
    lights.push({ x: w * 0.9 - fh * 0.15, y: gy - fh * 0.85, r: h * 0.12, col: '#BFD8FF' });
    lights.push({ x: rx + fh * 0.2, y: gy - fh * 0.6, r: h * 0.16, col: '#BFD8FF', glow: 0.3 });
    lightmap(c, w, h, 'rgba(6,8,22,0.74)', lights);
    personMod(c, w * 0.1, gy, fh, { mod: 'slumpPhone', mf: 1 }, 0, t, { rim: alpha('#BFD8FF', 0.5), side: 1 });
    personMod(c, w * 0.9, gy, fh, { mod: 'phone', mf: -1 }, 2, t, { rim: alpha('#BFD8FF', 0.5), side: -1 });
    personMod(c, rx, gy, fh, { mod: 'slumpPhone', mf: 1 }, 1, t, { red: true, rim: alpha('#FFD0E0', 0.7), side: 1 });
    hearts(c, fx + fw * 0.8, fy + fhh * 0.9, fh, t);
    const [hx, hy] = headOf(rx, gy, fh, 1, true); signal(c, hx, hy - fh * 0.05, fh * 0.42, t, 1, SIG);
  },
  // three in the morning, the baby, and you; on both sides of the walls, people asleep
  baby(c, w, h, t, u) {
    const B = block(c, w, h, t, 'baby'), gy = B.gy, fh = h * FH, lights = []; upstairs(c, w, h, t, B.up, lights);
    bed(c, w * 0.04, w * 0.24, gy, fh); bed(c, w * 0.76, w * 0.96, gy, fh);
    bed(c, w * 0.3, w * 0.46, gy, fh, '#443E50'); crib(c, w * 0.66, gy, fh);
    clock(c, w * 0.6, B.ceil + h * 0.08, h * 0.03, 0.15 * TAU * 0 + (3 / 12) * TAU + u * 0.3, u * TAU * 4);
    c.fillStyle = '#E8E4DC'; c.fillRect(w * 0.43, gy - fh * 0.3, fh * 0.03, fh * 0.07); // a bottle by the bed
    const px = w * (0.52 + Math.sin(t * 0.9) * 0.04);
    lamp(c, w * 0.38, B.ceil, fh); lights.push({ x: w * 0.38, y: B.ceil + fh * 0.3, r: h * 0.35, col: '#FFC890', glow: 0.12, a: 0.65 });
    lightmap(c, w, h, 'rgba(6,8,22,0.8)', lights);
    for (const [x, k] of [[w * 0.06, 0], [w * 0.78, 1]]) drawLying(c, x, gy - fh * 0.26, fh * 0.85, { body: body(k * 7 + 3), color: '#1A1820' });
    const pose = { ...walkPose(t * 3, { stride: 0.35, swing: 0 }), arms: POSES.carry.arms, bundle: true, head: 0.3, lean: 0.06 };
    const dir = Math.cos(t * 0.9) > 0 ? 1 : -1;
    drawFigure(c, px, gy, fh, { pose, facing: dir, body: body(0), color: RED, farColor: RED2, bundleColor: '#F0D8C8' });
    for (let i = 0; i < 3; i++) { const p = (t * 1.6 + i / 3) % 1; c.strokeStyle = alpha('#FFE0D0', 0.7 * (1 - p)); c.lineWidth = 1.5; c.beginPath(); c.arc(px + dir * fh * 0.25, gy - fh * 0.62, fh * (0.06 + p * 0.14), -0.7, 0.7); c.stroke(); }
    signal(c, px + dir * fh * 0.06, gy - fh * 1.0, fh * 0.42, t, 1, SIG);
  },
  // a row of the same room, one old person in each, the TV on
  old(c, w, h, t, u) {
    const B = block(c, w, h, t, 'old'), gy = B.gy, fh = h * FH, lights = []; upstairs(c, w, h, t, B.up, lights);
    const xs = [0.075, 0.325, 0.575, 0.825], cols = [];
    xs.forEach((x, i) => {
      chair(c, w * x, gy, fh, 1, '#4A4252'); c.fillStyle = '#5A5262'; c.fillRect(w * x - fh * 0.14, gy - fh * 0.28, fh * 0.26, fh * 0.06);
      cols.push(tv(c, w * x + w * 0.13, gy - fh * 0.58, fh * 0.8, t + i * 1.7, i + 3));
      lights.push({ x: w * x + w * 0.13, y: gy - fh * 0.58, r: h * 0.28, col: cols[i], glow: 0.18 });
      c.fillStyle = '#E8E4DC'; c.fillRect(w * x + w * 0.05, gy - fh * 0.33, fh * 0.035, fh * 0.05); // a cup
    });
    frameOnWall(c, w * 0.42, B.ceil + h * 0.12, h * 0.07, '#7A7468');
    lightmap(c, w, h, 'rgba(6,8,22,0.62)', lights);
    xs.forEach((x, i) => {
      const o = { pose: { ...POSES.slump, lean: 0.32, head: 0.55, arms: [[0.5, 0.6], [0.4, 0.7]] }, facing: 1, body: i === 1 ? body(0) : body(i * 13 + 2), color: i === 1 ? RED : '#22202A', farColor: i === 1 ? RED2 : '#3A3844' };
      lit(c, w * x, gy, fh * 0.95, o, alpha(cols[i], 0.6), 1, 0.012);
    });
    signal(c, w * xs[1] + fh * 0.1, gy - fh * 0.75, fh * 0.42, t, 1, SIG);
  },
  // soft, sweet, fast, and a knock at the door with more
  food(c, w, h, t, u) {
    const B = block(c, w, h, t, 'food'), gy = B.gy, fh = h * FH, lights = []; upstairs(c, w, h, t, B.up, lights);
    const rx = w * 0.2; sofa(c, rx, gy, fh, 1);
    const tvc = tv(c, w * 0.4, gy - fh * 0.62, fh, t, 9); lights.push({ x: w * 0.4, y: gy - fh * 0.62, r: h * 0.3, col: tvc, glow: 0.2 });
    // the coffee table: boxes, bags, cups, more of them as time goes
    c.fillStyle = '#3A3440'; c.fillRect(w * 0.27, gy - fh * 0.2, w * 0.1, fh * 0.03); c.fillRect(w * 0.275, gy - fh * 0.2, 3, fh * 0.2); c.fillRect(w * 0.365, gy - fh * 0.2, 3, fh * 0.2);
    const n = 2 + Math.floor(u * 6), wrap = ['#E8402A', '#F2C230', '#E8E4DC', '#D85A9A', '#3A9AD8'];
    for (let i = 0; i < n; i++) { const bx = w * 0.275 + (i % 4) * w * 0.022, by = gy - fh * 0.2 - Math.floor(i / 4) * fh * 0.06; c.fillStyle = wrap[i % wrap.length]; c.fillRect(bx, by - fh * 0.055, w * 0.018, fh * 0.055); }
    for (let i = 0; i < 2 + Math.floor(u * 4); i++) { c.fillStyle = wrap[(i + 2) % wrap.length]; c.fillRect(w * (0.08 + i * 0.03), gy - fh * 0.06, w * 0.022, fh * 0.06); }
    // the fridge, open
    const fx = w * 0.56; c.fillStyle = '#C8CCD0'; c.fillRect(fx - fh * 0.14, gy - fh * 0.85, fh * 0.28, fh * 0.85); c.fillStyle = '#F4F8FF'; c.fillRect(fx - fh * 0.12, gy - fh * 0.82, fh * 0.24, fh * 0.78);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { c.fillStyle = wrap[(i + j) % wrap.length]; c.fillRect(fx - fh * 0.1 + j * fh * 0.075, gy - fh * (0.78 - i * 0.19), fh * 0.05, fh * 0.08); }
    lights.push({ x: fx, y: gy - fh * 0.45, r: h * 0.4, col: '#E8F2FF', glow: 0.2, rect: { x: fx - fh * 0.12, y: gy - fh * 0.82, w: fh * 0.24, h: fh * 0.78, a: 1 } });
    // next door, in the corridor: another order arriving
    c.fillStyle = '#5A4E46'; c.fillRect(w * 0.7, gy - fh * 1.08, fh * 0.42, fh * 1.08);
    const dx = w * 0.86; lights.push({ x: dx, y: B.ceil + 6, r: h * 0.4, col: '#E8F2E0', glow: 0.08, a: 0.7 });
    lightmap(c, w, h, 'rgba(6,8,22,0.7)', lights);
    personMod(c, dx, gy, fh, { mod: 'phone', mf: -1 }, 3, t, { rim: alpha('#E8F2E0', 0.4), side: 1 });
    c.fillStyle = '#20A070'; c.fillRect(dx + fh * 0.05, gy - fh * 0.82, fh * 0.2, fh * 0.24); c.fillStyle = '#F4F4EE'; c.fillRect(dx + fh * 0.09, gy - fh * 0.74, fh * 0.12, fh * 0.03);
    const hand = Math.sin(t * 3) > 0 ? 2.25 : 1.6;
    personMod(c, rx, gy, fh, { mod: 'slump', mf: 1 }, 1, t, { red: true, rim: alpha(tvc, 0.6), side: 1, pose: { ...POSES.slump, lean: 0.15, head: 0.2, arms: [[0.75, hand], [0.5, 1.1]] } });
  },
  // the same five people, a wall between each, each with a screen
  lonely(c, w, h, t, u) {
    const B = block(c, w, h, t, 'lonely'), gy = B.gy, fh = h * FH, S = STAGE.lonely;
    const lights = [];
    upstairs(c, w, h, t, B.up, lights);
    // red: sofa, phone, a TV on the wall where the fire was
    const r = S[1], rx = w * r.x; sofa(c, rx, gy, fh, 1); const tvc = tv(c, w * 0.42, gy - fh * 0.62, fh, t, 1);
    lights.push({ x: w * 0.42, y: gy - fh * 0.62, r: h * 0.35, col: tvc, glow: 0.22 }, { x: rx + fh * 0.2, y: gy - fh * 0.6, r: h * 0.18, col: '#BFD8FF', glow: 0.3 });
    // across the wall, back to back with it: their own TV
    const n2 = S[2], x2 = w * n2.x; sofa(c, x2, gy, fh, -1, '#4A3E3A'); const tv2 = tv(c, w * 0.515, gy - fh * 0.62, fh, t + 3, 2);
    lights.push({ x: w * 0.515, y: gy - fh * 0.62, r: h * 0.3, col: tv2, glow: 0.2 });
    // kitchen: on the phone
    c.fillStyle = '#3A3842'; c.fillRect(0, gy - fh * 0.42, w * 0.08, fh * 0.42); c.fillStyle = '#C8C4BC'; c.fillRect(0, gy - fh * 0.44, w * 0.09, fh * 0.03);
    lights.push({ x: w * S[0].x + fh * 0.15, y: gy - fh * 0.85, r: h * 0.14, col: '#BFD8FF' });
    lamp(c, w * S[3].x, B.ceil, fh); lights.push({ x: w * S[3].x, y: B.ceil + fh * 0.25, r: h * 0.38, col: '#FFD7A0', glow: 0.12, a: 0.7 });
    lights.push({ x: w * S[3].x - fh * 0.15, y: gy - fh * 0.85, r: h * 0.12, col: '#BFD8FF' });
    // the kid: a desk, a game
    const x4 = w * S[4].x; table(c, x4 + fh * 0.1, x4 + fh * 0.36, gy, fh, '#3A3440'); chair(c, x4, gy, fh * 0.62, 1);
    c.fillStyle = '#121016'; c.fillRect(x4 + fh * 0.28, gy - fh * 0.6, fh * 0.03, fh * 0.22); c.fillStyle = `hsl(${(t * 90) % 360},70%,60%)`; c.fillRect(x4 + fh * 0.275, gy - fh * 0.58, fh * 0.01, fh * 0.18);
    lights.push({ x: x4 + fh * 0.27, y: gy - fh * 0.5, r: h * 0.22, col: '#8FA8FF', glow: 0.2 });
    lightmap(c, w, h, 'rgba(6,8,22,0.72)', lights);
    personMod(c, w * S[0].x, gy, fh, S[0], 0, t, { rim: alpha('#BFD8FF', 0.6), side: 1 });
    personMod(c, x2, gy, fh, n2, 2, t, { rim: alpha(tv2, 0.6), side: -1 });
    personMod(c, w * S[3].x, gy, fh, S[3], 3, t, { rim: alpha('#FFD7A0', 0.5), side: 1 });
    personMod(c, x4, gy, fh * 0.62, S[4], 4, t, { kind: 'child', rim: alpha('#8FA8FF', 0.7), side: 1 });
    personMod(c, rx, gy, fh, r, 1, t, { red: true, rim: alpha(tvc, 0.7), side: 1 });
    bubbles(c, rx + fh * 0.15, gy - fh * 0.8, fh, t);
    const [hx, hy] = headOf(rx, gy, fh, 1, true); signal(c, hx, hy - fh * 0.05, fh * 0.42, t, 1, SIG);
  },
  // they walk past his door, the other way, looking down. Days go by in the window. The post piles up.
  missed(c, w, h, t, u) {
    const day = 0.5 - 0.5 * Math.cos(u * TAU * 2.5 + Math.PI);
    const B = block(c, w, h, t, 'missed', { day }), gy = B.gy, fh = h * FH, S = STAGE.missed;
    const lights = []; upstairs(c, w, h, t, B.up, lights);
    // a corridor: doors and strip lights
    c.fillStyle = '#7C7A72'; c.fillRect(0, B.ceil, w * 0.68 - w * 0.007, gy - B.ceil);
    for (let i = 0; i < 3; i++) { const dx = w * (0.07 + i * 0.22); c.fillStyle = '#5A4E46'; c.fillRect(dx, gy - fh * 1.08, fh * 0.42, fh * 1.08); c.fillStyle = '#D8C88A'; c.fillRect(dx + fh * 0.34, gy - fh * 0.55, fh * 0.04, fh * 0.02); c.fillStyle = '#E8E4DC'; c.fillRect(dx + fh * 0.15, gy - fh * 0.92, fh * 0.12, fh * 0.05); }
    for (let i = 0; i < 3; i++) { const lx = w * (0.12 + i * 0.22); c.fillStyle = '#F4F6F2'; c.fillRect(lx, B.ceil, w * 0.08, 3); lights.push({ x: lx + w * 0.04, y: B.ceil + 6, r: h * 0.42, col: '#E8F2E0', glow: 0.08, a: 0.75 }); }
    // his flat: sofa, the phone on the floor, the post behind the door
    const x4 = w * S[4].x; sofa(c, x4 + fh * 0.35, gy, fh, -1);
    c.fillStyle = '#0E0C12'; c.fillRect(x4 - fh * 0.5, gy - 4, fh * 0.14, 4); c.fillStyle = alpha('#9EC4FF', 0.25 + 0.2 * Math.sin(t * 2)); c.fillRect(x4 - fh * 0.49, gy - 4, fh * 0.12, 1.5);
    const n = 1 + Math.floor(u * 9);
    for (let i = 0; i < n; i++) { c.save(); c.translate(w * 0.695 + hash(i) * fh * 0.25, gy - 2 - i * 1.6); c.rotate((hash(i * 3) - 0.5) * 0.6); c.fillStyle = i === n - 1 ? '#F2EEE4' : '#D8D2C6'; c.fillRect(-fh * 0.07, -2, fh * 0.14, 3.5); c.restore(); }
    // a clock
    const cx = w * 0.93, cy = B.ceil + h * 0.07, cr = h * 0.035; c.fillStyle = '#EDE6DA'; c.beginPath(); c.arc(cx, cy, cr, 0, TAU); c.fill();
    c.strokeStyle = '#16141C'; c.lineWidth = 1.5; const a = u * TAU * 5; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a) * cr * 0.8, cy - Math.cos(a) * cr * 0.8); c.moveTo(cx, cy); c.lineTo(cx + Math.sin(a / 12) * cr * 0.5, cy - Math.cos(a / 12) * cr * 0.5); c.stroke();
    lights.push({ x: w * 0.84, y: B.ceil + h * 0.2, r: h * 0.45 * (0.2 + day * 0.8), col: '#DDE6F0', glow: 0.1 * day, a: 0.9 * day });
    lightmap(c, w, h, `rgba(6,8,22,${0.55 + 0.2 * (1 - day)})`, lights);
    S.slice(0, 4).forEach((s, i) => personMod(c, w * s.x, gy, fh, s, i, t, { rim: alpha('#E8F2E0', 0.45), side: -1 }));
    personMod(c, x4, gy, fh, S[4], 4, t, { red: true, pose: { ...POSES.sitGround, head: 0.5, lean: 0.25 } });
    signal(c, x4 - fh * 0.06, gy - fh * 0.62, fh * 0.42, t, 1, SIG);
  },
  // the danger is a letter, and it keeps coming through the door
  stress(c, w, h, t, u) {
    const B = block(c, w, h, t, 'stress'), gy = B.gy, fh = h * FH, S = STAGE.stress;
    const lights = []; upstairs(c, w, h, t, B.up, lights);
    // next door: TV
    sofa(c, w * S[0].x, gy, fh, 1); const tvc = tv(c, w * 0.205, gy - fh * 0.6, fh, t, 4);
    lights.push({ x: w * 0.205, y: gy - fh * 0.6, r: h * 0.28, col: tvc, glow: 0.2 });
    // the kitchen table, the laptop, the bills
    const x1 = w * S[1].x; chair(c, x1, gy, fh, 1); table(c, x1 + fh * 0.12, x1 + fh * 0.55, gy, fh);
    laptop(c, x1 + fh * 0.36, gy - fh * 0.385, fh, -1, '#FFD0C8');
    lights.push({ x: x1 + fh * 0.3, y: gy - fh * 0.5, r: h * 0.3, col: '#D8E4FF', glow: 0.25 });
    const piles = 3 + Math.floor(u * 10);
    for (let i = 0; i < piles; i++) { c.save(); c.translate(x1 + fh * (0.45 + hash(i) * 0.08), gy - fh * 0.39 - i * 1.8); c.rotate((hash(i * 3) - 0.5) * 0.4); c.fillStyle = '#EDE6DA'; c.fillRect(-fh * 0.07, -2, fh * 0.14, 3.2); c.fillStyle = '#C8201A'; c.fillRect(-fh * 0.04, -1.5, fh * 0.03, 2); c.restore(); }
    // the front door where the lion stood; post keeps landing
    const dx = w * 0.82; c.fillStyle = '#4A3A34'; c.fillRect(dx - fh * 0.22, gy - fh * 1.1, fh * 0.44, fh * 1.1); c.fillStyle = '#B8A060'; c.fillRect(dx - fh * 0.08, gy - fh * 0.62, fh * 0.16, fh * 0.03);
    const fall = (t * 0.8) % 1; c.save(); c.translate(dx, gy - fh * 0.6 + fall * fh * 0.58); c.rotate(fall * 2); c.fillStyle = '#F2EEE4'; c.fillRect(-fh * 0.06, -2, fh * 0.12, 4); c.fillStyle = '#C8201A'; c.fillRect(-fh * 0.03, -1, fh * 0.02, 2); c.restore();
    for (let i = 0; i < 4 + Math.floor(u * 6); i++) { c.save(); c.translate(dx - fh * 0.15 + hash(i * 5) * fh * 0.3, gy - 2 - (i % 3) * 1.6); c.rotate((hash(i * 7) - 0.5) * 0.8); c.fillStyle = '#E2DCD0'; c.fillRect(-fh * 0.06, -2, fh * 0.12, 3); c.restore(); }
    lights.push({ x: w * S[2].x + fh * 0.15, y: gy - fh * 0.85, r: h * 0.12, col: '#BFD8FF' });
    lightmap(c, w, h, 'rgba(6,8,22,0.74)', lights);
    personMod(c, w * S[0].x, gy, fh, S[0], 0, t, { rim: alpha(tvc, 0.6), side: 1, pose: { ...POSES.slump, lean: 0.25, head: 0.2 } });
    personMod(c, w * S[2].x, gy, fh, S[2], 2, t, { rim: alpha('#BFD8FF', 0.5), side: 1 });
    personMod(c, x1, gy, fh, S[1], 1, t, { red: true, rim: alpha('#D8E4FF', 0.7), side: 1, pose: { ...POSES.slump, arms: [[1.5, 1.6], [1.3, 1.5]], head: 0.8 } });
    signal(c, x1 + fh * 0.12, gy - fh * 0.8, fh * 0.42, t, 1, SIG);
  },
  // daytime under tubes, no window; night lit by a phone and the street
  light(c, w, h, t, u) {
    const fh = h * FH, gy = h * GY, S = STAGE.light;
    if (u < 0.5) {
      c.fillStyle = '#C4C8C2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#D8DAD4'; c.fillRect(0, 0, w, h * 0.22);
      c.strokeStyle = '#B0B4AE'; c.lineWidth = 1; for (let x = 0; x < w; x += w / 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h * 0.22); c.stroke(); }
      for (let i = 0; i < 4; i++) { const lx = w * (0.08 + i * 0.24), on = i === 2 ? (Math.sin(t * 23) > -0.6 ? 1 : 0.3) : 1; c.fillStyle = mix('#9AA09A', '#FFFFFF', on); c.fillRect(lx, h * 0.2, w * 0.14, h * 0.018); glow(c, lx + w * 0.07, h * 0.24, h * 0.4, '#EEF6EA', 0.35 * on); }
      c.fillStyle = '#AEB2AC'; c.fillRect(0, h * 0.22, w, 2);
      c.fillStyle = '#E2E2DA'; c.fillRect(w * 0.42, h * 0.3, w * 0.16, h * 0.13); c.strokeStyle = '#8A8E88'; c.strokeRect(w * 0.42, h * 0.3, w * 0.16, h * 0.13);
      c.fillStyle = '#8C9088'; for (let i = 0; i < 3; i++) c.fillRect(w * 0.44, h * (0.33 + i * 0.03), w * (0.06 + hash(i) * 0.06), 2);
      c.fillStyle = '#9A9C94'; c.fillRect(w * 0.05, h * 0.3, w * 0.07, h * 0.12); c.fillStyle = '#B4B6AE'; for (let y = h * 0.305; y < h * 0.42; y += 4) c.fillRect(w * 0.05, y, w * 0.07, 1.5);
      c.fillStyle = '#7E8278'; c.fillRect(0, gy, w, h - gy); c.fillStyle = '#6E7268'; for (let x = 0; x < w; x += 18) c.fillRect(x, gy, 1, h - gy);
      // partitions between the desks
      for (const px of [0.28, 0.5, 0.72]) { c.fillStyle = '#8E948C'; c.fillRect(w * px - 3, gy - fh * 0.62, 6, fh * 0.62); c.fillStyle = '#A4AAA2'; c.fillRect(w * px - 3, gy - fh * 0.62, 6, 3); }
      S.slice(0, 3).forEach((s, i) => {
        const x = w * s.x; table(c, x + s.mf * fh * 0.12 - (s.mf < 0 ? fh * 0.36 : 0), x + s.mf * fh * 0.12 + (s.mf > 0 ? fh * 0.36 : 0), gy, fh, '#5E625A');
        chair(c, x, gy, fh, s.mf, '#3A3C38');
        const mx = x + s.mf * fh * 0.36; c.fillStyle = '#1E2024'; c.fillRect(mx - fh * 0.015, gy - fh * 0.68, fh * 0.03, fh * 0.28); c.fillStyle = '#CFE0F0'; c.fillRect(mx - s.mf * fh * 0.02 - 1, gy - fh * 0.66, 2, fh * 0.22);
        personMod(c, x, gy, fh, s, i, t, { red: i === 1, rim: alpha('#FFFFFF', 0.35), side: s.mf });
      });
      // the kitchen corner: coffee
      c.fillStyle = '#5E625A'; c.fillRect(w * 0.88, gy - fh * 0.45, w * 0.12, fh * 0.45); c.fillStyle = '#2A2C28'; c.fillRect(w * 0.92, gy - fh * 0.62, w * 0.04, fh * 0.17);
      personMod(c, w * S[3].x, gy, fh, S[3], 3, t, { rim: alpha('#FFFFFF', 0.35), side: -1 });
      c.fillStyle = 'rgba(200,214,190,0.12)'; c.fillRect(0, 0, w, h); // tube green
          } else {
      // night: the same row, in bed, in the next flat, out on the street
      const B = block(c, w, h, t, 'light'), lights = []; upstairs(c, w, h, t, B.up, lights);
      // a wall to the street at x .5: the outside
      const ex = w * 0.5;
      const sk = c.createLinearGradient(0, B.ceil, 0, gy); sk.addColorStop(0, '#2A1E30'); sk.addColorStop(1, '#6A4A3A');
      c.fillStyle = sk; c.fillRect(ex, B.ceil, w - ex, gy - B.ceil);
      for (let i = 0; i < 3; i++) { const bx = ex + w * (0.06 + i * 0.15), bh = h * (0.3 + hash(i) * 0.2); c.fillStyle = '#1A1620'; c.fillRect(bx, gy - bh, w * 0.12, bh); for (let y = gy - bh + 5; y < gy - 4; y += 7) for (let x = bx + 3; x < bx + w * 0.12 - 3; x += 6) if (hash(x * 1.7 + y) < 0.6) { c.fillStyle = hash(x + y * 3) < 0.3 ? '#9EC4FF' : '#FFC878'; c.fillRect(x, y, 3, 3.5); } }
      // street lamp and a lit sign where the tree was
      const lx = w * 0.64; c.fillStyle = '#121016'; c.fillRect(lx - 2, gy - fh * 1.3, 4, fh * 1.3); c.fillRect(lx - 2, gy - fh * 1.3, fh * 0.2, 4); c.fillStyle = '#FFD890'; c.fillRect(lx + fh * 0.12, gy - fh * 1.27, fh * 0.1, 4);
      lights.push({ x: lx + fh * 0.17, y: gy - fh * 1.2, r: h * 0.5, col: '#FFB050', glow: 0.25, a: 0.85 });
      const bx = w * 0.83, by = gy - fh * 0.95, pulse = 0.75 + 0.25 * Math.sin(t * 3);
      c.fillStyle = '#121016'; c.fillRect(bx - 2, by, 4, fh * 0.95); c.fillStyle = `hsl(${(t * 30) % 360},80%,${55 * pulse}%)`; c.fillRect(bx - fh * 0.3, by - fh * 0.3, fh * 0.6, fh * 0.32);
      lights.push({ x: bx, y: by - fh * 0.15, r: h * 0.45, col: '#FF5AA0', glow: 0.22, a: 0.9 });
      // next door: TV
      sofa(c, w * S[0].x, gy, fh, 1); const tvc = tv(c, w * 0.3, gy - fh * 0.62, fh, t, 6);
      lights.push({ x: w * 0.3, y: gy - fh * 0.62, r: h * 0.28, col: tvc, glow: 0.2 });
      // his bed, under the window glow
      const x1 = w * S[1].x; c.fillStyle = '#3A3644'; c.fillRect(x1 - fh * 0.55, gy - fh * 0.22, fh * 1.05, fh * 0.22); c.fillStyle = '#7A7488'; c.fillRect(x1 - fh * 0.55, gy - fh * 0.27, fh * 1.05, fh * 0.07); c.fillStyle = '#2A2632'; c.fillRect(x1 + fh * 0.45, gy - fh * 0.5, fh * 0.06, fh * 0.5);
      lights.push({ x: x1 + fh * 0.32, y: gy - fh * 0.42, r: h * 0.22, col: '#BFD8FF', glow: 0.35 });
      lightmap(c, w, h, 'rgba(8,8,22,0.7)', lights);
      personMod(c, w * S[0].x, gy, fh, S[0], 0, t, { rim: alpha(tvc, 0.6), side: 1, pose: POSES.slumpPhone });
      drawLying(c, x1 - fh * 0.5, gy - fh * 0.24, fh * 0.95, { body: body(0), color: RED, farColor: RED2 });
      c.fillStyle = '#EAF2FF'; c.fillRect(x1 + fh * 0.3, gy - fh * 0.52, fh * 0.035, fh * 0.07);
      [S[2], S[3]].forEach((s, k) => personMod(c, w * s.x, gy, fh, s, k + 2, t, { rim: alpha(k ? '#FF5AA0' : '#FFB050', 0.6), side: k ? 1 : 1, pose: poseOf('walkPhone', t, k) }));
    }
  },
};
// the floor above, cut off by the frame: other people's lit evenings
function upstairs(c, w, h, t, up, lights) {
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + i * 0.2), k = hash(i * 5.7 + 0.3), fh = h * FH, o = { body: body(i * 9 + 2), color: '#22202A', farColor: '#3A3844', screen: '#DDEBFF' };
    if (k < 0.35) { sofa(c, x, up, fh, 1); drawFigure(c, x, up, fh, { ...o, pose: POSES.slumpPhone, facing: 1 }); lights.push({ x: x + fh * 0.4, y: up - fh * 0.45, r: h * 0.18, col: `hsl(${(t * 30 + i * 70) % 360},60%,65%)`, glow: 0.15 }); }
    else if (k < 0.6) { drawFigure(c, x, up, fh, { ...o, pose: POSES.phone, facing: -1 }); lights.push({ x: x - fh * 0.15, y: up - fh * 0.85, r: h * 0.1, col: '#BFD8FF' }); }
    else if (k < 0.8) { table(c, x + fh * 0.1, x + fh * 0.4, up, fh, '#3A3440'); chair(c, x, up, fh, 1); drawFigure(c, x, up, fh, { ...o, pose: POSES.sitChair, facing: 1 }); lights.push({ x: x + fh * 0.32, y: up - fh * 0.5, r: h * 0.15, col: '#CFE0FF' }); }
    else { c.fillStyle = '#2A2830'; c.fillRect(x - fh * 0.1, up - fh * 0.3, fh * 0.5, fh * 0.3); }
  }
}

// ---------- the swap ----------
function scanEdge(c, w, h, x, t) {
  const g = c.createLinearGradient(x - w * 0.14, 0, x, 0);
  g.addColorStop(0, 'rgba(110,230,255,0)'); g.addColorStop(1, 'rgba(110,230,255,0.28)');
  c.fillStyle = g; c.fillRect(x - w * 0.14, 0, w * 0.14, h);
  c.fillStyle = 'rgba(160,240,255,0.18)'; for (let y = 0; y < h; y += 3) c.fillRect(x - w * 0.14, y, w * 0.14, 1);
  // a grid on the floor and walls, behind the edge
  c.strokeStyle = 'rgba(150,240,255,0.35)'; c.lineWidth = 1;
  for (let k = 0; k < 6; k++) { const gx = x - k * w * 0.025; c.globalAlpha = 1 - k / 6; c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, h); c.stroke(); }
  c.globalAlpha = 1;
  glow(c, x, h * 0.5, h * 0.9, '#9FF0FF', 0.25);
  c.fillStyle = '#E8FCFF'; c.fillRect(x - 1.5, 0, 3, h);
  for (let i = 0; i < 18; i++) { const y = hash(i * 3.1 + Math.floor(t * 20)) * h; c.fillStyle = alpha('#CFF8FF', 0.8); c.fillRect(x - 6 - hash(i) * 20, y, 4 + hash(i * 2) * 14, 1.5); }
}

// ---------- entry ----------
// mr: { from: generation shown before, k: 0..1 } swaps from that scene to this one with a scan.
// Into your world the scan is the full mixed-reality edge; between ancestors it is a quick, quiet wipe.
export function drawFrameScene(c, w, h, beat, g, t, u, first = false, mr = null) {
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  const paint = (cx, gg, uu) => {
    if (gg === 0) return (MOD[beat] || MOD.lonely)(cx, w, h, t, uu);
    const P = placeFor(gg, beat); if (first && beat === 'light' && gg === first) P.time = 'day';
    (MATCH[beat] || MATCH.lonely)(cx, w, h, P, t, gg, uu);
  };
  const toYou = g === 0;
  if (mr && mr.k < 1 && mr.from !== g) {
    const dpr = c.getTransform().a, A = buf('mrA', w, h, dpr), Bf = buf('mrB', w, h, dpr);
    for (const X of [A, Bf]) { X.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); X.ctx.clearRect(0, 0, w, h); }
    paint(A.ctx, mr.from, 0.5); paint(Bf.ctx, g, u);
    const x = toYou ? lerp(-w * 0.02, w * 1.16, easeInOut(mr.k)) : lerp(0, w, mr.k);
    c.drawImage(A.c, 0, 0, w, h);
    if (toYou && mr.k > 0 && mr.k < 0.25) { c.globalAlpha = 0.12 * Math.max(0, Math.sin(t * 60)); c.drawImage(Bf.c, 0, 0, w, h); c.globalAlpha = 1; }
    c.save(); c.beginPath(); c.rect(0, 0, Math.max(0, x), h); c.clip(); c.drawImage(Bf.c, 0, 0, w, h); c.restore();
    if (toYou) {
      for (let i = 0; i < 5; i++) {
        const sy = hash(i * 7.7 + Math.floor(t * 30)) * h, sh = 3 + hash(i * 2.2) * 8, off = (hash(i * 9.1 + Math.floor(t * 30)) - 0.5) * 24;
        if (x > 30) c.drawImage(Bf.c, (x - 30) * dpr, sy * dpr, 30 * dpr, sh * dpr, x - 30 + off, sy, 30, sh);
      }
      scanEdge(c, w, h, x, t);
    } else { glow(c, x, h * 0.5, h * 0.6, '#FFF4E0', 0.18); c.fillStyle = 'rgba(255,248,236,0.7)'; c.fillRect(x - 1, 0, 2, h); }
  } else paint(c, g, u);
  grain(c, w, h, t, toYou ? 0.08 : 0.06); vignette(c, w, h, toYou ? 0.45 : 0.35);
  c.restore();
}

// for modern.js (the generated modern scenes)
export { lit, lightmap, grain, vignette, sofa, chair, table, laptop, tv, lamp, cityWindow, slabCut, hatch, frameOnWall, bed, upstairs, buf, rng, GY, FH, RED, RED2, SIG, WALLPAPER };

// ---------- topics from outside ----------
// registerTopic(key, { compose(ctx), props?(c, w, h, P, t, g, K, env), times?: ['day', 'dusk', 'night'], modern(c, w, h, t, u, HELP), walls?: [] })
// compose gets { R, add, place, kind, props, people, taken, night, g } and adds people the way compose() does.
const HELP = { block, upstairs, lightmap, sofa, chair, table, laptop, tv, sideTV, lamp, bed, crib, clock, feed, hearts, bubbles, cityWindow, slabCut, hatch, frameOnWall,
  personMod, lit, headOf, shadow, spear, basket, smoke, sparks, leanTo, rack, bigTree, stars, grain, vignette, poseOf, GY, FH, SIG, RED, RED2, TIMES };
export function registerTopic(key, spec) {
  EXTRA[key] = spec;
  MATCH[key] = camp(key);
  MOD[key] = (c, w, h, t, u) => spec.modern(c, w, h, t, u, HELP);
  if (spec.walls) WALLS[key] = spec.walls;
}
export function registerPose(name, fn) { XPOSES[name] = fn; }
export { HELP };
