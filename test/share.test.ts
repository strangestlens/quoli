import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place } from '../src/game/board.ts';
import { asciiShare, letterShare, shapeShare, type ShareMeta } from '../src/game/share.ts';
import { LETTERS, SAMPLE } from './fixtures.ts';

const META: ShareMeta = { puzzleNumber: 228, rollIndex: 1, wordCount: 3, tileCount: 10 };

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
      ].join('\n'),
    );
  });

  it('contains no letters at all', () => {
    expect(shapeShare(SAMPLE, META)).not.toMatch(/[A-Z]RAIN/);
  });

  it('displays the roll one-based', () => {
    expect(shapeShare(SAMPLE, { ...META, rollIndex: 0 })).toContain('roll 1');
  });

  it('says "word" for a single word', () => {
    expect(shapeShare(SAMPLE, { ...META, wordCount: 1 })).toContain('1 word\n');
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
      ].join('\n'),
    );
  });

  it('uses only fullwidth forms and the ideographic space in the grid', () => {
    const grid = letterShare(SAMPLE, LETTERS, META).split('\n').slice(2);
    for (const line of grid) {
      expect(line).toMatch(/^[Ａ-Ｚ　]+$/);
    }
  });

  it('keeps every row the same length', () => {
    const grid = letterShare(SAMPLE, LETTERS, META).split('\n').slice(2);
    expect(new Set(grid.map((l) => [...l].length)).size).toBe(1);
  });
});

describe('asciiShare', () => {
  it('is the plain-text escape hatch', () => {
    expect(asciiShare(SAMPLE, LETTERS, META)).toBe(
      ['Quoli #228 · roll 2', '', '.C...', 'TRAIN', '.A..O', '.M..D'].join('\n'),
    );
  });
});

describe('empty board', () => {
  it('produces a header with no grid rather than throwing', () => {
    const meta = { ...META, wordCount: 0, tileCount: 0 };
    expect(shapeShare(EMPTY_BOARD, meta)).toBe('Quoli #228 · roll 2\n0 letters · 0 words\n');
  });
});

describe('bounding box', () => {
  it('is tight — no leading or trailing blank rows and columns', () => {
    const board = place(place(EMPTY_BOARD, 0, { c: 5, r: 5 }), 1, { c: 6, r: 5 });
    const grid = shapeShare(board, META).split('\n').slice(3);
    expect(grid).toEqual(['🟩🟩']);
  });
});
