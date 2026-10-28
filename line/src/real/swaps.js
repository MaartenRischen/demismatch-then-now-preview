// The swap cards: one situation seen twice with the same camera over the same subject. The top panel is now (a room
// or street built with the now-scenes kit), the bottom panel is the ancestors' world (world.js, as a story). Exactly
// one thing swaps to its ancestral equivalent in the same spot in frame. Stills, not clips: every figure is posed at
// one moment T and nothing moves.
//
// A case is data (line/cards/cases/<id>.json) plus the builders below. Coordinates in a case are "subject space":
// x and z as in the world, y measured from the surface the subject lies or sits on (support.top in the room,
// support.bottom above the ground outside). The camera is given in subject space too, so it stands in exactly the
// same place relative to the subject in both panels. The subject (red, gold ring) is built by one function for both
// panels, so its pose and head are identical by construction.
//
// buildSwap({ C, panel: 'top' | 'bottom', renderer, stage }) returns { scene, camera, look, render(t), head(),
// swapPoints(), info }: head() and swapPoints() are world points, for the gold ring and the lock check.
import * as THREE from 'three';
import { buildNow, lieOn, seatOn } from './now-scenes.js';
import { buildAncestors } from './world.js';
import { makeMannequin } from './mannequin.js';
import { POSE } from './poses.js';
import './poses-now.js';
import './poses-anc.js';
import { TONES } from './wood.js';
import * as I from './interior.js';
import { fire, shelter, hide, spear } from './camp.js';
import { NOISE_GLSL } from './wood.js';
import * as A from './props-anc.js';
import { nightSky, sunDir, lightFor } from './sky.js';
import { rng, makeHeight, bush, rock, acacia, fbm2 } from './nature.js';

export const T = 1.2; // the moment every still is taken at
const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const L = (dir, bend) => ({ dir, bend });
const FWD = [0, 0, 1], BACK = [0, 0, -1], DOWN = [0, -1, 0], UP = [0, 1, 0];

// ---------- poses the cards need (they add themselves to POSE; conventions in poses.js) ----------
Object.assign(POSE, {
  // an infant on its back mid-wail: back arched, head thrown back, arms and legs flung up into the air
  infantWail(t, r, o = {}) {
    // a reaching cry: arms bent up towards the face and out, fists by the head; knees drawn up to the belly, one leg
    // kicking; the back flat on the mattress, slightly curled, the head turned (an arched back lifts the body off its
    // support so it rests on the head alone)
    return {
      hipsX: -PI / 2, waist: [0.08, 0, 0], chest: [0.08, 0.05, 0.04], neck: [0.0, 0, 0], head: [-0.06, o.lookY ?? 0.45, 0.12],
      lSh: L([0.42 + (o.armOut ?? 0), 0.05 - (o.armDown ?? 0), 0.9], [0, 1, 0.2]), rSh: L([-0.35 - (o.armOut ?? 0), 0.15 - (o.armDown ?? 0), 0.92], [0, 1, 0.2]), lEl: -0.75, rEl: -0.6, lWr: [0, 0, 0.5], rWr: [0, 0, -0.5],
      lHip: L([0.22, 0.15, 0.96], DOWN), rHip: L([-0.2, -0.1, 0.97], DOWN), lKnee: 1.7, rKnee: 1.25, lAnk: -0.4, rAnk: -0.2,
    };
  },
  // on the back, head on the pillow, the right arm straight up holding something above the face (a phone); o.shade:
  // the same arm folded over to shade the eyes instead
  lieBackUp(t, r, o = {}) {
    // o.shade: the same raised arm, the hand opened flat against the light (shading the eyes from the sun)
    const arm = { rSh: L([-0.12, 0.2, 0.97], [0.6, 1, 0]), rEl: -0.7, rWr: o.shade ? [-0.35, 0, 0] : [0.6, 0, 0] };
    return {
      hipsX: -PI / 2, chest: [o.chestX ?? 0.06, 0, 0], neck: [o.neckX ?? 0.42, 0, 0], head: [0.28, o.lookY ?? 0.15, 0],
      lHip: L([0.1, -1, 0.04], BACK), rHip: L([-0.06, -1, 0.1], BACK), lKnee: 0.12, rKnee: 0.25, lAnk: 1.15, rAnk: 1.05,
      lSh: L([0.32, -0.94, 0.05], FWD), lEl: -0.35, lWr: o.lWr ?? [0, 0, 0], ...arm,
    };
  },
  // seated, the right arm raised in front: holding a phone up at a show (o.point: arm straight, pointing)
  sitRaise(t, r, o = {}) {
    const b = 0.012 * Math.sin(r * 9);
    // the phone arm and the pointing arm share the shoulder: the hand ends up in nearly the same place
    // o.left: the left arm does it (k flips x); o.bend: a pointing arm's elbow (a jab rather than a straight arm);
    // o.lean: leaning in. Varied per figure, so a row of pointing arms never reads as a salute.
    const k = o.left ? -1 : 1, s = o.left ? 'l' : 'r', f = o.left ? 'r' : 'l', sh = [k * (-0.1 + (o.side ?? 0)), 0.3 + (o.up ?? 0), 0.92];
    // o.film: the phone arm bent, the phone up in front of the face; pointing, the arm out (the hands land within the
    // swap's lock)
    const film = o.film ?? 0;
    const arm = o.point ? { [s + 'Sh']: L(sh, [0, 1, 0]), [s + 'El']: -(o.bend ?? 0.06), [s + 'Wr']: [0, 0, 0] } : { [s + 'Sh']: L([sh[0], sh[1] + film * 0.2, sh[2]], [0, 1, 0]), [s + 'El']: -0.32 - film, [s + 'Wr']: [1.0, 0, 0] };
    return {
      chest: [0.06 + b + (o.lean ?? 0), (o.turn ?? 0) * 0.5, 0], neck: [0.0, 0, 0], head: [o.headDown ?? -0.05, o.lookY ?? 0, 0],
      lHip: L([0.12, -0.05, 1], DOWN), rHip: L([-0.12, -0.05, 1], DOWN), lKnee: 1.45, rKnee: 1.5, lAnk: 0, rAnk: 0,
      [f + 'Sh']: L([-k * 0.18, -0.9, 0.4], FWD), [f + 'El']: -0.9, ...arm,
    };
  },
  // standing shoulder to shoulder, arms round the neighbours' backs (o.side: which arms reach out; 0 both)
  huddle(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    const lA = o.l === false ? { lSh: L([0.14, -1, 0.12], FWD), lEl: -0.5 } : { lSh: L([0.85, -0.05, -0.5], [0, 0, 1]), lEl: -0.55, lWr: [0, 0, 0.3] };
    const rA = o.r === false ? { rSh: L([-0.14, -1, 0.12], FWD), rEl: -0.5 } : { rSh: L([-0.85, -0.05, -0.5], [0, 0, 1]), rEl: -0.55, rWr: [0, 0, -0.3] };
    return { ...p, hipsZ: 0, hipsY: 0, chest: [0.12, 0, 0], neck: [0.12, 0, 0], head: [o.headDown ?? 0.38, o.lookY ?? 0, 0], ...lA, ...rA };
  },
  // a runway walk, mid-stride towards the camera, arms a little out (for the wings)
  runway(t, r, o = {}) {
    const p = POSE.walk(0.18, 0.1, { speed: 0.9, stride: 0.34 });
    return { ...p, hipsZ: 0.06, hipsY: 0.05, chest: [-0.03, -0.04, -0.03], neck: [-0.02, 0, 0], head: [0.0, 0, 0.04],
      lSh: L([0.32, -0.94, 0.06], FWD), rSh: L([-0.3, -0.94, 0.02], FWD), lEl: -0.25, rEl: -0.3, lWr: [0, 0, 0.2], rWr: [0, 0, -0.2] };
  },
  // standing, holding something up high in the right hand (the haunch)
  holdUp(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.35, 0.88, 0.32], [0, 0, 1]), rEl: -0.35, rWr: [0, 0, 0], head: [-0.12, 0, 0] };
  },
  // running in to bring news: leaning into the stride, one arm thrown forward and up, calling out
  runIn(t, r, o = {}) {
    // a sprint: leaning hard into it, arms pumping bent at the elbow, head up
    const p = POSE.run(t, r, { speed: 1.4, stride: 0.85, ...o });
    return { ...p, chest: [0.42, p.chest[1], 0], neck: [-0.3, 0, 0], head: [-0.15, o.lookY ?? 0, 0], lEl: -1.7, rEl: -1.7 };
  },
  // running in with both arms up, mid-shout (head back a little)
  runShout(t, r, o = {}) {
    const p = POSE.run(t, r, o);
    return { ...p, lSh: L([0.5, 0.82, 0.25], [0, 0, 1]), rSh: L([-0.45, 0.85, 0.3], [0, 0, 1]), lEl: -0.45, rEl: -0.6, neck: [-0.12, 0, 0], head: [-0.2, o.lookY ?? 0, 0] };
  },
});

// ---------- the subject and other locked figures ----------
// spec: { kind, pose, o, r, x, z, yaw, scale, red, wood, place: 'lie' | 'seat' | 'stand', sink, seed }
// base: the world height of subject space's y = 0 in this panel; spec.y: the support's height in subject space
// The cards' red: brighter and more saturated than the films' stained red, with a satin sheen, so "you" still reads
// in low light and at phone size
export const CARD_RED = '#EA3222';
function cardRed(m) { const mt = m.mat; mt.color.set(CARD_RED); mt.roughness = 0.38; mt.clearcoat = 0.6; mt.clearcoatRoughness = 0.25; mt.sheen = 0.7; mt.sheenRoughness = 0.35; mt.sheenColor = new THREE.Color('#FF7A5C'); return m; }
// every vertex of a mannequin's own body (not what is later hung on it), in world space
export function bodyVerts(m, step = 1) {
  m.root.updateMatrixWorld(true); const out = [], v = new THREE.Vector3();
  m.root.traverse((o) => { if (!o.isMesh || !o.userData.body) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += step) out.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone()); });
  return out;
}
// ---------- for the animated cards (studio animate): a pose as joint rotations, and blends between two ----------
const PKEYS = ['hips', 'waist', 'chest', 'neck', 'head', 'lSh', 'lEl', 'lWr', 'rSh', 'rEl', 'rWr', 'lHip', 'lKnee', 'lAnk', 'rHip', 'rKnee', 'rAnk'];
export function grabPose(m) { return { q: PKEYS.map((k) => m.J[k].quaternion.clone()), hp: m.J.hips.position.clone() }; }
export function setPose(m, A, B = null, u = 0) {
  PKEYS.forEach((k, i) => { const q = m.J[k].quaternion.copy(A.q[i]); if (B && u > 0) q.slerp(B.q[i], Math.min(1, u)); });
  m.J.hips.position.copy(A.hp); if (B && u > 0) m.J.hips.position.lerp(B.hp, Math.min(1, u));
  m.root.updateMatrixWorld(true);
}
// a pose function's pose, grabbed without disturbing the figure
function poseOf(m, P) { const keep = grabPose(m); m.pose(P); const g = grabPose(m); setPose(m, keep); return g; }
// the figure's pose with arm s laid down as the other arm rests (mirrored across the body)
function restArm(m, s) { const f = s === 'l' ? 'r' : 'l', g = grabPose(m); for (const j of ['Sh', 'El', 'Wr']) { const q = m.J[f + j].quaternion; g.q[PKEYS.indexOf(s + j)].set(q.x, -q.y, -q.z, q.w); } return g; }
const lerpAng = (a, b, u) => { let d = (b - a) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return a + d * u; };
// the crying infant's limbs: a kick on each burst (legs pump, arms thrash), and settling into a calm curl after
function babyMove(m, B, c, t) {
  setPose(m, B); const k = c.kick(t) * 1.6, st = c.settle(t), w = Math.sin(t * 11);
  m.J.lHip.rotateX(0.32 * k * w - 0.25 * st); m.J.rHip.rotateX(-0.32 * k * w - 0.25 * st);
  m.J.lKnee.rotateX(0.35 * k * Math.max(0, -w) + 0.3 * st); m.J.rKnee.rotateX(0.35 * k * Math.max(0, w) + 0.3 * st);
  m.J.lSh.rotateZ(0.22 * k * w); m.J.rSh.rotateZ(0.22 * k * w); m.J.lEl.rotateX(-0.3 * k * Math.max(0, w) - 0.35 * st); m.J.rEl.rotateX(-0.3 * k * Math.max(0, -w) - 0.35 * st);
  m.root.updateMatrixWorld(true);
}
// 03, both panels: the neighbours step in close round the subject (a few steps), still holding hands
function huddler(X) {
  const all = [X.subject, ...X.locked], C = X.C, chain = (C.chain || []).map((i) => all[i]), s0 = X.subject.root.position.clone(), K = C.huddleK || [0.78, 0.86, 0.74];
  const st = X.locked.map((m, i) => { const p0 = m.root.position.clone(), d = p0.clone().sub(s0).setY(0); return { m, p0, p1: s0.clone().add(d.multiplyScalar(K[i] ?? 0.8)), B: grabPose(m), r: 0.3 + i * 0.23 }; });
  // C.huddleGap: shoulder to shoulder along the chain, outwards from the subject (overrides the K factors)
  if (C.huddleGap) { const ci = chain.indexOf(X.subject), P = new Map([[X.subject, s0]]);
    for (const dirn of [-1, 1]) for (let k = ci + dirn; k >= 0 && k < chain.length; k += dirn) { const prev = chain[k - dirn], m = chain[k], q0 = P.get(prev), o0 = prev.root.position, d = m.root.position.clone().sub(o0).setY(0).normalize(); P.set(m, q0.clone().addScaledVector(d, C.huddleGap)); }
    for (const q of st) q.p1 = P.get(q.m).clone(); }
  const B0 = grabPose(X.subject), y = () => X.base;
  // the huddle itself: each figure's inner arms round its neighbours' backs (a figure's left hand is screen-right when
  // it faces us: chain[k]'s left arm reaches chain[k + 1]'s back, high; chain[k + 1]'s right arm reaches chain[k]'s
  // back, lower, so the two arms cross behind them without meeting); the outer arms of the end figures hang
  const rest = new Map([[X.subject, B0]].concat(st.map((q) => [q.m, q.B]))), hang = new Map();
  for (const m of chain) { setPose(m, rest.get(m)); const k = chain.indexOf(m); let g = grabPose(m); for (const sd of (k === 0 ? ['r'] : []).concat(k === chain.length - 1 ? ['l'] : []).concat(C.hugIn ? ['l', 'r'] : [])) { const p = poseOf(m, POSE.stand(T, 0.4, {})); for (const j of ['Sh', 'El', 'Wr']) g.q[PKEYS.indexOf(sd + j)].copy(p.q[PKEYS.indexOf(sd + j)]); } hang.set(m, g); }
  const hugArms = (ua = 1) => { for (let k = 0; k + 1 < chain.length; k++) { const A = chain[k], B = chain[k + 1];
    // (C.hugOne: one arm per pair, alternating sides, so two arms never cross behind the same pair of shoulders)
    // (the hand lands on the far side of the neighbour's back, so two hands on one back stay apart)
    // (on the way round, the hand passes outside the neighbour's near shoulder: the target starts beside them)
    const far = (from, to) => to.root.position.clone().sub(from.root.position).setY(0).normalize().multiplyScalar((C.hugFar ?? 0.1) * ua - 0.26 * (1 - ua));
    const pole = (m) => facing(m).negate().add(V(0, C.hugPoleUp ?? 0.2, 0)).normalize();
    // (hugOne: in each pair the figure nearer the subject reaches round the other: the subject holds both neighbours,
    // they hold the next ones out, and no back has two hands on it)
    // (hugIn: the two beside the subject reach round her instead, one over the shoulders, one round the waist)
    const ci = chain.indexOf(X.subject), adj = k === ci || k + 1 === ci, bReaches = C.hugIn && adj ? k + 1 !== ci : Math.abs(k + 1 - ci) < Math.abs(k - ci);
    // (the subject's arms go round their waists, lower: the neighbours' arms go over the shoulders)
    const hy = (m) => (m === X.subject ? C.hugSubY ?? 0.05 : C.hugIn && adj ? (k + 1 === ci ? C.hugHi ?? 0.27 : C.hugSubY ?? 0.05) : C.hugHi ?? 0.27);
    // (hugIn: only the two beside her reach; the outer pair keep holding hands)
    if (C.hugIn && !adj) { linkHands([A, B], { gap: C.chainGap ?? 0.03 }); continue; }
    // (the hand's path: up in front of the neighbour's shoulder first, then over and round behind, so it never sweeps
    // through a body or the hands it was holding)
    // (C.hugPath: start -> up in front of her shoulder -> over its top -> down behind; a keyframed path in her chest's
    // frame, from wherever the hand was)
    const path = (who, side, other) => {
      const fin = other.world(other.J.chest, V(0, hy(who), -(C.hugBack ?? 0.2))).add(far(who, other)); if (!C.hugPath || ua >= 1) return fin;
      const nearSide = who.root.position.clone().sub(other.root.position).setY(0).normalize().multiplyScalar(0.16);
      const P = [palmOf(who, side), other.world(other.J.chest, V(0, hy(who) - 0.04, 0.32)).add(nearSide.clone().multiplyScalar(1.4)), other.world(other.J.chest, V(0, hy(who) + 0.16, -0.04)).add(nearSide), fin];
      const x = ua * 3, k = Math.min(2, Math.floor(x)), f = x - k, e = f * f * (3 - 2 * f); return P[k].clone().lerp(P[k + 1], e);
    };
    if (C.hugOne && bReaches) reachTo(B, 'r', path(B, 'r', A), pole(B));
    else if (C.hugOne) reachTo(A, 'l', path(A, 'l', B), pole(A));
    else { reachTo(A, 'l', B.world(B.J.chest, V(0, C.hugHi ?? 0.27, -(C.hugBack ?? 0.2))), V(0, -1, -0.6)); reachTo(B, 'r', A.world(A.J.chest, V(0, C.hugLo ?? 0.12, -(C.hugBack ?? 0.2))), V(0, -1, -0.6)); } } };
  return (t, c) => {
    const u = c.huddle(t);
    // (the held hands let go first, quickly; the arms go round after)
    for (const m of chain) { const g = m === X.subject && C.hugSubLate ? Math.min(1, Math.max(0, (u - 0.3) / 0.4)) : Math.min(1, u * (C.hugLetGo ?? 1)); setPose(m, rest.get(m), hang.get(m), g * g * (3 - 2 * g)); }
    for (const q of st) {
      if (u <= 0) { q.m.root.position.copy(q.p0); if (q.yaw0 != null) q.m.root.rotation.y = q.yaw0; q.m.root.updateMatrixWorld(true); continue; }
      const w = Math.sin(PI * u) * 0.6; if (w > 0.01) { const now = grabPose(q.m), wk = poseOf(q.m, POSE.walk(t, q.r, { speed: 1.5, stride: 0.28 })); for (const k of ['lHip', 'lKnee', 'lAnk', 'rHip', 'rKnee', 'rAnk']) { const i = PKEYS.indexOf(k); now.q[i].slerp(wk.q[i], w); } setPose(q.m, now); }
      q.m.root.position.set(q.p0.x + (q.p1.x - q.p0.x) * u, 0, q.p0.z + (q.p1.z - q.p0.z) * u);
      // (huddleTurn: each turns in towards her as they close, so the shoulders angle in rather than meet)
      if (C.huddleTurn) { const to = s0.clone().sub(q.m.root.position), want = Math.atan2(to.x, to.z), y0 = q.yaw0 ??= q.m.root.rotation.y; let d = (want - y0) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; q.m.root.rotation.y = y0 + Math.sign(d) * Math.min(Math.abs(d), C.huddleTurn) * u; }
      q.m.snap(y);
      // (mid-step a toe can dip a few mm under the snap's contact points)
      if (w > 0.01) { q.m.root.position.y += 0.008 * w; q.m.root.updateMatrixWorld(true); }
    }
    // the arms go round as they close in
    if (u > (C.hugFrom ?? 0)) { const now = chain.map((m) => grabPose(m)), ua = Math.min(1, Math.max(0, (u - (C.hugFrom ?? 0)) / ((C.hugArmsBy ?? 0.35) - (C.hugFrom ?? 0)))); hugArms(ua * ua * (3 - 2 * ua)); const wa = Math.min(1, ua * (C.hugTake ?? 1)); chain.forEach((m, i) => setPose(m, now[i], grabPose(m), wa * wa * (3 - 2 * wa))); }
  };
}

