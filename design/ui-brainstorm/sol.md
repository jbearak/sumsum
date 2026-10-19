# UI brainstorm for the Sumsum library

This is a design proposal, based on the current template and data, not an implementation plan. I read `AGENTS.md`, `README.md`, `docs/library-ui.md` and `docs/episode-guide.md`, skimmed the template's tokens, responsive rules and view renderers, and sampled the guide and every `*-records.json` file. Observations below refer to source inspection. I did not run a browser layout review or test playback.

The strongest opportunity is to make choosing a video easier while giving the maintainer a clearer place to investigate it. The existing distinctions between episode identity, upload, access, coverage, project evidence and personal viewing are valuable. The redesign should make those distinctions easier to read.

## What the redesign has to carry forward

The guide data separates production identities, episode identities and upload records. `data/episode-guide.json` contains `productions`, `episodes` and production-keyed `unidentified` queues. Episodes link to records through `{recordId, role}` and separately carry coverage, evidence, identity confidence and sources. The sampled `*-records.json` files are arrays of host-specific uploads with titles, duration, tags, provenance and access information. Raw array lengths are not distinct-episode totals, or even a count of deduplicated uploads.

A useful example is `original-1980s-ietv-1`. Its catalogue title is `רחוב סומסום <1>`, its English display title is "A Basketball Game", and its sourced story name is `משחק כדורסל`. Its archive.org label S1E44 is an alternate label. Its whole-candidate link has metadata-only evidence. A redesign has to make that episode easy to find without turning S1E44 into its catalogue number or implying that someone checked the whole video.

The shared contract comes from [AGENTS.md](../../AGENTS.md), [the UI rules](../../docs/library-ui.md) and [the guide rules](../../docs/episode-guide.md). Keep the standalone `index.html`, external-host playback, local collection storage, dynamic filter counts and longest-first sorting. Keep full broadcasts separate from complete short installments. English, Terracotta and System remain defaults; Hebrew RTL, all palettes and appearance options remain available. Implementation would change the template and rebuild, never patch only the generated HTML. This brainstorm changes no data or coverage claims.

## Concrete ideas

### 1. Give watching and research clear entrances

**Current problem.** `mountGuide()` places the core-broadcast goal panel before the existing Up next recommendation. Missing episodes and Videos to identify sit behind Browse's split-button arrow, while Research to-do is linked from the footer. The first screen mixes a parent's viewing task with a maintainer's inventory task. Source: `mountGuide()` at lines 4003–4050 and `renderTabs()` / `renderFootLinks()` at 3692–3737.

**Proposal.** Keep Episode guide, Browse and Starred as the main navigation. Add a clearly named Research entrance with links to the existing research routes. On the guide overview, put a small "Find something to watch" section first, with the current Up next card and a Browse shortcut. Put the core coverage summary in a following "Library coverage" section. Research pages should share a compact local navigation so the maintainer can switch between missing, unidentified and playback checks.

**Constraints.** Preserve existing hash routes, including `#/uploads` and its filters. This changes presentation, not the definitions of identified or missing. Keep stars and watched marks in the same browser storage and file location. See `docs/library-ui.md`, Views and routes, and `AGENTS.md`, Files and build.

### 2. Introduce production chooser cards

**Current problem.** `renderRail()` groups productions by family and shows years, format and coverage. That is useful once someone knows the history. A newcomer still has to distinguish original Rechov Sumsum, the co-production, modern seasons, two Shalom Sesame series, short series and compilations from a long list. Source: `renderRail()` at lines 4289–4320; production fields in `data/episode-guide.json`.

**Proposal.** Add an overview chooser with a card for each production. Lead with its name, years, language when documented, and a short editorial description of its format. Provide separate "Open episode guide" and "Browse videos" actions. Group the cards by show family, then keep production differences explicit within each group. Retain the compact rail for repeat navigation inside the guide.

**Constraints.** Never combine core episodes, short installments, co-productions or home video into one episode total. Unknown language stays unknown. Editorial descriptions must be distinguishable from publisher copy. See `AGENTS.md`, Evidence and episode counts, and the guide's Totals rules.

