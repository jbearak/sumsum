# UI brainstorm, round 2

Author: Claude (Opus), 2026-10-18. Brainstorm only; nothing here is decided or built.

Inputs: `AGENTS.md`, `docs/library-ui.md`, [brief.md](brief.md), the round 1 notes, and screenshots at 1280 px of `design/mockups/1-living-room.html` (home, Browse, episode page) and `design/mockups/4-programme-guide.html` (Album, episode entry). The Terracotta tokens are from the top of `library.template.html`.

## What the two picked mockups get right

### Living Room

- The picture leads. The Up next card is a 16:9 still with the duration in the corner, the title in English, the Hebrew title beneath it and the NLI summary quoted in Hebrew. You can choose without reading anything else.
- Shelves are saved queries. "Short ones, up to 10 minutes", "Songs and music" and "Elmo's talk show" are rows of the same card, each with "See all 84" leading to Browse with those filters set.
- Characters are buttons. The round portraits (real thumbnails, cropped) with English and Hebrew names are the most playful thing in either mockup, and they double as the Character facet in Browse, with counts.
- The Watch button names its destination: "Open on Vimeo", "Open on Internet Archive". The access line beneath it ("Vimeo · direct link, playback not tested") is short.
- Browse's facets are grouped and short: Who's in it, How long (as chips: Up to 5 min 76, Up to 10 min 132), Program type, Language spoken, Where it plays.

### Programme guide

- The episode is the object. Each tile carries its catalogue number ("No. 167"), a coverage word ("Parts only", "Whole candidate", "No whole copy"), and a line saying what hangs from it ("3 linked parts", "2 possible copies, not counted", "4 whole / alternate copies").
- The production rail on the left keeps your place across fourteen productions without a 12,000 px page.
- The episode entry splits into "Copies attached to this episode" (the decision) and "Identity & sources" (the dossier). The evidence ladder is a plain list with "Now" beside the current level.
- Typography has character: a serif display face for titles, monospace for numbers and eyebrows. It looks like a printed TV guide.
- Album, Numbers and List each say what they are for ("Album · choose by picture").

### What to drop from both

- Taglines and pitch copy: "Video links for the family", "A video-link library", "Find the episode you remember.", "What shall we watch?", "Who do you want to see?", "One entry per programme. Every copy, part and source stays connected to it.", "THE ANNOTATED PROGRAMME GUIDE". Headings become plain labels: "Up next", "Characters", "Under 10 minutes", "The original series".
- Research as a destination: Living Room's "Research room" nav entry and Programme guide's "Read uncertainty" links. What couldn't be found goes into one small, quiet place (idea 14).
- Living Room's repeated access line under every card on Home. On shelves, the button's destination is enough; the access line can wait for the episode page and Browse.
- Programme guide's "Editorial English title" note under every tile. Say it once, in the dossier and in the guide's key.

### What to carry forward

From Living Room: the picture-first card, shelves as saved queries, character portraits as filters, the destination-first Watch button, "Another one", and the How long chips. From Programme guide: the episode as the organising object with uploads hanging from it, the production rail, the decision/dossier split, the serif-plus-mono type, and the Album/Numbers/List switch.

## Constraints the fun ideas work within

- Every colour is a token. `--whole`, `--parts`, `--excerpt`, `--missing` and `--acc-lic` mean coverage and licensed access only, so no decoration uses them, and nothing decorative is green, amber, violet, red or teal enough to be mistaken for them. Elmo is red and Kippi is honey, so characters get their colour from their real thumbnails, and their drawn parts use `--brand`, `--accent`, `--ink`, `--surface-*` and `--primary`.
- Evidence stays in words. Stickers, beads and tickets are for personal marks (Watched, Starred, Tonight) and are labelled that way; none of them stands for an evidence level.
- Random picks (dice, character picks, shuffle) draw only from uploads that would earn a Watch button: never a `possible` copy, never a failed availability check, and by default only what plays under the user's "How you watch" setting.
- Motion is CSS transitions and small keyframes, and all of it collapses to an instant change under `prefers-reduced-motion: reduce`. Nothing loops on its own while you read.
- Zen is Firefox-based, so `ui-rounded` doesn't work there. Display faces need a stack that degrades: `"Arial Rounded MT Bold", ui-rounded, var(--font)` for Latin, and `"Arial Hebrew", "Noto Sans Hebrew"` for Hebrew, both available on macOS. Embedding a font is possible but adds weight to a file that is already large.
- No copyrighted artwork. Characters appear as real thumbnails cropped into shapes, or as type and CSS shapes that suggest a trait (quills, a bin lid) without copying a design.

