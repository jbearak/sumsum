# Classic Rechov Sumsum: production totals and episode audit

Audited 2026-10-18. This note replaces the audit of 2026-10-17. That audit treated uploader season and episode labels as provisional identities because no primary episode list had been found. One has now been found, in the National Library of Israel.

The machine-readable crosswalk, the missing and possible lists and the task ids are in [classic-rechov-episode-audit.json](../data/classic-rechov-episode-audit.json). Episode identities, upload roles and coverage are in [episode-guide.json](../data/episode-guide.json), and the catalogue extract is in [nli-ietv-catalogue.json](../data/nli-ietv-catalogue.json). Nothing was watched or downloaded. Every link below is a metadata-checked candidate.

## Production totals

| Production | Total | Basis |
| --- | ---: | --- |
| Original IETV series, 1983-87 | 198 | IETV programme numbers 1-198 in the NLI catalogue |
| Rechov Sumsum / Shara'a Simsim, Hebrew-dominant, 1998 | 70 | NLI numbers 1-70, and Cole et al. |
| Shara'a Simsim, Arabic-dominant, 1998 | 20 | Cole et al., Warshel and launch reports. A related series, counted separately |
| IETV home-video tapes, 1999 | at least 5 | Library records. No publisher list was found |

These are separate denominators. Tapes are not television episodes, and the Arabic-dominant programmes are not extra Hebrew ones.

## The NLI catalogue is the primary list

The National Library of Israel holds Israeli Educational Television's catalogue records for its digitised Rechov Sumsum programmes ([SRU query](https://nli.alma.exlibrisgroup.com/view/sru/972NNL_INST?version=1.2&operation=searchRetrieve&query=alma.all_for_ui=%22%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D%22)). 199 records have titles of the form "רחוב סומסום <N>", with N running from 1 to 198. Programme 183 has two records, a regular version and a Tu BiShvat version, so the series has 198 distinct numbers. Another 70 records, titled "רחוב סומסום - שארע סימסים", number the co-production from 1 to 70. Each record gives a title, a summary and an IETV id, and most give a runtime.

The catalogue has limits. Viewing is on library premises only, and no record links a public video. 54 original-series records have no runtime; that leaves 53 numbers without one, because one of the two records for 183 has a runtime. Sixty season-1 titles are only "רחוב סומסום <N>", so for those programmes the summary has to carry the identification. From 66 on, the catalogue adds a subtitle, sometimes cut short in the catalogue itself. The guide quotes the titles verbatim and drops only the catalogue's final period. Its English titles (`titleEn`) are editorial translations, not catalogue titles. They translate the NLI title where it names a story, as in all 70 co-production programmes. For 55 of the 60 neutral season-1 titles, they translate the story name in the programme's archive.org file label instead. The guide quotes that story name verbatim in `storyHe` and names the label in `storySourceEn` and `storySourceHe`. It is the uploader's broadcast-order wording, matched to the IETV number through the crosswalk; nine of the 55 matches are medium or low confidence, and the source fields say so. Five labels end with a note about the file rather than the story: a year ("1983" for 35, 36 and 65; "1984" for 13) or "(לא מלא)", incomplete (46). `storyHe` leaves that note out; the label keeps it in `altLabels`. Programmes 19, 20, 41, 51 and 53 have no story name and no English title, because archive.org S1E7, S1E52 and S1E64 are unresolved among them.

### Conflicting totals

