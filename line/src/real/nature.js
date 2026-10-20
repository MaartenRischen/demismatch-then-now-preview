// The ground and what grows on it: terrain, grass that moves in the wind, acacias and bushes from leaf cards, rocks,
// distant hills. Everything is generated from a seed; nothing is loaded.
import * as THREE from 'three';
import { NOISE_GLSL } from './wood.js';

// ---------- seeded randomness and noise (JS side) ----------
export function rng(seed) { let s = (Math.floor(seed * 9973) ^ 0x9e3779b9) >>> 0; const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.range = (a, b) => a + (b - a) * f(); f.pick = (a) => a[Math.floor(f() * a.length)]; return f; }
function h2(x, y, s) { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); }
export function vnoise2(x, y, s = 0) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = h2(i, j, s), b = h2(i + 1, j, s), c = h2(i, j + 1, s), d = h2(i + 1, j + 1, s); return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy; }
export function fbm2(x, y, s = 0, o = 5) { let a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { t += a * vnoise2(x * f, y * f, s + i * 13); f *= 2.02; a *= 0.5; } return t; }

// ---------- terrain ----------
// height(x, z): flat where people are (within `flat` metres of the origin), rolling further out, hills at the edge.
// basin: a dip for a lake or the sea, centred at basin.x/z with radius basin.r, so water can fill it.
export function makeHeight({ seed, rough = 1, flat = 14, hills = 18, basin = null, shore = null }) {
  return (x, z) => {
    // a coast: the land runs down a beach into the sea beyond the shoreline at z = shore.z (the sea is at y = 0)
    if (shore) { const d = shore.z - z + Math.sin(x * 0.03 + seed) * 6; if (d > -4) { const y0 = 0.6 + (fbm2(x * 0.05, z * 0.05, seed, 3) - 0.5) * 0.3; return d < 0 ? y0 * (-d / 4) + 0.15 : 0.15 - d * 0.09; } }
    const d = Math.hypot(x, z), near = Math.min(1, Math.max(0, (d - flat) / 60));
    let y = (fbm2(x * 0.012, z * 0.012, seed) - 0.5) * 6 * rough * (0.15 + near) + (fbm2(x * 0.08, z * 0.08, seed + 5, 3) - 0.5) * 0.35 * rough;
    y += Math.pow(Math.max(0, (d - 150) / 250), 1.6) * hills * fbm2(x * 0.004, z * 0.004, seed + 9, 3);
    if (basin) { const b = Math.hypot(x - basin.x, z - basin.z) / basin.r; y -= basin.depth * Math.max(0, 1 - b * b) ** 1.2 + (b < 1.4 ? (1.4 - b) * 0.6 : 0); }
    return y;
  };
}

