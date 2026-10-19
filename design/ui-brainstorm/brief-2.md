# Mockup brief, round 2

Six agents (three Claude Opus, three GPT-6.1-Sol) each build one mockup, two per concept, so the user can choose. Read this brief, then [round2-opus.md](round2-opus.md) and [round2-astra.md](round2-astra.md), which hold the ideas and concepts. The first round's rules are in [brief.md](brief.md), under "Rules every mockup keeps" and "Use real data". Those still apply, except where this brief overrides them. Also read `AGENTS.md`, `docs/library-ui.md` and `docs/episode-guide.md`.

## What the user chose and said

Of six first-round mockups, the user called two "the best two, by far": `design/mockups/1-living-room.html` and `design/mockups/4-programme-guide.html`. Open both in a browser and study them. Every new mockup carries forward what made them work. From Living Room: picture-led shelves, character portraits as filters, and a Watch button that names its destination. From Programme guide: episodes as the object with copies, parts and excerpts beneath them, the production rail, and Album/Numbers/List.

The user's notes:

1. **No research desk.** What couldn't be found stays documented, as one small, quiet link (for example a footer link, "Not found · 69", that opens a plain list). There is no workbench, no identification queue and no coverage dashboard on any main screen.
2. **No marketing-speak or filler.** This is the user's own tool, not a product. Labels are plain and functional. No taglines, hero sentences, pitch copy or headings such as "Find the episode you remember", "What shall we watch?" or "A video-link library". If a heading only restates what the screen obviously is, cut it.
3. **More creative and fun.**

## Who uses it, and how

The main use is the user playing episodes for their daughter, who turns five months old on 2026-10-19. Design for that:

- **The adult operates the library**, often one-handed, holding the baby, on a phone or laptop, sometimes in a dim room. Primary actions need large targets and few steps from opening the page to a video playing. Dark appearance must be calm and low-glare.
- **The baby doesn't choose.** "Kid mode", a child picking by tapping characters and sticker rewards for a child are years away. Fun is for the adult running the session: a character "picking" for the adult is fine, as play.
- **Sittings are short**, so songs, short segments and whole episodes all matter. Length filters ("under 5 / 10 minutes") and a short queue for this sitting are useful. Videos still open on their original host in a new tab, one at a time; a queue means "open the next one", not autoplay or embedding.
- **Babies like repetition.** Favourites, "play again" and recently opened are more useful here than progress through a series. A Watched mark is not "done". Any new personal data, such as recently opened or a queue, lives in local storage and must join the existing backup. UI preferences stay out of the backup.
- **Language exposure may matter.** A visible way to choose Hebrew, English or both, based on each record's `language`, is useful. The interface language toggle is separate from this.
- **No sounds by default**, and nothing that flashes or autoplays. Don't moralise about screen time.
- **The library will grow up with her.** Don't build for a toddler now, but leave room.

## The three concepts

Each concept merges Living Room and Programme guide with the fun ideas from round 2. Opus and Sol each build every concept once, independently. Don't coordinate; the user wants two takes.

**A. The building / stoop and shelves** (`a-building`). One layout holds Living Room's home shelves and Programme guide's guide. The characters sit on a stoop row as filters. There is a "surprise me" button that respects the filters, rows for favourites, songs and short videos, house-number plaques, and copies opening beneath an entry. It is the most balanced of the three.

**B. Channel Sumsum / the TV set** (`b-channel`). A drawn TV set (CSS, not an image) frames one choice at a time: the real thumbnail, the title, the destination and the Watch button. A channel dial picks the production, and shuffle or "next" picks within the filters. Tonight's short queue sits beside it, and the guide is below. It suits a parent running a sitting one video at a time. It must stay usable on a phone, and the set must not push the guide far down on desktop.

**C. Her shelf / sticker album** (`c-album`). Programme guide's album as the main screen, with episodes as album cards with house-number plaques. The family's own marks are the decoration: favourites, played-again counts and stars become stickers on the cards. Recently opened and favourites lead. The full guide by production is one step away.

Use the fun ideas freely: character tokens drawn in CSS or type (never copyrighted artwork), Hebrew-numeral dice, an alef-bet strip, a kitchen-timer length control, parts as a train, a ticket-stub Watch button, empty states in a character's voice (short, and not filler), and Oofnik's bin for the "Not found" link. Both brainstorms note that Elmo's red and Kippi's honey sit too close to the coverage colours. Take character colour from the real thumbnails, and use only palette tokens for drawn parts. Every animation turns off under `prefers-reduced-motion`. Random picks draw only from videos that would get a Watch button.

## Deliverable

One self-contained HTML file per agent: `design/mockups/r2-<concept>-<opus|sol>.html`, for example `r2-b-channel-sol.html`. It must be under 400 KB, with inline CSS and JS, no framework and no build step; remote thumbnails are the only external requests. It needs at least three screens you can switch between: the landing screen, Browse with filters applied, and an episode page with several copies and parts. English/עברית (with RTL) and the light/dark switch must work on every screen. Design for 390 px phone and 1280 px desktop equally, and check both. The mockup shows no description of itself. Put your pitch in your reply, not on the page.

Check the file in a browser before you finish: phone and desktop, light and dark, English and Hebrew. Fix what you see. Work only on your own file in `design/mockups/`, write no other files that stay behind, and don't commit. Reply with the path and a short, plain pitch of one paragraph.
