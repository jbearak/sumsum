# Library views, routes and storage

Read this before changing `library.template.html`. What the UI must preserve is in [AGENTS.md](../AGENTS.md#project-purpose). Display rules tied to the guide data are in [episode-guide.md](episode-guide.md): episode headings and the Catalogue title, the licensed service named on Watch labels, access lines, filters and notes, and the availability status the library reads.

## Views and routes

The library is used mostly by a parent playing videos for a baby, often one-handed, in short sittings with repeated favourites (AGENTS.md). Labels are plain; the research pages stay quiet.

The views nav has four items: Home, Episode guide, Browse and Starred. Phones also get Surprise in it: below 761 px the nav is a bar fixed to the bottom of the screen, and the masthead's Surprise button is hidden. The masthead's controls are Surprise, Queue, the theme button and the language toggle.

**Home** (`#/home`) is the start view when the guide exists; without a guide the library starts on Browse. It holds:

- Two stored preferences, Spoken (All languages, Hebrew, English) and Length (any, or up to 5, 10, 20 or 30 minutes). They are `sumsum-spoken` and `sumsum-length`. They shape what Home and Surprise offer, never the guide, and a Browse hash never changes them.
- **Up next.** This is the earliest core episode of one family not marked watched, with its best *offered* whole or alternate copy. A two-button switch on the card picks the family, Rechov Sumsum (the core productions of the goal series in `data/series.json`) or Sesame Street, stored as `sumsum-upnext`; without a stored choice, Spoken English starts on Sesame Street and anything else on Rechov Sumsum. When the chosen family has nothing to offer, Up next uses the other, presses its button and says so in one line.
  - **Offered:** not marked as needing a VPN, a card or a purchase, not failed or region-limited in a check, and within the preferences.
  - **Choosing the copy:** the copy is picked among the episode's offered copies, so a copy that isn't offered never hides one that is.
  - **When no episode fits:** Up next offers any offered video.
  - **Wording:** nothing says these videos play; most links are not test-played.
  - **Again:** when the last opened video is something else, the hero offers it again.
- **The queue and Again.** The queue card and the masthead's Queue popover show the queue. Again lists opened videos, last first, with their counts.
- **The characters.** Twelve characters, ranked by the entries tagged with them in the Spoken language, each opening Browse filtered by that character (with the preferences). Under All, the Hebrew side (everything that is not English only) and the English side take turns, so thousands of English Sesame Street videos never push Kippi and Oofnik off the row.
- **The shelves.** Starred shows every starred video with its real Watch shape. Songs and music shows offered videos only; under All, Hebrew and English songs take turns. "See all" opens the same Browse query and counts what it shows.
- **The production doors.**

**Surprise** picks a random offered video. On Browse and Starred it picks from the list on screen; elsewhere it uses the Home preferences. When a character filter is on, the heading names the character. The popover and the queue popover close on Escape, an outside click or a route change, and focus returns to their button. `data-start-seed` on `<html>` makes the picks repeatable for the checks.

**The queue** (`sumsum-sitting`) is a list for one sitting. Each video opens in its own tab: "Open next" is a real link to the first video, and after its click that video leaves the queue. Phones show a bar above the bottom nav with the next video.

**Browse** (`#/browse`) lists every upload with the filters. The old All uploads route, `#/uploads`, still lands there with its filters.

- **Spoken** goes by series (`spoken` in `data/series.json`): Rechov Sumsum and Elmo's talk show are Hebrew, Shalom Sesame and Sesame Street English, whatever a listing's recorded language says (the user, 2026-10-20; recorded values often name subtitles, as on the official "Hebrew with English Subtitles" uploads, or are missing, as on Hop). A recorded language that leaves out the series' own and names one other than Hebrew or English (Arabic, Russian) marks a dub, under Other languages. Each upload has one group.
- **Length** is one choice at a time: up to 5, 10, 20 or 30 minutes. A video without a known duration shows only under Any length.
- **An empty result** shows Oofnik's bin, drawn in CSS, with one button per active filter group. Each button gives the count that clearing that group alone would show.

**What is not found** is one quiet footer link, "Not found · N", to Missing episodes. That page links on to the other research pages:

- **Missing episodes** (`#/browse/missing`): documented episodes without a whole copy (missing, then parts or excerpts only), then expected places not identified yet. A production with more than eight seasons is one group per season, folded to its heading and count until opened.
- **Videos to identify** (`#/browse/unidentified`): uploads in a production's `unidentified` queue and uploads linked only as `possible` copies, by production. `?prod=` shows one production.
- **Identified videos** (`#/browse/identified`): every upload that is not awaiting identification, with the same filters.

Identified videos and Videos to identify together hold every upload. Both are defined from the guide data, never from durations.

The Research to-do page (`#/todo`, formerly To find) is linked from Missing episodes and Videos to identify. It holds the whole links to check by playback and the JSON export, whose file name and format still say `sumsum-to-find`. The export's `unidentified` list is the Videos to identify list; an upload linked only as a possible copy names its candidate episodes in `possibleCopyOf`.

"Awaiting identification" always means both kinds, queued and possible-only; the Browse facet chip for the queue alone is "In an identification queue". A link to Videos to identify counts what the page it opens lists.

The guide's coverage panel for core Rechov Sumsum sits at the end of the guide overview.

A production with more than eight seasons (Sesame Street, 56) shows one season at a time, chosen with a season picker and kept in the route as `?season=N` (dropped when the production changes; an unknown season falls back). Without a route season, the first shown is the season of the earliest unwatched episode with a whole link. Searches and filters span every season and show the matching seasons' tiles without strips (the Numbers layout keeps dimmed strips on the production's own page). The unscoped guide shows that same season, up to 12 tiles, with an "All N seasons" link; its "Show all" counts that season's episodes. Its numbers are zero-padded (`numberWidth`).