### 3. Make Album, Numbers and List explain their jobs

**Current problem.** The guide offers all three layouts, but the labels describe presentation rather than purpose. The same production section also contains counts, disputed totals, inferred gaps and unidentified uploads. A parent looking for a recognizable still and a collector scanning IETV numbers need different emphasis. Source: `updateGuide()` at lines 4051–4125 and `renderSections()` at 4319 onward.

**Proposal.** Keep the existing choices and add short descriptions: Album for choosing by picture, Numbers for scanning the catalogue, List for comparing rows. In Album, make titles and viewing actions dominant. In Numbers, place numbering explanations and gaps beside the grid. In List, expose coverage and evidence columns with a sticky header on wide screens. Keep the chosen layout when entering another production.

**Constraints.** Preserve `sumsum-guide-layout` and `data-start-layout`. Numbers must remain IETV programme numbers where required. Expected slots remain distinct from identified episodes, and filtered views must explain when placeholders disappear. See both UI and episode-guide docs.

### 4. Establish a consistent card reading order

**Current problem.** `uploadCard()` stacks series, subseries, display title, published title, uploader, official/community status, kind, guide role, access and actions. Guide tiles use a different hierarchy. Both are accurate, but switching views changes where the reader finds the same kind of information. Source: `uploadCard()` at lines 5357–5386; guide tiles at 4530–4560.

**Proposal.** Use a shared order: picture and duration; title; production and format; access requirement; primary action. Place provenance and identification details in a clearly labeled secondary area. Guide cards should always say what kind of object they represent. An upload card can link to its episode without looking like a second episode. Preserve a readable text coverage label on small Album cards rather than relying on a mark alone.

**Constraints.** Evidence remains words, with tile badges only above "Details checked, not test-played" as documented. Keep original titles and uploader attribution accessible. Do not convert a short installment into a full broadcast through card wording. Coverage and access colours retain their meanings across palettes.

### 5. Offer visible filter starting points

**Current problem.** Browse already has dynamic series, type, guide-status and access pills, followed by theme and character selects. A parent has to assemble several choices before seeing a useful subset, and phone users first have to open Filters. Source: `renderFacets()` at lines 5237–5285 and `selectGroup()` at 5218–5235.

**Proposal.** Add a few explicit presets above the results, such as "Songs", "Full episodes" and "Elmo's talk show". Show the actual filters each preset applies and let users edit them immediately. Offer character shortcuts from existing tags. Avoid a vague "Best for kids" preset. A preset that yields no matches should show zero and explain which condition limits it.

**Constraints.** Presets use the same filter state, dynamic counts and removable chips as manual choices. Full episodes and complete short installments remain separate options. Character and theme tags are editorial and incomplete, not guarantees about every appearance. Preserve longest-first sorting.

### 6. Let a parent filter by available time

**Current problem.** Browse offers longest-first sorting, but `uMatch()` has no duration constraint. To find something under five minutes, the user must scan individual durations. This is a common parent decision that the current filters do not express. Source: `uMatch()` at lines 5144–5157 and duration sorting at 5287–5302.

**Proposal.** Add "Up to 5 minutes", "Up to 10 minutes" and a custom maximum duration. Keep the result sort independent so users can still choose longest first within a time budget. Put missing-duration items in an explicit "Length unknown" option. Explain that the limit applies to each upload, including a part when the result is a part.

**Constraints.** Duration never establishes completeness. A three-minute clip and a complete three-minute short installment keep their respective types. Use recorded metadata without implying playback verification. Counts must recompute with the other facets. See `AGENTS.md`, Evidence and episode counts.

### 7. Connect search across episodes and uploads

**Current problem.** The guide searches episodes and Browse searches uploads through separate inputs and match functions. Both already accept English, Hebrew and video links. A person who remembers an uploader title or archive label must still choose which view to search first. Source: `recSearch()` at lines 3111–3125, `epSearch()` at 3356 and `parseQuery()` at 3970.

