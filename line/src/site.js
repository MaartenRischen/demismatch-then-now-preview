// The topics site, playing one topic after another. Left: how life was arranged for 300,000 years, in a picture from one
// generation picked off the line, then a run of others. Right: you, close up, in a moment you'd recognise, and why it's
// normal. Each picture is tied to its person on the line below.
import { clamp, lerp, smooth, easeInOut, alpha, hash } from '../../v4/src/art.js';
import { sceneCover, coverWith, C } from './variants/kit.js';
import { MOMENTS } from './moments.js';
import { createScene } from './scene.js';
import { registerTopics } from './topics.js';
import { setFeeling } from './frame.js';
import { TOPICS, SCALE_SRC } from './personal-copy.js';

// the ancestors' scenes the topics use that live in topics.js (the prototype's eight beats are built into frame.js)
registerTopics([...new Set(TOPICS.map((t) => t.eea))].filter((k) => !['lonely', 'missed', 'stress', 'light', 'compare', 'baby', 'old', 'food'].includes(k)).map((k) => ({ key: k, signal: true })));
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const CAM = { g: 0, a: 0.94, s: 11100 / 0.9 };

// ---------- timing ----------
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

// ---------- layout ----------
// Top to bottom: the two sentences, the two pictures, the line. Left column: what held for 300,000 years and a picture
// from one generation, tied to that person on the line. Right column: what holds now and your world, tied to you.
// A time scale runs under the line.
const SOIL = { top: ['#9C8A5E', '#463B2E'], farm: ['#857650', '#3B3127'], ind: ['#5E5856', '#2A2624'], deep: '#1D1A17', fade: '29,26,23', grass: '#463B2E' };
const NARROW = '"PT Sans Narrow", "Arial Narrow", sans-serif';
let W = 0, H = 0, dpr = 1, px = 1, LINE = null, LAY = null; const S = {};
const mobile = false; // phones get the desktop layout, scaled down (below)
// A small screen shows the desktop layout as a landscape stage of STAGE_W x STAGE_H, scaled to fit and centred.
const STAGE_W = 1280, STAGE_H = 800;
// A phone held upright gets its own layout instead: the line runs down the left edge, the two pictures stack on the right.
let TALL = null;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  const small = innerWidth < 700 || innerHeight < 560, stage = $('stage');
  TALL = null;
  if (small && innerHeight > innerWidth * 1.2) return resizeTall();
  $('foot').style.cssText = ''; $('fact').style.fontSize = ''; document.body.classList.remove('tall');
  if (small) {
    // fit it above the topic bar, which stays full size so it can be tapped
    W = STAGE_W; H = STAGE_H; const room = innerHeight - 44, k = Math.min(innerWidth / W, room / H);
    stage.style.cssText = `width:${W}px;height:${H}px;transform:translate(${(innerWidth - W * k) / 2}px,${(room - H * k) / 2}px) scale(${k})`;
    px = dpr * k;
  } else { W = innerWidth; H = innerHeight; stage.style.cssText = ''; px = dpr; }
  cv.width = Math.round(W * px); cv.height = Math.round(H * px); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const yG = H - 148, ground = yG / H;
  LINE = createScene({ ground, soil: SOIL }); LINE.resize(W, H, Math.max(1, Math.min(1.25, px)));
  const lift = LINE.figH() * 2.3 + 28;
  const m = Math.max(24, W * 0.04), gut = m * 1.5, col = (W - 2 * m - gut) / 2;
  const fs = clamp(col / 14, 22, 52), hs = heights(fs, col), words = Math.max(...hs.flat());
  const bottom = yG - lift, top = Math.max(22, H * 0.04) + words + 18;
  const fw = Math.min(col, Math.max(80, bottom - top) / 0.56), fh = fw * 0.56;
  LAY = { a: [m, bottom - fh, fw, fh], b: [m + col + gut, bottom - fh, fw, fh] };
  const st = `width:${col}px;bottom:${H - (bottom - fh) + 18}px;font-size:${fs}px`;
  $('then').style.cssText = `left:${LAY.a[0]}px;` + st; $('now').style.cssText = `left:${LAY.b[0]}px;` + st;
}
// Upright phone. The line is drawn as usual into a strip LEN long and TH thick, rotated a quarter turn so the oldest
// generation is at the top, now at the bottom, and heads point right, toward the pictures. Strip point (x, y) lands at
// screen (TH - y, TOP + x). TOP keeps clear of the viewer's own header, which floats over the page in the Claude app.
function resizeTall() {
  W = innerWidth; H = innerHeight; px = dpr; $('stage').style.cssText = '';
  cv.width = Math.round(W * px); cv.height = Math.round(H * px); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const TOP = 96, BOT = H - 52, TH = clamp(W * 0.24, 84, 112), LEN = BOT - TOP;
  LINE = createScene({ ground: 0.56, soil: SOIL }); LINE.resize(LEN, TH, 1.5);
  const x0 = TH + 12, cw = W - x0 - 12, fs = clamp(W / 21, 15, 19), hs = heights(fs, cw);
  const hA = Math.max(...hs.map((q) => q[0])), hB = Math.max(...hs.map((q) => q[1]));
  const fh = Math.min(cw * 0.7, (LEN - 70 - hA - hB - 8 - 22 - 8) / 2), fw = Math.min(cw, fh / 0.7);
  const aTop = TOP + 6 + hA + 8, bTop = aTop + fh + 22 + hB + 8;
  LAY = { a: [x0, aTop, fw, fh], b: [x0, bTop, fw, fh] };
  TALL = { TOP, TH, LEN, to: (x, y) => [TH - y, TOP + x] };
  const st = `width:${cw}px;font-size:${fs}px;left:${x0}px;`;
  $('then').style.cssText = st + `bottom:${H - aTop + 8}px`; $('now').style.cssText = st + `bottom:${H - bTop + 8}px`;
  $('foot').style.cssText = `left:${x0}px;right:12px;bottom:${H - BOT + 4}px;font-size:11px;flex-direction:column;align-items:flex-start;color:rgba(29,26,23,.75)`;
  $('fact').style.fontSize = '0.82em'; document.body.classList.add('tall');
}
// how tall each topic's two blocks of words are at this size and width: [[then, now], ...]
function heights(fs, width) {
  const a = $('then'), b = $('now'), keep = [a.textContent, $('main').textContent, $('fact').textContent];
  a.style.cssText = b.style.cssText = `left:0;top:0;width:${width}px;font-size:${fs}px;visibility:hidden`;
  const out = TOPICS.map((tp) => { a.textContent = tp.then; $('main').textContent = tp.now; $('fact').textContent = tp.fact || ''; return [a.offsetHeight, b.offsetHeight]; });
  [a.textContent, $('main').textContent, $('fact').textContent] = keep;
  return out;
}

