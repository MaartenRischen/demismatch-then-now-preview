// The plants of the world beyond the savanna: broadleaf trees (oak, fig, teak, beech), conifers (spruce, pine),
// birches, palms, rainforest giants, eucalypts, and the low things under them (ferns, big-leaved shrubs, spinifex,
// heath). Built like nature.js's acacia: tapered tubes for wood, instanced cards cut from canvas leaf textures for
// foliage. Everything comes from a seed; nothing is loaded. FLORA maps a name to a builder for world.js.
import * as THREE from 'three';
import { NOISE_GLSL } from './wood.js';
import { rng, fbm2, acacia, bush } from './nature.js';

// ---------- wood ----------
function tube(points, r0, r1, seg = 9, steps = 16) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, steps, 1, seg, false), p = g.attributes.position;
  const tmp = new THREE.Vector3(), cp = curve.getSpacedPoints(steps);
  for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / (seg + 1)), u = ring / steps, r = r0 + (r1 - r0) * u, c = cp[Math.min(steps, ring)]; tmp.set(p.getX(i) - c.x, p.getY(i) - c.y, p.getZ(i) - c.z).multiplyScalar(r); p.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z); }
  g.computeVertexNormals(); return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// bark: kind 'rough' (furrowed, dark), 'birch' (white with black dashes), 'gum' (smooth, cream and grey patches where it
// peels), 'palm' (rings of old leaf bases), 'smooth' (rainforest grey)
const BARKS = {};
function barkMat(kind = 'rough', color) {
  const key = kind + (color || ''); if (BARKS[key]) return BARKS[key];
  const base = color || { rough: '#4A3F36', birch: '#E4E0D6', gum: '#CFC6B4', palm: '#6E604E', smooth: '#4E4B43', pine: '#7A5440' }[kind];
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: kind === 'gum' || kind === 'smooth' ? 0.8 : 0.95, envMapIntensity: kind === 'smooth' ? 0.25 : 0.5 }); // smooth: the rainforest's grey boles, under a canopy that hides the sky
  const body = {
    rough: 'diffuseColor.rgb *= 0.6 + 0.6 * fbm3(vP * vec3(18.0, 3.0, 18.0));',
    pine: 'float pl = fbm3(vP * vec3(9.0, 2.5, 9.0)); diffuseColor.rgb *= 0.55 + 0.7 * pl; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.3, 0.17), smoothstep(0.55, 0.8, pl) * 0.5);',
    birch: 'float d = smoothstep(0.62, 0.7, vnoise(vec3(vP.x * 9.0, vP.y * 26.0, vP.z * 9.0))) * smoothstep(0.35, 0.6, vnoise(vP * vec3(3.0, 1.0, 3.0))); diffuseColor.rgb *= (1.0 - 0.85 * d) * (0.85 + 0.2 * vnoise(vP * 40.0));',
    gum: 'float pa = fbm3(vP * vec3(2.2, 0.9, 2.2)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.4, 0.36), smoothstep(0.5, 0.62, pa)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.45, 0.3), smoothstep(0.66, 0.72, pa) * 0.8); diffuseColor.rgb *= 0.9 + 0.15 * vnoise(vP * 30.0);',
    palm: 'float rg = smoothstep(0.3, 0.0, abs(fract(vP.y * 3.2 + vnoise(vP * 4.0) * 0.3) - 0.5)); diffuseColor.rgb *= 0.7 + 0.35 * vnoise(vP * vec3(30.0, 2.0, 30.0)) - rg * 0.3;',
    smooth: 'diffuseColor.rgb *= 0.78 + 0.3 * fbm3(vP * vec3(3.0, 0.6, 3.0)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.15, 0.17, 0.12), smoothstep(0.55, 0.75, vnoise(vP * vec3(5.0, 1.5, 5.0))) * 0.5);',
  }[kind];
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n' + body); };
  m.customProgramCacheKey = () => 'bark-' + kind; // one shader per kind of bark (the compile hook's text is the same for all)
  return (BARKS[key] = m);
}
const wood = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };

// ---------- foliage textures (white-ish leaves on transparent; the card's colour tints them) ----------
const TEX = {};
function leafTex(kind) {
  if (TEX[kind]) return TEX[kind];
  const S = kind === 'frond' || kind === 'fern' || kind === 'needle' ? [512, 128] : [256, 256], c = document.createElement('canvas'); c.width = S[0]; c.height = S[1];
  const x = c.getContext('2d'), R = rng({ broad: 3, needle: 5, narrow: 9, frond: 11, fern: 13, big: 17, spiky: 19, tuft: 23, twig: 29 }[kind]), W = S[0], H = S[1];
  const leaf = (px, py, a, l, w, v) => { x.fillStyle = `rgb(${Math.round(120 * v)},${Math.round(138 * v)},${Math.round(84 * v)})`; x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.ellipse(0, 0, l, w, 0, 0, Math.PI * 2); x.fill(); x.restore(); };
  const line = (x0, y0, x1, y1, w, col) => { x.strokeStyle = col; x.lineWidth = w; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  if (kind === 'broad') { for (let i = 0; i < 150; i++) { const px = W / 2 + (R() - 0.5) * 220 * Math.sqrt(R()), py = H / 2 + (R() - 0.5) * 200 * Math.sqrt(R()); leaf(px, py, R() * Math.PI, R.range(10, 17), R.range(5, 8), R.range(0.5, 1)); } }
  if (kind === 'big') { for (let i = 0; i < 26; i++) { const px = W / 2 + (R() - 0.5) * 190, py = H / 2 + (R() - 0.5) * 170, a = R() * Math.PI; leaf(px, py, a, R.range(26, 44), R.range(11, 18), R.range(0.45, 0.95)); } }
  if (kind === 'narrow') { for (let i = 0; i < 160; i++) { const px = W / 2 + (R() - 0.5) * 220 * Math.sqrt(R()), py = 20 + R() * 220, a = Math.PI / 2 + R.range(-0.5, 0.5); leaf(px, py, a, R.range(12, 20), R.range(1.8, 3.2), R.range(0.55, 1)); } }
  if (kind === 'tuft') { for (let i = 0; i < 22; i++) { const cx = W / 2 + (R() - 0.5) * 180, cy = H / 2 + (R() - 0.5) * 160; for (let k = 0; k < 40; k++) { const a = R() * 6.283, l = R.range(10, 26), v = R.range(0.5, 1); line(cx, cy, cx + Math.cos(a) * l, cy + Math.sin(a) * l, 2, `rgb(${Math.round(110 * v)},${Math.round(130 * v)},${Math.round(80 * v)})`); } } }
  if (kind === 'spiky') { for (let i = 0; i < 260; i++) { const a = -Math.PI / 2 + R.range(-1.4, 1.4), l = R.range(60, 120), v = R.range(0.6, 1); line(W / 2 + R.range(-30, 30), H, W / 2 + Math.cos(a) * l, H + Math.sin(a) * l * 1.6, 1.6, `rgb(${Math.round(150 * v)},${Math.round(150 * v)},${Math.round(95 * v)})`); } }
  if (kind === 'twig') { x.lineCap = 'round'; const br = (x0, y0, a, l, w, d) => { const x1 = x0 + Math.cos(a) * l, y1 = y0 + Math.sin(a) * l; line(x0, y0, x1, y1, w, 'rgb(90,78,66)'); if (d > 0) { br(x1, y1, a + R.range(0.2, 0.6), l * 0.7, w * 0.7, d - 1); br(x1, y1, a - R.range(0.2, 0.6), l * 0.7, w * 0.7, d - 1); } }; for (let i = 0; i < 5; i++) br(W / 2 + R.range(-40, 40), H, -Math.PI / 2 + R.range(-0.6, 0.6), R.range(40, 70), 4, 5); }
  // a spray along the card's length: a stem with needles, leaflets or fern pinnae either side, tips narrowing
  if (kind === 'needle' || kind === 'frond' || kind === 'fern') {
    const mid = H / 2; line(4, mid, W - 6, mid, kind === 'frond' ? 5 : 3, kind === 'needle' ? 'rgb(80,70,55)' : 'rgb(150,160,110)');
    const step = kind === 'needle' ? 3 : kind === 'frond' ? 7 : 9;
    for (let px = 8; px < W - 8; px += step) {
      const u = px / W, len = (kind === 'frond' ? 58 : kind === 'fern' ? 54 : 40) * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (0.75 + R() * 0.3) + 4, v = R.range(0.6, 1);
      for (const s of [-1, 1]) {
        const a = s * (kind === 'needle' ? R.range(0.6, 1.1) : kind === 'frond' ? R.range(0.75, 1.0) : 1.1), ex = px + Math.cos(a) * len * 0.5, ey = mid + Math.sin(a) * len;
        if (kind === 'fern') { for (let k = 0; k < 6; k++) { const t = k / 6, qx = px + (ex - px) * t, qy = mid + (ey - mid) * t; leaf(qx, qy, a + Math.PI / 2, 4 * (1 - t * 0.6), 2.2, v); } }
        else line(px, mid, ex, ey, kind === 'needle' ? 1.4 : 4.5, `rgb(${Math.round(118 * v)},${Math.round(136 * v)},${Math.round(84 * v)})`);
      }
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return (TEX[kind] = t);
}
const MATS = {};
function foliage(kind, tint) { const k = kind + tint; return MATS[k] || (MATS[k] = new THREE.MeshStandardMaterial({ map: leafTex(kind), color: tint, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 })); }

// instanced cards: place(i, p, e, s) sets position, Euler rotation and scale for card i; snow whitens the upward cards
function cards(geo, mat, n, place, { snow = 0, R = Math.random, vary = 0.18 } = {}) {
  const inst = new THREE.InstancedMesh(geo, mat, n); inst.castShadow = inst.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), col = new THREE.Color(), white = new THREE.Color(2.6, 2.6, 2.7);
  for (let i = 0; i < n; i++) { s.set(1, 1, 1); place(i, p, e, s); q.setFromEuler(e); M.compose(p, q, s); inst.setMatrixAt(i, M);
    col.setScalar(1 - vary / 2 + R() * vary); if (snow && R() < snow) col.lerp(white, R.range ? R.range(0.5, 0.9) : 0.7); inst.setColorAt(i, col); }
  inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  return inst;
}
// a ball of foliage cards round a point
function cluster(grp, R, mat, c, r, n, size, { flat = 1, snow = 0, droop = 0 } = {}) {
  const geo = new THREE.PlaneGeometry(size, size * 0.75);
  grp.add(cards(geo, mat, n, (i, p, e) => { const a = R() * 6.283, b = Math.acos(R() * 2 - 1), rr = r * (0.55 + 0.45 * Math.sqrt(R())); p.set(c.x + Math.sin(b) * Math.cos(a) * rr, c.y + Math.cos(b) * rr * flat, c.z + Math.sin(b) * Math.sin(a) * rr);
    e.set(droop ? R.range(-0.4, 0.4) : R() * Math.PI, R() * Math.PI * 2, droop ? R.range(-0.3, 0.3) : R() * Math.PI); }, { snow, R }));
}

// ---------- broadleaf: oak, beech, fig, miombo, teak; a straight bole, a few limbs, a dome of leaf clusters ----------
export function broadleaf({ seed, scale = 1, tint = '#6F8046', kind = 'oak', snow = 0, bare = false }) {
  const R = rng(seed), grp = new THREE.Group(), bark = barkMat(kind === 'beech' ? 'smooth' : 'rough'), leaf = bare ? foliage('twig', '#6B5E52') : foliage(kind === 'teak' ? 'big' : 'broad', tint);
  const K = { oak: [7, 12, 0.36, 0.55], beech: [10, 16, 0.4, 0.42], fig: [8, 13, 0.3, 0.7], miombo: [6, 10, 0.4, 0.62], teak: [9, 15, 0.45, 0.42] }[kind] || [7, 12, 0.36, 0.55];
  const H = R.range(K[0], K[1]) * scale, fork = H * K[2], spread = H * K[3], lean = R.range(-0.25, 0.25);
  const top = V(lean, fork, R.range(-0.2, 0.2)), r0 = (kind === 'fig' ? 0.42 : 0.26) * scale * (H / 10);
  grp.add(wood(tube([V(0, -0.4, 0), V(lean * 0.3, fork * 0.5, 0), top], r0, r0 * 0.7), bark));
  const limbs = 4 + Math.floor(R() * 3), cl = [];
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * 6.283 + R() * 0.7, d = spread * R.range(0.35, 0.85), end = V(top.x + Math.cos(a) * d, fork + (H - fork) * R.range(0.45, 0.85), top.z + Math.sin(a) * d);
    const mid = top.clone().lerp(end, 0.5); mid.y += R.range(0.1, 0.6); grp.add(wood(tube([top, mid, end], r0 * 0.55, r0 * 0.18, 7, 10), bark)); cl.push(end);
  }
  cl.push(V(top.x, H * 0.95, top.z));
  const cs = (kind === 'teak' ? 1.9 : 1.35) * scale, flat = kind === 'miombo' ? 0.55 : kind === 'beech' ? 0.95 : 0.8;
  for (const c of cl) cluster(grp, R, leaf, c, spread * R.range(0.42, 0.6), Math.round((bare ? 16 : kind === 'teak' ? 26 : 46) * R.range(0.8, 1.2)), bare ? cs * 1.3 : cs, { flat, snow }); // bare in winter: twigs only
  return grp;
}

// ---------- conifers: a spruce (one straight stem, tiers of drooping sprays narrowing to a spire) or a pine (a tall
// bare stem, red-brown above, and an uneven crown of needle tufts at the top) ----------
export function conifer({ seed, scale = 1, tint = '#4F6440', kind = 'spruce', snow = 0 }) {
  const R = rng(seed), grp = new THREE.Group();
  if (kind === 'pine') {
    const H = R.range(10, 17) * scale, bend = R.range(-0.8, 0.8), bark = barkMat('pine'), tuft = foliage('tuft', tint);
    const pts = [V(0, -0.3, 0), V(bend * 0.2, H * 0.4, 0.1), V(bend * 0.6, H * 0.75, -0.1), V(bend, H, 0)]; grp.add(wood(tube(pts, 0.24 * scale * (H / 12), 0.07 * scale, 8, 18), bark));
    const crown0 = H * R.range(0.6, 0.72), n = 5 + Math.floor(R() * 4);
    for (let i = 0; i < n; i++) { const y = crown0 + (H - crown0) * (i / n) * R.range(0.8, 1.1), a = R() * 6.283, d = R.range(0.6, 2.4) * scale * (1 - i / n * 0.5), stem = V(bend * (y / H), y, 0), end = V(stem.x + Math.cos(a) * d, y + R.range(0.2, 0.8), Math.sin(a) * d);
      grp.add(wood(tube([stem, stem.clone().lerp(end, 0.5).add(V(0, 0.2, 0)), end], 0.07 * scale, 0.025 * scale, 6, 8), bark)); cluster(grp, R, tuft, end, R.range(0.9, 1.6) * scale, 26, 1.1 * scale, { flat: 0.45, snow }); }
    return grp;
  }
  const H = R.range(9, 18) * scale, R0 = H * R.range(0.18, 0.24), bark = barkMat('rough', '#4E4136'), spray = foliage('needle', tint);
  grp.add(wood(tube([V(0, -0.3, 0), V(R.range(-0.1, 0.1), H * 0.5, 0), V(0, H, 0)], 0.2 * scale * (H / 12), 0.02, 7, 14), bark));
  const sprays = [];
  for (let y = H * R.range(0.06, 0.14); y < H; y += 0.32 * scale) {
    const u = (H - y) / H, rr = R0 * Math.pow(u, 0.95) * (0.85 + R() * 0.3) + 0.25, n = Math.max(3, Math.round(rr * 6)), a0 = R() * 6.283;
    for (let k = 0; k < n; k++) sprays.push([y, rr, a0 + (k / n) * 6.283 + R.range(-0.2, 0.2)]);
  }
  const geo = new THREE.PlaneGeometry(1, 0.42); geo.translate(0.5, 0, 0); // a spray grows out from its stem end
  grp.add(cards(geo, foliage('needle', tint), sprays.length, (i, p, e, s) => { const [y, rr, a] = sprays[i]; p.set(0, y, 0); e.set(-Math.PI / 2 * R.range(0.35, 1), -a, -R.range(0.2, 0.5), 'YZX'); s.set(rr * 1.05, rr * 1.05, 1); }, { snow, R, vary: 0.25 }));
  return grp;
}

// ---------- birch: a slim white stem, a light narrow crown of small leaves; bare twigs in winter ----------
export function birch({ seed, scale = 1, tint = '#93A35A', bare = false, snow = 0 }) {
  const R = rng(seed), grp = new THREE.Group(), H = R.range(8, 14) * scale, lean = R.range(-0.7, 0.7), bark = barkMat('birch');
  const top = V(lean, H, R.range(-0.3, 0.3)); grp.add(wood(tube([V(0, -0.3, 0), V(lean * 0.3, H * 0.45, 0), top], 0.13 * scale * (H / 11), 0.03, 8, 16), bark));
  for (let i = 0; i < 6; i++) { const y = H * R.range(0.45, 0.9), a = R() * 6.283, st = V(lean * (y / H), y, 0), end = V(st.x + Math.cos(a) * R.range(0.8, 1.8) * scale, y + R.range(0.6, 1.6), Math.sin(a) * R.range(0.8, 1.8) * scale); grp.add(wood(tube([st, st.clone().lerp(end, 0.5), end], 0.04 * scale, 0.012, 5, 6), bark)); }
  if (bare) { const tw = foliage('twig', '#6B5E52'); for (let i = 0; i < 6; i++) cluster(grp, R, tw, V(lean * 0.8 + R.range(-1, 1) * scale, H * R.range(0.6, 0.95), R.range(-1, 1) * scale), 1.4 * scale, 14, 1.4 * scale, { flat: 1.2, snow }); return grp; }
  const leaf = foliage('broad', tint); for (let i = 0; i < 5; i++) cluster(grp, R, leaf, V(lean * 0.8 + R.range(-0.7, 0.7) * scale, H * R.range(0.58, 0.95), R.range(-0.7, 0.7) * scale), R.range(1.1, 1.7) * scale, 34, 0.8 * scale, { flat: 1.3 });
  return grp;
}

// ---------- palm: a ringed stem that curves, and a crown of arching fronds ----------
function frondGeo(L, W, droop) { const g = new THREE.PlaneGeometry(L, W, 14, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const u = (p.getX(i) + L / 2) / L, z = p.getY(i); const x = u * L, y = Math.sin(u * 1.3) * L * 0.25 - droop * u * u * L * 0.55; p.setXYZ(i, x, y + Math.abs(z) * 0.12, z); }
  g.computeVertexNormals(); return g; }
export function palm({ seed, scale = 1, tint = '#7E8F48' }) {
  const R = rng(seed), grp = new THREE.Group(), H = R.range(7, 13) * scale, lean = R.range(0.5, 2.6) * scale, la = R() * 6.283, bark = barkMat('palm');
  const topP = V(Math.cos(la) * lean, H, Math.sin(la) * lean); grp.add(wood(tube([V(0, -0.3, 0), V(Math.cos(la) * lean * 0.15, H * 0.45, Math.sin(la) * lean * 0.15), topP], 0.2 * scale, 0.14 * scale, 9, 18), bark));
  const fr = foliage('frond', tint), dead = foliage('frond', '#8A6E48'), n = 12 + Math.floor(R() * 6);
  for (let i = 0; i < n + 3; i++) { const isDead = i >= n, g = frondGeo(R.range(3.2, 4.6) * scale, R.range(0.9, 1.2) * scale, isDead ? 1.6 : R.range(0.45, 0.9)), m = new THREE.Mesh(g, isDead ? dead : fr);
    m.castShadow = true; m.position.copy(topP); m.rotation.set(0, (i / n) * 6.283 + R.range(-0.2, 0.2), isDead ? -0.9 : R.range(-0.15, 0.35), 'YZX'); grp.add(m); }
  return grp;
}

// ---------- the rainforest's big trees: a tall pale bole on buttress roots, a crown spread wide and flat high up ----------
export function jungle({ seed, scale = 1, tint = '#4F6A36' }) {
  const R = rng(seed), grp = new THREE.Group(), H = R.range(18, 30) * scale, bark = barkMat('smooth'), r0 = 0.45 * scale * (H / 24);
  grp.add(wood(tube([V(0, -0.5, 0), V(R.range(-0.3, 0.3), H * 0.5, 0), V(R.range(-0.4, 0.4), H * 0.82, R.range(-0.3, 0.3))], r0, r0 * 0.6, 10, 18), bark));
  // buttresses: thin fins running out from the foot of the bole
  for (let i = 0, n = 4 + Math.floor(R() * 3); i < n; i++) { const a = (i / n) * 6.283 + R() * 0.5, L = R.range(1.4, 2.6) * scale, hgt = R.range(1.6, 3.2) * scale, sh = new THREE.Shape(); sh.moveTo(0, hgt); sh.quadraticCurveTo(L * 0.25, hgt * 0.25, L, -0.1); sh.lineTo(0, -0.1); sh.lineTo(0, hgt);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.12 * scale, bevelEnabled: false }); g.translate(0, 0, -0.06 * scale); const m = wood(g, bark); m.rotation.y = -a; grp.add(m); }
  const crownY = H * 0.82, leaf = foliage('broad', tint), lim = 5 + Math.floor(R() * 3), cr = H * R.range(0.28, 0.4);
  for (let i = 0; i < lim; i++) { const a = (i / lim) * 6.283 + R() * 0.6, d = cr * R.range(0.4, 0.95), st = V(0, crownY, 0), end = V(Math.cos(a) * d, crownY + R.range(1, 3.5) * scale, Math.sin(a) * d); grp.add(wood(tube([st, st.clone().lerp(end, 0.5).add(V(0, 0.8, 0)), end], r0 * 0.4, r0 * 0.12, 7, 8), bark));
    cluster(grp, R, leaf, end, cr * R.range(0.4, 0.55), 46, 1.9 * scale, { flat: 0.42 }); }
  // a few climbers hanging from the limbs
  const vine = new THREE.MeshStandardMaterial({ color: '#4A4A32', roughness: 0.9 });
  for (let i = 0; i < 3; i++) { const a = R() * 6.283, d = cr * R.range(0.3, 0.7), x = Math.cos(a) * d, z = Math.sin(a) * d; grp.add(wood(tube([V(x, crownY + 1, z), V(x * 0.9 + 0.3, crownY * 0.55, z * 0.9), V(x * 0.8, 0.2, z * 0.8 + 0.4)], 0.035, 0.03, 5, 12), vine)); }
  return grp;
}