**Proposal.** Offer a search scope switch with "Episodes", "Videos" and "Both". The combined view has separate result groups and separate totals. Explain a match when helpful, for example "Matched alternate label archive.org S1E44" or "Possible copy of IETV 1". Keep video-link lookup prominent, including its existing "already in the library" answer. Offer spelling aliases for established character names, without changing stored titles.

**Constraints.** Never add upload counts to episode counts. `possible` matches remain visibly unresolved and do not produce a Watch button for the candidate episode. Preserve catalogue numbering, alternate-label attribution and verbatim titles. Search English and Hebrew regardless of interface language.

### 8. Make filter changes easier to understand

**Current problem.** The UI already has dynamic counts, removable chips and clear-all controls. Its zero-result message mainly offers a reset. Theme and character options intentionally remain present at zero, but a reader may not understand why a familiar choice now has no results. Source: `renderFacets()` at lines 5237–5285 and `renderCount()` at 5304–5311.

**Proposal.** Add a short filter sentence above results, such as "Elmo videos about music, on Vimeo". On zero results, offer specific, reversible relaxations with preview counts: "Remove character: 8 videos" or "Include other services: 3 videos". Explain multi-select behavior in plain language once per filter panel. On phones, keep the active filters visible outside the collapsed panel.

**Constraints.** Preserve the existing count semantics that calculate a facet while omitting that facet's own constraint. Explain that selections within a pill group are alternatives, while separate filter groups narrow one another. Never silently clear filters or replace a zero-count selection. Keep URL state, focus restoration and polite count announcements. See `docs/library-ui.md` and `renderFacets()`.

### 9. Put the destination beside the viewing decision

**Current problem.** The library already names licensed services on Watch labels and shows access notes. `bestLink()` chooses one primary link; alternate hosts and their evidence appear farther down the episode page. A parent may want a different host or need to know about a library card before leaving the library. The phone rule also hides the Up next access line, making the destination button carry more of that explanation. Source: `bestLink()` at lines 3230–3244, the episode hero at 4644–4670 and `.next .u-access` at 901.

**Proposal.** Keep a direct primary action, labeled "Open on Vimeo" or "Watch on hoopla · library card" as appropriate. Place "Other copies" beside it, expanding into a compact destination list with role, access requirement and recorded evidence. Display "Opens the original site in a new tab" nearby. Explain why the primary copy was selected without describing it as verified unless evidence supports that claim.

**Constraints.** Keep playback on the original host. Preserve full Vimeo privacy hashes and the associated Hop source. Failed availability statuses must prevent a normal public-play action. Service requirements remain explicit; `possible` copies never enter the episode's Watch choices. See `AGENTS.md` and Licensed listings in the guide doc.

### 10. Turn multipart viewing into an ordered checklist

**Current problem.** Episode pages already group uploads by role and number parts, and compare their durations. A family still has to manage several external tabs to view a multipart programme. The comparison table is better at comparing copies than following a sequence. Source: `partsOf()` at lines 3132–3141 and the episode upload groups at 4674–4700.

**Proposal.** Add a "Watch the available parts" block with part number, duration, host and one explicit open action per row. Show missing part numbers only when the documented numbering establishes them. Offer a temporary "Opened this part" marker within the current visit, clearly separate from Watched. After the last listed part, link back to the episode rather than automatically opening more videos.

**Constraints.** Numbered story segments remain excerpts when they are not splits of the programme. Do not declare the programme complete because all currently listed parts were opened. Preserve `parts-only` coverage and exact upload roles. No downloaded media, autoplay chain or inferred playback progress.

### 11. Divide the episode page into a decision and a dossier

**Current problem.** `mountEpisode()` already has a strong hero, role-based upload lists, comparison table, evidence card, personal progress card and identity card. In the single-column mobile layout, the main upload content precedes the sidebar, pushing the personal Watched control and identity material farther down. Source: The episode hero and detail grid at lines 4644–4721; single-column detail rules at 855–856.

