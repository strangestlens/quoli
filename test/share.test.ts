import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place } from '../src/game/board.ts';
import {
  letterGrid,
  letterShare,
  shapeGrid,
  shapeShare,
  SHARE_URL,
  type ShareMeta,
} from '../src/game/share.ts';
import { LETTERS, SAMPLE } from './fixtures.ts';

/** Solved on the second roll, so the link has to carry the roll. */
const META: ShareMeta = {
  subject: { kind: 'daily', puzzleNumber: 228, rollIndex: 1 },
  wordCount: 3,
  tileCount: 10,
};

const FIRST_ROLL: ShareMeta = {
  ...META,
  subject: { kind: 'daily', puzzleNumber: 228, rollIndex: 0 },
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
        `${SHARE_URL}/?roll=2`,
      ].join('\n'),
    );
  });

  it('contains no letters at all', () => {
    expect(shapeShare(SAMPLE, META)).not.toMatch(/[A-Z]RAIN/);
  });

  it('displays the roll one-based', () => {
    expect(shapeShare(SAMPLE, FIRST_ROLL)).toContain('roll 1');
  });

  it('says "word" for a single word', () => {
    expect(shapeShare(SAMPLE, { ...META, wordCount: 1 })).toContain('1 word\n');
  });
});

describe('daily links', () => {
  it('carries the roll so a friend lands on the one that was solved', () => {
    expect(shapeShare(SAMPLE, META)).toContain(`${SHARE_URL}/?roll=2`);
  });

  it('stays bare on roll 1, where the date alone is enough', () => {
    expect(shapeShare(SAMPLE, FIRST_ROLL)).toContain(SHARE_URL);
    expect(shapeShare(SAMPLE, FIRST_ROLL)).not.toContain('?roll=');
  });

  it('never carries a roll for a custom set', () => {
    expect(shapeShare(SAMPLE, CUSTOM)).not.toContain('?roll=');
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

  it('carries the code on both formats', () => {
    for (const text of [shapeShare(SAMPLE, CUSTOM), letterShare(SAMPLE, LETTERS, CUSTOM)]) {
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
        `${SHARE_URL}/?roll=2`,
      ].join('\n'),
    );
  });

  it('uses only fullwidth forms and the ideographic space in the grid', () => {
    for (const line of letterGrid(SAMPLE, LETTERS)) {
      expect(line).toMatch(/^[Ａ-Ｚ　]+$/);
    }
  });

  it('keeps every row the same length', () => {
    const grid = letterGrid(SAMPLE, LETTERS);
    expect(new Set(grid.map((l) => [...l].length)).size).toBe(1);
  });
});

describe('grids on their own', () => {
  // The share sheet previews these directly rather than parsing them back out
  // of the finished text, which used to drag the footer link into the preview.
  it('are exactly the rows the share embeds, with no header or link', () => {
    expect(shapeGrid(SAMPLE)).toEqual(['⬜🟩⬜⬜⬜', '🟩🟩🟩🟩🟩', '⬜🟩⬜⬜🟩', '⬜🟩⬜⬜🟩']);
    expect(letterGrid(SAMPLE, LETTERS)).toEqual(['　Ｃ　　　', 'ＴＲＡＩＮ', '　Ａ　　Ｏ', '　Ｍ　　Ｄ']);
  });

  it('contain no link', () => {
    for (const line of [...shapeGrid(SAMPLE), ...letterGrid(SAMPLE, LETTERS)]) {
      expect(line).not.toContain('http');
    }
  });

  it('are empty for an empty board', () => {
    expect(shapeGrid(EMPTY_BOARD)).toEqual([]);
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
    expect(shapeGrid(board)).toEqual(['🟩🟩']);
  });
});