// ---------- who feels it, in the ancestors' pictures ----------
// For each topic with the alarm on, the person in the ancestors' shot who feels the same thing gets the gold rings too.
const pick = (people, n, test) => people.map((q, i) => [q, i]).filter(([q]) => test(q)).sort((x, y) => x[0].d - y[0].d).slice(0, n).map(([, i]) => i);
const or0 = (ids) => (ids.length ? ids : [0]);
const farFromFire = (people, K) => { if (K.fire === undefined) return [0]; let best = 0; people.forEach((q, i) => { if (q.p !== 'lie' && Math.abs(q.x - K.fire) > Math.abs(people[best].x - K.fire)) best = i; }); return [best]; };
const FEELS = {
  strangers: (b, P) => or0(pick(P, 2, (q) => q.kind !== 'child' && (q.p === 'look' || q.p === 'stand') && q.d < 0.65)), // the ones watching them come
  leftout: (b, P, K) => farFromFire(P, K),                         // the one furthest from the fire
  night: () => [0],                                                // out in the dark on their own
  newparent: (b, P) => or0(pick(P, 1, (q) => q.baby)),             // whoever is holding the baby
  news: (b, P) => or0(pick(P, 2, (q) => q.p === 'look' || q.p === 'throw')), // the ones facing the lion
  compare: () => [0],                                              // the one showing what they can do
  touch: (b, P) => or0(pick(P, 1, (q) => q.p === 'hug' || q.p === 'holdHand' || q.baby)),
  speaking: () => [0],                                             // the one walking in with the food, everyone turning
  useful: (b, P) => or0(pick(P, 1, (q) => q.old)),                 // the grandparent
  burnout: (b, P) => or0(pick(P, 1, (q) => q.p === 'carry' || q.p === 'crouch' || q.p === 'reach')),
  crowd: (b, P, K) => farFromFire(P, K),
};

