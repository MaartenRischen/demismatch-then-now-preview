// Poses for the mannequins, as functions of time so the figures are never frozen: they breathe, shift their weight,
// turn their heads. The figure faces +z; its left is +x.
//   Limbs are aimed: { dir: where the upper limb points (parent space), bend: which way the next joint folds }.
//   Knees and elbows take a bend angle in radians (knee > 0, elbow < 0).
//   waist/chest/neck/head take [forward lean, turn left, tilt]; hipsX/hipsY/hipsZ turn the whole body.
// Every pose takes (t, r, o): time in seconds, a per-figure random 0..1, and options.

const S = Math.sin, C = Math.cos, PI = Math.PI;
const breathe = (t, r) => 0.015 * S(t * 1.6 + r * 9);
const sway = (t, r, a = 1) => a * 0.02 * S(t * 0.37 + r * 17);
const look = (t, r, a = 0.25) => a * S(t * 0.21 + r * 11) * S(t * 0.13 + r * 5);
const L = (dir, bend) => ({ dir, bend });
// mirror a left limb onto the right side
const M = (l) => ({ dir: [-l.dir[0], l.dir[1], l.dir[2]], bend: l.bend ? [-l.bend[0], l.bend[1], l.bend[2]] : undefined });
const FWD = [0, 0, 1], BACK = [0, 0, -1], DOWN = [0, -1, 0], UP = [0, 1, 0];

function legs(o = {}) { // relaxed standing legs, weight on one side
  const w = o.w ?? 1;
  return { lHip: L([0.04, -1, w > 0 ? 0.02 : -0.03], BACK), rHip: L([-0.04, -1, w > 0 ? -0.03 : 0.02], BACK), lKnee: w > 0 ? 0.04 : 0.16, rKnee: w > 0 ? 0.16 : 0.04, lAnk: 0, rAnk: 0 };
}
function arms(b = 0) { // arms hanging, slightly bent
  return { lSh: L([0.16, -1, 0.04 + b], FWD), rSh: L([-0.16, -1, 0.04 - b], FWD), lEl: -0.2, rEl: -0.22, lWr: [0, 0, 0.04], rWr: [0, 0, -0.04] };
}

