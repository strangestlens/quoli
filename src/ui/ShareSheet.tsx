import { useState } from 'react';
import type { Board } from '../game/board.ts';
import { asciiShare, letterShare, shapeShare, type ShareMeta } from '../game/share.ts';
import { copyText } from './clipboard.ts';

interface Props {
  board: Board;
  letters: readonly string[];
  meta: ShareMeta;
  onClose: () => void;
}

type Format = 'shape' | 'letters' | 'ascii';

export function ShareSheet({ board, letters, meta, onClose }: Props) {
  const [status, setStatus] = useState<{ format: Format; ok: boolean } | null>(null);

  const texts: Record<Format, string> = {
    shape: shapeShare(board, meta),
    letters: letterShare(board, letters, meta),
    ascii: asciiShare(board, letters, meta),
  };

  const copy = async (format: Format) => {
    // Report what actually happened rather than assuming success — a copy
    // can genuinely fail outside a secure context.
    const ok = await copyText(texts[format]);
    setStatus({ format, ok });
    window.setTimeout(() => setStatus(null), 2400);
  };

  const failed = status !== null && !status.ok;

  const label = (format: Format, text: string) => {
    if (status?.format !== format) return text;
    return status.ok ? 'Copied' : "Couldn't copy";
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Share your grid"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sheet-title">Solved on roll {meta.rollIndex + 1}</h2>
        <p className="sheet-sub">
          {meta.tileCount} letters · {meta.wordCount} {meta.wordCount === 1 ? 'word' : 'words'}
        </p>

        <pre className="share-preview" aria-hidden="true">
          {texts.shape.split('\n').slice(2).join('\n').trim()}
        </pre>

        <button type="button" className="btn btn-primary" onClick={() => copy('shape')}>
          {label('shape', 'Copy result')}
        </button>

        {failed ? (
          <p className="sheet-note sheet-note-warn">
            The clipboard is blocked here. Select the grid above and copy it by hand.
          </p>
        ) : (
          <p className="sheet-note">
            Everyone gets the same dice today, so the shape keeps it a fair fight.
          </p>
        )}

        <div className="sheet-secondary">
          <button type="button" className="btn btn-quiet" onClick={() => copy('letters')}>
            {label('letters', 'Copy with letters')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => copy('ascii')}>
            {label('ascii', 'Copy as plain text')}
          </button>
        </div>

        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Keep tinkering
        </button>
      </div>
    </div>
  );
}
