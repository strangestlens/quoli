import { useEffect, useMemo, useState } from 'react';
import type { Dictionary } from '../game/rules.ts';
import { setCode } from '../game/scan.ts';

interface Loaded {
  readonly code: string;
  readonly dictionary: Dictionary;
}

export interface DictionaryState {
  /** Null while loading, or if the lookup failed. */
  readonly dictionary: Dictionary | null;
  readonly loading: boolean;
  readonly failed: boolean;
}

/**
 * The words this roll's twelve letters can form.
 *
 * Fetched rather than bundled: the full lexicon is 376 KB gzipped, but the
 * slice a given roll can reach is about a kilobyte. Keyed by the sorted
 * letters so two rolls that happen to match share a cache entry, and the
 * response is immutable, so the daily is served from the edge after the first
 * player of the day.
 *
 * Only fetched with the rules on — free play never asks a question it doesn't use.
 */
export function useDictionary(letters: readonly string[], enabled: boolean): DictionaryState {
  const code = useMemo(() => setCode(letters), [letters]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let live = true;
    setLoading(true);
    setFailed(false);

    fetch(`/api/words?set=${code}`)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('lookup'))))
      .then((body: { words?: unknown }) => {
        if (!live) return;
        const words = new Set(Array.isArray(body.words) ? (body.words as string[]) : []);
        setLoaded({ code, dictionary: { has: (word) => words.has(word) } });
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [code, enabled]);

  return {
    // Guard on the code so a stale roll's words are never used to judge a new one.
    dictionary: loaded?.code === code ? loaded.dictionary : null,
    loading,
    failed,
  };
}
