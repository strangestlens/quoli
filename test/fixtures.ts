import { EMPTY_BOARD, place, type Board } from '../src/game/board.ts';

export const boardOf = (...entries: [number, number, number][]): Board =>
  entries.reduce<Board>((b, [tileId, c, r]) => place(b, tileId, { c, r }), EMPTY_BOARD);

/**
 * A hand-built ten-tile grid used across the word, rule and share tests.
 *
 *   C
 *  TRAIN
 *   A  O
 *   M  D
 */
export const LETTERS = ['C', 'T', 'R', 'A', 'I', 'N', 'A', 'M', 'O', 'D'];

export const SAMPLE = boardOf(
  [0, 1, 0],
  [1, 0, 1],
  [2, 1, 1],
  [3, 2, 1],
  [4, 3, 1],
  [5, 4, 1],
  [6, 1, 2],
  [7, 1, 3],
  [8, 4, 2],
  [9, 4, 3],
);
