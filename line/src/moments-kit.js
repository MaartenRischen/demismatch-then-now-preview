// Close-up scenes of you, in the moment you'd recognise: one red person, big, in a room you know.
// Every scene is a painter (c, w, h, t) => void, drawn at any size; the site crops it to the right-hand picture.
// Units: gy is the floor line, P = h (the frame height) so sizes scale with the picture.
import { TAU, clamp, lerp, smooth, mix, alpha, hash, glow } from '../../v4/src/art.js';
import { drawFigure, drawLying, POSES, body } from '../../v4/src/figure.js';
import { signal } from '../../v4/src/props.js';
import { HELP } from './frame.js';

export { TAU, clamp, lerp, smooth, mix, alpha, hash, glow, drawFigure, drawLying, POSES, body, HELP };
export const RED = '#E0201A', RED2 = '#A0140F', SIG = '#E2A93A', INK = '#1B1922', INK2 = '#2C2A36';

// poses for close-ups (pose objects: lean, head, legs [[hip, knee]], arms [[shoulder, elbow]], seat)
export const P = {
  ...POSES,
  armsCrossed: { lean: 0.02, head: 0.25, legs: [[0.04, 0.03], [-0.04, 0.03]], arms: [[0.2, 2.25], [0.15, 2.35]] },
  holdCup: { lean: 0.0, head: 0.08, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.25, 1.95], [-0.05, 0.15]] },
  talkCup: { lean: -0.03, head: -0.06, legs: [[0.08, 0.03], [-0.06, 0.03]], arms: [[0.55, 1.1], [0.2, 2.0]] },
  laugh: { lean: -0.1, head: -0.32, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.25, 2.1], [0.05, 0.2]] },
  sitKnees: { lean: 0.3, head: 0.45, seat: 'ground', arms: [[0.7, 0.35], [0.6, 0.45]] },
  sitBedPhone: { lean: 0.18, head: 0.8, seat: 'ground', arms: [[0.5, 1.5], [0.4, 1.55]], phone: true },
  deskLook: { lean: 0.05, head: -0.25, seat: 'chair', arms: [[0.75, 0.75], [0.35, 1.0]] },
  headInHand: { lean: 0.42, head: 0.55, seat: 'chair', arms: [[1.1, 1.9], [0.9, 0.9]] },
  sitHug: { lean: 0.2, head: 0.35, seat: 'chair', arms: [[1.05, 1.2], [0.95, 1.3]] },
  present: { lean: 0.04, head: 0.12, legs: [[0.06, 0.03], [-0.06, 0.03]], arms: [[1.0, 1.15], [0.95, 1.25]] },
  watch: { lean: 0.0, head: 0.05, seat: 'chair', arms: [[0.3, 0.9], [0.2, 1.0]] },
  reachUp: { lean: -0.04, head: -0.2, legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[2.4, 0.3], [0.1, 0.2]] },
  rock: (t) => ({ lean: 0.12 + 0.05 * Math.sin(t * 1.6), head: 0.3, seat: 'chair', arms: [[0.75, 1.55], [0.65, 1.65]] }),
};

// a person: red if it's you, a dark silhouette otherwise; rim light on one side
export function person(c, x, gy, hh, pose, { you = false, f = 1, i = 0, kind = 'adult', rim = null, side = 1, col = null, a = 1 } = {}) {
  const o = { pose, facing: f, body: you ? body(0, kind) : body(i * 13 + 5, kind), color: you ? RED : col || INK, farColor: you ? RED2 : mix(col || INK, '#000000', -0.0), screen: '#DDEBFF', alpha: a };
  if (rim) drawFigure(c, x + side * hh * 0.012, gy, hh, { ...o, color: rim, farColor: rim });
  drawFigure(c, x, gy, hh, o);
}
// the head of a person drawn by person(): roughly where the rings go
export const headAt = (x, gy, hh, f = 1, seated = false) => [x + f * hh * 0.06, gy - hh * (seated ? 0.8 : 0.93)];
// your alarm, firing
export function rings(c, x, y, r, t, on = 1) { signal(c, x, y, r, t, on, SIG); }

