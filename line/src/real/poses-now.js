// Poses for the "you, now" scenes: beds, sofas, desks, a fridge, a meeting room, a bus. They add themselves to POSE;
// the conventions are poses.js's (the figure faces +z, its left is +x; limbs aimed with { dir, bend }; knees bend > 0,
// elbows < 0; waist/chest/neck/head take [forward lean, turn left, tilt]). Every pose is (t, r, o).
import { POSE } from './poses.js';

const S = Math.sin, PI = Math.PI;
const breathe = (t, r, a = 1, f = 1.6) => 0.015 * a * S(t * f + r * 9);
const drift = (t, r, a = 1) => a * S(t * 0.21 + r * 11) * S(t * 0.13 + r * 5);
const L = (dir, bend) => ({ dir, bend });
const FWD = [0, 0, 1], BACK = [0, 0, -1], DOWN = [0, -1, 0], UP = [0, 1, 0];

// seated legs: thighs forward (drop tilts them down for a high seat), shins down to the floor
function seatLegs(o = {}) {
  const d = o.drop ?? 0, k = o.knee ?? 1.5, sp = o.spread ?? 0.09;
  return { lHip: L([sp, -d, 1], DOWN), rHip: L([-sp, -d * 0.95, 1], DOWN), lKnee: k - d, rKnee: k - d * 0.9 + (o.kneeOff ?? -0.05), lAnk: o.ank ?? 0.05, rAnk: o.ank ?? 0.05 };
}
// arms holding a phone in both hands in front of the chest (or low, between the knees)
function phoneArms(low = 0) {
  return { lSh: L([0.13, -0.95, 0.3 + low * 0.25], [-0.6, 1, 0.4]), rSh: L([-0.13, -0.95, 0.3 + low * 0.25], [0.6, 1, 0.4]), lEl: -1.55 + low * 0.45, rEl: -1.5 + low * 0.45, lWr: [0.2, 0, 0], rWr: [0.2, 0, 0] };
}