// ---------- drawing ----------
const LIGHT = '#F1EEE8', DIM = 'rgba(241,238,232,0.55)';
// a line from a picture to its person, and a ring round that person: a light core on a dark casing, so it reads on
// the pale sky and on the dark ground alike
const CASE = 'rgba(22,18,16,0.8)';
function leader(c, x0, y0, x1, y1, col, a, w = 3) {
  if (a < 0.02) return;
  c.save(); c.globalAlpha = a; c.lineCap = 'round';
  for (const [st, lw] of [[CASE, w + 3], [col, w]]) { c.strokeStyle = st; c.lineWidth = lw; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  c.restore();
}
function marker(c, x, y, r, col, a, w = 3) {
  if (a < 0.02) return;
  c.save(); c.globalAlpha = a;
  for (const [st, lw] of [[CASE, w + 3], [col, w]]) { c.strokeStyle = st; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}
function label(c, text, x, y, { col = DIM, bold = false, size = 13, align = 'center' } = {}) {
  c.font = `${bold ? 700 : 400} ${size}px ${NARROW}`; c.textAlign = align; c.textBaseline = 'middle';
  if (align === 'center') { const hw = c.measureText(text).width / 2 + 4; x = clamp(x, hw, W - hw); }
  if (bold) { c.lineWidth = 4; c.strokeStyle = SOIL.deep; c.strokeText(text, x, y); }
  c.fillStyle = col; c.fillText(text, x, y);
}
const fmtYears = (g) => { const y = g * 27, r = y >= 10000 ? Math.round(y / 1000) * 1000 : Math.round(y / 100) * 100; return r.toLocaleString('en-US') + ' years ago'; };
function frame(T) {
  const P = stateAt(T), tp = P.topic, c = ctx;
  if (TALL) return frameTall(T, P);
  c.setTransform(px, 0, 0, px, 0, 0); c.textAlign = 'left';
  LINE.draw(c, CAM, T, { lift: { g: P.g, amt: P.amt, sig: 0 }, ripple: -1, focusAmt: 0, you: 1, youPose: tp.youPose, youSig: tp.signal ? 1 : 0 });
  const yG = LINE.L.yG, xa = LINE.xOf(P.g), xy = LINE.xOf(0), x0 = LINE.xOf(11100);
  const [a, b] = [LAY.a, LAY.b], ys = yG + (mobile ? 30 : 34), size = mobile ? 12 : 14, fh = LINE.figH();
  const alA = (0.6 + 0.4 * P.amt) * P.fade;
  // time scale under the line: 100,000-year ticks, the old end labelled, and the picked person's age printed under them
  c.save(); c.strokeStyle = DIM; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, ys); c.lineTo(xy, ys); c.stroke();
  const ticks = [[11100, '300,000 years ago', 'left'], [200000 / 27, '200,000'], [100000 / 27, '100,000']];
  for (const [g, text, align] of ticks) {
    const x = LINE.xOf(g); c.beginPath(); c.moveTo(x, ys - 4); c.lineTo(x, ys + 4); c.stroke();
    const near = Math.abs(x - xa) < (align ? (mobile ? 120 : 150) : 100);
    if (!near && !(mobile && !align)) label(c, text, x, ys + size + 2, { size, align: align || 'center' });
  }
  c.beginPath(); c.moveTo(xa, ys - 4); c.lineTo(xa, ys + 4); c.globalAlpha = alA; c.strokeStyle = LIGHT; c.stroke();
  c.restore();
  // leaders: from the bottom of each picture down to the head of the person it belongs to
  const ax = clamp(xa, a[0] + 12, a[0] + a[2] - 12), bx = clamp(xy, b[0] + 12, b[0] + b[2] - 12);
  // the picked person (raised out of the row) and you, each ringed, each tied to their picture
  const rr = fh * 0.95, ya = yG - fh * (0.52 + 1.25 * P.amt), yy = yG - fh * 0.52;
  const toRing = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0) || 1; return [x1 - (x1 - x0) / d * rr, y1 - (y1 - y0) / d * rr]; };
  leader(c, ax, a[1] + a[3], ...toRing(ax, a[1] + a[3], xa, ya), LIGHT, alA); marker(c, xa, ya, rr, LIGHT, alA);
  leader(c, bx, b[1] + b[3], ...toRing(bx, b[1] + b[3], xy, yy), C.you, P.fade); marker(c, xy, yy, rr, C.you, P.fade);
  // the age sits under the picked person, kept clear of "Now" at the right end
  c.font = `700 ${size + 1}px ${NARROW}`; const hw = c.measureText(fmtYears(P.g)).width / 2, nw = c.measureText('Now').width;
  c.save(); c.globalAlpha = alA; label(c, fmtYears(P.g), Math.min(xa, xy - nw - 12 - hw), ys + size + 2, { col: LIGHT, bold: true, size: size + 1 }); c.restore();
  c.save(); c.globalAlpha = P.fade; label(c, 'Now', xy, ys + size + 2, { col: '#FF5A4E', bold: true, size: size + 1, align: 'right' }); c.restore();
  pictures(c, P, T);
  ui(P);
}

