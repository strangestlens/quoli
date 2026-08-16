import { describe, expect, it } from 'vitest';
import {
  bounds,
  components,
  deserializeBoard,
  EMPTY_BOARD,
  place,
  serializeBoard,
  tileAt,
  trayTiles,
  unplace,
} from '../src/game/board.ts';
import { boardOf } from './fixtures.ts';

describe('place', () => {
  it('puts a tile down and leaves the original alone', () => {
    const next = place(EMPTY_BOARD, 3, { c: 1, r: 2 });
    expect(next.get(3)).toEqual({ c: 1, r: 2 });
    expect(EMPTY_BOARD.size).toBe(0);
  });

  it('swaps two placed tiles', () => {
    const board = boardOf([0, 0, 0], [1, 1, 0]);
    const next = place(board, 0, { c: 1, r: 0 });
    expect(next.get(0)).toEqual({ c: 1, r: 0 });
    expect(next.get(1)).toEqual({ c: 0, r: 0 });
  });

  it('sends the displaced tile to the tray when the mover came from the tray', () => {
    const board = boardOf([1, 1, 0]);
    const next = place(board, 5, { c: 1, r: 0 });
    expect(next.get(5)).toEqual({ c: 1, r: 0 });
    expect(next.has(1)).toBe(false);
  });

  it('is a no-op when a tile is dropped on itself', () => {
    const board = boardOf([2, 3, 3]);
    const next = place(board, 2, { c: 3, r: 3 });
    expect(next.size).toBe(1);
    expect(next.get(2)).toEqual({ c: 3, r: 3 });
  });

  it('handles negative coordinates — the plane is unbounded', () => {
    const board = boardOf([0, -4, -9]);
    expect(tileAt(board, -4, -9)).toBe(0);
    expect(bounds(board)).toEqual({ minC: -4, minR: -9, maxC: -4, maxR: -9 });
  });
});

describe('unplace', () => {
  it('returns a tile to the tray', () => {
    const board = boardOf([0, 0, 0], [1, 1, 0]);
    expect(unplace(board, 0).has(0)).toBe(false);
  });

  it('returns the same board when the tile is already in the tray', () => {
    const board = boardOf([0, 0, 0]);
    expect(unplace(board, 7)).toBe(board);
  });
});

describe('trayTiles', () => {
  it('lists the dice still to be played, in die order', () => {
    const board = boardOf([0, 0, 0], [5, 1, 0], [11, 2, 0]);
    expect(trayTiles(board)).toEqual([1, 2, 3, 4, 6, 7, 8, 9, 10]);
  });
});

describe('bounds', () => {
  it('is null for an empty board', () => {
    expect(bounds(EMPTY_BOARD)).toBeNull();
  });

  it('spans every placed tile', () => {
    const board = boardOf([0, 2, 1], [1, -1, 4], [2, 5, 0]);
    expect(bounds(board)).toEqual({ minC: -1, minR: 0, maxC: 5, maxR: 4 });
  });
});

describe('components', () => {
  it('joins orthogonal neighbours into one group', () => {
    const board = boardOf([0, 0, 0], [1, 1, 0], [2, 1, 1]);
    expect(components(board)).toHaveLength(1);
  });

  it('does not treat diagonal contact as connected', () => {
    const board = boardOf([0, 0, 0], [1, 1, 1]);
    expect(components(board)).toHaveLength(2);
  });

  it('finds islands', () => {
    const board = boardOf([0, 0, 0], [1, 1, 0], [2, 8, 8]);
    const groups = components(board).map((g) => g.sort()).sort((a, b) => b.length - a.length);
    expect(groups).toEqual([[0, 1], [2]]);
  });
});

describe('serialization', () => {
  it('round-trips', () => {
    const board = boardOf([0, 1, 2], [7, -3, 4]);
    expect(deserializeBoard(serializeBoard(board))).toEqual(board);
  });

  it('drops garbage rather than trusting localStorage', () => {
    const restored = deserializeBoard([
      [0, 1, 1],
      [99, 0, 0],
      [1, 1.5, 0],
    ] as never);
    expect([...restored.keys()]).toEqual([0]);
  });
});
