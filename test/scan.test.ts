import { describe, expect, it } from 'vitest';
import { bounds, tileAt } from '../src/game/board.ts';
import {
  parseSetCode,
  setCode,
  validateScan,
  type Confidence,
  type ScannedSet,
  type ScannedTile,
} from '../src/game/scan.ts';

const tile = (
  letter: string,
  col: number,
  row: number,
  confidence: Confidence = 'high',
): ScannedTile => ({ letter, col, row, confidence });

/** Render a validated scan back to ASCII so layout assertions read like the photo. */
function render(set: ScannedSet): string[] {
  const b = bounds(set.board)!;
  const rows: string[] = [];
  for (let r = b.minR; r <= b.maxR; r++) {
    let line = '';
    for (let c = b.minC; c <= b.maxC; c++) {
      const tileId = tileAt(set.board, c, r);
      line += tileId === undefined ? '.' : set.letters[tileId];
    }
    rows.push(line);
  }
  return rows;
}

/** IMG_8461 — the twelve dice arranged 3 wide, 4 down. */
const GRID_PHOTO = {
  layout: 'grid' as const,
  tiles: [
    tile('E', 0, 0), tile('P', 1, 0), tile('Y', 2, 0),
    tile('L', 0, 1), tile('L', 1, 1), tile('A', 2, 1),
    tile('N', 0, 2), tile('N', 1, 2), tile('P', 2, 2),
    tile('C', 0, 3), tile('C', 1, 3), tile('R', 2, 3),
  ],
};

/** IMG_8466 — the solved board: APPLY across, NAN down the left, CYCLER down the right. */
const BOARD_PHOTO = {
  layout: 'crossword' as const,
  tiles: [
    tile('N', 0, 0), tile('C', 4, 0),
    tile('A', 0, 1), tile('P', 1, 1), tile('P', 2, 1), tile('L', 3, 1), tile('Y', 4, 1),
    tile('N', 0, 2), tile('C', 4, 2),
    tile('L', 4, 3), tile('E', 4, 4), tile('R', 4, 5),
  ],
};

