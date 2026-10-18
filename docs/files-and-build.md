# Files, build and checks

Read this before changing data files, scripts or the build. The rules, and the two commands to run after a change, are in [AGENTS.md](../AGENTS.md#files-and-build).

## Files

| File | Role |
| --- | --- |
| `library.template.html` | Editable UI source |
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

`python3 scripts/build-library.py [record-file.json ...] [--guide PATH] [--services PATH] [--output PATH]`

- With no inputs it embeds every `data/*-records.json` file and merges records by URL. It integrates the exact links and explicit playback evidence from `data/hop-player-links.json`.
- It embeds `data/episode-guide.json` by default. `--guide PATH` uses another guide, and an explicit path that does not exist is an error. Without the default guide it builds a plain uploads library.
- It embeds `data/licensed-services.json` (`--services PATH` for another file). It refuses a malformed entry: an unknown model, a host claimed twice, missing English or Hebrew text, a step or library without a source, a source without a date or page, or a library-card service without its libraries and lookup URL. It warns when a licensed record matches no service.
- It stops on a guide that breaks the contract in [episode-guide.md](episode-guide.md). Examples: an unknown production, record id or upload role; a record linked twice, or queued while linked (a `possible` copy may stay queued); stated coverage that disagrees with the upload roles; a `complete-playback-reviewed` or `reference-compared` level without `evidenceDetail`.
- It warns about softer problems, such as a record whose `guideEpisodeId` is not an episode that lists it, a record linked to several episodes, or numbers outside a season's range. Some warnings are expected; [TODO.md](../TODO.md#hop-vimeo-links) explains the ten Vimeo videos linked by two Hop records.

## Checking

`node scripts/check-library.cjs [path]` checks a built library, `index.html` by default.

- It runs the application in the DOM double from `scripts/dom-double.cjs`, in English and Hebrew, and visits every view and every production, episode, slot and record route.
- It also boots copies of the same file with the guide removed, with shared storage, and with fixed edge-case and contract fixtures added to its data (labelled numbers, `firstNumber` seasons, licensed listings, possible copies, numbered parts, alternate labels, availability checks), so every build exercises them.
- It runs builder checks on fixture inputs when `python3` is available.
- Browser layout and visual review are separate.

## Vimeo metadata

`python3 scripts/enrich-vimeo.py` reads public Vimeo oEmbed metadata for the exact URLs in `data/hop-player-links.json`. It makes network requests and updates `data/vimeo-metadata.json` and the records in `data/hop-records.json`. It reuses successful cached results unless given `--refresh`, and it never changes playback or access fields. Rebuild afterwards and inspect the changes.
