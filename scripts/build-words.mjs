#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Build the served word list from the source lexicon plus our allowlist.
 *
 * Filtering is what makes this cheap: Quoli's dice carry no Q, and only twelve
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

const source = read('data/enable.txt');
const allow = read('data/allowlist.txt');

const kept = new Set(source.filter(playable));
const added = allow.filter((w) => playable(w) && !kept.has(w));
for (const word of added) kept.add(word);

const rejected = allow.filter((w) => !playable(w));
const words = [...kept].sort();

writeFileSync('public/words.txt', words.join('\n') + '\n');

console.log(`source ${source.length.toLocaleString()} words`);
console.log(`  kept from source: ${(kept.size - added.length).toLocaleString()}`);
console.log(`  added from allowlist: ${added.length}`);
if (rejected.length) console.log(`  ignored (unplayable): ${rejected.join(', ')}`);
console.log(`  written: ${words.length.toLocaleString()} words -> public/words.txt`);