// the two pictures: square corners, a keyline in the colour of their leader
function pictures(c, P, T) {
  const tp = P.topic, [a, b] = [LAY.a, LAY.b];
  c.save(); c.globalAlpha = P.fade;
  setFeeling(tp.signal ? FEELS[tp.key] || null : null);
  c.save(); c.beginPath(); c.rect(...a); c.clip(); sceneCover(S, 'e', c, ...a, P.g, T, { beat: tp.eea, mr: P.mr }); c.restore();
  setFeeling(null);
  c.save(); c.beginPath(); c.rect(...b); c.clip(); coverWith(S, 'm', c, ...b, (c2, w2, h2) => MOMENTS[tp.key](c2, w2, h2, T)); c.restore();
  c.lineWidth = 3; c.strokeStyle = LIGHT; c.strokeRect(a[0] - 1.5, a[1] - 1.5, a[2] + 3, a[3] + 3);
  c.lineWidth = 3; c.strokeStyle = C.you; c.strokeRect(b[0] - 1.5, b[1] - 1.5, b[2] + 3, b[3] + 3);
  c.restore();
}
// the upright-phone frame: the line down the left, the scale in its soil, pointers from each picture's left edge
function frameTall(T, P) {
  const tp = P.topic, c = ctx, { TH, TOP, LEN, to } = TALL;
  c.setTransform(px, 0, 0, px, 0, 0);
  // the sky behind the pictures: the line's own sky, stretched
  const g0 = c.createLinearGradient(0, 0, 0, H); g0.addColorStop(0, '#2F6766'); g0.addColorStop(0.55, '#8FB0A6'); g0.addColorStop(1, '#E6D3AE'); c.fillStyle = g0; c.fillRect(0, 0, W, H);
  c.setTransform(0, px, -px, 0, px * TH, px * TOP); c.save(); c.beginPath(); c.rect(0, 0, LEN, TH); c.clip();
  LINE.draw(c, CAM, T, { lift: { g: P.g, amt: P.amt, sig: 0 }, ripple: -1, focusAmt: 0, you: 1, youPose: tp.youPose, youSig: tp.signal ? 1 : 0 });
  c.restore();
  c.setTransform(px, 0, 0, px, 0, 0);
  const yG = LINE.L.yG, fh = LINE.figH(), alA = (0.6 + 0.4 * P.amt) * P.fade, [a, b] = [LAY.a, LAY.b];
  // the scale, in the soil: a tick every 100,000 years, short labels, the picked person's age in bold
  const sx = (TH - yG) * 0.82, Y = (g) => TOP + LINE.xOf(g), ya0 = Y(P.g), yNow = Y(0);
  c.save(); c.strokeStyle = DIM; c.lineWidth = 1; c.beginPath(); c.moveTo(sx, Y(11100)); c.lineTo(sx, yNow); c.stroke();
  for (const [g, text] of [[11100, '300k'], [200000 / 27, '200k'], [100000 / 27, '100k']]) {
    const y = Y(g); c.beginPath(); c.moveTo(sx - 4, y); c.lineTo(sx + 4, y); c.stroke();
    if (Math.abs(y - ya0) > 18) label(c, text, sx - 7, y, { size: 11, align: 'right' });
  }
  c.restore();
  const age = Math.round(P.g * 27 / 1000) + 'k', nearNow = yNow - ya0 < 22;
  c.save(); c.globalAlpha = alA; label(c, age, sx - 7, nearNow ? yNow - 22 : ya0, { col: LIGHT, bold: true, size: 12, align: 'right' }); c.restore();
  c.save(); c.globalAlpha = P.fade; label(c, 'Now', sx - 7, yNow, { col: '#FF5A4E', bold: true, size: 12, align: 'right' }); c.restore();
  // rings and pointers
  const rr = fh * 0.95, [pa, pya] = to(LINE.xOf(P.g), yG - fh * (0.52 + 1.25 * P.amt)), [py, pyy] = to(LINE.xOf(0), yG - fh * 0.52);
  const toRing = (x0, y0, x1, y1) => { const d = Math.hypot(x1 - x0, y1 - y0) || 1; return [x1 - (x1 - x0) / d * rr, y1 - (y1 - y0) / d * rr]; };
  const ay = clamp(pya, a[1] + 10, a[1] + a[3] - 10), by = clamp(pyy, b[1] + 10, b[1] + b[3] - 10);
  leader(c, a[0], ay, ...toRing(a[0], ay, pa, pya), LIGHT, alA); marker(c, pa, pya, rr, LIGHT, alA);
  leader(c, b[0], by, ...toRing(b[0], by, py, pyy), C.you, P.fade); marker(c, py, pyy, rr, C.you, P.fade);
  pictures(c, P, T);
  ui(P);
}

