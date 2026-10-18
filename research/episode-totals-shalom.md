# Shalom Sesame episode totals and linked coverage

First audited 2026-10-17 against commit `011a072`; updated 2026-10-18 with the October acquisition sweep. The mapping, exact catalog ids, URLs, runtimes and counts are in [shalom-episode-audit.json](../data/shalom-episode-audit.json), schema 2, and the episodes are in [episode-guide.json](../data/episode-guide.json) as productions `shalom-classic` and `shalom-2010`. No media was downloaded and no programme was watched.

## What the totals mean

The classic series has **11 programmes**. UMass Amherst lists eleven titles with consecutive call numbers CH256 to CH266, and the Manitoba library catalog independently numbers the first five. [UMass inventory](https://www.umass.edu/langctr/jhweb.html), [Manitoba catalog, series index on PDF page 178](https://files.eric.ed.gov/fulltext/ED377837.pdf#page=178).

The 2010 series has **12 programmes**, numbered #1 to #12. The archived [Sesame Street store](https://web.archive.org/web/2012/http://store.sesamestreet.org/Product.aspx?cp=21415_21456_21463&pc=6EAM0976) sold them as "Shalom Sesame 2010 #1" to "#12", items 6EAM0976 to 6EAM0988 with 6EAM0978 unused, and called it "a brand new series of 12 episodes". The official site said "twelve half-hour episodes on DVD" ([archived 2010](https://web.archive.org/web/20101207092056/http://www.shalomsesame.org/about.html)) and listed the twelve titles ([archived 2012](https://web.archive.org/web/20120912052326/http://www.shalomsesame.org:80/about/dvd)). The licensed [hoopla season](https://www.hoopladigital.com/television/shalom-sesame-season-2/11516275) has episodes 1 to 12 in the same order and calls it "Season 2". [Israel Book Shop](https://www.israelbookshop.com/products/shalom-sesame-series-for-schools-set-of-12-dvd) and [URJ](https://urj.org/press-room/reformjudaismorg-partners-shalom-sesame-offer-engaging-jewish-content-kids) agree on twelve.

| Count | Classic | 2010 |
| --- | ---: | ---: |
| Programmes | 11 | 12 |
| Programmes with a whole candidate in the guide | 11 | 12 |
| Programmes with a free whole upload | 11 | 1 |
| Programmes whose whole candidates are licensed listings only | 0 | 11 |
| Programmes with every labelled part linked | 10 | 2 |
| Whole-candidate links in the guide | 31 | 31 |
| Programmes checked from start to credits | 0 | 0 |

A licensed listing is a hoopla, Apple TV or Prime Video page for the whole programme. hoopla is free with a card from a participating public library: you sign in to hoopla with the card, within that library's monthly limit. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard (age 12 or older); Westchester County library cards work too, by choosing "Westchester Library System" in hoopla. New York Public Library and Brooklyn Public Library cards do not, by the user's observation on 2026-10-18. Apple TV and Prime Video sell or rent each programme with an account. `data/licensed-services.json` records these facts with their sources and check dates. A licensed listing is a link to a whole programme, so the guide counts it as a whole candidate, but it is not a free upload and not evidence that the programme plays. The records carry access `licensed`. KET's page for programme 2 is different: the Kentucky PBS member network streams it free to viewers in its broadcast area after a browser location check, and to its donors anywhere in the United States. It is not a licensed listing; its availability check records the location requirement (`region-limited`), and the guide links it as an alternate edition.

## Classic checklist

The table gives the original production wave. The first five years and runtimes come from the government library catalog. The 1990 wave and Passover 1991 are provisional. Arizona library records confirm Aleph-Bet Telethon and Kids Sing Israel as 1991. [Manitoba catalog](https://files.eric.ed.gov/fulltext/ED377837.pdf), [Aleph-Bet record](https://cmeslibrary.sbs.arizona.edu/video/aleph-bet-telethon-discovering-hebrew-letters), [Kids Sing Israel record](https://cmeslibrary.sbs.arizona.edu/index.php/video/kids-sing-israel-grouches-dont), [wave chronology](https://en.wikipedia.org/w/index.php?title=Shalom_Sesame&oldid=1371814228). The media guide gives nominal runtimes of 30 minutes for programmes 1-8 and 40 for 9-11 ([PDF pages 33-34](https://cdn.fedweb.org/71/165/Alpha%2520Listing%2520Media%2520Guide.pdf#page=34)).

| No. | Programme | Year | Whole candidates | Split upload |
| ---: | --- | --- | --- | --- |
| 1 | The Land of Israel | 1986 | yt-XCsTpvlCBa8 32:42; new: yt-m5xLLZreMkw 32:32 | All 3 parts |
| 2 | Tel Aviv | 1986 | yt-Pvb-ziyleaA 32:11 | All 2 parts |
| 3 | Kibbutz | 1986 | yt-FxoTj7jZKuk 32:34, yt-OCiyjivPMA8 29:29 | All 3 parts |
| 4 | The People of Israel | 1986 | yt-dkW2lNq4Ul4 31:26; new: yt-yDhr_XU14Vg 32:34 | All 3 parts |
| 5 | Jerusalem | 1986 | yt-VNjR-rAVPPs 31:24; new: yt-5MT4uSuJmfI 29:13, yt-tazuHX_gpcg 31:13, an archive.org DVD rip 30:00 | All 3 parts |
| 6 | Chanukah | 1990, provisional | yt-cZ1TVctGUpw 32:47; new: four YouTube copies and an archive.org DVD rip, 31:58 to 32:59 | All 3 parts |
| 7 | Sing Around the Seasons | 1990, provisional | yt-UKO0HdFDQ0A 35:21, yt-WbxNshR-8kU 34:12; new: yt-mqS8t5H83d8 33:41 | None |
| 8 | Journey to Secret Places | 1990, provisional | yt-eAa0TLqIZ1Q 29:17 | All 2 parts |
| 9 | Aleph-Bet Telethon | 1991 | yt-aCe9MfpAtqk 37:44, yt-trl8wZ4zDIA 38:21; new: yt-Vy4SWYI8h5Y 37:52, an archive.org VHS copy 37:43 | All 3 parts, part 1 new |
| 10 | Passover | 1991, provisional | yt-gtlmeDpjmq4 36:51, yt-hjf2sFySZMc 36:09; new: yt-AgTb97ZmJuA 37:32 | All 3 parts |
| 11 | Kids Sing Israel | 1991 | yt-aSIbH-uLfo8 39:31; new: yt-dQJtsp8Tnjg 38:23, an archive.org VHS copy 38:53 | All 3 parts |

Some copies are alternate editions rather than extra candidates. dayingale's uploads of programmes 1-3 are labelled "דובר אנגלית ומתורגם לעברית", English with Hebrew subtitles. Two shorter editions are still flagged: Tel Aviv yt-Zdrzz3ozH7o at 25:08, labelled "עונה 2 פרק 2 ... 1990" by Dinostalgic 90', and Aleph-Bet Telethon yt-Yo365rmez08 at 29:26. A Russian dub of Passover on archive.org is filed as "רחוב סומסום - עונה 5 פרק 17 - פסח". Labels like that are why community "season 4-5" Rechov Sumsum uploads turn out to be Shalom Sesame; the original Israeli series had three seasons.

An archive.org VHS compilation of shows 1-5 (2:37:10) is linked to each of those programmes as an excerpt. Its programme boundaries were not checked.

Part 1 of the nostalgiateenable Aleph-Bet Telethon set turned up as yt-nZAFB1zzstg, so all three parts are now linked. A cookie-free metadata request from a non-Israeli connection on 18 October reported a content-claim block by Global Media Egypt. Where that block applies is not established.

## 2010 checklist

Runtimes are minute-rounded storefront figures. hoopla, Apple TV and Prime Video list most programmes at 25-29 minutes. Mitzvah on the Street and Be Happy, It's Purim! run 32-34 minutes, and Grover Learns Hebrew runs 23.

| No. | Programme | Licensed listings | Free whole or split copies |
| ---: | --- | --- | --- |
| 1 | Welcome to Israel | hoopla, Apple TV, Prime Video | Two-part set, both parts linked (15:00 + 12:39) |
| 2 | Chanukah: The Missing Menorah | hoopla, Apple TV, Prime Video (twice) | archive.org DVD rip, 27:38; two-part set (15:00 + 12:37); KET's location-gated PBS edition |
| 3 | Shabbat Shalom, Grover! | hoopla, Apple TV, Prime Video | None |
| 4 | Grover Plants a Tree | hoopla, Prime Video | None |
| 5 | Mitzvah on the Street | hoopla, Apple TV, Prime Video | None |
| 6 | Be Happy, It's Purim! | hoopla, Apple TV | None |
| 7 | It's Passover, Grover! | hoopla, Prime Video | None; a JCC Association Facebook video could not be read and is linked only as a possible copy |
| 8 | Grover Learns Hebrew | hoopla, Apple TV, Prime Video | None |
| 9 | Countdown to Shavuot | hoopla, Apple TV, Prime Video | None |
| 10 | The Sticky Shofar | hoopla | None |
| 11 | Monsters in the Sukkah | hoopla, Apple TV | None |
| 12 | Adventures in Israel | hoopla, Apple TV | None |

Two two-part sets now look complete on metadata. Welcome to Israel part 1 (yt-ncg_vcMXQBY, 15:00) turned up, and with part 2 it totals 27:39 against 27-28 minutes on the storefronts. A metadata request from a non-Israeli connection reported a content-claim block by Sesame Workshop on part 1. The Missing Menorah parts total 27:37; the official site's timed rundown lists 25:55 of segments before the closing and credits. Nobody has checked either set for gaps, overlaps at the part boundary or an ending.

The Missing Menorah DVD rip on archive.org is title 1 of a community disc image. The item does not name the series. The 2010 attribution comes from its 27:38 length, which matches the part set, and from twelve short titles on the disc that fit the 2010 DVDs' sneak peeks. KET's page is a PBS edition that is location-gated, and Muppet Wiki reports that PBS airings add a Matisyahu insert.

Trailers, sneak peeks and the official channel's studio stories are excerpts. The Sticky Shofar's official Parts I-III total only 6:36. They are a short studio-story sequence, not parts of the programme.

## Work still needed

- Review a classic candidate of each programme from start to credits, starting with the generic "episode 4" and "episode 5" titles.
- For the 2010 series, find free whole copies of the 11 programmes that have only licensed listings. All twelve are on hoopla, free with a Queens Public Library eCard anywhere in New York State or with a Westchester card; using hoopla, Apple TV or Prime Video is the user's decision.
- Check both 2010 two-part sets for continuity and an ending.
- Find out where the content-claim blocks on yt-ncg_vcMXQBY and yt-nZAFB1zzstg apply, recording the result per URL without changing VPN routing.
- Corroborate the provisional production years from distributor records, MARC records or title cards.

## Evidence limits

A whole candidate means the metadata supports the programme identity and the runtime fits. It does not certify an uncut master, current availability or rights. Licensed listings are links to services, not playback evidence. No Shalom Sesame programme has reached "complete-upload linked" in the audit.

Two source inconsistencies stay recorded. The media guide misprints Kids Sing Israel as number 1. The All Judaica retailer lists shows 1-11 in detail while its introduction says twelve programmes on six discs. The classic total follows the enumerated lists.
