import { bounds, type Board } from '../game/board.ts';

export const MIN_CELL = 24;
export const MAX_CELL = 72;
/** Smallest visible grid, so an empty board isn't one enormous square. */
export const MIN_SPAN = 5;

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
 * The visible window onto the unbounded plane.
 *
 * Always one empty ring around whatever is placed, so there is somewhere to
 * extend to; never smaller than MIN_SPAN; scaled to fill the panel with cells
 * between MIN_CELL and MAX_CELL. Twelve tiles top out at a 14x14 padded view,
 * which is exactly MIN_CELL on a narrow phone.
 */
export function computeGeometry(
  board: Board,
  panelWidth: number,
  panelHeight: number,
): GridGeometry {
  const b = bounds(board);

  let minC = b ? b.minC - 1 : 0;
  let maxC = b ? b.maxC + 1 : 0;
  let minR = b ? b.minR - 1 : 0;
  let maxR = b ? b.maxR + 1 : 0;

  [minC, maxC] = expandTo(minC, maxC, MIN_SPAN);
  [minR, maxR] = expandTo(minR, maxR, MIN_SPAN);

  const cols = maxC - minC + 1;
  const rows = maxR - minR + 1;

  const fit = Math.floor(Math.min(panelWidth / cols, panelHeight / rows));
  const cell = clamp(Number.isFinite(fit) && fit > 0 ? fit : MAX_CELL, MIN_CELL, MAX_CELL);

  return { originC: minC, originR: minR, cols, rows, cell };
}

/**
 * Which cell a client point lands on.
 *
 * Clamped to the rendered window rather than resolving to raw plane
 * coordinates: the padded ring already reaches one cell past everything
 * placed, so clamping still lets the grid grow in any direction while a
 * fumbled drop snaps to the edge instead of flinging a tile into the void.
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
