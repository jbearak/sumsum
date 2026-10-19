# Plan: build "The building" into the library

Status: draft for review, 2026-10-18.

The user chose the Opus round-2 mockup `design/mockups/r2-a-building-opus.html`, with additions from the album (`r2-c-album-opus.html`) and Channel Sumsum (`r2-b-channel-opus.html`) mockups. The context is in [ui-brainstorm/brief-2.md](ui-brainstorm/brief-2.md) and in AGENTS.md (Project purpose):

- The main use is a parent playing videos for a five-month-old, often one-handed, in short sittings, with repeated favourites.
- No research desk. What couldn't be found stays documented but quiet.
- No marketing copy. Plain labels.
- Playful design is welcome.

## Approach

Evolve `library.template.html`; don't rewrite it. The current views (guide with Album/Numbers/List, Browse and its facets, Starred, episode, record and slot pages, the Missing, Videos to identify and Research to-do pages), routes, evidence wording, licensed-service handling, theme picker and language toggle all stay. They are covered by `scripts/check-library.cjs` (4,700 lines) and encode rules the mockups only sampled. The mockup is a visual and interaction reference, not code to paste. We add a Home view and personal-session features, restyle shared components, demote the research pages, and update the checks and docs to match.

## What changes

### 1. Personal session data (local storage, part of the backup)

