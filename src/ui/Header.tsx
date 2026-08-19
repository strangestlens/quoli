import type { PuzzleSource } from '../game/puzzle.ts';
import { puzzleNumber } from '../game/roll.ts';

interface Props {
  source: PuzzleSource;
  onPhoto: (photo: File) => void;
  onPreviousRoll: () => void;
  onHelp: () => void;
}

export function Header({ source, onPhoto, onPreviousRoll, onHelp }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <h1 className="wordmark">
          <span className="wordmark-q">Q</span>uoli
        </h1>
        <p className="tagline">the only Q in the game</p>
      </div>

      <div className="header-right">
        <button type="button" className="icon-btn" onClick={onHelp} title="How to play">
          <span className="sr-only">How to play</span>
          <HelpIcon />
        </button>

        {/* A label wrapping the input keeps the camera on the user's own tap —
            programmatically clicking a file input is blocked on iOS. */}
        <label className="icon-btn" title="Scan physical dice">
          <span className="sr-only">Scan physical dice</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPhoto(file);
              // Let the same photo be picked twice in a row.
              e.target.value = '';
            }}
          />
          <CameraIcon />
        </label>

        <div className="counters">
          {source.kind === 'daily' ? (
            <>
              <span className="puzzle-no">#{puzzleNumber(source.dayKey)}</span>
              {/* Nothing here on the first set of dice. A bare "roll 1" in the
                  corner reads like "level 1" — it announces a sequence before
                  one exists, which is most of why re-rolling looked like step
                  two of a game rather than a fresh start. Once there really is
                  a second, this is both the tally and the way back. */}
              {source.rollIndex > 0 && (
                <button
                  type="button"
                  className="roll-back"
                  onClick={onPreviousRoll}
                  aria-label={`Back to roll ${source.rollIndex}`}
                >
                  <span aria-hidden="true">‹</span> roll {source.rollIndex + 1}
                </button>
              )}
            </>
          ) : (
            <>
              <span className="puzzle-no">custom set</span>
              <span className="set-code">{source.code}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function HelpIcon() {
  return (
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
  );
}

function CameraIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-1.9a1 1 0 0 1 .9-.5h6.6a1 1 0 0 1 .9.5L17.3 7h2.2A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}