A [letter of 20 February 1986](https://catalog.archives.gov.il/wp-content/uploads/2018/07/%D7%9C%D7%95%D7%A8%D7%91%D7%A8%D7%91%D7%95%D7%99%D7%9D-%D7%9C%D7%A0%D7%91%D7%95%D7%9F-1-%D7%92%D7%9C-18680-8-%D7%A2%D7%9E-154.bmp) from IETV director-general Ya'akov Lorberbaum to Yitzhak Navon, in Israel State Archives file גל-18680/8, counts a first series of 65 programmes and funding for 130 more, "בסה"כ 195 תכניות". IETV was then about to finish the 130. That is a funding count written partway through the third block, and it is three short of the catalogue.

The 195 in [Eli Eshed's 2013 feature](https://web.archive.org/web/20131128103635/http://www.nrg.co.il/online/47/ART2/523/758.html) and in Hebrew Wikipedia since 2010 cites no source and may come from the same 3 × 65 arithmetic. The 65 in the [2023 Jerusalem Post feature](https://www.jpost.com/israel-news/culture/article-742085) is probably one production block reported as the whole run. The "more than 200 episodes ... enough for four or five seasons" in the [2006 JTA feature](https://www.jta.org/2006/11/17/ny/open-sesame) describes how much material existed, not how many seasons were made. The guide keeps all three as conflicting claims. The catalogue's 198 is the denominator.

### Seasons

The guide splits the numbers into three seasons, 1-65, 66-130 and 131-198, so seasons 2 and 3 start at 66 and 131. Only the first block of 65 is documented directly, by the 1986 letter. The 130/131 boundary is inferred. Every archive.org season-1, season-2 and season-3 file that matched a number falls inside those blocks, and the NLI tape references in the 35xx series begin at 131. The NLI records carry no season.

There was no original season 4 or 5. TMDB's seasons 4 and 5 are untitled placeholders created in 2024. Community labels that put "season 4" or "season 5" on Rechov Sumsum belong to Shalom Sesame. The clearest example is an archive.org Russian dub of the Shalom Sesame Passover programme filed as "רחוב סומסום - עונה 5 פרק 17". The guide links it to Shalom Sesame show 10 as an alternate edition.

## The archive.org collection and where it came from

The Internet Archive item [rechov_sumsum_1983](https://archive.org/details/rechov_sumsum_1983) holds 193 MP4 files named "רחוב סומסום - עונה N פרק M - <story>" in three season folders. It was added on 30 June 2022.

| Folder | Slots | Files | Empty slots |
| --- | --- | ---: | --- |
| Season 1 | 1-65 | 63 | 10, 16 |
| Season 2 | 1-65 | 61 | 32, 45, 63, 64 |
| Season 3 | 1-70 | 69 | 60 |

Season 3 has two files each for programmes 143 (regular and Sukkot) and 183 (regular and Tu BiShvat). Four files are marked partial or an excerpt: S1E7, S1E22, S3E30 and S3E54.

The item description says "credit to archionir2", and another uploader credits "ארכיוניר 2" the same way. The YouTube user [archionir2](https://www.youtube.com/user/archionir2/videos) returned HTTP 404 on 17 October 2026. The channel is gone, and the archive.org item and scattered re-uploads are what survive of it.

Some files were assembled from other people's rips. The partial S3E30 and S3E54 have the summed lengths of forespec's three-part YouTube uploads of programmes 172 and 167: exactly for 172, and within a second for 167. IBA Classics uploads usually match the archive.org files to within a second, which suggests shared transfers. Nobody has established where the season and slot numbers come from: tape slates, a catalogue or a collector's order (task `orig-provenance`).

The slot numbers are broadcast or collector order, not IETV numbers. They agree with the season labels used by Dinostalgic 90', Avi Amitzur and OldTVIsrael in every case checked, so those uploader labels belong to the same sequence. The distance from the catalogue numbering can be large. S1E29 "אבנר מתגעגע" is IETV 14, and S3E32 "ככה שותלים שתיל" is IETV 198.

## How the crosswalk was made

Each archive.org file was matched to one NLI number inside its season block, by one of four methods:

- the NLI title, including spelling variants (112 files);
- words or phrases of the NLI summary (15 files);
- word 4-gram overlap between the [TMDB season-1 synopsis](https://www.themoviedb.org/tv/9099-rechov-sumsum/season/1?language=he) and the NLI summary (36 files);
- an individual spelling or keyword decision, written out per row in the audit JSON (25 files).

That gives 188 files with a single match, 175 at high confidence, 12 at medium and 1 at low. Two files are ambiguous between two numbers. Three season-1 files have no single match. An independent spot check of 15 matches reproduced all 15.

Runtime is supporting evidence only. Of the 140 single-matched files whose NLI record has a runtime, 45 agree within 3 seconds, 39 within 4-30 seconds, 52 within 31-150 seconds, and 4 differ by more than 150 seconds. Season-2 and season-3 files are often 50-140 seconds longer or shorter than the catalogue runtime, probably because of rebroadcast or tape edits. A matching runtime does not make a file complete. A mismatch does not make it a different programme.

Other uploads attach to a number through an exact or near story title, an uploader label already matched through archive.org, a description, the summed length of numbered parts, or YouTube preview frames. The audit JSON gives the basis per upload where the crosswalk recorded it. Otherwise it is in the record notes.

## What the links cover

All 198 numbers are guide episodes. 183 have at least one whole-programme candidate: for 95 the only one is the archive.org file, and 88 also have a YouTube copy. Three numbers have parts only, and twelve have nothing. The guide links 328 uploads to the series, 284 of them as whole candidates, and 15 more uploads wait in the original-series queue.

A whole candidate is a programme-length file matched to the number. None has been checked from start to finish. No classic upload has a recorded playback start, and none has been compared with a reference edition.

The three parts-only numbers:

- 46 has archive.org S1E22, marked partial, and a 190-second Kan Archive Facebook excerpt (fb-376562979864652) of Shoshana Damari singing "מרים בת ניסים".
- 167 has forespec's parts 1-3, 1,447 seconds together (462 + 534 + 451), within a second of archive.org S3E54 (1,446.2 seconds), which is marked partial.
- 172 has forespec's parts 1-3, 1,611 seconds together, and archive.org S3E30, marked partial.

## The twelve missing numbers

The English glosses are editorial summaries of the NLI text.

| IETV | NLI title | Gloss | Status |
| ---: | --- | --- | --- |
| 19 | רחוב סומסום <19> | Kippi tries to make rain on a summer day | Season-1 residual |
| 20 | רחוב סומסום <20> | Kippi does not come home from kindergarten | Season-1 residual |
| 41 | רחוב סומסום <41> | Two people who look alike; Kermit's short and long ladders | Season-1 residual |
| 51 | רחוב סומסום <51> | Sign language, Shabbat at kindergarten, autumn | Season-1 residual |
| 53 | רחוב סומסום <53> | Surprises for brothers and sisters; Kippi has butterflies in his head | Season-1 residual |
| 98 | אלברט מחפש עבודה | Albert tries out jobs; Kippi greets tourists | No known copy |
| 122 | יום הולדת למכרם | Makram's birthday | No known copy |
| 125 | להתחיל מחדש | Starting over | No known copy |
| 129 | רגליים מדברות | Reading moods from faces, and Moishe Oofnik's way | No known copy |
| 133 | נא לא להפריע | A car used as a home | Possible copy |
| 148 | סידור המחילה | Rearranging Kippi's burrow | No known copy |
| 178 | נא לא להפריע | 103 screws; Albert chooses a profession | Possible copy |

**Season-1 residuals.** Numbers 19, 20, 41, 51 and 53 map, in an undetermined order, to five archive.org slots. S1E7 is a 754-second excerpt, S1E10 and S1E16 have no files, and S1E52 "קיפי מודד את האף" and S1E64 "הנכדה של יונה" are programme-length. So two of the five probably have archive.org files, one probably survives only as the excerpt, and two have no file. IBA Classics' yt-Zp7wKyKpB6s has the S1E52 title and length, and forespec's yt-6szujkolcCw has the S1E7 length. Watching the three files against the five summaries would settle it (task `orig-s1-residual-order`).

**133 and 178.** Both carry the NLI title "נא לא להפריע". archive.org S3E34 (1,773.7 s) and S3E49 (1,694.2 s) both carry the story label. By slot count they probably hold the two programmes in some order. The guide lists both files as possible copies on both numbers. Possible copies never count as coverage, so both numbers stay missing until someone watches the files (task `orig-133-178`). forespec's "יונה חולה" parts 1-3 add up to 1,774 seconds, the length of S3E34, which is a runtime-only lead.

**98, 122, 125 and 129.** By elimination these fit the empty season-2 slots S2E32, S2E45, S2E63 and S2E64. A Ma'ariv listing page of 21 June 1985 prints 98 beside 97 (S2E44), which favours S2E45 for 98. That is an inference from one page. The 1988 Dinostalgic compilation yt-VG3HsNMshXc lists an unlabelled season-2 chapter at 21:28, a lead for any of them.

**148** probably belongs to the empty slot S3E60.

If the four probable files hold four of the twelve numbers, seven programmes have no known copy anywhere and one survives only as an excerpt.

## Former uploader-label identities

The 2026-10-17 audit kept twelve uploader labels as provisional identities. Each now resolves to an IETV number, and the labels stay in the audit JSON as alternate-label evidence.

| Label | Uploader | Upload | Now |
| --- | --- | --- | --- |
| S1E29 | Avi Amitzur | yt-pOZMqQkshT8 | 14, whole candidate |
| S2E15 | Dinostalgic 90' | yt-7pz7d6qGRa8 | 81, whole candidate |
| S2E22 | OldTVIsrael | yt-hBsDetJvy2E | 74, whole candidate |
| S2E38 | Dinostalgic 90' | yt-djxq68Q8bxo | 96, whole candidate |
| S2E58 | Dinostalgic 90' | yt-PA6PNk2dTxE | 99, part. Whole candidates are yt-UkKkGuzQkPs and the archive.org file |
| S2E59 | Dinostalgic 90' | yt-ZhRW7BinIlI | 79, whole candidate |
| S2E60 | Dinostalgic 90' | yt-MCRPNFn54YI | 117, part. The archive.org file is a whole candidate |
| S3E7 | Dinostalgic 90' | yt-nYf0IdtoeMk | 139, whole candidate |
| S3E8 | Dinostalgic 90' | yt-3d0L7B6jKso | 137, whole candidate |
| S3E32 | Dinostalgic 90', Avi Amitzur | yt-hD-vUnY-JqA, yt-5V3Xds5ZJUw | 198, whole candidate and part |
| S3E44 | Dinostalgic 90' | yt-XBPWy9UY2xU | 136, whole candidate |
| S6E33 | Avi Amitzur | yt-HRBrHRBZHG0 | Co-production 33, part |

Dinostalgic's S3E7, S3E8 and S3E44 differ by 60-126 seconds from the archive.org files and the IBA Classics copies. Sharing a number does not prove sharing a transfer.

The two story-label groups from the earlier audit are settled. The full "קיפי פוגש את גבי" upload (yt-xQix4Pe0iZA) is a whole candidate for 143, and the short one is an excerpt of it. Whether yt-xQix4Pe0iZA is the regular or the Sukkot edition is open. The full Purim upload (yt-LeUYIoUZz1o) is a whole candidate for 177, the only season-3 Purim programme. The 453-second Purim upload stays unlinked, because shared holiday wording is not an identity.

## The 1998 co-production

The NLI numbers the Hebrew-dominant programmes 1 to 70: 68 of 24 minutes and two 30-minute tolerance specials, 69 and 70. [Cole et al.](https://journals.sagepub.com/doi/10.1080/01650250344000019) also count 70, with an original plan of 65 expanded by five. Launch reports in [Globes](https://www.globes.co.il/news/article.aspx?did=120709) and the [Los Angeles Times](https://www.latimes.com/archives/la-xpm-1998-apr-01-ca-34706-story.html) said 60, and Eshed wrote 50. The [1998 Japan Prize record](https://web.archive.org/web/20030409012510/http://www.nhk.or.jp:80/jp-prize/english/past/25/jf.html) lists "Living in Harmony", a 30-minute IETV entry. Programme 69 is "לחיות בהרמוניה - סובלנות בין ישראלים ופל".

Thirteen programmes have some link and 57 have none. Eleven of the thirteen are identified with programme content:

- Six have whole-programme candidates: 8 (yt-73-kQzMvvXY), 10 (yt-1DwisSsu27I), 11 (yt-6j4qBatnpgE), 44 (yt-C7mlEaKbmJA), 65 (yt-Q090qFwyweQ) and 67 (yt-URnWguaOp0k). The match for 11 is medium confidence, because one segment in the upload's description is missing from the NLI summary. The uploads for 10 and 11 failed a metadata check from outside Israel on 17 October: "It was blocked due to the claimed content by Global Media Egypt". Where those blocks apply is not established, and the records are marked unavailable in that check.
- Three have partial uploads: 6 (the football upload yt-4n4G8W7MTbw, which its uploader says lacks a minute at each end), 33 (yt-HRBrHRBZHG0, described by its uploader as "פרק חלקי") and 60 (the Sukkot upload yt-W0JxRyqkbBI).
- Two survive only as tape editions: 12 and 68. Programme 67 is also on a tape.

Most matches rest on the uploads' YouTube descriptions, read on 2026-10-17, against the NLI segment lists. For 8, Dinostalgic's untitled "(3)" upload describes a gift for Shmil, a kite followed from the next street and Amal missing her sister, which are NLI <8>'s segments "מתנה לג'ולי", "עפיפון" and "אחותי". The audit gives the basis and confidence of every co-production link.

Programmes 30 and 48 have one segment clip each. Songs that recur across programmes are not linked to any one of them.

Uploaders call this production "season 6". That label matched the NLI number once, for programme 33. Dinostalgic's numbers (1), (2) and (3) are upload order: the uploads are programmes 11, 10 and 8.

Broadcast dates are thin. Launch reports give the premiere as 1 April 1998 and Hebrew Wikipedia gives 2 April, with a "second season" from 1 September 1998. No 1998 or 1999 newspaper listing turned up.

The Arabic-dominant version had 20 programmes of 15 minutes for Palestinian broadcast. No title, number or upload is known. Daoud Kuttab's [2025 recollection](https://currentpub.com/2025/03/08/a-christian-palestinian-journalist-worked-on-arab-sesame-street-he-has-things-to-say-about-trumps-cuts-to-usaid-funding/) of 26 episodes conflicts and may mix seasons. The Sharaa Simsim Palestine YouTube channel has about 20 uploads of 21-30 minutes, which could belong to this version or to the later Palestinian series.

## Home-video tapes

Five tapes are documented:

| Tape | Library record | Upload |
| --- | --- | --- |
| שיר קסומסום עם מוישה אופניק | Holon 054005, IETV, 1999, about 45 min | None found |
| ערוץ סומסום עם קיפי והמיקרופון המשוטט | Holon 054007, IETV, 1999 | yt-pQ65exR_HBQ, 44:26 |
| מה במחבת? דפי מארחת | Holon 054008, IETV, 1999 | yt-w3Hpk0-vW8Q, 42:59 |
| מסע בין אגדות | Holon; NLI 990022289060205171, Hed Arzi, [תשס"ב] | yt-PG7DTBsTlK4, 42:11 |
| מסע בארץ האותיות: לומדים א'-ב' | NLI 990022288410205171, Hed Arzi, [תשס"ב] | yt-TMqqGQoyZBc, 30:02 |

The last two are dated 1999 only by their uploader. Their cover text describes co-production programmes 67, 12 and 68, so those programmes link the tapes as excerpts. Erez Lutsky's "דומים ושונים" (yt-TIPNuXPEcUY, 44:40) could be a sixth tape or two programmes. The guide files it as a co-production upload awaiting identification.

## Newspaper listings

The NLI's digitised newspapers were searched through a search index, with 153 queries. Direct page requests returned HTTP 403, so only search snippets were read, and no page image was viewed. Each hit was mapped to an IETV number through the catalogue summary that the listing reproduces.

- A [Koteret Rashit feature of 7 September 1983](https://www.nli.org.il/ar/newspapers/kotert/1983/09/07/01/article/62) says the series starts "בעוד שבועיים", about 21 September. TMDB and Hebrew Wikipedia give 12 September.
- A [Ma'ariv page of 21 June 1985](https://www.nli.org.il/en/newspapers/mar/1985/06/21/01/article/366) prints 97 and 98 together and 92 on the same page. A [page of 26 July 1985](https://www.nli.org.il/en/newspapers/mar/1985/07/26/01/article/296) has 77 (S2E50). Both fit archive.org's season-2 order being the first-run order.
- [Hadashot of 31 December 1986](https://www.nli.org.il/en/newspapers/hadashot/1986/12/31/01/article/184) lists 152 (S3E18) at 08.30, during Hanukkah, although the Hanukkah programmes are S3E11 and S3E12.
- A [Ma'ariv page of 13 February 1987](https://www.nli.org.il/en/newspapers/mar/1987/02/13/01/article/289) lists 198, the Tu BiShvat special, and 170. Tu BiShvat fell on 14 February that year, which matches Avi Amitzur's "February 1987" label on yt-5V3Xds5ZJUw.
- Every titled listing from 1990 to 1992 is a rerun of a 1985 season-2 programme (111, 71, 116, 114).

The limits matter. Friday pages may cover several days, and the OCR is noisy. No titled listing turned up for archive.org S1E41-E65, so their first-run dates are unknown. The shared search budget ran out before IETV 124, 169 and 183-197 and co-production titles 2-70 were queried. Untitled slots from 1988 to 1992 cannot rule out first-run programmes after the 3 April 1988 finale that Hebrew Wikipedia reports, though no listing shows one. Yitzhak Halutzi's credit for directing "50 episodes" in 1988 is still unexplained.

## Queues

Fifteen uploads wait in the original-series queue: the five season-1 files and copies discussed above, the two possible copies of 133 and 178, forespec's three "יונה חולה" parts, OldTVIsrael's "קיפי המיוחד" (2 or 17), two AI-restored NAD Studios Hanukkah copies (8, 120, 142 or 196), Amital Feinstein's "מה מציירים" (leads 52 and 137) and the 1988 compilation. Five more sit in the classic queue because their production is not established. They include forespec's "שביר" parts, a weak lead for 190, and a 1991 Gulf War segment that is outside both documented productions. The audit JSON lists each with its candidate numbers.

## Open tasks

The audit JSON gives each task its id, status and affected record ids.

- `orig-s1-residual-order` and `orig-133-178`: watch the archive.org files against the NLI summaries.
- `orig-acquire-no-copy`: find any copy of 98, 122, 125, 129, 148 and the two season-1 numbers without a file. Leads include 199 YouTube playlist entries that are now removed (176) or private (23), most of them in OldTVIsrael's and Jordan Elpern-Waxman's Rechov Sumsum playlists.
- `orig-parts-only`: find whole copies of 46, 167 and 172.
- `orig-queue`, `orig-143-edition` and `orig-leads`: identify the queued uploads; check whether yt-xxd32WU1THc comes from 66 and yt-AlyEG_HPA7o from 97.
- `orig-season-boundary`: confirm the 130/131 boundary and first-run dates from an IETV or Kan ledger, the Israel State Archives files גל-18680/8, גל-18680/9 and גל-15454/9, or dated listings.
- `coproduction-acquire`, `coproduction-dates`, `arabic-version-titles` and `homevideo-list`.
- `classic-completeness-verification`: compare each whole candidate's opening, ending, runtime and credits with the NLI runtime or another reference before any completeness claim, and record the exact URL, date and evidence.

Acquisition and completeness are separate tasks. Finding a copy of a missing number does not make it complete.
