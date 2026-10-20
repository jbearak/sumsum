# US Sesame Street: sweep methods, sources and limits

On 19 October 2026 eight research agents swept the US Sesame Street main series, 1969 onward: three built the episode inventory and five searched for links. `scripts/import-sesame-street.py` turned their output into the guide and records. This note records what each agent searched, what it found, where it stopped and what it could not reach, then what was imported and how. The episode total and its evidence are in [episode-totals-sesame-street.md](episode-totals-sesame-street.md).

Everything was metadata only. No video was downloaded or played, no agent logged in, and no claim goes beyond "metadata checked". The agents' working files are under `.sweep/sesame-street/`, which is not tracked; what the project keeps is listed under [What was imported](#what-was-imported).

## Inventory agents

All three read Muppet Wiki through its MediaWiki API (`https://muppet.fandom.com/api.php`, `action=query`, `prop=revisions`, at most 50 titles a request, paced 1.5-2 seconds). Each kept the page, revision id and section of every quotation. The canonical season pages are titled like `Season 12 (1980-1981)`; the cross-season table is [Sesame Street seasons](https://muppet.fandom.com/wiki/Sesame_Street_seasons). Fandom returned HTTP 403 to requests without a descriptive User-Agent; with one, every batch succeeded and no 429 was seen.

English Wikipedia has no per-season articles or list for the US series: `List of Sesame Street episodes` redirects to [Sesame Street](https://en.wikipedia.org/wiki/Sesame_Street), and every `Sesame Street (season N)` title the agents tried is missing. So no agent could cross-check season counts against Wikipedia.

### inv-a, seasons 1-11

- 1,445 episodes, 0001-1445, every one with a date and a quoted summary: 1,435 from the first sentences of the SCENE 1 row, 9 from the page lead, 1 from an expanded Scene 1 template (0915). Plus the five July 1969 test shows as specials.
- Retrieved all eleven season pages, the season index, the five test-show pages, the pilot overview, the [lost-episodes overview](https://muppet.fandom.com/wiki/Lost_episodes_of_Sesame_Street) and the [0847 page](https://muppet.fandom.com/wiki/Episode_0847).
- Primary count checks: the CTW budget tables in [The Children's Television Workshop: How and Why It Works (1973)](https://files.eric.ed.gov/fulltext/ED086203.pdf#page=128), the [CTW Annual Report 1973](https://files.eric.ed.gov/fulltext/ED088428.pdf#page=10), Joan Ganz Cooney's [1,000 Hours of a Perpetual Television Experiment (1976)](https://files.eric.ed.gov/fulltext/ED130634.pdf) and the [Commissioner of Education report](https://files.eric.ed.gov/fulltext/ED621758.pdf#page=120). No season-specific primary total was found for seasons 5, 6, 8, 9, 10 or 11.
- Guest names for 943 episodes, matched from links against the season Guest Stars lists. Partial: an empty list does not mean no guest.
- 53 episodes are reported missing from the Sesame Archives. They are archival losses, not numbering gaps.
- Not reached: the newspaper scan behind season 3's premiere date, exact dates for test shows 2-5, and the blank sponsors of 0105.

### inv-b, seasons 12-24

- 1,690 episodes, 1446-3135, 130 a season, every number present once. 1,689 summaries quote SCENE 1; 2311 has no SCENE 1 row, so its quote is the first insert and is labelled that way.
- Fetched all 1,690 episode pages in 34 batches and the 21 celebrity-sketch pages transcluded in `Celebrity` rows, to recover guest names hidden in templates. Guests were extracted for 1,145 episodes.
- Checked Fandom's licence with `meta=siteinfo&siprop=rightsinfo`: CC BY-SA, [Fandom licensing](https://www.fandom.com/licensing).
- Date checks: a [Washington Post column of 11 November 1991](https://www.washingtonpost.com/archive/lifestyle/1991/11/11/the-tv-column/f466a148-dc48-4070-86b3-ff6765be4c99/) (season 23 premiere) and [Education Week, 4 November 1992](https://www.edweek.org/education/to-reach-kids-where-they-are-sesame-street-goes-to-preschool/1992/11) (season 24 premiere; the direct page returned 403, the indexed text was read).
- Open: the 2557 date, the unaired divorce production's number, and 2835's sponsors.

### inv-c, seasons 25 onward

- 1,609 aired episodes, 3136-5613, plus a provisional record for announced episode 5701. Summaries quote the first one or two sentences of the first street-scene description (1,605) or, for numbered specials, the opening paragraph (4).
- Published titles from Sesame Workshop press kits and Watch and Play pages, [Netflix's listing](https://www.netflix.com/title/83075543), Prime Video headings, Apple's iTunes Search and Lookup API, and NHPBS schedule pages. A title was accepted only on a title-and-story match or an explicit producer number, never on catalogue position. 482 episodes got a confirmed published title; 77 later Wiki headings still need a publisher match.
- NHPBS: 160 title-gap targets checked, 64 with a matching printed number; two of those (4715 and 5128) conflict and were not used.
- 224 Word on the Street values and guest names for 1,262 episodes.
- Failures: guessed press-kit URLs for seasons 46-49 returned 404; some WarnerMedia pages returned 403 and were read as indexed text; Prime pages expose only 24 episode headings; many old NHPBS URLs redirect to the current schedule.
- 16 HBO-era episodes, 5518-5533, have no separate PBS date.

## Link agents

### links-archive (Internet Archive)

- The first title, subject and description search returned 10,113 catalogue rows. Later searches brought the set to 26,504 distinct rows: 434 logged query jobs (7 advancedsearch, 427 scrape), covering CTW, PBS, VHS and off-air terms, padded episode numbers, the TV News Archive and one query per year from 1969 to 2026.
- 317 uploader catalogues (299 public profiles, 18 anonymous-account leads; 4,686,177 items in all) and 44 collections were enumerated. 1,883 items were read through `metadata/<id>` and their public details page.
- 1,387 items gave 8,869 candidate video files. 7,780 are publicly listed; 1,089 are in items that mark their videos private or restricted, chiefly robertfarrell10's [1960s-1970s](https://archive.org/details/sesame-street_202306), [1990s](https://archive.org/details/sesame-street-1990s) and [2010s](https://archive.org/details/sesame-street-2010s) collections. 91 items expose no video at all.
- Uploader names come from each item's public "Uploaded by" block. The private metadata email was never used or stored.
- Result: whole candidates for 3,931 episode numbers, parts only for 2, excerpts only for 85. Season gaps are heaviest in seasons 4-9.
- Muppet Wiki returned 403 to this agent, so it matched against the inventory agents' saved pages. Three offline review passes and a final audit corrected false matches: story-installment labels read as parts, the home video 123 Count With Me read as 0123, Canadian variants, Electric Company numbers inside mixed Noggin blocks, dates read as episode numbers.
- Andrew Stasio's [HBO/HBO Max/Tubi/Netflix selections](https://archive.org/details/hbo-max-selections-from-sesame-street-december-14-2020) item maps to 247 numbers; two labels stay unresolved. Modern season bundles had 49 conflicts between S/E ordinals and titles, so ordinals stay alternate labels.
- No main-series episode was found in the TV News Archive.
- Saturation: the last collection and uploader pass changed nothing, `(1883, 317, 44, 1883) -> (1883, 317, 44, 1883)`. Dark, private and unindexed items are outside that check.

### links-yt-official (official YouTube channels)

- Eleven channels tried: [Sesame Street](https://www.youtube.com/channel/UCoookXUzPciGrEZEXmh4Jjg), [Sesame Street Classics](https://www.youtube.com/channel/UC7DM7591Xkt1M2D3fs_wAlg), [Sesame Workshop](https://www.youtube.com/channel/UCuEgW3r4ytXwd9UfQySv_Nw), PBS KIDS, HBO, HBO Max Family, HBO Kids, Netflix Jr., Netflix Family, Shout! Kids and Sesame Street: Monthly Pass. Videos, Shorts, streams and playlists tabs were read; 445 playlists were enumerated.
- The two full-episode collections are YouTube "shows" that yt-dlp's playlists tab omits, so they were fetched by id: the [main playlist](https://www.youtube.com/playlist?list=PL8TioFHubWFsnPhBmrDQ8dtoXxghDMKxr) and the [Classics playlist](https://www.youtube.com/playlist?list=PLxKlPmCFYxy9y498dCB1tIddaxZz3OQCA). [YouTube's announcement of 15 January 2026](https://blog.youtube/news-and-events/sesame-street-now-streaming-on-youtube-and-youtube-kids/) promised more than 100 full episodes, not the whole series.
- Result: 420 URLs. 151 single full-episode uploads cover 146 numbers; 99 compilations hold 194 identified numbers; the union is 323. 169 parts or episode-organised excerpts; 29 uploads with no established number.
- The official premiere upload, [Dc5GpBU0kTI](https://www.youtube.com/watch?v=Dc5GpBU0kTI), was removed for a Terms of Service violation and returns oEmbed 404. It is kept with status `unavailable`. A 2019 marathon (3WB7Rv1T9yE) is private, and six PBS KIDS playlist entries are blank placeholders; both are in the audit, not the records.
- Chapter labels that contradict their titles were resolved by title and season (5904 read as 5409, "Season 42 Ep. 44" as 4282 not 4300, an impossible "Ep. 79" as 4279).
- Failed routes: @SesameInCommunities, @NetflixKidsFamily and @HBOkids returned 404; the legacy paid `sesamestreetepisodes` channel has no videos.
- Saturation: 38 long unlabelled uploads were checked against the episode index and added no numbered episodes. No other English US main-series channel turned up.

### links-yt-community (community YouTube uploads)

- yt-dlp flat searches, paced 1.5 seconds with a 45-second back-off on 429. Search stages: base terms, date-sorted, every year, broadcast years, every season, number ranges by hundreds and mid-hundreds, decades, collector terms and playlists. Then 444 channels' videos tabs, 442 playlists tabs, 442 streams tabs and 733 playlists. 695 single-video metadata reads through the embedded-player client.
- Result: 12,700 distinct upload URLs. By proposed role: 3,226 whole candidates (2,016 numbers), 55 alternate editions (46), 442 parts (198), 7,260 excerpts (3,159), 1,434 possible (702), 283 unmatched. Parts-only 70 numbers, excerpts-only 1,523.
- The largest whole-episode channels were John Woo-Hyon Kim (501 numbers), RoboGobo Fan 2025 (346), The Sesame Street Archive 2 (145), Rohail Hashmi (141), Channel 22 (122) and Vintage Sesame Street (118).
- 465 listings came back private, deleted or otherwise unavailable, and 10 single-video reads returned nothing parseable. Fan-made "episodes" with numbers that do not exist (4328, 4329, 4331 and others) are recorded as unverified labels.
- Stopped under a revised stop condition set by the orchestrating agent: Shorts tabs were skipped because they cannot hold whole episodes, capped mixed channels were not extended, and one extension in progress (AVTB) was stopped. 423 source specs were never requested; they are listed in `source-closure.json`. No claim of saturation is made.

### links-streaming (licensed and free-with-ads services)

- 2,265 listing URLs; 775 production numbers have a whole-candidate listing on at least one service. Services read: HBO Max (560 URLs, service seasons 1, 5, 7 and 39-55), Hulu (560, same catalogue), Apple's iTunes catalogue (363), Google Play (267), Tubi (251, service seasons 1-48), YouTube purchases (178, confirmed by oEmbed), PBS KIDS (25), Prime Video purchases (22 season pages listing 310 episodes), the HBO Max channel on Prime Video (20 pages), Netflix (15), Kanopy Kids (2), the Roku Channel (1) and Spectrum On Demand.
- Mapping used Muppet Wiki's [HBO Max](https://muppet.fandom.com/wiki/HBO_Max), [Tubi](https://muppet.fandom.com/wiki/Tubi), [TVOD](https://muppet.fandom.com/wiki/Sesame_Street_TVOD), [Classics](https://muppet.fandom.com/wiki/Sesame_Street_Classics) and [Selects](https://muppet.fandom.com/wiki/Sesame_Street_Selects) tables, checked against the dedicated episode pages. Service season and episode labels stay alternate labels.
- Limits: Prime Video's public HTML shows at most 24 episode cards a season, so longer seasons have uncollected tails. Netflix's 2026 Classics and Selects pages render ten episodes each; Muppet Wiki lists seventeen Selects entries, so seven are leads. Roku's free selection could not be enumerated. The PBS KIDS content API returned 403; the website was read instead.
- Not found as regular-series catalogues: PBS Passport (PBS says KIDS shows are not in it), hoopla (33 films and specials; JustWatch's "Sesame Street" hoopla offer is Shalom Sesame), Peacock, Paramount+, Pluto TV, Fandango at Home, SesameStreet.org, Showmax and Crave. Reelgood returned 403.
- 91 failed discovery requests are recorded: 89 oEmbed requests built from Google `.P` product ids, which are not YouTube video ids, plus the PBS KIDS content API and Reelgood.

### links-other (other hosts and institutions)

- 720 URLs: OK.ru 364, Dailymotion 190, Rumble 65, Vimeo 56, Paley Center 35, AAPB 4, Facebook 2, and one each from bilibili, Rutube, BitChute and a UGA legacy link. 500 numbers have listed public metadata and 392 a listed whole candidate.
- OK.ru: Robert Farrell's [public collection](https://ok.ru/video/c2297643) was exhausted over 30 pages, 351 entries, 345 of them numbered episodes. A second profile exposed only two videos without login.
- Dailymotion: 73 search strings, 160 API requests, 2,376 rows. Broad queries hit the 1,000-result cap, so the host is not exhausted. 12 direct video requests returned 404.
- Vimeo: public search returned 403. Three uploader lists were read through the API; only two uploads (0001 and 0131) are whole candidates. Two accounts label clips as short as 13 seconds "FULL".
- Rumble: the [Classic Sesame Street channel](https://rumble.com/c/ClassicSesameStreet), three pages, 65 URLs. Whether the videos are free or behind Rumble Premium is unresolved.
- Institutions: the [AAPB collection page](https://americanarchive.org/special_collections/sesame-street) says the episodes are not streaming and are available to researchers at the Library of Congress. Paley's 58 search results are on-site only. All these records carry status `unavailable`.
- Muppet Wiki's external-link citations were paginated in full (1,312 to Facebook, 1,453 to the Wayback Machine). Wayback CDX found 308 archived official episode pages; the two sampled pages had descriptions, not video.
- Odysee and LBRY gave nothing; TikTok search is blocked by robots.txt; bilibili's search API returned 412.

## What was imported

`scripts/import-sesame-street.py` reads only the sweep files and makes no network request. It wrote:

- [guide-sesame-street.json](../data/guide-sesame-street.json): the production, 4,744 aired episodes and a queue of 2,417 uploads to identify.
- [sesame-street-archive-records.json](../data/sesame-street-archive-records.json) (8,867 records), [sesame-street-youtube-records.json](../data/sesame-street-youtube-records.json) (13,120) and [sesame-street-other-records.json](../data/sesame-street-other-records.json) (2,964): 24,951 records, one per URL, with file-level defaults for repeated text.
- [sesame-street-link-evidence.json](../data/sesame-street-link-evidence.json): per record, keyed by record id, the URL, the agent and how the sweep identified the link: `matchBasis`, `matchSources`, `episodeNumbers`, `unverifiedEpisodeNumbers`, `compositionStatus`, `fileName`, `listedEpisodes` and `notes`, where the sweep recorded them, and where it was found: `sourceUrl` (the listing page, when it is not the link itself or an archive.org file's item page), `sourcePlaylists`, `discoverySources` (the channel, playlist or search pages that listed it) and `duplicateFileUrls`, with `alsoFoundBy` for a link found again. Uploader descriptions are not copied into it. It is not embedded in the library.
- [ATTRIBUTION.md](../data/ATTRIBUTION.md): the licence and attribution for the quoted Muppet Wiki text.
- [sesame-street-episode-audit.json](../data/sesame-street-episode-audit.json): what the guide does not hold.

Records by agent: links-archive 8,867 (8,869 candidates less the two rejected below), links-yt-official 420, links-yt-community 12,700, links-streaming 2,244, links-other 720. No URL was found by two agents.

Records by host: YouTube 13,298 (13,120 free uploads and 178 purchase listings), archive.org 8,867, HBO Max 560, Hulu 560, OK.ru 364, Apple 363, Google Play 267, Tubi 251, Dailymotion 190, Rumble 65, Vimeo 56, Paley 35, PBS KIDS 25, Prime Video 22, Netflix 15, AAPB 4, Kanopy 2, Facebook 2, and one each for the Roku Channel, bilibili, BitChute, Rutube and UGA.

2,219 records are licensed listings (`access: "licensed"`) under a service in [licensed-services.json](../data/licensed-services.json): HBO Max, Netflix and Hulu (subscribed), Apple TV, Prime Video, Google TV and YouTube purchases (purchase or rental), Kanopy (library card), and Tubi and the Roku Channel (free with ads). The sweep recorded Tubi and Roku as free hosts; they are filed as licensed listings of a free-with-ads service. PBS KIDS is not a licensed service: its 25 records are free links with status `region-limited`.

### Left out

- The 20 Prime Video pages for the HBO Max channel. It is an add-on subscription the user does not have, and it repeats HBO Max's own listings. The audit keeps the service record.
- Spectrum On Demand's one listing: no episode was mapped. The audit keeps the service record.
- The failures that are not videos to link: the streaming agent's 91 failed discovery requests, the community agent's 465 unavailable listings and 10 empty metadata reads, the private 2019 marathon and the blank PBS KIDS playlist entries. They are in the audit's `failedDiscovery` and `linkGaps`, by agent.
- Two archive.org files rejected after review, listed with their reasons under `rejectedLinks` in the audit. `ia-youtube-1fb7lHcgE8s-f4e2249048` is an unrelated talk show titled "... | Ep 231" (altCensored.com), which the archive agent had matched to 0231, a reported-lost episode, by its number. `ia-yt-5s.com-childrens-television-lost-media-a-compilation-of-classic-mysteries-b09f7d9a2c` is a lost-media discussion video whose description mentions 0847. Neither is a copy of the episode, and both had been proposed as whole candidates.
- The 5701 placeholder, the test pilots and specials, and 166 out-of-scope items (specials, home video, spin-offs, dubs). The four numbered specials 4057, 4327, 4427 and 4552 are episodes in the guide; their specials entries are cross-references only.

### Roles

The guide's upload entries are the only link between an episode and a record; records carry no episode list. Each upload gets one of the existing roles, decided per episode from the sweep's proposed role:

- `possible` when the sweep proposed it, when the episode number was named but unverified, or when a compilation's contents were unresolved. A record that is possible for every episode it names, or names none, goes into the `unidentified` queue.
- `excerpt` when the file label marks that episode incomplete inside a block, with the extent note "The file label marks this episode incomplete within the block." This applies inside compilations too, so an incomplete component is never a whole candidate.
- `whole-candidate` for the sweep's whole candidates and for each component of a compilation; `alternate-edition`, `excerpt` and `part` (with its part number) as proposed.
- An upload that holds several episodes as whole or alternate gets a `container`: `listing` for a licensed catalogue or season page, `compilation` for one video.

The guide has 25,012 upload entries: 14,312 whole-candidate, 8,202 excerpt, 1,935 possible, 501 part and 62 alternate-edition; 294 inside a compilation and 342 on a listing. The 2,417 queued records are 1,893 possible-only records and 524 with no number at all.

A record's `kind` follows from its roles: `collection` (119) when it is whole for several episodes, `episode` (13,760), `clip` (8,655), or `unverified` (2,417) when it waits in the queue. `guideEpisodeId` is set only when a record counts toward exactly one episode.

Character tags are editorial: names found in the Muppet Wiki summary of the record's episode, or in its title. The music theme comes from words like "song" or "sing" in the title. Neither is exhaustive.

### Evidence level

Every record defaults to "metadata checked; playback not tested", with the completeness note "Metadata checked only. No playback, end-to-end review or reference comparison." A link that was listed and showed no failure carries the check result "Listed; no failure recorded. Not a playback check." Public metadata confirms a title, an uploader and a listed duration. oEmbed and catalogue listings do not show that a video plays, that it is uncut, or that a part set is continuous. No Sesame Street upload has a recorded playback start, and none has been compared with a reference edition.

A whole candidate is an upload identified as the numbered episode and of episode size, without an excerpt or incomplete label. Duration was a filter, never proof. The PBS half-hour edits of 2014 onward, TVOD half-hour editions and Netflix Selects are edited versions; the records say so where the sweep found it.

Failed checks are kept with their status, so they never show as working links: 1,145 `unavailable` (archive.org 1,089, Paley 35, Dailymotion 12, AAPB 4, YouTube 2, and one each on Rumble, Vimeo and UGA) and 26 `region-limited` (PBS KIDS 25, the Roku Channel 1). They stay linked to their episodes.

### Text from Muppet Wiki

Each episode's `summaryEn` is quoted verbatim from Muppet Wiki, with wiki markup removed, and its `summarySource` names the page and revision id; all 4,744 carry a revision id. Muppet Wiki text is CC BY-SA ([Muppet Wiki copyrights](https://muppet.fandom.com/wiki/Muppet_Wiki:Copyrights), [Fandom licensing](https://www.fandom.com/licensing)): reuse keeps the attribution and the share-alike terms. [ATTRIBUTION.md](../data/ATTRIBUTION.md) records this. The licence version was not read, because the Fandom licensing page refused an automated request.

The source label says which part of the page is quoted. 4,730 summaries are labelled "Muppet Wiki, first scene": the first one or two sentences of the first scene or street scene, which is not a synopsis of the episode (for 1839, the first scene comes before Mr. Hooper's death is explained). 2311, which has no first-scene row, is labelled "Muppet Wiki, first insert". The other 13 are labelled "Muppet Wiki": 9 page leads in seasons 1-11 and the opening paragraphs of 4 numbered specials. Descriptive plot labels such as "Block party on Sesame Street" are alternate labels, not titles. `titleEn` holds only published titles (483 episodes). Each of the 483 also has our Hebrew translation in `titleHeEditorial`, merged by the importer from [sesame-street-titles-he.json](../data/sesame-street-titles-he.json); it is editorial, not a published Hebrew title.

## Coverage

These counts are distinct episodes, not URLs. Alternate hosts, editions and parts add no episodes. "Usable" leaves out links whose check failed.

| | All linked uploads | Usable uploads only |
| --- | ---: | ---: |
| Whole candidate | 4,111 | 4,104 |
| Parts only | 3 | 3 |
| Excerpts only | 385 | 391 |
| Possible copies only | 18 | 19 |
| Nothing | 227 | 227 |

The builder counts the first column; its "missing" is the last two rows together, 245. Seven episodes lose their only whole candidate when failed links are left out: 0723, 0870, 0915, 0923 and 3798 (restricted archive.org files), 1141 (a Paley catalogue record, on-site only) and 4427 (restricted archive.org; its other copies are possible).

Of the 4,104, 4,099 have a free whole candidate. Five, 5327 and 5331-5334, have only licensed listings. No episode depends on a compilation or a listing alone: each of the 4,104 has a direct whole-episode link.

Episodes with a usable whole candidate on each host (they overlap): archive.org 3,932, YouTube 2,182, licensed listings 775, OK.ru 363, Rumble 63, Dailymotion 6, Vimeo 2, Rutube 1. For 1,735 the only whole candidates are on archive.org, for 146 only on YouTube, and for one only on OK.ru.

The parts-only episodes are 0202, 0601 and 3881. All 53 episodes reported lost have excerpts only.

The gaps sit in seasons 4-9 and in season 42; from season 10 on, nearly every episode has a whole candidate:

| Season | Episodes | Whole | Parts only | Excerpts only | Possible only | Nothing |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 130 | 128 | 0 | 2 | 0 | 0 |
| 2 | 145 | 122 | 1 | 22 | 0 | 0 |
| 3 | 130 | 105 | 0 | 25 | 0 | 0 |
| 4 | 130 | 87 | 0 | 43 | 0 | 0 |
| 5 | 130 | 37 | 1 | 91 | 0 | 1 |
| 6 | 130 | 29 | 0 | 45 | 1 | 55 |
| 7 | 130 | 31 | 0 | 67 | 0 | 32 |
| 8 | 130 | 26 | 0 | 44 | 3 | 57 |
| 9 | 130 | 16 | 0 | 35 | 0 | 79 |
| 10-41 | 3,071 | 3,048 | 1 | 15 | 6 | 1 |
| 42 | 44 | 32 | 0 | 2 | 8 | 2 |
| 43-56 | 444 | 443 | 0 | 0 | 1 | 0 |

Usable uploads only. Within 10-41 the shortfalls are single episodes: season 12 (1 excerpt-only), 16, 17 (1 possible-only each), 22 (1 excerpt-only, 1 possible-only), 23 (2 excerpt-only, 1 possible-only, 2958 with nothing), 24 (1 excerpt-only), 27 (2 excerpt-only, 1 possible-only), 30 (4 excerpt-only, 1 possible-only) and 31 (4 excerpt-only, 3881 parts-only). In 43-56 the only shortfall is 4427. The episodes with nothing linked are 0577, 55 in season 6, 32 in season 7, 57 in season 8, 79 in season 9, 2958, 4298 and 4299; `linkGaps` in the audit lists them per agent.

## Fixed after review

- The two false whole candidates for 0231 and 0847 are now rejected by the importer (see [Left out](#left-out)). With them gone, 0231 has excerpts only, like the other reported-lost episodes, and 0847 keeps its other copies.
- Summary labels: the first-street-scene quotes of seasons 25 onward were labelled plain "Muppet Wiki" because their section was recorded in a different field. They are now labelled "Muppet Wiki, first scene".

## Open questions

- The same Noggin block file sits in two archive.org items, and the import gives it different roles for 1041: whole candidate (in a compilation) in one, part in the other. The archive agent counted 3,931 numbers with a whole candidate; the guide has 3,932 with a usable archive.org whole candidate. The guide adds 0871 and 1041, whose only public whole copies are Noggin blocks, and lacks 0231, whose false match was rejected.
- Whether Rumble's videos are free, and the spoken language of the Dailymotion 4263 upload (labelled French, titled in English).
- Netflix Selects' seven unseen entries, Prime Video's uncollected season tails, Roku's free selection, and Kanopy's season 39 product.
- Region availability, including from Israel. The reports do not record where each check was made from, and no check went through the VPN.

## Work still needed

- Settle the Noggin block roles for 0871 and 1041.
- Look for whole copies of seasons 5-9 and the 227 episodes with nothing linked, and resolve the 19 possible-only episodes, most of them in season 42 (4284-4294).
- Work through the 2,417 queued uploads, starting with the 283 unmatched community uploads and the 29 official compilations without numbers.
- Record a playback start for a sample of whole candidates before claiming any.
- Read the version of the CC BY-SA licence from the Fandom licensing page, which refused an automated request.
