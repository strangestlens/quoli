import { useMemo, useState } from 'react';
import { bounds, tileAt } from '../game/board.ts';
import { puzzlePath } from '../game/puzzle.ts';
import type { Settings } from '../game/rules.ts';
import { setCode } from '../game/scan.ts';
import type { Solve } from '../game/solve.ts';
import { loadSettings, saveSettings } from '../game/storage.ts';
import { extractWords } from '../game/words.ts';
import { HowToPlay } from './HowToPlay.tsx';

/** Matches the tray cascade, so the letters arrive the same way the dice did. */
const STAGGER_MS = 46;

interface Props {
  solve: Solve;
}

/**
 * Somebody else's finished grid.
 *
 * The shape is there from the start; the letters are not. Playing the same
 * dice is the prominent choice and revealing is the quiet one, so the default
 * path is to solve it yourself first — the reveal is one-way, and there is no
 * unseeing it.
 */
export function RevealView({ solve }: Props) {
  const [revealed, setRevealed] = useState(false);
  // This page is where someone who has never seen Quoli arrives, so the rules
  // need to be within reach here more than anywhere else.
  const [helpOpen, setHelpOpen] = useState(false);
  // Settings live in one place, so choosing a mode here carries into the game.
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const b = bounds(solve.board)!;
  const cols = b.maxC - b.minC + 1;
  const rows = b.maxR - b.minR + 1;

  const wordCount = useMemo(
    () => extractWords(solve.board, solve.letters).length,
    [solve],
  );

  // A grid from the daily keeps its identity, so the recipient plays the very
  // same puzzle rather than the letters rehomed as a nameless custom set.
  const playHref = solve.origin
    ? puzzlePath('', solve.origin.puzzleNumber, solve.origin.rollIndex)
    : `?set=${setCode(solve.letters)}`;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileId = tileAt(solve.board, c + b.minC, r + b.minR);
      cells.push(
        tileId === undefined ? (
          <span key={`gap-${c},${r}`} className="reveal-gap" />
        ) : (
          <span key={`tile-${c},${r}`} className="tile reveal-tile">
            <span
              className="reveal-letter"
              style={{ animationDelay: `${(c + r) * STAGGER_MS}ms` }}
            >
              {revealed ? solve.letters[tileId] : ''}
            </span>
          </span>
        ),
      );
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1 className="wordmark">
            <span className="wordmark-q">Q</span>uoli
          </h1>
          <p className="tagline">someone sent you their grid</p>
        </div>

        <div className="header-right">
        <button type="button" className="icon-btn" onClick={() => setHelpOpen(true)} title="How to play">
          <span className="sr-only">How to play</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.3a2.6 2.6 0 0 1 5.1.8c0 1.7-2.5 2.3-2.5 3.9" />
            <circle cx="12" cy="17.3" r="0.7" fill="currentColor" stroke="none" />
          </svg>
        </button>

        <div className="counters">
          {solve.origin ? (
            <>
              <span className="puzzle-no">#{solve.origin.puzzleNumber}</span>
              <span className="set-no">set {solve.origin.rollIndex + 1}</span>
            </>
          ) : (
            <>
              <span className="puzzle-no">custom set</span>
              <span className="set-code">{setCode(solve.letters)}</span>
            </>
          )}
        </div>
        </div>
      </header>

      <div className="panel">
        <div
          className="reveal-grid"
          data-revealed={revealed || undefined}
          style={{ ['--cols' as string]: cols, gridTemplateColumns: `repeat(${cols}, var(--reveal-cell))` }}
        >
          {cells}
        </div>
      </div>

      <p className="status" aria-live="polite">
        {revealed
          ? `Twelve letters · ${wordCount} ${wordCount === 1 ? 'word' : 'words'}`
          : 'Twelve dice, one grid. Try it before you look.'}
      </p>

      <div className="actions">
        <a className="btn btn-primary" href={playHref}>
          Play these dice
        </a>
        {!revealed && (
          <button type="button" className="btn btn-quiet" onClick={() => setRevealed(true)}>
            Reveal
          </button>
        )}
      </div>

      {helpOpen && (
        <HowToPlay
          onClose={() => setHelpOpen(false)}
          settings={settings}
          onSettings={(next) => {
            setSettings(next);
            saveSettings(next);
          }}
        />
      )}
    </div>
  );
}
