// Parametric human figure, drawn as a faceless silhouette (the Demismatch mannequin).
// All figures share one body; posture carries the meaning.
// drawFigure(ctx, x, y, h, opts): feet at (x, y), height h in px.
// opts.facing: 1 = right, -1 = left, 0 = toward the viewer.

const TAU = Math.PI * 2;

// closed smooth curve through points (midpoint quadratic splines)
function smoothClosed(ctx, P) {
  const n = P.length;
  ctx.moveTo((P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2);
  for (let i = 1; i <= n; i++) {
    const a = P[i % n], b = P[(i + 1) % n];
    ctx.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  ctx.closePath();
}

// a tapered limb segment: two circles joined by their outer tangents
export function capsule(ctx, x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy);
  if (d <= Math.abs(r1 - r2) + 1e-6) { const r = Math.max(r1, r2), cx = r1 > r2 ? x1 : x2, cy = r1 > r2 ? y1 : y2; ctx.moveTo(cx + r, cy); ctx.arc(cx, cy, r, 0, TAU); return; }
  const a = Math.atan2(dy, dx);
  const b = Math.acos((r1 - r2) / d);
  ctx.moveTo(x1 + r1 * Math.cos(a + b), y1 + r1 * Math.sin(a + b));
  ctx.arc(x1, y1, r1, a + b, a - b + TAU, false);
  ctx.arc(x2, y2, r2, a - b, a + b, false);
  ctx.closePath();
}

// Poses. Angles in radians. Side views: positive = toward the facing direction.
// legs: [hip, knee bend]; arms: [shoulder, elbow bend]; lean: spine; head: head tilt (down = positive).
export const POSES = {
  stand: { lean: 0.03, head: 0.06, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.1, 0.18], [-0.08, 0.14]] },
  hunch: { lean: 0.3, head: 0.6, legs: [[0.05, 0.05], [-0.04, 0.05]], arms: [[0.22, 0.32], [0.14, 0.38]] },
  reach: { lean: 0.1, head: -0.05, legs: [[0.16, 0.06], [-0.14, 0.06]], arms: [[1.45, 0.08], [1.2, 0.2]] },
  wave: { lean: 0.0, head: -0.02, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[2.75, 0.55], [-0.06, 0.14]] },
  carry: { lean: -0.04, head: 0.16, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.5, 1.6], [0.42, 1.75]], bundle: true },
  look: { lean: -0.05, head: -0.3, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.04, 0.2], [-0.1, 0.16]] },
  phone: { lean: 0.08, head: 0.75, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.32, 1.5], [0.26, 1.55]], phone: true },
  sitGround: { lean: 0.14, head: 0.18, seat: 'ground', arms: [[0.75, 0.75], [0.6, 0.9]] },
  sitChair: { lean: 0.03, head: 0.12, seat: 'chair', arms: [[0.32, 0.95], [0.24, 1.05]] },
  slump: { lean: 0.38, head: 0.65, seat: 'chair', arms: [[0.75, 0.9], [0.62, 1.0]] },
  slumpPhone: { lean: 0.34, head: 0.85, seat: 'chair', arms: [[0.45, 1.45], [0.38, 1.5]], phone: true },
  sitFire: { lean: 0.22, head: 0.22, seat: 'ground', arms: [[1.05, 0.35], [0.95, 0.45]] },
  sitArm: { lean: 0.1, head: 0.12, seat: 'ground', arms: [[1.35, 0.15], [0.6, 0.9]] },
  eat: { lean: 0.02, head: 0.05, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.75, 2.25], [-0.04, 0.15]] },
  pick: { lean: -0.06, head: -0.45, legs: [[0.08, 0.03], [-0.08, 0.03]], arms: [[2.55, 0.15], [0.1, 0.15]] },
  throw: { lean: -0.12, head: -0.25, legs: [[0.25, 0.1], [-0.25, 0.05]], arms: [[2.7, 0.25], [-0.5, 0.2]] },
  push: { lean: 0.42, head: -0.1, legs: [[0.32, 0.45], [-0.32, 0.08]], arms: [[1.45, 0.25], [1.35, 0.3]] },
  crouch: { lean: 0.3, head: -0.35, legs: [[0.75, 1.2], [0.35, 1.05]], arms: [[0.6, 0.6], [0.3, 0.7]] },
  touch: { lean: 0.04, head: 0.1, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[1.15, 0.25], [-0.05, 0.14]] },
  holdHand: { lean: 0.02, head: 0.0, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.5, 0.05], [-0.06, 0.14]] },
  tell: { lean: -0.03, head: -0.1, legs: [[0.08, 0.03], [-0.06, 0.03]], arms: [[1.35, -0.55], [0.55, 0.9]] },
  shoulderPole: { lean: 0.05, head: 0.05, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[2.2, 0.75], [2.0, 0.85]] },
  hug: { lean: 0.08, head: 0.2, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[1.1, 0.9], [1.0, 1.0]] },
};
export const runPose = (phase) => walkPose(phase, { stride: 1.55, swing: 1.7, lean: 0.16 });

