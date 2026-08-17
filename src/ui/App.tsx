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
import {
  canReroll,
  dailySource,
  lettersFor,
  parseSearch,
  type PuzzleSource,
} from '../game/puzzle.ts';
import { puzzleNumber, todayKey } from '../game/roll.ts';
import { analyze } from '../game/rules.ts';
import type { ShareMeta, ShareSubject } from '../game/share.ts';
import { loadPlay, loadRules, pruneOldPlays, savePlay } from '../game/storage.ts';
import { Board } from './Board.tsx';
import { computeGeometry, growWindow, type Window } from './geometry.ts';
import { Header } from './Header.tsx';
import { ShareSheet } from './ShareSheet.tsx';
import { Tray } from './Tray.tsx';
import { useDragPlacement } from './useDragPlacement.ts';

interface PlayState {
  source: PuzzleSource;
  board: BoardModel;
  /** First roll this player finished, kept for a future streak. */
  solvedRollIndex: number | null;
  solvedAt: number | null;
}

function initialState(): { state: PlayState; badSetCode: boolean } {
  const { source: fromUrl, badSetCode } = parseSearch(window.location.search);
  const saved = loadPlay(fromUrl);

  // Daily play is keyed by date, not by roll, so a restored record may be on a
  // later re-roll than the bare URL implies.
  const source =
    fromUrl.kind === 'daily' && saved !== null && saved.rollIndex !== fromUrl.rollIndex
      ? dailySource(fromUrl.dayKey, saved.rollIndex)
      : fromUrl;

  return {
    state: {
      source,
      board: saved?.board ?? EMPTY_BOARD,
      solvedRollIndex: saved?.solvedRollIndex ?? null,
      solvedAt: saved?.solvedAt ?? null,
    },
    badSetCode,
  };
}

const rollIndexOf = (source: PuzzleSource) => (source.kind === 'daily' ? source.rollIndex : 0);

export function App() {
  const [{ state: firstState, badSetCode }] = useState(initialState);
  const [state, setState] = useState<PlayState>(firstState);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingReroll, setConfirmingReroll] = useState(false);
  const [dayIsStale, setDayIsStale] = useState(false);
  const [setCodeWarning, setSetCodeWarning] = useState(badSetCode);

  const rules = useMemo(loadRules, []);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const letters = useMemo(() => lettersFor(state.source), [state.source]);
  const analysis = useMemo(
    () => analyze(state.board, letters, rules),
    [state.board, letters, rules],
  );

  const panel = usePanelSize(panelRef);

  // The rendered window only ever grows while a board is in play. Recomputing
  // it from the board each time would re-centre the grid on every placement,
  // sliding tiles out from under the player mid-solve. Reset it (null) when
  // the board is wiped. growWindow is idempotent, so StrictMode's double
  // render is harmless.
  const windowRef = useRef<Window | null>(null);
  const gridWindow = useMemo(() => {
    windowRef.current = growWindow(windowRef.current, state.board);
    return windowRef.current;
  }, [state.board]);

  const geometry = useMemo(
    () => computeGeometry(gridWindow, panel.w, panel.h),
    [gridWindow, panel.w, panel.h],
  );

  useEffect(() => pruneOldPlays(), []);

  useEffect(() => {
    savePlay(state.source, {
      rollIndex: rollIndexOf(state.source),
      board: state.board,
      solvedRollIndex: state.solvedRollIndex,
      solvedAt: state.solvedAt,
    });
  }, [state]);

  // Fire the share sheet on the transition into completeness, not on every
  // render where the board happens to be complete.
  const wasComplete = useRef(analysis.complete);
  useEffect(() => {
    if (analysis.complete && !wasComplete.current) {
      setSheetOpen(true);
      setState((s) =>
        s.solvedRollIndex === null
          ? { ...s, solvedRollIndex: rollIndexOf(s.source), solvedAt: Date.now() }
          : s,
      );
    }
    wasComplete.current = analysis.complete;
  }, [analysis.complete]);

  // A tab left open across UTC midnight is otherwise stranded on yesterday.
  // A custom set has no date, so it never goes stale.
  const dayKey = state.source.kind === 'daily' ? state.source.dayKey : null;
  useEffect(() => {
    if (dayKey === null) return;
    const check = () => setDayIsStale(todayKey() !== dayKey);
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dayKey]);

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

  const resetBoardState = () => {
    drag.clearSelection();
    wasComplete.current = false;
    windowRef.current = null;
  };

  const reroll = () => {
    if (state.source.kind !== 'daily') return;
    if (state.board.size > 0 && !confirmingReroll) {
      setConfirmingReroll(true);
      window.setTimeout(() => setConfirmingReroll(false), 3000);
      return;
    }
    setConfirmingReroll(false);
    resetBoardState();
    setState((s) => ({
      ...s,
      source: s.source.kind === 'daily' ? dailySource(s.source.dayKey, s.source.rollIndex + 1) : s.source,
      board: EMPTY_BOARD,
    }));
  };

  const clearBoard = () => {
    resetBoardState();
    setState((s) => ({ ...s, board: EMPTY_BOARD }));
  };

  const startNewDay = () => {
    setDayIsStale(false);
    setSheetOpen(false);
    resetBoardState();
    setState(initialState().state);
  };

  /** Leaving a shared set has to change the URL, or a reload lands back on it. */
  const goToDaily = () => {
    window.location.href = window.location.pathname;
  };

  const subject: ShareSubject =
    state.source.kind === 'daily'
      ? {
          kind: 'daily',
          puzzleNumber: puzzleNumber(state.source.dayKey),
          rollIndex: state.source.rollIndex,
        }
      : { kind: 'custom', code: state.source.code };

  const meta: ShareMeta = {
    subject,
    wordCount: analysis.words.length,
    tileCount: state.board.size,
  };

  const ghostSize = Math.max(geometry.cell, 40);
  const ghostLetter = drag.draggingTileId === null ? '' : (letters[drag.draggingTileId] ?? '');

  return (
    <div className="app">
      <Header source={state.source} />

      {setCodeWarning && (
        <button type="button" className="banner" onClick={() => setSetCodeWarning(false)}>
          That link wasn't a valid set — here's today's puzzle instead
        </button>
      )}

      {dayIsStale && (
        <button type="button" className="banner" onClick={startNewDay}>
          A new puzzle is ready — tap to start today's
        </button>
      )}

      <div className="panel" ref={panelRef}>
        <Board
          board={state.board}
          letters={letters}
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
        letters={letters}
        drag={drag}
        onReturnSelected={() => {
          if (drag.selectedTileId !== null) handleReturnToTray(drag.selectedTileId);
          drag.clearSelection();
        }}
      />

      <div className="actions">
        <button
          type="button"
          className="btn btn-quiet"
          onClick={clearBoard}
          disabled={state.board.size === 0}
        >
          Clear
        </button>

        {canReroll(state.source) ? (
          <button type="button" className="btn btn-quiet" onClick={reroll}>
            {confirmingReroll ? 'Clear board and re-roll?' : 'Re-roll'}
          </button>
        ) : (
          <button type="button" className="btn btn-quiet" onClick={goToDaily}>
            Today's puzzle
          </button>
        )}

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
          letters={letters}
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