// ---------- eucalypt: a pale peeling trunk, often forked and leaning, an open crown of hanging grey-green clumps ----------
export function eucalypt({ seed, scale = 1, tint = '#7F8C68' }) {
  const R = rng(seed), grp = new THREE.Group(), H = R.range(10, 18) * scale, bark = barkMat('gum'), leaf = foliage('narrow', tint);
  const fork = H * R.range(0.3, 0.5), base = V(R.range(-0.4, 0.4), fork, R.range(-0.3, 0.3)); grp.add(wood(tube([V(0, -0.3, 0), V(base.x * 0.4, fork * 0.5, 0), base], 0.3 * scale * (H / 14), 0.22 * scale, 9, 12), bark));
  const stems = 2 + Math.floor(R() * 2);
  for (let i = 0; i < stems; i++) { const a = R() * 6.283, tp = V(base.x + Math.cos(a) * R.range(1, 3) * scale, H * R.range(0.8, 1), base.z + Math.sin(a) * R.range(1, 3) * scale), mid = base.clone().lerp(tp, 0.5).add(V(R.range(-0.6, 0.6), 0, R.range(-0.6, 0.6)));
    grp.add(wood(tube([base, mid, tp], 0.18 * scale, 0.05 * scale, 8, 12), bark));
    for (let k = 0; k < 3; k++) { const c = base.clone().lerp(tp, R.range(0.55, 1)).add(V(R.range(-1.6, 1.6) * scale, R.range(-0.4, 0.8), R.range(-1.6, 1.6) * scale)); cluster(grp, R, leaf, c, R.range(1.0, 1.8) * scale, 22, 1.3 * scale, { flat: 0.7, droop: 1 }); } }
  return grp;
}

