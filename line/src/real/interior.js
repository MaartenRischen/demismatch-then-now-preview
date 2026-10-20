// Rooms and the things in them, for the "you, now" scenes: plaster walls, wooden and tiled floors, windows onto a
// night city or a wet street, beds with rumpled duvets, sofas, chairs, desks, kitchens, a fridge with its light on,
// lamps, screens, a classroom, a bus, a meeting room. Everything is built in code; surfaces get their texture from
// noise in the shader (onBeforeCompile), in world or object space, so nothing repeats and nothing is loaded.
// Units are metres. A room's floor is y = 0; furniture faces +z unless it says otherwise.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { NOISE_GLSL } from './wood.js';
import { rng, fbm2, bush } from './nature.js';

let RECT_READY = false;
export function initRectLights() { if (!RECT_READY) { RectAreaLightUniformsLib.init(); RECT_READY = true; } }
// a soft, neutral room environment for the varnish and the glass; scenes turn its intensity right down
const ENVS = new WeakMap();
export function roomEnv(renderer) {
  let e = ENVS.get(renderer); if (e) return e;
  const pm = new THREE.PMREMGenerator(renderer); e = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); ENVS.set(renderer, e); return e;
}

// ---------- shader patching ----------
// Adds world position (vW), object position (vO) and world normal (vNw) to a standard material, then lets a material
// rewrite its colour, roughness, metalness, normal (world-space nW, written back) and emission with GLSL snippets.
const GLSL_UTIL = NOISE_GLSL + `
  float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float vn2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
`;
export function patch(m, key, { uniforms = {}, decl = '', color = '', rough = '', metal = '', normal = '', emit = '' } = {}) {
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vO; varying vec3 vNw;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 _wp = vec4(transformed, 1.0); vec3 _wn = objectNormal;
          #ifdef USE_INSTANCING
            _wp = instanceMatrix * _wp; _wn = mat3(instanceMatrix) * _wn;
          #endif
          vW = (modelMatrix * _wp).xyz; vNw = normalize(mat3(modelMatrix) * _wn); vO = position; }`);
    let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vO; varying vec3 vNw;\n' + GLSL_UTIL + decl);
    if (color) f = f.replace('#include <color_fragment>', '#include <color_fragment>\n' + color);
    if (rough) f = f.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + rough);
    if (metal) f = f.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + metal);
    if (normal) f = f.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { vec3 nW = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        ${normal}
        normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz); }`);
    if (emit) f = f.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + emit);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => key;
  return m;
}
const col = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));
// a world-space bump: tilt nW by the gradient of a height function H(vec3) (GLSL expression in p), k = strength
const bump = (H, e = '0.004', k = '1.0') => `{ vec3 p0 = vW; float e = ${e};
  #define HF(P_) (${H.replace(/\bp\b/g, '(P_)')})
  float c0 = HF(p0); vec3 gr = vec3(HF(p0 + vec3(e, 0, 0)) - c0, HF(p0 + vec3(0, e, 0)) - c0, HF(p0 + vec3(0, 0, e)) - c0) / e;
  #undef HF
  nW = normalize(nW - ${k} * (gr - dot(gr, nW) * nW)); }`;

// ---------- materials ----------
// matte painted plaster: a faint mottle, a trowelled waviness you only see in raking light, fine grit
export function plaster({ color = '#E4DED3', rough = 0.92, mottle = 1, bumpK = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: rough });
  return patch(m, 'plaster', {
    uniforms: { uMot: { value: mottle }, uBk: { value: bumpK } }, decl: 'uniform float uMot, uBk;',
    color: 'diffuseColor.rgb *= 1.0 + uMot * (0.07 * (fbm3(vW * 0.9) - 0.5) + 0.035 * (vnoise(vW * 7.0) - 0.5));',
    normal: bump('(fbm3(p * 3.5) * 0.0012 + vnoise(p * 60.0) * 0.00012) * uBk', '0.004'),
  });
}
// floorboards: staggered planks, each its own tone, grain running along, dark seams, a varnish that catches light
export function floorWood({ a = '#9C6E46', b = '#B98B5C', plank = 0.16, len = 1.6, alongZ = false, rough = 0.42, coat = 0.25 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: rough, clearcoat: coat, clearcoatRoughness: 0.3 });
  return patch(m, 'floorWood', {
    uniforms: { uA: { value: col(a) }, uB: { value: col(b) }, uP: { value: plank }, uL: { value: len }, uZ: { value: alongZ ? 1 : 0 } },
    decl: `uniform vec3 uA, uB; uniform float uP, uL, uZ;
      vec4 plankInfo(vec2 q){ float row = floor(q.y / uP); float a = q.x + h11(row * 7.13) * uL; float seg = floor(a / uL);
        float id = h21(vec2(row, seg)); float fa = fract(a / uL) * uL, fb = fract(q.y / uP) * uP;
        return vec4(min(min(fa, uL - fa), min(fb, uP - fb)), id, fb / uP, row); }`,
    color: `vec2 fq = uZ > 0.5 ? vW.zx : vW.xz; vec4 PL = plankInfo(fq);
      vec3 fc = mix(uA, uB, PL.y); float fg = fbm3(vec3(fq.x * 0.7, fq.y * 26.0, PL.y * 40.0));
      float fl = fract(fq.y * 64.0 + fg * 5.0 + PL.y * 17.0 + sin(fq.x * 2.0 + PL.y * 9.0) * 0.6); fl = smoothstep(0.0, 0.15, fl) * (1.0 - smoothstep(0.25, 0.8, fl));
      fc *= 0.86 + 0.28 * fg - 0.1 * fl; fc *= 0.94 + 0.1 * vnoise(vec3(fq.x * 90.0, fq.y * 900.0, 1.0));
      float seam = 1.0 - smoothstep(0.0005, 0.0016, PL.x); fc *= 1.0 - 0.6 * seam;
      diffuseColor.rgb = fc;`,
    rough: 'roughnessFactor = clamp(roughnessFactor + (PL.y - 0.5) * 0.18 + fl * 0.06 + seam * 0.4 + (fbm3(vW * 2.0) - 0.5) * 0.2, 0.05, 1.0);',
    normal: 'float tilt = (h11(PL.y * 91.0) - 0.5) * 0.03; nW = normalize(nW + (uZ > 0.5 ? vec3(tilt, 0.0, 0.0) : vec3(0.0, 0.0, tilt)) * (1.0 - seam));',
  });
}
// tiles with grout: per-tile tone and a tiny tilt, so the glaze reflection breaks up the way real tiling does.
// plane: 'xz' floor, 'xy' or 'zy' wall
export function tiles({ color = '#D9D6CF', grout = '#9A958C', size = 0.3, sizeY = null, gap = 0.003, plane = 'xz', rough = 0.18, vary = 0.06 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: rough, clearcoat: 0.2 });
  const pq = { xz: 'vW.xz', xy: 'vW.xy', zy: 'vW.zy' }[plane];
  return patch(m, 'tiles' + plane, {
    uniforms: { uC: { value: col(color) }, uG: { value: col(grout) }, uS: { value: new THREE.Vector2(size, sizeY || size) }, uGap: { value: gap }, uV: { value: vary } },
    decl: 'uniform vec3 uC, uG; uniform vec2 uS; uniform float uGap, uV;',
    color: `vec2 tq = ${pq} / uS; vec2 tid = floor(tq), tf = fract(tq) * uS; float tg = min(min(tf.x, uS.x - tf.x), min(tf.y, uS.y - tf.y));
      float gm = 1.0 - smoothstep(uGap * 0.5, uGap * 0.5 + 0.0008, tg);
      vec3 tc = uC * (1.0 + (h21(tid) - 0.5) * uV) * (0.97 + 0.06 * vnoise(vW * 30.0));
      diffuseColor.rgb = mix(tc, uG * (0.9 + 0.2 * vnoise(vW * 80.0)), gm);`,
    rough: 'roughnessFactor = mix(roughnessFactor + (fbm3(vW * 4.0) - 0.5) * 0.08, 0.95, gm);',
    normal: 'vec2 tt = (h22(tid + 7.0) - 0.5) * 0.025; nW = normalize(nW + vec3(tt.x, tt.y, tt.x * tt.y) * (1.0 - gm));',
  });
}
// carpet or a rug: fuzzy, fully rough, a pile that shimmers slightly with tone
export function carpet({ color = '#6C6A66', pile = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  return patch(m, 'carpet', {
    uniforms: { uPile: { value: pile } }, decl: 'uniform float uPile;',
    color: 'float aaC = 1.0 - smoothstep(0.002, 0.006, length(fwidth(vW))); diffuseColor.rgb *= 0.86 + 0.16 * mix(0.5, vnoise(vW * 140.0), aaC) + 0.1 * (fbm3(vW * 2.0) - 0.5) * uPile;',
    normal: bump('vnoise(p * 300.0) * 0.0004', '0.002', '0.6 * aaC'),
  });
}
// upholstery and bedding: sheen at grazing angles, a fine weave, a slight mottle; texture follows the object
export function fabric({ color = '#777570', sheen = 0.6, rough = 0.88, weave = 1, scale = 1 } = {}) {
  const c = col(color), m = new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, sheen, sheenRoughness: 0.6, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.35), side: THREE.DoubleSide });
  return patch(m, 'fabric', {
    uniforms: { uWv: { value: weave }, uSc: { value: scale } }, decl: 'uniform float uWv, uSc;',
    // the weave fades out once a thread is smaller than a pixel, so it never turns into moire
    color: 'float aaW = 1.0 - smoothstep(0.0006, 0.0018, length(fwidth(vW))); diffuseColor.rgb *= 0.93 + 0.08 * fbm3(vO * 6.0 * uSc) + 0.04 * (vnoise(vO * 420.0 * uSc) - 0.5) * uWv * aaW;',
    normal: bump('(sin(p.x * 1400.0) * sin(p.y * 1400.0 + p.z * 1400.0) * 0.00004) * uWv', '0.0008', '0.5 * aaW'),
  });
}
// solid wood furniture: grain along x (or the axis given), satin finish
export function woodFurniture({ color = '#8A5D3B', rough = 0.5, axis = 'x', coat = 0.2, ringsK = 1 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: coat, clearcoatRoughness: 0.4 });
  const sw = { x: 'vO.yzx', y: 'vO.xzy', z: 'vO.xyz' }[axis];
  return patch(m, 'woodF' + axis, {
    uniforms: { uRk: { value: ringsK } }, decl: 'uniform float uRk;',
    color: `vec3 wq = ${sw}; float wg = fbm3(vec3(wq.x * 8.0, wq.y * 8.0, wq.z * 0.6)); float wr = fract(length(wq.xy + 3.0) * 60.0 + wg * 3.0);
      wr = smoothstep(0.0, 0.2, wr) * (1.0 - smoothstep(0.3, 0.85, wr));
      diffuseColor.rgb *= 1.0 - (wr * 0.12 * uRk + (wg - 0.5) * 0.22) - 0.05 * (vnoise(vec3(wq.x * 200.0, wq.y * 200.0, wq.z * 3.0)) - 0.5);`,
    rough: 'roughnessFactor = clamp(roughnessFactor + wr * 0.08, 0.05, 1.0);',
  });
}
// painted or laminated board: near-flat colour, a faint orange-peel finish
export function paint({ color = '#EEEBE4', rough = 0.45, coat = 0, metal = 0 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, clearcoat: coat, metalness: metal });
  return patch(m, 'paint', {
    color: 'diffuseColor.rgb *= 0.985 + 0.03 * vnoise(vW * 5.0);',
    rough: 'roughnessFactor = clamp(roughnessFactor + (vnoise(vW * 40.0) - 0.5) * 0.06, 0.03, 1.0);',
  });
}
export const metal = (color = '#B8B8B4', rough = 0.32) => paint({ color, rough, metal: 1 });
export const plastic = (color = '#E6E4DE', rough = 0.38) => paint({ color, rough, coat: 0.1 });
export function glass({ color = '#ffffff', opacity = 0.12, rough = 0.03, env = 1 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color, roughness: rough, metalness: 0, transparent: true, opacity, envMapIntensity: env, depthWrite: false, side: THREE.DoubleSide });
  m.userData.noDepth = true; return m;
}
// a glowing surface with no shading of its own (bulbs, diffusers); value is linear HDR, > 3 blooms
export function glow(color = '#FFD7A0', value = 1) { const m = new THREE.MeshBasicMaterial({ color: col(color).multiplyScalar(value) }); m.toneMapped = false; return m; }

// ---------- geometry ----------
const RB = new Map();
export function rbox(w, h, d, r = 0.01, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const k = [w, h, d, r, seg].map((v) => +v.toFixed(4)).join(); let g = RB.get(k);
  if (!g) { g = new RoundedBoxGeometry(w, h, d, seg, r); RB.set(k, g); }
  return g;
}
export function mesh(geo, mat, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, cast = true, recv = true, parent = null } = {}) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = cast; o.receiveShadow = recv; if (parent) parent.add(o); return o;
}
// a box sitting on y (its bottom), centred in x and z
export const block = (parent, mat, w, h, d, x, y, z, r = 0.006, o = {}) => mesh(rbox(w, h, d, r), mat, x, y + h / 2, z, { parent, ...o });
// a soft cushion or pillow: a superellipsoid, boxy at the edges, puffed in the middle, with a few dents
export function cushionGeo(w, h, d, { round = 0.22, puff = 0.35, dent = 0.12, seed = 1, seg = 40 } = {}) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7)), p = g.attributes.position, R = rng(seed), dents = [];
  for (let i = 0; i < 3; i++) dents.push([R.range(-0.6, 0.6), R.range(-0.6, 0.6), R.range(0.25, 0.5), R.range(0.3, 1) * dent]);
  const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const sx = sp(x, round), sz = sp(z, round), body = (1 - sx * sx * sx * sx) * (1 - sz * sz * sz * sz);
    let yy = sp(y, 0.7) * (1 - puff + puff * Math.max(0, body));
    for (const [dx, dz, r, a] of dents) { const dd = Math.hypot(sx - dx, sz - dz) / r; if (dd < 1 && y > 0) yy -= a * (1 - dd * dd) ** 2; }
    p.setXYZ(i, sx * w / 2, yy * h / 2, sz * d / 2);
  }
  g.computeVertexNormals(); return g;
}
function lathe(profile, segs = 40) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), segs); }
const cyl = (r0, r1, h, s = 24) => new THREE.CylinderGeometry(r0, r1, h, s);

