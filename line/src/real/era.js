// What people had at a given date and place: what they wore, what they hunted with, what they carried water and food
// in, what they slept under, which animals lived with them. There was no single "ancestral environment": a camp
// 250,000 years ago in East Africa, one 30,000 years ago on the steppe of Europe and one 6,000 years ago in the green
// Sahara had different clothes, tools, shelters and animals. eraFor() gives the kit for a pick of the dated map
// (places.js); the builders below make what the stories don't (clothing on the mannequins, bows, pots, dogs, cattle).
// Dates are first secure evidence, rounded; sources in PLACES.md.
import * as THREE from 'three';
import { NOISE_GLSL } from './wood.js';
import { rng } from './nature.js';

const COLD = new Set(['steppe', 'tundra', 'ice', 'taiga', 'pinewood', 'coldlake', 'coldcoast']);
// first dates (years ago) by region; a region missing from a table never had the thing in the line's span
const BOW = { africa: 64000, europe: 54000, southasia: 48000, seasia: 48000, neareast: 45000, eastasia: 30000, northasia: 30000 };
const POTTERY = { eastasia: 20000, northasia: 16000, africa: 11400, neareast: 8500, southasia: 8000, europe: 7500, americas: 7000, seasia: 5000 };
const DOGS = { europe: 15000, northasia: 15000, eastasia: 15000, neareast: 15000, americas: 11000, southasia: 10000, africa: 6500, seasia: 4000 };
const CATTLE = { neareast: 10500, southasia: 9000, africa: 7500, europe: 7500, eastasia: 5000 };
const NEEDLES = 40000; // eyed needles, so sewn clothes with sleeves and legs, in the north from about 40,000 years ago
// the temperate lands: once there were needles, people there wore sewn clothes even in the warm months
const TEMPERATE = new Set(['europe', 'northasia', 'eastasia', 'neareast', 'americas']);

export function eraFor({ years: y, region, habitat, snow = false }) {
  const cold = snow || COLD.has(habitat), has = (T) => T[region] !== undefined && y <= T[region];
  // clothes: nothing that survives before about 120,000 years ago (we don't know, so the wood stays bare); hide
  // loincloths after; in cold places cloaks, then sewn furs once there are needles; in the temperate lands' warm
  // places a sewn tunic once there are needles; in the tropics a loincloth
  const clothes = cold ? (y <= NEEDLES ? 'furs' : 'cloak') : TEMPERATE.has(region) && y <= NEEDLES ? 'tunic' : y <= 120000 ? 'loin' : 'bare';
  // shelters: grass or leaf domes in warm places, hide tents in the cold, mammoth-bone huts on the glacial plains of
  // Europe and Siberia, pit houses in East Asia and Siberia after the ice, bark lean-tos in Australia
  let shelter = 'dome';
  if (region === 'sahul') shelter = 'lean';
  else if ((region === 'europe' || region === 'northasia') && (habitat === 'steppe' || habitat === 'tundra' || habitat === 'ice') && y <= 26000 && y >= 14000) shelter = 'bone';
  else if ((region === 'eastasia' && y <= 15000) || (region === 'northasia' && y <= 12000)) shelter = 'pit';
  else if (cold) shelter = 'cone';
  return {
    clothes, shelter, cold,
    beads: y <= 142000,                        // shell beads, Bizmoune Cave, Morocco, about 142,000 years ago
    bow: has(BOW), pottery: has(POTTERY), dogs: has(DOGS),
    cattle: has(CATTLE) && (region !== 'africa' || ['greensahara', 'desert', 'savanna', 'hills'].includes(habitat)),
    eggs: region === 'africa' && y <= 60000,   // ostrich eggshell water flasks: Diepkloof, South Africa, about 60,000 years ago
  };
}

// ---------- materials ----------
const MATS = {};
function hideMat(color, fur = false) {
  const k = color + fur; if (MATS[k]) return MATS[k];
  const m = new THREE.MeshStandardMaterial({ color, roughness: fur ? 1 : 0.85, envMapIntensity: 0.6 });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvHP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n' +
      (fur ? 'diffuseColor.rgb *= (0.7 + 0.45 * fbm3(vHP * 9.0)) * (0.85 + 0.25 * vnoise(vHP * 90.0));' : 'diffuseColor.rgb *= (0.78 + 0.35 * fbm3(vHP * 7.0)) * (0.92 + 0.12 * vnoise(vHP * 40.0));')); };
  m.customProgramCacheKey = () => 'hide-' + fur;
  return (MATS[k] = m);
}
// browns, greys and buffs of tanned hide and fur; never red (red is you)
const HIDES = ['#6A5038', '#5C4A38', '#7B6248', '#8A765C', '#5E554C', '#766A5A', '#4E4238'];

