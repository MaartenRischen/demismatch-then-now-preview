// Drawing kit for the v4 scenes: colour, noise, skies, terrain, plants, clouds, birds.
// Everything is drawn in tinted silhouette layers: depth comes from mixing each layer toward the haze colour.

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t, a = 0, b = 1) => { const x = clamp((t - a) / (b - a)); return x * x * (3 - 2 * x); };
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

// ---------- colour ----------
const cache = new Map();
export function rgb(c) {
  if (Array.isArray(c)) return c;
  if (cache.has(c)) return cache.get(c);
  let r, g, b, a = 1;
  if (c[0] === '#') {
    const h = c.length === 4 ? c.slice(1).split('').map((x) => x + x).join('') : c.slice(1);
    r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
  } else { [r, g, b, a = 1] = c.match(/[\d.]+/g).map(Number); }
  const v = [r, g, b, a]; cache.set(c, v); return v;
}
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${lerp(A[3] ?? 1, B[3] ?? 1, t).toFixed(3)})`;
}
export function alpha(c, a) { const A = rgb(c); return `rgba(${A[0]},${A[1]},${A[2]},${(A[3] ?? 1) * a})`; }

// ---------- noise ----------
export function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return v - Math.floor(v); }
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 1013), b = hash(i + 1 + seed * 1013);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
export function fbm(x, seed = 0, oct = 4) {
  let v = 0, amp = 0.5, fr = 1, norm = 0;
  for (let o = 0; o < oct; o++) { v += amp * noise1(x * fr, seed + o * 17); norm += amp; amp *= 0.5; fr *= 2.03; }
  return v / norm;
}

// ---------- canvas ----------
export function setup(canvas, w, h, dpr) {
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
export function offscreen(w, h, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

// ---------- sky ----------
export function sky(ctx, w, h, stops, y0 = 0, y1 = h) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, a)); g.addColorStop(0.35, alpha(color, a * 0.35)); g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
export function sun(ctx, x, y, r, core, halo) {
  glow(ctx, x, y, r * 9, halo, 0.55);
  glow(ctx, x, y, r * 3, halo, 0.6);
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// soft cumulus: overlapping radial blobs with a flat-ish base
export function cloud(ctx, x, y, w, color, a = 1, seed = 0) {
  const n = 7;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const bx = x + (u - 0.5) * w * 0.9 + (hash(seed + i) - 0.5) * w * 0.08;
    const bh = Math.sin(u * Math.PI) * w * 0.17 + w * 0.06;
    const r = w * (0.12 + 0.1 * Math.sin(u * Math.PI)) * (0.8 + hash(seed + i * 3) * 0.4);
    const by = y - bh * 0.6;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    g.addColorStop(0, alpha(color, a * 0.85)); g.addColorStop(0.6, alpha(color, a * 0.5)); g.addColorStop(1, alpha(color, 0));
    ctx.fillStyle = g; ctx.fillRect(bx - r, by - r, 2 * r, 2 * r);
  }
}
// thin stretched cloud bands near the horizon
export function streak(ctx, x, y, w, hh, color, a = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, hh / w);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  g.addColorStop(0, alpha(color, a)); g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -w / 2, w, w); ctx.restore();
}

// ---------- terrain ----------
// A silhouette ridge across [x0, x1]. heightFn(x) returns the ridge height above baseY in px.
export function ridge(ctx, x0, x1, baseY, heightFn, color, step = 3, bottom = null) {
  ctx.beginPath(); ctx.moveTo(x0, bottom ?? baseY + 2000);
  for (let x = x0; x <= x1 + step; x += step) ctx.lineTo(x, baseY - heightFn(x));
  ctx.lineTo(x1, bottom ?? baseY + 2000); ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}
export const mountains = (seed, scale, amp, sharp = 1) => (x) => {
  const v = fbm(x / scale, seed, 5);
  return amp * Math.pow(v, sharp);
};

// ---------- plants ----------
// flat-topped acacia: a forked trunk and a layered umbrella canopy
export function acacia(ctx, x, y, s, color, seed = 0) {
  const r = (k) => hash(seed * 7.13 + k);
  const ch = s * (0.55 + r(1) * 0.2), cw = s * (0.9 + r(2) * 0.5);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  // trunk and forks
  ctx.lineWidth = Math.max(1, s * 0.045);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.03, y - ch * 0.45, x - s * 0.02, y - ch * 0.6); ctx.stroke();
  ctx.lineWidth = Math.max(0.8, s * 0.03);
  const forks = 3 + Math.floor(r(3) * 2);
  for (let i = 0; i < forks; i++) {
    const u = forks === 1 ? 0.5 : i / (forks - 1);
    ctx.beginPath(); ctx.moveTo(x - s * 0.02, y - ch * 0.6);
    ctx.quadraticCurveTo(x + (u - 0.5) * cw * 0.3, y - ch * 0.8, x + (u - 0.5) * cw * 0.75, y - ch * 0.98); ctx.stroke();
  }
  // canopy: overlapping flattened ellipses
  const n = 9;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const cx = x + (u - 0.5) * cw + (r(10 + i) - 0.5) * cw * 0.08;
    const cy = y - ch - Math.sin(u * Math.PI) * s * 0.06 + (r(20 + i) - 0.5) * s * 0.04;
    const rx = cw * (0.13 + r(30 + i) * 0.06), ry = s * (0.07 + r(40 + i) * 0.04);
    ctx.moveTo(cx + rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  }
  ctx.fill();
}
// a rounded bush/tree
export function bush(ctx, x, y, s, color, seed = 0) {
  ctx.fillStyle = color; ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI;
    const rr = s * (0.32 + hash(seed + i) * 0.18);
    const cx = x + Math.cos(a) * s * 0.35, cy = y - s * 0.25 - Math.sin(a) * s * 0.22;
    ctx.moveTo(cx + rr, cy); ctx.arc(cx, cy, rr, 0, TAU);
  }
  ctx.fill();
}
// tall poplar/cypress-like tree for farmland
export function poplar(ctx, x, y, s, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.bezierCurveTo(x + s * 0.2, y - s * 0.75, x + s * 0.17, y - s * 0.2, x + s * 0.02, y);
  ctx.lineTo(x - s * 0.02, y);
  ctx.bezierCurveTo(x - s * 0.17, y - s * 0.2, x - s * 0.2, y - s * 0.75, x, y - s);
  ctx.fill();
}
// grass blades along a line; sway with wind time t
export function grass(ctx, x0, x1, y, hgt, color, t = 0, density = 0.5, seed = 0) {
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.7, hgt * 0.08); ctx.lineCap = 'round';
  ctx.beginPath();
  const step = 1 / density;
  for (let x = x0; x < x1; x += step) {
    const k = Math.floor(x * 13.7);
    const hh = hgt * (0.45 + hash(k + seed) * 0.75);
    const lean = (hash(k * 3 + seed) - 0.5) * 0.6 + Math.sin(t * 1.3 + x * 0.02) * 0.18;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * hh * 0.3, y - hh * 0.6, x + lean * hh * 0.85, y - hh);
  }
  ctx.stroke();
}

// ---------- animals and birds ----------
export function bird(ctx, x, y, s, flap, color) {
  const w = Math.sin(flap) * 0.6;
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(0.8, s * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s, y - s * w);
  ctx.quadraticCurveTo(x - s * 0.45, y - s * (0.3 + w * 0.6), x, y);
  ctx.quadraticCurveTo(x + s * 0.45, y - s * (0.3 + w * 0.6), x + s, y - s * w);
  ctx.stroke();
}
// a grazing antelope-like animal seen from the side, facing right
export function antelope(ctx, x, y, s, color, phase = 0, grazing = 0) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, y - s * 0.62, s * 0.42, s * 0.17, 0, 0, TAU); ctx.fill();
  const neckA = lerp(-0.9, 0.5, grazing);
  const nx = x + s * 0.36, ny = y - s * 0.7;
  const hx = nx + Math.cos(neckA) * s * 0.38, hy = ny + Math.sin(neckA) * s * 0.38;
  ctx.lineWidth = s * 0.11; ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(hx + s * 0.06, hy + s * 0.02, s * 0.11, s * 0.065, neckA * 0.6 + 0.3, 0, TAU); ctx.fill();
  ctx.lineWidth = s * 0.03; ctx.beginPath(); ctx.moveTo(hx, hy - s * 0.04); ctx.lineTo(hx - s * 0.08, hy - s * 0.25); ctx.stroke();
  ctx.lineWidth = s * 0.055;
  for (const [lx, ph] of [[-0.3, 0], [-0.2, Math.PI], [0.25, Math.PI], [0.33, 0]]) {
    const sw = Math.sin(phase + ph) * 0.12;
    ctx.beginPath(); ctx.moveTo(x + s * lx, y - s * 0.6); ctx.lineTo(x + s * (lx + sw), y); ctx.stroke();
  }
}

// ---------- cloud sprites ----------
// A cloud bank drawn once into its own canvas: many soft puffs, lit from above, warm underneath.
export function cloudSprite(w, h, seed, { top = '#FFFFFF', bottom = '#F3C8A6', shade = 'rgba(120,120,160,0.0)', dpr = 1, puffs = 26 } = {}) {
  // the canvas is half again as tall as the cloud, so the tops of the puffs are never cut off; draw it 0.5h higher
  const o = offscreen(w, h * 1.5, dpr), ctx = o.ctx;
  const base = h * 0.5 + h * 0.78;
  for (let i = 0; i < puffs; i++) {
    const u = hash(seed * 31 + i * 1.7);
    const x = w * (0.22 + 0.56 * u);
    const hump = Math.sin(u * Math.PI);                      // taller in the middle
    const r = Math.min(w * 0.2, h * (0.16 + 0.26 * hump * hash(seed + i * 4.3)));
    const y = base - r * (0.35 + 0.6 * hash(seed + i * 9.1)) * (0.6 + hump * 0.6);
    const g = ctx.createRadialGradient(x, y - r * 0.25, r * 0.1, x, y, r);
    const lit = mix(bottom, top, clamp((base - y) / (h * 0.55)));
    g.addColorStop(0, alpha(lit, 0.95)); g.addColorStop(0.55, alpha(lit, 0.75)); g.addColorStop(1, alpha(lit, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // flatten the base: fade the bottom edge
  ctx.globalCompositeOperation = 'destination-in';
  const f = ctx.createLinearGradient(0, base - h * 0.1, 0, base + h * 0.12);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = f; ctx.fillRect(0, 0, w, h * 1.5);
  ctx.globalCompositeOperation = 'source-over';
  return o.c;
}
