interface Props {
  puzzleNumber: number;
  rollIndex: number;
}

export function Header({ puzzleNumber, rollIndex }: Props) {
  return (
    <header className="header">
      <div className="brand">
        <h1 className="wordmark">
          <span className="wordmark-q">Q</span>uoli
        </h1>
        <p className="tagline">the only Q in the game</p>
      </div>
      <div className="counters">
        <span className="puzzle-no">#{puzzleNumber}</span>
        <span className="roll-no">roll {rollIndex + 1}</span>
      </div>
    </header>
  );
}
