// The sky and the light it throws. Day and dusk use three's physical sky (Rayleigh and Mie scattering, clouds) with
// the sun disc held to a sane brightness, so a sun in frame flares a little instead of whiting out the picture.
// Night is a dark gradient with stars, a band of Milky Way and sometimes a moon. lightFor() gives the matching sun
// (or moon) colour and strength, and envFor() the environment map that lights the varnish and the ground.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export function sunDir(elevDeg, azDeg) { return new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevDeg), THREE.MathUtils.degToRad(azDeg)); }

export function daySky({ sun, turbidity = 5, rayleigh = 1.6, mie = 0.004, mieG = 0.82, clouds = 0.25, cloudScale = 0.0002, time = 0 } = {}) {
  const sky = new Sky(); sky.scale.setScalar(4000);
  const m = sky.material;
  m.fragmentShader = m.fragmentShader
    .replace('vec3 sundiscColor = ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 );', 'vec3 sundiscColor = min( ( 760.0 * sundisc ) * min( vSunE * Fex, 80.0 ), vec3( 18.0 ) );')
    .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor, vec3( 24.0 ) ), 1.0 );');
  const u = m.uniforms;
  u.sunPosition.value.copy(sun); u.turbidity.value = turbidity; u.rayleigh.value = rayleigh; u.mieCoefficient.value = mie; u.mieDirectionalG.value = mieG;
  if (u.cloudCoverage) { u.cloudCoverage.value = clouds; u.cloudScale.value = cloudScale; u.cloudSpeed.value = 0.00002; u.cloudElevation.value = 0.55; u.cloudDensity.value = 0.6; u.time.value = time; }
  m.needsUpdate = true;
  return sky;
}

// night: a gradient dome with stars that twinkle, a faint Milky Way and an optional moon
export function nightSky({ moon = null, seed = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uMoon: { value: moon ? moon.clone().normalize() : new THREE.Vector3(0, -1, 0) }, uSeed: { value: seed }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir; uniform vec3 uMoon; uniform float uSeed, uTime;
      float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y, 0.0);
        vec3 c = mix(vec3(0.010, 0.014, 0.030), vec3(0.0015, 0.0025, 0.007), pow(y, 0.5));
        vec3 g = floor(d * 900.0 + uSeed); float s = h(g); float star = step(0.9975, s) * pow(h(g + 3.1), 4.0) * 1.4;
        star *= 0.75 + 0.25 * sin(uTime * (2.0 + 6.0 * h(g + 7.0)) + s * 40.0);
        vec3 gb = normalize(vec3(0.35, 0.55, 0.76)); float band = exp(-pow(dot(d, gb) * 5.5, 2.0));
        float milk = band * (n(d * 9.0 + uSeed) * 0.6 + n(d * 23.0) * 0.4);
        c += vec3(0.020, 0.022, 0.030) * milk * smoothstep(0.0, 0.25, y);
        c += vec3(0.9, 0.92, 1.0) * star * smoothstep(0.0, 0.12, y) * (1.0 - band * 0.0);
        float md = dot(d, uMoon); c += vec3(0.95, 0.95, 0.9) * smoothstep(0.99985, 0.99992, md) * 6.0 + vec3(0.08, 0.09, 0.12) * pow(max(md, 0.0), 120.0) * 0.6;
        c = mix(c, vec3(0.028, 0.03, 0.045), (1.0 - smoothstep(0.0, 0.1, y)) * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 64, 32), mat); dome.frustumCulled = false; dome.renderOrder = -1;
  return dome;
}

// the colour and strength of direct light: warm and low at dusk, white at noon, cold blue moonlight at night
export function lightFor(time, elev) {
  if (time === 'night') return { color: new THREE.Color('#9DB4E6'), intensity: 0.35, ambient: 0.05 };
  const e = THREE.MathUtils.clamp(elev / 60, 0, 1);
  // low sun is warm, but held short of red: red is kept for "you"
  const color = new THREE.Color('#FFB27E').lerp(new THREE.Color('#FFF4E4'), Math.pow(e, 0.5));
  return { color, intensity: 0.8 + 2.8 * Math.pow(e, 0.6), ambient: 0.25 + 0.5 * e };
}

// an environment map from whatever sky object is passed in (rendered once)
export function envFor(renderer, skyObj) {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene(); s.add(skyObj);
  const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
}

// the sky's colour at the horizon in one direction, averaged over a few degrees: distance fades into this
export function horizonColor(renderer, skyObj, dir) {
  const rt = new THREE.WebGLRenderTarget(32, 8, { type: THREE.FloatType }), s = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 4, 1, 10000);
  s.add(skyObj); cam.position.set(0, 0, 0); cam.lookAt(dir.x, 0.02, dir.z);
  const prev = renderer.getRenderTarget(); renderer.setRenderTarget(rt); renderer.render(s, cam); renderer.setRenderTarget(prev);
  const px = new Float32Array(32 * 8 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 32, 8, px); rt.dispose();
  const c = [0, 0, 0]; let n = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 32; x++) { const i = (y * 32 + x) * 4; c[0] += px[i]; c[1] += px[i + 1]; c[2] += px[i + 2]; n++; }
  return new THREE.Color(c[0] / n, c[1] / n, c[2] / n);
}
