import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, placedCount, tileAt } from '../src/game/board.ts';
import { decodeSolve, encodeSolve } from '../src/game/solve.ts';
import { setCode } from '../src/game/scan.ts';
import { boardOf } from './fixtures.ts';

/** The physical board from IMG_8466: APPLY across, NAN down, CYCLER down. */
const REAL = 'N...C-APPLY-N...C-....L-....E-....R';

const build = (code: string) => {
  const solve = decodeSolve(code);
  if (!solve) throw new Error('expected a valid solve');
  return solve;
};

describe('encodeSolve', () => {
  it('writes rows of letters with gaps, joined by dashes', () => {
    const { board, letters } = build(REAL);
    expect(encodeSolve(board, letters)).toBe(REAL);
  });

  it('is tight to the board — no leading or trailing blank rows', () => {
    const board = boardOf([0, 7, 5], [1, 8, 5], [2, 9, 5]);
    expect(encodeSolve(board, ['A', 'B', 'C'])).toBe('ABC');
  });

  it('is empty for an empty board', () => {
    expect(encodeSolve(EMPTY_BOARD, [])).toBe('');
  });
});

describe('decodeSolve', () => {
  it('round-trips the real board', () => {
    const { board, letters } = build(REAL);
    expect(placedCount(board)).toBe(12);
    expect(encodeSolve(board, letters)).toBe(REAL);
  });

  it('puts every letter back where it was', () => {
    const { board, letters } = build(REAL);
    const at = (c: number, r: number) => {
      const id = tileAt(board, c, r);
      return id === undefined ? '.' : letters[id];
    };
    expect([at(0, 0), at(4, 0)]).toEqual(['N', 'C']);
    expect([at(0, 1), at(1, 1), at(2, 1), at(3, 1), at(4, 1)]).toEqual([...'APPLY']);
    expect(at(4, 5)).toBe('R');
    expect(at(1, 0)).toBe('.');
  });

  it('yields the same set code the scanner would', () => {
    expect(setCode(build(REAL).letters)).toBe('ACCELLNNPPRY');
  });

  it('is case-insensitive and tolerates pasted whitespace', () => {
    expect(decodeSolve(`  ${REAL.toLowerCase()} \n`)).not.toBeNull();
  });
});

describe('decodeSolve — rejections', () => {
  const bad = (code: string) => expect(decodeSolve(code)).toBeNull();

  it('rejects the wrong number of tiles', () => {
    bad('ABC');
    bad('ABCDEFGHIJKLM');
  });

  it('rejects a Q', () => {
    bad('N...C-APPLQ-N...C-....L-....E-....R');
  });

  it('rejects ragged rows', () => {
    bad('N...C-APPLY-N..C-....L-....E-....R');
  });

  it('rejects junk characters', () => {
    bad('N.!.C-APPLY-N...C-....L-....E-....R');
  });

  it('rejects a grid padded with empty edges', () => {
    // A real grid is always tight to its own bounds; padding means a mangled
    // or hand-made link. Note this is about blank edges, not about the shape:
    // an odd-but-tight board is somebody's business, not the decoder's.
    bad('.....-N...C-APPLY-N...C-....L-....E-....R'); // blank row on top
    bad('N...C-APPLY-N...C-....L-....E-....R-.....'); // blank row underneath
    bad('N...C.-APPLY.-N...C.-....L.-....E.-....R.'); // blank column to the right
    bad('.N...C-.APPLY-.N...C-.....L-.....E-.....R'); // blank column to the left
  });

  it('rejects an absurdly large grid rather than rendering it', () => {
    bad(Array.from({ length: 40 }, () => '.'.repeat(40)).join('-'));
  });

  it('rejects empty input', () => {
    bad('');
    bad('---');
  });
});
