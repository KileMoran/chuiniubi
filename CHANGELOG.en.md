# 📜 Chuiniubi · Complete Changelog

<p align="center"><a href="./CHANGELOG.md"><kbd>🇨🇳 简体中文</kbd></a> &nbsp; <a href="./CHANGELOG.en.md"><kbd>🇬🇧 English (current)</kbd></a></p>

[🏠 Chinese README](./README.md) · [🇬🇧 English README](./README.en.md) · [🎮 Play](https://kilemoran.github.io/chuiniubi/)

> **Historical note:** Dates for many early milestones were not preserved; “—” indicates an unknown date. Older deck rules are historical and are **not** the current V7.9 rules.

## Release overview

| Version | Date | Highlights |
| --- | --- | --- |
| V7.9 | 2026-11-10 — 2026-11-11 | Random-event easter eggs |
| V7.9 Documentation & Test Maintenance | 2026-11-11 | Tests and documentation maintenance |
| V7.8 | 2026-11-10 | Wild jokers and 12-card limit |
| V7.7.3 | 2026-11-07 | In-place tabletop card reveals |
| V7.7.2 | 2026-11-07 | Rank selection and reveal-stage improvements |
| V7.7.1 | 2026-11-07 | Two-hour all-offline room expiration |
| V7.7 | 2026-11-07 | Explicit declared rank and expanded room sizes |
| V7.6 | 2026-11-07 | Animated gold-themed landing page |
| V7.5 | — | Dedicated home screen |

## Detailed release notes

### V7.9 — Random-event easter eggs
*2026-11-10 — 2026-11-11*

- Added four dorm events: teacher enters, a knocked-over bin, one accidentally face-up card, and an important phone message.
- After each successful play, the server attempts one event at a 3% overall probability. Each type can occur once per match, only one per play, and events are disabled in solo testing.
- The teacher and bin events can remove one card only from a target holding at least 10 cards; that card enters the discard pile and card conservation is preserved.
- The accidental-flip event reveals one random card from the latest hand early while other hidden cards remain private.
- The phone event blocks one player for the next four player-action turns; the server automatically skips their turn when reached.
- Added event banners, phone-status feedback, face-up styling, and dedicated event regression tests.

### V7.9 Documentation & Test Maintenance — Tests and documentation maintenance
*2026-11-11*

- Updated outdated test expectations to 54 cards for 1–2 players and 108 for 3–6, with jokers in every deck.
- Disabled low-probability easter eggs in general-purpose tests to keep them deterministic; event tests remain separate.
- Added a regression scenario confirming that the two-second protection interval is not a challenge deadline.
- Removed obsolete root-level game logic and legacy upgrade helpers while retaining server/game.js as the authoritative rules source.
- Expanded bilingual README and changelogs without changing the deployed gameplay logic.

### V7.8 — Wild jokers and 12-card limit
*2026-11-10*

- Jokers act as the declared rank and are not false cards; they do not excuse other mismatched ordinary cards.
- Raised the per-play limit to 12 cards and added a live X/12 selection count.
- Standardized current decks: 54 cards for 1–2 players and 108 for 3–6, jokers included.
- Gave jokers distinct card/reveal visuals while keeping ordinary-card bluff validation.

### V7.7.3 — In-place tabletop card reveals
*2026-11-07*

- Removed the separate reveal gallery: reveal the challenged last hand first, then reveal earlier cards on the table.
- Added tabletop pagination for large piles and standardized the A label.

### V7.7.2 — Rank selection and reveal-stage improvements
*2026-11-07*

- Made the new-round rank selector more compact without heavily obscuring the table or hand.
- Collected facedown plays around the center; first resolve the latest challenged hand, then reveal the entire round.

### V7.7.1 — Two-hour all-offline room expiration
*2026-11-07*

- Rooms and associated state are removed after all players stay offline for two hours; any online player keeps the room active.
- Expired-room handling returns players to the lobby; temporary outages can still recover using the existing identity.

### V7.7 — Explicit declared rank and expanded room sizes
*2026-11-07*

- The first play of each round must explicitly declare a rank, preventing stale selections.
- Added rooms for one to three players and solo testing. Historical deck counts differ from V7.9; follow current rules.

### V7.6 — Animated gold-themed landing page
*2026-11-07*

- Introduced author/version information, a changelog entry point, and gold-toned animations.

### V7.5 — Dedicated home screen
*—*

- Separated nickname entry, room creation, and joining into clearer desktop/mobile panels.

### V7.4.3 — Landing layout refinement
*—*

- Reorganized the single-column controls into separate panels while retaining room recovery.

### V7.4.2 — Simplified challenge feedback
*—*

- Removed redundant center-screen result overlays while keeping concise top feedback and reveal effects.

### V7.4.1 — Per-friend volume panel
*—*

- Fixed an excessively wide friend-volume panel by making it compact.

### V7.4 — RealtimeKit voice and mobile landscape
*—*

- Added meeting join, microphone and sound controls, and per-friend volume.
- Added speaking indicators and a dedicated mobile-landscape table/control layout.

### V7.3 — Mobile layout support
*—*

- Improved seats, controls and hand layout in portrait and landscape orientations.

### V7.2 — Refresh recovery and reconnection
*—*

- The browser stores room/identity data to attempt recovery after refreshes and short outages.

### V7.1 — Web deployment packaging
*—*

- Organized the files and configuration needed for GitHub Pages, Workers and Durable Objects.

### V7.0 — Real-player multiplayer
*—*

- Removed AI play and moved rooms, hands, turns and challenges to an authoritative server.
- Introduced six-character room invitations for real-time matches.

### V6.3 — Control and discard fixes
*—*

- Improved controls and round/discard resolution when everyone passes.

### V6.2 — Centered bottom controls
*—*

- Rearranged controls to reduce button overlap with cards.

### V6.1 — Precise selection and preselection
*—*

- Improved selection of overlapping cards and preserved preselection during other players’ actions.

### V6.0 — Scrollable single-row hand
*—*

- Introduced a horizontally scrollable, overlapping hand layout for large hands.

### V5.9 — Hand sorting
*—*

- Sorted hands from 2, A, K, Q, J, 10 down to 3.

### V5.8 — Random opening-player feedback
*—*

- Added an animated announcement for the randomly chosen opening player.

### V5.7 — Declared-rank display
*—*

- Displayed the rank declared for the current round.

### V5.6 — Own-seat positioning
*—*

- Adjusted spacing between the local player’s seat information and hand.

### V5.5 — Duplicate-notice cleanup
*—*

- Removed redundant play notices in the top area.

### V5.4 — Concise play notices
*—*

- Compressed other players’ action notices to concise single-line messages.

### V5.3 — Play feedback
*—*

- Improved feedback about the active player and number of cards played.

### V5.2 — Challenge callout
*—*

- Added the “假的！！！” (FAKE!!!) challenge callout and reveal feedback.

### V5.1 — Player avatars and active state
*—*

- Enlarged avatars/nicknames and emphasized the current actor.

### V5 — Cardboard tabletop
*—*

- Made the cardboard table the visual focus of the dorm scene.

### V4.1 — Camera and table composition
*—*

- Further improved cardboard-table framing and placement.

### V4 — Realistic dorm setting
*—*

- Added a more realistic university-dorm layout with beds, desks, and a cardboard table.

### V3 — Dorm-themed multiplayer table
*—*

- Introduced the dormitory backdrop and seats surrounding the table.

### V2.1 — Face-down and reveal areas
*—*

- Improved face-down/reveal regions and challenge visuals.

### V2 — Interactive web table
*—*

- Moved card gameplay into a browser UI with card-to-table animations.

### V1 — Initial rules prototype
*—*

- Established the initial rules for declared ranks, turns, challenges, collection, and winning.

---

### Important current-rule clarifications

- **V7.9 decks:** one 54-card deck for 1–2 players; two 108-card decks for 3–6; jokers included in every deck.
- **Challenge interval:** the two-second pause prevents an instant next play; it is **not** a challenge deadline.
- **Event probability:** **3% overall** after each successful play, once per type per match, disabled in solo mode.
- **A changelog does not prove a live deployment:** verify GitHub Pages and Cloudflare Worker releases separately.

[🇨🇳 Chinese changelog](./CHANGELOG.md) · [🇬🇧 Return to English README](./README.en.md)
