// Layout options for the then-and-now page as one phone-width strip. Every option uses the same topic, the same two
// pictures, the same sentences and the same picked ancestor; only the arrangement of the three parts changes:
// the line of 11,100 generations, the ancestors' picture, and yours. Static: one moment of each picture.
import { clamp, mix, hash, offscreen } from '../../v4/src/art.js';
import { drawFigure, POSES, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';
import { drawFrameScene, setFeeling } from './frame.js';
import { MOMENTS } from './moments.js';
import { createScene } from './scene.js';
import { registerTopics } from './topics.js';
import { TOPICS, SCALE_SRC } from './personal-copy.js';

registerTopics([...new Set(TOPICS.map((t) => t.eea))].filter((k) => !['lonely', 'missed', 'stress', 'light', 'compare', 'baby', 'old', 'food'].includes(k)).map((k) => ({ key: k, signal: true })));

const FW = 375, FOLD = 700, M = 16, CW = FW - 2 * M, N = 11100;
const G = 6667, T0 = 2.2; // the picked ancestor: 180,000 years ago
const DPR = Math.min(2, devicePixelRatio || 1);
const LIGHT = '#F1EEE8', DIM = 'rgba(241,238,232,0.6)', RED = '#E0201A', REDL = '#FF5A4E', GOLD = '#E2A93A', INK = '#1A0A0E', SOILC = '#1D1A17';
const CASE = 'rgba(22,18,16,0.8)';
const NARROW = '"PT Sans Narrow", "Arial Narrow", sans-serif', READ = '"Charis SIL", Charter, Georgia, serif';
const SKY = 'linear-gradient(180deg,#2F6766 0%,#8FB0A6 55%,#E6D3AE 100%)';
const SOIL = { top: ['#9C8A5E', '#463B2E'], farm: ['#857650', '#3B3127'], ind: ['#5E5856', '#2A2624'], deep: '#1D1A17', fade: '29,26,23', grass: '#463B2E' };
const YEARS = '180,000 years ago';

// who feels it in the ancestors' picture (as on the site)
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

// ---------- pictures ----------
// Render a picture at its own 16:9-ish shape, note where the gold rings landed, then crop it into a box.
function render(kind, tp, w, h) {
  let sw = w, sh = w / 1.78; if (sh < h) { sh = h; sw = h * 1.78; }
  sw = Math.round(sw); sh = Math.round(sh);
  const o = offscreen(sw, sh, DPR);
  globalThis.__sigLog = [];
  if (kind === 'e') { setFeeling(tp.signal ? FEELS[tp.key] || null : null); drawFrameScene(o.ctx, sw, sh, tp.eea, G, T0, 0.5, false, null); setFeeling(null); }
  else MOMENTS[tp.key](o.ctx, sw, sh, T0);
  const rings = globalThis.__sigLog.map((p) => ({ x: p.x / DPR, y: p.y / DPR, r: p.r / DPR })); globalThis.__sigLog = null;
  return { c: o.c, sw, sh, rings };
}
// draw a picture into (x, y, w, h) of ctx. tx/ty: where in the box the ringed person should land, if the crop allows.
function paint(ctx, kind, tp, x, y, w, h, o = {}) {
  const R = render(kind, tp, w, h), rg = R.rings[0] || null;
  const mx = R.rings.length ? R.rings.reduce((s, q) => s + q.x, 0) / R.rings.length : R.sw / 2;
  const my = R.rings.length ? R.rings.reduce((s, q) => s + q.y, 0) / R.rings.length : R.sh / 2;
  const ox = clamp(mx - (o.tx ?? w / 2), 0, R.sw - w), oy = clamp(my - (o.ty ?? h / 2), 0, R.sh - h);
  ctx.drawImage(R.c, ox * DPR, oy * DPR, w * DPR, h * DPR, x, y, w, h);
  return rg ? { x: x + rg.x - ox, y: y + rg.y - oy, r: rg.r } : null;
}

// ---------- the line ----------
const CAMF = { g: 0, a: 0.94, s: N / 0.9 };
function drawLine(ctx, tp, w, h, { ground = 0.62, cam = CAMF, lift = 1, focus = null } = {}) {
  const L = createScene({ ground, soil: SOIL }); L.resize(w, h, DPR);
  L.draw(ctx, cam, T0, { lift: { g: G, amt: lift, sig: 0 }, ripple: -1, focusAmt: focus ? 0.6 : 0, focus, you: 1, youPose: tp.youPose, youSig: tp.signal ? 1 : 0 });
  const fh = L.figH(), yG = L.L.yG;
  return { pick: { x: L.xOf(G), y: yG - fh * (0.52 + 1.25 * lift) }, you: { x: L.xOf(0), y: yG - fh * 0.52 }, r: fh * 0.95, fh, yG, xOf: L.xOf };
}

// tiny people standing along a path, oldest at pts[0]. side +1: heads to the right of the direction of travel.
function crowdPath(ctx, pts, tp, { h = 12, side = 1, col = (g) => mix(INK, '#4A4458', hash(g * 2.3) * 0.55), pickCol = LIGHT, minPitch = 2.6 } = {}) {
  const seg = []; let L = 0;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0); if (d < 1e-6) continue; seg.push({ x0, y0, dx: (x1 - x0) / d, dy: (y1 - y0) / d, s0: L, d }); L += d; }
  const at = (g) => {
    const s = (N - 1 - g) / (N - 1) * L; let k = seg.findIndex((q) => s <= q.s0 + q.d); if (k < 0) k = seg.length - 1;
    const q = seg[k], u = s - q.s0; return { x: q.x0 + q.dx * u, y: q.y0 + q.dy * u, nx: -q.dy * side, ny: q.dx * side };
  };
  const stand = (p, hh, opts, sig = 0) => {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.nx, -p.ny));
    drawFigure(ctx, 0, 0, hh, opts);
    if (sig) signal(ctx, 0, -hh * 0.95, hh * 0.45, T0, 1, GOLD);
    ctx.restore();
  };
  const pitch = L / N, m = Math.pow(2, Math.ceil(Math.log2(minPitch / pitch)));
  const pp = at(G);
  for (let g = Math.floor((N - 1) / m) * m; g >= 1; g -= m) {
    const p = at(g); if (Math.hypot(p.x - pp.x, p.y - pp.y) < h * 0.5) continue;
    stand(p, h * (0.86 + hash(g * 1.7) * 0.2), { pose: POSES.stand, body: body(g), color: col(g) });
  }
  // the picked one, raised off the path; you at the end
  const up = { x: pp.x + pp.nx * h * 0.7, y: pp.y + pp.ny * h * 0.7, nx: pp.nx, ny: pp.ny };
  stand(up, h * 1.25, { pose: POSES.stand, facing: 0, body: body(G), color: pickCol });
  const py = at(0);
  stand(py, h * 1.25, { pose: POSES[tp.youPose] || POSES.stand, body: body(0), color: RED, screen: '#CFE4FF' }, tp.signal ? 1 : 0);
  const head = (p, hh) => ({ x: p.x + p.nx * hh * 0.55, y: p.y + p.ny * hh * 0.55 });
  return { pick: head(up, h * 1.25), you: head(py, h * 1.25), r: h * 1.15, at };
}
// a simple person mark for very small crowds: head and body
function glyph(ctx, x, y, h, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y - h * 0.86, h * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x - h * 0.13, y - h * 0.7, h * 0.26, h * 0.7); }

