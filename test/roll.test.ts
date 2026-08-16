import { describe, expect, it } from 'vitest';
import { DICE, DIE_COUNT, FACE_COUNT, VOWELS } from '../src/game/dice.ts';
import {
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
  it('uses UTC, not local time', () => {
    // 23:30 UTC on the 16th is still the 16th everywhere, including for a
    // player whose local clock already says the 17th.
    expect(todayKey(Date.UTC(2026, 7, 16, 23, 30))).toBe('2026-08-16');
    expect(todayKey(Date.UTC(2026, 7, 17, 0, 1))).toBe('2026-08-17');
  });

  it('numbers puzzles from the epoch', () => {
    expect(puzzleNumber('2026-01-01')).toBe(1);
    expect(puzzleNumber('2026-08-16')).toBe(228);
  });

  it('rolls over at the next UTC midnight', () => {
    const now = Date.UTC(2026, 7, 16, 23, 59);
    expect(dayKeyFromMs(nextRolloverMs(now))).toBe('2026-08-17');
  });
});
