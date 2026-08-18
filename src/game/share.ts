import { bounds, tileAt, type Board } from './board.ts';

export const SHARE_URL = 'https://quoli.pages.dev';

const FILLED = '\u{1F7E9}'; // 🟩
const EMPTY = '\u{2B1C}'; // ⬜

const FULLWIDTH_A = 0xff21; // Ａ
const IDEOGRAPHIC_SPACE = '　';

/** What the share is about: a dated puzzle, or someone's own dice. */
export type ShareSubject =
  | { readonly kind: 'daily'; readonly puzzleNumber: number; readonly rollIndex: number }
  | { readonly kind: 'custom'; readonly code: string };

export interface ShareMeta {
  readonly subject: ShareSubject;
  readonly wordCount: number;
  readonly tileCount: number;
  /**
   * Set once a board is finished. The message carries the shape; the link
   * carries the grid itself, so the recipient can reveal it or take the dice
   * on themselves.
   */
  readonly solveCode?: string | undefined;
}

function header(meta: ShareMeta): string {
  const { subject } = meta;
  return subject.kind === 'daily'
    ? `Quoli #${subject.puzzleNumber} · roll ${subject.rollIndex + 1}`
    : 'Quoli · custom set';
}

/**
 * A custom set's link carries the dice in it, so whoever opens it gets the
 * same twelve letters and an empty board. A daily link carries the roll, so
 * a friend lands on the one that was actually solved rather than roll 1.
 */
function link(meta: ShareMeta): string {
  if (!SHARE_URL) return '';
  if (meta.solveCode) return `${SHARE_URL}/?solve=${meta.solveCode}`;
  if (meta.subject.kind === 'custom') return `${SHARE_URL}/?set=${meta.subject.code}`;
  return meta.subject.rollIndex === 0
    ? SHARE_URL
    : `${SHARE_URL}/?roll=${meta.subject.rollIndex + 1}`;
}

function withFooter(lines: string[], meta: ShareMeta): string {
  const url = link(meta);
  if (url) lines.push('', url);
  return lines.join('\n');
}

/**
 * Renders the board's tight bounding box row by row.
 * `filled` maps an occupied tile to a string; `blank` fills the gaps.
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
 * The grids on their own, for previewing exactly what a copy will contain.
 * Exported so the share sheet doesn't have to parse them back out of the
 * finished text — which quietly dragged the footer link into the preview.
 */
export function shapeGrid(board: Board): string[] {
  return renderGrid(board, () => FILLED, EMPTY);
}

export function letterGrid(board: Board, letters: readonly string[]): string[] {
  return renderGrid(board, (tileId) => toFullwidth(letters[tileId] ?? '?'), IDEOGRAPHIC_SPACE);
}

/**
 * The default share: silhouette only.
 *
 * Everyone gets the same puzzle each day, so posting the letters spoils it.
 * This carries the shape and the stats without giving the answer away — and
 * for a custom set, the link hands over the dice without the solution.
 */
export function shapeShare(board: Board, meta: ShareMeta): string {
  return withFooter(
    [
      header(meta),
      `${meta.tileCount} letters · ${meta.wordCount} ${meta.wordCount === 1 ? 'word' : 'words'}`,
      '',
      ...shapeGrid(board),
    ],
    meta,
  );
}

/**
 * The opt-in spoiler share.
 *
 * Fullwidth Latin capitals plus the ideographic space, because both get a
 * consistent double-width advance in the fonts iMessage, Slack and Discord
 * use — so the columns line up in proportional text where plain ASCII would
 * ragged out.
 */
export function letterShare(
  board: Board,
  letters: readonly string[],
  meta: ShareMeta,
): string {
  return withFooter([header(meta), '', ...letterGrid(board, letters)], meta);
}

function toFullwidth(ch: string): string {
  const code = ch.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return ch;
  return String.fromCodePoint(FULLWIDTH_A + code - 65);
}