// a figure lying on its back along the ground, head to the right
export function drawLying(ctx, x, y, h, opts = {}) {
  ctx.save(); ctx.translate(x, y - h * 0.06); ctx.rotate(Math.PI / 2);
  drawFigure(ctx, 0, 0, h, { ...opts, facing: 1, pose: { lean: 0, head: 0.1, legs: [[0.02, 0.02], [-0.02, 0.02]], arms: [[0.15, 0.2], [0.1, 0.2]] } });
  ctx.restore();
}

export function walkPose(phase, { stride = 1, swing = 1, lean = 0.05 } = {}) {
  const leg = (p) => [0.36 * stride * Math.sin(p), 0.05 + 0.68 * stride * Math.max(0, Math.cos((p - 0.4) * 1.2)) ** 2];
  const s = Math.sin(phase);
  return {
    lean, head: 0.05, bob: Math.abs(Math.cos(phase)) * 0.008,
    legs: [leg(phase), leg(phase + Math.PI)],
    arms: [[-0.34 * swing * s, 0.22 + 0.3 * swing * Math.max(0, -s)], [0.34 * swing * s, 0.22 + 0.3 * swing * Math.max(0, s)]],
  };
}

// body types: proportions vary a little so a crowd never looks cloned
export function rnd(seed, k) { const v = Math.sin((seed + 1) * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); }
export function body(seed = 0, kind = 'adult') {
  const r = (k) => rnd(seed, k);
  if (kind === 'child') return { kind, head: 0.19, girth: 0.95, legs: 0.43, hair: r(3) < 0.4 ? 1 : 0, sh: 0.23 };
  if (kind === 'toddler') return { kind, head: 0.235, girth: 1.08, legs: 0.36, hair: 0, sh: 0.24 };
  return {
    kind,
    head: 0.125 + r(1) * 0.012,
    girth: 0.9 + r(4) * 0.22,
    legs: 0.475 + r(5) * 0.025,
    sh: 0.235 + r(2) * 0.04,
    hair: r(3) < 0.3 ? 2 : r(3) < 0.5 ? 1 : 0, // 2 = bun, 1 = long
  };
}

export function drawFigure(ctx, x, y, h, opts = {}) {
  const P = opts.pose || POSES.stand;
  const f = opts.facing ?? 1;
  const B = opts.body || body(0);
  const col = opts.color || '#16141c';
  const far = opts.farColor || col;
  if (h < 4) { // too small for limbs: a short stroke
    ctx.fillStyle = col; const w = Math.max(0.6, h * 0.26); ctx.fillRect(x - w / 2, y - h, w, h); return;
  }
  ctx.save();
  if (opts.alpha !== undefined) ctx.globalAlpha *= opts.alpha;
  if (f === 0) drawFront(ctx, x, y, h, P, B, col);
  else drawSide(ctx, x, y, h, P, B, col, far, f, opts);
  ctx.restore();
}

