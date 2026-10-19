// The right-hand pictures: you, close up, in a moment you'd recognise. One painter per topic key.
import { TAU, clamp, mix, alpha, hash, glow, person, headAt, rings, room, windowOn, sky, cityNight, doorway, bedSide, digital, finish, couch, screen, tether, drawLying, drawFigure, body, HELP, P, RED, RED2, INK, INK2 } from './moments-kit.js';

export const MOMENTS = {};

// walking into a room full of people you don't know
MOMENTS.strangers = (c, w, h, t) => {
  const gy = h * 0.93, hh = h * 0.7;
  room(c, w, h, { wall: '#4A3B42', floor: '#2A2228', gy });
  doorway(c, w * 0.05, gy, h * 0.66, w * 0.12, '#F4DDB0', '#4A3B42');
  // string lights along the top
  const lights = [{ x: w * 0.11, y: gy - h * 0.35, r: h * 0.5, col: '#FFE0A8', glow: 0.2 }];
  for (let i = 0; i < 14; i++) { const x = w * (0.2 + i * 0.06), y = h * (0.09 + 0.04 * Math.sin(i * 0.9) ** 2); c.fillStyle = '#FFE7B0'; c.beginPath(); c.arc(x, y, h * 0.008, 0, TAU); c.fill(); if (i % 3 === 0) lights.push({ x, y, r: h * 0.28, col: '#FFC870', glow: 0.12 }); }
  HELP.lightmap(c, w, h, 'rgba(14,8,14,0.5)', lights);
  // the group, mid-conversation
  const grp = [[0.5, P.holdCup, 1, 0.94], [0.6, P.laugh, -1, 1.03], [0.7, P.talkCup, -1, 0.97], [0.83, P.talkCup, 1, 1.0], [0.93, P.laugh, -1, 0.92]];
  grp.forEach(([x, pose, f, s], i) => person(c, w * x, gy, hh * s, pose, { f, i: i + 2, rim: alpha('#FFD08A', 0.45), side: -1 }));
  // you, just inside the door
  const yx = w * 0.27; person(c, yx, gy, hh, P.armsCrossed, { you: true, f: 1, rim: alpha('#FFE7C0', 0.6), side: -1 });
  const [hx, hy] = headAt(yx, gy, hh); rings(c, hx, hy + hh * 0.08, hh * 0.32, t);
  HELP.vignette(c, w, h, 0.4);
};

// awake at 3 in the morning
MOMENTS.night = (c, w, h, t) => {
  const gy = h * 0.95, s = h;
  room(c, w, h, { wall: '#262A44', floor: '#16151E', gy });
  windowOn(c, w * 0.62, h * 0.12, w * 0.24, h * 0.42, (c2, x, y, ww, wh) => cityNight(c2, x, y, ww, wh, t, 3, 4), { frame: '#59597A' });
  const top = bedSide(c, w * 0.04, w * 0.58, gy, s * 0.95, { col: '#2C2B44', sheet: '#4C4A6E', pillow: 'left' });
  // bedside table and clock
  c.fillStyle = '#1C1B2A'; c.fillRect(w * 0.64, gy - h * 0.3, w * 0.13, h * 0.3);
  digital(c, w * 0.705, gy - h * 0.36, h * 0.075, '3:12');
  HELP.lightmap(c, w, h, 'rgba(6,6,18,0.62)', [{ x: w * 0.74, y: h * 0.33, r: h * 0.6, col: '#8EA8FF', glow: 0.1 }, { x: w * 0.705, y: gy - h * 0.36, r: h * 0.35, col: '#7FD6FF', glow: 0.18 }]);
  // you, sitting up with your knees pulled in
  const yx = w * 0.3, hh = h * 0.66; person(c, yx, top, hh, P.sitKnees, { you: true, f: 1, rim: alpha('#9FB4FF', 0.5), side: 1 });
  rings(c, yx + hh * 0.18, top - hh * 0.62, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.5);
};

