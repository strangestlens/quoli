import { DIE_COUNT, type TileId } from './dice.ts';

export interface Coord {
  readonly c: number;
  readonly r: number;
}

/**
 * The board is just "where each placed tile is". Tiles absent from the map are
 * in the tray.
 *
 * There is no grid size and no bounds checking: twelve tiles can span at most
 * twelve cells in either axis, so an unbounded integer plane can never be
 * overrun. Keeping a single forward index (rather than also caching cell ->
 * tile) means the two can never disagree; `tileAt` scans twelve entries.
 */
export type Board = ReadonlyMap<TileId, Coord>;

export const EMPTY_BOARD: Board = new Map();

export interface Bounds {
  readonly minC: number;
  readonly minR: number;
  readonly maxC: number;
  readonly maxR: number;
}

export function coordOf(board: Board, tileId: TileId): Coord | undefined {
  return board.get(tileId);
}

export function tileAt(board: Board, c: number, r: number): TileId | undefined {
  for (const [tileId, coord] of board) {
    if (coord.c === c && coord.r === r) return tileId;
  }
  return undefined;
}

export function isPlaced(board: Board, tileId: TileId): boolean {
  return board.has(tileId);
}

export function placedCount(board: Board): number {
  return board.size;
}

export function trayTiles(board: Board): TileId[] {
  const out: TileId[] = [];
  for (let i = 0; i < DIE_COUNT; i++) {
    if (!board.has(i)) out.push(i);
  }
  return out;
}

/**
 * Put `tileId` on `at`. If another tile is already there they swap: the
 * occupant takes the mover's old cell, or goes back to the tray if the mover
 * came from the tray.
 */
export function place(board: Board, tileId: TileId, at: Coord): Board {
  const next = new Map(board);
  const from = board.get(tileId);
  const occupant = tileAt(board, at.c, at.r);

  next.set(tileId, at);

  if (occupant !== undefined && occupant !== tileId) {
    if (from) next.set(occupant, from);
    else next.delete(occupant);
  }

  return next;
}

/** Send a tile back to the tray. */
export function unplace(board: Board, tileId: TileId): Board {
  if (!board.has(tileId)) return board;
  const next = new Map(board);
  next.delete(tileId);
  return next;
}

export function bounds(board: Board): Bounds | null {
  if (board.size === 0) return null;

  let minC = Infinity;
  let minR = Infinity;
  let maxC = -Infinity;
  let maxR = -Infinity;

  for (const { c, r } of board.values()) {
    if (c < minC) minC = c;
    if (c > maxC) maxC = c;
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }

  return { minC, minR, maxC, maxR };
}

/** Orthogonal neighbours of a cell that hold tiles. */
export function neighbours(board: Board, c: number, r: number): TileId[] {
  const out: TileId[] = [];
  const deltas: readonly [number, number][] = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];
  for (const [dc, dr] of deltas) {
    const t = tileAt(board, c + dc, r + dr);
    if (t !== undefined) out.push(t);
  }
  return out;
}

/**
 * Groups of tiles connected orthogonally. One group means one crossword;
 * more than one means the player has left islands.
 */
export function components(board: Board): TileId[][] {
  const unvisited = new Set(board.keys());
  const out: TileId[][] = [];

  while (unvisited.size > 0) {
    const start = unvisited.values().next().value as TileId;
    const group: TileId[] = [];
    const stack: TileId[] = [start];
    unvisited.delete(start);

    while (stack.length > 0) {
      const tileId = stack.pop()!;
      group.push(tileId);
      const { c, r } = board.get(tileId)!;
      for (const n of neighbours(board, c, r)) {
        if (unvisited.delete(n)) stack.push(n);
      }
    }

    out.push(group);
  }

  return out;
}

/** Compact form for localStorage: [tileId, c, r] triples. */
export type SerializedBoard = readonly (readonly [number, number, number])[];

export function serializeBoard(board: Board): SerializedBoard {
  return [...board].map(([tileId, { c, r }]) => [tileId, c, r] as const);
}

export function deserializeBoard(data: SerializedBoard): Board {
  const map = new Map<TileId, Coord>();
  for (const entry of data) {
    const [tileId, c, r] = entry;
    if (
      Number.isInteger(tileId) &&
      tileId >= 0 &&
      tileId < DIE_COUNT &&
      Number.isInteger(c) &&
      Number.isInteger(r)
    ) {
      map.set(tileId, { c, r });
    }
  }
  return map;
}
