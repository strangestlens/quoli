import { describe, expect, it } from 'vitest';
import { EMPTY_BOARD, place, type Board } from '../src/game/board.ts';
import { analyze, CLASSIC_RULES, PHASE_1_RULES } from '../src/game/rules.ts';
import { LETTERS, SAMPLE } from './fixtures.ts';

/** Twelve tiles in a row — meaningless as a crossword, but complete. */
const twelveInARow: Board = Array.from({ length: 12 }).reduce<Board>(
  (b, _, i) => place(b, i, { c: i, r: 0 }),
  EMPTY_BOARD,
);

const twelveLetters = 'ABCDEFGHIJKL'.split('');

const codes = (board: Board, letters: readonly string[], rules = PHASE_1_RULES) =>
  analyze(board, letters, rules).violations.map((v) => v.code);

describe('phase 1 rules', () => {
  it('completes as soon as all twelve dice are down, however they are arranged', () => {
    const result = analyze(twelveInARow, twelveLetters, PHASE_1_RULES);
    expect(result.violations).toEqual([]);
    expect(result.complete).toBe(true);
  });

  it('does not care about islands or stray letters', () => {
    const scattered: Board = Array.from({ length: 12 }).reduce<Board>(
      (b, _, i) => place(b, i, { c: i * 3, r: i * 3 }),
      EMPTY_BOARD,
    );
    expect(codes(scattered, twelveLetters)).toEqual([]);
  });

  it('is incomplete while dice remain in the tray', () => {
    const result = analyze(SAMPLE, LETTERS, PHASE_1_RULES);
    expect(result.violations.map((v) => v.code)).toEqual(['tiles-unplaced']);
    expect(result.violations[0]!.message).toBe('2 dice still in the tray');
    expect(result.complete).toBe(false);
  });

  it('says "die" for a single remaining tile', () => {
    const board = place(SAMPLE, 10, { c: 5, r: 1 });
    expect(analyze(board, LETTERS, PHASE_1_RULES).violations[0]!.message).toBe(
      '1 die still in the tray',
    );
  });

  it('never completes an empty board', () => {
    expect(analyze(EMPTY_BOARD, twelveLetters, PHASE_1_RULES).complete).toBe(false);
  });
});

describe('classic rules', () => {
  it('rejects a straight line of twelve unrelated letters', () => {
    // One long "word" — connected, but not three letters at a time it isn't.
    expect(codes(twelveInARow, twelveLetters, CLASSIC_RULES)).toEqual([]);
  });

  it('flags islands', () => {
    const board = place(SAMPLE, 10, { c: 20, r: 20 });
    const withEleven = place(board, 11, { c: 21, r: 20 });
    expect(codes(withEleven, [...LETTERS, 'E', 'S'], CLASSIC_RULES)).toContain('disconnected');
  });

  it('flags a two-letter word when the minimum is three', () => {
    const board = place(SAMPLE, 10, { c: 2, r: 2 });
    const violations = analyze(board, [...LETTERS, 'T'], CLASSIC_RULES).violations;
    expect(violations.map((v) => v.code)).toContain('short-word');
    expect(violations.find((v) => v.code === 'short-word')!.message).toContain('AT');
  });

  it('accepts the sample grid once the tray rule is met', () => {
    const rules = { ...CLASSIC_RULES, requireAllTilesPlaced: false };
    expect(analyze(SAMPLE, LETTERS, rules).violations).toEqual([]);
  });

  it('flags a stray letter that forms no word', () => {
    const rules = { ...CLASSIC_RULES, requireAllTilesPlaced: false, requireConnected: false };
    const board = place(SAMPLE, 10, { c: 20, r: 20 });
    expect(codes(board, [...LETTERS, 'E'], rules)).toContain('orphan-tile');
  });
});
