import { useState } from 'react';
import type { Board } from '../game/board.ts';
import {
  letterGrid,
  letterShare,
  setLine,
  setShare,
  shapeGrid,
  shapeShare,
  type ShareMeta,
} from '../game/share.ts';
import { copyText } from './clipboard.ts';

interface Props {
  board: Board;
  letters: readonly string[];
  meta: ShareMeta;
  onClose: () => void;
}

/**
 * The three things there are to send, in order of how much they give away:
 * the dice you were dealt, the shape you made of them, and the answer.
 */
type Mode = 'set' | 'shape' | 'letters';

export function ShareSheet({ board, letters, meta, onClose }: Props) {
  // A finished board has a grid worth showing off, so that is what the sheet
  // opens on — it is also the one that auto-opens on the last placement. With
  // nothing finished there is only the set, and no choice to present.
  const solved = meta.solveCode !== undefined;
  const [mode, setMode] = useState<Mode>(solved ? 'shape' : 'set');
  const [status, setStatus] = useState<{ mode: Mode; ok: boolean } | null>(null);

  // The preview is driven by the same choice as the copy, so what you see is
  // always what lands on the clipboard.
  const preview =
    mode === 'set'
      ? setLine(letters)
      : mode === 'shape'
        ? shapeGrid(board).join('\n')
        : letterGrid(board, letters).join('\n');

  const copy = async () => {
    const text =
      mode === 'set'
        ? setShare(letters, meta)
        : mode === 'shape'
          ? shapeShare(board, meta)
          : letterShare(board, letters, meta);
    // Report what actually happened rather than assuming success — a copy
    // can genuinely fail outside a secure context.
    const ok = await copyText(text);
    setStatus({ mode, ok });
    window.setTimeout(() => setStatus(null), 2400);
  };

  const showing = status?.mode === mode ? status : null;
  const buttonLabel = showing ? (showing.ok ? 'Copied' : "Couldn't copy") : 'Copy';

  const { subject } = meta;
  const daily = subject.kind === 'daily';

  // The heading describes the game, not the selected mode, so it holds still
  // while you flick between them.
  const title = solved
    ? daily
      ? `Solved on set ${subject.rollIndex + 1}`
      : 'Solved a custom set'
    : daily
      ? `Quoli #${subject.puzzleNumber} · set ${subject.rollIndex + 1}`
      : 'Quoli · custom set';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sheet-title">{title}</h2>
        {solved && (
          <p className="sheet-sub">
            {meta.tileCount} letters · {meta.wordCount}{' '}
            {meta.wordCount === 1 ? 'word' : 'words'}
          </p>
        )}

        {/* Only a finished board has more than one thing to send. Two disabled
            segments would just raise the question of what unlocks them. */}
        {solved && (
          <div className="segmented" role="group" aria-label="What to share">
            <button
              type="button"
              className="segment"
              data-on={mode === 'set' || undefined}
              onClick={() => setMode('set')}
            >
              The dice
            </button>
            <button
              type="button"
              className="segment"
              data-on={mode === 'shape' || undefined}
              onClick={() => setMode('shape')}
            >
              My grid
            </button>
            <button
              type="button"
              className="segment"
              data-on={mode === 'letters' || undefined}
              onClick={() => setMode('letters')}
            >
              With letters
            </button>
          </div>
        )}

        <pre className="share-preview">{preview}</pre>

        <button type="button" className="btn btn-primary" onClick={copy}>
          {buttonLabel}
        </button>

        {showing && !showing.ok ? (
          <p className="sheet-note sheet-note-warn">
            The clipboard is blocked here. Select the grid above and copy it by hand.
          </p>
        ) : mode === 'letters' ? (
          <p className="sheet-note sheet-note-warn">
            This gives the answer away. Save it for people who have already played.
          </p>
        ) : mode === 'shape' ? (
          <p className="sheet-note">
            The shape gives nothing away, and the link keeps the letters hidden until
            they choose to look.
          </p>
        ) : daily ? (
          <p className="sheet-note">
            The link opens this exact set, whenever they get around to it.
          </p>
        ) : (
          <p className="sheet-note">
            The link carries your dice — whoever opens it gets the same twelve and an empty
            board.
          </p>
        )}

        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {solved ? 'Keep tinkering' : 'Back to the grid'}
        </button>
      </div>
    </div>
  );
}