export function terrain({ height, size = 900, seg = 360, palette, seed }) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, height(x, z)); }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.96, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.cA = { value: new THREE.Color(palette.soil) }; sh.uniforms.cB = { value: new THREE.Color(palette.soil2) };
    sh.uniforms.cC = { value: new THREE.Color(palette.grass) }; sh.uniforms.cD = { value: new THREE.Color(palette.rock || palette.soil2) };
    sh.uniforms.uSeed = { value: seed }; sh.uniforms.uGrassAmt = { value: palette.grassAmt ?? 0.5 }; sh.uniforms.uWet = { value: palette.wetline ?? -99 };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz; vN = normal;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vN; uniform vec3 cA, cB, cC, cD; uniform float uSeed, uGrassAmt, uWet;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 q = vW + uSeed;
        float big = fbm3(q * 0.03), mid = fbm3(q * 0.25), fine = vnoise(q * 3.0), grit = vnoise(q * 22.0);
        vec3 col = mix(cA, cB, smoothstep(0.35, 0.7, big + (mid - 0.5) * 0.4));
        float dist = length(vW.xz - cameraPosition.xz);
        float grassy = smoothstep(0.45, 0.75, mid * 0.6 + big * 0.6) * uGrassAmt * smoothstep(8.0, 22.0, length(vW.xz));
        // past the modelled grass the plain is grass-coloured, streaked like a field seen from afar
        float far = smoothstep(55.0, 95.0, dist) * uGrassAmt;
        float streak = vnoise(vec3(vW.x * 0.6, 0.0, vW.z * 2.4)) * 0.5 + vnoise(q * 0.9) * 0.5;
        col = mix(col, cC * (0.8 + 0.35 * streak), max(grassy, far * (0.75 + 0.25 * big)));
        float slope = 1.0 - clamp(vN.y, 0.0, 1.0); col = mix(col, cD, smoothstep(0.25, 0.55, slope));
        // near the camera: pebbles, dark specks, fine cracks
        float near = 1.0 - smoothstep(10.0, 30.0, dist);
        float peb = smoothstep(0.78, 0.86, vnoise(q * 9.0)) * near; col = mix(col, cD * 1.1, peb * 0.7);
        float speck = smoothstep(0.82, 0.9, vnoise(q * 31.0)) * near; col *= 1.0 - speck * 0.35;
        float crack = smoothstep(0.03, 0.0, abs(vnoise(q * 4.0) - 0.5)) * near * (1.0 - uGrassAmt * 0.5); col *= 1.0 - crack * 0.25;
        col *= 0.84 + 0.24 * fine; col *= 0.9 + 0.2 * grit;
        float wet = smoothstep(uWet + 0.6, uWet, vW.y); col = mix(col, col * 0.55, wet);
        diffuseColor.rgb = col;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 q2 = vW + uSeed; float e = 0.05; float hc = fbm3(q2 * 2.5); float hx = fbm3((q2 + vec3(e,0,0)) * 2.5); float hz = fbm3((q2 + vec3(0,0,e)) * 2.5);
          vec3 bump = vec3(hc - hx, 0.0, hc - hz) * 6.0; normal = normalize(normal + (viewMatrix * vec4(bump, 0.0)).xyz * 0.35); }`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  return mesh;
}

// ---------- grass ----------
// clumps of blades, each blade a thin bent strip; wind bends them by height. Normals point mostly up so a field
// lights evenly, the way real grass reads from a few metres away.
function clumpGeometry(blades = 9, h = 0.55, seed = 1) {
  const R = rng(seed), pos = [], nor = [], hgt = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = R() * Math.PI * 2, r = R() * 0.1, lean = R.range(0.15, 0.6), bh = h * R.range(0.5, 1.15), w = R.range(0.01, 0.018), seg = 5, base = pos.length / 3;
    const ox = Math.cos(a) * r, oz = Math.sin(a) * r, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, bend = lean * u * u * bh, y = bh * u, ww = w * (1 - u * 0.92);
      const cx = ox + dx * bend, cz = oz + dz * bend;
      pos.push(cx - px * ww, y, cz - pz * ww, cx + px * ww, y, cz + pz * ww);
      nor.push(dx * 0.3, 1, dz * 0.3, dx * 0.3, 1, dz * 0.3); hgt.push(u, u);
      if (i < seg) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('hgt', new THREE.Float32BufferAttribute(hgt, 1)); g.setIndex(idx); g.normalizeNormals();
  return g;
}
export function grass({ height, count = 60000, radius = 60, center = [0, 0], clear = [], colors, seed, bladeH = 0.55, wind = 1 }) {
  const g = clumpGeometry(12, bladeH, seed);
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  const U = { uTime: { value: 0 }, uWind: { value: wind }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(0, 0, 0) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float hgt; uniform float uTime, uWind; varying float vH; varying vec3 vGW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vH = hgt;
        vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float ph = ip.x * 0.21 + ip.z * 0.17;
        float gust = sin(uTime * 0.9 + ph * 0.6) * 0.5 + 0.5;
        float sway = (sin(uTime * 1.7 + ph) * 0.6 + sin(uTime * 3.1 + ph * 1.7) * 0.25) * (0.35 + gust * 0.65);
        transformed.x += sway * 0.09 * hgt * hgt * uWind; transformed.z += sway * 0.05 * hgt * hgt * uWind;`);
    // darker and greener at the base, paler at the tips; lit through from behind when the sun is low ahead
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH; varying vec3 vGW; uniform vec3 uSunDir, uSunCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb * vec3(0.26, 0.3, 0.2), diffuseColor.rgb * 1.04 + vec3(0.03, 0.025, 0.0), smoothstep(0.0, 1.0, vH));')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{ vec3 vd = normalize(vGW - cameraPosition); float back = pow(max(dot(vd, uSunDir), 0.0), 5.0); totalEmissiveRadiance += uSunCol * diffuseColor.rgb * back * vH * vH * 0.9; }');
  };
  const mesh = new THREE.InstancedMesh(g, m, count); mesh.receiveShadow = true; mesh.castShadow = true;
  const R = rng(seed + 0.5), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const cA = new THREE.Color(colors[0]), cB = new THREE.Color(colors[1]), cC = new THREE.Color(colors[2] || colors[1]);
  let n = 0;
  for (let tries = 0; n < count && tries < count * 4; tries++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * radius, x = center[0] + Math.cos(a) * r, z = center[1] + Math.sin(a) * r;
    // patchy: clumps thin out where the noise is low, and around the camp
    const patch = fbm2(x * 0.08, z * 0.08, seed + 3, 3);
    let keep = patch * 1.6 - 0.2; for (const c of clear) { const d = Math.hypot(x - c[0], z - c[1]); keep *= Math.min(1, Math.max(0, (d - c[2]) / (c[3] || 3))); }
    if (R() > keep) continue;
    const y = height(x, z); if (y < (colors.waterline ?? -99)) continue;
    q.setFromAxisAngle(up, R() * Math.PI * 2); const sc = R.range(0.6, 1.25) * (0.7 + patch * 0.6); s.set(sc, sc * R.range(0.8, 1.2), sc); p.set(x, y - 0.02, z);
    M.compose(p, q, s); mesh.setMatrixAt(n, M);
    col.copy(cA).lerp(cB, R()).lerp(cC, Math.max(0, patch - 0.55) * 1.5); col.multiplyScalar(R.range(0.85, 1.12)); mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.update = (t) => { U.uTime.value = t; };
  mesh.userData.sun = (dir, col) => { U.uSunDir.value.copy(dir).normalize(); U.uSunCol.value.copy(col); };
  return mesh;
}

