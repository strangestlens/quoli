import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD } from '../src/game/board.ts';
import {
  computeGeometry,
  growWindow,
  MAX_CELL,
  MIN_CELL,
  MIN_SPAN,
  requiredWindow,
} from '../src/ui/geometry.ts';
import { boardOf } from './fixtures.ts';

const span = (w: { minC: number; maxC: number; minR: number; maxR: number }) => ({
  cols: w.maxC - w.minC + 1,
  rows: w.maxR - w.minR + 1,
});

describe('requiredWindow', () => {
  it('opens at MIN_SPAN around the origin for an empty board', () => {
    const w = requiredWindow(EMPTY_BOARD);
    expect(span(w)).toEqual({ cols: MIN_SPAN, rows: MIN_SPAN });
    expect(w.minC).toBe(-2);
    expect(w.maxC).toBe(2);
  });

  it('keeps an empty ring around everything placed', () => {
    const w = requiredWindow(boardOf([0, 0, 0], [1, 1, 0], [2, 2, 0], [3, 3, 0], [4, 4, 0]));
    expect(w.minC).toBe(-1);
    expect(w.maxC).toBe(5);
  });

  it('never drops below MIN_SPAN on the short axis', () => {
    const w = requiredWindow(boardOf([0, 0, 0], [1, 1, 0], [2, 2, 0], [3, 3, 0], [4, 4, 0]));
    expect(span(w).rows).toBe(MIN_SPAN);
  });
});

describe('growWindow', () => {
  it('starts from the required window when there is nothing to grow from', () => {
    expect(growWindow(null, EMPTY_BOARD)).toEqual(requiredWindow(EMPTY_BOARD));
  });

  it('never shrinks while tiles are still down', () => {
    const wide = growWindow(null, boardOf([0, 6, 0], [1, 0, 0]));
    const after = growWindow(wide, boardOf([1, 0, 0]));
    expect(after.minC).toBeLessThanOrEqual(wide.minC);
    expect(after.maxC).toBeGreaterThanOrEqual(wide.maxC);
    expect(after.minR).toBeLessThanOrEqual(wide.minR);
    expect(after.maxR).toBeGreaterThanOrEqual(wide.maxR);
  });

  it('starts fresh once the board is empty', () => {
    const wide = growWindow(null, boardOf([0, 6, 0]));
    expect(growWindow(wide, EMPTY_BOARD)).toEqual(requiredWindow(EMPTY_BOARD));
  });

  it('never slides — the origin only moves when the board needs the room', () => {
    // The whole point: placing on the right must not shift what is already down.
    const start = growWindow(null, boardOf([0, 0, 0]));
    const after = growWindow(start, boardOf([0, 0, 0], [1, 1, 0]));
    expect(after.minC).toBe(start.minC);
    expect(after.minR).toBe(start.minR);
  });

  it('extends only on the side that needs it', () => {
    const start = growWindow(null, EMPTY_BOARD); // -2..2
    const after = growWindow(start, boardOf([0, 3, 0]));
    // The ring around c=3 is 2..4, then MIN_SPAN pushes the far edge to 5.
    expect(after.maxC).toBe(5);
    expect(after.minC).toBe(start.minC);
  });

  it('is idempotent, so a double render cannot creep the window', () => {
    const once = growWindow(null, boardOf([0, 2, 2]));
    expect(growWindow(once, boardOf([0, 2, 2]))).toEqual(once);
  });
});

describe('computeGeometry', () => {
  const win = requiredWindow(EMPTY_BOARD);

  it('scales cells to fill the panel', () => {
    expect(computeGeometry(win, 250, 500).cell).toBe(50);
  });

  it('caps cells at MAX_CELL on a roomy panel', () => {
    expect(computeGeometry(win, 2000, 2000).cell).toBe(MAX_CELL);
  });

  it('floors cells at MIN_CELL rather than vanishing', () => {
    expect(computeGeometry(win, 40, 40).cell).toBe(MIN_CELL);
  });

  it('survives a panel that has not been measured yet', () => {
    expect(computeGeometry(win, 0, 0).cell).toBe(MAX_CELL);
  });

  it('reports the window as the grid origin', () => {
    const w = growWindow(null, boardOf([0, 5, 5]));
    const geo = computeGeometry(w, 400, 400);
    expect(geo.originC).toBe(w.minC);
    expect(geo.cols).toBe(w.maxC - w.minC + 1);
  });
});
