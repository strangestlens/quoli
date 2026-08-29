import { bounds, tileAt, type Board } from './board.ts';
import { puzzlePath } from './puzzle.ts';

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
    ? `Quoli #${subject.puzzleNumber} · set ${subject.rollIndex + 1}`
    : 'Quoli · custom set';
}

/**
 * The link that hands over the dice and nothing else.
 *
 * A custom set carries its twelve letters in the code. A daily names the
 * puzzle outright rather than leaning on "today", because the message beside
 * it lists the letters — and a bare link would quietly serve different ones
 * to anyone who opened it after midnight.
 */
function setLink(subject: ShareSubject): string {
  if (!SHARE_URL) return '';
  return subject.kind === 'custom'
    ? `${SHARE_URL}/?set=${subject.code}`
    : SHARE_URL + puzzlePath('/', subject.puzzleNumber, subject.rollIndex);
}

/** A finished grid points at itself; an unfinished one can only offer the dice. */
function gridLink(meta: ShareMeta): string {
  if (!SHARE_URL) return '';
  return meta.solveCode ? `${SHARE_URL}/?solve=${meta.solveCode}` : setLink(meta.subject);
}

function withFooter(lines: string[], url: string): string {
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
 * The dice on their own, sorted — the same order `setCode` uses, so the row
 * reads as the set's identity rather than as a hint about where anything goes.
 */
export function setLine(letters: readonly string[]): string {
  return [...letters].sort().map(toFullwidth).join('');
}

/**
 * Share the dice: an invitation, not a result.
 *
 * Always available, because it gives nothing away — everyone playing the
 * daily gets these twelve anyway, and a custom set is worth nothing to a
 * friend without them.
 */
export function setShare(letters: readonly string[], meta: ShareMeta): string {
  return withFooter(
    [header(meta), 'Twelve dice, one grid.', '', setLine(letters)],
    setLink(meta.subject),
  );
}

/**
 * The default way to share a finished board: silhouette only.
 *
 * Everyone gets the same puzzle each day, so posting the letters spoils it.
 * This carries the shape and the stats without giving the answer away.
 */
export function shapeShare(board: Board, meta: ShareMeta): string {
  return withFooter(
    [
      header(meta),
      `${meta.tileCount} letters · ${meta.wordCount} ${meta.wordCount === 1 ? 'word' : 'words'}`,
      '',
      ...shapeGrid(board),
    ],
    gridLink(meta),
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
  return withFooter([header(meta), '', ...letterGrid(board, letters)], gridLink(meta));
}

function toFullwidth(ch: string): string {
  const code = ch.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return ch;
  return String.fromCodePoint(FULLWIDTH_A + code - 65);
}
