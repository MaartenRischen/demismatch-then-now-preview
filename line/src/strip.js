// The topics site as one strip, the same on a phone and on a desktop (centred there). Top to bottom: how life was
// arranged for 300,000 years and a picture from one generation, the line of generations, your picture and why it's
// normal. The line is drawn straight onto the page with no backdrop of its own: a procession of your ancestors walking
// towards you, as wide as the pictures. Each picture opens out of its person on the line like an inset on a map.
import { clamp, smooth, easeInOut, hash, mix, glow } from '../../v4/src/art.js';
import { drawFigure, POSES, walkPose, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';
import { sceneCover, coverWith } from './variants/kit.js';
import { MOMENTS } from './moments.js';
import { registerTopics } from './topics.js';
import { setFeeling } from './frame.js';
import { TOPICS, SCALE_SRC } from './personal-copy.js';

registerTopics([...new Set(TOPICS.map((t) => t.eea))].filter((k) => !['lonely', 'missed', 'stress', 'light', 'compare', 'baby', 'old', 'food'].includes(k)).map((k) => ({ key: k, signal: true })));
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const N = 11100;

// ---------- timing (as on the site: one picked generation held, then a quick run through others) ----------
const SEG = (() => { const s = []; let tt = 0, d = 0.95; const add = (dd) => { s.push({ t0: tt, t1: tt + dd, d: dd }); tt += dd; };
  add(6.5); for (let k = 0; k < 10; k++) { add(d); d = Math.max(0.2, d * 0.8); } return { s, T: tt + 3 }; })();
const DUR = SEG.T, TOTAL = DUR * TOPICS.length;
const gFor = (ti, i) => { const top = Math.min(11000, TOPICS[ti].span / 27 - 120); return Math.round(150 + hash(ti * 97.1 + i * 13.7 + 1) * (top - 150)); };
function stateAt(T) {
  const tt = ((T % TOTAL) + TOTAL) % TOTAL, ti = Math.floor(tt / DUR), lt = tt - ti * DUR, n = SEG.s.length;
  let i = SEG.s.findIndex((q) => lt < q.t1); const rest = i < 0; if (rest) i = n - 1;
  const q = SEG.s[i], g = gFor(ti, i), prev = i > 0 ? gFor(ti, i - 1) : null, st = lt - q.t0;
  const amt = rest ? 0 : easeInOut(smooth(st, 0, Math.min(0.6, q.d * 0.35))) * easeInOut(smooth(q.t1 - lt, 0, Math.min(0.4, q.d * 0.25)));
  const k = rest ? 1 : smooth(st, 0, Math.min(0.3, q.d * 0.5));
  return { ti, topic: TOPICS[ti], lt, g, amt, mr: prev !== null && k < 1 ? { from: prev, k } : null, fade: smooth(lt, 0, 0.45) * (1 - smooth(lt, DUR - 0.45, DUR)) };
}

// ---------- colours and type ----------
const BG = '#1D1A17', LIGHT = '#F1EEE8', DIM = 'rgba(241,238,232,0.6)', RED = '#E0201A', NOW = '#FF5A4E', GOLD = '#E2A93A';
const NARROW = '"PT Sans Narrow", "Arial Narrow", sans-serif';
const CAPTION = ['11,100 generations', ' of your ancestors'];

// ---------- layout ----------
// One column, as wide as a phone (a bit wider on a tall desktop window), centred. Everything down to the end of the
// second sentence fits one screen; the sources may sit just below it.
const NAV = 46;
let W = 0, H = 0, PH = 0, dpr = 1, LAY = null; const S = {};
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  const SW = Math.min(W, Math.round(clamp(H * 0.54, 380, 540))), m = 16, cw = SW - 2 * m, xL = Math.round((W - SW) / 2) + m, xR = xL + cw;
  const fs = clamp(Math.min(cw / 15, H / 30), 19, 28), [hA, hB, hS] = heights(fs, cw);
  // the line: figure height, where you stand, the ring sizes
  const fh = clamp(cw * 0.056, 18, 26), hp = fh * 1.15, r = hp * 0.8, lift = fh * 1.3;
  const x0 = xL + fh * 0.3, x1 = xR - fh * 0.5;
  const above = lift + hp * 0.55 + r;                 // from the ground up to the top of the picked person's ring
  const ycy = -hp * 0.55;                             // your ring's centre, relative to the ground
  // your funnel runs from your ring down to the corners of your picture. Make it tall enough that its left edge
  // clears the caption under the line.
  ctx.font = `700 12.5px ${NARROW}`; const capW = ctx.measureText(CAPTION[0]).width + (ctx.font = `400 12.5px ${NARROW}`, ctx.measureText(CAPTION[1]).width);
  const capY = 15, depth = capY + 8 - ycy, span = x1 - r - xL, G = Math.max(70, depth / Math.max(0.2, 1 - (capW + 12) / span));
  const top = 22, gapA = 22, block = gapA + above + (G + ycy);
  const fit = top + hA + 12 + block + 12 + hB + 12 + NAV;
  // with room to spare (a desktop) the sources fit on the screen too
  const roomy = (H - fit - hS - 10) / 2, ph = Math.round(roomy >= cw * 0.42 ? Math.min(roomy, cw * 0.6) : clamp((H - fit) / 2, 115, cw * 0.6));
  let y = top + hA + 12; const a = [xL, y, cw, ph]; y += ph + gapA + above;
  const yR = Math.round(y); y = yR + ycy + G; const b = [xL, Math.round(y), cw, ph]; y = b[1] + ph + 12;
  LAY = { a, b, xL, xR, cw, fh, hp, r, lift, x0, x1, yR, capY, now: y, src: y + hB + 10 };
  PH = Math.max(H, Math.ceil(LAY.src + hS + 12 + NAV));
  document.body.style.height = PH + 'px'; $('page').style.height = PH + 'px';
  cv.width = Math.round(W * dpr); cv.height = Math.round(PH * dpr); cv.style.width = W + 'px'; cv.style.height = PH + 'px';
  const st = `left:${xL}px;width:${cw}px;font-size:${fs}px;`;
  $('then').style.cssText = st + `bottom:${PH - a[1] + 12}px`;
  $('now').style.cssText = st + `top:${LAY.now}px`;
  $('foot').style.cssText = `left:${xL}px;width:${cw}px;top:${LAY.src}px`;
  shown = -1;
}
// the tallest each block of words gets at this size and width, across all topics: [then, now, sources]
function heights(fs, width) {
  const a = $('then'), b = $('now'), f = $('foot'), keep = [a.textContent, $('main').textContent, $('fact').textContent, $('src').textContent];
  a.style.cssText = b.style.cssText = `left:0;top:0;width:${width}px;font-size:${fs}px;visibility:hidden`;
  f.style.cssText = `left:0;top:0;width:${width}px;visibility:hidden`;
  const out = [0, 0, 0];
  for (const tp of TOPICS) {
    a.textContent = tp.then; $('main').textContent = tp.now; $('fact').textContent = tp.fact; $('src').textContent = srcText(tp);
    out[0] = Math.max(out[0], a.offsetHeight); out[1] = Math.max(out[1], b.offsetHeight); out[2] = Math.max(out[2], f.offsetHeight);
  }
  [a.textContent, $('main').textContent, $('fact').textContent, $('src').textContent] = keep;
  return out;
}
const srcText = (tp) => 'Sources: ' + tp.src + '. Time scale: ' + SCALE_SRC + '.';

