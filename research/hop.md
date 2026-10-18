# Hop video catalog research

Checked on October 17, 2026. This inventory uses Hop's own website and public WordPress REST API.

## Inventory

On October 17, [data/hop-records.json](../data/hop-records.json) contained 185 distinct Hop video posts: 171 modern Rechov Sumsum records and all 14 entries listed in the separate Israeli Elmo talk show collection. It now has 234 records, 220 modern and 14 Elmo, after the October 2026 additions below. Every record links to its actual Hop page and its individual public metadata endpoint. The list contains no guessed Vimeo IDs.

The [Rechov Sumsum collection](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) lists 17 subject and series groups. These include 2009 and 2012 Rechov Sumsum, Discovering Curiosity, both Word of the Day series, songs, road safety, months of the year, recycling, and health. Hop describes this collection as recent series about social relationships, diversity, cooperation, and understanding others. This establishes that it belongs under modern Rechov Sumsum, rather than the original educational television production.

The separate [Elmo talk show collection](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/) lists 14 guests. The Israeli program's title is תכנית האירוח של אלמו. Hop's [Nof Atamna episode metadata](https://hop.co.il/wp-json/wp/v2/shows/10136) identifies Elmo and Moishe Oofnik as the hosts and describes the guest's science and cooking discussion. This is the requested Israeli talk show, rather than the Hebrew dub called המופע של אלמו.

The [public category endpoint](https://hop.co.il/wp-json/wp/v2/shows-category?parent=60&per_page=100&_fields=id,count,name,parent,link) enumerates all 17 child categories. The [video API query, first page](https://hop.co.il/wp-json/wp/v2/shows?shows-category=60,337,319,336,326,327,325,324,323,322,321,329,335,370,320,318,328,367,180&per_page=100&page=1&_fields=id,link,title,content,shows-category,featured_media,modified) and [second page](https://hop.co.il/wp-json/wp/v2/shows?shows-category=60,337,319,336,326,327,325,324,323,322,321,329,335,370,320,318,328,367,180&per_page=100&page=2&_fields=id,link,title,content,shows-category,featured_media,modified) return 185 records. The response headers report `X-WP-Total: 185` and two pages.

Five posts appear under the main Rechov Sumsum category but do not appear in the main collection's video tiles. The API found them too: [Elmo gets a puppy](https://hop.co.il/wp-json/wp/v2/shows/10066), [Have you done something good today?](https://hop.co.il/wp-json/wp/v2/shows/10063), [Lia: For the flowers](https://hop.co.il/wp-json/wp/v2/shows/5109), [Environment week](https://hop.co.il/wp-json/wp/v2/shows/5111), and [Warming the nose](https://hop.co.il/wp-json/wp/v2/shows/5096).

## Metadata and classification

Hebrew titles, page URLs, category names, and descriptions come from Hop. English titles are editorial translations or transliterations, not official English release titles. Episode numbers and most thumbnail URLs come from the collection tiles. The five additional posts use their featured media URLs from Hop's public media API. Missing durations remain null.

The `themes` and `characters` arrays reflect explicit words in a record's official title, description, or group. They are useful filters, but they do not establish a complete cast or synopsis. An untagged record may still contain a character or subject that Hop did not name. No Hanukkah tag was added simply because a record covers Kislev.

Hop uses the word פרק for short segments as well as series installments. The first inventory marked the 2009 and 2012 narrative installments, Elmo talk show, and puppy special as `unverified`, because complete program status was not established. The 2009 story files and one short 2012 file were later reclassified as clips (see the October 2026 section). Songs, word segments, interviews with children, and other short format series are clips. The fifty year song compilation is a collection. Playback length has not been checked. In that first inventory there were 47 records with unverified format, 137 clips, and one collection, and no Hop record was in the verified full episode filter. Later changes to these counts are described below.

The Hebrew title for record 9747 is irregular on Hop, מיי בית החולים. Its English title, "Mom in the hospital", follows the [official description](https://hop.co.il/wp-json/wp/v2/shows/9747), which says Elmo's mother is in hospital.

## Regional access and Vimeo

The [Hug video page](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D-%D7%9E%D7%99%D7%9C%D7%AA-%D7%94%D7%99%D7%95%D7%9D/%D7%A2%D7%95%D7%A0%D7%94-1%D7%97%D7%91%D7%95%D7%A7/) and [Melech Zilberschlag episode](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/1-%D7%A2%D7%95%D7%A0%D7%94%D7%9E%D7%9C%D7%9A-%D7%96%D7%99%D7%9C%D7%91%D7%A8%D7%A9%D7%9C%D7%92/) return an English regional unavailability notice from the present non-Israeli connection. The fetched Hug HTML includes Vimeo's player API script, but the video iframe itself is absent. The public video metadata has an empty `acf` array and supplies no Vimeo link.

This confirms Hop's regional gate on the tested pages. The initial public-page investigation did not verify whether the underlying Vimeo videos play outside Israel. The initial metadata inventory left every `directUrl` null until an actual official player URL could be discovered from a permitted connection. Once that is done, the complete unlisted Vimeo URL, including any privacy hash, should be retained and tested with the VPN off. A numeric Vimeo ID alone may not be sufficient.

This is complete for the specific Hop category query at retrieval time. It is not a claim that every video ever produced, broadcast, or published elsewhere has been found.

[data/hop-url-manifest.json](../data/hop-url-manifest.json) contains the stable catalog IDs, Hop post IDs, and Hop source URLs for the browser collector. It held these 185 pages until October 18, 2026, when the 49 posts described under "October 2026 additions" were appended, for 234 in all.

The [public oEmbed response for Hug](https://hop.co.il/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fhop.co.il%2F%3Fp%3D8864) supplies a WordPress article embed and thumbnail, without a Vimeo player URL. The [REST API index](https://hop.co.il/wp-json/) advertises no separate video or ACF player metadata route. Neither public endpoint resolved the missing direct URLs.

## Browser collector

[scripts/collect-hop-links.js](../scripts/collect-hop-links.js) embeds all 234 official Hop URLs: the 185 original pages and the 49 appended on October 18. It was run on October 17 for the 185 pages and on October 18 for all 234 (see "Vimeo links for all 234 pages" below). Run it only on a Hop page after connecting that browser to Israel. It reads pages sequentially with a 200 millisecond pause, retries a failed request once when appropriate, and downloads only a JSON report. It records blocked pages and errors and preserves each complete Vimeo iframe URL, including an `h` privacy parameter. A corresponding Vimeo watch URL retains that hash in the path. The collector does not fetch video media or establish that Vimeo playback works outside Israel.

## Official Hop videos on YouTube

The [Rechov Sumsum channel](https://www.youtube.com/@rehovsumsum) describes itself as presented by Hop. Its [Videos tab](https://www.youtube.com/@rehovsumsum/videos) returned 22 publicly listed videos. Its [Playlists tab](https://www.youtube.com/@rehovsumsum/playlists) lists nine playlists, including [the Israeli Elmo talk show](https://www.youtube.com/playlist?list=PLZmhDCZt0d9ZLINL-lqu54FhWVnfPTyQl), [full episodes](https://www.youtube.com/playlist?list=PLZmhDCZt0d9ZJrRk1IXupzomu3o-pm0Gv), songs, short clips, guests, curiosity, friends, children's stories, and strong women.

Deduplicating the channel and readable playlist entries produced 52 titled video records from the official Rechov Sumsum channel and the official Hop channel. Those records are in [data/hop-youtube-records.json](../data/hop-youtube-records.json). The playlists also contain 33 untitled unavailable entries. Those have been excluded, since a video ID alone cannot establish the requested title, content, or availability.

Eight [Word of the Day videos](https://www.youtube.com/watch?v=jricljQkc3o) explicitly say פרקים מלאים in their official titles. Those are classified as full episodes of that short format series, with listed lengths around six minutes. Other narrative videos and talk show installments retain `unverified` format when complete program status is not explicit. A [47 minute compilation](https://www.youtube.com/watch?v=17GXHUTNMw4) identifies itself as all Word of the Day episodes in a row.

A public YouTube listing does not establish that the video plays outside Israel. Cookie-free player metadata checks for [Idan Raichel's talk show appearance](https://www.youtube.com/watch?v=riiXudhGPIk), [Hug](https://www.youtube.com/watch?v=jricljQkc3o), and [the reflection video](https://www.youtube.com/watch?v=2-J8pvV-pac) returned explicit country restrictions from the current non-Israeli connection. These cannot be offered as VPN-free alternatives on that evidence. Additional access checks are recorded on each catalog record. No video media was downloaded.

All 52 official YouTube records received cookie-free player metadata checks from the current connection. Twenty-nine returned explicit country restrictions. Twenty-three returned the generic message "This video is not available". The generic error does not identify permanent deletion or its cause. None returned usable playback format metadata in these checks. The data therefore marks 29 as `vpn-required` and 23 as `unavailable`, with the precise result recorded per item. Public listing metadata, including title and duration, remains independently available.

## Vimeo metadata enrichment and the Hug playback start

The main setup task subsequently connected the browser VPN to Israel for Hop and discovered the [Hug Vimeo page](https://vimeo.com/916707529/6cdb440a7c). It observed the Hop player and then playback startup on this direct Vimeo URL (to 00:14 of 06:14) while Vimeo was outside the Hop-only tunnel. That is a recorded playback start, not a complete playback review, and one tested example rather than proof that all Vimeo links share the same availability.

The [public Vimeo oEmbed response for that exact privacy URL](https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F916707529%2F6cdb440a7c) identifies the uploader as Hoptv and supplies a running time of 374 seconds. The metadata request works outside the browser VPN. The complete privacy hash remains part of the catalog URL.

[scripts/enrich-vimeo.py](../scripts/enrich-vimeo.py) reads the actual Hop collector report and fetches public Vimeo metadata with three concurrent requests, retries, and a cache. It saves metadata separately in `data/vimeo-metadata.json`, avoiding duplicate catalog records. The catalog receives verified running times, the original Vimeo title in `titleVimeo`, thumbnails, and source provenance. Metadata lookup alone does not verify playback, and the script preserves existing playback and access fields.

The script can promote the eight Word of the Day 2023 records to full episodes only when both the Hebrew title and episode number match an official YouTube title explicitly labelled as full. It does not classify other records by a duration threshold.

The first collector report, completed on October 17, contains 185 processed Hop pages, 185 exact Vimeo privacy URLs, and zero collection errors. Enrichment successfully retrieved public oEmbed metadata for all 185 URLs, with no missing durations or failed metadata requests. Every response identifies the uploader as Hoptv. The running times range from 50 seconds to 26 minutes 17 seconds, with a median of 3 minutes 12 seconds. Sixty-five videos run under two minutes, 44 run from two to under five minutes, 54 from five to under ten, 20 from ten to under twenty, and two run at least twenty minutes. Those counts describe durations, not verified full episode status.

The eight Word of the Day 2023 entries now have `kind: episode` based on corresponding official full-episode titles. All other format decisions remained unchanged. On October 17 the Hop dataset contained eight explicitly supported episodes, 129 clips, 47 records with unverified complete program status, and one song compilation. The puppy special runs 26 minutes, but its complete program status remains unverified.

## October 2026 additions

The sweep of 17-18 October paged Hop!'s whole public API. Every post in the original 185-page manifest is still live. 49 Rechov Sumsum posts sat outside the manifest's categories and were added to `data/hop-records.json`, at first without Vimeo links: six resilience posts in "המרחב המוגן של הופ!" with no show category, 42 posts of the separate `music` post type at `/music/` paths, and one Tu BiShvat special. Ten more posts are Hebrew dubs of later Sesame Workshop series ("אלמו וטנגו", "חבובוטים") and were not catalogued.

Their ids, Hop post ids and URLs were appended on October 18 to `data/hop-url-manifest.json` and to the manifest embedded in `scripts/collect-hop-links.js`, in the same order, so both list 234 pages. The collector checks only the host, so `/music/` pages are in scope. On October 18 they turned out to carry the same player markup as the show pages. "Vimeo links for all 234 pages" below describes their links.

Hop!'s official YouTube channel was also enumerated in full, including all 141 playlists. That surfaced 146 Sesame uploads, many unlisted, among them copies of all 14 Elmo talk-show guests and the 8 Word of the Day 2023 installments. The catalog now holds 151 records from ערוץ הופ!: 2 from the first inventory (in hop-youtube-records.json) and 149 added by the sweep, 144 of them from that enumeration and 5 Elmo talk-show promos from the general channel sweep. For the 149 sweep records, every per-video playability check from outside Israel failed: 110 country restrictions, 34 "This video is not available", 4 bot checks and 1 unspecified restriction ("The uploader has not made this video available"). The 35 generic or unspecified failures are recorded as unavailable in that check and the 110 restrictions as country-restricted. The yt-dlp metadata requests still returned an upload date and a duration for all 149, and a description for 58; playback is untested.

The records now count 8 episodes, 183 clips, 41 unverified and 2 collections. Of the original 185 records, 8 are episodes, 136 clips, 40 unverified and 1 a collection. The 11 Discovering Curiosity narrative stories moved from clip to unverified, because they are whole-programme candidates in the episode guide. The seventeen 2009 story files (hop-5130 to hop-5146) and the 95-second 2012 file hop-5082 moved from unverified to clip, because they are segments, not whole-programme candidates; the 2009 files still wait in the guide's 2009 queue for their episodes. The 49 new posts are 47 clips, 1 unverified record and 1 collection.

Three readings in this note have changed:

- The web numbers on 2012 and Discovering Curiosity stories follow Hebrew alphabetical order, and the 2009 numbers follow the old site's order. None is a broadcast number. The 2012 broadcast order for episodes 1-10 comes from Hop!'s DVD set.
- The 2009 story files are segments of unidentified episodes, not candidates for whole episodes. Twelve 2012 stories and eleven Discovering Curiosity stories, including "לחמם את האף" (post 5096), are whole-programme candidates in the episode guide.
- The untitled YouTube talk-show upload is Guri Alfi; its thumbnail file is byte-identical to the named copy on ערוץ הופ!.

[episode-totals-hop.md](episode-totals-hop.md) has the season totals and the evidence for each change.

## Vimeo links for all 234 pages

On October 18, 2026 an agent ran the collector in a Zen Home tab at the user's request, driving Zen through macOS accessibility automation. The Proton extension was found disconnected. It was connected to Israel, Tel Aviv (server IL#751) from Recents, and split tunneling was confirmed on, in Include mode, with only `hop.co.il` and all its subdomains. [vpn-setup.md](vpn-setup.md) records the connection. The report completed at 2026-10-18T14:14:10.958Z and was copied out of the browser console.

All 234 manifest pages returned `player-link-found`, with no region block, no error and no retry. Every `directUrl` keeps its privacy hash. The 185 earlier rows were read again with identical URLs and kept verbatim. Each now carries the first run's `collectedAt` (2026-10-17T18:39:56.236Z) and a `recheckedAt` and `recheckStatus` from the second run. The 49 new rows were added. A `collections` array in [data/hop-player-links.json](../data/hop-player-links.json) describes both runs.

The 234 pages hold 224 distinct Vimeo videos. Ten music posts embed the same video as a catalogued show post: hop-9857 and hop-5113, hop-9860 and hop-5112, hop-9862 and hop-5110, hop-9865 and hop-5114, hop-9867 and hop-5115, hop-9869 and hop-5162, hop-9872 and hop-5164, hop-9874 and hop-5168, hop-9876 and hop-5165, and hop-9878 and hop-5169. Each pair is one video listed on two Hop pages, so the 49 posts add 39 videos. Three same-title pairs are different videos: hop-6848 and hop-5116, hop-6963 and hop-5117, and hop-6960 and hop-6961. This comparison replaces the earlier estimate that about 15 music posts repeat show posts.

Four of the repeats are linked in the episode guide like their twins, as excerpts: hop-9860 to 2009 episode 1, hop-9857 to 2009 episode 2, hop-9865 to 2009 episode 4 and hop-9867 to 2006 episode 15. Those episodes stay excerpt-only. The builder now warns that 10 videos are linked by more than one record. The warning lists these ten pairs and is intended.

`scripts/enrich-vimeo.py` made 39 new oEmbed lookups. All 224 videos now have metadata, and every response names Hoptv as the uploader. The 49 new records run 0:53 to 26:17. The longest is the song compilation hop-9862, 1,577 seconds, which is the same video as hop-5110. Of the 39 new videos, 20 run under two minutes, 18 from two to under five, and one runs 6:52: the Tu BiShvat special hop-10133 "מעבדה – אביגיל שואלת איך ולמה". It stays `unverified`, because a running time alone does not establish a whole programme. Across all 224 videos, running times range from 50 seconds to 26 minutes 17 seconds, with a median of 2 minutes 34 seconds. Of those videos, 85 run under two minutes, 62 from two to under five, 55 from five to under ten, 20 from ten to under twenty and 2 at least twenty.

The builder now integrates 234 exact Vimeo URLs. In the built library 251 Watch links open vimeo.com, up from 202, and no record is left with only a hop.co.il Watch link, down from 49.

No new link was played. The Hug video is still the only Hop video with a recorded playback start. These pages were read only through the Israeli connection, so their behaviour outside Israel was not checked. [TODO.md](../TODO.md) keeps the playback task open and the collection steps for pages added later.
