// Drawing the line of generations: sky, land by era, ground, and the people, for any camera.
import { TAU, clamp, lerp, smooth, easeInOut, mix, alpha, hash, fbm, sky, glow, sun, streak, ridge, mountains, acacia, bush, poplar, grass, bird, offscreen, cloudSprite, setup } from '../../v4/src/art.js';
import { drawFigure, walkPose, POSES, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';

const TOTAL = 11100, YEARS = 27, FARM = 426, IND = 10, MOD = 4;
const PAL = {
  // Demismatch house colours: teal sky into parchment, oxblood ground, gold signal
  skyTop: '#2F6766', skyMid: '#8FB0A6', skyLow: '#E6D3AE',
  far: '#86908A', mid: '#5C4C54', ink: '#1A0A0E', you: '#E0201A', sig: '#E2A93A',
};

// ---------- labels ----------
export function genLabel(g, who) {
  if (g === 0) return 'Generation 11,100 · You';
  const n = (TOTAL - g).toLocaleString('en-US');
  const y = g * YEARS;
  if (who) return `Generation ${n} · ${who}`;
  if (y < 400) return `Generation ${n} · around ${2026 - y}`;
  const r = y >= 10000 ? Math.round(y / 1000) * 1000 : Math.round(y / 100) * 100;
  return `Generation ${n} · about ${r.toLocaleString('en-US')} years ago`;
}

// A renderer for the line at any size and camera. The page uses two: the whole line, and the close-up inside the loupe.
// soil: the ground's colours under the line. The default is the house oxblood; a page can pass plain earth instead.
const OXBLOOD = { top: ['#B39558', '#5A2A32'], farm: ['#8C7A4C', '#4A1E26'], ind: ['#5E5458', '#2E1A1E'], deep: '#2A0C11', fade: '42,12,17', grass: '#5A2A32' };
export function createScene({ ground: gFrac = 0.74, soil: SOIL = OXBLOOD } = {}) {
  let W = 0, H = 0, dpr = 1, L = null, back = null, clouds = [];

  function layout(w, h) {
    const mobile = w < 700;
    return { mobile, yG: h * gFrac };
  }

  // ---------- backdrops, painted once per size ----------
  const tone = (d) => mix(PAL.mid, '#F2E8CF', lerp(0.5, 0.18, d));
  function farLayers(c, seed) {
    ridge(c, 0, W, L.yG, mountains(seed, W * 0.2, H * 0.16, 1.5), mix(PAL.far, '#F2E8CF', 0.5));
    ridge(c, 0, W, L.yG, mountains(seed + 5, W * 0.11, H * 0.075, 1.3), mix(PAL.mid, '#F2E8CF', 0.42));
  }
  function paintWild() {
    const o = offscreen(W, H, dpr), c = o.ctx, yG = L.yG;
    farLayers(c, 3);
    ridge(c, 0, W, yG, (x) => H * 0.018 * fbm(x / (W * 0.06), 9, 3), tone(0.55));
    for (let i = 0; i < 26; i++) {
      const x = hash(i * 3.1) * W, d = hash(i * 7.7), s = lerp(H * 0.028, H * 0.075, d * d);
      if (hash(i * 1.3) < 0.7) acacia(c, x, yG + 1, s, tone(d), i); else bush(c, x, yG + 1, s * 0.32, tone(d), i);
    }
    for (const [u, k] of [[0.1, 0.19], [0.42, 0.15], [0.83, 0.21]]) acacia(c, W * u, yG + 2, Math.min(H, W * 0.9) * k, mix(PAL.mid, '#F2E8CF', 0.08), Math.round(u * 100));
    return o.c;
  }
  function paintFarm() {
    const o = offscreen(W, H, dpr), c = o.ctx, yG = L.yG;
    farLayers(c, 3);
    ridge(c, 0, W, yG, (x) => H * 0.022 * fbm(x / (W * 0.1), 21, 3), tone(0.45));
    for (let i = 0; i < 14; i++) {
      const hx = hash(i * 5.3) * W, d = hash(i * 2.9), s = H * lerp(0.012, 0.03, d);
      c.fillStyle = tone(d); c.fillRect(hx - s, yG - s * 1.1, s * 2, s * 1.1 + 1);
      c.beginPath(); c.moveTo(hx - s * 1.2, yG - s * 1.1); c.lineTo(hx, yG - s * 2.05); c.lineTo(hx + s * 1.2, yG - s * 1.1); c.fill();
    }
    for (let i = 0; i < 22; i++) { const d = hash(i * 4.4); poplar(c, hash(i * 9.1) * W, yG + 1, H * lerp(0.04, 0.1, d), tone(d)); }
    return o.c;
  }
  function paintIndustrial() {
    const o = offscreen(W, H, dpr), c = o.ctx, yG = L.yG;
    farLayers(c, 3);
    let x = -20;
    while (x < W) {
      const bw = 40 + hash(x * 0.03) * 90, bh = H * (0.04 + hash(x * 0.07) * 0.07);
      c.fillStyle = tone(0.35); c.fillRect(x, yG - bh, bw, bh + 1);
      if (hash(x * 0.19) < 0.4) { const cx = x + bw * 0.5, chH = H * (0.1 + hash(x) * 0.08); c.fillRect(cx - 4, yG - bh - chH, 8, chH); }
      x += bw + 4;
    }
    return o.c;
  }
  // the modern city in two layers: the buildings, and the lit windows (which brighten as evening falls)
  function paintModern() {
    const o = offscreen(W, H, dpr), c = o.ctx, lit = offscreen(W, H, dpr), lc = lit.ctx, yG = L.yG;
    farLayers(c, 3);
    for (const [layer, d, minH, maxH] of [[0, 0.2, 0.14, 0.34], [1, 0.6, 0.07, 0.2]]) {
      let x = -30 + layer * 17;
      while (x < W) {
        const bw = 30 + hash(x * 0.013 + layer) * 60, bh = H * lerp(minH, maxH, hash(x * 0.021 + layer * 3));
        c.fillStyle = tone(d); c.fillRect(x, yG - bh, bw, bh + 1);
        for (let wy = yG - bh + 6; wy < yG - 6; wy += 9) for (let wx = x + 5; wx < x + bw - 6; wx += 8) if (hash(wx * 1.7 + wy * 3.1) < 0.22) {
          c.fillStyle = alpha('#FFE3A8', layer ? 0.5 : 0.35); c.fillRect(wx, wy, 3, 4);
          lc.fillStyle = hash(wx + wy) < 0.25 ? '#BFD8FF' : '#FFD9A0'; lc.fillRect(wx, wy, 3, 4);
        }
        x += bw + (layer ? 6 : 10);
      }
    }
    for (let x = 30; x < W; x += 90) { c.fillStyle = tone(0.9); c.fillRect(x, yG - H * 0.075, 2, H * 0.075); c.fillRect(x, yG - H * 0.075, 12, 2); lc.fillStyle = '#FFE8B8'; lc.fillRect(x + 8, yG - H * 0.075 + 2, 5, 3); }
    return { base: o.c, lit: lit.c };
  }
  function paintSky(stops) { const s = offscreen(W, H, dpr); sky(s.ctx, W, H, stops, 0, L.yG); return s.c; }

  function resize(w, h, d) {
    W = w; H = h; dpr = d; L = layout(w, h);
    const m = paintModern();
    back = {
      sky: paintSky([[0, PAL.skyTop], [0.45, PAL.skyMid], [0.8, PAL.skyLow], [1, '#F2E8CF']]),
      night: paintSky([[0, '#141B33'], [0.5, '#2E3458'], [0.85, '#6E5470'], [1, '#B07766']]),
      wild: paintWild(), farm: paintFarm(), ind: paintIndustrial(), modern: m.base, lit: m.lit,
    };
    clouds = [];
    for (let i = 0; i < 6; i++) {
      const cw = W * (0.16 + hash(i * 3.3) * 0.18), ch = cw * (0.28 + hash(i * 5.1) * 0.12);
      clouds.push({ img: cloudSprite(cw, ch, i + 1, { top: '#F8F1DE', bottom: '#E4C59C', dpr: Math.min(dpr, 1.5) }), w: cw, h: ch, x: hash(i * 4.1), y: 0.05 + hash(i * 2.7) * 0.28, v: 4 + hash(i * 6.6) * 6, a: 0.5 + hash(i * 8.8) * 0.35 });
    }
  }

  // ---------- camera ----------
  let cam = { g: 0, a: 0.92, s: 13000 };
  const setOV = (o) => { OV = o; };
  const pitchOf = () => W / cam.s;
  const xOf = (g) => cam.a * W + (cam.g - g) * pitchOf();
  const gOf = (x) => cam.g - (x - cam.a * W) / pitchOf();
  function figH(pitch) {
    const p0 = (W * 0.885) / TOTAL, base = L.mobile ? 26 : 32, max = H * 0.5;
    const h = pitch < 8.7 ? base * Math.pow(pitch / p0, 0.17) : base * Math.pow(8.7 / p0, 0.17) * Math.pow(pitch / 8.7, 0.62);
    return clamp(h, base, max);
  }

  // ---------- land and ground ----------
  let land = null, tmp = null;
  const clearC = (c, cv) => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height); c.restore(); };
  function drawLand(c) {
    if (!land || land.c.width !== Math.round(W * dpr) || land.c.height !== Math.round(H * dpr)) { land = offscreen(W, H, dpr); tmp = offscreen(W, H, dpr); }
    const lc = land.ctx, tc = tmp.ctx, xYou = xOf(0);
    clearC(lc, land.c); lc.drawImage(back.wild, 0, 0, W, H);
    const eras = [[back.farm, xOf(FARM), 0.7], [back.ind, xOf(IND), 0], [back.modern, xOf(MOD), 0]];
    for (const [img, x0, ramp] of eras) {
      const v = smooth(xYou - x0, 70, 220);
      if (v <= 0 || x0 > W) continue;
      const f = Math.max(40, ramp * (xYou - x0)), a0 = x0 - (ramp ? 0 : f);
      const mask = (cc) => { const g = cc.createLinearGradient(a0, 0, x0 + f, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${v})`); return g; };
      lc.globalCompositeOperation = 'destination-out'; lc.fillStyle = mask(lc); lc.fillRect(Math.max(0, a0), 0, W, H);
      lc.globalCompositeOperation = 'source-over';
      clearC(tc, tmp.c); tc.drawImage(img, 0, 0, W, H);
      tc.globalCompositeOperation = 'destination-in'; tc.fillStyle = mask(tc); tc.fillRect(0, 0, W, H);
      if (a0 > 0) tc.clearRect(0, 0, a0, H);
      tc.globalCompositeOperation = 'source-over';
      lc.drawImage(tmp.c, 0, 0, W, H);
    }
    c.drawImage(land.c, 0, 0, W, H);
  }
  function ground(c, t) {
    const top = L.yG, xNow = Math.min(W + 2, xOf(-0.5)), xYou = xOf(0);
    const fill = ([c0, c1], x0, x1, a = 1) => {
      if (x1 <= x0) return;
      const g = c.createLinearGradient(0, top, 0, H); g.addColorStop(0, c0); g.addColorStop(0.16, c1); g.addColorStop(0.42, SOIL.deep); g.addColorStop(1, SOIL.deep);
      c.globalAlpha = a; c.fillStyle = g; c.fillRect(x0, top, x1 - x0, H - top); c.globalAlpha = 1;
    };
    fill(SOIL.top, 0, W);
    const xF = xOf(FARM), vF = smooth(xYou - xF, 70, 220);
    if (vF > 0) { const ramp = 0.7 * (xYou - xF), n = 24; for (let k = 0; k < n; k++) { const a = Math.max(0, xF + (k / n) * ramp), b = Math.max(0, xF + ((k + 1) / n) * ramp); if (b > a) fill(SOIL.farm, a, Math.min(b + 1, W), vF * (k + 0.5) / n); } fill(SOIL.farm, Math.max(0, xF + ramp), W, vF); }
    const xI = xOf(IND), vI = smooth(xYou - xI, 70, 220);
    if (vI > 0) fill(SOIL.ind, Math.max(0, xI), W, vI);
    if (xNow < W) { const f = c.createLinearGradient(xNow, 0, xNow + 160, 0); f.addColorStop(0, `rgba(${SOIL.fade},0)`); f.addColorStop(1, `rgba(${SOIL.fade},0.85)`); c.fillStyle = f; c.fillRect(xNow, top, W - xNow, H - top); }
    const xG = vF > 0 ? Math.min(W, xF + 0.7 * (xYou - xF)) : Math.min(W, xNow);
    if (xG > 0) {
      for (let r = 0; r < 3; r++) grass(c, 0, xG, top + 4 + r * r * 9, H * (0.01 + r * 0.006), alpha(SOIL.grass, 0.32 + r * 0.1), t + r, 0.12 + r * 0.03, r * 7);
      grass(c, 0, xG, top + 1, H * 0.012, alpha('#D2B472', 0.85), t, 0.25, 3);
    }
    if (vI > 0 && xNow > xI) { c.fillStyle = alpha('#E6E3EC', 0.5); c.fillRect(Math.max(0, xI), top, xNow - Math.max(0, xI), 2); }
  }

  // ---------- people ----------
  let OV = {};
  function bodyFor(g) {
    const b = body(g), s = OV[g];
    if (s === 'f') return { ...b, hair: b.hair || 2 };
    if (s === 'm') return { ...b, hair: 0 };
    return b;
  }
  function people(c, t, F) {
    const pitch = pitchOf(), fh = figH(pitch);
    let y = L.yG;
    const gLo = Math.max(0, Math.floor(gOf(W + fh))), gHi = Math.min(TOTAL - 1, Math.ceil(gOf(-fh)));
    const dimOthers = F.focusAmt * 0.5;
    if (pitch < 2.4) {
      // a crowd: draw every m-th generation, anchored to the generations so panning doesn't shimmer
      const m = Math.pow(2, Math.ceil(Math.log2(2.4 / pitch)));
      const x0 = xOf(TOTAL - 1), x1 = xOf(1);
      const rip = F.ripple, wx = rip >= 0 ? lerp(x0, x1, rip) : -1e9, wr = 46;
      const lx = F.lift && F.lift.g > 0 ? xOf(F.lift.g) : -1e9, gapW = fh * 0.45 * (F.lift ? F.lift.amt : 0);
      for (let g = Math.floor(gHi / m) * m; g >= Math.max(1, gLo); g -= m) {
        const x = xOf(g);
        if (Math.abs(x - lx) < gapW) continue;
        const d = Math.max(0, 1 - Math.abs(x - wx) / wr), lift = d * d * (3 - 2 * d);
        const pose = lift > 0.05 ? { ...POSES.stand, bob: -0.12 * lift, arms: [[0.1 + 2.6 * lift, 0.2], [-0.08 + 2.4 * lift, 0.2]] } : POSES.stand;
        const base = mix(PAL.ink, '#4A4458', hash(g * 2.3) * 0.55);
        drawFigure(c, x, y, fh * (0.86 + hash(g * 1.7) * 0.2), { pose, body: bodyFor(g), color: lift > 0.05 ? mix(base, '#D9A066', lift * 0.75) : base });
      }
    } else {
      for (let g = gHi; g >= Math.max(1, gLo); g--) {
        const x = xOf(g);
        if (x < -fh || x > W + fh) continue;
        const hh = fh * (0.9 + hash(g * 1.7) * 0.14);
        const focus = F.focus && Math.abs(F.focus.g - g) < 0.5 ? F.focus.amt : 0;
        const pose = fh > 40 ? walkPose(t * 1.6 + g * 0.83, { stride: 0.35, swing: 0.3 }) : POSES.stand;
        const tn = fh > 120 ? 0 : hash(g * 2.3) * 0.45;
        if (focus > 0.02) {
          // the person we are looking at turns to face us, in a soft pool of light
          glow(c, x, y - hh * 0.5, hh * 0.95, '#FFE6B8', 0.6 * focus);
          drawFigure(c, x, y, hh, { pose: focus > 0.5 ? POSES.stand : pose, facing: focus > 0.5 ? 0 : 1, body: bodyFor(g), color: PAL.ink, farColor: '#2A2733' });
          if (F.focus.sig > 0.01) signal(c, x, y - hh * 0.97, hh * 0.32, t, F.focus.sig, PAL.sig);
        } else {
          const col = mix(mix(PAL.ink, '#4A4458', tn), '#8A8299', dimOthers), farCol = mix(fh > 60 ? '#2A2733' : mix(PAL.ink, '#4A4458', tn), '#9890A6', dimOthers);
          drawFigure(c, x, y, hh, { pose, body: bodyFor(g), color: col, farColor: farCol });
        }
      }
    }
    // a person lifted out of the row: same size, raised above it, with a shadow where they stood
    if (F.lift && F.lift.amt > 0.001 && F.lift.g > 0) {
      const { g, amt, sig } = F.lift, x = xOf(g), up = amt * fh * 1.25, yy = y - up;
      c.fillStyle = alpha('#1A1420', 0.28 * amt); c.beginPath(); c.ellipse(x, y + 1, fh * 0.22, fh * 0.05, 0, 0, TAU); c.fill();
      glow(c, x, yy - fh * 0.5, fh * 1.3, '#FFF1D6', 0.75 * amt);
      drawFigure(c, x, yy, fh * 1.02, { pose: POSES.stand, facing: 0, body: bodyFor(g), color: PAL.ink });
      if (sig > 0.01) signal(c, x, yy - fh * 0.6, fh * 0.8, t, sig, PAL.sig);
    }
    // you
    const xY = xOf(0);
    if (xY > -fh && xY < W + fh) {
      const hh = fh, you = F.you || 0, up = (F.lift && F.lift.g === 0 ? F.lift.amt : 0) * fh * 1.25;
      y -= up;
      if (up > 0) glow(c, xY, y - hh * 0.5, hh * 1.3, '#FFE2D6', 0.7 * up / (fh * 1.25));
      const pose = you > 0.5 && F.youPose ? POSES[F.youPose] : POSES.stand;
      if (you > 0.02) glow(c, xY, y - hh * 0.5, hh * 0.95, '#FFB8A0', 0.35 * you);
      drawFigure(c, xY, y, hh, { pose, body: body(0), color: PAL.you, farColor: mix(PAL.you, '#000', 0.25), screen: you > 0.5 && pose.phone ? '#CFE4FF' : null });
      if (pose.phone && you > 0.5) glow(c, xY + hh * 0.12, y - hh * 0.66, hh * 0.35, '#BFD8FF', 0.5 * you);
      if (F.youSig > 0.01) signal(c, xY, y - hh * (up > 0 ? 0.6 : 0.97), hh * (up > 0 ? 0.8 : 0.32), t, F.youSig, PAL.sig);
    }
    return fh;
  }

  // one frame of the scene for a camera; env: { night, ice }
  function draw(c, camera, T, F, env = {}) {
    cam = camera;
    const night = env.night || 0, ice = env.ice || 0;
    c.drawImage(back.sky, 0, 0, W, H);
    if (night > 0) { c.globalAlpha = night * 0.92; c.drawImage(back.night, 0, 0, W, H); c.globalAlpha = 1; }
    if (night < 1) { c.globalAlpha = 1 - night; sun(c, W * 0.8, L.yG - H * 0.035, H * 0.045, '#FFF4DE', '#FFD08A'); c.globalAlpha = 1; }
    for (const cl of clouds) {
      const span2 = W + cl.w * 2, cx = ((cl.x * span2 + T * cl.v) % span2) - cl.w;
      c.globalAlpha = cl.a * (1 - night * 0.75); c.drawImage(cl.img, cx, H * cl.y - cl.h * 0.5, cl.w, cl.h * 1.5); c.globalAlpha = 1;
    }
    for (let k = 0; k < 4; k++) streak(c, ((hash(k * 9.3) * W + T * 3) % (W * 1.3)) - W * 0.15, L.yG - H * (0.04 + k * 0.035), W * 0.5, 10, '#F2E8CF', 0.5 * (1 - night));
    drawLand(c);
    if (ice > 0) { c.fillStyle = alpha('#C7D3E3', 0.55 * ice); c.fillRect(0, 0, W, L.yG + 2); }
    if (night > 0) {
      c.fillStyle = alpha('#0C1024', 0.72 * night); c.fillRect(0, 0, W, L.yG + 2);
      const xm = xOf(MOD);
      if (xm < W) { c.save(); c.beginPath(); c.rect(Math.max(0, xm), 0, W, L.yG); c.clip(); c.globalAlpha = night; c.drawImage(back.lit, 0, 0, W, H); c.restore(); c.globalAlpha = 1; }
    }
    if (env.birds !== false) for (let k = 0; k < 5; k++) { const bx = (W * 0.3 + T * 30 + k * 26) % (W * 1.3) - W * 0.1, by = H * 0.3 + Math.sin(T * 0.5 + k) * 8 + k * 6; bird(c, bx, by, 5, T * 9 + k, alpha(PAL.ink, 0.6 * (1 - night))); }
    ground(c, T);
    if (night > 0) { c.fillStyle = alpha('#0B0D1A', 0.35 * night); c.fillRect(0, L.yG, W, H - L.yG); }
    if (ice > 0) { const g = c.createLinearGradient(0, L.yG, 0, H); g.addColorStop(0, alpha('#EEF2F7', 0.85 * ice)); g.addColorStop(1, alpha('#9AA6B8', 0.6 * ice)); c.fillStyle = g; c.fillRect(0, L.yG, W, H - L.yG); }
    return people(c, T, F);
  }

  return { resize, draw, setOV, xOf: (g) => xOf(g), figH: () => figH(pitchOf()), get L() { return L; }, get W() { return W; }, get H() { return H; } };
}