// a child at a desk, looking out of the window
MOMENTS.restless = (c, w, h, t) => {
  const gy = h * 0.96;
  room(c, w, h, { wall: '#C9BFA6', floor: '#8E8270', gy });
  windowOn(c, w * 0.04, h * 0.1, w * 0.26, h * 0.46, (c2, x, y, ww, wh) => {
    sky(c2, x, y, ww, wh, '#6FA6E0', '#CFE4F2'); c2.fillStyle = '#7BA05B'; c2.fillRect(x, y + wh * 0.72, ww, wh * 0.3);
    for (let i = 0; i < 3; i++) { const tx = x + ww * (0.2 + i * 0.32), ty = y + wh * 0.72; c2.fillStyle = '#4E3A28'; c2.fillRect(tx - 2, ty - wh * 0.25, 4, wh * 0.25); c2.fillStyle = mix('#3F7A3A', '#5E9A48', i / 2); c2.beginPath(); c2.arc(tx, ty - wh * 0.3, wh * 0.16, 0, TAU); c2.fill(); }
    for (let i = 0; i < 3; i++) { const bx = x + ((t * 0.05 + i * 0.37) % 1) * ww, by = y + wh * (0.18 + 0.1 * i); c2.strokeStyle = '#2A2A3A'; c2.lineWidth = 1.2; c2.beginPath(); c2.moveTo(bx - 4, by); c2.quadraticCurveTo(bx - 2, by - 3 * Math.abs(Math.sin(t * 6 + i)), bx, by); c2.quadraticCurveTo(bx + 2, by - 3 * Math.abs(Math.sin(t * 6 + i)), bx + 4, by); c2.stroke(); }
  }, { frame: '#F2EEE4' });
  // board at the right
  c.fillStyle = '#2F4A3E'; c.fillRect(w * 0.8, h * 0.14, w * 0.22, h * 0.36); c.fillStyle = alpha('#FFFFFF', 0.55); c.fillRect(w * 0.83, h * 0.22, w * 0.12, 2); c.fillRect(w * 0.83, h * 0.28, w * 0.09, 2); c.fillRect(w * 0.83, h * 0.34, w * 0.14, 2);
  const hh = h * 0.52, desk = (x) => { c.fillStyle = '#6E5A44'; c.fillRect(x, gy - hh * 0.5, hh * 0.42, hh * 0.04); c.fillRect(x + hh * 0.38, gy - hh * 0.5, hh * 0.035, hh * 0.5); };
  // the class, facing the board
  for (const [x, i] of [[0.52, 3], [0.68, 4], [0.84, 5]]) { HELP.chair(c, w * x - hh * 0.04, gy, hh * 1.1, 1, '#4A3E34'); person(c, w * x, gy, hh, P.sitChair, { f: 1, i, kind: 'child', col: '#3A3442' }); desk(w * x + hh * 0.1); }
  // you, turned to the window, one leg swinging
  const yx = w * 0.36; HELP.chair(c, yx - hh * 0.04, gy, hh * 1.1, 1, '#4A3E34');
  person(c, yx, gy, hh, { ...P.deskLook, head: -0.2 + 0.05 * Math.sin(t * 0.7) }, { you: true, f: -1, kind: 'child' }); desk(yx - hh * 0.52);
  HELP.vignette(c, w, h, 0.25);
};

// a teenager who can't get up: alarm going, morning light, someone at the door
MOMENTS.teens = (c, w, h, t) => {
  const gy = h * 0.95, s = h;
  room(c, w, h, { wall: '#5A4E5C', floor: '#2E2830', gy });
  windowOn(c, w * 0.66, h * 0.1, w * 0.22, h * 0.4, (c2, x, y, ww, wh) => sky(c2, x, y, ww, wh, '#F6D9A0', '#FFF2D6'), { frame: '#EDE4D4' });
  c.fillStyle = alpha('#C66B5A', 0.85); c.fillRect(w * 0.63, h * 0.08, w * 0.06, h * 0.48); c.fillRect(w * 0.86, h * 0.08, w * 0.06, h * 0.48);
  doorway(c, w * 0.04, gy, h * 0.68, w * 0.12, '#F0E2C4', '#5A4E5C');
  const top = bedSide(c, w * 0.26, w * 0.86, gy, s * 0.95, { col: '#3E3448', sheet: '#7A6A8E', pillow: 'right' });
  HELP.lightmap(c, w, h, 'rgba(20,10,20,0.35)', [{ x: w * 0.77, y: h * 0.3, r: h * 0.75, col: '#FFE2A8', glow: 0.25 }, { x: w * 0.1, y: h * 0.6, r: h * 0.45, col: '#FFF0D0', glow: 0.1 }]);
  // you, under the covers; a lump with a head and an arm over it
  const hh = h * 0.62, lx = w * 0.4; drawLying(c, lx, top + hh * 0.02, hh, { color: RED, body: body(0, 'adult') });
  c.fillStyle = '#8A79A0'; c.beginPath(); c.roundRect(lx - hh * 0.08, top - hh * 0.13, hh * 0.7, hh * 0.17, hh * 0.08); c.fill();
  // the alarm on the floor, buzzing
  const bz = Math.sin(t * 40) * (Math.sin(t * 3) > 0 ? 1.5 : 0); digital(c, w * 0.9 + bz, gy - h * 0.06, h * 0.06, '7:00', '#FF8A5A');
  // a parent in the doorway
  person(c, w * 0.12, gy, h * 0.72, { ...P.stand, lean: -0.04, head: 0.05, arms: [[2.7, 0.2], [0.1, 0.15]] }, { f: -1, i: 7, col: '#2A2430' });
  HELP.vignette(c, w, h, 0.3);
};