export const POSE = {
  stand(t, r, o = {}) {
    const w = r > 0.5 ? 1 : -1, b = breathe(t, r);
    return {
      hipsZ: w * 0.035 + sway(t, r), hipsY: sway(t, r + 1, 2),
      chest: [b - 0.02, 0, -w * 0.03], neck: [0.04, 0, 0], head: [o.headDown ?? 0.02, o.lookY ?? look(t, r), 0],
      ...legs({ w }), ...arms(b),
    };
  },
  // walking; speed in strides per second
  walk(t, r, o = {}) {
    const f = (t * (o.speed ?? 0.9) + r) * PI * 2, s = S(f), c = C(f), b = breathe(t, r), A = o.stride ?? 0.4;
    const leg = (ph) => [0, -C(A * S(ph)), S(A * S(ph))];
    const arm = (ph, x) => [x, -C(0.32 * S(ph)), S(0.32 * S(ph))];
    return {
      hipsY: -s * 0.08, hipsZ: c * 0.025,
      chest: [0.05 + b + (o.lean || 0), s * 0.08, 0], neck: [0, 0, 0], head: [0.04 + (o.headDown ?? 0), o.lookY ?? look(t, r, 0.12), 0],
      lHip: L(leg(f), BACK), rHip: L(leg(f + PI), BACK),
      lKnee: Math.max(0.06, -c * 0.65 + 0.32), rKnee: Math.max(0.06, c * 0.65 + 0.32), lAnk: s * 0.12, rAnk: -s * 0.12,
      lSh: o.lArm || L(arm(f + PI, 0.12), FWD), rSh: o.rArm || L(arm(f, -0.12), FWD), lEl: o.lEl ?? -0.28, rEl: o.rEl ?? -0.28,
    };
  },
  // sitting on the ground, knees up, arms loosely round them
  sitKnees(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [0.32 + b, 0, 0], neck: [0.08, 0, 0], head: [o.headDown ?? 0.08, o.lookY ?? look(t, r, 0.3), 0],
      lHip: L([0.14, 0.52, 0.84], DOWN), rHip: L([-0.12, 0.5, 0.86], DOWN), lKnee: 1.85, rKnee: 1.8, lAnk: -0.25, rAnk: -0.2,
      lSh: L([0.12, -0.45, 0.88], [-1, -0.3, 0]), rSh: L([-0.12, -0.45, 0.88], [1, -0.3, 0]), lEl: -0.75, rEl: -0.8,
    };
  },
  // sitting cross-legged
  sitCross(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [0.15 + b + (o.lean || 0), 0, 0], neck: [0.08, 0, 0], head: [o.headDown ?? 0.1, o.lookY ?? look(t, r, 0.35), 0],
      lHip: L([0.72, 0.05, 0.69], [-1, 0, 0.35]), rHip: L([-0.72, 0.08, 0.69], [1, 0, 0.35]), lKnee: 2.45, rKnee: 2.5, lAnk: 0, rAnk: 0,
      lSh: o.lArm || L([0.3, -0.85, 0.42], FWD), rSh: o.rArm || L([-0.3, -0.85, 0.42], FWD), lEl: o.lEl ?? -0.55, rEl: o.rEl ?? -0.6,
    };
  },
  // squatting on the heels, forearms on the knees; work: hands busy at the ground
  crouch(t, r, o = {}) {
    const b = breathe(t, r), k = o.work ? S(t * 2.4 + r * 7) * 0.12 : 0;
    return {
      chest: [0.5 + b, 0, 0], neck: [0.1, 0, 0], head: [o.headDown ?? 0.3, o.lookY ?? 0, 0],
      lHip: L([0.32, 0.12, 0.94], DOWN), rHip: L([-0.32, 0.12, 0.94], DOWN), lKnee: 2.2, rKnee: 2.2, lAnk: -0.45, rAnk: -0.45,
      lSh: L([0.18, -0.62 - k, 0.76], DOWN), rSh: L([-0.18, -0.62 + k, 0.76], DOWN), lEl: -0.35, rEl: -0.4,
    };
  },
  // kneeling on the left knee, digging with a stick held in both hands
  dig(t, r) {
    const b = breathe(t, r), d = S(t * 2.6 + r * 7);
    return {
      chest: [0.7 + d * 0.08 + b, 0.08, 0], neck: [0.12, 0, 0], head: [0.35, 0, 0],
      lHip: L([0.1, -1, 0.1], BACK), lKnee: 1.62, lAnk: 0.6, rHip: L([-0.14, -0.08, 1], DOWN), rKnee: 1.6, rAnk: -0.1,
      lSh: L([0.12, -0.72 - d * 0.15, 0.68], DOWN), rSh: L([-0.02, -0.7 - d * 0.15, 0.71], DOWN), lEl: -0.3, rEl: -0.35,
    };
  },
  // asleep on the side, knees drawn up, one arm under the head
  lie(t, r) {
    const b = breathe(t, r) * 0.6;
    return {
      hipsZ: PI / 2, chest: [0.12 + b, 0, 0], neck: [0.15, 0, 0], head: [0.12, 0, -0.35],
      lHip: L([0.0, -0.45, 0.9], BACK), rHip: L([0.0, -0.6, 0.8], BACK), lKnee: 1.35, rKnee: 1.1, lAnk: -0.2, rAnk: -0.2,
      lSh: L([0.0, -0.3, 0.95], [0, 1, 0]), rSh: L([0.0, 0.55, 0.8], [0, 1, 0]), lEl: -1.4, rEl: -1.9,
    };
  },
  // a hand up to shade the eyes, looking into the distance
  shade(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.55, -0.05, 0.83], [1, 0.4, 0]), rEl: -2.1, rWr: [0.3, 0, 0], neck: [-0.04, 0, 0], head: [-0.08, o.lookY ?? 0.1, 0] };
  },
  // holding a spear upright, the hand at chest height
  spear(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.28, -0.94, 0.2], FWD), rEl: -1.2, rWr: [0, 0, 0] };
  },
  // a hand resting on a small child's shoulder (the child at the figure's left)
  guard(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, lSh: L([0.42, -0.88, 0.2], FWD), lEl: -0.45, lWr: [0.4, 0, 0], chest: [0.05, 0.12, 0] };
  },
  armsCrossed(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, lSh: L([0.22, -0.92, 0.3], [-1, 0.25, 0.4]), rSh: L([-0.2, -0.9, 0.38], [1, 0.35, 0.4]), lEl: -2.0, rEl: -1.95, lWr: [0, 0, 0], rWr: [0, 0, 0] };
  },
  // talking with one hand
  talk(t, r, o = {}) {
    const p = POSE.stand(t, r, o), g = S(t * 1.9 + r * 13), h = S(t * 1.3 + r * 3);
    return { ...p, rSh: L([-0.25, -0.8, 0.45 + g * 0.1], [0.4, 1, 0.3]), rEl: -1.25 - h * 0.25, lSh: L([0.18, -1, 0.1], FWD), lEl: -0.6, head: [0.0, (o.lookY ?? 0) + h * 0.12, 0] };
  },
  holdCup(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, rSh: L([-0.12, -0.96, 0.22], [0.5, 1, 0.5]), rEl: -1.75 };
  },
  // looking down at a phone held in both hands
  phone(t, r, o = {}) {
    const p = o.sit ? POSE.sitChair(t, r) : POSE.stand(t, r, o), b = breathe(t, r);
    return { ...p, lSh: L([0.12, -0.95, 0.28], [-0.6, 1, 0.4]), rSh: L([-0.12, -0.95, 0.28], [0.6, 1, 0.4]), lEl: -1.55, rEl: -1.5, neck: [0.32, 0, 0], head: [0.4 + b, 0, 0] };
  },
  sitChair(t, r, o = {}) {
    const b = breathe(t, r);
    return {
      chest: [0.04 + b + (o.lean || 0), 0, 0], neck: [0.05, 0, 0], head: [o.headDown ?? 0.05, o.lookY ?? look(t, r, 0.2), 0],
      lHip: L([0.09, 0.0, 1], DOWN), rHip: L([-0.09, 0.0, 1], DOWN), lKnee: 1.5, rKnee: 1.45, lAnk: 0, rAnk: 0,
      lSh: L([0.14, -0.88, 0.45], FWD), rSh: L([-0.14, -0.88, 0.45], FWD), lEl: -0.8, rEl: -0.85,
    };
  },
  // head in the hands, elbows on the knees
  headInHands(t, r, o = {}) {
    const p = o.ground ? POSE.sitKnees(t, r) : POSE.sitChair(t, r), b = breathe(t, r);
    return { ...p, chest: [0.62 + b, 0, 0], neck: [0.35, 0, 0], head: [0.4, 0, 0], lSh: L([0.12, -0.55, 0.83], UP), rSh: L([-0.12, -0.55, 0.83], UP), lEl: -2.35, rEl: -2.35, lWr: [-0.3, 0, 0], rWr: [-0.3, 0, 0] };
  },
  // a load carried on the head, steadied with both hands
  carryHead(t, r, o = {}) {
    const p = o.walk ? POSE.walk(t, r, { speed: 0.75, stride: 0.32 }) : POSE.stand(t, r);
    return { ...p, lSh: L([0.82, 0.5, 0.12], [-1, 0.6, 0]), rSh: L([-0.82, 0.5, 0.12], [1, 0.6, 0]), lEl: -1.7, rEl: -1.7, head: [0, 0, 0], chest: [0.02, 0, 0] };
  },
  // a baby held against the chest
  cradle(t, r, o = {}) {
    const p = o.sit ? POSE.sitCross(t, r, { headDown: 0.45 }) : POSE.stand(t, r, { headDown: 0.4 }), rock = S(t * 1.1 + r) * 0.04;
    return { ...p, lSh: L([0.16, -0.82, 0.5 + rock], [-1, 0.5, 0.3]), rSh: L([-0.2, -0.75, 0.6 - rock], [1, 0.6, 0.2]), lEl: -1.65, rEl: -1.45 };
  },
};
