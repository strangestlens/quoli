import { DIE_COUNT } from './dice.ts';
import { components, type Board, type Coord } from './board.ts';
import { extractWords, orphanTiles, type Word } from './words.ts';

/**
 * Which parts of Q-Less a given mode actually enforces.
 *
 * Every flag is independent, so a mode is a set of them rather than a branch
 * in the checker — which is what keeps another mode a config change rather
 * than a rewrite.
 */
export interface RuleSet {
  /** All twelve dice must be on the board. */
  requireAllTilesPlaced: boolean;
  /** One crossword, not several islands. */
  requireConnected: boolean;
  /** Every tile must sit in a run, and every run must clear minWordLength. */
  requireWordsFormed: boolean;
  minWordLength: 2 | 3;
  /** Needs a dictionary passed to `analyze`; without one, nothing is checked. */
  requireValidWords: boolean;
  allowProperNouns: boolean;
}

/**
 * Free play: the two rules that need no lexicon.
 *
 * All twelve down and one connected shape, which between them are everything
 * a machine can judge without knowing what a word is. Anything past that is
 * left to the player.
 */
export const FREE_RULES: RuleSet = {
  requireAllTilesPlaced: true,
  requireConnected: true,
  requireWordsFormed: false,
  minWordLength: 2,
  requireValidWords: false,
  allowProperNouns: true,
};

export type ViolationCode =
  | 'tiles-unplaced'
  | 'disconnected'
  | 'orphan-tile'
  | 'short-word'
  | 'invalid-word';

/** Whatever can answer "is this a word". Kept minimal so the source can change. */
export interface Dictionary {
  has(word: string): boolean;
}

export type GameMode = 'free' | 'strict';

export interface Settings {
  readonly mode: GameMode;
  /** Rules-on play only: Q-Less proper says three, but two is a common house rule. */
  readonly allowTwoLetterWords: boolean;
}

export const DEFAULT_SETTINGS: Settings = { mode: 'strict', allowTwoLetterWords: false };

/** Q-Less as written on the tin. */
export const STRICT_RULES: RuleSet = {
  requireAllTilesPlaced: true,
  requireConnected: true,
  requireWordsFormed: true,
  minWordLength: 3,
  // Proper nouns need no separate check once words are looked up: the lexicon
  // holds common words only, so a name simply isn't in it.
  requireValidWords: true,
  allowProperNouns: false,
};

export function rulesFor(settings: Settings): RuleSet {
  if (settings.mode === 'free') return FREE_RULES;
  return { ...STRICT_RULES, minWordLength: settings.allowTwoLetterWords ? 2 : 3 };
}

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
  dictionary?: Dictionary | null,
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

  // No dictionary yet — still loading, or offline — means words cannot be
  // judged. Silence beats blocking a finished grid on a fetch that hasn't
  // landed, so this checks nothing rather than failing everything.
  if (rules.requireValidWords && dictionary) {
    for (const word of words) {
      if (word.text.length < rules.minWordLength) continue; // already reported
      if (!dictionary.has(word.text.toLowerCase())) {
        violations.push({
          code: 'invalid-word',
          message: `"${word.text}" isn't a word we know`,
          cells: word.cells,
        });
      }
    }
  }

  return { words, violations, complete: violations.length === 0 && board.size > 0 };
}
