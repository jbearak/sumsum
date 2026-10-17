# Sesame video inventory research

Reviewed on October 17, 2026. The catalog file is `data/sesame-records.json`.

## Coverage

The file contains 463 distinct public YouTube upload links. These are upload records, not a claim of 463 unique stories. Duplicate uploads, edits, opening songs and numbered episode parts remain separate because each has its own playable page.

| Series grouping | Uploads |
| --- | ---: |
| Classic Rechov Sumsum, including 1990s Rechov Sumsum / Shara Sumsum | 153 |
| Classic Shalom Sesame | 53 |
| Modern Shalom Sesame | 257 |
| Total | 463 |

The 257 uploads sourced from the official [Shalom Sesame channel](https://www.youtube.com/@shalomsesame/videos) were enumerated through all public Videos-tab continuation pages. That channel's own description identifies Shalom Sesame as a Sesame Workshop production introducing children to Jewish culture, Hebrew and Israel. Its public channel ID is `UC2LHpDZUvDiWgaDTFj7rtRw`.

The remaining 206 links are community uploads. Every one has `sourceType: "community"`, a named uploader, a source page and a note that the uploader is not verified as the rights holder. This includes the public archives [IBA Classics](https://www.youtube.com/channel/UC3nW8YmiU4YAYbn6f9ME2pg/videos), [OldTVIsrael](https://www.youtube.com/channel/UCW0-3CFoKonUiyxwUtvln7w/videos), [Edward Bernstein](https://www.youtube.com/channel/UC4wiht0uuar1-DRXbKtPYPQ/videos), [nostalgiateenable](https://www.youtube.com/channel/UCqmElXzj7huxbWQlfpEkH7g/videos), [Dinostalgic](https://www.youtube.com/channel/UCTcDw7ch9m1NftYSREWeKlQ/videos), and individual uploads returned by public YouTube search. IBA Classics explicitly says in its channel description that it is not Kan. The catalog does not present that channel as an official broadcaster.

## Classification and evidence

There are 118 episode uploads, 339 clips or partial uploads, and 6 collections. Episode classifications use the uploader's episode label and listed duration; the catalog does not assert that every recording contains an uncut broadcast master. A community episode note explains that completeness has not been checked against a master copy. Records with a numbered part or an explicit partial label are clips even when they are long.

A useful example of the distinction is the official [Shabbat Shalom, Grover! (Full Studio)](https://www.youtube.com/watch?v=ucEIPOxR-bs). YouTube lists it as 8 minutes 36 seconds. It is indexed as a studio-story clip, not a complete television or DVD episode. The official [Mitzvah on the Street](https://www.youtube.com/watch?v=yYr7eRCeG1E), at 9 minutes 23 seconds, is also a clip. All 257 current official-channel uploads are under ten minutes.

Official uploads explicitly titled classic are grouped as classic Shalom Sesame. Examples are [Classic Shalom Sesame Opening](https://www.youtube.com/watch?v=b4f3swZmLiI), [Classic Mischpacha, The Family Song](https://www.youtube.com/watch?v=OfexSD2WuBA), and [Classic Ernie and Cookie Monster Bake a Cake](https://www.youtube.com/watch?v=jhB9IGsiAi4). Other uploads on that channel are grouped with the modern Shalom Sesame publishing series. These clips can reuse earlier Sesame material, so the grouping should not be read as a claim about the production year of every shot.

Examples of community episode pages are [Kippi Builds a Menorah](https://www.youtube.com/watch?v=OmucnvCpbYU), [Shalom Sesame, classic episode 1](https://www.youtube.com/watch?v=XCsTpvlCBa8), and [Shalom Sesame, classic Passover](https://www.youtube.com/watch?v=gtlmeDpjmq4). The two parts of the modern [Missing Menorah, part 1](https://www.youtube.com/watch?v=tGW3jDoiJvA) and [part 2](https://www.youtube.com/watch?v=ozg5XXchlEs) are indexed as partial uploads.

English translations of Hebrew titles are catalog translations. Original Hebrew upload titles remain in `titleHe`. English upload titles remain in `originalTitle`. Themes and characters are conservative editorial tags based on titles and any accessible publisher description. An absent tag does not mean a character or topic is absent from the video. Avigail examples include the official [Avigail Grows a Tree](https://www.youtube.com/watch?v=y3UDxfqINSg), [Avigail and Rabbi Lau](https://www.youtube.com/watch?v=NHzK7Y84eX8), and [Avigail and Brosh Explain Hachnasat Orchim](https://www.youtube.com/watch?v=UsrFqX0JnCI).

## Verification and limits

For every included record, public YouTube channel or search metadata supplied an actual video ID, watch-page URL, title, uploader and listed duration. The file was checked for unique IDs, valid YouTube watch URL syntax, English `titleEn` values and consistent required fields. Every record has a duration. No media files were downloaded.

Automated watch-page access encountered YouTube's sign-in/bot interstitial and then HTTP 429 responses. Nine publisher descriptions were available before the rate limit. These challenges do not establish that a video is unavailable to an ordinary signed-in browser. The catalog's verification text therefore says that metadata was checked and playback was not individually tested. The older indexed Kan video `n-W-9uKrBh0` returned an unavailable result and was omitted.

The catalog is broad but not exhaustive across all historical uploads or private collections. All 3,005 publicly listed videos in the Dinostalgic channel were enumerated. Thirty-one titles matched Sesame, of which one mixed-program broadcast was excluded; matching Sesame uploads were included. Region availability, removals, embedding permissions and playback remain subject to each publisher. Unlisted Hop/Vimeo discovery and VPN setup belong to the separate Hop collection workflow.

## Follow-up completeness audit

A second pass ran twelve targeted public YouTube metadata searches, with up to twenty results per title, for the modern titles Welcome to Israel; Chanukah: The Missing Menorah; It's Passover, Grover!; Grover Plants a Tree; The Sticky Shofar; Monsters in the Sukkah; Countdown to Shavuot; Grover Learns Hebrew; Be Happy, It's Purim!; Mitzvah on the Street; Adventures in Israel; and Shabbat Shalom, Grover! These searches found no additional unambiguously modern single-upload episode longer than twenty minutes. This is a search result, not evidence that no such upload exists anywhere. The modern [Missing Menorah part 1](https://www.youtube.com/watch?v=tGW3jDoiJvA) and [part 2](https://www.youtube.com/watch?v=ozg5XXchlEs), listed at 15:00 and 12:37, remain separate partial uploads. Only [Welcome to Israel part 2](https://www.youtube.com/watch?v=iuUHBFIbiRc), listed at 12:39, was found from that split upload.

All 463 records now carry `completenessStatus` and `completenessNote`. Among the 118 episode records, 42 have an explicit episode/full/show label in the original uploader title, and 76 use a long-form series title and runtime inference. Neither label certifies an uncut master. Duplicate editions demonstrate the issue: [Aleph-Bet Telethon from Sybil Kibble](https://www.youtube.com/watch?v=Yo365rmez08) is listed at 29:26, while [the Nostalgia_ChannelTV upload](https://www.youtube.com/watch?v=aCe9MfpAtqk) is 37:44 and [Edward Bernstein's episode 9](https://www.youtube.com/watch?v=trl8wZ4zDIA) is 38:21. The catalog preserves each actual upload and discloses uncertainty instead of treating those different runtimes as equivalent proof of completeness. Explicitly partial or numbered uploads remain clips.
