// What a camp is made of: a fire that really lights the people around it, brush shelters, hides on the ground,
// spears, digging sticks, wooden bowls, stones. All built in code.
import * as THREE from 'three';
import { NOISE_GLSL } from './wood.js';
import { rng } from './nature.js';

const wood = (c = '#5A4632', r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });

// ---------- fire ----------
// logs and stones, a flame from crossed noisy planes (additive), a flickering warm light with soft shadows,
// sparks rising, and a thin smoke drifting off.
let SMOKE = null;
function smokeTex() {
  if (SMOKE) return SMOKE; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); SMOKE = new THREE.CanvasTexture(c); return SMOKE;
}
export function fire({ seed = 1, size = 1, night = true, shadows = true }) {
  const R = rng(seed), grp = new THREE.Group();
  // ring of stones
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + R() * 0.3, s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 * size * R.range(0.8, 1.3), 1), new THREE.MeshStandardMaterial({ color: '#5E5850', roughness: 0.95 })); s.position.set(Math.cos(a) * 0.42 * size, 0.04, Math.sin(a) * 0.42 * size); s.scale.y = 0.7; s.rotation.set(R(), R(), R()); s.castShadow = s.receiveShadow = true; grp.add(s); }
  // logs leaning in
  const charred = new THREE.MeshStandardMaterial({ color: '#2A211B', roughness: 0.9, emissive: '#FF5A1E', emissiveIntensity: 0.0 });
  charred.onBeforeCompile = (sh) => { sh.uniforms.uT = { value: 0 }; charred.userData.sh = sh; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP; uniform float uT;\n' + NOISE_GLSL).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat glowN = smoothstep(0.55, 0.8, fbm3(vP * 9.0 + vec3(0.0, uT * 0.3, 0.0))); totalEmissiveRadiance = vec3(1.0, 0.35, 0.08) * glowN * 3.0 * smoothstep(0.4, 0.0, vP.y + 0.2);'); };
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + R() * 0.4, l = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * size, 0.055 * size, 0.75 * size, 8), charred); l.position.set(Math.cos(a) * 0.18 * size, 0.12 * size, Math.sin(a) * 0.18 * size); l.rotation.set(0, -a, 0); l.rotateZ(1.15); l.castShadow = true; grp.add(l); }
  // flame
  const fmat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uT: { value: 0 }, uSeed: { value: R() * 50 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT, uSeed;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv; float n = fbm3(vec3(p.x * 3.0, p.y * 2.2 - uT * 2.4, uSeed + uT * 0.4));
        float w = (0.5 - abs(p.x - 0.5)) * 2.0; float shape = w - p.y * 0.95 + n * 0.75 - 0.25;
        float a = smoothstep(0.0, 0.35, shape) * smoothstep(1.0, 0.6, p.y);
        vec3 c = mix(vec3(1.0, 0.25, 0.04), vec3(1.0, 0.75, 0.32), smoothstep(0.1, 0.7, shape)); c = mix(c, vec3(1.0, 0.95, 0.8), smoothstep(0.55, 1.0, shape));
        gl_FragColor = vec4(c * a * 2.4, a); // bright enough to bloom a little, not enough to swallow the people round it
      }`,
  });
  const flame = new THREE.Group(); flame.position.y = 0.05;
  for (let i = 0; i < 3; i++) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.75 * size, 1.05 * size), fmat); pl.position.y = 0.5 * size; pl.rotation.y = (i / 3) * Math.PI; pl.userData.noAO = true; flame.add(pl); }
  grp.add(flame);
  // light
  const light = new THREE.PointLight('#FFA552', night ? 14 : 4, 0, 2); // firelight, kept short of red: red is for "you" light.position.set(0, 0.55 * size, 0);
  if (shadows) { light.castShadow = true; light.shadow.mapSize.set(1024, 1024); light.shadow.bias = -0.002; light.shadow.radius = 4; light.shadow.camera.near = 0.2; }
  grp.add(light);
  // sparks
  const N = 60, sp = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [R(), R(), R()]);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#FFB060', size: 0.025, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); grp.add(sparks);
  // smoke
  const smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex(), color: night ? '#3A3A40' : '#B8B4AC', transparent: true, depthWrite: false, opacity: 0 })); grp.add(s); smoke.push(s); }
  grp.userData.update = (t) => {
    fmat.uniforms.uT.value = t; if (charred.userData.sh) charred.userData.sh.uniforms.uT.value = t;
    const fl = 0.82 + 0.1 * Math.sin(t * 13.1) + 0.06 * Math.sin(t * 23.7 + 1) + 0.05 * Math.sin(t * 5.3);
    light.intensity = (night ? 14 : 4) * fl * size * size; light.position.x = Math.sin(t * 7.3) * 0.03; light.position.z = Math.cos(t * 6.1) * 0.03;
    flame.scale.set(1, 0.9 + 0.12 * Math.sin(t * 9.7), 1);
    for (let i = 0; i < N; i++) { const [a, b, c] = seeds[i], u = (t * (0.35 + a * 0.4) + b) % 1; sp[i * 3] = Math.sin(c * 40 + u * 6) * 0.25 * u * size; sp[i * 3 + 1] = (0.3 + u * 2.2) * size; sp[i * 3 + 2] = Math.cos(c * 30 + u * 5) * 0.25 * u * size; }
    sg.attributes.position.needsUpdate = true;
    smoke.forEach((s, i) => { const u = (t * 0.08 + i / smoke.length) % 1; s.position.set(u * 1.6 * size + Math.sin(i + t * 0.3) * 0.2, (0.8 + u * 3.5) * size, u * 0.6 * size); s.scale.setScalar((0.6 + u * 2.4) * size); s.material.opacity = (night ? 0.18 : 0.22) * Math.sin(u * Math.PI); });
  };
  grp.userData.light = light;
  return grp;
}

// ---------- a brush shelter: bent sticks in a dome, thatched with dry grass ----------
// cover: 'thatch' (grass, the default), 'leaf' (big leaves, the wet tropics), 'hide' (skins laced over the frame, the
// cold north), 'bark' (sheets of bark, Australia). form: 'dome' (the default), 'cone' (a hide tent on poles), 'bone'
// (a dome weighted with mammoth jaws and tusks, the glacial plains), 'pit' (a low roof over a dug floor, East Asia
// after the ice), 'lean' (a lean-to, open at the front). See era.js.
export function shelter({ seed = 1, size = 1, grassColor = '#9C8656', cover = 'thatch', form = 'dome' }) {
  const R = rng(seed), grp = new THREE.Group(), stick = wood('#6B5A44');
  const r = 1.3 * size, h = 1.35 * size;
  // thatch: a lumpy dome with an opening, straw-coloured, rough
  const g = new THREE.SphereGeometry(r, 48, 24, 0.5, Math.PI * 2 - 1.1, 0, Math.PI / 2), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 9 + seed) * Math.cos(v.z * 8) * 0.04 + (R() - 0.5) * 0.05; v.multiplyScalar(1 + n); v.y *= h / r; p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals();
  const colour = { thatch: grassColor, leaf: '#6A6640', hide: '#82603F', bark: '#6E6254' }[cover] || grassColor;
  const body = {
    thatch: 'float straw = vnoise(vec3(atan(vP.z, vP.x) * 60.0, vP.y * 4.0, 0.0)); diffuseColor.rgb *= 0.55 + 0.6 * straw * (0.7 + 0.3 * fbm3(vP * 6.0));',
    leaf: 'float lf = vnoise(vec3(atan(vP.z, vP.x) * 14.0, vP.y * 7.0, 0.0)); diffuseColor.rgb *= 0.55 + 0.6 * lf; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.34, 0.2), smoothstep(0.6, 0.8, fbm3(vP * 3.0)) * 0.6);',
    hide: 'float pc = fbm3(vP * 2.2), seam = smoothstep(0.035, 0.0, abs(fract(atan(vP.z, vP.x) * 1.6 + pc * 0.4) - 0.5) - 0.46); diffuseColor.rgb *= (0.75 + 0.4 * pc) * (1.0 - seam * 0.45) * (0.92 + 0.12 * vnoise(vP * 30.0));',
    bark: 'float st = vnoise(vec3(atan(vP.z, vP.x) * 9.0, vP.y * 30.0, 0.0)); diffuseColor.rgb *= 0.6 + 0.5 * st * (0.7 + 0.3 * fbm3(vP * 4.0));',
  }[cover] || '';
  const thatch = new THREE.MeshStandardMaterial({ color: colour, roughness: cover === 'hide' ? 0.8 : 1, side: THREE.DoubleSide });
  thatch.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vP;\n' + NOISE_GLSL).replace('#include <color_fragment>', '#include <color_fragment>\n' + body); };
  thatch.customProgramCacheKey = () => 'shelter-' + cover; // one shader per cover (the compile hook's text is the same for all)
  if (form !== 'dome') return otherForm({ R, grp, form, r, h, size, mat: thatch, stick });
  const dome = new THREE.Mesh(g, thatch); dome.castShadow = dome.receiveShadow = true; grp.add(dome);
  // ribs of bent sticks poking through, and a few loose sticks
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R() * 0.2, pts = []; for (let k = 0; k <= 8; k++) { const u = k / 8, th = u * Math.PI * 0.55; pts.push(new THREE.Vector3(Math.cos(a) * Math.cos(th) * r * 1.03, Math.sin(th) * h * 1.03 + (u > 0.9 ? 0.15 : 0), Math.sin(a) * Math.cos(th) * r * 1.03)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.018 * size, 5), stick); m.castShadow = true; grp.add(m);
  }
  grp.rotation.y = R() * Math.PI * 2;
  return grp;
}

function otherForm({ R, grp, form, r, h, size, mat, stick }) {
  const add = (geo, m = mat) => { const o = new THREE.Mesh(geo, m); o.castShadow = o.receiveShadow = true; grp.add(o); return o; };
  const pole = (a, b, rad = 0.025) => { const d = new THREE.Vector3().subVectors(b, a), o = add(new THREE.CylinderGeometry(rad * size, rad * size * 1.2, d.length(), 6), stick); o.position.copy(a).addScaledVector(d, 0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); };
  if (form === 'cone' || form === 'pit') {
    // a cone of hide (or thatch) round a door gap; the poles cross above the smoke hole. A pit house is lower and
    // wider, its roof starting from a bank of earth round the dug floor
    const pit = form === 'pit', R0 = (pit ? 2.0 : 1.35) * size, H = (pit ? 1.9 : 2.6) * size, y0 = pit ? 0.25 * size : 0;
    const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12; pts.push(new THREE.Vector2(Math.max(0.06 * size, R0 * (1 - u) * (1 + 0.04 * Math.sin(u * 9))), y0 + H * u * 0.94)); }
    const cone = new THREE.LatheGeometry(pts, 40, 0.45, Math.PI * 2 - 0.8), p = cone.attributes.position;
    for (let i = 0; i < p.count; i++) { const n = (R() - 0.5) * 0.03 * size; p.setX(i, p.getX(i) * (1 + n)); p.setZ(i, p.getZ(i) * (1 + n)); }
    cone.computeVertexNormals(); add(cone);
    const top = new THREE.Vector3(0, y0 + H * 1.12, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + R() * 0.2, base = new THREE.Vector3(Math.cos(a) * R0 * 1.02, y0, Math.sin(a) * R0 * 1.02); pole(base, top.clone().add(new THREE.Vector3(-Math.cos(a) * 0.18, R.range(0, 0.25), -Math.sin(a) * 0.18).multiplyScalar(size))); }
    if (pit) { const bank = add(new THREE.TorusGeometry(R0 * 1.02, 0.32 * size, 8, 40), new THREE.MeshStandardMaterial({ color: '#6A5A44', roughness: 1 })); bank.rotation.x = Math.PI / 2; bank.scale.z = 0.55; bank.position.y = 0.02; }
  } else if (form === 'bone') {
    // the dome under hides, its foot walled with mammoth jaws stacked chin-down, two tusks arched over the door
    const g = new THREE.SphereGeometry(r * 1.25, 40, 20, 0.5, Math.PI * 2 - 1.1, 0, Math.PI / 2); g.scale(1, (h * 1.1) / (r * 1.25), 1); add(g);
    // the dome's door gap is at phi = -0.05 (SphereGeometry puts phi at x = -cos, z = sin): jaws all round but there
    const bone = new THREE.MeshStandardMaterial({ color: '#CDBFA2', roughness: 0.75 }), at = (phi, rad, y = 0) => new THREE.Vector3(-Math.cos(phi) * rad, y, Math.sin(phi) * rad);
    for (let i = 0; i < 26; i++) { const phi = 0.75 + (i / 25) * (Math.PI * 2 - 1.5), jaw = add(new THREE.TorusGeometry(0.16 * size, 0.06 * size, 6, 12, Math.PI), bone);
      jaw.position.copy(at(phi, r * 1.3, 0.05 + (i % 2) * 0.14 * size)); jaw.rotation.set(Math.PI, Math.atan2(-Math.cos(phi), Math.sin(phi)), R.range(-0.3, 0.3), 'YXZ'); }
    for (const sd of [-1, 1]) { const phi = -0.05 + sd * 0.42, b = at(phi, r * 1.3), pts = [b, at(phi, r * 1.36, h * 0.75), at(-0.05, r * 1.4, h * 1.05)];
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.06 * size, 8), bone); }
  } else if (form === 'lean') {
    // a sheet of bark on a ridge pole between two forked sticks, sloping to the ground at the back
    const W = 2.2 * size, D = 1.6 * size, Hh = 1.3 * size, sheet = new THREE.PlaneGeometry(W, Math.hypot(D, Hh), 10, 6), p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (R() - 0.5) * 0.04 + Math.sin(p.getX(i) * 6) * 0.02);
    sheet.computeVertexNormals(); const o = add(sheet); o.rotation.x = -Math.atan2(Hh, D) - Math.PI / 2 + Math.PI; o.position.set(0, Hh / 2, -D / 2);
    for (const s of [-1, 1]) pole(new THREE.Vector3(s * W * 0.45, 0, 0.05), new THREE.Vector3(s * W * 0.45, Hh + 0.1, 0.0), 0.03);
    pole(new THREE.Vector3(-W * 0.55, Hh, 0), new THREE.Vector3(W * 0.55, Hh, 0), 0.03);
  }
  grp.rotation.y = R() * Math.PI * 2;
  return grp;
}

// ---------- small things ----------
export function hide({ seed = 1, w = 1.4, d = 1.0, color = '#7A5A3C' }) {
  const R = rng(seed), g = new THREE.PlaneGeometry(w, d, 24, 18); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), e = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2)); p.setY(i, 0.01 + Math.sin(x * 7 + seed) * Math.cos(z * 6) * 0.012 + (e > 0.85 ? (e - 0.85) * 0.06 : 0)); const k = 1 - 0.18 * Math.max(0, Math.sin(Math.atan2(z, x) * 5 + seed)) * e * e; p.setX(i, x * k); p.setZ(i, z * k); }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide })); m.receiveShadow = true; m.rotation.y = R() * 6.28; return m;
}
export function spear({ length = 2.1, tip = true }) {
  const grp = new THREE.Group(), shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.017, length, 7), wood('#7A6248', 0.7)); shaft.position.y = length / 2; shaft.castShadow = true; grp.add(shaft);
  if (tip) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 5), new THREE.MeshStandardMaterial({ color: '#5F5A55', roughness: 0.55, metalness: 0.0 })); t.position.y = length + 0.06; t.scale.z = 0.4; t.castShadow = true; grp.add(t); }
  return grp;
}
export function stick({ length = 1.1 }) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, length, 6), wood('#6E5841')); m.castShadow = true; return m; }
export function bowl({ r = 0.14, color = '#6B4A30' }) {
  const pts = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r, -Math.cos(a) * r * 0.55 + r * 0.55)); }
  for (let i = 10; i >= 0; i--) { const a = (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r * 0.9, -Math.cos(a) * r * 0.48 + r * 0.55 + 0.004)); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 24), new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); m.castShadow = m.receiveShadow = true; return m;
}
export function egg() { const g = new THREE.SphereGeometry(0.075, 20, 14); g.scale(1, 1.22, 1); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#E9E1CF', roughness: 0.45 })); m.castShadow = true; return m; }
export function stones({ seed = 1, n = 6, spread = 0.4 }) {
  const R = rng(seed), grp = new THREE.Group();
  for (let i = 0; i < n; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(R.range(0.03, 0.07), 0), new THREE.MeshStandardMaterial({ color: '#7D7469', roughness: 0.8 })); s.position.set(R.range(-spread, spread), 0.02, R.range(-spread, spread)); s.rotation.set(R() * 3, R() * 3, R() * 3); s.castShadow = true; grp.add(s); }
  return grp;
}