// on your own above a city full of people
MOMENTS.crowd = (c, w, h, t) => {
  const gy = h * 0.95;
  room(c, w, h, { wall: '#22202C', floor: '#15141B', gy });
  windowOn(c, w * 0.08, h * 0.06, w * 0.84, h * 0.72, (c2, x, y, ww, wh) => cityNight(c2, x, y, ww, wh, t, 11, 9), { frame: '#3A3848', bars: true });
  HELP.lightmap(c, w, h, 'rgba(6,6,16,0.35)', [{ x: w * 0.5, y: h * 0.4, r: h * 0.9, col: '#6A7AC8', glow: 0.08 }]);
  const yx = w * 0.42, hh = h * 0.74; person(c, yx, gy, hh, { ...P.stand, head: 0.12, arms: [[0.05, 0.1], [-0.05, 0.12]] }, { you: true, f: 1, rim: alpha('#9FB0FF', 0.45), side: 1 });
  const [hx, hy] = headAt(yx, gy, hh); rings(c, hx, hy + hh * 0.05, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.45);
};

// the gym bag by the door, and the sofa
MOMENTS.effort = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.7, seat = hh * 0.25;
  room(c, w, h, { wall: '#3E3A4A', floor: '#26232C', gy });
  windowOn(c, w * 0.08, h * 0.12, w * 0.2, h * 0.38, (c2, x, y, ww, wh) => { sky(c2, x, y, ww, wh, '#1E2236', '#3A3E58'); c2.strokeStyle = alpha('#B8C4E8', 0.35); c2.lineWidth = 1; for (let i = 0; i < 26; i++) { const rx = x + hash(i * 3.1) * ww, ry = y + ((hash(i * 1.7) + t * 0.9) % 1) * wh; c2.beginPath(); c2.moveTo(rx, ry); c2.lineTo(rx - 2, ry + 9); c2.stroke(); } }, { frame: '#6A6680' });
  // the bag and trainers by the door
  c.fillStyle = '#1F5E6E'; c.beginPath(); c.roundRect(w * 0.08, gy - h * 0.12, w * 0.12, h * 0.12, h * 0.03); c.fill(); c.strokeStyle = '#1F5E6E'; c.lineWidth = 3; c.beginPath(); c.arc(w * 0.14, gy - h * 0.12, w * 0.035, Math.PI, 0); c.stroke();
  c.fillStyle = '#E8E4DA'; c.beginPath(); c.roundRect(w * 0.22, gy - h * 0.035, w * 0.06, h * 0.035, [h * 0.02, h * 0.01, 2, 2]); c.fill(); c.beginPath(); c.roundRect(w * 0.27, gy - h * 0.035, w * 0.06, h * 0.035, [h * 0.02, h * 0.01, 2, 2]); c.fill();
  couch(c, w * 0.45, w * 0.86, gy, seat, '#4E4A62');
  const tvc = '#9FC4FF';
  HELP.lightmap(c, w, h, 'rgba(10,8,20,0.45)', [{ x: w * 0.98, y: h * 0.5, r: h * 0.8, col: tvc, glow: 0.12 }, { x: w * 0.18, y: h * 0.3, r: h * 0.35 }]);
  const yx = w * 0.6; person(c, yx, gy, hh, { ...P.slump, head: 0.35, lean: -0.32, arms: [[0.15, 0.6], [0.1, 0.7]] }, { you: true, f: 1, rim: alpha(tvc, 0.5), side: 1 });
  HELP.vignette(c, w, h, 0.4);
};

