# AGENTS.md

Working notes for coding agents on Quoli. [README.md](README.md) explains the
game and the product decisions; this file is about working in the repo — what
the commands are, what is frozen, and what will bite you.

Read this first. It is meant to replace a full read of the tree.

`CLAUDE.md` is a symlink to this file, so tools that look for either name find
the same text. Keep it that way — editing "both" is how they quietly diverge.
Anything else this repo grows that a tool expects under a second name should
follow the same pattern: one real file, symlinks pointing at it.

## The shape of it

A React 19 + TypeScript SPA built by Vite, deployed as a static bundle to
Cloudflare Pages, with two Pages Functions behind `/api`. No backend state, no
accounts, no database. Every player's puzzle is derived from the date by a
seeded PRNG, so the "server" is only ever answering questions the client could
not answer cheaply itself.

```
src/game/     pure, DOM-free, fully tested — the whole model lives here
src/ui/       React components, one pointer-event drag system, one CSS file
functions/    Cloudflare Pages Functions (/api/words, /api/scan)
data/         word list sources
scripts/      build-words.mjs — merges data/ into public/words.txt
test/         Vitest, node environment
```

The dependency direction is one-way: `src/ui` imports `src/game`, never the
reverse, and `functions/` imports `src/game/scan.ts` so the Worker runs the
exact same validation the browser does.