Object.assign(POSE, {
  // sitting on the edge of a bed or sofa, hunched over a phone held low; o.drop for a high seat
  sitPhone(t, r, o = {}) {
    const b = breathe(t, r);
    return { ...seatLegs({ drop: o.drop ?? 0.2, knee: 1.45, spread: 0.11 }), chest: [0.38 + b + (o.hunch ?? 0), 0, 0], waist: [0.12, 0, 0], neck: [0.3, 0, 0], head: [0.42 + 0.02 * S(t * 0.4 + r), drift(t, r, 0.04), 0.04], ...phoneArms(o.low ?? 0.4) };
  },
  // sitting up in bed, knees pulled in, arms wrapped round them; o.lookY turns the head (towards a window)
  hugKnees(t, r, o = {}) {
    const b = breathe(t, r, 1.2, 1.3);
    return {
      waist: [0.1, 0, 0], chest: [0.3 + b, (o.lookY ?? 0) * 0.15, 0], neck: [0.1, (o.lookY ?? 0) * 0.3, 0], head: [o.headDown ?? 0.12, (o.lookY ?? 0) * 0.55 + drift(t, r, 0.05), o.tilt ?? 0.08],
      lHip: L([0.1, 0.62, 0.78], DOWN), rHip: L([-0.08, 0.6, 0.8], DOWN), lKnee: 2.15, rKnee: 2.1, lAnk: -0.35, rAnk: -0.3,
      lSh: L([0.1, -0.35, 0.93], [-1, -0.35, 0]), rSh: L([-0.1, -0.33, 0.94], [1, -0.4, 0]), lEl: -1.25, rEl: -1.3, lWr: [0, 0, 0.3], rWr: [0, 0, -0.3],
    };
  },
  // curled on the right side, asleep or hiding; o.reach drops the top arm forward over the edge of the bed
  curl(t, r, o = {}) {
    const b = breathe(t, r, 0.6, 1.1);
    return {
      hipsZ: PI / 2, waist: [0.18, 0, 0], chest: [0.15 + b, 0, 0], neck: [0.22, 0, 0], head: [0.28, 0, -0.25],
      lHip: L([-0.3, -0.45, 0.84], BACK), rHip: L([-0.05, -0.5, 0.86], BACK), lKnee: 1.6, rKnee: 1.5, lAnk: -0.3, rAnk: -0.2,
      lSh: o.reach ? L([-0.2 - 0.02 * S(t * 0.5), 0.12, 0.97], [-1, 0, 0.2]) : L([-0.35, -0.25, 0.9], [0, 1, 0]), lEl: o.reach ? -0.25 : -1.6, lWr: o.reach ? [0.15, 0, 1.1] : [0.3, 0, 0],
      rSh: L([0.0, 0.5, 0.86], [0, 1, 0]), rEl: -2.0,
    };
  },
  // lying on the right side, the phone held up in front of the face in the top hand, the other arm under the pillow
  lieSidePhone(t, r, o = {}) {
    const b = breathe(t, r, 0.7, 1.2), th = 0.012 * S(t * 3.1); // the thumb flicks
    return {
      hipsZ: PI / 2, waist: [0.08, 0, 0], chest: [0.1 + b, 0, 0], neck: [0.12, 0, 0], head: [0.2, 0, -0.15],
      lHip: L([-0.28, -0.55, 0.78], BACK), rHip: L([-0.02, -0.7, 0.7], BACK), lKnee: 1.15, rKnee: 0.85, lAnk: -0.2, rAnk: -0.15,
      lSh: L([-0.62, -0.12, 0.78], [0, 1, 0.25]), lEl: -1.65 + th, lWr: [-0.3, 0, 0.2],
      rSh: L([-0.15, 0.6, 0.78], [0.5, 1, 0]), rEl: -1.6, rWr: [-0.3, 0, 0],
    };
  },
  // a child at a school desk, twisted round in the chair to look out of the window on its left (o.side -1: right)
  twistLook(t, r, o = {}) {
    const s = o.side ?? 1, b = breathe(t, r, 1.2, 2.0), fid = 0.04 * S(t * 2.7 + r * 5);
    return {
      ...seatLegs({ knee: 1.55, spread: 0.12 }), lAnk: 0.2 + fid, rAnk: -0.1,
      hipsY: s * 0.18, waist: [0.0, s * 0.3, 0], chest: [-0.02 + b, s * 0.45, -s * 0.05], neck: [0.0, s * 0.35, 0], head: [-0.06 + 0.03 * S(t * 0.6), s * (0.45 + drift(t, r, 0.08)), s * 0.06],
      ...(s > 0
        ? { lSh: L([0.35, -0.6, -0.72], [0, 1, 0.3]), lEl: -0.55, rSh: L([-0.2, -0.55, 0.81], UP), rEl: -1.0, rWr: [0.2, 0, 0] }
        : { rSh: L([-0.35, -0.6, -0.72], [0, 1, 0.3]), rEl: -0.55, lSh: L([0.2, -0.55, 0.81], UP), lEl: -1.0, lWr: [0.2, 0, 0] }),
    };
  },
  // a pupil at a desk: forearms on the desk, head down to the work, the writing hand moving
  write(t, r, o = {}) {
    const b = breathe(t, r), w = 0.05 * S(t * 4.0 + r * 7);
    return {
      ...seatLegs({ knee: 1.5, spread: 0.1 }), chest: [0.3 + b + (o.lean ?? 0), 0.05 * S(r * 20), 0], neck: [0.2, 0, 0], head: [o.headDown ?? 0.35, (o.lookY ?? 0) + drift(t, r, 0.1), 0],
      lSh: L([0.2, -0.62, 0.76], UP), lEl: -1.05, lWr: [0.1, 0, 0.2], rSh: L([-0.18 + w * 0.3, -0.6, 0.78], UP), rEl: -1.1 + w, rWr: [0.2, 0, -0.2],
    };
  },
  // sunk into a sofa: pelvis rolled well back, the back curled against the cushions, feet up on the coffee table,
  // the phone held at the chest with the head bowed to it. (Thigh directions are in the rolled pelvis's space.)
  slump(t, r, o = {}) {
    const b = breathe(t, r, 0.8, 1.2), hx = o.recline ?? 0.75;
    return {
      hipsX: -hx, waist: [0.16, 0, 0], chest: [0.24 + b, 0, 0], neck: [0.34, 0, 0], head: [0.3, drift(t, r, 0.04), 0.04],
      lHip: L([0.1, -0.6, 0.79], DOWN), rHip: L([-0.06, -0.62, 0.78], DOWN), lKnee: o.knee ?? 0.3, rKnee: (o.knee ?? 0.3) + 0.1, lAnk: 0.35, rAnk: 0.3,
      lSh: L([0.2, -0.85, 0.45], [-0.5, 1, 0.4]), rSh: L([-0.2, -0.85, 0.45], [0.5, 1, 0.4]), lEl: -1.75, rEl: -1.7, lWr: [0.3, 0, 0], rWr: [0.3, 0, 0],
    };
  },
  // at an open fridge: one hand on the door, the other reaching in to a shelf, leaning in to look
  reachFridge(t, r, o = {}) {
    const b = breathe(t, r), p = S(t * 0.45 + r) * 0.04, ry = o.reachY ?? 0.0;
    return {
      hipsY: 0.05, hipsZ: -0.03, waist: [0.06, 0, 0], chest: [0.22 + b, -0.1, 0], neck: [0.06, 0, 0], head: [0.18, -0.15 + drift(t, r, 0.06), 0],
      lHip: L([0.06, -1, -0.02], BACK), rHip: L([-0.06, -1, 0.12], BACK), lKnee: 0.06, rKnee: 0.22, lAnk: 0, rAnk: 0,
      rSh: L([-0.2, ry - 0.05 + p * 0.3, 1], [0, 1, 0]), rEl: -0.35 - p, rWr: [0.25, 0, 0],
      lSh: L([0.75, -0.45, 0.35], [0, 0, 1]), lEl: -0.65, lWr: [0, 0, 0.4],
    };
  },
  // standing at the end of a table, just risen to speak: weight forward, one hand open towards the room
  present(t, r, o = {}) {
    const p = POSE.stand(t, r, { lookY: 0, headDown: -0.02 }), g = S(t * 1.1 + r * 3), b = breathe(t, r, 1.5, 2.2);
    return { ...p, hipsY: 0.05 * S(t * 0.3), chest: [0.04 + b, 0.06, 0], neck: [0.02, 0, 0], head: [-0.04, -0.06 + 0.08 * S(t * 0.35), 0],
      rSh: L([-0.25, -0.75, 0.6 + g * 0.05], [0.3, 1, 0.4]), rEl: -1.0 - g * 0.15, rWr: [-0.3, 0, -0.2],
      lSh: L([0.18, -0.92, 0.35], FWD), lEl: -0.3, lWr: [0.6, 0, 0] };
  },
  // seated at a table, turned in the chair to look at someone (o.lookY, radians to the left), forearms on the table
  sitTurn(t, r, o = {}) {
    const b = breathe(t, r), ly = o.lookY ?? 0, k = Math.sign(ly) || 1;
    return {
      ...seatLegs({ knee: 1.45, spread: 0.11 }), hipsY: ly * 0.15, waist: [0.04, ly * 0.15, 0], chest: [0.06 + b + (o.lean ?? 0), ly * 0.3, 0], neck: [0.02, ly * 0.25, 0], head: [o.headDown ?? -0.02, ly * 0.35 + drift(t, r, 0.03), 0],
      lSh: L([0.18, -0.7, 0.68], UP), lEl: -1.0 - (k > 0 ? 0 : 0.2), lWr: [0.1, 0, 0.2], rSh: L([-0.18, -0.72, 0.66], UP), rEl: -1.05, rWr: [0.1, 0, -0.2],
      ...(o.armBack ? (k > 0 ? { lSh: L([0.4, -0.75, -0.3], FWD), lEl: -0.4 } : { rSh: L([-0.4, -0.75, -0.3], FWD), rEl: -0.4 }) : {}),
    };
  },
  // curled at the end of a sofa, knees up, arms round a cushion held against them, leaning on the arm
  hugCushion(t, r, o = {}) {
    const b = breathe(t, r, 1, 1.3);
    return {
      waist: [0.05, 0, 0.05], chest: [0.22 + b, 0, 0.06], neck: [0.15, 0, 0], head: [o.headDown ?? 0.3, (o.lookY ?? 0) + drift(t, r, 0.05), 0.15],
      lHip: L([0.16, 0.5, 0.85], DOWN), rHip: L([-0.04, 0.48, 0.88], DOWN), lKnee: 2.0, rKnee: 2.05, lAnk: -0.3, rAnk: -0.35,
      lSh: L([0.18, -0.45, 0.87], [-1, -0.1, 0.2]), rSh: L([-0.18, -0.42, 0.88], [1, -0.1, 0.2]), lEl: -1.45, rEl: -1.5, lWr: [0, 0, 0.3], rWr: [0, 0, -0.3],
    };
  },
  // settled back in an armchair, forearms along the arms, head a little forward; old, still
  armchair(t, r, o = {}) {
    const b = breathe(t, r, 0.8, 1.1);
    return {
      hipsX: -0.18, waist: [0.05, 0, 0], chest: [0.12 + b, 0, 0.02], neck: [0.22, 0, 0], head: [o.headDown ?? 0.18, (o.lookY ?? 0) + drift(t, r, 0.05), 0.04],
      ...seatLegs({ knee: 1.25, spread: 0.12, drop: -0.15 }), lAnk: 0.25, rAnk: 0.2,
      lSh: L([0.32, -0.88, 0.25], FWD), rSh: L([-0.32, -0.88, 0.25], FWD), lEl: -1.3, rEl: -1.25, lWr: [0.1, 0, 0.3], rWr: [0.1, 0, -0.3],
    };
  },
  // at a table, head propped on the right hand (elbow on the table), the left hand on the laptop
  propHead(t, r, o = {}) {
    const b = breathe(t, r, 0.8, 1.2), sc = 0.03 * S(t * 0.9 + r);
    return {
      ...seatLegs({ knee: 1.5, spread: 0.12 }), waist: [0.06, 0, 0], chest: [0.3 + b, -0.1, 0.1], neck: [0.12, -0.05, 0.12], head: [0.1, -0.1, 0.32],
      rSh: L([0.12, -0.6, 0.79], [0.3, 1, 0]), rEl: -2.3, rWr: [-0.6, 0, -0.2],
      lSh: L([0.2, -0.72, 0.66], UP), lEl: -1.0 + sc, lWr: [0.2, 0, 0.2],
    };
  },
  // standing at a window, arms hanging, looking out and a little down
  atWindow(t, r, o = {}) {
    const p = POSE.stand(t, r, { lookY: 0.05, headDown: 0.12 }), b = breathe(t, r, 0.9, 1.3);
    return { ...p, hipsZ: -0.05, chest: [0.06 + b, 0.03, 0.03], neck: [0.06, 0, 0], head: [0.16, 0.06 + drift(t, r, 0.05), 0.04], rSh: L([-0.1, -1, 0.06], FWD), rEl: -0.18, lSh: L([0.1, -1, 0.05], FWD), lEl: -0.22 };
  },
  // a parent leaning on a door frame with a mug held at the chest
  leanMug(t, r, o = {}) {
    const p = POSE.stand(t, r, { lookY: o.lookY ?? 0, headDown: 0.12 });
    return { ...p, hipsZ: -0.08, chest: [0.02, 0, 0.06], rSh: L([-0.12, -0.96, 0.22], [0.5, 1, 0.5]), rEl: -1.85, rWr: [0.3, 0, 0], lSh: L([0.1, -1, 0.05], FWD), lEl: -0.35 };
  },
  // at a party: a cup in one hand, the other talking
  talkCup(t, r, o = {}) {
    const p = POSE.talk(t, r, o);
    return { ...p, lSh: L([0.12, -0.96, 0.22], [-0.5, 1, 0.5]), lEl: -1.7, lWr: [0.2, 0, 0] };
  },
  // at a party: laughing, head back, cup held low
  laugh(t, r, o = {}) {
    const p = POSE.holdCup(t, r, o), k = Math.max(0, S(t * 0.7 + r * 6)) * S(t * 9) * 0.05;
    return { ...p, chest: [-0.06 + k, (o.lookY ?? 0) * 0.3, 0], head: [-0.2 + k, o.lookY ?? 0, 0.05], lSh: L([0.16, -1, 0.15], FWD), lEl: -0.35 };
  },
  // at a party: listening with arms folded loosely or a hand on the hip
  listen(t, r, o = {}) {
    const p = POSE.stand(t, r, o);
    return { ...p, lSh: L([0.45, -0.85, -0.1], [0, 0, 1]), lEl: -1.6, lWr: [0, 0, 0.6], rSh: L([-0.12, -0.96, 0.22], [0.5, 1, 0.5]), rEl: -1.75 };
  },
  // sitting on the edge of a sofa, rocking a baby held across the forearms, head bowed over it
  sitCradle(t, r, o = {}) {
    const rock = S(t * 1.5 + r) * 0.05, b = breathe(t, r, 1.3, 1.8);
    return {
      ...seatLegs({ drop: o.drop ?? 0.05, knee: 1.55, spread: 0.14 }), lAnk: 0.15 + Math.max(0, rock) * 2, rAnk: 0.1,
      waist: [0.1, 0, 0], chest: [0.28 + rock + b, 0.05, 0], neck: [0.2, 0, 0], head: [0.42, 0.08, 0.06],
      lSh: L([0.2, -0.8, 0.56], [-1, 0.6, 0.3]), rSh: L([-0.22, -0.72, 0.64], [1, 0.7, 0.2]), lEl: -1.6, rEl: -1.35, lWr: [0, 0, 0.2], rWr: [0, 0, -0.3],
    };
  },
  // a swaddled newborn, crying: head back, one arm worked free and jerking
  babyCry(t, r) {
    const c = S(t * 6.5) * S(t * 1.3 + r), b = breathe(t, r, 2.5, 3.2);
    return {
      chest: [-0.1 + b, 0, 0], neck: [-0.25, 0, 0], head: [-0.35 + c * 0.08, 0.25 * S(t * 1.7), 0],
      lHip: L([0.06, -0.95, 0.3], BACK), rHip: L([-0.06, -0.95, 0.3], BACK), lKnee: 0.35, rKnee: 0.4, // swaddled: legs wrapped straight
      lSh: L([0.6, -0.1 + c * 0.2, 0.78], [0, 1, 0]), lEl: -0.9 + c * 0.3, rSh: L([-0.25, -0.5, 0.8], UP), rEl: -2.0,
    };
  },
  // on a bus seat, looking down at a phone in both hands, swaying a little with the road
  busPhone(t, r, o = {}) {
    const p = POSE.phone(t, r, { sit: true }), sw = 0.025 * S(t * 0.9 + r * 4) + 0.012 * S(t * 2.3);
    return { ...p, ...seatLegs({ knee: 1.45, spread: 0.12 }), hipsZ: sw * 0.4, chest: [0.18 + (o.lean ?? 0), 0, sw], neck: [0.3, 0, 0], head: [0.42, 0, -sw] };
  },
});

// the mirror image of a pose: left and right swapped, turns and tilts reversed (for lying on the other side, turning
// the other way). POSE.mirror('curl') returns a pose function.
const LIMBS = ['Sh', 'El', 'Wr', 'Hip', 'Knee', 'Ank'];
const flipLimb = (a) => (a && a.dir ? { ...a, dir: [-a.dir[0], a.dir[1], a.dir[2]], bend: a.bend ? [-a.bend[0], a.bend[1], a.bend[2]] : undefined } : Array.isArray(a) ? [a[0], -(a[1] || 0), -(a[2] || 0)] : a);
export function mirrorPose(P) {
  const Q = { ...P };
  for (const k of LIMBS) { Q['l' + k] = flipLimb(P['r' + k]); Q['r' + k] = flipLimb(P['l' + k]); }
  for (const k of ['waist', 'chest', 'neck', 'head']) if (Array.isArray(P[k])) Q[k] = [P[k][0], -(P[k][1] || 0), -(P[k][2] || 0)];
  Q.hipsY = -(P.hipsY || 0); Q.hipsZ = -(P.hipsZ || 0); Q.dx = -(P.dx || 0);
  return Q;
}
POSE.mirror = (name) => (t, r, o) => mirrorPose(POSE[name](t, r, o));
