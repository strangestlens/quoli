import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_BOARD,
  coordOf as coordOfTile,
  place,
  unplace,
  type Board as BoardModel,
  type Coord,
} from '../game/board.ts';
import type { TileId } from '../game/dice.ts';
import { puzzleNumber, rollFor, todayKey, type DayKey } from '../game/roll.ts';
import { analyze } from '../game/rules.ts';
import type { ShareMeta } from '../game/share.ts';
import { loadDay, loadRules, pruneOldDays, saveDay } from '../game/storage.ts';
import { Board } from './Board.tsx';
import { computeGeometry } from './geometry.ts';
import { Header } from './Header.tsx';
import { ShareSheet } from './ShareSheet.tsx';
import { Tray } from './Tray.tsx';
import { useDragPlacement } from './useDragPlacement.ts';

interface PlayState {
  dayKey: DayKey;
  rollIndex: number;
  board: BoardModel;
  /** First roll this player finished, kept for a future streak. */
  solvedRollIndex: number | null;
  solvedAt: number | null;
}

function initialState(): PlayState {
  const dayKey = todayKey();
  const saved = loadDay(dayKey);
  return saved !== null
    ? { dayKey, ...saved }
    : { dayKey, rollIndex: 0, board: EMPTY_BOARD, solvedRollIndex: null, solvedAt: null };
}

export function App() {
  const [state, setState] = useState<PlayState>(initialState);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingReroll, setConfirmingReroll] = useState(false);
  const [dayIsStale, setDayIsStale] = useState(false);

  const rules = useMemo(loadRules, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const roll = useMemo(
    () => rollFor(state.dayKey, state.rollIndex),
    [state.dayKey, state.rollIndex],
  );
  const analysis = useMemo(
    () => analyze(state.board, roll.letters, rules),
    [state.board, roll.letters, rules],
  );

  const panel = usePanelSize(panelRef);
  const geometry = useMemo(
    () => computeGeometry(state.board, panel.w, panel.h),
    [state.board, panel.w, panel.h],
  );

  useEffect(() => pruneOldDays(), []);

  useEffect(() => {
    saveDay(state.dayKey, state);
  }, [state]);

  // Fire the share sheet on the transition into completeness, not on every
  // render where the board happens to be complete.
  const wasComplete = useRef(analysis.complete);
  useEffect(() => {
    if (analysis.complete && !wasComplete.current) {
      setSheetOpen(true);
      setState((s) =>
        s.solvedRollIndex === null
          ? { ...s, solvedRollIndex: s.rollIndex, solvedAt: Date.now() }
          : s,
      );
    }
    wasComplete.current = analysis.complete;
  }, [analysis.complete]);

  // A tab left open across UTC midnight is otherwise stranded on yesterday.
  useEffect(() => {
    const check = () => setDayIsStale(todayKey() !== state.dayKey);
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [state.dayKey]);

  const handlePlace = useCallback((tileId: TileId, at: Coord) => {
    setState((s) => ({ ...s, board: place(s.board, tileId, at) }));
  }, []);

  const handleReturnToTray = useCallback((tileId: TileId) => {
    setState((s) => ({ ...s, board: unplace(s.board, tileId) }));
  }, []);

  const boardRef = useRef(state.board);
  boardRef.current = state.board;
  const coordOf = useCallback((tileId: TileId) => coordOfTile(boardRef.current, tileId), []);

  const drag = useDragPlacement({
    geometry,
    gridRef,
    panelRef,
    ghostRef,
    coordOf,
    onPlace: handlePlace,
    onReturnToTray: handleReturnToTray,
  });

  const reroll = () => {
    if (state.board.size > 0 && !confirmingReroll) {
      setConfirmingReroll(true);
      window.setTimeout(() => setConfirmingReroll(false), 3000);
      return;
    }
    setConfirmingReroll(false);
    drag.clearSelection();
    wasComplete.current = false;
    setState((s) => ({ ...s, rollIndex: s.rollIndex + 1, board: EMPTY_BOARD }));
  };

  const clearBoard = () => {
    drag.clearSelection();
    wasComplete.current = false;
    setState((s) => ({ ...s, board: EMPTY_BOARD }));
  };

  const startNewDay = () => {
    setDayIsStale(false);
    setSheetOpen(false);
    wasComplete.current = false;
    setState(initialState());
  };

  const meta: ShareMeta = {
    puzzleNumber: puzzleNumber(state.dayKey),
    rollIndex: state.rollIndex,
    wordCount: analysis.words.length,
    tileCount: state.board.size,
  };

  const ghostSize = Math.max(geometry.cell, 40);
  const ghostLetter =
    drag.draggingTileId === null ? '' : (roll.letters[drag.draggingTileId] ?? '');

  return (
    <div className="app">
      <Header puzzleNumber={meta.puzzleNumber} rollIndex={state.rollIndex} />

      {dayIsStale && (
        <button type="button" className="banner" onClick={startNewDay}>
          A new puzzle is ready — tap to start today's
        </button>
      )}

      <div className="panel" ref={panelRef}>
        <Board
          board={state.board}
          letters={roll.letters}
          geometry={geometry}
          gridRef={gridRef}
          drag={drag}
        />
      </div>

      <p className="status" aria-live="polite">
        {analysis.complete
          ? 'All twelve down.'
          : (analysis.violations[0]?.message ?? 'Build a grid with all twelve.')}
      </p>

      <Tray
        board={state.board}
        letters={roll.letters}
        drag={drag}
        onReturnSelected={() => {
          if (drag.selectedTileId !== null) handleReturnToTray(drag.selectedTileId);
          drag.clearSelection();
        }}
      />

      <div className="actions">
        <button type="button" className="btn btn-quiet" onClick={clearBoard} disabled={state.board.size === 0}>
          Clear
        </button>
        <button type="button" className="btn btn-quiet" onClick={reroll}>
          {confirmingReroll ? 'Clear board and re-roll?' : 'Re-roll'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setSheetOpen(true)}
          disabled={!analysis.complete}
        >
          Share
        </button>
      </div>

      {/* Always mounted so the first pointermove has somewhere to write. */}
      <div
        ref={ghostRef}
        className="ghost"
        data-active={drag.draggingTileId !== null || undefined}
        style={{ width: ghostSize, height: ghostSize, fontSize: ghostSize * 0.5 }}
        aria-hidden="true"
      >
        {ghostLetter}
      </div>

      {sheetOpen && (
        <ShareSheet
          board={state.board}
          letters={roll.letters}
          meta={meta}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

function usePanelSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
