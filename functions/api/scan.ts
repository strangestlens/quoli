import Anthropic from '@anthropic-ai/sdk';
import { validateScan } from '../../src/game/scan.ts';

/**
 * Read a photo of physical dice into a playable set.
 *
 * A Pages Function rather than a standalone Worker: it ships with the site,
 * shares its origin (so no CORS), and needs no second deploy.
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  SCAN_LIMITS: KVNamespace;
}

/** Per-IP, per-day. KV is eventually consistent, so this deters rather than enforces. */
const DAILY_SCAN_LIMIT = 20;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** No Q — constraining the model's output removes a whole class of misread. */
const LETTERS = [...'ABCDEFGHIJKLMNOPRSTUVWXYZ'];

const SCHEMA = {
  type: 'object',
  properties: {
    layout: { type: 'string', enum: ['grid', 'crossword'] },
    tiles: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          letter: { type: 'string', enum: LETTERS },
          col: { type: 'integer' },
          row: { type: 'integer' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['letter', 'col', 'row', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['layout', 'tiles'],
  additionalProperties: false,
} as const;

const SYSTEM = `You read photographs of physical wooden letter dice for the word game Quoli.

The photo is taken from directly above, and every die is upright and squarely aligned with the others. That alignment is load-bearing: N and Z are the same glyph rotated a quarter turn, as are M and W, and the shared orientation is the only thing telling them apart. Read every letter in the photo's own orientation.

Read glyphs, not words. Never adjust a letter because a different one would spell something — a die that looks like an E is an E even if the row would read better with a Y. Silently "correcting" a letter changes which dice the player is holding.

There is no Q in this game, and there are exactly twelve dice.

For each die report:
- letter: the face-up letter.
- col and row: integer coordinates on a square lattice matching the physical arrangement. col increases to the right, row increases downward. Any origin is fine. Dice touching side by side differ by one in col; dice touching one above the other differ by one in row. A gap the width of one die is one unit.
- confidence: "low" when you are not certain of the letter, "high" otherwise. Be honest here — a flagged letter costs the player one tap, a wrong confident one costs them the puzzle.

Set layout to "grid" when the dice form a solid rectangle, or "crossword" when they form interlocking words with empty squares between the arms.`;

/**
 * Handles every method, not just POST: without this, a GET falls through to
 * the static handler and answers with the app's index.html, which looks like
 * a working endpoint returning nonsense.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST an image to this endpoint.' }), {
      status: 405,
      headers: { 'content-type': 'application/json', allow: 'POST' },
    });
  }
  return scan(context);
};

const scan: PagesFunction<Env> = async ({ request, env }) => {
  const contentType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!ACCEPTED.has(contentType)) {
    return problem(415, 'Send a JPEG, PNG or WebP image.');
  }

  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_IMAGE_BYTES) {
    return problem(413, 'That photo is too large. Try again — the app should be shrinking it.');
  }

  const overLimit = await consumeQuota(env, request);
  if (overLimit) {
    return problem(429, `That's ${DAILY_SCAN_LIMIT} scans today. Try again tomorrow.`);
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return problem(400, 'No photo received.');
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return problem(413, 'That photo is too large. Try again — the app should be shrinking it.');
  }

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: contentType as 'image/jpeg' | 'image/png' | 'image/webp',
                data: base64(bytes),
              },
            },
            { type: 'text', text: 'Read the dice in this photo.' },
          ],
        },
      ],
    });
  } catch (error) {
    const status = error instanceof Anthropic.APIError ? error.status : undefined;
    // Rate limits and overloads are worth retrying; a 4xx from us is not.
    return problem(
      status === 429 || (status ?? 500) >= 500 ? 503 : 502,
      "Couldn't reach the reader. Try again in a moment.",
    );
  }

  if (response.stop_reason === 'refusal') {
    return problem(422, "The reader declined that image. Try another photo of the dice.");
  }

  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) return problem(502, "The reader returned nothing. Try again.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return problem(502, "Couldn't understand the reading. Try again.");
  }

  // The same validation the browser runs, so a malformed reading never ships.
  const result = validateScan(parsed);
  if (!result.ok) {
    return json(422, { error: result.error.message, code: result.error.code });
  }

  // Tiles rather than the derived letters/board: the read-back lets the player
  // correct a letter, which can change how it sorts, so the client re-runs the
  // same validation over the edited tiles.
  return json(200, { layout: result.value.layout, tiles: result.value.tiles });
};

/**
 * Returns true when the caller is over quota.
 *
 * Read-then-write on eventually-consistent KV can undercount under a burst,
 * which is fine: this exists to stop a bored person with curl running up a
 * bill, not to be an exact accounting.
 */
async function consumeQuota(env: Env, request: Request): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const key = `scan:${day}:${ip}`;

  try {
    const used = Number((await env.SCAN_LIMITS.get(key)) ?? '0');
    if (used >= DAILY_SCAN_LIMIT) return true;
    await env.SCAN_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
    return false;
  } catch {
    // A KV outage shouldn't take the feature down with it.
    return false;
  }
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = '';
  // Chunked: spreading a multi-megabyte array into apply() blows the stack.
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const problem = (status: number, error: string) => json(status, { error });
