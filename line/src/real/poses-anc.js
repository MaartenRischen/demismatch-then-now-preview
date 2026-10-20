// Extra poses for the ancestors' stories. They add themselves to POSE; see poses.js for the conventions.
// The figure faces +z; its left is +x. Limbs are aimed { dir, bend } in the parent's space; bend is the way the
// next part folds (the forearm, the shin). Knees > 0, elbows < 0. waist/chest/neck/head: [forward, turn left, tilt].
// Every pose takes (t, r, o); most take o.lookY (head turn, + = left) and o.headDown.
import { POSE } from './poses.js';

const S = Math.sin, C = Math.cos, PI = Math.PI;
const breathe = (t, r) => 0.015 * S(t * 1.6 + r * 9);
const sway = (t, r, a = 1) => a * 0.02 * S(t * 0.37 + r * 17);
const look = (t, r, a = 0.25) => a * S(t * 0.21 + r * 11) * S(t * 0.13 + r * 5);
const L = (dir, bend) => ({ dir, bend });
const FWD = [0, 0, 1], BACK = [0, 0, -1], DOWN = [0, -1, 0], UP = [0, 1, 0];
const lk = (o, t, r, a) => o.lookY ?? look(t, r, a);
// a slow working rhythm 0..1 with a quick stroke: rests, then strikes
const stroke = (t, r, rate = 1.2) => { const u = (t * rate + r * 3) % 1; return u < 0.75 ? u / 0.75 : 1 - (u - 0.75) / 0.25; };
function legs(w = 1) {
  return { lHip: L([0.04, -1, w > 0 ? 0.02 : -0.03], BACK), rHip: L([-0.04, -1, w > 0 ? -0.03 : 0.02], BACK), lKnee: w > 0 ? 0.04 : 0.16, rKnee: w > 0 ? 0.16 : 0.04, lAnk: 0, rAnk: 0 };
}
// sitting on the ground with the legs out in front, a little apart, knees soft
function legsOut(b = 0.25) {
  return { lHip: L([0.12, 0.0, 1], DOWN), rHip: L([-0.1, 0.0, 1], DOWN), lKnee: b, rKnee: b + 0.1, lAnk: 0.3, rAnk: 0.25 };
}
// kneeling, sitting back on the heels
function legsKneel() {
  return { lHip: L([0.12, -0.1, 1], DOWN), rHip: L([-0.12, -0.1, 1], DOWN), lKnee: 2.75, rKnee: 2.75, lAnk: 0.9, rAnk: 0.9 };
}
// kneeling upright on both knees (thighs vertical)
function legsKneelUp() {
  return { lHip: L([0.08, -1, 0.05], BACK), rHip: L([-0.08, -1, 0.05], BACK), lKnee: 1.57, rKnee: 1.57, lAnk: 0.75, rAnk: 0.75 };
}

