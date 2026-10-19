# UI brainstorm: Rechov Sumsum video-link library

Author: Claude (Opus), 2026-10-18. Brainstorm only; nothing here is decided or built.

## What I looked at

- `AGENTS.md`, `README.md`, `docs/library-ui.md`, `docs/episode-guide.md`, the English strings and markup in `library.template.html`, and the shape of `data/episode-guide.json` and `data/*-records.json`.
- The live site at https://jbearak.github.io/sumsum/ (guide, Browse and an episode page), read through the DOM because the 7 MB page timed out the screenshot tool.

Observations the ideas below rely on:

1. **The guide opens on research, not on something to watch.** At 1280 px wide the first screen is the "Rechov Sumsum core broadcasts" goal panel (189 whole / 69 missing / "At least 268 episodes are known to exist" / "Totals are unknown or contested…"). "Up next" sits about 670 px down, the four-part legend under it, and the first production starts about 1,040 px down. The page is about 12,200 px tall, with 14 productions stacked.
2. **Two audiences share every screen.** The parent wants "something Elmo, about 10 minutes, that plays". The maintainer wants gaps, queues and evidence levels. Today both get the same page: Browse cards carry host, published title, uploader, source type, program type, guide role, access line and Watch button; the episode page puts the four-step evidence ladder above "My progress" and the identity card.
3. **Browse's facet column is very long.** Series (5), Program type (5), In the guide (4), Where it plays (7), then about 70 theme chips and 36 character chips, all shown flat. Some themes overlap: "Health" and "Health and movement", "Music" (335) and "Songs" (124), "Holidays" (3) beside each named holiday.
4. **Two separate search boxes.** "Search episodes" (in the guide) and "Search uploads" (in Browse) look things up in different sets, and neither is in the masthead.
5. **Language is not a filter.** Records carry `language` (`he` 1,593, `en` 408, `ar` 46, mixed values for the rest), but a parent cannot ask for "English only" or "Hebrew only" except by picking a series.
6. **Thumbnails exist for nearly everything** (2,246 of 2,272 records have `thumbnailUrl`), but the guide's identity is still mostly text and numbers.
7. **Good material is buried.** The NLI catalogue summary (for example "משחק כדורסל מתקיים היום ברחוב סומסום, ומי מארגן אותו אם לא קיפי…") appears only inside the episode page's "Research note" paragraph.
8. **The watch flow ends at "opens in a new tab".** There is "Up next" with "Another one", stars and watched marks, but no queue, no notion of a sitting, and nothing that strings short clips into a session.

## Constraints every idea must respect

Collected once here; each idea names the ones that bite hardest.

- **C1. Self-contained file.** `index.html` is generated from `library.template.html` and `data/`, opened as `file://` in Zen, with no server. Edits go in the template or data, then `build-library.py` and `check-library.cjs`.
- **C2. Local storage stays put.** Stars, pasted Vimeo links and watched marks live in local storage for that file location. New user data must join the backup; UI preferences (`sumsum-*`) stay out of it.
- **C3. Preserved features.** Filtering by series, program type, theme and character with dynamic counts; longest-first duration sort; English default with Hebrew RTL toggle; Terracotta default palette; System default appearance; full episodes and complete short-series installments as separate categories.
- **C4. Evidence in words, never a graphic.** Levels are "Details checked, not test-played", "Seen to play", "Checked in full", "Compared with a reference". Never say "watched" for evidence; watched marks are not evidence.
- **C5. Possible copies never count** toward coverage, totals or the Watch button. Licensed listings are not free uploads and not playback evidence.
- **C6. Titles.** `titleHe` and `storyHe` verbatim; `titleHeEditorial`, English titles and tags are editorial and labelled as such.
- **C7. Access truth.** Hop pages need an Israeli connection; direct Vimeo links do not. Failed checks never show as public links.
- **C8. Colour tokens.** Every colour is a token; status colours (whole, parts, excerpt, missing) and the licensed teal are shared and kept clear of buttons, links and focus; WCAG contrast is checked per palette and scheme.
- **C9. Links and metadata only.** No video media stored.

---

## Ideas

### 1. Split the front door: "Watch" and "Research"