// ---------- who feels it, in the ancestors' pictures ----------
const pick = (people, n, test) => people.map((q, i) => [q, i]).filter(([q]) => test(q)).sort((x, y) => x[0].d - y[0].d).slice(0, n).map(([, i]) => i);
const or0 = (ids) => (ids.length ? ids : [0]);
const farFromFire = (people, K) => { if (K.fire === undefined) return [0]; let best = 0; people.forEach((q, i) => { if (q.p !== 'lie' && Math.abs(q.x - K.fire) > Math.abs(people[best].x - K.fire)) best = i; }); return [best]; };
const FEELS = {
  strangers: (b, P) => or0(pick(P, 2, (q) => q.kind !== 'child' && (q.p === 'look' || q.p === 'stand') && q.d < 0.65)),
  leftout: (b, P, K) => farFromFire(P, K), night: () => [0], newparent: (b, P) => or0(pick(P, 1, (q) => q.baby)),
  news: (b, P) => or0(pick(P, 2, (q) => q.p === 'look' || q.p === 'throw')), compare: () => [0],
  touch: (b, P) => or0(pick(P, 1, (q) => q.p === 'hug' || q.p === 'holdHand' || q.baby)), speaking: () => [0],
  useful: (b, P) => or0(pick(P, 1, (q) => q.old)), burnout: (b, P) => or0(pick(P, 1, (q) => q.p === 'carry' || q.p === 'crouch' || q.p === 'reach')),
  crowd: (b, P, K) => farFromFire(P, K),
};

