import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Coord } from '../game/board.ts';
import type { TileId } from '../game/dice.ts';
import { cellFromClient, isInside, type GridGeometry } from './geometry.ts';

/** Movement past this many px means "drag"; anything less is a tap. */
const DRAG_THRESHOLD = 8;

interface Gesture {
  tileId: TileId;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
}

interface Args {
  geometry: GridGeometry;
  gridRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  ghostRef: RefObject<HTMLDivElement | null>;
  /** Where a tile currently sits, or undefined if it is in the tray. */
  coordOf: (tileId: TileId) => Coord | undefined;
  onPlace: (tileId: TileId, at: Coord) => void;
  onReturnToTray: (tileId: TileId) => void;
}

export interface DragPlacement {
  /** Tile under the finger, hidden in place while its ghost flies. */
  draggingTileId: TileId | null;
  /** Tile armed by tapping, waiting for a destination. */
  selectedTileId: TileId | null;
  /** Cell the drag would land on right now. */
  hoverCell: Coord | null;
  onTilePointerDown: (tileId: TileId, e: ReactPointerEvent<HTMLElement>) => void;
  onTilePointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onTilePointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onTilePointerCancel: () => void;
  /** Tap target on the board: drops the armed tile here. */
  onCellTap: (at: Coord) => void;
  clearSelection: () => void;
}

/**
 * Placement by drag or by tap, on one pointer-event pipeline.
 *
 * Not HTML5 drag-and-drop, which does not work on touch at all, and not a drag
 * library — those model sortable lists, and this is a free-form snapping grid.
 *
 * Tapping is a first-class path, not a fallback: on a phone, tap-tile then
 * tap-cell is usually faster and more accurate than dragging, and it is the
 * route that works without fine motor control.
 */
export function useDragPlacement({
  geometry,
  gridRef,
  panelRef,
  ghostRef,
  coordOf,
  onPlace,
  onReturnToTray,
}: Args): DragPlacement {
  const gesture = useRef<Gesture | null>(null);
  const [draggingTileId, setDraggingTileId] = useState<TileId | null>(null);
  const [hoverCell, setHoverCell] = useState<Coord | null>(null);

  // Selection is mirrored into a ref so the tap handler can branch on it
  // imperatively — deciding "swap or re-select" inside a state updater would
  // run the side effect twice under StrictMode.
  const selectedRef = useRef<TileId | null>(null);
  const [selectedTileId, setSelectedState] = useState<TileId | null>(null);
  const setSelection = useCallback((tileId: TileId | null) => {
    selectedRef.current = tileId;
    setSelectedState(tileId);
  }, []);

  // The ghost floats above the finger so a thumb never covers the tile being
  // placed — and the drop target is read from the ghost's centre rather than
  // the finger's, so what you see is where it lands.
  const ghostSize = Math.max(geometry.cell, 40);
  const lift = ghostSize * 0.9;

  const moveGhost = useCallback(
    (x: number, y: number) => {
      const el = ghostRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${x - ghostSize / 2}px, ${y - ghostSize / 2 - lift}px, 0)`;
    },
    [ghostRef, ghostSize, lift],
  );

  const targetCell = useCallback(
    (x: number, y: number): Coord | null => {
      const grid = gridRef.current;
      const panel = panelRef.current;
      if (!grid || !panel) return null;

      const aimY = y - lift;
      if (!isInside(panel.getBoundingClientRect(), x, aimY)) return null;
      return cellFromClient(grid.getBoundingClientRect(), geometry, x, aimY);
    },
    [geometry, gridRef, lift, panelRef],
  );

  const endGesture = useCallback(() => {
    gesture.current = null;
    setDraggingTileId(null);
    setHoverCell(null);
  }, []);

  const onTilePointerDown = useCallback((tileId: TileId, e: ReactPointerEvent<HTMLElement>) => {
    if (gesture.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // NotFoundError when the pointer is already gone. The gesture still
      // works off the element's own listeners; it just won't survive the
      // finger leaving the tile.
    }
    gesture.current = {
      tileId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      dragging: false,
    };
  }, []);

  const onTilePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;

      if (!g.dragging) {
        if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < DRAG_THRESHOLD) return;
        g.dragging = true;
        setDraggingTileId(g.tileId);
        setSelection(null);
      }

      moveGhost(e.clientX, e.clientY);

      const next = targetCell(e.clientX, e.clientY);
      setHoverCell((prev) => {
        if (prev === next) return prev;
        if (prev && next && prev.c === next.c && prev.r === next.r) return prev;
        return next;
      });
    },
    [moveGhost, setSelection, targetCell],
  );

  const handleTap = useCallback(
    (tileId: TileId) => {
      const armed = selectedRef.current;

      if (armed === null || armed === tileId) {
        setSelection(armed === tileId ? null : tileId);
        return;
      }

      // Something else is armed and this tile is on the board: swap them.
      const destination = coordOf(tileId);
      if (destination) {
        onPlace(armed, destination);
        setSelection(null);
        return;
      }

      // Both in the tray — just move the arming across.
      setSelection(tileId);
    },
    [coordOf, onPlace, setSelection],
  );

  const onTilePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;

      if (!g.dragging) {
        handleTap(g.tileId);
        endGesture();
        return;
      }

      const at = targetCell(e.clientX, e.clientY);
      if (at) onPlace(g.tileId, at);
      else onReturnToTray(g.tileId);

      endGesture();
    },
    [endGesture, handleTap, onPlace, onReturnToTray, targetCell],
  );

  const onCellTap = useCallback(
    (at: Coord) => {
      const armed = selectedRef.current;
      if (armed === null) return;
      onPlace(armed, at);
      setSelection(null);
    },
    [onPlace, setSelection],
  );

  const clearSelection = useCallback(() => setSelection(null), [setSelection]);

  return {
    draggingTileId,
    selectedTileId,
    hoverCell,
    onTilePointerDown,
    onTilePointerMove,
    onTilePointerUp,
    // Losing capture — an unmount, a system gesture — must not strand a tile.
    onTilePointerCancel: endGesture,
    onCellTap,
    clearSelection,
  };
}