const unwrap = (result: ReturnType<typeof validateScan>): ScannedSet => {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}`);
  return result.value;
};

describe('validateScan — the real photos', () => {
  it('reads the arranged grid', () => {
    const set = unwrap(validateScan(GRID_PHOTO));
    expect(render(set)).toEqual(['EPY', 'LLA', 'NNP', 'CCR']);
    expect(set.layout).toBe('grid');
  });

  it('reads the solved board', () => {
    const set = unwrap(validateScan(BOARD_PHOTO));
    expect(render(set)).toEqual([
      'N...C',
      'APPLY',
      'N...C',
      '....L',
      '....E',
      '....R',
    ]);
  });

  it('gives both photos of the same dice one share code', () => {
    // The whole point of sorting: rescanning a set can't fork it into two links.
    const grid = unwrap(validateScan(GRID_PHOTO));
    const board = unwrap(validateScan(BOARD_PHOTO));
    expect(setCode(grid.letters)).toBe('ACCELLNNPPRY');
    expect(setCode(board.letters)).toBe(setCode(grid.letters));
  });
});

describe('validateScan — normalisation', () => {
  it('pulls the layout back to the origin', () => {
    const offset = {
      layout: 'grid' as const,
      tiles: GRID_PHOTO.tiles.map((t) => tile(t.letter, t.col + 5, t.row + 3)),
    };
    expect(render(unwrap(validateScan(offset)))).toEqual(render(unwrap(validateScan(GRID_PHOTO))));
    expect(bounds(unwrap(validateScan(offset)).board)).toMatchObject({ minC: 0, minR: 0 });
  });

  it('handles negative coordinates', () => {
    const shifted = {
      layout: 'grid' as const,
      tiles: GRID_PHOTO.tiles.map((t) => tile(t.letter, t.col - 9, t.row - 4)),
    };
    expect(render(unwrap(validateScan(shifted)))).toEqual(['EPY', 'LLA', 'NNP', 'CCR']);
  });

  it('assigns tile IDs by letter so the tray is ordered, not photo-ordered', () => {
    expect(unwrap(validateScan(BOARD_PHOTO)).letters).toEqual([
      'A', 'C', 'C', 'E', 'L', 'L', 'N', 'N', 'P', 'P', 'R', 'Y',
    ]);
  });

  it('is order-independent — shuffling the model output changes nothing', () => {
    const shuffled = { layout: 'grid' as const, tiles: [...GRID_PHOTO.tiles].reverse() };
    expect(render(unwrap(validateScan(shuffled)))).toEqual(['EPY', 'LLA', 'NNP', 'CCR']);
  });
});

describe('validateScan — rejections', () => {
  const errorOf = (input: unknown) => {
    const result = validateScan(input);
    if (result.ok) throw new Error('expected a rejection');
    return result.error;
  };

  it('rejects a short read and says how many it found', () => {
    const short = { layout: 'grid' as const, tiles: GRID_PHOTO.tiles.slice(0, 10) };
    const error = errorOf(short);
    expect(error.code).toBe('wrong-tile-count');
    expect(error.message).toBe('Found 10 dice, need 12. Retake with all twelve in frame.');
  });

  it('says "die" when it only found one', () => {
    expect(errorOf({ layout: 'grid', tiles: [tile('A', 0, 0)] }).message).toContain('1 die,');
  });

  it('rejects a Q outright', () => {
    const withQ = {
      layout: 'grid' as const,
      tiles: [tile('Q', 0, 0), ...GRID_PHOTO.tiles.slice(1)],
    };
    expect(errorOf(withQ).code).toBe('contains-q');
  });

  it('rejects a letter it could not make out', () => {
    const garbled = {
      layout: 'grid' as const,
      tiles: [tile('?', 0, 0), ...GRID_PHOTO.tiles.slice(1)],
    };
    expect(errorOf(garbled).code).toBe('invalid-letter');
  });

  it('rejects fractional coordinates', () => {
    const fuzzy = {
      layout: 'grid' as const,
      tiles: [tile('E', 0.5, 0), ...GRID_PHOTO.tiles.slice(1)],
    };
    expect(errorOf(fuzzy).code).toBe('invalid-coordinates');
  });

  it('rejects two dice on one square', () => {
    const stacked = {
      layout: 'grid' as const,
      tiles: [tile('E', 1, 0), ...GRID_PHOTO.tiles.slice(1)],
    };
    expect(errorOf(stacked).code).toBe('overlapping-tiles');
  });

  it('rejects anything that is not a scan response at all', () => {
    for (const junk of [null, undefined, 42, 'ACCELLNNPPRY', {}, { layout: 'grid' }, { layout: 'x', tiles: [] }]) {
      expect(errorOf(junk).code).toBe('malformed');
    }
  });

  it('every rejection tells the player what to do next', () => {
    const inputs = [
      { layout: 'grid', tiles: GRID_PHOTO.tiles.slice(0, 3) },
      { layout: 'grid', tiles: [tile('Q', 0, 0), ...GRID_PHOTO.tiles.slice(1)] },
      null,
    ];
    for (const input of inputs) {
      expect(errorOf(input).message).toMatch(/[Rr]etake|[Tt]ry again|Spread/);
    }
  });
});

describe('confidence', () => {
  it('reports the tiles the model flagged, by their assigned ID', () => {
    const hazy = {
      layout: 'grid' as const,
      tiles: GRID_PHOTO.tiles.map((t) =>
        t.letter === 'Y' || t.letter === 'A' ? tile(t.letter, t.col, t.row, 'low') : t,
      ),
    };
    const set = unwrap(validateScan(hazy));
    // A sorts to 0, Y to 11.
    expect(set.lowConfidence).toEqual([0, 11]);
    expect(set.lowConfidence.map((id) => set.letters[id])).toEqual(['A', 'Y']);
  });

  it('is empty when the model is sure', () => {
    expect(unwrap(validateScan(GRID_PHOTO)).lowConfidence).toEqual([]);
  });
});

describe('set codes', () => {
  it('round-trips', () => {
    expect(parseSetCode('ACCELLNNPPRY')).toEqual([...'ACCELLNNPPRY']);
  });

  it('canonicalises order and case', () => {
    expect(parseSetCode('yrppnnllecca')).toEqual([...'ACCELLNNPPRY']);
  });

  it('rejects the wrong length', () => {
    expect(parseSetCode('ABC')).toBeNull();
    expect(parseSetCode('ACCELLNNPPRYZ')).toBeNull();
  });

  it('rejects a Q, and anything that is not a letter', () => {
    expect(parseSetCode('QCCELLNNPPRY')).toBeNull();
    expect(parseSetCode('1CCELLNNPPRY')).toBeNull();
  });

  it('tolerates surrounding whitespace from a pasted link', () => {
    expect(parseSetCode('  accellnnppry \n')).toEqual([...'ACCELLNNPPRY']);
  });
});