// ---------- words and the topic bar ----------
const nav = $('nav');
TOPICS.forEach((tp, i) => { const bt = document.createElement('button'); bt.textContent = tp.title; bt.onclick = () => jump(i); nav.appendChild(bt); });
let shown = -1;
function ui(P) {
  const words = $('words'), foot = $('foot');
  if (P.ti !== shown) {
    shown = P.ti; const tp = P.topic;
    $('then').textContent = tp.then; $('main').textContent = tp.now; $('fact').textContent = tp.fact || '';
    $('src').textContent = 'Sources: ' + tp.src + '. Time scale: ' + SCALE_SRC + '.'; $('key').classList.toggle('off', !tp.signal);
    [...nav.children].forEach((bt, i) => bt.classList.toggle('on', i === P.ti));
    nav.children[P.ti].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    history.replaceState(null, '', '#' + tp.key);
  }
  const vis = P.lt > 0.15 && P.lt < DUR - 0.5;
  words.classList.toggle('out', !vis); foot.style.opacity = vis ? 1 : 0;
  nav.children[P.ti].style.setProperty('--p', (P.lt / DUR).toFixed(3));
}

// ---------- time ----------
const q = new URLSearchParams(location.search), freeze = q.has('t') ? +q.get('t') : null;
let offset = 0, t0 = performance.now(), paused = false, pausedAt = 0;
const now = () => (paused ? pausedAt : (performance.now() - t0) / 1000) + offset;
function jump(i) { offset = i * DUR; t0 = performance.now(); pausedAt = 0; shown = -1; }
const start = TOPICS.findIndex((tp) => '#' + tp.key === location.hash);
if (start > 0) offset = start * DUR;
addEventListener('keydown', (e) => {
  const cur = stateAt(now()).ti;
  if (e.key === 'ArrowRight') jump((cur + 1) % TOPICS.length);
  if (e.key === 'ArrowLeft') jump((cur + TOPICS.length - 1) % TOPICS.length);
  if (e.key === ' ') { e.preventDefault(); if (paused) { t0 = performance.now() - pausedAt * 1000; paused = false; } else { pausedAt = (performance.now() - t0) / 1000; paused = true; } }
});
resize(); addEventListener('resize', () => { resize(); });
function loop() { frame(now()); requestAnimationFrame(loop); }
// wait for the faces the canvas uses, but never more than 2.5 s: a font that fails to load must not stop the page
const fontsIn = Promise.allSettled(['400 14px "PT Sans Narrow"', '700 14px "PT Sans Narrow"', '400 14px "Charis SIL"'].map((f) => document.fonts.load(f)));
Promise.race([fontsIn, new Promise((r) => setTimeout(r, 2500))]).then(() => {
  resize();
  if (freeze !== null) { frame(freeze + offset); window.ready = true; } else requestAnimationFrame(loop);
});
window.__topics = TOPICS.map((t) => t.key); window.__dur = DUR;
