import type { PuzzleSource } from '../game/puzzle.ts';
import { puzzleNumber } from '../game/roll.ts';

interface Props {
  source: PuzzleSource;
  onPhoto: (photo: File) => void;
  onPreviousRoll: () => void;
}

export function Header({ source, onPhoto, onPreviousRoll }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <h1 className="wordmark">
          <span className="wordmark-q">Q</span>uoli
        </h1>
        <p className="tagline">the only Q in the game</p>
      </div>

      <div className="header-right">
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
              {/* Re-rolling used to be a one-way door. Tapping the counter walks
                  back a roll at a time, so nobody is stranded on a set they
                  can't solve — and roll 1 is always a few taps away. */}
              {source.rollIndex > 0 ? (
                <button
                  type="button"
                  className="roll-back"
                  onClick={onPreviousRoll}
                  aria-label={`Back to roll ${source.rollIndex}`}
                >
                  <span aria-hidden="true">‹</span> roll {source.rollIndex + 1}
                </button>
              ) : (
                <span className="roll-no">roll 1</span>
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