## Ideas

### 1. Character tokens

**Looks like.** Living Room's round portraits, each in a frame shaped for the character. Kippi's frame has a ring of short honey quills, made with a `conic-gradient` mask in `--accent` around the thumbnail crop. Moishe Oofnik's portrait sits inside a squat bin shape (a rounded rectangle with a lid line in `--line-strong`). Elmo, Grover, Cookie Monster and the Muppets without a frame motif get a plain round frame. Under each: English name, Hebrew name in smaller type, and the dynamic count in a mono pill ("169").

**Behaves.** Tap to filter by that character; tap two to see both ("Kippi and Oofnik · 38"). The selected token sits slightly raised with a `--primary` ring. On hover the frame turns a few degrees, and under reduced motion it doesn't. Counts change with the other filters, and a token with 0 fades to `--muted` but stays tappable, so the empty state (idea 13) can explain.

**Builds on.** Living Room's "Who's in it" portraits.

### 2. A character picks for you

**Looks like.** A small "Pick" button on each character token's back, or a long-press on the token. The chosen card slides up from behind the token, with a speech-bubble label in the character's voice, kept to one short line: Kippi "!זה", Oofnik "Fine. This one."

**Behaves.** Picks one upload at random from the current filters plus that character. "Another" sits in the bubble. The bubble's text is editorial and fixed, two or three lines per character, in both languages, never generated. Under reduced motion the card appears in place without the slide.

**Builds on.** Living Room's "Another one" button and portraits.

### 3. Hebrew-numeral dice

**Looks like.** A die in the masthead or the filter summary bar, drawn in CSS 3D (six faces with `transform-style: preserve-3d`), with faces א ב ג ד ה ו in English mode as well, because that's the fun of it. Beside it, plain text: "Roll · 84".

**Behaves.** Rolls within the current filters. The die tumbles for about 600 ms, lands, and the result opens as a card over the page with "Open on Vimeo" and "Roll again". The landed face is decoration only; the pick is uniform over the filtered set. Reduced motion: the face changes without the tumble. Keyboard: R when focus isn't in a text field.

**Builds on.** "Another one", generalised to any Browse filter set.

### 4. Channel dial for productions

**Looks like.** Programme guide's production rail turned into a rotary TV knob: a ring of fourteen detents around a knob in `--surface-3`, with the current production's name and years in the window above it and the Hebrew name beneath. Each detent has a short label (1983, 1998, 2006, 2009, Shalom, Elmo…).

**Behaves.** Drag or scroll the knob, or use arrow keys, and it clicks from detent to detent. The guide below changes production, with a short static-noise crossfade (CSS noise from a repeating radial gradient, 150 ms). It's an ARIA slider with named values. On phones it becomes a horizontal strip of the same labels that scrolls with snap. A plain list view of the rail is one click away for anyone who prefers it.

**Builds on.** Programme guide's production rail.

### 5. House-number Numbers view

**Looks like.** Programme guide's Numbers view as house-number plaques on a wall: each IETV programme number in a small enamel-style plaque (mono figures, `--surface` on `--line-strong` border, a rounded rectangle with two dot "screws"). The coverage word is a small band along the bottom of the plaque in its coverage colour and tint (`--whole-bg` with "Whole", `--parts-bg` with "Parts", and so on). That is the colour's real meaning, so it's allowed.

**Behaves.** Hover or focus shows the title in a tooltip; click opens the episode. Rows wrap at ten per row, so 1–10, 11–20 read as street blocks. Missing numbers keep their plaque, in `--missing-bg` with "No copy", so gaps read without a separate research page.

**Builds on.** Programme guide's Numbers view.

### 6. Alef-bet strip

**Looks like.** A thin strip of letters, א to ת, along the side of the guide (right side in Hebrew, left in English), in a large rounded Hebrew face. In English mode, A–Z appears beside it for English titles. Letters with no titles are `--muted`.