// ---------- a frame: one phone screen (or a longer scroll) ----------
function frame(host, bg = SOILC) {
  const el = document.createElement('div'); el.className = 'frame'; el.style.background = bg; host.appendChild(el);
  const ops = [];
  const F = {
    el,
    box(x, y, w, h, css = '') { const d = document.createElement('div'); d.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;${css}`; el.appendChild(d); return d; },
    canvas(x, y, w, h, css = '') {
      const c = document.createElement('canvas'); c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
      c.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;${css}`; el.appendChild(c);
      const ctx = c.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); return { c, ctx };
    },
    // words. Returns the height they took.
    text(str, x, y, w, { size = 24, col = LIGHT, weight = 700, font = NARROW, lh = 1.06, align = 'left', fact = null, factSize = 0.66 } = {}) {
      const p = document.createElement('p');
      p.style.cssText = `position:absolute;margin:0;left:${x}px;top:${y}px;width:${w}px;font-family:${font};font-size:${size}px;font-weight:${weight};line-height:${lh};color:${col};text-align:${align};text-wrap:balance`;
      p.textContent = str;
      if (fact) { const s = document.createElement('span'); s.style.cssText = `display:block;font-weight:400;font-size:${factSize}em;line-height:1.15;margin-top:.3em`; s.textContent = fact; p.appendChild(s); }
      el.appendChild(p); F.last = p; return p.offsetHeight;
    },
    say(tp, which, x, y, w, o = {}) { return which === 'then' ? F.text(tp.then, x, y, w, o) : F.text(tp.now, x, y, w, { fact: tp.fact, ...o }); },
    src(tp, x, y, w, col = DIM) {
      const k = tp.signal ? `<span style="white-space:nowrap"><span style="display:inline-block;width:.75em;height:.75em;border:1.5px solid ${GOLD};border-radius:50%;vertical-align:-.08em;margin:0 .45em 0 .9em"></span>Gold rings: the alarm is on</span>` : '';
      const p = document.createElement('p');
      p.style.cssText = `position:absolute;margin:0;left:${x}px;top:${y}px;width:${w}px;font-family:${READ};font-size:11px;line-height:1.35;color:${col}`;
      p.innerHTML = `Sources: ${tp.src}. Time scale: ${SCALE_SRC}.${k}`; el.appendChild(p); return p.offsetHeight;
    },
    label(str, x, y, { size = 12, col = DIM, bold = false, align = 'left', valign = 'middle', font = NARROW, css = '' } = {}) {
      const d = document.createElement('div');
      const tx = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0', ty = valign === 'middle' ? '-50%' : valign === 'bottom' ? '-100%' : '0';
      d.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(${tx},${ty});white-space:nowrap;font-family:${font};font-size:${size}px;font-weight:${bold ? 700 : 400};color:${col};${css}`;
      d.textContent = str; el.appendChild(d); return d;
    },
    // a picture in a box: kind 'e' (ancestors) or 'm' (you). Returns the box and where the gold rings are.
    pic(kind, tp, x, y, w, h, { shape = 'rect', border = true, tx, ty } = {}) {
      const col = kind === 'e' ? LIGHT : RED;
      const { ctx } = F.canvas(x, y, w, h, (shape === 'circle' ? 'border-radius:50%;' : '') + (border ? `box-shadow:0 0 0 3px ${col};` : ''));
      const ring = paint(ctx, kind, tp, 0, 0, w, h, { tx, ty });
      return { x, y, w, h, ring: ring ? { x: x + ring.x, y: y + ring.y, r: ring.r } : null };
    },
    // the line across a box
    line(x, y, w, h, tp, o = {}) {
      const { ctx } = F.canvas(x, y, w, h); const L = drawLine(ctx, tp, w, h, o);
      return { ...L, pick: { x: x + L.pick.x, y: y + L.pick.y }, you: { x: x + L.you.x, y: y + L.you.y }, xOf: (g) => x + L.xOf(g), top: y, bottom: y + h };
    },
    // the line down a box TH wide and LEN long: oldest at the top, now at the bottom, heads to the right
    lineV(x, y, th, len, tp, o = {}) {
      const { ctx } = F.canvas(x, y, th, len); ctx.setTransform(0, DPR, -DPR, 0, DPR * th, 0);
      const L = drawLine(ctx, tp, len, th, { ground: 0.56, ...o });
      const to = (p) => ({ x: x + th - p.y, y: y + p.x });
      return { ...L, pick: to(L.pick), you: to(L.you), yOf: (g) => y + L.xOf(g) };
    },
    // overlay drawing, collected and written as one SVG on top
    lead(x0, y0, x1, y1, col = LIGHT, w = 3, dash = '') {
      const d = dash ? ` stroke-dasharray="${dash}"` : '';
      ops.push(`<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${CASE}" stroke-width="${w + 3}" stroke-linecap="round"${d}/>`,
        `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"${d}/>`);
    },
    path(d, col = LIGHT, w = 3, { fill = 'none', dash = '', casing = true, op = 1 } = {}) {
      const ds = dash ? ` stroke-dasharray="${dash}"` : '';
      if (casing) ops.push(`<path d="${d}" fill="none" stroke="${CASE}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"${ds} opacity="${op}"/>`);
      ops.push(`<path d="${d}" fill="${fill}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${ds} opacity="${op}"/>`);
    },
    ring(x, y, r, col = LIGHT, w = 3) {
      ops.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${CASE}" stroke-width="${w + 3}"/>`, `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}"/>`);
    },
    poly(pts, fill, stroke = 'none', sw = 1.5) { ops.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`); },
    raw(s) { ops.push(s); },
    // a ring round a point, and a line from (x0, y0) to the edge of that ring
    tie(x0, y0, p, r, col = LIGHT, w = 3, dash = '') { const e = toward(x0, y0, p.x, p.y, r); F.lead(x0, y0, e[0], e[1], col, w, dash); F.ring(p.x, p.y, r, col, w); },
    // ring to ring
    link(a, ra, b, rb, col = LIGHT, w = 3) { const e0 = toward(b.x, b.y, a.x, a.y, ra), e1 = toward(a.x, a.y, b.x, b.y, rb); F.lead(e0[0], e0[1], e1[0], e1[1], col, w); F.ring(a.x, a.y, ra, col, w); },
    // a map-inset funnel from a ringed point to the edge p1-p2 of a picture
    funnel(c, r, p1, p2, col) {
      const fill = col === RED ? 'rgba(224,32,26,0.22)' : 'rgba(241,238,232,0.16)';
      F.poly([[c.x - r, c.y], p1, p2, [c.x + r, c.y]], fill);
      F.lead(c.x - r, c.y, ...p1, col, 1.5); F.lead(c.x + r, c.y, ...p2, col, 1.5); F.ring(c.x, c.y, r, col);
    },
    done(h) {
      el.style.height = h + 'px';
      el.insertAdjacentHTML('beforeend', `<svg class="over" width="${FW}" height="${h}" viewBox="0 0 ${FW} ${h}">${ops.join('')}</svg>`);
      if (h > FOLD + 20) el.insertAdjacentHTML('beforeend', `<div class="fold" style="top:${FOLD}px"><span>end of the first screen</span></div>`);
    },
  };
  return F;
}
// the point at distance r from (x1, y1) on the way to (x0, y0)
function toward(x0, y0, x1, y1, r) { const d = Math.hypot(x1 - x0, y1 - y0) || 1; return [x1 - (x1 - x0) / d * r, y1 - (y1 - y0) / d * r]; }
const ringOr = (pic, fx, fy) => pic.ring || { x: fx, y: fy, r: 0 };

