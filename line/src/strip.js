// The topics site as one strip, the same on a phone and on a desktop (centred there). Top to bottom: how life was
// arranged for 300,000 years and a picture from one generation, the line of generations, your picture and why it's
// normal. The line is drawn straight onto the page with no backdrop of its own: a procession of your ancestors walking
// towards you, as wide as the pictures. Each picture opens out of its person on the line like an inset on a map.
import { clamp, smooth, easeInOut, hash, mix, glow, offscreen } from '../../v4/src/art.js';
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

// ---------- timing ----------
// Each topic holds one picked generation long enough to read the sentence, then moves through others in a rhythm
// that changes from topic to topic: quick bursts, pauses, runs that speed up, runs that slow down, and a last one
// held for a beat. Seconds per picked generation; REST is the pause after the last, before the next topic.
const RHYTHMS = [
  [5.5, 0.6, 0.6, 0.65, 1.8, 1.1, 0.85, 0.7, 0.6, 2.2],          // burst, pause, run that speeds up
  [4.5, 1.5, 0.6, 0.6, 0.7, 0.85, 1.1, 1.4, 2.2],                // a step, then a run that slows down
  [5.0, 0.6, 0.6, 1.7, 0.6, 0.6, 1.5, 0.8, 0.7, 0.6, 0.6, 2.2],  // two short bursts, then a rush
];
const REST = 1.5;
const PLAN = TOPICS.map((tp, ti) => { const s = []; let tt = 0; for (const d of RHYTHMS[ti % RHYTHMS.length]) { s.push({ t0: tt, t1: tt + d, d }); tt += d; } return { s, T: tt + REST }; });
const START = []; let TOTAL = 0; for (const pl of PLAN) { START.push(TOTAL); TOTAL += pl.T; }
const gFor = (ti, i) => { const top = Math.min(11000, TOPICS[ti].span / 27 - 120); return Math.round(150 + hash(ti * 97.1 + i * 13.7 + 1) * (top - 150)); };
function stateAt(T) {
  const tt = ((T % TOTAL) + TOTAL) % TOTAL; let ti = 0; while (ti < TOPICS.length - 1 && tt >= START[ti + 1]) ti++;
  const SEG = PLAN[ti], DUR = SEG.T, lt = tt - START[ti], n = SEG.s.length;
  let i = SEG.s.findIndex((q) => lt < q.t1); const rest = i < 0; if (rest) i = n - 1;
  const q = SEG.s[i], g = gFor(ti, i), prev = i > 0 ? gFor(ti, i - 1) : null, st = lt - q.t0;
  const amt = rest ? 0 : easeInOut(smooth(st, 0, Math.min(0.6, q.d * 0.35))) * easeInOut(smooth(q.t1 - lt, 0, Math.min(0.4, q.d * 0.25)));
  const k = rest ? 1 : smooth(st, 0, Math.min(0.3, q.d * 0.5));
  return { ti, topic: TOPICS[ti], lt, g, si: i, k, amt, mr: prev !== null && k < 1 ? { from: prev, k } : null, dur: DUR, fade: smooth(lt, 0, 0.45) * (1 - smooth(lt, DUR - 0.45, DUR)) };
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
  shown = -1; PILE = { ti: -1, items: [] }; LIVE = null;
}
// the tallest each block of words gets at this size and width, across all topics: [then, now, sources]
function heights(fs, width) {
  const a = $('then'), b = $('now'), f = $('foot'), keep = [a.textContent, $('main').textContent, $('src').textContent];
  a.style.cssText = b.style.cssText = `left:0;top:0;width:${width}px;font-size:${fs}px;visibility:hidden`;
  f.style.cssText = `left:0;top:0;width:${width}px;visibility:hidden`;
  const out = [0, 0, 0];
  for (const tp of TOPICS) {
    a.textContent = tp.then; $('main').textContent = tp.now; $('src').textContent = srcText(tp);
    out[0] = Math.max(out[0], a.offsetHeight); out[1] = Math.max(out[1], b.offsetHeight); out[2] = Math.max(out[2], f.offsetHeight);
  }
  [a.textContent, $('main').textContent, $('src').textContent] = keep;
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
  const tq = topPhoto(P), bl = corner(tq, -tq.w / 2, tq.h / 2), br = corner(tq, tq.w / 2, tq.h / 2);
  funnel(c, xa, pcy, r, ...bl, ...br, LIGHT, 'rgba(241,238,232,0.06)', alA);
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
// ---------- the ancestors' pictures: a pile of photographs ----------
// Every generation picked in a topic leaves its photograph on the pile. The newest drops on top, slightly turned; the
// ones before it stay underneath, so the pile grows as the run goes on. It clears when the topic changes.
const PRINT = '#EEE8DC', BORDER = 5;
let PILE = { ti: -1, items: [] }, LIVE = null;
// where photograph j of topic ti lies: a small turn, alternating sides, and a small shift
function photoAt(ti, j) {
  const h1 = hash(ti * 31.7 + j * 7.3), h2 = hash(ti * 11.1 + j * 3.9 + 5), h3 = hash(ti * 5.3 + j * 13.1 + 9);
  return { rot: j === 0 ? (h1 - 0.5) * 0.02 : (j % 2 ? 1 : -1) * (0.012 + h1 * 0.045), dx: (h2 - 0.5) * 10, dy: (h3 - 0.5) * 6 };
}
// the outer size of a print: a little smaller than the picture's place, so a turned one still fits the column
function photoBox() { const [x, y, w, h] = LAY.a; return { cx: x + w / 2, cy: y + h / 2, w: w - 10, h: h - 10 }; }
const inner = () => { const B = photoBox(); return [Math.round(B.w - 2 * BORDER), Math.round(B.h - 2 * BORDER)]; };
// the scene for generation g at the print's inner size, into a canvas of its own
function develop(o, tp, g, T, slot) {
  const [iw, ih] = inner();
  setFeeling(tp.signal ? FEELS[tp.key] || null : null);
  sceneCover(S, slot, o.ctx, 0, 0, iw, ih, g, T, { beat: tp.eea });
  setFeeling(null);
  return o.c;
}
// where the top photograph is this frame: it drops in from a little above, larger and more turned, and settles
function topPhoto(P) {
  const B = photoBox(), p = photoAt(P.ti, P.si), e = 1 - Math.pow(1 - P.k, 3);
  return { cx: B.cx + p.dx, cy: B.cy + p.dy - (1 - e) * 14, rot: p.rot * (1 + (1 - e) * 1.5), sc: 1 + (1 - e) * 0.06, a: e, w: B.w, h: B.h };
}
const corner = (q, x, y) => [q.cx + (x * Math.cos(q.rot) - y * Math.sin(q.rot)) * q.sc, q.cy + (x * Math.sin(q.rot) + y * Math.cos(q.rot)) * q.sc];
// one photograph: a pale print with a soft shadow, turned about its centre
function print(c, q, img) {
  c.save(); c.globalAlpha *= q.a; c.translate(q.cx, q.cy); c.rotate(q.rot); c.scale(q.sc, q.sc);
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 14; c.shadowOffsetY = 4; c.fillStyle = PRINT; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
  c.shadowColor = 'transparent'; c.drawImage(img, -q.w / 2 + BORDER, -q.h / 2 + BORDER, q.w - 2 * BORDER, q.h - 2 * BORDER);
  c.restore();
}
function pictures(c, P, T) {
  const tp = P.topic, b = LAY.b, B = photoBox(), [iw, ih] = inner();
  c.save(); c.globalAlpha = P.fade;
  if (PILE.ti !== P.ti) PILE = { ti: P.ti, items: [] };
  if (PILE.items.length > P.si) PILE.items.length = P.si;
  while (PILE.items.length < P.si) PILE.items.push(develop(offscreen(iw, ih, dpr), tp, gFor(P.ti, PILE.items.length), T, 'pile'));
  PILE.items.forEach((img, j) => { const p = photoAt(P.ti, j); print(c, { cx: B.cx + p.dx, cy: B.cy + p.dy, rot: p.rot, sc: 1, a: 1, w: B.w, h: B.h }, img); });
  if (!LIVE) LIVE = offscreen(iw, ih, dpr);
  print(c, topPhoto(P), develop(LIVE, tp, P.g, T, 'e'));
  c.save(); c.beginPath(); c.rect(...b); c.clip(); coverWith(S, 'm', c, ...b, (c2, w2, h2) => MOMENTS[tp.key](c2, w2, h2, T)); c.restore();
  c.lineWidth = 2; c.strokeStyle = RED; c.strokeRect(b[0] - 1, b[1] - 1, b[2] + 2, b[3] + 2);
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
    $('then').textContent = tp.then; $('main').textContent = tp.now;
    $('src').textContent = srcText(tp); $('key').classList.toggle('off', !tp.signal);
    [...nav.children].forEach((bt, i) => bt.classList.toggle('on', i === P.ti));
    const on = nav.children[P.ti]; nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
    history.replaceState(null, '', location.search + '#' + tp.key);
  }
  const vis = P.lt > 0.15 && P.lt < P.dur - 0.5;
  words.classList.toggle('out', !vis);
  nav.children[P.ti].style.setProperty('--p', (P.lt / P.dur).toFixed(3));
}

// ---------- time ----------
const q = new URLSearchParams(location.search), freeze = q.has('t') ? +q.get('t') : null;
let offset = 0, t0 = performance.now(), paused = false, pausedAt = 0;
const now = () => (paused ? pausedAt : (performance.now() - t0) / 1000) + offset;
function jump(i) { offset = START[i]; t0 = performance.now(); pausedAt = 0; shown = -1; if (freeze !== null) frame(freeze + offset); }
const start = TOPICS.findIndex((tp) => '#' + tp.key === location.hash);
if (start > 0) offset = START[start];
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
window.__topics = TOPICS.map((t) => t.key); window.__dur = PLAN[0].T; window.__start = START;
