/**
 * The words a given twelve letters can form.
 *
 * The full lexicon is 376 KB gzipped — five times the whole app — but only
 * twelve letters exist in a roll, so at most a few hundred words are ever
 * playable. Filtering here turns an unshippable payload into about a
 * kilobyte, and the browser then validates instantly and offline.
 *
 * The answer depends only on the letters, so it is immutable and caches at the
 * edge: the first player of the day pays for it and nobody else does.
 */

interface Env {
  ASSETS: Fetcher;
}

const DIE_COUNT = 12;
const A = 'a'.charCodeAt(0);

interface Entry {
  readonly word: string;
  /** Bitmask of distinct letters, to reject most words without counting. */
  readonly mask: number;
}

/** Parsed once per isolate and reused across requests. */
let lexicon: Entry[] | null = null;

async function load(env: Env, request: Request): Promise<Entry[]> {
  if (lexicon) return lexicon;

  const response = await env.ASSETS.fetch(new URL('/words.txt', request.url));
  const text = await response.text();

  lexicon = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((word) => {
      let mask = 0;
      for (const ch of word) mask |= 1 << (ch.charCodeAt(0) - A);
      return { word, mask };
    });

  return lexicon;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return json(405, { error: 'GET this endpoint.' }, false);
  }

  const raw = new URL(request.url).searchParams.get('set') ?? '';
  const letters = raw.trim().toLowerCase();

  if (letters.length !== DIE_COUNT || !/^[a-pr-z]+$/.test(letters)) {
    return json(400, { error: 'Pass ?set= as twelve letters, no Q.' }, false);
  }

  const counts = new Int8Array(26);
  let pool = 0;
  for (const ch of letters) {
    const i = ch.charCodeAt(0) - A;
    counts[i]!++;
    pool |= 1 << i;
  }

  const words: string[] = [];
  for (const entry of await load(env, request)) {
    // Cheap rejection first: any letter the pool lacks rules the word out.
    if ((entry.mask & ~pool) !== 0) continue;

    const used = new Int8Array(26);
    let fits = true;
    for (const ch of entry.word) {
      const i = ch.charCodeAt(0) - A;
      if (++used[i]! > counts[i]!) {
        fits = false;
        break;
      }
    }
    if (fits) words.push(entry.word);
  }

  return json(200, { set: letters.toUpperCase(), words }, true);
};

function json(status: number, body: unknown, cacheable: boolean): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // Deterministic in its input, so it never needs revalidating.
      'cache-control': cacheable ? 'public, max-age=31536000, immutable' : 'no-store',
    },
  });
}
