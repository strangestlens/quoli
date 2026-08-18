#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Build the served word list from every source, merged.
 *
 * ENABLE is thorough but was compiled in the 1990s: no email, no blog, no
 * emoji. SCOWL is newer and has those, but is smaller and misses words ENABLE
 * knows — including `nan`, which turned up in a real game here. Neither is a
 * superset of the other, so both go in.
 *
 * Merging costs nothing. The browser is never sent a dictionary; it asks
 * /api/words for the few hundred words its own twelve letters can form. The
 * source list could be ten times this size and the payload would not move.
 *
 * Filtering is what makes that cheap: Quoli's dice carry no Q, and only twelve
 * tiles exist, so no word outside 2-12 letters can ever be played. The two
 * letter floor is there because the three-letter rule can be switched off.
 */

const MIN = 2;
const MAX = 12;

const read = (path) =>
  readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith('#'));

const playable = (word) =>
  /^[a-z]+$/.test(word) && !word.includes('q') && word.length >= MIN && word.length <= MAX;

/**
 * SCOWL ships as cumulative tiers: each file holds only what that level adds.
 * 70 is the usual spell-checker ceiling — beyond it the lists get obscure
 * enough to start looking like typos to a player.
 */
const SCOWL_TIERS = [10, 20, 35, 40, 50, 55, 60, 70];

function scowl() {
  const words = new Set();
  for (const tier of SCOWL_TIERS) {
    const path = `node_modules/wordlist-english/english-words-${tier}.json`;
    for (const word of JSON.parse(readFileSync(path, 'utf8'))) {
      words.add(word.toLowerCase());
    }
  }
  return [...words];
}

const sources = {
  enable: read('data/enable.txt'),
  scowl: scowl(),
  allowlist: read('data/allowlist.txt'),
};

const kept = new Set();
const contributed = {};
for (const [name, list] of Object.entries(sources)) {
  const before = kept.size;
  for (const word of list) if (playable(word)) kept.add(word);
  contributed[name] = kept.size - before;
}

const unplayable = sources.allowlist.filter((w) => !playable(w));
const words = [...kept].sort();

writeFileSync('public/words.txt', words.join('\n') + '\n');

for (const [name, list] of Object.entries(sources)) {
  console.log(`  ${name.padEnd(10)} ${list.length.toLocaleString().padStart(8)} words, ${contributed[name].toLocaleString()} new`);
}
if (unplayable.length) console.log(`  ignored (unplayable): ${unplayable.join(', ')}`);
console.log(`  written: ${words.length.toLocaleString()} -> public/words.txt`);
