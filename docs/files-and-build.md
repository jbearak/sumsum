# Files, build and checks

Read this before changing data files, scripts or the build. The rules, and the two commands to run after a change, are in [AGENTS.md](../AGENTS.md#files-and-build).

## Files

| File | Role |
| --- | --- |
| `library.template.html` | Editable UI source |
| `data/series.json` | Series registry: the guide rail's families, every series with its English and Hebrew labels and YouTube search terms, and the goal rows (the series whose core productions count as core Rechov Sumsum) |
| `data/vocabulary.json` | Editorial English and Hebrew names for theme and character tags, keyed by the lowercase tag |
| `data/episode-guide.json` | Episode guide: productions, totals with their evidence, episodes, upload roles, coverage and evidence levels, and the queues of uploads awaiting identification |
| `data/nli-ietv-catalogue.json` | National Library of Israel IETV catalogue extract: original-series programmes 1-198 and co-production programmes 1-70, with titles, summaries, runtimes and record ids |
| `data/hop-records.json` | Official Hop page metadata, one record per Hop page |
| `data/hop-youtube-records.json` | Official Hop/Rechov YouTube uploads from the first inventory |
| `data/sesame-records.json` | First inventory of classic Rechov Sumsum and both Shalom Sesame series |
| `data/youtube-records.json` | YouTube uploads added by the October 2026 sweep, official and community |
| `data/archive-org-records.json` | Internet Archive files and items |
| `data/other-host-records.json` | Vimeo, Dailymotion, Facebook, Kan and other pages, and licensed storefront listings |
| `data/licensed-services.json` | How each licensed service is reached (hoopla with a library card; Apple TV and Prime Video to buy or rent): steps in English and Hebrew, participating and non-participating libraries, the library lookup, and every fact's source and check date |
| `data/hop-url-manifest.json` | Hop source-page collection inventory |
| `data/hop-player-links.json` | Exact Vimeo URLs discovered from Hop pages, and playback evidence |
| `data/vimeo-metadata.json` | Cached public Vimeo oEmbed results |
| `data/*-episode-audit.json` | Episode identity mappings, crosswalks, source confidence, and open and resolved tasks |
| `scripts/build-library.py` | Builds `index.html` from the template, the records and the guide, and validates the guide against the records |
| `scripts/check-library.cjs` | Application checks on a built library |
| `scripts/dom-double.cjs` | DOM double used by the checks |
| `scripts/collect-hop-links.js` | Hop player-link collector, run in a Zen Home tab ([zen-and-hop.md](zen-and-hop.md#hop-link-collector)) |
| `scripts/enrich-vimeo.py` | Public Vimeo metadata enrichment |
| `research/` | Cited findings, classification decisions, setup observations and the October 2026 acquisition sweep |
| `docs/` | Agent procedures and reference moved out of AGENTS.md |
| `index.html` | Generated library to open in Zen Home |

`.sweep/` is gitignored scratch space for workflow agents.

## Building

`python3 scripts/build-library.py [record-file.json ...] [--guide PATH] [--services PATH] [--series PATH] [--vocabulary PATH] [--output PATH]`

- It reads the series registry, `data/series.json` (`--series PATH` for another file), and embeds it for the app. It refuses a record or production whose series is not listed, and a missing or malformed registry: a key repeated within one object, a duplicate, non-slug or all-digit id, a series whose family is not listed, a label without English or Hebrew text, an empty search prefix, a search language other than `he` or `en`, or goal rows that repeat a series or span two families.
- It embeds the tag vocabulary, `data/vocabulary.json` (`--vocabulary PATH` for another file). It refuses a missing file, a repeated key, a key that is not lowercase, has outer spaces or is a reserved name, and a name pair that is not `[English, Hebrew]` text with Hebrew letters in the second. The checks require a name pair for every tag a record uses.

- With no inputs it embeds every `data/*-records.json` file and merges records by URL. It integrates the exact links and explicit playback evidence from `data/hop-player-links.json`.
- It embeds `data/episode-guide.json` by default. `--guide PATH` uses another guide, and an explicit path that does not exist is an error. Without the default guide it builds a plain uploads library.
- It embeds `data/licensed-services.json` (`--services PATH` for another file). It refuses a malformed entry: an unknown model, a host claimed twice, missing English or Hebrew text, a step or library without a source, a source without a check date or with one after the build date, a published source (any kind except a user observation) without its page, or a library-card service without steps, libraries and lookup URL. It also refuses structured facts that disagree with the prose the UI shows: a library no step lists, a step whose `participates` disagrees with its libraries or that does not name them in both languages, or a `lookupUrl` that is no step's link. It warns when a licensed record matches no service.
- It stops on a guide that breaks the rules in [episode-guide.md](episode-guide.md) or lacks a field `validate_guide()` requires. Examples: an unknown production, record id or upload role; a record listed twice in one episode's uploads, in two `unidentified` queues, or queued while linked (a `possible` copy may stay queued); stated coverage that disagrees with the upload roles; a `complete-playback-reviewed` or `reference-compared` level without `evidenceDetail`.
- It warns about softer problems, such as an upload linked to, or queued under, a production of another series, a record whose `guideEpisodeId` is not an episode that lists it, a record linked to several episodes, or numbers outside a season's range. Some warnings are expected; [TODO.md](../TODO.md#hop-vimeo-links) explains the ten Vimeo videos linked by two Hop records.

## Checking

`node scripts/check-library.cjs [path]` checks a built library, `index.html` by default.

- It runs the application in the DOM double from `scripts/dom-double.cjs`, in English and Hebrew, and visits every view and every production, episode, slot and record route. The double runs the two inline scripts first, `#prefs-boot` (theme) and `#lang-boot` (the language toggle's state before the first paint), then the application.
- It also boots copies of the same file with the guide removed, with shared storage, and with fixed edge-case and contract fixtures added to its data (labelled numbers, `firstNumber` seasons, licensed listings, possible copies, numbered parts, alternate labels, availability checks, editorial Hebrew titles that start with a Latin word or hold a number range, one episode at each evidence level), so every build exercises them.
- It checks the theme tokens and contrast of every palette, light and dark, and drives the theme picker and the `#prefs-boot` script ([library-ui.md](library-ui.md#themes-and-appearance)).
- It boots a copy with a sixth series, in a family of its own, with a core production that sorts first. The registry alone must give it a Browse chip, a rail heading and its own YouTube search terms, and it must stay out of core Rechov Sumsum. It also checks that every registered series has a `--ser-ID` colour in both scheme rules and a `.ser-ID` class, and checks their contrast.
- It runs builder checks on fixture inputs when `python3` is available.
- Browser layout and visual review are separate.

## Adding a series

A series is what a record is filed under and what a production belongs to. A family groups series on the guide rail. The goal series are the ones whose core productions count as core Rechov Sumsum: the guide's coverage panel, Up next's preferred episodes and the builder's printed summary.

1. Add the series to `data/series.json`, with a new family if it belongs to none. List order is Browse's chip and sort order; family order is the rail's. A new series is not a goal series unless it is core Rechov Sumsum.
2. Add `--ser-ID` colours to the light and dark scheme rules at the top of `library.template.html`, and a `.ser-ID{--series-ink:var(--ser-ID)}` rule beside the others. The checker refuses a missing one and checks their contrast.
3. Add its records to a `data/*-records.json` file, and its productions to the guide, as [episode-guide.md](episode-guide.md) describes.
4. Add new character and theme names to `data/vocabulary.json`. The checker requires an English and Hebrew name for every tag. A name shared with a dub (Bert is בנץ in Rechov Sumsum) has one entry for every series: decide how it reads before reusing it.
5. `searchLanguage` chooses the language of an episode's title words in its YouTube searches. A number-only search still uses the production's number label or the Hebrew season and episode words; check those for a non-Hebrew series. Browse search is bilingual whatever the series.
6. Update the copy that names the programs (the page title, `appName`, the Home and guide ledes, AGENTS.md's project purpose), TODO.md, the research notes and an episode audit.
7. Rebuild and run the checks.

## Vimeo metadata

`python3 scripts/enrich-vimeo.py` reads public Vimeo oEmbed metadata for the exact URLs in `data/hop-player-links.json`. It makes network requests and updates `data/vimeo-metadata.json` and the records in `data/hop-records.json`. It reuses successful cached results unless given `--refresh`, and it never changes playback or access fields. Rebuild afterwards and inspect the changes.
