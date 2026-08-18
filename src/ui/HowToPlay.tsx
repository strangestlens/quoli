interface Props {
  onClose: () => void;
}

/**
 * The rules, and how this particular version of them works.
 *
 * Written to be read once and then ignored, so it leads with the game and
 * leaves the app's own mechanics further down. The rules section says plainly
 * which parts are enforced today, because half of them are still on trust.
 */
export function HowToPlay({ onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet sheet-tall"
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sheet-title">How to play</h2>

        <div className="guide">
          <p className="guide-lede">
            Twelve dice, one grid. Roll them, then use every letter to build a single
            interlocking crossword — a Scrabble board with no board.
          </p>

          <h3>The rules</h3>
          <ul>
            <li>Use all twelve letters.</li>
            <li>Everything interlocks: one shape, no islands.</li>
            <li>Words read across and down, three letters or longer.</li>
            <li>No proper nouns.</li>
          </ul>
          <p className="guide-note">
            Today only the first two are enforced. The rest are on trust until word
            checking arrives — you can finish a grid that spells nonsense.
          </p>

          <h3>Placing dice</h3>
          <p>
            Drag a die onto the grid, or tap it and then tap where it goes. Tap a placed die
            to pick it back up, and drop one onto another to swap them.
          </p>

          <h3>Re-rolling</h3>
          <p>
            Some rolls genuinely can't be solved. Re-roll for a fresh twelve, and use the
            counter in the corner to step back to an earlier set. Everyone gets the same dice
            each day, and the same re-rolls in the same order — so a roll you found brutal was
            brutal for everyone.
          </p>

          <h3>Scanning real dice</h3>
          <p>
            The camera button reads a physical set. Lay the dice out — either in a tidy block
            or as a finished grid — and shoot straight down with every die upright and square
            to the frame. Orientation matters more than it sounds: N and Z are the same shape
            turned a quarter turn, as are M and W.
          </p>
          <p>
            You'll see what it read before anything is committed, with uncertain letters
            ringed. Tap any that came out wrong.
          </p>

          <h3>Sharing</h3>
          <p>
            A finished grid copies as a silhouette, so the message gives nothing away. The
            link inside carries the real thing: whoever opens it sees the shape, then chooses
            to reveal your answer or take the same dice on themselves.
          </p>
        </div>

        <button type="button" className="btn btn-primary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