// ---------- the options ----------
const OPTS = [];
const opt = (name, idea, draw) => OPTS.push({ name, idea, draw });

opt('Inset zoom', 'The line sits between the pictures. Each picture opens out of its person like an inset on a map, so the eye follows the funnel.', (host, tp) => {
  const F = frame(host); let y = 18;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 190); y += 190 + 48;
  const L = F.line(0, y, FW, 100, tp); y += 100 + 44;
  const b = F.pic('m', tp, M, y, CW, 190); y += 190 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  F.funnel(L.pick, L.r, [a.x, a.y + a.h], [a.x + a.w, a.y + a.h], LIGHT);
  F.funnel(L.you, L.r, [b.x, b.y], [b.x + b.w, b.y], RED);
  F.done(y);
});

opt('Rails', 'The line across the top. The ancestor drops straight down into their picture; your line runs down its own rail on the right into yours.', (host, tp) => {
  const F = frame(host), PW = 318; const L = F.line(0, 0, FW, 110, tp); let y = 140;
  const a = F.pic('e', tp, M, y, PW, 180); y += 180 + 10;
  y += F.say(tp, 'then', M, y, PW) + 26;
  const b = F.pic('m', tp, M, y, PW, 180); y += 180 + 10;
  y += F.say(tp, 'now', M, y, PW) + 12; y += F.src(tp, M, y, PW) + 18;
  F.tie(L.pick.x, a.y, L.pick, L.r, LIGHT);
  F.path(`M${L.you.x} ${L.you.y + L.r} V${b.y + 16} H${b.x + b.w + 2}`, RED); F.ring(L.you.x, L.you.y, L.r, RED);
  F.done(y);
});

opt('Horizon', 'No frames. The ancestors’ world above, yours below, the line is the horizon between them. Each line ends on the person with the gold rings.', (host, tp) => {
  const F = frame(host);
  const a = F.pic('e', tp, 0, 0, FW, 290, { border: false, ty: 190 });
  const L = F.line(0, 290, FW, 110, tp);
  const b = F.pic('m', tp, 0, 400, FW, 300, { border: false, ty: 110 });
  F.box(0, 0, FW, 130, 'background:linear-gradient(rgba(29,26,23,.85),rgba(29,26,23,0))');
  F.box(0, 560, FW, 140, 'background:linear-gradient(rgba(29,26,23,0),rgba(29,26,23,.9))');
  F.say(tp, 'then', M, 16, CW);
  const hN = F.say(tp, 'now', M, 0, CW); F.last.style.top = (700 - hN - 16) + 'px';
  const ra = ringOr(a, L.pick.x, 250), rb = ringOr(b, L.you.x, 460);
  F.link(L.pick, L.r, ra, ra.r * 0.9, LIGHT); F.link(L.you, L.r, rb, rb.r * 0.9, RED);
  F.done(700);
});

opt('Swipe', 'The line stays put at the top. Below it, the two pictures are cards you swipe between, each with its own sentence. Your card peeks in from the right.', (host, tp) => {
  const F = frame(host), CWd = 300; const L = F.line(0, 0, FW, 110, tp); let y = 140;
  const a = F.pic('e', tp, M, y, CWd, 210); const b = F.pic('m', tp, M + CWd + 16, y, CWd, 210);
  const hA = F.say(tp, 'then', M, y + 222, CWd); F.say(tp, 'now', M + CWd + 16, y + 222, CWd);
  y += 222 + hA + 22;
  F.raw(`<circle cx="${FW / 2 - 8}" cy="${y}" r="4" fill="${LIGHT}"/><circle cx="${FW / 2 + 8}" cy="${y}" r="4" fill="none" stroke="${LIGHT}" stroke-width="1.5"/>`);
  y += 20; y += F.src(tp, M, y, CWd) + 18;
  F.tie(L.pick.x, a.y, L.pick, L.r, LIGHT); F.tie(L.you.x, b.y, L.you, L.r, RED, 3, '2 7');
  F.done(y);
});

opt('Loupes', 'The pictures are magnifying glasses held over the line. Each handle rests on the person it shows.', (host, tp) => {
  const F = frame(host), D = 220; let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 14;
  const a = F.pic('e', tp, 26, y, D, D, { shape: 'circle', border: false });
  const L = F.line(0, y + D + 46, FW, 100, tp);
  const b = F.pic('m', tp, FW - 26 - D, L.bottom + 46, D, D, { shape: 'circle', border: false });
  let y2 = b.y + D + 18; y2 += F.say(tp, 'now', M, y2, CW) + 12; y2 += F.src(tp, M, y2, CW) + 18;
  for (const [p, t, col] of [[a, L.pick, LIGHT], [b, L.you, RED]]) {
    const cx = p.x + D / 2, cy = p.y + D / 2, s = toward(t.x, t.y, cx, cy, D / 2 + 4), e = toward(cx, cy, t.x, t.y, L.r);
    F.lead(s[0], s[1], e[0], e[1], col, 9); F.ring(cx, cy, D / 2 + 3, col, 6); F.ring(t.x, t.y, L.r, col);
  }
  F.done(y2);
});

opt('Spine, level pointers', 'A fix of the current phone layout: the line runs down the left, and each picture sits level with its person, so both pointers are short and flat.', (host, tp) => {
  const F = frame(host, SKY), TH = 72, x0 = TH + 16, w = FW - x0 - 12, PH = 168;
  const L = F.lineV(0, 16, TH, 668, tp);
  F.label('300k', 6, L.yOf(N - 1), { size: 11, col: 'rgba(241,238,232,.8)' });
  F.label('Now', 6, L.you.y + 22, { size: 11, col: REDL, bold: true });
  const ay = clamp(L.pick.y - PH / 2, 110, 400), by = clamp(L.you.y - PH * 0.72, ay + PH + 100, 700 - PH - 8);
  const a = F.pic('e', tp, x0, ay, w, PH), b = F.pic('m', tp, x0, by, w, PH);
  const hT = F.say(tp, 'then', x0, 0, w, { size: 20, col: '#000' }); F.last.style.top = (ay - hT - 8) + 'px';
  const hN = F.say(tp, 'now', x0, 0, w, { size: 20, col: '#000' }); F.last.style.top = (by - hN - 8) + 'px';
  F.lead(L.pick.x + L.r, L.pick.y, x0 - 2, L.pick.y, LIGHT); F.ring(L.pick.x, L.pick.y, L.r, LIGHT);
  F.lead(L.you.x + L.r, L.you.y, x0 - 2, L.you.y, RED); F.ring(L.you.x, L.you.y, L.r, RED);
  F.done(700);
});

