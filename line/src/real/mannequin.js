// A painter's mannequin, built the way the real ones are: turned wooden parts on ball joints, a blank egg for a
// head, paddle hands, wedge feet. No face, ever. Kinds: man, woman, old, teen, child, toddler (proportions only).
// The figure faces +z; its left is +x. Rotations follow the joints: see poses.js for the conventions.
import * as THREE from 'three';
import { woodMaterial, TONES } from './wood.js';

const SEG = 28;
// a turned part: profile [[radius, y], ...] spun around y, squashed front to back by depth
function turned(profile, depth = 1, segs = SEG) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
  if (pts[0].y > pts[pts.length - 1].y) pts.reverse(); // the lathe wants the profile bottom to top, or it turns inside out
  const g = new THREE.LatheGeometry(pts, segs);
  if (depth !== 1) g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}
// smooth profile from a few control radii along a length (downwards from 0 to -len), with rounded ends
function limb(len, radii, cap = 0.6) {
  const n = 24, out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, k = u * (radii.length - 1), j = Math.min(radii.length - 2, Math.floor(k)), f = k - j, s = f * f * (3 - 2 * f);
    let r = radii[j] + (radii[j + 1] - radii[j]) * s;
    const e = Math.min(u, 1 - u) * len, rr = radii[u < 0.5 ? 0 : radii.length - 1] * cap; // round the ends
    if (e < rr) r *= Math.sqrt(Math.max(0, 1 - Math.pow(1 - e / rr, 2)));
    out.push([r, -u * len]);
  }
  return out;
}
function ball(r, depth = 1) { const g = new THREE.SphereGeometry(r, SEG, Math.round(SEG * 0.6)); if (depth !== 1) g.scale(1, 1, depth); return g; }
// the egg head: wider at the crown and back, narrower at the chin
function egg(h, w, d) {
  const pts = [];
  for (let i = 0; i <= 28; i++) { const a = (i / 28) * Math.PI, y = -Math.cos(a) * h / 2, r = Math.sin(a) * w / 2 * (1 + 0.12 * (y / (h / 2))); pts.push([r, y]); }
  const g = turned(pts, d / w); g.translate(0, 0, -0.008); return g;
}
// a paddle hand with a thumb, hanging down from the wrist
function hand(L, W, T) {
  const palm = new THREE.SphereGeometry(1, 20, 14); palm.scale(W / 2, L / 2, T / 2); palm.translate(0, -L / 2, 0);
  const thumb = new THREE.CapsuleGeometry(T * 0.38, L * 0.32, 6, 12); thumb.rotateZ(0.5); thumb.translate(W * 0.42, -L * 0.32, T * 0.15);
  return mergeAll([palm, thumb]);
}
// a wedge foot: heel under the ankle, toe forward (+z), flat sole
function foot(len, wid, hgt) {
  const s = new THREE.Shape();
  s.moveTo(-0.05 * len / 0.24, -hgt); s.lineTo(len * 0.8, -hgt); s.quadraticCurveTo(len * 0.86, -hgt * 0.45, len * 0.62, -hgt * 0.35);
  s.quadraticCurveTo(len * 0.2, -hgt * 0.05, 0.02, 0.012); s.quadraticCurveTo(-0.05 * len / 0.24, 0.0, -0.05 * len / 0.24, -hgt);
  const g = new THREE.ExtrudeGeometry(s, { depth: wid, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 4, curveSegments: 10 });
  g.translate(0, 0, -wid / 2); g.rotateY(-Math.PI / 2); g.computeVertexNormals();
  return g;
}
function mergeAll(gs) {
  // a tiny merge (positions, normals, uvs, index) so a part stays one mesh
  const parts = gs.map((g) => g.index ? g.toNonIndexed() : g), pos = [], nor = [];
  for (const g of parts) { g.computeVertexNormals(); pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return m;
}

const KINDS = {
  //            scale  head  shoulder hipW  limbT  armL  legL  chestR pelvisR
  man:     [1.00, 1.00, 0.185, 0.090, 1.00, 1.00, 1.00, 1.00, 1.00],
  woman:   [0.95, 0.97, 0.165, 0.098, 0.92, 0.97, 1.00, 0.92, 1.10],
  old:     [0.96, 1.00, 0.175, 0.092, 0.95, 1.00, 0.98, 0.98, 1.02],
  teen:    [0.92, 1.00, 0.170, 0.088, 0.88, 1.00, 1.03, 0.90, 0.95],
  child:   [0.66, 1.40, 0.150, 0.080, 1.05, 0.92, 0.90, 0.95, 1.00],
  toddler: [0.48, 1.70, 0.140, 0.078, 1.15, 0.85, 0.78, 1.00, 1.05],
};
const geoCache = new Map();

export function makeMannequin({ kind = 'man', tone = TONES.beech, seed = Math.random() * 100 } = {}) {
  const [S, HEAD, SH, HIPW, LT, ARM, LEG, CR, PR] = KINDS[kind] || KINDS.man;
  const mat = woodMaterial(tone, { seed });
  const key = kind;
  let G = geoCache.get(key);
  if (!G) {
    G = {
      pelvis: turned([[0.0005, -0.1], [0.07, -0.098], [0.12, -0.08], [0.15, -0.04], [0.15, 0.0], [0.13, 0.04], [0.1, 0.07], [0.0005, 0.075]].map(([r, y]) => [r * PR, y]), 0.66),
      waist: ball(0.078 * CR, 0.78),
      chest: turned([[0.0005, 0.0], [0.1, 0.005], [0.118, 0.04], [0.135, 0.12], [0.158, 0.22], [0.172, 0.29], [0.165, 0.33], [0.13, 0.36], [0.06, 0.375], [0.0005, 0.378]].map(([r, y]) => [r * CR, y]), 0.6),
      neck: turned(limb(0.1, [0.044, 0.04], 0.15).map(([r, y]) => [r * LT, -y])),
      head: egg(0.235 * HEAD, 0.165 * HEAD, 0.2 * HEAD),
      shoulder: ball(0.056 * LT, 0.95),
      upper: turned(limb(0.29 * ARM, [0.047, 0.046, 0.04, 0.035].map((r) => r * LT))),
      elbow: ball(0.036 * LT),
      fore: turned(limb(0.25 * ARM, [0.037, 0.041, 0.034, 0.027].map((r) => r * LT))),
      wrist: ball(0.026 * LT),
      hand: hand(0.175 * ARM, 0.075 * LT, 0.03 * LT),
      hip: ball(0.072 * LT),
      thigh: turned(limb(0.42 * LEG, [0.078, 0.074, 0.062, 0.05].map((r) => r * LT))),
      knee: ball(0.051 * LT),
      shin: turned(limb(0.42 * LEG, [0.048, 0.056, 0.045, 0.034, 0.031].map((r) => r * LT))),
      ankle: ball(0.034 * LT),
      foot: foot(0.24 * LEG, 0.085 * LT, 0.072 * LEG),
    };
    geoCache.set(key, G);
  }
  const mesh = (g, parent, y = 0) => { const m = new THREE.Mesh(g, mat); m.position.y = y; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const joint = (parent, x, y, z = 0) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };

  const root = new THREE.Group();          // ground point under the figure; heading turns it
  const hips = joint(root, 0, 0.95 * LEG / 1);  // the pelvis centre; moved up and down by snap()
  mesh(G.pelvis, hips);
  const waist = joint(hips, 0, 0.1); mesh(G.waist, waist);
  const chest = joint(waist, 0, 0.02); mesh(G.chest, chest);
  const neck = joint(chest, 0, 0.36); mesh(G.neck, neck);
  const head = joint(neck, 0, 0.09); const hm = mesh(G.head, head, 0.115 * HEAD); hm.rotation.x = -0.12;
  const J = { root, hips, waist, chest, neck, head };
  for (const [s, side] of [['l', 1], ['r', -1]]) {
    const sh = joint(chest, side * SH, 0.3); mesh(G.shoulder, sh);
    mesh(G.upper, sh, -0.01);
    const el = joint(sh, 0, -0.29 * ARM); mesh(G.elbow, el); mesh(G.fore, el, -0.005);
    const wr = joint(el, 0, -0.25 * ARM); mesh(G.wrist, wr);
    const hd = mesh(G.hand, wr, -0.012); if (side < 0) hd.scale.x = -1;
    const hp = joint(hips, side * HIPW, -0.045); mesh(G.hip, hp); mesh(G.thigh, hp, -0.01);
    const kn = joint(hp, 0, -0.42 * LEG); mesh(G.knee, kn); mesh(G.shin, kn, -0.005);
    const an = joint(kn, 0, -0.42 * LEG); mesh(G.ankle, an); mesh(G.foot, an, 0);
    Object.assign(J, { [s + 'Sh']: sh, [s + 'El']: el, [s + 'Wr']: wr, [s + 'Hip']: hp, [s + 'Knee']: kn, [s + 'Ank']: an, [s + 'Hand']: hd });
  }
  root.scale.setScalar(S);
  // points that can touch the ground
  const contacts = [];
  for (const s of ['l', 'r']) {
    contacts.push([J[s + 'Ank'], new THREE.Vector3(0, -0.084 * LEG, 0.19 * LEG)], [J[s + 'Ank'], new THREE.Vector3(0, -0.084 * LEG, -0.04)]);
    contacts.push([J[s + 'Knee'], new THREE.Vector3(0, 0, 0.05 * LT)], [J[s + 'Wr'], new THREE.Vector3(0, -0.17 * ARM, 0)], [J[s + 'El'], new THREE.Vector3(0, 0, -0.03)]);
    contacts.push([J[s + 'Sh'], new THREE.Vector3(side(s) * 0.05, 0, 0)], [J[s + 'Hip'], new THREE.Vector3(side(s) * 0.07, 0, 0)]);
  }
  contacts.push([hips, new THREE.Vector3(0, -0.1, 0)], [hips, new THREE.Vector3(0, -0.06, -0.09)], [head, new THREE.Vector3(0, 0.24 * HEAD, 0)], [head, new THREE.Vector3(0.08 * HEAD, 0.11 * HEAD, 0)], [head, new THREE.Vector3(-0.08 * HEAD, 0.11 * HEAD, 0)]);
  const v = new THREE.Vector3();
  const api = {
    root, J, mat, kind, height: 1.73 * S,
    // pose: see poses.js
    pose(P) {
      const rot = (o, a, arm) => { if (!a) { o.rotation.set(0, 0, 0); return; } if (typeof a === 'number') o.rotation.set(a, 0, 0); else if (a.dir) aim(o, a.dir, a.bend, arm ? 1 : -1, a.twist); else o.rotation.set(a[0] || 0, a[1] || 0, a[2] || 0, 'YXZ'); };
      hips.rotation.set(P.hipsX || 0, P.hipsY || 0, P.hipsZ || 0, 'YXZ');
      for (const k of ['waist', 'chest', 'neck', 'head', 'lSh', 'lEl', 'lWr', 'rSh', 'rEl', 'rWr', 'lHip', 'lKnee', 'lAnk', 'rHip', 'rKnee', 'rAnk']) rot(J[k], P[k], k.endsWith('Sh'));
      hips.position.set(P.dx || 0, 0.95 * LEG, P.dz || 0);
      api.lift = P.lift || 0;
    },
    // put the lowest contact point on the ground; ground(x, z) gives the height there
    snap(ground = () => 0) {
      root.position.y = 0; root.updateMatrixWorld(true);
      let lo = Infinity; for (const [o, p] of contacts) { v.copy(p).applyMatrix4(o.matrixWorld); lo = Math.min(lo, v.y); }
      root.position.y = ground(root.position.x, root.position.z) - lo + (api.lift || 0) + 0.002;
      root.updateMatrixWorld(true);
    },
    world(o, p = new THREE.Vector3()) { return p.applyMatrix4(o.matrixWorld); },
    headTop() { return api.world(head, new THREE.Vector3(0, 0.12 * HEAD, 0)); },
  };
  return api;
}
const side = (s) => (s === 'l' ? 1 : -1);
// point a limb: its length along dir (in the parent's space), turned about that line so the next joint bends towards
// bend. Knees bend the shin towards the limb's -z, elbows the forearm towards its +z (sign -1 legs, +1 arms).
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Matrix4();
function aim(o, dir, bend = [0, 0, 1], sign = 1, twist = 0) {
  _y.set(-dir[0], -dir[1], -dir[2]).normalize();
  _b.set(bend[0], bend[1], bend[2]); _b.addScaledVector(_y, -_b.dot(_y));
  if (_b.lengthSq() < 1e-6) _b.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.copy(_b.normalize()).multiplyScalar(sign); _x.crossVectors(_y, _z).normalize(); _z.crossVectors(_x, _y);
  _m.makeBasis(_x, _y, _z); o.quaternion.setFromRotationMatrix(_m);
  if (twist) o.rotateY(twist);
}
