// Where the ancestors stand: a rough map of where your ancestors were at a given date, and what the land looked like
// there in that phase of the climate. Every living person's ancestors lived in Africa until about 60,000 years ago;
// after that the ancestors of most living people left, waited a while in western Asia, then spread across the world,
// while the ancestors of living Africans stayed in Africa. So a pick's region is drawn from the regions people's
// ancestors lived in at its date, weighted roughly by how many living people descend from each, and its habitat from
// the land that region had in that climate. Research and sources: PLACES.md (same folder).

// ---------- the climate at a date ----------
// cold: glacial maxima (Africa dry, forests shrunk, the north under ice and steppe); mild: the long middle of a glacial
// (MIS 3, MIS 5a-d); warm: interglacials (MIS 5e, MIS 7, the Holocene); late: the last deglaciation
export function climate(years) {
  if (years < 11700) return 'warm';
  if (years < 14700) return 'late';
  if (years < 29000) return 'cold';
  if (years < 57000) return 'mild';
  if (years < 71000) return 'cold';
  if (years < 115000) return 'mild';
  if (years < 130000) return 'warm';
  if (years < 191000) return 'cold';
  if (years < 243000) return 'warm';
  return 'cold';
}
// the Sahara turned green in wet phases, roughly: the African Humid Period and the humid pulses of MIS 5 and earlier
export function greenSahara(years) {
  return [[5500, 14800], [75000, 85000], [95000, 105000], [115000, 130000], [200000, 215000], [230000, 245000], [320000, 335000]].some(([a, b]) => years >= a && years <= b);
}

// ---------- regions: when your ancestors were there, roughly how many living people descend from people there,
// and the habitats (keys of HABITATS in world.js) the region offered in each climate, with weights ----------
export const REGIONS = {
  africa: { from: 400000, weight: 0.2, habitats(c, y) {
    const wet = c === 'warm' || c === 'mild', h = { savanna: 2.2, lake: 1.5, miombo: wet ? 1.6 : 0.8, highland: 1, coast: 1, kalahari: c === 'cold' ? 1.2 : 0.7, hills: 0.8 };
    if (y <= 150000) h.rainforest = wet ? 1.3 : 0.6;   // Bete I, Cote d'Ivoire: people in wet forest by 150,000 years ago
    if (greenSahara(y)) h.greensahara = 1.6; else h.desert = 0.35; // people kept to the desert's edges
    return h; } },
  // the hub: after leaving Africa, the ancestors of non-Africans stayed in western Asia (Levant, Arabia, Zagros and
  // the Persian plateau) for perhaps 10,000 to 20,000 years before spreading out
  neareast: { from: 60000, weight: (y) => (y > 45000 ? 0.6 : 0.1), habitats(c, y) {
    return y < 11700 ? { mediterranean: 2, zagros: 1.5, desert: 0.6 } : { mediterranean: 1.5, zagros: 1.5, desert: c === 'cold' ? 1 : 0.5, steppe: c === 'cold' ? 0.6 : 0 }; } },
  southasia: { from: 50000, weight: 0.14, habitats(c) { return { monsoon: 2.2, riverplain: 1.4, tropicalcoast: 0.6, hills: c === 'cold' ? 0.8 : 0.3 }; } },
  seasia: { from: 50000, weight: 0.09, habitats(c) { return { rainforest: c === 'cold' ? 1.2 : 2.2, tropicalcoast: 1.2, monsoon: c === 'cold' ? 1.2 : 0.4 }; } },
  sahul: { from: 50000, weight: 0.08, habitats() { return { eucalypt: 2.2, outback: 1.2, auscoast: 0.8, rainforest: 0.6 }; } },   // Australia and New Guinea, one land at low sea level
  europe: { from: 45000, weight: 0.14, habitats(c) {
    if (c === 'warm') return { deciduous: 3, coldcoast: 0.8, pinewood: 0.6 };
    if (c === 'late') return { pinewood: 2, tundra: 1, steppe: 0.6 };
    if (c === 'cold') return { tundra: 2, ice: 1.4, steppe: 1, pinewood: 0.8 };   // the Last Glacial Maximum: ice sheets in the north, refuges in the south
    return { steppe: 2, taiga: 1, ice: 0.7, pinewood: 0.6 }; } },
  northasia: { from: 45000, weight: 0.07, habitats(c) {
    if (c === 'warm') return { taiga: 2, steppe: 1 };
    return { steppe: 2, taiga: 1.4, ice: 1, tundra: c === 'cold' ? 1 : 0.4 }; } },
  eastasia: { from: 45000, weight: 0.14, habitats(c) {
    if (c === 'warm') return { mixedwood: 2, deciduous: 1, riverplain: 1 };
    if (c === 'cold') return { steppe: 2, taiga: 1, mixedwood: 0.6, ice: 0.4 };
    return { mixedwood: 2, steppe: 1, riverplain: 0.8, taiga: 0.4 }; } },
  // White Sands footprints: people in North America 23,000 to 21,000 years ago, on a lakeshore with conifers nearby
  americas: { from: 22000, weight: 0.12, habitats(c, y) {
    if (y > 13000) return { coldlake: 2, steppe: 1, taiga: 1, tundra: 0.5 };
    return { deciduous: 1, steppe: 1, rainforest: 1, taiga: 0.8, desert: 0.5, pinewood: 0.6 }; } },
};

// the same generation always lands in the same place; two independent hashes of g, one for the region, one for the land.
// The salts are chosen (like stories.js's) so that the strip's own recent picks reach every region the map opens
export const SALT = { region: 223.193, land: 5.677 };
const hash = (g, salt) => { const v = Math.sin(g * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
function draw(weights, r) { const e = Object.entries(weights).filter(([, w]) => w > 0), T = e.reduce((s, [, w]) => s + w, 0); let a = r * T; for (const [k, w] of e) { if ((a -= w) < 0) return k; } return e[e.length - 1][0]; }

// avoid: habitats a story cannot be told in (a story's own list); regions: regions it cannot be told in
export function placeFor(g, years, { avoid = [], regions: noRegions = [] } = {}) {
  const c = climate(years), open = {};
  for (const [k, R] of Object.entries(REGIONS)) if (years <= R.from && !noRegions.includes(k)) open[k] = typeof R.weight === 'function' ? R.weight(years) : R.weight;
  const region = draw(open, hash(g, SALT.region)), hs = REGIONS[region].habitats(c, years);
  for (const a of avoid) delete hs[a];
  const habitat = Object.keys(hs).length ? draw(hs, hash(g, SALT.land)) : 'savanna';
  return { region, habitat, climate: c };
}