**Behaves.** Jumps to the first title with that initial in the current production, sorting by `titleHe` verbatim. It gives a child who is learning letters something to press. Hovering a letter shows its count.

**Builds on.** Programme guide's Album and List, which today only sort by number.

### 7. Letter and number of the day

**Looks like.** A small card on Home: a big letter (today, by date: ג) or numeral in the rounded face, and the label "Letter of the day" / "האות של היום", with two or three cards beside it tagged Hebrew letters, alphabet or counting (the records carry about 145 Hebrew and letters tags and 140 numbers and counting tags). When an installment of the real Word of the Day series (מילת היום) fits, it is one of the cards.

**Behaves.** Changes at midnight, chosen by day of year from the letters and numbers that have tagged clips, so it never shows an empty card. Clicking the letter opens Browse with that theme.

**Builds on.** Living Room's shelves.

### 8. Holiday shelf from the Hebrew calendar

**Looks like.** A Home shelf that appears only near a holiday: "Hanukkah" / "חנוכה", with the date range in small type. It uses the same card as the other shelves.

**Behaves.** `Intl.DateTimeFormat('en-u-ca-hebrew')` gives the Hebrew date offline, so the file needs no server. Two weeks before Hanukkah, Passover, Purim, Sukkot, Shavuot, Tu BiShvat or Rosh Hashanah, the shelf appears, built from those theme tags (Hanukkah has about 57 tagged uploads). Out of season it's absent, not empty.

**Builds on.** Living Room's shelves as saved queries.

### 9. Kitchen-timer length filter

**Looks like.** A round dial in the Browse sidebar marked 5, 10, 20, 30, 60 minutes, with a pointer in `--primary`. The How long chips stay beneath it for people who prefer them.

**Behaves.** Turn it to set "up to N minutes"; the result count updates as it turns ("Up to 12 min · 141"). The dial snaps to the five marks, with a free mode on drag. It writes the same filter the chips do, so the two always agree. Under reduced motion the pointer jumps.

**Builds on.** Living Room's How long chips.

### 10. Tape-label episode tiles

**Looks like.** Each Programme guide tile has a cassette-label band under the thumbnail: a cream strip (`--surface`) with two ruled lines in `--line`, the catalogue number in mono at the left ("No. 167"), the English title in the serif, the Hebrew title beneath. Uploads hang under the label as tabs, like index-card tabs: "Whole", "Part 1", "Part 2", "Part 3", "Excerpt", each a small tab with its host ("archive.org").

**Behaves.** Clicking a tab opens that upload on its host. The tab order is fixed: whole candidates, alternate editions, parts in order, excerpts. Possible copies don't get tabs; the tile says "2 possible copies, not counted" in small text, as Programme guide does now.

**Builds on.** Programme guide's tiles and copies-hanging-from-the-episode model.

### 11. Parts as a train

**Looks like.** For a multipart episode, the parts appear as a row of train cars: rounded rectangles joined by a short coupling line, each with its number and duration (for example "1 · 9:48", "2 · 10:02", "3 · 9:31") and the host underneath. The engine at the front shows the total ("29:21 in 3 parts").

**Behaves.** Click a car to open that part on its host. The car you've opened gets a filled roof in `--accent` and stays filled for the session (or longer if stored with the backup), so you can see where you stopped. This is a personal mark, labelled "Opened" in the tooltip, and it never marks the episode Watched or changes evidence. Under reduced motion there's no small rock when a car fills.

**Builds on.** Programme guide's "See parts" and Living Room's ordered parts list.

### 12. Stickers for personal marks

**Looks like.** Starring puts a gold star sticker (`--star`, slightly rotated, with a white die-cut edge) on the card's corner. Marking Watched puts a round sticker with a check and the date. The Starred page becomes a sticker album: a grid of the starred cards with their stickers on.

**Behaves.** The sticker lands with a small press (scale 1.15 to 1, 120 ms) and a tilt of a few degrees, fixed per card so it doesn't change on re-render. Reduced motion: it appears flat. The sticker's label in the accessible name is plain ("Starred", "Watched on 18 Oct"). A short note on the Starred page says these are yours and separate from the project's checks.

**Builds on.** Living Room's star buttons and Your stars shelf.

### 13. Empty states in character

