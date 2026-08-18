import { describe, expect, it } from 'vitest';
import {
  canReroll,
  customSource,
  dailySource,
  lettersFor,
  parseSearch,
  puzzlePath,
  rollPath,
} from '../src/game/puzzle.ts';
import { rollFor } from '../src/game/roll.ts';

const AUG_17 = Date.UTC(2026, 7, 17, 12);

describe('customSource', () => {
  it('canonicalises the code so any ordering yields one set', () => {
    const a = customSource('ACCELLNNPPRY')!;
    const b = customSource('yrppnnllecca')!;
    expect(a.code).toBe(b.code);
    expect(a.letters).toEqual(b.letters);
  });

  it('refuses anything that is not a valid set', () => {
    expect(customSource('ABC')).toBeNull();
    expect(customSource('QCCELLNNPPRY')).toBeNull();
    expect(customSource('')).toBeNull();
  });
});

describe('lettersFor', () => {
  it('derives the daily letters from the frozen roll', () => {
    expect(lettersFor(dailySource('2026-08-17', 0))).toEqual(rollFor('2026-08-17', 0).letters);
  });

  it('honours the roll index', () => {
    expect(lettersFor(dailySource('2026-08-17', 3))).toEqual(rollFor('2026-08-17', 3).letters);
  });

  it('takes a custom set at its word', () => {
    expect(lettersFor(customSource('ACCELLNNPPRY')!).join('')).toBe('ACCELLNNPPRY');
  });
});

describe('canReroll', () => {
  it('allows re-rolling the daily', () => {
    expect(canReroll(dailySource('2026-08-17'))).toBe(true);
  });

  it('refuses to re-roll a custom set — those are the dice you were handed', () => {
    expect(canReroll(customSource('ACCELLNNPPRY')!)).toBe(false);
  });
});

describe('parseSearch', () => {
  it('falls through to today when there is no set', () => {
    const { source, badSetCode } = parseSearch('', AUG_17);
    expect(source).toEqual(dailySource('2026-08-17', 0));
    expect(badSetCode).toBe(false);
  });

  it('opens a shared set', () => {
    const { source, badSetCode } = parseSearch('?set=ACCELLNNPPRY', AUG_17);
    expect(source.kind).toBe('custom');
    expect(lettersFor(source).join('')).toBe('ACCELLNNPPRY');
    expect(badSetCode).toBe(false);
  });

  it('survives other query params alongside it', () => {
    const { source } = parseSearch('?utm_source=imessage&set=ACCELLNNPPRY', AUG_17);
    expect(source.kind).toBe('custom');
  });

  it('falls back to the daily on a broken code, and says so', () => {
    const { source, badSetCode } = parseSearch('?set=NOPE', AUG_17);
    expect(source.kind).toBe('daily');
    expect(badSetCode).toBe(true);
  });

  it('treats a set containing Q as broken', () => {
    expect(parseSearch('?set=QCCELLNNPPRY', AUG_17).badSetCode).toBe(true);
  });

  it('does not flag a missing set as broken', () => {
    expect(parseSearch('?ref=twitter', AUG_17).badSetCode).toBe(false);
  });
});

describe('roll links', () => {
  it('reads a roll out of the URL, one-based', () => {
    const { source, explicitRoll } = parseSearch('?roll=4', AUG_17);
    expect(source).toEqual(dailySource('2026-08-17', 3));
    expect(explicitRoll).toBe(true);
  });

  it('treats a bare URL as roll 1, not as an explicit choice', () => {
    const { source, explicitRoll } = parseSearch('', AUG_17);
    expect(source).toEqual(dailySource('2026-08-17', 0));
    // Not explicit, so a saved later roll still wins on reload.
    expect(explicitRoll).toBe(false);
  });

  it('falls back to a playable puzzle on a mangled roll', () => {
    for (const bad of ['?roll=0', '?roll=-3', '?roll=abc', '?roll=2.5', '?roll=100000']) {
      const { source, explicitRoll } = parseSearch(bad, AUG_17);
      expect(source).toEqual(dailySource('2026-08-17', 0));
      expect(explicitRoll).toBe(false);
    }
  });

  it('ignores a roll on a custom set', () => {
    const { source } = parseSearch('?set=ACCELLNNPPRY&roll=5', AUG_17);
    expect(source.kind).toBe('custom');
  });

  it('round-trips through rollPath', () => {
    expect(rollPath('/', 0)).toBe('/');
    expect(rollPath('/', 3)).toBe('/?roll=4');
    expect(parseSearch('?roll=4', AUG_17).source).toEqual(dailySource('2026-08-17', 3));
  });
});

describe('past puzzles', () => {
  it('opens a puzzle by number, whatever today is', () => {
    const { source, explicitPuzzle } = parseSearch('?puzzle=230', AUG_17);
    expect(source).toEqual(dailySource('2026-08-18', 0));
    expect(explicitPuzzle).toBe(true);
  });

  it('carries the roll alongside it', () => {
    const { source, explicitPuzzle, explicitRoll } = parseSearch('?puzzle=230&roll=4', AUG_17);
    expect(source).toEqual(dailySource('2026-08-18', 3));
    expect(explicitPuzzle).toBe(true);
    expect(explicitRoll).toBe(true);
  });

  it('rebuilds the very same dice a year later', () => {
    const shared = parseSearch('?puzzle=230&roll=4', AUG_17).source;
    const muchLater = parseSearch('?puzzle=230&roll=4', Date.UTC(2027, 5, 1)).source;
    expect(lettersFor(muchLater)).toEqual(lettersFor(shared));
  });

  it('falls back to today on a mangled puzzle number', () => {
    for (const bad of ['?puzzle=0', '?puzzle=-5', '?puzzle=abc', '?puzzle=99999']) {
      const { source, explicitPuzzle } = parseSearch(bad, AUG_17);
      expect(source).toEqual(dailySource('2026-08-17', 0));
      expect(explicitPuzzle).toBe(false);
    }
  });

  it('does not flag an ordinary visit as a past puzzle', () => {
    expect(parseSearch('', AUG_17).explicitPuzzle).toBe(false);
    expect(parseSearch('?roll=3', AUG_17).explicitPuzzle).toBe(false);
  });

  it('round-trips through puzzlePath', () => {
    expect(puzzlePath('/', 230, 0)).toBe('/?puzzle=230');
    expect(puzzlePath('/', 230, 3)).toBe('/?puzzle=230&roll=4');
    expect(parseSearch('?puzzle=230&roll=4', AUG_17).source).toEqual(
      dailySource('2026-08-18', 3),
    );
  });
});