// the fridge at night
MOMENTS.cravings = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.74;
  room(c, w, h, { wall: '#2E3038', floor: '#1C1D22', gy });
  c.fillStyle = '#3A3C46'; c.fillRect(0, gy - h * 0.34, w * 0.5, h * 0.34); c.fillStyle = '#5A5C66'; c.fillRect(0, gy - h * 0.36, w * 0.5, h * 0.025);
  // the open fridge: lit shelves
  const fx = w * 0.62, fw = w * 0.22, ft = h * 0.12; c.fillStyle = '#F4F2EA'; c.fillRect(fx, ft, fw, gy - ft);
  for (let i = 1; i < 4; i++) { c.fillStyle = '#C9C6BC'; c.fillRect(fx, ft + (gy - ft) * i / 4.2, fw, 3); }
  const items = [['#E04A3A', 0.1, 0.2], ['#F2B73A', 0.35, 0.18], ['#6A3A2A', 0.6, 0.22], ['#3A8AD0', 0.15, 0.45], ['#F28AB0', 0.5, 0.42], ['#E8D8A0', 0.3, 0.68], ['#9A5A3A', 0.65, 0.66]];
  for (const [col, ix, iy] of items) { c.fillStyle = col; c.fillRect(fx + fw * ix, ft + (gy - ft) * iy, fw * 0.2, (gy - ft) * 0.09); }
  c.fillStyle = '#D6D2C6'; c.save(); c.translate(fx + fw, ft); c.transform(1, -0.12, 0, 1, 0, 0); c.fillRect(0, 0, fw * 0.32, gy - ft); c.restore();
  HELP.lightmap(c, w, h, 'rgba(6,8,16,0.7)', [{ x: fx + fw * 0.5, y: h * 0.45, r: h * 0.95, col: '#EAF4FF', glow: 0.22, rect: { x: fx, y: ft, w: fw, h: gy - ft, a: 1 } }]);
  const yx = w * 0.5; person(c, yx, gy, hh, { ...P.reach, lean: 0.12, head: 0.1, arms: [[1.45, 0.1], [0.05, 0.15]] }, { you: true, f: 1, rim: alpha('#EAF4FF', 0.7), side: 1 });
  HELP.vignette(c, w, h, 0.45);
};

// late at the office, inbox still full
MOMENTS.burnout = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.7;
  room(c, w, h, { wall: '#2A2C3A', floor: '#1A1A22', gy });
  windowOn(c, w * 0.04, h * 0.06, w * 0.5, h * 0.5, (c2, x, y, ww, wh) => cityNight(c2, x, y, ww, wh, t, 21, 6), { frame: '#3E4050' });
  // empty desks behind
  for (const x of [0.12, 0.3]) { c.fillStyle = '#23242E'; c.fillRect(w * x, gy - h * 0.3, w * 0.14, h * 0.025); c.fillRect(w * x + 4, gy - h * 0.3, 4, h * 0.3); c.fillStyle = '#181920'; c.fillRect(w * x + w * 0.04, gy - h * 0.42, w * 0.06, h * 0.11); }
  // your desk and screen
  const dx = w * 0.62; c.fillStyle = '#3A3A48'; c.fillRect(dx, gy - h * 0.33, w * 0.36, h * 0.025); c.fillRect(dx + w * 0.33, gy - h * 0.33, 6, h * 0.33);
  const sx = dx + w * 0.17, sy = gy - h * 0.62, sw = w * 0.17, sh = h * 0.26;
  c.fillStyle = '#121218'; c.fillRect(sx - 4, sy - 4, sw + 8, sh + 8); c.fillRect(sx + sw / 2 - 4, sy + sh, 8, h * 0.04);
  c.fillStyle = '#DCE6F6'; c.fillRect(sx, sy, sw, sh);
  for (let i = 0; i < 9; i++) { c.fillStyle = i < 3 ? '#3A6AD0' : '#9AA8C0'; c.fillRect(sx + sw * 0.06, sy + sh * (0.08 + i * 0.1), sw * (0.5 + hash(i) * 0.4), sh * 0.04); c.fillStyle = i < 3 ? '#3A6AD0' : 'transparent'; c.beginPath(); c.arc(sx + sw * 0.92, sy + sh * (0.1 + i * 0.1), 2.2, 0, TAU); c.fill(); }
  HELP.lightmap(c, w, h, 'rgba(6,6,16,0.6)', [{ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.7, col: '#CFE0FF', glow: 0.18, rect: { x: sx, y: sy, w: sw, h: sh, a: 1 } }, { x: w * 0.3, y: h * 0.3, r: h * 0.5 }]);
  const yx = dx + w * 0.02; HELP.chair(c, yx - hh * 0.05, gy, hh * 1.05, 1, '#2A2A34');
  person(c, yx, gy, hh, P.headInHand, { you: true, f: 1, rim: alpha('#CFE0FF', 0.6), side: 1 });
  rings(c, yx + hh * 0.22, gy - hh * 0.72, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.45);
};

