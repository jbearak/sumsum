# Project purpose

Maintain a local, interactive video-link library for classic and modern Rechov Sumsum, classic and modern Shalom Sesame, and Elmo's Israeli talk show, תכנית האירוח של אלמו. Collect episode and clip links, source metadata, and evidence about completeness and availability. Store links and metadata, never video media.

The library is `index.html`, a self-contained file generated from `library.template.html` and `data/`. Preserve filtering by series, program type, theme and character, dynamic filter counts, longest-first duration sorting, and the UI preferences, such as language (English by default, with a Hebrew toggle and RTL layout), palette (Green by default) and appearance (System by default, or Light or Dark). Full episodes and complete installments of short series are separate categories.

Before acquisition or coverage work, read [TODO.md](TODO.md): episode totals, coverage gaps and the acquisition checklist. Before changing a claim, read the [research/](research/) note that cites its evidence and limits.

# Keeping this file current

This file records the project's rules and the user's working preferences. Record new ones here, not in an agent's private memory. Each time you revise or add to it, look for what can be trimmed so it stays current and succinct. When unsure whether something can go, move it to a doc and point to it rather than deleting it.

Detail lives in these docs. Read each one before the work it covers:

- [docs/files-and-build.md](docs/files-and-build.md), before changing data files, scripts or the build: what each file holds, what the builder refuses and warns about, what the checks cover, and Vimeo metadata enrichment.
- [docs/episode-guide.md](docs/episode-guide.md), before editing the episode guide, a record's guide link or `data/licensed-services.json`: the guide rules and field shapes, licensed listings and availability checks.
- [docs/library-ui.md](docs/library-ui.md), before UI work: views, routes, browser storage, and the theme picker and its palettes.
- [docs/zen-and-hop.md](docs/zen-and-hop.md), before browser, VPN or Hop work: the Proton extension's state and server history, Hop discovery, the link collector, and driving Zen from the shell through the accessibility API.

# Working practices

The user set these on 2026-10-18.

