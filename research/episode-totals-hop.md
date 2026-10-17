# Hop episode totals and coverage audit

Checked October 17, 2026 against `data/hop-records.json` and `data/hop-youtube-records.json`. The machine-readable findings and record-level checklist are in [hop-episode-audit.json](../data/hop-episode-audit.json). This is research and a to-do list. It changes no library classifications, source records, or VPN settings and downloads no media.

## What can be counted now

| Production | Evidence for total produced | Current distinct identities | Whole-program coverage supported now |
|---|---|---|---|
| Modern core, 2006 reboot | 40 announced episodes, contemporary secondary reporting | No mapped whole-program identities; one related guest extract has a Vimeo title naming 2006 | 0 independently verified full broadcasts; forty announced slots remain missing or unverified |
| Modern core, 2009 season | 28 announced episodes in a Hop statement preserved by another site | 17 named narrative assets, plus related guest/song extracts | 0 independently verified full broadcasts; the 17 web numbers are not mapped to canonical broadcast episodes |
| Modern core, 2012 production / 2013 broadcast | 15 in the 2013 regulator's annual accounting; total commission unresolved | 15 named narrative assets | 0 independently verified full broadcasts; verify the current assets rather than claiming either 15 full programs or 15 missing programs |
| Discovering Curiosity, 2015 | Total commission unresolved | 12 narrative assets, 13 vocabulary shorts, 2 riddles in the Hop group | These 27 files cannot be counted as 27 core episodes |
| Israeli Elmo talk show, 2022 first season | 14 filmed and broadcast programs, contemporary secondary finale report; official listing corroborates 14 guest identities | 14 guests represented by 28 host rows, with one alternate-host match still uncertain | 14 whole-upload candidates; 0 independently checked complete broadcasts |
| Word of the Day 2023 | Eight current numbered installments; lifetime production denominator unresolved | 8 identities represented by 16 episode host rows, plus 1 compilation | Eight official per-video claims of complete short-series installments; zero core magazine episodes |

There is no verified combined production total for modern core Rechov Sumsum. Summing 40, 28, annual accounting counts, and current web assets would mix different kinds of evidence and omit the unresolved 2015 denominator. The audit leaves that total null.

## Sources and denominator limits

