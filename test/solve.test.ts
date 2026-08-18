import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, placedCount, tileAt } from '../src/game/board.ts';
import { setCode } from '../src/game/scan.ts';
import { decodeSolve, encodeSolve, type Solve } from '../src/game/solve.ts';
import { boardOf } from './fixtures.ts';

/** The physical board from IMG_8466: APPLY across, NAN down, CYCLER down. */
const GRID = ['N...C', 'APPLY', 'N...C', '....L', '....E', '....R'];

function fromRows(rows: string[]): { board: ReturnType<typeof boardOf>; letters: string[] } {
  const entries: [number, number, number][] = [];
  const letters: string[] = [];
  rows.forEach((row, r) =>
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      entries.push([letters.length, c, r]);
      letters.push(ch);
    }),
  );
  return { board: boardOf(...entries), letters };
}

const render = (solve: Solve) => {
  const rows: string[] = [];
  for (let r = 0; r < 6; r++) {
    let line = '';
    for (let c = 0; c < 5; c++) {
      const id = tileAt(solve.board, c, r);
      line += id === undefined ? '.' : solve.letters[id];
    }
    rows.push(line);
  }
  return rows;
};

const { board: BOARD, letters: LETTERS } = fromRows(GRID);
const ORIGIN = { puzzleNumber: 230, rollIndex: 3 };

const decode = (code: string): Solve => {
  const solve = decodeSolve(code);
  if (!solve) throw new Error('expected a valid solve');
  return solve;
};

describe('the code itself', () => {
  it('gives nothing away by eye', () => {
    const code = encodeSolve(BOARD, LETTERS, ORIGIN);
    expect(code).not.toContain('APPLY');
    // No run of letters from the grid survives in order.
    expect(code.toUpperCase()).not.toMatch(/APP|NAN|CYCL/);
  });

  it('is short and fixed-length whatever the grid looks like', () => {
    const sprawling = fromRows(['A.B.C', '.....', 'D.E.F', '.....', 'G.H.I', 'J.K.L']);
    const compact = fromRows(['ABCD', 'EFGH', 'IJKL']);
    const lengths = [
      encodeSolve(BOARD, LETTERS, ORIGIN),
      encodeSolve(sprawling.board, sprawling.letters, null),
      encodeSolve(compact.board, compact.letters, null),
    ].map((c) => c.length);

    expect(new Set(lengths).size).toBe(1);
    expect(lengths[0]).toBe(31);
  });

  it('is URL-safe', () => {
    expect(encodeSolve(BOARD, LETTERS, ORIGIN)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is empty for an empty board', () => {
    expect(encodeSolve(EMPTY_BOARD, [], null)).toBe('');
  });
});

describe('round trip', () => {
  it('puts every letter back where it was', () => {
    expect(render(decode(encodeSolve(BOARD, LETTERS, ORIGIN)))).toEqual(GRID);
  });

  it('keeps all twelve tiles', () => {
    expect(placedCount(decode(encodeSolve(BOARD, LETTERS, ORIGIN)).board)).toBe(12);
  });

  it('carries the daily it came from', () => {
    expect(decode(encodeSolve(BOARD, LETTERS, ORIGIN)).origin).toEqual(ORIGIN);
  });

  it('reports no origin for a custom set', () => {
    expect(decode(encodeSolve(BOARD, LETTERS, null)).origin).toBeNull();
  });

  it('survives a first-roll origin, where the roll index is zero', () => {
    const origin = { puzzleNumber: 1, rollIndex: 0 };
    expect(decode(encodeSolve(BOARD, LETTERS, origin)).origin).toEqual(origin);
  });

  it('handles the largest puzzle number and roll the format allows', () => {
    const origin = { puzzleNumber: 16383, rollIndex: 1023 };
    expect(decode(encodeSolve(BOARD, LETTERS, origin)).origin).toEqual(origin);
  });

  it('yields the same set code the scanner would', () => {
    expect(setCode(decode(encodeSolve(BOARD, LETTERS, ORIGIN)).letters)).toBe('ACCELLNNPPRY');
  });

  it('normalises a board that sat away from the origin', () => {
    const offset = fromRows(GRID);
    const shifted = boardOf(
      ...[...offset.board].map(([id, { c, r }]) => [id, c + 6, r + 4] as [number, number, number]),
    );
    expect(render(decode(encodeSolve(shifted, offset.letters, null)))).toEqual(GRID);
  });
});

describe('rejections', () => {
  const bad = (code: string) => expect(decodeSolve(code)).toBeNull();

  it('rejects junk', () => {
    bad('');
    bad('hello');
    bad('!!!!not base64!!!!');
  });

  it('rejects a code of the wrong length', () => {
    const code = encodeSolve(BOARD, LETTERS, ORIGIN);
    bad(code.slice(0, -4));
    bad(code + 'AAAA');
  });

  it('rejects an unknown format version', () => {
    const code = encodeSolve(BOARD, LETTERS, ORIGIN);
    // The version lives in the top four bits, so mangling the first character
    // is enough to make it a format we don't know how to read.
    const wrong = code.startsWith('E') ? `Z${code.slice(1)}` : `E${code.slice(1)}`;
    bad(wrong);
  });

  it('rejects a code that decodes to overlapping tiles', () => {
    // Twelve tiles all claiming (0,0): every field zero after the header.
    const zeros = new Uint8Array(23);
    zeros[0] = 0b0001_0000; // version 1, puzzle 0
    const b64 = btoa(String.fromCharCode(...zeros))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    bad(b64);
  });
});