// 4 in the morning, on your own with the baby
MOMENTS.newparent = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.7;
  room(c, w, h, { wall: '#2A2840', floor: '#18161F', gy });
  windowOn(c, w * 0.66, h * 0.1, w * 0.2, h * 0.38, (c2, x, y, ww, wh) => { sky(c2, x, y, ww, wh, '#0A0C22', '#1E2246'); HELP.stars(c2, ww, wh * 0.8, 20, 4, t); }, { frame: '#4E4C6A' });
  c.save(); c.globalAlpha = 1; HELP.crib(c, w * 0.78, gy, h * 0.75); c.restore();
  c.fillStyle = '#1E1C2A'; c.fillRect(w * 0.06, gy - h * 0.28, w * 0.1, h * 0.28); digital(c, w * 0.11, gy - h * 0.34, h * 0.06, '4:40');
  c.fillStyle = '#F2D7A8'; c.beginPath(); c.arc(w * 0.22, gy - h * 0.06, h * 0.015, 0, TAU); c.fill();
  HELP.lightmap(c, w, h, 'rgba(6,6,18,0.62)', [{ x: w * 0.22, y: gy - h * 0.06, r: h * 0.7, col: '#FFC070', glow: 0.22 }, { x: w * 0.11, y: gy - h * 0.34, r: h * 0.2, col: '#7FD6FF', glow: 0.1 }]);
  // you in the chair, rocking, the baby against your chest
  const yx = w * 0.42; HELP.chair(c, yx - hh * 0.04, gy, hh * 1.1, 1, '#3A3446');
  const rk = P.rock(t); person(c, yx, gy, hh, { ...rk, arms: [[0.45, 1.75], [0.35, 1.85]] }, { you: true, f: 1, rim: alpha('#FFC070', 0.5), side: -1 });
  // the baby, wrapped in a pale blanket, against your chest
  const bx = yx + hh * (0.13 + rk.lean * 0.3), by = gy - hh * 0.5; c.fillStyle = '#EDE2D2'; c.beginPath(); c.ellipse(bx, by, hh * 0.1, hh * 0.06, -0.5, 0, TAU); c.fill(); c.fillStyle = '#D8C8B4'; c.beginPath(); c.arc(bx + hh * 0.07, by - hh * 0.05, hh * 0.04, 0, TAU); c.fill();
  rings(c, yx + hh * 0.2, gy - hh * 0.72, hh * 0.32, t);
  HELP.vignette(c, w, h, 0.5);
};

// in bed with the news
MOMENTS.news = (c, w, h, t) => {
  const gy = h * 0.95, s = h;
  room(c, w, h, { wall: '#1E2032', floor: '#121219', gy });
  const top = bedSide(c, w * 0.04, w * 0.6, gy, s * 0.95, { col: '#262640', sheet: '#3E3E62', pillow: 'left' });
  const sx = w * 0.62, sy = h * 0.1, sw = w * 0.26, sh = h * 0.62;
  screen(c, sx, sy, sw, sh, t, (c2, x, y, ww, wh) => {
    c2.fillStyle = '#F4F4F6'; c2.fillRect(x, y, ww, wh); const off = (t * wh * 0.08) % (wh * 0.45);
    for (let k = -1; k < 4; k++) { const by = y + k * wh * 0.45 - off; c2.fillStyle = '#D21F1F'; c2.fillRect(x, by + wh * 0.04, ww, wh * 0.07); c2.fillStyle = '#FFFFFF'; c2.font = `700 ${Math.round(wh * 0.045)}px "PT Sans Narrow", sans-serif`; c2.fillText('BREAKING', x + ww * 0.06, by + wh * 0.09);
      c2.fillStyle = mix('#3A3A46', '#6A6A7A', hash(k * 3.3)); c2.fillRect(x + ww * 0.06, by + wh * 0.15, ww * 0.88, wh * 0.16); for (let l = 0; l < 3; l++) { c2.fillStyle = '#9A9AA6'; c2.fillRect(x + ww * 0.06, by + wh * (0.34 + l * 0.035), ww * (0.5 + hash(k + l) * 0.38), wh * 0.015); } }
  }, '#E8EEFF');
  HELP.lightmap(c, w, h, 'rgba(4,4,12,0.62)', [{ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.8, col: '#DCE6FF', glow: 0.14, rect: { x: sx - sw * 0.05, y: sy - sw * 0.05, w: sw * 1.1, h: sh + sw * 0.1, a: 1 } }]);
  const yx = w * 0.3, hh = h * 0.66; person(c, yx, top, hh, P.sitBedPhone, { you: true, f: 1, rim: alpha('#DCE6FF', 0.6), side: 1 });
  rings(c, yx + hh * 0.18, top - hh * 0.6, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.45);
};