opt('Ruler, scroll is time', 'One long scroll. A ruler runs down the middle at true scale: the ancestors’ picture hangs at its date, then a long empty stretch, then farming in the last few centimetres, then you.', (host, tp) => {
  const F = frame(host), X = FW / 2, y0 = 70, y1 = 1440, Y = (yrs) => y1 - yrs / 300000 * (y1 - y0), yp = Y(180000);
  F.label('300,000 years ago', X, y0 - 22, { size: 15, col: LIGHT, bold: true, align: 'center' });
  const hT = F.say(tp, 'then', M, 0, CW, { align: 'center' }); const ty = yp - hT - 30; F.last.style.top = ty + 'px';
  const a = F.pic('e', tp, M, yp + 18, CW, 200);
  F.lead(X, y0, X, ty - 14, DIM, 2); F.lead(X, a.y + a.h + 14, X, y1, DIM, 2);
  for (let k = 50000; k < 300000; k += 50000) { const y = Y(k); if (y > ty - 20 && y < a.y + a.h + 20) continue; F.lead(X - 7, y, X + 7, y, DIM, 2); F.label(k.toLocaleString('en-US'), X + 14, y, { size: 12 }); }
  F.ring(X, yp, 7, LIGHT); F.label(YEARS, X + 16, yp, { size: 13, col: LIGHT, bold: true });
  const yf = Y(12000);
  F.path(`M${X + 12} ${yf} h8 V${y1} h-8`, GOLD, 1.5, { casing: false }); F.label('Farming: the last 12,000 years', X + 26, (yf + y1) / 2, { size: 12, col: GOLD });
  F.label('Factories and screens: the last 270 years', X - 12, y1 - 1, { size: 12, col: REDL, align: 'right' });
  F.ring(X, y1, 9, RED); F.label('Now', X + 16, y1 + 2, { size: 14, col: REDL, bold: true });
  let y = y1 + 34; y += F.say(tp, 'now', M, y, CW, { align: 'center' }) + 14;
  F.pic('m', tp, M, y, CW, 200); y += 200 + 14; y += F.src(tp, M, y, CW) + 18;
  F.done(y);
});

opt('The queue behind you', 'Everyone who came before you stands in one queue behind you, shrinking into the distance. The ancestors in the picture are a speck far back in it.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 180); y += 180 + 26;
  const QH = 330, { ctx } = F.canvas(0, y, FW, QH), Q = queue(ctx, FW, QH, tp, F, y);
  y += QH + 26;
  const b = F.pic('m', tp, M, y, CW, 180); y += 180 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  F.tie(clamp(Q.pick.x, a.x + 12, a.x + a.w - 12), a.y + a.h, Q.pick, 11, LIGHT);
  F.ring(Q.you.x, Q.you.y, Q.r, RED); F.lead(Q.you.x + Q.r, Q.you.y, FW - 6, Q.you.y, RED); F.path(`M${FW - 6} ${Q.you.y} V${b.y + 20} H${b.x + b.w + 2}`, RED);
  F.done(y);
});
function queue(ctx, w, h, tp, F, top) {
  const hz = 58, V = { x: 70, y: hz }, P0 = { x: 280, y: h - 18 }, H0 = 150;
  let g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#2F6766'); g.addColorStop(0.6, '#8FB0A6'); g.addColorStop(1, '#E6D3AE'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
  g = ctx.createLinearGradient(0, hz, 0, h); g.addColorStop(0, '#C2A876'); g.addColorStop(0.5, '#7A6646'); g.addColorStop(1, '#3B3127'); ctx.fillStyle = g; ctx.fillRect(0, hz, w, h - hz);
  ctx.fillStyle = 'rgba(236,224,196,0.22)'; ctx.beginPath(); ctx.moveTo(V.x - 2, V.y); ctx.lineTo(V.x + 2, V.y); ctx.lineTo(P0.x + 90, h); ctx.lineTo(P0.x - 90, h); ctx.fill();
  const z = (gg) => 1 + 0.5 * Math.sqrt(gg), at = (gg) => { const k = 1 / z(gg); return { x: V.x + (P0.x - V.x) * k, y: V.y + (P0.y - V.y) * k, s: H0 * k }; };
  let last = null; const pp = at(G);
  for (let gg = N - 1; gg >= 1; gg--) {
    const p = at(gg); if (last && Math.hypot(p.x - last.x, p.y - last.y) < Math.max(0.6, p.s * 0.2)) continue;
    if (Math.abs(p.x - pp.x) < 2.5 && Math.abs(gg - G) < 400) continue;
    const haze = clamp((z(gg) - 1.4) / 30); drawFigure(ctx, p.x, p.y, p.s * (0.9 + hash(gg) * 0.15), { pose: POSES.stand, facing: 0, body: body(gg), color: mix('#1A0A0E', '#B8AC94', haze * 0.75) }); last = p;
  }
  ctx.fillStyle = 'rgba(255,241,214,0.6)'; ctx.beginPath(); ctx.arc(pp.x, pp.y - pp.s * 1.6, pp.s * 1.6, 0, Math.PI * 2); ctx.fill();
  drawFigure(ctx, pp.x, pp.y - pp.s * 1.1, pp.s * 1.3, { pose: POSES.stand, facing: 0, body: body(G), color: INK });
  drawFigure(ctx, P0.x, P0.y, H0, { pose: POSES[tp.youPose] || POSES.stand, body: body(0), color: RED, farColor: '#A0140F', screen: '#CFE4FF' });
  if (tp.signal) signal(ctx, P0.x, P0.y - H0 * 0.97, H0 * 0.32, T0, 1, GOLD);
  { const p = at(370); F.label('10,000 years ago', p.x + p.s * 0.6 + 8, top + p.y - p.s * 0.5, { size: 11, col: 'rgba(29,26,23,.85)' }); }
  F.label('300,000 years ago', V.x + 14, top + V.y - 12, { size: 11, col: 'rgba(29,26,23,.85)' });
  return { pick: { x: pp.x, y: top + pp.y - pp.s * 1.9 }, you: { x: P0.x, y: top + P0.y - H0 * 0.97 }, r: H0 * 0.2 };
}

opt('One dot per generation', 'The line folded into a block: 11,100 dots, one per generation, read like text. The ancestors are one dot in the middle; you are the last dot.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 180); y += 180 + 34;
  const G2 = dots(F, M, y, CW, 111, 1.15, 1); y += G2.h + 8;
  y += F.text('Each dot is one generation, oldest first. Gold: since farming. Red: you.', M, y, CW, { size: 12, weight: 400, font: READ, col: DIM }) + 30;
  const b = F.pic('m', tp, M, y, CW, 180); y += 180 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  F.tie(clamp(G2.pick.x, a.x + 12, a.x + a.w - 12), a.y + a.h, G2.pick, 7, LIGHT);
  F.tie(G2.you.x, b.y, G2.you, 7, RED);
  F.done(y);
});
// 11,100 dots in rows of `cols`, oldest top left. Returns where the picked one and you are.
function dots(F, x, y, w, cols, rad, a = 1) {
  const p = w / cols, rows = Math.ceil(N / cols), h = rows * p, { ctx } = F.canvas(x, y, w, h);
  for (let i = 0; i < N; i++) {
    const g = N - 1 - i, cx = (i % cols + 0.5) * p, cy = (Math.floor(i / cols) + 0.5) * p;
    ctx.fillStyle = g === 0 ? RED : g === G ? LIGHT : g < 10 ? `rgba(154,166,184,${a})` : g < 426 ? `rgba(201,168,106,${a})` : `rgba(241,238,232,${0.42 * a})`;
    ctx.beginPath(); ctx.arc(cx, cy, g === 0 || g === G ? rad * 1.6 : rad, 0, Math.PI * 2); ctx.fill();
  }
  const pos = (g) => { const i = N - 1 - g; return { x: x + (i % cols + 0.5) * p, y: y + (Math.floor(i / cols) + 0.5) * p }; };
  return { h, pick: pos(G), you: pos(0) };
}

