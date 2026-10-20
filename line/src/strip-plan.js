// The strip page's timeline, shared by the page and by the tool that records its clips: each topic holds one picked
// generation long enough to read the sentence, then moves through others in a rhythm that changes from topic to topic.
// Seconds per picked generation; REST is the pause after the last, before the next topic.
import { hash } from '../../v4/src/art.js';
import { TOPICS } from './personal-copy.js';

export const RHYTHMS = [
  [5.5, 0.6, 0.6, 0.65, 1.8, 1.1, 0.85, 0.7, 0.6, 2.2],          // burst, pause, run that speeds up
  [4.5, 1.5, 0.6, 0.6, 0.7, 0.85, 1.1, 1.4, 2.2],                // a step, then a run that slows down
  [5.0, 0.6, 0.6, 1.7, 0.6, 0.6, 1.5, 0.8, 0.7, 0.6, 0.6, 2.2],  // two short bursts, then a rush
];
export const REST = 1.5;
export const PLAN = TOPICS.map((tp, ti) => { const s = []; let tt = 0; for (const d of RHYTHMS[ti % RHYTHMS.length]) { s.push({ t0: tt, t1: tt + d, d }); tt += d; } return { s, T: tt + REST }; });
export const START = []; export let TOTAL = 0; for (const pl of PLAN) { START.push(TOTAL); TOTAL += pl.T; }
export const gFor = (ti, i) => { const top = Math.min(11000, TOPICS[ti].span / 27 - 120); return Math.round(150 + hash(ti * 97.1 + i * 13.7 + 1) * (top - 150)); };
// a pick's stretch of the topic's ancestors' clip: from its start to the next pick (the last runs on through the rest)
export const pickSpan = (ti, i) => { const s = PLAN[ti].s[i], last = i === PLAN[ti].s.length - 1; return [s.t0, last ? PLAN[ti].T : s.t1]; };