// scrolling other people's best moments
MOMENTS.compare = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.7, seat = hh * 0.25;
  room(c, w, h, { wall: '#2C2A3A', floor: '#1A1922', gy });
  couch(c, w * 0.08, w * 0.5, gy, seat, '#3E3A52');
  const sx = w * 0.62, sy = h * 0.06, sw = w * 0.25, sh = h * 0.66;
  screen(c, sx, sy, sw, sh, t, (c2, x, y, ww, wh) => HELP.feed(c2, x, y, ww, wh, t), '#FFD0E0');
  HELP.lightmap(c, w, h, 'rgba(6,4,14,0.6)', [{ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.8, col: '#FFC8DC', glow: 0.14, rect: { x: sx - sw * 0.05, y: sy - sw * 0.05, w: sw * 1.1, h: sh + sw * 0.1, a: 1 } }]);
  const yx = w * 0.3; person(c, yx, gy, hh, P.slumpPhone, { you: true, f: 1, rim: alpha('#FFC8DC', 0.55), side: 1 });
  rings(c, yx + hh * 0.2, gy - hh * 0.72, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.45);
};

// wanting to be held: the long sofa, one person on it
MOMENTS.touch = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.72, seat = hh * 0.25;
  room(c, w, h, { wall: '#3C3444', floor: '#221E26', gy });
  HELP.frameOnWall(c, w * 0.32, h * 0.12, h * 0.2, '#6A5A70'); HELP.frameOnWall(c, w * 0.56, h * 0.16, h * 0.16, '#5A6A70');
  couch(c, w * 0.16, w * 0.84, gy, seat, '#5A4A5E');
  c.fillStyle = '#2A2430'; c.fillRect(w * 0.9, gy - h * 0.5, 3, h * 0.5); HELP.lamp(c, w * 0.9 + 1, gy - h * 0.62, h * 0.7);
  HELP.lightmap(c, w, h, 'rgba(10,6,14,0.5)', [{ x: w * 0.9, y: gy - h * 0.5, r: h * 0.8, col: '#FFC890', glow: 0.2 }]);
  // you at one end, holding a cushion; the rest of the sofa empty
  const yx = w * 0.27; c.fillStyle = '#B88A9A'; c.beginPath(); c.roundRect(yx + hh * 0.06, gy - hh * 0.56, hh * 0.15, hh * 0.22, hh * 0.05); c.fill();
  person(c, yx, gy, hh, { ...P.sitHug, arms: [[0.55, 1.65], [0.45, 1.75]] }, { you: true, f: 1, rim: alpha('#FFD8A8', 0.5), side: 1 });
  rings(c, yx + hh * 0.2, gy - hh * 0.72, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.4);
};

