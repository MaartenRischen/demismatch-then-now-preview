// For 300,000 years, strangers were rare. Five situations, one picked per generation: in each, people nobody knows
// appear and everyone in the shot stops to watch. The figure with alarm: true is the one whose alarm the page marks.
const PI = Math.PI;
const face = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);
const turnTo = (x, z, tx, tz, yaw) => { let a = face(x, z, tx, tz) - yaw; while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return Math.max(-1.1, Math.min(1.1, a)); };
const strangerKind = (R) => (R() < 0.7 ? 'man' : 'woman');
const spearInHand = { type: 'spear', hand: 'r', o: { length: 2.0 }, rot: [0.15, 0, 0] };

// strangers walking in towards (tx, tz) from (sx, sz)
function walkers(R, n, sx, sz, tx, tz, speed = 0.8) {
  const yaw = face(sx, sz, tx, tz), out = [];
  for (let i = 0; i < n; i++) {
    const side = (i - (n - 1) / 2) * R.range(0.9, 1.5), back = i * R.range(0.4, 1.6);
    out.push({ kind: strangerKind(R), pose: 'walk', x: sx + Math.cos(yaw) * side - Math.sin(yaw) * back, z: sz - Math.sin(yaw) * side - Math.cos(yaw) * back, yaw: yaw + R.range(-0.08, 0.08), walk: { speed }, hold: R() < 0.6 ? spearInHand : null, o: { speed, rEl: -1.1 } });
  }
  return out;
}

