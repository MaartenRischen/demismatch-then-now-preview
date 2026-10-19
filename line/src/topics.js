// Scenes for the topics beyond the prototype's eight beats. Each topic has:
// - compose: the ancestors' scene, generated per generation like the prototype's (who, how many, doing what, where)
// - props: anything drawn around them (a carcass, trees, a fire)
// - times: which times of day the ancestors' scene can have
// - modern: one scene of your world, the same every time (it does not change from pick to pick)
// registerTopics(copy) registers the ones that have copy; the words live in topics-copy.js.
import { TAU, clamp, lerp, smooth, mix, alpha, hash, glow, fbm } from '../../v4/src/art.js';
import { drawFigure, drawLying, walkPose, runPose, POSES, body } from '../../v4/src/figure.js';
import { carcass, fruitTree, fire, signal } from '../../v4/src/props.js';
import { registerTopic, registerPose, rng, lightmap, slabCut, cityWindow, chair, table, laptop, lamp, bed, sofa, tv, frameOnWall, GY, FH, RED, RED2, SIG, WALLPAPER } from './frame.js';
import { PLACES, TIME, RINGS, crowd, home, wall, partition, skyBand, skyline } from './modern.js';

// ---------- poses the prototype doesn't have ----------
registerPose('run', (t, i) => runPose(t * 7 + i * 1.3));
// dancing in time: everyone on the same beat
registerPose('dance', (t, i) => { const p = t * 2.6, s = Math.sin(p), k = Math.abs(Math.cos(p));
  return { lean: 0.04, head: -0.12, bob: 0.025 * k, legs: [[0.12 * s, 0.3 + 0.2 * k], [-0.12 * s, 0.3 + 0.2 * k]], arms: [[2.5 + 0.35 * s, 0.35], [2.3 - 0.35 * s, 0.45]] }; });
registerPose('clap', (t, i) => ({ ...POSES.sitFire, arms: [[1.2, 0.9 + 0.35 * Math.max(0, Math.sin(t * 5.2))], [1.1, 1.0 + 0.35 * Math.max(0, Math.sin(t * 5.2))]] }));

// poses for the modern scenes, as objects (the modern people take pose objects or the prototype's pose names)
const DRIVE = { ...POSES.sitChair, lean: -0.08, head: 0.0, arms: [[1.45, 0.25], [1.35, 0.3]] }, FILM = { ...POSES.stand, head: -0.25, arms: [[2.15, 0.55], [1.95, 0.7]], phone: true };
const kindOf = (R, p = 0.18) => (R() < p ? 'child' : 'adult');
const walls = (c, w, h, top, gy, col) => { wall(c, 0, w, top, gy, col, h); };

