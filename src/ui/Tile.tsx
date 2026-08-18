import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import type { TileId } from '../game/dice.ts';

export type TileState = 'idle' | 'dragging' | 'selected';

interface Props {
  tileId: TileId;
  letter: string;
  size: number;
  state: TileState;
  onPointerDown: (tileId: TileId, e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  /** Merged over the computed sizing — used for the tray's stagger delay. */
  style?: CSSProperties;
}

export function Tile({
  tileId,
  letter,
  size,
  state,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  style,
}: Props) {
  return (
    <button
      type="button"
      className="tile"
      data-state={state}
      aria-label={`Letter ${letter}`}
      aria-pressed={state === 'selected'}
      style={{ width: size, height: size, fontSize: size * 0.5, ...style }}
      onPointerDown={(e) => onPointerDown(tileId, e)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {letter}
    </button>
  );
}
