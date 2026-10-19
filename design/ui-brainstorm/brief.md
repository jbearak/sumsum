# Mockup brief: a better interface for the Sumsum library

Six agents (three Claude Opus, three GPT-6.1-Sol) each build one mockup from this brief, so the user can choose a direction. The ideas behind it are in [opus.md](opus.md) and [sol.md](sol.md) in this folder. Read both before you start. Then read `AGENTS.md`, `docs/library-ui.md` and `docs/episode-guide.md`, and the Terracotta token rules at the top of `library.template.html`.

## What both brainstorms found

- **Watching and research share every screen.** At desktop width the guide opens on the core-broadcast coverage panel (189 whole, 69 missing, contested totals). "Up next" is about 670 px down and the first production about 1,040 px down, on a page about 12,200 px tall. Missing episodes, Videos to identify and Research to-do are hidden behind Browse's arrow menu and the footer.
- **Browse's filters are long and flat.** The order is series, program type, in the guide, where it plays, then about 70 theme chips and 36 character chips. Some themes overlap: Music and Songs; Health and "Health and movement". There is no filter for time available or for the language spoken, although records carry `language` (he 1,593, en 408, ar 46).
- **There are two search boxes.** "Search episodes" in the guide and "Search uploads" in Browse search different sets, and neither is in the masthead.
- **Pictures are underused.** 2,246 of 2,272 records have thumbnails, but the guide reads mainly as text and numbers. On phones, Album drops to three tiny columns with 12 px titles and loses the coverage word.
- **The episode page buries the decision.** The evidence ladder comes before My progress and the identity card. Alternate copies sit further down. Multipart episodes leave the user juggling tabs.
- **Cards order their information differently in each view.** Browse cards stack series, subseries, title, published title, uploader, source, kind, guide role, access and actions.

## Ideas to draw from (pick what serves your direction)

Separate Watch and Research entrances · a family home of thumbnail shelves, each a saved Browse query · one masthead search across episodes and videos, results grouped with separate counts · grouped, progressive filters with a summary sentence and zero-result relaxations · filters for time ("under 5 / 10 minutes") and spoken language · character portraits as filter buttons · production chooser cards · guide seasons as thumbnail rows · Album/Numbers/List layouts that say what each is for · one card reading order (picture and duration, title, production and format, access requirement, primary action; provenance second) · a destination-first Watch button ("Open on Vimeo", "Watch on hoopla · library card") with "Other copies" beside it · an ordered parts checklist · an episode page split into a decision area and a dossier · a parent-curated family shelf or kid mode · a "Tonight" queue · a "how do you watch" preference (no VPN, Israel VPN, hoopla card, buy or rent) · a research workbench (missing, to identify, playback checks) · an identity comparison view · a deliberate bilingual title hierarchy · a phone layout with readable two-column cards and a bottom tab bar · a street-sign visual identity.

## Rules every mockup keeps

- Filtering by series, program type, theme and character, with dynamic counts. Longest-first duration sort. Full episodes and complete installments of short series stay separate categories.
- English is the default, with a working English/עברית toggle that switches the page to Hebrew and RTL. Terracotta is the default palette and System the default appearance, and a light/dark switch must work. Use the Terracotta tokens from `library.template.html`, copied as CSS custom properties. The coverage colours (`--whole`, `--parts`, `--excerpt`, `--missing`) and the licensed teal (`--acc-lic`) mean only those things; never use them for buttons or decoration.
- Evidence is stated in words, never as a graphic: "Details checked, not test-played", "Seen to play", "Checked in full", "Compared with a reference". Never say "watched" about evidence. A user's Watched mark is personal and separate.
- A `possible` copy never counts towards coverage or the Watch button. Licensed listings (hoopla, Apple TV, Prime Video) are not free uploads. Hop pages need an Israeli connection; their direct Vimeo links do not.
- `titleHe` and `storyHe` are verbatim. English titles, `titleHeEditorial` and tags are editorial and labelled that way where it matters.
- Videos play on the original host, in a new tab. Nothing is embedded or downloaded.

## Use real data

Take the sample content from `data/episode-guide.json` and `data/*-records.json`: real productions, episode numbers, titles in both languages, durations, hosts, roles, coverage, evidence and `thumbnailUrl` values. Remote thumbnail URLs may load from their hosts. Where a thumbnail is missing or fails to load, use a neutral numbered placeholder, never a fake programme still. Include at least: a whole-candidate episode with metadata-only evidence; a multipart episode; a hoopla listing; an unresolved possible copy; a Shalom Sesame English item; an Elmo talk-show item; and a short song clip.

## Deliverable

One self-contained HTML file, `design/mockups/<n>-<slug>.html`, under 400 KB, with inline CSS and JS and no build step or framework CDN. Remote thumbnails are the only external requests. It must show at least three screens, switchable within the mockup: the landing screen, Browse with some filters applied, and an episode page. A fourth screen (research or phone) is welcome. The English/Hebrew toggle and the light/dark switch must work on every screen. Design for 1280 px desktop first, and make the mockup hold together at 390 px.

Put a short note at the top of the page, which can be collapsed, naming the direction and its three main ideas. Do not edit any file outside `design/mockups/`, and do not commit. When you finish, reply with the file path and a one-paragraph pitch.

## The six directions

1. **Living Room** (Opus), `1-living-room`. Family first. A watch-first home of thumbnail shelves: Up next, Under 10 minutes, Songs, a character shelf, In English, Your stars. One masthead search. Character portraits as filters. The episode page leads with the picture and one destination-first Watch button. Research is a quiet link for grown-ups. Low density, big 16:9 cards.
2. **Two Doors** (Sol), `2-two-doors`. The least change. Keep today's Terracotta look and views, but add a Watch door and a Research door, one masthead search, a progressive filter panel with a summary sentence, time and language filters, one consistent card order, and a reordered episode page. The aim is to fix daily friction without a new mental model.
3. **Rechov, the street** (Opus), `3-rechov`. The street is the interface. Each production is a bilingual street sign or shopfront plate, with English and Hebrew as equals. Seasons appear as film strips, characters sit on a stoop row, and episode numbers are house-number plaques. A strong visual identity, built only from Terracotta tokens.
4. **Annotated programme guide** (Sol), `4-programme-guide`. The episode identity is the organising object. Uploads hang from it visibly as whole copies, alternate editions, parts and excerpts. A production rail sits beside a wide reading column. Album, Numbers and List each say what they are for. The episode page is split into a decision area and a dossier, and the bilingual title hierarchy is deliberate. Medium density.
5. **Archive desk** (Opus), `5-archive-desk`. Research first, with a clean reading room for viewers. The landing page is a coverage dashboard of production rows with their units stated. It has a research workbench (missing, to identify, playback checks), an identity comparison view, dense keyboard-friendly tables with tabular figures, and a simple, separate "Find something to watch" path.
6. **Pocket, phone first** (Sol), `6-pocket`. Designed at 390 px first and scaled up. A bottom tab bar (Watch, Guide, Browse, Starred), readable two-column cards, a sticky "Filters · N active" control that opens a full-height sheet, a Tonight queue, a "How do you watch?" preference that changes which buttons appear, and an ordered parts checklist. On desktop it becomes a centred, comfortable layout.
