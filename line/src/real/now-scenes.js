// "You, now": sixteen ordinary modern moments, one per topic, staged with painter's mannequins in rooms built in code.
// "You" is the red mannequin; everyone else is natural wood. Light comes only from real sources: lamps, ceiling
// lights, screens, windows, streetlights, a fridge. buildNow({ key, renderer }) returns the same shape as
// world.js's buildAncestors: { scene, camera, look, update(t), alarmPoint(v), info }.
import * as THREE from 'three';
import { makeMannequin } from './mannequin.js';
import { POSE } from './poses.js';
import './poses-now.js';
import { TONES } from './wood.js';
import { rng } from './nature.js';
import { daySky, sunDir } from './sky.js';
import * as I from './interior.js';

const PI = Math.PI, V = (x, y, z) => new THREE.Vector3(x, y, z);
const WOODS = ['beech', 'beech', 'birch', 'pine', 'ash', 'oak'];
const yawTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

// ---------- the toolkit each scene builds with ----------
function kit(renderer, key) {
  I.initRectLights();
  let h = 7; for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 9973;
  const R = rng(h), scene = new THREE.Scene(), updates = [], figs = [];
  scene.background = new THREE.Color('#000000');
  scene.environment = I.roomEnv(renderer); scene.environmentIntensity = 0.08;
  const K = { R, scene, updates, figs, I, THREE };
  K.add = (o, x = 0, y = 0, z = 0, ry = 0, parent = scene) => { o.position.set(x, y, z); o.rotation.y = ry; parent.add(o); return o; };
  K.on = (fn) => updates.push(fn);
  K.env = (v) => { scene.environmentIntensity = v; };
  // a mannequin. place: floor (default), seat: y (the pelvis rests at that height, sinking a little), lie: y (a
  // bed: lowest point on the mattress). after(m, t): a hook to attach things each frame.
  K.fig = (f) => {
    const m = makeMannequin({ kind: f.kind || 'man', tone: f.red ? TONES.red : TONES[f.wood || R.pick(WOODS)], seed: R() * 100 });
    m.root.position.set(f.x || 0, 0, f.z || 0); m.root.rotation.y = f.yaw || 0; (f.parent || scene).add(m.root);
    if (f.scale) m.root.scale.multiplyScalar(f.scale);
    const r = f.r ?? R(), F = { m, f, r };
    F.place = (t) => {
      m.pose((f.mirror ? POSE.mirror(f.pose) : POSE[f.pose])(t + r * 10, r, f.o || {}));
      if (f.seat != null) seatOn(m, f.seat, f.sink ?? 0.03);
      else if (f.lie != null) lieOn(m, f.lie, f.sink ?? 0.025);
      else m.snap(() => f.floor ?? 0);
      if (f.after) f.after(m, t);
    };
    F.place(0); figs.push(F);
    return F;
  };
  // keep an object in a hand (or between both hands) every frame. face: a function returning a world point the
  // object's +z should turn to (a phone's screen to the eyes); otherwise it stays upright.
  K.hold = (F, obj, { hand = 'both', off = [0, 0, 0], face = null, up = null, yaw = 0 } = {}) => {
    const m = F.m, a = new THREE.Vector3(), b = new THREE.Vector3(), u = new THREE.Vector3(), q = new THREE.Quaternion();
    (obj.parent ? null : scene.add(obj));
    const fn = () => {
      m.root.updateMatrixWorld(true);
      if (hand === 'both') { m.world(m.J.lWr, a.set(0, -0.085, 0.0)); m.world(m.J.rWr, b.set(0, -0.085, 0.0)); obj.position.copy(a).add(b).multiplyScalar(0.5); }
      else m.world(m.J[hand + 'Wr'], obj.position.set(0, -0.085, 0));
      m.J.chest.getWorldQuaternion(q); u.set(...off).applyQuaternion(q); obj.position.add(u);
      if (face) { obj.up.copy(up ? up() : V(0, 1, 0).applyQuaternion(q)); obj.lookAt(face()); } else { obj.rotation.set(0, yaw, 0); }
    };
    const prev = F.f.after; F.f.after = (mm, t) => { prev && prev(mm, t); fn(); }; fn();
    return obj;
  };
  K.head = (F, v = new THREE.Vector3()) => F.m.world(F.m.J.head, v.set(0, 0.11, 0.0));
  K.eyes = (F) => () => F.m.world(F.m.J.head, new THREE.Vector3(0, 0.11, 0.08));
  // a light with a soft shadow
  K.shadow = (L, { size = 1024, radius = 5, bias = -0.0015, near = 0.05, normalBias = 0.02 } = {}) => { L.castShadow = true; L.shadow.mapSize.set(size, size); L.shadow.radius = radius; L.shadow.bias = bias; L.shadow.normalBias = normalBias; if (L.shadow.camera) L.shadow.camera.near = near; return L; };
  K.point = (color, power, x, y, z, shadow = null) => { const L = new THREE.PointLight(color, power, 0, 2); L.position.set(x, y, z); scene.add(L); if (shadow) K.shadow(L, shadow); return L; };
  K.spot = (color, power, from, to, angle = 0.6, pen = 0.6, shadow = null) => { const L = new THREE.SpotLight(color, power, 0, angle, pen, 2); L.position.set(...from); L.target.position.set(...to); scene.add(L, L.target); if (shadow) K.shadow(L, shadow); return L; };
  K.rect = (color, power, w, h, pos, at) => { const L = new THREE.RectAreaLight(color, power, w, h); L.position.set(...pos); scene.add(L); L.lookAt(...at); return L; };
  return K;
}
// sit a figure so its pelvis rests at height y (the seat top), sunk in by `sink`
const _v = new THREE.Vector3();
const SEAT_PTS = [[0, -0.1, 0], [0, -0.07, -0.08], [0.06, -0.08, 0.02], [-0.06, -0.08, 0.02]];
function seatOn(m, y, sink) {
  m.root.position.y = 0; m.root.updateMatrixWorld(true);
  let lo = Infinity; for (const p of SEAT_PTS) { m.world(m.J.hips, _v.set(...p)); lo = Math.min(lo, _v.y); }
  m.root.position.y = y - sink - lo; m.root.updateMatrixWorld(true);
}

// ---------- outside ----------
// a night street seen from a flat `level` metres up: the block across the road at `across`, more towers behind, a
// wet road, street lamps, the orange glow of the city in the sky
function nightStreet(K, { level = 8, across = -26, seed = 4, lit = 0.3, lamps = [[2, -6]], horizon = '#3A2614', glow = 1, far = 1, x0 = 0 } = {}) {
  const { I, scene, R } = K, st = -level, list = [];
  scene.add(I.citySky({ horizon, zenith: '#04060D', glow }));
  for (let x = x0 - 60; x < x0 + 60;) { const w = R.range(10, 22), h = R.range(14, 30); list.push({ x: x + w / 2, z: across - 7, w, d: 14, h }); x += w + (R() < 0.2 ? R.range(4, 9) : 0.3); }
  for (let i = 0; i < 26 * far; i++) list.push({ x: x0 + R.range(-120, 120), z: across - R.range(30, 160), w: R.range(14, 30), d: R.range(14, 30), h: R.range(20, 80) });
  const b = I.buildings(list, { lit, street: st, shops: 0.7, seed, bright: 1.1 }); scene.add(b);
  const road = I.mesh(new THREE.PlaneGeometry(400, 400), I.paint({ color: '#141416', rough: 0.28 }), 0, st, across - 100, { rx: -PI / 2, cast: false }); scene.add(road);
  for (const [x, z] of lamps) { const l = I.streetLamp({ h: 7.5, color: '#FF9440', intensity: 300, arm: 1.2, lens: 16 }); K.add(l, x, st, z, PI); const hl = I.halo('#FF9A48', 2.2, 1.2); hl.position.set(x - 1.2, st + 7.3, z); scene.add(hl); }
  return { street: st };
}

// lay a figure on a mattress: its torso (pelvis, shoulders, head) rests on the surface, sunk in a little; arms and
// legs may press into the mattress (as they do), so a dangling arm or a dropped knee does not lift the body
const LIE_PTS = [['hips', [0.13, 0, 0]], ['hips', [-0.13, 0, 0]], ['hips', [0, -0.08, -0.1]], ['chest', [0.17, 0.26, 0]], ['chest', [-0.17, 0.26, 0]], ['chest', [0, 0.2, -0.1]], ['head', [0.08, 0.11, 0]], ['head', [-0.08, 0.11, 0]], ['head', [0, 0.11, -0.1]]];
function lieOn(m, y, sink) {
  m.root.position.y = 0; m.root.updateMatrixWorld(true);
  let lo = Infinity; for (const [j, p] of LIE_PTS) { m.world(m.J[j], _v.set(...p)); lo = Math.min(lo, _v.y); }
  m.root.position.y = y - sink - lo; m.root.updateMatrixWorld(true);
}

