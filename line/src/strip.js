// The topics site as one strip, the same on a phone and on a desktop (centred there). Top to bottom: how life was
// arranged for 300,000 years and a picture from one generation, the line of generations, your picture and why it's
// normal. Each picture opens out of its person on the line like an inset on a map. The line's soil carries its scale
// and a one-line key, so the line explains itself.
import { clamp, smooth, easeInOut, hash } from '../../v4/src/art.js';
import { sceneCover, coverWith, C } from './variants/kit.js';
import { MOMENTS } from './moments.js';
import { createScene } from './scene.js';
import { registerTopics } from './topics.js';
import { setFeeling } from './frame.js';
import { TOPICS, SCALE_SRC } from './personal-copy.js';

registerTopics([...new Set(TOPICS.map((t) => t.eea))].filter((k) => !['lonely', 'missed', 'stress', 'light', 'compare', 'baby', 'old', 'food'].includes(k)).map((k) => ({ key: k, signal: true })));
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const CAM = { g: 0, a: 0.94, s: 11100 / 0.9 };

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

// ---------- layout ----------
const SOIL = { top: ['#9C8A5E', '#463B2E'], farm: ['#857650', '#3B3127'], ind: ['#5E5856', '#2A2624'], deep: '#1D1A17', fade: '29,26,23', grass: '#463B2E' };
const NARROW = '"PT Sans Narrow", "Arial Narrow", sans-serif';
const NAV = 44, BAND = 110, YG = 60; // band: the line, its ground at YG, the scale and key in the soil below
let W = 0, H = 0, PH = 0, dpr = 1, X0 = 0, SW = 0, LINE = null, LAY = null; const S = {};
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  // the strip is as wide as a phone, a bit wider on a tall desktop window
  SW = Math.min(W, Math.round(clamp(H * 0.54, 380, 540))); X0 = Math.round((W - SW) / 2);
  const m = 16, cw = SW - 2 * m, fs = clamp(Math.min(SW / 17, H / 31), 18, 27), [hA, hB, hS] = heights(fs, cw);
  // everything down to the end of the second sentence fits one screen; the sources may sit just below it
  const top = 12, f1 = 22, f2 = 34, fixed = top + hA + 8 + f1 + BAND + f2 + 8 + hB + 12 + NAV;
  const ph = clamp((H - fixed) / 2, 120, cw * 0.62);
  PH = Math.max(H, Math.ceil(fixed + 2 * ph + hS + 4));
  let y = top + hA + 8; const a = [X0 + m, y, cw, ph]; y += ph + f1;
  const band = y; y += BAND + f2; const b = [X0 + m, y, cw, ph]; y += ph + 8;
  LAY = { a, b, band, now: y, src: y + hB + 8 };
  document.body.style.height = PH + 'px'; $('page').style.height = PH + 'px';
  cv.width = Math.round(W * dpr); cv.height = Math.round(PH * dpr); cv.style.width = W + 'px'; cv.style.height = PH + 'px';
  LINE = createScene({ ground: YG / BAND, soil: SOIL }); LINE.resize(SW, BAND, dpr);
  const st = `left:${X0 + m}px;width:${cw}px;font-size:${fs}px;`;
  $('then').style.cssText = st + `bottom:${PH - a[1] + 8}px`;
  $('now').style.cssText = st + `top:${LAY.now}px`;
  $('foot').style.cssText = `left:${X0 + m}px;width:${cw}px;top:${LAY.src}px`;
  $('nav').style.cssText = `left:${X0}px;width:${SW}px`;
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
const LIGHT = '#F1EEE8', DIM = 'rgba(241,238,232,0.62)', NOW = '#FF5A4E', CASE = 'rgba(22,18,16,0.8)';
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
// a map-inset funnel: from the two sides of a ring to two corners of a picture
function funnel(c, x, y, r, xa, ya, xb, yb, col, fill, a) {
  if (a < 0.02) return;
  c.save(); c.globalAlpha = a; c.fillStyle = fill;
  c.beginPath(); c.moveTo(x - r, y); c.lineTo(xa, ya); c.lineTo(xb, yb); c.lineTo(x + r, y); c.closePath(); c.fill(); c.restore();
  leader(c, x - r, y, xa, ya, col, a, 1.5); leader(c, x + r, y, xb, yb, col, a, 1.5);
}
function label(c, text, x, y, { col = DIM, bold = false, size = 12, align = 'center', font = NARROW } = {}) {
  c.font = `${bold ? 700 : 400} ${size}px ${font}`; c.textAlign = align; c.textBaseline = 'middle';
  if (bold) { c.lineWidth = 4; c.strokeStyle = SOIL.deep; c.strokeText(text, x, y); }
  c.fillStyle = col; c.fillText(text, x, y);
  return c.measureText(text).width;
}
const fmtYears = (g) => { const y = g * 27, r = y >= 10000 ? Math.round(y / 1000) * 1000 : Math.round(y / 100) * 100; return r.toLocaleString('en-US') + ' years ago'; };

