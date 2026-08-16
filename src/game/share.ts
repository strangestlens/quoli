import { bounds, tileAt, type Board } from './board.ts';

/** Set once there's a domain. Omitted from shares while empty. */
export const SHARE_URL = '';

const FILLED = '\u{1F7E9}'; // 🟩
const EMPTY = '\u{2B1C}'; // ⬜

const FULLWIDTH_A = 0xff21; // Ａ
const IDEOGRAPHIC_SPACE = '　';

export interface ShareMeta {
  readonly puzzleNumber: number;
  /** 0-based internally; shares display it 1-based. */
  readonly rollIndex: number;
  readonly wordCount: number;
  readonly tileCount: number;
}

function header(meta: ShareMeta): string {
  return `Quoli #${meta.puzzleNumber} · roll ${meta.rollIndex + 1}`;
}

function withFooter(lines: string[]): string {
  if (SHARE_URL) lines.push('', SHARE_URL);
  return lines.join('\n');
}

/**
 * Renders the board's tight bounding box row by row.
 * `cell` maps an occupied tile to a string, or undefined to a blank.
 */
function renderGrid(
  board: Board,
  filled: (tileId: number) => string,
  blank: string,
): string[] {
  const b = bounds(board);
  if (!b) return [];

  const rows: string[] = [];
  for (let r = b.minR; r <= b.maxR; r++) {
    let line = '';
    for (let c = b.minC; c <= b.maxC; c++) {
      const tileId = tileAt(board, c, r);
      line += tileId === undefined ? blank : filled(tileId);
    }
    rows.push(line);
  }
  return rows;
}

/**
 * The default share: silhouette only.
 *
 * Everyone gets the same puzzle each day, so posting the letters spoils it.
 * This carries the shape and the stats without giving the answer away.
 */
export function shapeShare(board: Board, meta: ShareMeta): string {
  const grid = renderGrid(board, () => FILLED, EMPTY);
  return withFooter([
    header(meta),
    `${meta.tileCount} letters · ${meta.wordCount} ${meta.wordCount === 1 ? 'word' : 'words'}`,
    '',
    ...grid,
  ]);
}

/**
 * The opt-in spoiler share.
 *
 * Fullwidth Latin capitals plus the ideographic space, because both get a
 * consistent double-width advance in the fonts iMessage, Slack and Discord
 * use — so the columns line up in proportional text where plain ASCII would
 * ragged out. Not universal; asciiShare is the escape hatch.
 */
export function letterShare(
  board: Board,
  letters: readonly string[],
  meta: ShareMeta,
): string {
  const grid = renderGrid(board, (tileId) => toFullwidth(letters[tileId] ?? '?'), IDEOGRAPHIC_SPACE);
  return withFooter([header(meta), '', ...grid]);
}

/** Plain ASCII fallback, meant to be pasted inside a code fence. */
export function asciiShare(
  board: Board,
  letters: readonly string[],
  meta: ShareMeta,
): string {
  const grid = renderGrid(board, (tileId) => letters[tileId] ?? '?', '.');
  return withFooter([header(meta), '', ...grid]);
}

function toFullwidth(ch: string): string {
  const code = ch.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return ch;
  return String.fromCodePoint(FULLWIDTH_A + code - 65);
}