opt('Dots everywhere', 'The 11,100 dots are the background of the whole screen. Words and pictures float on top; two dots are lit, and they point to the pictures.', (host, tp) => {
  const F = frame(host), H = 752;
  const D = dots(F, 0, 0, FW, 75, 1.05, 0.55);
  let y = 22; y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 170);
  const hN = F.say(tp, 'now', M, 0, CW); const b = F.pic('m', tp, M, 470, CW, 190); F.last.style.top = (470 - hN - 12) + 'px';
  F.label('Each dot is one generation', M, 726, { size: 12, col: LIGHT, font: READ });
  F.tie(D.pick.x, a.y + a.h, D.pick, 8, LIGHT); F.tie(D.you.x - 2, b.y + b.h, D.you, 8, RED);
  F.done(H);
});

opt('Everyone, scrolled', 'You scroll past every generation as a tiny figure. The ancestors’ picture opens inside the crowd at their row; yours comes at the very end.', (host, tp) => {
  const F = frame(host), cols = 60, px = CW / cols, py = 7.5, hh = 6.4, iP = N - 1 - G, rP = Math.floor(iP / cols);
  let y = 16; y += F.say(tp, 'then', M, y, CW) + 14;
  F.label('One figure per generation', M, y + 6, { size: 12, col: DIM, font: READ }); y += 22;
  const crowd = (r0, r1, top) => {
    const { ctx } = F.canvas(M, top, CW, (r1 - r0 + 1) * py);
    for (let i = r0 * cols; i < Math.min(N, (r1 + 1) * cols); i++) {
      const g = N - 1 - i, x = (i % cols + 0.5) * px, yy = (Math.floor(i / cols) - r0 + 1) * py - 0.5;
      glyph(ctx, x, yy, g === G || g === 0 ? hh * 1.25 : hh, g === 0 ? RED : g === G ? '#FFFFFF' : g < 426 ? '#C9A86A' : 'rgba(241,238,232,.55)');
    }
    return (r1 - r0 + 1) * py;
  };
  const top1 = y; y += crowd(0, rP, y) + 26;
  const pP = { x: M + (iP % cols + 0.5) * px, y: top1 + rP * py + 3 };
  const a = F.pic('e', tp, M, y, CW, 190); y += 190 + 26;
  y += crowd(rP + 1, Math.ceil(N / cols) - 1, y) + 30;
  const pY = { x: M + ((N - 1) % cols + 0.5) * px, y: y - 30 - 3 };
  y += F.say(tp, 'now', M, y, CW - 34) + 12;
  const b = F.pic('m', tp, M, y, CW, 190); y += 190 + 14; y += F.src(tp, M, y, CW) + 18;
  F.tie(pP.x, a.y, pP, 7, LIGHT); F.tie(pY.x, b.y, pY, 7, RED);
  F.done(y);
});

opt('Scrubber', 'Video grammar. Your moment fills the screen like a paused video; the line is the progress bar, and the ancestors’ picture is the preview that pops up when you touch it.', (host, tp) => {
  const F = frame(host);
  const b = F.pic('m', tp, 0, 0, FW, 380, { border: false });
  F.box(0, 0, FW, 150, 'background:linear-gradient(rgba(29,26,23,.85),rgba(29,26,23,0))');
  F.say(tp, 'now', M, 16, CW);
  let y = 396; y += F.say(tp, 'then', M, y, CW, { size: 20 }) + 12;
  const ty = 668, { ctx } = F.canvas(0, ty - 22, FW, 34);
  const C = crowdPath(ctx, [[24, 26], [351, 26]], tp, { h: 13, side: -1, col: (g) => mix('#D9CFBC', '#8C826F', hash(g * 2.3)) });
  const pk = { x: C.pick.x, y: ty - 22 + C.pick.y }, yu = { x: C.you.x, y: ty - 22 + C.you.y };
  const TW = 230, TH = 130, tx = clamp(pk.x - TW / 2, M, FW - M - TW);
  const a = F.pic('e', tp, tx, y, TW, TH);
  F.label(YEARS, tx + 6, y + TH - 6, { size: 12, col: LIGHT, bold: true, valign: 'bottom', css: 'background:rgba(20,17,15,.8);padding:1px 6px;border-radius:3px' });
  F.raw(`<path d="M${pk.x - 7} ${a.y + TH + 18} L${pk.x} ${a.y + TH + 25} L${pk.x + 7} ${a.y + TH + 18}" fill="${LIGHT}"/>`);
  F.lead(pk.x, a.y + TH + 26, pk.x, pk.y - 9, LIGHT, 2); F.ring(pk.x, pk.y, 9, LIGHT, 2.5);
  F.ring(yu.x, yu.y, 10, RED, 3);
  F.label('300,000 years ago', 24, ty + 22, { size: 11 }); F.label('Now', 351, ty + 22, { size: 11, col: REDL, bold: true, align: 'right' });
  F.done(700);
});

opt('Diagonal', 'One screen cut in two along the line, oldest at top left, now at bottom right. The ancestors’ world above the cut, yours below.', (host, tp) => {
  const F = frame(host), H = 700, { ctx } = F.canvas(0, 0, FW, H);
  const P0 = [0, 292], P1 = [FW, 466], ang = Math.atan2(P1[1] - P0[1], P1[0] - P0[0]), co = Math.cos(ang), si = Math.sin(ang), TH = 96, half = TH / 2 / co;
  const up = (x) => P0[1] + (x / FW) * (P1[1] - P0[1]) - half, dn = (x) => up(x) + 2 * half;
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(FW, 0); ctx.lineTo(FW, up(FW)); ctx.lineTo(0, up(0)); ctx.clip();
  const ra = paint(ctx, 'e', tp, 0, 0, FW, up(FW), { tx: 270 }); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, dn(0)); ctx.lineTo(FW, dn(FW)); ctx.lineTo(FW, H); ctx.lineTo(0, H); ctx.clip();
  const rb = paint(ctx, 'm', tp, 0, dn(0) - 10, FW, H - dn(0) + 10, { tx: 110 }); ctx.restore();
  const LEN = Math.hypot(FW, P1[1] - P0[1]) + 120, O = [P0[0] - co * 60 + si * TH / 2, P0[1] - si * 60 - co * TH / 2];
  ctx.save(); ctx.setTransform(DPR * co, DPR * si, -DPR * si, DPR * co, DPR * O[0], DPR * O[1]); ctx.beginPath(); ctx.rect(0, 0, LEN, TH); ctx.clip();
  const L = drawLine(ctx, tp, LEN, TH, { ground: 0.62, cam: { g: 0, a: (LEN - 72) / LEN, s: N / ((LEN - 130) / LEN) } }); ctx.restore();
  const map = (p) => ({ x: O[0] + p.x * co - p.y * si, y: O[1] + p.x * si + p.y * co });
  F.box(0, 0, FW, 120, 'background:linear-gradient(rgba(29,26,23,.85),rgba(29,26,23,0))');
  F.box(0, 570, FW, 130, 'background:linear-gradient(rgba(29,26,23,0),rgba(29,26,23,.9))');
  F.say(tp, 'then', M, 16, CW * 0.8);
  const hN = F.say(tp, 'now', M, 0, CW); F.last.style.top = (H - hN - 16) + 'px';
  const pk = map(L.pick), yu = map(L.you);
  if (ra) F.link(pk, L.r, ra, ra.r * 0.9, LIGHT); else F.ring(pk.x, pk.y, L.r, LIGHT);
  if (rb) F.link(yu, L.r, rb, rb.r * 0.9, RED); else F.ring(yu.x, yu.y, L.r, RED);
  F.done(H);
});