**Proposal.** Keep the title, production, coverage, evidence and chosen destination together at the top. Put the personal Watched control immediately below that decision area. Follow with "Available copies", then "Identity and sources". Provide jump links for copies, evidence and catalogue details. Retain the evidence ladder as text with the current "Now" label; expand its explanation when requested.

**Constraints.** The identity card must retain the Catalogue title, story source and any labeled Editorial Hebrew title. Personal Watched never changes project evidence. Evidence remains exact-URL evidence, with recorded dates where available. Keep canonical episode routes and previous/next navigation.

### 12. Add a parent-curated family shelf

**Current problem.** Starred lists saved uploads using Browse's detailed card interface. There is no simplified handoff screen where a parent can narrow the choices before letting a child pick. Source: `mountUploads()` at lines 5165–5205 and `uploadCard()` at 5357–5386.

**Proposal.** Add a temporary "Family shelf" view populated by uploads the parent explicitly selects from Starred. Use large pictures, readable titles and a single open action. Give the adult a preview of every destination and access requirement before entering the shelf. Include an obvious return control and a small persistent reminder that videos open on other sites. Start with a session-only shelf to avoid adding backup complexity.

**Constraints.** This is a chooser, not a child-safe browser or an age rating. External hosts retain their own interfaces and recommendations. Never suppress region, payment or library-card requirements. Keep research detail reachable outside the shelf. Preserve stars and all existing local data.

### 13. Make personal actions easier to find and undo

**Current problem.** Browse cards expose Star, while episode pages expose personal Watched in a sidebar card. The existing Up next recommendation skips watched core Rechov episodes but does not provide a general family history across all productions. Backup controls live in About at the bottom. Source: `uploadCard()` at lines 5357–5386, the personal progress card at 4701–4712 and `renderAbout()` at 5661.

**Proposal.** Give personal controls a consistent "Your library" area. On upload cards, keep Star; where an upload maps unambiguously to an episode, offer that episode's Watched control with its title. In Starred, add "Not marked watched" and a short explanation of episode-based marks. Provide immediate Undo after a change and a visible shortcut to the existing backup section.

**Constraints.** Stars remain upload-based, Watched remains episode-based, and ambiguous mappings must not bulk-mark candidate episodes. Opening a host is not watching a video. Preserve current storage keys and backup compatibility. Preferences remain outside the collection backup. Do not imply cross-device sync or resuming at a timestamp.

### 14. Give the maintainer one research workbench

**Current problem.** `mountMissing()`, `mountUnidentified()` and `mountTodo()` provide related but separate lists. Research to-do already distinguishes playback work and exports JSON, but moving between the next useful actions requires navigating several pages. Source: `mountMissing()` at lines 5448–5481, `mountTodo()` at 5482–5502 and `mountUnidentified()` at 5429.

**Proposal.** Add a research overview with distinct sections for documented episodes lacking whole copies, expected unidentified slots, videos awaiting identification and whole links awaiting playback checks. Each row should name the next action and link to the existing detailed page. Scope the workbench to a production and keep acquisition separate from playback review. Show counts in their actual units rather than one completion percentage.

**Constraints.** This is a read-only reorganization of existing evidence. `possible`-only uploads belong with awaiting identification, alongside queued uploads. Do not infer lifetime totals from current listings. Keep the existing `sumsum-to-find` export name and format unless a separately planned migration changes them. Before implementation of coverage logic, read `TODO.md` and the relevant research notes.

### 15. Make unresolved identity comparisons legible

**Current problem.** `mappingCard()`, suggestion functions, alternate labels and the episode identity card contain identification clues. The upload comparison table compares role, duration, host, evidence, uploader and published title, but it does not directly compare an uncertain upload with several candidate episode identities. Source: `identityCard()` at lines 4766–4800, `compareTable()` at 4826 and `mappingCard()` at 5098.