function frame(T) {
  const P = stateAt(T), tp = P.topic, c = ctx, [a, b] = [LAY.a, LAY.b], by = LAY.band;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = SOIL.deep; c.fillRect(0, 0, W, PH);
  const fh = LINE.figH(), rr = fh * 0.95, xa = X0 + LINE.xOf(P.g), xy = X0 + LINE.xOf(0), x0 = X0 + LINE.xOf(11100);
  const ya = by + YG - fh * (0.52 + 1.25 * P.amt), yy = by + YG - fh * 0.52, alA = (0.6 + 0.4 * P.amt) * P.fade;
  // your funnel runs behind the band, so it comes out of the soil under you and the soil stays clear for the scale
  funnel(c, xy, yy, rr, b[0], b[1], b[0] + b[2], b[1], C.you, 'rgba(224,32,26,0.2)', P.fade);
  c.save(); c.translate(X0, by); c.beginPath(); c.rect(0, 0, SW, BAND); c.clip();
  LINE.draw(c, CAM, T, { lift: { g: P.g, amt: P.amt, sig: 0 }, ripple: -1, focusAmt: 0, you: 1, youPose: tp.youPose, youSig: tp.signal ? 1 : 0 });
  c.fillStyle = SOIL.deep; c.fillRect(0, YG + 24, SW, BAND - YG - 24); // plain soil under the scale
  c.restore();
  leader(c, xy, yy + rr, xy, by + BAND, C.you, P.fade, 2.5);
  funnel(c, xa, ya, rr, a[0], a[1] + a[3], a[0] + a[2], a[1] + a[3], LIGHT, 'rgba(241,238,232,0.16)', alA);
  marker(c, xa, ya, rr, LIGHT, alA); marker(c, xy, yy, rr, C.you, P.fade);
  // "You", beside your ring, unless the picked person is in the way
  if (xy - xa > rr * 2 + 44) { c.save(); c.globalAlpha = P.fade; label(c, 'You', xy - rr - 7, yy, { col: NOW, bold: true, size: 14, align: 'right' }); c.restore(); }
  // the scale, in the soil: an axis from the oldest generation to now, the picked person's age in bold
  const ys = by + YG + 12, yl = ys + 12;
  c.save(); c.strokeStyle = DIM; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, ys); c.lineTo(xy - 5, ys); c.stroke();
  for (const g of [11100, 200000 / 27, 100000 / 27]) { const x = X0 + LINE.xOf(g); c.beginPath(); c.moveTo(x, ys - 3); c.lineTo(x, ys + 3); c.stroke(); }
  c.globalAlpha = alA; c.strokeStyle = LIGHT; c.lineWidth = 2; c.beginPath(); c.moveTo(xa, ys - 5); c.lineTo(xa, ys + 5); c.stroke(); c.restore();
  c.font = `700 13px ${NARROW}`; const age = fmtYears(P.g), hw = c.measureText(age).width / 2, nw = c.measureText('Now').width;
  const ax = clamp(xa, x0 + hw, xy - 8 - nw - 12 - hw), oldW = (c.font = `400 12px ${NARROW}`, c.measureText('300,000 years ago').width);
  if (ax - hw > x0 + oldW + 12) label(c, '300,000 years ago', x0, yl, { align: 'left' });
  for (const [yrs, t] of [[200000, '200,000'], [100000, '100,000']]) { const x = X0 + LINE.xOf(yrs / 27); if (Math.abs(x - ax) > hw + 30 && x - 24 > x0 + oldW + 8) label(c, t, x, yl); }
  c.save(); c.globalAlpha = alA; label(c, age, ax, yl, { col: LIGHT, bold: true, size: 13 }); c.restore();
  c.save(); c.globalAlpha = P.fade; label(c, 'Now', xy - 8, yl, { col: NOW, bold: true, size: 13, align: 'right' }); c.restore();
  // the key
  const ky = yl + 18, kw = label(c, 'The line:', x0, ky, { col: LIGHT, bold: true, size: 14, align: 'left' });
  label(c, '11,100 generations of your ancestors', x0 + kw + 5, ky, { col: DIM, size: 14, align: 'left' });
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
  c.lineWidth = 3; c.strokeStyle = LIGHT; c.strokeRect(a[0] - 1.5, a[1] - 1.5, a[2] + 3, a[3] + 3);
  c.strokeStyle = C.you; c.strokeRect(b[0] - 1.5, b[1] - 1.5, b[2] + 3, b[3] + 3);
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