**Looks like.** When filters return nothing, a drawn Oofnik bin (CSS: a rounded rectangle, a lid offset at an angle, two dots peeking) with one line: "Nothing here." / "אין כלום." Beneath it, the relaxations that would bring results back, each with its count: "Remove 'Under 5 min' (+12)", "Any language (+31)".

**Behaves.** The lid lifts slightly when the empty state appears, and stays still afterwards. Different empties get different one-line jokes kept to the characters: an empty Starred page has Kippi with "Nothing starred yet."; an empty search keeps the bin. Keep it to one line each, no paragraphs.

**Builds on.** The brief's zero-result relaxations, with Living Room's character set.

### 14. Oofnik's bin: what couldn't be found

**Looks like.** A small bin icon with a number in the footer and in the guide's key: "Not found · 69". It's the only entry point to missing episodes and unidentified videos in the main UI.

**Behaves.** Opens a plain, short page in the Programme guide's List style: by production, the episode numbers with no whole copy ("No. 133 · Please Do Not Disturb · 2 possible copies, not counted"), then a one-line count of videos awaiting identification, then a link to the JSON export. No checklists, no workbench. The Research to-do route still works for the maintainer.

**Builds on.** The user's feedback, and Programme guide's House-number Numbers view (idea 5), which already shows gaps in place.

### 15. Rubber-key chips and a flip-sign language toggle

**Looks like.** Filter chips with a 2 px bottom edge in `--line-strong`, so they look like keys on a toy keyboard; pressed (selected) chips sit flush with a `--primary` fill and `--primary-ink` text. The EN / עב toggle is a hanging shop sign that flips to its other side.

**Behaves.** Press moves the chip down 2 px. The sign rotates on its Y axis in 300 ms as the page switches to RTL; reduced motion swaps it. The toggle stays a radio group, as `docs/library-ui.md` requires.

**Builds on.** Living Room's chips and its EN/עב control.

### 16. Odometer counts

**Looks like.** Dynamic filter counts and result totals in tabular mono figures inside small windows, like a counter on a tape deck.

**Behaves.** When a filter changes, each digit rolls to its new value over 200 ms. The final value is in the DOM at once for screen readers; the roll is decoration. Reduced motion: the number changes.

**Builds on.** Programme guide's mono numbers and the dynamic counts both keep.

### 17. Duration ruler in List

**Looks like.** In List and in Browse sorted longest-first, each row has a thin bar under the title, its length proportional to duration, in `--surface-3` with a tick every 5 minutes. The longest-first sort becomes a descending staircase. A 2:37:10 collection's bar is capped with a break mark so it doesn't swamp the scale.

**Behaves.** Static. It makes the full-episode / short-installment split visible: 28-minute bars on one side of the divider, 6-minute ones on the other, with the two categories still under separate headings.

**Builds on.** Programme guide's List and the longest-first sort.

### 18. The couch (Tonight)

**Looks like.** A low couch shape along the bottom of the screen on desktop (a rounded bar in `--surface-2` with two arm rests), collapsed to a tab when empty. Cards dropped on it, or added with "Add to couch", sit on it as small thumbnails. The total time is written on the cushion: "3 videos · 27 min".

**Behaves.** Drag to reorder; "Open the first" opens the first upload on its host and moves the couch's marker to the next. It's personal and joins the backup. On phones it's a bottom-sheet tab.

**Builds on.** Living Room's family home, and Pocket's Tonight queue from round 1.

### 19. Ticket-stub Watch button

**Looks like.** The destination-first Watch button with a perforated stub at its end: "Open on Vimeo" in the button, and on the stub the duration ("29:37"). The access words stay below in plain text: "Vimeo · direct link · Details checked, not test-played".

**Behaves.** Opens the host in a new tab. Licensed listings get a different stub label ("hoopla · library card"), with `--acc-lic` only on the small access mark beside it, never on the button. Other copies are a small "2 other copies" link beside the stub.

**Builds on.** Living Room's destination-first Watch button.

### 20. Street-sign headings

**Looks like.** Production headings in the guide as a street sign: a rounded plate in `--brand` with `--mast-ink` type, Hebrew above English (or the reverse in English mode), the years on a small plate beneath. "רחוב סומסום · 1983–1987".

**Behaves.** Static, and it's the one place the street metaphor appears, so it doesn't crowd the rest. Under the sign, the counts in words: "198 programmes · 183 with a whole copy".

