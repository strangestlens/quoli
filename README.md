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

The dev server listens on the LAN, so a phone on the same Wi-Fi can reach the
address Vite prints as `Network:`. For anything gated on a **secure context** —
the Clipboard API, and later the Web Share API — plain http on a LAN address
does not qualify, and copy will fall back or fail. Serve over TLS instead:

```bash
npm run dev:https
```

The certificate is self-signed, so Safari warns once: *Show Details → visit this
website*. Production is HTTPS, so this only matters in development.

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

### Ideas not yet built

**Shake to shuffle.** On a phone, shaking the device would be a natural proxy
for the tray's shuffle control. Worth knowing before starting: `devicemotion`
needs a secure context, and on iOS 13+ `DeviceMotionEvent.requestPermission()`
must be called from inside a user gesture and shows a system prompt — so it
cannot be enabled silently, and needs a deliberate moment to ask for it
(tapping the shuffle button being the obvious one). Detection is a threshold on
the delta between `accelerationIncludingGravity` samples, which will need
tuning on a real device; two consecutive samples over the threshold avoids a
single jolt, like setting the phone down, firing it.

**Identity and streaks.** A screen name, a local play streak from the
day-keyed history already in storage, and eventually a leaderboard behind the
Worker.

**A custom domain.** `quoli.pages.dev` is a real permanent URL in the
meantime; `SHARE_URL` in `src/game/share.ts` is the only place it appears.
