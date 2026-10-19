# Episode coverage and acquisition checklist

Audited 2026-10-18 against [data/episode-guide.json](data/episode-guide.json): 14 productions, 386 episodes and 2,272 catalog records.

Each episode counts once, however many uploads, hosts, editions or numbered parts link to it. Productions stay separate: the original IETV series, the 1998 co-production, each modern season, the short series, the home-video tapes and the two Shalom Sesame series each have their own denominator.

A whole candidate is a programme-length link matched to the episode. Nobody has checked it from start to finish. A licensed listing also counts, because it links to the whole programme, but it is not a free upload. On hoopla it is free with a card from a participating public library: anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard and sign in to hoopla with it, and Westchester County cards work too. Apple TV and Prime Video sell or rent it. `data/licensed-services.json` has the steps, the libraries and their sources. "Parts only" means numbered parts or an incomplete file with no single whole link. "Excerpt only" means a clip, segment, trailer or tape edition. "Missing" means no link at all; a possible copy, one that is probably the episode but unresolved, does not change that.

Every linked episode is at evidence level metadata-checked, except Word of the Day 2023 episode 2, whose Vimeo link has a recorded playback start. No episode has had its complete playback reviewed or been compared with a reference edition. Whole candidate does not mean verified complete.

## Coverage by production

Core Rechov Sumsum:

