import { deserializeBoard, serializeBoard, type Board, type SerializedBoard } from './board.ts';
import type { PuzzleSource } from './puzzle.ts';
import { dayKeyToMs, MS_PER_DAY } from './roll.ts';
import { PHASE_1_RULES, type RuleSet } from './rules.ts';

const NS = 'quoli:v1';
const MAX_AGE_DAYS = 90;

const DAILY_PREFIX = `${NS}:play:`;
const CUSTOM_PREFIX = `${NS}:custom:`;

export interface StoredPlay {
  /** Which re-roll the player is on. Always 0 for a custom set. */
  rollIndex: number;
  board: Board;
  /** Which roll they finished on, or null if still going. */
  solvedRollIndex: number | null;
  solvedAt: number | null;
}

interface PlayRecord {
  readonly rollIndex: number;
  readonly board: SerializedBoard;
  readonly solvedRollIndex: number | null;
  readonly solvedAt: number | null;
  /** Written on every save; drives pruning for keys with no date in them. */
  readonly updatedAt: number;
}

/**
 * Safari in private mode can throw on `localStorage` access rather than just
 * returning null, and an unhandled throw here is a white screen. Everything
 * below degrades to in-memory-only rather than breaking the game.
 */
const store: Storage | null = (() => {
  try {
    const probe = '__quoli_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
})();

export const storageAvailable = store !== null;

function read<T>(key: string): T | null {
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // Quota exceeded or private mode. Losing a save is survivable; crashing isn't.
  }
}

/** Daily play is keyed by its UTC date; a custom set by its own letters. */
function keyFor(source: PuzzleSource): string {
  return source.kind === 'daily'
    ? `${DAILY_PREFIX}${source.dayKey}`
    : `${CUSTOM_PREFIX}${source.code}`;
}

export function loadPlay(source: PuzzleSource): StoredPlay | null {
  const rec = read<PlayRecord>(keyFor(source));
  if (!rec || typeof rec.rollIndex !== 'number' || !Array.isArray(rec.board)) return null;

  return {
    rollIndex: Math.max(0, Math.floor(rec.rollIndex)),
    board: deserializeBoard(rec.board),
    solvedRollIndex: typeof rec.solvedRollIndex === 'number' ? rec.solvedRollIndex : null,
    solvedAt: typeof rec.solvedAt === 'number' ? rec.solvedAt : null,
  };
}

export function savePlay(
  source: PuzzleSource,
  state: StoredPlay,
  now: number = Date.now(),
): void {
  const rec: PlayRecord = {
    rollIndex: state.rollIndex,
    board: serializeBoard(state.board),
    solvedRollIndex: state.solvedRollIndex,
    solvedAt: state.solvedAt,
    updatedAt: now,
  };
  write(keyFor(source), rec);
}

export function loadRules(): RuleSet {
  const saved = read<Partial<RuleSet>>(`${NS}:rules`);
  return saved ? { ...PHASE_1_RULES, ...saved } : PHASE_1_RULES;
}

export function saveRules(rules: RuleSet): void {
  write(`${NS}:rules`, rules);
}

/**
 * Drop plays nobody is coming back to, keeping the last 90 days for streaks.
 *
 * Daily keys carry their own date, but a custom set's key is its letters — so
 * `updatedAt` is what ages those out. A record written before `updatedAt`
 * existed falls back to its date, and a custom one without either is kept
 * until its next save stamps it.
 */
export function pruneOldPlays(now: number = Date.now()): void {
  if (!store) return;
  const cutoff = now - MAX_AGE_DAYS * MS_PER_DAY;

  try {
    const doomed: string[] = [];

    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key) continue;

      const isDaily = key.startsWith(DAILY_PREFIX);
      if (!isDaily && !key.startsWith(CUSTOM_PREFIX)) continue;

      const rec = read<PlayRecord>(key);
      const touched =
        typeof rec?.updatedAt === 'number'
          ? rec.updatedAt
          : isDaily
            ? dayKeyToMs(key.slice(DAILY_PREFIX.length))
            : null;

      if (touched !== null && Number.isFinite(touched) && touched < cutoff) {
        doomed.push(key);
      }
    }

    for (const key of doomed) store.removeItem(key);
  } catch {
    // Nothing here is load-bearing.
  }
}