opt('Hung from the line', 'Each picture hangs on a string from its person, with its sentence printed on the card. The string is the pointer, so it can never be unclear.', (host, tp) => {
  const F = frame(host), CWd = 262; const L = F.line(0, 0, FW, 110, tp); let y = 146;
  const xa = clamp(L.pick.x - CWd / 2, M, FW - M - CWd - 30);
  const ca = F.box(xa - 10, y - 10, CWd + 20, 0, `background:${LIGHT}`);
  const a = F.pic('e', tp, xa, y, CWd, 150, { border: false });
  const hA = F.say(tp, 'then', xa, y + 160, CWd, { size: 20, col: '#000' }); ca.style.height = (150 + 10 + hA + 22) + 'px';
  y += 150 + hA + 52;
  const xb = FW - M - CWd + 6;
  const cb = F.box(xb - 10, y - 10, CWd + 20, 0, `background:#2A2228;box-shadow:inset 0 0 0 3px ${RED}`);
  const b = F.pic('m', tp, xb, y, CWd, 150, { border: false });
  const hB = F.say(tp, 'now', xb, y + 160, CWd, { size: 20 }); cb.style.height = (150 + 10 + hB + 22) + 'px';
  y += 150 + hB + 34; y += F.src(tp, M, y, CW) + 18;
  F.tie(L.pick.x, ca.offsetTop, L.pick, L.r, LIGHT, 2); F.raw(`<rect x="${L.pick.x - 5}" y="${ca.offsetTop - 6}" width="10" height="12" fill="${LIGHT}" stroke="${CASE}" stroke-width="1.5"/>`);
  F.tie(L.you.x, cb.offsetTop, L.you, L.r, RED, 2); F.raw(`<rect x="${L.you.x - 5}" y="${cb.offsetTop - 6}" width="10" height="12" fill="${RED}" stroke="${CASE}" stroke-width="1.5"/>`);
  F.done(y);
});

opt('Time is depth', 'A cut through the ground. You live on the surface; the ancestors’ world is a dig far down, at the depth of its date. Farming is the top sliver of soil.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'now', M, y, CW) + 12;
  F.pic('m', tp, M, y, CW, 180, { border: false }); y += 180;
  const S = y, D = 640, { ctx } = F.canvas(0, S, FW, D);
  for (let i = 0; i < D; i++) { const v = hash(Math.floor(i / 3) * 0.37) * 0.5 + 0.25 * Math.sin(i * 0.11); ctx.fillStyle = mix('#241D18', '#4A3B2E', clamp(v)); ctx.fillRect(0, i, FW, 1); }
  const dF = 426 / N * D; ctx.fillStyle = 'rgba(201,168,106,.55)'; ctx.fillRect(0, 0, FW, dF); ctx.fillStyle = '#9AA6B8'; ctx.fillRect(0, 0, FW, 1.5);
  F.lead(0, S, FW, S, RED, 2);
  F.label('Now', FW - M, S + 10, { size: 12, col: REDL, bold: true, align: 'right' });
  F.label('Farming', FW - M, S + dF + 10, { size: 12, col: GOLD, align: 'right' });
  const yp = S + 180000 / 300000 * (D - 10), PH = 170;
  const hT = F.say(tp, 'then', M + 14, 0, CW - 28, { size: 21 }); const tTop = yp - PH / 2 - hT - 12; F.last.style.top = tTop + 'px';
  for (const k of [100000, 200000, 300000]) { const yy = S + k / 300000 * (D - 10); if (yy > tTop - 14 && yy < yp + PH / 2 + 26) continue; F.lead(0, yy, 10, yy, DIM, 1.5); F.label(k.toLocaleString('en-US') + ' years ago', 14, yy, { size: 11 }); }
  const a = F.pic('e', tp, M + 14, yp - PH / 2, CW - 28, PH);
  F.lead(0, yp, M + 12, yp, LIGHT, 2); F.label(YEARS, M + 18, yp + PH / 2 + 14, { size: 12, col: LIGHT, bold: true });
  y = S + D + 14; y += F.src(tp, M, y, CW) + 18;
  F.done(y);
});

opt('Ring of everyone', 'The 11,100 generations stand in one circle, as if round a fire. The sentence sits inside it. The ring closes on you.', (host, tp) => {
  const F = frame(host), R = 138; let y = 16;
  const a = F.pic('e', tp, M, y, CW, 180); y += 180 + 34;
  const cy = y + R + 16, cx = FW / 2, y0 = y - 10, { ctx } = F.canvas(0, y0, FW, 2 * R + 52);
  const pts = []; for (let k = 0; k <= 400; k++) { const t = (95 + k / 400 * 350) * Math.PI / 180; pts.push([cx + R * Math.cos(t), (cy - y + 10) + R * Math.sin(t)]); }
  const C = crowdPath(ctx, pts, tp, { h: 16, side: -1, col: (g) => mix('#D9CFBC', '#8C826F', hash(g * 2.3)) });
  const off = (p) => ({ x: p.x, y: p.y + y0 });
  const hT = F.say(tp, 'then', cx - R * 0.72, 0, R * 1.44, { size: 21, align: 'center' }); F.last.style.top = (cy - hT / 2) + 'px';
  y = cy + R + 40;
  const b = F.pic('m', tp, M, y, CW, 180); y += 180 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  const pk = off(C.pick), yu = off(C.you);
  F.tie(clamp(pk.x, a.x + 12, a.x + a.w - 12), a.y + a.h, pk, 12, LIGHT); F.tie(yu.x, b.y, yu, 12, RED);
  F.done(y);
});

opt('Thin line, big pictures', 'The plainest version: big pictures, a slim line between them, two short straight pointers.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 228); y += 228 + 14;
  const L = F.line(0, y, FW, 70, tp, { ground: 0.74, lift: 0.55 }); y += 70 + 14;
  const b = F.pic('m', tp, M, y, CW, 228); y += 228 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  const r = L.r * 0.7;
  F.tie(L.pick.x, a.y + a.h, L.pick, r, LIGHT); F.tie(clamp(L.you.x, b.x + 12, b.x + b.w - 12), b.y, L.you, r, RED);
  F.done(y);
});

opt('Bar and sliver', 'The line as a plain bar of 300,000 years. Its last sliver is blown up underneath, so you can see the farming and factory years, and you at the very end.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 190); y += 190 + 40;
  const bx = M, bw = CW, x = (yrs, span = 300000) => bx + bw * (1 - yrs / span);
  F.raw(`<rect x="${bx}" y="${y}" width="${bw}" height="16" fill="#8A7A62"/><rect x="${x(12000)}" y="${y}" width="${bx + bw - x(12000)}" height="16" fill="#C9A86A"/>`);
  const pk = { x: x(180000), y: y + 8 };
  F.label('300,000 years ago', bx, y + 28, { size: 11 }); F.label('Now', bx + bw, y + 28, { size: 11, col: REDL, bold: true, align: 'right' });
  const y2 = y + 92, z0 = x(3000);
  F.poly([[z0, y + 16], [bx + bw, y + 16], [bx + bw, y2], [bx, y2]], 'rgba(241,238,232,.12)');
  F.lead(z0, y + 16, bx, y2, LIGHT, 1); F.lead(bx + bw, y + 16, bx + bw, y2, LIGHT, 1);
  F.raw(`<rect x="${bx}" y="${y2}" width="${bw}" height="16" fill="#C9A86A"/><rect x="${x(270, 3000)}" y="${y2}" width="${bx + bw - x(270, 3000)}" height="16" fill="#9AA6B8"/>`);
  F.label('3,000 years ago', bx, y2 + 28, { size: 11 }); F.label('Factories and screens', x(270, 3000) - 4, y2 + 28, { size: 11, align: 'right' });
  const yu = { x: bx + bw - 3, y: y2 + 8 };
  y = y2 + 66;
  const b = F.pic('m', tp, M, y, CW, 190); y += 190 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  F.tie(pk.x, a.y + a.h, pk, 11, LIGHT); F.tie(yu.x, b.y, yu, 11, RED);
  F.done(y);
});