// ---------- the room shell ----------
// walls are extruded with their thickness, so windows and doors have real reveals. Holes: { wall: 'back'|'front'|
// 'left'|'right', at: position along the wall in room coordinates (x for back/front, z for left/right), y0, w, h }.
// A hole with y0 = 0 is a doorway. open: walls left out (the camera usually stands where the front wall would be).
const WALLS = {
  back: { rot: 0, pos: (w, d) => [0, -d / 2], u: (a) => a, len: (w, d, t) => w + 2 * t },
  front: { rot: Math.PI, pos: (w, d) => [0, d / 2], u: (a) => -a, len: (w, d, t) => w + 2 * t },
  left: { rot: Math.PI / 2, pos: (w, d) => [-w / 2, 0], u: (a) => -a, len: (w, d) => d },
  right: { rot: -Math.PI / 2, pos: (w, d) => [w / 2, 0], u: (a) => a, len: (w, d) => d },
};
export function room({ w = 4, d = 4, h = 2.6, wall = plaster(), floor = floorWood(), ceiling = null, thick = 0.14, holes = [], open = [], skirting = '#ECEAE4', skirtH = 0.09, walls = {} } = {}) {
  const g = new THREE.Group(), ceil = ceiling || plaster({ color: '#E9E7E2', mottle: 0.5 });
  const fl = mesh(new THREE.PlaneGeometry(w + 2 * thick + 0.02, d + 2 * thick + 0.02), floor, 0, 0, 0, { rx: -Math.PI / 2, parent: g, cast: true });
  const cl = mesh(new THREE.PlaneGeometry(w + 2 * thick, d + 2 * thick), ceil, 0, h, 0, { rx: Math.PI / 2, parent: g, cast: true });
  const skMat = paint({ color: skirting, rough: 0.4 });
  const frames = {};
  for (const [name, W] of Object.entries(WALLS)) {
    const L = W.len(w, d, thick), [px, pz] = W.pos(w, d);
    const frame = new THREE.Group(); frame.position.set(px, 0, pz); frame.rotation.y = W.rot; g.add(frame); frames[name] = frame;
    if (open.includes(name)) continue;
    const hs = holes.filter((o) => o.wall === name).map((o) => ({ ...o, u: W.u(o.at) }));
    const doors = hs.filter((o) => o.y0 <= 0.001).sort((a, b) => a.u - b.u), wins = hs.filter((o) => o.y0 > 0.001);
    const s = new THREE.Shape(); s.moveTo(-L / 2, 0);
    for (const o of doors) { s.lineTo(o.u - o.w / 2, 0); s.lineTo(o.u - o.w / 2, o.h); s.lineTo(o.u + o.w / 2, o.h); s.lineTo(o.u + o.w / 2, 0); }
    s.lineTo(L / 2, 0); s.lineTo(L / 2, h); s.lineTo(-L / 2, h); s.lineTo(-L / 2, 0);
    for (const o of wins) { const p = new THREE.Path(); p.moveTo(o.u - o.w / 2, o.y0); p.lineTo(o.u - o.w / 2, o.y0 + o.h); p.lineTo(o.u + o.w / 2, o.y0 + o.h); p.lineTo(o.u + o.w / 2, o.y0); p.lineTo(o.u - o.w / 2, o.y0); s.holes.push(p); }
    const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 1 }); geo.translate(0, 0, -thick);
    mesh(geo, walls[name] || wall, 0, 0, 0, { parent: frame });
    // skirting along the foot of the wall, broken by doorways
    if (skirting) {
      let u0 = -L / 2 + (name === 'back' || name === 'front' ? thick : 0); const ends = [];
      for (const o of doors) { ends.push([u0, o.u - o.w / 2]); u0 = o.u + o.w / 2; }
      ends.push([u0, L / 2 - (name === 'back' || name === 'front' ? thick : 0)]);
      for (const [a, b] of ends) if (b - a > 0.02) block(frame, skMat, b - a, skirtH, 0.016, (a + b) / 2, 0, 0.008, 0.003);
    }
  }
  // put something on a wall: a group whose origin is on the inner face at `at` along the wall and height y, +z into the room
  const onWall = (name, at, y = 0, out = 0) => { const o = new THREE.Group(); o.position.set(WALLS[name].u(at), y, out); frames[name].add(o); return o; };
  return { group: g, floor: fl, ceiling: cl, onWall, frames, w, d, h, thick };
}
// a window in a hole: frame, glazing bars, glass, an inner sill. Built in the wall's space (see room.onWall), origin at
// the hole's bottom centre on the inner face.
export function windowUnit({ w = 1.2, h = 1.4, thick = 0.14, frame = 0.055, cols = 2, rows = 1, color = '#EFEDE8', sill = true, glassOpacity = 0.1, inset = 0.6 } = {}) {
  const g = new THREE.Group(), fm = paint({ color, rough: 0.35, coat: 0.15 }), z = -thick * inset, fd = 0.07;
  block(g, fm, w, frame, fd, 0, 0, z); block(g, fm, w, frame, fd, 0, h - frame, z);
  block(g, fm, frame, h, fd, -w / 2 + frame / 2, 0, z); block(g, fm, frame, h, fd, w / 2 - frame / 2, 0, z);
  for (let i = 1; i < cols; i++) block(g, fm, frame * 0.8, h, fd * 0.9, -w / 2 + (w * i) / cols, 0, z);
  for (let i = 1; i < rows; i++) block(g, fm, w, frame * 0.8, fd * 0.9, 0, (h * i) / rows - frame * 0.4, z);
  const gl = mesh(new THREE.PlaneGeometry(w - frame, h - frame), glass({ opacity: glassOpacity }), 0, h / 2, z, { parent: g, cast: false, recv: false });
  if (sill) block(g, paint({ color: '#F1EFEA', rough: 0.3, coat: 0.2 }), w + 0.12, 0.025, thick * (1 - inset) + 0.06, 0, -0.025, (-thick * (1 - inset)) / 2 + 0.03 + 0.005, 0.004);
  g.userData.glass = gl;
  return g;
}
// venetian blinds over a window: slats that cast striped shadows. open: slat angle (0 flat, 1.3 nearly closed)
export function blinds({ w = 1.2, h = 1.4, open = 0.55, color = '#D8D5CE', pitch = 0.025, drop = 1 } = {}) {
  const g = new THREE.Group(), m = paint({ color, rough: 0.5 }), n = Math.floor((h * drop) / pitch), slat = new THREE.BoxGeometry(w, 0.0012, 0.026);
  const inst = new THREE.InstancedMesh(slat, m, n); inst.castShadow = true; inst.receiveShadow = true;
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) { e.set(open + Math.sin(i * 1.7) * 0.03, 0, Math.sin(i * 0.7) * 0.002); q.setFromEuler(e); M.compose(new THREE.Vector3(0, h - i * pitch - 0.03, 0), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, M); }
  g.add(inst);
  block(g, m, w + 0.02, 0.035, 0.04, 0, h - 0.03, 0, 0.005); block(g, m, w, 0.015, 0.03, 0, h - n * pitch - 0.04, 0, 0.004);
  return g;
}
// curtains: a pleated wave hanging from a rail; gather < 1 bunches them to one side
export function curtain({ w = 0.8, h = 2.2, color = '#5D6670', folds = 9, depth = 0.05, seed = 1 } = {}) {
  const geo = new THREE.PlaneGeometry(w, h, folds * 8, 24), p = geo.attributes.position, R = rng(seed), ph = R() * 6;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), u = (x / w + 0.5) * folds * Math.PI * 2; p.setZ(i, Math.sin(u + ph) * depth * (0.8 + 0.2 * Math.sin(y * 3 + R() * 0.2)) + Math.sin(x * 9 + y * 2) * 0.006); }
  geo.translate(0, -h / 2, 0); geo.computeVertexNormals();
  const m = mesh(geo, fabric({ color, sheen: 0.4, rough: 0.9 }), 0, 0, 0); return m;
}

