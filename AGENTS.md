# Project purpose

Maintain a local, interactive video-link library for classic and modern Rechov Sumsum, classic and modern Shalom Sesame, and Elmo's Israeli talk show, תכנית האירוח של אלמו. Collect episode and clip links, source metadata, and evidence about completeness and availability. Store links and metadata rather than video media.

The library is `index.html`, a self-contained generated file. Its default UI is English, with a Hebrew toggle and RTL layout. Preserve filtering by series, program type, theme, and character, dynamic filter counts, and longest-first duration sorting. Full episodes and complete installments of short series are separate categories.

The views nav has three items: Episode guide, Browse and Starred. Browse (`#/browse`, formerly All uploads at `#/uploads`, which still lands there with its filters) lists every upload with the filters. The arrow beside it opens a menu of three pages:

- **Identified videos** (`#/browse/identified`): every upload that is not awaiting identification, with the same filters.
- **Videos to identify** (`#/browse/unidentified`): uploads in a production's `unidentified` queue and uploads linked only as `possible` copies, by production. `?prod=` shows one production.
- **Missing episodes** (`#/browse/missing`): documented episodes without a whole copy (missing, then parts or excerpts only), then expected places not identified yet.

Identified videos and Videos to identify together hold every upload; both are defined from the guide data, never from durations. The Research to-do page (`#/todo`, formerly To find) is linked from the footer and from those pages. It holds the whole links to check by playback and the JSON export.

Read [TODO.md](TODO.md) for episode totals, coverage gaps, and the acquisition checklist. The files in `research/` explain the evidence and its limits.

# Use Zen's Home workspace

- Use the existing **Zen browser**, in its **Home workspace**, for this project. Home is the user's personal workspace. The user explicitly corrected an earlier attempt that used Work.
- Home, Work, and Gmail are workspaces in one browser profile. Home is not a separate browser profile named Personal. Do not create a new profile to interpret this preference.
- Keep project and setup tabs in Home. Preserve unrelated tabs and workspaces.
- The Proton extension and its domain rules apply across this Zen profile. Selecting Home does not create a separate VPN configuration.
- When using browser or computer-control tools, select the existing Zen surface. A shell request, another browser, or the in-app browser does not inherit Zen's extension tunnel.

# Existing Proton VPN setup

The setup recorded on October 17, 2026 uses the official Proton VPN Firefox browser extension in Zen. It is installed, pinned, and signed into the user's existing account with VPN Plus. See [research/vpn-setup.md](research/vpn-setup.md) for the original configuration and playback observations.

| Setting | Intended value |
| --- | --- |
| Location | Israel, **Tel Aviv** |
| Split tunneling | Enabled, **Include mode** |
| Included websites | **Only `hop.co.il`, including all its subdomains** |
| Auto-connect | Enabled |

Vimeo, YouTube, and unrelated websites remain outside the include list. Other applications do not use this browser extension's tunnel. This selective routing is intentional. Preserve it when working on the collection; do not add broad website rules as a routine workaround. A system-wide VPN is acceptable for collecting Hop Vimeo links (see the Hop collector note below), not as a general workaround.

Select Tel Aviv by city, rather than depending on a fixed server number. The original setup used IL#734 and later IL#759, and the October 18 collection used IL#751; assigned servers can change. On October 18 the extension was found disconnected despite auto-connect. Check the extension's current connection when regional access is needed instead of assuming an earlier session is still connected.

Login information is stored in 1Password. Use the existing signed-in session when available. If reauthentication is needed, use 1Password through the supported account/browser flow. Never put passwords, session tokens, cookies, or proxy credentials in project files, logs, or generated HTML.

# Discover through Hop, play through the host

1. Switch Zen to Home and open the pinned Proton VPN extension.
2. Confirm connection to Israel, Tel Aviv, and the Hop-only Include rule above.
3. Open the official Hop collection or video page in a Home tab. Hop's region restriction can hide the player when this connection is absent.
4. Obtain the actual embedded Vimeo URL from the accessible Hop page. Preserve its complete privacy hash and any required parameters. A numeric video ID alone can be insufficient. Keep the Hop source URL alongside the direct URL.
5. Open the direct Vimeo watch URL in another Home tab, or use the library's Vimeo action. Vimeo stays outside the VPN rule, so there is no need to disconnect the Hop tunnel for this step.
6. Record playback evidence separately from metadata and episode completeness. If a link fails, check its exact URL, privacy hash, and current availability before changing VPN routing.