**Builds on.** Programme guide's production headings; borrows the sign from Rechov (direction 3) without the rest of it.

### 21. Shuffle a shelf

**Looks like.** A small shuffle icon beside "See all" on each Home shelf.

**Behaves.** The shelf's cards fan out and re-deal in a new order (each card translates a little and returns, staggered by 30 ms). The shelf remembers its order until you shuffle again. Reduced motion: the order changes without the deal.

**Builds on.** Living Room's shelves.

### 22. Season film strips in Album

**Looks like.** Within a production, each season is a horizontal strip of thumbnails with sprocket holes along the top and bottom edge (a repeating gradient in `--surface-3`), the catalogue number printed on each frame's edge in mono.

**Behaves.** Scrolls sideways with snap; the season label and count sit at the start of the strip. Frames without a whole copy show their coverage word over a dimmed still. Clicking a frame opens the episode entry.

**Builds on.** Programme guide's Album, made less tall.

### 23. Bilingual title stack with a swap

**Looks like.** Every title shows the interface language large and the other small beneath, in its own direction (`<bdi dir=auto>`). `titleHeEditorial` gets a small "our translation" mark, in Hebrew mode only.

**Behaves.** When the language toggles, the two lines swap with a short vertical slide, so you can see which is which. Reduced motion: they swap.

**Builds on.** Programme guide's deliberate title hierarchy.

### 24. Optional sounds, off by default

**Looks like.** A speaker icon in the theme picker's Appearance group: "Sounds: off / on".

**Behaves.** When on, a dice roll, a sticker or a train car makes a short WebAudio blip (synthesised, no audio file). Off by default, stored as a UI preference outside the backup, and silent under reduced motion.

**Builds on.** Nothing in either mockup; it's for the child on the couch.

## Combined concepts

### A. The building

Living Room's home and Programme guide's guide as two floors of one Sumsum building.