// rest: the body's lowest point exactly on the support (2 mm clear), nothing sunk into it
function restOn(m, y) { m.root.position.y = 0; let lo = Infinity; for (const v of bodyVerts(m, 2)) lo = Math.min(lo, v.y); m.root.position.y = y - lo + 0.002; m.root.updateMatrixWorld(true); }
export function lockedFigure(parent, spec, base) {
  const m = makeMannequin({ kind: spec.kind || 'man', tone: spec.red ? TONES.red : TONES[spec.wood || 'beech'], seed: spec.seed ?? 7 });
  if (spec.red) cardRed(m);
  // an infant: short limbs and a bigger head than the toddler mannequin's
  if (spec.infant) { const ls = spec.limbScale ?? 0.78, ch = spec.chubby ?? 1; for (const k of ['lSh', 'rSh', 'lHip', 'rHip']) m.J[k].scale.set(ls * ch, ls, ls * ch); m.J.head.scale.setScalar(spec.headScale ?? 1.12);
    // (spec.chubby: a rounder belly and chest too, default 1)
    if (ch !== 1) for (const k of ['chest', 'hips', 'waist']) { const b = m.J[k].children.find((c) => c.isMesh); if (b) b.scale.set(ch, 1, ch); } }
  if (spec.phoneOff != null) m.root.userData.defaultPhoneOff = spec.phoneOff;
  if (spec.o?.left) m.root.userData.hand = 'l';
  m.root.traverse((o) => { if (o.isMesh) o.userData.body = true; });
  if (spec.scale) m.root.scale.multiplyScalar(spec.scale);
  m.root.position.set(spec.x || 0, 0, spec.z || 0); m.root.rotation.y = spec.yaw || 0; parent.add(m.root);
  m.pose(POSE[spec.pose](T + (spec.r ?? 0.3) * 10, spec.r ?? 0.3, spec.o || {}));
  const y = base + (spec.y || 0), place = spec.place || 'stand';
  if (place === 'lie') restOn(m, y);
  else if (place === 'seat') seatOn(m, y, spec.sink ?? -0.002);
  else m.snap(() => y);
  m.root.updateMatrixWorld(true);
  return m;
}
// a soft rim on the subject from the direction of the panel's real light (the moon, the fire, the phone, the sun):
// a spot behind and above the figure, aimed at it. rim: { from: 'moon' | 'sun' | [x, y, z] world direction, power,
// color, dist, angle }
function addRim(scene, m, rim, dirs = {}) {
  if (!rim) return null; if (Array.isArray(rim)) return rim.map((r) => addRim(scene, m, r, dirs)); m.root.updateMatrixWorld(true);
  const box = new THREE.Box3(); m.root.traverse((o) => { if (o.isMesh && o.userData.body) box.expandByObject(o); });
  const c = rim.at === 'head' ? headOf(m) : box.getCenter(V(0, 0, 0)), d = (typeof rim.from === 'string' ? dirs[rim.from] : V(...rim.from)).clone().normalize();
  const L = new THREE.SpotLight(rim.color || '#DCE6FF', rim.power ?? 6, 0, rim.angle ?? 0.35, rim.pen ?? 0.8, 2); L.position.copy(c).addScaledVector(d, rim.dist ?? 3); L.target.position.copy(c);
  scene.add(L, L.target); return L;
}
// A chain of held hands: figures left to right (as the camera sees them, each facing it), each one's left hand (its
// left is screen-right when it faces us) meeting the next one's right hand, gap metres apart, the arms straight.
// Deterministic, so both panels get the same chain.
function linkHands(figs, { gap = 0.03 } = {}) {
  const S = (m, s) => m.world(m.J[s + 'Sh'], V(0, 0, 0)), palm = (m, s) => palmOf(m, s);
  const aimArm = (m, s, H) => { // turn the shoulder so the straight arm runs to H (world)
    m.J[s + 'El'].rotation.set(0, 0, 0); m.J[s + 'Wr'].rotation.set(0, 0, 0); m.root.updateMatrixWorld(true);
    const sh = S(m, s), q = m.J.chest.getWorldQuaternion(new THREE.Quaternion()).invert(), d = H.clone().sub(sh).normalize().applyQuaternion(q);
    m.J[s + 'Sh'].quaternion.setFromUnitVectors(V(0, -1, 0), d); m.root.updateMatrixWorld(true);
  };
  for (let i = 0; i + 1 < figs.length; i++) {
    const A = figs[i], B = figs[i + 1];
    // the arm's reach: shoulder to palm with the arm straight
    aimArm(A, 'l', S(A, 'l').add(V(0, -1, 0))); const reach = palm(A, 'l').distanceTo(S(A, 'l'));
    const sa = S(A, 'l'), sb = S(B, 'r'), mid = sa.clone().add(sb).multiplyScalar(0.5), half = sa.distanceTo(sb) / 2 + 0.001;
    const r = reach + gap / 2, drop = Math.sqrt(Math.max(0, r * r - half * half)); mid.y -= drop; // where the two hands meet
    const dir = sb.clone().sub(sa).normalize();
    aimArm(A, 'l', mid.clone().addScaledVector(dir, -gap / 2)); aimArm(B, 'r', mid.clone().addScaledVector(dir, gap / 2));
  }
}
// Two-bone reach: bend side's ('l' | 'r') arm so its palm lands on H (world), the elbow swung towards pole (a world
// direction: down and out for a phone held in front of the face). Straight if H is out of reach.
function reachTo(m, side, H, pole = V(0, -1, 0)) {
  const Sh = m.J[side + 'Sh'], El = m.J[side + 'El'], Wr = m.J[side + 'Wr'];
  El.rotation.set(0, 0, 0); Wr.rotation.set(0, 0, 0); m.root.updateMatrixWorld(true);
  const S = m.world(Sh, V(0, 0, 0)), E0 = m.world(El, V(0, 0, 0)), P0 = palmOf(m, side), a = S.distanceTo(E0), b = E0.distanceTo(P0);
  const toH = H.clone().sub(S), d = Math.min(toH.length(), a + b - 1e-3), u = toH.normalize();
  const al = Math.acos(THREE.MathUtils.clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1)), pp = pole.clone().addScaledVector(u, -pole.dot(u)).normalize();
  const up = u.clone().multiplyScalar(Math.cos(al)).addScaledVector(pp, Math.sin(al)).normalize(), E = S.clone().addScaledVector(up, a);
  // the shoulder frame: -y along the upper arm, +z the way the forearm folds (towards the hand)
  const y = up.clone().negate(), zf = H.clone().sub(E); zf.addScaledVector(y, -zf.dot(y)); const z = zf.lengthSq() > 1e-8 ? zf.normalize() : pp.clone(), x = new THREE.Vector3().crossVectors(y, z).normalize(); z.crossVectors(x, y);
  const qw = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)), qp = m.J.chest.getWorldQuaternion(new THREE.Quaternion()).invert();
  Sh.quaternion.copy(qp.multiply(qw));
  const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1)); El.rotation.set(-bend, 0, 0);
  m.root.updateMatrixWorld(true);
}
// a seated figure's facing in the world, and a point in front of its face
const facing = (m) => V(0, 0, 1).applyQuaternion(m.J.chest.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
// the head: the centre of the egg itself (the joint is at the neck; a toddler's big head sits well above it)
const eggOf = (m) => m.J.head.children.find((c) => c.isMesh);
const headOf = (m, v = new THREE.Vector3()) => { const e = eggOf(m); if (!e.geometry.boundingSphere) e.geometry.computeBoundingSphere(); m.root.updateMatrixWorld(true); return v.copy(e.geometry.boundingSphere.center).applyMatrix4(e.matrixWorld); };
// the head's radius in metres: half the egg's height, at the figure's scale
const headR = (m) => { const e = eggOf(m); if (!e.geometry.boundingBox) e.geometry.computeBoundingBox(); const b = e.geometry.boundingBox; return (b.max.y - b.min.y) / 2 * e.getWorldScale(new THREE.Vector3()).x; };
const palmOf = (m, side = 'r', v = new THREE.Vector3()) => m.world(m.J[side + 'Wr'], v.set(0, -0.09, 0.01));

// a world point on the camera's ray through a subject-space point p, `dist` metres from the camera
function rayFrom(C, base) {
  const cam = V(...C.camera.pos).add(V(0, base, 0));
  return {
    cam,
    dir: (p) => V(...p).sub(V(...C.camera.pos)).normalize(),
    at: (p, dist) => cam.clone().addScaledVector(V(...p).sub(V(...C.camera.pos)).normalize(), dist),
    // the point on the ray through p that sits `above` metres over the ground (the far fire)
    onGround(p, above, ground, lo = 2, hi = 3000) {
      const d = V(...p).sub(V(...C.camera.pos)).normalize(), f = (s) => { const q = cam.clone().addScaledVector(d, s); return q.y - above - ground(q.x, q.z); };
      if (f(lo) * f(hi) > 0) return null;
      for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
      return cam.clone().addScaledVector(d, (lo + hi) / 2);
    },
  };
}

// ---------- small things the cases build ----------
const std = (color, rough = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const shadowed = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
// a cot: four posts, top and bottom rails, round slats on all four sides, a mattress whose top is at `top`
// near: the height of the near side above the mattress (a drop-side cot let down; the far side and ends stay full height)
function cot({ w = 0.7, l = 1.28, top = 0.52, rail = 0.42, near = null, color = '#E2D6C2' } = {}) {
  const g = new THREE.Group(), m = I.woodFurniture({ color, axis: 'y', rough: 0.45 }), mt = 0.11, floor = top - mt - 0.04, H = top + rail;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) I.block(g, m, 0.045, H + 0.03, 0.045, x * l / 2, 0, z * w / 2, 0.01);
  const Hn = near == null ? H : top + near; // the near side's top rail
  for (const z of [-1, 1]) { I.block(g, m, l, 0.04, 0.035, 0, (z > 0 ? Hn : H) - 0.04, z * w / 2, 0.008); I.block(g, m, l, 0.06, 0.03, 0, floor - 0.02, z * w / 2, 0.006); }
  for (const x of [-1, 1]) { I.block(g, m, 0.035, 0.04, w, x * l / 2, H - 0.04, 0, 0.008); I.block(g, m, 0.03, 0.06, w, x * l / 2, floor - 0.02, 0, 0.006); }
  const slat = new THREE.CylinderGeometry(0.0085, 0.0085, H - 0.04 - floor, 10); slat.translate(0, (H - 0.04 + floor) / 2, 0);
  const slatN = new THREE.CylinderGeometry(0.0085, 0.0085, Math.max(0.01, Hn - 0.04 - floor), 10); slatN.translate(0, (Hn - 0.04 + floor) / 2, 0);
  for (const z of [-1, 1]) for (let x = -l / 2 + 0.1; x < l / 2 - 0.05; x += 0.1) I.mesh(z > 0 ? slatN : slat, m, x, 0, z * w / 2, { parent: g });
  for (const x of [-1, 1]) for (let z = -w / 2 + 0.1; z < w / 2 - 0.05; z += 0.1) I.mesh(slat, m, x * l / 2, 0, z, { parent: g });
  I.block(g, m, l - 0.02, 0.025, w - 0.02, 0, floor, 0, 0.004);
  I.mesh(I.rbox(l - 0.05, mt, w - 0.05, 0.03, 3), I.fabric({ color: '#ECEAE6', sheen: 0.3, weave: 0.5 }), 0, top - mt / 2, 0, { parent: g });
  return g;
}
// paired eyes in the dark: the tapetum throwing back the moonlight (real reflected light, small and dim)
function eyeshine({ gap = 0.075, r = 0.011, color = '#D8F0A8', value = 1.6, size = 1 } = {}) {
  r *= size; gap *= size;
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(value) }); mat.toneMapped = true;
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat); e.scale.set(1, 0.8, 0.5); e.position.x = s * gap / 2; e.userData.noAO = true; g.add(e); }
  return g;
}
// a hide's hair, painted in code: a pale centre going darker to the edge, combed strokes of lighter and darker hair
function furTex(color = '#C8A47A', edge = '#6E5038', seed = 7) {
  const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), R = rng(seed);
  const g = x.createRadialGradient(N / 2, N / 2, N * 0.08, N / 2, N / 2, N * 0.62); g.addColorStop(0, color); g.addColorStop(0.7, color); g.addColorStop(1, edge); x.fillStyle = g; x.fillRect(0, 0, N, N);
  x.lineCap = 'round';
  for (let i = 0; i < 7000; i++) { const px = R() * N, py = R() * N, a = Math.atan2(py - N / 2, px - N / 2) + R.range(-0.6, 0.6), l = R.range(10, 26), k = R();
    x.strokeStyle = k < 0.5 ? `rgba(255,240,220,${R.range(0.1, 0.3)})` : `rgba(40,25,15,${R.range(0.12, 0.32)})`; x.lineWidth = R.range(1.5, 3.5);
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// a shrub to be seen up close: thin dark stems and a few thousand small leaves in a lumpy dome (the savanna's
// billboard bushes are made for distance; near the lens their cards show edges)
function shrub(seed, { size = 1, tint = '#4A5530', leaves = 2600 } = {}) {
  const R = rng(seed), g = new THREE.Group(), stem = std('#2E2720', 0.9);
  const lumps = Array.from({ length: 5 }, () => [R.range(-0.5, 0.5) * size, R.range(0.35, 0.7) * size, R.range(-0.35, 0.35) * size, R.range(0.28, 0.45) * size]);
  for (let i = 0; i < 14; i++) { const [x, y, z] = R.pick(lumps), c = new THREE.Mesh(new THREE.CylinderGeometry(0.004 * size, 0.012 * size, 1, 5), stem); const top = V(x + R.range(-0.15, 0.15), y, z + R.range(-0.15, 0.15)), bot = V(R.range(-0.08, 0.08) * size, 0, R.range(-0.08, 0.08) * size);
    c.position.copy(top).add(bot).multiplyScalar(0.5); c.scale.y = top.distanceTo(bot); c.quaternion.setFromUnitVectors(V(0, 1, 0), top.clone().sub(bot).normalize()); c.castShadow = true; g.add(c); }
  const geo = new THREE.CircleGeometry(1, 6); geo.scale(1, 0.55, 1);
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.8, side: THREE.DoubleSide }), inst = new THREE.InstancedMesh(geo, mat, leaves), col = new THREE.Color(), base = new THREE.Color(tint);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(1, 1, 1), p = V(0, 0, 0);
  for (let i = 0; i < leaves; i++) {
    const [x, y, z, r] = lumps[i % lumps.length], u = V(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(r * Math.cbrt(R()) * 1.0);
    p.set(x + u.x, Math.max(0.03, y + u.y * 0.8), z + u.z); e.set(R() * PI, R() * PI, R() * PI); q.setFromEuler(e); sc.setScalar(R.range(0.018, 0.034) * Math.sqrt(size)); M.compose(p, q, sc); inst.setMatrixAt(i, M);
    inst.setColorAt(i, col.copy(base).multiplyScalar(R.range(0.6, 1.15)));
  }
  inst.castShadow = inst.receiveShadow = true; g.add(inst);
  return g;
}
// a low dark thicket: a few overlapping shrubs
function thicket(seed, { n = 4, size = 1.2, spread = 1.0, tint = '#4E5A34' } = {}) {
  const R = rng(seed), g = new THREE.Group();
  for (let i = 0; i < n; i++) { const b = shrub(seed + i * 3.1, { size: size * R.range(0.75, 1.25), tint }); b.position.set(R.range(-spread, spread), 0, R.range(-spread * 0.6, spread * 0.6)); b.rotation.y = R() * 6.28; g.add(b); }
  return g;
}
// no sparks: a far fire's rising sparks smear into a streak at card size
const noSparks = (f) => { f.traverse((o) => { if (o.isPoints) o.visible = false; }); return f; };
// a fire's shape, for the studio cards: o.stones false hides the hearth ring; o.flame [sx, sy] stretches the flame
// planes (narrower and taller); o.logs scales the logs. The flame's update only rescales its group, so the planes
// themselves can be stretched.
function shapeFire(f, o) {
  if (!o) return f;
  for (const c of f.children) {
    if (c.isMesh && c.geometry.type === 'DodecahedronGeometry' && o.stones === false) c.visible = false;
    // (its grey smoke sprites, drawn over the flame, wash it out to grey at card size)
    if (c.isSprite && o.smoke === false) c.visible = false;
    if (c.isMesh && c.geometry.type === 'CylinderGeometry' && o.logs) { c.scale.setScalar(o.logs); c.position.multiplyScalar(o.logs); }
    if (c.isGroup && o.flame) for (const pl of c.children) if (pl.isMesh) { pl.scale.set(o.flame[0], o.flame[1], 1); pl.position.y *= o.flame[1]; }
    // o.gain: the flame's brightness on the card, held against the exposure (the approach sets uGain = gain / exposure),
    // so a fire metered for a dark night stays orange instead of burning out to white
    if (c.isGroup && o.gain) { const fm = c.children.find((q) => q.isMesh)?.material; if (fm && !fm.uniforms.uGain) { fm.uniforms.uGain = { value: 1 }; fm.userData.gain0 = o.gain; fm.fragmentShader = fm.fragmentShader.replace('uniform float uT, uSeed;', 'uniform float uT, uSeed, uGain;').replace('c * a * 2.4', 'c * a * uGain'); fm.needsUpdate = true; } }
  }
  if (o.light) { const u = f.userData.update, L = f.children.find((c) => c.isPointLight); f.userData.update = (t) => { u(t); L.intensity *= o.light; }; }
  // o.tongues: [[x, z, size], ...] the engine's flame swapped for drawn tongues of flame (the torches' teardrops,
  // orange round a yellow core), so it reads as fire and not as a pale cone of light
  if (o.tongues) {
    for (const c of f.children) if (c.isGroup && c.children.some((q) => q.isMesh && q.material.blending === THREE.AdditiveBlending)) c.visible = false;
    const ups = [];
    o.tongues.forEach(([x, z, sz], i) => { const t = torch2(70 + i, sz, { light: 0 }), fl = t.children[0]; t.remove(fl); fl.position.set(x, 0.02, z); f.add(fl); ups.push(t.userData.update); fl.userData.t = t; });
    const u = f.userData.update; f.userData.update = (t) => { u(t); for (const g of ups) g(t); };
  }
  return f;
}
// a flame on a stick: a torch held high on a far ridge (a fire() made small, its light short). flame: the flame's
// size (1 = a hand torch); the stick stays TORCH_STICK long whatever the flame
const TORCH_STICK = 1.2, TORCH_GRIP = 0.55, torchFlameY = (flame) => TORCH_STICK + 0.05 + 0.5 * 0.32 * flame;
function torch(seed, flame = 1) {
  const g = new THREE.Group(), f = fire({ seed, size: 0.32 * flame, night: true, shadows: false });
  f.children.filter((c) => c.isMesh && c.geometry.type === 'DodecahedronGeometry').forEach((c) => (c.visible = false)); // no hearth stones on a torch
  f.children.filter((c) => c.isMesh && c.geometry.type === 'CylinderGeometry').forEach((c) => c.scale.setScalar(1 / flame)); // nor a bonfire's logs
  f.position.y = TORCH_STICK; g.add(f);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, TORCH_STICK, 6), std('#2A2018')); s.position.y = TORCH_STICK / 2; g.add(s);
  g.userData.update = f.userData.update;
  return g;
}
// a hand torch for the studio cards: a stick with a bundle at the top and a real flame shape on it, a teardrop of
// orange round a yellow core with a darker red tip, a little dark smoke above. Not additive: its colour is set
// directly and held against the camera's exposure (uniform uGain, set to k / exposure by the approach after metering),
// so the flame stays orange and never burns out to white. flame: the flame's size (1 = 0.32 m tall), as torch().
function torch2(seed, flame = 1, { light = 1.2 } = {}) {
  const g = new THREE.Group(), R = rng(seed), H = 0.32 * flame, W = H * 0.62;
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uGain: { value: 1 }, uSeed: { value: R() * 40 }, uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uGain, uSeed, uT;
      ${NOISE_GLSL}
      void main(){
        float y = vUv.y, n = fbm3(vec3(vUv * vec2(3.0, 2.5) - vec2(0.0, uT * 1.8), uSeed + uT * 0.6));
        // a teardrop: widest a quarter of the way up, drawn out to a licking tip
        float w = 0.47 * pow(sin(3.14159 * clamp(pow(y, 0.62), 0.0, 1.0)), 0.85) * (1.0 - 0.25 * y);
        float x = abs(vUv.x - 0.5 + (n - 0.5) * 0.4 * y) * (1.0 + 0.5 * (fbm3(vec3(vUv.y * 6.0 - uT * 2.0, uSeed, 2.0)) - 0.5) * y);
        float a = smoothstep(w, w * 0.72, x) * smoothstep(0.0, 0.05, y);
        float core = smoothstep(w * 0.75, w * 0.15, x) * smoothstep(0.75, 0.2, y);
        vec3 c = mix(vec3(0.85, 0.2, 0.03), vec3(1.0, 0.45, 0.06), smoothstep(0.85, 0.3, y));
        c = mix(c, vec3(1.0, 0.78, 0.3), core * 0.8);
        if (a < 0.02) discard;
        gl_FragColor = vec4(c * uGain, a);
      }` });
  mat.userData.gain0 = 1.0;
  const fl = new THREE.Group(); fl.position.y = TORCH_STICK + 0.05;
  for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat); pl.position.y = H / 2; pl.rotation.y = (i / 3) * PI; pl.userData.noAO = true; fl.add(pl); }
  g.add(fl);
  // the bundle the flame burns on, and the stick
  const bun = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * Math.sqrt(flame), 0.035, 0.16, 8), std('#1E1610', 0.95)); bun.position.y = TORCH_STICK; g.add(bun);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, TORCH_STICK, 6), std('#2A2018')); s.position.y = TORCH_STICK / 2; g.add(s);
  // thin dark smoke above the tip
  const sm = new THREE.MeshBasicMaterial({ color: '#141210', transparent: true, opacity: 0.05, depthWrite: false });
  // (a soft column, faint enough never to read as a shape of its own)
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CircleGeometry(W * (0.22 + i * 0.1), 16), sm); p.position.set((R() - 0.4) * W * 0.4 * i, TORCH_STICK + 0.05 + H * (0.95 + i * 0.22), 0); p.userData.noAO = true; fl.parent.add(p); }
  const L = new THREE.PointLight('#FF9A40', light, 6, 2); L.position.y = TORCH_STICK + 0.05 + H * 0.4; g.add(L);
  const ph = R() * 9;
  // (userData.fade: 1 burning .. 0 out)
  g.userData.update = (t) => { const f = g.userData.fade ?? 1; mat.uniforms.uT.value = t; const k = Math.sin(t * 9.1 + ph) * Math.sin(t * 4.3 + ph * 2); fl.scale.set((1 - 0.04 * k) * f, (1 + 0.09 * k) * f, f); fl.visible = f > 0.02; L.intensity = light * (0.88 + 0.12 * k) * f; };
  return g;
}
// a strike drone as the public knows a drone: a body on four arms, a rotor at each end (a dark blurred disc round a
// hub), landing legs and a payload slung under it. A dark shape against the night sky.
function drone2() {
  const g = new THREE.Group(), m = std('#141517', 0.55), disc = new THREE.MeshStandardMaterial({ color: '#1A1B1E', roughness: 0.7, transparent: true, opacity: 0.72, side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.62), m); g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10, 0, PI * 2, 0, PI / 2), m); top.scale.set(1, 0.5, 1.4); top.position.y = 0.07; g.add(top);
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.95), m); arm.position.set(x * 0.33, 0.02, z * 0.33); arm.rotation.y = Math.atan2(x, z); g.add(arm);
    const mot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12), m); mot.position.set(x * 0.66, 0.08, z * 0.66); g.add(mot);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.012, 32), disc); rot.position.set(x * 0.66, 0.16, z * 0.66); g.add(rot);
    // two blades over the disc (they turn in the animated cards)
    const bl = new THREE.Group(); bl.position.set(x * 0.66, 0.175, z * 0.66); for (const a of [0, PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.012, 0.05), m); b.rotation.y = a; bl.add(b); } g.add(bl); (g.userData.rotors ||= []).push(bl);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), m); leg.position.set(x * 0.2, -0.22, z * 0.22); g.add(leg);
  }
  const pay = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 12), m); pay.rotation.x = PI / 2; pay.position.y = -0.2; g.add(pay);
  return g;
}
// feathered show wings: two fans of long white feathers rising from the shoulder blades, curving out and down.
// Built at the chest joint, so they move with the figure. span: reach of each wing in metres
function showWings({ span = 0.95, rise = 0.75, color = '#F4F1EA', seed = 3 } = {}) {
  const R = rng(seed), g = new THREE.Group();
  const geo = new THREE.CircleGeometry(1, 10); geo.translate(0, -1, 0); geo.scale(0.5, 1, 1); // a feather hanging from its quill
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide });
  const rows = [[1.0, 0.36, 0.055, 24], [0.82, 0.26, 0.05, 30], [0.64, 0.18, 0.045, 34], [0.46, 0.12, 0.04, 36]]; // [reach of the row, feather length, width, count]
  const n = rows.reduce((a, r) => a + r[3], 0) * 2, inst = new THREE.InstancedMesh(geo, mat, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(1, 1, 1), p = V(0, 0, 0), col = new THREE.Color();
  let k = 0;
  for (const side of [1, -1]) for (const [reach, len, wid, cnt] of rows) for (let i = 0; i < cnt; i++) {
    const u = i / (cnt - 1), a = u * PI * 0.9; // round the arc: from rising off the back, over the top, out and down
    const x = side * (0.06 + Math.sin(a * 0.75) * span * reach), y = 0.2 + Math.sin(a) * rise * reach * (1.1 - 0.3 * u) - u * u * 0.25 * reach, z = -0.13 - u * 0.12 * reach - (1 - reach) * 0.03;
    p.set(x, y, z); e.set(R.range(-0.15, 0.1) - 0.2, side * (0.25 + u * 0.2), side * (-(0.35 + u * 1.05) * (1.15 - reach * 0.4)) + R.range(-0.08, 0.08), 'YXZ'); q.setFromEuler(e);
    sc.set(wid * R.range(0.85, 1.15), len * (0.7 + 0.5 * u) * R.range(0.9, 1.1), 1); M.compose(p, q, sc); inst.setMatrixAt(k, M); inst.setColorAt(k, col.set(color).multiplyScalar(R.range(0.92, 1.02))); k++;
  }
  inst.castShadow = inst.receiveShadow = true; g.add(inst);
  return g;
}
// show lingerie: a satin bra and briefs set with crystals (small mirrored stones) catching the stage light
function showLingerie(m, { color = '#E8E2DA', stones = '#FFFFFF' } = {}) {
  const sat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, sheen: 0.6, clearcoat: 0.4 }), gem = new THREE.MeshPhysicalMaterial({ color: stones, roughness: 0.05, metalness: 1, clearcoat: 1 });
  const R = rng(5), gg = new THREE.OctahedronGeometry(0.007, 0);
  const cups = []; for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.062, 20, 12, 0, PI * 2, 0, PI * 0.55), sat); c.rotation.x = PI / 2 + 0.25; c.scale.set(1, 1, 0.8); c.position.set(sx * 0.068, 0.235, 0.085); m.J.chest.add(shadowed(c)); cups.push(c); }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.012, 8, 32), sat); band.rotation.x = PI / 2; band.scale.set(1, 0.68, 1); band.position.set(0, 0.2, 0.0); m.J.chest.add(band);
  const brief = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.11, 0.1, 28, 1, true), sat); brief.material = sat.clone(); brief.material.side = THREE.DoubleSide; brief.scale.set(1, 1, 0.68); brief.position.set(0, -0.045, 0.0); m.J.hips.add(shadowed(brief));
  for (let i = 0; i < 140; i++) { const c = cups[i % 2], st = new THREE.Mesh(gg, gem), a = R() * PI * 2, b = R() * PI * 0.5; st.position.set(Math.cos(a) * Math.sin(b) * 0.064, Math.cos(b) * 0.064, Math.sin(a) * Math.sin(b) * 0.064); c.add(st); }
  for (let i = 0; i < 60; i++) { const st = new THREE.Mesh(gg, gem), a = R.range(-1.1, 1.1); st.position.set(Math.sin(a) * 0.155, R.range(-0.08, 0.0), Math.cos(a) * 0.105); m.J.hips.add(st); }
  return m;
}
// a roast haunch: a leg of meat browned and charred at the edges, the knuckle of bone sticking out (origin at the
// bone end, where a hand holds it; the meat hangs along +y)
function roastHaunch(seed = 2, size = 1) {
  const R = rng(seed), g = new THREE.Group();
  const pts = [[0.012, 0], [0.016, 0.05], [0.035, 0.09], [0.085, 0.15], [0.115, 0.24], [0.12, 0.32], [0.1, 0.4], [0.05, 0.45], [0.001, 0.46]].map(([r, y]) => new THREE.Vector2(r * size, y * size));
  const geo = new THREE.LatheGeometry(pts, 24), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const f = 1 + 0.08 * Math.sin(p.getY(i) * 40 + Math.atan2(p.getX(i), p.getZ(i)) * 3 + seed); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f * 0.8); }
  geo.computeVertexNormals();
  const meat = new THREE.MeshStandardMaterial({ color: '#4A2A14', roughness: 0.5 });
  meat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\nfloat ch = smoothstep(0.55, 0.8, fbm3(vMP * 22.0)); diffuseColor.rgb = mix(diffuseColor.rgb * (0.8 + 0.4 * fbm3(vMP * 9.0)), vec3(0.06, 0.04, 0.03), ch * 0.8);'); };
  const m = new THREE.Mesh(geo, meat); m.castShadow = true; g.add(m);
  const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.016 * size, 0.018 * size, 0.2 * size, 8), std('#EDE4D0', 0.5)); bone.position.y = -0.07 * size; g.add(bone);
  for (const sx of [-1, 1]) { const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024 * size, 10, 8), std('#EDE4D0', 0.5)); knob.position.set(sx * 0.018 * size, -0.17 * size, 0); g.add(knob); }
  return g;
}
// a roast haunch that reads at a glance: a whole hind leg, the thick rounded joint of meat tapering down a long shank
// to a bare white bone with a knuckle at its end. Origin at the knuckle; the meat runs along +y. Roasted: brown with
// darker crackling and lighter fat catching the light.
function roastHaunch2(size = 1, color = '#8A4A22') {
  const g = new THREE.Group(), k = size;
  const prof = [[0.045, 0.1], [0.05, 0.16], [0.07, 0.24], [0.1, 0.33], [0.135, 0.43], [0.155, 0.52], [0.152, 0.58], [0.13, 0.64], [0.09, 0.68], [0.04, 0.705], [0.001, 0.712]].map(([r, y]) => new THREE.Vector2(r * k, y * k));
  const geo = new THREE.LatheGeometry(prof, 32), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / k, a = Math.atan2(p.getX(i), p.getZ(i)), f = 1 + 0.05 * Math.sin(y * 31 + a * 3) + 0.03 * Math.sin(a * 7 + y * 13);
    // flattened front to back and swelling to one side (a leg is not a turned thing)
    p.setX(i, p.getX(i) * f * 1.08 + 0.03 * k * Math.max(0, Math.sin(Math.PI * Math.min(1, (y - 0.25) / 0.45)))); p.setZ(i, p.getZ(i) * f * 0.78); }
  geo.computeVertexNormals();
  const meat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  meat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvMP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vMP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\nfloat ch = smoothstep(0.58, 0.8, fbm3(vMP * 26.0)); float fat = smoothstep(0.6, 0.75, fbm3(vMP * 11.0 + 4.0)); diffuseColor.rgb = mix(diffuseColor.rgb * (0.8 + 0.35 * fbm3(vMP * 9.0)), vec3(0.16, 0.07, 0.03), ch * 0.75); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.48, 0.34), fat * 0.45);'); };
  const m = new THREE.Mesh(geo, meat); m.castShadow = true; g.add(m);
  const bm = std('#EFE6D2', 0.45), bone = new THREE.Mesh(new THREE.CylinderGeometry(0.022 * k, 0.028 * k, 0.14 * k, 12), bm); bone.position.y = 0.07 * k; bone.castShadow = true; g.add(bone);
  for (const sx of [-1, 1]) { const kn = new THREE.Mesh(new THREE.SphereGeometry(0.03 * k, 14, 10), bm); kn.position.set(sx * 0.022 * k, 0.0, 0); kn.castShadow = true; g.add(kn); }
  return g;
}
// a seat under a seated figure: a round top just under the pelvis, narrow enough to keep clear of the thighs
// (stone: a rough stone of the same size, for the camp)
function stool(scene, f, base, color, stone = false, ground = () => 0, m = null) {
  // its top 4 mm under the lowest point of the body above it (or 1.6 cm under the seat height)
  let top = base + f.y - 0.016; if (m) { let lo = Infinity; for (const v of bodyVerts(m, 1)) if (Math.hypot(v.x - f.x, v.z - f.z) < (stone ? 0.32 : 0.16)) lo = Math.min(lo, v.y); if (lo < Infinity) top = Math.min(top, lo - 0.004); }
  const g = ground(f.x, f.z), h = top - g, r = 0.13, z = f.z - 0.02 * Math.cos(f.yaw || 0), x = f.x - 0.02 * Math.sin(f.yaw || 0);
  if (stone === 'stump') { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, h, 14), std(color, 0.9)); st.position.set(x, g + h / 2, z); st.castShadow = st.receiveShadow = true; scene.add(st); return st; }
  if (stone) { const b = A.boulder(rng(f.x * 7 + 3), { h: h - 0.02, r: 0.3, color }); b.position.set(x, g - 0.002, z); scene.add(b); return b; }
  const s = new THREE.Group(); I.mesh(new THREE.CylinderGeometry(r, r, 0.04, 24), I.paint({ color, rough: 0.5 }), 0, h - 0.02, 0, { parent: s });
  I.mesh(new THREE.CylinderGeometry(0.025, 0.03, h - 0.04, 10), I.metal('#3A3A3E', 0.4), 0, (h - 0.04) / 2, 0, { parent: s });
  I.mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.02, 20), I.metal('#3A3A3E', 0.4), 0, 0.01, 0, { parent: s }); s.position.set(x, g, z); scene.add(s); return s;
}
// where a figure holds its phone: in front of the face, f.film.ahead metres out along its facing, f.film.up above
// the eyes (the same point in both panels)
function filmPoint(m, f) { const e = m.world(m.J.head, V(0, 0.11, 0.08)); return e.addScaledVector(facing(m), f.film?.ahead ?? 0.34).add(V(0, f.film?.up ?? 0, 0)); }
// a raider standing with a torch held up (a dark wood mannequin; no weapon raised)
function raider(i, yaw, sc = 1) {
  const m = makeMannequin({ kind: 'man', tone: '#4A3E34', seed: 50 + i }); m.root.rotation.y = yaw; if (sc !== 1) m.root.scale.multiplyScalar(sc); // dark, neutral wood: no red cast
  m.pose(POSE.holdUp(T, 0.2 + i * 0.3)); return m;
}
// a drone of the kind sent at power stations: a long body, a swept delta wing, fins at the tips; a dark shape
function drone() {
  const g = new THREE.Group(), m = std('#1A1B1D', 0.6);
  const s = new THREE.Shape(); s.moveTo(0, 1.6); s.lineTo(1.25, -0.6); s.lineTo(1.25, -0.9); s.lineTo(0.2, -0.75); s.lineTo(0, -1.0); s.lineTo(-0.2, -0.75); s.lineTo(-1.25, -0.9); s.lineTo(-1.25, -0.6); s.lineTo(0, 1.6);
  const w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }), m); w.rotation.x = -PI / 2; g.add(w);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 2.6, 10), m); b.rotation.x = PI / 2; b.position.set(0, 0.1, -0.2); g.add(b);
  for (const x of [-1.22, 1.22]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 0.4), m); f.position.set(x, 0.2, 0.75); g.add(f); }
  return g;
}
// a coat over a mannequin: a padded shell from the shoulders to the thigh, sleeves over the upper arms, a hood
// folded at the neck. Built in the figure's own joints so it follows the pose.
function coat(m, { color = '#3A3F48', len = 0.62, hood = true } = {}) {
  const mat = I.fabric({ color, sheen: 0.35, rough: 0.8, weave: 0.6 }), sk = m.root.scale.x;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, len - 0.3, 6, 18), mat); body.scale.set(1.0, 1, 0.74); body.position.set(0, 0.24 - (len - 0.62) * 0.5, -0.005); m.J.chest.add(shadowed(body));
  const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.205, 0.28, 18, 1, true), mat); hip.material.side = THREE.DoubleSide; hip.scale.set(1, 1, 0.78); hip.position.set(0, -0.08, 0); m.J.hips.add(shadowed(hip));
  for (const s of ['l', 'r']) { const sl = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 4, 12), mat); sl.position.y = -0.13; m.J[s + 'Sh'].add(shadowed(sl));
    const fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.16, 4, 12), mat); fo.position.y = -0.1; m.J[s + 'El'].add(shadowed(fo)); }
  if (hood) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.045, 10, 20), mat); h.rotation.x = PI / 2 - 0.25; h.position.set(0, 0.36, -0.02); m.J.chest.add(shadowed(h)); }
  return m;
}
// a battery lantern on the ground: a plastic body, a frosted globe lit from inside (a real lamp: its light is real)
function lantern({ power = 2.2 } = {}) {
  const g = new THREE.Group(), body = I.plastic('#2E3238', 0.4);
  I.mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.07, 20), body, 0, 0.035, 0, { parent: g });
  const globe = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.12, 20), I.glow('#FFF2DC', 2.2)); globe.position.y = 0.13; globe.userData.noAO = true; g.add(globe);
  I.mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.03, 20), body, 0, 0.205, 0, { parent: g });
  I.mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 20, PI), body, 0, 0.22, 0, { parent: g });
  const Lt = new THREE.PointLight('#FFEBD0', power, 0, 2); Lt.position.y = 0.14; Lt.castShadow = true; Lt.shadow.mapSize.set(1024, 1024); Lt.shadow.bias = -0.002; Lt.shadow.radius = 4; Lt.shadow.camera.near = 0.08; g.add(Lt);
  return g;
}
// a candle seen through a window far off: a dim warm square of light behind glass
function candleWindow(w = 1.1, h = 1.3, value = 0.5) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h), mat = new THREE.ShaderMaterial({ uniforms: { uV: { value } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uV; void main(){ vec2 d = (vUv - vec2(0.45, 0.32)) * vec2(1.4, 1.0); float k = exp(-dot(d, d) * 7.0); gl_FragColor = vec4(vec3(1.0, 0.55, 0.22) * uV * (0.12 + k), 1.0); }' });
  mat.toneMapped = true; const p = new THREE.Mesh(geo, mat); p.userData.noAO = true; g.add(p);
  return g;
}

// the gap under a lying head: where its lowest point is and how high above the support (for a pillow made to fit)
function headRest(m) { const e = eggOf(m); m.root.updateMatrixWorld(true); const p = e.geometry.attributes.position, v = V(0, 0, 0); let lo = Infinity, x = 0, z = 0;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(e.matrixWorld); if (v.y < lo) { lo = v.y; x = v.x; z = v.z; } }
  let sup = Infinity; for (const w of bodyVerts(m, 2)) sup = Math.min(sup, w.y); return { x, z, lift: Math.max(0.02, lo - sup - 0.004) }; }
// where a phone held up in the right hand sits: just off the palm, screen to the face (subject built with the top pose)
// (just past the fingers, along the forearm, so the hand holds its edge rather than sitting inside it)
function phonePose(m) {
  const s = m.root.userData.hand || 'r', wr = m.world(m.J[s + 'Wr'], V(0, 0, 0)), el = m.world(m.J[s + 'El'], V(0, 0, 0)), along = wr.clone().sub(el).normalize();
  const at = palmOf(m, s).addScaledVector(along, m.root.userData.phoneOff ?? m.root.userData.defaultPhoneOff ?? 0.07), eye = m.world(m.J.head, V(0, 0.11, 0.08));
  return { at, eye };
}
// the subject as posed in the top panel, built off-scene, for cases whose bottom needs a point from it
function topSubject(C) { const g = new THREE.Group(); const m = lockedFigure(g, { ...C.subject, red: true, ...(C.subject.top || {}) }, 0); g.updateMatrixWorld(true); return m; }

// ---------- the cases ----------
// top(X): build the room or street into X.K (the now-scenes kit); bottom(X): add to the ancestors' scene. Both
// return { swap: [world points] }. X carries C (the case), base (subject space y = 0 in world), ray, subject.
// the cases; more register themselves from line/src/real/swap-cases/ (registerCase), one module per case
export const CASES = {
  '02-fantasy-bra-outrage': {
    top(X) {
      const { K, C, base, subject, locked } = X, { I, scene } = K, D = C.top, all = [subject, ...locked];
      // the show: a glossy raised runway running from the front row away past the model, lit like a stage, a pale
      // backdrop at its far end washed with light; the hall round it falls off into shadow
      const Tm = V(...D.model.at), u = V(Tm.x, 0, Tm.z).normalize(), yaw = Math.atan2(u.x, u.z);
      K.env(D.env ?? 0.05);
      I.mesh(new THREE.PlaneGeometry(80, 80), I.paint({ color: D.floor ?? '#2A2A2E', rough: 0.55 }), 0, 0, 0, { rx: -PI / 2, parent: scene, cast: false });
      const rw = new THREE.Mesh(I.rbox(D.runway.w, D.runway.h, D.runway.len, 0.02, 3), new THREE.MeshPhysicalMaterial({ color: D.runway.color ?? '#ECEAE6', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03 }));
      rw.position.copy(Tm).addScaledVector(u, D.runway.len / 2 - D.runway.before); rw.position.y = D.runway.h / 2; rw.rotation.y = yaw; rw.receiveShadow = rw.castShadow = true; scene.add(rw);
      const back = Tm.clone().addScaledVector(u, D.runway.len - D.runway.before + 0.5); const bd = I.mesh(new THREE.PlaneGeometry(16, 8), I.plaster({ color: '#D8D2C8' }), back.x, 4, back.z, { parent: scene }); bd.lookAt(0, 4, 0);
      K.spot('#FFE9D0', D.backWash, back.clone().addScaledVector(u, -5).setY(7), back.clone().setY(2.5), 0.7, 0.8);
      for (const [i, d] of D.lights.entries()) { const at = Tm.clone().addScaledVector(u, d), side = V(-u.z, 0, u.x).multiplyScalar(i % 2 ? 1.8 : -1.8);
        const L = K.spot('#FFF3E2', D.lightPower, at.clone().add(side).setY(6.5), at.clone().setY(D.runway.h), 0.4, 0.55, i === 0 ? { size: 2048, radius: 3, bias: -0.0004, near: 1 } : null);
        const can = I.mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.3, 14), I.metal('#1C1C1E', 0.5), L.position.x, 6.5, L.position.z, { parent: scene }); can.lookAt(L.target.position); can.rotateX(PI / 2); }
      // the model walking towards the front row in jewelled lingerie and white show wings
      const md = makeMannequin({ kind: 'woman', tone: TONES.beech, seed: 61 }); md.root.position.set(Tm.x, 0, Tm.z); md.root.rotation.y = yaw + PI; scene.add(md.root);
      md.pose(POSE.runway(T, 0.3)); md.snap(() => D.runway.h); showLingerie(md); md.J.chest.add(showWings());
      // the front row on stools, every hand up with a phone, screen to its owner; a soft light from behind the row
      // so the backs read
      K.spot('#E8ECF4', D.rowLight, [-2.2, 3.6, 3.2], [0, 0.8, 0], 0.55, 0.8);
      // the hall behind the row: a dark grey wall, a little light on it, so the figures stand against something
      if (D.hallWall) { const w = I.mesh(new THREE.PlaneGeometry(30, 7), I.plaster({ color: D.hallWall }), -2, 3.5, -9, { parent: scene }); w.lookAt(2.6, 3.5, 5.6); K.spot('#C8D0E0', D.hallWash, [1, 6, 2], [-2, 1.5, -9], 0.8, 0.9); }
      const swap = [], phones = [];
      for (const [i, m] of all.entries()) {
        const f = [C.subject, ...C.locked][i]; stool(scene, f, base, '#26262A', false, () => 0, m);
        // (one hand: its palm below the phone, the fingers reaching up to its edge)
        // filming: the phone held sideways in both hands in front of the face (or up in one hand), the screen to the
        // eyes and turned a little our way so its light shows
        const at = filmPoint(m, f), eye = m.world(m.J.head, V(0, 0.11, 0.08)), side = V(-facing(m).z, 0, facing(m).x);
        const ph = I.phone({ kind: D.phoneKind ?? 'feed', seed: 3 + i, value: D.phoneValue, light: D.phoneLight ?? 0.8, flicker: 0, lightColor: '#DDE4F0' }); if (D.phoneScale) ph.scale.setScalar(D.phoneScale);
        // studio: a wider dark frame round the screen, so it reads as a phone and not a white card
        if (D.phoneBezel) { const sc = ph.children.find((c) => c.position.z > 0.004); if (sc) sc.scale.set(D.phoneBezel, D.phoneBezel * 1.04 - 0.04, 1); }
        const hw = 0.135 + 0.095 * ((D.phoneScale ?? 1) - 1);
        // (hold: the hands on the phone at `at`; the animation calls it again to move the subject's phone)
        const hold = (at) => {
          if (f.film?.two) { reachTo(m, 'l', at.clone().addScaledVector(side, hw), V(0.3, -1, 0)); reachTo(m, 'r', at.clone().addScaledVector(side, -hw), V(-0.3, -1, 0)); ph.up.copy(side); }
          else { reachTo(m, f.film?.hand || 'r', at.clone().add(V(0, -0.17 - 0.08 * ((D.phoneScale ?? 1) - 1), 0)), V(0, -1, 0)); ph.up.set(0, 1, 0); }
          ph.position.copy(at); ph.lookAt(eye.clone().lerp(V(...C.camera.pos).add(V(0, base, 0)), D.phoneToCam ?? 0.5));
        };
        hold(at); scene.add(ph); phones.push(ph, m.J.lEl, m.J.rEl); if (i === 0) X.hold0 = { hold, at: at.clone() };
        if (D.phoneGlow) K.point('#D8E2F4', D.phoneGlow, at.x, at.y + 0.02, at.z).distance = 1.2; if (i === 0) swap.push(ph.position.clone());
      }
      // animation: the subject's phone jabs at her on each pulse; the model sways where she stands
      const mB = grabPose(md), toM = Tm.clone().setY(1.3).sub(X.hold0.at).normalize(), sB = grabPose(subject);
      const anim = (t, c) => {
        const j = c.jab(t), an = c.anger ? c.anger(t) : 0; setPose(subject, sB);
        // (leaning in at her, the shoulders hunched up; then the phone thrust out at her on each pulse)
        subject.J.waist.rotateX((D.leanAnger ?? 0.12) * an + 0.06 * j); subject.J.chest.rotateX(0.05 * an); subject.J.neck.rotateX(-0.1 * an); subject.root.updateMatrixWorld(true);
        X.hold0.hold(X.hold0.at.clone().addScaledVector(toM, (D.jabReach ?? 0.16) * j + 0.05 * an).add(V(0, 0.02 * j, 0)));
        const sw = Math.sin((2 * PI * t) / 2.5); setPose(md, mB); md.J.hips.rotateY(0.12 * sw); md.J.hips.rotateZ(0.03 * sw); md.J.chest.rotateZ(-0.04 * sw); md.J.chest.rotateY(-0.06 * sw); md.root.updateMatrixWorld(true);
      };
      return { swap, swapObjects: phones, anim, targets: () => [headOf(md)] };
    },
    bottom(X) {
      const { scene, C, ground, subject, locked, updates } = X, D = C.bottom, all = [subject, ...locked], R = rng(13);
      const Tm = V(...C.top.model.at), u = V(Tm.x, 0, Tm.z).normalize(), yaw = Math.atan2(u.x, u.z);
      // the band on stones by the fire, every arm pointing at her
      // a stump of wood under each of them, its top fitted just under the body
      for (const [i, m] of all.entries()) stool(scene, [C.subject, ...C.locked][i], 0, '#7A5E44', 'stump', ground, m);
      // D.fireAt: [metres to her side, metres towards the row] (studio: small and to one side, never between them)
      const F = D.fireAt ? Tm.clone().addScaledVector(V(-u.z, 0, u.x), D.fireAt[0]).addScaledVector(u, -D.fireAt[1]) : Tm.clone().addScaledVector(u, -D.fireBefore), fr = shapeFire(noSparks(fire({ seed: 4, size: D.fireSize, night: true })), D.fireShape); fr.position.set(F.x, ground(F.x, F.z), F.z); scene.add(fr); updates.push(fr.userData.update);
      // where the model stood: a young woman, clean, holding up the biggest roast haunch; an older woman behind with
      // a hand on her shoulder; three dusty hunters behind them, spears lowered, nothing in their hands
      const girl = makeMannequin({ kind: 'woman', tone: TONES.beech, seed: 71 }); girl.root.position.set(Tm.x, 0, Tm.z); girl.root.rotation.y = yaw + PI; scene.add(girl.root);
      girl.pose(POSE.holdUp(T, 0.3)); girl.snap(ground);
      if (D.haunchBoth) {
        // studio: the haunch raised overhead in both hands, its length across the picture so its shape shows: one fist
        // round the bone by the knuckle, the other hand under the meat
        const B = D.haunchBoth, cam = V(...C.camera.pos), hd = headOf(girl), right = V(0, 1, 0).cross(cam.clone().sub(hd).setY(0).normalize()).normalize();
        const axis = right.clone().multiplyScalar(B.dir ?? 1).applyAxisAngle(cam.clone().sub(hd).setY(0).normalize(), (B.dir ?? 1) * (B.tilt ?? 0.35)).normalize();
        const h = B.make ? B.make(B.size ?? 1) : roastHaunch2(B.size ?? 1, B.meat), S0 = hd.clone().add(V(0, B.up ?? 0.42, 0)).addScaledVector(axis, -(B.back ?? 0.22) * (B.size ?? 1));
        h.position.copy(S0); h.quaternion.setFromUnitVectors(V(0, 1, 0), axis); scene.add(h);
        const L = 0.62 * (B.size ?? 1);
        const grip = (S0, axis) => {
          h.position.copy(S0); h.quaternion.setFromUnitVectors(V(0, 1, 0), axis);
          reachTo(girl, 'r', S0.clone().addScaledVector(axis, 0.06 * (B.size ?? 1)).add(V(0, -(B.gripR ?? 0.02), 0)), V(0, -1, 0).addScaledVector(axis, -0.6));
          reachTo(girl, 'l', S0.clone().addScaledVector(axis, L * 0.62).add(V(0, -(B.gripL ?? 0.1) * (B.size ?? 1), 0)), V(0, -1, 0).addScaledVector(axis, 0.6));
        };
        grip(S0, axis); X.haunch = { h, grip, S0: S0.clone(), axis: axis.clone() };
      } else {
      // the bone in the fist, the knuckle end below it, the meat held up and out
      const h = roastHaunch(3, D.haunch ?? 1.35); h.rotation.set(PI, 0, 0.75); girl.J.rWr.add(h); h.position.set(0, -0.2, 0.02);
      }
      const side = V(-u.z, 0, u.x), O = Tm.clone().addScaledVector(u, D.oldAt?.[0] ?? 0.55).addScaledVector(side, D.oldAt?.[1] ?? 0.42);
      const old = makeMannequin({ kind: D.oldKind ?? 'old', tone: TONES[D.oldTone ?? 'oak'], seed: 72 }); old.root.position.set(O.x, 0, O.z); old.root.rotation.y = yaw + PI - 0.15; scene.add(old.root);
      old.pose(POSE.shoulderHand(T, 0.4, { lookY: -0.2 })); old.snap(ground);
      // (D.dress: an approach's own clothing for the two women, default none)
      if (D.dress) { D.dress(girl, 'young'); D.dress(old, 'old'); }
      // (D.girlLight: [power, [dx, dy, dz] from her], a warm soft spot on the two women, default none)
      if (D.girlLight) { const gl = new THREE.SpotLight('#FFC08A', D.girlLight[0], 0, 0.3, 1, 2); gl.position.copy(girl.root.position).add(V(...D.girlLight[1])); gl.target.position.copy(girl.root.position).add(V(0, 1.1, 0)); scene.add(gl, gl.target); }
      // studio: the hand resting on the young woman's nearer shoulder, the arm relaxed (elbow down)
      if (D.oldRest) { const sh = ['l', 'r'].map((k) => girl.world(girl.J[k + 'Sh'], V(0, 0, 0))), O0 = old.world(old.J.rSh, V(0, 0, 0)), near = sh.sort((a, b) => a.distanceTo(O0) - b.distanceTo(O0))[0];
        const back = girl.root.position.clone().sub(Tm).setY(0); back.copy(O).sub(girl.root.position).setY(0).normalize();
        // (oldRestAt 'back': on the back of her nearer shoulder, clear of her raised arm)
        const nearL = girl.world(girl.J.lSh, V(0, 0, 0)).distanceTo(O0) < girl.world(girl.J.rSh, V(0, 0, 0)).distanceTo(O0);
        const tgt = D.oldRestAt === 'back' ? girl.world(girl.J.chest, V((nearL ? 1 : -1) * (D.oldRestX ?? 0.1), 0.27, -(D.oldRestZ ?? 0.15))) : near.add(V(0, D.oldRestUp ?? 0.06, 0)).addScaledVector(back, D.oldRestBack ?? 0);
        reachTo(old, 'r', tgt, V(0, -1, 0)); }
      for (const [j, k] of D.hunters.entries()) {
        const P = D.huntersAt ? V(D.huntersAt[j][0], 0, D.huntersAt[j][1]) : Tm.clone().addScaledVector(u, D.huntersBack + (j % 2) * 0.6).addScaledVector(side, k), m = makeMannequin({ kind: 'man', tone: TONES.ash, seed: 80 + j });
        m.root.position.set(P.x, 0, P.z); m.root.rotation.y = yaw + PI + 0.2 * (j - 1); scene.add(m.root);
        m.mat.color.set(D.hunterTone ?? '#6E5C48'); // dusty, darker than the clean young woman
        if (D.huntersAt) m.root.rotation.y = D.huntersYaw[j]; // walking back into camp, heads down, past her
        m.pose(D.huntersAt ? POSE.walk(T + j * 0.37, 0.2 + j * 0.25, { headDown: 0.3, speed: 0.6 }) : POSE.stand(T, 0.2 + j * 0.25, { headDown: 0.15 })); m.snap(ground);
        // lowered: carried at the side, the point down at the ground
        const sp = A.spearAt(R, { length: 2.0, grip: D.spearGrip ?? 0.62 }); sp.rotation.set(PI - (D.spearSlant ?? 0.12), 0, 0.05); m.J.rWr.add(sp); sp.position.set(0, -0.1, 0.05);
      }
      // the pointing hands, where the phones were (forearm and hand of every pointing arm)
      // every arm thrown out at her: the hand where the phone was (the subject's lands on the phone's spot), each
      // figure's own arm and angle, the other arm dropped
      const fs = [C.subject, ...C.locked], target = Tm.clone().setY(1.5), objs = [];
      for (const [i, m] of all.entries()) { const f = fs[i], s = f.point?.hand || 'r', at = filmPoint(m, f);
        const S = m.world(m.J[s + 'Sh'], V(0, 0, 0)), toHer = target.clone().add(V(0, f.point?.dy ?? 0, 0)).sub(S).normalize();
        // the subject points at her, bent a little towards where its phone was (its hand keeps the swap's lock)
        const dir = i === 0 ? at.clone().sub(S).normalize().lerp(toHer, D.subjectAim ?? 0.5).normalize() : toHer;
        reachTo(m, s, S.clone().addScaledVector(dir, f.point?.reach ?? 0.62), V(0, -1, 0).addScaledVector(dir, -0.2)); objs.push(m.J[s + 'El']);
        if (i === 0) X.jab0 = { S, dir, reach: f.point?.reach ?? 0.62, s }; }
      // animation: the subject's arm jabs on each pulse; she lowers the haunch and holds it out to the camp
      // (sharing), then the row's arms come down
      // (arms down: both arms as the pose's free arm rests, on the lap: the filming arm of the pose is up too)
      const pts = all.map((m) => grabPose(m)), rests = all.map((m, i) => { const f = { ...fs[i], ...(fs[i].bottom || {}) }, free = f.o?.left ? 'r' : 'l', other = free === 'l' ? 'r' : 'l', r = f.r ?? 0.3;
        const raw = poseOf(m, POSE[f.pose](T + r * 10, r, f.o || {})), g = grabPose(m);
        for (const j of ['Sh', 'El', 'Wr']) { const q = raw.q[PKEYS.indexOf(free + j)]; g.q[PKEYS.indexOf(free + j)].copy(q); g.q[PKEYS.indexOf(other + j)].set(q.x, -q.y, -q.z, q.w); } return g; });
      // the share: she steps towards the row and holds the meat out to them at arm's length; the older woman's hand
      // comes off her shoulder as she goes
      const H = X.haunch, row = all.reduce((a, m) => a.add(m.root.position), V(0, 0, 0)).multiplyScalar(1 / all.length), toRow = row.clone().sub(girl.root.position).setY(0).normalize();
      const G0 = girl.root.position.clone(), G1 = G0.clone().addScaledVector(toRow, D.shareStep ?? 0.7), gB = H ? grabPose(girl) : null, oB = grabPose(old), oR = restArm(old, 'r');
      girl.root.position.copy(G1); girl.snap(ground); const S1 = girl.world(girl.J.chest, V(0, 0.3, 0)).addScaledVector(toRow, D.shareReach ?? 0.42), ax1 = toRow.clone().add(V(0, 0.12, 0)).normalize(); girl.root.position.copy(G0); girl.snap(ground);
      const anim = (t, c) => {
        const j = c.jab(t), ad = c.armsDown(t), sh = c.share(t);
        all.forEach((m, i) => {
          setPose(m, pts[i]);
          if (i === 0 && j > 0) { const J0 = X.jab0, d = J0.dir.clone().add(V(0, 0.2 * j, 0)).normalize(); reachTo(m, J0.s, J0.S.clone().addScaledVector(d, J0.reach), V(0, -1, 0).addScaledVector(d, -0.2)); }
          if (ad > 0) setPose(m, grabPose(m), rests[i], ad);
        });
        setPose(old, oB, oR, Math.min(1, sh * 2));
        if (H) {
          const w = Math.sin(PI * sh) * 0.8; setPose(girl, gB); if (w > 0.01) setPose(girl, gB, poseOf(girl, POSE.walk(t, 0.3, { speed: 1.2, stride: 0.36 })), w);
          girl.root.position.copy(G0).lerp(G1, sh); girl.snap(ground);
          H.grip(H.S0.clone().addScaledVector(toRow, (D.shareStep ?? 0.7) * sh).lerp(S1, sh), H.axis.clone().lerp(ax1, sh).normalize());
        }
      };
      return { swap: [palmOf(subject, fs[0].point?.hand || 'r')], swapObjects: objs, anim, targets: () => [headOf(girl)], movers: [girl, old] };
    },
  },
  '03-ukraine-grid-strikes': {
    top(X) {
      const { K, C, base, subject, locked } = X, { I, scene } = K, D = C.top;
      // the sky over a city with its grid down: dark, low cloud catching a little light from districts still lit
      // the same moonlit sky as the bottom panel; the moon just above the drones, its light on the blocks
      scene.add(nightSky({ moon: sunDir(...C.moon), seed: 11, lift: D.nightLift ?? 1, moonDeg: C.moonDeg || 0, moonBright: C.moonBright || 1 }));
      const ml = new THREE.DirectionalLight('#A8BCE8', D.moonLight ?? 1.5); ml.position.copy(sunDir(...C.moon)).multiplyScalar(80); ml.target.position.set(0, 0, -10); scene.add(ml, ml.target);
      K.shadow(ml, { size: 4096, radius: 3, bias: -0.0004 }); Object.assign(ml.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
      K.env(D.env ?? 0.05);
      // the blocks: concrete, nearly every window dark; three lit by candles
      // (darkGlass: the window glass barely mirrors the moonlit sky, so the outage reads: every window dark but the candles)
      const blocks = I.buildings(D.blocks, { lit: 0.0, facade: '#4A4844', floorH: 3.0, seed: 6, glassRough: D.darkGlass != null ? 0.9 : 0.12 }); if (D.darkGlass != null) blocks.material.envMapIntensity = D.darkGlass; scene.add(blocks);
      for (const [x, y, z] of D.candles) { const w = candleWindow(1.0, 1.25, D.candleValue ?? 0.9); w.position.set(x, y, z); scene.add(w); }
      // the courtyard: worn asphalt, a kerb, bare trees
      I.mesh(new THREE.PlaneGeometry(400, 400), I.paint({ color: '#1C1C1E', rough: 1 }), 0, 0, -100, { rx: -PI / 2, parent: scene, cast: false }); // matte: a moon glare off wet-looking asphalt would outshine the moon
      for (const [x, z, h, sd] of D.trees || [[-6, -9, 7, 2], [5.5, -12, 8, 5]]) K.add(I.tree({ seed: sd, h, tint: '#3A3A30' }), x, 0, z);
      // the four neighbours in coats round one battery lantern
      // coats on the neighbours; the subject stays uncovered red in both panels (the same in both worlds)
      for (const [i, m] of [subject, ...locked].entries()) if (i > 0) coat(m, { color: [C.subject, ...C.locked][i].coat, hood: D.coatHood !== false });
      const ln = lantern({ power: D.lanternPower ?? 2.6 }); K.add(ln, ...D.lantern);
      // three drones, upper right, dark against the cloud
      const drones = [], swap = C.swap.points.map((p, i) => { const d = D.quad ? drone2() : drone(), w = V(...p).add(V(0, base, 0)); d.scale.setScalar(D.droneScale || 1); d.position.copy(w);
        // banked towards us, so the delta wing shows its shape rather than its edge
        const toCam = V(...C.camera.pos).add(V(0, base, 0)).sub(w).normalize(); d.up.copy(V(0, 1, 0).lerp(toCam, D.droneBank ?? 1).normalize()); d.lookAt(w.clone().add(V(-1, -0.3, 0.1 * (i - 1)))); if (D.quad) d.rotateZ(D.quadRoll?.[i] ?? 0); scene.add(d); drones.push(d); return w; });
      // animation: the neighbours huddle in; the drones hover, their rotors turning
      const hud = huddler(X), home = drones.map((d) => d.position.clone());
      // (the drones keep coming: the first drifts in towards the courtyard over the loop)
      const camW = V(...C.camera.pos).add(V(0, base, 0)), near = D.droneNear ?? 0.3;
      const anim = (t, c) => { hud(t, c); drones.forEach((d, i) => { d.position.copy(home[i]); if (i === 0) d.position.lerp(camW, near * Math.min(1, Math.max(0, t / 10))); d.position.y += 0.4 * (Math.sin((2 * PI * t) / 1.7 + i * 2.1) - Math.sin(i * 2.1)); for (const r of d.userData.rotors || []) r.rotation.y = t * 41 + i; }); };
      return { swap, swapObjects: drones, anim, targets: () => drones.map((d) => d.position.clone()) };
    },
    prepare(C, ray) {
      const D = C.bottom, fl = D.torchFlame ?? 1, rises = [], raiders = [];
      C.swap.points.forEach((p, i) => {
        const q = ray.at(p, D.torchDist[i]), yaw = Math.atan2(ray.cam.x - q.x, ray.cam.z - q.z) + 0.5 * (i - 1);
        const m = raider(i, yaw, D.raiderScale ?? 1), g = new THREE.Group(); g.add(m.root); m.snap(() => 0);
        const F = palmOf(m, 'r').add(V(0, torchFlameY(fl) - TORCH_GRIP, 0)); // the flame from the feet
        const x = q.x - F.x, z = q.z - F.z;
        rises.push({ x, z, top: q.y - F.y, rx: D.ridge.rx, rz: D.ridge.rz }); raiders.push({ x, z, yaw });
      });
      return { rises, raiders };
    },
    bottom(X) {
      const { scene, C, ground, ray, subject, locked, updates, prep } = X, D = C.bottom, R = rng(9);
      // hide cloaks on the four, a small fire where the lantern was
      if (D.cloaks) for (const [i, m] of [subject, ...locked].entries()) if (i > 0) m.J.rWr.add(A.held(A.cloak(R, { len: 0.8, color: D.cloakColors?.[i] }), { at: 'chest', pos: [0, -0.02, -0.01] }));
      const f = noSparks(fire({ seed: 8, size: D.fireSize ?? 0.62, night: true })); f.position.set(C.top.lantern[0], ground(C.top.lantern[0], C.top.lantern[2]), C.top.lantern[2]); scene.add(f); updates.push(f.userData.update);
      // brush shelters where the blocks stood
      for (const [x, z] of D.shelters) { const sh = shelter({ seed: x * 3 + z, size: 1.1, grassColor: '#8C7A50' }); sh.position.set(x, ground(x, z), z); scene.add(sh); }
      // the raiders on the ridge: a figure on the crest at each torch, the torch held high; the land was raised so
      // each flame sits on the camera ray through a drone (prepare)
      const fl0 = D.torchFlame ?? 1, swapObjects = [], swap = prep.raiders.map((r, i) => {
        // slide along the camera ray through drone i until the feet meet the land as it was actually built, so the flame
        // sits on that ray (the rises overlap, so the planned spot can be off)
        const m = raider(i, r.yaw, D.raiderScale ?? 1), g0 = new THREE.Group(); g0.add(m.root); m.snap(() => 0);
        const Foff = palmOf(m, 'r').add(V(0, torchFlameY(fl0) - TORCH_GRIP, 0)), p = C.swap.points[i], h = (t) => { const q = ray.at(p, t); return ground(q.x - Foff.x, q.z - Foff.z) + Foff.y - q.y; };
        // the crossing nearest the planned distance, found by stepping out along the ray, then bisected
        let lo = D.torchDist[i], hi = lo, best = Infinity;
        for (let t = 4; t < 160; t += 0.5) if (h(t) * h(t + 0.5) <= 0 && Math.abs(t - D.torchDist[i]) < best) { best = Math.abs(t - D.torchDist[i]); lo = t; hi = t + 0.5; }
        for (let k = 0; k < 40 && hi > lo; k++) { const mid = (lo + hi) / 2; if (h(lo) * h(mid) <= 0) hi = mid; else lo = mid; }
        const q = ray.at(p, (lo + hi) / 2); g0.remove(m.root); m.root.position.set(q.x - Foff.x, 0, q.z - Foff.z); scene.add(m.root); m.snap(ground);
        const fl = D.torchFlame ?? 1, t = D.torch2 ? torch2(60 + i, fl, { light: D.torchLight ?? 1.2 }) : torch(60 + i, fl); const hand = palmOf(m, 'r'); t.position.copy(hand).add(V(0, -TORCH_GRIP, 0)); scene.add(t); updates.push(t.userData.update);
        for (const o of [m.root, t]) o.traverse((q) => (q.castShadow = false)); // far off: a low moon behind them would throw their shadows into the camp through the shadow map's long frustum
        swapObjects.push(m.root, t); X.raiders = (X.raiders || []).concat([{ m, t, fl, yaw: m.root.rotation.y, p0: m.root.position.clone() }]); return hand.clone().add(V(0, torchFlameY(fl) - TORCH_GRIP, 0));
      });
      // animation: the neighbours huddle in round the fire (the torches flicker through their own update)
      // and the raiders turn back: they face away, walk off over the ridge and sink behind it, the torches going out
      const hud = huddler(X), rs = X.raiders, away = rs[0].p0.clone().sub(ray.cam).setY(0).normalize(), flames = swap.map((v) => v.clone());
      const hold = rs.map((r) => grabPose(r.m));
      const anim = (t, c) => {
        hud(t, c); const re = c.retreat(t), tu = Math.min(1, re * 3), go = Math.max(0, (re - 0.25) / 0.75);
        rs.forEach((r, i) => {
          // turn their backs, then walk off over the crest (torch still held up) and down behind it, out of sight
          r.m.root.rotation.y = lerpAng(r.yaw, Math.atan2(away.x, away.z), tu);
          setPose(r.m, hold[i]); if (go > 0 && go < 1) { const w = poseOf(r.m, POSE.walk(t + i, 0.3 + i * 0.2, { speed: 1.1, stride: 0.4 })), now = grabPose(r.m); for (const k of ['lHip', 'lKnee', 'lAnk', 'rHip', 'rKnee', 'rAnk', 'lSh', 'lEl']) now.q[PKEYS.indexOf(k)].copy(w.q[PKEYS.indexOf(k)]); setPose(r.m, now); }
          r.m.root.position.copy(r.p0).addScaledVector(away, (D.retreatGo ?? 7) * go); r.m.snap(ground);
          r.t.position.copy(palmOf(r.m, 'r')).add(V(0, -TORCH_GRIP, 0)); r.t.userData.fade = 1 - Math.max(0, (go - 0.75) / 0.25); flames[i].copy(r.t.position).add(V(0, torchFlameY(r.fl), 0));
        });
      };
      return { swap, swapObjects, anim, targets: () => flames.map((v) => v.clone()) };
    },
  },
  '04-awake-at-1am': {
    top(X) {
      const { K, C, base, subject: m } = X, { I, scene } = K, D = C.top;
      const room = I.room({ w: D.room.w, d: D.room.d, h: 2.45, wall: I.plaster({ color: D.wall ?? '#9C9A94' }), floor: I.floorWood({ a: '#5E4A3A', b: '#7A5E48' }), open: ['front'] });
      room.group.position.set(...D.room.at); scene.add(room.group);
      K.env(D.env ?? 0.01);
      const bed = I.bed({ w: 1.5, l: 2.0, top: base, sheet: D.sheet ?? '#B8BCC4', pillow: '#C6C9CF', seed: 12, pillows: 0, frame: D.headboard ? I.fabric({ color: D.headboard, sheen: 0.3 }) : I.woodFurniture({ color: '#4E3A2C', axis: 'z' }) });
      // a pillow made to fit: its top just under the head as it lies (nothing sinks into it)
      { const hb = headRest(m); const pH = hb.lift; const pl = I.mesh(I.rbox(0.6, pH, 0.24, Math.min(0.05, pH / 2 - 0.001), 4), I.fabric({ color: D.pillow ?? '#D4D7DD', sheen: 0.4 }), hb.x - 0.05, base + pH / 2, hb.z, { parent: scene }); pl.rotation.y = PI / 2; }
      K.add(bed, ...D.bed.at, D.bed.yaw);
      if (D.duvet !== false) { const caps = I.bodyCapsules(m, bed, { arms: false }), hp = bed.worldToLocal(m.world(m.J.hips, V(0, 0.12, 0)));
        bed.add(I.duvet({ w: 1.5, l: 2.0, top: base, z0: hp.z, bodies: caps, color: D.duvetColor ?? '#5E6676', seed: 13, wrinkle: 1.2 })); }
      // the bedside table and its clock
      K.add(I.cabinet({ w: 0.45, h: D.table.h, d: 0.38, doors: 1, color: '#4A3A2E', drawer: true }), ...D.table.at, D.table.yaw);
      const clk = K.add(I.digitalClock({ time: '1:07', color: D.clock.color, value: D.clock.value }), D.table.at[0], D.table.h, D.table.at[2] + 0.04, D.clock.yaw); clk.scale.setScalar(D.clock.scale || 1);
      if (D.clock.light != null) clk.traverse((o) => { if (o.isPointLight) o.intensity = D.clock.light; });
      // a dark wardrobe, curtains drawn on the back wall
      if (D.wardrobe) K.add(I.cabinet({ w: 1.1, h: 2.0, d: 0.58, doors: 2, color: '#3E3A36', legs: 0.05 }), ...D.wardrobe, 0);
      for (const [x, sd] of D.curtains) { const c = I.curtain({ w: 0.7, h: 2.2, color: D.curtain ?? '#262B34', folds: 8, seed: sd }); c.position.set(x, 2.3, D.room.at[2] - D.room.d / 2 + 0.12); scene.add(c); }
      // the phone, held up over the face, screen to the eyes; its light is the room's light
      const { at, eye } = phonePose(m), ph = I.phone({ kind: 'feed', seed: 4, value: D.phone.value, light: D.phone.light, flicker: 0, lightColor: '#C8D4F0' }); if (D.phone.scale) ph.scale.setScalar(D.phone.scale);
      // the screen turned to the face, and a little towards us: from beside the bed we see its light
      ph.position.copy(at); ph.up.set(1, 0, 0); ph.lookAt(eye.clone().lerp(V(...C.camera.pos).add(V(0, base, 0)), D.phone.toCam ?? 0.45)); scene.add(ph);
      // (studio: D.phone.cone, the spill as a cone from the screen onto the head and chest, so it does not light the ceiling)
      const gl = D.phone.cone ? K.spot('#B8C8F0', D.phone.spill, [at.x, at.y - 0.03, at.z], headOf(m).add(V(0, -0.05, 0.12)).toArray(), D.phone.cone, 0.9) : K.point('#B8C8F0', D.phone.spill, at.x, at.y - 0.05, at.z);
      // studio: a soft cool fill over the bed from our side (the phone's light thrown back by the room), so the covered
      // body reads
      if (D.bedFill) K.spot('#AEBEE6', D.bedFill, [0.6, base + 1.5, 2.3], [0.35, base, -0.35], 0.42, 1);
      // between the curtains, a slice of moonlight across the bed
      if (D.moonSlice) K.spot('#A8BEEA', D.moonSlice, [D.room.at[0] + 0.5, 2.2, D.room.at[2] - D.room.d / 2 + 0.05], [0.1, base, 0.1], 0.33, 0.6, { size: 2048, radius: 4, bias: -0.0005, near: 0.3 });
      // animation: each pulse is a scroll: the feed moves on and the screen's light flickers as it does
      const face = []; ph.traverse((o) => { if (o.material?.uniforms?.uOff) face.push(o.material.uniforms); }); const rect = []; ph.traverse((o) => { if (o.isRectAreaLight) rect.push([o, o.intensity]); });
      const anim = (t, c, score) => {
        const s = c.scroll(t), done = (score?.pulses || []).reduce((a, p) => a + Math.min(1, Math.max(0, (t - (p - 0.9) + 0.15) / 0.3)), 0);
        for (const U of face) { U.uOff.value = 0.18 * done; U.uI.value = D.phone.value * (1 - 0.3 * s); }
        for (const [o, i0] of rect) o.intensity = i0 * (1 - 0.3 * s); gl.intensity = D.phone.spill * (1 - 0.3 * s);
      };
      return { swap: [ph.position.clone()], swapObjects: [ph], anim, targets: () => [ph.position.clone()] };
    },
    prepare(C) {
      // the sun stands where the phone was: on the camera's ray through it
      const m = topSubject(C), pp = phonePose(m), s = m.root.userData.hand || 'r', along = pp.at.clone().sub(m.world(m.J[s + 'Wr'], V(0, 0, 0))).normalize();
      // (studio: sunGap metres further out along the forearm, a gap between the fingertips and the disc)
      const p = pp.at.clone().addScaledVector(along, C.bottom.sunGap ?? 0), d = p.clone().sub(V(...C.camera.pos)).normalize();
      return { sun: [Math.asin(d.y) * 180 / PI, Math.atan2(d.x, d.z) * 180 / PI], sunDir: d };
    },
    bottom(X) {
      const { scene, C, ground, ray, prep } = X, D = C.bottom;
      const P0 = D.pelt || null, h = hide({ seed: 3, w: P0?.w ?? 2.0, d: P0?.d ?? 1.0, color: P0 ? '#FFFFFF' : '#7A5A3C' }); h.rotation.y = 0.04; h.position.set(C.subject.x - 0.3 + (P0?.dx ?? 0), ground(C.subject.x, C.subject.z) - (P0 ? -0.004 : 0.005), C.subject.z + (P0?.dz ?? 0)); scene.add(h);
      // studio: a light pelt (cream fur, painted in code) clearly lying round the body
      if (P0) { h.material.map = furTex(P0.color ?? '#E6D2B0', P0.edge ?? '#A88A64', 11); h.material.roughness = 1; }
      // a rolled hide under the head, made to fit like the pillow above
      { const hb = headRest(X.subject), g0 = ground(hb.x, hb.z) + C.subject.support.bottom; const roll = new THREE.Mesh(new THREE.CylinderGeometry(hb.lift / 2, hb.lift / 2, 0.5, 18), std('#D2B48A', 0.8)); roll.rotation.x = PI / 2; roll.position.set(hb.x, g0 + hb.lift / 2, hb.z); roll.castShadow = roll.receiveShadow = true; scene.add(roll); }
      // studio: a hide drawn over the legs, as the duvet is in the top panel (the same cover, in the other world)
      if (D.cover) { const T0 = C.top, g = new THREE.Group(); g.position.set(T0.bed.at[0], X.base, T0.bed.at[2]); g.rotation.y = T0.bed.yaw; scene.add(g); g.updateMatrixWorld(true);
        const caps = I.bodyCapsules(X.subject, g, { arms: false }), hp = g.worldToLocal(X.subject.world(X.subject.J.hips, V(0, 0.12, 0)));
        const cv = I.duvet({ w: D.cover.w ?? 1.1, l: 2.0, top: 0, z0: hp.z, hang: D.cover.hang ?? 0.25, foot: 0.12, bodies: caps, seed: 13, wrinkle: 0.8, thick: 0.03 });
        cv.material = new THREE.MeshStandardMaterial({ map: furTex(D.cover.color ?? '#B08A62', D.cover.edge ?? '#6A4C34', 9), roughness: 1, side: THREE.DoubleSide }); cv.material.bumpMap = cv.material.map; cv.material.bumpScale = 2;
        // the cloth hangs to 3 cm over the support's own floor: here that is the ground under the hide
        g.add(cv); }
      const scouts = [];
      for (const sc of D.scouts) {
        const m = makeMannequin({ kind: 'man', tone: TONES[sc.wood], seed: sc.seed });
        m.root.position.set(sc.at[0], 0, sc.at[2]); m.root.rotation.y = sc.yaw; scene.add(m.root);
        m.pose(POSE.runIn(sc.t, sc.r, { lookY: sc.look ?? 0 })); m.snap(ground); scouts.push({ m, sc });
      }
      // animation: the sun sets (it sinks to the hills, the light warms and dims), her arm comes down, the scouts run
      // across the background (their run wraps out of frame)
      const sun0 = ray.cam.clone().addScaledVector(prep.sunDir, 2000), e0 = Math.asin(prep.sunDir.y) * 180 / PI, az = Math.atan2(prep.sunDir.x, prep.sunDir.z) * 180 / PI, E1 = D.sunsetTo ?? 1.2;
      let sky = null, sl = null; const spots = [], far = []; scene.traverse((o) => { if (o.material?.uniforms?.sunPosition) sky = o; if (o.isDirectionalLight && o.castShadow) sl = o; if (o.isSpotLight) spots.push([o, o.intensity]); if (o.isMesh && o.material?.isMeshBasicMaterial && o.material.side === THREE.BackSide) far.push([o.material, o.material.color.clone()]); });
      const fog0 = scene.fog ? scene.fog.color.clone() : null, dusk = new THREE.Color(0.55, 0.36, 0.3);
      const env0 = scene.environmentIntensity, slI = sl ? sl.intensity : 0, slC = sl ? sl.color.clone() : null, L0 = lightFor('day', e0), focus = sl ? sl.target.position.clone() : V(0, 0, 0), sunNow = sun0.clone();
      const subB = grabPose(X.subject), subRest = restArm(X.subject, 'r'), run = D.scoutRun ?? 34;
      // the sun's path: along the horizon away from her head (the side of the sun away from it), down to the hills
      const hd = headOf(X.subject).sub(ray.cam), azH = Math.atan2(hd.x, hd.z) * 180 / PI, dAz = (D.sunsetAz ?? 10) * Math.sign(((az - azH + 540) % 360) - 180 || 1);
      // asleep: rolled onto her side (the hips turned about the body's own length), knees drawn up, the curl's limbs
      const sub = X.subject, curl = poseOf(sub, POSE.curl(T, 0.2, {})), hipsQ = subB.q[0].clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), (D.rollDir ?? 1) * PI / 2));
      curl.q[0].copy(hipsQ); const subY = sub.root.position.y;
      // resting in the sun, not collapsed: one knee up, the free arm folded behind the head (D.relax), all along
      if (D.relax) { setPose(sub, subB);
        sub.J.lHip.quaternion.copy(poseOf(sub, { ...{}, hipsX: -PI / 2, lHip: { dir: [0.12, -0.5, 0.86], bend: [0, 0, -1] }, lKnee: 1.7, lAnk: 0.3 }).q[PKEYS.indexOf('lHip')]);
        sub.J.lKnee.rotation.set(1.7, 0, 0); sub.J.lAnk.rotation.set(0.3, 0, 0); sub.root.updateMatrixWorld(true); restOn(sub, X.base);
        subB.q = grabPose(sub).q; subB.hp = grabPose(sub).hp; Object.assign(subRest, restArm(sub, 'r')); }
      const subY2 = sub.root.position.y;
      const anim = (t, c) => {
        const ss = c.sunset(t), el = e0 + (E1 - e0) * ss, d = sunDir(el, az + dAz * ss); sunNow.copy(ray.cam).addScaledVector(d, 2000);
        // (the disc: dimmed as well as warmed, or the tone mapping keeps it white)
        if (sky) { sky.material.uniforms.sunPosition.value.copy(d); if (sky.material.uniforms.uTint) sky.material.uniforms.uTint.value.setRGB(1, 1 - 0.62 * ss, 1 - 0.9 * ss).multiplyScalar(1 - 0.72 * ss); }
        // the far hills and the haze go down with the light, towards a dusk mauve
        for (const [mt, c0] of far) mt.color.copy(c0).multiply(dusk.clone().lerp(new THREE.Color(1, 1, 1), 1 - ss)).multiplyScalar(1 - 0.45 * ss);
        if (fog0) scene.fog.color.copy(fog0).multiply(dusk.clone().lerp(new THREE.Color(1, 1, 1), 1 - ss)).multiplyScalar(1 - 0.45 * ss);
        if (sl) { const Lc = lightFor('day', el); sl.position.copy(d).multiplyScalar(120).add(focus); sl.color.copy(slC).multiply(Lc.color.clone().multiply(new THREE.Color(1 / L0.color.r, 1 / L0.color.g, 1 / L0.color.b))); sl.intensity = slI * (Lc.intensity / L0.intensity) * (1 - 0.35 * ss); }
        scene.environmentIntensity = env0 * (1 - 0.6 * ss); for (const [o, i0] of spots) o.intensity = i0 * (1 - 0.7 * ss);
        setPose(sub, subB, subRest, c.armDown(t)); const sl2 = c.sleep(t);
        // (asleep on the pelt: the lowest point on the pelt's top, not floating)
        if (sl2 > 0) { setPose(sub, grabPose(sub), curl, sl2); restOn(sub, X.base - (D.sleepSink ?? 0.012)); } else { sub.root.position.y = subY2; sub.root.updateMatrixWorld(true); }
        const u = c.scouts(t), w = ((u + 0.5) % 1) - 0.5;
        for (const { m, sc } of scouts) { m.root.position.set(sc.at[0] + Math.sin(sc.yaw) * run * w, 0, sc.at[2] + Math.cos(sc.yaw) * run * w); m.pose(POSE.runIn(sc.t + t, sc.r, { lookY: sc.look ?? 0 })); m.snap(ground); }
      };
      return { swap: [sun0], anim, targets: () => [sunNow.clone()], movers: scouts.map((q) => q.m) };
    },
  },
  '01-baby-put-down': {
    top(X) {
      const { K, C, base } = X, { I, scene } = K, D = C.top;
      const room = I.room({ w: D.room.w, d: D.room.d, h: 2.5, wall: I.plaster({ color: '#B9C0C6' }), floor: I.floorWood({ a: '#6E5440', b: '#86664C', plank: 0.14 }),
        holes: [{ wall: 'back', at: D.window.at, y0: D.window.y0, w: D.window.w, h: D.window.h }, { wall: 'back', at: D.door.at, y0: 0, w: 0.82, h: 2.04 }], open: ['front'] });
      room.group.position.set(...D.room.at); scene.add(room.group);
      const win = room.onWall('back', D.window.at, D.window.y0); win.add(I.windowUnit({ w: D.window.w, h: D.window.h, cols: 2 }));
      const cur = I.curtain({ w: 0.42, h: 2.05, color: '#4A5260', folds: 6, seed: 3 }); cur.position.set(-D.window.w / 2 - 0.12, D.window.h + 0.35, 0.1); win.add(cur);
      // the night outside: the same sky as the bottom panel, the same moon
      scene.add(nightSky({ moon: sunDir(...C.moon), seed: 11 }));
      const mdir = sunDir(...C.moon);
      // moonlight: the cool key on the cot, thrown from the window (a stage moon: steeper than the one in the glass)
      const wx = D.room.at[0] + D.window.at, wz = D.room.at[2] - D.room.d / 2;
      K.spot('#B4C8F0', D.moonLight, [wx - 0.2, D.window.y0 + D.window.h + 0.6, wz - 1.2], [D.cot.at[0] - 0.05, base, D.cot.at[2]], 0.42, 0.7, { size: 2048, radius: 5, bias: -0.0005, near: 0.5 });
      // and a wash of the same cool light on the wall behind the cot, so she reads against it
      if (D.wallLight) K.rect('#A8BCE6', D.wallLight, 2.4, 1.2, [D.cot.at[0], 2.3, D.cot.at[2] + 0.6], [D.cot.at[0], 0.9, wz]);
      K.rect('#8EA6D6', D.windowGlow, D.window.w - 0.1, D.window.h - 0.1, [D.room.at[0] + D.window.at, D.window.y0 + D.window.h / 2, D.room.at[2] - D.room.d / 2 + 0.03], [D.room.at[0] + D.window.at, D.window.y0, 1.5]);
      // the door, just ajar, onto a lit hallway
      const dw = room.onWall('back', D.door.at, 0); dw.add(I.doorway({ w: 0.82, h: 2.04, open: D.door.open, hingeLeft: false }));
      const hx = D.room.at[0] + D.door.at, hz = D.room.at[2] - D.room.d / 2;
      I.mesh(new THREE.PlaneGeometry(2.2, 2.5), I.plaster({ color: '#E8DCC6' }), hx, 1.25, hz - 1.1, { parent: scene });
      I.mesh(new THREE.PlaneGeometry(2.4, 1.4), I.floorWood({ a: '#6E5440', b: '#86664C' }), hx, 0.001, hz - 0.6, { rx: -PI / 2, parent: scene, cast: false });
      I.mesh(new THREE.PlaneGeometry(1.2, 2.5), I.plaster({ color: '#E8DCC6' }), hx + 0.55, 1.25, hz - 0.55, { ry: -PI / 2, parent: scene });
      I.mesh(new THREE.PlaneGeometry(1.2, 2.5), I.plaster({ color: '#E8DCC6' }), hx - 0.55, 1.25, hz - 0.55, { ry: PI / 2, parent: scene });
      K.point(D.hallColor ?? '#FFC27A', D.hallLight, hx + 0.2, 2.2, hz - 0.6);
      // the hall light through the gap, laid across the nursery floor as a warm wedge
      const sp = D.spill || {};
      K.spot(D.hallColor ?? '#FFC27A', D.hallSpill, sp.from ? [hx + sp.from[0], sp.from[1], hz + sp.from[2]] : [hx - 0.25, 1.9, hz - 0.9], sp.to ? [hx + sp.to[0], 0, hz + sp.to[1]] : [hx - 0.55, 0, hz + 1.6], sp.angle ?? 0.35, 0.5, { size: 1024, radius: 2, bias: -0.0008, near: 0.3 });
      K.env(D.env ?? 0.05);
      // the cot, its near side let down so nothing stands between us and her; a rug
      const c = cot({ top: C.subject.support.top, near: D.cot.near, l: D.cot.l ?? 1.28 }); K.add(c, ...D.cot.at, D.cot.yaw);
      K.add(I.rug({ w: 1.6, d: 1.1, color: '#8A8278' }), 0.1, 0, 0.6, 0.04);
      // a toy box by the door: it hides the foot of the light strip
      if (D.toybox) { const b = D.toybox; I.block(scene, I.woodFurniture({ color: b.color, axis: 'x' }), b.w, b.h, b.d, b.at[0], 0, b.at[2], 0.02); }
      // the swap point: the strip of hallway light, at the eye height of the camera
      // (studio: the lit hallway seen through the doorway is the swap's box)
      let gap = null; if (D.doorSwapBox) { gap = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 2.04), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); gap.position.set(hx, 1.02, hz - 0.02); scene.add(gap); }
      const bB = grabPose(X.subject), sp0 = V(...C.swap.points[0]).add(V(0, base, 0));
      return { swap: [sp0], swapObjects: gap ? [gap] : [], anim: (t, c) => babyMove(X.subject, bB, c, t), targets: () => [sp0.clone()] };
    },
    bottom(X) {
      const { scene, C, ground, ray } = X, D = C.bottom;
      // the far fire on the skyline, where the door light was, with two adults sitting by it
      const p = ray.at(C.swap.points[0], D.fireDist); // the flame's centre; the land rises to meet it (D.rises)
      const f = shapeFire(noSparks(fire({ seed: 5, size: D.fireSize, night: true, shadows: true })), D.fireShape); f.position.set(p.x, ground(p.x, p.z), p.z); scene.add(f); X.updates.push(f.userData.update);
      const side = V(-ray.dir(C.swap.points[0]).z, 0, ray.dir(C.swap.points[0]).x), swapObjects = [f];
      // studio: a hide under the baby, so she lies on a bed and not on bare dirt
      if (D.bed) { const h = hide({ seed: 5, w: D.bed.w, d: D.bed.d, color: '#FFFFFF' }); h.material.map = furTex(D.bed.color, D.bed.edge); h.material.bumpMap = h.material.map; h.material.bumpScale = 3; h.material.roughness = 1; h.rotation.y = D.bed.yaw ?? 0; const bx = C.subject.x + (D.bed.dx ?? 0), bz = C.subject.z + (D.bed.dz ?? 0); h.position.set(bx, ground(bx, bz) - (D.bed.sink ?? 0.024), bz); scene.add(h);
        // (D.bed.fringe: a furred edge, tufts of hair round the hide's rim, so it reads as a pelt)
        if (D.bed.fringe) { const R = rng(17), n = D.bed.fringe, tg = new THREE.ConeGeometry(0.012, 0.05, 4), tm = new THREE.MeshStandardMaterial({ color: D.bed.edge, roughness: 1 }), inst = new THREE.InstancedMesh(tg, tm, n), M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = V(1, 1, 1);
          for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2, rx = D.bed.w / 2 * (0.92 + 0.08 * R()), rz = D.bed.d / 2 * (0.92 + 0.08 * R()), lx = Math.cos(a) * rx, lz = Math.sin(a) * rz;
            const wx = bx + lx * Math.cos(h.rotation.y) + lz * Math.sin(h.rotation.y), wz = bz - lx * Math.sin(h.rotation.y) + lz * Math.cos(h.rotation.y);
            e.set(PI / 2 - 0.5 + R() * 0.4, -a + h.rotation.y + PI / 2, 0); q.setFromEuler(e); sc.setScalar(0.8 + R() * 0.8); M.compose(V(wx, ground(wx, wz) + 0.01, wz), q, sc); inst.setMatrixAt(i, M); }
          inst.receiveShadow = true; scene.add(inst); } }
      // the two adults: by default one each side of the fire; D.adults: [{ k (side), gap, back (m behind the fire), kind, tone }]
      const adults = D.adults || [[-1, D.adultGap ?? 0.9], [1, D.adultGap ?? 1.0]].map(([k, gap]) => ({ k, gap, back: 0.3, kind: k < 0 ? 'woman' : 'man', tone: TONES[k < 0 ? 'birch' : 'beech'] })), ads = [];
      for (const a of adults) {
        const k = a.k, fwd = ray.dir(C.swap.points[0]).setY(0).normalize(), q = p.clone().addScaledVector(side, k * a.gap).addScaledVector(D.adults ? fwd : V(0, 0, 1), D.adults ? a.back : -a.back);
        const m = makeMannequin({ kind: a.kind, tone: TONES[a.tone] || a.tone, seed: 3 + k });
        m.root.position.set(q.x, 0, q.z); m.root.rotation.y = Math.atan2(p.x - q.x, p.z - q.z); scene.add(m.root);
        // (a.pose / a.toBaby: an adult rising and turning to the crying baby, mid-step; default seated by the fire)
        if (a.toBaby) m.root.rotation.y = Math.atan2(C.subject.x - q.x, C.subject.z - q.z) + (a.turn ?? 0);
        m.pose(POSE[a.pose || 'sitKnees'](T + (a.t ?? 0), 0.4 + k * 0.2, { lookY: 0, ...(a.o || {}) })); m.snap(ground); if (!D.adults) swapObjects.push(m.root); ads.push({ m, r: 0.4 + k * 0.2 });
        if (a.pose) { m.root.traverse((o) => { if (o.isMesh) o.userData.body = true; }); let lo = 0; for (const v of bodyVerts(m, 2)) lo = Math.max(lo, ground(v.x, v.z) - v.y); if (lo > 0) { m.root.position.y += lo + 0.003; m.root.updateMatrixWorld(true); } }
      }
      // dark bush at the left and at the lower right, eyes in them
      for (const b of D.bushes) {
        const t = thicket(b.seed, { n: b.n, size: b.size, spread: b.spread, tint: '#3C4628' }); t.position.set(b.at[0], ground(b.at[0], b.at[2]), b.at[2]); scene.add(t);
        for (const e of b.eyes) { const es = eyeshine({ value: e[3] ?? 1.4, gap: b.eyeGap ?? 0.075, size: b.eyeSize ?? 1 }); es.position.set(e[0], ground(e[0], e[2]) + e[1], e[2]); es.lookAt(ray.cam); scene.add(es); }
      }
      // animation: she cries in bursts; the nearer adult turns, rises, walks over (on a line that stays behind her, never
      // near the lens), kneels, picks her up and holds her to the chest, rocking her
      const kid = X.subject, kB = grabPose(kid), chest = kid.world(kid.J.chest, V(0, 0.12, 0)), root0 = kid.root.position.clone(), q0 = kid.root.quaternion.clone();
      const A0 = ads.sort((a, b) => a.m.root.position.distanceTo(chest) - b.m.root.position.distanceTo(chest))[0], a = A0.m, rr = A0.r;
      a.root.traverse((o) => { if (o.isMesh) o.userData.body = true; });
      const P0 = a.root.position.clone(), yaw0 = a.root.rotation.y, seat = grabPose(a), ka = D.kneelAt || [0.1, -0.5], D1 = V(chest.x + ka[0], 0, chest.z + ka[1]);
      // (kneelNear: she arrives at D1, clear of the baby, and shuffles in on her knees to D2, within arm's reach)
      const kb = D.kneelNear || ka, D2 = V(chest.x + kb[0], 0, chest.z + kb[1]);
      const yawW = Math.atan2(D1.x - P0.x, D1.z - P0.z), yawK = Math.atan2(chest.x - D2.x, chest.z - D2.z), stand = poseOf(a, POSE.stand(T, rr, { lookY: 0 }));
      // nearing her she stoops low (a standing adult this close to the lens would be cut off by the frame's top)
      const stoop = poseOf(a, POSE.crouch(T, rr, { lookY: 0, headDown: 0.3 }));
      // the kneel, leaning down to her; then the hold, kneeling upright with her cradled across the chest
      a.root.position.set(D2.x, 0, D2.z); a.root.rotation.y = yawK; a.pose(POSE.kneel(T, rr, { lean: D.kneelLean ?? 0.55, headDown: 0.45, lookY: 0 })); a.snap(ground);
      const kneelP = grabPose(a), Hk = a.root.position.y;
      a.pose(POSE.kneel(T, rr, { lean: 0.08, headDown: 0.4, lookY: 0 })); a.snap(ground); const holdP = grabPose(a); a.root.updateMatrixWorld(true);
      const fwd = V(Math.sin(yawK), 0, Math.cos(yawK)), across = V(fwd.z, 0, -fwd.x), ax = headOf(kid).sub(kid.world(kid.J.hips, V(0, 0, 0))).setY(0).normalize();
      if (ax.dot(across) < 0) across.negate();
      const qYaw = new THREE.Quaternion().setFromUnitVectors(ax, across); let tilt = D.cradleTilt ?? 0.3; if (across.clone().applyAxisAngle(fwd, tilt).y < 0) tilt = -tilt;
      // (cradleFace: her front turned from the sky out towards us, 0..1; held against the chest, seen)
      const qFace = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), V(0, 1, 0).lerp(fwd, D.cradleFace ?? 0).normalize());
      const qD = qFace.multiply(new THREE.Quaternion().setFromAxisAngle(fwd, tilt)).multiply(qYaw), Tg = a.world(a.J.chest, V(0, 0.2, 0)).addScaledVector(fwd, D.cradleOut ?? 0.24).add(V(0, D.cradleDy ?? -0.06, 0));
      const c0 = kid.world(kid.J.chest, V(0, 0.05, 0)), R1 = Tg.clone().sub(c0.clone().sub(root0).applyQuaternion(qD)), Q1 = qD.clone().multiply(q0);
      const Lh = a.J.chest.matrixWorld.clone().invert().multiply(new THREE.Matrix4().compose(R1, Q1, kid.root.scale.clone()));
      a.root.position.copy(P0); a.root.rotation.y = yaw0; setPose(a, seat);
      const Mh = new THREE.Matrix4(), hp = V(0, 0, 0), hq = new THREE.Quaternion(), hs = V(0, 0, 0), sm = (u) => u * u * (3 - 2 * u);
      // the hands under her back and her hips (each the hand nearer its point)
      // (on the ground the hands slide in from her side, nearest the adult; as she rises they come round under her)
      const support = (li = 1) => { const side = a.root.position.clone().sub(kid.root.position).setY(0).normalize().multiplyScalar((D.holdSide ?? 0.1) * (1 - Math.min(1, li * 3))), g = (v) => { v.add(side); v.y = Math.max(v.y, ground(v.x, v.z) + 0.035); return v; };
        // (under her back in her own frame: she lies on her back, so behind her is her -z)
        const b1 = g(kid.world(kid.J.chest, V(0, 0.14, -(D.holdUnder ?? 0.2)))), b2 = g(kid.world(kid.J.hips, V(0, 0, -(D.holdUnder ?? 0.2))));
        const L = a.world(a.J.lSh, V(0, 0, 0)), Rr = a.world(a.J.rSh, V(0, 0, 0)); return L.distanceTo(b1) + Rr.distanceTo(b2) < L.distanceTo(b2) + Rr.distanceTo(b1) ? [b1, b2] : [b2, b1]; };
      // the rock's envelope: where the curve starts, found from the curve itself (0.6 s ramp)
      let rockEnv = () => 0;
      const anim = (t, c) => {
        if (!anim.r0) { let r0 = 0; for (let x = 0; x < 10; x += 0.02) if (c.rock(x) > 1e-4) { r0 = x; break; } anim.r0 = r0 || 99; rockEnv = (x) => sm(Math.min(1, Math.max(0, (x - anim.r0) / 0.6))); }
        babyMove(kid, kB, c, t);
        const tu = c.turn(t), ri = c.rise(t), wk = c.walk(t), kn = c.kneel(t), li = c.lift(t), ro = c.rock(t);
        a.root.rotation.y = kn > 0 ? lerpAng(yawW, yawK, kn) : lerpAng(yaw0, yawW, tu);
        if (tu <= 0) setPose(a, seat);
        else if (wk <= 0) setPose(a, seat, stand, ri);
        else if (kn <= 0) { const w = Math.min(1, wk * 6), cr = sm(Math.min(1, Math.max(0, (wk - (D.stoopFrom ?? 0.35)) / 0.4))), dn = sm(Math.min(1, Math.max(0, (wk - 0.62) / 0.38)));
          // she stoops as she comes, and sinks onto her knees as she arrives (so close to the lens, upright would be cut off)
          setPose(a, stand, stoop, cr); setPose(a, grabPose(a), poseOf(a, POSE.walk(t, rr, { speed: 1.2, stride: 0.42 })), w * (1 - 0.75 * cr) * (1 - dn)); if (dn > 0) setPose(a, grabPose(a), kneelP, dn); }
        else if (li <= 0) setPose(a, kneelP);
        else setPose(a, kneelP, holdP, li);
        // the rock: a slow sway of the upper body, her in it
        // (the rock curve is ramp * (0.5 + 0.5 sin): its centred sway is 2 rock - ramp; the ramp is the curve's own envelope)
        if (ro > 0) { const env = rockEnv(t); a.J.waist.rotateZ(0.07 * (2 * ro - env)); a.J.chest.rotateY(0.06 * (2 * ro - env)); }
        a.root.position.set(P0.x + (D1.x - P0.x) * wk, 0, P0.z + (D1.z - P0.z) * wk); if (kn > 0) a.root.position.lerp(D2, kn); a.snap(ground);
        // nothing under the ground: a kneeling shin or a rising heel lies lower than the snap's contact points
        let lo = 0; for (const v of bodyVerts(a, 4)) lo = Math.max(lo, ground(v.x, v.z) - v.y); if (lo > 0) { a.root.position.y += lo + 0.002; a.root.updateMatrixWorld(true); }
        // her: lifted off the hide on an arc into the cradle, then carried by the chest
        if (li > 0) { Mh.multiplyMatrices(a.J.chest.matrixWorld, Lh).decompose(hp, hq, hs); kid.root.position.copy(root0).lerp(hp, li); kid.root.position.y += 0.08 * Math.sin(PI * li); kid.root.quaternion.copy(q0).slerp(hq, li); }
        else { kid.root.position.copy(root0); kid.root.quaternion.copy(q0); }
        kid.root.updateMatrixWorld(true);
        // the arms: down under her as the kneel completes, holding her from then on
        if (kn > 0) { const before = grabPose(a), [p1, p2] = support(li); reachTo(a, 'l', p1, V(0, -1, 0)); reachTo(a, 'r', p2, V(0, -1, 0)); if (li <= 0 && kn < 1) setPose(a, before, grabPose(a), kn); }
      };
      return { swap: [p.clone()], swapObjects, anim, targets: () => [headOf(a)], movers: [a] };
    },
  },
};

// ---------- building a panel ----------
export function registerCase(id, def) { CASES[id] = def; }

export function buildSwap({ C, panel, renderer }) {
  const def = CASES[C.id]; if (!def) throw new Error('no swap case ' + C.id);
  const cam = C.camera, sub = { ...C.subject, red: true };
  if (panel === 'top') {
    const base = C.subject.support.top, out = {};
    const N = buildNow({ key: 'swap-' + C.id, renderer, opts: { def: (K) => {
      const m = lockedFigure(K.scene, { ...sub, ...(C.subject.top || {}) }, base); const you = { m, f: {}, r: 0 };
      const locked = (C.locked || []).map((f) => lockedFigure(K.scene, { ...f, ...(f.top || {}) }, base));
      if (C.chain) linkHands(C.chain.map((i) => [m, ...locked][i]), { gap: C.chainGap ?? 0.03 });
      const X = { K, C, base, ray: rayFrom(C, base), subject: m, locked };
      Object.assign(out, def.top(X)); out.locked = locked;
      addRim(K.scene, m, C.top.rim, { moon: C.moon ? sunDir(...C.moon) : null });
      return { you, lock: true, cam: { pos: V(...cam.pos).add(V(0, base, 0)).toArray(), target: V(...cam.target).add(V(0, base, 0)).toArray(), fov: cam.fov }, look: { bloom: 0, ...(C.top.look || {}) } };
    } } });
    const m = N.S.you.m;
    return { scene: N.scene, camera: N.camera, look: N.look, update: N.update, head: () => headOf(m), headR: () => headR(m), swapPoints: () => out.swap, info: { panel, base }, movers: out.movers || [], anim: out.anim || (() => {}), targets: () => (out.targets ? out.targets() : out.swap),
      subject: m, headMesh: eggOf(m), figures: [m, ...out.locked], swapObjects: () => out.swapObjects || [], floor: () => 0 };
  }
  // bottom: the ancestors' world as a story with a locked camera
  const D = C.bottom, anchor = [C.subject.x || 0, C.subject.z || 0];
  // rises: { x, z, h, rx, rz } a mound; or { ray: i, dist, above } the land lifted so that the point `dist` metres out
  // along the camera ray through swap point i lies `above` metres over it (a far fire sitting on the skyline). The
  // land is flat at the subject, so subject space y = 0 is the ground there plus support.bottom.
  const R0 = rayFrom(C, C.subject.support.bottom), prep = def.prepare ? def.prepare(C, R0) : {};
  const rises = (prep.rises || []).concat(D.rises || []).map((h) => { if (h.ray == null || h.top != null) return { ...h }; const p = R0.at(C.swap.points[h.ray], h.dist); return { x: p.x, z: p.z, top: p.y - h.above, rx: h.rx, rz: h.rz }; });
  const flat = (x, z) => Math.min(1, Math.max(0, (Math.hypot(x - anchor[0], z - anchor[1]) - 6) / 30));
  const story = {
    times: [D.time],
    compose: () => ({
      lock: true, anchor, anchorLift: C.subject.support.bottom, camera: { pos: cam.pos, target: cam.target, fov: cam.fov },
      focus: { x: anchor[0], z: anchor[1] }, figures: [], props: [], clear: (D.clear || [[anchor[0], anchor[1], 3, 3]]).concat(rises.filter((h) => h.top != null).map((h) => [h.x, h.z, h.clear ?? 7, 3])), keepOut: D.keepOut || [],
      moon: C.moon ?? null, sun: prep.sun || D.sun, sunDeg: D.sunDeg, sunHot: D.sunHot, sunHotRim: D.sunHotRim, clouds: D.clouds, scatter: D.scatter, noBirds: true, moonDeg: C.moonDeg, moonBright: C.moonBright, nightLift: D.nightLift, moonLight: D.moonLight, envNight: D.envNight, turbidity: D.turbidity, mie: D.mie, mieG: D.mieG, grass: D.grass, bladeH: D.bladeH, litter: D.litter,
      // flat round the subject, the savanna's own roll further out, and any rises the case asks for
      height: (b) => (x, z) => { let y = b(x, z) * flat(x, z); let up = 0; for (const h of rises) { const g = Math.exp(-(((x - h.x) / h.rx) ** 2) - (((z - h.z) / h.rz) ** 2)); if (h.top != null) up = Math.max(up, (h.top - b(h.x, h.z) * flat(h.x, h.z)) * g); else y += h.h * g; } return y + up; },
    }),
  };
  const W = buildAncestors({ topic: 'swap', g: D.g || 3000, renderer, opts: { story, habitat: D.habitat || 'savanna', time: D.time, env: D.env } });
  const base = W.ground(...anchor) + C.subject.support.bottom, updates = [];
  const m = lockedFigure(W.scene, { ...sub, ...(C.subject.bottom || {}) }, base);
  const locked = (C.locked || []).map((f) => lockedFigure(W.scene, { ...f, ...(f.bottom || {}) }, base));
  if (C.chain) linkHands(C.chain.map((i) => [m, ...locked][i]), { gap: C.chainGap ?? 0.03 });
  const X = { scene: W.scene, C, base, ground: W.ground, ray: rayFrom(C, base), subject: m, locked, updates, world: W, prep };
  const out = def.bottom(X);
  if (D.matteGround) W.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && !o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (o.isMesh && !o.isInstancedMesh && o.geometry.boundingSphere.radius > 100 && o.material.roughness != null) { o.material.roughness = 1; o.material.envMapIntensity = 0.35; } });
  addRim(W.scene, m, D.rim, { moon: C.moon ? sunDir(...C.moon) : null, sun: prep.sunDir || (D.sun ? sunDir(...D.sun) : null) });
  Object.assign(W.look, { bloom: 0 }, D.look || {});
  const update = (t) => { W.update(t); for (const u of updates) u(t); };
  return { movers: out.movers || [], anim: out.anim || (() => {}), targets: () => (out.targets ? out.targets() : out.swap), scene: W.scene, camera: W.camera, look: W.look, update, expose: (stage) => { W.expose(stage); if (D.exposure) W.look.exposure *= D.exposure; Object.assign(W.look, { bloom: 0 }); }, head: () => headOf(m), headR: () => headR(m), swapPoints: () => out.swap, info: { panel, base, ...W.info },
    subject: m, headMesh: eggOf(m), figures: [m, ...locked], swapObjects: () => out.swapObjects || [], floor: W.ground };
}

// ---------- the figures alone, for the other graphic approaches ----------
// rigCase(C, panel, parent, base): the subject and the locked figures exactly as buildSwap poses them (the hand chain
// of 03, the filming and pointing arms of 02, the phone offset of 04), without any scene. Every approach, 3D or drawn,
// starts from these, so the mannequins and their poses are the same everywhere.
export function rigCase(C, panel, parent = new THREE.Group(), base = 0) {
  const m = lockedFigure(parent, { ...C.subject, red: true, ...(C.subject[panel] || {}) }, base);
  const locked = (C.locked || []).map((f) => lockedFigure(parent, { ...f, ...(f[panel] || {}) }, base));
  if (C.chain) linkHands(C.chain.map((i) => [m, ...locked][i]), { gap: C.chainGap ?? 0.03 });
  const all = [m, ...locked], fs = [C.subject, ...(C.locked || [])];
  if (C.id === '02-fantasy-bra-outrage') {
    const Tm = V(...C.top.model.at), D = C.bottom;
    for (const [i, f2] of all.entries()) {
      const f = fs[i], at = filmPoint(f2, f);
      if (panel === 'top') { const side = V(-facing(f2).z, 0, facing(f2).x);
        if (f.film?.two) { reachTo(f2, 'l', at.clone().addScaledVector(side, 0.135), V(0.3, -1, 0)); reachTo(f2, 'r', at.clone().addScaledVector(side, -0.135), V(-0.3, -1, 0)); }
        else reachTo(f2, f.film?.hand || 'r', at.clone().add(V(0, -0.17, 0)), V(0, -1, 0));
      } else { const s = f.point?.hand || 'r', S = f2.world(f2.J[s + 'Sh'], V(0, 0, 0)), toHer = Tm.clone().setY(1.5).add(V(0, f.point?.dy ?? 0, 0)).sub(S).normalize();
        const dir = i === 0 ? at.clone().sub(S).normalize().lerp(toHer, D.subjectAim ?? 0.5).normalize() : toHer;
        reachTo(f2, s, S.clone().addScaledVector(dir, f.point?.reach ?? 0.62), V(0, -1, 0).addScaledVector(dir, -0.2)); }
    }
  }
  parent.updateMatrixWorld(true);
  return { subject: m, locked: all.slice(1), all };
}
// named joint positions of a posed mannequin in world space (for drawing it in 2D approaches)
export function joints(m) {
  m.root.updateMatrixWorld(true); const w = (k, p = [0, 0, 0]) => m.world(m.J[k], V(...p));
  const o = { head: headOf(m), headR: headR(m), neck: w('neck'), chest: w('chest', [0, 0.2, 0]), waist: w('waist'), hips: w('hips'), headTop: m.headTop() };
  for (const s of ['l', 'r']) Object.assign(o, { [s + 'Sh']: w(s + 'Sh'), [s + 'El']: w(s + 'El'), [s + 'Wr']: w(s + 'Wr'), [s + 'Palm']: palmOf(m, s), [s + 'Hip']: w(s + 'Hip'), [s + 'Knee']: w(s + 'Knee'), [s + 'Ank']: w(s + 'Ank'), [s + 'Toe']: w(s + 'Ank', [0, -0.07, 0.2]) });
  o.scale = m.root.scale.x; o.kind = m.kind;
  return o;
}
export { headOf, headR, palmOf, eggOf, phonePose, filmPoint, facing };
// the helpers, for the case modules in swap-cases/
export { babyMove, huddler, restOn, addRim, linkHands, reachTo, rayFrom, cot, eyeshine, furTex, shrub, thicket, shapeFire, torch, torch2, drone2, showWings, showLingerie, roastHaunch, roastHaunch2, stool, raider, drone, coat, lantern, candleWindow, headRest, topSubject, poseOf, restArm, cardRed, PI, V, L, FWD, BACK, DOWN, UP, I, A, fire, shelter, hide, spear, lieOn, seatOn, makeMannequin, POSE, TONES, rng, makeHeight, bush, rock, acacia, fbm2, nightSky, sunDir, lightFor };
