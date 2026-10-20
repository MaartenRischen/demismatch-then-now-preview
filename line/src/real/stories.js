// What happens in each topic's ancestors' scene, staged with mannequins. compose() places the camera, the people,
// their poses and the camp's things; R (seeded by the generation) varies every take: how many people, where they
// stand, which way the light falls. The camp sits around the origin and the camera mostly looks towards -z.
// A figure: { kind, pose, x, z, yaw (0 faces +z, PI faces -z), o: pose options, hold: { type, hand }, walk: { speed } }.
// Most stories hold several situations (variants) and R picks one that fits the time of day; ?v=N forces variant N.
import { held, spearAt, diggingStick, spearStuck, handStone, carcass, beast, honeycomb, meat, roots, nutsAnvil, firewood, bag, hole, target, rack, log, flask, baby, boulder, climbTree, cloak, together } from './props-anc.js';

const PI = Math.PI;
const lookAt = (x, z, tx, tz, yaw) => { let a = Math.atan2(tx - x, tz - z) - yaw; while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return Math.max(-1.1, Math.min(1.1, a)); };

// ---------- staging helpers ----------
const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const F = (kind, pose, x, z, yaw, o = {}, more = {}) => ({ kind, pose, x, z, yaw, o, ...more });
// turn a figure's head towards a point
const eye = (f, tx, tz) => { f.o = { ...f.o, lookY: lookAt(f.x, f.z, tx, tz, f.yaw) }; return f; };
// a check hook: ?v=N forces variant N of the story being built (for review sheets)
const FORCE = (() => { try { const v = new URLSearchParams(globalThis.location?.search || '').get('v'); return v === null || v === '' ? null : +v; } catch (e) { return null; } })();
// Which situation a generation gets: a hash of g (salted per story) over the variants that fit the time of day. Each
// story's salt is chosen so that the strip's own picks of that topic spread over all its variants (see the review
// notes); any other g still lands on a variant at random.
const hashG = (g, salt) => { const v = Math.sin(g * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
function pickVariant(list, R, time, g, salt = 0) {
  if (FORCE !== null && list[FORCE]) return list[FORCE];
  const ok = list.filter((v) => !v.times || v.times.includes(time)), from = ok.length ? ok : list;
  return from[Math.floor(hashG(g, salt) * from.length)];
}
// walking speeds that match the stride of each walking pose and the size of each kind of body
const LEG = { man: 0.84, woman: 0.8, old: 0.79, teen: 0.8, child: 0.5, toddler: 0.31 };
const GAIT = { walk: [0.4, 0.9], walkLook: [0.4, 0.9], hurry: [0.5, 1.15], oldWalk: [0.26, 0.6], carryHead: [0.32, 0.75], carryShoulder: [0.3, 0.7], carryArms: [0.32, 0.75], carryBack: [0.34, 0.75], run: [0.62, 1.5] };
const speedOf = (f) => { const [a, s] = GAIT[f.pose] || GAIT.walk, fixed = ['carryHead', 'carryArms', 'carryBack'].includes(f.pose); return LEG[f.kind || 'man'] * 4 * Math.sin(f.o?.stride ?? a) * (fixed ? s : f.o?.speed ?? s) * (f.pose === 'run' ? 1.2 : 1); };
// a moving figure: the spot given is where it is about a second in (half a second for the one with the alarm: the
// engine frames that person by where they start)
function mover(f, t0 = f.alarm ? 0.5 : 1) {
  t0 = t0 ?? (f.alarm ? 0.5 : 1);
  if (!GAIT[f.pose]) f.pose = 'walk';
  if (!['walk', 'walkLook', 'run', 'hurry', 'oldWalk'].includes(f.pose)) f.o = { ...f.o, walk: true };
  const v = speedOf(f); f.walk = { speed: v }; f.x -= Math.sin(f.yaw) * v * t0; f.z -= Math.cos(f.yaw) * v * t0;
  return f;
}
// the camera, dist metres from (tx, tz) at compass angle az (0: on the +z side looking towards -z)
const cam = (tx, tz, dist, az, h = 1.45, ty = 0.8, fov = 34, push = 0.15) => ({ pos: [tx + Math.sin(az) * dist, h, tz + Math.cos(az) * dist], target: [tx, ty, tz], fov, push });
// where the sun is: by default behind the camera or to one side, so the people are lit; 'back' puts it in front
function sunFor(camera, R, mode = 'front') {
  const [px, , pz] = camera.pos, [tx, , tz] = camera.target, v = Math.atan2(tx - px, tz - pz) * 180 / PI;
  if (mode === 'back') return v + R.range(-55, 55);
  if (mode === 'side') return v + R.pick([-1, 1]) * R.range(75, 115);
  return v + 180 + R.range(-80, 80);
}
// shelters and the camp's litter beyond (cx, cz) as seen from the camera, never between it and the people
function dress(R, props, camera, { cx = 0, cz = 0, r = 6, n = 2, hides = 1, spread = 1.1 } = {}) {
  const [px, , pz] = camera.pos, a = Math.atan2(cx - px, cz - pz);
  for (let i = 0; i < n; i++) { const b = a + R.range(-spread, spread), d = r * R.range(0.95, 1.35); props.push({ type: 'shelter', x: cx + Math.sin(b) * d, z: cz + Math.cos(b) * d, o: { size: R.range(0.9, 1.2) } }); }
  for (let i = 0; i < hides; i++) { const b = a + R.range(-1.4, 1.4), d = r * R.range(0.55, 0.8); props.push({ type: 'hide', x: cx + Math.sin(b) * d, z: cz + Math.cos(b) * d, o: { w: R.range(1.1, 1.6), d: R.range(0.8, 1.1), color: R.pick(['#7A5A3C', '#6B4E34', '#8A6A48']) } }); }
}
const fireAt = (x, z, size, time) => ({ type: 'fire', x, z, o: { size, shadows: time !== 'day' } });
const custom = (make, x, z, more = {}) => ({ type: 'custom', make, x, z, ...more });
// things held: held() pins them to the right joint, whichever wrist the engine hangs them on
const hold = (make, spec, hand = 'r') => ({ type: 'custom', hand, make: (R) => held(make(R), spec) });
const both = (...hs) => ({ type: 'custom', hand: 'r', make: (R) => together(...hs.map((h) => h.make(R))) });
const bagM = (R) => bag(R, { size: R.range(0.75, 0.95) }), woodM = (R) => firewood(R, { tied: true, n: 8, len: R.range(0.9, 1.2) });
const HOLD = {
  spear: (len = 2.1) => hold((R) => spearAt(R, { length: len, grip: 0.52 }), { at: 'rWr', frame: 'body', rot: [0.04, 0, 0] }),
  spearCarry: (len = 2.0) => hold((R) => spearAt(R, { length: len, grip: 0.5 }), { at: 'rWr', frame: 'body', rot: [0.5, 0, 0] }),
  throwSpear: (len = 2.0) => hold((R) => spearAt(R, { length: len, grip: 0.45 }), { at: 'rWr', frame: 'body', rot: [1.42, 0, 0] }),
  smallSpear: () => hold((R) => spearAt(R, { length: 1.2, grip: 0.45 }), { at: 'rWr', frame: 'body', rot: [1.3, 0, 0] }),
  spear2: () => hold((R) => spearAt(R, { length: 2.1, grip: 0.3 }), { between: ['rWr', 'lWr'], t: 0.5 }),
  dig: () => hold((R) => diggingStick(R, { grip: 0.75 }), { between: ['lWr', 'rWr'], t: 0 }),
  digKneel: () => hold((R) => diggingStick(R, { grip: 0.6, length: 1.0 }), { between: ['lWr', 'rWr'], t: 0 }),
  head: (make, turn = 0) => hold(make, { at: 'head', pos: [0, 0.25, 0], rot: [0, turn, 0] }),
  babyArms: () => hold((R) => baby(R, { pose: 'curl' }), { at: 'chest', pos: [0, 0.14, 0.21], rot: [0, 0, 1.4] }),
  babyBack: () => hold((R) => baby(R, { pose: 'sit' }), { at: 'chest', pos: [0, 0.27, -0.21] }),
  babyLap: () => hold((R) => baby(R, { pose: 'curl' }), { at: 'hips', pos: [0, 0.12, 0.32], rot: [0, 0, 1.5], frame: 'body' }),
  babyOffer: () => hold((R) => baby(R, { pose: 'curl' }), { between: ['rWr', 'lWr'], t: 0.5 }),
  carcass: () => hold((R) => carcass(R, { mode: 'shoulders', size: 0.8 }), { at: 'chest', pos: [0, 0.42, -0.17] }),
  hand: (make, hand = 'r', pos = [0, -0.01, 0.04]) => hold(make, { at: hand + 'Wr', pos }, hand),
  armful: (make) => hold(make, { at: 'chest', pos: [0, 0.02, 0.3], rot: [0, 0, 0] }),
  cloak: () => hold((R) => cloak(R), { at: 'chest', pos: [0, -0.02, -0.01] }),
};
// sitting people in a ring round (cx, cz), facing in: count n, radius r, over the arc a0..a1 (radians from +z)
function ring(R, cx, cz, r, n, a0, a1, jit = 0.08) {
  const out = []; for (let i = 0; i < n; i++) { const a = n === 1 ? (a0 + a1) / 2 : a0 + (a1 - a0) * (i / (n - 1)) + R.range(-jit, jit), rr = r * R.range(0.95, 1.06), x = cx + Math.sin(a) * rr, z = cz + Math.cos(a) * rr; out.push({ x, z, yaw: yawTo(x, z, cx, cz), a }); } return out;
}
const SIT = ['sitCross', 'sitKnees', 'sitKnees', 'sitCross'];
// no one already standing within d of (x, z)
const clearOf = (figures, x, z, d = 0.7) => figures.every((f) => Math.hypot(f.x - x, f.z - z) >= d);
const anyAdult = (R) => R.pick(['man', 'woman', 'woman', 'man', 'old', 'teen']);
// the last touches every story shares: grass cleared round the still people, walkers set going, the light, the camera
// line kept free of trees
function finish(S, c) {
  const { R } = c;
  S.props = S.props || [];
  for (const f of S.figures) { if (f.move) mover(f, f.t0); delete f.move; delete f.t0; }
  S.figClear = (S.figClear || []).concat(S.figures.filter((f) => !f.walk).map((f) => [f.x, f.z, f.kind === 'child' || f.kind === 'toddler' ? 0.55 : 0.85, 1.2]));
  if (S.sunAz === undefined) S.sunAz = sunFor(S.camera, R, S.light);
  if (!S.focus) S.focus = { x: S.camera.target[0], z: S.camera.target[2] };
  for (const p of S.props) if (p.behind) {
    const [px, , pz] = S.camera.pos, cx = p.cx ?? S.focus.x, cz = p.cz ?? S.focus.z, a = Math.atan2(cx - px, cz - pz) + R.pick([-1, 1]) * R.range(0.4, 0.75);
    let d = p.behind; const at = () => [cx + Math.sin(a) * d, cz + Math.cos(a) * d];
    for (let k = 0; k < 12 && S.figures.some((f) => Math.hypot(f.x - at()[0], f.z - at()[1]) < 1.0); k++) d += 0.3;
    [p.x, p.z] = at(); delete p.behind;
  }
  const [px, , pz] = S.camera.pos, [tx, , tz] = S.camera.target, dl = Math.hypot(tx - px, tz - pz);
  S.keepOut = (S.keepOut || []).concat([[px, pz, 3.5], [(px + tx) / 2, (pz + tz) / 2, dl / 2 + 1.5]]);
  globalThis.__variant = S.variant; // which situation was staged, for review sheets
  return S;
}
const story = (times, variants, more = {}) => ({ times, variants, ...more, compose(c) { const v = pickVariant(variants, c.R, c.time, c.g, this.salt), S = v.make(c); S.variant = v.name; return finish(S, c); } });

// ---------- the stories ----------
export const STORIES = {
  // For 300,000 years, strangers were rare: people nobody knows walk in from far off, and the whole camp stops
  strangers: {
    times: ['day', 'day', 'dusk'],
    compose({ R }) {
      const far = R.range(18, 30), sx = R.range(-6, 6), n = 2 + Math.floor(R() * 3), figures = [], props = [];
      const toward = (x, z) => Math.atan2(sx - x, -far - z);
      // the strangers, small, walking in
      for (let i = 0; i < n; i++) figures.push({ kind: R() < 0.7 ? 'man' : 'woman', pose: 'walk', x: sx + (i - n / 2) * R.range(0.9, 1.6), z: -far - i * R.range(0.5, 2), yaw: R.range(-0.1, 0.1), walk: { speed: 0.8 }, hold: R() < 0.6 ? { type: 'spear', hand: 'r', o: { length: 2.0 }, rot: [0.15, 0, 0] } : null, o: { speed: 0.8, rEl: -1.1 } });
      // a mother with a child pulled against her legs, nearest the camera
      const mx = R.range(-2.2, -0.6), mz = R.range(2.6, 3.6), my = toward(mx, mz);
      figures.push({ kind: 'woman', pose: 'guard', x: mx, z: mz, yaw: my });
      figures.push({ kind: R() < 0.5 ? 'child' : 'toddler', pose: 'stand', x: mx + Math.cos(my) * 0.32 + Math.sin(my) * 0.05, z: mz - Math.sin(my) * 0.32 + Math.cos(my) * 0.05, yaw: my + 0.3, o: { lookY: -0.3 } });
      // men who have stood up, one with a spear, one shading his eyes
      const ax = R.range(0.6, 2.0), az = R.range(0.8, 2.0);
      figures.push({ kind: 'man', pose: 'spear', x: ax, z: az, yaw: toward(ax, az), hold: { type: 'spear', hand: 'r', o: { length: 2.1 }, rot: [0, 0, 0] } });
      const bx = ax + R.range(1.2, 2.2), bz = az + R.range(-1.2, 0.8);
      figures.push({ kind: R() < 0.8 ? 'man' : 'woman', pose: R() < 0.6 ? 'shade' : 'armsCrossed', x: bx, z: bz, yaw: toward(bx, bz) });
      // by the fire, people who looked up from what they were doing
      const fx = R.range(2.2, 3.8), fz = R.range(4.2, 5.4);
      props.push({ type: 'fire', x: fx, z: fz, o: { size: 0.8, shadows: false } });
      for (let i = 0, k = 1 + Math.floor(R() * 3); i < k; i++) {
        const a = PI * 0.9 + i * 0.9 + R() * 0.3, x = fx + Math.cos(a) * 1.0, z = fz + Math.sin(a) * 1.0, yaw = Math.atan2(fx - x, fz - z);
        figures.push({ kind: R.pick(['man', 'woman', 'old', 'teen']), pose: R() < 0.5 ? 'sitKnees' : 'sitCross', x, z, yaw, o: { lookY: lookAt(x, z, sx, -far, yaw), headDown: -0.05 } });
      }
      // the camp's things
      props.push({ type: 'shelter', x: R.range(-7, -5), z: R.range(6, 9), o: { size: R.range(0.9, 1.2) } }, { type: 'shelter', x: R.range(5.5, 8), z: R.range(7, 10), o: { size: R.range(0.9, 1.1) } });
      props.push({ type: 'hide', x: mx + 1.2, z: mz + 1.8, o: { w: 1.5, d: 1.1 } }, { type: 'bowl', x: fx - 0.9, z: fz + 0.6 }, { type: 'stones', x: ax + 0.4, z: az + 1.2, seed: 3 }, { type: 'stick', x: mx + 0.9, z: mz + 1.4, yaw: 0.8, lean: PI / 2 });
      const cx = R.range(-1.2, 1.6), cz = R.range(7.0, 8.2);
      return {
        figures, props, focus: { x: mx, z: mz },
        camera: { pos: [cx, R.range(1.25, 1.55), cz], target: [sx * 0.5, 0.75, -far * 0.5], fov: R.range(28, 34), push: 0.18 },
        clear: [[1.5, 4.5, 6.5, 3]], keepOut: [[sx, -far * 0.5, far * 0.55]],
        sunAz: R.range(100, 260),
      };
    },
  },

  // For 300,000 years, being left out could kill you: the band close together, one person apart at the edge
  leftout: story(['day', 'dusk', 'dusk', 'night'], [
    { name: 'circle', times: ['day', 'dusk', 'night'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, R.range(0.6, 0.8), time)], side = R() < 0.5 ? 1 : -1, ao = side * PI / 2 + R.range(-0.5, 0.5);
      // the band, shoulder to shoulder round the fire on the side away from the one left out
      const n = 5 + Math.floor(R() * 4), r = R.range(1.25, 1.45), half = Math.min(2.4, (n - 1) * 0.56 / r / 2);
      ring(R, 0, 0, r, n, ao + PI - half, ao + PI + half, 0.04).forEach((p, i) => {
        const kind = i === 2 && R() < 0.5 ? 'child' : anyAdult(R), f = F(kind, R.pick(SIT), p.x, p.z, p.yaw, { lookY: R.range(-0.35, 0.35) });
        if (i > 0 && R() < 0.3) { f.pose = 'leanOn'; f.o = { side: 1 }; } else if (i > 0 && R() < 0.2) { f.pose = 'armRound'; }
        figures.push(f);
      });
      // the one left out
      const d = time === 'night' ? R.range(2.9, 3.4) : R.range(3.6, 5.0), ox = Math.sin(ao) * d, oz = Math.cos(ao) * d, oy = yawTo(ox, oz, 0, 0) + R.range(-0.5, 0.5);
      figures.push(eye(F(R.pick(['man', 'woman', 'teen', 'old']), R.pick(['sitHug', 'sitHug', 'standApart', 'sitKnees']), ox, oz, oy, { headDown: 0.12 }, { alarm: true }), 0, 0));
      // the camera: side on to the gap, or behind the band looking out at the one alone
      const mx = ox * 0.45, mz = oz * 0.45, k = time === 'night' ? 0 : R(); // at night never across the fire: its glare would hide the one alone
      const camera = k < 0.55 ? cam(mx, mz, R.range(5.5, 7.0), ao + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.3, 0.3), R.range(1.0, 1.25), 0.6, R.range(34, 38))
        : cam(0, 0, R.range(3.6, 4.6), ao + PI + R.range(-0.35, 0.35), R.range(1.3, 1.6), 0.55, R.range(30, 36));
      if (k >= 0.55) camera.target = [ox * 0.8, 0.6, oz * 0.8];
      // the shelters behind the band, never between the camera and the one alone
      for (const sd of [-1, 1]) { const a = ao + PI + sd * R.range(0.8, 1.1), r = R.range(5.0, 6.0); props.push({ type: 'shelter', x: Math.sin(a) * r, z: Math.cos(a) * r, o: { size: R.range(0.9, 1.2) } }); }
      props.push({ type: 'bowl', x: Math.sin(ao + PI) * 0.75, z: Math.cos(ao + PI) * 0.75 });
      return { figures, props, camera, focus: { x: k < 0.55 ? mx : ox * 0.6, z: k < 0.55 ? mz : oz * 0.6 }, clear: [[0, 0, 3.5, 2], [ox, oz, 1.2, 1.5]] };
    } },
    { name: 'left behind', times: ['day', 'dusk', 'morning'], make({ R }) {
      const figures = [], props = [], dir = PI + R.range(-0.35, 0.35), bx = R.range(-1, 1), bz = -R.range(12, 15);
      // the band walking off with everything they own
      const n = 5 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const kind = R.pick(['man', 'woman', 'woman', 'teen', 'child', 'man', 'old']), f = F(kind, 'walk', bx + R.range(-2.2, 2.2), bz - i * R.range(0.5, 1.0), dir + R.range(-0.06, 0.06), { speed: 0.85 }, { move: true });
        if (kind === 'woman' && R() < 0.7) { f.pose = 'carryHead'; f.hold = R() < 0.4 ? both(HOLD.head(R() < 0.5 ? bagM : woodM, PI / 2), HOLD.babyBack()) : HOLD.head(R() < 0.5 ? bagM : woodM, PI / 2); }
        else if (kind === 'man') f.hold = HOLD.spearCarry();
        figures.push(f);
      }
      // the one behind, hurrying to catch up
      const sx = bx + R.range(-1.4, 1.4), sz = R.range(-1.5, 0.5);
      figures.push(F(R.pick(['man', 'woman', 'teen', 'old']), 'hurry', sx, sz, dir + R.range(-0.08, 0.08), { lookY: 0, speed: 0.95 }, { alarm: true, move: true }));
      const camera = { pos: [sx + R.range(-1.8, 1.8), R.range(1.35, 1.65), sz + R.range(3.6, 5.0)], target: [bx, 1.0, bz * 0.55], fov: R.range(32, 38), push: 0.12 };
      props.push({ type: 'fire', x: sx + R.range(1.5, 2.5) * (R() < 0.5 ? 1 : -1), z: sz + 1.5, o: { size: 0.35, shadows: false } }); // the old camp's fire, nearly out
      return { figures, props, camera, focus: { x: sx, z: sz - 2 }, clear: [[sx, sz + 1, 3, 2]] };
    } },
    { name: 'on the rock', times: ['dusk', 'day'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.7, time)];
      // the camp, people together by the fire
      ring(R, 0, 0, 1.35, 4 + Math.floor(R() * 3), R.range(-0.4, 0.2), R.range(3.2, 4.2), 0.1).forEach((p) => figures.push(F(anyAdult(R), R.pick(SIT), p.x, p.z, p.yaw, { lookY: R.range(-0.4, 0.4) })));
      // one alone on a boulder above, looking down at them
      const a = R.range(-0.9, 0.9) + (R() < 0.5 ? PI / 2 : -PI / 2), d = R.range(5.0, 6.5), rx = Math.sin(a) * d, rz = Math.cos(a) * d, h = R.range(0.9, 1.25);
      props.push(custom((R) => boulder(R, { h, r: 0.95 }), rx, rz, { yaw: R() * 6 }));
      const oy = yawTo(rx, rz, 0, 0) + R.range(-0.35, 0.35);
      figures.push(eye(F(R.pick(['man', 'teen', 'woman']), 'on', rx, rz, oy, { base: R.pick(['sitHug', 'sitKnees']), lift: h - 0.04, headDown: 0.2 }, { alarm: true }), 0, 0));
      // camera low behind and beside the rock, looking past the one alone to the camp
      const camera = cam(rx * 0.55, rz * 0.55, R.range(7.5, 9), a + R.range(0.75, 1.05) * (R() < 0.5 ? 1 : -1), R.range(1.2, 1.5), 1.2, R.range(34, 38));
      dress(R, props, camera, { r: 5, n: 2, hides: 1 });
      return { figures, props, camera, focus: { x: rx * 0.6, z: rz * 0.6 }, clear: [[0, 0, 3.5, 2]], keepOut: [[rx, rz, 2.5]], light: time === 'dusk' ? 'side' : 'front' };
    } },
    { name: 'awake apart', times: ['night'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, R.range(0.5, 0.7), time)];
      // the others asleep together round the fire
      ring(R, 0, 0, R.range(1.7, 2.0), 4 + Math.floor(R() * 2), R.range(1.5, 2.2), R.range(4.6, 5.4), 0.1).forEach((p) => { figures.push(F(anyAdult(R), 'lie', p.x, p.z, p.yaw)); props.push({ type: 'hide', x: p.x - Math.cos(p.yaw) * 0.4, z: p.z + Math.sin(p.yaw) * 0.4, o: { w: 1.7, d: 0.9 } }); });
      // one lying apart in the dark, awake, head up towards them
      const a = R.range(-0.4, 0.5), d = R.range(4.0, 5.0), x = Math.sin(a) * d, z = Math.cos(a) * d, y = yawTo(x, z, 0, 0) + R.range(-0.4, 0.4);
      figures.push(eye(F(R.pick(['man', 'woman', 'teen']), R.pick(['liePropped', 'liePropped', 'lieBack']), x, z, y, { hands: 'head' }, { alarm: true }), 0, 0));
      props.push({ type: 'hide', x: x - Math.cos(y) * 0.4, z: z + Math.sin(y) * 0.4, o: { w: 1.6, d: 0.9 } });
      const away = Math.atan2(x, z) + R.pick([-1, 1]) * R.range(0.85, 1.1), camera = { pos: [x + Math.sin(away) * 2.5, R.range(1.4, 1.6), z + Math.cos(away) * 2.5], target: [x * 0.55, 0.25, z * 0.55], fov: R.range(38, 40), push: 0.05 };
      dress(R, props, camera, { r: 4.5, n: 1, hides: 0 });
      return { figures, props, camera, focus: { x: x * 0.7, z: z * 0.7 }, clear: [[0, 0, 3.5, 2], [x, z, 1.5, 1.5]] };
    } },
    { name: 'turned away', times: ['day', 'dusk'], make({ R }) {
      const figures = [], props = [];
      // a knot of people standing talking, their backs to one who stands a few steps off
      const n = 4 + Math.floor(R() * 3), cx = R.range(-0.6, 0.6), cz = R.range(-0.6, 0.6);
      ring(R, cx, cz, R.range(0.75, 0.95), n, 0, PI * 2 * (1 - 1 / n), 0.15).forEach((p, i) => figures.push(F(R.pick(['man', 'woman', 'woman', 'teen']), R.pick(['talk', 'stand', 'armsCrossed', 'handsHips', 'stand']), p.x, p.z, p.yaw + R.range(-0.3, 0.3), { lookY: R.range(-0.5, 0.5) })));
      const a = R.range(0, PI * 2), d = R.range(3.2, 4.2), ox = cx + Math.sin(a) * d, oz = cz + Math.cos(a) * d, oy = yawTo(ox, oz, cx, cz);
      figures.push(F(R.pick(['woman', 'man', 'teen']), 'standApart', ox, oz, oy, { lookY: R.range(-0.15, 0.15), headDown: 0.25 }, { alarm: true }));
      const camera = cam((cx + ox) / 2, (cz + oz) / 2, R.range(6.5, 8.0), a + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.35, 0.35), R.range(1.35, 1.6), 0.85, R.range(32, 38));
      dress(R, props, camera, { cx, cz, r: 6, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[cx, cz, 3, 2], [ox, oz, 1, 1.5]] };
    } },
  ], { salt: 4 }),

  // For 300,000 years, someone was always awake at night: the camp asleep round a low fire, one or two awake
  night: story(['night'], [
    { name: 'tending the fire', make: (c) => nightCamp(c, 'fire') },
    { name: 'holding the baby', make: (c) => nightCamp(c, 'baby') },
    { name: 'watching the dark', make: (c) => nightCamp(c, 'watch') },
    { name: 'lying awake', make: (c) => nightCamp(c, 'awake') },
    { name: 'two talking', make: (c) => nightCamp(c, 'two') },
    { name: 'old one up', make: (c) => nightCamp(c, 'old') },
  ], { salt: 753 }),

  // For 300,000 years, teenage body clocks ran late: teenagers up by the dying fire; in the morning, still asleep
  teens: story(['night', 'night', 'morning', 'morning'], [
    { name: 'late by the embers', times: ['night'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, R.range(0.35, 0.5), time)];
      const n = 2 + Math.floor(R() * 3), a0 = R.range(-0.6, 0.6);
      ring(R, 0, 0, R.range(0.95, 1.15), n, a0 - 0.55 * (n - 1) / 2, a0 + 0.55 * (n - 1) / 2, 0.05).forEach((p, i) => {
        const f = F('teen', R.pick(['sitKnees', 'sitCross', 'sitHug', 'listen']), p.x, p.z, p.yaw + R.range(-0.4, 0.4), {});
        if (i === 0 && R() < 0.5) f.pose = 'feedFire';
        figures.push(eye(f, i ? figures[figures.length - 1].x : 0, i ? figures[figures.length - 1].z : 0));
      });
      if (n > 2 && R() < 0.5) figures[1].pose = 'liePropped';
      // the grown-ups asleep further back, at the edge of the light
      const ss = R.pick([-1, 1]); ring(R, 0, 0, R.range(2.2, 2.7), 3 + Math.floor(R() * 2), a0 + ss * 1.3, a0 + ss * 2.6, 0.12).forEach((p) => { figures.push(F(R.pick(['man', 'woman', 'old', 'child']), 'lie', p.x, p.z, p.yaw + R.range(-0.4, 0.4))); props.push({ type: 'hide', x: p.x - Math.cos(p.yaw) * 0.4, z: p.z + Math.sin(p.yaw) * 0.4, o: { w: 1.7, d: 0.9 } }); });
      const camera = cam(Math.sin(a0 + ss * 0.9) * 1.0, Math.cos(a0 + ss * 0.9) * 1.0, R.range(3.8, 4.6), a0 - ss * R.range(0.7, 1.1), R.range(1.0, 1.3), 0.4, R.range(36, 40));
      dress(R, props, camera, { r: 4.5, n: 1, hides: 0 });
      return { figures, props, camera, focus: { x: Math.sin(a0) * 1, z: Math.cos(a0) * 1 }, clear: [[0, 0, 4, 2]] };
    } },
    { name: 'awake among the sleepers', times: ['night'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, R.range(0.3, 0.42), time)], wa = R.range(0, 6.28);
      // the family asleep in a ring round the last of the fire
      const spots = ring(R, 0, 0, R.range(1.6, 1.9), 5 + Math.floor(R() * 2), wa + 0.7, wa + PI * 2 - 0.7, 0.1);
      spots.forEach((p) => { figures.push(F(R.pick(['man', 'woman', 'old', 'child']), 'lie', p.x, p.z, p.yaw + R.range(-0.2, 0.2))); props.push({ type: 'hide', x: p.x - Math.cos(p.yaw) * 0.45, z: p.z + Math.sin(p.yaw) * 0.45, o: { w: 1.8, d: 1.0 } }); });
      // two teenagers still up on the open side, propped on an elbow or sitting, heads together
      const ax = Math.sin(wa) * 1.5, az = Math.cos(wa) * 1.5, ay = yawTo(ax, az, 0, 0), px = Math.cos(ay) * 0.45, pz = -Math.sin(ay) * 0.45;
      figures.push(F('teen', R.pick(['liePropped', 'sitKnees']), ax + px, az + pz, ay - 0.5, { lookY: -0.7 }), F('teen', R.pick(['sitHug', 'sitCross', 'listen']), ax - px, az - pz, ay + 0.5, { lookY: 0.6 }));
      const camera = cam(ax * 0.8, az * 0.8, R.range(2.8, 3.4), Math.atan2(-ax, -az) + R.pick([-1, 1]) * R.range(1.5, 1.9), R.range(1.0, 1.25), 0.4, R.range(36, 40));
      dress(R, props, camera, { r: 4.0, n: 1, hides: 0 });
      return { figures, props, camera, focus: { x: ax, z: az }, clear: [[0, 0, 4, 2]] };
    } },
    { name: 'still asleep', times: ['morning'], make({ R, time }) {
      const figures = [], props = [fireAt(R.range(1.5, 2.5), R.range(-2.5, -1.5), 0.4, time)];
      // the teenager asleep on a hide in the foreground
      const tx = R.range(-0.8, 0.8), tz = R.range(1.5, 2.5), ty = R.range(-0.8, 0.8) + (R() < 0.5 ? 0 : PI);
      figures.push(F('teen', 'lie', tx, tz, ty)); props.push({ type: 'hide', x: tx - Math.cos(ty) * 0.4, z: tz + Math.sin(ty) * 0.4, o: { w: 1.8, d: 1.0 } });
      // the camp up and at work around them
      const jobs = R() < 0.5 ? ['scrape', 'walkSpear', 'digWalk', 'feedFire'] : ['walkSpear', 'carryWood', 'scrape', 'stand'];
      jobs.forEach((j, i) => {
        const a = -1.6 + i * 1.05 + R.range(-0.2, 0.2), d = R.range(3.2, 5.5), x = Math.sin(a) * d, z = Math.cos(a) * d - 1.5;
        if (!clearOf(figures, x, z, 1.0)) return;
        if (j === 'scrape') { figures.push(F('woman', 'scrape', x, z, R.range(0, 6.28))); props.push({ type: 'hide', x: x + 0.1, z: z + 0.5, o: { w: 1.4, d: 1.0 } }); }
        else if (j === 'walkSpear') figures.push(F('man', 'walk', x, z, R.range(-2.6, -0.5) * (R() < 0.5 ? 1 : -1), { speed: 0.85 }, { move: true, hold: HOLD.spearCarry() }));
        else if (j === 'digWalk') figures.push(F('woman', 'walk', x, z, R.range(1.8, 2.8) * (R() < 0.5 ? 1 : -1), { speed: 0.8 }, { move: true, hold: HOLD.babyBack() }));
        else if (j === 'carryWood') figures.push(F('woman', 'carryHead', x, z, R.range(-2.5, 2.5), {}, { move: true, hold: HOLD.head(woodM, PI / 2) }));
        else if (j === 'feedFire') { const p = props[0]; figures.push(F(R.pick(['old', 'woman']), 'feedFire', p.x - 0.8, p.z + 0.3, yawTo(p.x - 0.8, p.z + 0.3, p.x, p.z))); }
        else figures.push(eye(F(R.pick(['old', 'man']), 'handsHips', x, z, yawTo(x, z, tx, tz)), tx, tz));
      });
      { const cx = tx + R.range(0.9, 1.3), cz = tz - R.range(0.3, 0.8); if (R() < 0.4 && clearOf(figures, cx, cz)) figures.push(eye(F('child', 'stand', cx, cz, yawTo(cx, cz, tx, tz), { headDown: 0.4 }), tx, tz)); }
      const camera = cam(tx, tz - 1.0, R.range(4.5, 6.0), R.range(-0.5, 0.5), R.range(1.0, 1.35), 0.4, R.range(34, 40));
      camera.target = [tx * 0.5, 0.55, tz - 2.5];
      dress(R, props, camera, { cx: 0, cz: -2, r: 6, n: 2, hides: 0 });
      return { figures, props, camera, focus: { x: tx, z: tz }, clear: [[0, 0, 5, 2.5]], light: R() < 0.5 ? 'side' : 'front' };
    } },
    { name: 'stood over', times: ['morning'], make({ R, time }) {
      const figures = [], props = [];
      const tx = R.range(-0.5, 0.5), tz = R.range(-0.5, 0.5), ty = R.range(0, 6.28);
      figures.push(F('teen', 'lie', tx, tz, ty)); props.push({ type: 'hide', x: tx - Math.cos(ty) * 0.4, z: tz + Math.sin(ty) * 0.4, o: { w: 1.8, d: 1.0 } });
      if (R() < 0.5) { figures.push(F('teen', 'lie', tx + Math.sin(ty) * 1.0, tz + Math.cos(ty) * 1.0, ty + R.range(-0.4, 0.4))); }
      // a grown-up standing over them, others already leaving for the day
      const sa = ty + PI + R.range(-0.6, 0.6), sx = tx + Math.sin(sa) * 1.3, sz = tz + Math.cos(sa) * 1.3;
      figures.push(F(R.pick(['woman', 'man', 'old']), R.pick(['handsHips', 'armsCrossed']), sx, sz, yawTo(sx, sz, tx, tz), { headDown: 0.45, lookY: 0 }));
      for (let i = 0, k = 2 + Math.floor(R() * 2); i < k; i++) { const x = R.range(-5, 5), z = -R.range(4, 7), f = F(R.pick(['man', 'woman', 'child']), 'walk', x, z, PI + R.range(-0.4, 0.4), { speed: 0.8 }, { move: true }); if (f.kind === 'man') f.hold = HOLD.spearCarry(); else if (f.kind === 'woman') f.hold = HOLD.dig(); figures.push(f); }
      props.push({ type: 'fire', x: tx + R.range(1.5, 2.2), z: tz - 1.5, o: { size: 0.3, shadows: false } });
      const camera = cam(tx, tz, R.range(4.0, 5.2), sa + R.range(1.2, 1.8) * (R() < 0.5 ? 1 : -1), R.range(1.2, 1.5), 0.5, R.range(34, 38));
      dress(R, props, camera, { cx: tx, cz: tz, r: 4.5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[tx, tz, 3, 2]], light: 'side' };
    } },
  ], { salt: 10 }),

  // For 300,000 years, children spent the day moving: running, climbing, chasing, throwing, digging, wrestling
  restless: story(['day', 'day', 'morning'], [
    { name: 'running pack', make({ R }) {
      const figures = [], props = [], ca = R.range(0, 6.28), camera = cam(0, 0, R.range(6.0, 7.0), ca, R.range(0.95, 1.2), 0.6, R.range(36, 40), 0.03);
      // the pack runs at the camera on a slant: the given spots are where they are about 2.6 s in
      const dir = ca + R.pick([-1, 1]) * R.range(0.35, 0.6), n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const back = i * R.range(0.6, 1.0), side = R.range(-1.0, 1.0); figures.push(F(R.pick(['child', 'child', 'teen', 'child']), 'run', -Math.sin(dir) * back + Math.cos(dir) * side, -Math.cos(dir) * back - Math.sin(dir) * side, dir + R.range(-0.1, 0.1), { speed: R.range(1.15, 1.35), lookY: R.range(-0.4, 0.4) }, { move: true, t0: 2.6 })); }
      if (R() < 0.6) figures.push(F('toddler', 'run', -Math.sin(dir) * (n * 0.8 + 0.6), -Math.cos(dir) * (n * 0.8 + 0.6), dir, { speed: 1.5 }, { move: true, t0: 2.6 }));
      // grown-ups in the camp behind, getting on with things
      const ax = -Math.sin(ca) * R.range(4, 6) + Math.cos(ca) * R.range(-2, 2), az = -Math.cos(ca) * R.range(4, 6);
      figures.push(F('woman', R.pick(['sitWork', 'scrape']), ax, az, R.range(-0.8, 0.8)));
      if (R() < 0.6) figures.push(eye(F(R.pick(['old', 'man']), R.pick(['sitKnees', 'stand']), ax + R.range(1.2, 2.0), az - 0.6, R.range(-0.6, 0.6)), 0, 0));
      dress(R, props, camera, { cx: ax, cz: az, r: 3, n: 2, hides: 1 });
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 6, 3], [ax, az, 3, 2]] };
    } },
    { name: 'climbing', make({ R }) {
      const figures = [], props = [], ty = R.range(-0.5, 0.5) + (R() < 0.5 ? 0 : PI), tx = R.range(-0.5, 0.5), tz = R.range(-1.0, 0), by = R.range(1.65, 1.85);
      props.push(custom((R) => climbTree(R, { branchY: by }), tx, tz, { yaw: ty }));
      const at = (u, w = 0) => [tx + Math.cos(ty) * u + Math.sin(ty) * w, tz - Math.sin(ty) * u + Math.cos(ty) * w];
      // one hanging from the long branch, one climbing the trunk, others below
      const [hx, hz] = at(R.range(1.0, 1.4)); figures.push(F('child', 'on', hx, hz, ty + (R() < 0.5 ? 0 : PI), { base: 'hang', lift: by - 1.32 }));
      const [cx, cz] = at(0.0, 0.34); figures.push(F('child', 'on', cx, cz, ty + PI, { base: 'climb', lift: R.range(0.25, 0.5) }));
      const [px, pz] = at(R.range(0.6, 1.2), R.range(1.2, 1.7)); figures.push(F(R.pick(['child', 'toddler']), R.pick(['armsUp', 'point', 'stand']), px, pz, yawTo(px, pz, hx, hz), { up: 0.9, lookY: 0 }));
      if (R() < 0.7) { const [rx, rz] = at(R.range(2.5, 3.5), R.range(1.5, 3.0)); figures.push(F('child', 'run', rx, rz, yawTo(rx, rz, tx, tz), { speed: 1.4 }, { move: true })); }
      const camera = cam(tx, tz, R.range(5.5, 7.0), ty + R.range(-0.5, 0.5), R.range(1.2, 1.5), 1.1, R.range(34, 40), 0.08);
      camera.target = [(tx + hx) / 2, 1.0, (tz + hz) / 2];
      return { figures, props, camera, focus: { x: hx, z: hz }, clear: [[tx, tz, 3, 2]] };
    } },
    { name: 'chasing', make({ R }) {
      const figures = [], props = [], ca = R.range(0, 6.28), camera = cam(0, 0, R.range(5.5, 6.5), ca, R.range(0.95, 1.2), 0.55, R.range(36, 40), 0.03);
      const dir = ca + R.pick([-1, 1]) * R.range(0.5, 0.8);
      figures.push(F('child', 'run', 0, 0, dir, { speed: 1.35, lookY: R.pick([-1, 1]) * 0.9 }, { move: true, t0: 2.5 }));
      figures.push(F(R.pick(['child', 'teen']), 'run', -Math.sin(dir) * 1.3, -Math.cos(dir) * 1.3, dir + R.range(-0.1, 0.1), { speed: 1.3 }, { move: true, t0: 2.5 }));
      if (R() < 0.6) figures.push(F('child', 'run', -Math.sin(dir) * 2.6 + Math.cos(dir) * R.range(-0.8, 0.8), -Math.cos(dir) * 2.6, dir + R.range(-0.25, 0.25), { speed: 1.3 }, { move: true, t0: 2.5 }));
      const ax = -Math.sin(ca) * R.range(3.5, 5) + Math.cos(ca) * R.range(-2, 2), az = -Math.cos(ca) * R.range(3.5, 5);
      figures.push(F('woman', 'dig', ax, az, R.range(-1, 1), {}, { hold: HOLD.digKneel() })); props.push(custom((R) => roots(R, { n: 4 }), ax + 0.7, az + 0.4));
      dress(R, props, camera, { cx: ax, cz: az, r: 3, n: 2, hides: 1 });
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 5, 3]] };
    } },
    { name: 'throwing spears', make({ R }) {
      const figures = [], props = [], tx = R.range(-1, 1), tz = -R.range(4.5, 5.5);
      props.push(custom((R) => target(R, { misses: 2 + Math.floor(R() * 2) }), tx, tz, { yaw: R.range(-0.3, 0.3) }));
      // the children in a loose line where they throw from, the target ahead of them
      const n = 2 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) {
        const x = tx + (i - (n - 1) / 2) * R.range(1.0, 1.3), z = R.range(0.4, 0.9), f = F(R.pick(['child', 'teen', 'child']), i === 0 ? 'throwSmall' : R.pick(['throwSmall', 'stand', 'handsHips']), x, z, yawTo(x, z, tx, tz), {}, {});
        if (f.pose === 'throwSmall') f.hold = HOLD.smallSpear(); else eye(f, tx, tz);
        figures.push(f);
      }
      // one running out to fetch a spear
      figures.push(F('child', 'run', tx + R.range(-1.0, 1.0), -0.8, PI + R.range(-0.3, 0.3), { speed: 1.2 }, { move: true, t0: 0.3 }));
      const sd = R.pick([-1, 1]), camera = { pos: [tx + sd * R.range(2.2, 3.0), R.range(1.0, 1.25), R.range(3.6, 4.4)], target: [tx - sd * 0.3, 0.75, -1.4], fov: R.range(36, 40), push: 0.04 };
      dress(R, props, camera, { cx: tx, cz: tz, r: 4, n: 1, hides: 0 });
      return { figures, props, camera, focus: { x: tx, z: 0.5 }, clear: [[tx, -1.5, 4, 2]] };
    } },
    { name: 'digging alongside', make({ R }) {
      const figures = [], props = [], ax = R.range(-0.6, 0.6), az = R.range(-0.6, 0.6), ay = R.range(-0.6, 0.6) + PI;
      figures.push(F('woman', 'digStand', ax, az, ay, {}, { hold: HOLD.dig() })); props.push(custom((R) => hole(R, { r: 0.3 }), ax + Math.sin(ay) * 0.7, az + Math.cos(ay) * 0.7, { yaw: ay }));
      const cx = ax + Math.sin(ay) * 1.3 + Math.cos(ay) * 0.6, cz = az + Math.cos(ay) * 1.3 - Math.sin(ay) * 0.6;
      figures.push(F('child', 'dig', cx, cz, ay + PI - 0.4, {}, { hold: HOLD.digKneel() }));
      props.push(custom((R) => roots(R, { n: 5 }), ax - Math.cos(ay) * 0.9, az + Math.sin(ay) * 0.9), custom((R) => bag(R, { size: 0.8 }), ax - Math.cos(ay) * 1.3, az + Math.sin(ay) * 1.1));
      // and the others, who can't keep still
      const dir = R.range(0, 6.28); figures.push(F('child', 'run', ax + R.range(-2, 2), az + R.range(1.5, 2.5), dir, { speed: 1.5 }, { move: true }));
      if (R() < 0.6) figures.push(F('toddler', 'run', ax + R.range(-2, 2), az + R.range(2, 3), dir + R.range(-0.6, 0.6), { speed: 1.6 }, { move: true }));
      const camera = cam(ax + Math.sin(ay) * 0.6, az + Math.cos(ay) * 0.6, R.range(4.0, 5.0), ay + R.pick([-1, 1]) * R.range(1.3, 1.6), R.range(1.1, 1.35), 0.55, R.range(36, 40));
      return { figures, props, camera, clear: [[ax, az, 3, 2]] };
    } },
    { name: 'wrestling', make({ R }) {
      const figures = [], props = [], wx = R.range(-0.5, 0.5), wz = R.range(-0.5, 0.5), wy = R.range(0, 6.28);
      const camera = cam(wx, wz, R.range(3.8, 4.8), wy + PI / 2 + R.range(-0.4, 0.4), R.range(0.95, 1.2), 0.45, R.range(36, 40));
      figures.push(F('child', 'wrestle', wx, wz, wy), F(R.pick(['child', 'teen']), 'wrestle', wx + Math.sin(wy) * 0.62, wz + Math.cos(wy) * 0.62, wy + PI));
      const far = Math.atan2(wx - camera.pos[0], wz - camera.pos[2]), n = 1 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const a = far + R.range(-1.0, 1.0), d = R.range(1.5, 2.3), x = wx + Math.sin(a) * d, z = wz + Math.cos(a) * d; if (!clearOf(figures, x, z)) continue; figures.push(eye(F(R.pick(['child', 'child', 'toddler']), R.pick(['armsUp', 'stand', 'handsHips', 'crouch']), x, z, yawTo(x, z, wx, wz)), wx, wz)); }
      dress(R, props, camera, { cx: wx, cz: wz, r: 5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[wx, wz, 3, 2]] };
    } },
  ], { salt: 16 }),

  // For 300,000 years, nobody exercised: the day's work was the movement
  effort: story(['day', 'day', 'morning', 'dusk'], [
    { name: 'loads home', make({ R }) {
      const figures = [], props = [], dir = R.range(-0.6, 0.6), n = 2 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) {
        const x = R.range(-0.5, 0.5) - Math.sin(dir) * i * 1.4 + (i % 2 ? 0.4 : -0.4), z = -Math.cos(dir) * i * 1.4, load = R() < 0.5 ? bagM : woodM;
        figures.push(F(R.pick(['woman', 'woman', 'teen', 'old']), 'carryHead', x, z, dir + R.range(-0.05, 0.05), {}, { move: true, hold: i === 1 && R() < 0.6 ? both(HOLD.head(load, PI / 2), HOLD.babyBack()) : HOLD.head(load, PI / 2) }));
      }
      if (R() < 0.6) figures.push(F('child', 'walk', R.range(0.8, 1.3), -0.8, dir, { speed: 1.2 }, { move: true }));
      const camera = cam(0, -1, R.range(6.5, 8.0), dir + R.range(-0.7, 0.7), R.range(1.3, 1.55), 1.0, R.range(32, 38), 0.05);
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, -2, 2, 3]] };
    } },
    { name: 'digging deep', times: ['day', 'morning'], make({ R }) {
      const figures = [], props = [], ax = R.range(-0.5, 0.5), az = R.range(-0.5, 0.5), ay = R.range(0, 6.28);
      figures.push(F(R.pick(['woman', 'woman', 'old']), 'digStand', ax, az, ay, {}, { hold: HOLD.dig() }));
      props.push(custom((R) => hole(R, { r: 0.38 }), ax + Math.sin(ay) * 0.7, az + Math.cos(ay) * 0.7, { yaw: ay + PI / 2 }));
      const bx = ax + Math.sin(ay + 1.3) * 1.5, bz = az + Math.cos(ay + 1.3) * 1.5;
      figures.push(F('woman', R.pick(['dig', 'cut']), bx, bz, yawTo(bx, bz, ax + Math.sin(ay) * 1.4, az + Math.cos(ay) * 1.4), {}, R() < 0.6 ? { hold: HOLD.digKneel() } : {}));
      props.push(custom((R) => bag(R, { open: true }), ax - Math.sin(ay) * 1.1, az - Math.cos(ay) * 1.1, { yaw: R() * 6 }));
      if (R() < 0.5) figures.push(F('toddler', 'sitKnees', ax - Math.sin(ay - 0.8) * 1.8, az - Math.cos(ay - 0.8) * 1.8, ay));
      const camera = cam(ax, az, R.range(4.2, 5.5), ay + R.range(1.0, 1.8) * (R() < 0.5 ? 1 : -1), R.range(1.2, 1.5), 0.55, R.range(34, 40));
      return { figures, props, camera, clear: [[ax, az, 3, 2]], light: 'side' };
    } },
    { name: 'moving camp', make({ R }) {
      const figures = [], props = [], dir = (R() < 0.5 ? 1 : -1) * PI / 2 + R.range(-0.25, 0.25), n = 5 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const kind = i === 0 ? 'man' : R.pick(['woman', 'woman', 'man', 'teen', 'child', 'old']), x = -Math.sin(dir) * i * R.range(1.2, 1.6), z = R.range(-0.6, 0.6);
        const f = F(kind, 'walk', x + Math.sin(dir) * n * 0.6, z, dir + R.range(-0.05, 0.05), { speed: 0.85 }, { move: true });
        if (kind === 'man') { if (R() < 0.3) { f.pose = 'carryShoulder'; f.hold = HOLD.carcass(); } else f.hold = HOLD.spearCarry(); }
        if (kind === 'woman') { f.pose = 'carryHead'; f.hold = R() < 0.5 ? both(HOLD.head(R() < 0.5 ? bagM : woodM, PI / 2), HOLD.babyBack()) : HOLD.head(bagM); }
        if (kind === 'teen' && R() < 0.5) f.hold = HOLD.babyBack();
        figures.push(f);
      }
      const camera = cam(0, 0, R.range(6.2, 7.5), dir + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.45, 0.45), R.range(1.3, 1.6), 0.9, R.range(38, 40), 0.03);
      return { figures, props, camera, clear: [[0, 0, 3, 3]] };
    } },
    { name: 'meat home', make({ R }) {
      const figures = [], props = [], dir = R.range(-0.5, 0.5);
      figures.push(F('man', 'carryShoulder', 0, 0, dir, { speed: 0.7 }, { move: true, hold: HOLD.carcass() }));
      const side = R.pick([-1, 1]);
      figures.push(F('man', 'walk', R.range(0.9, 1.3) * (R() < 0.5 ? 1 : -1), -R.range(1.2, 2.0), dir + R.range(-0.08, 0.08), { speed: 0.62 }, { move: true, hold: HOLD.spearCarry() }));
      if (R() < 0.5) figures.push(F('teen', 'walk', R.range(-1.5, 1.5), -R.range(3, 4), dir, { speed: 0.62 }, { move: true, hold: HOLD.spearCarry(1.7) }));
      const camera = cam(0, -0.5, R.range(5.2, 6.5), dir + side * R.range(0.7, 1.2), R.range(1.25, 1.5), 1.1, R.range(34, 38), 0.03);
      return { figures, props, camera, clear: [[0, -1, 2, 3]] };
    } },
    { name: 'the long walk', make({ R }) {
      const figures = [], props = [], dir = PI + R.range(-0.5, 0.5), n = 3 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const kind = R.pick(['man', 'woman', 'teen', 'woman', 'child']), f = F(kind, 'walk', R.range(-1.0, 1.0), -i * R.range(0.9, 1.3) - 0.5, dir + R.range(-0.06, 0.06), { speed: 0.85 }, { move: true }); if (kind === 'man') f.hold = HOLD.spearCarry(); if (kind === 'woman') { f.pose = 'carryHead'; f.hold = HOLD.head(bagM); } figures.push(f); }
      const camera = { pos: [R.range(-1.5, 1.5), R.range(1.2, 1.5), R.range(2.5, 3.5)], target: [0, R.range(1.3, 1.9), -12], fov: R.range(36, 40), push: 0.1 };
      return { figures, props, camera, focus: { x: 0, z: -4 }, clear: [[0, -3, 2, 3]], light: R() < 0.5 ? 'back' : 'side' };
    } },
    { name: 'firewood', make({ R }) {
      const figures = [], props = [], dir = R.range(0, 6.28);
      figures.push(F(R.pick(['woman', 'old']), 'carryHead', 0, 0, dir, {}, { move: true, hold: HOLD.head(woodM, PI / 2) }));
      const bx = R.range(1.4, 2.2) * (R() < 0.5 ? 1 : -1), bz = R.range(-1.5, 1);
      figures.push(F('woman', R.pick(['crouch', 'digStand']), bx, bz, R.range(0, 6.28), { work: true }));
      props.push(custom((R) => firewood(R, { n: 10 }), bx + 0.6, bz + 0.3), custom((R) => firewood(R, { n: 4 }), bx - 0.8, bz - 0.4));
      const camera = cam(bx / 2, bz / 2, R.range(5.5, 7), dir + R.range(-1.2, 1.2), R.range(1.25, 1.5), 0.85, R.range(34, 38), 0.05);
      return { figures, props, camera, clear: [[bx / 2, bz / 2, 2.5, 2]] };
    } },
  ], { salt: 1415 }),

  // For 300,000 years, sugar and fat were rare: fibrous roots, a scrap of honey for many, a little meat to go round
  cravings: story(['day', 'day', 'dusk'], [
    { name: 'digging roots', times: ['day'], make({ R }) {
      const figures = [], props = [], ax = R.range(-0.5, 0.5), az = R.range(-0.5, 0.5);
      figures.push(F('woman', 'dig', ax, az, R.range(0, 6.28), {}, { hold: HOLD.digKneel() }));
      props.push(custom((R) => hole(R, { r: 0.25 }), ax + 0.2, az + 0.65));
      const bx = ax + R.range(1.2, 1.6), bz = az + R.range(-0.4, 0.6);
      figures.push(F(R.pick(['woman', 'old']), 'scrape', bx, bz, yawTo(bx, bz, ax, az) + R.range(-0.6, 0.6)));
      props.push({ type: 'hide', x: bx + 0.2, z: bz + 0.45, o: { w: 1.1, d: 0.9 } }, custom((R) => roots(R, { n: 9, spread: 0.35, size: 1.4 }), bx + 0.2, bz + 0.45));
      if (R() < 0.6) figures.push(F('child', 'eat', ax - 1.1, az + 0.8, R.range(0, 6.28), { crouch: true }));
      const camera = cam((ax + bx) / 2, (az + bz) / 2, R.range(3.2, 4.0), yawTo(ax, az, bx, bz) + R.pick([-1, 1]) * R.range(1.2, 1.9), R.range(1.3, 1.6), 0.35, R.range(36, 40));
      return { figures, props, camera, clear: [[ax, az, 3, 2]], light: 'side' };
    } },
    { name: 'roots in the ashes', make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.45, time), custom((R) => roots(R, { n: 6, spread: 0.18, size: 0.9 }), 0.0, 0.05)];
      ring(R, 0, 0, R.range(0.95, 1.15), 3 + Math.floor(R() * 2), R.range(-0.5, 0.5), R.range(3.0, 4.0), 0.1).forEach((p, i) => figures.push(F(i ? R.pick(['woman', 'child', 'man', 'old']) : 'woman', i ? R.pick(['crouch', 'sitKnees', 'eat']) : 'feedFire', p.x, p.z, p.yaw, { crouch: true, headDown: 0.3 })));
      const camera = cam(0, 0, R.range(3.2, 4.2), R.range(0, 6.28), R.range(1.05, 1.35), 0.3, R.range(34, 40));
      dress(R, props, camera, { r: 4.5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'one honeycomb', make({ R }) {
      const figures = [], props = [], hx = 0, hz = 0, hy = R.range(0, 6.28);
      // the one who found it holds it out on a piece of bark
      figures.push(F('man', 'offer', hx, hz, hy, { lookY: 0 }, { hold: hold((R) => honeycomb(R, { size: 1.3, tray: true }), { between: ['rWr', 'lWr'], t: 0.5, rot: [0, 0, PI / 2] }) }));
      // everyone crowds round, reaching
      const n = 5 + Math.floor(R() * 3);
      ring(R, hx + Math.sin(hy) * 0.3, hz + Math.cos(hy) * 0.3, R.range(0.9, 1.05), n, hy - 1.25, hy + 1.25, 0.03).forEach((p, i) => {
        const kind = R.pick(['child', 'child', 'woman', 'child', 'old', 'toddler']), f = F(kind, kind === 'toddler' ? 'armsUp' : R.pick(['reach', 'reach', 'stand']), p.x, p.z, p.yaw + R.range(-0.2, 0.2), { headDown: 0.3 });
        figures.push(f);
      });
      const camera = cam(hx + Math.sin(hy) * 0.4, hz + Math.cos(hy) * 0.4, R.range(3.2, 4.0), hy + R.pick([-1, 1]) * R.range(1.75, 2.1), R.range(1.85, 2.1), 0.85, R.range(34, 38));
      dress(R, props, camera, { r: 5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'meat cut thin', make({ R, time }) {
      const figures = [], props = [], ky = R.range(0, 6.28);
      figures.push(F('man', 'cut', 0, 0, ky, {}, { hold: HOLD.hand((R) => handStone(R, { r: 0.035 })) }));
      props.push({ type: 'hide', x: Math.sin(ky) * 0.7, z: Math.cos(ky) * 0.7, o: { w: 1.3, d: 1.0, color: '#B89A72' } }, custom((R) => meat(R, { kind: 'strips', n: 12, size: 1.3 }), Math.sin(ky) * 0.7, Math.cos(ky) * 0.7, { y: 0.02 }));
      ring(R, Math.sin(ky) * 0.7, Math.cos(ky) * 0.7, R.range(1.4, 1.7), 4 + Math.floor(R() * 3), ky - 2.2, ky + 2.2, 0.1).forEach((p) => figures.push(F(R.pick(['woman', 'child', 'old', 'teen', 'child']), R.pick(['sitKnees', 'sitCross', 'listen']), p.x, p.z, p.yaw, { headDown: 0.3 })));
      props.push(custom((R) => rack(R, { w: 1.6 }), Math.sin(ky + PI) * 2.0, Math.cos(ky + PI) * 2.0, { yaw: ky + PI / 2 }));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.6, time), behind: 2.4 });
      const camera = cam(Math.sin(ky) * 0.5, Math.cos(ky) * 0.5, R.range(3.2, 4.0), ky + R.pick([-1, 1]) * R.range(1.2, 1.7), R.range(1.5, 1.8), 0.4, R.range(34, 40));
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'cracking nuts', make({ R }) {
      const figures = [], props = [], n = 2 + Math.floor(R() * 2), a0 = R.range(0, 6.28);
      for (let i = 0; i < n; i++) {
        const a = a0 + i * R.range(1.6, 2.1), x = Math.sin(a) * 0.9, z = Math.cos(a) * 0.9, y = R.range(0, 6.28);
        figures.push(F(R.pick(['woman', 'woman', 'old', 'teen']), 'crack', x, z, y, {}, { hold: HOLD.hand((R) => handStone(R, { r: 0.055 })) }));
        props.push(custom((R) => nutsAnvil(R, { n: 12 }), x + Math.sin(y) * 0.55, z + Math.cos(y) * 0.55));
      }
      if (R() < 0.7) figures.push(F('child', 'eat', R.range(-0.5, 0.5), R.range(-0.5, 0.5), R.range(0, 6.28), { crouch: R() < 0.5 }));
      props.push(custom((R) => bag(R, { size: 0.8 }), Math.sin(a0 + PI) * 1.2, Math.cos(a0 + PI) * 1.2));
      const camera = cam(0, 0, R.range(3.8, 5.0), R.range(0, 6.28), R.range(1.15, 1.45), 0.35, R.range(34, 40));
      dress(R, props, camera, { r: 4.5, n: 1, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
  ], { salt: 218 }),

  // For 300,000 years, your work fed people you knew: the food comes in and the people it is for are right there
  burnout: story(['day', 'day', 'dusk'], [
    { name: 'the hunters come in', make({ R, time }) {
      const figures = [], props = [], dir = PI + R.range(-0.5, 0.5), hx = R.range(-1.2, 1.2), hz = -R.range(1.0, 1.8);
      // the hunters walk in, one carrying the kill
      figures.push(F('man', 'carryShoulder', hx, hz, dir + PI, { speed: 0.6 }, { alarm: true, move: true, hold: HOLD.carcass() }));
      figures.push(F('man', 'walk', hx + R.range(1.0, 1.5) * (R() < 0.5 ? 1 : -1), hz - R.range(0.8, 1.5), dir + PI, { speed: 0.55 }, { move: true, hold: HOLD.spearCarry() }));
      // the camp turns to them: someone gets up, children run out, an old man looks round
      figures.push(F('child', 'run', R.range(-1.5, 1.5), R.range(-1.5, 0), yawTo(0, 0, hx, hz) + R.range(-0.3, 0.3), { speed: 1.4 }, { move: true }));
      if (R() < 0.6) figures.push(F('toddler', 'run', R.range(-1.5, 1.5), R.range(-0.3, 0.8), yawTo(0, 0, hx, hz), { speed: 1.5 }, { move: true }));
      const wx = R.range(1.2, 2.2) * (R() < 0.5 ? 1 : -1), wz = R.range(0.8, 1.8);
      figures.push(eye(F('woman', R.pick(['stand', 'shade', 'welcome']), wx, wz, yawTo(wx, wz, hx, hz)), hx, hz));
      props.push(fireAt(-wx * 0.6, R.range(1.5, 2.2), 0.6, time));
      const ox = -wx * 0.6 + R.range(-1, 1), oz = R.range(2.6, 3.2);
      figures.push(eye(F(R.pick(['old', 'woman']), R.pick(SIT), ox, oz, yawTo(ox, oz, -wx * 0.6, 2)), hx, hz));
      const camera = { pos: [R.range(-1.5, 1.5) - hx * 0.5, R.range(1.4, 1.65), R.range(5.2, 6.2)], target: [hx * 0.6, 1.0, hz * 0.6], fov: R.range(32, 36), push: 0.06 };
      dress(R, props, camera, { cx: 0, cz: 2, r: 3.0, n: 0, hides: 1 });
      return { figures, props, camera, focus: { x: hx, z: hz + 1.5 }, clear: [[0, 0, 5, 3]] };
    } },
    { name: 'roots for the family', make({ R, time }) {
      const figures = [], props = [], wy = R.range(0, 6.28);
      figures.push(F('woman', 'kneel', 0, 0, wy, { headDown: 0.4, lean: 0.25 }, { alarm: true }));
      const bx = Math.sin(wy) * 0.75, bz = Math.cos(wy) * 0.75;
      props.push(custom((R) => bag(R, { open: true, size: 1.25 }), bx, bz, { yaw: wy + PI / 2 }));
      // her children and her old mother, sitting where the food is being poured out
      ring(R, bx, bz, R.range(0.95, 1.15), 3, wy - 1.0, wy + 1.0, 0.1).forEach((p, i) => figures.push(F(['child', 'old', 'toddler'][i], ['sitKnees', 'sitCross', 'sitKnees'][i], p.x, p.z, p.yaw, { headDown: 0.35 })));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.8 });
      const camera = cam(bx * 0.6, bz * 0.6, R.range(3.6, 4.6), wy + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.5, 0.5), R.range(1.2, 1.45), 0.5, R.range(34, 40));
      dress(R, props, camera, { cx: bx, cz: bz, r: 4.5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'handing out meat', make({ R, time }) {
      const figures = [], props = [], my = R.range(0, 6.28);
      figures.push(F('man', 'give', 0, 0, my, { lookY: 0 }, { alarm: true, hold: HOLD.hand((R) => meat(R, { kind: 'haunch', size: 0.8 })) }));
      props.push({ type: 'hide', x: -Math.sin(my) * 0.6, z: -Math.cos(my) * 0.6, o: { w: 1.1, d: 0.8 } }, custom((R) => meat(R, { kind: 'pieces', n: 6 }), -Math.sin(my) * 0.6, -Math.cos(my) * 0.6, { y: 0.02 }));
      const tx = Math.sin(my) * 0.85, tz = Math.cos(my) * 0.85;
      figures.push(F(R.pick(['woman', 'old']), 'reach', tx, tz, my + PI, { lookY: 0 }));
      ring(R, 0, 0, R.range(1.6, 1.9), 3 + Math.floor(R() * 3), my - 1.6, my + 1.6, 0.15).filter((p) => Math.hypot(p.x - tx, p.z - tz) > 0.8).forEach((p) => figures.push(F(R.pick(['child', 'woman', 'teen', 'man']), R.pick(['sitKnees', 'eat', 'stand', 'reach']), p.x, p.z, p.yaw, { sit: true })));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 2.0 });
      const camera = cam(tx * 0.5, tz * 0.5, R.range(4.2, 5.4), my + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.4, 0.4), R.range(1.35, 1.6), 0.85, R.range(34, 40));
      dress(R, props, camera, { r: 5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'water for the old', make({ R, time }) {
      const figures = [], props = [], oy = R.range(0, 6.28);
      figures.push(F('old', R.pick(['sitKnees', 'reach']), 0, 0, oy, { sit: true, lookY: 0 }));
      const wx = Math.sin(oy) * 0.95, wz = Math.cos(oy) * 0.95;
      figures.push(F(R.pick(['woman', 'teen']), 'give', wx, wz, oy + PI, { crouch: true }, { alarm: true, hold: HOLD.hand((R) => flask(R, { size: 1.1 })) }));
      props.push({ type: 'shelter', x: -Math.sin(oy) * 1.8 + Math.cos(oy) * 0.8, z: -Math.cos(oy) * 1.8 - Math.sin(oy) * 0.8, o: { size: 1.0 } });
      if (R() < 0.6) figures.push(F('child', 'sitKnees', Math.cos(oy) * 1.0, -Math.sin(oy) * 1.0, oy + 0.6));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      const camera = cam(wx / 2, wz / 2, R.range(3.4, 4.4), oy + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.4, 0.4), R.range(1.1, 1.35), 0.55, R.range(34, 40));
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'wood for the fire', make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.6, time)], dir = R.range(0, 6.28), d = 2.4;
      figures.push(F('man', 'carryArms', Math.sin(dir + PI) * d, Math.cos(dir + PI) * d, dir, {}, { alarm: true, move: true, hold: HOLD.armful((R) => firewood(R, { tied: true, n: 12, len: 1.2 })) }));
      ring(R, 0, 0, R.range(1.2, 1.4), 3 + Math.floor(R() * 3), dir + 0.9, dir + PI * 2 - 0.9, 0.1).forEach((p) => figures.push(eye(F(R.pick(['woman', 'child', 'old', 'toddler', 'child']), R.pick(SIT), p.x, p.z, p.yaw), Math.sin(dir + PI) * d, Math.cos(dir + PI) * d)));
      const camera = cam(Math.sin(dir + PI) * 0.8, Math.cos(dir + PI) * 0.8, R.range(5, 6.5), dir + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.3, 0.3), R.range(1.25, 1.5), 0.7, R.range(34, 40));
      dress(R, props, camera, { r: 4.5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 4, 2]] };
    } },
  ], { salt: 7 }),

  // For 300,000 years, parents had help: a baby and many arms
  newparent: story(['day', 'dusk', 'morning'], [
    { name: 'grandmother holds the baby', make({ R, time }) {
      const figures = [], props = [], gy = R.range(0, 6.28);
      figures.push(F('old', R() < 0.5 ? 'lapBaby' : 'cradle', 0, 0, gy, { sit: true }, { hold: R() < 0.5 ? HOLD.babyLap() : HOLD.babyArms() }));
      if (figures[0].pose === 'lapBaby') figures[0].hold = HOLD.babyLap(); else figures[0].hold = HOLD.babyArms();
      const mx = Math.cos(gy) * 1.0 + Math.sin(gy) * 0.2, mz = -Math.sin(gy) * 1.0 + Math.cos(gy) * 0.2;
      figures.push(eye(F('woman', 'eat', mx, mz, gy - 0.5), 0, 0)); figures[1].alarm = true;
      props.push({ type: 'bowl', x: mx + Math.sin(gy) * 0.5, z: mz + Math.cos(gy) * 0.5 });
      if (R() < 0.7) { const cx = -Math.cos(gy) * 0.9, cz = Math.sin(gy) * 0.9; figures.push(eye(F(R.pick(['child', 'teen']), 'sitKnees', cx, cz, gy + 0.5), 0, 0)); }
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      const camera = cam(mx / 2 + Math.sin(gy) * 0.3, mz / 2 + Math.cos(gy) * 0.3, R.range(3.4, 4.4), gy + R.range(-0.6, 0.6), R.range(1.1, 1.35), 0.5, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'big sister carries it', make({ R }) {
      const figures = [], props = [], sy = R.range(0, 6.28);
      const sis = F(R.pick(['child', 'teen']), R() < 0.5 ? 'walk' : 'rock', 0, 0, sy, { speed: 0.6 }, {});
      if (sis.pose === 'walk') { sis.hold = HOLD.babyBack(); sis.move = true; } else sis.hold = HOLD.babyArms();
      figures.push(sis);
      // the mother working nearby, looking over
      const mx = R.range(1.6, 2.2) * (R() < 0.5 ? 1 : -1), mz = R.range(-1.6, -0.6);
      figures.push(eye(F('woman', R.pick(['scrape', 'sitWork', 'scrape']), mx, mz, R.range(0, 6.28)), 0, 0)); figures[1].alarm = true;
      if (figures[1].pose === 'scrape') props.push({ type: 'hide', x: mx + Math.sin(figures[1].yaw) * 0.6, z: mz + Math.cos(figures[1].yaw) * 0.6, o: { w: 1.4, d: 1.0 } });
      if (R() < 0.6) figures.push(F('woman', 'sitWork', mx + R.range(1, 1.4), mz - 0.8, R.range(0, 6.28)));
      const camera = cam(mx / 2, mz / 2, R.range(4.4, 5.4), sy + (sis.pose === 'walk' ? PI / 2 * R.pick([-1, 1]) + R.range(-0.4, 0.2) : R.range(-0.6, 0.6)), R.range(1.3, 1.55), 0.75, R.range(36, 40), 0.05);
      dress(R, props, camera, { cx: mx / 2, cz: mz / 2, r: 4.5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'passed round', make({ R, time }) {
      const figures = [], props = [], cy = R.range(0, 6.28), n = 4 + Math.floor(R() * 2);
      const spots = ring(R, 0, 0, R.range(0.85, 1.0), n, cy - 1.8, cy + 1.8, 0.05); spots.sort((a, b) => Math.abs(Math.sin((a.a - cy) / 2)) - Math.abs(Math.sin((b.a - cy) / 2)));
      spots.forEach((p, i) => figures.push(F(i === 2 ? 'old' : R.pick(['woman', 'woman', 'teen', 'old']), 'sitCross', p.x, p.z, p.yaw)));
      // the two nearest the back of the ring, facing the camera: one hands the baby across, the next reaches for it
      const [g0, g1] = figures, [s0, s1] = spots;
      g0.pose = 'offer'; g0.o = { sit: true }; g0.hold = HOLD.babyOffer(); g0.yaw = yawTo(s0.x, s0.z, s1.x, s1.z) + 0.5;
      g1.pose = 'reach'; g1.o = { sit: true }; g1.yaw = yawTo(s1.x, s1.z, s0.x, s0.z) - 0.5;
      // the mother sits at the end, watching her baby go round
      const mo = figures[n - 1]; mo.alarm = true; mo.kind = 'woman'; eye(mo, (s0.x + s1.x) / 2, (s0.z + s1.z) / 2);
      if (time !== 'day') props.push(fireAt(0, 0, 0.4, time));
      const camera = cam(0, 0, R.range(3.4, 4.2), cy + PI + R.range(-0.5, 0.5), R.range(1.4, 1.7), 0.45, R.range(36, 40));
      dress(R, props, camera, { r: 4.5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'she sleeps', make({ R }) {
      const figures = [], props = [], my = R.range(0, 6.28);
      figures.push(F('woman', 'lie', 0, 0, my, {}, { alarm: true })); props.push({ type: 'hide', x: -Math.cos(my) * 0.4, z: Math.sin(my) * 0.4, o: { w: 1.8, d: 1.0 } });
      props.push({ type: 'shelter', x: -Math.sin(my) * 1.6, z: -Math.cos(my) * 1.6, o: { size: 1.1 } });
      const ax = Math.sin(my) * 1.6 + R.range(-0.5, 0.5), az = Math.cos(my) * 1.6;
      figures.push(F(R.pick(['woman', 'old', 'teen']), 'rock', ax, az, yawTo(ax, az, 0, 0) + R.range(-1.2, 1.2), {}, { hold: HOLD.babyArms() }));
      if (R() < 0.6) figures.push(eye(F('woman', 'sitWork', ax + R.range(1.0, 1.4), az + R.range(-0.5, 0.5), R.range(0, 6.28)), ax, az));
      const camera = cam(ax / 2, az / 2, R.range(3.8, 5.0), my + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.5, 0.5), R.range(1.2, 1.45), 0.6, R.range(34, 40));
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'fed while feeding', make({ R, time }) {
      const figures = [], props = [], my = R.range(0, 6.28);
      figures.push(F('woman', 'cradle', 0, 0, my, { sit: true }, { alarm: true, hold: HOLD.babyArms() }));
      const gx = Math.sin(my) * 0.9 + Math.cos(my) * 0.3, gz = Math.cos(my) * 0.9 - Math.sin(my) * 0.3;
      figures.push(F(R.pick(['woman', 'old', 'man']), 'give', gx, gz, yawTo(gx, gz, 0, 0), { kneel: true }, { hold: HOLD.hand((R) => roots(R, { n: 1 })) }));
      if (R() < 0.7) figures.push(eye(F('child', 'sitKnees', -Math.cos(my) * 0.85, Math.sin(my) * 0.85, my + 1.2), 0, 0));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.7 });
      const camera = cam(gx / 2, gz / 2, R.range(3.4, 4.4), my + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.4, 0.4), R.range(1.1, 1.35), 0.5, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'father has it', make({ R, time }) {
      const figures = [], props = [], fy = R.range(0, 6.28);
      figures.push(F('man', 'lapBaby', 0, 0, fy, {}, { hold: HOLD.babyLap() }));
      const mx = Math.cos(fy) * 1.0, mz = -Math.sin(fy) * 1.0;
      figures.push(eye(F('woman', R.pick(['sitBack', 'sitBack', 'lie']), mx, mz, fy + R.range(-0.4, 0.4)), 0, 0)); figures[1].alarm = true;
      if (R() < 0.6) figures.push(F('old', 'sitWork', -Math.cos(fy) * 1.2, Math.sin(fy) * 1.2, fy + 0.4));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.7 });
      const camera = cam(mx / 2, mz / 2, R.range(3.4, 4.4), fy + R.range(-0.7, 0.7), R.range(1.1, 1.35), 0.45, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
  ], { salt: 152 }),

  // For 300,000 years, danger was over in minutes: the lion is leaving, the spears come down, people sit back down
  news: story(['day', 'day', 'dusk'], [
    { name: 'spears coming down', make: (c) => aftermath(c, 'spears') },
    { name: 'already back at work', make: (c) => aftermath(c, 'work') },
    { name: 'walking back', make: (c) => aftermath(c, 'back') },
  ], { salt: 4 }),

  // For 300,000 years, you compared yourself to a few dozen people: one shows a skill, the band you know watches
  compare: story(['day', 'day', 'dusk'], [
    { name: 'the throw', make({ R, time }) {
      const figures = [], props = [], dir = (R() < 0.5 ? 1 : -1) * PI / 2 + R.range(-0.2, 0.2), td = R.range(5.5, 6.5), tx = Math.sin(dir) * td, tz = Math.cos(dir) * td;
      props.push(custom((R) => target(R, { misses: 1 + Math.floor(R() * 3) }), tx, tz, { yaw: dir + PI }));
      figures.push(F(R.pick(['man', 'man', 'woman', 'teen']), 'throw', 0, 0, dir, {}, { hold: HOLD.throwSpear() }));
      crowd(R, figures, 0, 0, dir + PI, 12 + Math.floor(R() * 10), 1.9, 1.4);
      const side = R() < 0.5 ? 1 : -1, camera = cam(Math.sin(dir) * 0.6, Math.cos(dir) * 0.6, R.range(7, 8.2), dir + side * (PI / 2 + R.range(0.3, 0.55)), R.range(1.5, 1.8), 0.9, R.range(38, 40));
      dress(R, props, camera, { cx: -Math.sin(dir) * 3, cz: -Math.cos(dir) * 3, r: 4, n: 2, hides: 0 });
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 6, 3], [tx, tz, 2, 2]], keepOut: [[tx / 2, tz / 2, 6]] };
    } },
    { name: 'the knapper', make({ R, time }) {
      const figures = [], props = [], ky = R.range(0, 6.28);
      figures.push(F('man', 'knap', 0, 0, ky, {}, { hold: HOLD.hand((R) => handStone(R, { r: 0.05 })) }));
      props.push(custom((R) => handStone(R, { r: 0.04, color: '#8E8478' }), Math.sin(ky) * 0.6, Math.cos(ky) * 0.6), { type: 'stones', x: Math.sin(ky) * 0.6 + 0.2, z: Math.cos(ky) * 0.6, o: { n: 8, spread: 0.2 } });
      // the watchers, close in rows: sitting in front, standing behind
      const n1 = 6 + Math.floor(R() * 3), n2 = 5 + Math.floor(R() * 4);
      ring(R, 0, 0, 1.3, n1, ky - 1.7, ky + 1.7, 0.05).forEach((p) => figures.push(eye(F(R.pick(['man', 'teen', 'child', 'woman', 'teen']), R.pick(['sitKnees', 'sitCross', 'listen', 'crouch']), p.x, p.z, p.yaw), 0, 0)));
      ring(R, 0, 0, 2.15, n2, ky - 1.9, ky + 1.9, 0.06).forEach((p) => figures.push(eye(F(R.pick(['man', 'woman', 'old', 'teen', 'man']), R.pick(['stand', 'armsCrossed', 'handsHips', 'stand']), p.x, p.z, p.yaw), 0, 0)));
      const a = figures.length - n2 - 2; figures[a].alarm = true; figures[a].kind = R.pick(['man', 'teen']);
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 2.6 });
      const camera = cam(0, 0, R.range(4.0, 4.8), ky + PI + R.range(-0.5, 0.5), R.range(2.3, 2.6), 0.3, R.range(36, 40));
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 4, 2]] };
    } },
    { name: 'the race', make({ R }) {
      const figures = [], props = [], ca = R.range(-0.3, 0.3), camera = cam(0, -0.6, R.range(6.5, 7.5), ca, R.range(1.35, 1.6), 0.9, R.range(38, 40), 0.03);
      // two or three young men racing, coming obliquely at the camera; the band lined up behind them, watching
      const dir = ca + R.pick([-1, 1]) * R.range(0.55, 0.8), n = 2 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) figures.push(F(R.pick(['man', 'teen', 'teen']), 'run', Math.cos(dir) * (i - (n - 1) / 2) * 0.8 - Math.sin(dir) * R.range(0, 0.8), -Math.sin(dir) * (i - (n - 1) / 2) * 0.8 - Math.cos(dir) * R.range(0, 0.8), dir, { speed: 0.95, lean: 0.1 }, { move: true, t0: 2.4 }));
      const m = 12 + Math.floor(R() * 9);
      for (let i = 0; i < m; i++) {
        const along = (i - m / 2) * 0.62 + R.range(-0.1, 0.1), row = i % 3 === 0 ? 1 : 0, x = along, z = -2.6 - row * 0.8 + R.range(-0.15, 0.15);
        figures.push(eye(F(R.pick(['man', 'woman', 'child', 'teen', 'old', 'woman']), R.pick(['stand', 'armsUp', 'handsHips', 'stand', 'armsCrossed', 'sitKnees']), x, z, R.range(-0.3, 0.3)), 0, 0));
      }
      const w = figures[n + Math.floor(m / 2) + 1]; w.alarm = true; w.kind = 'teen'; w.pose = 'standApart'; eye(w, 0, 0);
      return { figures, props, camera, focus: { x: 0, z: -1 }, clear: [[0, -1, 6, 3]] };
    } },
  ], { salt: 7 }),

  // For millions of years, someone touched you every day
  touch: story(['day', 'dusk', 'dusk', 'night'], [
    { name: 'grooming', times: ['day', 'dusk'], make({ R, time }) {
      const figures = [], props = [], gy = R.range(0, 6.28), n = 2 + Math.floor(R() * 2);
      // a line, each picking through the hair of the one in front
      for (let i = 0; i < n; i++) { const x = -Math.sin(gy) * i * 0.62, z = -Math.cos(gy) * i * 0.62, f = F(R.pick(['woman', 'woman', 'teen', 'old', 'child']), i === 0 ? 'sitBowed' : 'groom', x, z, gy, {}); figures.push(f); }
      figures[0].alarm = true;
      if (R() < 0.6) figures.push(F('child', 'sitKnees', Math.cos(gy) * 1.0, -Math.sin(gy) * 1.0, gy - 1.4, { lookY: 0.6 }));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      const camera = cam(-Math.sin(gy) * 0.5, -Math.cos(gy) * 0.5, R.range(3.2, 4.2), gy + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.5, 0.5), R.range(1.0, 1.3), 0.6, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'children on their father', times: ['day', 'dusk'], make({ R }) {
      const figures = [], props = [], fy = R.range(0, 6.28);
      figures.push(F('man', 'lieBack', 0, 0, fy, { flat: true, lookY: 0.4 }));
      props.push({ type: 'hide', x: Math.sin(fy) * 0.6, z: Math.cos(fy) * 0.6, o: { w: 1.0, d: 2.0 } });
      // lieBack: the head lies towards -z of the figure (yaw fy), the legs towards +z
      const hx = -Math.sin(fy) * 0.55, hz = -Math.cos(fy) * 0.55, sx = Math.cos(fy), sz = -Math.sin(fy);
      figures.push(F('child', 'on', hx * 0.2 + sx * 0.32, hz * 0.2 + sz * 0.32, fy + PI / 2 + 0.2, { base: 'lie', lift: 0.13 }));
      figures.push(F(R.pick(['child', 'toddler']), R.pick(['sitBack', 'sitKnees']), hx + sx * -0.55, hz + sz * -0.55, fy + 1.6, { lookY: -0.5 }));
      figures[1].alarm = true;
      const camera = cam(0, 0, R.range(3.0, 3.8), fy + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.5, 0.5), R.range(1.2, 1.5), 0.2, R.range(34, 40));
      dress(R, props, camera, { r: 3.5, n: 1, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'sleeping huddled', times: ['night', 'dusk'], make({ R, time }) {
      const figures = [], props = [fireAt(-R.range(2.4, 2.9), R.range(-0.2, 0.6), 0.55, time)], y = R.range(-0.3, 0.3) + PI / 2;
      // people lying spooned close together on one big hide, a child in the middle
      const n = 3 + Math.floor(R() * 2), kinds = ['man', 'child', 'woman', 'teen', 'old'];
      // lying on the side facing +x (yaw ~PI/2), each body runs along +z from the hips; spooned one behind another along x
      for (let i = 0; i < n; i++) figures.push(F(kinds[i % kinds.length], 'lie', -i * 0.56 + 0.7, R.range(-0.06, 0.06) - 0.35, y + R.range(-0.06, 0.06)));
      figures[1].alarm = true;
      props.push({ type: 'hide', x: 0.7 - (n - 1) * 0.28, z: 0.1, o: { w: n * 0.6 + 0.6, d: 1.9 } });
      const camera = cam(0, 0, R.range(3.0, 3.8), PI / 2 + R.range(-0.4, 0.4) + (R() < 0.5 ? 0 : 0.0), R.range(1.1, 1.4), 0.15, R.range(36, 40));
      dress(R, props, camera, { r: 3.5, n: 1, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'on a shoulder', make({ R, time }) {
      const figures = [], props = [], sy = R.range(0, 6.28), n = 2 + Math.floor(R() * 2);
      // side by side, the one on the right leaning on the next, an arm round
      const ox = Math.cos(sy), oz = -Math.sin(sy);
      for (let i = 0; i < n; i++) figures.push(F(R.pick(['woman', 'man', 'teen', 'old', 'woman']), 'sitKnees', ox * (i - (n - 1) / 2) * 0.58, oz * (i - (n - 1) / 2) * 0.58, sy, { lookY: R.range(-0.2, 0.2) }));
      // figures are left to right along +x of the row: figure i's left neighbour is i+1
      figures[0].pose = 'leanOn'; figures[0].o = { side: 1, knees: true }; figures[0].alarm = true;
      figures[1].pose = 'armRound'; figures[1].o = { knees: true, lookY: -0.4 };
      figures[1].pose = 'sitKnees'; figures[1].o = { lookY: -0.3, headDown: 0.2 };
      if (n > 2) { figures[2].pose = 'leanOn'; figures[2].o = { side: -1, knees: true }; }
      const fx = Math.sin(sy) * 2.0, fz = Math.cos(sy) * 2.0;
      props.push(time === 'day' ? { type: 'hide', x: fx * 0.5, z: fz * 0.5, o: { w: 1.4, d: 0.8 } } : { ...fireAt(0, 0, 0.55, time), behind: 1.8 });
      const camera = cam(0, 0, R.range(3.0, 3.8), sy + R.pick([-1, 1]) * R.range(0.5, 0.9), R.range(1.0, 1.25), 0.6, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]], light: 'side' };
    } },
    { name: 'asleep in a lap', times: ['day', 'dusk', 'night'], make({ R, time }) {
      const figures = [], props = [], gy = R.range(0, 6.28);
      figures.push(F('old', 'sitLap', 0, 0, gy, { headDown: 0.5 }));
      // the child lies across the old woman's legs, head in the crook of her arm
      const lx = Math.sin(gy) * 0.48, lz = Math.cos(gy) * 0.48;
      figures.push(F('child', 'on', lx - Math.cos(gy) * 0.3, lz + Math.sin(gy) * 0.3, gy + PI, { base: 'lie', lift: 0.17 }, { alarm: true }));
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      if (R() < 0.6) figures.push(F(R.pick(['woman', 'man']), 'sitWork', -Math.cos(gy) * 1.1, Math.sin(gy) * 1.1, gy + 0.4));
      const camera = cam(lx, lz, R.range(2.8, 3.6), gy + R.range(0.4, 1.1) * (R() < 0.5 ? 1 : -1), R.range(1.1, 1.35), 0.35, R.range(34, 40));
      dress(R, props, camera, { r: 3.5, n: 1, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
  ], { salt: 7 }),

  // For 250,000 years, your reputation kept you alive: one speaks, everyone they depend on watches
  speaking: story(['dusk', 'night', 'dusk', 'day'], [
    { name: 'telling the hunt', make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.7, time)], sy = R.range(0, 6.28);
      const sx = Math.sin(sy) * 1.5, sz = Math.cos(sy) * 1.5;
      figures.push(F('man', R.pick(['mime', 'tell', 'mime']), sx, sz, sy + PI + R.range(-0.3, 0.3), { lookY: R.range(-0.3, 0.3) }, { alarm: true }));
      ring(R, 0, 0, R.range(1.5, 1.7), 7 + Math.floor(R() * 4), sy + PI - 1.7, sy + PI + 1.7, 0.03).forEach((p) => figures.push(eye(F(R.pick(['man', 'woman', 'child', 'old', 'teen', 'woman']), R.pick(['sitKnees', 'sitCross', 'listen', 'sitKnees']), p.x, p.z, p.yaw), sx, sz)));
      const camera = cam(sx * 0.5, sz * 0.5, R.range(3.8, 4.6), sy + PI + R.range(0.7, 1.1) * (R() < 0.5 ? 1 : -1), R.range(1.45, 1.7), 0.85, R.range(36, 40));
      dress(R, props, camera, { r: 5, n: 2, hides: 0 });
      return { figures, props, camera, focus: { x: sx * 0.7, z: sz * 0.7 }, clear: [[0, 0, 4, 2]] };
    } },
    { name: 'a quarrel settled', times: ['day', 'dusk'], make({ R, time }) {
      const figures = [], props = [], qy = R.range(0, 6.28), ax = Math.cos(qy) * 0.8, az = -Math.sin(qy) * 0.8;
      figures.push(F('man', 'talk', ax, az, yawTo(ax, az, -ax, -az), { lookY: 0 }, { alarm: true }));
      figures.push(F(R.pick(['man', 'woman']), R.pick(['armsCrossed', 'handsHips']), -ax, -az, yawTo(-ax, -az, ax, az), { lookY: 0 }));
      figures.push(eye(F('old', R.pick(['talk', 'stand']), Math.sin(qy) * 0.9, Math.cos(qy) * 0.9, qy + PI, {}), ax, az));
      // the band sitting round, every head on them
      ring(R, 0, 0, R.range(2.2, 2.6), 8 + Math.floor(R() * 6), qy + 0.8, qy + PI * 2 - 0.8, 0.06).filter((p) => Math.abs(Math.sin((p.a - qy - PI) / 2)) > 0.3).forEach((p) => figures.push(eye(F(R.pick(['man', 'woman', 'child', 'old', 'teen', 'woman']), R.pick(['sitKnees', 'sitCross', 'stand', 'sitKnees']), p.x, p.z, p.yaw), ax * 0.5, az * 0.5)));
      if (time !== 'day') props.push(fireAt(-Math.sin(qy) * 0.9, -Math.cos(qy) * 0.9, 0.55, time));
      const camera = cam(0, 0, R.range(4.0, 4.8), qy + PI + R.range(-0.4, 0.4), R.range(1.6, 1.85), 0.95, R.range(38, 40));
      dress(R, props, camera, { r: 5.5, n: 2, hides: 0 });
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 4.5, 2]] };
    } },
    { name: 'she speaks', make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.6, time)], sy = R.range(0, 6.28), sx = Math.sin(sy) * 1.3, sz = Math.cos(sy) * 1.3;
      figures.push(F('woman', 'tell', sx, sz, sy + PI, { kneel: R() < 0.5, lookY: R.range(-0.4, 0.4) }, { alarm: true }));
      ring(R, 0, 0, R.range(1.4, 1.55), 6 + Math.floor(R() * 4), sy + PI - 1.6, sy + PI + 1.6, 0.03).forEach((p) => figures.push(eye(F(R.pick(['old', 'man', 'woman', 'old', 'teen']), R.pick(['listen', 'sitKnees', 'sitCross']), p.x, p.z, p.yaw), sx, sz)));
      const camera = cam(sx * 0.4, sz * 0.4, R.range(4.0, 5.0), sy + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.4, 0.4), R.range(1.2, 1.45), 0.65, R.range(34, 40));
      dress(R, props, camera, { r: 4.5, n: 2, hides: 0 });
      return { figures, props, camera, focus: { x: sx * 0.6, z: sz * 0.6 }, clear: [[0, 0, 4, 2]] };
    } },
  ], { salt: 8 }),

  // For 300,000 years, nobody retired: the old still working, and needed
  useful: story(['day', 'morning', 'dusk'], [
    { name: 'digging', times: ['day', 'morning'], make({ R }) {
      const figures = [], props = [], oy = R.range(0, 6.28);
      figures.push(F('old', 'dig', 0, 0, oy, {}, { alarm: true, hold: HOLD.digKneel() }));
      props.push(custom((R) => hole(R, { r: 0.26 }), Math.sin(oy) * 0.65, Math.cos(oy) * 0.65), custom((R) => bag(R, { open: true }), -Math.cos(oy) * 0.9, Math.sin(oy) * 0.9, { yaw: R() * 6 }));
      const wx = Math.cos(oy) * 1.6 + Math.sin(oy) * 0.5, wz = -Math.sin(oy) * 1.6 + Math.cos(oy) * 0.5;
      figures.push(F(R.pick(['woman', 'teen']), R.pick(['digStand', 'dig']), wx, wz, oy + R.range(-0.5, 0.5), {}, { hold: HOLD.dig() }));
      if (figures[1].pose === 'dig') figures[1].hold = HOLD.digKneel();
      const camera = cam(wx / 3, wz / 3, R.range(3.8, 5.0), oy + R.range(0.6, 1.4) * (R() < 0.5 ? 1 : -1), R.range(1.15, 1.4), 0.45, R.range(34, 40));
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 3, 2]], light: 'side' };
    } },
    { name: 'firewood', make({ R }) {
      const figures = [], props = [], dir = R.range(0, 6.28);
      figures.push(F('old', R() < 0.6 ? 'carryHead' : 'carryArms', 0, 0, dir, {}, { alarm: true, move: true }));
      figures[0].hold = figures[0].pose === 'carryHead' ? HOLD.head(woodM, PI / 2) : HOLD.armful((R) => firewood(R, { tied: true, n: 8, len: 0.9 }));
      if (R() < 0.6) figures.push(F(R.pick(['woman', 'child']), 'walk', Math.cos(dir) * 1.0, -Math.sin(dir) * 1.0 - Math.cos(dir) * 0.6, dir, { speed: 0.7 }, { move: true }));
      const camera = cam(0, 0, R.range(5.0, 6.5), dir + R.range(-1.0, 1.0), R.range(1.3, 1.55), 0.9, R.range(34, 38), 0.03);
      return { figures, props, camera, clear: [[0, 0, 2.5, 2]] };
    } },
    { name: 'making tools for the young', make({ R, time }) {
      const figures = [], props = [], oy = R.range(0, 6.28);
      figures.push(F('old', 'knap', 0, 0, oy, {}, { alarm: true, hold: HOLD.hand((R) => handStone(R, { r: 0.05 })) }));
      props.push({ type: 'hide', x: Math.sin(oy) * 0.65, z: Math.cos(oy) * 0.65, o: { w: 0.8, d: 0.6 } }, { type: 'stones', x: Math.sin(oy) * 0.65, z: Math.cos(oy) * 0.65, o: { n: 9, spread: 0.22 } });
      const ts = R.pick([-1, 1]), tx = Math.sin(oy + ts * 1.1) * 0.95, tz = Math.cos(oy + ts * 1.1) * 0.95;
      figures.push(eye(F('teen', R.pick(['listen', 'crouch', 'sitKnees']), tx, tz, yawTo(tx, tz, 0, 0) + 0.3, { headDown: 0.45 }), Math.sin(oy) * 0.5, Math.cos(oy) * 0.5));
      if (R() < 0.5) { const cx = Math.sin(oy - ts * 1.3) * 1.1, cz = Math.cos(oy - ts * 1.3) * 1.1; figures.push(eye(F('child', 'sitKnees', cx, cz, yawTo(cx, cz, 0, 0)), 0, 0)); }
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      const camera = cam(Math.sin(oy) * 0.4, Math.cos(oy) * 0.4, R.range(3.0, 3.8), oy - ts * R.range(0.3, 0.7), R.range(1.1, 1.35), 0.4, R.range(36, 40));
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'teaching a girl', make({ R }) {
      const figures = [], props = [], gy = R.range(0, 6.28);
      figures.push(F('child', 'scrape', 0, 0, gy));
      props.push({ type: 'hide', x: Math.sin(gy) * 0.6, z: Math.cos(gy) * 0.6, o: { w: 1.3, d: 1.0 } });
      const ox = Math.cos(gy) * 0.75 + Math.sin(gy) * 0.3, oz = -Math.sin(gy) * 0.75 + Math.cos(gy) * 0.3;
      figures.push(F('old', 'reach', ox, oz, yawTo(ox, oz, Math.sin(gy) * 0.6, Math.cos(gy) * 0.6), { kneel: true, lookY: 0 }, { alarm: true }));
      const camera = cam(Math.sin(gy) * 0.3, Math.cos(gy) * 0.3, R.range(3.0, 3.8), gy + R.range(0.6, 1.3) * (R() < 0.5 ? 1 : -1), R.range(1.15, 1.4), 0.35, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]], light: 'side' };
    } },
    { name: 'cooking for the children', make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.5, time), custom((R) => roots(R, { n: 5, spread: 0.15 }), 0.05, 0.0)], oy = R.range(0, 6.28);
      figures.push(F('old', 'feedFire', Math.sin(oy + PI) * 0.95, Math.cos(oy + PI) * 0.95, oy, {}, { alarm: true }));
      ring(R, 0, 0, R.range(1.05, 1.25), 3 + Math.floor(R() * 3), oy - 1.5, oy + 1.5, 0.1).forEach((p) => figures.push(F(R.pick(['child', 'child', 'toddler', 'child']), R.pick(['sitKnees', 'sitCross', 'eat']), p.x, p.z, p.yaw, { headDown: 0.25 })));
      const camera = cam(0, 0, R.range(3.4, 4.4), oy + PI * (R() < 0.5 ? 0.6 : -0.6) + R.range(-0.2, 0.2), R.range(1.15, 1.4), 0.35, R.range(34, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'a spear for the boy', make({ R, time }) {
      const figures = [], props = [], oy = R.range(0, 6.28);
      figures.push(F('old', 'sitWork', 0, 0, oy, {}, { alarm: true, hold: hold((R) => spearAt(R, { length: 1.9, grip: 0.4 }), { between: ['rWr', 'lWr'], t: 0.5 }) }));
      const bs = R.pick([-1, 1]), bx = Math.sin(oy + bs * 1.35) * 1.0, bz = Math.cos(oy + bs * 1.35) * 1.0;
      figures.push(eye(F(R.pick(['child', 'teen']), R.pick(['crouch', 'stand', 'sitKnees']), bx, bz, yawTo(bx, bz, 0, 0)), 0, 0));
      if (R() < 0.5) { const cx = Math.sin(oy - bs * 1.5) * 1.1, cz = Math.cos(oy - bs * 1.5) * 1.1; figures.push(eye(F('child', 'stand', cx, cz, yawTo(cx, cz, 0, 0)), 0, 0)); }
      if (time !== 'day') props.push({ ...fireAt(0, 0, 0.5, time), behind: 1.6 });
      const camera = cam(Math.sin(oy) * 0.3, Math.cos(oy) * 0.3, R.range(3.0, 3.8), oy + R.range(-0.45, 0.45), R.range(1.1, 1.35), 0.45, R.range(36, 40));
      dress(R, props, camera, { r: 4, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
  ], { salt: 11 }),

  // For 300,000 years, people lived outside: the whole day spent in daylight, under the open sky
  winter: story(['day', 'day', 'morning'], [
    { name: 'scraping hides', make({ R, H }) {
      const figures = [], props = [], n = 2 + Math.floor(R() * 2), a0 = R.range(0, 6.28);
      for (let i = 0; i < n; i++) { const a = a0 + i * R.range(1.7, 2.2), x = Math.sin(a) * 1.1, z = Math.cos(a) * 1.1, y = R.range(0, 6.28); figures.push(F(R.pick(['woman', 'woman', 'old', 'teen']), 'scrape', x, z, y, {}, H.snow ? { hold: HOLD.cloak() } : {})); props.push({ type: 'hide', x: x + Math.sin(y) * 0.6, z: z + Math.cos(y) * 0.6, o: { w: 1.5, d: 1.1, color: R.pick(['#8A6A48', '#7A5A3C', '#9A7A58']) } }); }
      if (R() < 0.6) figures.push(F('child', R.pick(['sitKnees', 'stand', 'eat']), R.range(-0.4, 0.4), R.range(-0.4, 0.4), R.range(0, 6.28), {}, H.snow ? { hold: HOLD.cloak() } : {}));
      const camera = cam(0, 0, R.range(4.2, 5.5), R.range(0, 6.28), R.range(1.3, 1.6), 0.3, R.range(34, 40));
      dress(R, props, camera, { r: 5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3.5, 2]] };
    } },
    { name: 'under the sky', make({ R, H }) {
      const figures = [], props = [], dir = R.range(-0.8, 0.8) + (R() < 0.5 ? PI / 2 : -PI / 2), n = 2 + Math.floor(R() * 3);
      for (let i = 0; i < n; i++) { const f = F(R.pick(['man', 'woman', 'teen', 'child', 'woman']), 'walk', -Math.sin(dir) * i * 1.3 + R.range(-0.3, 0.3), -Math.cos(dir) * i * 1.3 + R.range(-0.4, 0.4), dir + R.range(-0.05, 0.05), { speed: 0.8 }, { move: true }); if (f.kind === 'man') f.hold = HOLD.spearCarry(); else if (H.snow) f.hold = HOLD.cloak(); else if (f.kind === 'woman' && R() < 0.5) f.hold = HOLD.babyBack(); figures.push(f); }
      const camera = { pos: [0, R.range(0.5, 0.8), 0], target: [0, 0, 0], fov: R.range(36, 40), push: 0.03 };
      const a = dir + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.4, 0.4), d = R.range(5.5, 7);
      camera.pos = [Math.sin(a) * d - Math.sin(dir) * n * 0.6, camera.pos[1], Math.cos(a) * d - Math.cos(dir) * n * 0.6]; camera.target = [-Math.sin(dir) * n * 0.6, R.range(1.5, 1.9), -Math.cos(dir) * n * 0.6];
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 2, 3]], light: R() < 0.5 ? 'side' : 'front' };
    } },
    { name: 'eating outside', make({ R, H }) {
      const figures = [], props = [{ type: 'hide', x: 0, z: 0, o: { w: 1.1, d: 0.9 } }, custom((R) => meat(R, { kind: 'pieces', n: 6 }), 0, 0, { y: 0.02 }), { type: 'bowl', x: 0.25, z: -0.2 }];
      ring(R, 0, 0, R.range(1.0, 1.2), 4 + Math.floor(R() * 3), R.range(0, 1), R.range(4.5, 5.8), 0.1).forEach((p) => figures.push(F(R.pick(['man', 'woman', 'child', 'old', 'teen']), R.pick(['eat', 'eat', 'sitKnees', 'sitCross']), p.x, p.z, p.yaw, { lookY: R.range(-0.4, 0.4) }, H.snow ? { hold: HOLD.cloak() } : {})));
      const camera = cam(0, 0, R.range(3.6, 4.6), R.range(0, 6.28), R.range(1.3, 1.55), 0.4, R.range(36, 40));
      dress(R, props, camera, { r: 4.5, n: 2, hides: 0 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]] };
    } },
    { name: 'a grey day, still out', make({ R, H }) {
      const figures = [], props = [], n = 3 + Math.floor(R() * 2);
      for (let i = 0; i < n; i++) { const a = i * 2 * PI / n + R.range(-0.3, 0.3), x = Math.sin(a) * R.range(0.8, 1.4), z = Math.cos(a) * R.range(0.8, 1.4); figures.push(eye(F(R.pick(['man', 'woman', 'old', 'teen']), R.pick(['armsCrossed', 'stand', 'talk', 'sitWork']), x, z, yawTo(x, z, 0, 0) + R.range(-0.4, 0.4)), 0, 0)); figures[i].hold = HOLD.cloak(); }
      figures.push(F('child', 'run', R.range(-2, 2), R.range(1.5, 2.5), R.range(0, 6.28), { speed: 1.4 }, { move: true, hold: HOLD.cloak() }));
      props.push(custom((R) => firewood(R, { n: 8 }), R.range(-1.6, 1.6), -1.8));
      const camera = cam(0, 0, R.range(4.5, 5.8), R.range(0, 6.28), R.range(1.4, 1.65), 0.85, R.range(34, 40));
      dress(R, props, camera, { r: 5, n: 2, hides: 1 });
      return { figures, props, camera, clear: [[0, 0, 3, 2]], light: 'side' };
    } },
  ], { salt: 67 }),

  // For 300,000 years, everyone around you knew you: a band of a few dozen, all known
  crowd: story(['night', 'dusk', 'day', 'dusk'], [
    { name: 'stories at the fire', times: ['night', 'dusk'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.8, time)], sy = R.range(0, 6.28), sx = Math.sin(sy) * 1.6, sz = Math.cos(sy) * 1.6;
      figures.push(F(R.pick(['old', 'man', 'woman']), 'tell', sx, sz, sy + PI, { kneel: R() < 0.4 }));
      // the whole band, two rows deep round the fire
      const n1 = 9 + Math.floor(R() * 4), n2 = 7 + Math.floor(R() * 6), cs = R.pick([-1, 1]), camA = sy + PI + cs * R.range(0.55, 0.85);
      ring(R, 0, 0, 1.6, n1, sy + 0.5, sy + PI * 2 - 0.5, 0.04).forEach((p) => figures.push(eye(F(R.pick(['man', 'woman', 'child', 'teen', 'old', 'woman', 'child']), R.pick(['sitKnees', 'sitCross', 'listen', 'leanOn']), p.x, p.z, p.yaw, { side: 1 }), sx, sz)));
      ring(R, 0, 0, 2.4, n2, sy + 0.7, sy + PI * 2 - 0.7, 0.06).filter((p) => Math.abs(Math.sin((p.a - camA) / 2)) > 0.38).forEach((p) => figures.push(eye(F(R.pick(['man', 'woman', 'teen', 'old', 'man']), R.pick(['stand', 'armsCrossed', 'sitKnees', 'stand']), p.x, p.z, p.yaw), sx, sz)));
      // the one the rings are drawn on: a listener on the near side
      const camera = cam(sx * 0.3, sz * 0.3, R.range(4.6, 5.6), camA, R.range(1.7, 2.0), 0.7, R.range(38, 40));
      let best = null, bd = 1e9; for (const f of figures.slice(1, n1 + 1)) { const d = Math.hypot(f.x - camera.pos[0], f.z - camera.pos[2]); if (d < bd) { bd = d; best = f; } }
      best.alarm = true;
      dress(R, props, camera, { r: 5.5, n: 3, hides: 0 });
      return { figures, props, camera, focus: { x: 0, z: 0 }, clear: [[0, 0, 5, 2]] };
    } },
    { name: 'a camp of twenty-five', times: ['day', 'dusk'], make({ R, time }) {
      const figures = [], props = [fireAt(0, 0, 0.6, time)];
      // knots of people round the camp, each busy with something, all of them kin
      const groups = [
        () => ['woman', 'scrape'], () => ['woman', 'sitWork'], () => ['man', 'knap'], () => ['old', 'sitKnees'], () => ['child', 'run'], () => ['man', 'talk'], () => ['man', 'armsCrossed'], () => ['teen', 'sitKnees'], () => ['woman', 'cradle'], () => ['child', 'sitKnees'], () => ['toddler', 'stand'], () => ['woman', 'eat'], () => ['old', 'sitWork'], () => ['teen', 'stand'], () => ['man', 'spear'],
      ];
      const n = 20 + Math.floor(R() * 6);
      for (let i = 0; i < n; i++) {
        const [kind, pose] = R.pick(groups)(), a = R() * PI * 2, d = 1.3 + Math.sqrt(R()) * 6.5, x = Math.sin(a) * d, z = Math.cos(a) * d;
        if (figures.some((f) => Math.hypot(f.x - x, f.z - z) < 0.9)) continue;
        const f = F(kind, pose, x, z, R.range(0, 6.28), { sit: true, lookY: R.range(-0.5, 0.5) });
        if (pose === 'run') f.move = true; if (pose === 'cradle') f.hold = HOLD.babyArms(); if (pose === 'spear') f.hold = HOLD.spear();
        if (pose === 'scrape') props.push({ type: 'hide', x: x + Math.sin(f.yaw) * 0.6, z: z + Math.cos(f.yaw) * 0.6, o: { w: 1.3, d: 0.9 } });
        figures.push(f);
      }
      const camera = cam(0, 0, R.range(9.5, 11.5), R.range(0, 6.28), R.range(1.6, 1.9), 0.6, R.range(36, 40)), ca = Math.atan2(camera.pos[0], camera.pos[2]);
      for (let i = 0; i < 4; i++) { const a = ca + PI + (i - 1.5) * R.range(0.5, 0.7), d = R.range(7.5, 9); props.push({ type: 'shelter', x: Math.sin(a) * d, z: Math.cos(a) * d, o: { size: R.range(0.9, 1.2) } }); }
      let best = null, bd = 1e9; for (const f of figures) { const d = Math.hypot(f.x - camera.pos[0], f.z - camera.pos[2]); if (d < bd && f.kind !== 'toddler' && !f.move) { bd = d; best = f; } }
      best.alarm = true;
      return { figures, props, camera, focus: { x: best.x * 0.5, z: best.z * 0.5 }, clear: [[0, 0, 9, 3]] };
    } },
    { name: 'home after days away', times: ['day', 'dusk'], make({ R, time }) {
      const figures = [], props = [], dir = R.range(0, 6.28), rx = Math.sin(dir + PI) * 2.6, rz = Math.cos(dir + PI) * 2.6;
      figures.push(F(R.pick(['man', 'woman', 'teen']), 'walk', rx, rz, dir, { speed: 0.6 }, { alarm: true, move: true, hold: R() < 0.5 ? HOLD.spearCarry() : HOLD.babyBack() }));
      // people coming out to meet them
      const meet = [['woman', 'welcome'], ['child', 'run'], ['old', 'welcome'], ['man', 'armsUp'], ['child', 'run'], ['woman', 'stand'], ['toddler', 'run'], ['teen', 'welcome']];
      for (let i = 0, n = 7 + Math.floor(R() * 4); i < n; i++) {
        const [kind, pose] = meet[i % meet.length], a = dir + R.range(-1.1, 1.1), d = R.range(0.2, 2.6), x = Math.sin(a) * d - Math.sin(dir) * 0.6, z = Math.cos(a) * d - Math.cos(dir) * 0.6;
        if (figures.some((f) => Math.hypot(f.x - x, f.z - z) < 0.8)) continue;
        const f = F(kind, pose, x, z, yawTo(x, z, rx, rz), { speed: 1.4, lookY: 0 });
        if (pose === 'run') { f.move = true; f.yaw += R.range(-0.2, 0.2); }
        figures.push(f);
      }
      props.push(fireAt(Math.sin(dir) * 3.2, Math.cos(dir) * 3.2, 0.55, time));
      const camera = cam(rx * 0.4, rz * 0.4, R.range(5.5, 7.0), dir + PI / 2 * (R() < 0.5 ? 1 : -1) + R.range(-0.5, 0.5), R.range(1.35, 1.6), 0.85, R.range(34, 40), 0.05);
      dress(R, props, camera, { cx: Math.sin(dir) * 2, cz: Math.cos(dir) * 2, r: 4, n: 2, hides: 1 });
      return { figures, props, camera, focus: { x: rx * 0.5, z: rz * 0.5 }, clear: [[0, 0, 4.5, 2]] };
    } },
  ], { salt: 3 }),
};