// walls and floor: flat colour with a little falloff, floor with a skirting line
export function room(c, w, h, { wall = '#34323F', floor = '#24222B', gy = h * 0.9, top = 0 } = {}) {
  const g = c.createLinearGradient(0, top, 0, gy); g.addColorStop(0, mix(wall, '#000000', 0.25)); g.addColorStop(1, wall);
  c.fillStyle = g; c.fillRect(0, top, w, gy - top);
  c.fillStyle = floor; c.fillRect(0, gy, w, h - gy);
  c.fillStyle = mix(wall, '#000000', 0.35); c.fillRect(0, gy - h * 0.012, w, h * 0.012);
}
// a window onto somewhere: sky gradient plus whatever paint() draws, with a frame
export function windowOn(c, x, y, ww, wh, paint, { frame = '#D8D2C6', bars = true } = {}) {
  c.save(); c.beginPath(); c.rect(x, y, ww, wh); c.clip(); paint(c, x, y, ww, wh); c.restore();
  c.strokeStyle = frame; c.lineWidth = Math.max(2, ww * 0.025); c.strokeRect(x, y, ww, wh);
  if (bars) { c.beginPath(); c.moveTo(x + ww / 2, y); c.lineTo(x + ww / 2, y + wh); c.stroke(); }
  c.fillStyle = frame; c.fillRect(x - ww * 0.04, y + wh, ww * 1.08, Math.max(3, wh * 0.035));
}
export function sky(c, x, y, ww, wh, top, bottom) { const g = c.createLinearGradient(0, y, 0, y + wh); g.addColorStop(0, top); g.addColorStop(1, bottom); c.fillStyle = g; c.fillRect(x, y, ww, wh); }
// lit windows of a city at night, filling a box
export function cityNight(c, x, y, ww, wh, t, seed = 1, n = 6) {
  sky(c, x, y, ww, wh, '#0B1026', '#26284A');
  for (let i = 0; i < n; i++) {
    const bw = ww / n * (0.8 + hash(i * 2.1 + seed) * 0.5), bx = x + (i / n) * ww - bw * 0.1, bh = wh * (0.35 + hash(i * 3.3 + seed) * 0.55);
    c.fillStyle = mix('#12122A', '#1E1E36', hash(i + seed)); c.fillRect(bx, y + wh - bh, bw, bh);
    const s = Math.max(3, ww * 0.018);
    for (let yy = y + wh - bh + s; yy < y + wh - s; yy += s * 1.8) for (let xx = bx + s * 0.6; xx < bx + bw - s; xx += s * 1.5) {
      const k = hash(xx * 1.3 + yy * 2.7 + seed);
      if (k < 0.45) { c.fillStyle = alpha(k < 0.12 ? '#9EC4FF' : '#FFD08A', 0.55 + 0.4 * Math.sin(t * 0.4 + k * 40)); c.fillRect(xx, yy, s * 0.7, s * 0.9); }
    }
  }
}
// a door frame, open, with light from the hall behind
export function doorway(c, x, gy, dh, dw, light = '#F2D7A8', wall = '#34323F') {
  c.fillStyle = light; c.fillRect(x, gy - dh, dw, dh);
  const g = c.createLinearGradient(x, 0, x + dw, 0); g.addColorStop(0, alpha('#000000', 0)); g.addColorStop(1, alpha('#000000', 0.25)); c.fillStyle = g; c.fillRect(x, gy - dh, dw, dh);
  c.fillStyle = mix(wall, '#000000', 0.45); c.fillRect(x - dw * 0.07, gy - dh - dw * 0.07, dw * 0.07, dh + dw * 0.07); c.fillRect(x + dw, gy - dh - dw * 0.07, dw * 0.07, dh + dw * 0.07); c.fillRect(x - dw * 0.07, gy - dh - dw * 0.07, dw * 1.14, dw * 0.07);
}
// a bed seen from the side, pillow at the left or right
export function bedSide(c, x0, x1, gy, s, { col = '#3A3850', sheet = '#5A5878', pillow = 'left' } = {}) {
  const hgt = s * 0.3;
  c.fillStyle = mix(col, '#000000', 0.35); c.fillRect(x0, gy - hgt, x1 - x0, hgt);
  c.fillStyle = sheet; c.beginPath(); c.roundRect(x0 - s * 0.01, gy - hgt - s * 0.06, x1 - x0 + s * 0.02, s * 0.1, s * 0.03); c.fill();
  const px = pillow === 'left' ? x0 + s * 0.04 : x1 - s * 0.26;
  c.fillStyle = mix(sheet, '#FFFFFF', 0.3); c.beginPath(); c.roundRect(px, gy - hgt - s * 0.12, s * 0.22, s * 0.08, s * 0.035); c.fill();
  c.fillStyle = mix(col, '#000000', 0.2); const hb = pillow === 'left' ? x0 - s * 0.03 : x1; c.fillRect(hb, gy - hgt - s * 0.32, s * 0.03, hgt + s * 0.32);
  return gy - hgt - s * 0.05; // the mattress top, where a sitter's seat is
}
// a digital clock face
export function digital(c, x, y, s, text, col = '#7FD6FF') {
  c.fillStyle = '#111016'; c.beginPath(); c.roundRect(x - s * 0.9, y - s * 0.45, s * 1.8, s * 0.9, s * 0.12); c.fill();
  c.fillStyle = col; c.font = `700 ${Math.round(s * 0.62)}px "PT Sans Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + s * 0.03);
  c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, s * 1.6, col, 0.12); c.restore(); c.textAlign = 'left';
}
// a phone in a hand: a glowing slab, with what's on it drawn by paint()
export function phoneGlow(c, x, y, s, t, col = '#BFD8FF') { c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x, y, s, col, 0.35); c.restore(); }
// the finish every scene gets: darkness with light holes, a vignette, a little grain
export function finish(c, w, h, t, { dark = 'rgba(8,6,16,0.55)', lights = [], vig = 0.45 } = {}) {
  if (lights.length) HELP.lightmap(c, w, h, dark, lights); else if (dark) { c.fillStyle = dark; c.fillRect(0, 0, w, h); }
  HELP.vignette(c, w, h, vig);
}
// a long sofa seen from the side-front: seat top at gy - seat, back behind
export function couch(c, x0, x1, gy, seat, col = '#4A4658') {
  c.fillStyle = mix(col, '#000000', 0.25); c.beginPath(); c.roundRect(x0, gy - seat * 2.1, x1 - x0, seat * 1.4, seat * 0.18); c.fill();
  c.fillStyle = col; c.beginPath(); c.roundRect(x0 - seat * 0.15, gy - seat * 1.02, x1 - x0 + seat * 0.3, seat * 0.62, seat * 0.14); c.fill();
  c.fillStyle = mix(col, '#000000', 0.15); c.beginPath(); c.roundRect(x0 - seat * 0.3, gy - seat * 1.45, seat * 0.32, seat * 1.05, seat * 0.12); c.fill(); c.beginPath(); c.roundRect(x1 - seat * 0.02, gy - seat * 1.45, seat * 0.32, seat * 1.05, seat * 0.12); c.fill();
  c.fillStyle = mix(col, '#000000', 0.5); c.fillRect(x0, gy - seat * 0.4, seat * 0.08, seat * 0.4); c.fillRect(x1 - seat * 0.08, gy - seat * 0.4, seat * 0.08, seat * 0.4);
}
// a glowing screen floating beside someone: what they're looking at, big enough to read
export function screen(c, x, y, sw, sh, t, paint, col = '#CFE0FF') {
  c.save(); c.globalCompositeOperation = 'lighter'; glow(c, x + sw / 2, y + sh / 2, Math.max(sw, sh) * 0.9, col, 0.18); c.restore();
  c.fillStyle = '#0D0C12'; c.beginPath(); c.roundRect(x - sw * 0.05, y - sw * 0.05, sw * 1.1, sh + sw * 0.1, sw * 0.12); c.fill();
  c.save(); c.beginPath(); c.roundRect(x, y, sw, sh, sw * 0.07); c.clip(); paint(c, x, y, sw, sh); c.restore();
}
// a line from someone's hand to the screen they're holding up
export function tether(c, x0, y0, x1, y1, col = '#CFE0FF') { c.save(); c.strokeStyle = alpha(col, 0.35); c.setLineDash([3, 4]); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.restore(); }

