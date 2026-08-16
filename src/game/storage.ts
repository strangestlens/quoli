import { deserializeBoard, serializeBoard, type Board, type SerializedBoard } from './board.ts';
import { dayKeyToMs, MS_PER_DAY, type DayKey } from './roll.ts';
import { PHASE_1_RULES, type RuleSet } from './rules.ts';

const NS = 'quoli:v1';
const MAX_AGE_DAYS = 90;

export interface DayRecord {
  /** Which re-roll the player is currently on. */
  readonly rollIndex: number;
  readonly board: SerializedBoard;
  /** Which roll they finished on, or null if still going. */
  readonly solvedRollIndex: number | null;
  readonly solvedAt: number | null;
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

const dayKeyFor = (dayKey: DayKey) => `${NS}:play:${dayKey}`;

export function loadDay(dayKey: DayKey): { rollIndex: number; board: Board; solvedRollIndex: number | null; solvedAt: number | null } | null {
  const rec = read<DayRecord>(dayKeyFor(dayKey));
  if (!rec || typeof rec.rollIndex !== 'number' || !Array.isArray(rec.board)) return null;

  return {
    rollIndex: Math.max(0, Math.floor(rec.rollIndex)),
    board: deserializeBoard(rec.board),
    solvedRollIndex: typeof rec.solvedRollIndex === 'number' ? rec.solvedRollIndex : null,
    solvedAt: typeof rec.solvedAt === 'number' ? rec.solvedAt : null,
  };
}

export function saveDay(
  dayKey: DayKey,
  state: { rollIndex: number; board: Board; solvedRollIndex: number | null; solvedAt: number | null },
): void {
  const rec: DayRecord = {
    rollIndex: state.rollIndex,
    board: serializeBoard(state.board),
    solvedRollIndex: state.solvedRollIndex,
    solvedAt: state.solvedAt,
  };
  write(dayKeyFor(dayKey), rec);
}

export function loadRules(): RuleSet {
  const saved = read<Partial<RuleSet>>(`${NS}:rules`);
  return saved ? { ...PHASE_1_RULES, ...saved } : PHASE_1_RULES;
}

export function saveRules(rules: RuleSet): void {
  write(`${NS}:rules`, rules);
}

/** Day records outlive their usefulness; keep the last 90 days for streaks. */
export function pruneOldDays(now: number = Date.now()): void {
  if (!store) return;
  const cutoff = now - MAX_AGE_DAYS * MS_PER_DAY;
  const prefix = `${NS}:play:`;

  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const ms = dayKeyToMs(key.slice(prefix.length));
      if (Number.isFinite(ms) && ms < cutoff) doomed.push(key);
    }
    for (const key of doomed) store.removeItem(key);
  } catch {
    // Nothing here is load-bearing.
  }
}
