import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place, type Board } from '../src/game/board.ts';
import { analyze, rulesFor, type Dictionary } from '../src/game/rules.ts';

/**
 * Against the real generated list, not a stub — this is the thing that decides
 * whether a finished grid counts, so a stub would prove very little.
 */
const WORDS = new Set(
  readFileSync('public/words.txt', 'utf8')
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean),
);

const dictionary: Dictionary = { has: (word) => WORDS.has(word) };
const STRICT = rulesFor({ mode: 'strict', allowTwoLetterWords: false });
const LOOSE = rulesFor({ mode: 'strict', allowTwoLetterWords: true });
const FREE = rulesFor({ mode: 'free', allowTwoLetterWords: false });

/** Build a board from an ASCII grid, `.` for gaps. */
function grid(rows: string[]): { board: Board; letters: string[] } {
  let board: Board = EMPTY_BOARD;
  const letters: string[] = [];
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      board = place(board, letters.length, { c, r });
      letters.push(ch);
    }),
  );
  return { board, letters };
}

const REAL = grid(['N...C', 'APPLY', 'N...C', '....L', '....E', '....R']);
const ROW = grid(['ACCELLNNPPRY']);

describe('the generated word list', () => {
  it('is filtered to what this game can actually play', () => {
    expect(WORDS.size).toBeGreaterThan(155_000);
    for (const word of WORDS) {
      expect(word).toMatch(/^[a-pr-z]+$/); // lowercase, and never a Q
      expect(word.length).toBeGreaterThanOrEqual(2);
      expect(word.length).toBeLessThanOrEqual(12);
    }
  });

  it('carries the modern words SCOWL brings and ENABLE lacks', () => {
    for (const word of ['email', 'blog', 'emoji', 'selfie', 'meme', 'online', 'podcast']) {
      expect(WORDS.has(word)).toBe(true);
    }
  });

  it('carries our own allowlist, which no source has', () => {
    for (const word of ['risc', 'app', 'wifi', 'zen']) {
      expect(WORDS.has(word)).toBe(true);
    }
  });

  it('keeps words ENABLE has that SCOWL does not', () => {
    // `nan` came up in a real game and is absent from SCOWL, which is why
    // both lists are merged rather than one replacing the other.
    expect(WORDS.has('nan')).toBe(true);
  });

  it('still knows ordinary words', () => {
    for (const word of ['apply', 'nan', 'cycler', 'bright', 'dice', 'toke', 'grunt']) {
      expect(WORDS.has(word)).toBe(true);
    }
  });

  it('does not know nonsense', () => {
    for (const word of ['accellnnppry', 'zzxk', 'blorptastic']) {
      expect(WORDS.has(word)).toBe(false);
    }
  });

  it('knows obscure words too, which cuts both ways', () => {
    // ENABLE misses `email` but contains `trop`. Worth pinning so nobody
    // "fixes" a rejection that is actually the list being older than it looks.
    expect(WORDS.has('trop')).toBe(true);
  });
});

describe('strict play', () => {
  it('accepts a genuine grid', () => {
    const result = analyze(REAL.board, REAL.letters, STRICT, dictionary);
    expect(result.violations).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('rejects twelve letters in a row that spell nothing', () => {
    const result = analyze(ROW.board, ROW.letters, STRICT, dictionary);
    expect(result.complete).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain('invalid-word');
  });

  it('names the word it objected to', () => {
    const result = analyze(ROW.board, ROW.letters, STRICT, dictionary);
    expect(result.violations[0]!.message).toContain('ACCELLNNPPRY');
  });

  it('rejects a grid where only one word is wrong', () => {
    // APPLY -> APPLZ, everything else untouched.
    const broken = grid(['N...C', 'APPLZ', 'N...C', '....L', '....E', '....R']);
    const codes = analyze(broken.board, broken.letters, STRICT, dictionary).violations.map(
      (v) => v.code,
    );
    expect(codes).toContain('invalid-word');
  });
});

describe('the two-letter house rule', () => {
  const withPair = grid(['CAT', 'A..', 'T..', 'S..']);

  it('rejects a two-letter run when the minimum is three', () => {
    const pair = grid(['AT.', '...', '...']);
    expect(analyze(pair.board, pair.letters, STRICT, dictionary).violations.map((v) => v.code)).toContain(
      'short-word',
    );
  });

  it('accepts a real two-letter word when the rule is relaxed', () => {
    const pair = grid(['AT']);
    const codes = analyze(pair.board, pair.letters, { ...LOOSE, requireAllTilesPlaced: false }, dictionary)
      .violations.map((v) => v.code);
    expect(codes).toEqual([]);
  });

  it('still rejects a two-letter non-word when relaxed', () => {
    const pair = grid(['XZ']);
    const codes = analyze(pair.board, pair.letters, { ...LOOSE, requireAllTilesPlaced: false }, dictionary)
      .violations.map((v) => v.code);
    expect(codes).toContain('invalid-word');
  });

  it('leaves longer words alone either way', () => {
    const rules = { ...LOOSE, requireAllTilesPlaced: false };
    expect(analyze(withPair.board, withPair.letters, rules, dictionary).violations).toEqual([]);
  });
});

describe('free play', () => {
  it('accepts the nonsense strict rejected', () => {
    const result = analyze(ROW.board, ROW.letters, FREE, dictionary);
    expect(result.violations).toEqual([]);
    expect(result.complete).toBe(true);
  });
});
