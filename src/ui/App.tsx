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
  customSource,
  dailySource,
  lettersFor,
  parseSearch,
  resolveDailyRoll,
  rollPath,
  type PuzzleSource,
} from '../game/puzzle.ts';
import { puzzleNumber, todayKey } from '../game/roll.ts';
import { analyze, rulesFor, type Settings } from '../game/rules.ts';
import { setCode, type ScannedSet } from '../game/scan.ts';
import { decodeSolve, encodeSolve } from '../game/solve.ts';
import type { ShareMeta, ShareSubject } from '../game/share.ts';
import { loadPlay, loadSettings, pruneOldPlays, savePlay, saveSettings } from '../game/storage.ts';
import { Board } from './Board.tsx';
import { computeGeometry, growWindow, type Window } from './geometry.ts';
import { Header } from './Header.tsx';
import { HowToPlay } from './HowToPlay.tsx';
import { RevealView } from './RevealView.tsx';
import { ScanSheet } from './ScanSheet.tsx';
import { ShareSheet } from './ShareSheet.tsx';
import { Tray } from './Tray.tsx';
import { useDictionary } from './useDictionary.ts';
import { useDragPlacement } from './useDragPlacement.ts';

/**
 * A `?solve=` link opens somebody else's finished grid rather than a game, so
 * the choice is made once up front. An unreadable code falls through to the
 * daily — a broken link should still land somewhere playable.
 */
export function App() {
  const [solve] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('solve');
    return code === null ? null : decodeSolve(code);
  });

  return solve ? <RevealView solve={solve} /> : <GameView />;
}

interface PlayState {
  source: PuzzleSource;
  board: BoardModel;
  /** First roll this player finished, kept for a future streak. */
  solvedRollIndex: number | null;
  solvedAt: number | null;
}

function initialState(): { state: PlayState; badSetCode: boolean; explicitPuzzle: boolean } {
  const { source: fromUrl, badSetCode, explicitRoll, explicitPuzzle } = parseSearch(
    window.location.search,
  );
  const saved = loadPlay(fromUrl);

  // Daily play is keyed by date, so an absent record means this day has not
  // been started — and any roll still sitting in the URL belongs to a previous
  // one. See resolveDailyRoll.
  const savedRoll = saved?.rollIndex ?? null;
  const rollIndex = resolveDailyRoll({
    urlRollIndex: rollIndexOf(fromUrl),
    explicitRoll,
    explicitPuzzle,
    savedRollIndex: savedRoll,
  });
  const source = fromUrl.kind === 'daily' ? dailySource(fromUrl.dayKey, rollIndex) : fromUrl;

  // A saved board is a set of positions for one particular roll's letters.
  // Carrying it onto a different roll would keep the shape but silently swap
  // every letter under it.
  const boardBelongsHere = fromUrl.kind !== 'daily' || rollIndex === savedRoll;

  return {
    state: {
      source,
      board: boardBelongsHere ? (saved?.board ?? EMPTY_BOARD) : EMPTY_BOARD,
      solvedRollIndex: saved?.solvedRollIndex ?? null,
      solvedAt: saved?.solvedAt ?? null,
    },
    badSetCode,
    explicitPuzzle,
  };
}

const rollIndexOf = (source: PuzzleSource) => (source.kind === 'daily' ? source.rollIndex : 0);