## Commands

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
npm run typecheck
```

```bash
npm run build
```

| Script | What it does |
| --- | --- |
| `dev` | Vite on port 5173, listening on the LAN so a phone can reach it |
| `dev:https` | Same, over self-signed TLS — needed for the Clipboard API on a LAN address |
| `test` / `test:watch` | Vitest (185 tests, ~3s) |
| `typecheck` | `tsc -b` across all three projects |
| `build` | `npm run words` then `tsc -b` then `vite build` → `dist/` |
| `words` | Regenerates `public/words.txt` from `data/` + the `wordlist-english` package |
| `deploy` | Builds and pushes to Cloudflare Pages (project `quoli`, branch `main`) |

Node is pinned to 22.12.0 in `.node-version`. Newer majors work fine.

### `npm run dev` does not serve `/api`

This is the single most confusing thing about the repo. Vite has no proxy and
no Functions plugin, so `/api/words` falls through to the SPA fallback and
returns `index.html` with a 200. The dictionary fetch then fails to parse and
the app sits there saying *"Couldn't load the word list — words aren't being
checked."* — which, since the rules are on by default, means **no word
validation at all under plain `npm run dev`**.

That is fine for layout, drag, tray and share work. For anything touching the
dictionary or the scanner, run the real thing:

```bash
npm run build && npx wrangler pages dev
```

That serves `dist/` plus `functions/` on port 8788 with the KV binding
attached. It has no HMR, so rebuild to see changes.

Note that `.wrangler/` — local Miniflare state, including the KV store — is
currently tracked in git, so running it dirties the working tree. Check the
`.wrangler/**` churn out of any commit; it is not part of the change.

`/api/scan` additionally needs an API key. Put it in `.dev.vars` (gitignored,
never commit it):

```
ANTHROPIC_API_KEY=sk-ant-...
```

In production it is a Pages secret set through the Cloudflare dashboard.

## Frozen things

Several files are load-bearing for correctness *across time* — a change that
compiles and passes review can still silently rewrite history. Treat these as
append-only.

**`src/game/dice.ts` and `src/game/rng.ts`.** `rollFor` draws one random number
per die in `DICE` array order, so reordering the dice, reordering the faces
within a die, or touching `xmur3`/`mulberry32` changes every past and future
puzzle. Shares, the reveal links people have already sent, and any future
streak all rest on `(dayKey, rollIndex)` producing the same twelve letters
forever. `test/roll.test.ts` pins golden vectors for three dates; **if that test
fails, updating the expectations is almost never the fix**. If the sequence
genuinely must change, bump `SEED_VERSION` in `roll.ts` as a deliberate act.

**`ALPHABET` and the bit layout in `src/game/solve.ts`.** A `?solve=` link is
184 bits packed into 31 base64url characters, and the letter is stored as an
index into that string. Changing the order, the field widths, or the field
order invalidates every link already in a chat somewhere. There is a 4-bit
`VERSION` at the front for exactly this — bump it and handle both.

**`setCode` in `src/game/scan.ts`.** The canonical `?set=` code is the twelve
letters sorted. Rescanning the same physical dice has to produce the same code,
or a set forks into two links. `validateScan` sorts by letter (position breaking
ties) for the same reason: tile IDs must be a function of the dice, not of the
order the model happened to list them in.

**The `quoli:v1` namespace in `src/game/storage.ts`.** Key shapes are
`quoli:v1:play:<dayKey>`, `quoli:v1:custom:<code>` and `quoli:v1:settings`.
Changing them orphans every saved board and every settings choice. `loadPlay`
and `loadSettings` are deliberately forgiving of missing fields so old records
keep working; keep new fields optional and default them the same way.

**No Q.** Not on a die face, not in `solve.ts`'s alphabet, not in the scanner's
schema, not in the generated word list. It is the name of the game.

## Invariants worth knowing before you change something

- **`src/game/` is DOM-free and side-effect-free.** `scan.ts` in particular is
  imported by the Worker, where `window` does not exist. `storage.ts` is the one
  exception and it guards every access.
- **The grid window only grows.** `growWindow` in `src/ui/geometry.ts` widens
  the rendered window to fit the board and never narrows or slides it.
  Recomputing from the board each render re-centres the grid and slides placed
  tiles out from under the player mid-aim. Callers reset it (pass `null`) on
  clear, re-roll and new day — see `resetBoardState` in `App.tsx`.
- **One source of truth per gesture.** `ghostCentre` in `useDragPlacement.ts`
  decides both where the ghost is drawn and which cell the drop resolves to, so
  the highlight can never disagree with where the tile lands.
- **Tap is a first-class placement path**, not a fallback for when drag fails.
  It is the route that works without fine motor control, and on a phone it is
  often faster. Anything added to drag needs a tap equivalent.
- **A saved board belongs to one roll's letters.** Carrying it across a re-roll
  keeps the shape and swaps every letter under it. `App.tsx`'s `initialState`
  guards this.
- **`analyze` reports, it does not block.** A missing dictionary (still loading,
  or offline) checks nothing rather than failing everything.
- **The Worker's response is re-validated in the browser.** `scanClient.ts`
  runs `validateScan` on what `/api/scan` returned, so the client never takes
  the Worker on trust — and the Worker never takes the model on trust.

## Conventions

**TypeScript.** `strict`, plus `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters` and
`verbatimModuleSyntax`. Relative imports carry their extension
(`./board.ts`, `./Tile.tsx`) — `allowImportingTsExtensions` is on. Three
projects: `tsconfig.app.json` (src + test, DOM libs),
`tsconfig.worker.json` (functions, workers-types), `tsconfig.node.json` (the
Vite/Vitest configs). `tsc -b` builds all three; a change to `functions/` is
only typechecked by the worker project.

**No linter, no formatter.** There is no ESLint or Prettier config — the
`eslint-disable` comment in `App.tsx:155` is vestigial. `npm run typecheck` and
`npm test` are the only automated gates. Match the surrounding style by hand:
two-space indent, single quotes, trailing commas, ~96 columns.

**Comments explain why, not what.** This codebase's comments are unusually
load-bearing — they record the bug that motivated the line, the platform
quirk being worked around, or the design call being defended. Match that
register, and delete a comment when its reason expires rather than leaving it
to rot. Do not add narrating comments to code that does the obvious thing.

**CSS.** One file, `src/styles/index.css`, plain CSS with custom properties on
`:root` and a `prefers-color-scheme: dark` override. Component state travels as
data attributes (`data-state`, `data-target`, `data-armed`, `data-intro`,
`data-on`, `data-revealed`), never as class toggling. `.sr-only` for screen
reader text, and every animation is disabled under
`prefers-reduced-motion: reduce`. Sizes that must agree between CSS and TS
(the tray cascade's `STAGGER_MS`/`FADE_MS` and the `tray-drop` keyframes) say
so in comments on both sides.

**Player-facing copy** says what to do, not what broke: *"Retake with all
twelve in frame"*, not *"wrong tile count"*. Sentence case, no exclamation
marks, no emoji outside the share grid's own squares.

**Commits.** Sentence-case imperative subject describing the change in the
game's own vocabulary, then a prose body explaining why it was needed and what
it displaced. No conventional-commit prefixes, no emoji, no bullet lists of
files. Existing history is the reference — `git log` reads like release notes,
because it is the only design record this project keeps. Include the
`Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` trailer.

## Testing

Vitest, `environment: 'node'`, `test/**/*.test.ts` only. There are no component
tests and no DOM environment — the test surface is `src/game/` plus
`src/ui/geometry.ts`, which is under test precisely because it is pure. UI
behaviour is verified by running the app.

- `test/fixtures.ts` holds `boardOf(...)` and the shared ten-tile `SAMPLE`
  grid. Use them rather than hand-rolling a board.
- `test/dictionary.test.ts` reads the real `public/words.txt`, not a stub. If
  you touch `data/` or `scripts/build-words.mjs`, run `npm run words` before
  the tests or you are testing the old list. It is also the slow one (~2.5s).
- `test/roll.test.ts`'s golden vectors are a tripwire, not an assertion about
  preference. See "Frozen things".

When adding logic, put it in `src/game/` if it can go there — that is what
makes it testable, and what would let it move server-side later.

## Deployment

`npm run deploy` builds and pushes to Cloudflare Pages project `quoli`, live at
`quoli.pages.dev`. The build output is plain static `dist/` with nothing
host-specific in it, so it would drop onto Netlify or S3 unchanged — the only
Cloudflare-specific parts are the two Pages Functions and their bindings.

Bindings, from `wrangler.jsonc`:

- `ASSETS` — implicit on Pages; `words.ts` uses it to read `/words.txt`.
- `SCAN_LIMITS` — KV, per-IP daily scan counters. Read-then-write on eventually
  consistent KV, so it deters a bored person with curl rather than enforcing an
  exact quota.
- `ANTHROPIC_API_KEY` — secret. `.dev.vars` locally, Pages secret in production.

`/api/scan` calls `claude-opus-5` with a JSON schema constraining output to the
25 non-Q letters. It is the only endpoint that costs money per call, which is
what the KV limit and the client-side image downscale (`MAX_EDGE = 1024`) are
for. `/api/words` is deterministic in its input and served
`immutable`, so the first player of the day pays the compute and the edge cache
covers everyone else.

## Verifying a change

1. `npm test` and `npm run typecheck` — both must be clean.
2. Run the app. `npm run dev` for anything visual; `npm run build && npx
   wrangler pages dev` if the dictionary or scanner is involved.
3. If you touched drag, tray or board geometry, check it on a narrow viewport —
   the layout is designed phone-first and the tray cascade is tuned for six
   columns.
4. If you touched `data/` or the word script, `npm run words` and check
   `git diff --stat public/words.txt` is what you expected.

## Keeping this file current

Update AGENTS.md in the same commit as the change, not afterwards. Specifically:

- **New or renamed npm script** → the command table.
- **New module in `src/game/`** → the layout block, and the invariants section
  if it carries one.
- **New Pages Function, binding or secret** → the deployment section.
- **Anything that becomes frozen** — a new wire format, storage key shape, or
  encoded identifier — → "Frozen things", with the reason it cannot move.
- **A gotcha that cost you more than ten minutes** → wherever it fits. That is
  what this file is for; the `npm run dev` / `/api` section exists because it
  is exactly that kind of trap.
- **Tooling arriving** — a linter, a formatter, CI — → the conventions section,
  replacing the note that says there isn't one.

Product and gameplay reasoning belongs in [README.md](README.md), design
history belongs in commit messages, and the *why* behind a specific line
belongs in a comment next to it. This file is for what an agent needs before it
starts editing.
