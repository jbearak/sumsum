# Hop video catalog research

Checked on October 17, 2026. This inventory uses Hop's own website and public WordPress REST API.

## Inventory

[data/hop-records.json](../data/hop-records.json) contains 185 distinct Hop video posts. It includes 171 modern Rechov Sumsum records and all 14 entries listed in the separate Israeli Elmo talk show collection. Every record links to its actual Hop page and its individual public metadata endpoint. The list contains no guessed Vimeo IDs.

The [Rechov Sumsum collection](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) lists 17 subject and series groups. These include 2009 and 2012 Rechov Sumsum, Discovering Curiosity, both Word of the Day series, songs, road safety, months of the year, recycling, and health. Hop describes this collection as recent series about social relationships, diversity, cooperation, and understanding others. This establishes that it belongs under modern Rechov Sumsum, rather than the original educational television production.

The separate [Elmo talk show collection](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/) lists 14 guests. The Israeli program's title is תכנית האירוח של אלמו. Hop's [Nof Atamna episode metadata](https://hop.co.il/wp-json/wp/v2/shows/10136) identifies Elmo and Moishe Ofnik as the hosts and describes the guest's science and cooking discussion. This is the requested Israeli talk show, rather than the Hebrew dub called המופע של אלמו.

The [public category endpoint](https://hop.co.il/wp-json/wp/v2/shows-category?parent=60&per_page=100&_fields=id,count,name,parent,link) enumerates all 17 child categories. The [video API query, first page](https://hop.co.il/wp-json/wp/v2/shows?shows-category=60,337,319,336,326,327,325,324,323,322,321,329,335,370,320,318,328,367,180&per_page=100&page=1&_fields=id,link,title,content,shows-category,featured_media,modified) and [second page](https://hop.co.il/wp-json/wp/v2/shows?shows-category=60,337,319,336,326,327,325,324,323,322,321,329,335,370,320,318,328,367,180&per_page=100&page=2&_fields=id,link,title,content,shows-category,featured_media,modified) return 185 records. The response headers report `X-WP-Total: 185` and two pages.

Five posts appear under the main Rechov Sumsum category but do not appear in the main collection's video tiles. The API found them too: [Elmo gets a puppy](https://hop.co.il/wp-json/wp/v2/shows/10066), [Have you done something good today?](https://hop.co.il/wp-json/wp/v2/shows/10063), [Lia: For the flowers](https://hop.co.il/wp-json/wp/v2/shows/5109), [Environment week](https://hop.co.il/wp-json/wp/v2/shows/5111), and [Warming the nose](https://hop.co.il/wp-json/wp/v2/shows/5096).

## Metadata and classification

Hebrew titles, page URLs, category names, and descriptions come from Hop. English titles are editorial translations or transliterations, not official English release titles. Episode numbers and most thumbnail URLs come from the collection tiles. The five additional posts use their featured media URLs from Hop's public media API. Missing durations remain null.

The `themes` and `characters` arrays reflect explicit words in a record's official title, description, or group. They are useful filters, but they do not establish a complete cast or synopsis. An untagged record may still contain a character or subject that Hop did not name. No Hanukkah tag was added simply because a record covers Kislev.

Hop uses the word פרק for short segments as well as series installments. The catalog marks the 2009 and 2012 narrative installments, Elmo talk show, and puppy special as `unverified`, because complete program status is not established. Songs, word segments, interviews with children, and other short format series are clips. The fifty year song compilation is a collection. Playback length has not been checked. There are 47 records with unverified format, 137 clips, and one collection. No Hop record is included in the verified full episode filter.

The Hebrew title for record 9747 is irregular on Hop, מיי בית החולים. Its English title, "Mom in the hospital", follows the [official description](https://hop.co.il/wp-json/wp/v2/shows/9747), which says Elmo's mother is in hospital.

## Regional access and Vimeo

The [Hug video page](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D-%D7%9E%D7%99%D7%9C%D7%AA-%D7%94%D7%99%D7%95%D7%9D/%D7%A2%D7%95%D7%A0%D7%94-1%D7%97%D7%91%D7%95%D7%A7/) and [Melech Zilberschlag episode](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/1-%D7%A2%D7%95%D7%A0%D7%94%D7%9E%D7%9C%D7%9A-%D7%96%D7%99%D7%9C%D7%91%D7%A8%D7%A9%D7%9C%D7%92/) return an English regional unavailability notice from the present non-Israeli connection. The fetched Hug HTML includes Vimeo's player API script, but the video iframe itself is absent. The public video metadata has an empty `acf` array and supplies no Vimeo link.

This confirms Hop's regional gate on the tested pages. The initial public-page investigation did not verify whether the underlying Vimeo videos play outside Israel. The initial metadata inventory left every `directUrl` null until an actual official player URL could be discovered from a permitted connection. Once that is done, the complete unlisted Vimeo URL, including any privacy hash, should be retained and tested with the VPN off. A numeric Vimeo ID alone may not be sufficient.

This is complete for the specific Hop category query at retrieval time. It is not a claim that every video ever produced, broadcast, or published elsewhere has been found.

[data/hop-url-manifest.json](../data/hop-url-manifest.json) contains the stable catalog IDs, Hop post IDs, and all 185 Hop source URLs for a later browser collector.

The [public oEmbed response for Hug](https://hop.co.il/wp-json/oembed/1.0/embed?url=https%3A%2F%2Fhop.co.il%2F%3Fp%3D8864) supplies a WordPress article embed and thumbnail, without a Vimeo player URL. The [REST API index](https://hop.co.il/wp-json/) advertises no separate video or ACF player metadata route. Neither public endpoint resolved the missing direct URLs.

## Browser collector

[scripts/collect-hop-links.js](../scripts/collect-hop-links.js) embeds all 185 official Hop URLs. Run it only on a Hop page after connecting that browser to Israel. It reads pages sequentially with a 200 millisecond pause, retries a failed request once when appropriate, and downloads only a JSON report. It records blocked pages and errors and preserves each complete Vimeo iframe URL, including an `h` privacy parameter. A corresponding Vimeo watch URL retains that hash in the path. The collector does not fetch video media or establish that Vimeo playback works outside Israel.

## Official Hop videos on YouTube

The [Rechov Sumsum channel](https://www.youtube.com/@rehovsumsum) describes itself as presented by Hop. Its [Videos tab](https://www.youtube.com/@rehovsumsum/videos) returned 22 publicly listed videos. Its [Playlists tab](https://www.youtube.com/@rehovsumsum/playlists) lists nine playlists, including [the Israeli Elmo talk show](https://www.youtube.com/playlist?list=PLZmhDCZt0d9ZLINL-lqu54FhWVnfPTyQl), [full episodes](https://www.youtube.com/playlist?list=PLZmhDCZt0d9ZJrRk1IXupzomu3o-pm0Gv), songs, short clips, guests, curiosity, friends, children's stories, and strong women.

Deduplicating the channel and readable playlist entries produced 52 titled video records from the official Rechov Sumsum channel and the official Hop channel. Those records are in [data/hop-youtube-records.json](../data/hop-youtube-records.json). The playlists also contain 33 untitled unavailable entries. Those have been excluded, since a video ID alone cannot establish the requested title, content, or availability.

Eight [Word of the Day videos](https://www.youtube.com/watch?v=jricljQkc3o) explicitly say פרקים מלאים in their official titles. Those are classified as full episodes of that short format series, with listed lengths around six minutes. Other narrative videos and talk show installments retain `unverified` format when complete program status is not explicit. A [47 minute compilation](https://www.youtube.com/watch?v=17GXHUTNMw4) identifies itself as all Word of the Day episodes in a row.

A public YouTube listing does not establish that the video plays outside Israel. Cookie-free player metadata checks for [Idan Raichel's talk show appearance](https://www.youtube.com/watch?v=riiXudhGPIk), [Hug](https://www.youtube.com/watch?v=jricljQkc3o), and [the reflection video](https://www.youtube.com/watch?v=2-J8pvV-pac) returned explicit country restrictions from the current non-Israeli connection. These cannot be offered as VPN-free alternatives on that evidence. Additional access checks are recorded on each catalog record. No video media was downloaded.

All 52 official YouTube records received cookie-free player metadata checks from the current connection. Twenty-nine returned explicit country restrictions. Twenty-three returned the generic message "This video is not available". The generic error does not identify permanent deletion or its cause. None returned usable playback format metadata in these checks. The data therefore marks 29 as `vpn-required` and 23 as `unavailable`, with the precise result recorded per item. Public listing metadata, including title and duration, remains independently available.

## Vimeo metadata enrichment and the verified Hug example

The main setup task subsequently connected the browser VPN to Israel for Hop and discovered the [Hug Vimeo page](https://vimeo.com/916707529/6cdb440a7c). It verified the Hop player and then playback of this direct Vimeo URL while Vimeo was outside the Hop-only tunnel. This is one tested example, rather than proof that all Vimeo links share the same availability.

The [public Vimeo oEmbed response for that exact privacy URL](https://vimeo.com/api/oembed.json?url=https%3A%2F%2Fvimeo.com%2F916707529%2F6cdb440a7c) identifies the uploader as Hoptv and supplies a running time of 374 seconds. The metadata request works outside the browser VPN. The complete privacy hash remains part of the catalog URL.

[scripts/enrich-vimeo.py](../scripts/enrich-vimeo.py) reads the actual Hop collector report and fetches public Vimeo metadata with three concurrent requests, retries, and a cache. It saves metadata separately in `data/vimeo-metadata.json`, avoiding duplicate catalog records. The catalog receives verified running times, the original Vimeo title in `titleVimeo`, thumbnails, and source provenance. Metadata lookup alone does not verify playback, and the script preserves existing playback and access fields.

The script can promote the eight Word of the Day 2023 records to full episodes only when both the Hebrew title and episode number match an official YouTube title explicitly labelled as full. It does not classify other records by a duration threshold.

The completed collector report contains 185 processed Hop pages, 185 exact Vimeo privacy URLs, and zero collection errors. Enrichment successfully retrieved public oEmbed metadata for all 185 URLs, with no missing durations or failed metadata requests. Every response identifies the uploader as Hoptv. The running times range from 50 seconds to 26 minutes 17 seconds, with a median of 3 minutes 12 seconds. Sixty-five videos run under two minutes, 44 run from two to under five minutes, 54 from five to under ten, 20 from ten to under twenty, and two run at least twenty minutes. Those counts describe durations, not verified full episode status.

The eight Word of the Day 2023 entries now have `kind: episode` based on corresponding official full-episode titles. All other format decisions remain unchanged. The Hop dataset contains eight explicitly supported episodes, 129 clips, 47 records with unverified complete program status, and one song compilation. The puppy special runs 26 minutes, but its complete program status remains unverified.