// ---------- leaves: a canvas texture of small leaves, cut out with alpha ----------
let LEAF = null;
function leafTexture() {
  if (LEAF) return LEAF;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), R = rng(7);
  x.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const px = 128 + (R() - 0.5) * 230 * Math.sqrt(R()), py = 128 + (R() - 0.5) * 120, a = R() * Math.PI, l = R.range(5, 11);
    const v = R.range(0.55, 1.0); x.fillStyle = `rgb(${Math.round(110 * v)},${Math.round(125 * v)},${Math.round(70 * v)})`;
    x.save(); x.translate(px, py); x.rotate(a); x.beginPath(); x.ellipse(0, 0, l, l * 0.38, 0, 0, Math.PI * 2); x.fill(); x.restore();
  }
  // a few twigs
  x.strokeStyle = 'rgb(70,55,40)'; x.lineWidth = 2; for (let i = 0; i < 10; i++) { x.beginPath(); x.moveTo(128 + (R() - 0.5) * 60, 128 + (R() - 0.5) * 30); x.lineTo(128 + (R() - 0.5) * 220, 128 + (R() - 0.5) * 100); x.stroke(); }
  LEAF = new THREE.CanvasTexture(c); LEAF.colorSpace = THREE.SRGBColorSpace; LEAF.anisotropy = 4;
  return LEAF;
}
function leafMaterial(tint = '#8C9A5C') {
  return new THREE.MeshStandardMaterial({ map: leafTexture(), color: tint, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
}

// ---------- trees ----------
// an umbrella acacia: a leaning trunk that forks into a few limbs, a flat wide crown of leaf cards on top
function tube(points, r0, r1, seg = 10) {
  const curve = new THREE.CatmullRomCurve3(points), g = new THREE.TubeGeometry(curve, 16, 1, seg, false), p = g.attributes.position, n = g.attributes.normal;
  // taper: tube radius 1 scaled by distance along the curve
  const tmp = new THREE.Vector3(), cpts = curve.getSpacedPoints(16);
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / (seg + 1)), u = ring / 16, r = r0 + (r1 - r0) * u, c = cpts[Math.min(16, ring)];
    tmp.set(p.getX(i) - c.x, p.getY(i) - c.y, p.getZ(i) - c.z).multiplyScalar(r); p.setXYZ(i, c.x + tmp.x, c.y + tmp.y, c.z + tmp.z);
  }
  g.computeVertexNormals(); return g;
}
const BARK = () => { const m = new THREE.MeshStandardMaterial({ color: '#4A3F36', roughness: 0.95 });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.6 + 0.6 * fbm3(vP * vec3(18.0, 3.0, 18.0));'); };
  return m; };
