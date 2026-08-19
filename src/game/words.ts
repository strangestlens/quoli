import type { TileId } from './dice.ts';
import { tileAt, type Board, type Coord } from './board.ts';

export type Direction = 'across' | 'down';

export interface Word {
  readonly text: string;
  readonly dir: Direction;
  readonly cells: readonly Coord[];
  readonly tileIds: readonly TileId[];
}

/**
 * Every contiguous run of two or more tiles, across and down.
 *
 * Runs, not verdicts: two or more so a bare pair is visible to the checker
 * even when the minimum is three. Every rule check works off these, and the
 * share text counts them.
 */
export function extractWords(board: Board, letters: readonly string[]): Word[] {
  const out: Word[] = [];

  for (const [tileId, coord] of board) {
    collectRun(board, letters, tileId, coord, 'across', out);
    collectRun(board, letters, tileId, coord, 'down', out);
  }

  return out;
}

function collectRun(
  board: Board,
  letters: readonly string[],
  tileId: TileId,
  coord: Coord,
  dir: Direction,
  out: Word[],
): void {
  const dc = dir === 'across' ? 1 : 0;
  const dr = dir === 'across' ? 0 : 1;

  // Only start a run from its first cell.
  if (tileAt(board, coord.c - dc, coord.r - dr) !== undefined) return;
  // A lone tile is not a run.
  if (tileAt(board, coord.c + dc, coord.r + dr) === undefined) return;

  const cells: Coord[] = [];
  const tileIds: TileId[] = [tileId];
  let text = letters[tileId] ?? '';
  cells.push(coord);

  let c = coord.c + dc;
  let r = coord.r + dr;
  for (;;) {
    const next = tileAt(board, c, r);
    if (next === undefined) break;
    cells.push({ c, r });
    tileIds.push(next);
    text += letters[next] ?? '';
    c += dc;
    r += dr;
  }

  out.push({ text, dir, cells, tileIds });
}

/** Tiles that belong to no run at all — a stray letter sitting on its own. */
export function orphanTiles(board: Board, words: readonly Word[]): TileId[] {
  const inWord = new Set<TileId>();
  for (const w of words) {
    for (const t of w.tileIds) inWord.add(t);
  }
  return [...board.keys()].filter((t) => !inWord.has(t));
}
