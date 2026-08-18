import { useEffect, useMemo, useState } from 'react';
import { trayTiles, type Board } from '../game/board.ts';
import { Tile } from './Tile.tsx';
import type { DragPlacement } from './useDragPlacement.ts';

const TRAY_TILE = 46;

/**
 * The wave's pace is the stagger; each tile's softness is the fade. Keep FADE_MS
 * in step with the tray-drop animation in index.css. All twelve land inside a
 * second, which is the budget for the whole cascade.
 */
const STAGGER_MS = 46;
const FADE_MS = 675;

/** The tray wraps at six on a phone, which is the layout the cascade is tuned for. */
const TRAY_COLUMNS = 6;

/** A full two-row tray's furthest tile sits TRAY_COLUMNS diagonals from the corner. */
const INTRO_MS = TRAY_COLUMNS * STAGGER_MS + FADE_MS + 60;

/**
 * Cascade position for every tile, indexed as laid out.
 *
 * The step is simply how far a tile sits from the top-left corner, column plus
 * row — so everything on the same diagonal starts at the same instant and the
 * wave crosses the tray as a line rather than a trickle. Across two rows of
 * six that pairs 2 with 7, 3 with 8, and so on. A single row of six or fewer
 * collapses to plain left-to-right.
 */
function cascadeSteps(total: number): number[] {
  return [...Array(total).keys()].map(
    (index) => (index % TRAY_COLUMNS) + Math.floor(index / TRAY_COLUMNS),
  );
}

interface Props {
  board: Board;
  letters: readonly string[];
  drag: DragPlacement;
  onReturnSelected: () => void;
  /** Changes when a new set of dice arrives, replaying the drop-in. */
  introKey: string;
}

export function Tray({ board, letters, drag, onReturnSelected, introKey }: Props) {
  const remaining = trayTiles(board);
  const steps = useMemo(() => cascadeSteps(remaining.length), [remaining.length]);

  // A flat row of letters above a "Re-roll" button read as a start screen to
  // more than one person. Cascading the dice in says they were just thrown.
  // The flag clears afterwards so putting a tile back later doesn't replay it.
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    setIntro(true);
    const id = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(id);
  }, [introKey]);
  const selectedIsPlaced = drag.selectedTileId !== null && board.has(drag.selectedTileId);

  return (
    <div
      className="tray"
      data-drop={selectedIsPlaced || undefined}
      data-intro={intro || undefined}
      onClick={() => {
        if (selectedIsPlaced) onReturnSelected();
      }}
    >
      {remaining.length === 0 ? (
        <p className="tray-empty">
          {selectedIsPlaced ? 'Tap here to take that one back' : 'All twelve are down.'}
        </p>
      ) : (
        remaining.map((tileId, index) => (
          <Tile
            key={tileId}
            style={{ animationDelay: `${(steps[index] ?? 0) * STAGGER_MS}ms` }}
            tileId={tileId}
            letter={letters[tileId] ?? '?'}
            size={TRAY_TILE}
            state={
              tileId === drag.draggingTileId
                ? 'dragging'
                : tileId === drag.selectedTileId
                  ? 'selected'
                  : 'idle'
            }
            onPointerDown={drag.onTilePointerDown}
            onPointerMove={drag.onTilePointerMove}
            onPointerUp={drag.onTilePointerUp}
            onPointerCancel={drag.onTilePointerCancel}
          />
        ))
      )}
    </div>
  );
}
