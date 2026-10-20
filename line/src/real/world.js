// The ancestors' world, built per generation: where people could have been at that date, the time of day, the
// weather, and the topic's story told with painter's mannequins. buildAncestors(topic, g) returns a live scene.
import * as THREE from 'three';
import { daySky, nightSky, sunDir, lightFor, envFor, horizonColor } from './sky.js';
import { rng, makeHeight, terrain, grass, acacia, bush, rock, farHills, farTrees, litter, dust, birds, fbm2 } from './nature.js';
import { fire, shelter, hide, spear, stick, bowl, egg, stones } from './camp.js';
import { makeMannequin } from './mannequin.js';
import { POSE } from './poses.js';
import { TONES } from './wood.js';
import { STORIES } from './stories.js';
import { strangers } from './story-strangers.js';
const MINE = { strangers };
import './poses-anc.js'; // extra poses for the ancestors' stories (they add themselves to POSE)

// ---------- places ----------
export const HABITATS = {
  savanna: { soil: '#9A7B52', soil2: '#7A5E3E', grassC: '#A38C58', rock: '#857A6C', grass: ['#C9AE6E', '#A88D55', '#8C8B55'], grassAmt: 0.6, bladeH: 0.55, density: 1, trees: 12, treeTint: '#7C8A4C', bushes: 24, rocks: 8, hills: '#8D8C92', haze: 0.0019, jag: 1 },
  lake: { soil: '#8E7552', soil2: '#6E5A40', grassC: '#97895A', rock: '#7F766A', grass: ['#BDAA6C', '#9C9157', '#7E8A50'], grassAmt: 0.7, bladeH: 0.5, density: 0.9, trees: 8, treeTint: '#728448', bushes: 16, rocks: 5, hills: '#7E8496', haze: 0.0021, water: { r: 70, depth: 3, color: '#3E5A66' }, jag: 0.8 },
  woodland: { soil: '#7E5638', soil2: '#5E4029', grassC: '#8C8A50', rock: '#6E655C', grass: ['#A99A5E', '#8C8A4E', '#6E7A40'], grassAmt: 0.7, bladeH: 0.6, density: 0.9, trees: 40, treeTint: '#68793F', bushes: 40, rocks: 6, hills: '#6E7268', haze: 0.0026, jag: 0.7 },
  kalahari: { soil: '#B4734A', soil2: '#9A5C38', grassC: '#C4A877', rock: '#9A6F52', grass: ['#D8C08C', '#C2A774', '#A99467'], grassAmt: 0.4, bladeH: 0.45, density: 0.55, trees: 6, treeTint: '#808C55', bushes: 14, rocks: 2, hills: '#A08C80', haze: 0.0016, jag: 0.5 },
  highland: { soil: '#5D5136', soil2: '#4A4029', grassC: '#6F8445', rock: '#6F6D66', grass: ['#7E9650', '#62803E', '#9A9A58'], grassAmt: 0.85, bladeH: 0.5, density: 1.1, trees: 5, treeTint: '#55693A', bushes: 12, rocks: 14, hills: '#6A7A82', haze: 0.0045, jag: 1.6 },
  coast: { soil: '#B9A584', soil2: '#9D8A6B', grassC: '#8E8A5A', rock: '#7A7268', grass: ['#A79E6A', '#8C8A58', '#B1A574'], grassAmt: 0.3, bladeH: 0.4, density: 0.45, trees: 0, treeTint: '#6F7E4A', bushes: 20, rocks: 26, hills: '#7D8790', haze: 0.0024, water: { color: '#2F4D5E', sea: true }, jag: 1.2 },
  hills: { soil: '#A08766', soil2: '#857056', grassC: '#8A845A', rock: '#B3A58E', grass: ['#B4A06C', '#958A5C', '#7D7E50'], grassAmt: 0.35, bladeH: 0.4, density: 0.55, trees: 3, treeTint: '#6C7A48', bushes: 34, rocks: 30, hills: '#A39A8E', haze: 0.0018, jag: 1.4 },
  ice: { soil: '#E8ECEF', soil2: '#C9D0D6', grassC: '#B4AE92', rock: '#6E6A66', grass: ['#BDB59A', '#A69F84', '#D3CDB4'], grassAmt: 0.25, bladeH: 0.35, density: 0.35, trees: 0, treeTint: '#4E5E44', bushes: 8, rocks: 12, hills: '#B9C4D2', haze: 0.0032, snow: true, jag: 1.3 },
};
// where people could be at a given date: Africa throughout; Ice Age Europe only between 45,000 and 12,000 years ago
export function placeFor(g, years) {
  const r = fbm2(g * 0.731, 0.5, 3, 1), opts = ['savanna', 'savanna', 'lake', 'woodland', 'kalahari', 'highland', 'coast', 'hills'];
  if (years < 45000 && years > 12000) opts.push('ice');
  const r2 = Math.abs(Math.sin(g * 12.9898 + 4.1) * 43758.5453) % 1;
  return opts[Math.floor(r2 * opts.length)];
}
const TIMES = { day: [24, 48], dusk: [2.5, 9], morning: [6, 16] };

