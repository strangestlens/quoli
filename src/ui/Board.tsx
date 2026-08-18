import type { RefObject } from 'react';
import type { Board as BoardModel, Coord } from '../game/board.ts';
import type { TileId } from '../game/dice.ts';
import type { GridGeometry } from './geometry.ts';
import { Tile } from './Tile.tsx';
import type { DragPlacement } from './useDragPlacement.ts';

interface Props {
  board: BoardModel;
  letters: readonly string[];
  geometry: GridGeometry;
  gridRef: RefObject<HTMLDivElement | null>;
  drag: DragPlacement;
}

export function Board({ board, letters, geometry, gridRef, drag }: Props) {
  const { originC, originR, cols, rows, cell } = geometry;
  const { hoverCell, selectedTileId, draggingTileId } = drag;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const at: Coord = { c: col + originC, r: row + originR };
      const isTarget = hoverCell?.c === at.c && hoverCell?.r === at.r;
      cells.push(
        <div
          key={`cell-${at.c},${at.r}`}
          className="cell"
          data-c={at.c}
          data-r={at.r}
          data-target={isTarget || undefined}
          data-armed={selectedTileId !== null || undefined}
          style={{ gridColumn: col + 1, gridRow: row + 1 }}
          onClick={() => drag.onCellTap(at)}
        />,
      );
    }
  }

  const tiles = [...board].map(([tileId, coord]) => (
    <div
      key={`tile-${tileId}`}
      className="tile-slot"
      style={{
        gridColumn: coord.c - originC + 1,
        gridRow: coord.r - originR + 1,
        // Painter's order, not placement order. Tiles cast their shadow down
        // and to the right, so a tile has to sit above its neighbours in that
        // direction or the shadows land under the wrong pieces and the grid
        // looks stacked in whatever sequence it happened to be built.
        zIndex: 1 + cols + rows - (coord.c - originC) - (coord.r - originR),
      }}
    >
      <Tile
        tileId={tileId}
        letter={letters[tileId] ?? '?'}
        size={cell}
        state={tileStateOf(tileId, draggingTileId, selectedTileId)}
        onPointerDown={drag.onTilePointerDown}
        onPointerMove={drag.onTilePointerMove}
        onPointerUp={drag.onTilePointerUp}
        onPointerCancel={drag.onTilePointerCancel}
      />
    </div>
  ));

  return (
    <div
      className="grid"
      ref={gridRef}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows}, ${cell}px)`,
      }}
    >
      {cells}
      {tiles}
    </div>
  );
}

function tileStateOf(
  tileId: TileId,
  draggingTileId: TileId | null,
  selectedTileId: TileId | null,
) {
  if (tileId === draggingTileId) return 'dragging' as const;
  if (tileId === selectedTileId) return 'selected' as const;
  return 'idle' as const;
}
