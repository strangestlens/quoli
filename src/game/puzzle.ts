import { rollFor, todayKey, type DayKey } from './roll.ts';
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
}

/**
 * Resolve the puzzle from the URL. `?set=ACCELLNNPPRY` opens that set;
 * anything else falls through to today's daily.
 */
export function parseSearch(search: string, now: number = Date.now()): ParsedSearch {
  const code = new URLSearchParams(search).get('set');
  if (code === null) {
    return { source: dailySource(todayKey(now)), badSetCode: false };
  }

  const custom = customSource(code);
  return custom
    ? { source: custom, badSetCode: false }
    : { source: dailySource(todayKey(now)), badSetCode: true };
}