// ---------- the scene ----------
export function buildAncestors({ topic = 'strangers', g = 4000, years = g * 27, renderer, opts = {} }) {
  const R = rng(g * 1.37 + 0.5), story = MINE[topic] || STORIES[topic] || STORIES.strangers;
  const habitat = opts.habitat || story.habitat?.(g, R) || placeFor(g, years), H = HABITATS[habitat];
  let time = opts.time || pickTime(story.times || ['day', 'dusk'], R);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 6000);
  const updates = [];
  // the story decides where the camera stands and what it looks at; the world is built around that
  const S = story.compose({ R, g, years, habitat, time, H });
  if (!opts.time && S.times && !S.times.includes(time)) time = pickTime(S.times, R); // a situation can need its own light (a fire at dusk)
  const az = S.sunAz ?? R.range(0, 360), elev = time === 'night' ? -10 : R.range(...(TIMES[time] || TIMES.day));
  const sun = sunDir(elev, az);
  // sky, environment light, fog
  if (time === 'night') {
    const moon = R() < 0.6 ? sunDir(R.range(18, 45), az + 140) : null;
    const sky = nightSky({ moon, seed: g }); scene.add(sky); updates.push((t) => { sky.material.uniforms.uTime.value = t; });
    scene.environment = envFor(renderer, nightSky({ moon, seed: g })); scene.environmentIntensity = moon ? 1.6 : 1.1;
    const ml = new THREE.DirectionalLight('#9FB2DA', moon ? 0.9 : 0.35); ml.position.copy(moon || sunDir(40, az)).multiplyScalar(200); scene.add(ml);
    scene.fog = new THREE.FogExp2('#0A0E18', H.haze * 0.8);
  } else {
    const clouds = H.snow ? R.range(0.35, 0.7) : R.range(0, 0.45);
    scene.add(daySky({ sun, turbidity: time === 'dusk' ? R.range(4, 8) : R.range(3, 7), rayleigh: time === 'dusk' ? 2.2 : 1.5, clouds }));
    scene.environment = envFor(renderer, daySky({ sun, turbidity: 5, rayleigh: 1.6, clouds })); scene.environmentIntensity = opts.env ?? (time === 'dusk' ? 0.22 : 0.28);
    const L = lightFor(time, elev), sl = new THREE.DirectionalLight(L.color, L.intensity * (opts.sun ?? 1.6));
    sl.position.copy(sun).multiplyScalar(120).add(new THREE.Vector3(S.focus.x, 0, S.focus.z)); sl.target.position.set(S.focus.x, 0, S.focus.z); scene.add(sl, sl.target);
    sl.castShadow = true; sl.shadow.mapSize.set(4096, 4096); Object.assign(sl.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 10, far: 300 }); sl.shadow.bias = -0.0003; sl.shadow.normalBias = 0.03;
    // haze takes the colour of the sky at the horizon where the camera looks
    const vd = new THREE.Vector3(S.camera.target[0] - S.camera.pos[0], 0, S.camera.target[2] - S.camera.pos[2]).normalize();
    const fogC = horizonColor(renderer, daySky({ sun, turbidity: 5, rayleigh: time === 'dusk' ? 2.2 : 1.5, clouds: 0 }), vd);
    // at dusk the glow round the sun is brighter than the air between us and the hills: damp it
    if (time === 'dusk') fogC.multiplyScalar(0.62).lerp(new THREE.Color(0.32, 0.27, 0.33).multiplyScalar(fogC.r), 0.25);
    scene.fog = new THREE.FogExp2(H.snow ? fogC.clone().lerp(new THREE.Color(0.9, 0.93, 0.97), 0.3) : fogC, H.haze * (time === 'dusk' ? 1.2 : 1));
  }
  // ground
  // water lies beyond the action, in the direction the camera looks, and never under anyone
  let water = null;
  if (H.water) {
    const cp = S.camera.pos, ct = S.camera.target, dir = new THREE.Vector2(ct[0] - cp[0], ct[2] - cp[2]).normalize(), people = S.figures.map((f) => [f.x, f.z]);
    const far = (cx, cz, r) => people.every(([x, z]) => Math.hypot(x - cx, z - cz) > r);
    if (H.water.sea) { let d = R.range(26, 45); for (let k = 0; k < 60 && people.some(([x, z]) => x * dir.x + z * dir.y > d - 8); k++) d += 4; water = { ...H.water, dir, d }; }
    else { let d = H.water.r + R.range(14, 30); const side = R.range(-0.5, 0.5), wx = () => dir.x * d + side * 40, wz = () => dir.y * d; for (let k = 0; k < 80 && !far(wx(), wz(), H.water.r * 1.15 + 8); k++) d += 5; water = { ...H.water, x: wx(), z: wz() }; }
  }
  // the coast is laid along z, so turn the shore to face the camera's view: rotate coordinates by the view direction
  const rot = water && water.sea ? Math.atan2(water.dir.x, -water.dir.y) : 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const base = makeHeight({ seed: g % 997, rough: H.jag, basin: water && !water.sea ? { x: water.x, z: water.z, r: water.r, depth: water.depth } : null, shore: water && water.sea ? { z: -water.d } : null });
  const height = rot ? (x, z) => base(x * cr + z * sr, -x * sr + z * cr) : base;
  const ground = (x, z) => height(x, z);
  scene.add(terrain({ height, palette: { soil: H.soil, soil2: H.soil2, grass: H.grassC, rock: H.rock, grassAmt: H.grassAmt, wetline: water ? (water.sea ? 0.05 : LAKE_Y + 0.1) : -99 }, seed: g % 997 }));
  if (water) scene.add(waterSurface(water, updates, rot));
  const camp = S.clear || [[0, 0, 5, 3]];
  const field = grass({ height, count: Math.round(140000 * H.density), radius: 85, center: [S.focus.x * 0.5, S.focus.z * 0.5], clear: camp.concat(S.figClear || []), colors: { ...H.grass, waterline: water ? (water.sea ? 0.3 : LAKE_Y + 0.5) : -99 }, seed: g % 991, bladeH: H.bladeH });
  scene.add(field); updates.push(field.userData.update);
  if (time !== 'night') { const L = lightFor(time, elev); field.userData.sun(sun, L.color.clone().multiplyScalar(L.intensity * (opts.sun ?? 1.6))); }
  // trees, bushes, rocks, around the camp but out of the shot's way
  const free = (x, z, m = 3) => !camp.some((c) => Math.hypot(x - c[0], z - c[1]) < c[2] + m) && !(S.keepOut || []).some((c) => Math.hypot(x - c[0], z - c[1]) < c[2]) && (!water || height(x, z) > (water.sea ? 0.4 : LAKE_Y + 0.6));
  for (let i = 0; i < H.trees; i++) { const a = R() * 6.28, d = R.range(9, 160), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 4)) continue; const t = acacia({ seed: g + i * 7.1, scale: R.range(0.75, 1.3), tint: H.treeTint }); t.position.set(x, ground(x, z), z); t.rotation.y = R() * 6.28; scene.add(t); }
  for (let i = 0; i < H.bushes; i++) { const a = R() * 6.28, d = R.range(6, 90), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z)) continue; const b = bush({ seed: g + i * 3.3, size: R.range(0.6, 1.5), tint: H.treeTint }); b.position.set(x, ground(x, z), z); scene.add(b); }
  for (let i = 0; i < H.rocks; i++) { const a = R() * 6.28, d = R.range(5, 80), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 1)) continue; const k = rock({ seed: g + i * 5.7, size: R.range(0.2, H.rocks > 20 ? 1.6 : 0.8), color: H.rock }); k.position.set(x, ground(x, z) - 0.1, z); scene.add(k); }
  // far hills: hazed silhouettes a shade darker than the sky behind them (night: nearly black against the stars)
  const hz = scene.fog.color.clone(), hillTint = time === 'night' ? new THREE.Color(0.004, 0.005, 0.009) : (time === 'dusk' ? hz.clone().multiplyScalar(0.42).lerp(new THREE.Color(0.05, 0.045, 0.075), 0.35) : hz.clone().lerp(new THREE.Color(H.hills).multiplyScalar(0.35), 0.22).multiplyScalar(0.86));
  scene.add(farHills({ seed: g % 97, color: H.hills, height: 60 + H.jag * 90, jag: H.jag, tint: hillTint }));
  if (H.trees > 2) scene.add(farTrees({ height, seed: g % 89, n: Math.round(H.trees * 14), color: new THREE.Color(H.treeTint).lerp(new THREE.Color('#5A5A48'), 0.5).multiplyScalar(0.5), avoid: (x, z) => (water && height(x, z) < 0.3) || (S.keepOut || []).some((c) => Math.hypot(x - c[0], z - c[1]) < c[2]) }));
  for (const c of camp) scene.add(litter({ height, seed: g % 83 + c[0], center: [c[0], c[1]], radius: c[2] + 4, n: 700, colors: [H.rock, '#5E4D3B', H.grass[0]] }));
  // the air: dust in low light, birds now and then by day
  if (time === 'dusk' || time === 'morning') { const d = dust({ center: [S.focus.x, S.focus.z], seed: g % 71, strength: time === 'dusk' ? 1 : 0.6 }); scene.add(d); updates.push(d.userData.update); }
  if (time !== 'night' && R() < 0.45) { const b = birds({ seed: g % 61, n: 3 + Math.floor(R() * 5) }); scene.add(b); updates.push(b.userData.update); }
  // the camp's things and the people
  const figs = [];
  const put = (o, x, z, yaw = 0) => { o.position.set(x, ground(x, z), z); o.rotation.y = yaw; scene.add(o); return o; };
  const lib = { fire: (o) => fire({ ...o, night: time !== 'day' }), shelter: (o) => shelter({ ...o, grassColor: H.grass[1] }), hide, spear, stick, bowl, egg, stones };
  // props: a named camp thing, or { type: 'custom', make: (R) => Object3D } for anything a story builds itself; y lifts it
  for (const p of S.props || []) { const o = p.type === 'custom' ? p.make(R, { ground, time, H }) : lib[p.type]({ seed: g + (p.seed || 0), ...(p.o || {}) }); put(o, p.x, p.z, p.yaw || 0); if (p.y) o.position.y += p.y; if (p.lean) { o.rotation.z = p.lean; } if (o.userData.update) updates.push(o.userData.update); }
  for (const f of S.figures) {
    const m = makeMannequin({ kind: f.kind || 'man', tone: f.tone || TONES[f.wood || R.pick(['birch', 'ash', 'beech', 'birch', 'pine'])], seed: R() * 100 });
    m.root.position.set(f.x, 0, f.z); m.root.rotation.y = f.yaw || 0; scene.add(m.root);
    if (f.hold) { const h = f.hold.type === 'custom' ? f.hold.make(R) : lib[f.hold.type]({ ...(f.hold.o || {}) }); m.J[f.hold.hand === 'l' ? 'lWr' : 'rWr'].add(h); h.position.set(0, -0.12, 0.02); if (f.hold.rot) h.rotation.set(...f.hold.rot); }
    figs.push({ m, f, r: R() });
  }
  updates.push((t) => {
    for (const { m, f, r } of figs) {
      if (f.walk) { const d = f.walk.speed * t; m.root.position.x = f.x + Math.sin(f.yaw) * d; m.root.position.z = f.z + Math.cos(f.yaw) * d; }
      const P = POSE[f.pose](t + r * 10, r, f.o || {});
      // the old stoop: a forward curve in the back and neck, knees a little bent when standing
      if (f.kind === 'old') { const add = (k, x) => { const v = P[k]; P[k] = Array.isArray(v) ? [v[0] + x, v[1], v[2]] : [(v || 0) + x, 0, 0]; }; add('chest', 0.22); add('neck', 0.18); add('head', -0.12); if (typeof P.lKnee === 'number' && P.lKnee < 0.5) { P.lKnee += 0.12; P.rKnee += 0.12; } }
      m.pose(P); m.snap(ground);
    }
  });
  // where a figure is two seconds in (walkers move): framing goes by that, not by where they start
  const at2 = (f) => (f.walk ? [f.x + Math.sin(f.yaw || 0) * f.walk.speed * 2, f.z + Math.cos(f.yaw || 0) * f.walk.speed * 2] : [f.x, f.z]);
  // the camera: where the story wants it, handheld; stepped back if anyone stands closer than 1.8 m to the lens
  const cam0 = S.camera, tgt = new THREE.Vector3(...cam0.target), pos = new THREE.Vector3(...cam0.pos);
  { const back = new THREE.Vector3(pos.x - tgt.x, 0, pos.z - tgt.z).normalize();
    const PR = { shelter: 2.4, fire: 1.2, custom: 1.0 }, blockers = S.figures.map((f) => [...at2(f), 1.8]).concat((S.props || []).map((p) => [p.x, p.z, PR[p.type] || 0.7]));
    for (let k = 0; k < 60 && blockers.some(([x, z, r]) => Math.hypot(x - pos.x, z - pos.z) < r); k++) pos.addScaledVector(back, 0.15); }
  pos.y += ground(pos.x, pos.z); tgt.y += ground(tgt.x, tgt.z);
  camera.fov = cam0.fov || 36;
  // the person whose alarm is on must be well inside the frame: turn the camera towards them if they fall near an edge
  { const af = S.figures.find((f) => f.alarm);
    if (af) { const [ax, az] = at2(af), c = new THREE.PerspectiveCamera(camera.fov, 16 / 9, 0.1, 1000), head = new THREE.Vector3(ax, ground(ax, az) + 1.4, az);
      for (let k = 0; k < 30; k++) { c.position.copy(pos); c.lookAt(tgt); c.updateMatrixWorld(); const p = head.clone().project(c);
        if (p.z < 1 && Math.abs(p.x) < 0.72 && Math.abs(p.y) < 0.8) break; tgt.lerp(head, 0.12); } } }
  updates.push((t) => {
    const push = (cam0.push ?? 0.25) * t, dir = tgt.clone().sub(pos).setY(0).normalize();
    camera.position.copy(pos).addScaledVector(dir, push);
    camera.position.x += 0.02 * Math.sin(t * 0.9) + 0.008 * Math.sin(t * 2.3); camera.position.y += 0.015 * Math.sin(t * 0.7 + 1) + 0.006 * Math.sin(t * 2.9);
    camera.lookAt(tgt.x + 0.03 * Math.sin(t * 0.5), tgt.y + 0.02 * Math.sin(t * 0.6), tgt.z);
  });
  const focus = pos.distanceTo(new THREE.Vector3(S.focus.x, ground(S.focus.x, S.focus.z) + 1, S.focus.z));
  const look = { exposure: time === 'night' ? 1.5 : time === 'dusk' ? 0.8 : 0.6, focus, aperture: S.aperture ?? 0.00012, maxblur: time === 'night' ? 0.0025 : 0.005, warm: time === 'dusk' ? 0.22 : 0.1, bloom: time === 'night' ? 0.14 : 0.0 };
  // the head of the person whose alarm is on (figure with alarm: true), in world space, for the gold rings
  const alarmFig = figs.find((x) => x.f.alarm);
  const alarmPoint = (v = new THREE.Vector3()) => (alarmFig ? alarmFig.m.world(alarmFig.m.J.head, v.set(0, 0.11, 0)) : null);
  // expose(stage): meter the scene and set the exposure so each time of day lands at its own brightness (night stays dark)
  const KEY = { day: 0.18, morning: 0.12, dusk: 0.07, night: 0.024 };
  const api = { scene, camera, look, habitat, time, figs, alarmPoint, update(t) { for (const u of updates) u(t); }, info: { g, years, habitat, time, topic },
    expose(stage) { api.update(2); const L = stage.meter(scene, camera), p = look.exposure; look.exposure = THREE.MathUtils.clamp(KEY[time] / L, p * 0.6, p * 2.8); api.info.exposure = +look.exposure.toFixed(3); } };
  return api;
}
function pickTime(list, R) { return list[Math.floor(R() * list.length)]; }

