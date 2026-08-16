/**
 * Seeded PRNG. Deliberately boring and deliberately frozen.
 *
 * Every player must get identical letters for a given (day, roll), forever —
 * shares, streaks and any future leaderboard all rest on that. So this file is
 * append-only in spirit: fix bugs by bumping SEED_VERSION in roll.ts, never by
 * editing these functions in place.
 */

/** xmur3 string hash — turns a seed string into a 32-bit state generator. */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — 32-bit PRNG, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convenience: seed string straight to a float stream. */
export function seededRandom(seedString: string): () => number {
  return mulberry32(xmur3(seedString)());
}
