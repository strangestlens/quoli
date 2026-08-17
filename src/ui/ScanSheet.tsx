import { useEffect, useMemo, useState } from 'react';
import type { ScannedSet } from '../game/scan.ts';
import { scanPhoto, toOutcome } from './scanClient.ts';

/** Every letter the game has. No Q. */
const ALPHABET = [...'ABCDEFGHIJKLMNOPRSTUVWXYZ'];

interface Props {
  photo: Blob;
  onClose: () => void;
  onAccept: (set: ScannedSet, prefill: boolean) => void;
}

type Phase =
  | { kind: 'reading' }
  | { kind: 'review'; set: ScannedSet }
  | { kind: 'error'; message: string };

export function ScanSheet({ photo, onClose, onAccept }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'reading' });
  const [editing, setEditing] = useState<number | null>(null);
  const [prefill, setPrefill] = useState(false);

  useEffect(() => {
    let live = true;
    void scanPhoto(photo).then((outcome) => {
      if (!live) return;
      setPhase(outcome.ok ? { kind: 'review', set: outcome.value } : { kind: 'error', message: outcome.message });
    });
    return () => {
      live = false;
    };
  }, [photo]);

  const correct = (index: number, letter: string) => {
    if (phase.kind !== 'review') return;
    // The player has just told us what the letter is, so it stops being a
    // guess — leaving the ring on would keep drawing the eye to a settled die.
    const tiles = phase.set.tiles.map((tile, i) =>
      i === index ? { ...tile, letter, confidence: 'high' as const } : tile,
    );
    // Re-validate rather than patching: a corrected letter can sort elsewhere,
    // which changes tile IDs and therefore the set's code.
    const next = toOutcome({ layout: phase.set.layout, tiles });
    if (next.ok) setPhase({ kind: 'review', set: next.value });
    setEditing(null);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Check the scan"
        onClick={(e) => e.stopPropagation()}
      >
        {phase.kind === 'reading' && (
          <>
            <h2 className="sheet-title">Reading the dice…</h2>
            <div className="spinner" aria-hidden="true" />
            <p className="sheet-note">This takes a few seconds.</p>
          </>
        )}

        {phase.kind === 'error' && (
          <>
            <h2 className="sheet-title">Couldn't read that</h2>
            <p className="sheet-note sheet-note-warn">{phase.message}</p>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Take another
            </button>
          </>
        )}

        {phase.kind === 'review' && (
          <>
            <h2 className="sheet-title">Does this match?</h2>
            <p className="sheet-sub">
              {phase.set.lowConfidence.length > 0
                ? 'Ringed letters were a guess — check those first.'
                : 'Tap any letter that came out wrong.'}
            </p>

            <ScanGrid set={phase.set} editing={editing} onEdit={setEditing} />

            {editing !== null && (
              <div className="picker" role="group" aria-label="Choose the right letter">
                {ALPHABET.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className="picker-key"
                    onClick={() => correct(editing, letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            )}

            <label className="check">
              <input
                type="checkbox"
                checked={prefill}
                onChange={(e) => setPrefill(e.target.checked)}
              />
              Start from this arrangement
            </label>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAccept(phase.set, prefill)}
            >
              Play these dice
            </button>

            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Take another
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ScanGrid({
  set,
  editing,
  onEdit,
}: {
  set: ScannedSet;
  editing: number | null;
  onEdit: (index: number | null) => void;
}) {
  const { cols, rows, cell } = useMemo(() => {
    const c = Math.max(...set.tiles.map((t) => t.col)) + 1;
    const r = Math.max(...set.tiles.map((t) => t.row)) + 1;
    // The sheet is ~320px of usable width; never grow past a comfortable tap.
    return { cols: c, rows: r, cell: Math.max(22, Math.min(46, Math.floor(320 / c))) };
  }, [set.tiles]);

  return (
    <div
      className="scan-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cell}px)`,
        gridTemplateRows: `repeat(${rows}, ${cell}px)`,
      }}
    >
      {set.tiles.map((tile, index) => (
        <button
          key={`${tile.col},${tile.row}`}
          type="button"
          className="scan-tile"
          data-unsure={tile.confidence === 'low' || undefined}
          data-editing={editing === index || undefined}
          style={{
            gridColumn: tile.col + 1,
            gridRow: tile.row + 1,
            fontSize: cell * 0.5,
          }}
          aria-label={`${tile.letter}${tile.confidence === 'low' ? ', uncertain' : ''}. Tap to change.`}
          onClick={() => onEdit(editing === index ? null : index)}
        >
          {tile.letter}
        </button>
      ))}
    </div>
  );
}