**Proposal.** Add a research-only comparison view with an upload column and candidate episode columns. Align published title, catalogue title, alternate labels, description excerpts with named sources, runtime and source links. Separate "Matching clues", "Conflicting clues" and "Still unknown". Let the maintainer copy a plain-text research summary without writing an accepted mapping into the guide.

**Constraints.** Suggestions stay suggestions. Duration similarity and matching thumbnails do not establish completeness. Preserve source wording, stable IDs and uncertainty. An accepted identification remains a repository change subject to the guide, research-note, TODO and audit update rules, rather than a casual UI toggle.

### 16. Treat bilingual titles as a deliberate hierarchy

**Current problem.** The template already handles title precedence, mixed-language isolates and RTL carefully. Published and alternate titles appear as secondary lines on some cards, while editorial Hebrew provenance lives on detail pages. Long mixed-script names can still demand substantial reading space. Source: `identityCard()` at lines 4766–4800, `uploadCard()` at 5357–5386 and title precedence in `docs/episode-guide.md`.

**Proposal.** Offer an optional "Show both titles" reading preference. Lead with the title selected by the current language rules and show the other title below when available. Label translations as editorial in the expanded title details. In research views, keep the source title and its source together. Use logical alignment and isolate identifiers, URLs, dates and durations so they remain readable inside Hebrew sentences.

**Constraints.** English remains the default and Hebrew changes the page to RTL. Preserve the exact title precedence in `docs/episode-guide.md`; do not manufacture missing Hebrew titles or translate quoted story names. Keep language-switch keyboard behavior and first-paint preference handling. A new title-display preference belongs with UI preferences, outside the collection backup. The palette button keeps the same size and place in both languages.

### 17. Design a phone view around readable choices

**Current problem.** Below 480px, Album becomes three columns, titles become 12px and the coverage word disappears. Browse becomes a one-column horizontal card. Below 980px, production navigation and filters collapse, and the guide toolbar stops being sticky. These are sensible space savings, but Album trades away much of the information needed to choose. Source: Responsive rules at lines 841–975, especially `.tiles`, `.tile-title` and `.cov-word` at 944–949.

**Proposal.** Use two Album columns on narrow phones, with a single-column option at large text sizes. Keep the title, coverage word and viewing action readable. Add a compact "Filters · N active" control that remains reachable while scrolling; open it as a full-height panel with a visible close action and current result count. Keep production selection separate from content filters. Use explicit failure text instead of relying on a struck-through host label.

**Constraints.** Keep touch targets at least 44px for primary controls, keyboard access, visible focus and sensible DOM order. Avoid stacked sticky controls covering results or focused content. Test 320px width, zoom, long Hebrew titles, RTL and safe-area insets. Preserve text evidence badges above the baseline level when the List evidence column is hidden.

### 18. Give the library a recognizable street-sign identity

**Current problem.** The current Terracotta tokens already supply a strong clay masthead, sandstone backgrounds, honey stripe and deep blue action colour. The interface uses many pills, badges, boxes and repeated numerical summaries, so decorative treatments compete with actual status information. Source: Terracotta tokens at lines 39–56 and `uploadCard()` at 5357–5386.

**Proposal.** Build a restrained identity around a small typographic street-sign wordmark, paired English/Hebrew lettering and section headings that resemble programme labels. Keep thumbnails visually quiet, give episode numbers a consistent location and reserve enclosing boxes for interactive groups or substantive summaries. Use whitespace and rules to separate ordinary metadata. Add neutral numbered artwork for missing thumbnails without imitating a real programme still.

**Constraints.** Keep Terracotta default and retain all six palettes, System/Light/Dark and no-flash boot behavior. Every colour stays tokenized. Do not reuse coverage or licensed-access colours for ordinary buttons, decoration or identity categories. Preserve documented contrast and colour-distance requirements in both schemes. Use the existing system font stack unless a self-contained font strategy is justified; Hebrew must have equal visual weight. Respect reduced-motion and forced-colour support.

## Four coherent redesign directions

These are alternatives for emphasis. They share the same data and evidence rules.

### A. The family bookshelf