// ---------- outside: night city, streets, sky ----------
// a dome for an urban night: no stars, a navy zenith, a sodium-orange glow of light pollution at the horizon,
// low cloud lit from below
export function citySky({ zenith = '#03050C', horizon = '#2A1A10', glow = 1, clouds = 0.6, dusk = 0 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uZ: { value: col(zenith) }, uH: { value: col(horizon) }, uG: { value: glow }, uC: { value: clouds }, uT: { value: 0 }, uDusk: { value: dusk } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 uZ, uH; uniform float uG, uC, uT, uDusk; ${NOISE_GLSL}
      void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0);
        vec3 c = mix(uH * uG, uZ, pow(smoothstep(0.0, 0.45, y), 0.6));
        vec2 q = d.xz / (d.y + 0.08); float cl = fbm3(vec3(q * 0.9 + vec2(uT * 0.004, 0.0), 1.0)); cl = smoothstep(0.42, 0.85, cl) * uC;
        c += uH * uG * cl * 1.6 * (1.0 - smoothstep(0.0, 0.6, y)) + uZ * cl * 0.6;
        c = mix(c, uH * uG * 1.2, (1.0 - smoothstep(-0.02, 0.06, d.y)));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), mat); dome.frustumCulled = false; dome.renderOrder = -1;
  dome.userData.update = (t) => { mat.uniforms.uT.value = t; };
  return dome;
}
// buildings as instanced boxes whose faces are covered in a grid of windows, some lit (warm, cool, a few with a TV's
// blue), some floors dark. The grid fades to its average when a window shrinks below a pixel, so a far city does not
// shimmer. list: [{ x, z, w, d, h, rot }]
export function buildings(list, { lit = 0.32, facade = '#3A3835', floorH = 3.0, bright = 1, shops = 0, seed = 1, street = 0 } = {}) {
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  const m = new THREE.MeshStandardMaterial({ color: facade, roughness: 0.85 });
  const U = { uLit: { value: lit }, uFH: { value: floorH }, uBr: { value: bright }, uShop: { value: shops }, uT: { value: 0 }, uSeed: { value: seed }, uSt: { value: street } };
  patch(m, 'buildings', {
    uniforms: U, decl: `uniform float uLit, uFH, uBr, uShop, uT, uSeed, uSt;
      vec4 winAt(vec2 f, float bid, float side, out float gl){
        float sp = mix(1.5, 2.7, h11(bid * 1.7)), wf = mix(0.38, 0.72, h11(bid * 3.1)), hf = mix(0.42, 0.7, h11(bid * 5.3));
        vec2 cell = vec2(f.x / sp + h11(bid) * 7.0, (f.y - uSt - 0.4) / uFH); vec2 id = floor(cell), fr = fract(cell);
        vec2 fw = fwidth(cell) + 1e-4;
        float wx = smoothstep(0.5 - wf * 0.5 - fw.x, 0.5 - wf * 0.5 + fw.x, fr.x) * (1.0 - smoothstep(0.5 + wf * 0.5 - fw.x, 0.5 + wf * 0.5 + fw.x, fr.x));
        float wy = smoothstep(0.32 - fw.y, 0.32 + fw.y, fr.y) * (1.0 - smoothstep(0.32 + hf - fw.y, 0.32 + hf + fw.y, fr.y));
        float win = wx * wy; gl = win;
        float flo = h21(vec2(id.y, bid * 3.3 + side)); float floorOn = step(0.18, flo);
        float r = h21(id + vec2(bid * 13.7 + side * 7.1 + uSeed, bid * 2.9));
        float on = step(r, uLit * mix(0.45, 1.6, h11(bid * 9.2))) * floorOn * step(0.0, id.y);
        float k = h21(id * 1.31 + bid); vec3 lc = k < 0.62 ? vec3(1.0, 0.62, 0.3) : k < 0.86 ? vec3(0.95, 0.85, 0.7) : k < 0.95 ? vec3(0.78, 0.86, 1.0) : vec3(0.35, 0.5, 1.0);
        float b = mix(0.25, 1.4, h21(id + 3.7 + bid)) * (0.55 + 0.45 * smoothstep(0.32, 0.32 + hf, fr.y));
        // inside a lit window: a curtain drawn across part of it, a glazing bar, a darker lower half where furniture stands
        float wu = (fr.x - 0.5 + wf * 0.5) / wf, wv = (fr.y - 0.32) / hf, ch = h21(id + 5.1 + bid);
        b *= ch < 0.35 ? mix(0.25, 1.0, smoothstep(0.55, 0.62, wu)) : ch < 0.55 ? mix(1.0, 0.3, smoothstep(0.3, 0.36, wu)) : 1.0;
        b *= 1.0 - 0.75 * (1.0 - smoothstep(0.0, max(fw.x * 2.0, 0.015), abs(wu - 0.5))) * step(0.5, h11(bid * 2.2));
        b *= mix(0.6, 1.0, smoothstep(0.15, 0.45, wv));
        if (k > 0.95) b *= 0.7 + 0.3 * sin(uT * 7.0 + bid * 5.0 + id.x) * sin(uT * 3.1 + id.y);
        vec3 e = lc * b * on * win;
        float far = smoothstep(0.2, 0.6, max(fw.x, fw.y));
        vec3 avg = vec3(0.95, 0.68, 0.4) * 0.75 * uLit * wf * hf;
        return vec4(mix(e, avg, far), mix(win, wf * hf, far));
      }`,
    color: `vec3 bn = normalize(vNw); float bidC = h21(floor(vW.xz / 7.0) + uSeed); float glz = 0.0;
      if (bn.y < 0.5) { vec2 bf = abs(bn.x) > 0.5 ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y); vec4 W = winAt(bf, vBid, bn.x + bn.z * 2.0, glz); }
      diffuseColor.rgb *= (1.0 - glz * 0.8) * (0.8 + 0.4 * h11(vBid * 4.4));`,
    rough: 'roughnessFactor = mix(roughnessFactor, 0.12, glz);',
    emit: `{ vec3 bn2 = normalize(vNw); if (bn2.y < 0.5) { float g2; vec2 bf2 = abs(bn2.x) > 0.5 ? vec2(vW.z, vW.y) : vec2(vW.x, vW.y);
        vec4 W2 = winAt(bf2, vBid, bn2.x + bn2.z * 2.0, g2); totalEmissiveRadiance += W2.rgb * uBr;
        totalEmissiveRadiance += vec3(1.0, 0.75, 0.45) * uShop * step(vW.y - uSt, 3.2) * step(0.6, vW.y - uSt) * (0.6 + 0.4 * vn2(vW.xz * 0.3)) * step(0.4, vn2(vec2(vW.x + vW.z, 1.0) * 0.12)); } }`,
  });
  // the building id rides on the instance position
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBid;').replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\n vBid = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453) * 97.0;\n#else\n vBid = 1.0;\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBid;'); };
  const inst = new THREE.InstancedMesh(g, m, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((b, i) => { q.setFromEuler(e.set(0, b.rot || 0, 0)); M.compose(new THREE.Vector3(b.x, b.y || 0, b.z), q, new THREE.Vector3(b.w, b.h, b.d)); inst.setMatrixAt(i, M); });
  inst.castShadow = false; inst.receiveShadow = true; inst.frustumCulled = false;
  inst.userData.update = (t) => { U.uT.value = t; };
  return inst;
}
// a field of towers for a city seen from high up: blocks along a street grid, taller towards a centre
export function cityField({ seed = 3, cx = 0, cz = -900, radius = 1400, count = 2600, minH = 12, maxH = 140, block = 70, avoid = null } = {}) {
  const R = rng(seed), list = [];
  for (let i = 0; i < count * 3 && list.length < count; i++) {
    const x = cx + R.range(-radius, radius), z = cz + R.range(-radius, radius * 0.6);
    const bx = Math.floor(x / block), bz = Math.floor(z / block), fx = x - bx * block, fz = z - bz * block;
    if (fx < 14 || fz < 14) continue; // streets
    if (avoid && avoid(x, z)) continue;
    const dc = Math.hypot(x - cx * 0.6, z - (cz - 300)) / radius, tall = Math.pow(Math.max(0, 1 - dc), 2.2);
    const h = minH + (maxH - minH) * Math.min(1, tall * R.range(0.3, 1.3) + (R() < 0.04 ? R.range(0.3, 0.8) : 0));
    const w = R.range(14, 34), d = R.range(14, 34);
    list.push({ x: bx * block + 14 + Math.min(fx - 14, block - 14 - w / 2), z: bz * block + 14 + Math.min(fz - 14, block - 14 - d / 2), w, d, h, rot: 0 });
  }
  return list;
}
// the city floor seen from above: dark blocks, streets traced by sodium lamps, car lights moving along them
export function cityGround({ size = 6000, block = 70, y = 0, seed = 2 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#0C0B0A', roughness: 0.95 });
  const U = { uT: { value: 0 }, uB: { value: block } };
  patch(m, 'cityGround', {
    uniforms: U, decl: `uniform float uT, uB;
      float lampsAlong(float a, float across, float sp){ float c = fract(a / sp) - 0.5; float fw = fwidth(a / sp) + 1e-4; return smoothstep(0.08 + fw, 0.0, abs(c)) * smoothstep(3.0, 0.0, abs(across)); }`,
    emit: `{ vec2 g = vW.xz / uB; vec2 f = fract(g) * uB; vec2 id = floor(g);
        float sx = f.x - 7.0, sz = f.y - 7.0; float on = 0.0; vec3 e = vec3(0.0);
        float fwx = fwidth(vW.x) + 1e-3;
        float streetX = smoothstep(7.0 + fwx, 7.0 - fwx, abs(sx)), streetZ = smoothstep(7.0 + fwx, 7.0 - fwx, abs(sz));
        e += vec3(1.0, 0.55, 0.2) * 0.05 * max(streetX, streetZ);
        float l1 = lampsAlong(vW.z, abs(sx) - 6.0, 28.0) + lampsAlong(vW.x, abs(sz) - 6.0, 28.0);
        e += vec3(1.0, 0.58, 0.22) * 2.2 * l1 * (0.7 + 0.6 * h21(id));
        float lane = fract(vW.z / 9.0 + uT * 0.9 * (h21(vec2(id.x, 3.0)) * 2.0 - 1.0)) ; float car = smoothstep(0.06, 0.0, abs(lane - 0.5)) * smoothstep(2.0, 0.0, abs(sx)) * step(0.55, h21(vec2(id.x, floor(vW.z / 9.0 + uT * 0.9))));
        float lane2 = fract(vW.x / 9.0 + uT * 0.8 * (h21(vec2(id.y, 5.0)) * 2.0 - 1.0)); float car2 = smoothstep(0.06, 0.0, abs(lane2 - 0.5)) * smoothstep(2.0, 0.0, abs(sz)) * step(0.55, h21(vec2(id.y, floor(vW.x / 9.0 + uT * 0.8))));
        e += (sx > 0.0 ? vec3(1.0, 0.92, 0.8) : vec3(1.0, 0.1, 0.05)) * 2.0 * car + (sz > 0.0 ? vec3(1.0, 0.92, 0.8) : vec3(1.0, 0.1, 0.05)) * 2.0 * car2;
        float far = smoothstep(0.15, 0.5, fwidth(vW.x / 28.0)); e = mix(e, vec3(1.0, 0.6, 0.25) * 0.35 * max(streetX, streetZ), far);
        totalEmissiveRadiance += e; }`,
  });
  const g = mesh(new THREE.PlaneGeometry(size, size), m, 0, y, -size * 0.3, { rx: -Math.PI / 2, cast: false });
  g.userData.update = (t) => { U.uT.value = t; };
  return g;
}
// a street lamp: a pole, a head with a glowing lens, and the cone of light it throws
export function streetLamp({ h = 6, color = '#FF9A45', intensity = 60, arm = 1.0, shadow = false, lens = 14 } = {}) {
  const g = new THREE.Group(), m = metal('#2C2E30', 0.5);
  mesh(cyl(0.06, 0.09, h, 12), m, 0, h / 2, 0, { parent: g });
  mesh(cyl(0.04, 0.04, arm, 8), m, arm / 2, h - 0.05, 0, { rz: Math.PI / 2, parent: g });
  block(g, m, 0.5, 0.1, 0.22, arm, h - 0.15, 0, 0.03);
  mesh(new THREE.PlaneGeometry(0.4, 0.16), glow(color, lens), arm, h - 0.155, 0, { rx: Math.PI / 2, parent: g, cast: false });
  const sl = new THREE.SpotLight(color, intensity, 40, 1.1, 0.7, 2); sl.position.set(arm, h - 0.2, 0); sl.target.position.set(arm, 0, 0); g.add(sl, sl.target);
  if (shadow) { sl.castShadow = true; sl.shadow.mapSize.set(1024, 1024); sl.shadow.bias = -0.0005; sl.shadow.radius = 3; }
  g.userData.light = sl;
  return g;
}
// a soft glow sprite for a light seen through haze or wet glass
let HALO = null;
export function halo(color = '#FFA050', size = 1, value = 1) {
  if (!HALO) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.12, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); HALO = new THREE.CanvasTexture(c); }
  const m = new THREE.SpriteMaterial({ map: HALO, color: col(color).multiplyScalar(value), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  m.userData.noDepth = true;
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}
// rain on a window pane: beads that catch the light outside (brightest where a lamp shows through), runs that slide
// down leaving a wet track. Additive, sits just inside the glass. light: the lamp's position on the pane in uv.
export function rainGlass({ w = 1.2, h = 1.4, amount = 1, color = '#FFA050', room = '#FFE6C8' } = {}) {
  const U = { uT: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) }, uL: { value: new THREE.Vector2(0.5, 0.6) }, uLC: { value: col(color) }, uRC: { value: col(room) }, uAmt: { value: amount } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uAmt; uniform vec2 uSize, uL; uniform vec3 uLC, uRC;
      float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
      // one layer of static beads; returns (bead, rim, highlight)
      vec3 beads(vec2 p, float cell, float dens){ vec2 g = p / cell, id = floor(g), f = fract(g) - 0.5; vec2 o = (h22(id) - 0.5) * 0.6;
        float r = mix(0.12, 0.36, h21(id + 4.0)) * step(1.0 - dens, h21(id + 9.0)); vec2 q = (f - o) * vec2(1.0, 0.85); float d = length(q) / max(r, 1e-3);
        float b = smoothstep(1.0, 0.8, d) * step(0.001, r); float hl = smoothstep(0.32, 0.0, length(q - vec2(-0.32, 0.36) * r) / max(r, 1e-3)) * b;
        return vec3(b, b * smoothstep(0.55, 1.0, d), hl); }
      void main(){
        vec2 p = vUv * uSize; vec3 b1 = beads(p, 0.026, 0.3 * uAmt), b2 = beads(p + 3.1, 0.014, 0.22 * uAmt), b3 = beads(p + 7.7, 0.05, 0.14 * uAmt);
        float bead = max(max(b1.x, b2.x), b3.x), rim = max(max(b1.y, b2.y), b3.y), hl = max(max(b1.z, b2.z), b3.z);
        // runs: a few columns where a drop slides down, a wet track above it
        float colW = 0.06; float cx = floor(p.x / colW); float fx = fract(p.x / colW) - 0.5; float hs = h21(vec2(cx, 1.0));
        float run = 0.0, track = 0.0;
        if (hs > 1.0 - 0.3 * uAmt) { float sp = mix(0.04, 0.16, h21(vec2(cx, 2.0))); float yy = fract(-uT * sp + h21(vec2(cx, 3.0))) * (uSize.y + 0.3) - 0.15;
          float wob = sin(p.y * 40.0 + cx) * 0.08; float dx = abs(fx - wob);
          float dy = p.y - yy; run = smoothstep(0.22, 0.12, dx) * smoothstep(0.007, 0.0, abs(dy) - 0.004);
          track = smoothstep(0.1, 0.0, dx) * step(0.0, dy) * exp(-dy * 3.0) * 0.5; }
        bead = max(bead, run);
        vec2 dl = (vUv - uL) * uSize; float dist2 = dot(dl, dl);
        float nearL = exp(-dist2 / 0.004) * 3.0 + exp(-dist2 / 0.05) * 0.5;
        vec3 c = uLC * (bead * 0.6 + rim * 0.9) * nearL + uRC * hl * 0.3 + uRC * rim * 0.015 + uLC * track * nearL * 0.4;
        c += uLC * exp(-dist2 / 0.02) * 0.18 * uAmt; // the wet pane smears the lamp into a soft glow
        gl_FragColor = vec4(c, 1.0); }`,
  });
  mat.userData.noDepth = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.renderOrder = 2;
  m.userData.update = (t) => { U.uT.value = t; };
  m.userData.U = U;
  return m;
}

// ---------- more materials ----------
// a speckled stone or composite worktop
export function stone({ color = '#3B3936', fleck = '#8A8680', rough = 0.3 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: rough, clearcoat: 0.3 });
  return patch(m, 'stone', {
    uniforms: { uC: { value: col(color) }, uF: { value: col(fleck) } }, decl: 'uniform vec3 uC, uF;',
    color: 'float sn = vnoise(vW * 220.0), sm = fbm3(vW * 6.0); diffuseColor.rgb = mix(uC * (0.85 + 0.3 * sm), uF, smoothstep(0.78, 0.86, sn) * 0.7);',
    rough: 'roughnessFactor = clamp(roughnessFactor + (sm - 0.5) * 0.2, 0.05, 1.0);',
  });
}
// vinyl flooring with flecks (bus, classroom)
export function vinyl({ color = '#5A5E62', fleck = '#B9B4A8', rough = 0.55 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: rough });
  return patch(m, 'vinyl', {
    uniforms: { uC: { value: col(color) }, uF: { value: col(fleck) } }, decl: 'uniform vec3 uC, uF;',
    color: 'float vn = vnoise(vW * 160.0); diffuseColor.rgb = mix(uC * (0.9 + 0.2 * fbm3(vW * 1.5)), uF, step(0.86, vn) * 0.5);',
    rough: 'roughnessFactor = clamp(roughnessFactor + (fbm3(vW * 3.0) - 0.5) * 0.3, 0.1, 1.0);',
  });
}
// bus-seat moquette: a busy small pattern of dots and dashes in a few colours
export function moquette({ a = '#1F2A44', b = '#3E5A8A', c = '#C9A43A' } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.95, sheen: 0.5, sheenColor: new THREE.Color('#8090B0'), side: THREE.DoubleSide });
  return patch(m, 'moquette', {
    uniforms: { uA: { value: col(a) }, uB: { value: col(b) }, uC: { value: col(c) } }, decl: 'uniform vec3 uA, uB, uC;',
    color: `vec2 mq = (vO.xy + vO.zz * 0.7) * 38.0; vec2 mi = floor(mq), mf = fract(mq) - 0.5; float mh = h21(mi);
      vec3 mc = uA; if (length(mf) < 0.28) mc = mh < 0.3 ? uB : mh < 0.4 ? uC : uA; diffuseColor.rgb = mc * (0.9 + 0.2 * vnoise(vO * 300.0));`,
  });
}

// ---------- screens ----------
// No readable text, no brands: interfaces are drawn as blocks, bars and soft pictures.
const TEX = new Map();
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function rr(x, X, Y, W, H, r) { x.beginPath(); x.roundRect(X, Y, W, H, r); x.fill(); }
// a soft "photo": a gradient sky or room, blobs of colour, optionally a few small figures together
function photo(x, X, Y, W, H, R, { figures = 0, warm = false } = {}) {
  const pal = warm ? [['#F2A65A', '#7A3B2E'], ['#F7C873', '#B4553A'], ['#E98A6B', '#5E2E3A']] : [['#7FC4E8', '#2F7FA8'], ['#F6B26B', '#C2544E'], ['#9AD38A', '#3D7A4A'], ['#F3D9A4', '#D98C5F'], ['#C9A3E6', '#5A4C9C'], ['#86E0D2', '#2C8C88'], ['#FFD36E', '#E0703A']];
  const [a, b] = pal[Math.floor(R() * pal.length)], gr = x.createLinearGradient(0, Y, 0, Y + H);
  gr.addColorStop(0, a); gr.addColorStop(1, b); x.fillStyle = gr; x.fillRect(X, Y, W, H);
  x.save(); x.beginPath(); x.rect(X, Y, W, H); x.clip();
  for (let i = 0; i < 4; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 255 : 30},${Math.floor(R() * 255)},${Math.floor(R() * 200)},0.25)`; x.beginPath(); x.ellipse(X + R() * W, Y + H * (0.4 + R() * 0.6), W * (0.15 + R() * 0.3), H * (0.1 + R() * 0.2), 0, 0, 7); x.fill(); }
  for (let i = 0; i < figures; i++) {
    const fx = X + W * (0.18 + (0.64 * i) / Math.max(1, figures - 1)) + (R() - 0.5) * 4, fy = Y + H * 0.42 + (R() - 0.5) * H * 0.05, s = W / (figures * 2.4);
    x.fillStyle = `rgba(${40 + R() * 40},${25 + R() * 25},${30 + R() * 30},0.85)`; x.beginPath(); x.arc(fx, fy, s * 0.42, 0, 7); x.fill(); rr(x, fx - s * 0.62, fy + s * 0.5, s * 1.24, H * 0.6, s * 0.5);
  }
  if (figures) { x.fillStyle = 'rgba(255,240,200,0.5)'; for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(X + R() * W, Y + R() * H * 0.3, 1.5 + R() * 2, 0, 7); x.fill(); } }
  x.restore();
}
function screenCanvas(kind, seed) {
  const R = rng(seed);
  if (kind === 'feed' || kind === 'feedDim') { // a grid of bright tiles, a bar above each run of them; tall so it scrolls
    const [c, x] = cv(256, 1024); x.fillStyle = kind === 'feed' ? '#F4F4F2' : '#16181C'; x.fillRect(0, 0, 256, 1024);
    for (let y = 0; y < 1024;) {
      if (R() < 0.35) { x.fillStyle = kind === 'feed' ? '#D9D9D6' : '#3A3E45'; x.beginPath(); x.arc(20, y + 18, 11, 0, 7); x.fill(); rr(x, 38, y + 10, 90, 7, 3); rr(x, 38, y + 21, 60, 6, 3); y += 38; photo(x, 0, y, 256, 240, R); y += 244; continue; }
      for (let i = 0; i < 3; i++) photo(x, i * 86, y, 84, 84, R); y += 86;
    }
    return c;
  }
  if (kind === 'photo') { // one photo of people together, in a dark app frame
    const [c, x] = cv(256, 512); x.fillStyle = '#0E0F12'; x.fillRect(0, 0, 256, 512);
    x.fillStyle = '#2A2C31'; x.beginPath(); x.arc(22, 96, 12, 0, 7); x.fill(); rr(x, 42, 88, 80, 8, 4); rr(x, 42, 100, 50, 6, 3);
    photo(x, 0, 120, 256, 256, R, { figures: 5, warm: true });
    x.fillStyle = '#4A4D55'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(20 + i * 30, 398, 9, 0, 7); x.fill(); }
    rr(x, 12, 420, 180, 7, 3); rr(x, 12, 434, 130, 7, 3);
    return c;
  }
  if (kind === 'news') { // dark cards with grey bars and stark thumbnails
    const [c, x] = cv(256, 1024); x.fillStyle = '#101114'; x.fillRect(0, 0, 256, 1024);
    for (let y = 6; y < 1024; y += 128) {
      x.fillStyle = '#1C1E23'; rr(x, 6, y, 244, 120, 8);
      const tones = ['#7A2A22', '#4C5560', '#A5503A', '#2F3A48', '#6A6A6A', '#B88A3A']; x.fillStyle = tones[Math.floor(R() * tones.length)]; rr(x, 14, y + 10, 90, 100, 6);
      x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.ellipse(14 + 45 + (R() - 0.5) * 30, y + 70, 30, 20, 0, 0, 7); x.fill();
      x.fillStyle = '#C9CBD0'; rr(x, 114, y + 16, 120, 9, 4); rr(x, 114, y + 31, 100, 9, 4); x.fillStyle = '#6B6F78'; rr(x, 114, y + 52, 110, 6, 3); rr(x, 114, y + 64, 90, 6, 3); rr(x, 114, y + 92, 40, 6, 3);
    }
    return c;
  }
  if (kind === 'alarm') { // an alarm going off: a dark screen, a big ring, a bright pill to swipe
    const [c, x] = cv(256, 512), gr = x.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#1A2238'); gr.addColorStop(1, '#3A2A3E'); x.fillStyle = gr; x.fillRect(0, 0, 256, 512);
    x.strokeStyle = '#F6F2EA'; x.lineWidth = 10; x.beginPath(); x.arc(128, 190, 70, 0, 7); x.stroke();
    x.fillStyle = '#F6F2EA'; rr(x, 70, 150, 116, 30, 8); rr(x, 92, 200, 72, 20, 8);
    x.fillStyle = '#FFB347'; rr(x, 36, 400, 184, 54, 27); x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(64, 427, 22, 0, 7); x.fill();
    return c;
  }
  if (kind === 'rows') { // a spreadsheet seen as a pattern: header band, sidebar, ruled rows of bars, a few coloured cells
    const [c, x] = cv(512, 320); x.fillStyle = '#F7F8FA'; x.fillRect(0, 0, 512, 320); x.fillStyle = '#2F5C9A'; x.fillRect(0, 0, 512, 22);
    x.fillStyle = '#E6E9EE'; x.fillRect(0, 22, 512, 18); x.fillStyle = '#EEF0F3'; x.fillRect(0, 40, 26, 280);
    for (let y = 44, i = 0; y < 320; y += 11, i++) { if (i % 2) { x.fillStyle = '#EEF1F5'; x.fillRect(26, y - 1, 486, 11); }
      for (let cx = 30; cx < 500; cx += 64) { const ww = 12 + R() * 40; x.fillStyle = R() < 0.06 ? (R() < 0.5 ? '#9ED39A' : '#F2B8A8') : '#9AA0AA'; if (R() < 0.08) { x.fillRect(cx - 3, y - 1, 64, 11); x.fillStyle = '#5A606A'; } x.fillRect(cx, y + 3, ww, 4); } }
    x.strokeStyle = '#D5D9E0'; for (let cx = 26; cx < 512; cx += 64) { x.beginPath(); x.moveTo(cx + 0.5, 40); x.lineTo(cx + 0.5, 320); x.stroke(); }
    return c;
  }
  if (kind === 'slide') { // a projected slide: a title band, a bar chart, a few lines
    const [c, x] = cv(512, 288); x.fillStyle = '#FBFBF9'; x.fillRect(0, 0, 512, 288); x.fillStyle = '#23344F'; x.fillRect(0, 0, 512, 54);
    x.fillStyle = '#E8ECF2'; rr(x, 28, 18, 220, 16, 6);
    const bars = ['#3C6FB0', '#3C6FB0', '#3C6FB0', '#E59A3A', '#3C6FB0', '#3C6FB0'];
    for (let i = 0; i < 6; i++) { const hh = 40 + R() * 140; x.fillStyle = bars[i]; x.fillRect(40 + i * 46, 250 - hh, 30, hh); }
    x.fillStyle = '#AAB1BC'; x.fillRect(32, 251, 290, 2); for (let i = 0; i < 4; i++) rr(x, 350, 90 + i * 30, 120 - i * 14, 9, 4);
    return c;
  }
  if (kind === 'doc') { // a word processor: a white page in a grey frame, lines of grey bars
    const [c, x] = cv(512, 320); x.fillStyle = '#D7DADF'; x.fillRect(0, 0, 512, 320); x.fillStyle = '#EDEFF2'; x.fillRect(0, 0, 512, 26);
    x.fillStyle = '#FFFFFF'; x.fillRect(96, 34, 320, 286); x.fillStyle = '#8F949C';
    for (let y = 60; y < 310; y += 13) { if (R() < 0.12) { y += 8; continue; } rr(x, 120, y, 220 + R() * 50, 5, 2); }
    return c;
  }
  if (kind === 'clock') { const [c, x] = cv(64, 64); x.fillStyle = '#000'; x.fillRect(0, 0, 64, 64); return c; }
  const [c, x] = cv(64, 64); x.fillStyle = '#888'; x.fillRect(0, 0, 64, 64); return c;
}
export function screenTexture(kind, seed = 1) {
  const k = kind + ':' + seed; let t = TEX.get(k); if (t) return t;
  t = new THREE.CanvasTexture(screenCanvas(kind, seed)); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.generateMipmaps = true; TEX.set(k, t); return t;
}
// a lit screen: unshaded HDR light from an interface picture, scrolling if asked, with a slight flicker, plus a glass
// cover that catches reflections. light: lumen-ish strength of a RectAreaLight the screen throws on the room.
// kind 'tv' is a moving picture made in the shader: soft colour fields that cut every few seconds.
const AVG = { feed: '#E8E2DA', feedDim: '#5E6B80', photo: '#C89070', news: '#5A5F6A', alarm: '#8A86A0', rows: '#E4E8EE', slide: '#E8EAEE', doc: '#E0E3E8', tv: '#8AA0C0' };
export function screen(w, h, kind, { seed = 1, value = 1.6, view = 0.5, scroll = 0, flicker = 0.02, light = 0, lightColor = null, cover = true, pause = 0, pulse = 0 } = {}) {
  const U = { uMap: { value: kind === 'tv' ? null : screenTexture(kind, seed) }, uI: { value: value }, uOff: { value: 0 }, uView: { value: view }, uT: { value: 0 },
    uA: { value: new THREE.Color('#3A5A8A') }, uB: { value: new THREE.Color('#C08A5A') }, uC: { value: new THREE.Color('#2A2A30') }, uAspect: { value: w / h } };
  const tv = kind === 'tv';
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uI, uOff, uView, uT, uAspect; uniform vec3 uA, uB, uC;
      float h21(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main(){ vec3 c;
        ${tv ? `vec2 p = vUv; p.x = (p.x - 0.5) * uAspect; float pan = uT * 0.015;
          c = mix(uB, uA, smoothstep(0.25, 0.75, p.y + 0.08 * sin(p.x * 3.0 + pan * 20.0)));
          for (int i = 0; i < 3; i++) { float fi = float(i); vec2 bc = vec2((h21(vec2(fi, uC.r)) - 0.5) * 1.2 + sin(uT * 0.2 + fi) * 0.05 - pan, 0.25 + 0.3 * h21(vec2(fi, 4.0 + uC.g)));
            float bl = smoothstep(0.22, 0.0, length((p - bc) * vec2(1.6, 1.0))); c = mix(c, uC * (0.6 + 0.8 * h21(vec2(fi, 9.0))), bl * 0.85); }
          c *= 0.85 + 0.15 * sin(vUv.y * 600.0);` : `vec2 uv = vec2(vUv.x, fract(1.0 - ((1.0 - vUv.y) * uView + uOff))); c = texture2D(uMap, uv).rgb;`}
        float edge = smoothstep(0.0, 0.02, vUv.x) * smoothstep(1.0, 0.98, vUv.x) * smoothstep(0.0, 0.02, vUv.y) * smoothstep(1.0, 0.98, vUv.y);
        gl_FragColor = vec4(c * uI * mix(0.85, 1.0, edge), 1.0); }`,
  });
  const g = new THREE.Group(), face = mesh(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0, { parent: g, cast: false });
  if (cover) mesh(new THREE.PlaneGeometry(w, h), glass({ opacity: 0.08, env: 1.2 }), 0, 0, 0.0008, { parent: g, cast: false, recv: false });
  let rect = null; const lc = new THREE.Color(lightColor || AVG[kind] || '#ffffff');
  if (light) { rect = new THREE.RectAreaLight(lc, light, w, h); rect.rotation.y = Math.PI; rect.position.z = 0.002; g.add(rect); }
  const R = rng(seed + 11); let cut = -1;
  const pal = [['#6A8FC0', '#9AA86A', '#3A3A30'], ['#2E3A58', '#C77A4A', '#E8C9A0'], ['#8AB0D8', '#E8E0D0', '#4A3A30'], ['#3A6A4A', '#C8B070', '#6A4A3A'], ['#1A1C2A', '#3A5AA0', '#E8E8F0'], ['#C0D0E0', '#5A7A9A', '#D09060']];
  g.userData.update = (t) => {
    U.uT.value = t;
    // scrolling: a thumb flick, a pause to look, another flick
    if (scroll) { const k = t * scroll, ph = k % 1, base = Math.floor(k); U.uOff.value = (base + (pause ? Math.min(1, ph / 0.35) ** 0.5 : ph)) * 0.18; }
    const fl = (1 - flicker * (0.5 + 0.5 * Math.sin(t * 31.0) * Math.sin(t * 7.3))) * (pulse ? 1 - pulse * (0.5 + 0.5 * Math.sin(t * 5.5)) : 1);
    U.uI.value = value * fl;
    if (tv) { const c = Math.floor(t / 4.2 + seed); if (c !== cut) { cut = c; const P = pal[Math.floor(Math.abs(Math.sin(c * 12.9898 + seed) * 43758.5453) % pal.length)]; U.uA.value.set(P[0]); U.uB.value.set(P[1]); U.uC.value.set(P[2]); if (rect) rect.color.copy(U.uA.value).lerp(U.uB.value, 0.5).lerp(new THREE.Color('#ffffff'), 0.3); } }
    if (rect) rect.intensity = light * fl * (tv ? 0.9 + 0.1 * Math.sin(t * 2.3) : 1);
  };
  g.userData.face = face; g.userData.light = rect;
  return g;
}
// a phone: black glass slab with a thin metal edge, screen on +z, long axis y
export function phone({ kind = 'feed', seed = 1, value = 1.8, scroll = 0, light = 0, flicker = 0.02, pause = 1, pulse = 0, lightColor = null } = {}) {
  const g = new THREE.Group(), W = 0.071, H = 0.148;
  mesh(rbox(W, H, 0.0085, 0.004), metal('#2A2B2E', 0.35), 0, 0, 0, { parent: g });
  const s = screen(W - 0.006, H - 0.008, kind, { seed, value, scroll, light, flicker, pause, pulse, lightColor, view: kind === 'photo' || kind === 'alarm' ? 1 : 0.5 }); s.position.z = 0.0045; g.add(s);
  g.userData.update = s.userData.update; g.userData.light = s.userData.light;
  return g;
}

// ---------- beds and bedding ----------
// a bed: low frame, a headboard, a mattress with a sheet, pillows. Its head is at -z; the top of the mattress is `top`
export function bed({ w = 1.4, l = 2.0, top = 0.5, frame = null, sheet = '#E6E3DD', pillow = '#E2DFD8', headboard = 0.95, pillows = 2, legs = 0.12, seed = 1 } = {}) {
  const g = new THREE.Group(), fm = frame || woodFurniture({ color: '#6E4E36', axis: 'z' }), mt = 0.22, base = top - mt;
  block(g, fm, w + 0.08, base - legs + 0.02, l + 0.05, 0, legs, 0.01, 0.012);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(g, fm, 0.06, legs, 0.06, x * (w / 2 - 0.02), 0, z * (l / 2 - 0.02), 0.008);
  if (headboard) block(g, fm, w + 0.12, headboard, 0.05, 0, legs, -l / 2 - 0.03, 0.018);
  mesh(rbox(w, mt, l, 0.06, 4), fabric({ color: sheet, sheen: 0.3, weave: 0.6 }), 0, base + mt / 2, 0, { parent: g });
  const R = rng(seed), pm = fabric({ color: pillow, sheen: 0.4 });
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i - (pillows - 1) / 2) * (w / pillows) * 1.02;
    mesh(cushionGeo(Math.min(0.68, w / pillows - 0.04), 0.15, 0.44, { seed: seed + i, puff: 0.45, round: 0.3, dent: 0.25 }), pm, x, top + 0.06, -l / 2 + 0.3, { parent: g, ry: R.range(-0.08, 0.08), rx: -0.12 });
  }
  g.userData = { top, w, l };
  return g;
}
// a duvet that settles over whatever lies beneath it: bodies are capsules { a: [x,y,z], b: [x,y,z], r } in the bed's
// space; the cloth takes their shape, tents between them, wrinkles, and hangs over the sides and foot.
export function duvet({ w = 1.4, l = 2.0, top = 0.5, z0 = -0.55, hang = 0.28, foot = 0.22, bodies = [], lumps = [], color = '#DCD9D2', seed = 1, thick = 0.045, res = 0.02, wrinkle = 1, sheen = 0.5, side = 'both' } = {}) {
  const X0 = -w / 2 - hang, X1 = w / 2 + hang, Z1 = l / 2 + foot, nx = Math.ceil((X1 - X0) / res), nz = Math.ceil((Z1 - z0) / res);
  const H = new Float32Array((nx + 1) * (nz + 1)), at = (i, j) => j * (nx + 1) + i;
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), ab = new THREE.Vector3();
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = Math.max(-w / 2, Math.min(w / 2, X0 + i * res)), z = Math.min(l / 2, z0 + j * res); let hgt = top;
    for (const c of bodies) {
      a.set(...c.a); b.set(...c.b); ab.subVectors(b, a); const L2 = ab.x * ab.x + ab.z * ab.z;
      let t = L2 > 1e-6 ? ((x - a.x) * ab.x + (z - a.z) * ab.z) / L2 : 0; t = Math.max(0, Math.min(1, t));
      v.copy(a).addScaledVector(ab, t); const d = Math.hypot(x - v.x, z - v.z); if (d < c.r) hgt = Math.max(hgt, v.y + Math.sqrt(c.r * c.r - d * d));
    }
    for (const k of lumps) { const d = Math.hypot((x - k.x) / k.rx, (z - k.z) / k.rz); if (d < 1) hgt = Math.max(hgt, top + k.h * Math.cos(d * Math.PI / 2) ** 1.5); }
    H[at(i, j)] = hgt;
  }
  // the cloth falls away from what it covers at a steep slope (a two-pass dilation), then settles (blur)
  const slope = 1.25 * res, rad = 16, tmp = new Float32Array(H.length);
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { let mx = H[at(i, j)]; for (let k = -rad; k <= rad; k++) { const ii = i + k; if (ii < 0 || ii > nx) continue; mx = Math.max(mx, H[at(ii, j)] - Math.abs(k) * slope); } tmp[at(i, j)] = mx; }
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { let mx = tmp[at(i, j)]; for (let k = -rad; k <= rad; k++) { const jj = j + k; if (jj < 0 || jj > nz) continue; mx = Math.max(mx, tmp[at(i, jj)] - Math.abs(k) * slope); } H[at(i, j)] = Math.max(top, mx); }
  const raw = H.slice();
  for (let it = 0; it < 4; it++) {
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const ii = Math.max(0, Math.min(nx, i + k)); s += H[at(ii, j)]; n++; } tmp[at(i, j)] = s / n; }
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) { let s = 0, n = 0; for (let k = -3; k <= 3; k++) { const jj = Math.max(0, Math.min(nz, j + k)); s += tmp[at(i, jj)]; n++; } H[at(i, j)] = Math.max(s / n, raw[at(i, j)] - 0.012); }
  }
  const geo = new THREE.PlaneGeometry(1, 1, nx, nz), p = geo.attributes.position, R = rng(seed), ang = R() * 3, so = seed * 3.7;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i; let x = X0 + i * res, z = z0 + j * res, hh = H[at(i, j)] + thick;
    const dx = Math.max(0, Math.abs(x) - w / 2), dz = Math.max(0, z - l / 2), over = Math.max(dx, dz);
    const lift = H[at(i, j)] - top, crumple = Math.min(1, lift * 8 + 0.35);
    const gx = (H[at(Math.min(nx, i + 1), j)] - H[at(Math.max(0, i - 1), j)]) / (2 * res), gz = (H[at(i, Math.min(nz, j + 1))] - H[at(i, Math.max(0, j - 1))]) / (2 * res), sl = Math.hypot(gx, gz);
    if (sl > 0.2) { const ax = -gz / sl, az = gx / sl; hh += wrinkle * Math.min(1, sl) * 0.012 * Math.sin((x * ax + z * az) * 16 + fbm2(x * 6, z * 6, seed + 3, 3) * 16) * Math.max(0, fbm2(x * 3 + 7, z * 3, seed + 5, 2) * 2 - 0.6); } // folds running down the slope, in patches
    hh += wrinkle * crumple * ((fbm2(x * 5 + so, z * 5, seed, 3) - 0.5) * 0.04 + Math.abs(Math.sin((x * Math.cos(ang) + z * Math.sin(ang)) * 14 + fbm2(x * 3, z * 3, seed + 1, 3) * 14)) * 0.006 * fbm2(x * 2 + 3, z * 2, seed + 2, 2));
    hh += 0.025 * Math.exp(-(((z - z0) / 0.05) ** 2)); // the top edge rolls over a little
    let px = x, pz = z, py = hh;
    if (over > 0) {
      const ex = Math.sign(x) * Math.min(Math.abs(x), w / 2), ez = Math.min(z, l / 2), base = H[at(Math.round((ex - X0) / res), Math.round((ez - z0) / res))] + thick;
      const r0 = 0.035, out = Math.min(over, r0), down = Math.max(0, over - r0 * 0.6), wave = Math.sin((dx > dz ? z : x) * 13 + seed) * 0.018 * Math.min(1, down / 0.15);
      px = dx > 0 ? Math.sign(x) * (w / 2 + out * 0.7 + Math.max(0, wave)) : x; pz = dz > 0 ? l / 2 + out * 0.7 + Math.max(0, wave) : z; py = Math.max(0.03, base - down - out * 0.3);
    }
    p.setXYZ(k, px, py, pz);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, fabric({ color, sheen, rough: 0.85, weave: 0.8 }), 0, 0, 0);
  return m;
}
// capsules for a posed mannequin, in the space of `frame` (e.g. a bed), for duvet(): torso, thighs, shins, upper arms
export function bodyCapsules(m, frame, { arms = true, head = false, pad = 0.02 } = {}) {
  m.root.updateMatrixWorld(true); frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert(), S = m.root.scale.x, J = m.J;
  const P = (o, y = 0, z = 0) => new THREE.Vector3(0, y, z).applyMatrix4(o.matrixWorld).applyMatrix4(inv).toArray();
  const out = [
    { a: P(J.hips, -0.03), b: P(J.chest, 0.3), r: 0.15 * S + pad },
    { a: P(J.lHip), b: P(J.lKnee), r: 0.075 * S + pad }, { a: P(J.rHip), b: P(J.rKnee), r: 0.075 * S + pad },
    { a: P(J.lKnee), b: P(J.lAnk), r: 0.055 * S + pad }, { a: P(J.rKnee), b: P(J.rAnk), r: 0.055 * S + pad },
    { a: P(J.lAnk, -0.03, -0.02), b: P(J.lAnk, -0.05, 0.19), r: 0.05 * S + pad }, { a: P(J.rAnk, -0.03, -0.02), b: P(J.rAnk, -0.05, 0.19), r: 0.05 * S + pad },
  ];
  if (arms) out.push({ a: P(J.lSh), b: P(J.lEl), r: 0.05 * S + pad }, { a: P(J.rSh), b: P(J.rEl), r: 0.05 * S + pad }, { a: P(J.lEl), b: P(J.lWr), r: 0.04 * S + pad }, { a: P(J.rEl), b: P(J.rWr), r: 0.04 * S + pad });
  if (head) out.push({ a: P(J.neck), b: P(J.head, 0.15), r: 0.1 * S + pad });
  return out;
}

// ---------- seating ----------
// a sofa: plinth on short legs, seat and back cushions, rolled arms. Faces +z; seats along x.
// returns userData { seatH: top of the seat cushions, front: z of the seat's front edge, xs: seat centres }
export function sofa({ seats = 3, seatW = 0.6, d = 0.9, seatH = 0.45, armW = 0.17, backH = 0.84, color = '#7C7B77', legColor = '#3B2C20', seed = 1, armH = 0.62, saggy = 0.02 } = {}) {
  const g = new THREE.Group(), F = fabric({ color, sheen: 0.55 }), Fd = fabric({ color: col(color).multiplyScalar(0.92), sheen: 0.55 }), W = seats * seatW + 2 * armW, legs = 0.09, R = rng(seed);
  const legM = woodFurniture({ color: legColor, axis: 'y' });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.022, 0.016, legs, 12), legM, x * (W / 2 - 0.06), legs / 2, z * (d / 2 - 0.06), { parent: g });
  block(g, Fd, W, 0.2, d, 0, legs, 0, 0.03);                                     // plinth
  block(g, Fd, W, backH - legs - 0.2, 0.2, 0, legs + 0.18, -d / 2 + 0.1, 0.05); // back frame
  for (const s of [-1, 1]) block(g, F, armW, armH - legs, d, s * (W / 2 - armW / 2), legs, 0, 0.07); // arms
  const cushionTop = seatH, ct = cushionTop - (legs + 0.2) + 0.02, xs = [];
  for (let i = 0; i < seats; i++) {
    const x = -W / 2 + armW + seatW * (i + 0.5); xs.push(x);
    mesh(cushionGeo(seatW - 0.012, ct, d - 0.24, { seed: seed + i, puff: 0.25, round: 0.18, dent: saggy * 6 }), F, x, legs + 0.2 + ct / 2 - 0.01, 0.1, { parent: g });
    const back = mesh(cushionGeo(seatW - 0.015, backH - cushionTop + 0.04, 0.2, { seed: seed + 10 + i, puff: 0.35, round: 0.2, dent: 0.15 }), F, x, cushionTop + (backH - cushionTop) / 2 - 0.01, -d / 2 + 0.25, { parent: g, rx: -0.2 + R.range(-0.03, 0.03) });
    back.rotation.z = R.range(-0.02, 0.02);
  }
  g.userData = { seatH: cushionTop, front: d / 2, xs, W, d };
  return g;
}
// an upholstered armchair (one seat, deeper arms, a slightly higher back)
export function armchair({ color = '#6E6455', ...o } = {}) { const g = sofa({ seats: 1, seatW: 0.58, d: 0.86, backH: 0.98, armW: 0.19, color, armH: 0.64, ...o }); return g; }
// a cushion to throw on a sofa or hold
export function cushion({ w = 0.44, h = 0.14, color = '#A88A64', seed = 1 } = {}) { return mesh(cushionGeo(w, h, w, { seed, puff: 0.6, round: 0.35, dent: 0.2 }), fabric({ color, sheen: 0.6 })); }
// a kitchen or dining chair in solid wood, seat at 0.46
export function chair({ color = '#8C6440', seatH = 0.46, seed = 1, back = 0.86 } = {}) {
  const g = new THREE.Group(), m = woodFurniture({ color, axis: 'y' }), ms = woodFurniture({ color, axis: 'x' }), s = 0.42;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(rbox(0.035, z < 0 ? back : seatH - 0.02, 0.035, 0.008), m, x * (s / 2 - 0.03), (z < 0 ? back : seatH - 0.02) / 2, z * (s / 2 - 0.03), { parent: g, rx: z < 0 ? -0.06 : 0 });
  block(g, ms, s, 0.03, s, 0, seatH - 0.03, 0, 0.008);
  for (const y of [back - 0.12, back - 0.32]) block(g, ms, s - 0.04, y > back - 0.2 ? 0.08 : 0.03, 0.022, 0, y, -s / 2 + 0.03 - (y - seatH) * 0.06, 0.006);
  for (const z of [-1, 1]) block(g, ms, s - 0.06, 0.03, 0.02, 0, 0.16, z * (s / 2 - 0.03), 0.004);
  g.userData = { seatH };
  return g;
}
// a school chair: moulded plastic shell on a tubular steel frame
export function schoolChair({ color = '#3E6E8E', seatH = 0.35, seed = 1 } = {}) {
  const g = new THREE.Group(), pm = plastic(color, 0.45), mm = metal('#9A9C9E', 0.35), s = 0.34;
  mesh(cushionGeo(s, 0.022, s, { puff: 0.05, round: 0.12, dent: 0 }), pm, 0, seatH, 0, { parent: g });
  mesh(cushionGeo(s * 0.95, 0.2, 0.018, { puff: 0.05, round: 0.15, dent: 0 }), pm, 0, seatH + 0.24, -s / 2 + 0.01, { parent: g, rx: -0.12 });
  for (const x of [-1, 1]) for (const z of [-1, 1]) mesh(cyl(0.01, 0.01, seatH, 8), mm, x * (s / 2 - 0.03), seatH / 2, z * (s / 2 - 0.03), { parent: g });
  for (const x of [-1, 1]) mesh(cyl(0.009, 0.009, 0.28, 8), mm, x * (s / 2 - 0.03), seatH + 0.12, -s / 2 + 0.02, { parent: g, rx: -0.12 });
  g.userData = { seatH: seatH + 0.012 };
  return g;
}
// an office task chair: padded seat and back, gas lift, five-star base on castors
export function officeChair({ color = '#2E3034', seatH = 0.48, back = 0.5, yaw = 0, seed = 1 } = {}) {
  const g = new THREE.Group(), F = fabric({ color, sheen: 0.3 }), P = plastic('#1E1F22', 0.5), M = metal('#8E9094', 0.3);
  mesh(cushionGeo(0.48, 0.07, 0.46, { puff: 0.3, round: 0.25, seed }), F, 0, seatH - 0.035, 0.02, { parent: g });
  mesh(cushionGeo(0.44, back, 0.06, { puff: 0.25, round: 0.3, seed: seed + 3 }), F, 0, seatH + 0.12 + back / 2, -0.24, { parent: g, rx: -0.12 });
  block(g, P, 0.05, 0.18, 0.03, 0, seatH - 0.02, -0.24, 0.01);
  mesh(cyl(0.025, 0.025, seatH - 0.12, 12), M, 0, (seatH - 0.12) / 2 + 0.07, 0, { parent: g });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + 0.3; const leg = block(g, P, 0.04, 0.03, 0.3, Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14, 0.01); leg.rotation.y = a; mesh(new THREE.SphereGeometry(0.025, 12, 8), P, Math.sin(a) * 0.29, 0.025, Math.cos(a) * 0.29, { parent: g }); }
  g.rotation.y = yaw;
  g.userData = { seatH };
  return g;
}

// ---------- tables, desks, storage ----------
export function table({ w = 1.2, d = 0.8, h = 0.75, top = null, legs = null, thick = 0.035, inset = 0.06 } = {}) {
  const g = new THREE.Group(), tm = top || woodFurniture({ color: '#9A7450', axis: 'x' }), lm = legs || woodFurniture({ color: '#8A6644', axis: 'y' });
  block(g, tm, w, thick, d, 0, h - thick, 0, 0.006);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(g, lm, 0.045, h - thick, 0.045, x * (w / 2 - inset), 0, z * (d / 2 - inset), 0.006);
  block(g, lm, w - 2 * inset, 0.07, 0.02, 0, h - thick - 0.07, -d / 2 + inset, 0.004); block(g, lm, w - 2 * inset, 0.07, 0.02, 0, h - thick - 0.07, d / 2 - inset, 0.004);
  g.userData = { top: h };
  return g;
}
// a school desk: laminate top, steel frame, a tray beneath
export function schoolDesk({ w = 0.65, d = 0.48, h = 0.6, color = '#D8CBB0', frame = '#7A7E82' } = {}) {
  const g = new THREE.Group(), tm = paint({ color, rough: 0.5 }), mm = metal(frame, 0.4);
  block(g, tm, w, 0.022, d, 0, h - 0.022, 0, 0.005); block(g, plastic('#5A5E64', 0.6), w - 0.06, 0.012, d - 0.08, 0, h - 0.13, 0.02, 0.003);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.012, 0.012, h - 0.02, 8), mm, x * (w / 2 - 0.03), (h - 0.02) / 2, z * (d / 2 - 0.03), { parent: g });
  g.userData = { top: h };
  return g;
}
// an office bench desk with a fabric privacy screen at the back
export function officeDesk({ w = 1.4, d = 0.75, h = 0.74, screenH = 0.38, top = '#E9E7E2', panel = '#596068' } = {}) {
  const g = new THREE.Group(), tm = paint({ color: top, rough: 0.4, coat: 0.1 }), mm = metal('#C9CACC', 0.35);
  block(g, tm, w, 0.025, d, 0, h - 0.025, 0, 0.004);
  for (const x of [-1, 1]) { block(g, mm, 0.05, h - 0.025, 0.05, x * (w / 2 - 0.05), 0, -d / 2 + 0.06, 0.006); block(g, mm, 0.05, h - 0.025, 0.05, x * (w / 2 - 0.05), 0, d / 2 - 0.06, 0.006); block(g, mm, 0.05, 0.04, d - 0.1, x * (w / 2 - 0.05), h - 0.065, 0, 0.006); }
  if (screenH) block(g, fabric({ color: panel, sheen: 0.2 }), w - 0.02, screenH, 0.03, 0, h, -d / 2 + 0.015, 0.012);
  g.userData = { top: h };
  return g;
}
// a computer monitor on a stand, screen facing +z
export function monitor({ w = 0.6, h = 0.36, kind = 'rows', on = true, seed = 1, value = 1.2, light = 0, scroll = 0 } = {}) {
  const g = new THREE.Group(), P = plastic('#1A1B1E', 0.45), M = metal('#3A3B3E', 0.4);
  block(g, M, 0.24, 0.012, 0.18, 0, 0, 0.0, 0.006); block(g, M, 0.05, 0.3, 0.025, 0, 0.01, -0.04, 0.008);
  const y = 0.12 + h / 2 + 0.02; mesh(rbox(w + 0.02, h + 0.02, 0.035, 0.006), P, 0, y, -0.02, { parent: g });
  if (on) { const s = screen(w, h, kind, { seed, value, light, scroll, view: 1 }); s.position.set(0, y, -0.0015); g.add(s); g.userData.update = s.userData.update; g.userData.screen = s; }
  else mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.12, clearcoat: 1 }), 0, y, -0.0015, { parent: g });
  g.userData.screenY = y;
  return g;
}
// a laptop open at `open` radians, screen towards +z (the user sits at +z)
export function laptop({ w = 0.32, d = 0.22, open = 1.85, kind = 'doc', seed = 1, value = 1.3, light = 0, color = '#B9BBBE' } = {}) {
  const g = new THREE.Group(), M = metal(color, 0.3);
  block(g, M, w, 0.014, d, 0, 0, 0, 0.004); mesh(new THREE.PlaneGeometry(w * 0.86, d * 0.42), plastic('#1D1E21', 0.6), 0, 0.0145, -d * 0.12, { rx: -Math.PI / 2, parent: g, cast: false });
  const lid = new THREE.Group(); lid.position.set(0, 0.012, -d / 2); lid.rotation.x = -(open - Math.PI / 2); g.add(lid);
  mesh(rbox(w, d, 0.006, 0.003), M, 0, d / 2, -0.003, { parent: lid });
  const s = screen(w * 0.92, d * 0.86, kind, { seed, value, light, view: 1 }); s.position.set(0, d / 2 + 0.004, 0.0005); lid.add(s);
  g.userData.update = s.userData.update; g.userData.light = s.userData.light;
  return g;
}
// a flat TV on a low unit; on: a moving picture that lights the room
export function tv({ w = 1.1, on = true, light = 4, value = 1.1, unit = true, wall = false, seed = 3 } = {}) {
  const g = new THREE.Group(), h = w * 9 / 16, P = plastic('#111214', 0.4), y0 = wall ? 0 : unit ? 0.5 : 0.75;
  if (unit && !wall) { const um = woodFurniture({ color: '#4E3A2C', axis: 'x' }); block(g, um, w + 0.5, 0.42, 0.42, 0, 0.06, 0, 0.01); block(g, metal('#222', 0.4), 0.3, 0.02, 0.2, 0, 0.48, 0, 0.004); block(g, P, 0.06, 0.08, 0.04, 0, 0.48, 0, 0.004);
    for (const x of [-1, 1]) for (const z of [-1, 1]) block(g, metal('#222', 0.4), 0.03, 0.06, 0.03, x * ((w + 0.5) / 2 - 0.05), 0, z * 0.16, 0.004); }
  const cy = y0 + h / 2 + 0.06; mesh(rbox(w + 0.016, h + 0.016, 0.03, 0.004), P, 0, cy, -0.012, { parent: g });
  if (on) { const s = screen(w, h, 'tv', { seed, value, light, cover: true }); s.position.set(0, cy, 0.0035); g.add(s); g.userData.update = s.userData.update; g.userData.light = s.userData.light; }
  else mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ color: '#030304', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.05 }), 0, cy, 0.0035, { parent: g, cast: false });
  g.userData.center = new THREE.Vector3(0, cy, 0);
  return g;
}
// a low cabinet (sideboard, TV unit, bedside table): carcass, door fronts with shadow gaps, small knobs
export function cabinet({ w = 1.6, h = 0.75, d = 0.45, doors = 3, color = '#6A4A34', top = null, knob = '#B8A888', legs = 0.1, drawer = false } = {}) {
  const g = new THREE.Group(), m = woodFurniture({ color, axis: 'x' }), fronts = woodFurniture({ color: col(color).multiplyScalar(1.04), axis: 'x' }), body = h - legs;
  block(g, m, w, body, d - 0.02, 0, legs, -0.01, 0.006); if (top !== false) block(g, top || m, w + 0.02, 0.025, d + 0.01, 0, h - 0.02, 0, 0.005);
  const fw = (w - 0.03) / doors;
  for (let i = 0; i < doors; i++) { const x = -w / 2 + 0.015 + fw * (i + 0.5); block(g, fronts, fw - 0.006, body - 0.06, 0.02, x, legs + 0.03, d / 2 - 0.01, 0.003); mesh(new THREE.SphereGeometry(0.011, 12, 8), metal(knob, 0.35), x + (drawer ? 0 : (i % 2 ? -1 : 1) * (fw / 2 - 0.05)), legs + body * (drawer ? 0.75 : 0.55), d / 2 + 0.012, { parent: g }); }
  if (legs) for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) block(g, m, 0.04, legs, 0.04, x * (w / 2 - 0.04), 0, z * (d / 2 - 0.05), 0.008);
  g.userData = { top: h };
  return g;
}
export function rug({ w = 2, d = 1.4, color = '#7A6A5A', border = null } = {}) {
  const g = new THREE.Group(); mesh(rbox(w, 0.012, d, 0.005, 2), carpet({ color }), 0, 0.006, 0, { parent: g, cast: false });
  if (border) for (const s of [-1, 1]) { mesh(new THREE.PlaneGeometry(w - 0.1, 0.04), carpet({ color: border }), 0, 0.0125, s * (d / 2 - 0.08), { rx: -Math.PI / 2, parent: g, cast: false }); }
  return g;
}

// ---------- kitchen ----------
// a run of base units with a worktop and wall units above; leave gaps (e.g. for the fridge) with skip: [[x0, x1]]
export function kitchenRun({ len = 2.4, d = 0.62, h = 0.9, color = '#DAD7CF', top = null, wallUnits = true, skip = [], hob = null, sink = null, seed = 1 } = {}) {
  const g = new THREE.Group(), fm = paint({ color, rough: 0.35, coat: 0.15 }), cm = paint({ color: col(color).multiplyScalar(0.8), rough: 0.6 }), tm = top || stone(), hm = metal('#B7B7B4', 0.25), unit = 0.6;
  const inSkip = (x) => skip.some(([a, b]) => x > a - 1e-3 && x < b + 1e-3);
  for (let x = -len / 2 + unit / 2; x < len / 2; x += unit) {
    if (inSkip(x)) continue;
    block(g, cm, unit, 0.1, d - 0.08, x, 0, -0.04, 0.003);               // recessed plinth
    block(g, cm, unit, h - 0.14, d - 0.04, x, 0.1, -0.02, 0.003);        // carcass
    block(g, fm, unit - 0.004, h - 0.18, 0.018, x, 0.11, d / 2 - 0.01, 0.003); // door
    block(g, hm, 0.16, 0.012, 0.012, x, h - 0.15, d / 2 + 0.008, 0.005); // handle
    if (wallUnits) { block(g, cm, unit, 0.7, 0.33, x, 1.45, -d / 2 + 0.165, 0.003); block(g, fm, unit - 0.004, 0.7, 0.018, x, 1.45, -d / 2 + 0.34, 0.003); block(g, hm, 0.012, 0.12, 0.012, x + unit / 2 - 0.06, 1.48, -d / 2 + 0.355, 0.005); }
  }
  // worktop pieces between the gaps
  const edges = [-len / 2, ...skip.flat().map((v, i) => (i % 2 ? v + unit / 2 : v - unit / 2)), len / 2].sort((a, b) => a - b);
  for (let i = 0; i < edges.length; i += 2) if (edges[i + 1] - edges[i] > 0.05) block(g, tm, edges[i + 1] - edges[i], 0.035, d + 0.02, (edges[i] + edges[i + 1]) / 2, h - 0.04, 0.01, 0.004);
  if (hob != null) mesh(new THREE.PlaneGeometry(0.56, 0.5), new THREE.MeshPhysicalMaterial({ color: '#08080A', roughness: 0.1, clearcoat: 1 }), hob, h - 0.004, 0.02, { rx: -Math.PI / 2, parent: g, cast: false });
  if (sink != null) { block(g, hm, 0.46, 0.006, 0.4, sink, h - 0.008, 0.02, 0.02); mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 20, Math.PI), hm, sink, h + 0.2, -d / 2 + 0.12, { parent: g, ry: Math.PI / 2 }); mesh(cyl(0.014, 0.018, 0.2, 10), hm, sink, h + 0.1, -d / 2 + 0.02, { parent: g }); }
  return g;
}
// a fridge-freezer with its door open: white liner, glass shelves, packed with brightly coloured packaging (no
// writing), bottles in the door, and the cold light inside that is the only light in a dark kitchen. Hinge at -x.
export function fridge({ w = 0.6, h = 1.82, d = 0.64, open = 1.75, color = '#E6E6E3', power = 6, seed = 4, freezer = 0.62 } = {}) {
  const g = new THREE.Group(), R = rng(seed), shell = paint({ color, rough: 0.3, coat: 0.3 }), liner = plastic('#F2F4F5', 0.35), t = 0.04;
  liner.emissive = new THREE.Color('#BFD6FF'); liner.emissiveIntensity = 0.06;
  const y0 = freezer; // the fridge compartment sits above the freezer drawers
  block(g, shell, w, h, t, 0, 0, -d / 2 + t / 2, 0.006);                 // back
  for (const s of [-1, 1]) block(g, shell, t, h, d, s * (w / 2 - t / 2), 0, 0, 0.006); // sides
  block(g, shell, w, t, d, 0, h - t, 0, 0.006); block(g, shell, w, y0, d, 0, 0, 0, 0.008); // top, freezer body
  block(g, shell, w - 0.006, y0 - 0.02, 0.06, 0, 0.01, d / 2 + 0.03, 0.01); block(g, metal('#BDBEBF', 0.3), 0.3, 0.02, 0.02, 0, y0 - 0.06, d / 2 + 0.07, 0.006);
  // inner liner
  const iw = w - 2 * t, id = d - t - 0.02, ih = h - t - y0;
  block(g, liner, iw, ih, 0.01, 0, y0, -d / 2 + t + 0.005, 0.002);
  for (const s of [-1, 1]) block(g, liner, 0.01, ih, id, s * (iw / 2 - 0.005), y0, 0.0, 0.002);
  block(g, liner, iw, 0.01, id, 0, y0, 0, 0.002);
  const shelves = [y0 + 0.24, y0 + 0.5, y0 + 0.76, y0 + 1.0].filter((y) => y < h - 0.12), gm = glass({ opacity: 0.35, color: '#E8F4F4' });
  for (const y of shelves) { block(g, gm, iw - 0.01, 0.006, id - 0.04, 0, y, 0.0, 0.002).castShadow = false; block(g, plastic('#DDE2E4', 0.3), iw - 0.01, 0.012, 0.012, 0, y - 0.004, id / 2 - 0.02, 0.003); }
  block(g, plastic('#D8E4E8', 0.25), iw - 0.03, 0.18, id - 0.06, 0, y0 + 0.012, 0.0, 0.01); // crisper drawer
  // food: packets, tubs, jars, bottles in loud colours
  const loud = ['#E8432E', '#F3B61F', '#2E7DD7', '#36B24A', '#F07FB3', '#FF8A1E', '#7A3FC0', '#14B6C9', '#F6E04B', '#E23A7A', '#FFFFFF'];
  const levels = [y0 + 0.012 + 0.18, ...shelves];
  for (let li = 0; li < levels.length; li++) {
    const yb = levels[li] + 0.006, room = (levels[li + 1] ?? h - t) - yb - 0.03; let x = -iw / 2 + 0.02;
    while (x < iw / 2 - 0.06) {
      const kind = R(), c = loud[Math.floor(R() * loud.length)], pm = plastic(c, R.range(0.25, 0.5)); let ww;
      if (kind < 0.45) { ww = R.range(0.07, 0.14); const hh = Math.min(room, R.range(0.06, 0.2)), dd = R.range(0.06, 0.16); block(g, pm, ww, hh, dd, x + ww / 2, yb, R.range(-0.08, 0.08), 0.006);
        if (R() < 0.6) block(g, plastic(loud[Math.floor(R() * loud.length)], 0.4), ww * 0.6, hh * 0.25, 0.002, x + ww / 2, yb + hh * 0.5, dd / 2 + R.range(-0.08, 0.08) + 0.001, 0.001); }
      else if (kind < 0.7) { ww = R.range(0.08, 0.12); const hh = Math.min(room, R.range(0.05, 0.1)); mesh(cyl(ww / 2, ww / 2 * 0.92, hh, 20), pm, x + ww / 2, yb + hh / 2, R.range(-0.08, 0.1), { parent: g }); mesh(cyl(ww / 2 + 0.003, ww / 2 + 0.003, 0.012, 20), plastic(loud[Math.floor(R() * loud.length)], 0.3), x + ww / 2, yb + hh, 0, { parent: g }); }
      else if (kind < 0.85 && room > 0.2) { ww = 0.07; const hh = Math.min(room, R.range(0.18, 0.26)); mesh(lathe([[0.0, 0], [0.033, 0], [0.034, hh * 0.6], [0.014, hh * 0.85], [0.013, hh]]), glass({ color: R() < 0.5 ? '#9ED8A8' : '#F2D2A0', opacity: 0.55, rough: 0.08 }), x + ww / 2, yb, R.range(-0.1, 0.05), { parent: g }); }
      else { ww = R.range(0.1, 0.16); block(g, pm, ww, Math.min(room, 0.045), 0.18, x + ww / 2, yb, 0.0, 0.008); block(g, plastic(loud[Math.floor(R() * loud.length)], 0.3), ww, Math.min(room, 0.04), 0.17, x + ww / 2, yb + Math.min(room, 0.045), 0.0, 0.008); }
      x += ww + R.range(0.005, 0.02);
    }
  }
  // the door, hinged at -x, with shelves of bottles
  const door = new THREE.Group(); door.position.set(-w / 2, y0, d / 2); door.rotation.y = -open; g.add(door);
  block(door, shell, w, h - y0, 0.06, w / 2, 0, 0.03, 0.012); block(door, liner, w - 0.06, h - y0 - 0.06, 0.04, w / 2, 0.03, -0.02, 0.01);
  block(door, metal('#BDBEBF', 0.3), 0.02, 0.4, 0.02, w - 0.03, 0.15, 0.07, 0.006);
  for (const yy of [0.12, 0.45, 0.8]) { block(door, plastic('#E6EEF0', 0.25), w - 0.08, 0.08, 0.1, w / 2, yy, -0.09, 0.006);
    let x = 0.06; while (x < w - 0.08) { const bw = R.range(0.05, 0.08), bh = R.range(0.12, 0.24); if (R() < 0.6) mesh(lathe([[0, 0], [bw / 2, 0], [bw / 2, bh * 0.7], [bw * 0.2, bh * 0.9], [bw * 0.18, bh]]), R() < 0.5 ? glass({ color: '#CFE8D4', opacity: 0.5 }) : plastic(loud[Math.floor(R() * loud.length)], 0.3), x + bw / 2, yy + 0.02, -0.09, { parent: door }); else block(door, plastic(loud[Math.floor(R() * loud.length)], 0.4), bw, bh * 0.8, 0.07, x + bw / 2, yy + 0.02, -0.09, 0.005); x += bw + 0.01; } }
  // the light: a lamp at the top front of the compartment, with shadows, and a soft glow out of the opening
  const lp = new THREE.PointLight('#EAF2FF', power, 0, 2); lp.position.set(0.0, h - t - 0.07, 0.05); lp.castShadow = true; lp.shadow.mapSize.set(512, 512); lp.shadow.radius = 5; lp.shadow.bias = -0.003; lp.shadow.camera.near = 0.03; g.add(lp);
  mesh(new THREE.BoxGeometry(0.12, 0.02, 0.04), glow('#F2F6FF', 6), 0, h - t - 0.03, 0.1, { parent: g, cast: false });
  for (const sx of [-1, 1]) { const sl = new THREE.PointLight('#EAF2FF', power * 0.12, 0.3, 2); sl.position.set(sx * (iw / 2 - 0.05), y0 + ih * 0.55, 0.0); g.add(sl); } // the side strips light every shelf
  const ra = new THREE.RectAreaLight('#E4EEFF', power * 0.9, iw, ih * 0.9); ra.position.set(0, y0 + ih / 2, d / 2 + 0.01); g.add(ra); // faces +z (default -z flipped below)
  ra.rotation.y = Math.PI;
  const hum = R() * 10;
  g.userData.update = (t2) => { const f = 1 - 0.015 * Math.sin(t2 * 2 * Math.PI * 0.7 + hum) - 0.006 * Math.sin(t2 * 50); lp.intensity = power * f; ra.intensity = power * 0.9 * f; };
  g.userData.light = lp;
  return g;
}

// ---------- light fittings ----------
// a lamp with a fabric shade: the bulb's light leaves through the top and bottom (shadowed), and a little glows
// through the shade. kind 'table' or 'floor'.
export function lamp({ kind = 'table', shade = '#E9DFCB', base = '#4E4138', on = true, power = 6, color = '#FFB56B', shadow = true, shadeR = null, scale = 1 } = {}) {
  const g = new THREE.Group(), floor = kind === 'floor', H = (floor ? 1.5 : 0.42) * scale, [r0, r1] = shadeR || (floor ? [0.24, 0.17] : [0.16, 0.11]), sh = floor ? 0.3 : 0.2;
  const bm = floor ? metal(base, 0.35) : paint({ color: base, rough: 0.3, coat: 0.5 });
  if (floor) { mesh(cyl(0.15, 0.16, 0.025, 32), bm, 0, 0.0125, 0, { parent: g }); mesh(cyl(0.012, 0.012, H, 12), bm, 0, H / 2, 0, { parent: g }); }
  else { mesh(lathe([[0, 0], [0.07, 0], [0.075, 0.02], [0.09, 0.12], [0.075, 0.24], [0.03, 0.3], [0.012, 0.32], [0.012, H], [0, H]]), bm, 0, 0, 0, { parent: g }); }
  const sm = fabric({ color: shade, sheen: 0.2, rough: 0.9 }); if (on) { sm.emissive = col(color).lerp(col(shade), 0.4); sm.emissiveIntensity = power * 0.09; }
  const top = H + sh * 0.55, shadeG = new THREE.LatheGeometry([new THREE.Vector2(r0, 0), new THREE.Vector2(r1, sh)], 48, 0, Math.PI * 2);
  mesh(shadeG, sm, 0, top - sh, 0, { parent: g });
  mesh(new THREE.SphereGeometry(0.03, 16, 12), on ? glow(color, 25) : plastic('#EEE', 0.2), 0, H + 0.05, 0, { parent: g, cast: false });
  if (on) {
    const L = new THREE.PointLight(color, power, 0, 2); L.position.set(0, H + 0.05, 0); g.add(L);
    if (shadow) { L.castShadow = true; L.shadow.mapSize.set(512, 512); L.shadow.radius = 5; L.shadow.bias = -0.002; L.shadow.normalBias = 0.02; L.shadow.camera.near = 0.04; }
    const T = new THREE.PointLight(color, power * 0.22, 0, 2); T.position.set(0, H + 0.08, 0); g.add(T); // what comes through the shade
    g.userData.light = L;
  }
  g.userData.top = top;
  return g;
}
// a ceiling light: a bare bulb on a flex (harsh), or a shallow shade
export function pendant({ drop = 0.6, on = true, power = 10, color = '#FFC98A', shade = null, ceilH = 2.5, shadow = true } = {}) {
  const g = new THREE.Group(); g.position.y = ceilH;
  mesh(cyl(0.004, 0.004, drop, 6), plastic('#EEE', 0.5), 0, -drop / 2, 0, { parent: g });
  mesh(cyl(0.035, 0.035, 0.05, 16), plastic('#F2F2F0', 0.4), 0, -drop - 0.02, 0, { parent: g });
  if (shade) mesh(new THREE.LatheGeometry([new THREE.Vector2(0.03, 0), new THREE.Vector2(0.09, -0.05), new THREE.Vector2(0.17, -0.16), new THREE.Vector2(0.18, -0.17)], 40), paint({ color: shade, rough: 0.4, metal: 0.2 }), 0, -drop - 0.02, 0, { parent: g });
  mesh(new THREE.SphereGeometry(0.035, 16, 12), on ? glow(color, 40) : glass({ opacity: 0.4 }), 0, -drop - 0.09, 0, { parent: g, cast: false });
  if (on) { const L = new THREE.PointLight(color, power, 0, 2); L.position.set(0, -drop - 0.09, 0); g.add(L);
    if (shadow) { L.castShadow = true; L.shadow.mapSize.set(2048, 2048); L.shadow.radius = 2.5; L.shadow.bias = -0.002; L.shadow.normalBias = 0.02; L.shadow.camera.near = 0.05; }
    g.userData.light = L; }
  return g;
}
// a recessed ceiling panel or a fluorescent batten: a glowing diffuser, a soft rect light down, and optionally a
// shadow-casting spot so desks and people throw shadows
export function ceilingPanel({ w = 0.6, d = 0.6, on = true, power = 8, color = '#F2F5FF', value = 4, spot = 0, ceilH = 2.7, batten = false } = {}) {
  const g = new THREE.Group(); g.position.y = ceilH;
  if (batten) block(g, plastic('#ECEDEE', 0.4), w + 0.04, 0.06, d + 0.04, 0, -0.06, 0, 0.01);
  else block(g, plastic('#E2E3E4', 0.4), w + 0.03, 0.012, d + 0.03, 0, -0.01, 0, 0.003);
  mesh(new THREE.PlaneGeometry(w, d), on ? glow(color, value) : plastic('#CFD1D4', 0.5), 0, batten ? -0.062 : -0.012, 0, { rx: Math.PI / 2, parent: g, cast: false });
  if (on) {
    const R = new THREE.RectAreaLight(color, power, w, d); R.position.y = batten ? -0.065 : -0.015; R.rotation.x = -Math.PI / 2; g.add(R);
    if (spot) { const S = new THREE.SpotLight(color, spot, 0, 1.25, 0.9, 2); S.position.y = -0.1; S.target.position.set(0, -3, 0); g.add(S, S.target); S.castShadow = true; S.shadow.mapSize.set(1024, 1024); S.shadow.radius = 8; S.shadow.bias = -0.0008; S.shadow.normalBias = 0.02; g.userData.spot = S; }
    g.userData.light = R;
  }
  return g;
}
// party lights: a sagging string of small warm bulbs between hooks, with a few real lights along it
export function stringLights(anchors, { sag = 0.14, spacing = 0.17, color = '#FFBE73', value = 14, lights = 4, power = 0.9, shadow = false } = {}) {
  const g = new THREE.Group(), pts = [];
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = new THREE.Vector3(...anchors[i]), b = new THREE.Vector3(...anchors[i + 1]), n = Math.max(4, Math.round(a.distanceTo(b) / 0.05));
    for (let k = i ? 1 : 0; k <= n; k++) { const u = k / n, p = a.clone().lerp(b, u); p.y -= sag * 4 * u * (1 - u) * (a.distanceTo(b) / 2); pts.push(p); }
  }
  const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength();
  mesh(new THREE.TubeGeometry(curve, Math.round(len * 60), 0.0025, 5, false), plastic('#1A1A1A', 0.6), 0, 0, 0, { parent: g, cast: false });
  const n = Math.floor(len / spacing), bulb = new THREE.SphereGeometry(0.014, 10, 8); bulb.scale(1, 1.3, 1);
  const inst = new THREE.InstancedMesh(bulb, glow(color, value), n), M = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let i = 0; i < n; i++) { const p = curve.getPointAt((i + 0.5) / n); p.y -= 0.022; M.compose(p, q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, M); }
  g.add(inst);
  for (let i = 0; i < lights; i++) { const p = curve.getPointAt((i + 0.5) / lights); const L = new THREE.PointLight(color, power, 0, 2); L.position.copy(p).add(new THREE.Vector3(0, -0.05, 0)); if (shadow && i === 0) { L.castShadow = true; L.shadow.mapSize.set(1024, 1024); L.shadow.radius = 6; L.shadow.bias = -0.002; } g.add(L); }
  return g;
}

// ---------- doors, walls, things on walls ----------
// a door frame (architrave) and a door leaf standing open; in a wall's space (room.onWall at the doorway's centre)
export function doorway({ w = 0.86, h = 2.04, thick = 0.14, open = 1.3, color = '#F0EEE8', leaf = '#EEECE6', hingeLeft = true } = {}) {
  const g = new THREE.Group(), m = paint({ color, rough: 0.35, coat: 0.2 }), lm = paint({ color: leaf, rough: 0.35, coat: 0.2 }), a = 0.07;
  block(g, m, a, h + a, 0.02, -w / 2 - a / 2 + 0.01, 0, 0.01, 0.005); block(g, m, a, h + a, 0.02, w / 2 + a / 2 - 0.01, 0, 0.01, 0.005); block(g, m, w + 2 * a - 0.02, a, 0.02, 0, h, 0.01, 0.005);
  block(g, m, 0.02, h, thick, -w / 2 + 0.01, 0, -thick / 2, 0.003); block(g, m, 0.02, h, thick, w / 2 - 0.01, 0, -thick / 2, 0.003); block(g, m, w, 0.02, thick, 0, h - 0.02, -thick / 2, 0.003);
  const s = hingeLeft ? -1 : 1, hinge = new THREE.Group(); hinge.position.set(s * (w / 2 - 0.02), 0, 0.0); hinge.rotation.y = s * open; g.add(hinge);
  block(hinge, lm, w - 0.04, h - 0.03, 0.04, -s * (w / 2 - 0.02), 0.005, -0.02, 0.004);
  for (const zz of [0.01, -0.05]) { mesh(cyl(0.01, 0.01, 0.12, 10), metal('#9A9894', 0.3), -s * (w - 0.1), 1.0, zz, { rz: Math.PI / 2, parent: hinge }); }
  return g;
}
// a framed picture (or photo) with a mat; image: a soft warm abstract or a family photo seen as shapes
export function picture({ w = 0.4, h = 0.3, frame = '#2A2420', mat = '#F2EEE6', warm = true, seed = 1, stand = false, border = 0.025 } = {}) {
  const g = new THREE.Group(), fm = woodFurniture({ color: frame, axis: 'x' });
  block(g, fm, w, border, 0.025, 0, 0, 0, 0.004); block(g, fm, w, border, 0.025, 0, h - border, 0, 0.004); block(g, fm, border, h, 0.025, -w / 2 + border / 2, 0, 0, 0.004); block(g, fm, border, h, 0.025, w / 2 - border / 2, 0, 0, 0.004);
  mesh(new THREE.PlaneGeometry(w - border * 2, h - border * 2), paint({ color: mat, rough: 0.8 }), 0, h / 2, 0.004, { parent: g, cast: false });
  const [c, x] = cv(128, 128), R = rng(seed); photo(x, 0, 0, 128, 128, R, { figures: R() < 0.7 ? 1 + Math.floor(R() * 3) : 0, warm });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const im = Math.min(w, h) * 0.12; mesh(new THREE.PlaneGeometry(w - border * 2 - im, h - border * 2 - im), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), 0, h / 2, 0.006, { parent: g, cast: false });
  mesh(new THREE.PlaneGeometry(w - border * 2, h - border * 2), glass({ opacity: 0.07 }), 0, h / 2, 0.012, { parent: g, cast: false, recv: false });
  if (stand) { block(g, fm, 0.02, h * 0.8, 0.012, 0, 0, -0.06, 0.003).rotation.x = 0.35; g.rotation.x = -0.12; }
  return g;
}
// a round wall clock with tick marks (no numerals) and moving hands, set to a time of day in hours
export function wallClock({ r = 0.15, hour = 16.5, face = '#F4F2EC', rim = '#1E1E1E' } = {}) {
  const g = new THREE.Group(), rm = paint({ color: rim, rough: 0.4 });
  mesh(new THREE.TorusGeometry(r, 0.012, 12, 48), rm, 0, 0, 0.02, { parent: g }); mesh(cyl(r, r, 0.03, 48), rm, 0, 0, 0.005, { rx: Math.PI / 2, parent: g });
  mesh(new THREE.CircleGeometry(r - 0.008, 48), paint({ color: face, rough: 0.6 }), 0, 0, 0.021, { parent: g, cast: false });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, tk = mesh(new THREE.BoxGeometry(i % 3 ? 0.005 : 0.01, i % 3 ? 0.018 : 0.03, 0.002), rm, Math.sin(a) * (r - 0.03), Math.cos(a) * (r - 0.03), 0.023, { parent: g, cast: false }); tk.rotation.z = -a; }
  const hand = (L, W, z) => { const p = new THREE.Group(); p.position.z = z; g.add(p); mesh(new THREE.BoxGeometry(W, L, 0.002), rm, 0, L / 2 - 0.015, 0, { parent: p, cast: false }); return p; };
  const hh = hand(r * 0.55, 0.012, 0.026), mh = hand(r * 0.82, 0.008, 0.029), sh = hand(r * 0.85, 0.003, 0.032);
  sh.children[0].material = paint({ color: '#A8322A', rough: 0.4 });
  mesh(new THREE.CircleGeometry(r, 48), glass({ opacity: 0.08 }), 0, 0, 0.036, { parent: g, cast: false, recv: false });
  g.userData.update = (t) => { const s = Math.floor(t) % 60, m = (hour % 1) * 60 + t / 60, hr = Math.floor(hour) % 12 + m / 60; sh.rotation.z = -(s / 60) * Math.PI * 2; mh.rotation.z = -(m / 60) * Math.PI * 2; hh.rotation.z = -(hr / 12) * Math.PI * 2; };
  return g;
}
// a bedside alarm clock with a seven-segment display; time "3:12"
export function digitalClock({ time = '3:12', color = '#9FD8FF', value = 3.5 } = {}) {
  const g = new THREE.Group(); block(g, plastic('#141518', 0.35), 0.17, 0.075, 0.07, 0, 0, 0, 0.012);
  mesh(new THREE.PlaneGeometry(0.15, 0.052), new THREE.MeshPhysicalMaterial({ color: '#050608', roughness: 0.15, clearcoat: 1 }), 0, 0.0375, 0.0352, { parent: g, cast: false });
  const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const sm = glow(color, value), dw = 0.022, dh = 0.036, th = 0.0035;
  const segs = { a: [0, dh / 2, dw, th], d: [0, -dh / 2, dw, th], g: [0, 0, dw, th], b: [dw / 2, dh / 4, th, dh / 2], c: [dw / 2, -dh / 4, th, dh / 2], e: [-dw / 2, -dh / 4, th, dh / 2], f: [-dw / 2, dh / 4, th, dh / 2] };
  const chars = time.split(''); let x = -0.05;
  for (const ch of chars) {
    if (ch === ':') { for (const y of [0.008, -0.008]) mesh(new THREE.PlaneGeometry(0.004, 0.004), sm, x - 0.006, 0.0375 + y, 0.0355, { parent: g, cast: false }); x += 0.008; continue; }
    for (const s of SEG[ch] || '') { const [sx, sy, sw, shh] = segs[s]; mesh(new THREE.PlaneGeometry(sw, shh), sm, x + sx, 0.0375 + sy, 0.0356, { parent: g, cast: false }); }
    x += 0.032;
  }
  const L = new THREE.PointLight(color, 0.06, 0, 2); L.position.set(0, 0.04, 0.08); g.add(L);
  return g;
}
// a whiteboard: aluminium frame, a glossy white face with the ghosts of old marker, a pen tray
export function whiteboard({ w = 2.4, h = 1.2, seed = 2 } = {}) {
  const g = new THREE.Group(), fm = metal('#B5B7BA', 0.35), [c, x] = cv(512, 256), R = rng(seed);
  x.fillStyle = '#F7F8F8'; x.fillRect(0, 0, 512, 256);
  x.lineCap = 'round'; for (let i = 0; i < 7; i++) { x.strokeStyle = R() < 0.7 ? 'rgba(40,60,120,0.55)' : 'rgba(30,120,60,0.5)'; x.lineWidth = 2 + R() * 2; x.beginPath(); let px = 30 + R() * 400, py = 30 + R() * 190; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += R() * 30 + 6; py += (R() - 0.5) * 14; x.lineTo(px, py); } x.stroke(); }
  x.strokeStyle = 'rgba(40,60,120,0.55)'; x.lineWidth = 3; x.strokeRect(300, 60, 120, 90); x.beginPath(); x.arc(150, 170, 40, 0, 7); x.stroke();
  x.fillStyle = 'rgba(120,130,140,0.08)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.ellipse(R() * 512, R() * 256, 40 + R() * 60, 10 + R() * 20, R(), 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.18, clearcoat: 0.6 }), 0, h / 2, 0.012, { parent: g, cast: false });
  block(g, fm, w + 0.04, 0.025, 0.02, 0, -0.012, 0.01, 0.004); block(g, fm, w + 0.04, 0.025, 0.02, 0, h - 0.012, 0.01, 0.004); block(g, fm, 0.025, h, 0.02, -w / 2 - 0.01, 0, 0.01, 0.004); block(g, fm, 0.025, h, 0.02, w / 2 + 0.01, 0, 0.01, 0.004);
  block(g, fm, w * 0.6, 0.02, 0.06, 0, -0.03, 0.04, 0.004);
  return g;
}
// pinned-up pictures on a wall (children's paintings as blocks of colour)
export function pinboard({ w = 1.6, h = 0.9, seed = 3, n = 9 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  block(g, fabric({ color: '#3D5A7A', sheen: 0.1 }), w, h, 0.015, 0, 0, 0, 0.003);
  for (let i = 0; i < n; i++) { const [c, x] = cv(64, 48); x.fillStyle = '#FBFAF6'; x.fillRect(0, 0, 64, 48); for (let k = 0; k < 5; k++) { x.fillStyle = ['#E84A3A', '#F5C22E', '#3C8DDB', '#4DB35A', '#E07AB0', '#F08A2E'][Math.floor(R() * 6)]; x.beginPath(); x.ellipse(R() * 64, R() * 48, 4 + R() * 14, 3 + R() * 10, R() * 3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const pw = R.range(0.22, 0.3), ph = pw * 0.75;
    mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }), -w / 2 + 0.2 + (i % 5) * (w - 0.3) / 5 + R.range(-0.02, 0.02), 0.2 + Math.floor(i / 5) * 0.4 + R.range(-0.03, 0.03), 0.01, { parent: g, rz: R.range(-0.06, 0.06), cast: false }); }
  return g;
}

// ---------- small things ----------
export function mug({ color = '#E9E6DF' } = {}) {
  const g = new THREE.Group(), m = paint({ color, rough: 0.25, coat: 0.6 });
  mesh(lathe([[0, 0.002], [0.036, 0], [0.04, 0.005], [0.041, 0.095], [0.037, 0.095], [0.036, 0.012], [0, 0.012]]), m, 0, 0, 0, { parent: g });
  mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 16, Math.PI), m, 0.04, 0.05, 0, { rz: -Math.PI / 2, parent: g });
  mesh(new THREE.CircleGeometry(0.035, 20), paint({ color: '#3A2416', rough: 0.15 }), 0, 0.075, 0, { rx: -Math.PI / 2, parent: g, cast: false });
  return g;
}
// a party cup (paper/plastic, pale) or a glass of wine
export function cup({ color = '#EDEBE4', wine = false } = {}) {
  const g = new THREE.Group();
  if (wine) { const gm = glass({ opacity: 0.25 }); mesh(lathe([[0, 0], [0.035, 0], [0.004, 0.006], [0.004, 0.08], [0.03, 0.1], [0.038, 0.14], [0.035, 0.17]]), gm, 0, 0, 0, { parent: g, cast: false }); mesh(lathe([[0, 0.085], [0.03, 0.1], [0.035, 0.12], [0, 0.12]]), paint({ color: '#5A0E18', rough: 0.1 }), 0, 0, 0, { parent: g }); return g; }
  mesh(lathe([[0, 0], [0.03, 0], [0.04, 0.11], [0.042, 0.115], [0.038, 0.115], [0.028, 0.006], [0, 0.006]]), plastic(color, 0.35), 0, 0, 0, { parent: g });
  return g;
}
export function bottle({ color = '#2E5A3A', h = 0.3 } = {}) {
  const g = new THREE.Group(); mesh(lathe([[0, 0], [0.036, 0], [0.037, h * 0.62], [0.014, h * 0.82], [0.013, h], [0, h]]), glass({ color, opacity: 0.75, rough: 0.05 }), 0, 0, 0, { parent: g });
  mesh(cyl(0.015, 0.015, 0.02, 12), metal('#C9B98A', 0.3), 0, h, 0, { parent: g }); return g;
}
export function babyBottle() {
  const g = new THREE.Group(); mesh(lathe([[0, 0], [0.032, 0], [0.033, 0.13], [0, 0.13]]), glass({ color: '#F8F6F0', opacity: 0.55, rough: 0.2 }), 0, 0, 0, { parent: g });
  mesh(lathe([[0, 0], [0.026, 0], [0.027, 0.06], [0, 0.06]]), paint({ color: '#F5F1E6', rough: 0.4 }), 0, 0, 0, { parent: g });
  mesh(cyl(0.035, 0.035, 0.025, 20), plastic('#BFD9EA', 0.35), 0, 0.142, 0, { parent: g }); mesh(lathe([[0.02, 0], [0.018, 0.02], [0.008, 0.035], [0.006, 0.05], [0, 0.055]]), plastic('#E8D2A8', 0.5), 0, 0.155, 0, { parent: g });
  return g;
}
// a muslin cloth dropped on a surface: a crumpled square
export function cloth({ w = 0.5, color = '#F1EEE6', seed = 2, h = 0.05 } = {}) {
  const geo = new THREE.PlaneGeometry(w, w, 40, 40), p = geo.attributes.position, R = rng(seed); geo.rotateX(-Math.PI / 2);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.max(0, (fbm2(x * 6 + seed, z * 6, seed, 3) - 0.45)) * h + Math.abs(Math.sin(x * 25 + z * 9 + R() * 0.2)) * 0.004 + 0.002); p.setX(i, x * (0.75 + 0.25 * fbm2(z * 3, x * 3, seed + 2, 2))); }
  geo.computeVertexNormals(); return mesh(geo, fabric({ color, sheen: 0.4, rough: 0.95 }));
}
// a packed sports holdall: a fat soft barrel, end panels, two handles, a zip, a shoulder strap
export function gymBag({ l = 0.6, r = 0.16, color = '#24272C', trim = '#5A6470' } = {}) {
  const g = new THREE.Group(), F = fabric({ color, sheen: 0.5, rough: 0.7 }), T = fabric({ color: trim, sheen: 0.4 });
  const body = new THREE.CapsuleGeometry(r, l - 2 * r * 0.6, 12, 32); body.rotateZ(Math.PI / 2); body.scale(1, 0.92, 0.95);
  const p = body.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < -r * 0.6) p.setY(i, -r * 0.6 - (y + r * 0.6) * 0.15); p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 20) * 0.004); }
  body.computeVertexNormals(); mesh(body, F, 0, r * 0.6 + 0.01, 0, { parent: g });
  for (const s of [-1, 1]) mesh(cyl(r * 0.85, r * 0.85, 0.01, 32), T, s * (l / 2 - r * 0.25), r * 0.6, 0, { rz: Math.PI / 2, parent: g });
  mesh(new THREE.BoxGeometry(l * 0.75, 0.006, 0.012), metal('#1A1A1A', 0.4), 0, r * 1.5 + 0.005, 0, { parent: g });
  for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.07, 0.009, 8, 20, Math.PI), T, s * 0.06, r * 1.48, 0, { parent: g, ry: Math.PI / 2, rx: -0.3 });
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-l / 2 + 0.05, r * 0.9, 0.0), new THREE.Vector3(-0.1, 0.02, r + 0.1), new THREE.Vector3(0.2, 0.01, r + 0.15), new THREE.Vector3(l / 2 - 0.05, r * 0.9, 0)]), 40, 0.01, 6), T, 0, 0, 0, { parent: g });
  return g;
}
// a pair of trainers, one on its side
export function trainers({ color = '#E8E8E6', sole = '#F4F4F2' } = {}) {
  const g = new THREE.Group(), U = fabric({ color, sheen: 0.4 }), S = plastic(sole, 0.6);
  const shoe = (x, z, ry, rz) => { const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.set(0, ry, rz); g.add(s); block(s, S, 0.1, 0.03, 0.28, 0, 0, 0, 0.015); mesh(cushionGeo(0.09, 0.09, 0.26, { round: 0.4, puff: 0.2 }), U, 0, 0.065, -0.005, { parent: s }); return s; };
  shoe(0, 0, 0.2, 0); const s2 = shoe(0.14, 0.05, -0.4, 0); s2.position.y = 0.0;
  return g;
}
// books lying or standing; a few spines in muted colours
export function books({ n = 5, lying = false, seed = 1 } = {}) {
  const g = new THREE.Group(), R = rng(seed); let x = 0;
  for (let i = 0; i < n; i++) { const w = R.range(0.02, 0.045), h = R.range(0.18, 0.26), d = R.range(0.13, 0.17), c = ['#5A3A30', '#2E4A5A', '#7A6A4A', '#3A4A3A', '#8A3A30', '#C8BFA8'][Math.floor(R() * 6)];
    if (lying) block(g, paint({ color: c, rough: 0.7 }), h, w, d, 0, x, 0, 0.003).rotation.y = R.range(-0.1, 0.1); else block(g, paint({ color: c, rough: 0.7 }), w, h, d, x, 0, 0, 0.003); x += w + (lying ? 0 : 0.002); }
  return g;
}
// a pot plant: a ceramic pot and a loose clump of long leaves
export function plant({ h = 0.9, pot = '#C9C2B6', leaf = '#3E5A36', seed = 2 } = {}) {
  const g = new THREE.Group(), R = rng(seed);
  mesh(lathe([[0, 0], [0.12, 0], [0.15, 0.26], [0.155, 0.27], [0, 0.27]]), paint({ color: pot, rough: 0.5, coat: 0.3 }), 0, 0, 0, { parent: g });
  const lm = new THREE.MeshStandardMaterial({ color: leaf, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 22; i++) { const a = R() * 6.28, len = R.range(0.35, 0.7) * h, lean = R.range(0.15, 0.7);
    const pts = []; for (let k = 0; k <= 6; k++) { const u = k / 6; pts.push(new THREE.Vector3(Math.cos(a) * lean * u * u * len * 0.7, 0.26 + u * len * (1 - lean * u * 0.6), Math.sin(a) * lean * u * u * len * 0.7)); }
    const c = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(c, 12, 0.025, 3, false); geo.scale(1, 1, 1);
    const leafM = mesh(geo, lm, 0, 0, 0, { parent: g }); leafM.scale.set(1, 1, 1); }
  return g;
}

// ---------- outdoors in daylight ----------
// a broadleaf tree: a forked trunk and a rounded crown of leaf clusters
export function tree({ seed = 1, h = 7, tint = '#5E7A3E', bark = '#4A4038' } = {}) {
  const g = new THREE.Group(), R = rng(seed), bm = new THREE.MeshStandardMaterial({ color: bark, roughness: 0.95 });
  const top = new THREE.Vector3(R.range(-0.3, 0.3), h * 0.45, R.range(-0.3, 0.3));
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, h * 0.25, 0), top]), 8, h * 0.035, 8), bm, 0, 0, 0, { parent: g });
  for (let i = 0; i < 4; i++) { const a = R() * 6.28, e = new THREE.Vector3(Math.cos(a) * h * 0.22, h * R.range(0.6, 0.8), Math.sin(a) * h * 0.22); mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([top, top.clone().lerp(e, 0.5).add(new THREE.Vector3(0, 0.3, 0)), e]), 6, h * 0.015, 6), bm, 0, 0, 0, { parent: g }); }
  for (let i = 0; i < 16; i++) { const a = R() * 6.28, r = Math.sqrt(R()) * h * 0.3, b = bush({ seed: seed * 10 + i, size: h * R.range(0.22, 0.32), tint }); b.position.set(Math.cos(a) * r, h * 0.55 + R.range(0, h * 0.35) * (1 - r / (h * 0.32)), Math.sin(a) * r); b.rotation.y = R() * 6; g.add(b); }
  return g;
}

// ---------- a bus ----------
// the lower deck of a city bus at night, built along z (front at -z): vinyl floor, panelled sides with a band of
// windows, a curved ceiling with light strips, rows of moquette seats each side of the aisle, yellow grab poles.
// returns userData { seats: [{ x, z, side, row }], seatH, floor }
export function busInterior({ len = 9, w = 2.45, h = 2.25, rows = 7, pitch = 0.78, z0 = -3.2, light = 3.2, seed = 1 } = {}) {
  const g = new THREE.Group(), floor = 0.0, panel = plastic('#C9CCCF', 0.45), dark = plastic('#3A3D42', 0.5), pole = paint({ color: '#E8B21C', rough: 0.3, coat: 0.4 });
  mesh(new THREE.PlaneGeometry(w, len), vinyl({ color: '#4E5258', fleck: '#A8A69E' }), 0, floor, 0, { rx: -Math.PI / 2, parent: g, cast: false });
  const wy0 = 0.95, wy1 = 1.92;
  for (const s of [-1, 1]) {
    block(g, panel, 0.06, wy0, len, s * (w / 2 + 0.03), 0, 0, 0.01);                          // lower side panel
    block(g, panel, 0.06, h - wy1, len, s * (w / 2 + 0.03), wy1, 0, 0.01);                    // above the windows
    for (let z = -len / 2; z <= len / 2 + 1e-3; z += 1.25) block(g, dark, 0.08, wy1 - wy0, 0.07, s * (w / 2 + 0.02), wy0, z, 0.01); // window pillars
    block(g, dark, 0.12, 0.035, len, s * (w / 2 - 0.02), wy0 - 0.025, 0, 0.008);               // window ledge (a hair above the panel)
    const gl = mesh(new THREE.PlaneGeometry(len, wy1 - wy0), glass({ opacity: 0.16, env: 1.5, color: '#C8D4D0' }), s * (w / 2 + 0.035), (wy0 + wy1) / 2, 0, { ry: -s * Math.PI / 2, parent: g, cast: false, recv: false });
    g.userData['glass' + (s > 0 ? 'R' : 'L')] = gl;
  }
  mesh(new THREE.PlaneGeometry(w + 0.1, len), plastic('#D8DADB', 0.5), 0, h, 0, { rx: Math.PI / 2, parent: g });
  for (const s of [-1, 1]) {
    block(g, plastic('#E4E5E6', 0.4), 0.3, 0.12, len, s * (w / 2 - 0.15), h - 0.12, 0, 0.04);
    mesh(new THREE.PlaneGeometry(0.08, len - 0.4), glow('#E6F0FF', 3.2), s * (w / 2 - 0.34), h - 0.08, 0, { rx: Math.PI / 2, rz: 0, parent: g, cast: false });
    const ra = new THREE.RectAreaLight('#DCE8FF', light, 0.08, len - 0.4); ra.position.set(s * (w / 2 - 0.34), h - 0.082, 0); ra.rotation.x = -Math.PI / 2; g.add(ra);
  }
  const back = block(g, panel, w + 0.1, h, 0.06, 0, 0, len / 2, 0.01); const front = block(g, dark, w + 0.1, h, 0.06, 0, 0, -len / 2, 0.01);
  // seats: pairs either side of the aisle, all facing the front (-z)
  const seatM = moquette({}), frame = plastic('#2A2C30', 0.5), seats = [], seatH = 0.46;
  for (let r = 0; r < rows; r++) for (const s of [-1, 1]) {
    const z = z0 + r * pitch;
    const sg = new THREE.Group(); sg.position.set(s * (w / 2 - 0.5), 0, z); g.add(sg);
    block(sg, frame, 0.9, 0.06, 0.4, 0, seatH - 0.1, 0.0, 0.02);
    for (const k of [-0.22, 0.22]) {
      mesh(cushionGeo(0.42, 0.09, 0.42, { round: 0.2, puff: 0.2, seed: seed + r * 3 + k * 10 }), seatM, k, seatH - 0.04, 0.0, { parent: sg });
      mesh(cushionGeo(0.42, 0.6, 0.1, { round: 0.25, puff: 0.2, seed: seed + r * 5 + k * 10 }), seatM, k, seatH + 0.3, 0.22, { parent: sg, rx: 0.12 });
      seats.push({ x: s * (w / 2 - 0.5) + k, z: z - 0.02, side: s, row: r, window: (s > 0) === (k > 0) });
    }
    block(sg, frame, 0.9, 0.05, 0.06, 0, seatH + 0.62, 0.28, 0.02);
    block(sg, frame, 0.05, seatH - 0.1, 0.05, s * -0.38, 0, 0, 0.01);
    if (r % 2 === 0) mesh(cyl(0.017, 0.017, h, 12), pole, s * (w / 2 - 0.95), h / 2, z + 0.3, { parent: g });
  }
  mesh(cyl(0.016, 0.016, len, 10), pole, -0.3, h - 0.18, 0, { rx: Math.PI / 2, parent: g }); mesh(cyl(0.016, 0.016, len, 10), pole, 0.3, h - 0.18, 0, { rx: Math.PI / 2, parent: g });
  g.userData = { ...g.userData, seats, seatH, w, len, wy0, wy1 };
  return g;
}
// a lit shopfront at night: a plain coloured fascia (no lettering), a glazed front with mullions, a bright interior
// with shelves and a figure or two, a dark stall riser
function shopTexture(R) {
  const [c, x] = cv(128, 96), tone = R.pick([['#FFE2B0', '#C89060'], ['#EAF2FF', '#8AA0B8'], ['#FFD0A0', '#B86A40'], ['#F4F8E8', '#9AAA88'], ['#FFE8E0', '#C08080']]);
  x.fillStyle = '#141414'; x.fillRect(0, 0, 128, 96);
  x.fillStyle = R.pick(['#2A5A8A', '#8A2A2A', '#2A6A4A', '#5A5A5A', '#C8A040', '#3A3A6A']); x.fillRect(0, 4, 128, 16);
  const g = x.createLinearGradient(0, 22, 0, 84); g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]); x.fillStyle = g; x.fillRect(4, 24, 120, 58);
  x.fillStyle = 'rgba(60,40,30,0.55)'; for (let i = 0; i < 3; i++) x.fillRect(8, 40 + i * 13, 112, 3);
  for (let i = 0; i < 2; i++) if (R() < 0.6) { const px = 20 + R() * 88; x.fillStyle = 'rgba(30,25,25,0.75)'; x.beginPath(); x.arc(px, 50, 5, 0, 7); x.fill(); x.fillRect(px - 6, 55, 12, 27); }
  x.fillStyle = '#1A1A1A'; for (const mx of [4, 44, 84, 120]) x.fillRect(mx, 22, 4, 62); x.fillRect(0, 82, 128, 14);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// the street sliding past a bus window at night: lit shopfronts, lamp heads, a car's lights, all moving backwards
export function passingStreet({ side = 1, x = 3.2, len = 60, speed = 7, seed = 3, y0 = -0.4, n = 26 } = {}) {
  const g = new THREE.Group(), R = rng(seed), items = [];
  for (let i = 0; i < n; i++) {
    const k = R(), z = R.range(-len / 2, len / 2);
    let o;
    if (k < 0.45) { const w = R.range(3, 6), hh = R.range(2.6, 3.4), m = new THREE.MeshBasicMaterial({ map: shopTexture(R), color: new THREE.Color(1, 1, 1).multiplyScalar(R.range(0.9, 1.8)) }); m.toneMapped = false; o = mesh(new THREE.PlaneGeometry(w, hh), m, 0, y0 + hh / 2, 0, { ry: -side * Math.PI / 2, cast: false }); o.userData.dx = R.range(5, 12); }
    else if (k < 0.75) { o = halo(R() < 0.7 ? '#FF9A48' : '#E8F2FF', R.range(0.8, 1.6), R.range(1.2, 2.2)); o.position.y = y0 + R.range(4, 6); o.userData.dx = R.range(0.5, 1.5); }
    else { o = halo(R() < 0.5 ? '#FF2A1A' : '#FFF4E0', R.range(0.3, 0.6), 2.5); o.position.y = y0 + 0.7; o.userData.dx = R.range(-1.5, 0.5); }
    o.userData.z0 = z; o.userData.v = speed * (o.userData.dx < 0.6 ? R.range(0.3, 0.7) : 1); g.add(o); items.push(o);
  }
  if (side > 0) mesh(new THREE.PlaneGeometry(40, len), paint({ color: '#121214', rough: 0.22 }), 0, y0, 0, { rx: -Math.PI / 2, parent: g, cast: false });
  g.userData.update = (t) => { for (const o of items) { o.position.x = side * (x + o.userData.dx); let z = o.userData.z0 + t * o.userData.v; z = ((z + len / 2) % len + len) % len - len / 2; o.position.z = z; } };
  return g;
}

// a pane that mirrors the room faintly, the way a window does at night: a real reflection (rendered from a mirrored
// camera), dimmed and added over whatever is outside. Faces +z. strength: how much of the room it gives back.
export function reflectPane(w, h, { strength = 0.22, tint = '#DDE6EE', res = 512 } = {}) {
  const shader = {
    name: 'ReflectPane',
    uniforms: { color: { value: col(tint) }, tDiffuse: { value: null }, textureMatrix: { value: null }, uStr: { value: strength } },
    vertexShader: 'uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 color; uniform sampler2D tDiffuse; uniform float uStr; varying vec4 vUv; void main(){ vec3 b = texture2DProj(tDiffuse, vUv).rgb; gl_FragColor = vec4(min(b, vec3(8.0)) * color * uStr, 1.0); }',
  };
  const r = new Reflector(new THREE.PlaneGeometry(w, h), { shader, textureWidth: res * (w / h > 1 ? 1 : w / h), textureHeight: res * (h / w > 1 ? 1 : h / w), clipBias: 0.003 });
  Object.assign(r.material, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  r.material.userData.noDepth = true; r.renderOrder = 3;
  return r;
}