// standing up to speak, everyone looking at you
MOMENTS.speaking = (c, w, h, t) => {
  const gy = h * 0.8, hh = h * 0.56;
  room(c, w, h, { wall: '#3A3C48', floor: '#2A2A32', gy });
  c.fillStyle = '#F0F2F6'; c.fillRect(w * 0.48, h * 0.1, w * 0.36, h * 0.38); c.fillStyle = '#3A6AD0'; c.fillRect(w * 0.52, h * 0.16, w * 0.16, h * 0.03); for (let i = 0; i < 4; i++) { c.fillStyle = '#9AA8C0'; c.fillRect(w * 0.52, h * (0.24 + i * 0.05), w * (0.18 + hash(i) * 0.1), h * 0.018); }
  HELP.lightmap(c, w, h, 'rgba(8,8,16,0.35)', [{ x: w * 0.66, y: h * 0.28, r: h * 0.7, col: '#E6EEFF', glow: 0.12, rect: { x: w * 0.48, y: h * 0.1, w: w * 0.36, h: h * 0.38, a: 1 } }]);
  const yx = w * 0.36; person(c, yx, gy, hh, P.present, { you: true, f: 1, rim: alpha('#E6EEFF', 0.5), side: 1 });
  const [hx, hy] = headAt(yx, gy, hh); rings(c, hx, hy + hh * 0.08, hh * 0.36, t);
  // the backs of the audience, close to us
  for (let i = 0; i < 7; i++) { const x = w * (0.04 + i * 0.155), y = h * (1.02 + (i % 2) * 0.04), r = h * (0.075 + hash(i) * 0.01); c.fillStyle = '#121118'; c.beginPath(); c.ellipse(x, y, r * 2.1, r * 1.3, 0, Math.PI, 0); c.fill(); c.beginPath(); c.arc(x + hash(i * 3) * r * 0.3, y - r * 1.9, r, 0, TAU); c.fill(); }
  HELP.vignette(c, w, h, 0.35);
};

// retired: the long afternoon, the clock, the photos of everyone
MOMENTS.useful = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.66, seat = hh * 0.25;
  room(c, w, h, { wall: '#7A6E5E', floor: '#4A4036', gy });
  windowOn(c, w * 0.62, h * 0.1, w * 0.26, h * 0.44, (c2, x, y, ww, wh) => { sky(c2, x, y, ww, wh, '#A8C4DE', '#E6EEF0'); c2.fillStyle = '#9AA48A'; c2.fillRect(x, y + wh * 0.75, ww, wh); }, { frame: '#EEE6D6' });
  for (const [x, y] of [[0.18, 0.14], [0.27, 0.12], [0.36, 0.15], [0.22, 0.28], [0.32, 0.29]]) HELP.frameOnWall(c, w * x, h * y, h * 0.1, '#8A7A66');
  HELP.clock(c, w * 0.5, h * 0.2, h * 0.05, (t * 0.02) % TAU, (t * 0.24) % TAU);
  // the armchair
  c.fillStyle = '#5A3E36'; c.beginPath(); c.roundRect(w * 0.26, gy - seat * 2.6, seat * 0.5, seat * 2.2, seat * 0.2); c.fill(); c.beginPath(); c.roundRect(w * 0.26, gy - seat * 1.05, seat * 2.1, seat * 0.62, seat * 0.14); c.fill(); c.fillStyle = '#4A322C'; c.beginPath(); c.roundRect(w * 0.26 + seat * 1.7, gy - seat * 1.5, seat * 0.4, seat * 1.1, seat * 0.12); c.fill();
  HELP.lightmap(c, w, h, 'rgba(20,14,10,0.3)', [{ x: w * 0.75, y: h * 0.32, r: h * 0.85, col: '#FFF0D0', glow: 0.16 }]);
  const yx = w * 0.26 + seat * 0.9; person(c, yx, gy, hh, { ...P.watch, lean: -0.02, head: 0.1 }, { you: true, f: 1, rim: alpha('#FFF0D0', 0.55), side: 1 });
  rings(c, yx + hh * 0.18, gy - hh * 0.74, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.3);
};