The [2006 Council for Cable TV and Satellite Broadcasting report, printed page 141](https://www.gov.il/BlobFolder/reports/moatsa2006/he/%D7%93%D7%95%D7%97%202006%20%D7%9E%D7%95%D7%A2%D7%A6%D7%94.pdf) records ten Rechov Sumsum episodes in that year's accounting, a fifteen-minute episode figure, and first transmission on December 16. That annual count is not the complete season commission. A [November 2006 Jewish Week/JTA report](https://www.jta.org/2006/11/17/ny/open-sesame), based on interviews with Sesame Workshop executives, says the new program will have forty episodes. [World Screen's contemporary trade report](https://worldscreen.com/sesame-street-returns-to-israel/) independently reports forty. These are labelled secondary fallbacks. The original producer delivery inventory has not been recovered.

The [December 2009 TVNetil text](https://www.tvnetil.net/report/3268/) explicitly introduces its text as a statement from Hop and gives twenty-eight episodes for the new season. This is a producer-origin press statement reproduced on a third-party site. It is stronger than inferring a total from current web clips, but it is not an original hosted producer inventory. The [2010 regulator report, printed page 67](https://www.gov.il/BlobFolder/reports/moatsa2010/he/%D7%93%D7%95%D7%97%202010%20%D7%9E%D7%95%D7%A2%D7%A6%D7%94.pdf) records sixteen episodes in its annual accounting, with a net episode figure of 16.51 and a footnote granting 64% local-production recognition because the program mixes non-local material. Neither sixteen nor the accounting hours establishes the total season production.

The [2013 regulator report, printed page 139](https://www.gov.il/BlobFolder/reports/moatsa2013/he/%D7%93%D7%95%D7%97%202013%20%D7%9E%D7%95%D7%A2%D7%A6%D7%94_0.pdf) records fifteen Rechov Sumsum 2012 installments and first broadcast on January 13, 2013. Its nine-minute figure is regulatory net time. It is not evidence that every currently uploaded file contains all international inserts or the complete broadcast. Direct PDF reads returned access errors; the tables were available through indexed primary-document text.

[Ministry of Education material](https://meyda.education.gov.il/files/PreSchool/Word-of-the-day.pdf) recognizes Discovering Curiosity narratives and vocabulary material. A [reproduced 2015 Ministry of Science announcement](https://www.israel.agrisupportonline.com/news/csv/csvread.pl?mytemplate=tp2&show=5502) describes new episodes in that season. Neither provides a commissioned count. The current [Hop index](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) interleaves two independently numbered sequences under the curiosity group. Treating its 27 files as 27 programs would double-count vocabulary units as narratives and include riddles.

For Israeli Elmo, the [official dedicated collection](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/) lists fourteen guests. An [October 2022 Israel Hayom season-finale review](https://www.israelhayom.co.il/culture/tv/article/13225897) explicitly says fourteen programs were filmed and aired. The indexed source body explicitly included the short phrase "ב-14 התוכניות שצולמו ושודרו בשבועיים האחרונים". A direct reader can return only the page shell, so the access method is recorded as indexed source-body retrieval. The reported first-season denominator is therefore fourteen with a secondary source, corroborated by the primary guest listing. Hop/Vimeo versions run 7:41 to 10:10. Runtime and generic collection-page wording alone do not establish complete broadcast status for each hosted asset.

The [official full-episodes playlist](https://www.youtube.com/playlist?list=PLZmhDCZt0d9ZJrRk1IXupzomu3o-pm0Gv) contains eight Word of the Day numbered titles explicitly labelled full episodes and an all-episodes compilation. That supports eight complete short-installment claims in the current published run. It is not an independently documented lifetime production count, and a compilation is not a ninth episode. The [Home video](https://www.youtube.com/watch?v=fqEOjxQP7No) is explicitly episode eight, rather than evidence that the core magazine program had only eight episodes.

## Identity checks and source inconsistencies

All 237 input host records are accounted for in the JSON. Certain alternate-host episodes share one identity. The audit's aggregate count of 211 provisional content identities includes ordinary clips and compilations, and is not an episode total. Some similar clips may overlap without sufficient evidence for a merge.

The Elmo candidates have fourteen guest identities. Thirteen YouTube counterparts explicitly name those same guests. The remaining [YouTube upload](https://www.youtube.com/watch?v=-ajWXnyBJ5I), catalog record `hop-yt--ajWXnyBJ5I`, omits the guest name. It probably corresponds to `hop-4908`, Guri Alfi: the playlist position and four-second duration difference match the other host pairs. That match remains unconfirmed and does not become a fifteenth known guest.

Source numbers must not manufacture missing episodes:

- `hop-10327`, Amalia Douek, and `hop-10325`, Kobi Oz, both have Hop tile number eight. Kobi's saved Hoptv Vimeo title explicitly supplies number nine, while Amalia's supplies eight. The audit preserves both source values and uses the guests as identities.
- `hop-9747`, the hospital installment of We love you, Elmo, has Hop tile number six but Vimeo title number five. This does not prove an additional missing fifth installment.
- `hop-10439`, Pass it on, has Hop tile number five but Vimeo title number three. The recycling sequence has no observed Vimeo number seven, but a numbering gap does not prove a missing produced episode.

## Other current short-series and segment inventories

These counts describe the material catalogued now, with lifetime production totals unresolved:

| Group | Known Hop identities | Interpretation for whole-program audit |
|---|---:|---|
| Older Word of the Day | 25 | Vocabulary segments, not core broadcasts |
| Curiosity vocabulary | 13 | Separate sequence from the twelve curiosity narratives |
| Curiosity riddles | 2 | Segments |
| We love you, Elmo | 5 | Complete-upload candidates; three also have clear YouTube counterparts; source numbering conflicts |
| A makeover in the bin | 10 | Recycling segments; possible numbering gap unresolved |
| Months of the year | 12 | Named monthly upload candidates; twelve topics do not independently prove the total produced |
| School of health | 5 | Numbered short segments; complete-program boundaries unverified |
| Hop! I know | 6 | Short activity segments |
| Time to solve | 2 | Short segments |
| Road safety | 4 | Segments |
| Sesame stories current group | 3 | Short clips, not proof of coverage of the earlier complete Sesame Stories television production |
| Children interviews | 14 | Interviews, excluded from main-program denominator |

Songs, guest appearances, compilations, the puppy special, and other official YouTube inserts remain separate content records. They do not increase the core episode count. The twenty-six-minute puppy upload remains a whole-special candidate in the source catalog, but this bounded audit does not establish its original complete program master.

## To-do order

1. Obtain a producer or rights-holder canonical season inventory for the 2006, 2009, 2012/2013 and 2015 core productions. The 2012 and 2015 commissioned totals remain unresolved.
2. Map the current seventeen 2009 and fifteen 2012 narrative assets to original broadcast identities. Check program boundaries and inserts. Do not call eleven 2009 episodes missing merely by subtracting seventeen stories from twenty-eight broadcasts.
3. Check the fourteen Elmo candidates for complete openings, interview/show structure and endings, or compare with a producer delivery guide. Resolve the unnamed YouTube guest.
4. Obtain an explicit Word of the Day 2023 production inventory. Current published-run coverage is eight of eight named short installments, with alternate hosts counted once.
5. Resolve short-series denominator and numbering tasks listed per production in the JSON. These unknowns are tasks, rather than invented totals or guessed video links.

The JSON includes stable catalog IDs, exact source and viewing URLs, record-level evidence categories, source-number anomalies, and one count-based canonical-inventory acquisition task each for the forty and twenty-eight announced seasons. It creates no invented ordinal episode rows and does not assert a mapping to website episode numbers.