The episode page shows "About this episode" when the guide has details: the summary quoted in English with its source revision and licence, "Brought to you by" the sponsor letters and numbers, word on the street and guest stars. Upload rows inside a compilation or on a service listing say so, and every Watch label for such a copy adds "In a compilation" or "Opens a listing" (short labels: "compilation", "listing").

A production with no documented episode and no queued upload, known only by its total (the 1998 Arabic-dominant version), gets no door on Home and no rail entry or section in the guide. The coverage summary still names it, and its own route still opens.

## Entries and link order

Browse, Starred, Home's shelves, Again, Surprise and the queue show **entries**, one per episode or video, so an episode is never listed several times.

- **An episode entry** holds the counted copies of one episode: whole, alternate edition and parts. Its card is headed by the episode and opens its page.
  - Excerpts are other videos, and possible copies are unresolved, so neither joins it.
  - A record that is a counted copy of several episodes (a compilation) is an entry of its own, so a star or an open never stands for two episodes. When such a compilation is the copy an episode page's Watch button opens, its star and "+" act on the compilation's entry.
- **A video entry** is every other record. Records that are the same video on another page join it (the same host video id in the record's own link, such as one Vimeo video on two Hop! pages).
- **The research pages stay per upload:** Videos to identify, Identified videos, Missing episodes, record pages and the to-do export.

An entry's copies are ranked by `data/link-priority.json`, the user's order (2026-10-19). Each link falls into one tier, and the file ranks the tiers. Links that failed a check come after every tier.

- **How a link gets its tier** (`tierOf` in the template):
  - A licensed listing goes by its service: subscribed, library card, free with ads, or paid (buy, rent, or a subscription the user does not have).
  - A link needing the Israel VPN is `vpn`.
  - A region-limited free stream ranks with `free-with-ads`.
  - Anything else goes by host: archive.org, YouTube, Vimeo, or `other-free`.
- **How copies are sorted** (`copyKey`): usable before failed, then whole and alternate editions, parts, excerpts, then a copy of the episode alone before one inside a compilation before a service listing (`container`), then the tier, then official before community, then part number.
- **What uses the order:**
  - The Watch button and Up next open the first copy that fits.
  - A card shows the first copy that passes every active filter together, and names the other places once each ("Also on YouTube, Vimeo").
  - The episode page lists each role's copies in this order.
- **What counts as offered:** services with `subscribed: true` count as offered, like free links. Library-card, free-with-ads and paid listings and links needing the VPN do not.
- **Stars:** an entry is starred by its own key (`ep:<episode id>`, or a video's record key) or by a star on any of its copies. Unstarring the entry clears both. Record pages and episode upload rows still star one upload.
- **Opens:** summed over an entry's copies.
- **The queue:** stores the exact link chosen (a record key), so a queued part stays that part. It is named by its entry.
- **Again:** reopens the copy opened last.

## Evidence display

Evidence is said in words, never with a graphic. The levels are "Details checked, not test-played" (metadata checked, which every linked episode has), "Seen to play" (playback started), "Checked in full" and "Compared with a reference", and "Nothing to check yet" without an upload. Guide tiles, and List rows on phones (where the Evidence column is hidden), show a text badge only above the first level. The List's Evidence column and the episode page's tag name every level; the episode page keeps its ladder, with "Now" at the level. Production pages summarise the levels with counts, and the legend explains each in one line. Evidence wording never says "watched": it is about what the project checked, not about the user's own Watched marks.

## Browser storage

The file works without a server and opens playback on the original host. Stars, pasted Vimeo links and watched marks live in local storage; [AGENTS.md](../AGENTS.md#files-and-build) says how to keep them. The JSON backup controls are in the library's "About, evidence levels and backup" section.

Two more personal stores sit beside them:

- `sumsum-opened` holds how often each video was opened and when last, keyed like stars: `{key: {n, last}}`.
  - **What counts:** a primary or middle click on a Watch link on a viewing surface (Home, Browse and Starred cards, guide tiles and List rows, the episode page). Research lists and record pages don't count.
  - **What it isn't:** opening is not watching. Watched marks stay manual and per episode, and evidence never reads opens.
  - **Re-rendering:** a view that shows opens re-renders after a deferred timer, so the clicked link is still in the page when the browser follows it.
- `sumsum-sitting` holds the queue for a sitting: an ordered list of record keys.

The backup (`sumsum-direct-links-v1`) carries both, as `opened` and `sitting`. An import validates each entry and merges, keeping the higher count and the later date and appending queued items without repeats, so importing the same backup twice changes nothing.

The UI preferences live in local storage too, as `sumsum-language`, `sumsum-theme`, `sumsum-appearance`, `sumsum-guide-layout` (the guide's Album, Numbers or List layout; `data-start-layout` overrides it), `sumsum-spoken` and `sumsum-length` (Home's preferences), and `sumsum-upnext` (Up next's family). The backup leaves them out, because it holds what the user collected (pasted links, stars, watched marks, opens and the queue), not how the page looks.

## Themes and appearance

The round palette button before the language toggle opens the theme picker. Its Theme group has six palettes: Terracotta, the default, then Stone, Sea, Sage, Kippi and Bauhaus. Its Appearance group has System, Light and Dark. A choice applies at once. The button has the same size and place in English and Hebrew at every width.

An inline script at the end of `<head>`, `#prefs-boot`, sets `data-palette`, `data-appearance` and `data-scheme` on `<html>` before the first paint, so the page never shows the default palette first. A second one, `#lang-boot`, right after the language toggle, checks the stored language's option the same way, so a Hebrew page never first shows English checked. The toggle is a radio group: activating the unchecked option or an arrow key switches the language, and activating the checked one changes nothing. A stored value that is not a listed name falls back to the default. The script reads the ids of the earlier palettes, `green`, `blue`, `plum`, `sunny` and `graphite`, as `sage`, `sea`, `kippi`, `stone` and `bauhaus` (its `RENAMED` map), and leaves the stored id until the next choice. Under System, `data-scheme` follows `prefers-color-scheme`, and it changes when the system scheme does. The script also keeps `<meta name="color-scheme">` and `<meta name="theme-color">` in step; under System the first is `light dark`, and the second is always the masthead colour. Tests and probes can set `data-start-palette` and `data-start-appearance` on `<html>` to override the stored values, as `data-start-lang` does.

Every colour in the stylesheet is a custom property in the token rules at its top. Other rules use only `var(--…)`, `transparent` and, under forced colours, system colours. The tokens come in two layers.

- Scheme tokens are shared by every palette, so a coverage mark or an access mark means the same thing in each one. They sit in the rules that set `color-scheme`: `:root` for light and `:root[data-scheme=dark]` for dark. They hold the coverage colours (`--whole`, `--parts`, `--excerpt`, `--missing`, `--unknown` and their `-bg` tints), the access marks (`--acc-*`), the series inks (`--ser-*`), the star and the thumbnail overlays.
- Palette tokens hold the surfaces, inks, lines, buttons, accent stripe, focus ring, links, chips, shadows and masthead (`--brand` and the `--mast-*` controls). Terracotta's are on `:root` and `:root[data-scheme=dark]`.

Every palette keeps its buttons, links and focus rings clear of the four status colours (whole, parts, excerpt, missing), in normal vision and under simulated protanopia and deuteranopia. Buttons and their hover colours are CIEDE2000 11 or more from each mark, and links and focus rings 10 or more. In normal vision, buttons, links and focus rings are also 10 or more from the licensed-access teal (`--acc-lic`), so no palette has turquoise or aqua buttons. Under simulated colour-vision deficiency some pale and blue buttons come closer to the teal than that. Chips are 4.5 or more (OKLab, ×100) from every coverage tint. All six palettes share the link and focus colours.

To add a palette NAME:

1. Add a light rule, `:root[data-palette=NAME],.tp-sw-NAME{…}`, that defines every palette token. Terracotta's light rule lists them. Add a dark rule, `:root[data-palette=NAME][data-scheme=dark],[data-scheme=dark] .tp-sw-NAME{…}`, that defines at least the tokens Terracotta's dark rule sets. The `.tp-sw-NAME` selectors colour the palette's swatch in the picker. A palette may override a shared token, but only in both rules. The palettes other than the default tint `--unknown` and `--unknown-bg` to their surfaces this way.
2. Add NAME to `PALETTES` in `#prefs-boot`, in the order of the rules.
3. Add `pal_NAME` to the English and Hebrew strings.
4. Rebuild and run `node scripts/check-library.cjs`. It fails if a palette lacks a token or sets an unknown one, if the script or the strings miss a palette, or if a colour appears outside the tokens. It also fails if a key pair falls below WCAG contrast in any palette and scheme: 4.5:1 for text, 3:1 for marks, rings and outlines. A failure lists each pair below its minimum, with its palette, scheme, tokens and ratio.
5. Look at the guide, Browse and an episode page in a browser, light and dark, in English and Hebrew. The checker measures contrast but not the colour distances above, so measure those yourself.
