// Things the ancestors' stories need beyond the camp basics: a carcass, an animal walking off, honeycomb, firewood,
// roots, a dug hole, a bark target, a drying rack with meat, nuts on an anvil stone, a baby, loads on the head.
// Each maker takes (R, o) and returns an Object3D; stories use them as { type: 'custom', make: (R, ctx) => ... }.
// held(obj, spec) pins a thing to a joint of the figure holding it (head, chest, back, between both hands), so a
// load rides on the head and a stick runs through both fists whatever the pose does. The engine hangs holds on a
// wrist; held() reads the figure's other joints from there.
import * as THREE from 'three';
import { NOISE_GLSL, TONES } from './wood.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMannequin } from './mannequin.js';
import { POSE } from './poses.js';
import './poses-anc.js';

const std = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
// a material with a little noise in its colour, so a surface doesn't read as plastic
function mottled(color, { rough = 0.9, scale = 6, amt = 0.25 } = {}) {
  const m = std(color, rough);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>\ndiffuseColor.rgb *= ${(1 - amt).toFixed(3)} + ${(2 * amt).toFixed(3)} * fbm3(vMP * ${scale.toFixed(2)});`);
  };
  m.customProgramCacheKey = () => 'mottled' + scale + amt;
  return m;
}

// ---------- holding ----------
const nm = (o) => o.children.filter((c) => !c.isMesh && !c.isPoints && !c.userData.held && !c.isLight);
// the joints of the mannequin an object hangs in (see mannequin.js for the order the parts are built in)
function jointsOf(o) {
  let root = o; while (root.parent && !root.parent.isScene) root = root.parent;
  const hips = nm(root)[0], waist = nm(hips)[0], chest = nm(waist)[0], [neck, lSh, rSh] = nm(chest), head = nm(neck)[0];
  const lEl = nm(lSh)[0], rEl = nm(rSh)[0], lWr = nm(lEl)[0], rWr = nm(rEl)[0];
  return { root, hips, waist, chest, neck, head, lSh, rSh, lEl, rEl, lWr, rWr };
}
const PALM = new THREE.Vector3(0, -0.1, 0.01), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _m = new THREE.Matrix4(), _y = new THREE.Vector3(), _x = new THREE.Vector3(), _z = new THREE.Vector3();
// spec: { at: 'head' | 'chest' | 'hips' | 'lWr' | 'rWr' | ..., pos: [x, y, z] in that joint's space (wrists: from the palm),
//         rot: [x, y, z] (YXZ), frame: 'joint' (turns with the joint) | 'body' (turns with the figure only),
//         between: ['rWr', 'lWr'] (the thing's +y runs from the first palm to the second), t: where along it the origin sits }
export function held(obj, spec = {}) {
  const g = new THREE.Group(); g.userData.held = true; g.add(obj);
  const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rot || [0, 0, 0]), 'YXZ'));
  const pos = new THREE.Vector3(...(spec.pos || [0, 0, 0]));
  let J = null;
  g.updateMatrixWorld = function () {
    if (!J) { try { J = jointsOf(this); } catch (e) { J = false; } }
    if (!J) { THREE.Group.prototype.updateMatrixWorld.call(this, true); return; }
    J.root.getWorldQuaternion(_q2);
    if (spec.between) {
      const A = J[spec.between[0]], B = J[spec.between[1]]; A.updateWorldMatrix(true, false); B.updateWorldMatrix(true, false);
      _a.copy(PALM).applyMatrix4(A.matrixWorld); _b.copy(PALM).applyMatrix4(B.matrixWorld);
      _y.subVectors(_b, _a).normalize(); _z.set(0, 0, 1).applyQuaternion(_q2); _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
      _m.makeBasis(_x, _y, _z); _q.setFromRotationMatrix(_m).multiply(rq);
      _a.lerp(_b, spec.t ?? 0.5);
    } else {
      const j = J[spec.at || 'head']; j.updateWorldMatrix(true, false);
      _a.copy(pos); if (/Wr$/.test(spec.at)) _a.add(PALM); _a.applyMatrix4(j.matrixWorld);
      if (spec.frame === 'body') _q.copy(_q2).multiply(rq); else { j.getWorldQuaternion(_q); _q.multiply(rq); }
    }
    this.matrixWorld.compose(_a, _q, _s);
    for (const c of this.children) c.updateMatrixWorld(true);
  };
  return g;
}

// ---------- weapons and sticks ----------
// a spear whose origin is the grip: grip 0..1 along the shaft from the butt; the point is at +y
export function spearAt(R, { length = 2.1, grip = 0.45, tip = true } = {}) {
  // a touch thicker than life (a real shaft is about 2.5 cm) so it still reads in a small picture
  const g = new THREE.Group(), shaft = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, length, 7), std('#6E5640', 0.7)));
  shaft.position.y = length / 2 - grip * length; g.add(shaft);
  if (tip) { const t = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.17, 5), std('#5F5A55', 0.55))); t.scale.z = 0.4; t.position.y = length * (1 - grip) + 0.06; g.add(t); }
  return g;
}
// a digging stick, origin at the grip, the sharpened end at -y
export function diggingStick(R, { length = 1.15, grip = 0.7 } = {}) {
  const g = new THREE.Group(), m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, length, 7), std('#6E5841')));
  m.position.y = length / 2 - grip * length; g.add(m);
  const p = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 7), std('#5C4A38'))); p.rotation.x = Math.PI; p.position.y = -grip * length - 0.035; g.add(p);
  return g;
}
// a spear standing in the ground, leaning
export function spearStuck(R, { length = 2.0, lean = 0.2 } = {}) {
  const g = new THREE.Group(), s = spearAt(R, { length, grip: 0.1 }); s.position.y = length * 0.1 - 0.15; g.add(s); g.rotation.set(lean, R() * 6.28, lean * 0.5, 'YXZ'); return g;
}
// a stone held in the hand
export function handStone(R, { r = 0.045, color = '#6F675E' } = {}) {
  const m = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), std(color, 0.75))); m.scale.set(1, 0.75, 0.85); return m;
}

// ---------- bodies of animals ----------
// a dead antelope: o.mode 'ground' (on its side) or 'shoulders' (draped across a carrier, legs hanging front)
export function carcass(R, { size = 1, mode = 'ground', color } = {}) {
  const coat = mottled(color || R.pick(['#6E4426', '#7A4C2A', '#5E3A22']), { scale: 4, amt: 0.2 }), belly = std('#E2D6BE', 0.95), hoof = std('#2A2420', 0.6), horn = std('#2E2620', 0.5);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const s = size, torso = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.17 * s, 0.62 * s, 6, 14), coat)); torso.rotation.z = Math.PI / 2; torso.scale.set(1, 1, 0.9); body.add(torso);
  const under = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.13 * s, 0.5 * s, 4, 10), belly)); under.rotation.z = Math.PI / 2; under.position.y = -0.06 * s; body.add(under);
  const neck = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * s, 0.32 * s, 4, 10), coat)), head = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * s, 0.18 * s, 4, 10), coat));
  const leg = (x, front) => {
    const L = new THREE.Group(); L.position.set(x, -0.08 * s, 0);
    const up = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.045 * s, 0.03 * s, 0.32 * s, 6), coat)); up.position.y = -0.16 * s; L.add(up);
    const lo = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02 * s, 0.018 * s, 0.3 * s, 6), coat)); lo.position.y = -0.46 * s; L.add(lo);
    const h = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.025 * s, 0.06 * s, 6), hoof)); h.position.y = -0.63 * s; h.rotation.x = Math.PI; L.add(h);
    return L;
  };
  const legs = [leg(0.36 * s, true), leg(0.3 * s, true), leg(-0.34 * s, false), leg(-0.28 * s, false)];
  legs.forEach((l, i) => { l.position.z = (i % 2 ? -1 : 1) * 0.06 * s; body.add(l); });
  for (const sx of [-1, 1]) { const h = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.018 * s, 0.22 * s, 6), horn)); h.position.set(0.06 * s, 0.12 * s, sx * 0.035 * s); h.rotation.z = -0.5; head.add(h); }
  if (mode === 'ground') {
    // on its side: the body rolled 90 degrees, legs out stiff along the ground, head stretched out
    neck.position.set(0.55 * s, 0.02 * s, 0); neck.rotation.z = -1.2; body.add(neck);
    head.position.set(0.78 * s, -0.04 * s, 0.02); head.rotation.z = -1.35; body.add(head);
    legs.forEach((l, i) => { l.rotation.z = (i < 2 ? 0.5 : -0.4) + R.range(-0.15, 0.15); });
    body.rotation.x = Math.PI / 2; body.position.y = 0.15 * s;
  } else {
    // across the shoulders: the legs hang down in front, the head lolls over one side
    neck.position.set(0.5 * s, -0.12 * s, 0.02); neck.rotation.z = 0.9; body.add(neck);
    head.position.set(0.62 * s, -0.36 * s, 0.05); head.rotation.z = 0.2; body.add(head);
    legs.forEach((l, i) => { l.rotation.set(-0.7 + R.range(-0.15, 0.15), 0, (i < 2 ? 0.25 : -0.25)); l.position.z = 0.1 * s; });
  }
  return g;
}

// an animal walking off: a lion (o.kind 'lion', maned or not) or a hyena, built from rounded parts, its legs swinging.
// It moves along its own heading at o.speed (m/s); ctx.ground keeps its feet on the land.
export function beast(R, { kind = 'lion', speed = 1.1, mane = R() < 0.5, ground = null } = {}) {
  const hy = kind === 'hyena', coat = mottled(hy ? '#7D6C54' : '#B08A55', { scale: 3, amt: hy ? 0.3 : 0.15 }), dark = std(hy ? '#3B3128' : '#5B3E22', 0.95);
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const len = hy ? 0.95 : 1.15, sh = hy ? 0.82 : 0.95, hp = hy ? 0.66 : 0.9;
  // torso: chest and haunch spheres joined, the line of the back sloping for a hyena
  const chest = shadow(new THREE.Mesh(new THREE.SphereGeometry(hy ? 0.3 : 0.33, 18, 12), coat)); chest.position.set(0, sh - 0.12, len / 2); chest.scale.set(0.85, 1.05, 1.1); body.add(chest);
  const haunch = shadow(new THREE.Mesh(new THREE.SphereGeometry(hy ? 0.24 : 0.3, 18, 12), coat)); haunch.position.set(0, hp - 0.12, -len / 2); haunch.scale.set(0.85, 1.0, 1.15); body.add(haunch);
  const mid = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(hy ? 0.24 : 0.27, len * 0.7, 6, 14), coat)); mid.rotation.x = Math.PI / 2 + Math.atan2(sh - hp, len) * 0.9; mid.position.set(0, (sh + hp) / 2 - 0.15, 0); mid.scale.set(0.9, 1, 0.95); body.add(mid);
  // neck and head
  const neck = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(hy ? 0.16 : 0.17, 0.25, 6, 12), coat)); neck.position.set(0, sh + 0.0, len / 2 + 0.28); neck.rotation.x = hy ? 1.0 : 0.75; body.add(neck);
  const head = new THREE.Group(); head.position.set(0, sh + (hy ? 0.0 : 0.12), len / 2 + 0.48); body.add(head);
  const skull = shadow(new THREE.Mesh(new THREE.SphereGeometry(hy ? 0.17 : 0.17, 16, 12), coat)); skull.scale.set(0.95, 0.95, 1.1); head.add(skull);
  const muzzle = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(hy ? 0.085 : 0.095, 0.12, 4, 10), hy ? dark : coat)); muzzle.rotation.x = Math.PI / 2 + 0.25; muzzle.position.set(0, -0.06, 0.17); head.add(muzzle);
  for (const sx of [-1, 1]) { const e = shadow(new THREE.Mesh(new THREE.SphereGeometry(hy ? 0.06 : 0.045, 10, 8), hy ? dark : coat)); e.scale.set(1, hy ? 1.3 : 1, 0.45); e.position.set(sx * 0.1, 0.15, -0.03); head.add(e); }
  if (!hy && mane) { const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), mottled('#5E4126', { scale: 9, amt: 0.3 }))); m.position.set(0, sh + 0.04, len / 2 + 0.3); m.scale.set(1.0, 1.15, 0.95); body.add(m); }
  if (hy) { const crest = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), dark)); crest.rotation.x = Math.PI / 2 + 0.35; crest.position.set(0, sh + 0.16, len / 2 - 0.05); body.add(crest); }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, hp - 0.02, -len / 2 - 0.25); body.add(tail);
  const tl = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, hy ? 0.35 : 0.8, 6), coat)); tl.position.y = hy ? -0.17 : -0.4; tail.add(tl); tail.rotation.x = hy ? 0.35 : 0.5;
  if (!hy) { const tuft = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), dark)); tuft.position.y = -0.8; tuft.scale.y = 1.6; tail.add(tuft); }
  // legs: hip and knee pivots
  const legs = [];
  const mkLeg = (x, z, top, front) => {
    const hip = new THREE.Group(); hip.position.set(x, top, z); body.add(hip);
    const up = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(front ? 0.075 : 0.09, top * 0.42, 4, 8), coat)); up.position.y = -top * 0.25; hip.add(up);
    const knee = new THREE.Group(); knee.position.y = -top * 0.5; hip.add(knee);
    const lo = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.05, top * 0.36, 4, 8), coat)); lo.position.y = -top * 0.22; knee.add(lo);
    const paw = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), coat)); paw.scale.set(1, 0.6, 1.3); paw.position.set(0, -top * 0.47, 0.03); knee.add(paw);
    legs.push({ hip, knee, front });
  };
  mkLeg(0.13, len / 2 + 0.05, sh - 0.05, true); mkLeg(-0.13, len / 2 + 0.05, sh - 0.05, true); mkLeg(0.14, -len / 2 - 0.02, hp - 0.02, false); mkLeg(-0.14, -len / 2 - 0.02, hp - 0.02, false);
  const phase = [0, Math.PI, Math.PI * 0.5, Math.PI * 1.5];
  let p0 = null; const stride = speed / 1.1;
  g.userData.update = (t) => {
    if (!p0) p0 = g.position.clone();
    const yaw = g.rotation.y, d = speed * t;
    g.position.x = p0.x + Math.sin(yaw) * d; g.position.z = p0.z + Math.cos(yaw) * d;
    if (ground) g.position.y = ground(g.position.x, g.position.z);
    const f = t * stride * 2.2 * Math.PI;
    legs.forEach((l, i) => { const s = Math.sin(f + phase[i]); l.hip.rotation.x = s * 0.42; l.knee.rotation.x = l.front ? Math.max(0, Math.cos(f + phase[i])) * -0.9 * -1 : -Math.max(0, Math.cos(f + phase[i])) * 0.8; });
    body.position.y = 0.025 * Math.abs(Math.sin(f)); head.rotation.x = 0.05 * Math.sin(f * 2) + (hy ? 0.25 : 0.1); tail.rotation.z = 0.15 * Math.sin(f * 0.5);
  };
  return g;
}

// ---------- food ----------
let COMB = null;
function combTexture() {
  if (COMB) return COMB;
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#B9821F'; x.fillRect(0, 0, 256, 256);
  const r = 9, h = r * Math.sqrt(3);
  for (let j = -1; j < 256 / h + 1; j++) for (let i = -1; i < 256 / (r * 1.5) + 1; i++) {
    const cx = i * r * 1.5, cy = j * h + (i % 2 ? h / 2 : 0), filled = Math.sin(i * 12.9 + j * 78.2) * 43758.5 % 1;
    x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * (r - 1.6), cy + Math.sin(a) * (r - 1.6)); } x.closePath();
    x.fillStyle = Math.abs(filled) > 0.35 ? '#E3A936' : '#F2D27A'; x.fill();
  }
  COMB = new THREE.CanvasTexture(c); COMB.colorSpace = THREE.SRGBColorSpace; COMB.wrapS = COMB.wrapT = THREE.RepeatWrapping; return COMB;
}
// a broken piece of honeycomb, on a leaf or a bark tray if o.tray
export function honeycomb(R, { size = 1, tray = false } = {}) {
  const g = new THREE.Group(), s = 0.13 * size, sh = new THREE.Shape();
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, rr = s * (0.75 + 0.35 * Math.abs(Math.sin(a * 2 + 1)) + R.range(-0.08, 0.08)); const p = [Math.cos(a) * rr * 1.3, Math.sin(a) * rr]; i ? sh.lineTo(...p) : sh.moveTo(...p); }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035 * size, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 });
  const tex = combTexture().clone(); tex.needsUpdate = true; tex.repeat.set(4, 4);
  const m = shadow(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: '#FFFFFF', roughness: 0.28, emissive: '#3A2400', emissiveIntensity: 0.15 })));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; g.add(m);
  if (tray) { const b = shadow(new THREE.Mesh(new THREE.CylinderGeometry(s * 2.2, s * 2.0, 0.025, 18), mottled('#5B4430', { scale: 14, amt: 0.3 }))); b.scale.z = 0.6; b.position.y = 0.0; g.add(b); m.position.y = 0.03; }
  return g;
}
// meat: a haunch, or thin strips laid out (o.kind 'haunch' | 'strips' | 'pieces')
const MEAT = () => mottled('#7A2E22', { rough: 0.55, scale: 12, amt: 0.25 });
export function meat(R, { kind = 'haunch', n = 8, size = 1 } = {}) {
  const g = new THREE.Group(), mat = MEAT();
  if (kind === 'haunch') { const h = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.11 * size, 14, 10), mat)); h.scale.set(1, 1.6, 0.8); g.add(h); const bone = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22 * size, 6), std('#E5DCC8', 0.6))); bone.position.y = 0.22 * size; g.add(bone); return g; }
  for (let i = 0; i < n; i++) {
    const w = kind === 'strips' ? 0.035 : 0.06, l = kind === 'strips' ? R.range(0.22, 0.32) : R.range(0.07, 0.12);
    const geo = new THREE.BoxGeometry(w * size, 0.012, l * size, 1, 1, 4); const p = geo.attributes.position; for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + Math.sin(p.getZ(k) * 25 + i) * 0.006); geo.computeVertexNormals();
    const s = shadow(new THREE.Mesh(geo, mat)); s.position.set(R.range(-0.18, 0.18) * size, 0.008, R.range(-0.12, 0.12) * size); s.rotation.y = R.range(-0.4, 0.4); g.add(s);
  }
  return g;
}
// fibrous roots / tubers: a few lumpy brown shapes, earth still on them
export function roots(R, { n = 6, spread = 0.3, size = 1 } = {}) {
  const g = new THREE.Group(), mat = mottled('#7A5A3A', { scale: 18, amt: 0.35 });
  for (let i = 0; i < n; i++) {
    const geo = new THREE.CapsuleGeometry(R.range(0.03, 0.055) * size, R.range(0.12, 0.3) * size, 4, 8), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k), f = 1 + Math.sin(y * 30 + i) * 0.15; p.setX(k, p.getX(k) * f); p.setZ(k, p.getZ(k) * f); }
    geo.computeVertexNormals();
    const m = shadow(new THREE.Mesh(geo, mat)); m.rotation.set(Math.PI / 2 + R.range(-0.2, 0.2), R() * 6.28, 0, 'YXZ'); m.position.set(R.range(-spread, spread), 0.04 * size, R.range(-spread, spread) * 0.7); g.add(m);
  }
  return g;
}
// nuts on a flat anvil stone, cracked shells around it
export function nutsAnvil(R, { n = 14 } = {}) {
  const g = new THREE.Group(), anvil = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 1), mottled('#6E675E', { scale: 8, amt: 0.2 }))); anvil.scale.set(1.2, 0.35, 1); anvil.position.y = 0.04; g.add(anvil);
  const nut = std('#5E4630', 0.6), shell = std('#3E2E20', 0.8);
  for (let i = 0; i < n; i++) { const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), i % 3 ? nut : shell)); m.scale.set(1, 0.8, 1.2); const a = R() * 6.28, d = R.range(0.22, 0.45); m.position.set(Math.cos(a) * d, 0.02, Math.sin(a) * d); g.add(m); }
  return g;
}
// a heap of firewood, or a bundle tied for carrying (o.tied)
export function firewood(R, { n = 9, len = 1.2, tied = false } = {}) {
  const g = new THREE.Group(), mat = mottled('#6A5440', { scale: 10, amt: 0.3 }), grey = mottled('#8A8072', { scale: 10, amt: 0.25 });
  for (let i = 0; i < n; i++) {
    const l = len * R.range(0.8, 1.1), m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(R.range(0.015, 0.03), R.range(0.02, 0.035), l, 6), R() < 0.4 ? grey : mat));
    if (tied) { m.rotation.z = Math.PI / 2 + R.range(-0.06, 0.06); m.rotation.y = R.range(-0.08, 0.08); const a = (i / n) * 6.28; m.position.set(R.range(-0.08, 0.08), Math.sin(a) * 0.06, Math.cos(a) * 0.06); }
    else { m.rotation.set(Math.PI / 2, R() * 6.28, 0, 'YXZ'); m.rotateX(R.range(-0.15, 0.15)); m.position.set(R.range(-0.25, 0.25), 0.03 + (i / n) * 0.12, R.range(-0.25, 0.25)); }
    g.add(m);
  }
  if (tied) for (const x of [-0.3, 0.3]) { const c = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 14), std('#4A3A2A'))); c.rotation.y = Math.PI / 2; c.position.x = x * len / 1.2; g.add(c); }
  return g;
}
// a leather bag or bundle (gathered food, a rolled hide); o.open spills roots out of it
export function bag(R, { size = 1, color = '#6E5236', open = false } = {}) {
  const g = new THREE.Group(), mat = mottled(color, { scale: 7, amt: 0.25 });
  const geo = new THREE.SphereGeometry(0.2 * size, 18, 12), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setY(i, y * (y > 0 ? 0.75 : 0.6)); p.setX(i, p.getX(i) * (1 + Math.sin(p.getZ(i) * 30) * 0.04)); }
  geo.computeVertexNormals();
  const b = shadow(new THREE.Mesh(geo, mat)); b.position.y = 0.12 * size; g.add(b);
  const neck = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * size, 0.09 * size, 0.1 * size, 10), mat)); neck.position.y = 0.27 * size; g.add(neck);
  if (open) { b.rotation.z = 1.3; b.position.set(-0.12, 0.12 * size, 0); neck.rotation.z = 1.3; neck.position.set(0.12, 0.08, 0); const r = roots(R, { n: 7, spread: 0.22 }); r.position.x = 0.4; g.add(r); }
  return g;
}
// a hole dug for roots: dark loose earth heaped beside a dark mouth
export function hole(R, { r = 0.28 } = {}) {
  const g = new THREE.Group(), dirt = mottled('#5A4330', { scale: 14, amt: 0.3 });
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(r, 20), std('#1E1610', 1)); mouth.rotation.x = -Math.PI / 2; mouth.position.y = 0.012; mouth.receiveShadow = true; g.add(mouth);
  const rim = shadow(new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, 0.05, 6, 20), dirt)); rim.rotation.x = Math.PI / 2; rim.scale.z = 0.6; g.add(rim);
  const heap = shadow(new THREE.Mesh(new THREE.SphereGeometry(r * 1.1, 14, 8, 0, 6.28, 0, Math.PI / 2), dirt)); heap.scale.y = 0.45; heap.position.set(r * 2.1, 0, R.range(-0.1, 0.1)); g.add(heap);
  return g;
}
// a slab of bark hung on a post, the target for spear throwing; spears that missed stuck in the ground near it
export function target(R, { misses = 2 } = {}) {
  const g = new THREE.Group(), bark = mottled('#5E4A38', { scale: 9, amt: 0.35 }), pale = mottled('#A88E6E', { scale: 9, amt: 0.25 });
  const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 7), std('#6B5640'))); post.position.y = 0.72; g.add(post);
  const slab = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20, 1), bark)); slab.rotation.x = Math.PI / 2; slab.position.set(0, 1.05, 0.05); slab.scale.set(1, 1, 1.25); g.add(slab);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), pale); face.position.set(0, 1.05, 0.081); face.scale.y = 1.25; g.add(face);
  for (let i = 0; i < misses; i++) { const s = spearStuck(R, { length: 1.7, lean: R.range(0.3, 0.5) }); s.position.set(R.range(-1.2, 1.2), 0, R.range(-1.5, 0.2)); g.add(s); }
  return g;
}
// a drying rack: two forked posts and a crossbar with strips of meat hanging off it
export function rack(R, { w = 1.8 } = {}) {
  const g = new THREE.Group(), wood = mottled('#6B5640', { scale: 10, amt: 0.3 }), mat = MEAT();
  for (const x of [-w / 2, w / 2]) { const p = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.45, 7), wood)); p.position.set(x, 0.72, 0); p.rotation.z = R.range(-0.05, 0.05); g.add(p); }
  const bar = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, w + 0.3, 7), wood)); bar.rotation.z = Math.PI / 2; bar.position.y = 1.42; g.add(bar);
  for (let i = 0, n = Math.round(w * 6); i < n; i++) {
    const l = R.range(0.35, 0.6), geo = new THREE.BoxGeometry(R.range(0.04, 0.07), l, 0.012, 1, 6, 1), p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) p.setZ(k, p.getZ(k) + Math.sin(p.getY(k) * 9 + i) * 0.02);
    geo.computeVertexNormals(); const s = shadow(new THREE.Mesh(geo, mat)); s.position.set(-w / 2 + 0.1 + (i / n) * (w - 0.2), 1.42 - l / 2, 0); s.rotation.y = R.range(-0.5, 0.5); g.add(s);
  }
  return g;
}
// a fallen log to sit on
export function log(R, { len = 2.0, r = 0.16 } = {}) {
  const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, len, 12), mottled('#5E4F40', { scale: 6, amt: 0.35 }))); m.rotation.z = Math.PI / 2; m.position.y = r * 0.9; const g = new THREE.Group(); g.add(m); return g;
}
// an ostrich-egg water flask
export function flask(R, { size = 1 } = {}) {
  const g = new THREE.Group(), m = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.075 * size, 16, 12), std('#E3D8C2', 0.5))); m.scale.set(1, 1.25, 1); m.position.y = 0.09 * size; g.add(m);
  const plug = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 6), std('#3A2E22'))); plug.position.y = 0.19 * size; g.add(plug); return g;
}

// ---------- a baby ----------
// a toddler mannequin made smaller and posed: o.pose 'curl' (held, asleep), 'lie' (on its back, kicking a little),
// 'sit' (propped up). Centred on its middle, so held() can put it where arms are.
const BABY = {
  curl: { chest: [0.45, 0, 0], neck: [0.3, 0, 0], head: [0.35, 0.3, 0.2], lHip: { dir: [0.2, 0.55, 0.8], bend: [0, -1, 0] }, rHip: { dir: [-0.2, 0.5, 0.85], bend: [0, -1, 0] }, lKnee: 2.2, rKnee: 2.1, lAnk: -0.3, rAnk: -0.3, lSh: { dir: [0.2, -0.4, 0.9], bend: [-1, 1, 0] }, rSh: { dir: [-0.2, -0.4, 0.9], bend: [1, 1, 0] }, lEl: -2.0, rEl: -2.1 },
  sit: { chest: [0.2, 0, 0], neck: [0.05, 0, 0], head: [0.1, 0.2, 0], lHip: { dir: [0.35, 0.05, 0.93], bend: [0, -1, 0] }, rHip: { dir: [-0.35, 0.05, 0.93], bend: [0, -1, 0] }, lKnee: 0.5, rKnee: 0.6, lAnk: 0.2, rAnk: 0.2, lSh: { dir: [0.3, -0.8, 0.5], bend: [0, 0, 1] }, rSh: { dir: [-0.3, -0.8, 0.5], bend: [0, 0, 1] }, lEl: -0.8, rEl: -0.7 },
  lie: { hipsX: -Math.PI / 2, chest: [0, 0, 0], head: [0, 0.6, 0], lHip: { dir: [0.3, -0.3, 0.9], bend: [0, -1, 0] }, rHip: { dir: [-0.3, -0.5, 0.8], bend: [0, -1, 0] }, lKnee: 1.6, rKnee: 1.3, lAnk: 0, rAnk: 0, lSh: { dir: [0.6, -0.2, 0.7], bend: [0, 0, 1] }, rSh: { dir: [-0.6, -0.3, 0.6], bend: [0, 0, 1] }, lEl: -1.5, rEl: -1.2 },
};
// o.wrap: wrapped to the shoulders in a soft hide, the way babies were carried (and so it reads as a baby at a distance)
export function baby(R, { pose = 'curl', scale = 0.78, tone, wrap = pose !== 'lie' } = {}) {
  const m = makeMannequin({ kind: 'toddler', tone: tone || TONES[R.pick(['beech', 'birch', 'pine', 'ash'])], seed: R() * 100 });
  m.root.scale.multiplyScalar(scale); m.pose(BABY[pose] || BABY.curl);
  const g = new THREE.Group(); g.add(m.root); m.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m.root), c = box.getCenter(new THREE.Vector3());
  m.root.position.sub(c);
  if (pose === 'lie') m.root.position.y += (box.max.y - box.min.y) / 2; // on the ground: lowest point at 0
  if (wrap) {
    // the hide: a soft rounded bundle round the body and the drawn-up legs, the head left out
    m.root.updateMatrixWorld(true);
    const nk = m.J.neck.getWorldPosition(new THREE.Vector3()), hp = m.J.hips.getWorldPosition(new THREE.Vector3()), kn = m.J.lKnee.getWorldPosition(new THREE.Vector3()).add(m.J.rKnee.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
    const mid = nk.clone().add(hp).add(kn).multiplyScalar(1 / 3), axis = nk.clone().sub(hp), len = axis.length();
    const geo = new THREE.SphereGeometry(1, 20, 14), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + 0.06 * Math.sin(p.getY(i) * 9 + p.getZ(i) * 7)));
    geo.computeVertexNormals();
    const w = shadow(new THREE.Mesh(geo, mottled(R.pick(['#6B4B30', '#5E4128', '#7A5638']), { scale: 9, amt: 0.25 })));
    const k = scale / 0.78; w.scale.set(0.115 * k, len / 2 + 0.07 * k, 0.12 * k); w.position.copy(mid);
    w.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    g.add(w);
  }
  return g;
}

// ---------- ground and trees ----------
// a boulder with a flattish top at height o.h, to sit on (userData.top gives the height)
export function boulder(R, { h = 1.0, r = 0.9, color = '#7D756B' } = {}) {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 5)), p = geo.attributes.position, v = new THREE.Vector3(), s = R() * 50;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = 0.84 + 0.22 * Math.sin(v.x * 3.1 + s) * Math.cos(v.z * 2.7 + s) + 0.05 * Math.sin(v.y * 9 + v.x * 7) + 0.025 * Math.sin(v.x * 23 + v.z * 19);
    v.multiplyScalar(n); let y = (v.y + 0.3) * h / 0.85; if (y > h * 0.8) y = h * 0.8 + (y - h * 0.8) * 0.35; y = Math.min(y, h + 0.015 * Math.sin(v.x * 11 + v.z * 7));
    p.setXYZ(i, v.x * r, y, v.z * r * 0.85);
  }
  geo.computeVertexNormals();
  const m = shadow(new THREE.Mesh(geo, mottled(color, { scale: 4, amt: 0.35 }))), g = new THREE.Group(); g.add(m); g.userData.top = h;
  return g;
}
// a low, spreading tree to climb: a leaning trunk, one long branch out along +x at about o.branchY, a light crown
export function climbTree(R, { branchY = 1.75, reach = 2.2 } = {}) {
  const g = new THREE.Group(), bark = mottled('#4F443A', { scale: 5, amt: 0.35 });
  const tube = (pts, r0, r1) => { const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), geo = new THREE.TubeGeometry(c, 20, 1, 9, false), p = geo.attributes.position, cp = c.getSpacedPoints(20), t = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { const ring = Math.floor(i / 10), u = ring / 20, rr = r0 + (r1 - r0) * u, q = cp[Math.min(20, ring)]; t.set(p.getX(i) - q.x, p.getY(i) - q.y, p.getZ(i) - q.z).multiplyScalar(rr); p.setXYZ(i, q.x + t.x, q.y + t.y, q.z + t.z); }
    geo.computeVertexNormals(); return shadow(new THREE.Mesh(geo, bark)); };
  g.add(tube([[0, -0.2, 0], [-0.05, 1.0, 0.02], [-0.15, 2.2, 0.0], [-0.1, 3.4, -0.1]], 0.2, 0.09));
  g.add(tube([[-0.05, branchY - 0.25, 0], [0.6, branchY, 0.02], [1.4, branchY + 0.05, 0.0], [reach, branchY + 0.25, -0.05]], 0.1, 0.035));
  g.add(tube([[-0.12, 2.3, 0], [-0.9, 3.0, 0.4], [-1.6, 3.5, 0.6]], 0.08, 0.03));
  g.add(tube([[-0.12, 2.6, 0], [0.5, 3.4, -0.5], [1.2, 3.9, -0.6]], 0.07, 0.03));
  // leaves: a few clumps of small cards round the top
  const leafMat = new THREE.MeshStandardMaterial({ color: '#5F6E3C', roughness: 0.85, side: THREE.DoubleSide });
  for (let i = 0; i < 160; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(R.range(0.06, 0.1), 5), leafMat); const a = R() * 6.28, d = Math.sqrt(R()) * 1.6; l.position.set(-0.2 + Math.cos(a) * d * 1.2, 3.5 + R.range(-0.3, 0.5) - d * 0.15, Math.sin(a) * d); l.rotation.set(R() * 3, R() * 3, R() * 3); l.castShadow = true; g.add(l); }
  for (let i = 0; i < 40; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(R.range(0.05, 0.08), 5), leafMat); const u = R(); l.position.set(0.6 + u * (reach - 0.6) + R.range(-0.1, 0.1), branchY + 0.15 + u * 0.2 + R.range(0, 0.2), R.range(-0.3, 0.3)); l.rotation.set(R() * 3, R() * 3, R() * 3); l.castShadow = true; g.add(l); }
  return g;
}
// a hide cloak over the shoulders and down the back, open at the front; hold it at the chest
export function cloak(R, { len = 0.85, color } = {}) {
  const pts = [[0.07, 0.42], [0.2, 0.36], [0.27, 0.27], [0.29, 0.1], [0.31, -0.2], [0.34, 0.42 - len]].map(([r, y]) => new THREE.Vector2(r, y)).reverse();
  const geo = new THREE.LatheGeometry(pts, 28, 0.75, Math.PI * 2 - 1.5), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), f = 1 + 0.05 * Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 9) * Math.max(0, 0.3 - y); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
  geo.computeVertexNormals();
  const m = shadow(new THREE.Mesh(geo, mottled(color || R.pick(['#6A4E36', '#5C4632', '#7B5E44', '#8A7258']), { scale: 7, amt: 0.3 }))); m.material.side = THREE.DoubleSide;
  const g = new THREE.Group(); g.add(m); return g;
}
// several things held at once by one figure (a load on the head and a baby on the back)
export function together(...things) { const g = new THREE.Group(); for (const t of things) g.add(t); return g; }
