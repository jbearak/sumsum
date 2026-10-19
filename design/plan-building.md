# Plan: build "The building" into the library

Status: revised after the Opus and Astra reviews, 2026-10-18. The user asked for the result to be merged to `main` and pushed after review.

The user chose the Opus round-2 mockup `design/mockups/r2-a-building-opus.html`, with additions from the album (`r2-c-album-opus.html`) and Channel Sumsum (`r2-b-channel-opus.html`) mockups. The context is in [ui-brainstorm/brief-2.md](ui-brainstorm/brief-2.md) and in AGENTS.md (Project purpose):

- A parent plays videos for a five-month-old, one-handed, in short sittings, with repeated favourites.
- No research desk. What couldn't be found stays quiet.
- No marketing copy. Playful design is welcome.

## Approach

Evolve `library.template.html`; don't rewrite it. Every current view, route, evidence rule, licensed-service rule, the theme picker and the language toggle stay. The mockup is a visual reference, not code to paste. Never copy its copy: no brand, no "plays" claims.

## Shared rules

- **Eligibility for generated picks (`pickable(r)`).** Generated shelves, the Up next fallback and Surprise use only records that:
  - have a destination;
  - have an access of `played`, `local`, `vimeo` or `public`, so never `web`, `hop`, `licensed`, `restricted` or `unavailable`;
  - are not `region-limited`;
  - pass the Spoken and Length preferences.

  The UI never says these "play". The cards keep their access line or mark. Starred and Again show everything the user chose, with each item's real Watch shape: VPN, library card, unavailable.
- **Possible copies.** A record linked only as `possible` can appear as a video. Its card uses the existing possible-copy tag wording, never the candidate episode's title or number, and it never gets the ✓ sticker.
- **The ✓ (Watched) sticker on a record card.** Only when the record is linked as `whole-candidate` or `alternate-edition` to exactly one episode, and that episode is marked watched. It looks like `seenTag()`, not like a coverage mark or an evidence badge.
- **Opens.**
  - **Counted from:** viewing surfaces only, which are Home (hero, cards, Again, sitting), Browse and Starred cards, the episode hero's Watch, the parts train and Surprise.
  - **Not counted from:** research lists or record pages.
  - **How:** one shared handler on `click` (primary button, including keyboard activation) and `auxclick` (middle button).
  - **Timing:** storage writes happen at once, but any re-render is deferred (`setTimeout(0)`), so the activated link is never removed before it navigates (Gecko cancels navigation of a disconnected link).
- **Titles.** Use `epTitle`, `epAlt`, `recTitle`, `titleDir` and the editorial-title rules everywhere. Nothing new composes titles.

## 1. Session data (local storage, part of the backup)

- **`sumsum-opened`:** record key (`mapKey(r)`) → `{n, last}`, where `n` is a positive integer and `last` an ISO date.
- **`sumsum-sitting`:** an ordered array of record keys with no duplicates.
- **Unknown keys** are kept, but not shown.
- **Malformed stored values** are dropped field by field.
- **Backup.** The export adds `opened` and `sitting` to `sumsum-direct-links-v1`. The import:
  - accepts a backup holding only these fields;
  - validates them: a null-prototype object, keys under 2048 characters and not in `BAD_KEYS`, integer `n` ≥ 1, a parseable date;
  - merges them: the maximum `n`, the later `last`, and queue items appended without duplicates;
  - changes nothing when the same backup is imported twice.

  The `imported` toast counts the new fields in both languages.

## 2. Preferences: Spoken and Length (UI preferences, out of the backup)

- **Language groups for each record** (from `language`): Hebrew if any part is `he`; English if any part is `en`; Other if it has another code; Not recorded if the value is empty or `und`. Mixed values count in each group they contain.
- **Browse Spoken facet:** multi-select chips (Hebrew / English / Other / Not recorded) with dynamic counts, hash `spoken=`. Help line: "From the recorded language".
- **Browse Length facet:** single-select chips (Any / up to 5 / 10 / 20 / 30 minutes), hash `len=`. Unknown durations pass only under Any.
- **Home controls:** Spoken is Hebrew / English / All languages, stored as `sumsum-spoken`; Length uses the same steps, stored as `sumsum-length`. Home's controls stay visible. When a filter empties something, a one-tap "Show all lengths" or "All languages" appears.
- **Hashes:** Browse hashes change only Browse state, never the stored Home preferences. Shelf links from Home write the preferences into the Browse hash explicitly.
- **The guide** is never filtered by them.

## 3. Navigation, routes and the quiet research pages

- **Routes:** `#/home` is the start view when a guide exists; with no guide, `#/` starts on Browse. `parseRoute` learns `home`, and every old route keeps working.
- **Tabs:** Home, Guide, Browse, Starred. The Browse arrow menu and its code go.
- **Surprise in the nav:** a Surprise item in the nav list after Guide, visible on phones only, so the bottom bar's visual order matches the DOM order. The masthead's die button is visible on wider screens only.
- **Footer:** "Not found · N" (N = documented episodes without a whole copy) links to Missing episodes, replacing the Research to-do footer link. Missing episodes' header links quietly to Videos to identify, Identified videos and Research to-do. The Hebrew string avoids "מה חסר".
- **The guide overview** opens on its toolbar and productions. The coverage goal panel keeps its own toggle (`state.goalOpen`) and moves to the bottom of the guide overview. Up next moves to Home.