opt('Three taps', 'One thing at a time. Tap 1: the ancestors and their sentence. Tap 2: the whole line, the ring travelling to the end. Tap 3: you.', (host, tp) => {
  const F = frame(host), k = 0.305, mw = FW * k, gap = (FW - 3 * mw) / 2;
  const screens = [
    (S) => { let y = 24; y += S.say(tp, 'then', M, y, CW, { size: 30 }) + 18; const a = S.pic('e', tp, M, y, CW, 280); const L = S.line(0, 560, FW, 120, tp); S.tie(L.pick.x, a.y + a.h, L.pick, L.r, LIGHT); S.done(700); },
    (S) => { const L = S.line(0, 230, FW, 180, tp, { ground: 0.66 }); S.ring(L.pick.x, L.pick.y, L.r, LIGHT); S.ring(L.you.x, L.you.y, L.r, RED);
      S.path(`M${L.pick.x} ${L.pick.y - L.r - 8} Q ${(L.pick.x + L.you.x) / 2} 120 ${L.you.x} ${L.you.y - L.r - 8}`, GOLD, 3, { dash: '3 9' });
      S.label('300,000 years ago', M, 450, { size: 22, col: LIGHT }); S.label('Now', FW - M, 450, { size: 22, col: REDL, bold: true, align: 'right' }); S.done(700); },
    (S) => { const L = S.line(0, 20, FW, 120, tp); let y = 170; y += S.say(tp, 'now', M, y, CW, { size: 30 }) + 18; const b = S.pic('m', tp, M, y, CW, 280); S.tie(clamp(L.you.x, b.x + 12, b.x + b.w - 12), b.y, L.you, L.r, RED); S.done(700); },
  ];
  screens.forEach((draw, i) => {
    const holder = F.box(i * (mw + gap), 10, FW, 700, `transform:scale(${k});transform-origin:0 0;border-radius:${10 / k}px;overflow:hidden`);
    draw(frame(holder)); F.label(['1', '2', '3'][i], i * (mw + gap) + mw / 2, 700 * k + 30, { size: 16, col: LIGHT, bold: true, align: 'center' });
  });
  F.done(700 * k + 54);
});

opt('Twin squares', 'The desktop idea squeezed into the strip: two square pictures side by side, the line underneath, a straight drop from each.', (host, tp) => {
  const F = frame(host), S = 168, xa = M, xb = FW - M - S; let y = 16;
  const h1 = F.say(tp, 'then', xa, y, S, { size: 18 }), h2 = F.say(tp, 'now', xb, y, S, { size: 18 }); y += Math.max(h1, h2) + 12;
  const a = F.pic('e', tp, xa, y, S, S), b = F.pic('m', tp, xb, y, S, S); y += S + 34;
  const L = F.line(0, y, FW, 104, tp); y += 104 + 14; y += F.src(tp, M, y, CW) + 18;
  F.tie(clamp(L.pick.x, a.x + 12, a.x + S - 12), a.y + S, L.pick, L.r, LIGHT); F.tie(clamp(L.you.x, b.x + 12, b.x + S - 12), b.y + S, L.you, L.r, RED);
  F.done(y);
});

opt('One alarm, two ends', 'You first. A gold thread runs from your alarm, back along the whole line, into the ancestor who felt the same thing.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'now', M, y, CW) + 12;
  const b = F.pic('m', tp, M, y, CW, 210); y += 210 + 24;
  const L = F.line(0, y, FW, 104, tp); y += 104 + 24;
  const a = F.pic('e', tp, M, y, CW, 210); y += 210 + 12;
  y += F.say(tp, 'then', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  const rb = ringOr(b, L.you.x, b.y + b.h - 20), ra = ringOr(a, L.pick.x, a.y + 30), top = L.top + 10;
  F.path(`M${rb.x} ${rb.y + rb.r * 0.5} V${b.y + b.h + 12} H${L.you.x} V${top} H${L.pick.x} V${L.pick.y - L.r} M${L.pick.x} ${L.pick.y + L.r} V${a.y - 12} H${ra.x} V${ra.y - ra.r * 0.5}`, GOLD, 2.5);
  F.ring(L.pick.x, L.pick.y, L.r, GOLD, 2.5);
  F.done(y);
});

opt('Framed by everyone', 'The line runs round the edge of the screen, up the left, across the top and down the right, ending with you in the bottom corner.', (host, tp) => {
  const F = frame(host), H = 700, B = 24, { ctx } = F.canvas(0, 0, FW, H);
  ctx.fillStyle = '#E6D3AE'; ctx.fillRect(0, 0, FW, B); ctx.fillRect(0, 0, B, H); ctx.fillRect(FW - B, 0, B, H);
  const C = crowdPath(ctx, [[3, H - 6], [3, 3], [FW - 3, 3], [FW - 3, H - 30]], tp, { h: 17 });
  const x0 = B + 12, w = FW - 2 * x0; let y = B + 16;
  y += F.say(tp, 'then', x0, y, w, { size: 22 }) + 10;
  const a = F.pic('e', tp, x0, y, w, 170); y += 170 + 22;
  y += F.say(tp, 'now', x0, y, w, { size: 22 }) + 10;
  const b = F.pic('m', tp, x0, y, w, 170); y += 170 + 10;
  F.src(tp, x0, y, w);
  const ra = ringOr(a, a.x + 30, a.y + 30); F.link(C.pick, 13, ra, ra.r * 0.9, LIGHT);
  F.tie(b.x + b.w, clamp(C.you.y, b.y + 12, b.y + b.h - 12), C.you, 13, RED);
  F.done(H);
});

opt('Matching marks', 'No pointer lines at all. The line carries two numbered marks, and the same numbers sit on the pictures.', (host, tp) => {
  const F = frame(host); const L = F.line(0, 0, FW, 116, tp); let y = 140;
  const badge = (x, y2, n, col, ink) => F.raw(`<circle cx="${x}" cy="${y2}" r="14" fill="${col}" stroke="${CASE}" stroke-width="2"/><text x="${x}" y="${y2 + 5.5}" text-anchor="middle" font-family='${NARROW}' font-weight="700" font-size="16" fill="${ink}">${n}</text>`);
  F.ring(L.pick.x, L.pick.y, L.r, LIGHT, 2); F.ring(L.you.x, L.you.y, L.r, RED, 2);
  badge(L.pick.x + L.r * 0.75, L.pick.y - L.r * 0.75, 1, LIGHT, '#000'); badge(L.you.x - L.r * 0.75, L.you.y - L.r * 0.75, 2, RED, '#fff');
  y += F.say(tp, 'then', M + 36, y, CW - 36) + 12; badge(M + 14, 156, 1, LIGHT, '#000');
  F.pic('e', tp, M, y, CW, 190); y += 190 + 28;
  const yb = y; y += F.say(tp, 'now', M + 36, y, CW - 36) + 12; badge(M + 14, yb + 16, 2, RED, '#fff');
  F.pic('m', tp, M, y, CW, 190); y += 190 + 14; y += F.src(tp, M, y, CW) + 18;
  F.done(y);
});

