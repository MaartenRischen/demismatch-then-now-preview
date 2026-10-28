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
import { FLORA, treeline } from './flora.js';
import { placeFor as place } from './places.js';
import { eraFor, dress, beads, pot, dog, cattle } from './era.js';
import { held, cloak, together } from './props-anc.js';
import { strangers } from './story-strangers.js';
const MINE = { strangers };
import './poses-anc.js'; // extra poses for the ancestors' stories (they add themselves to POSE)

// ---------- places ----------
export const HABITATS = {
  savanna: { soil: '#9A7B52', soil2: '#7A5E3E', grassC: '#A38C58', rock: '#857A6C', grass: ['#C9AE6E', '#A88D55', '#8C8B55'], grassAmt: 0.6, bladeH: 0.55, density: 1, trees: 12, treeTint: '#7C8A4C', bushes: 24, rocks: 8, hills: '#8D8C92', haze: 0.0019, jag: 1 },
  lake: { soil: '#8E7552', soil2: '#6E5A40', grassC: '#97895A', rock: '#7F766A', grass: ['#BDAA6C', '#9C9157', '#7E8A50'], grassAmt: 0.7, bladeH: 0.5, density: 0.9, trees: 8, treeTint: '#728448', bushes: 16, rocks: 5, hills: '#7E8496', haze: 0.0021, water: { r: 70, depth: 3, color: '#3E5A66' }, jag: 0.8, flora: [['acacia', 1], ['broadleaf', 1, { kind: 'fig', tint: '#5F7A3C' }]], shrubs: [['bush', 2], ['reeds', 1.4]] },
  woodland: { soil: '#7E5638', soil2: '#5E4029', grassC: '#8C8A50', rock: '#6E655C', grass: ['#A99A5E', '#8C8A4E', '#6E7A40'], grassAmt: 0.7, bladeH: 0.6, density: 0.9, trees: 40, treeTint: '#68793F', bushes: 40, rocks: 6, hills: '#6E7268', haze: 0.0026, jag: 0.7 },
  kalahari: { soil: '#B4734A', soil2: '#9A5C38', grassC: '#C4A877', rock: '#9A6F52', grass: ['#D8C08C', '#C2A774', '#A99467'], grassAmt: 0.4, bladeH: 0.45, density: 0.55, trees: 6, treeTint: '#808C55', bushes: 14, rocks: 2, hills: '#A08C80', haze: 0.0016, jag: 0.5 },
  highland: { soil: '#5D5136', soil2: '#4A4029', grassC: '#6F8445', rock: '#6F6D66', grass: ['#7E9650', '#62803E', '#9A9A58'], grassAmt: 0.85, bladeH: 0.5, density: 1.1, trees: 5, treeTint: '#55693A', bushes: 12, rocks: 14, hills: '#6A7A82', haze: 0.0045, jag: 1.6, flora: [['conifer', 1.4, { kind: 'pine', tint: '#4E6038' }], ['broadleaf', 1, { kind: 'oak', tint: '#5C6E3A' }]], shrubs: [['bush', 1]], line: { r: [100, 160], top: 12, shape: 'round', cover: 0.45, color: '#2E3A28', layers: 2 }},
  coast: { soil: '#B9A584', soil2: '#9D8A6B', grassC: '#8E8A5A', rock: '#7A7268', grass: ['#A79E6A', '#8C8A58', '#B1A574'], grassAmt: 0.3, bladeH: 0.4, density: 0.45, trees: 0, treeTint: '#6F7E4A', bushes: 20, rocks: 26, hills: '#7D8790', haze: 0.0024, water: { color: '#2F4D5E', sea: true }, jag: 1.2 },
  hills: { soil: '#A08766', soil2: '#857056', grassC: '#8A845A', rock: '#B3A58E', grass: ['#B4A06C', '#958A5C', '#7D7E50'], grassAmt: 0.35, bladeH: 0.4, density: 0.55, trees: 3, treeTint: '#6C7A48', bushes: 34, rocks: 30, hills: '#A39A8E', haze: 0.0018, jag: 1.4 },
  ice: { soil: '#E8ECEF', soil2: '#C9D0D6', grassC: '#B4AE92', rock: '#6E6A66', grass: ['#BDB59A', '#A69F84', '#D3CDB4'], grassAmt: 0.25, bladeH: 0.35, density: 0.35, trees: 0, treeTint: '#4E5E44', bushes: 8, rocks: 12, hills: '#B9C4D2', haze: 0.0032, snow: true, jag: 1.3, trees: 5, flora: [['conifer', 1, { snow: 0.7, tint: '#3E5034' }], ['birch', 0.6, { bare: true, snow: 0.5 }]], cover: 'hide', snowAmt: 0.7, line: { r: [130, 190], top: 12, shape: 'spiky', cover: 0.3, color: '#26302A', layers: 2 }},
  // ---- beyond the savanna (see places.js). flora/shrubs: [builder, weight, options] from flora.js; far: the distant
  // trees' shape and number; cover: what the shelters are covered with; snowChance: how often it is winter there ----
  // Africa: miombo (broadleaf woodland), the wet forest of the west (by 150,000 years ago), the Sahara green and dry
  miombo: { soil: '#8A5A3A', soil2: '#6E4630', grassC: '#9C9452', rock: '#7A6656', grass: ['#B8AA62', '#9A984E', '#7E8A44'], grassAmt: 0.75, bladeH: 0.65, density: 1, trees: 26, treeTint: '#7C8644', bushes: 26, rocks: 6, hills: '#727A6E', haze: 0.0024, jag: 0.8, hillJag: 0.6, flora: [['broadleaf', 3, { kind: 'miombo', tint: '#7E8A42' }], ['broadleaf', 1, { kind: 'miombo', tint: '#8E7E48' }], ['acacia', 0.4]], line: { r: [90, 150], top: 11, shape: 'round', cover: 0.7, color: '#3E4A28' }, treeD: [9, 90]},
  rainforest: { soil: '#5A4430', soil2: '#46361F', grassC: '#4E5A30', rock: '#5A5446', grass: ['#5E7434', '#4A6230', '#6E7E3A'], grassAmt: 0.25, bladeH: 0.4, density: 0.18, trees: 46, treeTint: '#4F6A36', bushes: 80, rocks: 4, hills: '#3E4A3A', haze: 0.0042, jag: 1.1, hillJag: 0.6,
    flora: [['jungle', 1.2, { tint: '#4A6834' }], ['broadleaf', 1.5, { kind: 'fig', tint: '#3F5E30' }], ['broadleaf', 0.8, { kind: 'teak', tint: '#55703A' }], ['palm', 0.8, { tint: '#5E7A3A' }]], shrubs: [['bigleaf', 2, { tint: '#3E5A2C' }], ['fern', 2], ['bush', 1, { tint: '#46602E' }]], cover: 'leaf', clouds: [0.3, 0.7], fogTint: ['#4A5638', 0.6], envK: 0.4, keyK: 0.72, nightK: 0.5, expMax: 4.5, line: { r: [30, 55], top: 26, shape: 'round', color: '#2A3A20' }, treeD: [8, 40]},
  greensahara: { soil: '#B08A5E', soil2: '#9A7650', grassC: '#9C9A58', rock: '#A8765A', grass: ['#A9A460', '#8E9450', '#BDB070'], grassAmt: 0.7, bladeH: 0.5, density: 0.9, trees: 7, treeTint: '#7A8848', bushes: 16, rocks: 22, hills: '#B08870', haze: 0.0016, water: { r: 80, depth: 3, color: '#3E5A66' }, jag: 1.5, flora: [['acacia', 2], ['broadleaf', 0.6, { kind: 'fig', tint: '#64783E' }]], shrubs: [['bush', 2], ['reeds', 1]] },
  desert: { soil: '#D2B184', soil2: '#BF9B6C', grassC: '#B8A878', rock: '#A47E5C', grass: ['#C8B47E', '#B0A06C', '#9E9A6A'], grassAmt: 0.08, bladeH: 0.3, density: 0.1, trees: 3, treeTint: '#7C8650', bushes: 10, rocks: 16, hills: '#C0A080', haze: 0.0014, jag: 0.9, dunes: 1, flora: [['acacia', 1, { scale: 0.7 }], ['palm', 0.3]], shrubs: [['bush', 1, { size: 0.6, tint: '#7E7E52' }], ['spinifex', 1, { tint: '#BDAF7A' }]], far: { shape: 'flat', n: 0 } },
  // western Asia: the Levant's oak and pistachio country on red soil and limestone; the Zagros, mountain steppe and oak
  mediterranean: { soil: '#8E6044', soil2: '#765038', grassC: '#9C9A5A', rock: '#C4BCAC', grass: ['#B0A860', '#8E9450', '#C2B272'], grassAmt: 0.55, bladeH: 0.4, density: 0.7, trees: 14, treeTint: '#5E6E3E', bushes: 34, rocks: 26, hills: '#A39C8E', haze: 0.0018, jag: 1.3, flora: [['broadleaf', 2, { kind: 'oak', scale: 0.7, tint: '#72824A' }], ['conifer', 0.6, { kind: 'pine', scale: 0.8, tint: '#4E6236' }]], shrubs: [['bush', 2, { tint: '#4E6036' }], ['bush', 1, { size: 0.6, tint: '#7E8252' }]], line: { r: [100, 160], top: 8, shape: 'round', cover: 0.45, color: '#3A4430', layers: 2 }},
  zagros: { soil: '#7E6A4E', soil2: '#685840', grassC: '#A6A062', rock: '#9A9284', grass: ['#B4AA6A', '#A0A05E', '#8C9658'], grassAmt: 0.8, bladeH: 0.42, density: 0.95, trees: 7, treeTint: '#62723E', bushes: 16, rocks: 22, hills: '#8C94A2', haze: 0.0014, jag: 2.4, flora: [['broadleaf', 2, { kind: 'oak', scale: 0.65, tint: '#74844A' }], ['broadleaf', 1, { kind: 'oak', scale: 0.55, tint: '#8A8C52' }]], shrubs: [['bush', 1, { tint: '#6A7244' }]], far: { shape: 'round', n: 70, size: 0.8, color: '#40482E' }, cover: 'hide', snowChance: 0.2 },
  // South and Southeast Asia: dry teak forest on red laterite, river grassland, palm coast
  monsoon: { soil: '#9A5E3E', soil2: '#7E4C32', grassC: '#A09A52', rock: '#7E6450', grass: ['#B4A65A', '#9A9A4C', '#7E8C40'], grassAmt: 0.7, bladeH: 0.6, density: 0.95, trees: 22, treeTint: '#6E7E3E', bushes: 28, rocks: 6, hills: '#7A8274', haze: 0.0032, jag: 1.2, hillJag: 0.7, flora: [['broadleaf', 2.4, { kind: 'teak', tint: '#728040' }], ['broadleaf', 0.8, { kind: 'fig', tint: '#4E6A34' }], ['palm', 0.5, { tint: '#6E8040' }]], shrubs: [['bush', 2, { tint: '#5E7038' }], ['bigleaf', 0.6, { tint: '#5A7036' }]], line: { r: [80, 140], top: 15, shape: 'round', cover: 0.75, color: '#36442A' }, treeD: [9, 80]},
  riverplain: { soil: '#6E5A40', soil2: '#5A4834', grassC: '#8E9A4E', rock: '#7A7062', grass: ['#9EA452', '#86964A', '#B2AA60'], grassAmt: 0.85, bladeH: 0.75, density: 1.1, trees: 10, treeTint: '#5E7A3C', bushes: 16, rocks: 3, hills: '#7A8494', haze: 0.0034, water: { r: 80, depth: 3, color: '#4A5A50' }, jag: 0.5, flora: [['broadleaf', 2, { kind: 'fig', tint: '#56723A' }], ['palm', 1, { tint: '#6E8442' }]], shrubs: [['bush', 1.4, { tint: '#56703A' }], ['reeds', 2]], line: { r: [110, 170], top: 14, shape: 'round', cover: 0.6, color: '#34422A' }},
  tropicalcoast: { soil: '#D2C29C', soil2: '#BCAA84', grassC: '#8E9A52', rock: '#6E6A62', grass: ['#9AA45A', '#86964E', '#B0AA6A'], grassAmt: 0.25, bladeH: 0.4, density: 0.4, trees: 12, treeTint: '#6E8442', bushes: 18, rocks: 10, hills: '#5E6E6A', haze: 0.0028, water: { color: '#2E5A62', sea: true }, jag: 1.4, flora: [['palm', 3, { tint: '#728646' }], ['broadleaf', 0.6, { kind: 'fig', tint: '#4E6A34' }]], shrubs: [['bush', 1, { tint: '#4E6A36' }], ['bigleaf', 0.6]], cover: 'leaf', line: { r: [55, 95], top: 14, shape: 'palm', cover: 0.75, color: '#34442A', layers: 2 }},
  // Australia (Sahul): eucalypt woodland on red earth, the arid centre's spinifex, a eucalypt coast
  eucalypt: { soil: '#A8623C', soil2: '#8E5032', grassC: '#B8A266', rock: '#8E5A40', grass: ['#C8B070', '#B09A5E', '#9C9A60'], grassAmt: 0.55, bladeH: 0.5, density: 0.8, trees: 18, treeTint: '#7F8C68', bushes: 24, rocks: 8, hills: '#94786A', haze: 0.0017, jag: 0.6, flora: [['eucalypt', 3], ['eucalypt', 1, { tint: '#6E7E5E', scale: 0.7 }]], shrubs: [['spinifex', 2], ['bush', 1, { tint: '#7A8466' }]], cover: 'bark', line: { r: [100, 160], top: 15, shape: 'round', cover: 0.5, color: '#4A5042', layers: 2 }},
  outback: { soil: '#B8633A', soil2: '#A0522F', grassC: '#BCA86C', rock: '#9E4E34', grass: ['#C8B474', '#B49E62', '#A49C68'], grassAmt: 0.15, bladeH: 0.35, density: 0.25, trees: 5, treeTint: '#808C6C', bushes: 46, rocks: 14, hills: '#A0563A', haze: 0.0013, jag: 0.8, flora: [['eucalypt', 1, { scale: 0.6, tint: '#7E8A6A' }]], shrubs: [['spinifex', 4], ['bush', 0.6, { size: 0.7, tint: '#8A8E6A' }]], far: { shape: 'round', n: 30, size: 0.8, color: '#5A5A48' }, cover: 'bark' },
  auscoast: { soil: '#CDB894', soil2: '#B89C74', grassC: '#9C9A62', rock: '#9A5E44', grass: ['#A8A06A', '#8E9058', '#B8AA76'], grassAmt: 0.35, bladeH: 0.4, density: 0.5, trees: 8, treeTint: '#7F8C68', bushes: 22, rocks: 18, hills: '#8C7A6E', haze: 0.0022, water: { color: '#2F5462', sea: true }, jag: 1.0, flora: [['eucalypt', 2, { scale: 0.8 }]], shrubs: [['bush', 2, { tint: '#6E7A58' }], ['spinifex', 1]], far: { shape: 'round', n: 60, color: '#4A5242' }, cover: 'bark' },
  // the north in the Ice Age: mammoth steppe (grass to the horizon, a few trees in the valleys), tundra by the ice
  // sheets, open pine and birch woods in the refuges and the thaw; spruce forest east of the steppe
  steppe: { soil: '#7A7058', soil2: '#8E846A', grassC: '#A8A272', rock: '#7E7A72', grass: ['#B4AE7A', '#9C9C6A', '#C4BC8A'], grassAmt: 0.95, bladeH: 0.5, density: 1.1, trees: 3, treeTint: '#56643E', bushes: 8, rocks: 8, hills: '#8E96A4', haze: 0.0022, jag: 1.0, flora: [['birch', 1, { tint: '#8E9A58' }], ['conifer', 1]], shrubs: [['bush', 1, { size: 0.6, tint: '#6E7048' }]], cover: 'hide', snowChance: 0.3, clouds: [0.25, 0.65], line: { r: [130, 200], top: 13, shape: 'spiky', cover: 0.28, color: '#2A3428', layers: 2 }},
  tundra: { soil: '#77705E', soil2: '#A9ADAA', grassC: '#8E8A68', rock: '#6E6C68', grass: ['#9A9470', '#857F5E', '#B0A884'], grassAmt: 0.45, bladeH: 0.22, density: 0.6, trees: 2, treeTint: '#4E5A3C', bushes: 22, rocks: 24, hills: '#B4BECC', haze: 0.0026, jag: 1.6, flora: [['birch', 1, { scale: 0.45, tint: '#8A9050' }], ['conifer', 1, { scale: 0.5 }]], shrubs: [['bush', 1, { size: 0.45, tint: '#6A6644' }]], far: { shape: 'cone', n: 0 }, cover: 'hide', snowChance: 0.4, clouds: [0.35, 0.75] },
  pinewood: { soil: '#6E604A', soil2: '#5A4E3C', grassC: '#949460', rock: '#7A746C', grass: ['#A4A066', '#8C9058', '#B4AC76'], grassAmt: 0.7, bladeH: 0.42, density: 0.85, trees: 26, treeTint: '#4E6236', bushes: 18, rocks: 10, hills: '#7E8896', haze: 0.0026, jag: 1.2, hillJag: 0.6, flora: [['conifer', 2, { kind: 'pine', tint: '#4A5E34' }], ['birch', 1.4, { tint: '#8E9C56' }]], shrubs: [['bush', 1, { tint: '#56643C' }], ['fern', 0.5, { tint: '#6E7A40' }]], cover: 'hide', snowChance: 0.3, line: { r: [80, 130], top: 16, shape: 'spiky', cover: 0.7, color: '#26321F' }, treeD: [9, 80]},
  taiga: { soil: '#5A5040', soil2: '#4A4234', grassC: '#7E8050', rock: '#6E6A64', grass: ['#8E9058', '#767E4A', '#A09E66'], grassAmt: 0.55, bladeH: 0.35, density: 0.7, trees: 32, treeTint: '#3E5234', bushes: 22, rocks: 10, hills: '#6E7A88', haze: 0.003, jag: 1.3, hillJag: 0.5, flora: [['conifer', 3, { tint: '#3E5232' }], ['birch', 1, { tint: '#8A9852' }], ['conifer', 0.8, { kind: 'pine', tint: '#46583A' }]], shrubs: [['bush', 1, { size: 0.7, tint: '#4A5A36' }]], cover: 'hide', snowChance: 0.45, line: { r: [55, 95], top: 17, shape: 'spiky', color: '#1E2A1E' }, treeD: [9, 55]},
  // the warm Holocene north: oak and beech forest, mixed forest of East Asia, a cold grey coast; and the glacial
  // lakeshores of North America (White Sands' footprints are on one)
  deciduous: { soil: '#5A4632', soil2: '#4A3A2A', grassC: '#6E8A3E', rock: '#6E6A60', grass: ['#6E8A3E', '#5A7A34', '#86964A'], grassAmt: 0.85, bladeH: 0.45, density: 1, trees: 34, treeTint: '#5A7438', bushes: 30, rocks: 6, hills: '#6E7A72', haze: 0.0034, jag: 1.0, hillJag: 0.6, flora: [['broadleaf', 2, { kind: 'oak', tint: '#55703A' }], ['broadleaf', 1.2, { kind: 'beech', tint: '#62803E' }], ['birch', 0.4]], shrubs: [['bush', 2, { tint: '#4E6A34' }], ['fern', 1]], clouds: [0.2, 0.6], line: { r: [55, 95], top: 20, shape: 'round', color: '#26361E' }, treeD: [9, 55]},
  mixedwood: { soil: '#7A6646', soil2: '#625238', grassC: '#808A4A', rock: '#7A746A', grass: ['#8E964E', '#748644', '#A09E5E'], grassAmt: 0.75, bladeH: 0.45, density: 0.9, trees: 30, treeTint: '#56703A', bushes: 26, rocks: 12, hills: '#7A8696', haze: 0.0036, jag: 1.9, hillJag: 1.0, flora: [['conifer', 1.5, { kind: 'pine', tint: '#46603A' }], ['broadleaf', 1.5, { kind: 'oak', tint: '#5A7438' }], ['birch', 0.5]], shrubs: [['bush', 2, { tint: '#4E6634' }], ['fern', 0.6]], snowChance: 0.15, line: { r: [65, 110], top: 18, shape: 'spiky', cover: 0.85, color: '#26341F' }, treeD: [9, 65]},
  coldcoast: { soil: '#8E8672', soil2: '#7A725E', grassC: '#7E8A5A', rock: '#6A6A68', grass: ['#8A9460', '#748256', '#9C9E70'], grassAmt: 0.6, bladeH: 0.35, density: 0.7, trees: 4, treeTint: '#4E6038', bushes: 14, rocks: 28, hills: '#7E8894', haze: 0.003, water: { color: '#3A4E58', sea: true }, jag: 1.3, flora: [['conifer', 1, { kind: 'pine' }], ['birch', 1]], shrubs: [['bush', 1, { size: 0.7, tint: '#5A6640' }]], cover: 'hide', clouds: [0.35, 0.8], line: { r: [90, 140], top: 12, shape: 'spiky', cover: 0.4, color: '#2A3428', layers: 2 }},
  coldlake: { soil: '#7A6E56', soil2: '#6A5E48', grassC: '#94966A', rock: '#7E7A72', grass: ['#A4A26E', '#8E9260', '#B4AE7C'], grassAmt: 0.75, bladeH: 0.45, density: 0.9, trees: 12, treeTint: '#3E5234', bushes: 12, rocks: 10, hills: '#9AA2B0', haze: 0.0024, water: { r: 80, depth: 3, color: '#3E5662' }, jag: 1.6, hillJag: 0.8, flora: [['conifer', 2, { tint: '#3E5234' }], ['conifer', 1, { kind: 'pine' }]], shrubs: [['bush', 1, { size: 0.6, tint: '#5A6442' }], ['reeds', 1.2]], cover: 'hide', snowChance: 0.2, line: { r: [110, 170], top: 14, shape: 'spiky', cover: 0.6, color: '#24302A' }},
};
// winter in a cold place: the same land under snow (applied over a habitat when its snowChance comes up)
const SNOW = { soil: '#E8ECEF', soil2: '#C9D0D6', grassC: '#B4AE92', grass: ['#BDB59A', '#A69F84', '#D3CDB4'], grassAmt: 0.3, bladeH: 0.3, density: 0.4, snow: true, snowAmt: 0.6 };
// where people could be at a given date: places.js (the dated map); kept here for callers that import it from world.js
export function placeFor(g, years, o) { return place(g, years, o).habitat; }
const TIMES = { day: [24, 48], dusk: [2.5, 9], morning: [6, 16] };