// ---------- drawing ----------
function stroke(c, pts, col, w, a) { c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore(); }
function ring(c, x, y, r, col, a) { c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.restore(); }
// a map-inset funnel: from the two sides of a ring to two corners of a picture
function funnel(c, x, y, r, xa, ya, xb, yb, col, fill, a) {
  if (a < 0.02) return;
  c.save(); c.globalAlpha = a; c.fillStyle = fill;
  c.beginPath(); c.moveTo(x - r, y); c.lineTo(xa, ya); c.lineTo(xb, yb); c.lineTo(x + r, y); c.closePath(); c.fill(); c.restore();
  stroke(c, [[x - r, y], [xa, ya]], col, 1.25, a); stroke(c, [[x + r, y], [xb, yb]], col, 1.25, a);
}
function text(c, s, x, y, { col = DIM, bold = false, size = 12.5, align = 'left', a = 1 } = {}) {
  c.save(); c.globalAlpha = a; c.font = `${bold ? 700 : 400} ${size}px ${NARROW}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y);
  const w = c.measureText(s).width; c.restore(); return w;
}
const fmtYears = (g) => { const y = g * 27, r = y >= 10000 ? Math.round(y / 1000) * 1000 : Math.round(y / 100) * 100; return r.toLocaleString('en-US') + ' years ago'; };
const xOf = (g) => LAY.x1 - (g / N) * (LAY.x1 - LAY.x0);
const pcy0 = (L) => L.yR - L.lift - L.hp * 0.55; // the picked person's ring centre, fully lifted

function frame(T) {
  const P = stateAt(T), tp = P.topic, c = ctx, L = LAY, [a, b] = [L.a, L.b], { yR, fh, hp, r } = L;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = BG; c.fillRect(0, 0, W, PH);
  const xa = xOf(P.g), xy = L.x1, alA = (0.55 + 0.45 * P.amt) * P.fade;
  const pb = yR - L.lift * P.amt, pcy = pb - hp * 0.55, ycy = yR - hp * 0.55;
  // the two funnels first, under everything else
  funnel(c, xy, ycy, r, b[0], b[1], b[0] + b[2], b[1], RED, 'rgba(224,32,26,0.08)', P.fade);
  funnel(c, xa, pcy, r, a[0], a[1] + a[3], a[0] + a[2], a[1] + a[3], LIGHT, 'rgba(241,238,232,0.06)', alA);
  // the ground, then the procession, oldest on the left, everyone walking towards you
  stroke(c, [[L.xL, yR + 0.5], [L.xR, yR + 0.5]], LIGHT, 1, 0.3);
  const pitch = (L.x1 - L.x0) / N, m = Math.pow(2, Math.ceil(Math.log2(3.6 / pitch))), gap = fh * 0.55 * P.amt;
  for (let g = Math.floor((N - 1) / m) * m; g >= m; g -= m) {
    const x = xOf(g); if (Math.abs(x - xa) < gap || xy - x < fh * 0.55) continue;
    drawFigure(c, x, yR, fh * (0.86 + hash(g * 1.7) * 0.22), { pose: walkPose(hash(g * 3.1) * 6.28, { stride: 0.32, swing: 0.3 }), body: body(g), color: mix('#CFC5B4', '#80776A', hash(g * 2.3)) });
  }
  // the picked person, lifted out of the line where they walked
  if (P.amt > 0.01) { c.save(); c.globalAlpha = 0.5 * P.amt; c.fillStyle = '#000'; c.beginPath(); c.ellipse(xa, yR + 1, fh * 0.28, fh * 0.06, 0, 0, Math.PI * 2); c.fill(); c.restore(); glow(c, xa, pcy, hp, '#FFF1D6', 0.3 * P.amt * P.fade); }
  c.save(); c.globalAlpha = Math.max(0.5, P.fade); drawFigure(c, xa, pb, hp, { pose: POSES.stand, facing: 0, body: body(P.g), color: LIGHT }); c.restore();
  // you, at the end
  glow(c, xy, ycy, hp, '#FF7A5E', 0.28);
  drawFigure(c, xy, yR, hp, { pose: POSES[tp.youPose] || POSES.stand, body: body(0), color: RED, farColor: '#A0140F', screen: '#CFE4FF' });
  if (tp.signal) signal(c, xy, yR - hp * 0.97, hp * 0.4, T, 1, GOLD);
  ring(c, xa, pcy, r, LIGHT, alA); ring(c, xy, ycy, r, RED, P.fade);
  // the picked person's age, beside them, on the side with room
  const age = fmtYears(P.g); c.font = `700 13px ${NARROW}`; const aw = c.measureText(age).width;
  const right = xa + r + 8 + aw < xy - r - 8, ax = right ? xa + r + 7 : xa - r - 7;
  text(c, age, ax, pcy0(L) + 8, { col: LIGHT, bold: true, size: 13, align: right ? 'left' : 'right', a: alA * P.amt });
  // what the line is, under it; where it starts, over its first figures (unless the picked person is there); now, under you
  const w0 = text(c, CAPTION[0], L.xL, yR + L.capY, { col: LIGHT, bold: true });
  text(c, CAPTION[1], L.xL + w0, yR + L.capY);
  text(c, 'Now', xy, yR + L.capY, { col: NOW, bold: true, align: 'center' });
  c.font = `400 12.5px ${NARROW}`; const sw = c.measureText('300,000 years ago').width, lab = right ? [xa - r, ax + aw] : [ax - aw, xa + r];
  const clear = lab[0] - (L.xL + sw) > 10 ? 1 : 0;
  const yl = pcy0(L) + 8; // the same height as the picked person's age
  stroke(c, [[L.xL, yl - 6], [L.xL, yR + 4]], LIGHT, 1, 0.45);
  text(c, '300,000 years ago', L.xL + 5, yl, { a: clear ? 1 : 0 });
  pictures(c, P, T);
  ui(P);
}
// the two pictures: square corners, a keyline in the colour of their funnel
function pictures(c, P, T) {
  const tp = P.topic, [a, b] = [LAY.a, LAY.b];
  c.save(); c.globalAlpha = P.fade;
  setFeeling(tp.signal ? FEELS[tp.key] || null : null);
  c.save(); c.beginPath(); c.rect(...a); c.clip(); sceneCover(S, 'e', c, ...a, P.g, T, { beat: tp.eea, mr: P.mr }); c.restore();
  setFeeling(null);
  c.save(); c.beginPath(); c.rect(...b); c.clip(); coverWith(S, 'm', c, ...b, (c2, w2, h2) => MOMENTS[tp.key](c2, w2, h2, T)); c.restore();
  c.lineWidth = 2; c.strokeStyle = LIGHT; c.strokeRect(a[0] - 1, a[1] - 1, a[2] + 2, a[3] + 2);
  c.strokeStyle = RED; c.strokeRect(b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2);
  c.restore();
}

// ---------- words and the topic bar ----------
const nav = $('nav');
TOPICS.forEach((tp, i) => { const bt = document.createElement('button'); bt.textContent = tp.title; bt.onclick = () => jump(i); nav.appendChild(bt); });
let shown = -1;
function ui(P) {
  const words = $('words');
  if (P.ti !== shown) {
    shown = P.ti; const tp = P.topic;
    $('then').textContent = tp.then; $('main').textContent = tp.now; $('fact').textContent = tp.fact;
    $('src').textContent = srcText(tp); $('key').classList.toggle('off', !tp.signal);
    [...nav.children].forEach((bt, i) => bt.classList.toggle('on', i === P.ti));
    const on = nav.children[P.ti]; nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
    history.replaceState(null, '', location.search + '#' + tp.key);
  }
  const vis = P.lt > 0.15 && P.lt < DUR - 0.5;
  words.classList.toggle('out', !vis);
  nav.children[P.ti].style.setProperty('--p', (P.lt / DUR).toFixed(3));
}

// ---------- time ----------
const q = new URLSearchParams(location.search), freeze = q.has('t') ? +q.get('t') : null;
let offset = 0, t0 = performance.now(), paused = false, pausedAt = 0;
const now = () => (paused ? pausedAt : (performance.now() - t0) / 1000) + offset;
function jump(i) { offset = i * DUR; t0 = performance.now(); pausedAt = 0; shown = -1; if (freeze !== null) frame(freeze + offset); }
const start = TOPICS.findIndex((tp) => '#' + tp.key === location.hash);
if (start > 0) offset = start * DUR;
addEventListener('keydown', (e) => {
  const cur = stateAt(now()).ti;
  if (e.key === 'ArrowRight') jump((cur + 1) % TOPICS.length);
  if (e.key === 'ArrowLeft') jump((cur + TOPICS.length - 1) % TOPICS.length);
  if (e.key === ' ') { e.preventDefault(); if (paused) { t0 = performance.now() - pausedAt * 1000; paused = false; } else { pausedAt = (performance.now() - t0) / 1000; paused = true; } }
});
addEventListener('resize', () => { resize(); if (freeze !== null) frame(freeze + offset); });
function loop() { frame(now()); requestAnimationFrame(loop); }
// wait for the faces the canvas uses, but never more than 2.5 s: a font that fails to load must not stop the page
const fontsIn = Promise.allSettled(['400 14px "PT Sans Narrow"', '700 14px "PT Sans Narrow"', '400 14px "Charis SIL"'].map((f) => document.fonts.load(f)));
Promise.race([fontsIn, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  resize();
  if (freeze !== null) { frame(freeze + offset); window.ready = true; } else { requestAnimationFrame(loop); window.ready = true; }
});
window.__topics = TOPICS.map((t) => t.key); window.__dur = DUR;