// ---------- scenes shared by several variants ----------
// night: the camp asleep round a low fire, and one (or two) awake
function nightCamp({ R, time }, who) {
  const figures = [], props = [fireAt(0, 0, R.range(0.38, 0.5), time)], wa = R.range(0, 6.28);
  // the sleepers, on hides round the fire; a child curled against its mother
  const n = 4 + Math.floor(R() * 3), spots = ring(R, 0, 0, R.range(1.7, 2.1), n, wa + 0.9, wa + PI * 2 - 0.9, 0.12);
  spots.forEach((p, i) => {
    const kind = R.pick(['man', 'woman', 'woman', 'old', 'teen']); figures.push(F(kind, 'lie', p.x, p.z, p.yaw + R.range(-0.25, 0.25)));
    props.push({ type: 'hide', x: p.x - Math.cos(p.yaw) * 0.45, z: p.z + Math.sin(p.yaw) * 0.45, o: { w: 1.8, d: 1.0 } });
    if (kind === 'woman' && i % 2 === 0) figures.push(F(R.pick(['child', 'toddler']), 'lie', p.x + Math.sin(p.yaw) * 0.45, p.z + Math.cos(p.yaw) * 0.45, p.yaw));
  });
  // the one awake, on the open side of the fire
  const ax = Math.sin(wa) * 1.15, az = Math.cos(wa) * 1.15, ay = yawTo(ax, az, 0, 0);
  let awake;
  if (who === 'fire') awake = F(R.pick(['woman', 'man', 'old']), 'feedFire', ax, az, ay, {});
  else if (who === 'baby') awake = F('woman', R() < 0.5 ? 'cradle' : 'lapBaby', ax * 1.1, az * 1.1, ay + R.range(-0.5, 0.5), { sit: true }, {});
  else if (who === 'watch') { const d = R.range(3.2, 4.0), wx = Math.sin(wa) * d, wz = Math.cos(wa) * d; awake = F('man', R.pick(['watch', 'spear']), wx, wz, yawTo(0, 0, wx, wz) + R.range(-0.5, 0.5), {}, {}); if (awake.pose === 'spear') awake.hold = HOLD.spear(); }
  else if (who === 'awake') { const s = spots[Math.floor(n / 2)]; awake = figures.find((f) => f.x === s.x); awake.pose = R() < 0.6 ? 'liePropped' : 'lieBack'; awake.o = { lookY: R.range(-0.5, 0.5), headDown: -0.45, hands: 'head', flat: R() < 0.5 }; }
  else if (who === 'two') { awake = F(R.pick(['woman', 'man']), 'sitKnees', ax + Math.cos(ay) * 0.35, az - Math.sin(ay) * 0.35, ay - 0.5, { lookY: -0.6 }); figures.push(F(R.pick(['woman', 'man', 'old']), R.pick(['sitCross', 'listen']), ax - Math.cos(ay) * 0.4, az + Math.sin(ay) * 0.4, ay + 0.5, { lookY: 0.6 })); }
  else awake = F('old', R.pick(['sitHug', 'sitKnees']), ax, az, ay, { headDown: 0.0 });
  if (awake.pose === 'cradle' || awake.pose === 'lapBaby') awake.hold = awake.pose === 'cradle' ? HOLD.babyArms() : HOLD.babyLap();
  awake.alarm = true; if (!figures.includes(awake)) figures.push(awake);
  // the camera low, the awake one large in frame with the sleepers round
  const toFire = Math.atan2(-awake.x, -awake.z), far = who === 'watch' ? R.range(3.6, 4.6) : who === 'awake' ? R.range(2.2, 2.7) : R.range(2.8, 3.6);
  const camera = who === 'awake' ? cam(awake.x * 0.8, awake.z * 0.8, R.range(2.8, 3.3), toFire + PI + R.pick([-1, 1]) * R.range(0.45, 0.7), R.range(1.4, 1.65), 0.15, R.range(36, 40)) : cam(awake.x * 0.75, awake.z * 0.75, far, toFire + R.pick([-1, 1]) * R.range(1.45, 2.0), who === 'watch' ? R.range(1.1, 1.4) : who === 'awake' ? R.range(1.3, 1.55) : R.range(0.8, 1.1), who === 'watch' ? 0.85 : who === 'awake' ? 0.15 : 0.35, R.range(36, 40));
  dress(R, props, camera, { r: 4.0, n: 1, hides: 0 });
  return { figures, props, camera, focus: { x: awake.x, z: awake.z }, clear: [[0, 0, 4, 2]] };
}
// a crowd watching (cx, cz) from the side facing dir: some sitting in front, more standing behind
function crowd(R, figures, cx, cz, dir, n, d, depth) {
  const start = figures.length;
  for (let i = 0; i < n; i++) {
    const row = i < n * 0.35 ? 0 : i < n * 0.75 ? 1 : 2, a = dir + R.range(-1.0, 1.0), r = d + row * 0.75 + R.range(-0.15, 0.15), x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    if (figures.slice(start).some((f) => Math.hypot(f.x - x, f.z - z) < (row ? 0.55 : 0.75))) continue;
    const kind = R.pick(['man', 'woman', 'child', 'teen', 'old', 'woman', 'man']);
    figures.push(eye(F(kind, row === 0 ? R.pick(['sitKnees', 'sitCross', 'crouch']) : R.pick(['stand', 'armsCrossed', 'handsHips', 'stand', 'shade']), x, z, yawTo(x, z, cx, cz) + R.range(-0.25, 0.25)), cx, cz));
  }
  // the one who feels it: a young man in the second row, his own spear in hand
  const cands = figures.slice(start).filter((f) => f.pose !== 'sitKnees' && f.pose !== 'sitCross' && f.pose !== 'crouch');
  const w = cands[Math.floor(R() * cands.length)] || figures[start];
  w.alarm = true; w.kind = R.pick(['man', 'teen']); w.pose = 'spear'; w.hold = HOLD.spear(); eye(w, cx, cz);
}
// after danger: an animal leaving, far off; the spears coming down; people already back at what they were doing.
// Seen from one side, so the men's spears show in profile and the animal is still in frame beyond them.
function aftermath({ R, time }, mode) {
  const figures = [], props = [], side = R.pick([-1, 1]), dir = PI + R.range(-0.2, 0.2), far = R.range(15, 20), bx = Math.sin(dir) * far - side * R.range(0, 4), bz = Math.cos(dir) * far;
  const kind = R() < 0.6 ? 'lion' : 'hyena';
  props.push(custom((R, ctx) => beast(R, { kind, speed: R.range(0.7, 0.9), ground: ctx?.ground }), bx, bz, { yaw: dir + R.range(-0.5, 0.5) }));
  // the men who stood up with spears, between the camp and where it went
  const mx = Math.sin(dir) * 3.4, mz = Math.cos(dir) * 3.4, across = (k) => [mx + Math.cos(dir) * k, mz - Math.sin(dir) * k];
  const back = mode === 'back';
  const lead = F('man', back ? 'walkLook' : 'spearLow', mx, mz, back ? dir + PI : dir + R.range(-0.25, 0.25), { tense: R.range(0.15, 0.4), lookY: 0, side: side, speed: 0.7 }, { alarm: true, hold: back ? HOLD.spearCarry() : HOLD.spear2() });
  if (back) lead.move = true; figures.push(lead);
  const [ox, oz] = across(side * R.range(1.3, 1.8));
  const m2 = F('man', back ? 'walk' : R.pick(['spear', 'spear', 'walk']), ox, oz, dir, { speed: 0.7, lookY: 0 }, {});
  if (m2.pose === 'walk') { m2.yaw = dir + PI + R.range(-0.3, 0.3); m2.move = true; m2.hold = HOLD.spearCarry(); } else m2.hold = HOLD.spear();
  figures.push(m2);
  if (R() < 0.6) { const [x, z] = across(-side * R.range(1.2, 1.7)); const m3 = F('man', back ? 'walk' : 'spear', x, z - R.range(0, 0.6), back ? dir + PI : dir, { speed: 0.7 }, { hold: back ? HOLD.spearCarry() : HOLD.spear() }); if (back) m3.move = true; figures.push(m3); }
  // the camera off to one side and behind: the men three-quarter on, the animal beyond them
  const camera = { pos: [side * R.range(4.4, 5.4), R.range(1.5, 1.75), R.range(2.6, 3.6)], target: [mx * 0.8 + bx * 0.2, 0.95, mz * 0.8 + bz * 0.2], fov: R.range(36, 40), push: 0.05 };
  // the camp, between the camera and the men: already sitting back down, back at work
  const [cx, , cz] = camera.pos, [tx, , tz] = camera.target, u = R.range(0.4, 0.5), wx = cx + (tx - cx) * u - side * R.range(0.6, 1.2), wz = cz + (tz - cz) * u + R.range(0, 0.6);
  if (mode === 'work') {
    figures.push(F('woman', 'dig', wx, wz, R.range(0, 6.28), {}, { hold: HOLD.digKneel() }), F('child', 'run', wx - side * R.range(1.2, 2), wz + 0.4, R.range(0, 6.28), { speed: 1.3 }, { move: true }));
    const sx = wx - side * R.range(1.6, 2.4), sz = wz - R.range(0.3, 0.9), sy = R.range(0, 6.28);
    figures.push(F('woman', 'scrape', sx, sz, sy)); props.push({ type: 'hide', x: sx + Math.sin(sy) * 0.6, z: sz + Math.cos(sy) * 0.6, o: { w: 1.3, d: 1.0 } });
  } else {
    const wy = R.range(0, 6.28), w = F('woman', R.pick(['scrape', 'sitWork', 'eat']), wx, wz, wy);
    figures.push(w); if (w.pose === 'scrape') props.push({ type: 'hide', x: wx + Math.sin(wy) * 0.6, z: wz + Math.cos(wy) * 0.6, o: { w: 1.3, d: 1.0 } });
    figures.push(eye(F(R.pick(['child', 'toddler']), R.pick(['stand', 'sitKnees']), wx - side * R.range(0.7, 0.9), wz + R.range(-0.3, 0.3), R.range(0, 6.28)), bx, bz));
    if (R() < 0.6) figures.push(F(R.pick(['old', 'woman']), R.pick(['sitKnees', 'sitCross']), wx - side * R.range(1.8, 2.4), wz + R.range(-0.6, 0.2), R.range(0, 6.28), { lookY: 0 }));
  }
  props.push(fireAt(wx - side * R.range(1.0, 1.4), wz + R.range(0.9, 1.4), 0.5, time));
  props.push({ type: 'shelter', x: -side * R.range(4.0, 5.0), z: R.range(1.0, 2.5), o: { size: 1.1 } });
  return { figures, props, camera, focus: { x: mx, z: mz }, clear: [[wx, wz, 3, 2], [mx, mz, 3, 2]], keepOut: [[(camera.pos[0] + bx) / 2, (camera.pos[2] + bz) / 2, far * 0.5]] };
}
