import type { PuzzleSource } from '../game/puzzle.ts';
import { puzzleNumber } from '../game/roll.ts';

interface Props {
  source: PuzzleSource;
}

export function Header({ source }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <h1 className="wordmark">
          <span className="wordmark-q">Q</span>uoli
        </h1>
        <p className="tagline">the only Q in the game</p>
      </div>

      <div className="counters">
        {source.kind === 'daily' ? (
          <>
            <span className="puzzle-no">#{puzzleNumber(source.dayKey)}</span>
            <span className="roll-no">roll {source.rollIndex + 1}</span>
          </>
        ) : (
          <>
            <span className="puzzle-no">custom set</span>
            <span className="set-code">{source.code}</span>
          </>
        )}
      </div>
    </header>
  );
}
