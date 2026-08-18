import { describe, expect, it } from 'vitest';
import { DICE, DIE_COUNT, FACE_COUNT, VOWELS } from '../src/game/dice.ts';
import {
  dayKeyForPuzzle,
  dayKeyFromMs,
  nextRolloverMs,
  puzzleNumber,
  rollFor,
  todayKey,
} from '../src/game/roll.ts';

describe('dice table', () => {
  it('is twelve six-sided dice', () => {
    expect(DICE).toHaveLength(DIE_COUNT);
    for (const die of DICE) expect(die).toHaveLength(FACE_COUNT);
  });

  it('has no Q — the entire premise', () => {
    expect(DICE.flat()).not.toContain('Q');
  });

  it('carries vowels on exactly dice 10, 11 and 12', () => {
    const withVowels = DICE.map((die, i) => (die.some((f) => VOWELS.has(f)) ? i : -1)).filter(
      (i) => i >= 0,
    );
    expect(withVowels).toEqual([9, 10, 11]);
  });
});

describe('rollFor — golden vectors', () => {
  // These are load-bearing. A change here means every historical puzzle,
  // every share and every streak has silently shifted. If this test fails,
  // the fix is almost never to update the expectations.
  const GOLDEN: Record<string, readonly string[]> = {
    '2026-01-01': ['BVNLGZHBSOAE', 'YVNRGBHBCYUO', 'YFRDGXTCCYAO'],
    '2026-08-16': ['MPHDRBHDCNOA', 'MPRDDSTCTNAO', 'YVHLRBTCTIEE'],
    '2026-12-31': ['MGRRGXHBTYOO', 'YPHLGZTCSIUE', 'YFNWLBPJTYAE'],
  };

  for (const [dayKey, expected] of Object.entries(GOLDEN)) {
    it(`is frozen for ${dayKey}`, () => {
      expected.forEach((letters, rollIndex) => {
        expect(rollFor(dayKey, rollIndex).letters.join('')).toBe(letters);
      });
    });
  }
});

describe('rollFor', () => {
  it('is pure — same input, same letters', () => {
    const a = rollFor('2026-05-05', 7);
    const b = rollFor('2026-05-05', 7);
    expect(a.letters).toEqual(b.letters);
  });

  it('gives a different roll per rollIndex', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i++) seen.add(rollFor('2026-05-05', i).letters.join(''));
    // Collisions are possible in principle but 20 identical rolls is not.
    expect(seen.size).toBeGreaterThan(15);
  });

  it('draws each letter from its own die', () => {
    for (let i = 0; i < 200; i++) {
      const roll = rollFor('2026-03-01', i);
      roll.letters.forEach((letter, dieIndex) => {
        expect(DICE[dieIndex]).toContain(letter);
      });
    }
  });

  it('always yields two or three vowels', () => {
    for (let day = 0; day < 400; day++) {
      const dayKey = dayKeyFromMs(Date.UTC(2026, 0, 1) + day * 86_400_000);
      for (let rollIndex = 0; rollIndex < 3; rollIndex++) {
        const vowels = rollFor(dayKey, rollIndex).letters.filter((l) => VOWELS.has(l));
        expect(vowels.length).toBeGreaterThanOrEqual(2);
        expect(vowels.length).toBeLessThanOrEqual(3);
      }
    }
  });
});

describe('day keys', () => {
  const at = (y: number, m: number, d: number, h: number, min = 0) =>
    Date.UTC(y, m - 1, d, h, min);

  it('turns over at midnight Eastern, not UTC', () => {
    // Summer is UTC-4, so the puzzle flips at 04:00Z. Before that it is still
    // yesterday's, even though UTC has already moved on.
    expect(todayKey(at(2026, 8, 18, 3, 59))).toBe('2026-08-17');
    expect(todayKey(at(2026, 8, 18, 4, 0))).toBe('2026-08-18');
  });

  it('follows daylight saving rather than a fixed offset', () => {
    // Winter is UTC-5, so the same boundary lands an hour later.
    expect(todayKey(at(2026, 1, 15, 4, 59))).toBe('2026-01-14');
    expect(todayKey(at(2026, 1, 15, 5, 0))).toBe('2026-01-15');
  });

  it('holds one puzzle across a whole Eastern day', () => {
    const morning = todayKey(at(2026, 8, 18, 13, 0)); // 9am Eastern
    const evening = todayKey(at(2026, 8, 19, 3, 0)); // 11pm Eastern, same day
    expect(evening).toBe(morning);
  });

  it('numbers puzzles from the epoch', () => {
    expect(puzzleNumber('2026-01-01')).toBe(1);
    expect(puzzleNumber('2026-08-16')).toBe(228);
  });

  it('maps a puzzle number back to its day, unchanged by the rollover shift', () => {
    // The index is deliberately not timezone-aware: moving it would renumber
    // every puzzle ever shared.
    expect(dayKeyForPuzzle(1)).toBe('2026-01-01');
    expect(dayKeyForPuzzle(228)).toBe('2026-08-16');
    expect(dayKeyForPuzzle(230)).toBe('2026-08-18');
  });

  it('round-trips numbers and days for years', () => {
    for (let n = 1; n <= 4000; n++) {
      expect(puzzleNumber(dayKeyForPuzzle(n))).toBe(n);
    }
  });

  it('reports the next rollover to the minute', () => {
    const next = nextRolloverMs(at(2026, 8, 18, 12, 0));
    expect(new Date(next).toISOString()).toBe('2026-08-19T04:00:00.000Z');
    expect(todayKey(next)).toBe('2026-08-19');
  });

  it('reports the winter rollover an hour later', () => {
    const next = nextRolloverMs(at(2026, 1, 15, 12, 0));
    expect(new Date(next).toISOString()).toBe('2026-01-16T05:00:00.000Z');
  });
});