// winter, dark by half past four, under the ceiling light
MOMENTS.winter = (c, w, h, t) => {
  const gy = h * 0.95, hh = h * 0.7;
  room(c, w, h, { wall: '#4E5058', floor: '#2E2E34', gy });
  windowOn(c, w * 0.08, h * 0.08, w * 0.34, h * 0.5, (c2, x, y, ww, wh) => {
    sky(c2, x, y, ww, wh, '#141A30', '#2A3050'); c2.fillStyle = '#C8CEDC'; c2.fillRect(x, y + wh * 0.8, ww, wh);
    c2.fillStyle = '#2A2A34'; c2.fillRect(x + ww * 0.7, y + wh * 0.3, 3, wh * 0.5); c2.save(); c2.globalCompositeOperation = 'lighter'; glow(c2, x + ww * 0.7, y + wh * 0.3, wh * 0.25, '#FFB860', 0.4); c2.restore();
    for (let i = 0; i < 40; i++) { const fx = x + ((hash(i * 2.3) + Math.sin(t * 0.5 + i) * 0.02) % 1) * ww, fy = y + ((hash(i * 4.1) + t * 0.06) % 1) * wh; c2.fillStyle = alpha('#FFFFFF', 0.8); c2.fillRect(fx, fy, 2, 2); }
  }, { frame: '#D0D0D6' });
  digital(c, w * 0.56, h * 0.2, h * 0.05, '16:35', '#9FE0FF');
  // table, mug, and the ceiling light
  c.fillStyle = '#3A3036'; c.fillRect(w * 0.5, gy - h * 0.3, w * 0.4, h * 0.025); c.fillRect(w * 0.87, gy - h * 0.3, 6, h * 0.3);
  c.fillStyle = '#D8D0C0'; c.fillRect(w * 0.7, gy - h * 0.36, h * 0.04, h * 0.06);
  c.fillStyle = '#2A2A30'; c.fillRect(w * 0.7, 0, 2, h * 0.1); c.fillStyle = '#E8E8EE'; c.fillRect(w * 0.66, h * 0.1, w * 0.08, h * 0.012);
  HELP.lightmap(c, w, h, 'rgba(10,10,18,0.4)', [{ x: w * 0.7, y: h * 0.14, r: h * 0.75, col: '#E6EEFF', glow: 0.1 }]);
  const yx = w * 0.55; HELP.chair(c, yx - hh * 0.04, gy, hh * 1.05, 1, '#2A2A30');
  person(c, yx, gy, hh, { ...P.slump, arms: [[1.1, 0.6], [0.95, 0.8]] }, { you: true, f: 1, rim: alpha('#E6EEFF', 0.4), side: -1 });
  HELP.vignette(c, w, h, 0.4);
};

// the photo from the night you weren't invited to
MOMENTS.leftout = (c, w, h, t) => {
  const gy = h * 0.95, s = h;
  room(c, w, h, { wall: '#2C2638', floor: '#18151E', gy });
  const top = bedSide(c, w * 0.04, w * 0.56, gy, s * 0.95, { col: '#2E2840', sheet: '#544A6E', pillow: 'left' });
  const sx = w * 0.6, sy = h * 0.08, sw = w * 0.3, sh = h * 0.62;
  screen(c, sx, sy, sw, sh, t, (c2, x, y, ww, wh) => {
    c2.fillStyle = '#EDEAF2'; c2.fillRect(x, y, ww, wh);
    // the group photo: everyone together, arms up, warm light
    const py = y + wh * 0.12, ph = wh * 0.5; const g = c2.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, '#F6B66A'); g.addColorStop(1, '#C8604A'); c2.fillStyle = g; c2.fillRect(x + ww * 0.06, py, ww * 0.88, ph);
    for (let i = 0; i < 5; i++) drawFigure(c2, x + ww * (0.18 + i * 0.16), py + ph * 1.0, ph * (0.78 + hash(i) * 0.1), { pose: i % 2 ? { frontArms: [[2.6, 0.3], [2.4, 0.3]] } : { frontArms: [[0.5, 1.2], [2.5, 0.3]] }, facing: 0, body: body(i * 7 + 3), color: '#3A1E22' });
    c2.fillStyle = '#5A5A6A'; c2.fillRect(x + ww * 0.06, y + wh * 0.67, ww * 0.6, wh * 0.03); c2.fillStyle = '#E04A6A'; c2.font = `700 ${Math.round(wh * 0.05)}px sans-serif`; c2.fillText('♥ 47', x + ww * 0.06, y + wh * 0.79);
  }, '#FFE0C8');
  HELP.lightmap(c, w, h, 'rgba(6,4,14,0.62)', [{ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.8, col: '#FFD8C0', glow: 0.14, rect: { x: sx - sw * 0.05, y: sy - sw * 0.05, w: sw * 1.1, h: sh + sw * 0.1, a: 1 } }]);
  const yx = w * 0.3, hh = h * 0.66; person(c, yx, top, hh, P.sitBedPhone, { you: true, f: 1, rim: alpha('#FFD8C0', 0.55), side: 1 });
  rings(c, yx + hh * 0.18, top - hh * 0.6, hh * 0.3, t);
  HELP.vignette(c, w, h, 0.45);
};