Object.assign(POSE, {
  // running; speed in strides per second
  run(t, r, o = {}) {
    const f = (t * (o.speed ?? 1.5) + r) * PI * 2, s = S(f), c = C(f), A = o.stride ?? 0.62, b = breathe(t, r);
    const leg = (ph) => { const a = A * S(ph) + 0.12; return [0, -C(a), S(a)]; };
    const arm = (ph, x) => { const a = 0.7 * S(ph); return [x, -C(a), S(a)]; };
    return {
      hipsY: -s * 0.12, hipsZ: c * 0.03, lift: 0.05 * Math.abs(S(f)),
      chest: [0.22 + b + (o.lean || 0), s * 0.14, 0], neck: [-0.08, 0, 0], head: [-0.02 + (o.headDown ?? 0), lk(o, t, r, 0.1), 0],
      lHip: L(leg(f), BACK), rHip: L(leg(f + PI), BACK),
      lKnee: 0.3 + 1.35 * Math.max(0, c), rKnee: 0.3 + 1.35 * Math.max(0, -c), lAnk: 0.25 + s * 0.2, rAnk: 0.25 - s * 0.2,
      lSh: L(arm(f + PI, 0.18), FWD), rSh: L(arm(f, -0.18), FWD), lEl: -1.55, rEl: -1.55,
    };
  },
  // walking fast, leaning in, as if late
  hurry(t, r, o = {}) {
    const p = POSE.walk(t, r, { speed: o.speed ?? 1.15, stride: 0.5, lean: 0.12, lookY: o.lookY, headDown: -0.06 });
    return p;
  },
  // walking slowly with a stick in the right hand, a little bent
  oldWalk(t, r, o = {}) {
    const p = POSE.walk(t, r, { speed: o.speed ?? 0.6, stride: 0.26, lean: 0.18, lookY: o.lookY, headDown: 0.05 });
    return { ...p, rSh: L([-0.18, -0.85, 0.5], FWD), rEl: -0.7 };
  },
  // sitting with the knees pulled in tight, arms wrapped round them, head low
  sitHug(t, r, o = {}) {
    const b = breathe(t, r) * 0.7;
    return {
      chest: [0.42 + b, 0, 0], neck: [0.2, 0, 0], head: [o.headDown ?? 0.25, lk(o, t, r, 0.12), o.tilt ?? 0],
      lHip: L([0.08, 0.62, 0.78], DOWN), rHip: L([-0.08, 0.6, 0.8], DOWN), lKnee: 2.25, rKnee: 2.2, lAnk: -0.35, rAnk: -0.3,
      lSh: L([0.02, -0.35, 0.94], [-1, 0, 0.2]), rSh: L([-0.02, -0.35, 0.94], [1, 0, 0.2]), lEl: -1.25, rEl: -1.3,
    };
  },
  // sitting with the legs out, leaning back on the hands
  sitBack(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [-0.28 + b, 0, 0], neck: [0.22, 0, 0], head: [o.headDown ?? 0.12, lk(o, t, r, 0.3), 0],
      ...legsOut(o.knee ?? 0.35),
      lSh: L([0.35, -0.85, -0.4], BACK), rSh: L([-0.35, -0.85, -0.4], BACK), lEl: -0.15, rEl: -0.15, lWr: [-0.9, 0, 0], rWr: [-0.9, 0, 0],
    };
  },
  // sitting with the legs out, upright, hands in the lap (a child can lie across the legs)
  sitLap(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [0.12 + b, 0, 0], neck: [0.15, 0, 0], head: [o.headDown ?? 0.42, lk(o, t, r, 0.12), 0],
      ...legsOut(o.knee ?? 0.45),
      lSh: L([0.18, -0.82, 0.55], [-1, 0.2, 0.4]), rSh: L([-0.18, -0.82, 0.55], [1, 0.2, 0.4]), lEl: -0.85, rEl: -0.8,
    };
  },
  // kneeling, sitting back on the heels; hands on the thighs
  kneel(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [0.1 + b + (o.lean || 0), 0, 0], neck: [0.08, 0, 0], head: [o.headDown ?? 0.15, lk(o, t, r, 0.3), 0],
      ...legsKneel(),
      lSh: L([0.12, -0.8, 0.58], DOWN), rSh: L([-0.12, -0.8, 0.58], DOWN), lEl: -0.4, rEl: -0.45,
    };
  },
  // kneeling and leaning over the ground, both hands pushing a scraper back and forth (a hide, a root, a board)
  scrape(t, r, o = {}) {
    const b = breathe(t, r), d = S(t * (o.rate ?? 2.2) + r * 7);
    return {
      chest: [0.75 + b + d * 0.05, 0, 0], neck: [0.05, 0, 0], head: [o.headDown ?? 0.35, o.lookY ?? 0, 0],
      ...legsKneel(),
      lSh: L([0.14, -0.55 - d * 0.18, 0.82], DOWN), rSh: L([-0.1, -0.55 - d * 0.18, 0.82], DOWN), lEl: -0.25, rEl: -0.3,
    };
  },
  // sitting, a stone core held low in the left hand, the right striking down at it
  knap(t, r, o = {}) {
    const b = breathe(t, r), k = stroke(t, r, o.rate ?? 1.1);
    return {
      chest: [0.42 + b, 0.05, 0], neck: [0.2, 0, 0], head: [o.headDown ?? 0.45, o.lookY ?? 0, 0],
      lHip: L([0.55, 0.25, 0.8], DOWN), rHip: L([-0.5, 0.25, 0.83], DOWN), lKnee: 1.7, rKnee: 1.75, lAnk: -0.1, rAnk: -0.1,
      lSh: L([0.1, -0.75, 0.66], [-0.6, 0.4, 0.3]), lEl: -1.15,
      rSh: L([-0.15, -0.55 + k * 0.6, 0.8 - k * 0.2], [0.4, 1, 0.3]), rEl: -1.3 - k * 0.5,
    };
  },
  // a spear thrown: the right arm drawn back and high, the left reaching forward, weight on the back leg
  throw(t, r, o = {}) {
    const b = breathe(t, r), k = 0.5 + 0.5 * S(t * 0.9 + r * 4);
    const tw = 0.6 + k * 0.15, sx = S(tw), cz = C(tw); // how far the chest has turned away from the target
    return {
      hipsY: -0.55, chest: [-0.08 + b, -tw + 0.55, 0.05], neck: [0, 0, 0], head: [0.0, tw + 0.1, -0.05],
      lHip: L([0.16, -0.95, 0.3], BACK), rHip: L([-0.16, -0.94, -0.3], BACK), lKnee: 0.12, rKnee: 0.35, lAnk: 0.05, rAnk: 0.2,
      rSh: L([-sx * 0.95, 0.32, -cz * 0.95], [0, 1, 0]), rEl: -0.35, rWr: [0, 0, 0],
      lSh: L([sx * 0.9, 0.05, cz * 0.9], [-0.3, 0.6, 0.2]), lEl: -0.3,
    };
  },
  // a spear held in both hands, point forward and down, the body coming up out of a crouch (danger passing)
  spearLow(t, r, o = {}) {
    const b = breathe(t, r), k = o.tense ?? 0.5;
    return {
      hipsY: 0.25, chest: [0.12 + k * 0.2 + b, -0.25, 0], neck: [-0.05, 0, 0], head: [o.headDown ?? 0.0, o.lookY ?? 0.2, 0],
      lHip: L([0.18, -0.95, 0.22], BACK), rHip: L([-0.14, -0.96, -0.2], BACK), lKnee: 0.15 + k * 0.4, rKnee: 0.2 + k * 0.45, lAnk: 0, rAnk: 0.1,
      rSh: L([-0.2, -0.95, 0.1], FWD), rEl: -1.8, rWr: [0, 0, 0],
      lSh: L([0.15, -0.6, 0.78], FWD), lEl: -0.1,
    };
  },
  // pointing far off with the right arm
  point(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.3, 0.1 + (o.up ?? 0), 0.95], FWD), rEl: -0.1, rWr: [0, 0, 0], head: [-0.04, o.lookY ?? 0, 0] };
  },
  // telling: arms open, then one sweeping, the body turning to the listeners
  tell(t, r, o = {}) {
    const b = breathe(t, r), g = S(t * 1.4 + r * 13), h = S(t * 0.9 + r * 3);
    const base = o.kneel ? { ...legsKneelUp() } : legs(r > 0.5 ? 1 : -1);
    return {
      ...base, hipsY: h * 0.2,
      chest: [0.06 + b, h * 0.18, 0], neck: [0, 0, 0], head: [-0.04, (o.lookY ?? 0) + h * 0.2, 0],
      rSh: L([-0.5, -0.05 + g * 0.3, 0.86], [0.2, 1, 0.4]), rEl: -0.8 - g * 0.3,
      lSh: L([0.45, -0.6 - g * 0.15, 0.66], [-0.3, 1, 0.5]), lEl: -1.0 + g * 0.2,
    };
  },
  // acting out the hunt: crouched low, the right arm cocked to throw, creeping
  mime(t, r, o = {}) {
    const b = breathe(t, r), k = S(t * 0.8 + r * 5);
    return {
      hipsY: -0.3, lift: 0,
      chest: [0.45 + b, -0.2, 0], neck: [-0.25, 0, 0], head: [-0.15, 0.35, 0],
      lHip: L([0.25, -0.55, 0.8], DOWN), rHip: L([-0.2, -0.8, -0.35], BACK), lKnee: 1.35, rKnee: 1.2, lAnk: -0.3, rAnk: 0.4,
      rSh: L([-0.7, 0.45 + k * 0.15, -0.5], [0, 1, 0.6]), rEl: -1.2,
      lSh: L([0.35, -0.2, 0.9], FWD), lEl: -0.3,
    };
  },
  // arms out to someone arriving
  welcome(t, r, o = {}) {
    const p = POSE.stand(t, r, o), k = S(t * 1.2 + r * 7) * 0.1;
    return { ...p, chest: [-0.04, 0, 0], lSh: L([0.55, -0.15 + k, 0.8], [-0.4, 0.6, 0.2]), rSh: L([-0.55, -0.15 - k, 0.8], [0.4, 0.6, 0.2]), lEl: -0.6, rEl: -0.6 };
  },
  // a hug, arms round the person in front
  embrace(t, r, o = {}) {
    const p = POSE.stand(t, r, o), b = breathe(t, r);
    return { ...p, chest: [0.12 + b, 0, 0], neck: [0.1, 0, 0], head: [0.25, o.lookY ?? 0.5, 0.15], lSh: L([0.25, -0.1, 0.96], [-1, 0, 0]), rSh: L([-0.2, -0.3, 0.93], [1, 0, 0]), lEl: -1.5, rEl: -1.6 };
  },
  // a hand on the shoulder of someone standing alongside (on the figure's right)
  shoulderHand(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, chest: [0.04, -0.1, -0.05], rSh: L([-0.97, 0.12, -0.15], [0, -1, 0.3]), rEl: -0.45, rWr: [0, 0, 0], head: [0.05, o.lookY ?? -0.3, 0] };
  },
  // giving: the right arm held out at waist height, palm up; o.kneel kneels
  give(t, r, o = {}) {
    const p = o.kneel ? POSE.kneel(t, r, o) : o.crouch ? POSE.crouch(t, r, o) : POSE.stand(t, r, o), k = S(t * 0.8 + r * 3) * 0.05;
    return { ...p, chest: [(o.kneel ? 0.25 : 0.12), 0.1, 0], head: [0.25, o.lookY ?? 0, 0], rSh: L([-0.12, -0.45 + k, 0.9], [0, 1, 0.5]), rEl: -0.35, rWr: [-0.6, 0, 0] };
  },
  // reaching out to take something; o.sit / o.kneel
  reach(t, r, o = {}) {
    const p = o.sit ? POSE.sitCross(t, r, o) : o.kneel ? POSE.kneel(t, r, o) : POSE.stand(t, r, o), k = S(t * 0.7 + r * 3) * 0.06;
    return { ...p, chest: [(o.sit || o.kneel ? 0.3 : 0.15), 0, 0], head: [0.15, o.lookY ?? 0, 0], lSh: L([0.1, -0.2 + k, 0.97], [0, 1, 0.5]), lEl: -0.25, lWr: [-0.6, 0, 0] };
  },
  // eating with the fingers, sitting; the right hand goes to the mouth now and then
  eat(t, r, o = {}) {
    const p = o.crouch ? POSE.crouch(t, r, o) : POSE.sitCross(t, r, o), k = Math.max(0, S(t * 0.9 + r * 6));
    return { ...p, head: [0.12 - k * 0.1, o.lookY ?? 0, 0], rSh: L([-0.18, -0.7 + k * 0.25, 0.68], [0.6, 1, 0.3]), rEl: -1.6 - k * 0.7, lSh: L([0.16, -0.75, 0.62], [-0.5, 0.6, 0.6]), lEl: -1.1 };
  },
  // squatting at the fire, poking it or putting wood on, the right arm reaching in
  feedFire(t, r, o = {}) {
    const p = POSE.crouch(t, r, o), k = S(t * 0.7 + r * 3);
    return { ...p, chest: [0.42, 0, 0], head: [0.35, 0, 0], rSh: L([-0.12, -0.45 + k * 0.08, 0.89], DOWN), rEl: -0.15, rWr: [0.2, 0, 0], lSh: L([0.2, -0.8, 0.55], DOWN), lEl: -0.9 };
  },
  // crouched at the ground, cracking something with a stone in the right hand: it rises and falls
  crack(t, r, o = {}) {
    const p = POSE.crouch(t, r, o), k = stroke(t, r, o.rate ?? 1.3);
    return { ...p, head: [0.4, 0, 0], rSh: L([-0.15, -0.6 + k * 0.75, 0.78 - k * 0.2], DOWN), rEl: -0.4 - k * 0.9, lSh: L([0.1, -0.65, 0.75], DOWN), lEl: -0.45 };
  },
  // kneeling, cutting at something on the ground in front: a sawing hand
  cut(t, r, o = {}) {
    const p = POSE.kneel(t, r, o), k = S(t * 3.2 + r * 7);
    return { ...p, chest: [0.62, 0, 0], head: [0.45, 0, 0], rSh: L([-0.1 + k * 0.08, -0.6, 0.8], DOWN), rEl: -0.5, lSh: L([0.16, -0.6, 0.78], DOWN), lEl: -0.45 };
  },
  // standing, bent over, driving a digging stick down with both hands
  digStand(t, r, o = {}) {
    const b = breathe(t, r), k = stroke(t, r, o.rate ?? 0.9);
    return {
      chest: [0.55 + b + k * 0.12, 0, 0], neck: [0.0, 0, 0], head: [0.35, 0, 0],
      lHip: L([0.14, -0.96, 0.22], BACK), rHip: L([-0.14, -0.95, -0.22], BACK), lKnee: 0.5 + k * 0.15, rKnee: 0.3, lAnk: -0.2, rAnk: 0.1,
      lSh: L([0.12, -0.6 - k * 0.3, 0.6 - k * 0.2], [-0.5, 0.2, 0.6]), rSh: L([-0.1, -0.5 - k * 0.3, 0.7 - k * 0.2], [0.5, 0.2, 0.6]), lEl: -0.9 + k * 0.3, rEl: -1.1 + k * 0.3,
    };
  },
  // a load on the shoulders (a carcass, a bundle): both hands up at the shoulders holding it; o.walk walks
  carryShoulder(t, r, o = {}) {
    const p = o.walk ? POSE.walk(t, r, { speed: o.speed ?? 0.7, stride: 0.3, lean: 0.12 }) : POSE.stand(t, r, o);
    return { ...p, chest: [0.16, 0, 0], head: [0.12, o.lookY ?? 0, 0], lSh: L([0.35, -0.75, 0.56], UP), rSh: L([-0.35, -0.75, 0.56], UP), lEl: -2.25, rEl: -2.25 };
  },
  // something carried in front in both arms, forearms level; o.walk walks
  carryArms(t, r, o = {}) {
    const p = o.walk ? POSE.walk(t, r, { speed: o.speed ?? 0.75, stride: 0.32, lean: -0.04 }) : POSE.stand(t, r, o);
    return { ...p, chest: [-0.03, 0, 0], head: [0.15, o.lookY ?? 0, 0], lSh: L([0.12, -0.9, 0.35], [-0.2, 0.5, 1]), rSh: L([-0.12, -0.9, 0.35], [0.2, 0.5, 1]), lEl: -1.45, rEl: -1.45 };
  },
  // a bag or a bundle over the right shoulder, the hand holding it; o.walk walks
  carryBack(t, r, o = {}) {
    const p = o.walk ? POSE.walk(t, r, { speed: o.speed ?? 0.75, stride: 0.34, lean: 0.12 }) : POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.25, -0.2, 0.5], [0.2, 1, -0.4]), rEl: -2.4 };
  },
  // a baby against the chest, standing, swaying slowly from foot to foot
  rock(t, r, o = {}) {
    const p = POSE.cradle(t, r, o), k = S(t * 1.3 + r * 5);
    return { ...p, hipsZ: k * 0.04, hipsY: k * 0.1, head: [0.45, 0.15, 0.1] };
  },
  // holding something out in both hands in front (a baby being passed)
  offer(t, r, o = {}) {
    const p = o.sit ? POSE.sitCross(t, r, o) : o.kneel ? POSE.kneel(t, r, o) : POSE.stand(t, r, o);
    return { ...p, chest: [0.18, 0, 0], head: [0.3, o.lookY ?? 0, 0], lSh: L([0.1, -0.45, 0.89], [-0.3, 1, 0.3]), rSh: L([-0.1, -0.45, 0.89], [0.3, 1, 0.3]), lEl: -0.65, rEl: -0.65 };
  },
  // a baby held in the lap, sitting cross-legged, looking down at it
  lapBaby(t, r, o = {}) {
    const p = POSE.sitCross(t, r, { headDown: 0.5 }), k = S(t * 1.0 + r) * 0.03;
    return { ...p, chest: [0.32, 0, 0], lSh: L([0.15, -0.75, 0.62 + k], [-1, 0.3, 0.3]), rSh: L([-0.15, -0.75, 0.62 - k], [1, 0.3, 0.3]), lEl: -1.25, rEl: -1.2 };
  },
  // grooming: sitting behind someone, both hands at their head, picking through the hair
  groom(t, r, o = {}) {
    const b = breathe(t, r), k = S(t * 2.1 + r * 7) * 0.06, j = S(t * 1.7 + r * 3) * 0.06;
    const base = o.kneel ? legsKneel() : { lHip: L([0.72, 0.05, 0.69], [-1, 0, 0.35]), rHip: L([-0.72, 0.08, 0.69], [1, 0, 0.35]), lKnee: 2.45, rKnee: 2.5, lAnk: 0, rAnk: 0 };
    return {
      ...base, chest: [0.3 + b, 0, 0], neck: [0.15, 0, 0], head: [0.4, 0, 0],
      lSh: L([0.12, -0.2 + k, 0.97], [-0.5, 1, 0]), rSh: L([-0.12, -0.15 + j, 0.98], [0.5, 1, 0]), lEl: -1.35 - j, rEl: -1.4 - k,
    };
  },
  // sitting with the head down, being groomed or dozing
  sitBowed(t, r, o = {}) {
    const p = o.kneel ? POSE.kneel(t, r, o) : POSE.sitCross(t, r, o), b = breathe(t, r);
    return { ...p, chest: [0.28 + b, 0, 0], neck: [0.3, 0, 0], head: [0.45, o.lookY ?? 0, o.tilt ?? 0.1] };
  },
  // sitting and leaning sideways against someone (o.side 1: leaning left, -1: right), head on their shoulder
  leanOn(t, r, o = {}) {
    const p = o.knees ? POSE.sitKnees(t, r, o) : POSE.sitCross(t, r, o), sd = o.side ?? 1, b = breathe(t, r);
    return { ...p, hipsZ: -sd * 0.12, chest: [0.18 + b, 0, -sd * 0.22], neck: [0.1, 0, -sd * 0.2], head: [0.25, sd * 0.2, -sd * 0.3] };
  },
  // sitting with an arm round the shoulders of someone on the left
  armRound(t, r, o = {}) {
    const p = o.knees ? POSE.sitKnees(t, r, o) : POSE.sitCross(t, r, o);
    return { ...p, chest: [0.12, 0.1, 0.06], lSh: L([0.97, 0.1, -0.12], [0, -1, 0.3]), lEl: -0.45, head: [0.12, o.lookY ?? 0.35, 0.05] };
  },
  // lying on the back, knees up, hands on the belly: awake, looking at the sky (o.flat: legs out)
  lieBack(t, r, o = {}) {
    const b = breathe(t, r) * 0.7;
    const legsUp = o.flat ? { lHip: L([0.1, -1, 0.05], BACK), rHip: L([-0.08, -1, 0.1], BACK), lKnee: 0.15, rKnee: 0.3, lAnk: 0.5, rAnk: 0.45 }
      : { lHip: L([0.12, -0.6, 0.8], BACK), rHip: L([-0.1, -0.85, 0.5], BACK), lKnee: 1.6, rKnee: 0.9, lAnk: 0.1, rAnk: 0.3 };
    return {
      hipsX: -PI / 2, chest: [b, 0, 0], neck: [-0.15, 0, 0], head: [o.headDown ?? -0.1, o.lookY ?? 0.1, 0],
      ...legsUp,
      ...(o.hands === 'head' ? { lSh: L([0.75, 0.6, 0.1], [-1, 0.2, -0.3]), rSh: L([-0.75, 0.6, 0.1], [1, 0.2, -0.3]), lEl: -2.3, rEl: -2.3 }
        : { lSh: L([0.3, -0.95, -0.08], FWD), rSh: L([-0.25, -0.92, 0.2], [1, 0, 0.5]), lEl: -0.2, rEl: -1.6 }),
    };
  },
  // lying on the side, propped up on the right elbow, head up and turned: awake among sleepers
  liePropped(t, r, o = {}) {
    const b = breathe(t, r) * 0.6;
    return {
      hipsZ: PI / 2, chest: [0.1 + b, 0, -0.5], neck: [0.05, 0, -0.15], head: [o.headDown ?? 0.05, o.lookY ?? 0, 0.1],
      lHip: L([0.0, -0.6, 0.8], BACK), rHip: L([0.0, -0.75, 0.62], BACK), lKnee: 1.3, rKnee: 1.1, lAnk: -0.2, rAnk: -0.2,
      rSh: L([-0.75, -0.2, 0.62], [0, 1, 0.3]), rEl: -1.3, lSh: L([0.1, -0.85, 0.5], FWD), lEl: -0.5,
    };
  },
  // lying on the front, head on the forearms
  lieFront(t, r, o = {}) {
    const b = breathe(t, r) * 0.6;
    return {
      hipsX: PI / 2, chest: [b, 0, 0], neck: [-0.2, 0, 0], head: [-0.2, o.lookY ?? 0.6, 0],
      lHip: L([0.12, -1, 0], BACK), rHip: L([-0.08, -1, -0.15], BACK), lKnee: 0.1, rKnee: 0.5, lAnk: 1.2, rAnk: 1.1,
      lSh: L([0.5, 0.75, 0.2], [-1, 0, 0.3]), rSh: L([-0.5, 0.75, 0.2], [1, 0, 0.3]), lEl: -1.8, rEl: -1.8,
    };
  },
  // asleep sitting up, head down on the knees
  dozeSit(t, r, o = {}) {
    const p = POSE.sitHug(t, r, o), b = breathe(t, r) * 0.6;
    return { ...p, chest: [0.6 + b, 0, 0], neck: [0.35, 0, 0], head: [0.35, 0, 0.15] };
  },
  // a child climbing: arms up holding a branch, one knee high
  climb(t, r, o = {}) {
    const k = S(t * 1.6 + r * 5);
    return {
      chest: [-0.1, 0, 0], neck: [-0.2, 0, 0], head: [-0.3, o.lookY ?? 0, 0],
      lHip: L([0.18, -0.25, 0.95], DOWN), lKnee: 1.9, lAnk: 0.2, rHip: L([-0.08, -1, 0.1], BACK), rKnee: 0.2, rAnk: 0.4,
      lSh: L([0.2, 0.97, 0.15 + k * 0.05], [0, 0, 1]), rSh: L([-0.25, 0.95, 0.25 - k * 0.05], [0, 0, 1]), lEl: -0.4 - k * 0.2, rEl: -0.5 + k * 0.2,
    };
  },
  // hanging from a branch by both hands, legs swinging
  hang(t, r, o = {}) {
    const k = S(t * 1.4 + r * 5);
    return {
      hipsX: k * 0.15, chest: [-0.05, 0, 0], neck: [-0.2, 0, 0], head: [-0.25, o.lookY ?? 0, 0],
      lHip: L([0.08, -0.95, 0.3 + k * 0.2], BACK), rHip: L([-0.08, -0.95, 0.1 + k * 0.2], BACK), lKnee: 0.6, rKnee: 0.9, lAnk: 0.6, rAnk: 0.5,
      lSh: L([0.12, 1, 0.05], FWD), rSh: L([-0.12, 1, 0.05], FWD), lEl: -0.1, rEl: -0.1,
    };
  },
  // in the water, knees bent, arms flinging spray
  splash(t, r, o = {}) {
    const k = S(t * 3.0 + r * 9), j = C(t * 2.3 + r * 4);
    return {
      hipsY: k * 0.25, chest: [0.25 + j * 0.08, k * 0.2, 0], neck: [0, 0, 0], head: [0.05, o.lookY ?? 0, 0],
      lHip: L([0.2, -0.9, 0.3], BACK), rHip: L([-0.2, -0.9, 0.25], BACK), lKnee: 0.6, rKnee: 0.5, lAnk: -0.2, rAnk: -0.2,
      lSh: L([0.5, -0.3 + k * 0.6, 0.7], [0, 1, 0.4]), rSh: L([-0.5, -0.3 - k * 0.6, 0.7], [0, 1, 0.4]), lEl: -0.5, rEl: -0.5,
    };
  },
  // wrestling: crouched forward, arms out to grab, rocking
  wrestle(t, r, o = {}) {
    const k = S(t * 2.2 + r * 5), b = breathe(t, r);
    return {
      hipsY: k * 0.15, chest: [0.55 + b, k * 0.15, 0], neck: [-0.3, 0, 0], head: [-0.15, 0, 0],
      lHip: L([0.25, -0.75, 0.55], DOWN), rHip: L([-0.25, -0.85, -0.3], BACK), lKnee: 1.2, rKnee: 0.8, lAnk: -0.3, rAnk: 0.3,
      lSh: L([0.3, -0.15 + k * 0.1, 0.94], [-0.5, 0.5, 0.3]), rSh: L([-0.3, -0.15 - k * 0.1, 0.94], [0.5, 0.5, 0.3]), lEl: -0.7, rEl: -0.7,
    };
  },
  // a child throwing a small spear: a quick overarm loop
  throwSmall(t, r, o = {}) {
    const u = (t * 0.8 + r) % 1, k = u < 0.7 ? u / 0.7 : 1 - (u - 0.7) / 0.3; // draw back slowly, throw fast
    return {
      hipsY: -0.4 + (1 - k) * 0.7, chest: [0.05 + (1 - k) * 0.3, -0.2 * k, 0], neck: [0, 0, 0], head: [0, 0.4 * k, 0],
      lHip: L([0.16, -0.95, 0.28], BACK), rHip: L([-0.16, -0.95, -0.28], BACK), lKnee: 0.2, rKnee: 0.35, lAnk: 0, rAnk: 0.2,
      rSh: L([-0.35, 0.35 - (1 - k) * 0.6, -0.85 * k + (1 - k) * 0.8], [0, 1, 0.3]), rEl: -0.3 - k * 0.5,
      lSh: L([0.45, 0.0, 0.88], FWD), lEl: -0.3,
    };
  },
  // standing with the hands on the hips, watching
  handsHips(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, lSh: L([0.72, -0.68, -0.12], [-1, -0.3, 0.4]), rSh: L([-0.72, -0.68, -0.12], [1, -0.3, 0.4]), lEl: -1.75, rEl: -1.75, lWr: [0, 0, 0], rWr: [0, 0, 0] };
  },
  // standing still, arms hanging, shoulders down, head low and turned (the one at the edge)
  standApart(t, r, o = {}) {
    const p = POSE.stand(t, r, o), b = breathe(t, r);
    return { ...p, chest: [0.08 + b, 0, 0], neck: [0.15, 0, 0], head: [o.headDown ?? 0.2, o.lookY ?? 0, 0], lSh: L([0.1, -1, 0.06], FWD), rSh: L([-0.1, -1, 0.06], FWD), lEl: -0.12, rEl: -0.15 };
  },
  // standing at the edge of the dark, arms folded, weight on one leg, looking out
  watch(t, r, o = {}) {
    const p = POSE.armsCrossed(t, r, o);
    return { ...p, head: [-0.02, o.lookY ?? look(t, r, 0.5), 0], neck: [-0.02, 0, 0] };
  },
  // squatting, both hands round something held up to the mouth (honey, a bone)
  lick(t, r, o = {}) {
    const p = o.sit ? POSE.sitKnees(t, r, o) : POSE.crouch(t, r, o), k = S(t * 1.1 + r * 4) * 0.08;
    return { ...p, chest: [0.25, 0, 0], head: [0.05, 0, 0], lSh: L([0.1, -0.55 + k, 0.83], [-0.4, 1, 0.3]), rSh: L([-0.1, -0.55 + k, 0.83], [0.4, 1, 0.3]), lEl: -2.0, rEl: -2.0 };
  },
  // sitting and listening, chin on a fist, elbow on a knee
  listen(t, r, o = {}) {
    const p = POSE.sitKnees(t, r, o);
    return { ...p, chest: [0.38, 0, 0], head: [0.0, o.lookY ?? 0, 0], rSh: L([-0.1, -0.35, 0.93], UP), rEl: -2.3, rWr: [-0.3, 0, 0] };
  },
  // sitting cross-legged with the hands busy in the lap (twisting cord, picking over food)
  sitWork(t, r, o = {}) {
    const p = POSE.sitCross(t, r, o), k = S(t * 2.6 + r * 7) * 0.08, j = S(t * 2.1 + r * 3) * 0.08;
    return { ...p, chest: [0.32, 0, 0], head: [o.headDown ?? 0.5, o.lookY ?? 0, 0], lSh: L([0.14, -0.7 + k, 0.7], [-0.7, 0.4, 0.4]), rSh: L([-0.14, -0.7 + j, 0.7], [0.7, 0.4, 0.4]), lEl: -1.1, rEl: -1.15 };
  },
  // standing, both arms raised high (a shout, a greeting from far off)
  armsUp(t, r, o = {}) {
    const p = POSE.stand(t, r, o), k = S(t * 2.0 + r * 5) * 0.12;
    return { ...p, head: [-0.15, o.lookY ?? 0, 0], lSh: L([0.35, 0.92 + k, 0.15], FWD), rSh: L([-0.35, 0.92 - k, 0.15], FWD), lEl: -0.25, rEl: -0.25 };
  },
});
// walking and looking back over the shoulder (o.side 1: over the left shoulder)
POSE.walkLook = (t, r, o = {}) => { const p = POSE.walk(t, r, o), sd = o.side ?? 1; return { ...p, chest: [p.chest[0], p.chest[1] + sd * 0.45, 0], neck: [0, sd * 0.35, 0], head: [0.0, sd * 1.0, 0] }; };
// any pose raised off the ground by o.lift metres (sitting on a rock, hanging from a branch); o.base names the pose
POSE.on = (t, r, o = {}) => ({ ...POSE[o.base || 'sitKnees'](t, r, o), lift: o.lift || 0 });
