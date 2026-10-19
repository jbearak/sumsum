# Acquisition sweep, October 2026

On 17 and 18 October 2026 a set of search agents swept YouTube, the Internet Archive, other video hosts, Hop!'s public API and a range of archives for Rechov Sumsum, Shalom Sesame and Israeli Elmo material. A second round followed up the gaps, a verification round re-checked the results, and an integration step merged everything into the catalog and the episode guide. This note records how the sweep worked, how close it came to saturation, what it could not reach and what is left for the user.

Everything was metadata only. No video media was downloaded and no programme was watched. No Hop! HTML page was loaded outside Zen, and no VPN setting changed.

## What it produced

| Output | Count |
| --- | ---: |
| Raw candidate records from all agents | 4,096 |
| Distinct videos after merging duplicates | 2,232 |
| New catalog records | 1,572 |
| Field patches to the 700 existing records | 1,142 |
| Exclusions | 660 |
| Episode guide productions and episodes | 14 and 386 |

New records by host: YouTube 831, archive.org 627, hop.co.il 49, licensed storefront listings 31 (hoopla 12, Prime Video 10, Apple TV 9), KET 1 (a PBS member-station page limited to its broadcast area by a location check), Vimeo 17, Dailymotion 6, Facebook 6, other 4 (IMDb 2, Kan 1 and a free TV Guide promo clip). By series: classic 1,097, modern 289, classic Shalom Sesame 74, 2010 Shalom Sesame 67, Elmo 45.

The records live in [archive-org-records.json](../data/archive-org-records.json), [youtube-records.json](../data/youtube-records.json) and [other-host-records.json](../data/other-host-records.json), and the 49 Hop! posts were appended to [hop-records.json](../data/hop-records.json). The patches to existing records change production, guide links, labels, notes and classification fields. None changes a title, uploader, URL, privacy hash or id. The NLI catalogue extract is [nli-ietv-catalogue.json](../data/nli-ietv-catalogue.json).

## Methods

### YouTube searches

YouTube was read with yt-dlp in metadata mode only, with no cookies, paced at 2-3 seconds between calls.

- Classic search: 416 search specifications (ytsearch20, 50 and 100, plus 13 date-sorted result pages) built from Hebrew, English and Arabic base terms crossed with episode, season, year, channel, archive and VHS modifiers, cast and character names, and every catalogued classic story title. The 31 playlists and channels that surfaced were enumerated. The searches saw 6,021 distinct videos.
- Modern search: 246 searches covering Hop! and modern terms, every year from 2006 to 2025, spin-off titles, every 2009, 2012 and Discovering Curiosity story title in the catalog, cast names from Hebrew Wikipedia, and Arabic variants.
- Residual search: 36 searches for distinctive words from the NLI summaries of IETV programmes that had no match, and for co-production segment and guest names.

Flat searches hit no rate limit. Single-video metadata hit YouTube's bot check with the default client, so it was read through the embedded-player client, and titles were confirmed through the public oEmbed endpoint because search results sometimes return auto-translated titles.

### YouTube channels and playlists

The channel sweep ran in three phases. It started from the 27 channels already in the catalog plus the official @rehovsumsum and Hop! channels, reading each one's videos, streams, shorts and playlists tabs. It then enumerated 87 more channels found through 70 video searches, 5 playlist searches and 7 channel searches, and finally every remaining uploader of a relevant item (135 channels) and 14 Kan, IETV and IBA archive channels. Very large general channels (news channels, HOT, Netflix Israel, Sesame Workshop, the Knesset) were searched in-channel instead. In all, 265 channels were fully enumerated, 23 were searched in-channel and 384 playlists were read. The sweep saw 128,565 distinct video ids.

Hop!'s own YouTube channel was enumerated separately: its 1,119 videos and all 141 playlists, which hold 2,421 distinct entries. That produced 146 Sesame uploads not yet in the catalog, many of them unlisted and reachable only through a playlist. Sesame Workshop International, the Hop! group channel ילדות ישראלית, Hop!'s Arabic channel لولي بالعربية and the National Road Safety Authority channel were also read.

