import { dayKeyForPuzzle, rollFor, todayKey, type DayKey } from './roll.ts';
import { parseSetCode } from './scan.ts';

/**
 * Where a puzzle's twelve letters come from.
 *
 * The daily puzzle derives them from the UTC date; a custom set carries them
 * directly, having come off a photo of someone's physical dice. Custom sets
 * hold their letters rather than their code alone, so an invalid set can't
 * be represented — `customSource` is the only way to build one.
 */
export type PuzzleSource = DailySource | CustomSource;

export interface DailySource {
  readonly kind: 'daily';
  readonly dayKey: DayKey;
  readonly rollIndex: number;
}

export interface CustomSource {
  readonly kind: 'custom';
  /** Canonical (sorted) twelve-letter code — the `?set=` value. */
  readonly code: string;
  readonly letters: readonly string[];
}

export function dailySource(dayKey: DayKey, rollIndex = 0): DailySource {
  return { kind: 'daily', dayKey, rollIndex };
}

/** Build a custom source, or null if the code isn't twelve valid letters. */
export function customSource(code: string): CustomSource | null {
  const letters = parseSetCode(code);
  if (!letters) return null;
  return { kind: 'custom', code: letters.join(''), letters };
}

export function lettersFor(source: PuzzleSource): readonly string[] {
  return source.kind === 'daily'
    ? rollFor(source.dayKey, source.rollIndex).letters
    : source.letters;
}

/** Only the daily puzzle can be re-rolled; a custom set is the dice you were handed. */
export function canReroll(source: PuzzleSource): boolean {
  return source.kind === 'daily';
}

export interface ParsedSearch {
  readonly source: PuzzleSource;
  /** A `?set=` was present but unusable — worth telling the player. */
  readonly badSetCode: boolean;
  /**
   * The URL named a roll outright. It overrides whatever roll was saved,
   * which is what makes a shared link land on the roll that was solved
   * rather than on wherever the recipient happened to leave off.
   */
  readonly explicitRoll: boolean;
  /**
   * The URL named a specific past puzzle. Today's rollover prompt has to stay
   * quiet in that case — the player asked for an old one on purpose.
   */
  readonly explicitPuzzle: boolean;
}

/** Rolls beyond this are certainly a mangled link, not a real game. */
const MAX_ROLL = 999;

/**
 * `?roll=` is one-based for humans; rolls count from zero internally.
 * Anything unparseable falls back to the first roll rather than erroring —
 * a bad roll in a link should still give you a playable puzzle.
 */
function rollIndexFrom(raw: string | null): { rollIndex: number; explicit: boolean } {
  if (raw === null) return { rollIndex: 0, explicit: false };
  const roll = Number(raw);
  if (!Number.isInteger(roll) || roll < 1 || roll > MAX_ROLL) {
    return { rollIndex: 0, explicit: false };
  }
  return { rollIndex: roll - 1, explicit: true };
}

/**
 * Resolve the puzzle from the URL. `?set=ACCELLNNPPRY` opens that set,
 * `?roll=3` opens today's third roll, and anything else is today's first.
 */
export function parseSearch(search: string, now: number = Date.now()): ParsedSearch {
  const params = new URLSearchParams(search);
  const code = params.get('set');

  if (code !== null) {
    const custom = customSource(code);
    return custom
      ? { source: custom, badSetCode: false, explicitRoll: false, explicitPuzzle: false }
      : {
          source: dailySource(todayKey(now)),
          badSetCode: true,
          explicitRoll: false,
          explicitPuzzle: false,
        };
  }

  const { rollIndex, explicit } = rollIndexFrom(params.get('roll'));
  const puzzle = puzzleNumberFrom(params.get('puzzle'));

  // A named puzzle can be any day, past or future — rollFor is pure, so its
  // dice rebuild exactly. That is what lets a shared grid keep its identity
  // instead of decaying into "custom set" the next morning.
  return {
    source: dailySource(puzzle === null ? todayKey(now) : dayKeyForPuzzle(puzzle), rollIndex),
    badSetCode: false,
    explicitRoll: explicit,
    explicitPuzzle: puzzle !== null,
  };
}

/** Puzzles beyond this are a mangled link, not a real day. */
const MAX_PUZZLE = 16383;

function puzzleNumberFrom(raw: string | null): number | null {
  if (raw === null) return null;
  const puzzle = Number(raw);
  return Number.isInteger(puzzle) && puzzle >= 1 && puzzle <= MAX_PUZZLE ? puzzle : null;
}

/** The URL for a specific daily, used by shared grids to keep their identity. */
export function puzzlePath(
  pathname: string,
  puzzleNumber: number,
  rollIndex: number,
): string {
  const roll = rollIndex === 0 ? '' : `&roll=${rollIndex + 1}`;
  return `${pathname}?puzzle=${puzzleNumber}${roll}`;
}

/** The URL for a given roll — bare on the first, since the date says it all. */
export function rollPath(pathname: string, rollIndex: number): string {
  return rollIndex === 0 ? pathname : `${pathname}?roll=${rollIndex + 1}`;
}