function drawSide(ctx, x, y, h, P, B, col, far, f, opts) {
  const g = B.girth;
  const legL = h * B.legs, thigh = legL * 0.51, shin = legL * 0.49;
  const torso = h * (1 - B.legs) - h * B.head * 1.58; // pelvis to shoulder top
  const k = h; // unit
  const lw = { hip: 0.056 * k * g, knee: 0.032 * k * g, calf: 0.036 * k * g, ankle: 0.021 * k, sh: 0.035 * k * g, elbow: 0.026 * k * g, wrist: 0.018 * k };
  const lean = P.lean || 0, ht = P.head || 0;
  // pelvis position relative to the feet
  let pel = [0, 0];
  let legs;
  if (P.seat === 'chair') {
    const seatH = shin + lw.ankle * 1.3;
    pel = [0, -seatH];
    legs = [0, 0.035].map((dx) => ({ kx: thigh * 0.97 + dx * k, ky: pel[1] - 0.004 * k, ax: thigh * 0.97 + dx * k + 0.012 * k, ay: -lw.ankle, calfOut: -1 }));
  } else if (P.seat === 'ground') {
    pel = [0, -lw.hip * 0.95];
    legs = [0, 0.03].map((dx) => {
      const kx = thigh * 0.66 + dx * k, ky = pel[1] - thigh * 0.74;
      return { kx, ky, ax: kx + shin * 0.36, ay: -lw.ankle, calfOut: 1 };
    });
  } else {
    legs = P.legs.map(([hip, kb]) => {
      const kx = Math.sin(hip) * thigh, ky = Math.cos(hip) * thigh;
      const sa = hip - kb;
      return { kx, ky, ax: kx + Math.sin(sa) * shin, ay: ky + Math.cos(sa) * shin, sa };
    });
    const low = Math.max(legs[0].ay, legs[1].ay);
    pel = [0, -(low + lw.ankle) - (P.bob || 0) * h];
    legs = legs.map((L) => ({ ...L, ky: L.ky + pel[1], ay: L.ay + pel[1] }));
  }
  // spine frame
  const ux = Math.sin(lean), uy = -Math.cos(lean), vx = Math.cos(lean), vy = Math.sin(lean);
  const at = (s, v) => [pel[0] + ux * s + vx * v, pel[1] + uy * s + vy * v]; // s, v in px
  const S = torso / 0.3; // the outline below is authored for a torso of 0.30 units
  const T = (s, v) => at(s * S, v * k * g);
  const X = (v) => x + v * f, Y = (v) => y + v;
  const shoulder = T(0.275, -0.004);
  const neckTop = (() => { const a = lean + ht * 0.45; return [shoulder[0] + Math.sin(a) * 0.07 * k, shoulder[1] - Math.cos(a) * 0.07 * k]; })();
  const headR = h * B.head * 0.5;
  const ha = lean + ht;
  const head = [neckTop[0] + Math.sin(ha) * headR * 0.62 + Math.cos(ha) * headR * 0.12, neckTop[1] - Math.cos(ha) * headR * 0.62 + Math.sin(ha) * headR * 0.12];
  const arm = (a, e) => {
    const up = 0.168 * k, fo = 0.15 * k;
    const ex = shoulder[0] + Math.sin(a) * up, ey = shoulder[1] + Math.cos(a) * up;
    return { ex, ey, wx: ex + Math.sin(a + e) * fo, wy: ey + Math.cos(a + e) * fo, a: a + e };
  };
  const arms = P.arms.map(([a, e]) => arm(a, e));
  const fillPath = (fn, c) => { ctx.beginPath(); fn(); ctx.fillStyle = c; ctx.fill(); };
  const drawLeg = (L) => {
    const calf = [L.kx + (L.ax - L.kx) * 0.32 - (L.calfOut ?? -1) * 0.006 * k, L.ky + (L.ay - L.ky) * 0.32];
    capsule(ctx, X(pel[0]), Y(pel[1]), lw.hip, X(L.kx), Y(L.ky), lw.knee);
    capsule(ctx, X(L.kx), Y(L.ky), lw.knee, X(calf[0]), Y(calf[1]), lw.calf);
    capsule(ctx, X(calf[0]), Y(calf[1]), lw.calf, X(L.ax), Y(L.ay), lw.ankle);
    capsule(ctx, X(L.ax - 0.012 * k), Y(L.ay + lw.ankle * 0.45), lw.ankle * 0.95, X(L.ax + 0.052 * k), Y(L.ay + lw.ankle * 0.62), lw.ankle * 0.5);
  };
  const drawArm = (A) => {
    capsule(ctx, X(shoulder[0]), Y(shoulder[1]), lw.sh, X(A.ex), Y(A.ey), lw.elbow);
    capsule(ctx, X(A.ex), Y(A.ey), lw.elbow, X(A.wx), Y(A.wy), lw.wrist);
    const hx = A.wx + Math.sin(A.a) * 0.03 * k, hy = A.wy + Math.cos(A.a) * 0.03 * k;
    capsule(ctx, X(A.wx), Y(A.wy), lw.wrist, X(hx), Y(hy), lw.wrist * 1.12);
  };
  // far side
  fillPath(() => { drawLeg(legs[1]); drawArm(arms[1]); }, far);
  // body
  fillPath(() => {
    const O = [
      [-0.035, -0.02], [0.0, -0.064], [0.055, -0.06], [0.12, -0.046], [0.19, -0.052], [0.25, -0.058], [0.293, -0.042],
      [0.31, -0.008], [0.302, 0.028], [0.262, 0.06], [0.212, 0.066], [0.165, 0.056], [0.105, 0.05], [0.045, 0.056], [-0.005, 0.046], [-0.035, 0.03],
    ].map(([s, v]) => { const p = T(s, v); return [X(p[0]), Y(p[1])]; });
    smoothClosed(ctx, O);
    // shoulder, neck, head
    ctx.moveTo(X(shoulder[0]) + lw.sh * 1.25, Y(shoulder[1])); ctx.arc(X(shoulder[0]), Y(shoulder[1]), lw.sh * 1.25, 0, TAU);
    capsule(ctx, X(shoulder[0] - Math.cos(lean) * 0.008 * k), Y(shoulder[1] + 0.006 * k), 0.037 * k, X(neckTop[0]), Y(neckTop[1]), 0.031 * k);
    ctx.moveTo(X(head[0]) + headR, Y(head[1]));
    ctx.ellipse(X(head[0]), Y(head[1]), headR * 0.9, headR * 1.04, ha * f * 0.85, 0, TAU);
    if (B.hair === 2) {
      const bx = head[0] - Math.cos(ha) * headR * 0.92 + Math.sin(ha) * headR * 0.2, by = head[1] - Math.sin(ha) * headR * 0.92 - Math.cos(ha) * headR * 0.2;
      ctx.moveTo(X(bx) + headR * 0.4, Y(by)); ctx.arc(X(bx), Y(by), headR * 0.4, 0, TAU);
    }
    if (B.hair === 1) {
      const b1 = [head[0] - Math.cos(ha) * headR * 0.45, head[1] - Math.sin(ha) * headR * 0.45];
      const b2 = [head[0] - Math.cos(ha) * headR * 0.7 - Math.sin(ha) * headR * 1.3, head[1] - Math.sin(ha) * headR * 0.7 + Math.cos(ha) * headR * 1.3];
      capsule(ctx, X(b1[0]), Y(b1[1]), headR * 0.78, X(b2[0]), Y(b2[1]), headR * 0.42);
    }
  }, col);
  // near side
  fillPath(() => { drawLeg(legs[0]); }, col);
  if (P.bundle) {
    const bx = (arms[0].wx + arms[1].wx) / 2 + 0.01 * k, by = (arms[0].wy + arms[1].wy) / 2 - 0.03 * k;
    fillPath(() => {
      ctx.ellipse(X(bx), Y(by), 0.07 * k, 0.045 * k, -0.35 * f, 0, TAU);
      ctx.moveTo(X(bx + 0.062 * k) + 0.032 * k, Y(by - 0.035 * k)); ctx.arc(X(bx + 0.062 * k), Y(by - 0.035 * k), 0.032 * k, 0, TAU);
    }, opts.bundleColor || col);
  }
  fillPath(() => { drawArm(arms[0]); }, col);
  if (P.phone && opts.screen) { // a small lit screen in the hands
    const px = (arms[0].wx + arms[1].wx) / 2 + 0.03 * k, py = (arms[0].wy + arms[1].wy) / 2 - 0.02 * k;
    ctx.save(); ctx.translate(X(px), Y(py)); ctx.rotate(-0.9 * f);
    ctx.fillStyle = opts.screen; ctx.fillRect(-0.012 * k, -0.026 * k, 0.024 * k, 0.052 * k); ctx.restore();
  }
}