- **Recently opened.** `sumsum-opened`: record key → `{n, last}` (open count and ISO date). Every Watch link that opens a record (the `watchLink`/`recWatch` links, the queue's Open next, and Surprise picks) records an open on `click` and on middle-click (`auxclick`). Opening is not watching: the Watched mark stays a separate, manual, per-episode control, and evidence is untouched.
- **Sitting queue.** `sumsum-sitting`: an ordered list of record keys. Add from any card or hero ("+"). Remove, reorder (up/down buttons) and clear it. "Open next" is a real `<a target=_blank>` to the first item's destination (so the new tab is a user gesture); on click it records the open and removes the item.
- **Backup.** The export adds `opened` and `sitting` to the existing `sumsum-direct-links-v1` object; the format name stays. The import merges them: open counts take the maximum and the later date, and queue items are appended without duplicates. Older backups without these fields still import. UI preferences stay out of the backup.
- **Keys.** These use the same record key as stars (`mapKey(r)`), so they survive the way stars do. Unknown keys stay stored, so backups round-trip, but are not shown.

### 2. Two session preferences: Spoken and Length

- **Spoken:** Hebrew / English / Both, from each record's `language`. `he`, `he-*` and `*-he` count as Hebrew; `en*` and `*-en` as English; a mixed `en-he` as both. Arabic, Russian and unknown languages show only under Both. Stored as `sumsum-spoken` (a UI preference, out of the backup), default Both.
- **Length:** Any / ≤5 / ≤10 / ≤20 / ≤30 minutes, from `durationSeconds`. Unknown durations show only under Any. Stored as `sumsum-length`, default Any.
- **Where they apply:** Home's shelves, Up next and Surprise me, and they become two new Browse facets ("Spoken", "Length") with dynamic counts, written to the hash like the other facets (`spoken=`, `len=`). In Browse they are ordinary filters; Home's controls set the stored defaults that Home and Surprise use. A Browse link from a Home shelf carries them explicitly.
- **Not filtered:** neither applies to the episode guide, which documents every episode.

### 3. Home view (new default route)

`#/home` becomes the start view when the guide exists; with no guide, Browse stays the start view. `#/guide` and every existing route keep working. Layout at 1280 px:

- **Controls row:** the Spoken and Length segmented controls, with the kitchen-timer icon beside Length.
- **Up next hero (left, large):** the existing `upNext()` rule (the next unwatched core Rechov Sumsum episode with a whole copy that plays without VPN or card), extended to respect Spoken and Length. If no episode passes, the hero falls back to a clip that passes. It shows the real thumbnail, title, production and format line, the ticket Watch button, "+" (sitting) and the star. "Another" (the die) and "Previous" step through the candidates.
- **Right column:** a **Sitting** card (queue rows with up/down/remove and the total duration; Open next; Clear) and a **Recently opened** card (last 6, each with "×N" and a one-tap "Again ↻" Watch link).
- **Character stoop:** the 10–12 characters with the most videos, from the existing character tags. Each is a round crop of a representative thumbnail, with its English and Hebrew names and a count under the current Spoken and Length. Kippi gets a CSS quill ring and Oofnik a CSS bin and lid. A tap opens Browse filtered by that character, plus Spoken and Length.
- **Shelves:** horizontal rows of cards with scroll snap. Each title links to the equivalent Browse query ("See all N"), and each shelf has a shuffle button that reorders it.
  - Starred.
  - Play again: opened at least twice, starred items excluded, so it doesn't repeat Starred.
  - Songs and music, from the music/songs themes.
  - Under 5 minutes.
  - Word of the Day (its production).
  - Elmo's talk show.
  - In English (Shalom Sesame).
  - Holiday: only within about two weeks of a Jewish holiday, using `Intl.DateTimeFormat` with the `hebrew` calendar and the existing holiday theme tags; hidden if the calendar isn't supported.
  - Productions, as doors to the guide.
- **Shelf card:** the same component everywhere: thumbnail with duration, a "×N" sticker if opened before, and a ✓ sticker if its episode is marked watched; title (verbatim title rules as now); production and format line; ticket Watch button; "+". Uploads that would not get a Watch button are never on a shelf. Possible copies are uploads, so they may appear as videos; they never add to an episode's coverage. Videos that failed an availability check or need the VPN or a library card are left off Home shelves (they stay in Browse).

### 4. Navigation and the quiet research pages

- **Tabs:** Home, Guide, Browse, Starred. The Browse arrow menu goes.
- **Footer:** one quiet link, "Not found · N" (N = documented episodes without a whole copy, today's Missing count). It goes to Missing episodes, whose header links to Videos to identify, Identified videos and Research to-do. The routes stay the same.
- **Guide overview:** the coverage goal panel moves out of the guide's head into a collapsed "Coverage" `<details>` at the bottom of the guide overview, with the same content. Up next moves to Home. The guide opens on the toolbar and productions.
- **No brand:** there is still no wordmark or brand, per the existing masthead rule. The awning (a scalloped bottom edge on the masthead, CSS only) is decoration, not a brand.

### 5. Masthead and phone layout

- **Desktop masthead:** tabs, then the tools: Surprise me (die button), Sitting (button with count, opening a popover with the Sitting card), the theme button, then the language toggle. The theme button keeps its size and place relative to the language toggle.
- **Phone (≤ 640 px):**
  - The tabs become a fixed bottom bar: Home, Guide, Surprise, Browse, Starred, with icons and short labels. The DOM order stays the same.
  - When the queue has items, a slim "next in sitting" bar sits just above it, with the thumbnail, title and an Open next ticket.
  - The masthead keeps the theme, language and Sitting buttons.
  - Primary targets are at least 44 px. Safe-area insets are respected.
- **Masthead search (deferred):** a single search across episodes and videos is a candidate for a later round; each view keeps its own search now.

### 6. Surprise me

- **Where:** the die button in the masthead or bottom bar, and "Another" in the hero.
- **The pool:** uploads that play without a VPN, card or purchase (access groups direct and public, recorded `played`, `local` and `vimeo`; never `unavailable`, `restricted`, `hop` or licensed), passing Spoken and Length. On Browse, the pool is the current Browse result list, filtered the same way.
- **The pick:** a popover card with the thumbnail, title, ticket Watch button, "+", "Another" and "Previous" (a short pick history). With a character filter active, it is labelled "{Character} picks", as play. The die face rolls through א–ו (a CSS animation, off under `prefers-reduced-motion`).
- **Empty pool:** a short line that says why ("Nothing under 5 minutes in English") and offers to clear Length or Spoken.

### 7. Visual language (Terracotta tokens only)

- **Masthead:** an awning edge.
- **Ticket Watch button:** the primary Watch links on Home, cards and the episode hero get a perforated stub showing the duration (`aria-hidden`; the accessible name is unchanged). Licensed and VPN links keep their shapes and marks.
- **Stickers:** the star is a sticker on thumbnails; "×N" and ✓ as above.
- **House-number plaques:** for episode numbers on guide tiles and the hero.
- **Shelf ledges:** a ledge under each shelf row.
- **Stoop:** a stone step under the character row.
- **Parts train (episode page):** when an episode has numbered parts, the decision area shows them as train cars, each a link that records opens. Opened cars are filled. The existing parts list stays below.
- **Watched control:** moves into the episode hero beside Watch, for one-handed use. The aside keeps the evidence ladder and identity.
- **Oofnik's bin:** the empty Browse result. A small CSS bin, the existing "no uploads match" text, and buttons that relax the active filters one at a time, with counts.
- **Colour:** coverage colours, the licensed teal and evidence wording keep their meanings. Character colour comes only from real thumbnails. New tokens (awning, ledge, stoop, sticker) are added to every palette and both schemes, and pass the checker's contrast and distance rules.
- **Motion:** only the die roll, a sticker pop on star, and a card lift on hover. All are off under reduced motion. No sounds.

### 8. Copy

Plain labels: Home, Up next, Sitting, Open next, Recently opened, Again, Play again, Spoken, Length, Surprise me, Another, Previous, Not found. No ledes or taglines on Home. The current ledes on other views are reviewed under the same rule and kept only where they explain something non-obvious. Every string gets EN and HE, kept in parity by the checker.

### 9. Docs and checks

- **Checker (`scripts/check-library.cjs`):**
  - Start route and nav: Home tab, no Browse menu.
  - Masthead structure.
  - The Home view: shelves hold only eligible uploads; Up next obeys the rule; the stoop counts; Spoken and Length counts in Browse; the hash round-trip.
  - Surprise: the pool's eligibility, including under Browse filters.
  - Opened and sitting: persistence, backup export and import round-trip, merge rules, old backups.
  - Footer "Not found" count, routes for the demoted pages, string parity, new tokens in every palette, contrast.
  - The guide's goal panel is now inside a `<details>`.
- **Docs:** update `docs/library-ui.md` (views, routes, storage keys, the new preferences, the phone layout) and the README's "Using it" section.

## Phases (each committed when the build and checks pass)

1. Session data: opened, sitting, spoken and length prefs, backup, plus checks.
2. Browse facets Spoken and Length, and Oofnik's bin, plus checks.
3. Home view, route and nav changes, the footer link, guide overview cleanup, plus checks.
4. Surprise me, the Sitting popover, the phone bottom bar and the sitting bar, plus checks.
5. Visual layer: tokens, awning, ticket, stickers, stoop, plaques, train, Watched in the hero. Browser review at 390 and 1280 px, light and dark, EN and HE, with headless Chromium screenshots.
6. Docs and README.

Then a self-review, a Sol review loop until high confidence, then merge to `main` through a pull request and push.

## Open questions for reviewers

1. Is removing the Browse arrow menu (moving its pages behind the footer "Not found" link) right, given the user's "no research desk" note, or should Identified videos stay reachable from Browse?
2. Should Home's Spoken and Length be stored preferences, or reset each visit?
3. Should Up next stay "next unwatched core episode", or lead with the last-opened favourite, since a baby repeats favourites?
4. Is the shelf list too long for the use case? Which shelves should go?
5. Anything in the current views that conflicts with the one-handed phone use and that this plan misses?
