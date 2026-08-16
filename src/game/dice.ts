/**
 * The twelve dice.
 *
 * FROZEN. Do not reorder the dice and do not reorder the faces within a die.
 * `rollFor` consumes one random number per die in array order, so any change
 * here silently rewrites every past and future puzzle. If you genuinely need
 * to change the set, bump SEED_VERSION in roll.ts as a deliberate act.
 *
 * There is no Q on any face — that is the whole joke.
 *
 * Dice 11 and 12 are all-vowel and die 10 carries three vowel faces, which is
 * *why* every roll lands 2-3 vowels. That is a property of the physical dice,
 * not a rule anything needs to enforce.
 */
export const DICE = [
  ['M', 'M', 'L', 'L', 'B', 'Y'],
  ['V', 'F', 'G', 'K', 'P', 'P'],
  ['H', 'H', 'N', 'N', 'R', 'R'],
  ['D', 'F', 'R', 'L', 'L', 'W'],
  ['R', 'R', 'D', 'L', 'G', 'G'],
  ['X', 'K', 'B', 'S', 'Z', 'N'],
  ['W', 'H', 'H', 'T', 'T', 'P'],
  ['C', 'C', 'B', 'T', 'J', 'D'],
  ['C', 'C', 'M', 'T', 'T', 'S'],
  ['O', 'I', 'I', 'N', 'N', 'Y'],
  ['A', 'E', 'I', 'O', 'U', 'U'],
  ['A', 'A', 'E', 'E', 'O', 'O'],
] as const;

export const DIE_COUNT = DICE.length;
export const FACE_COUNT = 6;

/** A tile's stable identity for the whole day: its die index, 0-11. */
export type TileId = number;

export const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);