function drawFront(ctx, x, y, h, P, B, col) {
  const k = h, g = B.girth;
  const legL = h * B.legs;
  const headR = h * B.head * 0.5;
  const pelY = y - legL;
  const shY = pelY - (h * (1 - B.legs) - h * B.head * 1.58) * 0.97;
  const sw = B.sh * 0.5 * k * (0.94 + 0.06 * g);
  const waist = 0.072 * k * g, hipW = 0.088 * k * g;
  ctx.beginPath();
  // legs
  for (const s of [-1, 1]) {
    capsule(ctx, x + s * hipW * 0.5, pelY + 0.01 * k, 0.05 * k * g, x + s * hipW * 0.56, y - 0.25 * k, 0.03 * k);
    capsule(ctx, x + s * hipW * 0.56, y - 0.25 * k, 0.032 * k, x + s * hipW * 0.6, y - 0.03 * k, 0.021 * k);
    capsule(ctx, x + s * hipW * 0.6, y - 0.018 * k, 0.02 * k, x + s * (hipW * 0.6 + 0.022 * k), y - 0.012 * k, 0.014 * k);
  }
  // torso
  const O = [
    [-sw * 0.5, shY - 0.016 * k], [sw * 0.5, shY - 0.016 * k], [sw * 0.92, shY + 0.008 * k], [sw * 1.0, shY + 0.06 * k],
    [waist * 1.12, shY + 0.16 * k], [waist, pelY - 0.07 * k], [hipW * 1.02, pelY + 0.005 * k], [hipW * 0.7, pelY + 0.05 * k],
    [-hipW * 0.7, pelY + 0.05 * k], [-hipW * 1.02, pelY + 0.005 * k], [-waist, pelY - 0.07 * k], [-waist * 1.12, shY + 0.16 * k],
    [-sw * 1.0, shY + 0.06 * k], [-sw * 0.92, shY + 0.008 * k],
  ].map(([dx, yy]) => [x + dx, yy]);
  smoothClosed(ctx, O);
  // arms
  const fa = P.frontArms || [[0.1, 0.06], [0.1, 0.06]];
  [-1, 1].forEach((s, i) => {
    const [a, e] = fa[i];
    const sx0 = x + s * sw * 0.86, sy0 = shY + 0.035 * k;
    const ex = sx0 + s * Math.sin(a) * 0.165 * k, ey = sy0 + Math.cos(a) * 0.165 * k;
    const wx = ex + s * Math.sin(a + e) * 0.15 * k, wy = ey + Math.cos(a + e) * 0.15 * k;
    capsule(ctx, sx0, sy0, 0.034 * k * g, ex, ey, 0.025 * k * g);
    capsule(ctx, ex, ey, 0.025 * k * g, wx, wy, 0.018 * k);
    capsule(ctx, wx, wy, 0.018 * k, wx + s * Math.sin(a + e) * 0.03 * k, wy + Math.cos(a + e) * 0.03 * k, 0.02 * k);
  });
  // neck and head
  capsule(ctx, x, shY + 0.01 * k, 0.034 * k, x, shY - 0.05 * k, 0.03 * k);
  const hy = shY - 0.05 * k - headR * 0.8;
  ctx.moveTo(x + headR * 0.86, hy); ctx.ellipse(x, hy, headR * 0.86, headR * 1.04, 0, 0, TAU);
  if (B.hair === 2) { ctx.moveTo(x + headR * 0.38, hy - headR * 1.02); ctx.arc(x, hy - headR * 1.02, headR * 0.38, 0, TAU); }
  if (B.hair === 1) { for (const s of [-1, 1]) capsule(ctx, x + s * headR * 0.62, hy - headR * 0.25, headR * 0.42, x + s * headR * 0.72, hy + headR * 1.25, headR * 0.3); }
  ctx.fillStyle = col; ctx.fill();
}