- **Problem.** Observation 1 and 2: a parent lands on coverage arithmetic and contested totals; the first playable thing is below the fold.
- **Proposal.** Make the top-level nav two clear modes. **Watch** (default route `#/`) holds a home shelf, Browse, Starred and the guide's episode tiles. **Research** (`#/research`) holds the goal panel, Coverage by production, Missing episodes, Videos to identify, Research to-do and the evidence legend. Each mode keeps its own nav. The current `#/guide`, `#/browse/*` and `#/todo` routes keep working and land in the right mode.
- **Constraints.** C3 (all filters and sorts survive in Watch), C4 (evidence still on every episode page), old routes keep resolving (docs/library-ui.md lists them).

### 2. Home shelf for the family

- **Problem.** "Up next" is the only watch-first element on the guide, it has one item, and it sits under the stats.
- **Proposal.** A home made of horizontal shelves, each a row of thumbnail cards: "Up next" (the existing rule: next unwatched core episode with a whole link that plays without a VPN), "Short ones, under 10 minutes", "Songs", "Starring Elmo / Kippi / Moishe Oofnik" (rotating character shelf from tags), "In English (Shalom Sesame)", "Holiday now" (see idea 9), "Your stars". Each shelf links to Browse with the matching filters applied, so the shelf is just a saved query.
- **Constraints.** C3 (shelves reuse filters, do not replace them), C5 (only records that pass the Watch-button rules appear), C6 (shelf names that use tags say "editorial" in the shelf's help), C7 (default shelves exclude VPN-only and unavailable links; a VPN shelf can be opt-in).

### 3. A single search in the masthead

- **Problem.** Observation 4: two search boxes in two views, neither always visible.
- **Proposal.** One search field in the masthead (an icon that expands on phones) with grouped results: Episodes, Videos, Characters and themes (jumps to Browse with that chip on), Productions. Pasting a video URL keeps today's "This video is already in the library" behaviour. Hebrew or English input both work; results show the title in the interface language with the other language beneath.
- **Constraints.** C3, C6 (show `titleHe` verbatim; mark editorial titles), RTL: the field and result groups mirror under `dir=rtl`, and mixed-script titles keep `bdi`/`dir=auto` handling.

### 4. Progressive filter panel with grouped themes

- **Problem.** Observation 3: about 110 chips in one column, overlapping theme names.
- **Proposal.** Show the four structural facets open (Series, Program type, Where it plays, Language) and collapse Theme and Character behind a typeahead plus "top 12 by count" chips. Group themes for display only: Jewish holidays (Hanukkah, Passover, Purim, Sukkot…), Learning (Letters, Numbers, Counting, Shapes, Hebrew…), Feelings and friendship, Nature and animals, Music and songs, Israel and places. The grouping is a display layer; the underlying tag keys and counts stay unchanged, and each chip still shows its dynamic count. Active filters appear as removable pills above results.
- **Constraints.** C3 (dynamic counts on every chip, including grouped ones), C6 (the facet header keeps "editorial"). Theme merges such as Music/Songs are a data decision, not a UI one, so the UI only groups.

### 5. Language as a first-class filter and badge

- **Problem.** Observation 5: `language` exists on records but is not filterable; a parent of an English-speaking child cannot ask for English material across series.
- **Proposal.** Add a "Language spoken" facet (Hebrew, English, Arabic, Mixed, Unknown) with counts, and a small text badge on cards ("עב", "EN", "عر"). This is the language of the video, separate from the interface language toggle; label it clearly so nobody confuses the two.
- **Constraints.** C3 (dynamic counts), C1 (derived at build or run time from existing fields), the 185 records with no `language` show as "Not recorded", never guessed.

### 6. Kid mode ("Couch mode")

- **Problem.** Observation 2: cards are dense with uploader names, access lines and research notes a child cannot read and a tired parent does not need.
- **Proposal.** A toggle in the masthead that switches to big thumbnails, one title line, a duration and one large Watch button; hides uploader, published title, evidence badges, research notes and the Research nav. It defaults to shelves that play without a VPN and are not licensed. A small "Grown-up" button returns to normal (no PIN; it is a convenience, not a lock). Stored as a UI preference like `sumsum-language`.
- **Constraints.** C2 (preference stays out of the backup), C4 (evidence is hidden, never restated as "verified"; the episode page still shows it when a grown-up opens one), C5/C7 (never surface possible copies, licensed listings, VPN or unavailable links as one-tap watch).

### 7. Watch queue ("Tonight")

- **Problem.** Observation 8: no way to line up three clips and an episode for a sitting.
- **Proposal.** "Add to Tonight" on any card; a slim queue drawer shows total running time and a "Play next" button that opens the next item's best link in a new tab and offers to mark the previous one watched. Optional preset: "Build a 20-minute set" fills from current filters, longest-first so one episode plus clips fits.
- **Constraints.** C2 (the queue is user data; add it to Export/Import backup), C4 (marking watched is the user's progress, not evidence), C3 (uses the existing longest-first sort), C9 (still opens on the original host).

### 8. Episode page reordered for viewers, with a quiet research drawer

- **Problem.** On the episode page the four-step evidence ladder, "Next step" research instruction and identity card dominate; "My progress" sits between them; the NLI synopsis is inside a research note (observation 7).
- **Proposal.** Order: hero (thumbnail, title in the interface language, the other-language title, duration, one Watch button with its access line), then "What happens" (a verbatim source synopsis where one exists, with its source named, otherwise nothing), then other copies (parts, alternate editions), then a collapsible "Research details" holding the evidence ladder, identity, catalogue title, alternate labels and sources. Previous/Next stay at the top. Watched and star sit on the hero.
- **Constraints.** C4 (the ladder and its words stay, only collapsed; the coverage and evidence tags stay visible in the hero in words), C6 (synopsis quoted verbatim from a named source, never summarised or translated; an English rendering, if ever added, is labelled editorial and is a data change), C5.

### 9. Calendar-aware holiday shelf

- **Problem.** Holiday themes (Hanukkah 57, Passover 36, Purim 31…) are a natural reason a family looks for these shows, but they are buried in the theme list.
- **Proposal.** Compute the next Jewish holiday from a small table in the template (dates for the next few years) and show "Hanukkah is coming" with matching clips from three weeks before. No network calls.
- **Constraints.** C1 (static table in the template; no API), C6 (theme tags are editorial; the shelf help says so), C3.

### 10. Character portraits as navigation

- **Problem.** The 36 characters are plain text chips; a child who cannot read cannot choose Kippi.
- **Proposal.** A row of round character "buttons" using a representative video thumbnail per character (chosen by a data field, never a stored image file), with the name beneath in both languages. Tap filters Browse by that character.
- **Constraints.** C9 (thumbnails are remote host URLs, as today; no image files committed), C6 (character tags editorial), C1 (offline use: show initials on a tinted disc when the thumbnail fails, as `imgEl` already must handle).

### 11. Album guide with season "film strips"

- **Problem.** Productions stack 14 tall sections; the 198-episode original series is three long seasons. The Numbers strip is good for the maintainer but abstract for viewers.
- **Proposal.** In the Watch mode guide, show each production as a header card (years, language, episode count, a strip of a few thumbnails) and expand to season rows that scroll horizontally like a film strip. Keep Album/Numbers/List as layouts; Numbers moves to Research mode as the default there.
- **Constraints.** C3 (full episodes and short-series installments labelled apart: "Episode" vs "Installment" nouns already exist), `sumsum-guide-layout` keeps working, C5 (missing and possible-only episodes appear as quiet placeholders, not as watchable tiles).

### 12. Coverage dashboard for the maintainer

- **Problem.** The goal panel mixes core and separate counts, and the explanation of contested totals is prose under the meter. "Coverage by production (table)" is a disclosure.
- **Proposal.** In Research mode, a dashboard: one row per production with a stacked bar (whole / parts / excerpts / missing / expected-not-identified), the expected total with its confidence word ("Primary source", "Contested: 29 or 4"), queue size and a link to its to-do. Core Rechov Sumsum first, "Counted separately" below a rule. A second panel lists evidence level counts in words. A third: "Recently changed" from `generatedAt` diffs if the builder can emit them.
- **Constraints.** Productions never summed across formats (AGENTS.md evidence rules), C4 (evidence counts in words, no evidence graphic; the coverage bar is coverage, which already has a graphic), C8 (bar colours are the shared status tokens), contested totals shown as contested, never as a percentage.

### 13. Identification workbench

- **Problem.** Videos to identify and "Possible matches" exist, but matching means hopping between record pages, guide strips and external tabs.
- **Proposal.** A two-pane view: left, the queue for one production (thumbnail, duration, published title, uploader); right, the candidate episodes ("fills a numbering gap", "shared words", runtime from NLI) with the nearest numbers. Buttons copy a ready-to-paste JSON snippet (`{recordId, role}`) for `data/episode-guide.json`, since the file cannot write data. Keyboard: J/K through the queue.
- **Constraints.** C1 (no writes; clipboard only), C5 (suggestions stay suggestions; the snippet defaults to `possible` unless the maintainer picks a role), C6 (published titles verbatim).

### 14. Playback-check mode

- **Problem.** Almost every linked episode is at "Details checked, not test-played"; the to-do page lists whole links to check, but recording a check is manual.
- **Proposal.** A check queue that opens one exact URL at a time and offers three buttons: "Started", "Failed: country restriction", "Failed: unavailable", plus date. It records into an exportable "check report" (like the existing collector report import) that the maintainer merges into data by id.
- **Constraints.** C4 (only "Seen to play" can come from this; nothing implies complete playback), C7 (failures recorded with the statuses in docs/episode-guide.md so they never show as public), C2 (the report is exported, not silently stored), Hop links checked only through Zen and the Tel Aviv VPN, per AGENTS.md.

### 15. Access clarity as a "where can I watch" picker

- **Problem.** Access lines are accurate but long ("Vimeo · direct link, playback not tested"; "Hop page · needs Israel VPN"; "Free with a library card (hoopla)"). A visitor has to read each card to learn what will work for them.
- **Proposal.** A one-time "How do you watch?" setting with checkboxes: "No VPN", "I have an Israel VPN", "I have a hoopla library card", "I buy or rent on Apple TV / Prime Video". It sets the default Where-it-plays filter and orders each episode's Watch links accordingly. It is a preference, editable from the masthead.
- **Constraints.** C7 (never hides that a Hop link needs a VPN; licensed listings still say licensed and name the service's terms), C5, C2 (preference, not backup data), the hoopla how-to box keeps its sources and dates.

### 16. Bilingual titles done once, consistently

- **Problem.** Titles appear as English editorial, then Hebrew below, sometimes with an uploader's published title too (Browse card: "Karambula / Rehov Sumsum- קרמבולה"). Which is which is learned, not shown.
- **Proposal.** A fixed title block everywhere: primary title in the interface language, secondary in the other language, and a tiny tag ("editorial", "our translation", "catalogue", "as published") only where the title is not the source's. In Hebrew mode the block mirrors; numbers and Latin codes stay LTR in `bdi`. Typography: a Hebrew face with matching x-height to the Latin face so mixed lines sit level.
- **Constraints.** C6 (verbatim fields untouched; `titleHeEditorial` labelled as ours), RTL rules already in the template (`dirAuto`, `bdi`), C1 (system fonts or an embedded subset; no CDN dependency if the file must work offline).

### 17. Phone layout: bottom tab bar and filter sheet

- **Problem.** The masthead carries the tabs, the Browse split menu, the palette button and the language toggle; on phones the filters column precedes results.
- **Proposal.** On narrow screens, a bottom tab bar (Home, Guide, Search, Starred, Research), the palette and language moved into a "More" sheet, and filters in a bottom sheet with a sticky "Show 214 videos" button that carries the live count.
- **Constraints.** C3 (dynamic counts in the sheet button), docs/library-ui.md (the theme button keeps the same size and place in English and Hebrew; this moves it, so that rule would need the user's agreement, or keep the button in the masthead and move only the tabs), coarse-pointer sizes already in the CSS (44 px buttons).

### 18. Visual identity: street signage

- **Problem.** The masthead is a clay bar with tabs; the site has no image of its subject, and every production looks alike apart from series ink colours.
- **Proposal.** Borrow Israeli street-sign language without the off-palette blue and white: production headers as Terracotta clay plates with cream lettering, bilingual on one plate (English and Hebrew, as on real signs), and the series ink as a narrow edge band. Episode numbers set as house-number plaques. The accent stripe under the masthead becomes a tiled kerb.
- **Constraints.** C8 (all colours from tokens; plates use `--brand`, `--surface`, series inks; no status colour used decoratively), all six palettes must render the plates, contrast checks pass.

---

## Directions

### A. "The Living Room" (family-first, research tucked away)

Bundles 1, 2, 5, 6, 7, 8, 9, 10, 15. The default route is a home of shelves; the guide and Browse are reached through characters, shelves and one search. Research is a separate mode a grown-up opens. The episode page leads with the picture, a verbatim synopsis where one exists, and one Watch button, with research details folded below. Kid mode and the Tonight queue make it usable from the couch.

*Visual language.* Big 16:9 thumbnails with 12 px radius on `--surface`, generous spacing (24-32 px gaps), one card per 240-280 px column. Type: a rounded system sans at 17 px body, 28-34 px shelf titles, Hebrew at the same visual size. Terracotta clay only in the masthead and Watch buttons' hover ring; buttons stay the palette's sea-teal `--primary`; honey `--accent` for the active shelf underline. Low density: two to three shelves per screen.

### B. "The Archive Desk" (research-first, viewer path kept clean)

Bundles 1, 3, 4, 11 (Numbers default), 12, 13, 14, 16. Treats the site as a catalogue with a public reading room. The landing page is the coverage dashboard; the guide, identification workbench and playback-check mode are the main tools; the viewer gets a clean Browse with the progressive filter panel. Strong on keyboard use and dense tables.

*Visual language.* Two-column layout: left rail of productions with mini stacked bars, right working pane. Type: system sans at 14 px, tabular figures for counts and durations, monospace for record ids and URLs. Colour mostly neutral `--surface`/`--surface-2` with status tokens doing the work in bars and pills; clay appears only as the masthead and section rules. High density: 30-40 rows per screen in List layout.

### C. "Rechov" (the street as the interface)

Bundles 2, 3, 10, 11, 16, 18, 17. The library is a street: each production is a building or shopfront plate along it (Classic IETV, the 1998 co-production, the Hop! seasons, Elmo's talk show, Shalom Sesame across the road). Opening one shows its seasons as film strips. Characters sit on a "stoop" row for children to tap. Bilingual signage makes English and Hebrew equals on every plate, which also makes the RTL switch feel native rather than mirrored.

*Visual language.* Plates with 6 px radius and an inset border in `--line-strong`, bilingual lettering (Latin above, Hebrew below, both 600 weight), series ink as a 4 px edge band, house-number plaques for episode numbers. Terracotta carries the identity: `--brand` for plates' grounds in the masthead and production headers, `--accent` honey for the kerb stripe, cream `--surface` for content. Medium density: one production plate and one film strip per screen band.

### D. "Two Doors" (minimal change, maximum separation)

Bundles 1, 3, 4, 5, 8, 15, 17. Keeps the current views and code mostly as they are, and draws the line between the two audiences: a Watch door and a Research door, one masthead search, the progressive filter panel with language, a reordered episode page, a "how do you watch" preference and the phone bottom bar. This is the lowest-risk path and a reasonable first step towards A or C.

*Visual language.* Today's Terracotta unchanged: clay masthead, honey stripe, sandstone pages, sea-teal buttons. Changes are structural: wider gutters around results, a sticky filter summary bar, card text cut to title, duration and access line. Density stays medium; the Research door may use the denser List layout by default.

## Open questions for the user

- Should the default route change from `#/guide` to a watch-first home, or should the guide stay first?
- Is a kid mode wanted, and should it exclude licensed and VPN links by default?
- May the theme button move on phones (docs/library-ui.md fixes its size and place)?
- Should the Tonight queue join the backup file?
- May a verbatim source synopsis (NLI summary) appear on the episode page outside the research note, with its source named?
