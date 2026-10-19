// Your world, generated from a seed the way the ancestors' scenes are generated from a generation number:
// where you are, the time of day, who is near you and what they are doing. You are always in it, in red, with the signal on.
// Loneliness beat: people close by, every one of them apart.
import { TAU, clamp, lerp, smooth, easeInOut, mix, alpha, hash, glow } from '../../v4/src/art.js';
import { drawFigure, walkPose, POSES, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';
import { lit, lightmap, grain, vignette, sofa, chair, table, laptop, tv, lamp, cityWindow, slabCut, hatch, frameOnWall, bed, upstairs, buf, rng, GY, FH, RED, RED2, SIG, WALLPAPER } from './frame.js';

// topics without an alarm signal (daylight, food, ...) turn the gold rings off
export const RINGS = { on: true };
const TIME = {
  day: { dark: 'rgba(10,12,26,0.2)', day: 1 },
  evening: { dark: 'rgba(8,10,24,0.5)', day: 0.35 },
  night: { dark: 'rgba(6,8,22,0.72)', day: 0 },
};
const poseOf = (name, t, i) => {
  if (name === 'walk') return walkPose(t * 4.2 + i * 1.7, { stride: 0.75, swing: 0.7 });
  if (name === 'walkPhone') return { ...walkPose(t * 3.4 + i * 1.7, { stride: 0.55, swing: 0 }), head: 0.75, lean: 0.08, arms: POSES.phone.arms, phone: true };
  return POSES[name] || POSES.stand;
};

// ---------- people ----------
// queue people while painting the rooms, draw them after the light map so they sit in the light as silhouettes
function crowd() {
  const Q = [];
  const add = (x, gy, fh, o) => Q.push({ x, gy, fh, ...o });
  add.draw = (c, t) => {
    let you = null;
    for (const p of Q) {
      const P = typeof p.pose === 'string' ? poseOf(p.pose, t, p.i || 0) : p.pose || POSES.stand;
      const o = { pose: P, facing: p.f ?? 1, body: p.red ? body(0) : body((p.i || 0) * 13 + 5, p.kind || 'adult'), color: p.red ? RED : '#22202A', farColor: p.red ? RED2 : '#3A3844', screen: '#DDEBFF' };
      lit(c, p.x, p.gy, p.fh, o, p.rim || null, p.side ?? (p.f || 1), 0.012);
      if (p.phones !== false && P.phone) glow(c, p.x + (p.f || 0) * p.fh * 0.14, p.gy - p.fh * (P.seat ? 0.55 : 0.68), p.fh * 0.14, '#CFE4FF', 0.35);
      if (p.headset) { c.strokeStyle = '#121016'; c.lineWidth = Math.max(1.5, p.fh * 0.02); const hy = p.gy - p.fh * (P.seat ? 0.8 : 0.97); c.beginPath(); c.arc(p.x + (p.f || 0) * p.fh * 0.05, hy, p.fh * 0.075, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
      if (p.red) you = [p.x + (p.f || 0) * p.fh * 0.08, p.gy - p.fh * (P.seat ? 0.8 : 0.97), p.fh];
    }
    if (you && RINGS.on) signal(c, you[0], you[1] - you[2] * 0.04, you[2] * 0.42, t, 1, SIG);
    return you;
  };
  return add;
}

// ---------- furniture and the things people do at home ----------
function screenSide(c, x, y, s, t, seed) { // a monitor seen side-on, its light on the wall
  const hue = (t * 50 + seed * 97) % 360;
  c.fillStyle = '#121016'; c.fillRect(x - s * 0.015, y - s * 0.22, s * 0.03, s * 0.22); c.fillRect(x - s * 0.06, y, s * 0.12, s * 0.012);
  return `hsl(${hue},55%,68%)`;
}
function home(c, kind, x, gy, fh, f, t, i, h, lights, people, red) {
  const rimOf = (col, a = 0.6) => alpha(col, a);
  if (kind === 'tv') {
    sofa(c, x, gy, fh, f, mix('#3C3A48', '#5A4A40', hash(i * 3.3)));
    const tx = x + f * fh * 0.66, col = tv(c, tx, gy - fh * 0.62, fh, t, i);
    lights.push({ x: tx, y: gy - fh * 0.62, r: h * 0.32, col, glow: 0.22 });
    people(x, gy, fh, { pose: hash(i * 7.1) < 0.5 ? 'slumpPhone' : 'slump', f, red, i, rim: rimOf(col), side: f });
  } else if (kind === 'desk' || kind === 'game') {
    const a = x + f * fh * 0.14, b = x + f * fh * 0.5; table(c, Math.min(a, b), Math.max(a, b), gy, fh, '#3A3440'); chair(c, x, gy, fh, f);
    let col = '#CFE0FF';
    if (kind === 'game') col = screenSide(c, x + f * fh * 0.4, gy - fh * 0.39, fh, t, i);
    else laptop(c, x + f * fh * 0.32, gy - fh * 0.38, fh, -f);
    lights.push({ x: x + f * fh * 0.38, y: gy - fh * 0.5, r: h * 0.2, col, glow: 0.25 });
    people(x, gy, fh, { pose: 'sitChair', f, red, i, rim: rimOf(col, 0.7), side: f, headset: kind === 'game' });
  } else if (kind === 'bed') {
    bed(c, x - fh * 0.3, x + fh * 0.45, gy, fh, mix('#3A3644', '#4A3A44', hash(i)));
    lights.push({ x: x + f * fh * 0.15, y: gy - fh * 0.55, r: h * 0.12, col: '#BFD8FF' });
    people(x, gy, fh, { pose: 'slumpPhone', f, red, i, rim: rimOf('#BFD8FF'), side: f });
  } else if (kind === 'kitchen') {
    c.fillStyle = '#3A3842'; c.fillRect(x - fh * 0.32, gy - fh * 0.42, fh * 0.64, fh * 0.42); c.fillStyle = '#C8C4BC'; c.fillRect(x - fh * 0.34, gy - fh * 0.44, fh * 0.68, fh * 0.03);
    lights.push({ x: x + f * fh * 0.15, y: gy - fh * 0.85, r: h * 0.12, col: '#BFD8FF' });
    people(x + f * fh * 0.42, gy, fh, { pose: 'phone', f: -f, red, i, rim: rimOf('#BFD8FF'), side: -f });
  } else if (kind === 'phone') {
    lights.push({ x: x + f * fh * 0.15, y: gy - fh * 0.85, r: h * 0.12, col: '#BFD8FF' });
    people(x, gy, fh, { pose: 'phone', f, red, i, rim: rimOf('#BFD8FF'), side: f });
  } else if (kind === 'window') {
    people(x, gy, fh, { pose: 'look', f, red, i, rim: rimOf('#D8E0F0', 0.5), side: f });
  }
}
const HOME = ['tv', 'tv', 'desk', 'game', 'bed', 'kitchen', 'phone'];

function wall(c, x0, x1, top, gy, col, h) {
  c.fillStyle = col; c.fillRect(x0, top, x1 - x0, gy - top);
  c.fillStyle = alpha('#000000', 0.07); for (let x = x0 + 6; x < x1; x += 9) c.fillRect(x, top, 1, gy - top);
  c.fillStyle = mix(col, '#FFFFFF', 0.25); c.fillRect(x0, gy - h * 0.025, x1 - x0, h * 0.025);
}
function partition(c, x, top, gy, w) { c.fillStyle = '#4A4650'; c.fillRect(x - w * 0.007, top, w * 0.014, gy - top); hatch(c, x - w * 0.007, top, w * 0.014, gy - top); }
function skyBand(c, x, y, w, h, T, t, seed) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, mix('#0C1024', '#7FA6D8', T.day)); g.addColorStop(1, mix('#3A2E4A', '#E4E2D8', T.day));
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
function skyline(c, x0, x1, base, hmax, T, t, seed, lit = 0.5) {
  let x = x0 - 10, k = 0;
  while (x < x1) {
    const bw = hmax * (0.25 + hash(seed + k * 3.1) * 0.45), bh = hmax * (0.35 + hash(seed + k * 5.7) * 0.65);
    c.fillStyle = mix('#14142A', '#8A90A0', T.day * 0.8); c.fillRect(x, base - bh, bw, bh);
    for (let yy = base - bh + 4; yy < base - 3; yy += 6) for (let xx = x + 3; xx < x + bw - 3; xx += 5) {
      const q = hash(xx * 1.3 + yy * 2.7 + seed);
      if (q < lit) { c.fillStyle = alpha(q < lit * 0.3 ? '#9EC4FF' : '#FFD08A', (1 - T.day * 0.85) * (0.6 + 0.4 * Math.sin(t * 0.5 + q * 40))); c.fillRect(xx, yy, 2, 3); }
    }
    x += bw + 3; k++;
  }
}

// ---------- the places ----------
const PLACES = {
  // a cut through a block of flats: a wall between every person
  flats(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * FH, ceil = h * R.range(0.29, 0.34), slab = h * 0.045, n = R.pick([3, 4, 4, 5, 5, 6]);
    const xs = [0]; for (let k = 1; k < n; k++) xs.push(k / n + R.range(-0.035, 0.035)); xs.push(1);
    const lights = [], people = crowd(), red = Math.floor(hash(seed * 91.3 + 7.1) * n);
    for (let i = 0; i < n; i++) {
      const x0 = xs[i] * w, x1 = xs[i + 1] * w, col = R.pick(WALLPAPER);
      wall(c, x0, x1, ceil, gy, col, h);
      if (x1 - x0 > w * 0.14 && R() < 0.75) { const ww = Math.min((x1 - x0) * 0.45, w * 0.13); cityWindow(c, x0 + (x1 - x0) * R.range(0.1, 0.5), ceil + h * 0.07, ww, h * 0.24, t, T.day, seed + i); }
      else if (R() < 0.6) frameOnWall(c, x0 + (x1 - x0) * 0.6, ceil + h * 0.12, h * 0.06, col);
      if (R() < 0.4) { lamp(c, (x0 + x1) / 2, ceil, fh); lights.push({ x: (x0 + x1) / 2, y: ceil + fh * 0.25, r: h * 0.3, col: '#FFD7A0', glow: 0.1, a: 0.6 }); }
      const kind = i === red ? R.pick(['tv', 'desk', 'game', 'bed', 'phone']) : R() < 0.15 ? 'empty' : R.pick(HOME), f = R() < 0.5 ? 1 : -1;
      home(c, kind, lerp(x0, x1, R.range(0.35, 0.65)), gy, fh * R.range(0.95, 1.03), f, t, i + seed, h, lights, people, i === red);
    }
    slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, ceil - slab, w, slab);
    for (let k = 1; k < n; k++) partition(c, xs[k] * w, ceil, gy, w);
    if (R() < 0.75) upstairs(c, w, h, t, ceil - slab, lights); else skyBand(c, 0, 0, w, ceil - slab, T, t, seed);
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // two floors of identical small rooms
  dorm(c, w, h, t, R, T, seed) {
    const n = R.pick([4, 5, 6]), floors = [h * 0.49, h * GY], fh = h * 0.27, tops = [h * 0.12, h * 0.55], lights = [], people = crowd();
    const redF = hash(seed * 13.7 + 2.2) < 0.5 ? 0 : 1, redI = Math.floor(hash(seed * 91.3 + 7.1) * n), col = R.pick(['#B8B0A0', '#A8B0A8', '#B0A8B4']);
    skyBand(c, 0, 0, w, tops[0], T, t, seed);
    floors.forEach((gy, fl) => {
      for (let i = 0; i < n; i++) {
        const x0 = i / n * w, x1 = (i + 1) / n * w, rw = x1 - x0, isRed = fl === redF && i === redI;
        wall(c, x0, x1, tops[fl], gy, mix(col, '#000', hash(i + fl * 9) * 0.15), h);
        c.fillStyle = mix(col, '#000', 0.35); c.fillRect(x0 + rw * 0.08, tops[fl] + h * 0.05, rw * 0.22, h * 0.1);
        const off = !isRed && R() < 0.2; if (off) continue;
        const kind = R.pick(['bed', 'bed', 'desk', 'game', 'desk']);
        home(c, kind, x0 + rw * R.range(0.4, 0.62), gy, fh, R() < 0.5 ? 1 : -1, t, seed + i * 3 + fl, h, lights, people, isRed);
      }
      slabCut(c, 0, gy, w, fl ? h - gy + 2 : h * 0.06);
      for (let i = 1; i < n; i++) partition(c, i / n * w, tops[fl], gy, w);
    });
    slabCut(c, 0, tops[0] - h * 0.04, w, h * 0.04);
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // an open-plan office: a row of desks, headphones on, nobody facing anybody
  office(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.36, top = h * 0.14, lights = [], people = crowd();
    c.fillStyle = '#C8CCC8'; c.fillRect(0, top, w, gy - top);
    for (let k = 0; k < 4; k++) { const x = w * (0.03 + k * 0.25); skyBand(c, x, top + h * 0.06, w * 0.22, h * 0.3, T, t, seed); skyline(c, x, x + w * 0.22, top + h * 0.36, h * 0.22, T, t, seed + k, 0.4); c.strokeStyle = '#E8E8E4'; c.lineWidth = 3; c.strokeRect(x, top + h * 0.06, w * 0.22, h * 0.3); }
    slabCut(c, 0, 0, w, top); slabCut(c, 0, gy, w, h - gy + 2);
    for (let k = 0; k < 6; k++) { const lx = w * (0.06 + k * 0.17); c.fillStyle = '#F4F6F2'; c.fillRect(lx, top, w * 0.08, 3); lights.push({ x: lx + w * 0.04, y: top + 8, r: h * 0.45, col: '#EEF4F0', glow: 0.05, a: T.day > 0.5 ? 0.9 : 0.6 }); }
    const n = R.pick([5, 6, 7]), redI = Math.floor(hash(seed * 91.3 + 7.1) * n), f = R() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const x = w * (0.08 + i * 0.86 / (n - 1)), isRed = i === redI;
      c.fillStyle = '#8A8E94'; c.fillRect(x - f * fh * 0.25 - fh * 0.02, gy - fh * 0.62, fh * 0.03, fh * 0.62);
      if (!isRed && T.day < 0.5 && R() < 0.45) { table(c, Math.min(x + f * fh * 0.14, x + f * fh * 0.5), Math.max(x + f * fh * 0.14, x + f * fh * 0.5), gy, fh, '#5A5A60'); continue; }
      home(c, 'desk', x, gy, fh, f, t, seed + i, h, lights, (xx, yy, ff, o) => people(xx, yy, ff, { ...o, headset: R() < 0.6 }), isRed);
    }
    lightmap(c, w, h, T.day > 0.5 ? 'rgba(10,12,26,0.12)' : T.dark, lights); return people.draw(c, t);
  },

  // a metro carriage: shoulder to shoulder, eyes down
  train(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.42, top = h * 0.12, lights = [], people = crowd();
    c.fillStyle = T.day > 0.5 ? '#C9CDD2' : '#6A7080'; c.fillRect(0, top, w, gy - top);
    const wy = h * 0.27, wh = h * 0.24;
    for (let k = 0; k < 4; k++) {
      const x = w * (0.04 + k * 0.25), ww = w * 0.2;
      c.save(); c.beginPath(); c.roundRect(x, wy, ww, wh, 10); c.clip();
      skyBand(c, x, wy, ww, wh, T, t, seed);
      for (let j = 0; j < 8; j++) { const sx = x + ((hash(j * 3.1 + seed) * 2 * ww - t * w * 0.9) % (ww * 2) + ww * 2) % (ww * 2) - ww * 0.5; c.fillStyle = T.day > 0.5 ? alpha('#5A6070', 0.5) : alpha(hash(j) < 0.5 ? '#FFD08A' : '#9EC4FF', 0.8); c.fillRect(sx, wy + wh * (0.3 + hash(j * 5) * 0.6), ww * (0.3 + hash(j * 7) * 0.6), T.day > 0.5 ? wh * 0.5 : 2); }
      c.restore(); c.strokeStyle = '#8A9098'; c.lineWidth = 4; c.beginPath(); c.roundRect(x, wy, ww, wh, 10); c.stroke();
    }
    c.fillStyle = '#9AA0A8'; c.fillRect(0, top + h * 0.03, w, 4);
    for (let k = 0; k < 9; k++) { const sx = w * (0.05 + k * 0.11); c.strokeStyle = '#9AA0A8'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, top + h * 0.03); c.lineTo(sx, top + h * 0.09); c.stroke(); c.beginPath(); c.arc(sx, top + h * 0.1, h * 0.01, 0, TAU); c.stroke(); }
    for (const px of [0.27, 0.73]) { c.fillStyle = '#B8BCC2'; c.fillRect(w * px - 2, top, 4, gy - top); }
    slabCut(c, 0, 0, w, top); c.fillStyle = '#3A3A44'; c.fillRect(0, gy, w, h - gy);
    for (let k = 0; k < 3; k++) lights.push({ x: w * (0.17 + k * 0.33), y: top + 10, r: h * 0.6, col: '#E8F2E8', glow: 0.06, a: 0.85 });
    const seats = [], nS = R.pick([7, 8, 9]);
    for (let i = 0; i < nS; i++) seats.push(w * (0.06 + i * 0.88 / (nS - 1)));
    c.fillStyle = mix('#3A5A8A', '#8A3A4A', hash(seed)); for (const sx of seats) { c.fillRect(sx - fh * 0.14, gy - fh * 0.26, fh * 0.3, fh * 0.06); c.fillRect(sx - fh * 0.16, gy - fh * 0.55, fh * 0.05, fh * 0.32); }
    const redI = Math.floor(hash(seed * 91.3 + 7.1) * nS), f = 1;
    seats.forEach((sx, i) => { if (i !== redI && R() < 0.25) return; people(sx, gy, fh, { pose: R() < 0.7 ? 'slumpPhone' : 'sitChair', f, red: i === redI, i: seed + i, rim: alpha('#E8F2E8', 0.4), side: 1, headset: R() < 0.3 }); });
    const nStand = R.pick([1, 2, 3, 4]);
    for (let k = 0; k < nStand; k++) people(w * R.range(0.1, 0.9), gy + h * 0.02, fh * 1.05, { pose: 'phone', f: R() < 0.5 ? 1 : -1, i: seed + 40 + k, rim: alpha('#E8F2E8', 0.4) });
    lightmap(c, w, h, T.day > 0.5 ? 'rgba(10,12,26,0.15)' : 'rgba(8,10,24,0.35)', lights); return people.draw(c, t);
  },

  // a street after dark: lit shop windows, people walking past, you at the bus stop
  street(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.36, lights = [], people = crowd();
    skyBand(c, 0, 0, w, h * 0.5, T, t, seed); skyline(c, 0, w, h * 0.42, h * 0.38, T, t, seed, 0.55);
    c.fillStyle = mix('#2A2632', '#6A6670', T.day); c.fillRect(0, h * 0.4, w, gy - h * 0.4);
    let x = 0, k = 0;
    while (x < w) { const sw = w * R.range(0.14, 0.22); if (R() < 0.75) { const lc = R.pick(['#FFE2A8', '#F4F4F0', '#CFE4FF', '#FFC8A0']); c.fillStyle = lc; c.fillRect(x + sw * 0.08, h * 0.52, sw * 0.84, gy - h * 0.56); lights.push({ x: x + sw / 2, y: h * 0.7, r: h * 0.32, col: lc, glow: 0.12, rect: { x: x + sw * 0.08, y: h * 0.52, w: sw * 0.84, h: gy - h * 0.56, a: 0.9 } }); c.fillStyle = '#1A1820'; c.fillRect(x + sw * 0.08, h * 0.47, sw * 0.84, h * 0.04); } x += sw; k++; }
    c.fillStyle = '#4A4852'; c.fillRect(0, gy, w, h - gy); c.fillStyle = '#6A6870'; c.fillRect(0, gy, w, 3);
    const lx = w * R.range(0.15, 0.4); c.fillStyle = '#16141C'; c.fillRect(lx - 2, h * 0.22, 4, gy - h * 0.22); c.fillRect(lx - 2, h * 0.22, w * 0.04, 4);
    lights.push({ x: lx + w * 0.035, y: h * 0.25, r: h * 0.55, col: '#FFD8A0', glow: 0.2 });
    const bx = w * R.range(0.55, 0.78); c.fillStyle = alpha('#C8DCE8', 0.25); c.fillRect(bx - fh * 0.1, gy - fh * 1.15, fh * 0.9, fh * 1.15); c.fillStyle = '#16141C'; c.fillRect(bx - fh * 0.12, gy - fh * 1.18, fh * 0.94, fh * 0.04);
    c.fillStyle = '#F4F4EE'; c.fillRect(bx + fh * 0.5, gy - fh * 1.0, fh * 0.28, fh * 0.6); lights.push({ x: bx + fh * 0.64, y: gy - fh * 0.7, r: h * 0.22, col: '#F4F4EE', glow: 0.2, rect: { x: bx + fh * 0.5, y: gy - fh * 1.0, w: fh * 0.28, h: fh * 0.6, a: 1 } });
    people(bx + fh * 0.2, gy, fh, { pose: 'phone', f: 1, red: true, i: 0, rim: alpha('#F4F4EE', 0.5) });
    const n = R.pick([3, 4, 5, 6]);
    for (let i = 0; i < n; i++) { const dir = R() < 0.5 ? 1 : -1, sp = w * R.range(0.03, 0.06), x0 = R() * w * 1.3, xx = ((x0 + dir * t * sp) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15; if (Math.abs(xx - bx - fh * 0.2) < fh * 0.3) continue; people(xx, gy + h * R.range(0, 0.03), fh * R.range(0.92, 1.05), { pose: R() < 0.7 ? 'walkPhone' : 'walk', f: dir, i: seed + i, rim: alpha('#FFD8A0', 0.35) }); }
    if (R() < 0.4) { c.strokeStyle = alpha('#C8D4E8', 0.35); c.lineWidth = 1; for (let i = 0; i < 90; i++) { const rx = (hash(i * 3.3) * w + t * 40) % w, ry = (hash(i * 5.1) * h + t * h * 1.6) % h; c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - 3, ry + 12); c.stroke(); } }
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // a cafe: a table each, a laptop each
  cafe(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.38, top = h * 0.1, lights = [], people = crowd();
    c.fillStyle = '#6A4E3E'; c.fillRect(0, top, w, gy - top);
    const wx = w * 0.05, ww = w * 0.9, wy = top + h * 0.06, wh = h * 0.42;
    skyBand(c, wx, wy, ww, wh, T, t, seed); skyline(c, wx, wx + ww, wy + wh, wh * 0.7, T, t, seed + 3, 0.45);
    for (let k = 0; k < 4; k++) { const sx = (hash(k * 3.1 + seed) * ww + t * ww * 0.06 * (k % 2 ? 1 : -1)) % ww; drawFigure(c, wx + Math.abs(sx), wy + wh, wh * 0.35, { pose: poseOf('walkPhone', t, k), facing: k % 2 ? 1 : -1, color: alpha('#2A2832', 0.7), body: body(k + 50) }); }
    c.strokeStyle = '#2A1E18'; c.lineWidth = 5; c.strokeRect(wx, wy, ww, wh); for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(wx + ww * k / 4, wy); c.lineTo(wx + ww * k / 4, wy + wh); c.stroke(); }
    slabCut(c, 0, 0, w, top); c.fillStyle = '#4A3428'; c.fillRect(0, gy, w, h - gy);
    const n = R.pick([3, 4, 5]), redI = Math.floor(hash(seed * 91.3 + 7.1) * n);
    for (let i = 0; i < n; i++) {
      const x = w * (0.12 + i * 0.78 / (n - 1)), f = R() < 0.5 ? 1 : -1, tx = x + f * fh * 0.36;
      c.fillStyle = '#2A1E18'; c.beginPath(); c.ellipse(tx, gy - fh * 0.4, fh * 0.17, fh * 0.025, 0, 0, TAU); c.fill(); c.fillRect(tx - 2, gy - fh * 0.4, 4, fh * 0.4);
      chair(c, x, gy, fh, f, '#2A1E18'); laptop(c, tx, gy - fh * 0.41, fh, -f);
      c.strokeStyle = '#2A1E18'; c.lineWidth = 1; c.beginPath(); c.moveTo(tx, top); c.lineTo(tx, top + h * 0.12); c.stroke(); c.fillStyle = '#E8C890'; c.beginPath(); c.arc(tx, top + h * 0.13, h * 0.012, 0, TAU); c.fill();
      lights.push({ x: tx, y: top + h * 0.2, r: h * 0.3, col: '#FFD8A0', glow: 0.12, a: 0.7 }, { x: tx, y: gy - fh * 0.5, r: h * 0.12, col: '#CFE0FF', glow: 0.2 });
      people(x, gy, fh, { pose: 'sitChair', f, red: i === redI, i: seed + i, rim: alpha('#FFD8A0', 0.5), side: f, headset: R() < 0.4 });
    }
    lightmap(c, w, h, T.day > 0.5 ? 'rgba(20,12,10,0.15)' : T.dark, lights); return people.draw(c, t);
  },

  // houses along a street, cut open: one or two people each, a garden between
  houses(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.24, lights = [], people = crowd();
    skyBand(c, 0, 0, w, gy, T, t, seed);
    c.fillStyle = mix('#1A2418', '#5A7048', T.day); c.fillRect(0, gy - h * 0.02, w, h);
    const n = R.pick([3, 4]), redI = Math.floor(hash(seed * 91.3 + 7.1) * n);
    for (let i = 0; i < n; i++) {
      const hw = w * R.range(0.17, 0.2), cx = w * (0.13 + i * 0.74 / (n - 1)), x0 = cx - hw / 2, top = gy - h * R.range(0.42, 0.5);
      c.fillStyle = R.pick(['#8A6A58', '#9A8A78', '#6A5A60', '#8A7A6A']); c.beginPath(); c.moveTo(x0 - hw * 0.08, top); c.lineTo(cx, top - h * 0.14); c.lineTo(x0 + hw * 1.08, top); c.fill();
      wall(c, x0, x0 + hw, top, gy, R.pick(WALLPAPER), h);
      c.strokeStyle = '#3A3036'; c.lineWidth = 4; c.strokeRect(x0, top, hw, gy - top);
      home(c, i === redI ? R.pick(['tv', 'desk', 'phone']) : R.pick(['tv', 'tv', 'desk', 'kitchen']), cx, gy, fh, R() < 0.5 ? 1 : -1, t, seed + i, h, lights, people, i === redI);
      if (i < n - 1) { c.fillStyle = '#3A3036'; for (let fx = x0 + hw + 6; fx < cx + w * 0.74 / (n - 1) - hw / 2 - 4; fx += 7) c.fillRect(fx, gy - h * 0.05, 3, h * 0.05); }
      if (R() < 0.5) { const carx = x0 + hw + w * 0.02; c.fillStyle = '#16141C'; c.beginPath(); c.roundRect(carx, gy - h * 0.06, w * 0.07, h * 0.04, 4); c.fill(); c.beginPath(); c.roundRect(carx + w * 0.012, gy - h * 0.09, w * 0.04, h * 0.035, 4); c.fill(); }
    }
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // alone in a room at night, the game on the wall
  game(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * FH, top = h * 0.14, lights = [], people = crowd(), col = R.pick(WALLPAPER);
    wall(c, 0, w, top, gy, mix(col, '#000', 0.2), h);
    cityWindow(c, w * R.range(0.04, 0.12), top + h * 0.08, w * 0.15, h * 0.3, t, T.day, seed);
    const sx = w * R.range(0.42, 0.55), sy = top + h * 0.1, sw = w * 0.3, sh = h * 0.32;
    c.fillStyle = '#121016'; c.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
    c.fillStyle = '#E8ECF0'; c.fillRect(sx, sy, sw, sh);
    const P = [[sx + sw * 0.2, sy + sh * 0.45], [sx + sw * 0.8, sy + sh * 0.45], [sx + sw * 0.5, sy + sh * 0.92]], s = sh * 0.32;
    P.forEach(([px, py], i) => drawFigure(c, px, py, s, { facing: i === 2 ? 0 : i ? -1 : 1, color: i === 2 ? RED : '#2A2A30', body: body(i + 3) }));
    const k = (t / 1.3) % 2, fw = k < 1, u = easeInOut(fw ? k : k - 1), [a, b] = fw ? [P[0], P[1]] : [P[1], P[0]];
    c.fillStyle = '#2A2A30'; c.beginPath(); c.arc(lerp(a[0], b[0], u), lerp(a[1], b[1], u) - s * 0.55 - Math.sin(u * Math.PI) * sh * 0.16, sh * 0.025, 0, TAU); c.fill();
    lights.push({ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.6, col: '#DDE8FF', glow: 0.18, rect: { x: sx, y: sy, w: sw, h: sh, a: 1 } });
    const dx = sx - fh * 0.35; table(c, dx + fh * 0.12, dx + fh * 0.5, gy, fh, '#2A2630'); chair(c, dx, gy, fh, 1);
    slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
    if (R() < 0.6) { const px = w * 0.86; partition(c, w * 0.78, top, gy, w); home(c, R.pick(['tv', 'phone', 'bed']), px, gy, fh, -1, t, seed + 7, h, lights, people, false); }
    people(dx, gy, fh, { pose: 'sitChair', f: 1, red: true, i: 0, rim: alpha('#DDE8FF', 0.7), side: 1, headset: R() < 0.6 });
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // a lift: close enough to touch, nobody speaks
  lift(c, w, h, t, R, T, seed) {
    const fh = h * 0.3, lights = [], people = crowd(), floors = [h * 0.3, h * 0.62, h * 0.94];
    c.fillStyle = '#8A8478'; c.fillRect(0, 0, w, h);
    floors.forEach((fy, k) => { slabCut(c, 0, fy, w, h * 0.04); lights.push({ x: w * 0.15, y: fy - h * 0.25, r: h * 0.25, col: '#EEF0E8', glow: 0.05, a: 0.6 }); });
    const cx = w * 0.5, cw = w * 0.26, shaftT = 0;
    c.fillStyle = '#2A2830'; c.fillRect(cx - cw / 2 - 8, 0, cw + 16, h);
    const cy = lerp(floors[2], floors[1], 0.5 + 0.5 * Math.sin(t * 0.35)), ctop = cy - fh * 1.22;
    c.fillStyle = '#C8C4BC'; c.fillRect(cx - cw / 2, ctop, cw, cy - ctop); c.fillStyle = '#9A968E'; c.fillRect(cx - cw / 2, cy, cw, h * 0.02);
    c.fillStyle = '#16141C'; c.fillRect(cx - cw * 0.12, ctop + fh * 0.06, cw * 0.24, fh * 0.08); c.fillStyle = '#FF7A3A'; c.font = `600 ${fh * 0.06}px "JetBrains Mono", monospace`; c.textAlign = 'center'; c.fillText(String(1 + Math.floor((t * 0.35) % 9)), cx, ctop + fh * 0.125); c.textAlign = 'left';
    lights.push({ x: cx, y: ctop + 6, r: h * 0.3, col: '#F4F0E4', glow: 0.1, rect: { x: cx - cw / 2, y: ctop, w: cw, h: cy - ctop, a: 0.85 } });
    const n = R.pick([3, 4, 5]), redI = Math.floor(hash(seed * 91.3 + 7.1) * n);
    for (let i = 0; i < n; i++) people(cx - cw * 0.38 + i * cw * 0.76 / (n - 1), cy, fh, { pose: R() < 0.6 ? 'phone' : 'stand', f: 0, red: i === redI, i: seed + i, rim: null });
    for (let k = 0; k < 2; k++) { const fy = floors[k], dir = R() < 0.5 ? 1 : -1, xx = ((R() * w * 0.35 + dir * t * w * 0.03) % (w * 0.35) + w * 0.35) % (w * 0.35) + (R() < 0.5 ? 0 : w * 0.63); people(xx, fy, fh * 0.95, { pose: 'walkPhone', f: dir, i: seed + 20 + k }); }
    lightmap(c, w, h, T.dark, lights); return people.draw(c, t);
  },

  // a waiting room: one seat apart
  waiting(c, w, h, t, R, T, seed) {
    const gy = h * GY, fh = h * 0.4, top = h * 0.1, lights = [], people = crowd();
    c.fillStyle = R.pick(['#A8B4A8', '#B4B0A4', '#A4ACB4']); c.fillRect(0, top, w, gy - top);
    slabCut(c, 0, 0, w, top); c.fillStyle = '#8A8E88'; c.fillRect(0, gy, w, h - gy);
    for (let k = 0; k < 4; k++) { const lx = w * (0.08 + k * 0.25); c.fillStyle = '#F4F6F2'; c.fillRect(lx, top, w * 0.1, 3); lights.push({ x: lx + w * 0.05, y: top + 8, r: h * 0.5, col: '#F0F4F0', glow: 0.05, a: 0.85 }); }
    const tx = w * R.range(0.55, 0.8), ty = top + h * 0.08; c.fillStyle = '#121016'; c.fillRect(tx, ty, w * 0.14, h * 0.13); const tc = `hsl(${(t * 40) % 360},50%,60%)`; c.fillStyle = tc; c.fillRect(tx + 3, ty + 3, w * 0.14 - 6, h * 0.13 - 6);
    c.fillStyle = '#16141C'; c.fillRect(w * 0.1, ty, w * 0.08, h * 0.06); c.fillStyle = '#FF5A3A'; c.font = `600 ${h * 0.04}px "JetBrains Mono", monospace`; c.fillText('A' + (40 + Math.floor(t / 4) % 50), w * 0.107, ty + h * 0.047);
    const n = R.pick([7, 8, 9, 10]), redI = Math.floor(hash(seed * 91.3 + 7.1) * n);
    const xs = []; for (let i = 0; i < n; i++) xs.push(w * (0.06 + i * 0.88 / (n - 1)));
    c.fillStyle = '#3A4A6A'; xs.forEach((x) => { c.fillRect(x - fh * 0.12, gy - fh * 0.26, fh * 0.26, fh * 0.05); c.fillRect(x - fh * 0.14, gy - fh * 0.5, fh * 0.04, fh * 0.26); }); c.fillRect(xs[0] - fh * 0.12, gy - fh * 0.22, xs[n - 1] - xs[0] + fh * 0.26, fh * 0.03);
    xs.forEach((x, i) => { if (i !== redI && (R() < 0.45 || i % 2 === 1 && R() < 0.5)) return; people(x, gy, fh, { pose: R() < 0.7 ? 'slumpPhone' : 'sitChair', f: 1, red: i === redI, i: seed + i, rim: alpha('#F0F4F0', 0.3) }); });
    lightmap(c, w, h, 'rgba(10,12,26,0.12)', lights); return people.draw(c, t);
  },
};
// how often each place comes up, and which times of day it can have
const MENU = [
  ['flats', 3, ['day', 'evening', 'night', 'night']], ['game', 2, ['night', 'evening']], ['dorm', 1.2, ['evening', 'night']],
  ['office', 1.2, ['day', 'evening']], ['train', 1.2, ['day', 'night']], ['street', 1.2, ['evening', 'night']],
  ['cafe', 1, ['day', 'evening']], ['houses', 1, ['evening', 'night']], ['lift', 0.8, ['day', 'night']], ['waiting', 0.8, ['day']],
];
export function modernPlace(seed) {
  const R = rng(seed * 3.7 + 11), tot = MENU.reduce((a, m) => a + m[1], 0);
  let r = R() * tot, m = MENU[0];
  for (const q of MENU) { if (r < q[1]) { m = q; break; } r -= q[1]; }
  return { place: m[0], time: R.pick(m[2]), R };
}
function paint(c, w, h, seed, t) {
  const { place, time, R } = modernPlace(seed);
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  c.fillStyle = '#1A1820'; c.fillRect(0, 0, w, h);
  const you = PLACES[place](c, w, h, t, R, TIME[time], seed);
  c.restore();
  return you;
}

// mr: { from: the previous seed, k: 0..1 } wipes from that scene to this one.
// Returns where you are in it, as fractions of the frame, so a crop can keep you in view.
export function drawModernScene(c, w, h, seed, t, mr = null) {
  let you = null;
  c.save(); c.beginPath(); c.rect(0, 0, w, h); c.clip();
  if (mr && mr.k < 1 && mr.from !== seed) {
    const dpr = c.getTransform().a, A = buf('mdA', w, h, dpr), B = buf('mdB', w, h, dpr);
    for (const X of [A, B]) { X.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); X.ctx.clearRect(0, 0, w, h); }
    paint(A.ctx, w, h, mr.from, t); you = paint(B.ctx, w, h, seed, t);
    const x = lerp(w, 0, mr.k);
    c.drawImage(A.c, 0, 0, w, h);
    c.save(); c.beginPath(); c.rect(x, 0, w - x, h); c.clip(); c.drawImage(B.c, 0, 0, w, h); c.restore();
    glow(c, x, h * 0.5, h * 0.6, '#E0F4FF', 0.15); c.fillStyle = 'rgba(236,246,255,0.7)'; c.fillRect(x - 1, 0, 2, h);
  } else you = paint(c, w, h, seed, t);
  grain(c, w, h, t, 0.08); vignette(c, w, h, 0.45);
  c.restore();
  return you ? { x: you[0] / w, y: you[1] / h } : { x: 0.5, y: 0.6 };
}

// building blocks for topics.js
export { PLACES, TIME, crowd, home, wall, partition, skyBand, skyline, poseOf };
