import { bounds, type Board } from '../game/board.ts';

export const MIN_CELL = 24;
export const MAX_CELL = 72;
/** Smallest visible grid, so an empty board isn't one enormous square. */
export const MIN_SPAN = 5;

/** The rendered window onto the unbounded plane. */
export interface Window {
  readonly minC: number;
  readonly minR: number;
  readonly maxC: number;
  readonly maxR: number;
}

export interface GridGeometry {
  /** Logical coordinate of the top-left rendered cell. */
  readonly originC: number;
  readonly originR: number;
  readonly cols: number;
  readonly rows: number;
  /** Rendered cell edge, in px. */
  readonly cell: number;
}

/** Grow a range symmetrically until it spans at least `target`. */
function expandTo(min: number, max: number, target: number): [number, number] {
  let lo = min;
  let hi = max;
  while (hi - lo + 1 < target) {
    lo -= 1;
    if (hi - lo + 1 < target) hi += 1;
  }
  return [lo, hi];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The smallest window the board needs: everything placed, plus one empty ring
 * so there is always somewhere to extend to, and never below MIN_SPAN.
 */
export function requiredWindow(board: Board): Window {
  const b = bounds(board);

  let minC = b ? b.minC - 1 : 0;
  let maxC = b ? b.maxC + 1 : 0;
  let minR = b ? b.minR - 1 : 0;
  let maxR = b ? b.maxR + 1 : 0;

  [minC, maxC] = expandTo(minC, maxC, MIN_SPAN);
  [minR, maxR] = expandTo(minR, maxR, MIN_SPAN);

  return { minC, minR, maxC, maxR };
}

/**
 * Widen the window to fit the board — never narrow it, never slide it.
 *
 * Recomputing from scratch on every placement re-centres the grid, which
 * slides every tile already on the board out from under the player just as
 * they are aiming the next one. Growing monotonically keeps the board still.
 * Callers reset the window (pass null) on clear, re-roll and a new day.
 */
export function growWindow(previous: Window | null, board: Board): Window {
  const needed = requiredWindow(board);
  // An empty board has nothing to hold still, so it starts fresh rather than
  // inheriting a window stretched by tiles that are no longer there.
  if (!previous || board.size === 0) return needed;

  return {
    minC: Math.min(previous.minC, needed.minC),
    minR: Math.min(previous.minR, needed.minR),
    maxC: Math.max(previous.maxC, needed.maxC),
    maxR: Math.max(previous.maxR, needed.maxR),
  };
}

/** Fit the window into the panel, sizing cells between MIN_CELL and MAX_CELL. */
export function computeGeometry(
  window: Window,
  panelWidth: number,
  panelHeight: number,
): GridGeometry {
  const cols = window.maxC - window.minC + 1;
  const rows = window.maxR - window.minR + 1;

  const fit = Math.floor(Math.min(panelWidth / cols, panelHeight / rows));
  const cell = clamp(Number.isFinite(fit) && fit > 0 ? fit : MAX_CELL, MIN_CELL, MAX_CELL);

  return { originC: window.minC, originR: window.minR, cols, rows, cell };
}

/**
 * Which cell a client point lands on.
 *
 * Clamped to the rendered window rather than resolving to raw plane
 * coordinates: the ring already reaches one cell past everything placed, so
 * clamping still lets the grid grow in any direction while a fumbled drop
 * snaps to the edge instead of flinging a tile into the void.
 */
export function cellFromClient(
  gridRect: DOMRect,
  geo: GridGeometry,
  clientX: number,
  clientY: number,
): { c: number; r: number } {
  const col = clamp(Math.floor((clientX - gridRect.left) / geo.cell), 0, geo.cols - 1);
  const row = clamp(Math.floor((clientY - gridRect.top) / geo.cell), 0, geo.rows - 1);
  return { c: col + geo.originC, r: row + geo.originR };
}

export function isInside(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
