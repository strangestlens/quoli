import { DICE, FACE_COUNT, type TileId } from './dice.ts';
import { seededRandom } from './rng.ts';

/**
 * Bump this only when you *intend* to invalidate every historical puzzle.
 * It exists so that a needed change to the roll algorithm is a deliberate,
 * visible act rather than an accident of refactoring.
 */
export const SEED_VERSION = 'v1';

/** Puzzle #1. Everything numbers forward from here. */
export const PUZZLE_EPOCH = '2026-01-01';

export const MS_PER_DAY = 86_400_000;

/** A UTC calendar day, `YYYY-MM-DD`. Never local time — the puzzle is global. */
export type DayKey = string;

export interface Roll {
  readonly dayKey: DayKey;
  /** 0 for the day's first roll, incrementing per re-roll. */
  readonly rollIndex: number;
  /** Twelve letters, index-aligned to DICE. */
  readonly letters: readonly string[];
  /** Which face landed up on each die, for rendering the dice themselves. */
  readonly faces: readonly number[];
}

/**
 * The timezone that decides when the puzzle turns over.
 *
 * A fixed zone, deliberately not the player's own: everyone getting the same
 * dice on the same day is the whole point, and a local rollover would hand
 * neighbours in different zones different puzzles. Eastern is the convention
 * daily puzzles follow.
 */
export const PUZZLE_ZONE = 'America/New_York';

const zonedDate = new Intl.DateTimeFormat('en-US', {
  timeZone: PUZZLE_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Index helper, not a clock: maps a day key to a number so puzzle arithmetic
 * works, and back again. Deliberately UTC and deliberately *not* zone-aware —
 * it pairs with dayKeyToMs, and making it local would move every puzzle
 * number by a day. Which day it is *now* is todayKey's job.
 */
export function dayKeyFromMs(ms: number): DayKey {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Which puzzle is today's, by the clock in PUZZLE_ZONE. */
export function todayKey(now: number = Date.now()): DayKey {
  const parts = zonedDate.formatToParts(new Date(now));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function dayKeyToMs(dayKey: DayKey): number {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Human-facing puzzle number. 2026-01-01 is #1. */
export function puzzleNumber(dayKey: DayKey): number {
  return Math.round((dayKeyToMs(dayKey) - dayKeyToMs(PUZZLE_EPOCH)) / MS_PER_DAY) + 1;
}

/**
 * The day a puzzle number refers to.
 *
 * The inverse of puzzleNumber, and the reason a past puzzle needs no
 * backdating: rollFor is pure, so any day's dice can be rebuilt exactly
 * whenever they are asked for.
 */
export function dayKeyForPuzzle(puzzleNumber: number): DayKey {
  return dayKeyFromMs(dayKeyToMs(PUZZLE_EPOCH) + (puzzleNumber - 1) * MS_PER_DAY);
}

/**
 * When the puzzle next turns over, to the minute.
 *
 * Walked rather than calculated: the offset from UTC changes twice a year, so
 * adding a fixed twenty-four hours would be an hour out either side of a
 * daylight-saving switch.
 */
export function nextRolloverMs(now: number = Date.now()): number {
  const today = todayKey(now);

  let ms = now;
  while (todayKey(ms) === today) ms += 3_600_000;
  ms -= 3_600_000;
  while (todayKey(ms) === today) ms += 60_000;

  return ms;
}

/**
 * The whole point of this project.
 *
 * (dayKey, rollIndex) -> the same twelve letters for everyone, forever. One
 * random draw per die, in DICE order.
 */
export function rollFor(dayKey: DayKey, rollIndex: number): Roll {
  const rand = seededRandom(`quoli:${SEED_VERSION}:${dayKey}:${rollIndex}`);
  const faces: number[] = [];
  const letters: string[] = [];

  for (const dieFaces of DICE) {
    const face = Math.floor(rand() * FACE_COUNT);
    faces.push(face);
    letters.push(dieFaces[face]!);
  }

  return { dayKey, rollIndex, letters, faces };
}

/** Letter showing on a given die for a roll. */
export function letterOf(roll: Roll, tileId: TileId): string {
  return roll.letters[tileId]!;
}
