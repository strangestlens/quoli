import { EMPTY_BOARD, place, type Board } from './board.ts';
import { DIE_COUNT, type TileId } from './dice.ts';

/**
 * Turning a photo of physical dice into a playable set.
 *
 * Everything here is pure and DOM-free so the Worker can run the exact same
 * validation the client does — a malformed model response is rejected before
 * it ever reaches the browser, and the browser doesn't have to trust the
 * Worker either.
 */

export type ScanLayout = 'grid' | 'crossword';
export type Confidence = 'high' | 'low';

/** One die as reported by the vision model, before any validation. */
export interface ScannedTile {
  readonly letter: string;
  readonly col: number;
  readonly row: number;
  readonly confidence: Confidence;
}

export interface ScanResponse {
  readonly layout: ScanLayout;
  readonly tiles: readonly ScannedTile[];
}

export type ScanErrorCode =
  | 'malformed'
  | 'wrong-tile-count'
  | 'invalid-letter'
  | 'contains-q'
  | 'invalid-coordinates'
  | 'overlapping-tiles';

export interface ScanError {
  readonly code: ScanErrorCode;
  /** Shown to the player, so it says what to do rather than what broke. */
  readonly message: string;
}

export interface ScannedSet {
  readonly layout: ScanLayout;
  /** Letters indexed by TileId, sorted so the same dice always yield the same set. */
  readonly letters: readonly string[];
  /** Where each die sat in the photo, normalised so the top-left is (0,0). */
  readonly board: Board;
  /** Dice the model wasn't sure about — surfaced first in the read-back. */
  readonly lowConfidence: readonly TileId[];
}

export type ScanResult =
  | { readonly ok: true; readonly value: ScannedSet }
  | { readonly ok: false; readonly error: ScanError };

const LETTER = /^[A-Z]$/;

const fail = (code: ScanErrorCode, message: string): ScanResult => ({
  ok: false,
  error: { code, message },
});

/**
 * Validate and normalise a vision model's reading of a photo.
 *
 * Takes `unknown` on purpose: this runs on a model response, which is
 * schema-constrained but never guaranteed.
 */
export function validateScan(response: unknown): ScanResult {
  if (!isScanResponse(response)) {
    return fail('malformed', "Couldn't read that photo. Try again, straight down.");
  }

  const { layout, tiles } = response;

  if (tiles.length !== DIE_COUNT) {
    const found = tiles.length;
    return fail(
      'wrong-tile-count',
      `Found ${found} ${found === 1 ? 'die' : 'dice'}, need ${DIE_COUNT}. Retake with all twelve in frame.`,
    );
  }

  for (const tile of tiles) {
    const letter = tile.letter.toUpperCase();

    if (letter === 'Q') {
      return fail('contains-q', "Read a Q — there's no Q in this game. Retake the photo.");
    }
    if (!LETTER.test(letter)) {
      return fail(
        'invalid-letter',
        "Couldn't make out one of the letters. Retake with the dice upright and evenly lit.",
      );
    }
    if (!Number.isInteger(tile.col) || !Number.isInteger(tile.row)) {
      return fail(
        'invalid-coordinates',
        "Couldn't work out the layout. Retake straight down, with the dice square to the frame.",
      );
    }
  }

  const seen = new Set<string>();
  for (const tile of tiles) {
    const cell = `${tile.col},${tile.row}`;
    if (seen.has(cell)) {
      return fail(
        'overlapping-tiles',
        'Two dice read as the same square. Spread them out a little and retake.',
      );
    }
    seen.add(cell);
  }

  // Sort by letter so a given set of dice always produces the same tile IDs
  // and the same share code, whichever order the model happened to list them.
  // Position breaks ties between duplicate letters, keeping it deterministic.
  const ordered = [...tiles].sort(
    (a, b) =>
      a.letter.localeCompare(b.letter) || a.row - b.row || a.col - b.col,
  );

  const minC = Math.min(...ordered.map((t) => t.col));
  const minR = Math.min(...ordered.map((t) => t.row));

  let board: Board = EMPTY_BOARD;
  const letters: string[] = [];
  const lowConfidence: TileId[] = [];

  ordered.forEach((tile, tileId) => {
    letters.push(tile.letter.toUpperCase());
    board = place(board, tileId, { c: tile.col - minC, r: tile.row - minR });
    if (tile.confidence === 'low') lowConfidence.push(tileId);
  });

  return { ok: true, value: { layout, letters, board, lowConfidence } };
}

function isScanResponse(value: unknown): value is ScanResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ScanResponse>;

  if (candidate.layout !== 'grid' && candidate.layout !== 'crossword') return false;
  if (!Array.isArray(candidate.tiles)) return false;

  return candidate.tiles.every(
    (tile: unknown) =>
      typeof tile === 'object' &&
      tile !== null &&
      typeof (tile as ScannedTile).letter === 'string' &&
      typeof (tile as ScannedTile).col === 'number' &&
      typeof (tile as ScannedTile).row === 'number' &&
      ((tile as ScannedTile).confidence === 'high' ||
        (tile as ScannedTile).confidence === 'low'),
  );
}

/**
 * The shareable form of a set: its twelve letters, sorted.
 *
 * Canonical on purpose — rescanning the same dice produces the same code, so
 * a set can't accidentally fork into two links.
 */
export function setCode(letters: readonly string[]): string {
  return [...letters].sort().join('');
}

/** Parse a `?set=` code back into letters, or null if it isn't a valid set. */
export function parseSetCode(code: string): string[] | null {
  const letters = code.trim().toUpperCase().split('');
  if (letters.length !== DIE_COUNT) return null;
  if (letters.some((l) => !LETTER.test(l) || l === 'Q')) return null;
  return letters.sort();
}