// ---------- the scene ----------
export function buildAncestors({ topic = 'strangers', g = 4000, years = g * 27, renderer, opts = {} }) {
  const R = rng(g * 1.37 + 0.5), story = opts.story || MINE[topic] || STORIES[topic] || STORIES.strangers;
  // where: a habitat the caller or story fixes, or the dated map's region and habitat for this generation
  let habitat = opts.habitat || story.habitat?.(g, R), region = opts.region || null;
  if (!habitat) ({ habitat, region } = place(g, years, { avoid: story.avoid, regions: story.noRegions }));
  // winter: a cold place under snow when its season comes up (never in a story that needs summer); own randomness, so
  // the story's draws stay as they were
  let H = HABITATS[habitat];
  if (H.snowChance && !story.noSnow && (opts.snow ?? rng(g * 2.71 + 0.3)() < H.snowChance)) H = { ...H, ...SNOW, winter: true };
  // the kit of that date and place (era.js): only for picks of the dated map, so a story or card that fixes its own
  // habitat keeps its own people and things
  const E = region ? eraFor({ years, region, habitat, snow: !!H.snow }) : null, ER = rng(g * 5.31 + 0.7);
  let time = opts.time || pickTime(story.times || ['day', 'dusk'], R);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 6000);
  const updates = [];
  // the story decides where the camera stands and what it looks at; the world is built around that
  const S = story.compose({ R, g, years, habitat, time, H });
  if (!opts.time && S.times && !S.times.includes(time)) time = pickTime(S.times, R); // a situation can need its own light (a fire at dusk)
  // a story can fix the sun ([elevation, azimuth] in degrees) and the moon ([elevation, azimuth], or null for none)
  let az = S.sunAz ?? R.range(0, 360), elev = time === 'night' ? -10 : R.range(...(TIMES[time] || TIMES.day));
  if (S.sun) [elev, az] = S.sun;
  const sun = sunDir(elev, az);
  // sky, environment light, fog
  if (time === 'night') {
    let moon = R() < 0.6 ? sunDir(R.range(18, 45), az + 140) : null; if (S.moon !== undefined) moon = S.moon && sunDir(...S.moon);
    const sky = nightSky({ moon, seed: g, lift: S.nightLift || 0, moonDeg: S.moonDeg || 0, moonBright: S.moonBright || 1 }); scene.add(sky); updates.push((t) => { sky.material.uniforms.uTime.value = t; });
    scene.environment = envFor(renderer, nightSky({ moon, seed: g, lift: S.nightLift || 0 })); scene.environmentIntensity = S.envNight ?? (moon ? 1.6 : 1.1);
    // a story can ask for a cinematic moon: a strong cool key that throws shadows (S.moonLight)
    const ml = new THREE.DirectionalLight('#9FB2DA', S.moonLight ?? (moon ? 0.9 : 0.35)); ml.position.copy(moon || sunDir(40, az)).multiplyScalar(200); scene.add(ml);
    if (S.moonLight) { ml.position.add(new THREE.Vector3(S.focus.x, 0, S.focus.z)); ml.target.position.set(S.focus.x, 0, S.focus.z); scene.add(ml.target); ml.castShadow = true; ml.shadow.mapSize.set(4096, 4096); Object.assign(ml.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 10, far: 400 }); ml.shadow.bias = -0.0004; ml.shadow.normalBias = 0.03; }
    scene.fog = new THREE.FogExp2('#0A0E18', H.haze * 0.8);
  } else {
    const clouds = H.clouds ? R.range(...H.clouds) : H.snow ? R.range(0.35, 0.7) : R.range(0, 0.45);
    const turb = time === 'dusk' ? R.range(4, 8) : R.range(3, 7); // a story can ask for clear air (S.turbidity, S.mie): a deep sky round a visible sun
    scene.add(daySky({ sun, turbidity: S.turbidity ?? turb, rayleigh: time === 'dusk' ? 2.2 : 1.5, mie: S.mie ?? 0.004, mieG: S.mieG ?? 0.82, clouds: S.clouds ?? clouds, sunDeg: S.sunDeg, hot: S.sunHot || 0, hotRim: S.sunHotRim ?? 0.06 }));
    scene.environment = envFor(renderer, daySky({ sun, turbidity: S.turbidity ?? 5, rayleigh: 1.6, mie: S.mie ?? 0.004, clouds })); scene.environmentIntensity = (opts.env ?? (time === 'dusk' ? 0.22 : 0.28)) * (H.envK ?? 1); // under a canopy the sky lights less
    const L = lightFor(time, elev), sl = new THREE.DirectionalLight(L.color, L.intensity * (opts.sun ?? 1.6));
    sl.position.copy(sun).multiplyScalar(120).add(new THREE.Vector3(S.focus.x, 0, S.focus.z)); sl.target.position.set(S.focus.x, 0, S.focus.z); scene.add(sl, sl.target);
    sl.castShadow = true; sl.shadow.mapSize.set(4096, 4096); Object.assign(sl.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 10, far: 300 }); sl.shadow.bias = -0.0003; sl.shadow.normalBias = 0.03;
    // haze takes the colour of the sky at the horizon where the camera looks
    const vd = new THREE.Vector3(S.camera.target[0] - S.camera.pos[0], 0, S.camera.target[2] - S.camera.pos[2]).normalize();
    const fogC = horizonColor(renderer, daySky({ sun, turbidity: S.turbidity ?? 5, rayleigh: time === 'dusk' ? 2.2 : 1.5, mie: S.mie ?? 0.004, clouds: 0 }), vd);
    // at dusk the glow round the sun is brighter than the air between us and the hills: damp it
    if (time === 'dusk') fogC.multiplyScalar(0.62).lerp(new THREE.Color(0.32, 0.27, 0.33).multiplyScalar(fogC.r), 0.25);
    // looking towards a low morning sun, the horizon there is the sun's glow, several times brighter than the air, and the
    // morning exposure lifts it further: a forest's edge 50 m off would glow salmon. In the new lands cap the haze's
    // brightness near the savanna's morning level (the savanna's kept as it was)
    if (H.flora && time === 'morning') { const l = fogC.r + fogC.g + fogC.b; if (l > 1.8) fogC.multiplyScalar(1.8 / l); }
    if (H.fogTint) fogC.lerp(new THREE.Color(H.fogTint[0]).multiplyScalar(fogC.r + fogC.g + fogC.b), H.fogTint[1]); // a forest's air is green-grey, not sky-blue
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
  const height0 = S.height ? S.height(base) : rot ? (x, z) => base(x * cr + z * sr, -x * sr + z * cr) : base; // a story can reshape the land (a rise on the skyline)
  const height = H.dunes ? dunesOver(height0, g % 997) : height0;
  const ground = (x, z) => height(x, z);
  scene.add(terrain({ height, palette: { soil: H.soil, soil2: H.soil2, grass: H.grassC, rock: H.rock, grassAmt: H.grassAmt, wetline: water ? (water.sea ? 0.05 : LAKE_Y + 0.1) : -99 }, seed: g % 997 }));
  if (water) scene.add(waterSurface(water, updates, rot));
  const camp = S.clear || [[0, 0, 5, 3]];
  const field = grass({ height, count: Math.round(140000 * H.density * (S.grass ?? 1)), radius: 85, center: [S.focus.x * 0.5, S.focus.z * 0.5], clear: camp.concat(S.figClear || []), colors: { ...H.grass, waterline: water ? (water.sea ? 0.3 : LAKE_Y + 0.5) : -99 }, seed: g % 991, bladeH: H.bladeH * (S.bladeH ?? 1) });
  scene.add(field); updates.push(field.userData.update);
  if (time !== 'night') { const L = lightFor(time, elev); field.userData.sun(sun, L.color.clone().multiplyScalar(L.intensity * (opts.sun ?? 1.6))); }
  // trees, bushes, rocks, around the camp but out of the shot's way
  const SC = { trees: 1, bushes: 1, rocks: 1, ...(S.scatter || {}) }; // a story can thin the trees, bushes and rocks it did not place
  const free = (x, z, m = 3) => !camp.some((c) => Math.hypot(x - c[0], z - c[1]) < c[2] + m) && !(S.keepOut || []).some((c) => Math.hypot(x - c[0], z - c[1]) < c[2]) && (!water || height(x, z) > (water.sea ? 0.4 : LAKE_Y + 0.6));
  if (!H.flora) { // the savanna's acacias and bushes, exactly as before (the swap cards are built on these)
    for (let i = 0; i < Math.round(H.trees * SC.trees); i++) { const a = R() * 6.28, d = R.range(9, 160), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 4)) continue; const t = acacia({ seed: g + i * 7.1, scale: R.range(0.75, 1.3), tint: H.treeTint }); t.position.set(x, ground(x, z), z); t.rotation.y = R() * 6.28; scene.add(t); }
    for (let i = 0; i < Math.round(H.bushes * SC.bushes); i++) { const a = R() * 6.28, d = R.range(6, 90), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z)) continue; const b = bush({ seed: g + i * 3.3, size: R.range(0.6, 1.5), tint: H.treeTint }); b.position.set(x, ground(x, z), z); scene.add(b); }
  } else {
    // the habitat's own plants (flora.js), drawn by weight; nothing tall between the lens and anyone in the shot
    const FR = rng(g * 3.17 + 0.9), pickW = (list) => { let a = FR() * list.reduce((t, e) => t + e[1], 0); for (const e of list) if ((a -= e[1]) < 0) return e; return list[list.length - 1]; };
    const cp = S.camera.pos, seg = (x, z, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - ax - t * dx, z - az - t * dz); };
    const inShot = (x, z, r) => Math.hypot(x - cp[0], z - cp[2]) < r + 3 || S.figures.some((f) => seg(x, z, cp[0], cp[2], f.x, f.z) < r);
    const dress = (o) => ({ ...o, ...(H.snow ? { snow: o.snow ?? H.snowAmt ?? 0.5 } : {}), ...(H.winter ? { bare: true } : {}) });
    // most of them where the camera looks (behind the people and at the frame's edges), so the land reads in the shot
    const viewA = Math.atan2(S.camera.target[2] - cp[2], S.camera.target[0] - cp[0]), around = (R) => (FR() < (H.inView ?? 0.6) ? viewA + (R() - 0.5) * 1.3 : R() * 6.28);
    for (let i = 0; i < Math.round(H.trees * SC.trees); i++) { const a = around(R), d = R.range(...(H.treeD || [9, 160])), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 4) || inShot(x, z, 3)) continue;
      const [type, , o = {}] = pickW(H.flora), t = FLORA[type](dress({ ...o, seed: g + i * 7.1, scale: R.range(0.75, 1.3) * (o.scale || 1), tint: o.tint || H.treeTint })); t.position.set(x, ground(x, z) - 0.05, z); t.rotation.y = R() * 6.28; scene.add(t); }
    const shrubs = H.shrubs || [['bush', 1]];
    for (let i = 0; i < Math.round(H.bushes * SC.bushes); i++) { let a = around(R), d = R.range(6, 90), x = Math.cos(a) * d, z = Math.sin(a) * d; const [type, , o = {}] = pickW(shrubs);
      // reeds stand at the lake's edge, in the shallows
      if (type === 'reeds') { if (!water || water.sea) continue; const rr = water.r * R.range(0.86, 1.0); x = water.x + Math.cos(a) * rr; z = water.z + Math.sin(a) * rr; const y = height(x, z); if (y > LAKE_Y + 0.9 || y < LAKE_Y - 0.4 || inShot(x, z, 1.5) || camp.some((c) => Math.hypot(x - c[0], z - c[1]) < c[2] + 3)) continue; }
      else if (!free(x, z) || inShot(x, z, 1.4)) continue;
      const b = FLORA[type](dress({ ...o, seed: g + i * 3.3, size: R.range(0.6, 1.5) * (o.size || 1), tint: o.tint || (type === 'bush' ? H.treeTint : undefined) })); if (!b.isObject3D) continue; b.position.set(x, ground(x, z), z); b.rotation.y = R() * 6.28; scene.add(b); }
  }
  for (let i = 0; i < Math.round(H.rocks * SC.rocks); i++) { const a = R() * 6.28, d = R.range(5, 80), x = Math.cos(a) * d, z = Math.sin(a) * d; if (!free(x, z, 1)) continue; const k = rock({ seed: g + i * 5.7, size: R.range(0.2, H.rocks > 20 ? 1.6 : 0.8), color: H.rock }); k.position.set(x, ground(x, z) - 0.1, z); scene.add(k); }
  // far hills: hazed silhouettes a shade darker than the sky behind them (night: nearly black against the stars)
  const hz = scene.fog.color.clone(), hillTint = time === 'night' ? new THREE.Color(0.004, 0.005, 0.009) : (time === 'dusk' ? hz.clone().multiplyScalar(0.42).lerp(new THREE.Color(0.05, 0.045, 0.075), 0.35) : hz.clone().lerp(new THREE.Color(H.hills).multiplyScalar(0.35), 0.22).multiplyScalar(0.86));
  // hillJag: a forest's far hills roll low and round (sharp peaks above a treeline read as a cut-out forest)
  const hj = H.hillJag ?? H.jag;
  scene.add(farHills({ seed: g % 97, color: H.hills, height: 60 + hj * 90, jag: hj, tint: hillTint }));
  const farAvoid = (x, z) => (water && height(x, z) < (water.sea ? 0.3 : LAKE_Y + 0.6)) || (S.keepOut || []).some((c) => Math.hypot(x - c[0], z - c[1]) < c[2]);
  // a forest's edge round the clearing, standing behind the camera and everyone in the shot (walkers included)
  if (H.line && SC.trees > 0) { const reach = Math.max(Math.hypot(S.camera.pos[0], S.camera.pos[2]), ...S.figures.map((f) => Math.hypot(f.x, f.z) + (f.walk ? 10 : 0)));
    const r0 = Math.max(H.line.r[0], reach + 14), r1 = r0 + H.line.r[1] - H.line.r[0];
    scene.add(treeline({ height, seed: g % 97, r: [r0, r1], top: H.line.top, shape: H.line.shape, cover: H.line.cover ?? 1, color: H.line.color, layers: H.line.layers ?? 3, gap: (x, z, y) => farAvoid(x, z) || (water && (water.sea ? y < 0.6 : y < LAKE_Y + 0.9)) })); }
  if (H.far) { const n = H.far.n ?? Math.round(H.trees * 14); if (n > 0 && SC.trees > 0) scene.add(farTrees({ height, seed: g % 89, n, near: H.far.near ?? 110, shape: H.far.shape, size: H.far.size ?? 1, color: H.far.color ? new THREE.Color(H.far.color) : new THREE.Color(H.treeTint).multiplyScalar(0.5), avoid: farAvoid })); }
  else if (H.trees > 2 && SC.trees > 0) scene.add(farTrees({ height, seed: g % 89, n: Math.round(H.trees * 14), color: new THREE.Color(H.treeTint).lerp(new THREE.Color('#5A5A48'), 0.5).multiplyScalar(0.5), avoid: (x, z) => (water && height(x, z) < 0.3) || (S.keepOut || []).some((c) => Math.hypot(x - c[0], z - c[1]) < c[2]) }));
  for (const c of camp) scene.add(litter({ height, seed: g % 83 + c[0], center: [c[0], c[1]], radius: c[2] + 4, n: S.litter ?? 700, colors: [H.rock, '#5E4D3B', H.grass[0]] }));
  // the air: dust in low light, birds now and then by day
  if (time === 'dusk' || time === 'morning') { const d = dust({ center: [S.focus.x, S.focus.z], seed: g % 71, strength: time === 'dusk' ? 1 : 0.6 }); scene.add(d); updates.push(d.userData.update); }
  if (time !== 'night' && R() < 0.45 && !S.noBirds) { const b = birds({ seed: g % 61, n: 3 + Math.floor(R() * 5) }); scene.add(b); updates.push(b.userData.update); }
  // the camp's things and the people
  const figs = [];
  // thatch is cut grass, dried: straw-coloured whatever green the living grass is (the savanna's huts kept as they were)
  const thatchC = H.thatch || (H.flora ? '#' + new THREE.Color(H.grass[1]).lerp(new THREE.Color('#A08654'), 0.9).getHexString() : H.grass[1]);
  const put = (o, x, z, yaw = 0) => { o.position.set(x, ground(x, z), z); o.rotation.y = yaw; scene.add(o); return o; };
  const lib = { fire: (o) => fire({ ...o, night: time !== 'day' }), shelter: (o) => shelter({ ...o, grassColor: thatchC, cover: E?.shelter === 'bone' ? 'hide' : E?.shelter === 'pit' ? 'thatch' : E?.shelter === 'lean' ? 'bark' : H.cover || 'thatch', form: E?.shelter || 'dome' }), hide, spear, stick, bowl: (o) => (E?.pottery ? pot(rng(g + (o.seed || 0) + 0.21)) : bowl(o)), egg, stones };
  // props: a named camp thing, or { type: 'custom', make: (R) => Object3D } for anything a story builds itself; y lifts it
  for (const p of S.props || []) { const o = p.type === 'custom' ? p.make(R, { ground, time, H }) : lib[p.type]({ seed: g + (p.seed || 0), ...(p.o || {}) }); put(o, p.x, p.z, p.yaw || 0); if (p.y) o.position.y += p.y; if (p.lean) { o.rotation.z = p.lean; } if (o.userData.update) updates.push(o.userData.update); }
  for (const f of S.figures) {
    // a spear becomes a bow for about half the carriers where there were bows; an egg flask becomes a skin bag
    if (E && f.hold?.alt && ((f.hold.era === 'bow' && E.bow && ER() < 0.5) || (f.hold.era === 'noEggs' && !E.eggs))) f.hold = f.hold.alt;
    // a hide cloak over the shoulders in the cold before there were needles (as well as anything held)
    if (E?.clothes === 'cloak' && !['child', 'toddler'].includes(f.kind) && !f.noCloak && !/^lie|curl/.test(f.pose || '')) { const c = { type: 'custom', hand: 'r', make: (R) => held(cloak(R), { at: 'chest', pos: [0, -0.02, -0.01] }) }; f.hold = f.hold ? { type: 'custom', hand: f.hold.hand, rot: f.hold.rot, make: ((h) => (R) => together(h.type === 'custom' ? h.make(R) : lib[h.type]({ ...(h.o || {}) }), c.make(R)))(f.hold) } : c; }
    const m = makeMannequin({ kind: f.kind || 'man', tone: f.tone || TONES[f.wood || R.pick(['birch', 'ash', 'beech', 'birch', 'pine'])], seed: R() * 100 });
    m.root.position.set(f.x, 0, f.z); m.root.rotation.y = f.yaw || 0; scene.add(m.root);
    if (E) { dress(m, E.clothes, ER, { kind: f.kind || 'man' }); if (E.beads && !['child', 'toddler'].includes(f.kind) && ER() < 0.45) beads(m, ER); }
    if (f.hold) { const h = f.hold.type === 'custom' ? f.hold.make(R) : lib[f.hold.type]({ ...(f.hold.o || {}) }); m.J[f.hold.hand === 'l' ? 'lWr' : 'rWr'].add(h); h.position.set(0, -0.12, 0.02); if (f.hold.rot) h.rotation.set(...f.hold.rot); }
    const r = R(); figs.push({ m, f, r: f.r ?? r });
  }
  // the era's animals and pots, round the camp where no one stands and nothing blocks the shot
  if (E) {
    const taken = S.figures.map((f) => [f.x, f.z, 1.1]).concat((S.props || []).map((p) => [p.x, p.z, p.type === 'shelter' ? 2.6 : 0.9]));
    const cp = S.camera.pos, viewA = Math.atan2(S.camera.target[2] - cp[2], S.camera.target[0] - cp[0]);
    const clear = (x, z, r) => taken.every(([a, b, rr]) => Math.hypot(x - a, z - b) > rr + r) && Math.hypot(x - cp[0], z - cp[2]) > 3 && (!water || height(x, z) > (water.sea ? 0.5 : LAKE_Y + 0.8));
    const putNear = (o, near, r, d0, d1, spread) => { for (let k = 0; k < 40; k++) { const a = viewA + (ER() - 0.5) * spread, d = d0 + ER() * (d1 - d0), x = near[0] + Math.cos(a) * d, z = near[1] + Math.sin(a) * d; if (!clear(x, z, r)) continue;
      o.position.set(x, ground(x, z), z); o.rotation.y = ER() * 6.28; scene.add(o); taken.push([x, z, r]); if (o.userData.update) updates.push(o.userData.update); return true; } return false; };
    const fire0 = (S.props || []).find((p) => p.type === 'fire'), hearth = fire0 ? [fire0.x, fire0.z] : [S.focus.x, S.focus.z];
    if (E.pottery) for (let i = 0; i < 1 + Math.floor(ER() * 2); i++) putNear(pot(ER), hearth, 0.25, 0.7, 1.6, 6.28);
    if (E.dogs) for (let i = 0; i < 1 + Math.floor(ER() * 2); i++) putNear(dog(ER), hearth, 0.5, 1.5, 5, 3.2);
    if (E.cattle) for (let i = 0; i < 3 + Math.floor(ER() * 4); i++) putNear(cattle(ER), [S.focus.x, S.focus.z], 1.4, 10, 28, 1.1);
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
  // lock: the camera stands exactly where the story says, its height measured from the ground at S.anchor (the
  // swap cards: the same camera over the same subject in two worlds); no stepping back, no reframing, no drift
  const lock = !!S.lock;
  if (lock) { const [ax, az2] = S.anchor || [0, 0], b = ground(ax, az2) + (S.anchorLift || 0); pos.y += b; tgt.y += b; }
  if (!lock) { const back = new THREE.Vector3(pos.x - tgt.x, 0, pos.z - tgt.z).normalize();
    const PR = { shelter: 2.4, fire: 1.2, custom: 1.0 }, blockers = S.figures.map((f) => [...at2(f), 1.8]).concat((S.props || []).map((p) => [p.x, p.z, PR[p.type] || 0.7]));
    for (let k = 0; k < 60 && blockers.some(([x, z, r]) => Math.hypot(x - pos.x, z - pos.z) < r); k++) pos.addScaledVector(back, 0.15); }
  if (!lock) { pos.y += ground(pos.x, pos.z); tgt.y += ground(tgt.x, tgt.z); }
  camera.fov = cam0.fov || 36;
  // the person whose alarm is on must be well inside the frame: turn the camera towards them if they fall near an edge
  { const af = S.figures.find((f) => f.alarm);
    if (af && !lock) { const [ax, az] = at2(af), c = new THREE.PerspectiveCamera(camera.fov, 16 / 9, 0.1, 1000), head = new THREE.Vector3(ax, ground(ax, az) + 1.4, az);
      for (let k = 0; k < 30; k++) { c.position.copy(pos); c.lookAt(tgt); c.updateMatrixWorld(); const p = head.clone().project(c);
        if (p.z < 1 && Math.abs(p.x) < 0.72 && Math.abs(p.y) < 0.8) break; tgt.lerp(head, 0.12); } } }
  updates.push((t) => {
    if (lock) { camera.position.copy(pos); camera.lookAt(tgt); return; }
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
  const api = { scene, camera, look, habitat, time, figs, alarmPoint, ground, S, update(t) { for (const u of updates) u(t); }, info: { g, years, region, habitat, winter: !!H.winter, time, topic, era: E ? [E.clothes, E.shelter, E.bow && 'bow', E.pottery && 'pots', E.dogs && 'dogs', E.cattle && 'cattle'].filter(Boolean).join(' ') : '' },
    expose(stage) { api.update(2); const L = stage.meter(scene, camera), p = look.exposure; look.exposure = THREE.MathUtils.clamp(KEY[time] * (H.keyK ?? 1) * (time === 'night' ? H.nightK ?? 1 : 1) / L, p * 0.6, p * (H.expMax ?? 2.8)); api.info.exposure = +look.exposure.toFixed(3); } }; // keyK: a forest floor is darker than open ground
  return api;
}
function pickTime(list, R) { return list[Math.floor(R() * list.length)]; }
// dunes: long sand ridges rising out of the flat ground round the camp, their crests bent by noise
function dunesOver(h, seed) {
  const th = (seed % 360) * 0.0175, c = Math.cos(th), s = Math.sin(th);
  return (x, z) => { const d = Math.hypot(x, z), ramp = Math.min(1, Math.max(0, (d - 22) / 60)), u = x * c + z * s, v = -x * s + z * c;
    const ridge = Math.pow(0.5 + 0.5 * Math.sin(u * 0.04 + fbm2(u * 0.008, v * 0.008, seed, 3) * 5), 2.5);
    return h(x, z) + ramp * ridge * (4 + fbm2(v * 0.005, u * 0.005, seed + 3, 2) * 9); };
}

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
