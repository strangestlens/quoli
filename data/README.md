# Word sources

Three lists, merged. None is a superset of the others.

- **`enable.txt`** — ENABLE, 172,823 words, public domain. Thorough, but
  compiled in the 1990s: no `email`, no `blog`, no `emoji`. It does have
  `trop`, which is the same age showing from the other side.
- **SCOWL**, via the `wordlist-english` package (MIT), tiers 10-70. Newer, and
  carries the modern vocabulary ENABLE lacks — but it is smaller and misses
  words ENABLE knows, including `nan`, which turned up in a real game here.
  Tier 70 is the usual spell-checker ceiling; past it the words get obscure
  enough to read as typos to a player.
- **`allowlist.txt`** — ours, merged last. Deliberately tiny: SCOWL covered 23
  of the 26 words it originally held. It exists so our own additions survive a
  source being swapped out.

## Merging costs nothing

The browser is never sent a dictionary. It asks `/api/words` for the few
hundred words its own twelve letters can form and gets back about a kilobyte.
The combined source list is 157,848 words and could be ten times that without
moving the payload.

## Swapping a source

Replace the file, run `npm run words`, deploy. No client change, no API change,
no format change — the browser cannot tell which lexicon answered.