const VARIANTS = [
  // the camp from behind its people: a mother holding a child against her legs, men who have stood up
  (R) => {
    const far = R.range(16, 26), sx = R.range(-5, 5), figures = walkers(R, 2 + Math.floor(R() * 3), sx, -far, 0, 4), props = [];
    const mx = R.range(-2.2, -0.6), mz = R.range(2.6, 3.6), my = face(mx, mz, sx, -far);
    figures.push({ kind: 'woman', pose: 'guard', x: mx, z: mz, yaw: my, alarm: true });
    figures.push({ kind: R() < 0.5 ? 'child' : 'toddler', pose: 'stand', x: mx + Math.cos(my) * 0.32, z: mz - Math.sin(my) * 0.32, yaw: my + 0.3, o: { lookY: -0.3 } });
    const ax = R.range(0.8, 2.2), az = R.range(0.8, 2.0);
    figures.push({ kind: 'man', pose: 'spear', x: ax, z: az, yaw: face(ax, az, sx, -far), hold: { type: 'spear', hand: 'r', o: { length: 2.1 } } });
    if (R() < 0.7) { const bx = ax + R.range(1.2, 2.2), bz = az + R.range(-1.2, 0.6); figures.push({ kind: R() < 0.8 ? 'man' : 'woman', pose: R() < 0.6 ? 'shade' : 'armsCrossed', x: bx, z: bz, yaw: face(bx, bz, sx, -far) }); }
    props.push({ type: 'fire', x: R.range(-4.5, -3), z: R.range(1, 3), o: { size: 0.8, shadows: false } }, { type: 'shelter', x: R.range(-9, -7), z: R.range(-1, 2), o: { size: R.range(0.9, 1.2) } }, { type: 'hide', x: mx + 1.0, z: mz + 1.6, o: { w: 1.5, d: 1.1 } }, { type: 'bowl', x: -2.6, z: 2.4 });
    return { figures, props, focus: { x: mx, z: mz }, camera: { pos: [R.range(-0.5, 1.5), R.range(1.25, 1.55), R.range(7.0, 8.0)], target: [sx * 0.5, 0.8, -far * 0.5], fov: R.range(28, 34), push: 0.16 }, clear: [[-1.5, 2.5, 6.5, 3]], keepOut: [[sx, -far * 0.5, far * 0.5]], times: null };
  },
  // dusk: a stranger at the edge of the firelight; the people at the fire have turned, an older man has stood up
  (R) => {
    const fx = 0, fz = 0, figures = [], props = [{ type: 'fire', x: fx, z: fz, o: { size: 1.0 } }, { type: 'shelter', x: R.range(-6, -4.5), z: R.range(-3, -1.5), o: { size: 1.1 } }, { type: 'hide', x: 1.3, z: -1.0 }];
    const sa = R.range(-0.6, 0.6), sd = R.range(7, 10), sx = Math.sin(sa) * sd, sz = -Math.cos(sa) * sd;
    figures.push({ kind: 'man', pose: R() < 0.5 ? 'spear' : 'stand', x: sx, z: sz, yaw: face(sx, sz, fx, fz), hold: R() < 0.5 ? { type: 'spear', hand: 'r', o: { length: 2.0 } } : null });
    for (let i = 0, n = 3 + Math.floor(R() * 3); i < n; i++) {
      const a = PI * 0.25 + (i / n) * PI * 1.5 + R() * 0.25, x = fx + Math.sin(a) * 1.3, z = fz + Math.cos(a) * 1.3, yaw = face(x, z, fx, fz);
      figures.push({ kind: R.pick(['man', 'woman', 'teen', 'old']), pose: R() < 0.5 ? 'sitKnees' : 'sitCross', x, z, yaw, o: { lookY: turnTo(x, z, sx, sz, yaw), headDown: -0.05 } });
    }
    const ox = R.range(-1.6, -1.0), oz = R.range(-1.6, -1.0);
    figures.push({ kind: 'old', pose: 'stand', x: ox, z: oz, yaw: face(ox, oz, sx, sz), alarm: true, o: { headDown: -0.03 } });
    return { figures, props, focus: { x: ox, z: oz }, camera: { pos: [R.range(-1.5, 1.5), R.range(1.1, 1.4), R.range(4.5, 5.5)], target: [sx * 0.6, 0.9, sz * 0.6], fov: R.range(34, 40), push: 0.1 }, clear: [[0, 0, 6, 3]], times: ['dusk', 'night'] };
  },
  // women digging for roots straighten up: a stranger is walking towards them; one holds a girl by the arm
  (R) => {
    const figures = [], props = [], sx = R.range(-6, 6), sz = -R.range(13, 20);
    for (let i = 0; i < 2 + Math.floor(R() * 2); i++) { const x = R.range(-3, 3), z = R.range(-1, 2); figures.push({ kind: R() < 0.8 ? 'woman' : 'old', pose: R() < 0.4 ? 'crouch' : 'stand', x, z, yaw: face(x, z, sx, sz), o: { lookY: 0 } }); props.push({ type: 'stick', x: x + 0.4, z: z + 0.3, yaw: R() * 3, lean: PI / 2 }); }
    const wx = R.range(-1, 1), wz = R.range(1.5, 2.5), wy = face(wx, wz, sx, sz);
    figures.push({ kind: 'woman', pose: 'guard', x: wx, z: wz, yaw: wy, alarm: true });
    figures.push({ kind: 'child', pose: 'stand', x: wx + Math.cos(wy) * 0.36, z: wz - Math.sin(wy) * 0.36, yaw: wy, o: { lookY: 0 } });
    figures.push(...walkers(R, 1, sx, sz, wx, wz, 0.7));
    return { figures, props, focus: { x: wx, z: wz }, camera: { pos: [R.range(-3, 3), R.range(1.0, 1.4), R.range(6, 7.5)], target: [sx * 0.5, 0.8, sz * 0.5], fov: R.range(32, 40), push: 0.12 }, clear: [[0, 1, 5, 3]], keepOut: [[sx * 0.5, sz * 0.5, 8]] };
  },
  // the band on the move has halted in single file: far ahead, another group has halted too. Seen from the side.
  (R) => {
    const figures = [], n = 4 + Math.floor(R() * 4), gap = R.range(1.2, 1.7);
    for (let i = 0; i < n; i++) figures.push({ kind: R.pick(['man', 'woman', 'woman', 'teen', 'child', 'old']), pose: R() < 0.3 ? 'carryHead' : R() < 0.5 ? 'spear' : 'stand', x: R.range(-0.3, 0.3), z: 2 + i * gap, yaw: Math.PI + R.range(-0.15, 0.15), hold: R() < 0.3 ? { type: 'spear', hand: 'r', o: { length: 2 } } : null, alarm: i === 0 });
    const ox = R.range(-3, 3), oz = -R.range(16, 24);
    for (let i = 0, k = 2 + Math.floor(R() * 3); i < k; i++) figures.push({ kind: strangerKind(R), pose: R() < 0.5 ? 'spear' : 'stand', x: ox + (i - k / 2) * R.range(0.8, 1.4), z: oz + R.range(-0.6, 0.6), yaw: R.range(-0.2, 0.2), hold: R() < 0.5 ? spearInHand : null });
    const side = R() < 0.5 ? 1 : -1;
    const end = 2 + n * gap;
    return { figures, props: [], focus: { x: 0, z: end - gap * 1.5 }, camera: { pos: [side * R.range(1.6, 2.6), R.range(1.4, 1.7), end + R.range(1.0, 2.0)], target: [ox * 0.6, 0.9, oz * 0.7], fov: R.range(30, 36), push: 0.1 }, clear: [], keepOut: [[ox * 0.5, oz * 0.5, 7]] };
  },
  // children who were playing run back to the adults, who are staring at strangers coming over the rise
  (R) => {
    const figures = [], props = [{ type: 'fire', x: R.range(2, 4), z: R.range(-1, 1), o: { size: 0.7, shadows: false } }, { type: 'shelter', x: R.range(4.5, 6.5), z: R.range(-4, -2.5), o: { size: 1.1 } }];
    const sx = R.range(-8, 8), sz = -R.range(20, 30);
    for (let i = 0, n = 2 + Math.floor(R() * 2); i < n; i++) { const x = R.range(-3.5, 1.5), z = R.range(-1.5, 0.5); figures.push({ kind: R() < 0.6 ? 'man' : 'woman', pose: R() < 0.5 ? 'stand' : 'shade', x, z, yaw: face(x, z, sx, sz), alarm: i === 0 }); }
    for (let i = 0, n = 2 + Math.floor(R() * 2); i < n; i++) { const x = R.range(-2.5, 2.5), z = R.range(-6, -3.5); figures.push({ kind: R() < 0.6 ? 'child' : 'toddler', pose: 'walk', x, z, yaw: face(x, z, 0, 3) + R.range(-0.2, 0.2), walk: { speed: 1.5 }, o: { speed: 1.6, stride: 0.6 } }); }
    figures.push(...walkers(R, 2 + Math.floor(R() * 2), sx, sz, 0, 0, 0.7));
    return { figures, props, focus: { x: 0, z: -2 }, camera: { pos: [R.range(-2, 2), R.range(1.2, 1.5), R.range(5.5, 7)], target: [sx * 0.4, 0.9, sz * 0.5], fov: R.range(32, 38), push: 0.12 }, clear: [[0, -1, 6, 3]], keepOut: [[sx * 0.5, sz * 0.5, 10]] };
  },
];

export const strangers = {
  times: ['day', 'day', 'dusk', 'morning'],
  compose({ R }) { const v = VARIANTS[Math.floor(R() * VARIANTS.length)](R); if (v.times) this.lastTimes = v.times; return v; },
};
