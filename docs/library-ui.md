# Library views, routes and storage

Read this before changing `library.template.html`. What the UI must preserve is in [AGENTS.md](../AGENTS.md#project-purpose). Display rules tied to the guide data are in [episode-guide.md](episode-guide.md): episode headings and the Catalogue title, the licensed service named on Watch labels, access lines, filters and notes, and the availability status the library reads.

## Views and routes

The views nav has three items: Episode guide, Browse and Starred.

Browse (`#/browse`) lists every upload with the filters. The old All uploads route, `#/uploads`, still lands there with its filters. The arrow beside Browse opens a menu of three pages:

- **Identified videos** (`#/browse/identified`): every upload that is not awaiting identification, with the same filters.
- **Videos to identify** (`#/browse/unidentified`): uploads in a production's `unidentified` queue and uploads linked only as `possible` copies, by production. `?prod=` shows one production.
- **Missing episodes** (`#/browse/missing`): documented episodes without a whole copy (missing, then parts or excerpts only), then expected places not identified yet.

Identified videos and Videos to identify together hold every upload. Both are defined from the guide data, never from durations.

The Research to-do page (`#/todo`, formerly To find) is linked from the footer and from the Videos to identify and Missing episodes pages. It holds the whole links to check by playback and the JSON export, whose file name and format still say `sumsum-to-find`. The export's `unidentified` list is the Videos to identify list; an upload linked only as a possible copy names its candidate episodes in `possibleCopyOf`.

"Awaiting identification" always means both kinds, queued and possible-only; the Browse facet chip for the queue alone is "In an identification queue". A link to Videos to identify counts what the page it opens lists.

## Evidence display

Evidence is said in words, never with a graphic. The levels are "Details checked, not test-played" (metadata checked, which every linked episode has), "Seen to play" (playback started), "Checked in full" and "Compared with a reference", and "Nothing to check yet" without an upload. Guide tiles, and List rows on phones (where the Evidence column is hidden), show a text badge only above the first level. The List's Evidence column and the episode page's tag name every level; the episode page keeps its ladder, with "Now" at the level. Production pages summarise the levels with counts, and the legend explains each in one line. Evidence wording never says "watched": it is about what the project checked, not about the user's own Watched marks.

## Browser storage

The file works without a server and opens playback on the original host. Stars, pasted Vimeo links and watched marks live in local storage; [AGENTS.md](../AGENTS.md#files-and-build) says how to keep them. The JSON backup controls are in the library's "About, evidence levels and backup" section.

The UI preferences live in local storage too, as `sumsum-language`, `sumsum-theme`, `sumsum-appearance` and `sumsum-guide-layout` (the guide's Album, Numbers or List layout; `data-start-layout` overrides it). The backup leaves them out, because it holds what the user collected (pasted links, stars and watched marks), not how the page looks.

## Themes and appearance

The round palette button before the language toggle opens the theme picker. Its Theme group has six palettes: Green, the default, then Blue, Plum, Terracotta, Sunny and Graphite. Its Appearance group has System, Light and Dark. A choice applies at once. The button has the same size and place in English and Hebrew at every width.

An inline script at the end of `<head>`, `#prefs-boot`, sets `data-palette`, `data-appearance` and `data-scheme` on `<html>` before the first paint, so the page never shows the default palette first. A second one, `#lang-boot`, right after the language toggle, checks the stored language's option the same way, so a Hebrew page never first shows English checked. The toggle is a radio group: activating the unchecked option or an arrow key switches the language, and activating the checked one changes nothing. A stored value that is not a listed name falls back to the default. Under System, `data-scheme` follows `prefers-color-scheme`, and it changes when the system scheme does. The script also keeps `<meta name="color-scheme">` and `<meta name="theme-color">` in step; under System the first is `light dark`, and the second is always the masthead colour. Tests and probes can set `data-start-palette` and `data-start-appearance` on `<html>` to override the stored values, as `data-start-lang` does.

Every colour in the stylesheet is a custom property in the token rules at its top. Other rules use only `var(--…)`, `transparent` and, under forced colours, system colours. The tokens come in two layers.

- Scheme tokens are shared by every palette, so a coverage mark or an access mark means the same thing in each one. They sit in the rules that set `color-scheme`: `:root` for light and `:root[data-scheme=dark]` for dark. They hold the coverage colours (`--whole`, `--parts`, `--excerpt`, `--missing`, `--unknown` and their `-bg` tints), the access marks (`--acc-*`), the series inks (`--ser-*`), the star and the thumbnail overlays.
- Palette tokens hold the surfaces, inks, lines, buttons, accent stripe, focus ring, links, chips, shadows and masthead (`--brand` and the `--mast-*` controls). Green's are on `:root` and `:root[data-scheme=dark]`.

To add a palette NAME:

1. Add a light rule, `:root[data-palette=NAME],.tp-sw-NAME{…}`, that defines every palette token. Green's light rule lists them. Add a dark rule, `:root[data-palette=NAME][data-scheme=dark],[data-scheme=dark] .tp-sw-NAME{…}`, that defines at least the tokens Green's dark rule sets. The `.tp-sw-NAME` selectors colour the palette's swatch in the picker. A palette may override a shared token, but only in both rules. The palettes other than Green tint `--unknown` and `--unknown-bg` to their surfaces this way.
2. Add NAME to `PALETTES` in `#prefs-boot`, in the order of the rules.
3. Add `pal_NAME` to the English and Hebrew strings.
4. Rebuild and run `node scripts/check-library.cjs`. It fails if a palette lacks a token or sets an unknown one, if the script or the strings miss a palette, or if a colour appears outside the tokens. It also fails if a key pair falls below WCAG contrast in any palette and scheme: 4.5:1 for text, 3:1 for marks, rings and outlines. A failure lists each pair below its minimum, with its palette, scheme, tokens and ratio.
5. Look at the guide, Browse and an episode page in a browser, light and dark, in English and Hebrew.