// ---------- low plants ----------
// a fern: fronds arching out from one crown
export function fern({ seed, size = 1, tint = '#5E7A3A' }) {
  const R = rng(seed), grp = new THREE.Group(), fr = foliage('fern', tint), n = 9 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(frondGeo(R.range(0.9, 1.5) * size, 0.42 * size, R.range(0.6, 1.1)), fr); m.castShadow = m.receiveShadow = true; m.rotation.set(0, (i / n) * 6.283 + R.range(-0.2, 0.2), R.range(0.2, 0.6), 'YZX'); grp.add(m); }
  return grp;
}
// a big-leaved shrub of the forest floor
export function bigleaf({ seed, size = 1, tint = '#4F6B34' }) { const R = rng(seed), grp = new THREE.Group(); cluster(grp, R, foliage('big', tint), V(0, 0.8 * size, 0), 0.9 * size, 22, 1.2 * size, { flat: 0.9 }); return grp; }
// spinifex: a low hummock of stiff spiky grass, straw-gold to grey-green
export function spinifex({ seed, size = 1, tint = '#B9AE78' }) {
  const R = rng(seed), grp = new THREE.Group(), geo = new THREE.PlaneGeometry(0.9 * size, 0.55 * size); geo.translate(0, 0.27 * size, 0);
  grp.add(cards(geo, foliage('spiky', tint), 18, (i, p, e) => { p.set(R.range(-0.25, 0.25) * size, 0, R.range(-0.25, 0.25) * size); e.set(R.range(-0.25, 0.25), (i / 18) * Math.PI * 2, R.range(-0.2, 0.2)); }, { R }));
  grp.scale.set(1, 0.8, 1); return grp;
}
// reeds at a lakeshore: a stand of thin upright blades
export function reeds({ seed, size = 1, tint = '#9A9A5E' }) {
  const R = rng(seed), grp = new THREE.Group(), geo = new THREE.PlaneGeometry(0.7 * size, 1.8 * size); geo.translate(0, 0.9 * size, 0);
  grp.add(cards(geo, foliage('spiky', tint), 10, (i, p, e) => { p.set(R.range(-0.4, 0.4) * size, 0, R.range(-0.4, 0.4) * size); e.set(R.range(-0.1, 0.1), R() * Math.PI, 0); }, { R }));
  return grp;
}