// ---------- clothing: pieces fitted over the mannequin's own parts, so they bend with it in every pose ----------
// Each joint's wooden meshes are copied in hide, a little larger; the copy rides on the same joint.
const PARTS = {
  loin: ['hips'],
  cloak: ['hips', 'lKnee', 'rKnee', 'lAnk', 'rAnk'],       // a loincloth, leg wraps and foot wraps; the cloak itself is a prop
  tunic: ['hips', 'waist', 'chest', 'lHip', 'rHip'],        // a sewn hide tunic over the body and thighs, arms bare
  furs: ['hips', 'waist', 'chest', 'lSh', 'rSh', 'lEl', 'rEl', 'lHip', 'rHip', 'lKnee', 'rKnee', 'lAnk', 'rAnk'],
};
const GROW = { hips: [1.1, 1.04], waist: [1.25, 1.1], chest: [1.1, 1.03], lSh: [1.3, 1.0], rSh: [1.3, 1.0], lEl: [1.3, 1.0], rEl: [1.3, 1.0], lHip: [1.2, 1.0], rHip: [1.2, 1.0], lKnee: [1.25, 1.0], rKnee: [1.25, 1.0], lAnk: [1.18, 1.1], rAnk: [1.18, 1.1] };
export function dress(m, clothes, R, { kind = 'man' } = {}) {
  if (clothes === 'bare' || !PARTS[clothes]) return;
  if (clothes === 'loin' && (kind === 'child' || kind === 'toddler')) return; // small children went bare in warm places
  const col = HIDES[Math.floor(R() * HIDES.length)], fur = clothes === 'furs', mat = hideMat(col, fur), trim = hideMat(HIDES[(HIDES.indexOf(col) + 3) % HIDES.length], true);
  for (const j of PARTS[clothes]) {
    const J = m.J[j]; if (!J) continue;
    const [g, gy] = GROW[j] || [1.15, 1.02];
    for (const part of J.children.filter((c) => c.isMesh && !c.userData.garment)) {
      // the hips piece: the pelvis only (a loincloth), not the hip balls; the chest piece is a tunic over the chest
      const c = new THREE.Mesh(part.geometry, fur && (j === 'lAnk' || j === 'rAnk') ? trim : mat); c.userData.garment = true; c.castShadow = c.receiveShadow = true;
      c.position.copy(part.position); c.rotation.copy(part.rotation); c.scale.copy(part.scale).multiply(new THREE.Vector3(g, gy, g));
      if (j === 'hips' && !fur) c.scale.y *= 0.8; // a loincloth sits lower and shorter than the pelvis
      J.add(c);
    }
  }
  // furs: a thick collar round the neck
  if (fur) { const col2 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.035, 10, 20), trim); col2.rotation.x = Math.PI / 2; col2.position.y = 0.02; col2.userData.garment = true; col2.castShadow = true; m.J.neck.add(col2); }
}
// a string of shell or eggshell beads round the neck
export function beads(m, R) {
  const g = new THREE.Group(), n = 18, mat = new THREE.MeshStandardMaterial({ color: R() < 0.5 ? '#E8DFCB' : '#C9B48E', roughness: 0.5 });
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), mat); b.position.set(Math.sin(a) * 0.072, -Math.max(0, Math.cos(a)) * 0.05, Math.cos(a) * 0.06); g.add(b); }
  g.position.y = 0.01; m.J.neck.add(g);
}

// ---------- a bow: a bent stave with its string, gripped at the middle (held like a spear: along y, grip at 0) ----------
export function bowAt(R, { length = 1.45 } = {}) {
  const g = new THREE.Group(), half = length / 2, bend = length * 0.12, pts = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16 * 2 - 1; pts.push(new THREE.Vector3(0, u * half, (1 - u * u) * bend)); }
  const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, 24, 0.013, 6, false);
  const stave = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#6A5438', roughness: 0.7 })); stave.castShadow = true; g.add(stave);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, length * 0.98, 4), new THREE.MeshStandardMaterial({ color: '#BDB39E', roughness: 0.8 })); s.castShadow = true; g.add(s);
  return g;
}