Combine the viewing entrance in idea 1, production cards in 2, filter presets and time budgets in 5–6, destination choice in 9 and the family shelf in 12. The guide overview opens with a small set of understandable choices and the existing Up next recommendation, then leads into production shelves. Parents can choose by show, character or time without learning catalogue terminology first. The complete guide and research pages remain a direct navigation choice. This direction best serves someone choosing one video with a child beside them.

**Visual-language sketch.** A shallow clay masthead, sandstone page and generous cream cards. Use the existing sans-serif at roughly 28–34px for desktop page titles, 17–18px for card titles and 14–16px for metadata. Deep blue identifies actions; the honey stripe anchors the header. Aim for three cards across on desktop and two readable Album cards on phones. Keep density low around choices, with fuller copy details one expansion away. Dark mode uses the existing dark Terracotta surfaces rather than bright white cards.

### B. The annotated programme guide

Combine the layout explanations in 3, common card hierarchy in 4, cross-view search in 7, episode dossier in 11 and bilingual title treatment in 16. The episode identity becomes the main organizing object, with uploads visibly attached as editions, parts and excerpts. Users can move between an illustrated album and a precise list without losing their place. This direction best serves someone who knows an episode name or remembers a programme from childhood, while still giving a parent a clear Watch decision.

**Visual-language sketch.** A narrow production rail and a wide reading column on desktop, collapsing into a labeled production chooser on phones. Use a 30px page heading, 21–23px production headings, 16px episode titles and tabular numerals for programme codes and durations. Clay belongs mostly to the header and section accents; cream panels and fine sandstone rules carry the content. Density is medium, with generous title lines and compact comparison rows. Hebrew receives the same hierarchy, without Latin-style letter spacing.

### C. The collector's catalogue

Combine explicit Research navigation in 1, Numbers/List refinements in 3, the workbench in 14 and identity comparison in 15. The maintainer starts with a production and chooses an unresolved task, then follows a row into its evidence and candidate links. Distinct sections keep acquisition, identity and playback review separate. A visible "Browse videos" route supports watching without making research controls part of every family-facing card. This direction best serves sustained collection work and audits.

**Visual-language sketch.** A restrained clay header above a broad cream work area, with production scope at the top and a left research navigation on wide screens. Use the existing sans-serif at 15–16px for rows, larger headings and tabular numbers. Prefer tables, aligned fields and short source excerpts to badge stacks. Density is high on desktop but expands into labeled rows on mobile. Coverage colours appear only with coverage labels; evidence stays textual. No green "verified" checkmark shorthand.

### D. One library, two reading densities

Combine the shared hierarchy in 4, filter explanations in 8, episode structure in 11, personal actions in 13 and mobile changes in 17. Keep the current main navigation and improve it incrementally. Comfortable cards emphasize choosing a video; compact lists emphasize comparing records. Both lead to the same episode and upload pages. Research gains a clear entrance, while familiar layouts and local preferences remain intact. This is my preferred first direction because it addresses daily friction without requiring a new home-screen model or a second mode system.

**Visual-language sketch.** Retain the current Terracotta masthead and honey rule. Comfortable views use fewer containers, larger thumbnails and 16–18px titles. Compact views use the same type family, colour tokens and metadata order with tighter row spacing and fewer repeated labels. A production rail appears only where it helps guide navigation. Phones default to readable cards and can opt into List. Density changes spacing and arrangement, never the meaning of evidence, availability or titles.

## Suggested first experiment

Prototype direction D with three screens: a production Album at phone width, a filtered Browse page, and an episode with several copies. Use a whole candidate with metadata-only evidence, a multipart episode, a licensed listing and an unresolved possible copy as the sample cases. Repeat the screens in Hebrew RTL and dark Terracotta. Test whether a parent can name the destination and requirement before opening it, and whether the maintainer can distinguish the episode, its copies and their evidence without opening several pages.

The most useful early changes are readable phone cards, consistent destination information and a visible research entrance. Time budgets and a parent-curated shelf are promising additions after that hierarchy works.
