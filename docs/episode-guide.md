# Editing the episode guide

Read this before editing `data/episode-guide.json`, a record's `production` or `guideEpisodeId`, or `data/licensed-services.json`. The evidence and counting rules in [AGENTS.md](../AGENTS.md#evidence-and-episode-counts) apply throughout. `validate_guide()` in `scripts/build-library.py` is the authoritative list of the guide's required fields and allowed values, as `validate_services()` is for the services file; [files-and-build.md](files-and-build.md#building) summarises what the builder refuses and what it only warns about.

## Episode identity and titles

- An episode is identified by its documented number or title: the IETV programme number for the original series and the 1998 co-production, the DVD number for 2012, Hop's listing number for the Elmo talk show, or the documented title; failing these, a label, as described under `altLabels` below. Published Hebrew titles are quoted verbatim; `titleHeEditorial` holds our translation where none was published. English titles are editorial unless a source publishes one (the Shalom Sesame series, Sisu's English DVD titles for 2006); keep a published English title verbatim.
- Each episode needs a `confidence` in its identity: `documented`, `provisional`, or `uploader-label` when an uploader's label is the only evidence. Each entry in its `sources` has a `url`, a `label` or both.
- `titleHe` is the identifying source's title, verbatim. For the original series and the 1998 co-production it is the NLI IETV catalogue title.
- When that title has no story name (`רחוב סומסום <44>`), you may put a Hebrew story name quoted verbatim from another source in `storyHe`. Name that source in `storySourceEn` (required) and `storySourceHe`, for example `archive.org file label (uploader's wording)`. Never compose, shorten or translate a story name into `storyHe`.
- The Hebrew interface heads the episode with `storyHe`, else `titleHe`, else `titleHeEditorial`, else `titleEn`. The English interface uses `titleEn` (editorial or published), or `titleHe` without one. The episode page's identity card keeps `titleHe` as the "Catalogue title" and shows the story name with its source.
- `titleHeEditorial` is our Hebrew translation of the editorial English title, or of the original title, on an episode or a record that has no published Hebrew title. Never put it in `titleHe`, `storyHe` or `originalTitle`: an upload's own Hebrew wording goes in `titleHe` (verbatim), and only an item without one gets an editorial title. The Hebrew interface shows it where it would otherwise fall back to English and labels it as ours in an "Editorial Hebrew title" row on the record page and the identity card; English shows it only in that row. The builder refuses a value that is not a string, is empty or has leading or trailing spaces, and a value beside `titleHe` (or, on an episode, `storyHe`), also when two entries for one URL merge (it names the entry with each field). It warns about a value with no Hebrew letter. The conventions for writing one (glossary, Latin-script exceptions) are in `.sweep/titles-he/glossary.json`, the sweep that wrote them.
- The builder refuses an empty or non-string value, a `storyHe` without `storySourceEn`, and a source without `storyHe`. It warns when `titleHe` is missing or already contains the story name.
- Uploader and archive season/episode labels, such as archive.org "S2E58", are alternate labels. Put them in `altLabels`, never in `number`. Each entry is `{labelEn, labelHe?, sourceLabel, url?}`; `sourceLabel` names who uses the label.
- The exception is a production without a documented numbering, when a label is the only evidence of an episode: the label may supply its `number`, with `confidence: "uploader-label"`. Hop!'s post titles and old site codes number some 2006 and 2009 episodes this way. A label on an episode documented by its title, such as the community "episode 30" for Karambula, still goes in `altLabels`.

## Uploads, coverage and evidence

