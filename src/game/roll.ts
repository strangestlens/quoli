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

export function dayKeyFromMs(ms: number): DayKey {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(now: number = Date.now()): DayKey {
  return dayKeyFromMs(now);
}

export function dayKeyToMs(dayKey: DayKey): number {
  const [y, m, d] = dayKey.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Human-facing puzzle number. 2026-01-01 is #1. */
export function puzzleNumber(dayKey: DayKey): number {
  return Math.round((dayKeyToMs(dayKey) - dayKeyToMs(PUZZLE_EPOCH)) / MS_PER_DAY) + 1;
}

/** Epoch ms of the next UTC midnight — when the puzzle turns over. */
export function nextRolloverMs(now: number = Date.now()): number {
  return dayKeyToMs(dayKeyFromMs(now)) + MS_PER_DAY;
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