### Hop! WordPress API

Hop!'s public API was paged in full with curl: 1,114 show posts, 264 show categories, 292 music posts, 157 creation posts and the games, podcasts, blog posts and pages. All 185 posts then in [hop-url-manifest.json](../data/hop-url-manifest.json) are still live. The API holds 59 Sesame-related posts outside that manifest. Ten are Hebrew dubs of Sesame Workshop series ("אלמו וטנגו - תעלומות מסתוריות" and "חבובוטים") and were excluded. The other 49 became catalog records and were appended to the manifest and to the collector's copy of it: 6 resilience posts, 42 music posts and 1 Tu BiShvat special. Their Vimeo links were collected after the sweep (see "Hop! Vimeo links, 18 October" below). Hop!'s Vimeo account has no public listing, so Hop! videos can only be found through the privacy-hash URLs on Hop! pages.

### Internet Archive and other hosts

- archive.org: about 75 advanced-search queries in Hebrew, Arabic and English, subject and uploader sweeps, and file listings for 46 items. The main finds were [rechov_sumsum_1983](https://archive.org/details/rechov_sumsum_1983) (193 original-series files) and sesamestreetpscs246bu, a 2019 backup of a deleted YouTube channel with 390 Hebrew-dubbed segment clips among its 815 files. Shalom Sesame DVD and VHS rips, a Russian dub and the 2006 Karambula episode also came from archive.org.
- Dailymotion: 38 API searches returned 1,040 videos, of which 6 were relevant.
- Vimeo: the community channel [רחוב סומסום](https://vimeo.com/channels/1670669/videos) (16 clips) and a Tablet Magazine Shalom Sesame preview.
- Embeds: popy.co.il pages yielded 6 new YouTube ids, including unlisted full-length uploads by O sternberg 1991; bagels.tv's WordPress API yielded 5, two of them dead.
- Facebook: six posts. Five are Kan Archive posts whose title, description, duration and date were read without login with yt-dlp in metadata mode. The sixth, a JCC Association Shalom Sesame video, exposed only a generic title without login; its title comes from the URL slug and a search result.
- ok.ru, Rutube, bilibili and TikTok searches found no Israeli uploads.
- Licensed services: hoopla, Apple TV and Prime Video pages were read for metadata. KET's page was read too; it streams free inside its broadcast area after a location check, so it is not a licensed listing. A TV Guide page with a free 62-second promo clip was read too; it is not a licensed listing either.

### Archives, libraries and the press

- National Library of Israel: Alma SRU MARC queries for the IETV holdings (199 + 70 programme records), the Classicaletet DVD records and the Hed Arzi tapes.
- Israel State Archives: the publication page and document scans, including the 1986 Lorberbaum letter.
- Wayback Machine: IETV's old site (23tv.co.il), the Kan archive site, Hop!'s 2003-2006 Sippuray Sumsum pages and 2004 schedule, Hop!'s 2007-2014 Sesame minisite, 238 Hop! pages from 2014-2016, Hop!'s old JSON API (2019-2023), the Shalom Sesame site (97 video pages, 40 player configs, the store and the DVD page), Classicaletet's catalogue (31 pages) and Hed Arzi's sites.
- Library catalogues on the Agron platform: Holon, Nahariya, Karmiel, Ashkelon, Kiryat Ata, Eilat and a 13-library union search.
- Regulator reports for 2005-2018, downloaded and read in full.
- NLI historical newspapers through a search index: 153 queries, 16 listing hits.
- Kan and IETV YouTube uploads playlists, the Kan Chinuchit channel and the Israel State Archives channel.

### Integration and verification

The candidates were merged by video id, checked against the catalog, given an availability check (YouTube oEmbed, archive.org metadata, Hop! API) and classified in 23 batches. Six reviewers then checked the package and raised 82 problems. All 82 were accepted, 7 with extensions and 2 with a different fix. The episode guide was built after that, so its episode links reflect the corrections.

## Saturation

Several independent checks suggest the public sweep is close to complete for what can be found from outside Israel.

- The channel sweep met every one of the 515 YouTube ids already in the catalog.
- The merge combined 1,074 duplicate reports, cases where two or more agents found the same video.
- The 36 residual searches for unmatched IETV programmes returned 366 distinct videos. 63 were already known and the rest were unrelated, apart from five non-Sesame items. The 15 residual archive.org queries found nothing new.
- All 200 YouTube ids embedded on the later official Shalom Sesame site were already known.
- Hop!'s API has no Rechov Sumsum show category beyond the groups already catalogued, and every post of the original manifest is still live.
- Flat searches for "סיפורי סומסום" and several Sesame Stories titles return no rows through yt-dlp, repeatably and without a rate limit. The known Sesame Stories uploads came from other routes.

Saturation is not completeness. Uploads restricted to Israel, private uploads and copies on sites the sweep could not read are outside these checks.

## Blocked sources

| Source | What happened | Consequence |
| --- | --- | --- |
| NLI newspaper pages | Cloudflare returned 403 to curl and to the web fetcher | Listings were read as search snippets only; page images not viewed |
| Web search budget | 200 calls per turn, shared by all agents, exhausted | IETV 124, 169, 183-197 and co-production titles 2-70 were never queried in the press index |
| Israeli VOD and cable catalogues | yes.co.il and stingtv.co.il 403; cellcomtv.co.il and nexttv.co.il timed out; partner.co.il returned an empty shell; hot.net.il looped | No VOD season listing was read. The Wayback Machine has no captured VOD title page |
| YouTube from outside Israel | Per-video playability checks of the 149 ערוץ הופ! uploads added by the sweep (the catalog holds 151 with the first inventory's 2) returned 110 country restrictions, 34 "not available", 4 bot checks and 1 unspecified restriction. Across all new YouTube records, 119 country restrictions are recorded as `country-restricted` and 91 generic, content-claim or unspecified failures as `unavailable` in their availability checks | No official Hop! upload could be checked for playback. The yt-dlp metadata requests still gave upload dates and durations for all 149 and descriptions for 58. Uploads restricted to Israel may not appear in search results at all, and many surfaced only through playlists |
| YouTube single-video metadata | Bot checks and HTTP 429 | Worked around with the embedded-player client; some durations still missing |
| Kan websites | Listing pages render empty; curl got 403 | Kan items were found one at a time through search |
| IMDb, Amazon, Yale and UMD archives, Israel Hayom, ishim.co.il, Maariv, the New York Times, TVNetil, the Washington Post | 403, WAF challenges, 5xx or dead hosts | Facts from these come from snippets, other copies or not at all |
| Facebook video pages | Pages show only a generic title without login | Kan Archive posts were read with yt-dlp metadata; the JCC Association post's title comes from its URL slug and a search result |
| Hoptv on Vimeo | No public listing | Hop! videos are reachable only through Hop! pages |
| Wayback CDX | Intermittent 502-504 | Retried; key queries succeeded |

## Removed, private and dead copies

- 199 untitled entries in classic Rechov Sumsum playlists were checked with oEmbed: 176 are removed and 23 are private. None is in the catalog. Most sit in OldTVIsrael's playlist "רחוב סומסום - מבחר פרקים" (69) and Jordan Elpern-Waxman's "Rechov Sumsum" playlist (81), which points to a large set of classic uploads that are no longer public. No titles are known.
- Hop!'s 141 YouTube playlists have 659 private or unavailable entries without titles.
- The YouTube user archionir2, credited by the archive.org original-series item, returns 404. The PumpkinSeedCandySalesman246 channel is gone and survives only as its archive.org backup.
- 45 candidates were dropped as removed, private or sign-in only, including two oEmbed 404s found before classification.
- Hop! has removed SUM_2009_e6 (a Keren Leibovitch guest segment), SUM_2006_e16 (the Uri documentary, which survives on YouTube), SUM_speical_e54, SUM_m27 and the 2012 story "אלמו לומד לנצח בכבוד".
- Hop!'s 2003 Sippuray Sumsum streams (mms:// addresses) and its 2014-2016 Brightcove account are dead. The archived pages give metadata but no playable links.

## Exclusions

658 batch decisions plus 2 earlier removals. The grouping below is by keyword and approximate.

| Reason | Count |
| --- | ---: |
| Other Sesame productions or foreign dubs | 322 |
| Fan-made or parody | 102 |
| Other | 89 |
| Interviews, events, news | 49 |
| Removed, private or sign-in only | 43 |
| Derivative or alternate copies | 22 |
| A separate programme | 20 |
| Station continuity or sponsorship | 10 |
| Duplicate | 1 |

The channel sweep's relevance filter dropped a further 25,240 Sesame-titled uploads before they became candidates, almost all US or other-country Sesame Street material on collector channels. Hebrew dubs of US home videos and of later Sesame Workshop series were excluded as other productions. "We love you, Elmo" on Hop! is such a dub, but it was already in the catalog and stays there as a Hop! group.

## Hop! Vimeo links, 18 October

The sweep left the 49 new Hop! posts without Vimeo links. On 18 October an agent collected them at the user's request. It ran the Hop collector in a Zen Home tab, with the Proton extension on Israel, Tel Aviv and the Hop-only Include rule. All 234 manifest pages returned a Vimeo player link, with no region block, error or retry, and every link keeps its privacy hash. The 185 earlier links came back unchanged. Public Vimeo oEmbed metadata was then read for the 39 new videos; all 224 have metadata.

The 234 Hop! pages hold 224 distinct videos. Ten music posts are second listings of videos already catalogued, so the 49 posts add 39 videos. Four of those ten are linked to the same 2006 and 2009 episodes as their twins, as excerpts, and no episode's coverage changed. In the built library 251 Watch links now open vimeo.com, up from 202, and none is left on hop.co.il alone, down from 49. No new link was played. [hop.md](hop.md) has the details.

## What remains user-gated

These need the user, a browser session in Zen, an account, or a visit to an archive. Hop! pages added later no longer need the user: an agent may run the collector in Zen Home, as described in [TODO.md](../TODO.md).

- **Identifications that need viewing.** The order of original-series 19, 20, 41, 51 and 53 against archive.org S1E7, S1E52 and S1E64; which of S3E34 and S3E49 is 133 and which is 178; the original-series and co-production queues; the 17 Hop! 2009 story files; hop-5090 and hop-5104; the Shosha Goren uploads; the IMDb preview web-6b6a7cd601.
- **Completeness and playback.** Every whole candidate is metadata-checked only, apart from Word of the Day 2023 episode 2 (Hug), whose Vimeo link has a recorded playback start. None of the other 223 Hop!/Vimeo videos has been played.
- **Licensed services.** All twelve 2010 Shalom Sesame programmes are on hoopla, and most are on Apple TV or Prime Video. hoopla is free with a card from a participating public library, which you use to sign in to hoopla. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard; Westchester County cards work too (choose "Westchester Library System" in hoopla). New York Public Library and Brooklyn Public Library cards do not, by the user's observation on 2026-10-18. Each library allows only a few hoopla borrows a month. Apple TV and Prime Video sell or rent each programme. The library pages behind these facts, read on 2026-10-18, are listed with their findings in `data/licensed-services.json`. Which service to use is the user's decision.
- **Israeli VOD catalogues.** Reading them needs an Israeli connection. The project's Proton rule covers only hop.co.il, and widening it is not a routine workaround. That is the user's call.
- **NLI newspaper pages** need an ordinary browser session that can pass Cloudflare.
- **Archive requests.** The NLI's IETV programmes can be viewed only on library premises. Further leads are the Israel State Archives files גל-18680/8, גל-18680/9 and גל-15454/9, the Children's Television Workshop records at the University of Maryland (international programming files), the Kan archive, and the internal CTW and Sesame Workshop documents cited by Warshel.
- **Content-claim blocks** on two Shalom Sesame parts (yt-ncg_vcMXQBY and yt-nZAFB1zzstg). Where the blocks apply is not known.
