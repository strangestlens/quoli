import { bounds, EMPTY_BOARD, place, tileAt, type Board } from './board.ts';
import { DIE_COUNT } from './dice.ts';

/**
 * Packing a finished grid into a link.
 *
 * The readable form this replaced spelled the answer out in the URL, which
 * iMessage renders directly under the silhouette — the reveal was over before
 * anyone tapped it. This is bit-packed and base64url'd instead: 31 characters,
 * fixed regardless of how sprawling the grid is, and nothing legible at a
 * glance.
 *
 * Obfuscation, not encryption. Someone determined can unpack it; the point is
 * that nobody reads it by accident.
 *
 * Layout, 184 bits:
 *   4   format version
 *   14  puzzle number, 0 for a custom set
 *   10  roll index
 *   12x (4 column, 4 row, 5 letter)
 */

const VERSION = 1;
const VERSION_BITS = 4;
const PUZZLE_BITS = 14;
const ROLL_BITS = 10;
const COORD_BITS = 4;
const LETTER_BITS = 5;

const TOTAL_BITS =
  VERSION_BITS + PUZZLE_BITS + ROLL_BITS + DIE_COUNT * (COORD_BITS * 2 + LETTER_BITS);
const TOTAL_BYTES = Math.ceil(TOTAL_BITS / 8);

/** No Q. Index into this is what gets stored, so the order is frozen. */
const ALPHABET = 'ABCDEFGHIJKLMNOPRSTUVWXYZ';

/** Twelve tiles cannot span more than twelve cells either way. */
const MAX_SPAN = DIE_COUNT;
export const MAX_PUZZLE_NUMBER = (1 << PUZZLE_BITS) - 1;
export const MAX_ROLL_INDEX = (1 << ROLL_BITS) - 1;

/** Which daily a grid came from, or null when it was somebody's own dice. */
export interface SolveOrigin {
  readonly puzzleNumber: number;
  readonly rollIndex: number;
}

export interface Solve {
  /** Letters indexed by tile, in reading order. */
  readonly letters: readonly string[];
  readonly board: Board;
  readonly origin: SolveOrigin | null;
}

export function encodeSolve(
  board: Board,
  letters: readonly string[],
  origin: SolveOrigin | null,
): string {
  const b = bounds(board);
  if (!b) return '';

  let bits =
    bin(VERSION, VERSION_BITS) +
    bin(origin ? origin.puzzleNumber : 0, PUZZLE_BITS) +
    bin(origin ? origin.rollIndex : 0, ROLL_BITS);

  // Reading order, so the same board always packs to the same code.
  for (let r = b.minR; r <= b.maxR; r++) {
    for (let c = b.minC; c <= b.maxC; c++) {
      const tileId = tileAt(board, c, r);
      if (tileId === undefined) continue;
      const letter = (letters[tileId] ?? '').toUpperCase();
      bits +=
        bin(c - b.minC, COORD_BITS) +
        bin(r - b.minR, COORD_BITS) +
        bin(Math.max(0, ALPHABET.indexOf(letter)), LETTER_BITS);
    }
  }

  return toBase64Url(bitsToBytes(bits.padEnd(TOTAL_BITS, '0')));
}

/**
 * Read a grid back, or null if it isn't one.
 *
 * Strict on purpose: a link that decoded to the wrong board would show
 * somebody else's answer as though it were the sender's.
 */
export function decodeSolve(code: string): Solve | null {
  const bytes = fromBase64Url(code.trim());
  if (!bytes || bytes.length !== TOTAL_BYTES) return null;

  const bits = bytesToBits(bytes);
  let at = 0;
  const take = (width: number) => {
    const value = parseInt(bits.slice(at, at + width), 2);
    at += width;
    return value;
  };

  if (take(VERSION_BITS) !== VERSION) return null;

  const puzzleNumber = take(PUZZLE_BITS);
  const rollIndex = take(ROLL_BITS);

  let board: Board = EMPTY_BOARD;
  const letters: string[] = [];
  const seen = new Set<string>();

  for (let tileId = 0; tileId < DIE_COUNT; tileId++) {
    const c = take(COORD_BITS);
    const r = take(COORD_BITS);
    const letter = ALPHABET[take(LETTER_BITS)];

    if (letter === undefined) return null;
    if (c >= MAX_SPAN || r >= MAX_SPAN) return null;
    if (seen.has(`${c},${r}`)) return null;
    seen.add(`${c},${r}`);

    board = place(board, tileId, { c, r });
    letters.push(letter);
  }

  // A real grid is tight to its own bounds; anything else is a mangled link.
  const b = bounds(board)!;
  if (b.minC !== 0 || b.minR !== 0) return null;

  return {
    letters,
    board,
    origin: puzzleNumber === 0 ? null : { puzzleNumber, rollIndex },
  };
}

const bin = (value: number, width: number) => value.toString(2).padStart(width, '0');

function bitsToBytes(bits: string): Uint8Array {
  const bytes = new Uint8Array(TOTAL_BYTES);
  for (let i = 0; i < TOTAL_BYTES; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

const bytesToBits = (bytes: Uint8Array) => [...bytes].map((b) => bin(b, 8)).join('');

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code: string): Uint8Array | null {
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}
