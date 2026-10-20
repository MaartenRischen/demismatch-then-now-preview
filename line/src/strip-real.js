// The topics site as one strip, the same on a phone and on a desktop (centred there). Top to bottom: how life was
// arranged for 300,000 years and a picture from one generation, the line of generations, your picture and why it's
// normal. The pictures are films rendered from code (line/src/real/: wooden painter's mannequins in scenes built per
// generation), recorded by line/tools/real-clips.mjs: per topic one clip of the ancestors' picks in timeline order and
// one of you. The page plays them in step with its own clock. The drawn version is strip.v4.js.
import { clamp, smooth, easeInOut, hash, mix, glow, offscreen } from '../../v4/src/art.js';
import { drawFigure, POSES, walkPose, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';
import { TOPICS, SCALE_SRC } from './personal-copy.js';
import { PLAN, START, TOTAL, gFor } from './strip-plan.js';

const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const N = 11100;

// ---------- timing (strip-plan.js) ----------
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
let W = 0, H = 0, PH = 0, dpr = 1, LAY = null;
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
  const SW = Math.min(W, Math.round(clamp(H * 0.54, 380, 540))), m = 16, cw = SW - 2 * m, xL = Math.round((W - SW) / 2) + m, xR = xL + cw;
  const fs = clamp(Math.min(cw / 15, H / 30), 19, 28), [hA, hB, hS] = heights(fs, cw);
  // the line: figure height, where you stand, the ring sizes
  const fh = clamp(cw * 0.056, 18, 26), hp = fh * 1.15, r = hp * 0.8, lift = fh * 1.3;
  const x0 = xL + fh * 0.3, x1 = xR - fh * 0.5;
  const above = lift + hp * 0.55 + r;                 // from the ground up to the top of the picked person's ring
  const ycy = -hp * 0.55;                             // your ring's centre, relative to the ground
  // under the line: the timeline (row 1) and what the line is (row 2); your picture starts below them
  const capY = 33, G = capY + 34 - ycy;
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
  shown = -1; CUT = new Map();
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

// ---------- the films ----------
// line/clips/<topic>-then.mp4 runs through the topic's picks in order; <topic>-now.mp4 is you for the whole topic.
// <topic>.json holds, per frame, where the head of the person whose alarm is on lies: [x, y, r] as fractions of the
// frame's width (r too) and height.
const CLIP = (key, kind) => new URL(`../clips/${key}-${kind}.mp4`, import.meta.url).href;
const VIDS = new Map(); // topic index -> { then, now, track }
function film(ti) {
  let v = VIDS.get(ti);
  if (!v) {
    // phones only decode video that is inline, muted and in the document, so the elements sit in the page, invisible
    const key = TOPICS[ti].key, mk = (kind) => { const e = document.createElement('video'); e.muted = true; e.defaultMuted = true; e.playsInline = true; for (const a of ['muted', 'playsinline', 'webkit-playsinline']) e.setAttribute(a, '');
      e.preload = 'auto'; e.crossOrigin = 'anonymous'; e.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none'; e.src = CLIP(key, kind); document.body.appendChild(e); e.load(); return e; };
    v = { then: mk('then'), now: mk('now'), track: null };
    fetch(new URL(`../clips/${key}.json`, import.meta.url)).then((r) => r.json()).then((j) => { v.track = j; }).catch(() => {});
    VIDS.set(ti, v);
  }
  return v;
}
// the topic on screen and the next one; others are dropped so a phone holds at most four videos
function preload(ti) {
  const keep = new Set([ti, (ti + 1) % TOPICS.length]);
  for (const k of keep) film(k);
  for (const [k, v] of VIDS) if (!keep.has(k)) { for (const e of [v.then, v.now]) { e.pause(); e.removeAttribute('src'); e.load(); e.remove(); } VIDS.delete(k); }
}
// keep a video at time t: playing on the page's clock, nudged back when it drifts; seeked when frozen
function keep(e, t) {
  if (!(e.readyState >= 1)) return;
  const d = Math.max(0, Math.min(t, (e.duration || t) - 0.05));
  if (freeze !== null) { if (Math.abs(e.currentTime - d) > 0.01 && !e.seeking) e.currentTime = d; return; }
  if (Math.abs(e.currentTime - d) > 0.25) e.currentTime = d;
  if (e.paused) e.play().catch(() => {});
}
const live = (e) => e.readyState >= 2 && e.videoWidth > 0;
// a frame filling a box, cropped to fit, pushed in by z; returns how to find a point of the frame in the box
function cover(c, im, x, y, w, h, z = 1) {
  const iw = im.videoWidth || im.width, ih = im.videoHeight || im.height, s = Math.max(w / iw, h / ih) * z, sw = w / s, sh = h / s;
  const sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  c.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  return (px, py) => [x + (px * iw - sx) * s, y + (py * ih - sy) * s, s * iw];
}
// the gold rings on whoever's alarm is on, from the clip's track at time t
function alarm(c, at, pts, t, T, a, h) {
  if (!pts || a < 0.02) return; const p = pts.pts[Math.min(pts.pts.length - 1, Math.max(0, Math.floor(t * pts.fps)))]; if (!p) return;
  const [x, y, pw] = at(p[0], p[1]), r = clamp(p[2] * pw * 1.3, 8, h * 0.13);
  const g0 = c.globalAlpha; c.save(); c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 3; c.strokeStyle = GOLD;
  for (let k = 0; k < 3; k++) {
    const u = (T * 0.9 + k / 3) % 1; c.globalAlpha = g0 * a * (1 - u) * 0.95; c.lineWidth = Math.max(1.4, r * 0.07 * (1 - u * 0.5));
    c.beginPath(); c.arc(x, y, r * (0.75 + u * 0.9), 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}
// film grain over the pictures, drawn on the page so the clips stay small
const GRAIN = (() => { const o = offscreen(256, 256, 1), d = o.ctx.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } o.ctx.putImageData(d, 0, 0); return o.c; })();
function grain(c, x, y, w, h, T) {
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.globalAlpha *= 0.06; c.globalCompositeOperation = 'overlay';
  const ox = (Math.floor(T * 24) * 73) % 256, oy = (Math.floor(T * 24) * 151) % 256;
  for (let yy = y - oy; yy < y + h; yy += 256) for (let xx = x - ox; xx < x + w; xx += 256) c.drawImage(GRAIN, xx, yy);
  c.restore();
}

// ---------- drawing ----------
function stroke(c, pts, col, w, a) { c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.restore(); }
function ring(c, x, y, r, col, a) { c.save(); c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = 2; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke(); c.restore(); }
// a map-inset funnel: from the two sides of a ring to two corners of a picture
// skip: boxes [x, y, w, h] the two edge lines break around, so they never run through words
function funnel(c, x, y, r, xa, ya, xb, yb, col, fill, a, skip = []) {
  if (a < 0.02) return;
  c.save(); c.globalAlpha = a; c.fillStyle = fill;
  c.beginPath(); c.moveTo(x - r, y); c.lineTo(xa, ya); c.lineTo(xb, yb); c.lineTo(x + r, y); c.closePath(); c.fill(); c.restore();
  c.save(); c.beginPath(); c.rect(0, 0, W, PH); for (const q of skip) c.rect(...q); c.clip('evenodd');
  stroke(c, [[x - r, y], [xa, ya]], col, 1.25, a); stroke(c, [[x + r, y], [xb, yb]], col, 1.25, a);
  c.restore();
}
function text(c, s, x, y, { col = DIM, bold = false, size = 12.5, align = 'left', a = 1 } = {}) {
  c.save(); c.globalAlpha = a; c.font = `${bold ? 700 : 400} ${size}px ${NARROW}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(s, x, y);
  const w = c.measureText(s).width; c.restore(); return w;
}
// the words under the line, laid out once per frame: row 1 is the timeline (300,000 years ago to now), row 2 what the
// line is. Each has a box, padded, for the funnel lines to break around.
function lineWords(c) {
  const L = LAY, y1 = L.yR + 16, y2 = L.yR + L.capY, out = [];
  const add = (s, x, y, o) => { c.font = `${o.bold ? 700 : 400} ${o.size || 12.5}px ${NARROW}`; const w = c.measureText(s).width, l = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x; out.push({ s, x, y, o, w, box: [l - 5, y - 10, w + 10, 20] }); return w; };
  const w300 = add('300,000 years ago', L.xL, y1, { col: LIGHT, bold: true, size: 13.5 });
  for (const [yrs, t] of [[200000, '200,000'], [100000, '100,000']]) { const x = xOf(yrs / 27); if (x - 22 > L.xL + w300 + 8) add(t, x, y1, { align: 'center' }); }
  add('Now', L.xR, y1, { col: NOW, bold: true, size: 13.5, align: 'right' });
  c.font = `700 12.5px ${NARROW}`; const c0 = c.measureText(CAPTION[0]).width; c.font = `400 12.5px ${NARROW}`; const c1 = c.measureText(CAPTION[1]).width;
  const l = (L.xL + L.xR) / 2 - (c0 + c1) / 2; add(CAPTION[0], l, y2, { col: LIGHT, bold: true }); add(CAPTION[1], l + c0, y2, {});
  return out;
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
  const words = lineWords(c);
  funnel(c, xy, ycy, r, b[0], b[1], b[0] + b[2], b[1], RED, 'rgba(224,32,26,0.08)', P.fade, words.map((q) => q.box));
  const tq = topPhoto(P), bl = corner(tq, -tq.w / 2, tq.h / 2), br = corner(tq, tq.w / 2, tq.h / 2);
  funnel(c, xa, pcy, r, ...bl, ...br, LIGHT, 'rgba(241,238,232,0.06)', alA);
  // the ground is the timeline: 300,000 years ago at the left, now at the right, an arrow pointing to now
  stroke(c, [[L.xL, yR + 0.5], [L.xR, yR + 0.5]], LIGHT, 1.5, 0.6);
  stroke(c, [[L.xR - 6, yR - 4], [L.xR, yR + 0.5], [L.xR - 6, yR + 5]], LIGHT, 1.5, 0.6);
  for (const yrs of [300000, 200000, 100000]) { const x = xOf(yrs / 27); stroke(c, [[x, yR], [x, yR + (yrs === 300000 ? 7 : 5)]], LIGHT, 1.5, 0.6); }
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
  // the picked person's place on the timeline
  stroke(c, [[xa, yR - 1], [xa, yR + 6]], LIGHT, 2, alA * P.amt);
  for (const q of words) text(c, q.s, q.x, q.y, q.o);
  pictures(c, P, T);
  ui(P);
}
// ---------- the ancestors' pictures: a pile of photographs ----------
// Every generation picked in a topic leaves its photograph on the pile. The newest drops on top, slightly turned; the
// ones before it stay underneath, so the pile grows as the run goes on. It clears when the topic changes.
const PRINT = '#EEE8DC', BORDER = 5, DARK = '#2B2723';
// where photograph j of topic ti lies: a small turn, alternating sides, and a small shift
function photoAt(ti, j) {
  const h1 = hash(ti * 31.7 + j * 7.3), h2 = hash(ti * 11.1 + j * 3.9 + 5), h3 = hash(ti * 5.3 + j * 13.1 + 9);
  return { rot: j === 0 ? (h1 - 0.5) * 0.02 : (j % 2 ? 1 : -1) * (0.012 + h1 * 0.045), dx: (h2 - 0.5) * 10, dy: (h3 - 0.5) * 6 };
}
// the outer size of a print: a little smaller than the picture's place, so a turned one still fits the column
function photoBox() { const [x, y, w, h] = LAY.a; return { cx: x + w / 2, cy: y + h / 2, w: w - 10, h: h - 10 }; }
// each pick's last frame, kept as it was when the next pick took over: these are the prints under the top one
let CUT = new Map();
function keepFrame(ti, si, e, w, h) {
  const k = ti + ':' + si; let o = CUT.get(k);
  if (!o) { o = offscreen(w, h, dpr); CUT.set(k, o); }
  o.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); cover(o.ctx, e, 0, 0, w, h); o.ok = true;
}
// where the top photograph is this frame: it drops in from a little above, larger and more turned, and settles
function topPhoto(P) {
  const B = photoBox(), p = photoAt(P.ti, P.si), e = 1 - Math.pow(1 - P.k, 3);
  return { cx: B.cx + p.dx, cy: B.cy + p.dy - (1 - e) * 14, rot: p.rot * (1 + (1 - e) * 1.5), sc: 1 + (1 - e) * 0.06, a: e, w: B.w, h: B.h };
}
const corner = (q, x, y) => [q.cx + (x * Math.cos(q.rot) - y * Math.sin(q.rot)) * q.sc, q.cy + (x * Math.sin(q.rot) + y * Math.cos(q.rot)) * q.sc];
// one photograph: a pale print with a soft shadow, turned about its centre; paint(c, x, y, w, h) fills the picture
function print(c, q, paint) {
  c.save(); c.globalAlpha *= q.a; c.translate(q.cx, q.cy); c.rotate(q.rot); c.scale(q.sc, q.sc);
  c.shadowColor = 'rgba(0,0,0,0.55)'; c.shadowBlur = 14; c.shadowOffsetY = 4; c.fillStyle = PRINT; c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
  c.shadowColor = 'transparent'; const x = -q.w / 2 + BORDER, y = -q.h / 2 + BORDER, w = q.w - 2 * BORDER, h = q.h - 2 * BORDER;
  c.fillStyle = DARK; c.fillRect(x, y, w, h); c.beginPath(); c.rect(x, y, w, h); c.clip(); paint(c, x, y, w, h);
  c.restore();
}
function pictures(c, P, T) {
  const tp = P.topic, b = LAY.b, B = photoBox(), seg = PLAN[P.ti].s[P.si], v = film(P.ti), lt = P.lt;
  keep(v.then, lt); keep(v.now, lt);
  if (CUT.size && [...CUT.keys()][0].split(':')[0] !== String(P.ti)) CUT = new Map();
  c.save(); c.globalAlpha = P.fade;
  for (let j = 0; j < P.si; j++) {
    const p = photoAt(P.ti, j), o = CUT.get(P.ti + ':' + j);
    print(c, { cx: B.cx + p.dx, cy: B.cy + p.dy, rot: p.rot, sc: 1, a: 1, w: B.w, h: B.h }, (c2, x, y, w, h) => { if (o?.ok) c2.drawImage(o.c, x, y, w, h); });
  }
  // the top print: the film at this moment, pushed in slowly while the pick is held
  const z = 1 + 0.035 * smooth(lt - seg.t0, 0, seg.d + 1.5);
  print(c, topPhoto(P), (c2, x, y, w, h) => {
    if (!live(v.then)) return;
    const at = cover(c2, v.then, x, y, w, h, z);
    if (lt > seg.t0 + 0.12) keepFrame(P.ti, P.si, v.then, w, h);
    if (tp.signal) alarm(c2, at, v.track?.then, v.then.currentTime, T, P.amt, h);
    grain(c2, x, y, w, h, T);
  });
  // you, now: one film for the whole topic
  c.save(); c.beginPath(); c.rect(...b); c.clip(); c.fillStyle = DARK; c.fillRect(...b);
  if (live(v.now)) { const at = cover(c, v.now, ...b, 1.0); if (tp.signal) alarm(c, at, v.track?.now, v.now.currentTime, T, 1, b[3]); grain(c, ...b, T); }
  c.restore();
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
    shown = P.ti; const tp = P.topic; preload(P.ti);
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
// a frozen frame (?t=, for stills) waits for its topic's films to reach the frame, up to 20 s
async function filmsAt(T) {
  const P = stateAt(T), v = film(P.ti), want = Math.max(0, P.lt);
  const ready = (e) => new Promise((res) => { const go = () => { e.currentTime = Math.min(want, (e.duration || want) - 0.05); e.addEventListener('seeked', () => res(), { once: true }); }; if (e.readyState >= 1) go(); else e.addEventListener('loadedmetadata', go, { once: true }); });
  await Promise.race([Promise.all([ready(v.then), ready(v.now)]), new Promise((r) => setTimeout(r, 20000))]);
  await Promise.race([fetch(new URL(`../clips/${TOPICS[P.ti].key}.json`, import.meta.url)).then((r) => r.json()).then((j) => { v.track = j; }).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}
Promise.race([fontsIn, new Promise((r) => setTimeout(r, 2500))]).then(async () => {
  resize();
  if (freeze !== null) { await filmsAt(freeze + offset); frame(freeze + offset); window.ready = true; } else { requestAnimationFrame(loop); window.ready = true; }
});
window.__film = film; window.__topics = TOPICS.map((t) => t.key); window.__dur = PLAN[0].T; window.__start = START;