- To link an upload, add `{recordId, role}` to the episode's `uploads`, with `part` for numbered parts. Set the record's `production` and `guideEpisodeId` to match.
- Roles are `whole-candidate`, `alternate-edition`, `part`, `excerpt` and `possible`. A `part` splits the programme itself; numbered parts of one story or segment are `excerpt`s.
- A `possible` copy is probably the episode but unresolved. It never counts toward coverage, the totals or the Watch button. It may stay in its production's `unidentified` queue, because its identity is unresolved.
- `coverage` is `whole-candidate`, `parts-only`, `excerpt-only` or `missing`, and must agree with the upload roles.
- `evidence` of `complete-playback-reviewed` or `reference-compared` needs `evidenceDetail`, `{level, recordId, url, checkedAt, noteEn?}`. `level` repeats `evidence`. `recordId` is a linked upload: a whole or alternate one when the episode has one, never a `possible` copy. `url` is one of that record's URLs, and `checkedAt` an ISO date. Use it only for a recorded check of that URL.
- `playback-started` takes no `evidenceDetail`; the builder refuses one at that level. Its exact URL and date are the linked record's playback fields, `playbackUrl` and `playbackVerifiedAt` with `playbackVerified`. For Hop pages those come from `data/hop-player-links.json`.
- Put uploads that are not matched to an episode in `unidentified` under their production: long uploads that may be episodes, and segments whose episode is unknown. The `classic-unassigned` queue holds classic uploads whose production is not established.

## Totals

Record each production total in `totalsEvidence`, including conflicting claims. Each claim is `{value, confidence, url?, sourceLabel?, scope?}`, with a `url`, a `sourceLabel` or both. `value` is an integer or a string such as `>200`; `confidence` is `primary`, `secondary`, `conflicting`, `annual-accounting-only` or `current-listing-only`. Related series (`format: related-series`), short series, home video and the Shalom and Elmo series stay outside the core Rechov Sumsum count.

## Licensed listings

- Licensed storefront and library-service listings carry `access: "licensed"`. They can make an episode a whole candidate, but they are not free uploads and not playback evidence.
- A free broadcaster stream limited to its service area, such as KET's PBS page, is not a licensed listing. Its availability check has status `region-limited`.
- Each licensed record is matched to a service in `data/licensed-services.json` by its link's hostname. The library names that service and what it needs on every Watch label, access line, filter and note.
- hoopla is free with a card from a participating public library. You sign in to hoopla with the card, and each library sets a small monthly borrowing limit; where a library's own pages disagree (Queens: 5 or 10 a month), say so rather than pick one. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County cards work too, by choosing "Westchester Library System" in hoopla rather than the member library's name. New York Public Library and Brooklyn Public Library cards do not work (the user's observation, 2026-10-18).
- Apple TV and Prime Video sell or rent each programme with an account.
- The how-to box shows the steps' prose, so the builder ties the structured facts to it. A step (or the headline) that states a library's facts lists it in `libraries` with `participates` (whether its cards work), and names it, its member examples and its hoopla choice in both languages. Every entry in a library-card service's `libraries` is listed by a step, `lookupUrl` is the link of a step, and no `checkedAt` is after the build date.
- Library rules, fees and limits change. Give every new fact in `data/licensed-services.json` its source and check date, and record an unconfirmed lead as a lead, not a fact. Open questions are in [TODO.md](../TODO.md#completeness-and-playback-checks).

## Availability checks

A record's `availabilityCheck` is a status string, or an object `{method, checkedAt, status?, result}`; `validate_record_fields()` in `scripts/build-library.py` refuses an unknown status. A check that found the item listed carries no status; a failed or limited one must carry one of these statuses, and the library reads only the status:

| Status | Meaning | Pair with |
| --- | --- | --- |
| `country-restricted` | Failed outside Israel with a country restriction | `access: "vpn-required"` |
| `unavailable` | A generic error, a content-claim block or an unspecified restriction | `access: "unavailable"` |
| `region-limited` | A free stream limited to its service area by a location check | |

The `result` text is evidence for people. The status is what keeps a failed check from showing as a public link.

## After a change

Rebuild and check (see [AGENTS.md](../AGENTS.md#files-and-build)). When a gap is filled or a mapping is resolved, also update [TODO.md](../TODO.md), the relevant note in [research/](../research/) and the episode audit (`data/*-episode-audit.json`). [TODO.md](../TODO.md#how-to-update-this-list) explains how to add an alternate copy and when to tick a task.
