import { useLayoutEffect, useMemo, useState } from 'react';
import { trayTiles, type Board } from '../game/board.ts';
import { DIE_COUNT, type TileId } from '../game/dice.ts';
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

/**
 * A fresh order for all twelve, not just the ones still in the tray, so a die
 * put back later has a place to land rather than jumping to the front.
 */
function shuffledOrder(): TileId[] {
  const ids = [...Array(DIE_COUNT).keys()];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
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
  // Rearranging the dice is a way of seeing them differently before committing
  // any of them, so it is deliberately throwaway: no persistence, and cleared
  // whenever a new set arrives.
  const [order, setOrder] = useState<readonly TileId[] | null>(null);
  const [shuffles, setShuffles] = useState(0);

  const remaining = useMemo(() => {
    const tiles = trayTiles(board);
    if (!order) return tiles;
    const rank = new Map(order.map((id, index) => [id, index]));
    return [...tiles].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
  }, [board, order]);

  const steps = useMemo(() => cascadeSteps(remaining.length), [remaining.length]);

  // A flat row of letters above a "Re-roll" button read as a start screen to
  // more than one person. Cascading the dice in says they were just thrown.
  // The flag clears afterwards so putting a tile back later doesn't replay it.
  //
  // Layout effect, not a plain one: on a roll that arrives after the flag has
  // cleared this adds `data-intro` before paint, so the tiles never flash at
  // full opacity for a frame before the cascade takes hold.
  const [intro, setIntro] = useState(true);
  useLayoutEffect(() => {
    setIntro(true);
    const id = window.setTimeout(() => setIntro(false), INTRO_MS);
    return () => window.clearTimeout(id);
  }, [introKey, shuffles]);

  // New dice, or stepping back to an earlier set, drops any rearrangement.
  useLayoutEffect(() => {
    setOrder(null);
    setShuffles(0);
  }, [introKey]);
  const selectedIsPlaced = drag.selectedTileId !== null && board.has(drag.selectedTileId);

  return (
    <div
      // Re-keyed per roll so the dice are genuinely new elements. Re-rolling
      // inside the cascade window leaves `data-intro` already set, and an
      // animation the browser has not seen change does not restart — which
      // silently swallowed the effect on a quick second roll.
      // Keyed per roll *and* per shuffle: the dice have to be new elements or
      // the browser sees no animation change and skips the cascade, which is
      // what makes a rearrangement read as a re-throw rather than a jump.
      key={`${introKey}:${shuffles}`}
      className="tray"
      data-drop={selectedIsPlaced || undefined}
      data-intro={intro || undefined}
      onClick={() => {
        if (selectedIsPlaced) onReturnSelected();
      }}
    >
      {remaining.length > 1 && (
        <button
          type="button"
          className="tray-shuffle"
          title="Shuffle the dice"
          onClick={(e) => {
            // The tray itself takes clicks to put a selected die back.
            e.stopPropagation();
            setOrder(shuffledOrder());
            setShuffles((n) => n + 1);
          }}
        >
          <span className="sr-only">Shuffle the dice</span>
          <ShuffleIcon />
        </button>
      )}

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

function ShuffleIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
      <path d="m18 2 4 4-4 4" />
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
      <path d="m18 14 4 4-4 4" />
    </svg>
  );
}