// ---------- the scenes ----------
// each takes the kit and returns { you: the red figure, alarm: bool, cam: { pos, target, fov, push }, look }
const SCENES = {
  // 3am in a small city bedroom: sitting up in bed, knees pulled in, turned to the window; the next block's lit
  // windows and a street lamp outside; cold light on the bed; a clock on the bedside table
  night(K) {
    const { I, scene } = K, W = 3.4, D = 3.8, Hh = 2.5;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#C9CDD2' }), floor: I.floorWood({ a: '#6E5440', b: '#8A6A50', plank: 0.14 }), holes: [{ wall: 'back', at: 0.75, y0: 0.8, w: 1.3, h: 1.4 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('back', 0.75, 0.8); win.add(I.windowUnit({ w: 1.3, h: 1.4, cols: 2 }));
    const cur = I.curtain({ w: 0.55, h: 2.0, color: '#3E4652', folds: 6, seed: 3 }); cur.position.set(-0.95, 1.3, 0.1); win.add(cur);
    const cur2 = I.curtain({ w: 0.4, h: 2.0, color: '#3E4652', folds: 5, seed: 4 }); cur2.position.set(0.88, 1.3, 0.1); win.add(cur2);
    I.block(win, I.metal('#9A9A98', 0.4), 2.3, 0.02, 0.02, 0, 1.42, 0.12, 0.008);
    nightStreet(K, { level: 9, across: -24, seed: 4, lamps: [[1.6, -6.5]], x0: 0.75 });
    // light into the room: cold sky-glow through the glass, a cold patch of light on the bed, the street lamp's
    // orange thrown up onto the ceiling with the window bars in it
    K.rect('#8FA8D8', 5, 1.2, 1.3, [0.75, 1.5, -1.95], [0.75, 1.2, 0]);
    K.spot('#FF8E3C', 260, [0.4, -1.6, -6.5], [-0.2, 2.5, 0.5], 0.28, 0.5, { size: 1024, radius: 3, bias: -0.0008, near: 1 });
    K.spot('#7E9BE0', 26, [1.2, 3.4, -5.4], [-0.9, 0.5, -0.5], 0.3, 0.7, { size: 1024, radius: 4, bias: -0.0006, near: 1 });
    K.env(0.04);
    // the bed along the left wall, head at the back; a bedside table with the clock; a wardrobe, a chair of clothes
    const bed = I.bed({ w: 1.4, l: 2.0, top: 0.5, sheet: '#D9DCE0', pillow: '#D2D6DB', frame: I.woodFurniture({ color: '#5E4434', axis: 'z' }), seed: 2 });
    K.add(bed, -W / 2 + 0.72, 0, -D / 2 + 1.05);
    const nt = I.cabinet({ w: 0.45, h: 0.52, d: 0.38, doors: 1, color: '#5A4636', drawer: true }); K.add(nt, -W / 2 + 1.72, 0, -D / 2 + 0.3);
    const clk = I.digitalClock({ time: '3:12', color: '#9ED4FF', value: 4 }); K.add(clk, -W / 2 + 1.68, 0.52, -D / 2 + 0.34, 0.5);
    K.add(I.books({ n: 3, lying: true, seed: 4 }), -W / 2 + 1.82, 0.52, -D / 2 + 0.22, 0.4);
    const ph = I.phone({ kind: 'feed', value: 0 }); ph.rotation.set(-PI / 2, 0, 0.4); ph.position.set(-W / 2 + 1.56, 0.528, -D / 2 + 0.2); scene.add(ph);
    K.add(I.rug({ w: 1.6, d: 1.0, color: '#5A5650' }), 0.4, 0, 0.2, 0.05);
    K.add(I.cabinet({ w: 1.0, h: 2.0, d: 0.58, doors: 2, color: '#D8D4CC', legs: 0.05 }), W / 2 - 0.3, 0, 0.3, -PI / 2);
    const ch = I.chair({ color: '#3A3A3A' }); K.add(ch, W / 2 - 0.45, 0, -1.2, -PI / 2 - 0.4);
    const cl = I.cloth({ w: 0.6, color: '#3E4A5E', seed: 3, h: 0.08 }); cl.position.set(W / 2 - 0.45, 0.47, -1.2); cl.rotation.y = 0.5; scene.add(cl);
    const pic = room.onWall('left', -0.8, 1.25); pic.add(I.picture({ w: 0.7, h: 0.5, seed: 7, warm: false }));
    // you: sitting up on the bed, knees pulled in, looking at the window
    const you = K.fig({ red: true, kind: 'woman', pose: 'hugKnees', x: bed.position.x + 0.05, z: bed.position.z - 0.05, yaw: 2.05, lie: 0.5, o: { lookY: 0.2, headDown: -0.02, tilt: 0.05 } });
    const caps = I.bodyCapsules(you.m, bed, { arms: false });
    bed.add(I.duvet({ w: 1.4, l: 2.0, top: 0.5, z0: -0.1, bodies: caps.slice(5), lumps: [{ x: 0.3, z: 0.55, rx: 0.35, rz: 0.4, h: 0.16 }, { x: -0.35, z: 0.2, rx: 0.3, rz: 0.3, h: 0.08 }], color: '#C9CED6', seed: 5, wrinkle: 1.3 }));
    return { you, alarm: true, cam: { pos: [0.95, 1.32, 0.95], target: [-0.35, 0.92, -1.0], fov: 40, push: 0.025 }, look: { exposure: 1.35, aperture: 0.0012, bloom: 0.35, vignette: 0.42 } };
  },

  // late at night in a small dark bedroom: on the edge of the bed, looking down at a photo of other people together;
  // the phone is the light
  leftout(K) {
    const { I, scene } = K, W = 3.0, D = 3.4, Hh = 2.45;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#B8B2A8' }), floor: I.floorWood({ a: '#5A4434', b: '#74563E' }), holes: [{ wall: 'right', at: -0.4, y0: 0.85, w: 1.0, h: 1.3 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('right', -0.4, 0.85); win.add(I.windowUnit({ w: 1.0, h: 1.3, cols: 1 }));
    const bl = I.blinds({ w: 1.0, h: 1.3, open: 1.2, color: '#C8C4BC' }); bl.position.z = 0.05; win.add(bl);
    scene.add(I.citySky({ horizon: '#2A1C14', zenith: '#04060C', glow: 0.7 }));
    K.rect('#6E86B8', 0.7, 0.9, 1.2, [W / 2 - 0.05, 1.5, -0.4], [0, 1.4, -0.4]);
    K.env(0.02);
    const bed = I.bed({ w: 1.4, l: 2.0, top: 0.5, sheet: '#8E8A84', pillow: '#9A968E', headboard: 0.9, seed: 7 });
    K.add(bed, -0.35, 0, -D / 2 + 1.07);
    bed.add(I.duvet({ w: 1.4, l: 2.0, top: 0.5, z0: -0.4, lumps: [{ x: -0.2, z: 0.1, rx: 0.5, rz: 0.4, h: 0.15 }, { x: 0.25, z: 0.6, rx: 0.4, rz: 0.35, h: 0.1 }], color: '#6A6E78', seed: 8, wrinkle: 1.4 }));
    const nt = I.cabinet({ w: 0.42, h: 0.5, d: 0.36, doors: 1, color: '#4E3E30', drawer: true }); K.add(nt, -1.3, 0, -D / 2 + 0.25);
    K.add(I.lamp({ kind: 'table', on: false, shade: '#CFC6B4', base: '#3A3A38' }), -1.3, 0.5, -D / 2 + 0.22);
    K.add(I.cloth({ w: 0.5, color: '#4A4E58', seed: 2, h: 0.08 }), 0.9, 0, 0.3);
    // you, sitting on the side of the bed facing into the room, hunched over the phone
    const you = K.fig({ red: true, kind: 'man', pose: 'sitPhone', x: 0.27, z: -0.75, yaw: PI / 2 - 0.25, seat: 0.5, sink: 0.05, o: { drop: 0.15, low: 0.35 } });
    const ph = I.phone({ kind: 'photo', seed: 5, value: 2.4, light: 6, flicker: 0.015, lightColor: '#D8D4E4' });
    K.hold(you, ph, { off: [0, 0.02, 0.03], face: K.eyes(you) });
    const glowL = K.point('#B8C4E8', 0.25, 0, 0, 0);
    K.on(() => { glowL.position.copy(ph.position).add(V(0, 0.06, 0)); });
    return { you, alarm: true, cam: { pos: () => K.head(you).add(V(1.05, 0.42, 1.25)), target: () => K.head(you).add(V(0.12, -0.32, 0.05)), fov: 42, push: 0.015 }, look: { exposure: 1.5, aperture: 0.0025, maxblur: 0.009, bloom: 0.45, vignette: 0.5 } };
  },

  // a house party in a crowded city flat: string lights, people in small groups with cups, turned to each other;
  // you just inside the doorway, arms crossed, part of no group. Seen from behind and to one side.
  strangers(K) {
    const { I, scene, R } = K, W = 6.4, D = 5.4, Hh = 2.75;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#D8CFC0' }), floor: I.floorWood({ a: '#7A5434', b: '#9A6E48', plank: 0.12, len: 1.2 }),
      holes: [{ wall: 'back', at: -1.6, y0: 0.6, w: 1.4, h: 1.7 }, { wall: 'back', at: 0.6, y0: 0.6, w: 1.4, h: 1.7 }, { wall: 'right', at: 1.7, y0: 0, w: 0.9, h: 2.05 }, { wall: 'left', at: -1.2, y0: 0, w: 1.0, h: 2.1 }], open: ['front'] });
    scene.add(room.group);
    for (const at of [-1.6, 0.6]) { const w = room.onWall('back', at, 0.6); w.add(I.windowUnit({ w: 1.4, h: 1.7, cols: 2, rows: 2 })); }
    const dw = room.onWall('right', 1.7, 0); dw.add(I.doorway({ w: 0.9, h: 2.05, open: -1.45, hingeLeft: false }));
    // the hall beyond the door, lit
    I.mesh(new THREE.PlaneGeometry(2.4, Hh), I.plaster({ color: '#D9D2C4' }), W / 2 + 1.4, Hh / 2, 1.7, { ry: -PI / 2, parent: scene });
    I.mesh(new THREE.PlaneGeometry(2.6, 2.4), I.floorWood({ a: '#7A5434', b: '#9A6E48' }), W / 2 + 1.2, 0.001, 1.7, { rx: -PI / 2, parent: scene, cast: false });
    K.point('#FFD7A8', 2.5, W / 2 + 1.0, 2.4, 1.7);
    // the kitchen through the left doorway
    I.mesh(new THREE.PlaneGeometry(3, Hh), I.plaster({ color: '#E6E2D8' }), -W / 2 - 1.8, Hh / 2, -1.2, { ry: PI / 2, parent: scene });
    K.point('#FFF0D8', 6, -W / 2 - 1.0, 2.5, -1.2);
    nightStreet(K, { level: 14, across: -30, seed: 9, lamps: [[-3, -8], [12, -8]], lit: 0.38 });
    // party lights zigzagging under the ceiling, a floor lamp
    scene.add(I.stringLights([[-W / 2 + 0.1, Hh - 0.08, -D / 2 + 0.1], [-1.2, Hh - 0.12, 0.6], [0.4, Hh - 0.08, -D / 2 + 0.1], [1.8, Hh - 0.12, 0.7], [W / 2 - 0.1, Hh - 0.08, -D / 2 + 0.2]], { sag: 0.18, lights: 6, power: 1.6, value: 16 }));
    scene.add(I.stringLights([[-W / 2 + 0.05, Hh - 0.25, -D / 2 + 0.2], [-W / 2 + 0.05, Hh - 0.2, 1.6]], { sag: 0.1, lights: 2, power: 0.9, value: 14 }));
    K.add(I.lamp({ kind: 'floor', power: 7, shade: '#EADBC0' }), -W / 2 + 0.4, 0, 1.4);
    K.env(0.06);
    // a sofa along the left, a table of bottles, a sideboard, a plant, a rug
    const so = I.sofa({ seats: 3, color: '#5E6A6E', seed: 4 }); K.add(so, -W / 2 + 0.5, 0, 0.2, PI / 2);
    K.add(I.table({ w: 1.4, d: 0.7, h: 0.76 }), 2.0, 0, -D / 2 + 0.5);
    for (let i = 0; i < 7; i++) K.add(I.bottle({ color: R.pick(['#2E5A3A', '#5A3A1E', '#C8D8D0', '#3A2A1A']), h: R.range(0.24, 0.32) }), 2.0 + R.range(-0.6, 0.6), 0.76, -D / 2 + 0.5 + R.range(-0.25, 0.25));
    for (let i = 0; i < 6; i++) K.add(I.cup({}), 2.0 + R.range(-0.6, 0.6), 0.76, -D / 2 + 0.5 + R.range(-0.25, 0.25));
    K.add(I.cabinet({ w: 1.6, h: 0.9, d: 0.4, doors: 4, color: '#6A503C' }), -0.5, 0, -D / 2 + 0.22);
    K.add(I.plant({ h: 1.1, seed: 4 }), 1.25, 0, -D / 2 + 0.3);
    K.add(I.rug({ w: 2.4, d: 1.7, color: '#8A4A36', border: '#D8C8A8' }), -1.1, 0, 0.4, 0.05);
    const pf = room.onWall('back', -0.5, 1.2); pf.add(I.picture({ w: 0.8, h: 0.6, seed: 11 }));
    // the party: small groups, turned to each other
    const groups = [{ x: -1.3, z: -1.3, n: 4 }, { x: 1.2, z: -1.0, n: 3 }, { x: -0.3, z: 0.6, n: 3 }, { x: -2.4, z: 0.0, n: 2, sit: true }];
    for (const g of groups) {
      for (let i = 0; i < g.n; i++) {
        const a = (i / g.n) * PI * 2 + R.range(-0.3, 0.3), rr = g.n > 2 ? 0.5 : 0.38, x = g.x + Math.cos(a) * rr, z = g.z + Math.sin(a) * rr, yaw = yawTo(x, z, g.x, g.z);
        if (g.sit) { K.fig({ kind: R.pick(['man', 'woman']), pose: 'sitTurn', x: -W / 2 + 0.92, z: 0.2 + (i ? 0.62 : -0.62), yaw: PI / 2, seat: so.userData.seatH, o: { lookY: i ? -0.9 : 0.9 } }); continue; }
        const pose = R.pick(['talkCup', 'holdCup', 'laugh', 'listen', 'talk']);
        const F = K.fig({ kind: R.pick(['man', 'woman', 'woman', 'man', 'teen']), pose, x, z, yaw, o: { lookY: R.range(-0.3, 0.3) } });
        if (pose !== 'talk') K.hold(F, I.cup({ wine: R() < 0.35 }), { hand: pose === 'talkCup' ? 'l' : 'r', off: [0, -0.02, 0.02] });
      }
    }
    // you: just inside the door, arms crossed, at the edge of it all
    const you = K.fig({ red: true, kind: 'man', pose: 'armsCrossed', x: 2.4, z: 1.45, yaw: -1.85, o: { lookY: 0.1 } });
    return { you, alarm: true, cam: { pos: [3.1, 1.6, 3.35], target: [-0.4, 1.1, -0.9], fov: 42, push: 0.03 }, look: { exposure: 0.88, aperture: 0.0016, bloom: 0.4, warm: 0.2, vignette: 0.4 } };
  },

  // a kitchen at midnight: at the open fridge, its light the only light, reaching for something on shelves of
  // brightly packaged food
  cravings(K) {
    const { I, scene } = K, W = 3.4, D = 3.2, Hh = 2.5;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#D9D4CA' }), floor: I.tiles({ color: '#B9B2A6', grout: '#6E6860', size: 0.4, rough: 0.25 }), holes: [{ wall: 'right', at: -0.6, y0: 0.95, w: 1.0, h: 1.2 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('right', -0.6, 0.95); win.add(I.windowUnit({ w: 1.0, h: 1.2, cols: 1 }));
    scene.add(I.citySky({ horizon: '#1E1612', zenith: '#03040A', glow: 0.5 }));
    // the back wall: the fridge at the left, then units with a worktop, a splashback of tiles
    const run = I.kitchenRun({ len: 2.4, skip: [[-0.9, -0.9]], hob: 0.6, sink: -0.1 }); K.add(run, 0.1, 0, -D / 2 + 0.31);
    I.mesh(new THREE.PlaneGeometry(1.8, 0.55), I.tiles({ color: '#E8E6E0', grout: '#B8B4AC', size: 0.15, sizeY: 0.075, plane: 'xy', rough: 0.1 }), 0.4, 1.17, -D / 2 + 0.003, { cast: false, parent: scene });
    K.add(I.fridge({ open: 2.05, power: 6.5, seed: 6 }), -0.8, 0, -D / 2 + 0.33);
    K.add(I.table({ w: 1.0, d: 0.8 }), 0.8, 0, 0.75); K.add(I.chair({}), 0.8, 0, 1.3, PI);
    room.onWall('back', -0.8, 2.12).add(I.wallClock({ hour: 0.2, r: 0.12 }));
    K.env(0.012);
    // you at the fridge, reaching in
    const you = K.fig({ red: true, kind: 'man', pose: 'reachFridge', x: -1.0, z: -D / 2 + 1.02, yaw: PI - 0.6, o: { reachY: 0.0 } });
    return { you, alarm: false, cam: { pos: [1.0, 1.5, -0.1], target: [-0.85, 1.05, -1.05], fov: 42, push: 0.03 }, look: { exposure: 1.2, aperture: 0.0015, bloom: 0.35, vignette: 0.45 } };
  },
  // 7:00 on a school morning: a teenager buried under the duvet, one arm out towards the alarm lit on the floor; a
  // parent in the doorway with a mug; grey morning light through the blinds
  teens(K) {
    const { I, scene } = K, W = 3.4, D = 3.6, Hh = 2.45;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#9AA4AC' }), floor: I.carpet({ color: '#6A6460' }), holes: [{ wall: 'left', at: 0.75, y0: 0.9, w: 1.0, h: 1.25 }, { wall: 'back', at: 0.95, y0: 0, w: 0.86, h: 2.03 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('left', 0.75, 0.9); win.add(I.windowUnit({ w: 1.0, h: 1.25, cols: 1 }));
    const bl = I.blinds({ w: 1.0, h: 1.25, open: 0.62, color: '#E2DED6' }); bl.position.z = 0.06; win.add(bl);
    room.onWall('back', 0.95, 0).add(I.doorway({ w: 0.86, h: 2.03, open: -1.35, hingeLeft: true }));
    // the landing beyond the door, lit warm
    I.mesh(new THREE.PlaneGeometry(2.4, Hh), I.plaster({ color: '#D8D0C0' }), 0.95, Hh / 2, -D / 2 - 1.3, { parent: scene });
    I.mesh(new THREE.PlaneGeometry(2.4, 1.6), I.carpet({ color: '#7A6E62' }), 0.95, 0.001, -D / 2 - 0.7, { rx: -PI / 2, parent: scene, cast: false });
    K.point('#FFC88E', 3.0, 0.7, 2.25, -D / 2 - 0.8);
    scene.add(I.citySky({ zenith: '#7C8794', horizon: '#AEB4BA', glow: 1, clouds: 0.3 }));
    scene.add(I.buildings([{ x: -18, z: 6, w: 12, d: 18, h: 9 }, { x: -20, z: 24, w: 12, d: 14, h: 10 }], { lit: 0.12, facade: '#8C8478', seed: 3 }));
    // grey daylight: the sky's glow through the window, a soft beam striped by the slats falling across the bed
    K.rect('#B8C2CE', 3.2, 0.95, 1.15, [-W / 2 + 0.05, 1.5, 0.75], [0, 1.4, 0.75]);
    K.spot('#C9D2DC', 100, [-W / 2 - 3.0, 3.3, 1.6], [-0.4, 0.4, -0.4], 0.3, 0.4, { size: 1024, radius: 7, bias: -0.0006, near: 1 });
    K.env(0.08);
    // a single bed with its head against the left wall; a desk with a dark monitor; clothes on the floor; posters
    const bed = I.bed({ w: 1.0, l: 2.0, top: 0.48, sheet: '#3E4656', pillow: '#4A5262', headboard: 0.8, pillows: 1, frame: I.woodFurniture({ color: '#B49A7A', axis: 'z' }), seed: 3 });
    K.add(bed, -W / 2 + 1.06, 0, -0.55, PI / 2);
    const desk = I.table({ w: 1.1, d: 0.55, top: I.paint({ color: '#E8E6E0', rough: 0.4 }), legs: I.metal('#9A9C9E', 0.4) }); K.add(desk, W / 2 - 0.3, 0, -0.3, -PI / 2);
    K.add(I.monitor({ on: false, w: 0.55, h: 0.32 }), W / 2 - 0.4, 0.75, -0.3, -PI / 2);
    K.add(I.officeChair({ color: '#2A2C30' }), W / 2 - 0.8, 0, 0.1, -PI / 2 - 0.8);
    const c1 = I.cloth({ w: 0.6, color: '#2E3440', seed: 4, h: 0.1 }); c1.position.set(0.55, 0, 0.6); scene.add(c1);
    const c2 = I.cloth({ w: 0.45, color: '#8A6E2E', seed: 6, h: 0.08 }); c2.position.set(0.3, 0, -0.9); c2.rotation.y = 1; scene.add(c2);
    K.add(I.gymBag({ color: '#1F2A3C', trim: '#C8C8C8', l: 0.45, r: 0.13 }), -0.2, 0, -1.55, 0.3);
    for (const [at, y, sd] of [[-0.6, 1.25, 21], [-1.3, 1.5, 22]]) room.onWall('left', at, y).add(I.picture({ w: 0.45, h: 0.62, frame: '#1A1A1A', mat: '#1A1A1A', warm: false, seed: sd, border: 0.012 }));
    // the teen: curled on the right side under the duvet facing us, head on the pillow, left arm out over the edge
    const you = K.fig({ red: true, kind: 'teen', pose: 'curl', x: -W / 2 + 1.12, z: -0.47, yaw: 0, lie: 0.48, o: { reach: true } });
    const caps = I.bodyCapsules(you.m, bed, { arms: true }).filter((c, i) => i !== 9), hd = you.m.world(you.m.J.head, V(0, 0.1, 0)); bed.worldToLocal(hd);
    bed.add(I.duvet({ w: 1.0, l: 2.0, top: 0.48, z0: hd.z + 0.03, bodies: caps, lumps: [{ x: 0.05, z: hd.z + 0.12, rx: 0.32, rz: 0.14, h: 0.2 }], color: '#5A6478', seed: 9, wrinkle: 1.0, hang: 0.3 }));
    const ph = I.phone({ kind: 'alarm', value: 3.6, light: 7, pulse: 0.35, lightColor: '#E8D8C8' }); ph.rotation.set(-PI / 2, 0, 0.5);
    ph.position.set(-W / 2 + 0.7, 0.0055, 0.22); scene.add(ph);
    // the parent at the door with a mug
    const par = K.fig({ kind: 'woman', pose: 'leanMug', x: 0.98, z: -D / 2 - 0.05, yaw: yawTo(0.98, -D / 2, -1.2, -0.5), o: { lookY: 0.05 } });
    K.hold(par, I.mug({ color: '#D9D4C8' }), { hand: 'r', off: [0, -0.03, 0.02] });
    return { you, alarm: false, cam: { pos: [0.4, 1.2, 1.75], target: [-0.45, 0.66, -0.85], fov: 46, push: 0.02 }, look: { exposure: 1.15, aperture: 0.0012, bloom: 0.35, vignette: 0.38 } };
  },

  // a primary school classroom under fluorescent light: rows of children at desks facing the whiteboard; one child,
  // twisted round in the chair, looking out of the window at the playground and the trees
  restless(K) {
    const { I, scene, R } = K, W = 7.2, D = 7.0, Hh = 3.0;
    const holes = [-2.2, 0, 2.2].map((at) => ({ wall: 'right', at, y0: 0.85, w: 1.8, h: 1.7 }));
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#E4DED0' }), floor: I.vinyl({ color: '#8C8476', fleck: '#C8C0B0', rough: 0.45 }), holes, open: ['front'] });
    scene.add(room.group);
    for (const h of holes) room.onWall('right', h.at, 0.85).add(I.windowUnit({ w: 1.8, h: 1.7, cols: 3, rows: 2 }));
    room.onWall('back', -0.4, 0.9).add(I.whiteboard({ w: 2.6, h: 1.2 }));
    room.onWall('left', 0.2, 1.1).add(I.pinboard({ w: 2.4, h: 1.0, n: 10 }));
    room.onWall('back', 2.4, 2.1).add(I.wallClock({ hour: 10.7, r: 0.16 }));
    // outside: a sunny morning, a playground, trees
    const sun = sunDir(38, 250); scene.add(I.citySky({ zenith: '#6E9CD8', horizon: '#DCE6EE', glow: 1.7, clouds: 0.45 }));
    I.mesh(new THREE.PlaneGeometry(60, 60), I.paint({ color: '#5E5E60', rough: 0.9 }), W / 2 + 30, -0.05, 0, { rx: -PI / 2, parent: scene, cast: false });
    I.mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#5C7A3A', roughness: 1 }), W / 2 + 70, -0.06, 0, { rx: -PI / 2, parent: scene, cast: false });
    for (let i = 0; i < 4; i++) I.mesh(new THREE.PlaneGeometry(0.08, 12), I.paint({ color: '#E8E4D8', rough: 0.8 }), W / 2 + 6 + i * 3.5, -0.045, -2 + i, { rx: -PI / 2, parent: scene, cast: false });
    for (let i = 0; i < 9; i++) K.add(I.tree({ seed: i + 3, h: R.range(7, 11), tint: R.pick(['#5E7A3E', '#6E8A44', '#4E6A36']) }), W / 2 + R.range(18, 34), 0, R.range(-16, 16));
    for (let z = -20; z <= 20; z += 2.5) I.block(scene, I.metal('#4A5A4A', 0.5), 0.05, 1.6, 0.05, W / 2 + 14, 0, z, 0.01);
    const sl = new THREE.DirectionalLight('#FFF1DC', 2.4); sl.position.copy(sun).multiplyScalar(30); scene.add(sl, sl.target); sl.target.position.set(0, 0, 0);
    K.shadow(sl, { size: 2048, radius: 3, bias: -0.0004, near: 1 }); Object.assign(sl.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, far: 80 });
    for (const h of holes) K.rect('#CFE0F2', 5, 1.7, 1.6, [W / 2 - 0.05, 1.7, h.at], [0, 1.6, h.at]);
    // fluorescent battens, one shadowing spot
    for (const x of [-2.2, 0, 2.2]) for (const z of [-2.0, 0.3, 2.6]) K.add(I.ceilingPanel({ w: 1.25, d: 0.18, batten: true, power: 9, value: 5, ceilH: Hh, color: '#EEF4FF' }), x, 0, z);
    K.spot('#EEF4FF', 40, [0.2, Hh - 0.1, 0.8], [0.2, 0, 0.8], 1.2, 0.9);
    K.env(0.18);
    // desks in rows, two children to a desk, all facing the board; the teacher at the board
    const cols = [-2.1, -0.15, 1.85], rows = [-1.5, -0.2, 1.1, 2.4], pastel = ['#3E6E8E', '#C8573A', '#3E8E5A', '#D8A23A'];
    let you = null;
    for (const [ri, z] of rows.entries()) for (const [ci, x] of cols.entries()) {
      K.add(I.schoolDesk({ w: 1.2, d: 0.5, h: 0.6 }), x, 0, z);
      for (const dx of [-0.3, 0.3]) {
        const cx = x + dx, cz = z + 0.48; K.add(I.schoolChair({ color: pastel[(ri + ci) % 4] }), cx, 0, cz, PI);
        const red = ri === 3 && ci === 1 && dx > 0;
        if (!red && R() < 0.12) continue;
        const F = K.fig({ red, kind: 'child', pose: red ? 'twistLook' : R() < 0.6 ? 'write' : 'sitTurn', x: cx, z: cz - 0.04, yaw: PI, seat: 0.36, sink: 0.01, o: red ? { side: -1 } : { headDown: R.range(-0.1, 0.4), lookY: R.range(-0.2, 0.2), lean: 0.1 } });
        if (red) you = F;
      }
    }
    K.fig({ kind: 'woman', pose: 'talk', x: 1.0, z: -D / 2 + 0.7, yaw: 0.2, o: { lookY: 0.1 } });
    K.add(I.table({ w: 1.3, d: 0.65 }), 2.0, 0, -D / 2 + 0.8);
    return { you, alarm: false, cam: { pos: [0.1, 1.6, 4.9], target: [1.25, 0.85, -0.6], fov: 44, push: 0.03 }, look: { exposure: 0.85, aperture: 0.0012, bloom: 0.2, vignette: 0.3, warm: 0.05 } };
  },

  // early evening in a small flat: a packed gym bag by the front door; you sunk into the sofa with a phone, the TV's
  // glow on your legs; seen from behind the sofa
  effort(K) {
    const { I, scene } = K, W = 4.4, D = 4.6, Hh = 2.5;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#CFC6B6' }), floor: I.floorWood({ a: '#8A6A4C', b: '#A88462', plank: 0.18, len: 1.8 }), holes: [{ wall: 'left', at: -1.0, y0: 0, w: 0.92, h: 2.05 }, { wall: 'right', at: -0.7, y0: 0.85, w: 1.3, h: 1.4 }], open: ['front'] });
    scene.add(room.group);
    room.onWall('left', -1.0, 0).add(I.doorway({ w: 0.92, h: 2.05, open: 0, color: '#EDEBE5', leaf: '#5A6670' }));
    room.onWall('right', -0.7, 0.85).add(I.windowUnit({ w: 1.3, h: 1.4, cols: 2 }));
    scene.add(I.citySky({ zenith: '#1C2C4E', horizon: '#6A6E86', glow: 1, clouds: 0.5 }));
    scene.add(I.buildings([{ x: 16, z: -6, w: 12, d: 20, h: 18 }, { x: 22, z: 14, w: 14, d: 12, h: 26 }], { lit: 0.35, street: -5, seed: 6 }));
    K.rect('#6E80B0', 3.5, 1.2, 1.3, [W / 2 - 0.05, 1.5, -0.7], [0, 1.4, -0.7]);
    K.env(0.05);
    // TV on a unit against the back wall, the sofa facing it, a coffee table between
    const t = I.tv({ w: 1.25, on: true, light: 7, value: 1.4, seed: 5 }); K.add(t, 0.1, 0, -D / 2 + 0.25);
    const so = I.sofa({ seats: 3, color: '#4E5A66', seed: 6 }); K.add(so, 0.1, 0, 0.75, PI);
    K.add(I.table({ w: 1.0, d: 0.55, h: 0.42, inset: 0.05 }), 0.1, 0, -0.42);
    K.add(I.mug({ color: '#2E3440' }), 0.42, 0.42, -0.5); K.add(I.rug({ w: 2.0, d: 1.4, color: '#6E665E' }), 0.1, 0, -0.3);
    // by the front door: the packed gym bag, trainers, a jacket on a hook
    K.add(I.gymBag({ color: '#3A6E8C', trim: '#E0E4E8', l: 0.62, r: 0.17 }), -W / 2 + 0.5, 0, -0.95, 0.15);
    K.add(I.trainers({ color: '#E2E2DE' }), -W / 2 + 0.75, 0, -1.35, 0.8);
    I.block(room.onWall('left', -0.1, 1.7), I.metal('#3A3A3A', 0.4), 0.5, 0.03, 0.04, 0, 0, 0.02, 0.008);
    const jk = I.curtain({ w: 0.42, h: 0.8, color: '#2E3A2E', folds: 3, depth: 0.04, seed: 5 }); jk.position.set(0, 1.7, 0.08); room.onWall('left', -0.1, 0).add(jk);
    // you: sunk into the middle seat, feet up on the table, phone held at the chest
    const you = K.fig({ red: true, kind: 'man', pose: 'slump', x: 0.1, z: 0.66, yaw: PI, seat: so.userData.seatH, sink: 0.08 });
    K.hold(you, I.phone({ kind: 'feed', seed: 3, value: 1.8, light: 1.6, scroll: 0.45 }), { off: [0, 0.02, 0.02], face: K.eyes(you) });
    return { you, alarm: false, cam: { pos: [0.85, 1.62, 2.3], target: [-0.35, 0.68, -0.9], fov: 46, push: 0.025 }, look: { exposure: 1.2, aperture: 0.0012, bloom: 0.3, vignette: 0.4 } };
  },

  // an open-plan office at 9pm, empty except for you at a desk with your head in your hands in front of a monitor
  // full of rows; rows of empty desks; half the ceiling lights off
  burnout(K) {
    const { I, scene, R } = K, W = 14, D = 12, Hh = 2.85;
    const holes = []; for (let x = -5.5; x <= 5.5; x += 2.2) holes.push({ wall: 'back', at: x, y0: 0.85, w: 1.9, h: 1.75 }); for (let z = -4; z <= 4; z += 2.2) holes.push({ wall: 'left', at: z, y0: 0.85, w: 1.9, h: 1.75 });
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#D6D6D2' }), floor: I.carpet({ color: '#4E545C' }), ceiling: I.tiles({ color: '#D8D8D4', grout: '#B4B4B0', size: 0.6, plane: 'xz', rough: 0.9, vary: 0.02 }), holes });
    scene.add(room.group);
    for (const h of holes) room.onWall(h.wall, h.at, 0.85).add(I.windowUnit({ w: 1.9, h: 1.75, cols: 1, color: '#5A5E62', sill: false }));
    nightStreet(K, { level: 24, across: -14, seed: 12, lamps: [], lit: 0.4, far: 1.5 });
    scene.add(I.buildings([{ x: -40, z: 0, w: 16, d: 40, h: 60 }, { x: -36, z: -40, w: 20, d: 20, h: 90 }], { lit: 0.35, street: -24, seed: 13 }));
    // ceiling panels on a grid: the ones over you on, a few others far off, the rest dark
    for (let x = -6; x <= 6; x += 2.4) for (let z = -4.8; z <= 4.8; z += 2.4) {
      const near = Math.abs(x) < 2 && Math.abs(z - 0.0) < 1.3, on = near || (x < -3 && z < -2) || (x > 4 && z < -3);
      K.add(I.ceilingPanel({ w: 0.6, d: 0.6, on, power: 13, value: 4.5, ceilH: Hh, spot: near && x > 0 ? 34 : 0 }), x, 0, z);
    }
    K.env(0.05);
    // rows of desks, monitors dark, chairs left where they were
    let you = null;
    for (const zd of [-3.6, -1.6, 0.4, 2.6, 4.6]) for (let x = -5.6; x <= 5.6; x += 1.45) {
      const mine = zd === 0.4 && Math.abs(x - 0.2) < 0.5;
      K.add(I.officeDesk({ w: 1.4, d: 0.75 }), x, 0, zd);
      K.add(I.monitor({ on: mine, kind: 'rows', w: 0.6, h: 0.35, light: mine ? 4.5 : 0, value: 1.15, seed: 3 }), x, 0.74, zd - 0.18);
      if (!mine && R() < 0.3) K.add(I.books({ n: 3, lying: true, seed: x * 7 + zd }), x + 0.4, 0.74, zd - 0.1, R() * 0.4);
      if (!mine && R() < 0.15) K.add(I.mug({ color: R.pick(['#E8E4DC', '#3A5A7A', '#C84A3A']) }), x - 0.35, 0.74, zd + 0.1);
      K.add(I.officeChair({ yaw: 0, seed: x }), x + (mine ? 0 : R.range(-0.2, 0.2)), 0, zd + (mine ? 0.62 : R.range(0.5, 0.8)), PI + (mine ? 0 : R.range(-0.6, 0.6)));
      if (mine) {
        you = K.fig({ red: true, kind: 'man', pose: 'headInHands', x, z: zd + 0.66, yaw: PI, seat: 0.48, sink: 0.03 });
        K.add(I.mug({ color: '#E8E4DC' }), x + 0.42, 0.74, zd - 0.05);
        I.block(scene, I.plastic('#2A2C30', 0.5), 0.44, 0.02, 0.14, x, 0.74, zd + 0.1, 0.004);
      }
    }
    for (const [x, z] of [[-6.5, -5.5], [6.5, 5.3], [-6.4, 2]]) K.add(I.plant({ h: 1.3, seed: x }), x, 0, z);
    return { you, alarm: true, cam: { pos: [1.55, 1.55, 1.85], target: [-0.15, 0.88, -0.35], fov: 46, push: 0.025 }, look: { exposure: 1.15, aperture: 0.0014, bloom: 0.3, vignette: 0.42 } };
  },

  // 4am in a small flat: alone on the edge of the sofa holding a crying baby; one lamp on; a bottle and a cloth on the
  // table; nobody else
  newparent(K) {
    const { I, scene } = K, W = 3.9, D = 4.0, Hh = 2.5;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#C9BFAE' }), floor: I.floorWood({ a: '#7A5A40', b: '#946E50' }), holes: [{ wall: 'left', at: -0.6, y0: 0.85, w: 1.2, h: 1.4 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('left', -0.6, 0.85); win.add(I.windowUnit({ w: 1.2, h: 1.4 }));
    const c1 = I.curtain({ w: 0.5, h: 2.1, color: '#6A5E52', folds: 6 }); c1.position.set(0.8, 1.55, 0.1); win.add(c1);
    nightStreet(K, { level: 6, across: -6, seed: 21, lamps: [], lit: 0.06, far: 0.4 });
    K.rect('#5E78A8', 0.7, 1.1, 1.3, [-W / 2 + 0.05, 1.5, -0.6], [0, 1.4, -0.6]);
    K.env(0.025);
    const so = I.sofa({ seats: 3, color: '#8A7E70', seed: 9 }); K.add(so, -0.45, 0, -D / 2 + 0.5);
    const right = so.position.x + so.userData.W / 2;
    K.add(I.cabinet({ w: 0.45, h: 0.55, d: 0.42, doors: 1, color: '#5A4636', drawer: true }), right + 0.3, 0, -D / 2 + 0.45);
    K.add(I.lamp({ kind: 'table', power: 3.0, shade: '#E8DCC4', base: '#7A6A5A', shadeR: [0.17, 0.1] }), right + 0.3, 0.55, -D / 2 + 0.45);
    K.add(I.table({ w: 1.0, d: 0.55, h: 0.42, inset: 0.05 }), -0.2, 0, -0.5);
    K.add(I.babyBottle(), 0.1, 0.42, -0.45);
    const cl = I.cloth({ w: 0.45, color: '#EEEAE0', seed: 5, h: 0.04 }); cl.position.set(-0.35, 0.42, -0.5); scene.add(cl);
    K.add(I.mug({ color: '#B8C4CC' }), -0.55, 0.42, -0.38);
    K.add(I.rug({ w: 2.0, d: 1.4, color: '#7A6E64' }), -0.3, 0, -0.5);
    K.add(I.cushion({ color: '#A88A64', seed: 3 }), so.position.x - 0.7, 0.5, -D / 2 + 0.55).rotation.set(-0.3, 0.3, 0.2);
    // a laundry basket, a pack of nappies: the last weeks
    I.block(scene, I.plastic('#D8D2C4', 0.6), 0.5, 0.28, 0.36, -1.45, 0, -0.3, 0.04); const cl2 = I.cloth({ w: 0.5, color: '#C8B8D8', seed: 7, h: 0.1 }); cl2.position.set(-1.45, 0.24, -0.3); scene.add(cl2);
    I.block(scene, I.plastic('#9AC8E0', 0.5), 0.3, 0.22, 0.2, 1.3, 0, -0.6, 0.01);
    // you, on the edge of the right-hand seat beside the lamp, rocking the baby
    const you = K.fig({ red: true, kind: 'woman', pose: 'sitCradle', x: so.position.x + so.userData.xs[2] + 0.02, z: so.position.z + 0.22, yaw: -0.25, seat: so.userData.seatH, sink: 0.04 });
    const baby = K.fig({ kind: 'toddler', pose: 'babyCry', scale: 0.74, x: 0, z: 0, wood: 'birch' });
    const bk = 1 / baby.m.root.scale.x, sw = I.mesh(I.cushionGeo(0.2 * bk, 0.4 * bk, 0.15 * bk, { round: 0.6, puff: 0.3, seed: 2 }), I.fabric({ color: '#EEF2F4', sheen: 0.6 }), 0, -0.05 * bk, 0.01 * bk); baby.m.J.hips.add(sw); // the swaddle, sized in metres
    const q = new THREE.Quaternion(), X = V(0, 0, 0), Y = V(0, 0, 0), Z = V(0, 0, 0), M4 = new THREE.Matrix4(), a = V(0, 0, 0), b = V(0, 0, 0);
    baby.place = (t) => {
      const m = baby.m; m.pose(POSE.babyCry(t, baby.r));
      you.m.root.updateMatrixWorld(true); you.m.J.chest.getWorldQuaternion(q);
      you.m.world(you.m.J.lEl, a.set(0, 0, 0)); you.m.world(you.m.J.rWr, b.set(0, -0.06, 0));
      Y.set(1, 0.5, 0.1).applyQuaternion(q).normalize(); Z.set(0, 0.85, -0.5).applyQuaternion(q).normalize(); X.crossVectors(Y, Z).normalize(); Z.crossVectors(X, Y);
      M4.makeBasis(X, Y, Z); m.root.quaternion.setFromRotationMatrix(M4);
      m.root.position.copy(a).lerp(b, 0.5).addScaledVector(Y, -0.3).addScaledVector(Z, 0.04); m.root.position.y -= 0.0;
      m.root.updateMatrixWorld(true);
    };
    return { you, alarm: true, cam: { pos: [0.95, 1.22, 0.75], target: [0.35, 0.74, -1.3], fov: 42, push: 0.02 }, look: { exposure: 1.3, aperture: 0.0016, bloom: 0.35, vignette: 0.45, warm: 0.15 } };
  },

  // bed at night: lying on your side, face lit by the phone, scrolling; the room dark
  news(K) {
    const { I, scene } = K, W = 3.2, D = 3.6, Hh = 2.45;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#AAA49A' }), floor: I.floorWood({ a: '#5E4A3A', b: '#7A5E48' }), holes: [{ wall: 'right', at: -0.9, y0: 0.85, w: 1.1, h: 1.35 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('right', -0.9, 0.85); win.add(I.windowUnit({ w: 1.1, h: 1.35 }));
    for (const [x, sd] of [[-0.3, 1], [0.32, 2]]) { const c = I.curtain({ w: 0.65, h: 2.1, color: '#2E3440', folds: 8, seed: sd }); c.position.set(x, 1.6, 0.1); win.add(c); }
    K.rect('#4A5E88', 0.25, 0.1, 1.3, [W / 2 - 0.12, 1.4, -0.88], [0, 1.4, -0.88]);
    K.env(0.012);
    const bed = I.bed({ w: 1.5, l: 2.0, top: 0.52, sheet: '#C8C6C0', pillow: '#D6D4CE', seed: 12 });
    K.add(bed, -W / 2 + 0.77, 0, -D / 2 + 1.05);
    K.add(I.cabinet({ w: 0.42, h: 0.5, d: 0.36, doors: 1, color: '#4E3E30', drawer: true }), -W / 2 + 1.82, 0, -D / 2 + 0.25);
    K.add(I.digitalClock({ time: '1:47', color: '#8FD0FF', value: 2.5 }), -W / 2 + 1.75, 0.5, -D / 2 + 0.38, -0.5);
    // you, on the left side facing the room, the phone held in front of your face
    const you = K.fig({ red: true, kind: 'woman', pose: 'lieSidePhone', mirror: true, x: bed.position.x + 0.22, z: bed.position.z - 0.12, yaw: PI / 2, lie: 0.52 });
    const caps = I.bodyCapsules(you.m, bed, { arms: false }), sh = you.m.world(you.m.J.chest, V(0, 0.1, 0)); bed.worldToLocal(sh);
    bed.add(I.duvet({ w: 1.5, l: 2.0, top: 0.52, z0: sh.z, bodies: caps, color: '#7E8694', seed: 13, wrinkle: 1.2 }));
    const ph = I.phone({ kind: 'news', seed: 4, value: 2.0, light: 5, scroll: 0.55, flicker: 0.04, lightColor: '#C8D4F0' });
    K.hold(you, ph, { hand: 'r', off: [0.0, 0.03, 0.0], face: K.eyes(you), up: () => V(0, 1, 0) });
    const gl = K.point('#B8C8F0', 0.12, 0, 0, 0); K.on((t) => { gl.position.copy(ph.position).add(V(0.05, 0.02, 0)); gl.intensity = 0.12 * (0.9 + 0.1 * Math.sin(t * 17)); });
    return { you, alarm: true, cam: { pos: () => K.head(you).add(V(0.85, 0.78, 0.68)), target: () => K.head(you).add(V(0.08, -0.06, 0.12)), fov: 40, push: 0.012 }, look: { exposure: 1.6, aperture: 0.0025, maxblur: 0.009, bloom: 0.45, vignette: 0.5 } };
  },

  // a night bus: you scrolling a phone of bright tiles; reflections in the window; other passengers on phones too
  compare(K) {
    const { I, scene, R } = K;
    const bus = I.busInterior({ rows: 8, z0: -3.3, light: 9 }); scene.add(bus);
    for (const s of [-1, 1]) scene.add(I.passingStreet({ side: s, seed: s + 5, n: 54, len: 48 }));
    scene.add(I.citySky({ zenith: '#04060C', horizon: '#1E1612', glow: 0.8 }));
    K.env(0.05);
    const seats = bus.userData.seats, mine = seats.find((s) => s.side > 0 && s.window && s.row === 4);
    const rp = I.reflectPane(3.6, bus.userData.wy1 - bus.userData.wy0 - 0.02, { strength: 0.32 }); rp.position.set(bus.userData.w / 2 + 0.05, (bus.userData.wy0 + bus.userData.wy1) / 2, mine.z); rp.rotation.y = -PI / 2; scene.add(rp);
    const you = K.fig({ red: true, kind: 'woman', pose: 'busPhone', x: mine.x, z: mine.z, yaw: PI, seat: 0.46, sink: 0.03, o: { lean: 0.05 } });
    const ph = K.hold(you, I.phone({ kind: 'feed', seed: 8, value: 2.6, light: 4, scroll: 0.5, lightColor: '#F0E8F0' }), { off: [0, 0.03, 0.05], face: K.eyes(you) });
    for (const s of seats) {
      if (s === mine || R() > 0.45 || (s.row === 4 && s.side > 0) || (s.row === 3) || (s.row === 4 && s.side < 0) || (s.row === 5 && s.side > 0)) continue;
      const F = K.fig({ kind: R.pick(['man', 'woman', 'old', 'teen']), pose: R() < 0.75 ? 'busPhone' : 'sitTurn', x: s.x, z: s.z, yaw: PI, seat: 0.46, sink: 0.03, o: { lookY: s.side * 0.5, headDown: 0.2 } });
      if (F.f.pose === 'busPhone') K.hold(F, I.phone({ kind: 'feedDim', seed: R() * 50, value: 1.4, light: 0, scroll: R.range(0.2, 0.6) }), { off: [0, 0.02, 0.03], face: K.eyes(F) });
    }
    return { you, alarm: true, cam: { pos: () => V(mine.x - 0.62, 1.74, mine.z + 0.3), target: () => ph.position.clone().add(V(0.16, 0.14, -0.08)), fov: 46, push: 0.01 }, look: { exposure: 1.15, aperture: 0.0022, maxblur: 0.009, bloom: 0.4, vignette: 0.42 } };
  },

  // a long grey sofa in a quiet living room in the evening: you at one end, knees up, hugging a cushion; the rest of
  // the sofa empty; the TV off; one lamp
  touch(K) {
    const { I, scene } = K, W = 5.4, D = 4.6, Hh = 2.55;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#BCC0BC' }), floor: I.floorWood({ a: '#A08060', b: '#B8966E', plank: 0.2, len: 2.0 }), holes: [{ wall: 'right', at: -0.4, y0: 0.7, w: 1.4, h: 1.65 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('right', -0.4, 0.7); win.add(I.windowUnit({ w: 1.4, h: 1.65, cols: 2 }));
    nightStreet(K, { level: 10, across: -8, seed: 31, lamps: [], lit: 0.25, far: 0.6, horizon: '#2A2440' });
    K.rect('#4E62A0', 1.6, 1.3, 1.5, [W / 2 - 0.05, 1.5, -0.4], [0, 1.4, -0.4]);
    K.env(0.04);
    const so = I.sofa({ seats: 4, seatW: 0.64, color: '#80848A', seed: 13, d: 0.95 }); K.add(so, 0.2, 0, -D / 2 + 0.52);
    const left = so.position.x - so.userData.W / 2;
    K.add(I.lamp({ kind: 'floor', power: 5, shade: '#E6DCC8', base: '#2A2A2A' }), left - 0.3, 0, -D / 2 + 0.45);
    K.add(I.table({ w: 1.2, d: 0.6, h: 0.4, inset: 0.05 }), 0.3, 0, -0.35);
    K.add(I.books({ n: 2, lying: true, seed: 8 }), 0.55, 0.4, -0.35, 0.3); K.add(I.mug({ color: '#3A4A5A' }), -0.1, 0.4, -0.3);
    K.add(I.rug({ w: 2.6, d: 1.6, color: '#8A8478' }), 0.2, 0, -0.4);
    // the TV, off, on the right wall
    const t = I.tv({ w: 1.2, on: false, unit: true }); K.add(t, W / 2 - 0.3, 0, 0.9, -PI / 2);
    room.onWall('back', 0.6, 1.25).add(I.picture({ w: 1.0, h: 0.7, frame: '#2A2A2A', seed: 14, warm: false }));
    for (const [x, sd] of [[0.9, 4], [1.6, 5]]) K.add(I.cushion({ color: '#5E6A74', seed: sd }), so.position.x + x, so.userData.seatH + 0.15, so.position.z - 0.2).rotation.set(-0.5, sd, 0.1);
    // you, curled at the left end against the arm, hugging a cushion
    const you = K.fig({ red: true, kind: 'man', pose: 'hugCushion', x: left + 0.42, z: so.position.z + 0.06, yaw: PI / 2 - 0.45, seat: so.userData.seatH, sink: 0.05, o: { headDown: 0.32, lookY: -0.15 } });
    K.hold(you, I.cushion({ color: '#B49870', seed: 9, w: 0.42, h: 0.15 }), { off: [0, 0.03, 0.1], face: () => K.head(you, V(0, 0, 0)).add(V(0, 0, 0)), up: () => V(0, 1, 0) });
    return { you, alarm: true, cam: { pos: [-0.2, 1.08, 1.45], target: [-0.25, 0.7, -1.6], fov: 52, push: 0.02 }, look: { exposure: 1.35, aperture: 0.0012, bloom: 0.3, vignette: 0.45, warm: 0.1 } };
  },

  // a meeting room: you have just stood up at the end of a long table to speak; a dozen colleagues turned to look at
  // you; the screen glowing behind them. Seen from behind you.
  speaking(K) {
    const { I, scene, R } = K, W = 5.2, D = 8.6, Hh = 2.8;
    const holes = [-2.6, -0.4, 1.8].map((at) => ({ wall: 'left', at, y0: 0.75, w: 1.8, h: 1.75 }));
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#E4E2DC' }), floor: I.carpet({ color: '#4A5260' }), ceiling: I.tiles({ color: '#E0E0DC', grout: '#BDBDB8', size: 0.6, rough: 0.9, vary: 0.02 }), holes, open: ['front'] });
    scene.add(room.group);
    for (const h of holes) { const w = room.onWall('left', h.at, 0.75); w.add(I.windowUnit({ w: 1.8, h: 1.75, cols: 2, color: '#5A5E62' })); const b = I.blinds({ w: 1.8, h: 1.75, open: 0.9, drop: 0.55 }); b.position.z = 0.06; w.add(b); }
    scene.add(I.citySky({ zenith: '#7A8494', horizon: '#C4C8CC', glow: 1, clouds: 0.4 }));
    scene.add(I.buildings([{ x: -22, z: -10, w: 14, d: 30, h: 40 }, { x: -30, z: 20, w: 16, d: 20, h: 55 }], { lit: 0.2, facade: '#7A7470', street: -15, seed: 8 }));
    for (const h of holes) K.rect('#D4DCE6', 3.5, 1.7, 1.6, [-W / 2 + 0.05, 1.6, h.at], [0, 1.5, h.at]);
    for (const z of [-2.6, -0.6, 1.4]) for (const x of [-0.9, 0.9]) K.add(I.ceilingPanel({ w: 0.6, d: 1.2, power: 6, value: 4, ceilH: Hh, spot: x > 0 && z > 0 ? 22 : 0 }), x, 0, z);
    K.env(0.12);
    // the screen on the far wall, the long table, a dozen colleagues turned to the end where you stand
    const sc = room.onWall('back', 0, 1.42); const scr = I.screen(2.0, 1.125, 'slide', { seed: 2, value: 1.1, light: 9, cover: true }); scr.position.z = 0.05; sc.add(scr); I.block(sc, I.plastic('#121314', 0.4), 2.06, 1.18, 0.04, 0, -0.59, 0.02, 0.004);
    const tb = I.table({ w: 1.35, d: 5.0, h: 0.74, top: I.woodFurniture({ color: '#B89C78', axis: 'z' }), legs: I.metal('#7A7C80', 0.35), inset: 0.25 }); K.add(tb, 0, 0, -0.7);
    const youPos = [0.12, 2.35];
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
      const z = -2.75 + i * 0.82, x = s * 0.98, yaw = -s * PI / 2;
      K.add(I.officeChair({ seed: i * 2 + s }), x, 0, z, yaw);
      let ly = yawTo(x, z, youPos[0], youPos[1]) - yaw; while (ly > PI) ly -= 2 * PI; while (ly < -PI) ly += 2 * PI; ly = Math.max(-1.4, Math.min(1.4, ly));
      K.fig({ kind: R.pick(['man', 'woman', 'man', 'woman', 'old']), pose: 'sitTurn', x: x + s * 0.02, z, yaw, seat: 0.48, sink: 0.03, o: { lookY: ly, armBack: R() < 0.3, headDown: -0.06 } });
      K.add(R() < 0.5 ? I.laptop({ open: 1.9, value: 1.0, kind: 'doc', seed: i + s * 7 }) : I.mug({ color: R.pick(['#E8E4DC', '#3A5A7A']) }), s * 0.42, 0.74, z, yaw + PI);
    }
    const you = K.fig({ red: true, kind: 'woman', pose: 'present', x: youPos[0], z: youPos[1], yaw: PI });
    K.add(I.officeChair({ seed: 40 }), 0.35, 0, 2.95, PI + 0.5);
    return { you, alarm: true, cam: { pos: [0.72, 1.62, 3.85], target: [-0.18, 1.05, -1.6], fov: 44, push: 0.025 }, look: { exposure: 0.95, aperture: 0.0014, bloom: 0.25, vignette: 0.35 } };
  },

  // a retired man alone in an armchair in a tidy living room in the long afternoon: a wall clock, framed photos on
  // the sideboard, the TV on with nobody really watching
  useful(K) {
    const { I, scene } = K, W = 4.6, D = 4.4, Hh = 2.5;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#D8C9AE' }), floor: I.carpet({ color: '#7A6A58' }), holes: [{ wall: 'left', at: -0.35, y0: 0.8, w: 1.5, h: 1.45 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('left', -0.35, 0.8); win.add(I.windowUnit({ w: 1.5, h: 1.45, cols: 3, color: '#F2F0EA' }));
    for (const [x, sd] of [[-0.95, 1], [0.95, 2]]) { const c = I.curtain({ w: 0.45, h: 2.1, color: '#8A6A4A', folds: 5, seed: sd }); c.position.set(x, 1.6, 0.12); win.add(c); }
    // the long afternoon: low sun through the side window, across him and the carpet to the far wall
    const sun = sunDir(22, 244); scene.add(daySky({ sun, turbidity: 5, rayleigh: 1.8, clouds: 0.2 }));
    I.mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#5A6A3A', roughness: 1 }), -100, -0.1, 0, { rx: -PI / 2, parent: scene, cast: false });
    for (const [x, z, i] of [[-12, 9, 0], [-17, 14, 1], [-13, -13, 2], [-20, -17, 3], [-28, 20, 4]]) K.add(I.tree({ seed: 30 + i, h: 6 + i, tint: '#6A7A3E' }), x, 0, z);
    const sl = new THREE.DirectionalLight('#FFC690', 4.6); sl.position.set(sun.x * 20 - W / 2, sun.y * 20 + 1.5, sun.z * 20 - 0.35); sl.target.position.set(-W / 2, 1.5, -0.35); scene.add(sl, sl.target);
    K.shadow(sl, { size: 2048, radius: 3, bias: -0.0005, near: 1 }); Object.assign(sl.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, far: 60 });
    K.rect('#D8E2EE', 1.8, 1.4, 1.35, [-W / 2 + 0.05, 1.5, -0.35], [0, 1.4, -0.35]);
    K.env(0.07);
    // sideboard with photographs and the clock above it, on the back wall
    K.add(I.cabinet({ w: 1.5, h: 0.8, d: 0.45, doors: 3, color: '#6A4A32' }), 0.35, 0, -D / 2 + 0.25);
    for (const [x, w, h, sd] of [[-0.15, 0.2, 0.26, 41], [0.2, 0.28, 0.22, 42], [0.55, 0.18, 0.24, 43], [0.85, 0.22, 0.17, 44]]) K.add(I.picture({ w, h, frame: '#B89A60', warm: true, seed: sd, stand: true, border: 0.015 }), x, 0.8, -D / 2 + 0.3, (x - 0.35) * -0.3);
    room.onWall('back', 0.35, 1.72).add(I.wallClock({ hour: 16.6, r: 0.17, face: '#F2EEE2', rim: '#5A4030' }));
    room.onWall('back', -1.4, 1.35).add(I.picture({ w: 0.55, h: 0.42, frame: '#6A4A32', seed: 45, warm: true }));
    // the armchair by the window facing the TV on the far wall; a side table, a standard lamp switched off
    const ac = I.armchair({ color: '#7A5E48', seed: 5 }); K.add(ac, -1.15, 0, 0.15, PI / 2 - 0.3);
    K.add(I.cabinet({ w: 0.4, h: 0.55, d: 0.4, doors: 1, color: '#6A4A32' }), -1.55, 0, -0.65);
    K.add(I.mug({ color: '#F2EEE6' }), -1.5, 0.55, -0.6);
    K.add(I.lamp({ kind: 'floor', on: false, shade: '#E6D8B8', base: '#6A5A40' }), -1.95, 0, -1.55);
    const t = I.tv({ w: 1.0, on: true, light: 4, value: 1.2, seed: 9 }); K.add(t, W / 2 - 0.3, 0, 0.0, -PI / 2 - 0.3);
    K.add(I.rug({ w: 2.2, d: 1.6, color: '#8A4A3A', border: '#C8A878' }), 0.1, 0, 0.2, 0.1);
    K.add(I.table({ w: 0.9, d: 0.5, h: 0.42, inset: 0.05 }), 0.15, 0, 0.35, 0.1);
    K.add(I.plant({ h: 0.8, seed: 9, pot: '#B87A4A' }), 1.6, 0, -D / 2 + 0.35);
    const you = K.fig({ red: true, kind: 'old', pose: 'armchair', x: -1.1, z: 0.15, yaw: PI / 2 - 0.3, seat: ac.userData.seatH, sink: 0.05, o: { headDown: 0.32, lookY: 0.1 } });
    return { you, alarm: true, cam: { pos: [-0.35, 1.38, 2.55], target: [0.15, 0.85, -0.85], fov: 46, push: 0.02 }, look: { exposure: 0.95, aperture: 0.0012, bloom: 0.3, vignette: 0.38, warm: 0.2 } };
  },

  // a December afternoon at half past four, already dark: at a kitchen table under one harsh ceiling light, laptop
  // open, head propped on a hand; the window black and wet, a street lamp beyond
  winter(K) {
    const { I, scene } = K, W = 3.5, D = 3.6, Hh = 2.45;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#D6D2C6' }), floor: I.tiles({ color: '#8E8678', grout: '#5A544C', size: 0.33, rough: 0.35 }), holes: [{ wall: 'back', at: 0.1, y0: 0.95, w: 1.25, h: 1.2 }], open: ['front'] });
    scene.add(room.group);
    const win = room.onWall('back', 0.1, 0.95); const wu = I.windowUnit({ w: 1.25, h: 1.2, cols: 2 }); win.add(wu);
    const rain = I.rainGlass({ w: 1.2, h: 1.15, color: '#FFA050', room: '#FFE2C0' }); rain.position.set(0, 0.6, -0.14 * 0.6 + 0.004); win.add(rain);
    const rp = I.reflectPane(1.18, 1.13, { strength: 0.05, tint: '#E8E0D8' }); rp.position.set(0, 0.6, -0.14 * 0.6 + 0.002); win.add(rp);
    // outside: a dark wet street, low houses across it, a lamp
    scene.add(I.citySky({ zenith: '#04050A', horizon: '#1A1410', glow: 0.8, clouds: 0.8 }));
    scene.add(I.buildings([{ x: -14, z: -22, w: 9, d: 8, h: 8 }, { x: -5, z: -22, w: 9, d: 8, h: 8.5 }, { x: 4, z: -22, w: 9, d: 8, h: 8 }, { x: 13, z: -22, w: 9, d: 8, h: 8.5 }, { x: 22, z: -22, w: 9, d: 8, h: 8 }], { lit: 0.3, facade: '#3A302A', seed: 15, floorH: 2.8 }));
    K.spot('#FF9A48', 70, [1.4, 5.0, -12], [1.4, 3, -18], 0.9, 0.8);
    I.mesh(new THREE.PlaneGeometry(120, 120), I.paint({ color: '#0E0E10', rough: 0.15 }), 0, -0.3, -50, { rx: -PI / 2, parent: scene, cast: false });
    const lmp = I.streetLamp({ h: 5.5, color: '#FF9A48', intensity: 120, arm: 0.8, lens: 7 }); K.add(lmp, 2.2, -0.3, -12, PI);
    const lampHead = V(1.4, 5.05, -12); const hl = I.halo('#FFA050', 2.5, 1.0); hl.position.copy(lampHead); scene.add(hl);
    // light in the kitchen: one bare bulb over the table, the laptop
    const pd = I.pendant({ drop: 0.75, power: 9, ceilH: Hh }); K.add(pd, 0.0, 0, -0.35);
    K.env(0.04);
    K.add(I.kitchenRun({ len: 2.4, wallUnits: true, hob: 0.6, sink: -0.4 }), -W / 2 + 0.31, 0, 0.1, PI / 2);
    const tb = I.table({ w: 1.15, d: 0.8, h: 0.75 }); K.add(tb, 0.05, 0, -0.35);
    K.add(I.chair({ color: '#7A5A3E' }), 0.05, 0, -0.98); K.add(I.chair({ color: '#7A5A3E' }), 0.15, 0, 0.35, PI + 0.3);
    const lp = I.laptop({ kind: 'doc', value: 0.9, light: 3.0, seed: 6 }); K.add(lp, 0.05, 0.75, -0.42, PI);
    K.add(I.mug({ color: '#C8C0B0' }), 0.42, 0.75, -0.55); K.add(I.cloth({ w: 0.3, color: '#E8E4DA', seed: 9, h: 0.02 }), -0.35, 0.75, -0.25);
    const ph = I.phone({ value: 0 }); ph.rotation.set(-PI / 2, 0, 0.3); ph.position.set(-0.32, 0.755, -0.5); scene.add(ph);
    const you = K.fig({ red: true, kind: 'man', pose: 'propHead', x: 0.05, z: -0.98, yaw: 0, seat: 0.46, sink: 0.02 });
    // the lamp's place on the wet pane follows the camera
    const pane = rain, lv = V(0, 0, 0), ray = new THREE.Ray(), plane = new THREE.Plane(), hit = V(0, 0, 0), cam = { o: null };
    K.on(() => { if (!cam.o) return; pane.updateMatrixWorld(true); plane.setFromNormalAndCoplanarPoint(V(0, 0, 1), pane.getWorldPosition(V(0, 0, 0)));
      ray.set(cam.o.position, lampHead.clone().sub(cam.o.position).normalize()); if (ray.intersectPlane(plane, hit)) { pane.worldToLocal(lv.copy(hit)); pane.userData.U.uL.value.set(lv.x / 1.2 + 0.5, lv.y / 1.15 + 0.5); } });
    return { you, alarm: false, camHook: cam, cam: { pos: [0.72, 1.27, 0.72], target: [-0.08, 1.02, -0.98], fov: 42, push: 0.02 }, look: { exposure: 1.15, aperture: 0.0016, maxblur: 0.011, bloom: 0.4, vignette: 0.42 } };
  },

  // a small high-rise flat at night: standing at a big window, looking out over a city of thousands of lit windows;
  // the room behind dark and empty. Seen from behind.
  crowd(K) {
    const { I, scene } = K, W = 4.6, D = 4.0, Hh = 2.65, level = 95;
    const room = I.room({ w: W, d: D, h: Hh, wall: I.plaster({ color: '#8E8C86' }), floor: I.floorWood({ a: '#5A4A3C', b: '#6E5A48', plank: 0.18, len: 2.0 }), holes: [{ wall: 'back', at: 0, y0: 0.06, w: 4.2, h: 2.42 }], open: ['front'] });
    scene.add(room.group);
    room.onWall('back', 0, 0.06).add(I.windowUnit({ w: 4.2, h: 2.42, cols: 3, color: '#2A2C2E', sill: false, glassOpacity: 0.07 }));
    scene.add(I.citySky({ zenith: '#04060E', horizon: '#3E2414', glow: 1.15, clouds: 0.5 }));
    const city = I.buildings(I.cityField({ seed: 5, cz: -1200, radius: 1600, count: 3200, minH: 15, maxH: 170, avoid: (x, z) => z > -60 }), { lit: 0.3, street: -level, seed: 7, bright: 1.4, floorH: 3.2 });
    city.position.y = -level; scene.add(city);
    scene.add(I.cityGround({ y: -level, block: 70 }));
    scene.fog = new THREE.FogExp2('#1A140F', 0.00045);
    // the room: dark, empty but for a mattress on the floor and a box; a little warm light from the hall behind you
    K.add(I.rug({ w: 1.4, d: 2.0, color: '#4A4640' }), 1.5, 0, 0.6, 0.1);
    I.block(scene, I.plastic('#B8A888', 0.8), 0.5, 0.35, 0.4, -1.8, 0, 0.8, 0.02);
    K.point('#FFB070', 2.2, -1.7, 2.0, 2.4, { radius: 6, near: 0.1 });
    const rp = I.reflectPane(4.1, 2.35, { strength: 0.16, tint: '#E0E4EC' }); rp.position.set(0, 1.25, -D / 2 - 0.05); scene.add(rp);
    K.rect('#8A7A88', 1.0, 4.0, 2.3, [0, 1.3, -D / 2 + 0.05], [0, 1.2, 0]);
    K.env(0.02);
    const you = K.fig({ red: true, kind: 'man', pose: 'atWindow', x: -0.35, z: -D / 2 + 0.68, yaw: PI });
    return { you, alarm: true, cam: { pos: [0.5, 1.5, 0.75], target: [-0.5, 1.1, -3.0], fov: 44, push: 0.03 }, look: { exposure: 1.3, aperture: 0.0008, bloom: 0.5, vignette: 0.42 } };
  },

  // a test bench for poses (not one of the sixteen): ?key=_pose&pose=slump&mirror=1&seat=0.45 or &lie=0.5, &yaw=, &view=side|front|top
  _pose(K, opts) {
    const { I, scene } = K, q = opts.q || new URLSearchParams(), pose = q.get('pose') || 'stand', seat = q.has('seat') ? +q.get('seat') : null, lie = q.has('lie') ? +q.get('lie') : null;
    scene.add(I.room({ w: 6, d: 6, h: 3, wall: I.plaster({ color: '#CFCBC4' }), floor: I.floorWood(), open: ['front'] }).group);
    if (seat != null) K.add(I.sofa({ seats: 2, seatH: seat }), 0, 0, -0.1);
    if (lie != null) K.add(I.bed({ top: lie }), 0, 0, 0, +(q.get('bedYaw') || 0));
    K.point('#FFF4E8', 14, 1.5, 2.6, 2.0, { radius: 3 }); K.point('#DDE6FF', 6, -2, 2, 1); K.env(0.25);
    const you = K.fig({ red: true, kind: q.get('kind') || 'man', pose, mirror: q.has('mirror'), x: 0, z: 0.1, yaw: +(q.get('yaw') || 0), seat, lie, o: JSON.parse(q.get('o') || '{}') });
    if (q.has('phone')) K.hold(you, I.phone({ kind: 'feed', value: 2, light: 2 }), { hand: q.get('phone'), off: [0, 0.02, 0.02], face: K.eyes(you) });
    if (q.has('duvet') && lie != null) { const bed = scene.children.find((o) => o.userData && o.userData.top === lie); const hd = you.m.world(you.m.J.head, V(0, 0.1, 0)); bed.worldToLocal(hd); bed.add(I.duvet({ top: lie, z0: hd.z + 0.03, bodies: I.bodyCapsules(you.m, bed, { arms: true }).filter((c, i) => i !== 9), color: '#5A6478' })); }
    const v = q.get('view') || 'front', P = { front: [0.9, 1.3, 2.8], side: [2.6, 1.2, 0.3], top: [0.4, 2.9, 1.2], back: [0.9, 1.4, -2.6], side2: [-2.6, 1.2, 0.3] }[v];
    return { you, alarm: true, cam: { pos: P, target: [0, 0.75, 0], fov: 40, push: 0 }, look: { exposure: 1, aperture: 0.0002 } };
  },
};

