import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place, type Board } from '../src/game/board.ts';
import { extractWords, orphanTiles } from '../src/game/words.ts';
import { boardOf, LETTERS, SAMPLE } from './fixtures.ts';

const textsOf = (board: Board, letters: readonly string[]) =>
  extractWords(board, letters)
    .map((w) => `${w.dir}:${w.text}`)
    .sort();

describe('extractWords', () => {
  it('finds every across and down run', () => {
    expect(textsOf(SAMPLE, LETTERS)).toEqual(['across:TRAIN', 'down:CRAM', 'down:NOD']);
  });

  it('ignores lone tiles', () => {
    const board = place(EMPTY_BOARD, 0, { c: 0, r: 0 });
    expect(extractWords(board, LETTERS)).toEqual([]);
  });

  it('counts a two-letter run as a word — length rules live in rules.ts', () => {
    const board = place(place(EMPTY_BOARD, 0, { c: 0, r: 0 }), 1, { c: 1, r: 0 });
    expect(textsOf(board, LETTERS)).toEqual(['across:CT']);
  });

  it('reads a run once, from its first cell', () => {
    const board = boardOf([0, 0, 0], [1, 1, 0], [2, 2, 0]);
    expect(extractWords(board, LETTERS)).toHaveLength(1);
  });

  it('records cells in reading order', () => {
    const across = extractWords(SAMPLE, LETTERS).find((w) => w.text === 'TRAIN')!;
    expect(across.cells.map((c) => c.c)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('orphanTiles', () => {
  it('is empty when every tile is in a word', () => {
    expect(orphanTiles(SAMPLE, extractWords(SAMPLE, LETTERS))).toEqual([]);
  });

  it('catches a stray letter', () => {
    const board = place(SAMPLE, 10, { c: 20, r: 20 });
    expect(orphanTiles(board, extractWords(board, LETTERS))).toEqual([10]);
  });
});
