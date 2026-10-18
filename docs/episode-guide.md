# Editing the episode guide

Read this before editing `data/episode-guide.json`, a record's `production` or `guideEpisodeId`, or `data/licensed-services.json`. The evidence and counting rules in [AGENTS.md](../AGENTS.md#evidence-and-episode-counts) apply throughout. `scripts/build-library.py` enforces much of this contract; [files-and-build.md](files-and-build.md#building) lists what it refuses and what it only warns about.

## Episode identity and titles

- An episode is identified by its documented number or title: the IETV programme number for the original series and the 1998 co-production, the DVD number for 2012, Hop's listing number for the Elmo talk show, or the documented title. Hebrew titles are quoted as published. English titles are editorial.
- `titleHe` is the identifying source's title, verbatim. For the original series and the 1998 co-production it is the NLI IETV catalogue title.
- When that title has no story name (`רחוב סומסום <44>`), you may put a Hebrew story name quoted verbatim from another source in `storyHe`. Name that source in `storySourceEn` (required) and `storySourceHe`, for example `archive.org file label (uploader's wording)`. Never compose, shorten or translate a story name into `storyHe`.
- The Hebrew interface heads the episode with `storyHe`. The English interface uses the editorial `titleEn`, or `titleHe` without one. The episode page's identity card keeps `titleHe` as the "Catalogue title" and shows the story name with its source.
- The builder refuses an empty or non-string value, a `storyHe` without `storySourceEn`, and a source without `storyHe`. It warns when `titleHe` is missing or already contains the story name.
- Uploader and archive season/episode labels, such as archive.org "S2E58", are alternate labels. Put them in `altLabels`, never in `number`.

## Uploads, coverage and evidence

- To link an upload, add `{recordId, role}` to the episode's `uploads`, with `part` for numbered parts. Set the record's `production` and `guideEpisodeId` to match.
- Roles are `whole-candidate`, `alternate-edition`, `part`, `excerpt` and `possible`. A `part` splits the programme itself; numbered parts of one story or segment are `excerpt`s.
- A `possible` copy is probably the episode but unresolved. It never counts toward coverage, the totals or the Watch button. It may stay in its production's `unidentified` queue, because its identity is unresolved.
- `coverage` is `whole-candidate`, `parts-only`, `excerpt-only` or `missing`, and must agree with the upload roles.
- `evidence` of `complete-playback-reviewed` or `reference-compared` needs `evidenceDetail` naming the linked record, its exact URL and the check date. Use it only for a recorded check of that URL.
- `playback-started` takes no `evidenceDetail`; the builder refuses one at that level. Its exact URL and date are the linked record's playback fields, `playbackUrl` and `playbackVerifiedAt` with `playbackVerified`. For Hop pages those come from `data/hop-player-links.json`.
- Put uploads that are not matched to an episode in `unidentified` under their production: long uploads that may be episodes, and segments whose episode is unknown. The `classic-unassigned` queue holds classic uploads whose production is not established.

## Totals

Record each production total in `totalsEvidence` with its source and confidence, including conflicting claims. Related series (`format: related-series`), short series, home video and the Shalom and Elmo series stay outside the core Rechov Sumsum count.

## Licensed listings

- Licensed storefront and library-service listings carry `access: "licensed"`. They can make an episode a whole candidate, but they are not free uploads and not playback evidence.
- A free broadcaster stream limited to its service area, such as KET's PBS page, is not a licensed listing. Its availability check has status `region-limited`.
- Each licensed record is matched to a service in `data/licensed-services.json` by its link's hostname. The library names that service and what it needs on every Watch label, access line, filter and note.
- hoopla is free with a card from a participating public library. You sign in to hoopla with the card, and each library sets a small monthly borrowing limit. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County cards work too, by choosing "Westchester Library System" in hoopla rather than the member library's name. New York Public Library and Brooklyn Public Library cards do not work (the user's observation, 2026-10-18).
- Apple TV and Prime Video sell or rent each programme with an account.
- Library rules, fees and limits change. Give every new fact in `data/licensed-services.json` its source and check date, and record an unconfirmed lead as a lead, not a fact. Open questions are in [TODO.md](../TODO.md#completeness-and-playback-checks).

## Availability checks

A recorded availability check is the string `country-restricted` or `unavailable`, or an object `{method, checkedAt, status, result}`. The library reads only `status`:

| Status | Meaning | Pair with |
| --- | --- | --- |
| `country-restricted` | Failed outside Israel with a country restriction | `access: "vpn-required"` |
| `unavailable` | A generic error, a content-claim block or an unspecified restriction | `access: "unavailable"` |
| `region-limited` | A free stream limited to its service area by a location check | |

The `result` text is evidence for people. Record every failed check with a status, so that it never shows as a public link.

## After a change

Rebuild and check (see [AGENTS.md](../AGENTS.md#files-and-build)). When a gap is filled or a mapping is resolved, also update [TODO.md](../TODO.md), the relevant note in [research/](../research/) and the episode audit (`data/*-episode-audit.json`). [TODO.md](../TODO.md#how-to-update-this-list) explains how to add an alternate copy and when to tick a task.
