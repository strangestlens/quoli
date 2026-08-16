# Quoli

**The daily crossword roll.** Twelve lettered dice, one grid, a new puzzle every day — the same twelve letters for everyone, everywhere.

Quoli is a web take on [Q-Less](https://qlessgame.com/), Tom Sturdevant's pocket crossword-solitaire dice game. Roll twelve dice, arrange every letter into an interlocking crossword. No timer, no score. There is no Q on any die, which is where both games get their name — and where Quoli gets its wordmark.

## How it works

- **One puzzle a day.** The roll is derived from the UTC date, so everyone sees the same dice.
- **Re-rolls are deterministic too.** If today's first roll is unsolvable, roll again — and roll 2 will be the same twelve letters for everyone, and still the same after a reload. Nothing about the day's sequence is random at runtime.
- **Drag or tap.** Drag a die onto the grid, or tap it and tap a destination. The board auto-fits as it grows.
- **Share without spoiling.** The default share is a silhouette of your grid. There's an opt-in "copy with letters" for chats where everyone has already played.

## Phase 1 scope

Words are **not** validated yet. A board is complete when all twelve dice are down, arranged however you like — honour system. The rule checks (minimum word length, connectivity, dictionary) are all written and tested; they're just switched off in `PHASE_1_RULES`. Turning them on is a config change, not a rewrite.

## Development

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

The build emits a plain static `dist/` with no host-specific output, so it deploys unchanged to Cloudflare Pages, Netlify, GitHub Pages, or an S3 bucket.

## Layout

```
src/game/     pure, DOM-free, fully tested — reusable server-side later
  dice.ts     the twelve dice (frozen)
  rng.ts      xmur3 + mulberry32 (frozen)
  roll.ts     day keys, puzzle numbers, the roll itself
  board.ts    sparse grid model
  words.ts    across/down run extraction
  rules.ts    configurable RuleSet + analysis
  share.ts    silhouette / fullwidth-letter / ASCII encoders
  storage.ts  versioned localStorage
src/ui/       React components and the pointer-event drag system
test/         Vitest
```

### A note on `src/game/`

`dice.ts` and `rng.ts` are frozen on purpose. A given `(day, rollIndex)` must produce the same twelve letters forever — shares, streaks, and any future leaderboard all depend on it. `test/roll.test.ts` pins golden vectors so a refactor cannot quietly rewrite history. If the sequence genuinely has to change, bump `SEED_VERSION` in `roll.ts` as a deliberate act rather than editing the algorithm in place.

## Roadmap

- **Phase 2** — screen name, local play streak, a settings sheet for toggling rules.
- **Phase 3** — leaderboard behind a Worker, dictionary validation reusing `src/game/` server-side.