export const NOW_KEYS = ['strangers', 'leftout', 'night', 'teens', 'restless', 'effort', 'cravings', 'burnout', 'newparent', 'news', 'compare', 'touch', 'speaking', 'useful', 'winter', 'crowd'];

export function buildNow({ key = 'night', renderer, opts = {} }) {
  const def = SCENES[key] || SCENES.night, K = kit(renderer, key), S = def(K, opts), { scene } = K;
  if (typeof S.cam.target === 'function') S.cam.target = S.cam.target().toArray(); // aimed at a point on the figure
  if (typeof S.cam.pos === 'function') S.cam.pos = S.cam.pos().toArray();
  if (opts.cam) S.cam = { ...S.cam, ...opts.cam }; // a debug viewpoint
  const camera = new THREE.PerspectiveCamera(S.cam.fov || 38, 16 / 9, 0.05, 9000);
  if (S.camHook) S.camHook.o = camera;
  // everything that moves on its own (screens, clocks, lights, the city)
  const fns = new Set(); scene.traverse((o) => { if (o.userData.update) fns.add(o.userData.update); });
  // glass, halos and rain stay out of the depth passes, so ambient occlusion and focus see through them
  const noDepth = []; scene.traverse((o) => { if (o.material && o.material.userData && o.material.userData.noDepth) noDepth.push(o.material); });
  scene.onBeforeRender = () => { const hide = !!scene.overrideMaterial; for (const m of noDepth) m.visible = !hide; };
  // the camera: where the scene put it, handheld, pushing in slowly
  const pos = V(...S.cam.pos), tgt = V(...S.cam.target), dir = tgt.clone().sub(pos).normalize(), push = S.cam.push ?? 0.03, you = S.you;
  const look = { exposure: 1, focus: pos.distanceTo(tgt), aperture: 0.0012, maxblur: 0.007, bloom: 0.3, warm: 0, vignette: 0.36, grain: 0.05, ...S.look };
  const hv = new THREE.Vector3();
  function update(t) {
    for (const F of K.figs) F.place(t);
    for (const u of K.updates) u(t);
    for (const f of fns) f(t);
    const p = push * 8 * (1 - Math.exp(-t / 8));
    camera.position.copy(pos).addScaledVector(dir, p);
    camera.position.x += 0.008 * Math.sin(t * 0.9) + 0.003 * Math.sin(t * 2.3 + 1); camera.position.y += 0.006 * Math.sin(t * 0.7 + 1) + 0.0025 * Math.sin(t * 2.9);
    camera.lookAt(tgt.x + 0.01 * Math.sin(t * 0.5), tgt.y + 0.008 * Math.sin(t * 0.6), tgt.z);
    look.focus = camera.position.distanceTo(K.head(you, hv));
  }
  update(0);
  const youPoint = (v = new THREE.Vector3()) => you.m.world(you.m.J.head, v.set(0, 0.11, 0));
  return { scene, camera, look, update, youPoint, alarmPoint: (v = new THREE.Vector3()) => (S.alarm ? youPoint(v) : null), info: { key, alarm: !!S.alarm, figures: K.figs.length } };
}
