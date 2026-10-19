# Round two: shelves, episodes and a little mischief

## What to keep from the two choices

I read the brief, project rules, UI documentation and both mockup sources, then rendered both at 1280 px with `html_preview`. Neither render reported console errors. The screenshots showed neutral thumbnail placeholders, including the character circles, so they establish layout rather than the effect of the real pictures. Living Room's capture stopped at 4,000 px of a 5,424 px page. I also inspected the source for the episode and filter interactions. This was not a full interaction or phone review.

Living Room works because the next action is easy to spot. Large pictures, character buttons and short shelves let someone choose without first understanding the catalogue. The destination is on the Watch button. Its broad featured card has room for an actual decision. Keep that reading order and the single search box. Reduce the long stack of shelves, remove the conversational headings and taglines, and keep research out of the main navigation.

Programme Guide works because one episode remains one entry. Its copies do not compete as unrelated cards. The production rail gives the collection an understandable shape, and Album, Numbers and List support different ways of looking through it. Keep those structures, the labelled copy roles and the ordered parts. Replace the opening editorial spread and oversized pitch sentence with useful controls. Fold source details into a small disclosure below the viewing choices.

The best combination puts Living Room's pictures on Programme Guide's episode structure. A thumbnail shelf can contain episode entries, each with a direct viewing action and its other copies underneath. Standalone clips still have their own cards and upload counts.

## Rules shared by every idea

These are constraints on all the ideas below, including their combined concepts.

- Keep series, program type, theme and character filters with counts recalculated against the other active filters. State whether a count means episodes, installments or videos. Possible copies never contribute to coverage, viewing-choice totals or Watch actions.
- Keep longest-first duration sorting. On an episode card, display and sort by the selected eligible copy's known duration. Do not sum duplicate copies or treat an excerpt's duration as the episode's runtime. Unknown durations follow known ones. Other layouts preserve the selected sort.
- Keep full episodes, complete short-series installments, talk-show installments, clips and compilations distinguishable. A time filter does not turn a short installment into a full broadcast. Keep productions and their numbering systems separate.
- English is the default. Hebrew switches the layout to RTL and uses the existing title precedence. Published Hebrew titles and story titles remain verbatim, with full text available. Editorial translations remain labelled. Numbers, durations and host names retain sensible reading direction.
- Terracotta and System remain the defaults. Keep the existing palette picker and Light/Dark choices. All decoration uses palette tokens, never coverage colours or licensed-access teal. The star colour belongs to personal stars.
- State evidence in words: "Details checked, not test-played", "Seen to play", "Checked in full" or "Compared with a reference". No evidence meters, stars, lights or collectible badges. Personal Watched marks remain separate and explicit.
- Watch buttons name the destination and access requirement. Licensed listings are not free uploads. Hop pages need an Israeli connection; direct Vimeo links preserve the complete URL and privacy hash. Known failures do not become public viewing links. Playback opens the original host in a new tab, without embedding or downloading video.
- Research remains available through a quiet "Missing episodes and source notes" link and small episode disclosures. No assignments, unfilled-collection challenges or requests to hunt for copies.
- Use real thumbnails, original CSS shapes and type. No copied character illustrations, logos or decorative video downloads. Neutral numbered placeholders identify missing images without pretending to be programme stills.
- Every playful action has a normal button, keyboard support, visible focus and a useful accessible name. Touch targets are at least 44 px. No hover-only information, autoplay, sounds, flashing or mandatory animation. Reduced-motion replaces movement with an immediate state change.

## Twenty ideas

### 1. The stoop

Turn the character row into a shallow stone step. Circular thumbnail crops or simple original shape emblems sit just above a single baseline, with names and live counts underneath. Kippi ben Kippod, Moishe Oofnik and Elmo have equal-sized buttons. Selecting one presses its button into the step and adds the ordinary character filter chip. No mascot follows the pointer around the page.

Builds on Living Room's character filters and Programme Guide's stable selection context.

### 2. House-number episodes

Give each episode a small rectangular number plaque beside its title. In Numbers view the plaque grows, while title, production and coverage words remain visible. Use the documented programme number, never a display position or invented street address. An unnumbered installment gets its title, not a fabricated number.

Builds on Programme Guide's Numbers view and brings a street detail onto Living Room's picture cards.

### 3. Copies in the drawer