function GameView() {
  const [{ state: firstState, badSetCode, explicitPuzzle }] = useState(initialState);
  const [state, setState] = useState<PlayState>(firstState);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmingReroll, setConfirmingReroll] = useState(false);
  const [dayIsStale, setDayIsStale] = useState(false);
  const [setCodeWarning, setSetCodeWarning] = useState(badSetCode);
  const [photo, setPhoto] = useState<File | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [settings, setSettings] = useState<Settings>(loadSettings);
  const rules = useMemo(() => rulesFor(settings), [settings]);

  const applySettings = (next: Settings) => {
    setSettings(next);
    saveSettings(next);
  };
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  const letters = useMemo(() => lettersFor(state.source), [state.source]);
  const words = useDictionary(letters, rules.requireValidWords);
  const analysis = useMemo(
    () => analyze(state.board, letters, rules, words.dictionary),
    [state.board, letters, rules, words.dictionary],
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

  // Put the address bar back in step with what actually opened. Without this a
  // roll dropped for being stale would still be sitting in the URL, ready to
  // be read again on the next reload.
  useEffect(() => {
    if (state.source.kind !== 'daily' || explicitPuzzle) return;
    const canonical = rollPath(window.location.pathname, state.source.rollIndex);
    if (window.location.pathname + window.location.search !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
    // Only on mount: goToRoll keeps the URL in step from then on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  //
  // Not while another sheet is up, though. Tiles can't move behind a backdrop,
  // so the only way completeness changes there is the rules changing under it —
  // and relaxing a rule shouldn't be congratulated, least of all by throwing a
  // second sheet over the one being used. The solve is still recorded; only the
  // celebration is withheld, and Share stays available.
  const modalOpen = helpOpen || photo !== null;
  const wasComplete = useRef(analysis.complete);
  useEffect(() => {
    if (analysis.complete && !wasComplete.current) {
      if (!modalOpen) setSheetOpen(true);
      setState((s) =>
        s.solvedRollIndex === null
          ? { ...s, solvedRollIndex: rollIndexOf(s.source), solvedAt: Date.now() }
          : s,
      );
    }
    wasComplete.current = analysis.complete;
  }, [analysis.complete, modalOpen]);

  // A tab left open across UTC midnight is otherwise stranded on yesterday.
  // A custom set has no date, so it never goes stale.
  const dayKey = state.source.kind === 'daily' ? state.source.dayKey : null;
  useEffect(() => {
    if (dayKey === null || explicitPuzzle) return;
    const check = () => setDayIsStale(todayKey() !== dayKey);
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [dayKey, explicitPuzzle]);

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

  /**
   * Move to another roll of today's puzzle, forwards or back.
   *
   * The URL is kept in step so a reload lands on the same roll and the address
   * bar always names what is on screen. The board is cleared because it holds
   * positions for the roll it was built on.
   */
  const goToRoll = (rollIndex: number) => {
    if (state.source.kind !== 'daily' || rollIndex < 0) return;
    resetBoardState();
    window.history.replaceState(null, '', rollPath(window.location.pathname, rollIndex));
    setState((s) => ({
      ...s,
      source: s.source.kind === 'daily' ? dailySource(s.source.dayKey, rollIndex) : s.source,
      board: EMPTY_BOARD,
    }));
  };

  const reroll = () => {
    if (state.source.kind !== 'daily') return;
    if (state.board.size > 0 && !confirmingReroll) {
      setConfirmingReroll(true);
      window.setTimeout(() => setConfirmingReroll(false), 3000);
      return;
    }
    setConfirmingReroll(false);
    goToRoll(state.source.rollIndex + 1);
  };

  const previousSet = () => {
    if (state.source.kind === 'daily') goToRoll(state.source.rollIndex - 1);
  };

  const clearBoard = () => {
    resetBoardState();
    setState((s) => ({ ...s, board: EMPTY_BOARD }));
  };

  /** A new day starts at the first set of dice, on a clean URL. */
  const startNewDay = () => {
    window.location.href = window.location.pathname;
  };

  /** Leaving a shared set has to change the URL, or a reload lands back on it. */
  const goToDaily = () => {
    window.location.href = window.location.pathname;
  };

  /**
   * A scanned set becomes a normal custom set, reached by its own link — so
   * the same navigation handles playing it here and sending it to a friend.
   */
  const acceptScan = (scanned: ScannedSet, prefill: boolean) => {
    const code = setCode(scanned.letters);
    const source = customSource(code);
    if (!source) return;

    // Prefilling needs no extra URL state: seed the saved board and let the
    // normal load path find it.
    if (prefill) {
      savePlay(source, {
        rollIndex: 0,
        board: scanned.board,
        solvedRollIndex: null,
        solvedAt: null,
      });
    }

    window.location.href = `${window.location.pathname}?set=${code}`;
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
    solveCode: analysis.complete
      ? encodeSolve(
          state.board,
          letters,
          state.source.kind === 'daily'
            ? { puzzleNumber: puzzleNumber(state.source.dayKey), rollIndex: state.source.rollIndex }
            : null,
        )
      : undefined,
  };

  // Opened by name and not the current day: say so rather than letting someone
  // wonder why their daily looks unfamiliar.
  const isPastPuzzle = explicitPuzzle && dayKey !== null && dayKey !== todayKey();

  const ghostSize = Math.max(geometry.cell, 40);
  const ghostLetter = drag.draggingTileId === null ? '' : (letters[drag.draggingTileId] ?? '');

  return (
    <div className="app">
      <Header
        source={state.source}
        onPhoto={setPhoto}
        onPreviousSet={previousSet}
        onHelp={() => setHelpOpen(true)}
      />

      {setCodeWarning && (
        <button type="button" className="banner" onClick={() => setSetCodeWarning(false)}>
          That link wasn't a valid set — here's today's puzzle instead
        </button>
      )}

      {isPastPuzzle && (
        <a className="banner" href={window.location.pathname}>
          Puzzle #{puzzleNumber(dayKey!)} — not today's. Play today's →
        </a>
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
        {words.loading
          ? 'Fetching the word list…'
          : words.failed
            ? "Couldn't load the word list — words aren't being checked."
            : analysis.complete
              ? 'All twelve down.'
              : (analysis.violations[0]?.message ?? 'Build a grid with all twelve.')}
      </p>

      <Tray
        board={state.board}
        letters={letters}
        drag={drag}
        introKey={
          state.source.kind === 'daily'
            ? `${state.source.dayKey}:${state.source.rollIndex}`
            : state.source.code
        }
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
          <button type="button" className="btn btn-quiet btn-wide" onClick={reroll}>
            {/* Rolling is the action, a set is what you get: this button is
                the one place that names the action, because "dice" is the
                thing being thrown. "Stuck?" carries the rest of the meaning —
                the trouble was that this looked like the next step rather
                than an escape hatch. */}
            {confirmingReroll ? 'Start over?' : 'Stuck? New dice'}
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

      {helpOpen && (
        <HowToPlay
          onClose={() => setHelpOpen(false)}
          settings={settings}
          onSettings={applySettings}
        />
      )}

      {photo && (
        <ScanSheet photo={photo} onClose={() => setPhoto(null)} onAccept={acceptScan} />
      )}

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