The Hop discovery pages are [Rechov Sumsum](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) and [Elmo's Israeli talk show](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/).

One exact Vimeo video, Word of the Day: A hug, had playback startup observed outside the VPN. That does not verify every Vimeo link or complete playback. Public oEmbed metadata confirms titles and durations, not playback or an uncut episode. Some official YouTube links returned country restrictions or generic availability errors; they are not established VPN-free alternatives.

# Files and update workflow

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
| `data/licensed-services.json` | How each licensed service is reached (hoopla with a library card; Apple TV and Prime Video to buy or rent): the how-to steps in English and Hebrew, participating and non-participating libraries, the library lookup, and every fact's source and check date |
| `data/hop-url-manifest.json` | Hop source-page collection inventory |
| `data/hop-player-links.json` | Exact Vimeo URLs discovered from Hop pages and playback evidence |
| `data/vimeo-metadata.json` | Cached public Vimeo oEmbed results |
| `data/*-episode-audit.json` | Episode identity mappings, crosswalks, source confidence, and open and resolved tasks |
| `scripts/build-library.py` | Builds `index.html` from the template, the records and the guide, and validates the guide against the records |
| `scripts/check-library.cjs` | Application checks on a built library |
| `scripts/dom-double.cjs` | DOM double used by the checks |
| `scripts/collect-hop-links.js` | Hop player-link collector for Zen Home |
| `scripts/enrich-vimeo.py` | Public Vimeo metadata enrichment |
| `research/` | Cited findings, classification decisions, setup observations and the October 2026 acquisition sweep |
| `index.html` | Generated library to open in Zen Home |

Edit the template or source JSON and rebuild. Do not make UI fixes only in generated `index.html`.

Run these commands from the project root after catalog, guide or UI changes:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

The builder embeds every `data/*-records.json` file, merges records by URL and integrates the exact links and explicit playback evidence from `data/hop-player-links.json`. It embeds `data/episode-guide.json` by default; `--guide PATH` uses another guide, and an explicit path that does not exist is an error. Without the default guide it builds a plain uploads library. It also embeds `data/licensed-services.json` (`--services PATH` for another file) and refuses a malformed entry: an unknown model, a host claimed twice, missing English or Hebrew text, a step or library without a source, a source without a date or page, or a library-card service without its libraries and lookup URL. It warns when a licensed record matches no service. It stops on a guide that breaks the contract, for example an unknown production, record id or upload role, a record linked twice or queued while linked (a `possible` copy may stay in its production's `unidentified` queue, because its identity is unresolved), stated coverage that disagrees with the upload roles, or a `complete-playback-reviewed` or `reference-compared` evidence level without `evidenceDetail`. It prints warnings for softer problems, such as a record whose `guideEpisodeId` is not an episode that lists it, a record linked to several episodes, or numbers outside a season's range. Fix the errors and read the warnings. Keep the generated `index.html` with its source changes.

`node scripts/check-library.cjs [path]` checks a built library, `index.html` by default. It runs the application in the DOM double from `scripts/dom-double.cjs` against that file, in English and Hebrew, and visits every view and every production, episode, slot and record route. It also boots copies of the same file with the guide removed, with shared storage, and with fixed edge-case and contract fixtures added to its data (labelled numbers, `firstNumber` seasons, licensed listings, possible copies, numbered parts, alternate labels, availability checks), so every build exercises them. It runs builder checks on fixture inputs when `python3` is available. Browser layout and visual review are separate.

## Editing the episode guide

- An episode is identified by its documented number or title: the IETV programme number for the original series and the 1998 co-production, the DVD number for 2012, Hop's listing number for the Elmo talk show, or the documented title. Hebrew titles are quoted as published. English titles are editorial.
- `titleHe` is the identifying source's title, verbatim; for the original series and the 1998 co-production it is the NLI IETV catalogue title. When that title has no story name (`רחוב סומסום <44>`), you may put a Hebrew story name quoted verbatim from another source in `storyHe`. Name that source in `storySourceEn` (required) and `storySourceHe`, for example `archive.org file label (uploader's wording)`. Never compose, shorten or translate a story name into `storyHe`. The Hebrew interface heads the episode with `storyHe`. The English interface uses the editorial `titleEn`, or `titleHe` without one. The episode page's identity card keeps `titleHe` as the "Catalogue title" and shows the story name with its source. The builder refuses an empty or non-string value, a `storyHe` without `storySourceEn`, and a source without `storyHe`. It warns when `titleHe` is missing or already contains the story name.
- Uploader and archive season/episode labels, such as archive.org "S2E58", are alternate labels. Put them in `altLabels`, never in `number`.
- To link an upload, add `{recordId, role}` to the episode's `uploads`, with `part` for numbered parts. Roles are `whole-candidate`, `alternate-edition`, `part`, `excerpt` and `possible`. A `part` splits the programme itself; numbered parts of one story or segment are `excerpt`s. Set the record's `production` and `guideEpisodeId` to match.
- A `possible` copy is probably the episode but unresolved. It never counts toward coverage, the totals or the Watch button.
- `coverage` is `whole-candidate`, `parts-only`, `excerpt-only` or `missing`, and must agree with the upload roles. `evidence` of `complete-playback-reviewed` or `reference-compared` needs `evidenceDetail` naming the linked record, its exact URL and the check date; use it only for a recorded check of that URL. `playback-started` takes no `evidenceDetail` (the builder refuses one at that level): its exact URL and date are the linked record's playback fields, `playbackUrl` and `playbackVerifiedAt` with `playbackVerified`, which for Hop pages come from `data/hop-player-links.json`.
- Put uploads that are not matched to an episode in `unidentified` under their production: long uploads that may be episodes, and segments whose episode is unknown. The `classic-unassigned` queue holds classic uploads whose production is not established.
- Record each production total in `totalsEvidence` with its source and confidence, including conflicting claims. Related series (`format: related-series`), short series, home video and the Shalom and Elmo series stay outside the core Rechov Sumsum count.
- Licensed storefront and library-service listings carry `access: "licensed"`. They can make an episode a whole candidate, but they are not free uploads and not playback evidence. A free broadcaster stream limited to its service area (KET's PBS page) is not a licensed listing.
- Each licensed record is matched to a service in `data/licensed-services.json` by its link's hostname, and the library names that service and what it needs on every Watch label, access line, filter and note. hoopla is free with a card from a participating public library: you sign in to hoopla with the card, and each library sets a small monthly borrowing limit. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County cards work too, by choosing "Westchester Library System" in hoopla rather than the member library's name. New York Public Library and Brooklyn Public Library cards do not work (the user's observation, 2026-10-18). Apple TV and Prime Video sell or rent each programme with an account. Library rules, fees and limits change; give every new fact in that file its source and check date, and record an unconfirmed lead as a lead, not a fact.
- A recorded availability check is the string `country-restricted` or `unavailable`, or an object `{method, checkedAt, status, result}`. The library reads only `status`: `country-restricted` (failed outside Israel with a country restriction; pair it with `access: "vpn-required"`), `unavailable` (a generic error, a content-claim block or an unspecified restriction; pair it with `access: "unavailable"`) or `region-limited` (a free stream limited to its service area by a location check). The `result` text is evidence for people. Record every failed check with a status, so that it never shows as a public link.

For Hop link collection, [scripts/collect-hop-links.js](scripts/collect-hop-links.js) is a same-origin public-page collector intended to run in an accessible Hop tab in Zen Home. It collects JSON, without downloading video media. Its manifest is embedded in the script; keep it consistent with the source inventory when adding pages. Preserve existing successful links and playback evidence when importing a new report: merge new rows into `data/hop-player-links.json` by id, never replace the file with a new report. As of October 18, 2026 every manifest page has its Vimeo link. [TODO.md](TODO.md) has the steps for pages added later.

Run the collection yourself rather than handing it to the user. On October 18, 2026 the user asked agents to "just use the VPN, either from Zen or by activating the VPN computer-wide" for the Hop Vimeo links. Zen's extension with the Hop-only rule is the established route. A computer-wide VPN is acceptable for this task, but no Proton desktop app was installed on that date.

To enrich already discovered Vimeo URLs with public metadata, run:

```sh
python3 scripts/enrich-vimeo.py
```

This makes network requests and updates the metadata cache and Hop catalog. Successful cached results are reused unless `--refresh` is supplied. It preserves playback/access evidence. Rebuild afterward and inspect the changes.

The local HTML works without a server and opens playback on the original host. Stars and pasted Vimeo links are stored in the browser's local storage. Keep the file path and browser context stable, and use the library's JSON backup controls before moving the file or changing how it is opened.

# Evidence and episode counts

- Count upload URLs separately from distinct episode identities. Alternate hosts, duplicate editions, and numbered parts do not create additional episodes.
- Keep original Rechov Sumsum, the later Rechov Sumsum/Shara'a Simsim co-production, modern core seasons, short series, and home-video compilations distinct when calculating coverage.
- Number the original series and the 1998 co-production by the IETV programme numbers in the NLI catalogue. archive.org and uploader season/episode labels follow broadcast or collector order; keep them as alternate labels and evidence, not identities.
- Do not infer a full episode from duration alone or from Hop's generic use of the word פרק. A short installment can be complete within its own series without being a complete core Rechov Sumsum broadcast.
- Distinguish metadata checked, playback startup observed, complete playback reviewed, and completeness compared against a reference edition. Record the exact URL, date, and evidence for a stronger claim.
- Preserve original titles, uploader names, source URLs, privacy hashes, and stable catalog IDs. English titles and theme/character tags may be editorial; do not present them as publisher-supplied facts.
- Name an archive.org uploader by the public "Uploaded by" name on the item's details page, with its `@screenname` page as `uploaderUrl`, or "Unknown (archive.org)" when the page shows Unknown. The item metadata's `uploader` field is a private email address; never derive a name from it.
- Use primary sources for production totals where available. Keep contradictory totals and uncertain mappings explicit. Annual regulator accounting and current website counts do not automatically establish a lifetime production total.
- Update `data/episode-guide.json`, `TODO.md`, the relevant research note, and the episode audit when a gap is filled or a mapping is resolved. Acquisition and completeness verification are separate tasks.
