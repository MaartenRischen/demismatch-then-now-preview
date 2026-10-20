// The camera body: a WebGL renderer with a photographic finish. ACES tone mapping, soft shadows, ambient occlusion,
// depth of field, a little bloom for fire and sun, then film grain, vignette and a touch of lens fringing.
// One stage renders any number of scenes in turn; take the result with stage.canvas right after render().
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// The ambient occlusion pass draws the scene's normals with an override material; it already skips points and lines.
// Sprites (smoke) have no normals and turned into NaNs that spread as black blocks, and flames are not surfaces:
// skip those too (anything with userData.noAO).
GTAOPass.prototype._overrideVisibility = function () {
  const cache = this._visibilityCache;
  this.scene.traverse((o) => { if ((o.isPoints || o.isLine || o.isLine2 || o.isSprite || o.userData.noAO) && o.visible) { o.visible = false; cache.push(o); } });
};

const Finish = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0.05 }, vignette: { value: 0.32 }, fringe: { value: 0.00025 }, warm: { value: 0 }, lift: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, fringe, warm, lift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5; float r2 = dot(d, d);
      vec3 c = vec3(texture2D(tDiffuse, vUv - d * fringe * 4.0).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * fringe * 4.0).b);
      c = c * (1.0 - vignette * smoothstep(0.05, 0.75, r2 * 2.2));
      c = mix(c, c * vec3(1.04, 1.0, 0.94), warm);
      c = c + lift * (1.0 - c) * 0.06;
      float g = h(vUv * vec2(1931.0, 1213.0) + fract(time * 23.17)) - 0.5;
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c += g * grain * (1.0 - lum * 0.6);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export function createStage({ width = 960, height = 540, dpr = 1, canvas = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas: canvas || undefined, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const pipes = new Map();
  // each scene/camera pair gets its own pass chain, built on first use
  function pipe(scene, camera) {
    let p = pipes.get(scene);
    if (p && p.camera === camera) return p;
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(dpr); composer.setSize(width, height);
    const render = new RenderPass(scene, camera);
    const ao = new GTAOPass(scene, camera, width * dpr, height * dpr);
    ao.output = GTAOPass.OUTPUT.Default; ao.blendIntensity = 1.0;
    ao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 16 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    const dof = new BokehPass(scene, camera, { focus: 8, aperture: 0.0006, maxblur: 0.006 });
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.25, 0.6, 3.0); // HDR: only fire, lamps and the sun pass the threshold
    const out = new OutputPass();
    const finish = new ShaderPass(Finish);
    composer.addPass(render); composer.addPass(ao); composer.addPass(dof); composer.addPass(bloom); composer.addPass(out); composer.addPass(finish);
    p = { composer, ao, dof, bloom, finish, camera };
    pipes.set(scene, p);
    return p;
  }
  return {
    renderer, THREE,
    get canvas() { return renderer.domElement; },
    setSize(w, h, d = dpr) { width = w; height = h; dpr = d; renderer.setPixelRatio(d); renderer.setSize(w, h, false); },
    // the scene's log-average brightness, before tone mapping, from a small render (no post passes)
    meter(scene, camera) {
      const rt = new THREE.WebGLRenderTarget(64, 36, { type: THREE.HalfFloatType }), prev = renderer.getRenderTarget();
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(prev);
      const px = new Uint16Array(64 * 36 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 64, 36, px); rt.dispose();
      let sum = 0; for (let i = 0; i < px.length; i += 4) { const l = 0.2126 * THREE.DataUtils.fromHalfFloat(px[i]) + 0.7152 * THREE.DataUtils.fromHalfFloat(px[i + 1]) + 0.0722 * THREE.DataUtils.fromHalfFloat(px[i + 2]); sum += Math.log(1e-4 + l); }
      return Math.exp(sum / (64 * 36));
    },
    // free a scene's pass chain and everything it holds on the GPU (call before dropping a scene)
    release(scene) {
      const p = pipes.get(scene); if (p) { p.composer.dispose?.(); for (const k of ['ao', 'dof', 'bloom', 'finish']) p[k].dispose?.(); pipes.delete(scene); }
      scene.traverse((o) => { o.geometry?.dispose(); const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { for (const v of Object.values(m)) if (v && v.isTexture) v.dispose(); m.dispose(); } });
      if (scene.environment?.dispose) scene.environment.dispose();
    },
    // look: { focus (m), aperture, bloom, grain, vignette, exposure, warm, ao }
    render(scene, camera, t = 0, look = {}) {
      if (look.raw) { camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.toneMappingExposure = look.exposure ?? 1.0; renderer.render(scene, camera); return; }
      const p = pipe(scene, camera);
      for (const [k, on] of Object.entries(look.off || {})) if (p[k]) p[k].enabled = !on;
      camera.aspect = width / height; camera.updateProjectionMatrix();
      renderer.toneMappingExposure = look.exposure ?? 1.0;
      p.dof.uniforms.focus.value = look.focus ?? 8; p.dof.uniforms.aperture.value = look.aperture ?? 0.0006; p.dof.uniforms.maxblur.value = look.maxblur ?? 0.006;
      p.bloom.strength = look.bloom ?? 0.18;
      p.ao.blendIntensity = look.ao ?? 1.0;
      const f = p.finish.uniforms; f.time.value = t; f.grain.value = look.grain ?? 0.05; f.vignette.value = look.vignette ?? 0.32; f.warm.value = look.warm ?? 0; f.lift.value = look.lift ?? 0;
      p.composer.render();
    },
  };
}