- Commit finished work on the working branch at reasonable checkpoints without waiting to be asked, for example before starting the next big piece of work. When [Files and build](#files-and-build) calls for the build and checks, they must pass first. In multi-agent workflows, each stage that changes project files commits its own changes, staged by path rather than with `git add -A`. Scan staged files for credentials. Use imperative, sentence-case subjects like the existing commits. Do not amend, rebase, reset or use a bare `git stash`.
- `origin` is the private GitHub repository `git@github.com:jbearak/sumsum.git`. Push only when the user asks.
- Review substantial changes with one Claude review round, then a Codex review loop with GPT-6.1-Sol (T3 `delegate_task`, provider `codex`, model `gpt-6.1-sol`). Repeat it until there is no valid feedback or very high confidence that the work is ready to commit or merge. Another Claude review may then check that confidence. Do not cap the rounds at a small fixed number. Each Codex round is a fresh `delegate_task` carrying the original brief, prior findings, responses and unresolved objections. Verify each finding adversarially before fixing it, and commit fixes at checkpoints.
- Take the time the work needs. Do not trim verification or set time targets to go faster. The user's worry about long runs is crashed agents, not elapsed time, so when work runs long, check that agents are alive (transcript growth, tool activity) and report it.

# Zen, Proton VPN and Hop

- Use the existing Zen browser in its Home workspace, the user's personal workspace, not Work. Home, Work and Gmail are workspaces in one profile; do not create a new profile. Keep project and setup tabs in Home and preserve unrelated tabs and workspaces.
- With browser or computer-control tools, select the existing Zen window. Shell requests, other browsers and the in-app browser do not go through Zen's Proton extension.
- The Proton VPN extension in Zen connects to Israel, Tel Aviv, chosen by city rather than by server number. Split tunneling is on in Include mode, with only `hop.co.il` and its subdomains included; Vimeo, YouTube and everything else stay outside. Keep this rule, and do not add broad website rules as a workaround. Check the current connection before regional work, because it has been found disconnected despite auto-connect.
- Collect Hop links yourself rather than handing the work to the user (the user, 2026-10-18). Zen's extension is the established route. A computer-wide VPN is acceptable for this task only.
- Find Vimeo links through Hop and play them on Vimeo. Take the URL embedded in the Hop page with its complete privacy hash, keep the Hop source URL beside it, and open the Vimeo URL directly. If a link fails, check its exact URL, hash and current availability before changing VPN routing.
- Logins are in 1Password. Use the existing signed-in session when available; if reauthentication is needed, use 1Password through the supported account or browser flow. Never put passwords, session tokens, cookies or proxy credentials in project files, logs, commits or generated HTML.

# Files and build

Edit `library.template.html` or the JSON in `data/` and rebuild. Never make a fix only in the generated `index.html`, and commit the rebuilt `index.html` with its sources. After any change to `library.template.html`, `data/` or `scripts/`, run from the project root:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

Fix every builder error and read its warnings. Passing checks do not cover browser layout or visual review.

Merge a new Hop collector report into `data/hop-player-links.json` by id. Never replace the file, and keep existing links and playback evidence verbatim.

Keep `index.html` at its path and keep opening it the same way, as a file in Zen. The user's stars, pasted Vimeo links and watched marks live in that browser's local storage for that location. Before moving the file or changing how it is opened (another browser or profile, or a server instead of `file://`), export a backup from the library's About section.

# Editing the episode guide

[docs/episode-guide.md](docs/episode-guide.md) has the rest of the rules. These matter most:

- `titleHe` is the identifying source's title, verbatim. A `storyHe` is quoted verbatim from a source named in `storySourceEn`. Never compose, shorten or translate one.
- Link an upload with a role: `whole-candidate`, `alternate-edition`, `part`, `excerpt` or `possible`. A `possible` copy is unresolved and never counts toward coverage, the totals or the Watch button.
- `coverage` must agree with the upload roles. Claim `complete-playback-reviewed` or `reference-compared` only for a recorded check of the exact URL, named in `evidenceDetail`.
- Licensed listings (`access: "licensed"`) can make an episode a whole candidate, but they are not free uploads or playback evidence.
- Record every failed availability check with a status, so that it never shows as a public link.

# Evidence and episode counts

- Count upload URLs separately from distinct episode identities. Alternate hosts, duplicate editions and numbered parts do not add episodes.
- Keep original Rechov Sumsum, the 1998 Rechov Sumsum/Shara'a Simsim co-production, the modern core seasons, short series and home-video compilations distinct when calculating coverage.
- Number the original series and the 1998 co-production by the IETV programme numbers in the NLI catalogue. Uploader and archive.org season/episode labels, such as "S2E58", follow broadcast or collector order: keep them as alternate labels and evidence in `altLabels`, not in `number` ([one exception](docs/episode-guide.md#episode-identity-and-titles)).
- Do not infer a full episode from duration alone or from Hop's generic use of the word פרק. A short installment can be complete within its own series without being a complete core Rechov Sumsum broadcast.
- Distinguish metadata checked, playback startup observed, complete playback reviewed, and completeness compared against a reference edition. Record the exact URL, date and evidence for a stronger claim.
- A Vimeo playback start seen outside the VPN (Word of the day: A hug) does not verify other Vimeo links or complete playback. Public oEmbed metadata confirms titles and durations, not playback or an uncut episode. YouTube copies that returned country restrictions or generic errors are not VPN-free alternatives.
- Preserve original titles, uploader names, source URLs, privacy hashes and stable catalog ids. English titles and theme and character tags may be editorial; do not present them as publisher-supplied facts.
- Name an archive.org uploader by the public "Uploaded by" name on the item's details page, with its `@screenname` page as `uploaderUrl`, or "Unknown (archive.org)" when the page shows Unknown. The item metadata's `uploader` field is a private email address; never derive a name from it.
- Use primary sources for production totals where available. Keep contradictory totals and uncertain mappings explicit, and record an unconfirmed lead as a lead, not a fact. Annual regulator accounting and current website counts do not establish a lifetime production total.
- When a gap is filled or a mapping is resolved, update `data/episode-guide.json`, [TODO.md](TODO.md), the relevant research note and the episode audit. Acquisition and completeness verification are separate tasks.
