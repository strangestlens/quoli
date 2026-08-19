import { useState } from 'react';
import type { Board } from '../game/board.ts';
import {
  letterGrid,
  letterShare,
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

type Format = 'shape' | 'letters';

export function ShareSheet({ board, letters, meta, onClose }: Props) {
  // The preview is driven by the same choice as the copy, so what you see is
  // always what lands on the clipboard.
  const [format, setFormat] = useState<Format>('shape');
  const [status, setStatus] = useState<{ format: Format; ok: boolean } | null>(null);

  const preview =
    format === 'shape' ? shapeGrid(board).join('\n') : letterGrid(board, letters).join('\n');

  const copy = async () => {
    const text =
      format === 'shape' ? shapeShare(board, meta) : letterShare(board, letters, meta);
    // Report what actually happened rather than assuming success — a copy
    // can genuinely fail outside a secure context.
    const ok = await copyText(text);
    setStatus({ format, ok });
    window.setTimeout(() => setStatus(null), 2400);
  };

  const showing = status?.format === format ? status : null;
  const buttonLabel = showing ? (showing.ok ? 'Copied' : "Couldn't copy") : 'Copy';

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share your grid"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sheet-title">
          {meta.subject.kind === 'daily'
            ? `Solved on set ${meta.subject.rollIndex + 1}`
            : 'Solved a custom set'}
        </h2>
        <p className="sheet-sub">
          {meta.tileCount} letters · {meta.wordCount} {meta.wordCount === 1 ? 'word' : 'words'}
        </p>

        <div className="segmented" role="group" aria-label="What to share">
          <button
            type="button"
            className="segment"
            data-on={format === 'shape' || undefined}
            onClick={() => setFormat('shape')}
          >
            Shape only
          </button>
          <button
            type="button"
            className="segment"
            data-on={format === 'letters' || undefined}
            onClick={() => setFormat('letters')}
          >
            With letters
          </button>
        </div>

        <pre className="share-preview">{preview}</pre>

        <button type="button" className="btn btn-primary" onClick={copy}>
          {buttonLabel}
        </button>

        {showing && !showing.ok ? (
          <p className="sheet-note sheet-note-warn">
            The clipboard is blocked here. Select the grid above and copy it by hand.
          </p>
        ) : format === 'letters' ? (
          <p className="sheet-note sheet-note-warn">
            This gives the answer away. Save it for people who have already played.
          </p>
        ) : meta.subject.kind === 'custom' ? (
          <p className="sheet-note">
            The link carries your dice — whoever opens it gets the same twelve and an empty
            board.
          </p>
        ) : (
          <p className="sheet-note">
            Everyone gets the same dice today, so the shape keeps it a fair fight.
          </p>
        )}

        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Keep tinkering
        </button>
      </div>
    </div>
  );
}
