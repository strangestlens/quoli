import { trayTiles, type Board } from '../game/board.ts';
import { Tile } from './Tile.tsx';
import type { DragPlacement } from './useDragPlacement.ts';

const TRAY_TILE = 46;

interface Props {
  board: Board;
  letters: readonly string[];
  drag: DragPlacement;
  onReturnSelected: () => void;
}

export function Tray({ board, letters, drag, onReturnSelected }: Props) {
  const remaining = trayTiles(board);
  const selectedIsPlaced = drag.selectedTileId !== null && board.has(drag.selectedTileId);

  return (
    <div
      className="tray"
      data-drop={selectedIsPlaced || undefined}
      onClick={() => {
        if (selectedIsPlaced) onReturnSelected();
      }}
    >
      {remaining.length === 0 ? (
        <p className="tray-empty">
          {selectedIsPlaced ? 'Tap here to take that one back' : 'All twelve are down.'}
        </p>
      ) : (
        remaining.map((tileId) => (
          <Tile
            key={tileId}
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