## 4. Home

- **Desktop:**
  - **Controls row:** Spoken and Length, the latter with a timer icon.
  - **Hero (left):** Up next, the existing rule, which is the next unwatched core episode with a whole copy. It now chooses among the episode's eligible whole and alternate copies, so it never picks a copy and then rejects it. It has "Another" and "Previous". When there is a last-opened video, the hero also offers "Again: <title>" as a second ticket. If no core episode qualifies, the hero falls back to a pickable clip.
  - **Right column:** a **Sitting** card (queue with up/down/remove, total time, Open next, Clear, and Undo after Clear) and an **Again** card (last opened first, ×N, one-tap Watch, up to 8).
  - **Character stoop:** the top 10–12 characters by tag. Each is a round thumbnail crop with names in both languages and a count under the current preferences. Kippi gets a CSS quill ring and Oofnik a bin. A tap opens Browse filtered by that character plus the preferences.
  - **Shelves:** Starred (all, real shapes, "See all" → `#/starred`); Songs and music (pickable, "See all N" → the Browse query it shows); Productions (doors to the guide). Empty shelves are hidden.
- **Phone (≤ 640 px):** a single column with the hero, a sitting bar if the queue is non-empty, the Again row, the stoop as a horizontal scroll, then the shelves. The tabs become a fixed bottom bar. The toast rises above the bars. Fixed bars never cover focus: `scroll-padding-bottom`.

## 5. Surprise

- **Where:** the masthead die (desktop) and the nav item (phone).
- **The pool:**
  - On Browse or Starred, the current result list filtered by `pickable` without the preferences (Browse's own facets decide).
  - Elsewhere, all pickable records.
- **The pick:** a popover with the thumbnail, title, ticket Watch, "+ Sitting", Another and Previous. It is labelled "{Character} picks" when a character filter is active. The die rolls through א–ו (off under reduced motion).
- **Empty pool:** a line saying which preference empties it, with one-tap clears.
- **Randomness:** seeded by `data-start-seed` in checks.
- **Popover rules:** Escape, an outside click and route changes close it, and focus returns to its opener, as with the theme picker.

## 6. Visual layer (existing tokens only)

- **No new palette tokens.** The awning uses `--brand` and `--accent`; ledges and the stoop `--surface-3` and `--line-strong`; stickers `--surface`, `--ink`, `--line-strong` and the shared `--star`.
- **Ticket Watch:** primary Watch links on Home, cards and the episode hero get a perforated stub with the duration (`aria-hidden`; names unchanged). VPN, licensed and failed shapes and marks stay. The stub uses logical properties for RTL.
- **Stickers:** the star, ×N and ✓ (per the rule above).
- **House-number plaques:** for numbers on guide tiles and the episode hero.
- **Parts train:** in the episode hero, when `partsOf(e)` has numbered parts. Cars follow `partsOf` numbering and each car's `accessOf` shape. A car you've opened is marked "Opened" (never evidence). Cars start at the inline start. The existing parts list stays.
- **Watched control:** moves into the episode hero beside Watch.
- **Oofnik's bin:** a CSS bin in the empty Browse result, the existing text, and buttons that remove one active filter each, showing the count each would give.
- **Targets:** 44 px for star, "+", queue controls, chip removal and popover close.
- **Motion:** the die, the star sticker and a card lift, and none under reduced motion. No sounds.
- **Copy:** plain labels only. Home has no lede.

## 7. Phases

Each phase updates the checker and `docs/library-ui.md` with the code, passes the build and checks, and is committed. From phase 3 on, each UI phase is reviewed in headless Chromium at 320, 390, 641, 761 and 1280 px, in light and dark and in English and Hebrew, with reduced motion and with keyboard focus.

1. Session data, the open-tracking handler and backup import/export, with tests: only-new-fields imports, malformed values, idempotent merges, link still connected after the click.
2. Browse Spoken and Length facets and Oofnik's bin, with tests: counts add up, Not recorded, single-select length, hash and reset, chips.
3. Routes and nav: `#/home` with a minimal Home that holds Up next with eligible-copy selection and region-limited excluded; tabs; the footer link; the guide overview; removal of the Browse menu; the minimal phone bottom bar. The checker rewrites the nav, masthead and Up next contracts.
4. The full Home (stoop, Again, Sitting card, shelves), the phone sitting bar, Surprise and its popover, with tests: pool eligibility asserted directly, seeded picks, popover dismissal, the ✓ rule.
5. Visual layer: ticket, stickers, plaques, awning, stoop styling, the parts train, Watched in the hero. Measure contrast and colour distances for the new uses.
6. README "Using it". Final browser review, including Zen opening the worktree build from `file://`, which is a different file location, so the user's own storage is untouched.

## Then

Self-review, then a fresh `delegate_task` GPT-6.1-Sol review loop until there is no valid feedback or there is high confidence. Then a pull request to `main`, merge and push.

## Deferred

The holiday shelf (Hebrew calendar), masthead-wide search, and the Word of the Day, Elmo and In English shelves. The stoop, Productions and the Spoken control reach all three.
