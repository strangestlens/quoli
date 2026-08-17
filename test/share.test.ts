import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place } from '../src/game/board.ts';
import {
  asciiShare,
  letterShare,
  shapeShare,
  SHARE_URL,
  type ShareMeta,
} from '../src/game/share.ts';
import { LETTERS, SAMPLE } from './fixtures.ts';

const META: ShareMeta = {
  subject: { kind: 'daily', puzzleNumber: 228, rollIndex: 1 },
  wordCount: 3,
  tileCount: 10,
};

const CUSTOM: ShareMeta = {
  subject: { kind: 'custom', code: 'ACCELLNNPPRY' },
  wordCount: 3,
  tileCount: 10,
};

describe('shapeShare', () => {
  it('gives away the shape and nothing else', () => {
    expect(shapeShare(SAMPLE, META)).toBe(
      [
        'Quoli #228 · roll 2',
        '10 letters · 3 words',
        '',
        '⬜🟩⬜⬜⬜',
        '🟩🟩🟩🟩🟩',
        '⬜🟩⬜⬜🟩',
        '⬜🟩⬜⬜🟩',
        '',
        SHARE_URL,
      ].join('\n'),
    );
  });

  it('contains no letters at all', () => {
    expect(shapeShare(SAMPLE, META)).not.toMatch(/[A-Z]RAIN/);
  });

  it('displays the roll one-based', () => {
    expect(
      shapeShare(SAMPLE, { ...META, subject: { kind: 'daily', puzzleNumber: 228, rollIndex: 0 } }),
    ).toContain('roll 1');
  });

  it('says "word" for a single word', () => {
    expect(shapeShare(SAMPLE, { ...META, wordCount: 1 })).toContain('1 word\n');
  });
});

describe('custom sets', () => {
  it('titles the share as a custom set rather than a puzzle number', () => {
    expect(shapeShare(SAMPLE, CUSTOM)).toContain('Quoli · custom set');
    expect(shapeShare(SAMPLE, CUSTOM)).not.toContain('#');
  });

  it('puts the dice in the link so the recipient plays the same twelve', () => {
    expect(shapeShare(SAMPLE, CUSTOM)).toContain(`${SHARE_URL}/?set=ACCELLNNPPRY`);
  });

  it('still gives nothing away in the default share', () => {
    const text = shapeShare(SAMPLE, CUSTOM);
    expect(text).not.toContain('TRAIN');
    expect(text).toContain('🟩');
  });

  it('links the bare site for the daily, with no code', () => {
    expect(shapeShare(SAMPLE, META)).toContain(SHARE_URL);
    expect(shapeShare(SAMPLE, META)).not.toContain('?set=');
  });

  it('carries the code on every format', () => {
    for (const text of [
      shapeShare(SAMPLE, CUSTOM),
      letterShare(SAMPLE, LETTERS, CUSTOM),
      asciiShare(SAMPLE, LETTERS, CUSTOM),
    ]) {
      expect(text).toContain('?set=ACCELLNNPPRY');
    }
  });
});

describe('letterShare', () => {
  it('renders fullwidth letters over ideographic blanks so columns align', () => {
    expect(letterShare(SAMPLE, LETTERS, META)).toBe(
      [
        'Quoli #228 · roll 2',
        '',
        '　Ｃ　　　',
        'ＴＲＡＩＮ',
        '　Ａ　　Ｏ',
        '　Ｍ　　Ｄ',
        '',
        SHARE_URL,
      ].join('\n'),
    );
  });

  it('uses only fullwidth forms and the ideographic space in the grid', () => {
    const grid = letterShare(SAMPLE, LETTERS, META).split('\n').slice(2, 6);
    for (const line of grid) {
      expect(line).toMatch(/^[Ａ-Ｚ　]+$/);
    }
  });

  it('keeps every row the same length', () => {
    const grid = letterShare(SAMPLE, LETTERS, META).split('\n').slice(2, 6);
    expect(new Set(grid.map((l) => [...l].length)).size).toBe(1);
  });
});

describe('asciiShare', () => {
  it('is the plain-text escape hatch', () => {
    expect(asciiShare(SAMPLE, LETTERS, META)).toBe(
      ['Quoli #228 · roll 2', '', '.C...', 'TRAIN', '.A..O', '.M..D', '', SHARE_URL].join('\n'),
    );
  });
});

describe('empty board', () => {
  it('produces a header with no grid rather than throwing', () => {
    const meta = { ...META, wordCount: 0, tileCount: 0 };
    expect(shapeShare(EMPTY_BOARD, meta)).toContain('0 letters · 0 words');
    expect(shapeShare(EMPTY_BOARD, meta)).not.toContain('🟩');
  });
});

describe('bounding box', () => {
  it('is tight — no leading or trailing blank rows and columns', () => {
    const board = place(place(EMPTY_BOARD, 0, { c: 5, r: 5 }), 1, { c: 6, r: 5 });
    const grid = shapeShare(board, META).split('\n').slice(3, 4);
    expect(grid).toEqual(['🟩🟩']);
  });
});
