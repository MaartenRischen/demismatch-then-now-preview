// Turned and carved wood with a satin varnish, the material of a painter's mannequin. The grain is computed in each
// part's own space: rings around the part's long axis, pulled about by noise, plus fine fibres along it, so every
// limb looks cut from its own blank. tone: the wood's base colour; red: the stained red of "you".
import * as THREE from 'three';

export const NOISE_GLSL = `
  float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

export const TONES = {
  beech: '#C79A68', birch: '#D3B189', pine: '#CC9F6C', oak: '#A87A4C', walnut: '#6E4A30', ash: '#C8AE8E',
  red: '#B3261C',
};

export function woodMaterial(tone = TONES.beech, { seed = Math.random() * 100, rough = 0.48, coat = 0.35, grainScale = 1 } = {}) {
  const m = new THREE.MeshPhysicalMaterial({ color: tone, roughness: rough, clearcoat: coat, clearcoatRoughness: 0.35 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSeed = { value: seed }; sh.uniforms.uGrain = { value: grainScale };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWoodP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWoodP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWoodP; uniform float uSeed, uGrain;\n' + NOISE_GLSL)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 wp = vWoodP * uGrain + vec3(uSeed, uSeed * 0.37, uSeed * 1.71);
        float warp = fbm3(wp * vec3(3.0, 0.6, 3.0)) * 1.6;
        float ring = fract(length(wp.xz) * 110.0 + warp * 2.2 + wp.y * 0.4); // growth rings of a tree whose centre lies outside the part: fine lines along its length
        float rings = smoothstep(0.0, 0.25, ring) * (1.0 - smoothstep(0.35, 0.8, ring));
        float fibre = vnoise(vec3(wp.x * 160.0, wp.y * 5.0, wp.z * 160.0));
        float blot = fbm3(wp * 3.0);
        float dark = rings * 0.11 + (fibre - 0.5) * 0.08 + (blot - 0.5) * 0.16;
        diffuseColor.rgb *= 1.0 - dark;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 0.98, 0.9), blot * 0.25);
        float woodRough = rings * 0.08 + (fibre - 0.5) * 0.06;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + woodRough, 0.05, 1.0);');
  };
  m.customProgramCacheKey = () => 'wood';
  return m;
}
