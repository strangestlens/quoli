import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place } from '../src/game/board.ts';
import {
  letterGrid,
  letterShare,
  setLine,
  setShare,
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

/** A full set, since the dice share is about all twelve rather than a board. */
const TWELVE = ['P', 'A', 'C', 'N', 'L', 'E', 'C', 'Y', 'L', 'N', 'P', 'R'];

describe('shapeShare', () => {
  it('gives away the shape and nothing else', () => {
    expect(shapeShare(SAMPLE, META)).toBe(
      [
        'Quoli #228 · set 2',
        '10 letters · 3 words',
        '',
        '⬜🟩⬜⬜⬜',
        '🟩🟩🟩🟩🟩',
        '⬜🟩⬜⬜🟩',
        '⬜🟩⬜⬜🟩',
        '',
        `${SHARE_URL}/?puzzle=228&roll=2`,
      ].join('\n'),
    );
  });

  it('contains no letters at all', () => {
    expect(shapeShare(SAMPLE, META)).not.toMatch(/[A-Z]RAIN/);
  });

  it('displays the set one-based', () => {
    expect(shapeShare(SAMPLE, FIRST_ROLL)).toContain('set 1');
  });

  it('says "word" for a single word', () => {
    expect(shapeShare(SAMPLE, { ...META, wordCount: 1 })).toContain('1 word\n');
  });
});

describe('setShare', () => {
  it('hands over the twelve dice and a link to them', () => {
    expect(setShare(TWELVE, CUSTOM)).toBe(
      [
        'Quoli · custom set',
        'Twelve dice, one grid.',
        '',
        'ＡＣＣＥＬＬＮＮＰＰＲＹ',
        '',
        `${SHARE_URL}/?set=ACCELLNNPPRY`,
      ].join('\n'),
    );
  });

  it('sorts the dice, so the row matches the set code rather than the tray', () => {
    expect(setLine(TWELVE)).toBe(setLine([...TWELVE].reverse()));
    expect(setLine(TWELVE)).toBe('ＡＣＣＥＬＬＮＮＰＰＲＹ');
  });

  it('uses only fullwidth forms', () => {
    expect(setLine(TWELVE)).toMatch(/^[Ａ-Ｚ]+$/);
  });

  it('shows no grid, finished or not', () => {
    const text = setShare(TWELVE, { ...META, solveCode: 'ABC' });
    expect(text).not.toContain('🟩');
    expect(text).not.toContain('　');
  });

  it('offers the dice rather than the solution, even from a finished board', () => {
    const text = setShare(TWELVE, { ...META, solveCode: 'ABC' });
    expect(text).not.toContain('?solve=');
    expect(text).toContain(`${SHARE_URL}/?puzzle=228&roll=2`);
  });
});

describe('daily links', () => {
  // The message names the puzzle and, for a set share, lists its letters. A
  // bare link would hand over a different twelve to anyone opening it after
  // midnight, so every daily link names the puzzle outright.
  it('names the puzzle and the roll', () => {
    expect(shapeShare(SAMPLE, META)).toContain(`${SHARE_URL}/?puzzle=228&roll=2`);
  });

  it('drops the roll on the first set, where the puzzle number is enough', () => {
    expect(shapeShare(SAMPLE, FIRST_ROLL)).toContain(`${SHARE_URL}/?puzzle=228`);
    expect(shapeShare(SAMPLE, FIRST_ROLL)).not.toContain('roll=');
  });

  it('never carries a roll for a custom set', () => {
    expect(shapeShare(SAMPLE, CUSTOM)).not.toContain('roll=');
    expect(setShare(TWELVE, CUSTOM)).not.toContain('roll=');
  });
});

describe('solve links', () => {
  const SOLVED: ShareMeta = { ...META, solveCode: 'N...C-APPLY-N...C-....L-....E-....R' };

  it('points a finished board at itself, so the shape can be revealed', () => {
    expect(shapeShare(SAMPLE, SOLVED)).toContain(
      `${SHARE_URL}/?solve=N...C-APPLY-N...C-....L-....E-....R`,
    );
  });

  it('still gives nothing away in the message itself', () => {
    const text = shapeShare(SAMPLE, SOLVED);
    // The grid rows above the link are silhouette only.
    expect(text.split('\n').slice(2, 6).join('')).not.toMatch(/[A-Z]/);
  });

  it('replaces the puzzle link rather than sitting alongside it', () => {
    expect(shapeShare(SAMPLE, SOLVED)).not.toContain('?puzzle=');
  });

  it('replaces a custom set link too', () => {
    const solvedCustom = { ...CUSTOM, solveCode: 'AB-CD' };
    expect(shapeShare(SAMPLE, solvedCustom)).not.toContain('?set=');
    expect(shapeShare(SAMPLE, solvedCustom)).toContain('?solve=AB-CD');
  });

  it('falls back to the set link while a board is unfinished', () => {
    expect(shapeShare(SAMPLE, { ...META, solveCode: undefined })).toContain(
      '?puzzle=228&roll=2',
    );
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

  it('carries the code on every format', () => {
    for (const text of [
      shapeShare(SAMPLE, CUSTOM),
      letterShare(SAMPLE, LETTERS, CUSTOM),
      setShare(TWELVE, CUSTOM),
    ]) {
      expect(text).toContain('?set=ACCELLNNPPRY');
    }
  });
});

describe('letterShare', () => {
  it('renders fullwidth letters over ideographic blanks so columns align', () => {
    expect(letterShare(SAMPLE, LETTERS, META)).toBe(
      [
        'Quoli #228 · set 2',
        '',
        '　Ｃ　　　',
        'ＴＲＡＩＮ',
        '　Ａ　　Ｏ',
        '　Ｍ　　Ｄ',
        '',
        `${SHARE_URL}/?puzzle=228&roll=2`,
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
    expect(setLine(TWELVE)).toBe('ＡＣＣＥＬＬＮＮＰＰＲＹ');
  });

  it('contain no link', () => {
    for (const line of [...shapeGrid(SAMPLE), ...letterGrid(SAMPLE, LETTERS), setLine(TWELVE)]) {
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

  // Nothing is placed, but the dice are the dice — this is the share that has
  // to work before a single tile goes down.
  it('still shares the set in full', () => {
    expect(setShare(TWELVE, { ...META, wordCount: 0, tileCount: 0 })).toContain(
      'ＡＣＣＥＬＬＮＮＰＰＲＹ',
    );
  });
});

describe('bounding box', () => {
  it('is tight — no leading or trailing blank rows and columns', () => {
    const board = place(place(EMPTY_BOARD, 0, { c: 5, r: 5 }), 1, { c: 6, r: 5 });
    expect(shapeGrid(board)).toEqual(['🟩🟩']);
  });
});
