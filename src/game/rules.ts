import { DIE_COUNT } from './dice.ts';
import { components, type Board, type Coord } from './board.ts';
import { extractWords, orphanTiles, type Word } from './words.ts';

/**
 * Which parts of Q-Less we actually enforce.
 *
 * Phase 1 enforces only "all twelve tiles are down" — the board can be
 * anything the player likes. The rest of the flags exist now so that turning
 * real rules on later is a config change rather than a rewrite.
 */
export interface RuleSet {
  /** All twelve dice must be on the board. */
  requireAllTilesPlaced: boolean;
  /** One crossword, not several islands. */
  requireConnected: boolean;
  /** Every tile must sit in a run, and every run must clear minWordLength. */
  requireWordsFormed: boolean;
  minWordLength: 2 | 3;
  /** Needs a dictionary — phase 3. */
  requireValidWords: boolean;
  allowProperNouns: boolean;
}

export const PHASE_1_RULES: RuleSet = {
  requireAllTilesPlaced: true,
  requireConnected: true,
  requireWordsFormed: false,
  minWordLength: 2,
  requireValidWords: false,
  allowProperNouns: true,
};

/** Q-Less as written on the tin. Not yet reachable — the dictionary is phase 3. */
export const CLASSIC_RULES: RuleSet = {
  requireAllTilesPlaced: true,
  requireConnected: true,
  requireWordsFormed: true,
  minWordLength: 3,
  requireValidWords: false,
  allowProperNouns: false,
};

export type ViolationCode =
  | 'tiles-unplaced'
  | 'disconnected'
  | 'orphan-tile'
  | 'short-word';

export interface Violation {
  readonly code: ViolationCode;
  readonly message: string;
  readonly cells?: readonly Coord[];
}

export interface Analysis {
  readonly words: readonly Word[];
  readonly violations: readonly Violation[];
  readonly complete: boolean;
}

export function analyze(
  board: Board,
  letters: readonly string[],
  rules: RuleSet,
): Analysis {
  const words = extractWords(board, letters);
  const violations: Violation[] = [];

  if (rules.requireAllTilesPlaced && board.size < DIE_COUNT) {
    const left = DIE_COUNT - board.size;
    violations.push({
      code: 'tiles-unplaced',
      message: `${left} ${left === 1 ? 'die' : 'dice'} still in the tray`,
    });
  }

  if (rules.requireConnected) {
    const groups = components(board);
    if (groups.length > 1) {
      const stranded = groups
        .slice(1)
        .flat()
        .map((t) => board.get(t)!);
      violations.push({
        code: 'disconnected',
        message: `${groups.length} separate groups — everything must interlock`,
        cells: stranded,
      });
    }
  }

  if (rules.requireWordsFormed) {
    const orphans = orphanTiles(board, words);
    if (orphans.length > 0) {
      violations.push({
        code: 'orphan-tile',
        message: `${orphans.length} ${orphans.length === 1 ? 'letter is' : 'letters are'} not part of a word`,
        cells: orphans.map((t) => board.get(t)!),
      });
    }

    for (const word of words) {
      if (word.text.length < rules.minWordLength) {
        violations.push({
          code: 'short-word',
          message: `"${word.text}" is shorter than ${rules.minWordLength} letters`,
          cells: word.cells,
        });
      }
    }
  }

  return { words, violations, complete: violations.length === 0 && board.size > 0 };
}