// name -> builder, all taking { seed, scale (trees) or size (low plants), tint, ... }
export const FLORA = {
  acacia: (o) => acacia(o), broadleaf, conifer, birch, palm, jungle, eucalypt,
  bush: (o) => bush({ seed: o.seed, size: o.size ?? o.scale ?? 1, tint: o.tint }), fern, bigleaf, spinifex, reeds,
};

// ---------- a forest's edge: a ring of canopy round the clearing, its top edge cut into crowns of uneven width and
// height (domes for broadleaf, spires for conifers, fans on stems for palms), two or three layers deep. It stands on
// the ground's own height function, darker at the foot, leafy noise over all, each crown its own shade; it thins out
// where the cover noise is low and stops where the land is under water. r: [near, far] radius of the first and last
// layer; top: canopy height in metres; cover: share of the ring wooded ----------
export function treeline({ height, seed, r = [40, 80], top = 16, shape = 'round', cover = 1, color = '#2E3E24', gap = () => false, layers = 3 }) {
  const R = rng(seed + 0.31), grp = new THREE.Group(), col = new THREE.Color(color);
  // a faint sky reflection only: at grazing angles a full one outshines the dark leaves and the edge reads as painted card
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.25 });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTW;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\nfloat ang = atan(vTW.z, vTW.x) * length(vTW.xz); float stems = smoothstep(0.62, 0.8, vnoise(vec3(ang * 0.9, vTW.y * 0.05, 3.0)));\ndiffuseColor.rgb *= (0.6 + 0.6 * fbm3(vTW * 0.7)) * (0.7 + 0.45 * vnoise(vTW * 3.5)) * (0.8 + 0.32 * vnoise(vec3(ang * 1.6, vTW.y * 1.8, 1.0))) * (1.0 - stems * 0.35);'); };
  mat.customProgramCacheKey = () => 'treeline';
  const W = { spiky: [1.6, 3.6], round: [4, 12], palm: [5, 9] }[shape] || [4, 12];
  // a crown's profile across its width (f: 0..1), 0..1
  const crownF = (f) => shape === 'spiky' ? Math.max(0, 1 - Math.abs(f - 0.5) * 2) ** 0.9 : shape === 'palm' ? (Math.abs(f - 0.5) < 0.3 ? 0.75 + 0.25 * Math.cos((f - 0.5) * 10) : 0.12) : Math.sqrt(Math.max(0, 1 - ((f - 0.5) * 2) ** 2));
  for (let k = 0; k < layers; k++) {
    const rad = r[0] + (r[1] - r[0]) * (k / Math.max(1, layers - 1)), C = 6.2832 * rad, H = top * (1 + k * 0.12), shade = col.clone().multiplyScalar(1 - k * 0.1);
    // the crowns along this layer: [start, width, height, shade]; wooded or not by the cover noise at the crown's centre
    const crowns = []; for (let u = 0; u < C;) { const w = R.range(...W), a = (u + w / 2) / rad, n = fbm2(Math.cos(a) * 2.2 + 7, Math.sin(a) * 2.2, seed + 11 + k, 3);
      const wood = Math.min(1, Math.max(0, (n - (1 - cover)) / 0.08)); crowns.push([u, w, wood * R.range(0.55, 1), R.range(0.78, 1.15)]); u += w * R.range(0.55, 0.8); }
    const N = Math.ceil(C / 0.35), pos = [], cols = [], idx = []; let j = 0;
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * C, a = u / rad, rr = rad + (fbm2(Math.cos(a) * 3 + k, Math.sin(a) * 3, seed + k, 3) - 0.5) * rad * 0.3, x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = height(x, z);
      while (j < crowns.length - 1 && crowns[j + 1][0] <= u) j++;
      let t = 0, sh = 1; for (let q = Math.max(0, j - 3); q <= j; q++) { const [u0, w, hh, c] = crowns[q], f = (u - u0) / w; if (f < 0 || f > 1) continue; const v = hh * (shape === 'spiky' ? 0.35 + 0.65 * crownF(f) : 0.55 + 0.45 * crownF(f)); if (v > t) { t = v; sh = c; } }
      if (gap(x, z, y)) t = 0; t *= H;
      pos.push(x, y - 1.5, z, x, y + t * 0.5, z, x, y + t, z);
      const c0 = shade.clone().multiplyScalar(sh * 0.8), foot = c0.clone().multiplyScalar(0.3), mid = c0.clone().multiplyScalar(0.75), tip = c0.clone().multiplyScalar(1.15);
      cols.push(foot.r, foot.g, foot.b, mid.r, mid.g, mid.b, tip.r, tip.g, tip.b);
      if (i < N) { const b = i * 3; idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
    // light it as foliage, not as a wall: normals mostly up, a little out towards the clearing, so a low sun behind the
    // camera grazes the canopy instead of lighting the whole edge flat (needles shade each other)
    const n = g.attributes.normal; for (let i = 0; i < n.count; i++) { const x = pos[i * 3], z = pos[i * 3 + 2], l = Math.hypot(x, z) || 1; n.setXYZ(i, -x / l * 0.45, 0.89, -z / l * 0.45); }
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = k === 0; grp.add(m);
  }
  return grp;
}