// a lake or the sea: dark water that mirrors the sky, with moving ripples and a sun glitter path
const LAKE_Y = -0.6;
function waterSurface(w, updates, rot = 0) {
  // the sea: a huge sheet beyond the shore; a lake: a disc inside its basin, set low enough that no dip in the camp ground reaches it
  const size = w.sea ? 5000 : w.r * 1.1, g = w.sea ? new THREE.PlaneGeometry(size, size, 1, 1) : new THREE.CircleGeometry(size, 96); g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshPhysicalMaterial({ color: w.color, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const U = { uT: { value: 0 } };
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW2;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW2 = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW2; uniform float uT;\nfloat wv(vec2 p, float t){ return sin(p.x * 0.9 + t * 1.1) * 0.5 + sin(p.y * 1.3 - t * 0.8) * 0.5 + sin((p.x + p.y) * 2.7 + t * 1.9) * 0.25 + sin((p.x - p.y) * 5.1 - t * 2.6) * 0.12; }')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec2 p = vW2.xz; float e = 0.05; float c0 = wv(p, uT); vec3 bn = normalize(vec3((c0 - wv(p + vec2(e, 0.0), uT)) / e, 1.0 / 0.06, (c0 - wv(p + vec2(0.0, e), uT)) / e));
          normal = normalize((viewMatrix * vec4(bn, 0.0)).xyz); }`)
  };
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true;
  // the sea's near edge lies square to the view, along the shore
  if (w.sea) { const off = w.d + size / 2 - 6; mesh.position.set(w.dir.x * off, 0, w.dir.y * off); mesh.rotation.y = Math.atan2(w.dir.x, w.dir.y); } else mesh.position.set(w.x, LAKE_Y, w.z);
  updates.push((t) => { U.uT.value = t; });
  return mesh;
}