**Layout.** Masthead in `--brand` with a plain wordmark ("Sumsum" / "סומסום", no tagline), four tabs (Home, Guide, Browse, Starred), the one search field, the dice (3), How you watch, the flip-sign language toggle (15) and the theme button. Home: Up next on the left (picture, Hebrew summary, ticket-stub Watch button, 19) and Letter of the day (7) on the right; under it the character tokens (1) as a stoop row; then shelves (Under 10 minutes, Songs, Elmo's talk show, In English, the seasonal holiday shelf (8), Your stars), each with shuffle (21) and See all. Guide: the street-sign heading (20), the channel dial (4) above the content, then Album as season film strips (22) with tape-label tiles (10), or Numbers as house-number plaques (5), or List with the duration ruler (17). Footer: Oofnik's bin (14) and About.

```
┌ Sumsum  Home Guide Browse Starred [ search……………… ] ⚂ How you watch [EN|עב] ◐ ┐
├──────────────────────────────────────────────────────────────────────────────┤
│ Up next                                         │ Letter of the day         │
│ ┌──────────── still 16:9 ─────────┐ A Basketball│      ג                    │
│ │                           29:37 │ Game        │ [clip] [clip] [clip]      │
│ └─────────────────────────────────┘ משחק כדורסל │                           │
│ [Open on Internet Archive ┆29:37]  Another                                   │
│                                                                             │
│ Characters   (◎Kippi 169)(◎Oofnik 188)(◎Elmo 85)(◎Grover 114) …            │
│ Under 10 minutes ⤮  See all 84 →   [card][card][card][card]                 │
│ Songs ⤮             See all 29 →   [card][card][card][card]                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🗑 Not found · 69                                    About · backup         │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Type.** Programme guide's serif for titles and headings (a system serif stack: `"New York", Charter, Georgia`, with `"Arial Hebrew"` for Hebrew); mono for numbers, durations and counts; the rounded face only for letters, dice faces and the Letter of the day.

**Motion.** Dice tumble, shelf shuffle, sticker press, dial detents with static crossfade. All under 600 ms, all off under reduced motion.

**Colour.** Masthead `--brand` over the `--accent` stripe; pages `--bg`, cards `--surface`, film-strip sprockets and the dial in `--surface-3`; buttons `--primary`; Kippi's quills and the train roofs in `--accent`. Coverage colours only on coverage words and plaque bands.

**Why.** It keeps Living Room's front door and Programme guide's structure in one place, with the fun in the controls rather than in copy.

### B. Channel Sumsum

The library as a TV set: you change channels, and the screen is the guide.

**Layout.** The channel dial (4) is the main control, at the top left at desktop width, beside a large "screen": the current production's Album, framed with rounded corners like a CRT (`--radius` larger than elsewhere, an inner shadow from `--shadow`). Below the dial: the kitchen timer (9), the character tokens (1) in two rows, and the rubber-key chips for program type and language (15). On the screen, the dice (3) and "Kippi picks" (2) sit in the corner like a remote. The episode entry opens on the screen with the decision on the left (ticket-stub Watch button, parts train, 11) and the dossier on the right, in Programme guide's split. Oofnik's bin is a small button on the TV's base.

```
┌──────────────┐ ┌──────────────────────────────────────────────┐
│   (  dial  ) │ │ רחוב סומסום · 1983–1987        Album Numbers List │
│  1983 ◉ 1998 │ │ [film strip: season 1 ……………………………]      │
│ Shalom  Elmo │ │ [film strip: season 2 ……………………………]      │
│ ( timer 10′ )│ │                                ⚂ Roll · 198  │
│ ◎◎◎◎ ◎◎◎◎    │ └──────────────────────────────────────────────┘
│ [Full][Short]│        ▔▔▔▔▔▔ 🗑 Not found · 69 ▔▔▔▔▔▔
└──────────────┘
```

**Type.** Mono for the dial labels, numbers and counts (odometers, 16); serif titles on the screen; Hebrew in `"Arial Hebrew"` at a larger size than Latin to match its x-height.

**Motion.** Detent clicks on the dial; a 150 ms static crossfade between productions; odometer counts as filters change.

**Colour.** The control panel in `--surface-2` with keys in `--surface` and `--line-strong` edges; the screen bezel in `--ink` (dark in light mode, which makes the thumbnails pop) and `--surface-3` in dark mode; the dial pointer in `--primary`.

**Why.** It's the most playful of the three and gives the production rail a physical form, but it's less suited to phones, where the dial has to become a strip, and the screen frame costs some width.

### C. Sticker album

The library as a scrapbook the family fills in: personal marks are the decoration.

**Layout.** Home is a two-page spread at desktop width: on the left, Up next and Tonight on the couch (18); on the right, the sticker album of starred and watched cards (12). Below, the shelves. The guide uses the tape-label tiles (10) in Album and house-number plaques (5) in Numbers, with the alef-bet strip (6) down the side. Browse keeps Living Room's sidebar, with the kitchen timer (9) and character tokens (1). Empty states use idea 13; the bin (14) is in the footer.

```
┌───────────── left page ─────────────┬──────────── right page ────────────┐
│ Up next  [still]  A Basketball Game │ Your album        ★ 3   ✓ 12      │
│ [Open on Internet Archive ┆29:37]   │ [card★] [card✓] [card★✓] [card✓]  │
│                                     │ [card✓] [card★]                   │
│ ╭──── couch: 3 videos · 27 min ───╮ │                                   │
│ │ [t] [t] [t]     Open the first  │ │                                   │
│ ╰─────────────────────────────────╯ │                                   │
└─────────────────────────────────────┴───────────────────────────────────┘
 א ב ג ד …  │ No. 1 ▭▭ │ No. 2 ▭▭ │ No. 3 ▭▭ │ (tape-label tiles)
```

**Type.** Serif for titles; the rounded face for the alef-bet strip and sticker labels; mono for numbers.

**Motion.** Sticker press and tilt, couch cards sliding into place, title stack swap on language change.

**Colour.** Pages in `--surface` with a centre gutter shadow from `--shadow`; stickers in `--star` and `--surface` with `--line` edges; tape labels with `--line` rules; buttons `--primary`.

**Why.** It makes the user's own use of the library the playful part, which rewards coming back, and it keeps the guide plain. It depends on stars and watched marks, so a new browser profile starts blank (the empty album uses idea 13).

## Recommendation

Concept A is the safest merge and takes most of the ideas. B is the most fun and worth a mockup if the user wants to go further. C's sticker album and couch can be added to A as the Starred page and a Tonight tray.