An episode card has a narrow lower edge labelled "Copies" with an eligible-copy count. Activating it reveals a flat list of host, role, duration, access and evidence wording. One open drawer per row prevents a shelf becoming a wall of controls. The dedicated episode page remains available. On a phone, the drawer expands below its card.

Builds on Programme Guide's attached copies and Living Room's immediate destination button. Possible copies stay in source notes, outside this drawer and count.

### 4. Surprise me

A small die-shaped button beside the result count chooses one item within the current filters and access choices. It shows a normal card with "Another" and the destination button. It never opens a host automatically. In episode mode, draw equally among distinct eligible episode identities, so an episode with six uploads gets no extra chances. In video mode, state that the draw is among videos.

Builds on Living Room's featured choice and Programme Guide's distinction between identities and copies. The list behind it stays longest-first. Avoid repeats during the current draw session until its eligible set is exhausted.

### 5. Kippi picks

Offer a small "Kippi picks" action inside the Kippi character filter, accompanied by an original round hedgehog-like shape made from scallops and a nose. It applies the visible Kippi filter and draws from those results using idea 4. No invented character dialogue and no claim that the character endorses a video. The character label remains ordinary text.

Builds on Living Room's portraits and uses Programme Guide's episode-based selection. A one-time nose tilt can acknowledge the press, but the result appears immediately.

### 6. Oofnik's lid

The "Another" button on a surprise card has a tiny CSS bin-lid shape above it. Pressing it lifts the lid once and replaces only that card. The old choice remains reachable through "Previous choice". This is a brief Oofnik reference, never a delete control or a judgment on the episode.

Builds on Living Room's "Another one" and Programme Guide's persistent context. Keep the lid away from evidence and missing-episode notices.

### 7. Elmo's guest cards

Within Elmo's talk-show production, show episode thumbnails as cards with a small pair of CSS chair outlines below the production heading. Use the documented guest title on each card. A "Choose a guest" button draws an eligible installment within the current filters. Do not invent guest portraits or infer guests from thumbnails.

Builds on Living Room's Elmo shelf and Programme Guide's production rail. It gives this production its own detail without making the whole library a talk-show set.

### 8. The TV dial

Place an optional compact dial beside the production selector. Its labelled positions correspond to actual productions; turning it or using arrow keys chooses a production. Clicking a position works too. The standard select stays available, especially on phones. A single short pointer turn is enough; no tuning static, audio or delayed results.

Builds on Programme Guide's production rail and Living Room's family-room objects. Names and years stay visible so classic and modern productions cannot collapse into one channel.

### 9. Shelf tabs

Replace the long home-page stack with three or four pinned shelf tabs above one broad picture shelf. Start with plain labels such as "Starred", "Songs" and "In English". Each tab is a saved query, displays the relevant count and opens the same filters through "See all". The user can pin a different current query without building a playlist.

Builds on Living Room's saved-query shelves and Programme Guide's compact navigation. If a query mixes formats, show separate labelled sections rather than calling all results episodes.

### 10. Album corners

Give episode thumbnails two small paper corners, drawn with borders. A personal star sits outside the picture instead of covering a face. Opening the entry lifts its paper edge by two pixels and then settles. Titles and controls remain aligned, without random card rotations.

Builds on Programme Guide's Album view and Living Room's image sizes. Numbers and List omit the paper corners so dense views stay clean.

### 11. Number blocks, with titles

In Numbers view, render the documented number as a large block-print numeral on a shallow square tile. Under it, retain the readable title, category and coverage words. Keyboard navigation follows the visible order. A small thumbnail can appear beside the selected tile's details without requiring hover.

Builds on Programme Guide's compact number scanning and Living Room's visual recognition. Numbers are identities, not progress counters. This view does not become a chart of empty collection slots.

### 12. The alphabet drawer

A button marked "א ב ג · Titles" opens a title-initial index. Only letters that occur in displayed titles have results; each shows a dynamic count. English mode offers an English title index, with Hebrew available explicitly. Selecting a letter adds a removable title filter while preserving longest-first ordering inside it.

Builds on Programme Guide's scanning tools and Living Room's direct filters. These letters index titles, not educational subject matter. Do not infer that a video teaches aleph because its title begins with aleph.

### 13. Filter pegs

Active filters look like small labels attached to a short rail by round pegs. Each has its ordinary name and remove button. The rail wraps rather than scrolling offscreen. Below it, "Theme" and "Character" reveal searchable lists with dynamic counts. A pressed peg changes depth, not semantic colour.