// ---------- a clay pot: round-bottomed, a little neck and rim, fire-blackened low down ----------
export function pot(R, { size = 1 } = {}) {
  const r = R.range(0.11, 0.16) * size, pts = [];
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 0.8; pts.push(new THREE.Vector2(Math.sin(a) * r, -Math.cos(a) * r + r)); }
  pts.push(new THREE.Vector2(r * 0.62, r * 1.95), new THREE.Vector2(r * 0.7, r * 2.1), new THREE.Vector2(r * 0.64, r * 2.12), new THREE.Vector2(r * 0.56, r * 1.98));
  const geo = new THREE.LatheGeometry(pts, 28), m = new THREE.MeshStandardMaterial({ color: R.pick(['#8A6A4C', '#7A5E46', '#94785A']), roughness: 0.85, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= (0.8 + 0.3 * fbm3(vPP * 30.0)) * mix(0.35, 1.0, smoothstep(0.02, 0.12, vPP.y + 0.04 * vnoise(vPP * 40.0)));'); };
  m.customProgramCacheKey = () => 'pot';
  const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; return o;
}

// ---------- animals that lived with people: dogs (after about 15,000 years ago) and cattle (herders, the last
// 10,000). Built from capsules like props-anc's beasts; update(t) breathes and moves head and tail ----------
function quad(R, { len, sh, hip, legR, bodyR, neckL, headL, headR, coat, belly, tail = 0.4, horns = null, earsUp = false, lie = false, graze = false }) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const M = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = o.receiveShadow = true; return o; };
  const y0 = lie ? bodyR * 1.05 : (sh + hip) / 2;
  const torso = M(new THREE.CapsuleGeometry(bodyR, len, 8, 16), coat); torso.rotation.x = Math.PI / 2 + (lie ? 0 : Math.atan2(sh - hip, len) * 0.8); torso.position.y = y0; body.add(torso);
  if (belly) { const b = M(new THREE.CapsuleGeometry(bodyR * 0.8, len * 0.7, 6, 12), belly); b.rotation.x = Math.PI / 2; b.position.set(0, y0 - bodyR * 0.3, 0); body.add(b); }
  const neck = new THREE.Group(); neck.position.set(0, lie ? y0 + bodyR * 0.5 : sh, len / 2 + bodyR * 0.3); body.add(neck);
  const nk = M(new THREE.CapsuleGeometry(bodyR * 0.55, neckL, 6, 12), coat); nk.position.y = neckL * 0.45; nk.position.z = neckL * 0.25; nk.rotation.x = 0.55; neck.add(nk);
  const head = new THREE.Group(); head.position.set(0, neckL * 0.9, neckL * 0.55); neck.add(head);
  const hd = M(new THREE.CapsuleGeometry(headR, headL, 6, 12), coat); hd.rotation.x = Math.PI / 2 + 0.35; hd.position.z = headL * 0.35; head.add(hd);
  if (horns) for (const s of [1, -1]) { const pts = [new THREE.Vector3(s * headR * 0.8, headR * 0.6, 0), new THREE.Vector3(s * headR * 3.2, headR * 2.6, -headR), new THREE.Vector3(s * headR * 2.4, headR * 5.2, -headR * 1.5)]; const h = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, headR * 0.16, 6), horns); head.add(h); }
  for (const s of [1, -1]) { const e = M(new THREE.ConeGeometry(headR * 0.35, headR * 0.9, 6), coat); e.position.set(s * headR * 0.6, headR * 0.9, -headR * 0.2); e.rotation.z = -s * (earsUp ? 0.25 : 1.2); head.add(e); }
  if (graze) neck.rotation.x = 1.0; else neck.rotation.x = lie ? -0.1 : -0.15;
  // legs: straight down when standing, folded under when lying
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const L = M(new THREE.CapsuleGeometry(legR, lie ? legR * 4 : (z > 0 ? sh : hip) - legR * 2, 4, 8), coat);
    if (lie) { L.rotation.x = Math.PI / 2; L.position.set(x * bodyR * 0.8, legR, z * len * 0.4 + (z > 0 ? bodyR * 1.2 : 0)); }
    else L.position.set(x * bodyR * 0.55, ((z > 0 ? sh : hip)) / 2 - bodyR * 0.2, z * len * 0.45);
    body.add(L);
  }
  const tl = new THREE.Group(); tl.position.set(0, lie ? y0 : hip, -len / 2 - bodyR * 0.6); body.add(tl);
  const tg = M(new THREE.CapsuleGeometry(legR * 0.5, tail, 4, 8), coat); tg.position.y = -tail * 0.45; tl.add(tg); tl.rotation.x = lie ? 1.5 : 0.35;
  const ph = R() * 6.28;
  g.userData.update = (t) => { body.scale.y = 1 + Math.sin(t * 2.2 + ph) * 0.012; tl.rotation.z = Math.sin(t * (lie ? 0.8 : 1.6) + ph) * 0.35; if (!graze) head.rotation.y = Math.sin(t * 0.35 + ph) * 0.35; else neck.rotation.x = 1.0 + Math.sin(t * 0.9 + ph) * 0.08; };
  return g;
}
export function dog(R, { lie = R() < 0.5 } = {}) {
  const coat = hideMat(R.pick(['#8A7458', '#5E5248', '#A08C6C', '#3E3832', '#7A6A58']), true);
  return quad(R, { len: 0.5, sh: 0.5, hip: 0.47, legR: 0.035, bodyR: 0.13, neckL: 0.16, headL: 0.14, headR: 0.075, coat, tail: 0.3, earsUp: R() < 0.7, lie });
}
export function cattle(R, { graze = R() < 0.5 } = {}) {
  const coat = hideMat(R.pick(['#5A4232', '#3A3230', '#7A6650', '#C9BFAE', '#6E5A48']), false), belly = R() < 0.4 ? hideMat('#D8D0C0', false) : null;
  // the long lyre-shaped horns of the herds on the Sahara's rock art
  return quad(R, { len: 1.25, sh: 1.25, hip: 1.2, legR: 0.07, bodyR: 0.36, neckL: 0.42, headL: 0.36, headR: 0.15, coat, belly, tail: 0.75, horns: new THREE.MeshStandardMaterial({ color: '#D8CDB4', roughness: 0.5 }), graze });
}
