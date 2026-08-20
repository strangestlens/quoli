# Changelog

Notable changes to Quoli, loosely following [Keep a Changelog](https://keepachangelog.com/).
Versioning is 0.x (pre-1.0, no stability guarantees) — the wire formats that cannot move
are listed under "Frozen things" in [`AGENTS.md`](AGENTS.md).

## [Unreleased]

### Added
- The daily roll: twelve lettered dice derived from the date by a seeded PRNG, so every
  player gets the same puzzle without a server holding any state. `(dayKey, rollIndex)`
  fixes the letters forever — see `SEED_VERSION` in `src/game/roll.ts`.
- Drag and tap placement, either of which can place a tile. Tap is a first-class route
  rather than a fallback, because it is the one that works without fine motor control.
- Sharing: an emoji grid of the finished board, and a `?solve=` reveal link that packs the
  whole solution into 31 base64url characters and stays hidden until the reader asks.
- Custom sets. `/api/scan` reads a photo of twelve physical dice and returns the letters;
  the canonical `?set=` code is those twelve sorted, so rescanning the same dice always
  lands on the same link. Per-IP daily limits live in KV.
- Strict play: words are checked against a list merged from ENABLE and SCOWL. `analyze`
  reports rather than blocks, so a dictionary that is still loading checks nothing instead
  of failing everything.
- A How to play sheet, and a tray cascade that deals the dice in diagonally on each roll.
- Shuffle, for reordering the dice still in the tray.
- Deployment to Cloudflare Pages as a static bundle with two Pages Functions behind `/api`.

### Changed
- The day turns over at midnight Eastern rather than UTC, so the puzzle changes when the
  evening ends rather than in the middle of it.
- Each new day starts on the first set of dice, and re-rolling no longer presents itself
  as step two of the game.
- "Set" is the word for the dice you were dealt, replacing the phase-1 naming.

### Fixed
- The drop target now resolves from the same value that draws the ghost, so the highlight
  can never disagree with where the tile lands.
- The grid window only grows, so placed tiles stop sliding out from under an aiming finger.
- Copy failures are reported honestly instead of silently succeeding, and the Clipboard API
  works on a LAN address over the self-signed dev server.