Builds on Living Room's progressive filters and Programme Guide's orderly toolbar. The playful shape costs no extra click and never replaces the filter text.

### 14. Time buttons

Offer shallow physical-looking buttons for "Under 5 min", "Under 10 min" and "Any length". They behave as a single-choice duration filter and show result counts. "Any length" returns to the full filtered set. Unknown durations appear there, not under an unverified time limit.

Builds on Living Room's short shelf and Programme Guide's explicit format labels. The active program type remains visible above the results, and longest-first still applies within the chosen limit.

### 15. A fold-out parts strip

For an episode with parts, "See parts" unfolds a vertical sequence of numbered thumbnail rows. Each has its documented part number, host, duration and destination button. Missing part numbers remain textual notes. Never invent a continuous running time or draw a completion bar across the sequence.

Builds on Programme Guide's ordered parts and Living Room's watch-first episode page. Optional "Opened this part" marks are personal session aids, separate from Watched and evidence. Opening one part never marks the episode watched.

### 16. One quiet shelf for tonight

A small "Tonight" tray can hold a few explicitly chosen episode entries or standalone videos. Add through a labelled secondary action; remove with Undo. Numbered positions can be reordered with buttons as well as dragging. Selecting an entry returns to its viewing choices, with requirements still visible. It never chains playback across hosts.

Builds on Living Room's family shelf and Programme Guide's one-entry-per-episode structure. Make it optional and collapsed when empty. Do not automatically put every starred item there.

### 17. The empty shelf

With no matches, show two simple bookends and the words "No matches". Beneath them, offer specific filter changes with computed outcomes, such as "Remove Kippi · 12 videos" only when that is the real count. The filter rail stays visible. No sad character, apology, invented recommendation or invitation to find missing footage.

Builds on Living Room's filter relaxation and Programme Guide's clear counts. An empty Starred shelf instead says "No starred items" and links to Browse. These are different empty states.

### 18. A small wave after a star

After the user stars an entry, two small CSS eyes briefly peek over that card's upper edge. The star itself changes immediately and a text message says "Starred" with Undo. The eyes appear only after the action, never on a timer, and do not cover the thumbnail or title. A quiet-controls preference can suppress these flourishes.

Builds on Living Room's easy personal stars and Programme Guide's stable card identity. No rewards for watching more, streaks or collection-completion pressure.

### 19. Letterpress headings

Set short section labels in a heavy rounded system font, with one modest offset border behind the label block. Use the existing Hebrew-capable font stack for text and unmodified source titles. Give durations tabular numerals. Reserve the playful treatment for labels such as "Songs" and "Starred", not every word on a card.

Builds on Living Room's approachable headings and Programme Guide's disciplined title hierarchy. Avoid simulated Hebrew lettering in English, distorted Hebrew glyphs and tiny spaced-out capitals.

### 20. The reverse of the card

At the bottom of an episode entry, a plain "Source notes" disclosure opens the catalogue title, uploader labels, exact source links and unresolved copies. Its surface has a faint ruled-paper border, with no flipping animation. Elsewhere, a small footer link opens missing-episode documentation. Neither asks the user to investigate.

Builds on Programme Guide's source attachment and Living Room's quiet research access. Keep viewing requirements and current evidence wording above this disclosure, where they inform the actual choice.

## Combined concepts

### A. Stoop and shelves

This is my first choice. Keep Living Room's first-screen ease, use episode identities for its shelves, and add Programme Guide's production rail and three layouts. The stoop, filter pegs and one surprise button provide most of the playfulness. Copies open underneath an entry; the episode page remains the stable place for parts and notes.

Visual sketch, desktop:

```text
Sumsum       [ Search                              ] [Palette] EN / עברית
Home   Episode guide   Browse   Starred
------------------------------------------------------------------------
Production rail     Character stoop:  Kippi   Oofnik   Elmo   More
names + years       [Series] [Program type] [Theme] [Character]
                    Active filter pegs          [Longest first]
                    [Starred] [Songs] [In English] [Pinned query]
                    Result count                [Surprise me]
                    [large picture] [large picture] [large picture]
                    title / format  title / format  title / format
                    access / Open   access / Open   access / Open
                    [Copies]        [Copies]        [Copies]
                    Album / Numbers / List
------------------------------------------------------------------------
Missing episodes and source notes              About and backup
```