| Production | Episodes made | Guide rows | Whole candidate | Parts only | Excerpt only | Missing | Awaiting identification |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original IETV series, 1983-87 | 198, [NLI catalogue](https://nli.alma.exlibrisgroup.com/view/sru/972NNL_INST?version=1.2&operation=searchRetrieve&query=alma.all_for_ui=%22%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D%22) | 198 | 183 | 3 | 0 | 12 | 15 |
| Co-production, Hebrew-dominant, 1998 | 70, NLI and [Cole et al.](https://journals.sagepub.com/doi/10.1080/01650250344000019) | 70 | 6 | 3 | 4 | 57 | 1 |
| Hop! revival, 2006 | 40, [Hop!'s 2007 page](https://web.archive.org/web/20071013054127/http://hop.co.il:80/sesameNew/html/aboutInfo.html) | 8 (6-8 distinct) | 1 | 0 | 3 | 4 | 1 |
| 2009 season | 28, [Hop! statement](https://www.tvnetil.net/report/3268/) and regulator 12 + 16 | 7 (4-7 distinct) | 0 | 0 | 3 | 4 | 19 |
| 2012 season, aired 2013 | 15, [Hop!'s DVD set](https://nahariya.agronplus.org/title-details/?title_no=Sm1MaXpnaG5TU05oOEJtTmJzS25RZz09) | 15 | 12 | 0 | 0 | 3 | 2 |
| Discovering Curiosity, 2015 | Contested: [29](http://revital-world.blogspot.com/2015/03/2015-15-2015-82-77.html) or a [4-episode unit](https://www.gov.il/BlobFolder/reports/moatsa2014/he/%D7%93%D7%95%D7%97%202014.pdf) | 12 | 11 | 0 | 0 | 1 | 1 |

Counted separately:

| Production | Episodes made | Guide rows | Whole candidate | Missing | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Shara'a Simsim, Arabic-dominant, 1998 (related series) | 20 | 0 | 0 | – | All 20 expected but not identified: no titles, numbers or uploads known |
| IETV home-video tapes, 1999 | At least 5 | 5 | 4 | 1 | Tapes are not television episodes |
| Sesame Stories (Sippuray Sumsum), 2003 (related series) | 26, [Hop!'s booklet](https://web.archive.org/web/20040118125430/http://www.hop.co.il:80/sumsum/ganim/prospect.asp) | 26 | 1 | 25 | |
| Word of the Day 2023 (short series) | Not documented; 8 published | 8 | 8 | 0 | Complete short-series installments, not core episodes |
| Elmo's Israeli talk show, 2022 | 14, [season-finale review](https://www.israelhayom.co.il/culture/tv/article/13225897) | 14 | 14 | 0 | |
| Classic Shalom Sesame | 11, [UMass](https://www.umass.edu/langctr/jhweb.html) | 11 | 11 | 0 | |
| Shalom Sesame 2010 | 12, [official store](https://web.archive.org/web/2012/http://store.sesamestreet.org/Product.aspx?cp=21415_21456_21463&pc=6EAM0976) | 12 | 12 | 0 | 11 of the 12 rest on licensed listings only |

Five more long classic uploads sit in the unassigned queue because their production is not established.

Read the totals with these limits:

- The original series has 183 numbers with a whole candidate. For 95 of them the only whole candidate is the archive.org file (57, 82, 103 and 117 also have YouTube excerpts or parts). The other 88 also have a whole YouTube copy.
- Two of the twelve missing original numbers, 133 and 178, probably have archive.org copies whose order is unresolved.
- The only whole links of co-production programmes 10 and 11 failed a check from outside Israel with a content-claim block by Global Media Egypt. Where the blocks apply is not established; the library shows them as unavailable in that check.
- The 2006 and 2009 rows include numbered rows from Hop! labels that may be the same programmes as titled rows. Between 32 and 34 of the 40 titles of 2006 are unknown, and between 21 and 24 of the 28 titles of 2009.
- There is no combined modern total, because the 2015 figure is contested.

Research notes: [classic](research/episode-totals-classic-rechov.md), [modern and Elmo](research/episode-totals-hop.md), [Shalom Sesame](research/episode-totals-shalom.md), [October 2026 sweep](research/acquisition-sweep-2026-10.md).

## Next work

- [x] Collect Vimeo links for the 49 new Hop! posts. Done on 2026-10-18 (below).
- [ ] Do the identifications that need viewing.
- [ ] Look for copies of the missing episodes listed below.
- [ ] Check completeness and playback of the whole candidates, starting with those listed below.
- [ ] Work through the research tasks at the end.

## Hop! Vimeo links

Every catalogued Hop! page has its exact Vimeo link. On 2026-10-18 an agent ran [scripts/collect-hop-links.js](scripts/collect-hop-links.js) in a Zen Home tab at the user's request. All 234 manifest pages returned `player-link-found`, with no region block, error or retry, and every `directUrl` keeps its privacy hash. The 42 `/music/` pages carry the same player markup as the show pages. The 185 earlier rows came back with identical URLs and were kept. The 49 new rows were merged into [data/hop-player-links.json](data/hop-player-links.json), whose `collections` array describes both runs. `scripts/enrich-vimeo.py` then made 39 new oEmbed lookups, and all 224 videos have metadata. The 49 posts run 0:53 to 26:17. They are listed in `newHopPosts` in [data/hop-episode-audit.json](data/hop-episode-audit.json).

The 234 pages hold 224 distinct Vimeo videos. Ten music posts embed the same video as a catalogued show post, so the 49 posts add 39 videos:

| Music post | Same video as |
| --- | --- |
| hop-9857 "הדג נחש" | hop-5113, 2009 episode 2 excerpt |
| hop-9860 "בנאים" | hop-5112, 2009 episode 1 excerpt |
| hop-9865 "אחינועם ניני ומירה עוואד" | hop-5114, 2009 episode 4 excerpt |
| hop-9867 "הרב בנימין לאו" | hop-5115, 2006 episode 15 excerpt |
| hop-9862, the fifty-year song compilation | hop-5110 |
| hop-9869, hop-9872, hop-9874, hop-9876, hop-9878 | hop-5162, hop-5164, hop-5168, hop-5165, hop-5169 (songs) |

The first four are linked to the same episodes as excerpts, like their twins. Coverage is unchanged. Three same-title pairs embed different videos: hop-6848 and hop-5116, hop-6963 and hop-5117, hop-6960 and hop-6961. The builder warns that 10 videos are linked by more than one record; those are these ten pairs, and the warning is expected. This comparison settles the earlier estimate that about 15 music titles duplicate show posts: 12 music posts share a show post's title or nearly so, and 10 of those are the same video.

The Tu BiShvat special hop-10133 "מעבדה – אביגיל שואלת איך ולמה" runs 6:52. It stays unverified, because a running time alone does not establish a whole programme.

The links were collected, not played. Playback testing stays open under "Completeness and playback checks".

### Collecting links for Hop! pages added later

An agent may run these steps directly.

1. Add the page to [data/hop-records.json](data/hop-records.json), [data/hop-url-manifest.json](data/hop-url-manifest.json) and the manifest array embedded in [scripts/collect-hop-links.js](scripts/collect-hop-links.js), in the same order. The committed manifest must keep listing every catalogued Hop! page. A temporary copy of the script with only the new entries saves time, but do not commit it.
2. Switch Zen to the **Home** workspace. Do not use Work, a new browser profile, another browser or the in-app browser.
3. Open the pinned Proton VPN extension and check that it is connected. On 2026-10-18 it was found disconnected despite auto-connect, and was connected to Israel, Tel Aviv from Recents. Pick **Tel Aviv** by city; the server number may differ (IL#751 on 2026-10-18). Confirm that split tunneling is on in **Include mode** and that the only included website is `hop.co.il` with its subdomains. Do not change these settings. If the extension asks you to sign in again, use 1Password.
4. In a Home tab, open an official Hop! page, for example the [Rechov Sumsum collection](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/). Make sure it shows the player and no regional notice.
5. Open the browser console in that tab, paste the whole collector script and run it. It reads the pages one at a time, shows progress, downloads `hop-player-links.json` when it finishes and keeps the report in `window.hopCollectorResult`. Copy the report from the console if the download does not arrive. Keep the Hop! tab open until then. The 234 pages took under five minutes on 2026-10-18.
6. Check the report. Each row should say `player-link-found` and have a `directUrl` that keeps its privacy hash. For a `region-blocked` row, check the VPN connection. For a `no-player-found` row, open that page in Zen Home and read the embedded Vimeo URL by hand before concluding that the video is absent.
7. Merge the new rows into [data/hop-player-links.json](data/hop-player-links.json) by id. Keep every existing row and all recorded playback evidence verbatim; do not replace the file with the new report. Give re-read rows `recheckedAt` and `recheckStatus`. If a re-read row has a different URL, report the difference instead of overwriting the row. Add the run to `collections`.
8. Run `python3 scripts/enrich-vimeo.py` (it reads public Vimeo oEmbed metadata), then rebuild and check the library.
9. Compare the new Vimeo ids with the existing rows. The builder warns when two records link one video. Treat the two Hop! pages as one video, and link a duplicate in the guide the same way as its twin.

Five items are no longer on Hop! and cannot be collected: the 2009 Keren Leibovitch segment (old code SUM_2009_e6), the 2012 story "אלמו לומד לנצח בכבוד", SUM_2006_e16 (the Uri documentary, which survives on YouTube), SUM_speical_e54 and SUM_m27. The first three are tied to guide rows. The first two leave their guide episode without any copy; SUM_2006_e16's episode keeps its YouTube excerpt. SUM_speical_e54 and SUM_m27 are not tied to a guide episode.

## Missing episodes

### Original IETV series: 12 numbers

- [ ] 19, 20, 41, 51, 53. Season 1. They map in an undetermined order to archive.org S1E7 (a 754-second excerpt), S1E10 and S1E16 (no files), S1E52 and S1E64. Two probably have archive.org copies and one probably survives only as the excerpt; two have no file.
- [ ] 98 "אלברט מחפש עבודה", 122 "יום הולדת למכרם", 125 "להתחיל מחדש", 129 "רגליים מדברות". No known copy. Lead: an unlabelled season-2 chapter at 21:28 in yt-VG3HsNMshXc.
- [ ] 133 and 178, both "נא לא להפריע". Possible copies: archive.org S3E34 and S3E49, order unknown.
- [ ] 148 "סידור המחילה". No known copy.

Whole copies are also needed for 46, 167 and 172, which have parts only.

### 1998 co-production: 57 programmes

Titles as in the NLI catalogue.

- [ ] 1 הנחירות של אופניק, 2 שקט, 3 חברה חדשה, 4 מזוזה, 5 אופניים, 7 קיפי מצייר כדורגל, 9 בית מספר 5
- [ ] 13 לילה אצל חברה, 14 הלהקה, 15 סוכר, 16 דפי המדענית, 17 נחמן המשורר, 18 קיפי מתכונן לבית הספר, 19 החלון, 20 האוסף של דפי
- [ ] 21 פרח מוגן, 22 הרוכבת הנועזת, 23 אופניק חולה, 24 הכן רכבך לחורף, 25 צחצוח שיניים, 26 שגדבום, 27 אלכסנדר השני, 28 קיפי מטייל, 29 המורה לדרמה
- [ ] 31 אוטו אוף, 32 ספרות אופניקית, 34 גריז, 35 כלב כלבבי, 36 המריבה, 37 הצב אלכסנדר, 38 היומן של קיפי, 39 דפי מתעדכנת, 40 סתיו
- [ ] 41 ערוץ סומסום, 42 מצב רוח עגול, 43 המכתב של מויישה, 45 המשפחה, 46 מר כעס, 47 אופניק מאוהב (רומאו), 49 היפיפה הנרדם, 50 קיפי משהק
- [ ] 51 חיסור, 52 מחבואים, 53 דפי השניה, 54 דפי הקוסמת, 55 חג המולד, 56 מד עצבים, 57 איפון, 58 שעון חדש, 59 אמבטיית זבל
- [ ] 61 החוה של קיפי, 62 מעסלאמה, 63 חבר דמיוני, 64 אין כניסה, 66 מתנות שונות
- [ ] 69 לחיות בהרמוניה - סובלנות בין ישראלים ופל, 70 שניים - שניים - סובלנות בחברה הישראלית

Whole copies are also needed for 6, 33 and 60 (partial uploads), 12 and 68 (tape editions only) and 30 and 48 (one segment clip each). Erez Lutsky's "דומים ושונים" (yt-TIPNuXPEcUY, 44:40) may hold 69 and 70, or may be a tape.

### Shara'a Simsim, Arabic-dominant version: 20 programmes

- [ ] Find titles first. No title, number or upload is known.

### Sesame Stories, 2003: 25 titles

English titles are editorial. The one linked title is "נוח וברוש לא חברים".

- [ ] מושי (Moshi), הקניון (The Mall), תולי התולעת (Tuli the Worm), שרשרת השוקו (The Chocolate-Milk Chain), אבו ג'מיל (Abu Jamil)
- [ ] מגפיים לשניים (Boots for Two), כולם איבתיסאמו (Everyone Became Ibtisam), העציץ (The Flowerpot), פלאפל (Falafel), בלי רשות (Without Permission)
- [ ] כל אחד נחמד (Everyone Is Nice), להתפשר (To Compromise), ברוש עוזב (Brosh Leaves), והשד הזה הוא אני (And That Demon Is Me), בלשים (Detectives)
- [ ] צחי עצוב (Tzachi Is Sad), איבתיסאם ושלושת הצפרדעים (Ibtisam and the Three Frogs), קבוצות (Teams), אדום ומעצבן (Red and Annoying), שותפים (Partners)
- [ ] אוהדים (The Fans), גם וגם (Both This and That), הטרול (The Troll), תופים ומתחשבים (Drums and Consideration), מסיבת הפתעה (Surprise Party)

### Modern seasons

- [ ] 2006: What to Do When You're Angry (מה עושים כשכועסים), The Dwarf and the Giant (הגמד והענק), Avigile's Friends (החברים של אביגיל), Avigile Is Sad (אביגיל עצובה). Avigile's Paintings and episodes 15 and 16 have excerpts only. Find the 32-34 unknown titles.
- [ ] 2009: "הצבע לא קובע", "המסעדה של כרובי", "שיר המקהלה" and episode 6. Episodes 1, 2 and 4 have excerpts only. Find the 21-24 unknown titles.
- [ ] 2012: episode 8 "הסרט של מוני", episode 10 "פיקניק בגשם" and "אלמו לומד לנצח בכבוד". Find the titles on disc 3 (episodes 11-15).
- [ ] 2015: "מה קרה לקרטיבים?", named in the Ministry of Education's 2016 guide.

### Home-video tapes

- [ ] "שיר קסומסום עם מוישה אופניק" (Holon Mediatheque 054005). Find a publisher list of the 1999 tapes.

## Identifications that need viewing

These cannot be settled from metadata. Each one needs someone to watch the upload.

- [ ] Original series: which of 19, 20, 41, 51 and 53 archive.org S1E7, S1E52 and S1E64 hold, together with the copies yt-Zp7wKyKpB6s and yt-6szujkolcCw.
- [ ] Original series: which of archive.org S3E34 and S3E49 is 133 and which is 178. forespec's "יונה חולה" parts 1-3 have the length of S3E34.
- [ ] Original series: yt-NLp5scAQkqA (2 or 17); the NAD Studios Hanukkah copies yt-qoq0GUreRk8 and yt-hy5t9WfsqpM (8, 120, 142 or 196); yt-D0JCF52Tp3c (leads 52 and 137); the unlabelled season-2 chapter in yt-VG3HsNMshXc; whether yt-xQix4Pe0iZA is the regular or the Sukkot edition of 143.
- [ ] Classic queue: Avi Amitzur's Hanukkah partial yt-S92pkgXT8kQ; forespec's "שביר" parts (weak lead 190); the Gulf War segment yt-WEXFzBnsp5U.
- [ ] Short-clip leads: yt-xxd32WU1THc (perhaps 66) and yt-AlyEG_HPA7o (perhaps 97).
- [ ] 2009: the 17 Hop! story files hop-5130 to hop-5146 and the two Shosha Goren uploads yt-RijAHYGqVeU and yt-bh939L3pYXw.
- [ ] 2012: hop-5090 against episode 8 and hop-5104 against episode 10.
- [ ] 2015: yt-rcjMhVLd1IE, an off-screen recording labelled "פרק 1".
- [ ] Sesame Stories, 2003: whether Hop!'s "סיפורי סומסום" clips hop-4722 "מיחזור" and hop-5107 "נקיון חופים" are the songs of the same names on Classicaletet's 2007 DVD of songs and stories from the series (NLI record 990028077290205171). If they are, map the group (with hop-5108 "אלמוגים") to the 2003 series as excerpts.
- [ ] 2006: web-6b6a7cd601, a 13-minute IMDb preview of the Avigile & Friends DVD.
- [ ] Metadata-only links made in the verification round, for example yt-5uRyIMy2ktA to 142 (YouTube preview frames) and hop-yt--ajWXnyBJ5I to Guri Alfi (identical thumbnail).

## Completeness and playback checks

For each check, record the exact URL, the date and the evidence level reached: playback started, complete playback reviewed, or compared with a reference edition.

- [ ] Hop!/Vimeo links: test playback. Of the 224 distinct Vimeo videos behind the 234 Hop! pages, only Hug (hop-8864, [vimeo.com/916707529/6cdb440a7c](https://vimeo.com/916707529/6cdb440a7c)) has a recorded playback start. None of the 49 links collected on 2026-10-18 has been played. Open the direct Vimeo URL in another Home tab; Vimeo is outside the VPN rule, so there is no need to disconnect. Record the exact URL, the date and what played in [data/hop-player-links.json](data/hop-player-links.json).

- [ ] Original series: compare whole candidates with the NLI runtime and credits, starting with the 95 numbers whose only whole candidate is the archive.org file. Season-2 and season-3 files often differ from the catalogue runtime by 50-140 seconds.
- [ ] Co-production: the six whole candidates against the NLI's 24-minute runtime. Find where the content-claim blocks on yt-1DwisSsu27I (10) and yt-6j4qBatnpgE (11) apply, without changing VPN routing.
- [ ] Classic Shalom Sesame: review one candidate per programme from start to credits, starting with the generic "episode 4" and "episode 5" uploads. Compare the shorter Tel Aviv (25:08) and Aleph-Bet Telethon (29:26) editions. Find where the content-claim block on yt-nZAFB1zzstg (Aleph-Bet Telethon part 1) applies, without changing VPN routing.
- [ ] Shalom Sesame 2010: check the two two-part sets (Welcome to Israel, Missing Menorah) for gaps and an ending. Find where the content-claim block on yt-ncg_vcMXQBY (Welcome to Israel) applies, without changing VPN routing. Whether to watch them on hoopla (free with a Queens Public Library eCard anywhere in New York State, or a Westchester card), Apple TV or Prime Video is your decision.
- [ ] Licensed access (`data/licensed-services.json`): confirm on a Queens Public Library page that the eCard, not only the regular card, signs in to hoopla (QPL's eCard pages say it covers e-materials but do not name hoopla). Re-check the Westchester hoopla limit: a Lewisboro Library post reported 2 borrows a month from 2026-07-01, but it returned HTTP 404 on 2026-10-18, so the file uses Yonkers' 3 and Eastchester's 6. QPL's own pages give 10 and 5 a month.
- [ ] 2012: compare Hop!'s files with the 2021 YouTube copies, which run 150-170 seconds shorter.
- [ ] 2015: check "התיק של אלמו" and "לחמם את האף", whose archived pages make no full-episode claim, and the six story files shorter than the 7.1 net minutes per episode accounted in 2014 (hop-5086 5:21, hop-5096 5:26, hop-5085 6:12, hop-5091 6:17, hop-5083 6:46, hop-5075 7:03).
- [ ] Elmo: check whether the 7:41-10:10 Hop! assets are complete programmes or web edits.

## Research tasks

- [ ] Find where the archive.org season and slot numbering comes from (the deleted archionir2 channel) and the IBA Classics numbering.
- [ ] Confirm the original series' inferred 130/131 season boundary and its first-run dates. Sources to try: Kan or IETV records, the Israel State Archives files גל-18680/8, גל-18680/9 and גל-15454/9, and NLI newspaper pages read in an ordinary browser.
- [ ] Look for the 199 classic YouTube playlist entries that are now removed (176) or private (23).
- [ ] Establish the co-production's 1998-1999 broadcast dates.
- [ ] Resolve the 2015 total.
- [ ] Find the whole 2012 "מילת היום ברחוב סומסום" programmes. Hop! hosts only their opening segments.
- [ ] Israeli VOD catalogues could list modern seasons but need an Israeli connection. The Proton rule covers only hop.co.il. Widening it is your decision, not a routine workaround.

## Audit files

| Scope | Research note | Machine-readable mappings |
| --- | --- | --- |
| Classic Rechov Sumsum | [episode-totals-classic-rechov.md](research/episode-totals-classic-rechov.md) | [classic-rechov-episode-audit.json](data/classic-rechov-episode-audit.json), [nli-ietv-catalogue.json](data/nli-ietv-catalogue.json) |
| Modern Rechov Sumsum, short series, Sesame Stories and Israeli Elmo | [episode-totals-hop.md](research/episode-totals-hop.md) | [hop-episode-audit.json](data/hop-episode-audit.json) |
| Both Shalom Sesame series | [episode-totals-shalom.md](research/episode-totals-shalom.md) | [shalom-episode-audit.json](data/shalom-episode-audit.json) |
| All productions | [acquisition-sweep-2026-10.md](research/acquisition-sweep-2026-10.md) | [episode-guide.json](data/episode-guide.json) |

## How to update this list

Keep the existing upload record when an alternate copy is found. Add the new URL with its provenance, then link it to the same episode in `data/episode-guide.json` with the right role (`whole-candidate`, `alternate-edition`, `part`, `excerpt` or `possible`) and note the link in the audit JSON. Rebuild, check, and recount this page from the guide.

Mark an acquisition task complete only when a usable link has been captured. Mark a completeness task complete separately, with the exact URL, evidence and review date. Do not use a duration threshold alone to promote a clip or story to a full programme, and do not let a possible copy count as coverage.

Production totals with conflicting or incomplete sources stay open research tasks. The research notes and audit JSON keep the evidence and the unresolved mappings.
