import { bounds, EMPTY_BOARD, place, tileAt, type Board } from './board.ts';
import { DIE_COUNT } from './dice.ts';

/**
 * Encoding a finished grid into a link.
 *
 * Deliberately legible rather than packed: rows of letters with `.` for gaps,
 * joined by `-`. A typical grid lands around 35 characters, which is no worse
 * than base64 would be, and a malformed link can be diagnosed by reading it.
 *
 * `?solve=` is kept separate from `?set=` so a plain set link can never leak
 * an answer — the two carry different things on purpose.
 */

const EMPTY_CELL = '.';
const ROW_SEPARATOR = '-';
const LETTER = /^[A-Z]$/;

/** Twelve tiles cannot span more than twelve cells either way. */
const MAX_SPAN = DIE_COUNT;

export interface Solve {
  /** Letters indexed by tile, in reading order. */
  readonly letters: readonly string[];
  readonly board: Board;
}

export function encodeSolve(board: Board, letters: readonly string[]): string {
  const b = bounds(board);
  if (!b) return '';

  const rows: string[] = [];
  for (let r = b.minR; r <= b.maxR; r++) {
    let row = '';
    for (let c = b.minC; c <= b.maxC; c++) {
      const tileId = tileAt(board, c, r);
      row += tileId === undefined ? EMPTY_CELL : (letters[tileId] ?? EMPTY_CELL);
    }
    rows.push(row);
  }
  return rows.join(ROW_SEPARATOR);
}

/**
 * Read a grid back, or null if it isn't one.
 *
 * Strict on purpose: a link that decodes to the wrong board would show
 * somebody else's answer as though it were the sender's.
 */
export function decodeSolve(code: string): Solve | null {
  const rows = code.trim().toUpperCase().split(ROW_SEPARATOR);
  if (rows.length === 0 || rows.length > MAX_SPAN) return null;

  const width = rows[0]!.length;
  if (width === 0 || width > MAX_SPAN) return null;
  if (rows.some((row) => row.length !== width)) return null;

  let board: Board = EMPTY_BOARD;
  const letters: string[] = [];

  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === EMPTY_CELL) return;
      board = place(board, letters.length, { c, r });
      letters.push(ch);
    });
  });

  if (letters.length !== DIE_COUNT) return null;
  if (letters.some((l) => !LETTER.test(l) || l === 'Q')) return null;

  // A grid that decodes with gaps at its edges came from a bad encoder or a
  // mangled link; a real one is always tight to its own bounding box.
  const b = bounds(board)!;
  if (b.minC !== 0 || b.minR !== 0 || b.maxC !== width - 1 || b.maxR !== rows.length - 1) {
    return null;
  }

  return { letters, board };
}