On a 390 px phone, the rail becomes a production select. The character row scrolls with visible names, while active filters wrap. Use two columns only while titles and destination buttons remain readable; otherwise use one. The primary decision card is always full width. Keep layout choices above the results when in the guide.

Type uses the existing sans stack for titles and controls, with heavier rounded shelf labels. Colour uses `--bg` for the page, `--surface` for cards, `--surface-3` for the step and `--line-strong` for pegs. The masthead uses `--brand` and `--mast-ink`; actions use `--primary` and `--primary-ink`. A thin `--accent` shelf edge adds warmth. Motion is limited to a pressed character button and a short drawer reveal. Reduced-motion shows both states instantly. No decoration changes evidence meaning.

### B. The television cabinet

A more playful alternative centred on one selection. A CSS television cabinet frames a real thumbnail and ordinary viewing controls; it never contains an embedded player. The production dial chooses the collection, and "Surprise me" chooses within visible filters. Beneath it sits a compact Programme Guide with Album, Numbers and List. Choosing a guide entry updates the cabinet without losing scroll position or filter state.

Visual sketch, desktop:

```text
Sumsum     [Search]                              [Palette] EN / עברית
[Production selector]  [Filters and counts]      [Longest first]
+--------------------------------------+------------------------+
|                                      | Production dial        |
|             Real thumbnail           | title + category       |
|             duration                 | access requirement     |
|                                      | evidence in words      |
+--------------------------------------+ [Open on host]         |
| [Previous choice] [Surprise me]        | [Other copies]         |
+--------------------------------------+------------------------+
Episode guide                          Album / Numbers / List
[episode card]     [episode card]     [episode card]
```

The cabinet is low and wide, with a thin frame rather than a large decorative appliance. On phones it becomes a simple thumbnail card; the dial collapses to the production select. A parts-only episode shows "See parts" in the decision area. A possible-only entry never gets a play control. Normal browsing remains available without using random choice.

Use rounded bold type for the current production and plain sans for the episode title. Cabinet surfaces use `--surface-2` and `--surface-3`, outlines use `--line-strong`, and the dial pointer uses `--ink`. Use `--accent` for small cabinet trim and `--primary` for actions. No fake coloured signal lights. A short dial rotation and Oofnik lid movement are the only motion; reduced-motion skips both. This concept is fun, but the cabinet must not push the first guide row below a typical desktop viewport.

### C. The street album

Use Programme Guide as the main screen, with Living Room's large thumbnails and character selection across the top. Episodes appear as album cards with house-number plaques. Production tabs resemble simple street plates made from rectangles and type. Album corners, the title alphabet drawer and the copies drawer supply the play. This is the best option if the user usually knows the production or episode number.

Visual sketch, desktop:

```text
Sumsum      [Search]                             [Palette] EN / עברית
[production plate + years] [production plate + years] [More]
[Character stoop]          [Series] [Type] [Theme] [Character]
[Title initials] [Active filters]                [Longest first]
Episode count             Album / Numbers / List     [Surprise me]
+-------------------+ +-------------------+ +-------------------+
| real thumbnail    | | real thumbnail    | | real thumbnail    |
| [number plaque]   | | [number plaque]   | | [number plaque]   |
| title / category  | | title / category  | | title / category  |
| access / Open     | | access / Open     | | access / Open     |
| Copies            | | Copies            | | See parts         |
+-------------------+ +-------------------+ +-------------------+
```

On phones, production plates become a select and album cards form one or two readable columns. Numbers view can be denser, but retains titles and words for coverage. List uses ordinary rows without album decoration. All three share filters, selection, sorting and the same episode page. Documented gaps are accessible through the small notes link, without empty album spaces demanding to be filled.

Use large block numerals, plain Hebrew-capable titles and heavy production labels. Cards use `--surface`, paper corners use `--surface-3`, and plaques use `--chip` with `--chip-ink`. The street plates use `--brand` with `--mast-ink`; preserve `--focus` for keyboard focus. A card edge rises two pixels on activation. Switching views is immediate and does not scatter or shuffle cards. Dark mode uses the existing dark token values, including subdued paper surfaces.

## Summary

Build Stoop and shelves first. Keep the episode structure, copy drawers and plain destination buttons common to every view. Try the TV cabinet only as an optional choosing panel. The most useful playful details are the character stoop, numbered plaques and a filter-respecting surprise button; they make existing actions enjoyable without adding a second interface to learn.