opt('Zoom steps', 'Two steps of zoom. From the whole line, into a stretch where you can see single people walking, into the picture. Then down from the end of the line to you.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 12;
  const a = F.pic('e', tp, M, y, CW, 190); y += 190 + 40;
  const Bz = F.line(0, y, FW, 130, tp, { ground: 0.8, lift: 0, cam: { g: G, a: 0.5, s: 34 }, focus: { g: G, amt: 1, sig: tp.signal ? 1 : 0 } });
  const zp = { x: FW / 2, y: Bz.top + 0.8 * 130 - Bz.fh * 0.55 }; y += 130 + 48;
  const L = F.line(0, y, FW, 100, tp, { lift: 0 }); y += 100 + 44;
  const b = F.pic('m', tp, M, y, CW, 190); y += 190 + 14;
  y += F.say(tp, 'now', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  F.funnel({ x: zp.x, y: zp.y }, Bz.fh * 0.7, [a.x, a.y + a.h], [a.x + a.w, a.y + a.h], LIGHT);
  const wx = L.xOf(G), wy = L.yG + L.top - L.fh * 1.1;
  F.poly([[wx - 4, wy], [0, Bz.bottom], [FW, Bz.bottom], [wx + 4, wy]], 'rgba(241,238,232,.14)'); F.lead(wx - 4, wy, 0, Bz.bottom, LIGHT, 1.5); F.lead(wx + 4, wy, FW, Bz.bottom, LIGHT, 1.5);
  F.raw(`<rect x="${wx - 4}" y="${wy}" width="8" height="${L.fh * 1.2}" fill="none" stroke="${LIGHT}" stroke-width="2"/>`);
  F.funnel(L.you, L.r, [b.x, b.y], [b.x + b.w, b.y], RED);
  F.done(y);
});

opt('Window in the room', 'One picture: your room, with the ancestors’ world showing through a window in it. The line underneath is the floor both stand on.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'now', M, y, CW) + 12;
  const PH = 330, { ctx } = F.canvas(M, y, CW, PH, `box-shadow:0 0 0 3px ${RED}`);
  const rm = paint(ctx, 'm', tp, 0, 0, CW, PH, { tx: CW * 0.7 });
  const iw = 156, ih = 104, ix = 14, iy = 18;
  ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip(); const re = paint(ctx, 'e', tp, ix, iy, iw, ih); ctx.restore();
  ctx.strokeStyle = LIGHT; ctx.lineWidth = 4; ctx.strokeRect(ix - 2, iy - 2, iw + 4, ih + 4);
  const top = y; y += PH + 3;
  const L = F.line(0, y, FW, 100, tp); y += 100 + 14;
  y += F.say(tp, 'then', M, y, CW) + 12; y += F.src(tp, M, y, CW) + 18;
  const ra = re ? { x: M + re.x, y: top + re.y } : { x: M + ix + iw / 2, y: top + iy + ih / 2 };
  F.link(L.pick, L.r, ra, (re ? re.r : 0) * 0.9, LIGHT);
  if (rm) F.link(L.you, L.r, { x: M + rm.x, y: top + rm.y }, rm.r * 0.9, RED); else F.ring(L.you.x, L.you.y, L.r, RED);
  F.done(y);
});

opt('Slider', 'One picture split in two, then on the left and now on the right, with a handle you drag. Each half is tied to its person on the line underneath.', (host, tp) => {
  const F = frame(host); let y = 16;
  y += F.say(tp, 'then', M, y, CW) + 8;
  y += F.say(tp, 'now', M, y, CW, { col: REDL }) + 14;
  const PH = 360, sx = CW * 0.5, { ctx } = F.canvas(M, y, CW, PH);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, sx, PH); ctx.clip(); const re = paint(ctx, 'e', tp, 0, 0, CW, PH, { tx: sx * 0.5 }); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, CW - sx, PH); ctx.clip(); const rm = paint(ctx, 'm', tp, 0, 0, CW, PH, { tx: sx + (CW - sx) * 0.5 }); ctx.restore();
  const top = y; y += PH + 12;
  F.lead(M + sx, top, M + sx, top + PH, LIGHT, 3);
  F.raw(`<circle cx="${M + sx}" cy="${top + PH / 2}" r="17" fill="${LIGHT}" stroke="${CASE}" stroke-width="2"/><path d="M${M + sx - 4} ${top + PH / 2 - 6} l-6 6 l6 6 M${M + sx + 4} ${top + PH / 2 - 6} l6 6 l-6 6" stroke="#000" stroke-width="2.2" fill="none"/>`);
  const L = F.line(0, y, FW, 100, tp); y += 100 + 14; y += F.src(tp, M, y, CW) + 18;
  if (re && re.x < sx) F.link(L.pick, L.r, { x: M + re.x, y: top + re.y }, re.r * 0.9, LIGHT); else F.tie(M + sx * 0.5, top + PH, L.pick, L.r, LIGHT);
  if (rm && rm.x > sx) F.link(L.you, L.r, { x: M + rm.x, y: top + rm.y }, rm.r * 0.9, RED); else F.tie(L.you.x, top + PH, L.you, L.r, RED);
  F.done(y);
});

// ---------- the sheet ----------
const $ = (id) => document.getElementById(id);
let cur = TOPICS.findIndex((t) => '#' + t.key === location.hash); if (cur < 0) cur = TOPICS.findIndex((t) => t.key === 'newparent');
const bar = $('topics');
TOPICS.forEach((tp, i) => { const b = document.createElement('button'); b.textContent = tp.title; b.onclick = () => { cur = i; history.replaceState(null, '', '#' + tp.key); build(); }; bar.appendChild(b); });
let job = 0;
async function build() {
  const me = ++job, tp = TOPICS[cur], grid = $('grid');
  [...bar.children].forEach((b, i) => b.classList.toggle('on', i === cur));
  grid.innerHTML = '';
  for (let i = 0; i < OPTS.length; i++) {
    if (me !== job) return;
    const o = OPTS[i], card = document.createElement('section'); card.className = 'opt';
    card.innerHTML = `<h2><span>${String(i + 1).padStart(2, '0')}</span>${o.name}</h2><p>${o.idea}</p><div class="fit"></div>`;
    grid.appendChild(card);
    try { o.draw(card.querySelector('.fit'), tp); } catch (e) { console.error(o.name, e); card.querySelector('.fit').textContent = 'error: ' + e.message; }
    await new Promise((r) => setTimeout(r, 0));
  }
  fit(); window.ready = true;
}
// frames are 375 wide; on a narrower screen scale them down to fit
function fit() { const k = Math.min(1, (innerWidth - 32) / FW); document.querySelectorAll('.fit').forEach((f) => { f.style.zoom = k < 1 ? k : ''; }); }
addEventListener('resize', fit);
const fontsIn = Promise.allSettled(['400 14px "PT Sans Narrow"', '700 14px "PT Sans Narrow"', '400 14px "Charis SIL"'].map((f) => document.fonts.load(f)));
Promise.race([fontsIn, new Promise((r) => setTimeout(r, 2500))]).then(build);