export function acacia({ seed, scale = 1, tint = '#7F8E4E' }) {
  const R = rng(seed), grp = new THREE.Group(), bark = BARK(), leaf = leafMaterial(tint);
  const H = R.range(4.5, 7.5) * scale, lean = R.range(-0.4, 0.4), fork = H * R.range(0.35, 0.5);
  const top = new THREE.Vector3(lean * 0.6, fork, R.range(-0.3, 0.3));
  const trunk = new THREE.Mesh(tube([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(lean * 0.2, fork * 0.5, 0), top], 0.22 * scale, 0.15 * scale), bark); trunk.castShadow = trunk.receiveShadow = true; grp.add(trunk);
  const crownR = H * R.range(0.55, 0.85), crownY = H * R.range(0.85, 1.0), ends = [];
  const limbs = 3 + Math.floor(R() * 3);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + R() * 0.8, rr = crownR * R.range(0.35, 0.75), end = new THREE.Vector3(top.x + Math.cos(a) * rr, crownY * R.range(0.82, 1.0), top.z + Math.sin(a) * rr);
    const mid = top.clone().lerp(end, 0.5); mid.y += R.range(0.2, 0.8);
    const limb = new THREE.Mesh(tube([top, mid, end], 0.12 * scale, 0.04 * scale, 8), bark); limb.castShadow = true; grp.add(limb); ends.push(end);
  }
  // the crown: many horizontal-ish leaf cards in a flat layer, thicker in the middle
  const cards = 140 + Math.floor(R() * 80), card = new THREE.PlaneGeometry(1.6 * scale, 0.9 * scale);
  const inst = new THREE.InstancedMesh(card, leaf, cards); inst.castShadow = true; inst.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < cards; i++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(R()) * crownR * 1.05, c = ends[i % ends.length];
    p.set(top.x + Math.cos(a) * r, crownY + (1 - r / crownR) * 0.45 * scale + R.range(-0.35, 0.25) * scale, top.z + Math.sin(a) * r);
    p.lerp(c, 0.15);
    e.set(-Math.PI / 2 + R.range(-0.5, 0.5), R() * Math.PI * 2, R.range(-0.4, 0.4)); q.setFromEuler(e); const k = R.range(0.7, 1.3); s.set(k, k, k);
    M.compose(p, q, s); inst.setMatrixAt(i, M);
  }
  grp.add(inst);
  return grp;
}
// a low bush: a ball of leaf cards
export function bush({ seed, size = 1, tint = '#6E7C45' }) {
  const R = rng(seed), leaf = leafMaterial(tint), n = 26 + Math.floor(R() * 20), inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.9 * size, 0.6 * size), leaf, n);
  inst.castShadow = inst.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = R() * 0.7 * size; p.set(Math.cos(a) * r, (0.25 + R() * 0.6) * size, Math.sin(a) * r * 0.8); e.set(R() * Math.PI, R() * Math.PI, R() * Math.PI); q.setFromEuler(e); M.compose(p, q, s); inst.setMatrixAt(i, M); }
  return inst;
}

// ---------- rocks ----------
export function rock({ seed, size = 1, color = '#8A7F72' }) {
  const R = rng(seed), g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = fbm2(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.3, seed, 4); v.multiplyScalar(0.75 + n * 0.6); p.setXYZ(i, v.x, v.y * 0.65, v.z); }
  g.scale(size * R.range(0.8, 1.3), size, size * R.range(0.8, 1.2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.92 })); m.castShadow = m.receiveShadow = true; m.rotation.y = R() * 6.28;
  return m;
}