// ---------- the scenes ----------
const SCENES = {
  // walking and carrying all day
  move: {
    times: ['day', 'day', 'dusk'],
    compose({ R, add, place, props }) {
      const dir = R() < 0.5 ? 1 : -1, n = 4 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) { const k = R.pick(['walk', 'walk', 'carry', 'shoulderPole', 'walk', 'run', 'carry']); add(place(0.04, 0.96, 0.075, 0, 0.85), { p: k, f: dir, stick: k === 'walk' && R() < 0.35, spear: k === 'run' || (k === 'walk' && R() < 0.2), kind: k === 'walk' ? kindOf(R, 0.25) : 'adult' }); }
      if (R() < 0.5) add(place(0.05, 0.95, 0.08, 0.2, 0.8), { p: 'hunch', stick: true, f: -dir });
      props.baskets = Array.from({ length: Math.floor(R() * 2) }, () => R.range(0.05, 0.95));
    },
    // stuck in traffic, one person to a car
    modern(c, w, h, t, u, H) {
      const gy = h * GY, T = TIME.evening, people = crowd(), lights = [];
      skyBand(c, 0, 0, w, h * 0.62, T, t, 3); skyline(c, 0, w, h * 0.6, h * 0.42, T, t, 5, 0.5);
      c.fillStyle = '#3A3842'; c.fillRect(0, h * 0.6, w, h); c.fillStyle = '#5A5862'; c.fillRect(0, h * 0.6, w, h * 0.02);
      for (let x = (t * 6) % 60 - 60; x < w; x += 60) { c.fillStyle = alpha('#E8E4D8', 0.5); c.fillRect(x, h * 0.93, 30, 3); }
      const n = 4, cw = w * 0.21, redI = 1;
      for (let i = 0; i < n; i++) {
        const cx = w * 0.02 + i * w * 0.25 + Math.sin(t * 0.3 + i) * 1.5, by = gy - h * 0.02, ch = h * 0.13;
        c.fillStyle = '#1C1C24'; c.beginPath(); c.roundRect(cx + cw * 0.18, by - ch * 1.75, cw * 0.55, ch * 0.9, [14, 18, 4, 4]); c.fill();
        c.fillStyle = mix('#3A4458', '#8A9AB0', T.day); c.beginPath(); c.roundRect(cx + cw * 0.22, by - ch * 1.65, cw * 0.47, ch * 0.72, [10, 14, 2, 2]); c.fill();
        people(cx + cw * 0.42, by - ch * 0.35, h * 0.3, { pose: DRIVE, f: 1, red: i === redI, i: i + 3, rim: alpha('#FFD8A0', 0.3), phones: false });
        lights.push({ x: cx - 2, y: by - ch * 0.6, r: h * 0.12, col: '#FF3A2A', glow: 0.25 }, { x: cx + cw, y: by - ch * 0.6, r: h * 0.18, col: '#FFF0C8', glow: 0.15 });
        S_car[i] = { cx, by, ch };
      }
      lightmap(c, w, h, T.dark, lights);
      const you = people.draw(c, t);
      for (let i = 0; i < n; i++) { const { cx, by, ch } = S_car[i]; c.fillStyle = i === redI ? '#2A2630' : '#22222A'; c.beginPath(); c.roundRect(cx, by - ch, cw, ch * 0.85, 10); c.fill(); for (const wx of [0.2, 0.8]) { c.fillStyle = '#0C0C10'; c.beginPath(); c.arc(cx + cw * wx, by - ch * 0.12, ch * 0.24, 0, TAU); c.fill(); } c.fillStyle = '#FF3A2A'; c.fillRect(cx, by - ch * 0.8, 4, ch * 0.2); c.fillStyle = '#FFF4D8'; c.fillRect(cx + cw - 4, by - ch * 0.8, 4, ch * 0.18); }
    },
  },

  // children outside all day, looking far
  eyes: {
    times: ['day', 'day', 'dusk'],
    compose({ R, add, place, props }) {
      props.trees = Array.from({ length: Math.floor(R() * 2) }, () => ({ x: R.range(0.05, 0.95), s: R.range(0.24, 0.34), fruit: R() < 0.5 }));
      const n = 4 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) add(place(0.04, 0.96, 0.065, 0, 0.85), { p: R.pick(['run', 'run', 'throw', 'reach', 'crouch', 'walk', 'look', 'wave', 'pick']), kind: 'child' });
      for (let i = 0, m = 1 + Math.floor(R() * 2); i < m; i++) add(place(0.05, 0.95, 0.08, 0.55, 0.95), { p: R.pick(['hunch', 'carry', 'walk']), stick: R() < 0.5 });
    },
    // a child at a desk, the bright day on the other side of the glass
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.12, people = crowd(), lights = [];
      walls(c, w, h, top, gy, '#8A9088');
      const wx = w * 0.56, wy = top + h * 0.06, ww = w * 0.34, wh = h * 0.42;
      skyBand(c, wx, wy, ww, wh, TIME.day, t, 2); c.fillStyle = '#7A9A5A'; c.fillRect(wx, wy + wh * 0.7, ww, wh * 0.3);
      fruitTree(c, wx + ww * 0.7, wy + wh * 0.95, wh * 0.7, '#4A6A3A', '#D8A040', []);
      c.strokeStyle = '#E8E4DC'; c.lineWidth = 4; c.strokeRect(wx, wy, ww, wh); c.beginPath(); c.moveTo(wx + ww / 2, wy); c.lineTo(wx + ww / 2, wy + wh); c.stroke();
      lights.push({ x: wx + ww / 2, y: wy + wh / 2, r: h * 0.7, col: '#FFF6E0', glow: 0.18, rect: { x: wx, y: wy, w: ww, h: wh, a: 1 } });
      frameOnWall(c, w * 0.2, top + h * 0.1, h * 0.08, '#8A9088');
      const fh = h * FH * 0.68, dx = w * 0.3;
      table(c, dx + fh * 0.15, dx + fh * 0.6, gy, fh * 1.35, '#4A4038'); chair(c, dx, gy, fh, 1);
      laptop(c, dx + fh * 0.45, gy - fh * 0.51, fh * 1.2, -1); lamp(c, dx + fh * 0.5, top, h * FH);
      lights.push({ x: dx + fh * 0.45, y: gy - fh * 0.62, r: h * 0.15, col: '#CFE0FF', glow: 0.2 });
      slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
      people(dx, gy, fh, { pose: 'sitChair', f: 1, red: true, kind: 'child', i: 0, rim: alpha('#FFF6E0', 0.5), side: 1 });
      lightmap(c, w, h, 'rgba(10,12,26,0.3)', lights); people.draw(c, t);
    },
  },

  // the hunt comes home and is handed out
  purpose: {
    times: ['day', 'dusk', 'dusk'],
    compose({ R, add, place, props, taken }) {
      const cx = props.carcass = R.range(0.3, 0.7); taken.push({ x: cx, d: 0.15 });
      for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) { const side = i ? 1 : -1; add(place(cx + side * 0.05, cx + side * 0.1, 0.05, 0, 0.3), { p: R.pick(['crouch', 'reach', 'stand']), f: -side, spear: R() < 0.4 }); }
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) { const pos = place(0.05, 0.95, 0.075, 0, 0.85); if (pos) add(pos, { p: R.pick(['walk', 'reach', 'look', 'carry', 'wave', 'eat']), f: pos.x < cx ? 1 : -1, kind: kindOf(R, 0.25) }); }
      if (R() < 0.5) props.fire = R.range(0.1, 0.9);
    },
    props(c, w, h, P, t, g, K, E) { if (K.carcass !== undefined) carcass(c, w * K.carcass, E.gy - h * 0.005, h * 0.34, mix(E.prop, '#6A4030', 0.35), t); },
    // the office: work goes out on a screen to people nobody here will meet
    modern(c, w, h, t, u, H) { return PLACES.office(c, w, h, t, rng(1 * 3.7 + 11), TIME.day, 1); },
  },

  // the whole band moving in time around the fire
  dance: {
    times: ['night', 'night', 'dusk'],
    compose({ R, add, place, props, taken }) {
      const fx = props.fire = R.range(0.3, 0.7); taken.push({ x: fx, d: 0.3 });
      for (let i = 0, n = 4 + Math.floor(R() * 5); i < n; i++) { const pos = place(0.06, 0.94, 0.065, 0, 0.8); if (pos) add(pos, { p: 'dance', f: pos.x < fx ? 1 : -1, kind: kindOf(R, 0.2) }); }
      for (let i = 0, n = 1 + Math.floor(R() * 3); i < n; i++) { const side = i % 2 ? 1 : -1, pos = place(fx + side * 0.05, fx + side * 0.12, 0.05, 0, 0.4); if (pos) add(pos, { p: 'clap', f: pos.x < fx ? 1 : -1 }); }
    },
    // a concert: thousands in one room, facing the same way, filming
    modern(c, w, h, t, u, H) {
      const gy = h * GY, people = crowd(), lights = [];
      c.fillStyle = '#0C0A12'; c.fillRect(0, 0, w, h);
      const sx = w * 0.9; for (let k = 0; k < 5; k++) { const a = -2.6 + k * 0.18 + Math.sin(t * 0.8 + k) * 0.12, col = `hsl(${(t * 30 + k * 60) % 360},80%,65%)`; c.save(); c.globalAlpha = 0.18; c.fillStyle = col; c.beginPath(); c.moveTo(sx, h * 0.08); c.lineTo(sx + Math.cos(a) * w * 1.2 - w * 0.04, h * 0.08 + Math.sin(-a) * h * 1.6); c.lineTo(sx + Math.cos(a) * w * 1.2 + w * 0.04, h * 0.08 + Math.sin(-a) * h * 1.6); c.fill(); c.restore(); }
      c.fillStyle = '#16141C'; c.fillRect(w * 0.82, h * 0.55, w * 0.2, h * 0.45); glow(c, w * 0.92, h * 0.5, h * 0.4, '#FFE0F0', 0.4);
      lights.push({ x: w * 0.92, y: h * 0.45, r: h * 0.9, col: '#FFD0F0', glow: 0.15 });
      const rows = [[0.5, 0.17, 10], [0.68, 0.24, 8], [0.88, 0.34, 6]];
      rows.forEach(([yy, s, n], r) => { for (let i = 0; i < n; i++) { const x = w * (0.02 + (i + (r % 2) * 0.5) * 0.8 / n), red = r === 2 && i === 2; people(x, h * yy, h * s, { pose: red ? 'stand' : hash(i * 3 + r) < 0.55 ? FILM : 'stand', f: 1, red, i: i + r * 20, rim: alpha('#FFD0F0', 0.45), side: 1 }); } });
      lightmap(c, w, h, 'rgba(6,4,14,0.6)', lights); people.draw(c, t);
    },
  },

  // a birth among women who know her
  birth: {
    times: ['dusk', 'night', 'day'],
    compose({ R, add, place, props, taken }) {
      const bx = R.range(0.3, 0.7); taken.push({ x: bx + 0.001, d: 0.1 });
      add(place(bx - 0.005, bx + 0.005, 0.04, 0, 0.12), { p: 'crouch', f: R() < 0.5 ? 1 : -1 });
      for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) { const side = i % 2 ? 1 : -1, pos = place(bx + side * 0.045, bx + side * 0.13, 0.045, 0, 0.45); if (pos) add(pos, { p: R.pick(['crouch', 'touch', 'holdHand', 'sitArm', 'touch']), f: pos.x < bx ? 1 : -1, old: R() < 0.3 ? 1 : 0 }); }
      for (let i = 0, n = Math.floor(R() * 3); i < n; i++) add(place(0.05, 0.95, 0.08, 0.4, 0.9), { p: R.pick(['carry', 'walk', 'sitGround', 'look']), kind: kindOf(R, 0.3) });
      props.shelters = [{ x: clamp(bx + (R() < 0.5 ? -0.18 : 0.18), 0.08, 0.92), s: R.range(0.32, 0.42), hut: R() < 0.5, d: R.range(0.5, 0.9) }];
      if (R() < 0.7) props.fire = clamp(bx + (R() < 0.5 ? -0.25 : 0.25), 0.1, 0.9);
    },
    // a delivery room: machines, a clock, nobody she knows
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.1, people = crowd(), lights = [], fh = h * FH;
      walls(c, w, h, top, gy, '#B4C0BC'); slabCut(c, 0, 0, w, top);
      const bx = w * 0.42; c.fillStyle = '#E8EAE6'; c.fillRect(bx - fh * 0.5, gy - fh * 0.42, fh * 1.3, fh * 0.12); c.fillStyle = '#8A9094'; c.fillRect(bx - fh * 0.48, gy - fh * 0.3, fh * 0.04, fh * 0.3); c.fillRect(bx + fh * 0.74, gy - fh * 0.3, fh * 0.04, fh * 0.3); c.fillRect(bx - fh * 0.55, gy - fh * 0.75, fh * 0.06, fh * 0.45);
      const mx = w * 0.68, my = gy - fh * 1.0; c.fillStyle = '#16141C'; c.fillRect(mx, my, fh * 0.34, fh * 0.24); c.strokeStyle = '#6AFF9A'; c.lineWidth = 1.5; c.beginPath();
      for (let k = 0; k <= 30; k++) { const x = mx + 4 + k * (fh * 0.34 - 8) / 30, ph = (k / 30 + t * 0.8) % 1; c.lineTo(x, my + fh * 0.14 - (ph > 0.45 && ph < 0.5 ? fh * 0.08 : 0)); } c.stroke();
      c.fillStyle = '#8A9094'; c.fillRect(mx + fh * 0.16, my + fh * 0.24, fh * 0.02, gy - my - fh * 0.24);
      lights.push({ x: mx + fh * 0.17, y: my + fh * 0.12, r: h * 0.18, col: '#6AFF9A', glow: 0.15 }, { x: w * 0.42, y: top + 6, r: h * 0.7, col: '#F0F4F0', glow: 0.06, a: 0.8 });
      const clx = w * 0.2, cly = top + h * 0.12; c.fillStyle = '#EDE6DA'; c.beginPath(); c.arc(clx, cly, h * 0.045, 0, TAU); c.fill(); c.strokeStyle = '#16141C'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(clx, cly); c.lineTo(clx + Math.sin(t * 0.5) * h * 0.03, cly - Math.cos(t * 0.5) * h * 0.03); c.moveTo(clx, cly); c.lineTo(clx + Math.sin(3.6) * h * 0.02, cly - Math.cos(3.6) * h * 0.02); c.stroke();
      const doorX = w * 0.86; c.fillStyle = '#8A9AA0'; c.fillRect(doorX, gy - fh * 1.1, fh * 0.42, fh * 1.1); c.fillStyle = '#DDE8EC'; c.fillRect(doorX + fh * 0.12, gy - fh * 0.95, fh * 0.18, fh * 0.22);
      people(bx + fh * 0.1, gy - fh * 0.1, fh, { pose: { ...POSES.slump, lean: -0.35, head: 0.25 }, f: 1, red: true, i: 0, rim: alpha('#F0F4F0', 0.4), side: 1, phones: false });
      chair(c, w * 0.6, gy, fh, -1, '#5A6064');
      lightmap(c, w, h, 'rgba(10,12,26,0.25)', lights); people.draw(c, t);
    },
  },

  // the fire at night, someone telling a story
  stories: {
    times: ['night'],
    compose({ R, add, place, props, taken }) {
      const fx = props.fire = R.range(0.3, 0.7); taken.push({ x: fx, d: 0.3 });
      const side0 = R() < 0.5 ? -1 : 1; add(place(fx + side0 * 0.1, fx + side0 * 0.16, 0.05, 0, 0.3), { p: 'tell', f: -side0 });
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) { const side = i % 2 ? 1 : -1, pos = place(fx + side * 0.05, fx + side * 0.22, 0.06, 0, 0.75); if (pos) add(pos, { p: R.pick(['sitFire', 'sitFire', 'sitArm', 'sitGround']), f: pos.x < fx ? 1 : -1, kind: kindOf(R, 0.3) }); }
      for (let i = 0, n = Math.floor(R() * 3); i < n; i++) add(place(0.06, 0.94, 0.2, 0.2, 0.8), { p: 'lie', kind: 'child' });
      props.shelters = R() < 0.6 ? [{ x: R.range(0.05, 0.95), s: R.range(0.28, 0.4), hut: R() < 0.5, d: R.range(0.5, 1) }] : [];
    },
    modern(c, w, h, t, u, H) { return PLACES.flats(c, w, h, t, rng(10 * 3.7 + 11), TIME.night, 10); },
  },

  // held, groomed, leaned on
  touch: {
    times: ['day', 'dusk', 'dusk'],
    compose({ R, add, place, props }) {
      for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) {
        const pos = place(0.06, 0.88, 0.12, 0, 0.8); if (!pos) continue;
        const k = R.pick(['hug', 'holdHand', 'touch', 'sitArm', 'carry']);
        add(pos, { p: k, f: 1, kind: k === 'carry' ? 'adult' : kindOf(R), baby: k === 'carry' ? 1 : 0 });
        if (k !== 'carry') { const p2 = place(pos.x + 0.035, pos.x + 0.055, 0.02, pos.d, pos.d + 0.05); if (p2) add(p2, { p: k === 'touch' ? 'sitArm' : k, f: -1, kind: kindOf(R) }); }
      }
      if (R() < 0.6) props.fire = R.range(0.1, 0.9);
    },
    modern(c, w, h, t, u, H) { return PLACES.train(c, w, h, t, rng(19 * 3.7 + 11), TIME.night, 19); },
  },

  // asleep in the quiet, around a low fire
  quiet: {
    times: ['night'],
    compose({ R, add, place, props, taken }) {
      const fx = props.fire = R.range(0.3, 0.7); taken.push({ x: fx, d: 0.3 });
      if (R() < 0.6) { const pos = place(fx - 0.12, fx + 0.12, 0.06, 0, 0.4); if (pos) add(pos, { p: 'sitFire', f: pos.x < fx ? 1 : -1 }); }
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) add(place(0.06, 0.94, 0.22, 0, 0.9), { p: 'lie', kind: kindOf(R, 0.3) });
    },
    // a bedroom on a main road: headlights across the ceiling all night
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.14, people = crowd(), lights = [], fh = h * FH;
      walls(c, w * 0.62, h, top, gy, '#5A6074'); c.fillStyle = '#5A6074'; c.fillRect(0, top, w * 0.62, gy - top);
      skyBand(c, w * 0.62, 0, w * 0.38, gy, TIME.night, t, 4); skyline(c, w * 0.62, w, h * 0.55, h * 0.4, TIME.night, t, 9, 0.6);
      c.fillStyle = '#2A2830'; c.fillRect(w * 0.62, h * 0.55, w * 0.38, h); c.fillStyle = '#16141C'; c.fillRect(w * 0.62, gy - h * 0.02, w * 0.38, h * 0.02);
      // a plane low over the roofs, lights blinking
      { const k = (t * 0.09) % 1, px = lerp(w * 1.08, w * 0.56, k), py = h * (0.22 - 0.07 * k), s2 = h * 0.075;
        c.save(); c.beginPath(); c.rect(w * 0.62, 0, w * 0.38, h * 0.55); c.clip();
        c.fillStyle = '#4A4E66'; c.beginPath(); c.ellipse(px, py, s2, s2 * 0.13, -0.05, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(px - s2 * 0.1, py); c.lineTo(px + s2 * 0.25, py + s2 * 0.45); c.lineTo(px + s2 * 0.38, py + s2 * 0.45); c.lineTo(px + s2 * 0.2, py); c.fill();
        c.beginPath(); c.moveTo(px + s2 * 0.75, py); c.lineTo(px + s2 * 0.95, py - s2 * 0.35); c.lineTo(px + s2 * 1.02, py - s2 * 0.35); c.lineTo(px + s2 * 0.95, py); c.fill();
        if (Math.sin(t * 9) > 0.6) { glow(c, px + s2 * 0.3, py + s2 * 0.4, s2 * 0.25, '#FF3A2A', 0.9); }
        if (Math.sin(t * 9 + 2) > 0.7) { glow(c, px - s2, py, s2 * 0.3, '#FFFFFF', 0.9); }
        glow(c, px - s2 * 1.05, py + s2 * 0.05, s2 * 0.9, '#FFF4D8', 0.55); c.fillStyle = '#FFF8E8'; c.beginPath(); c.arc(px - s2 * 0.98, py + s2 * 0.03, s2 * 0.05, 0, TAU); c.fill();
        c.restore(); }
      for (let k = 0; k < 3; k++) { const p = ((t * 0.35 + k / 3) % 1), x = lerp(w * 1.05, w * 0.55, p); c.fillStyle = '#16141C'; c.fillRect(x, gy - h * 0.09, w * 0.08, h * 0.06); lights.push({ x: x - 4, y: gy - h * 0.07, r: h * 0.25, col: '#FFF4D8', glow: 0.25 }); }
      const sweep = (t * 0.35) % 1, lx = lerp(w * 0.62, 0, sweep); c.save(); c.globalAlpha = 0.25 * Math.sin(sweep * Math.PI); c.fillStyle = '#FFF4D8'; c.beginPath(); c.moveTo(lx, top); c.lineTo(lx + w * 0.12, top); c.lineTo(lx + w * 0.2, top + h * 0.3); c.lineTo(lx + w * 0.08, top + h * 0.3); c.fill(); c.restore();
      const wx = w * 0.4, wy = top + h * 0.07; cityWindow(c, wx, wy, w * 0.14, h * 0.26, t, 0, 7);
      lights.push({ x: wx + w * 0.07, y: wy + h * 0.13, r: h * 0.3, col: '#FFE8C8', glow: 0.1 });
      partition(c, w * 0.62, top, gy, w); slabCut(c, 0, gy, w * 0.62, h - gy + 2); slabCut(c, 0, 0, w * 0.62, top);
      bed(c, w * 0.08, w * 0.34, gy, fh, '#3A3644');
      lightmap(c, w, h, 'rgba(6,8,22,0.62)', lights);
      drawLying(c, w * 0.13, gy - fh * 0.24, fh * 0.92, { color: RED, body: body(0) });
      if (RINGS.on) signal(c, w * 0.13 + fh * 0.85, gy - fh * 0.32, fh * 0.4, t, 1, SIG);
    },
  },

  // living among trees and plants
  nature: {
    times: ['day', 'dusk'],
    compose({ R, add, place, props, taken }) {
      props.trees = Array.from({ length: 2 + Math.floor(R() * 3) }, () => ({ x: R.range(0.04, 0.96), s: R.range(0.24, 0.36), fruit: R() < 0.6 }));
      props.trees.forEach((tr) => taken.push({ x: tr.x, d: 0.9 }));
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) add(place(0.05, 0.95, 0.08, 0, 0.8), { p: R.pick(['pick', 'walk', 'reach', 'sitGround', 'look', 'carry']), kind: kindOf(R) });
      props.baskets = Array.from({ length: Math.floor(R() * 3) }, () => R.range(0.05, 0.95));
    },
    // a desk facing the next block, nothing green in sight
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.12, people = crowd(), lights = [], fh = h * FH;
      walls(c, w, h, top, gy, '#7A7E86');
      const wx = w * 0.42, wy = top + h * 0.06, ww = w * 0.3, wh = h * 0.42;
      c.fillStyle = '#8A7466'; c.fillRect(wx, wy, ww, wh); c.strokeStyle = alpha('#5A4A40', 0.6); c.lineWidth = 1;
      for (let yy = wy; yy < wy + wh; yy += 7) { c.beginPath(); c.moveTo(wx, yy); c.lineTo(wx + ww, yy); c.stroke(); for (let xx = wx + ((yy / 7) % 2) * 9; xx < wx + ww; xx += 18) { c.beginPath(); c.moveTo(xx, yy); c.lineTo(xx, yy + 7); c.stroke(); } }
      c.fillStyle = '#5A6070'; c.fillRect(wx + ww * 0.15, wy + wh * 0.2, ww * 0.18, wh * 0.25); c.fillRect(wx + ww * 0.6, wy + wh * 0.2, ww * 0.18, wh * 0.25);
      c.strokeStyle = '#E8E4DC'; c.lineWidth = 4; c.strokeRect(wx, wy, ww, wh);
      lights.push({ x: wx + ww / 2, y: wy + wh / 2, r: h * 0.5, col: '#E8ECF0', glow: 0.08, rect: { x: wx, y: wy, w: ww, h: wh, a: 0.8 } });
      // a child at a desk (the headline is about children growing up)
      const dx = w * 0.3, fk = fh * 0.68; table(c, dx + fk * 0.15, dx + fk * 0.6, gy, fk * 1.35, '#4A4038'); chair(c, dx, gy, fk, 1); laptop(c, dx + fk * 0.45, gy - fk * 0.51, fk * 1.2, -1);
      lights.push({ x: dx + fk * 0.45, y: gy - fk * 0.62, r: h * 0.15, col: '#CFE0FF', glow: 0.2 });
      slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
      people(dx, gy, fk, { pose: 'sitChair', f: 1, red: true, kind: 'child', i: 0, rim: alpha('#CFE0FF', 0.6), side: 1 });
      lightmap(c, w, h, 'rgba(10,12,26,0.35)', lights); people.draw(c, t);
    },
  },

  // meat cut up and handed round
  share: {
    times: ['dusk', 'night'],
    compose({ R, add, place, props, taken }) {
      const fx = props.fire = R.range(0.3, 0.7); taken.push({ x: fx, d: 0.3 });
      const cx = props.carcass = clamp(fx + (R() < 0.5 ? -0.14 : 0.14), 0.12, 0.88); taken.push({ x: cx, d: 0.15 });
      add(place(cx - 0.05, cx + 0.05, 0.04, 0, 0.2), { p: 'crouch', f: cx < fx ? 1 : -1 });
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) { const pos = place(0.06, 0.94, 0.065, 0, 0.8); if (pos) add(pos, { p: R.pick(['reach', 'eat', 'sitFire', 'eat', 'carry', 'reach']), f: pos.x < fx ? 1 : -1, kind: kindOf(R, 0.25) }); }
    },
    props(c, w, h, P, t, g, K, E) { if (K.carcass !== undefined) carcass(c, w * K.carcass, E.gy - h * 0.005, h * 0.28, mix(E.prop, '#6A4030', 0.35), t); },
    // dinner for one at the kitchen counter
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.12, people = crowd(), lights = [], fh = h * FH;
      walls(c, w, h, top, gy, '#7E7488');
      cityWindow(c, w * 0.08, top + h * 0.07, w * 0.14, h * 0.26, t, 0, 3);
      const kx = w * 0.4; c.fillStyle = '#3A3842'; c.fillRect(kx, gy - fh * 0.45, w * 0.36, fh * 0.45); c.fillStyle = '#C8C4BC'; c.fillRect(kx - 4, gy - fh * 0.47, w * 0.36 + 8, fh * 0.03);
      const mx = kx + w * 0.24; c.fillStyle = '#E8E4DC'; c.fillRect(mx, gy - fh * 0.72, fh * 0.32, fh * 0.24); c.fillStyle = `rgba(255,200,120,${0.6 + 0.3 * Math.sin(t * 3)})`; c.fillRect(mx + 4, gy - fh * 0.69, fh * 0.2, fh * 0.18);
      lights.push({ x: mx + fh * 0.14, y: gy - fh * 0.6, r: h * 0.2, col: '#FFC878', glow: 0.25 }, { x: kx + w * 0.1, y: top + 6, r: h * 0.45, col: '#F4F0E4', glow: 0.06, a: 0.6 });
      lamp(c, kx + w * 0.1, top, fh);
      slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
      people(kx + w * 0.08, gy, fh, { pose: 'eat', f: 1, red: true, i: 0, rim: alpha('#FFC878', 0.5), side: 1, phones: false });
      lightmap(c, w, h, 'rgba(8,10,24,0.55)', lights); people.draw(c, t);
    },
  },

  // a child working beside an adult, doing the same thing
  learn: {
    times: ['day', 'day', 'dusk'],
    compose({ R, add, place, props }) {
      for (let i = 0, n = 2 + Math.floor(R() * 2); i < n; i++) {
        const pos = place(0.06, 0.86, 0.15, 0, 0.75); if (!pos) continue;
        const k = R.pick(['hunch', 'throw', 'carry', 'pick', 'crouch']), f = R() < 0.5 ? 1 : -1;
        add(pos, { p: k, f, stick: k === 'hunch', spear: k === 'throw' && R() < 0.5 });
        const p2 = place(pos.x + 0.045, pos.x + 0.07, 0.03, pos.d, pos.d + 0.06); if (p2) add(p2, { p: k, f, stick: k === 'hunch', kind: 'child' });
      }
      props.baskets = Array.from({ length: Math.floor(R() * 2) }, () => R.range(0.05, 0.95));
    },
    // a classroom: rows of desks, everyone facing the front
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.12, people = crowd(), lights = [], fh = h * FH * 0.7;
      walls(c, w, h, top, gy, '#A8AE98');
      c.fillStyle = '#2A3A30'; c.fillRect(w * 0.04, top + h * 0.08, w * 0.22, h * 0.3); c.strokeStyle = alpha('#E8E8E0', 0.6); c.lineWidth = 1.5; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(w * 0.06, top + h * (0.14 + k * 0.06)); c.lineTo(w * (0.12 + hash(k) * 0.12), top + h * (0.14 + k * 0.06)); c.stroke(); }
      for (let k = 0; k < 4; k++) { const lx = w * (0.12 + k * 0.24); c.fillStyle = '#F4F6F2'; c.fillRect(lx, top, w * 0.1, 3); lights.push({ x: lx + w * 0.05, y: top + 8, r: h * 0.5, col: '#F0F4F0', glow: 0.05, a: 0.85 }); }
      slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
      people(w * 0.2, gy, h * FH, { pose: 'tell', f: 1, i: 30, rim: alpha('#F0F4F0', 0.3) });
      const n = 6, redI = 3;
      for (let i = 0; i < n; i++) { const x = w * (0.36 + i * 0.105); table(c, x - fh * 0.62, x - fh * 0.18, gy, fh * 1.25, '#6A5A48'); chair(c, x, gy, fh, -1, '#4A4A52'); people(x, gy, fh, { pose: 'sitChair', f: -1, red: i === redI, kind: 'child', i: i + 40, rim: alpha('#F0F4F0', 0.3), side: -1 }); }
      lightmap(c, w, h, 'rgba(10,12,26,0.15)', lights); people.draw(c, t);
    },
  },
  // someone comes in with food for everyone, and the camp turns toward them
  // people you don't know, coming in from far off: the camp stops and watches, children pulled close
  strangers: {
    times: ['day', 'dusk', 'dusk'],
    compose({ R, add, place, props }) {
      const dir = R() < 0.5 ? 1 : -1, near = dir > 0 ? [0.05, 0.5] : [0.5, 0.95], far = dir > 0 ? [0.72, 0.96] : [0.04, 0.28];
      for (let i = 0, n = 2 + Math.floor(R() * 2); i < n; i++) add(place(far[0], far[1], 0.04, 0.82, 1), { p: 'walk', f: -dir, spear: R() < 0.6 });
      for (let i = 0, n = 4 + Math.floor(R() * 3); i < n; i++) add(place(near[0], near[1], 0.06, 0, 0.6), { p: R.pick(['look', 'stand', 'look', 'stand']), f: dir, spear: R() < 0.35, kind: kindOf(R, 0.15) });
      for (let i = 0, n = 1 + Math.floor(R() * 2); i < n; i++) add(place(near[0], near[1], 0.05, 0.5, 0.9), { p: 'look', f: dir, kind: 'child' });
      if (R() < 0.6) props.fire = dir > 0 ? R.range(0.08, 0.3) : R.range(0.7, 0.92);
    },
    modern() {},
  },

  standing: {
    times: ['day', 'dusk', 'dusk'],
    compose({ R, add, place, props, taken }) {
      const gx = R.range(0.2, 0.8), dir = gx < 0.5 ? 1 : -1;
      add(place(gx - 0.01, gx + 0.01, 0.05, 0, 0.2), { p: R.pick(['carry', 'shoulderPole', 'carry']), f: dir });
      props.baskets = [clamp(gx + dir * 0.05, 0.05, 0.95)];
      for (let i = 0, n = 3 + Math.floor(R() * 4); i < n; i++) { const pos = dir > 0 ? place(gx + 0.08, 0.95, 0.07, 0, 0.8) : place(0.05, gx - 0.08, 0.07, 0, 0.8); if (pos) add(pos, { p: R.pick(['wave', 'reach', 'look', 'walk', 'stand', 'tell']), f: -dir, kind: kindOf(R, 0.25) }); }
      if (R() < 0.6) add(place(0.05, 0.95, 0.08, 0.3, 0.8), { p: 'sitGround', old: 1, f: -dir });
      if (R() < 0.5) props.fire = R.range(0.1, 0.9);
    },
    // a meeting room: the title at the head of the table does the talking
    modern(c, w, h, t, u, H) {
      const gy = h * GY, top = h * 0.12, people = crowd(), lights = [], fh = h * FH;
      walls(c, w, h, top, gy, '#B8BCC0');
      const sx = w * 0.06, sy = top + h * 0.06, sw = w * 0.2, sh = h * 0.26;
      c.fillStyle = '#F4F6F8'; c.fillRect(sx, sy, sw, sh); [0.3, 0.55, 0.42, 0.8].forEach((v, k) => { c.fillStyle = k === 3 ? '#C8201A' : '#4A6A8A'; c.fillRect(sx + sw * (0.12 + k * 0.2), sy + sh * (0.9 - v * 0.75), sw * 0.12, sh * v * 0.75); });
      lights.push({ x: sx + sw / 2, y: sy + sh / 2, r: h * 0.35, col: '#F4F6F8', glow: 0.1, rect: { x: sx, y: sy, w: sw, h: sh, a: 1 } });
      c.fillStyle = alpha('#C8DCE8', 0.35); c.fillRect(w * 0.82, top, w * 0.18, gy - top); skyline(c, w * 0.82, w, top + h * 0.5, h * 0.35, TIME.day, t, 4, 0.3);
      for (let k = 0; k < 4; k++) { const lx = w * (0.1 + k * 0.22); c.fillStyle = '#F4F6F2'; c.fillRect(lx, top, w * 0.1, 3); lights.push({ x: lx + w * 0.05, y: top + 8, r: h * 0.5, col: '#F0F4F0', glow: 0.05, a: 0.8 }); }
      const t0 = w * 0.36, t1 = w * 0.8; table(c, t0, t1, gy, fh * 1.1, '#3A3440');
      slabCut(c, 0, gy, w, h - gy + 2); slabCut(c, 0, 0, w, top);
      people(w * 0.3, gy, fh, { pose: 'tell', f: 1, i: 50, rim: alpha('#F4F6F8', 0.4), side: -1 });
      const n = 5, redI = 4;
      for (let i = 0; i < n; i++) { const x = t0 + (t1 - t0) * (0.12 + i * 0.19); chair(c, x, gy, fh, -1, '#2A2830'); people(x, gy, fh, { pose: i === redI ? 'slump' : 'sitChair', f: -1, red: i === redI, i: i + 60, rim: alpha('#F0F4F0', 0.3), side: -1 }); }
      lightmap(c, w, h, 'rgba(10,12,26,0.15)', lights); people.draw(c, t);
    },
  },
};
const S_car = [];

// register the topics that have copy; signal: whether your figure carries the gold rings
export function registerTopics(copy) {
  for (const k of copy) {
    const sc = SCENES[k.scene || k.key]; if (!sc) continue;
    registerTopic(k.key, { ...sc, modern: (c, w, h, t, u, H) => { RINGS.on = !!k.signal; sc.modern(c, w, h, t, u, H); RINGS.on = true; } });
  }
}
export const SCENE_KEYS = Object.keys(SCENES);