// ---------- the far distance: a ring of hills or mountains ----------
// tint: if given (a linear colour, usually a little darker than the horizon), the hills are drawn as hazed
// silhouettes in that colour instead of lit surfaces, the way distant ranges look through air
export function farHills({ seed, radius = 1400, height = 120, color = '#7F8A93', jag = 1, tint = null }) {
  const seg = 256, g = new THREE.CylinderGeometry(radius, radius, 1, seg, 8, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x);
    const hgt = (fbm2(Math.cos(a) * 3 + seed, Math.sin(a) * 3, seed, 5) ** (1.4 * jag)) * height * 1.8;
    p.setY(i, (y + 0.5) * hgt - 8);
  }
  g.computeVertexNormals();
  const m = tint ? new THREE.MeshBasicMaterial({ color: tint, side: THREE.BackSide, fog: false }) : new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float a = atan(vHP.z, vHP.x);
        float scrub = smoothstep(0.45, 0.7, fbm3(vec3(a * 120.0, vHP.y * 0.08, 0.0)));
        float gully = smoothstep(0.55, 0.8, vnoise(vec3(a * 400.0, vHP.y * 0.02, 1.0)));
        float lift = clamp(vHP.y / 150.0, 0.0, 1.0);
        diffuseColor.rgb *= 0.88 + 0.16 * fbm3(vec3(a * 40.0, vHP.y * 0.03, 2.0)) + 0.08 * lift;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.85, scrub * 0.6 + gully * 0.25);`);
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = false;
  return mesh;
}

// ---------- many trees far off: a trunk and a flat dark crown each, instanced, for the depth of a plain ----------
export function farTrees({ height, seed, n = 160, near = 110, far = 900, color = '#4C5634', avoid = () => false }) {
  const R = rng(seed + 0.77), trunk = new THREE.CylinderGeometry(0.12, 0.2, 1, 5); trunk.translate(0, 0.5, 0);
  const crown = new THREE.SphereGeometry(1, 16, 8); { const p = crown.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + (fbm2(v.x * 2 + seed, v.z * 2, seed, 3) - 0.5) * 0.5; p.setXYZ(i, v.x * k, v.y * (v.y > 0 ? 0.32 : 0.12) * k, v.z * k); } crown.computeVertexNormals(); }
  const tm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#3B332B', roughness: 1 }), n);
  const cm = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color, roughness: 1 }), n);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const a = R() * Math.PI * 2, d = near + (far - near) * Math.pow(R(), 0.7), x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (avoid(x, z)) continue; const y = height(x, z), H = R.range(3.5, 7.5), W = R.range(2.5, 5.5);
    q.identity(); s.set(1.3, H * 0.85, 1.3); p.set(x, y, z); M.compose(p, q, s); tm.setMatrixAt(k, M);
    s.set(W, W * R.range(0.8, 1.2), W * R.range(0.8, 1.1)); p.set(x + R.range(-0.4, 0.4), y + H * 0.85, z); M.compose(p, q, s); cm.setMatrixAt(k, M); k++;
  }
  tm.count = cm.count = k; const g = new THREE.Group(); g.add(tm, cm); return g;
}
// ---------- what lies on the ground near people: pebbles, twigs, bits of dry grass ----------
export function litter({ height, seed, radius = 14, center = [0, 0], n = 900, colors = ['#7E7466', '#6B5D4C', '#A08A62'] }) {
  const R = rng(seed + 0.33), grp = new THREE.Group(), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const peb = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), n);
  const twig = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.006, 0.009, 1, 4), new THREE.MeshStandardMaterial({ color: colors[1], roughness: 0.95 }), Math.floor(n / 3));
  const straw = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, 0.002, 1), new THREE.MeshStandardMaterial({ color: colors[2], roughness: 0.9 }), n);
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, r = Math.sqrt(R()) * radius, x = center[0] + Math.cos(a) * r, z = center[1] + Math.sin(a) * r, y = height(x, z);
    const k = R.range(0.006, 0.022) * (R() < 0.06 ? 2.2 : 1); e.set(R() * 3, R() * 3, R() * 3); q.setFromEuler(e); s.set(k, k * 0.6, k * R.range(0.8, 1.3)); p.set(x, y + k * 0.25, z); M.compose(p, q, s); peb.setMatrixAt(i, M);
    col.set(colors[0]).multiplyScalar(R.range(0.85, 1.35)); peb.setColorAt(i, col);
    if (i < twig.count) { const L = R.range(0.08, 0.4); e.set(Math.PI / 2 + R.range(-0.1, 0.1), R() * 6.28, 0); q.setFromEuler(e); s.set(1, L, 1); const x2 = center[0] + Math.cos(a + 1) * r, z2 = center[1] + Math.sin(a + 1) * r; p.set(x2, height(x2, z2) + 0.008, z2); M.compose(p, q, s); twig.setMatrixAt(i, M); }
    { const L = R.range(0.05, 0.18); e.set(0, R() * 6.28, R.range(-0.2, 0.2)); q.setFromEuler(e); s.set(1, 1, L); const x3 = center[0] + Math.cos(a - 1.3) * r * 1.05, z3 = center[1] + Math.sin(a - 1.3) * r * 1.05; p.set(x3, height(x3, z3) + 0.003, z3); M.compose(p, q, s); straw.setMatrixAt(i, M); }
  }
  for (const m of [peb, twig, straw]) { m.castShadow = m === peb; m.receiveShadow = true; m.instanceMatrix.needsUpdate = true; grp.add(m); }
  if (peb.instanceColor) peb.instanceColor.needsUpdate = true;
  return grp;
}

// ---------- air: dust motes that catch a low sun, and now and then birds crossing the sky ----------
export function dust({ center, seed, n = 500, radius = 9, color = '#FFE6C0', strength = 1 }) {
  const R = rng(seed + 0.9), pos = new Float32Array(n * 3), base = [];
  for (let i = 0; i < n; i++) base.push([center[0] + R.range(-radius, radius), R.range(0.2, 3.2), center[1] + R.range(-radius, radius), R() * 6.28, R.range(0.05, 0.25)]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size: 0.012, transparent: true, opacity: 0.55 * strength, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, m);
  pts.userData.update = (t) => { for (let i = 0; i < n; i++) { const [x, y, z, ph, sp] = base[i]; pos[i * 3] = x + Math.sin(t * sp + ph) * 0.4 + t * 0.05; pos[i * 3 + 1] = y + Math.sin(t * sp * 1.3 + ph * 2) * 0.15; pos[i * 3 + 2] = z + Math.cos(t * sp * 0.7 + ph) * 0.4; } g.attributes.position.needsUpdate = true; };
  return pts;
}
export function birds({ seed, n = 5, dist = 120, height = 35, color = '#2A2622' }) {
  const R = rng(seed + 0.4), grp = new THREE.Group(), wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.6, 0, -0.1, 0, 0, -0.15, 0, 0, 0.25, 0.6, 0, -0.1, 0, 0, -0.15], 3));
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }), flock = [];
  const a0 = R() * 6.28, dir = new THREE.Vector3(Math.cos(a0 + 1.7), 0, Math.sin(a0 + 1.7));
  for (let i = 0; i < n; i++) { const b = new THREE.Mesh(wing.clone(), mat); b.userData.off = new THREE.Vector3(R.range(-6, 6), R.range(-2, 2), R.range(-6, 6)); b.userData.ph = R() * 6.28; b.scale.setScalar(R.range(0.9, 1.3)); b.userData.noAO = true; grp.add(b); flock.push(b); }
  const start = new THREE.Vector3(Math.cos(a0) * dist, height, Math.sin(a0) * dist).addScaledVector(dir, -60);
  grp.userData.update = (t) => {
    for (const b of flock) {
      b.position.copy(start).addScaledVector(dir, t * 9).add(b.userData.off);
      b.lookAt(b.position.clone().add(dir)); const f = Math.sin(t * 9 + b.userData.ph) * 0.45, p = b.geometry.attributes.position;
      p.setY(1, f * 0.6); p.setY(4, f * 0.6); p.needsUpdate = true;
    }
  };
  return grp;
}
