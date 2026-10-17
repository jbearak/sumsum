# Project purpose

Maintain a local, interactive video-link library for classic and modern Rechov Sumsum, classic and modern Shalom Sesame, and Elmo's Israeli talk show, תכנית האירוח של אלמו. Collect episode and clip links, source metadata, and evidence about completeness and availability. Store links and metadata rather than video media.

The library is `index.html`, a self-contained generated file. Its default UI is English, with a Hebrew toggle and RTL layout. Preserve filtering by series, program type, theme, and character, dynamic filter counts, and longest-first duration sorting. Full episodes and complete installments of short series are separate categories.

Read [TODO.md](TODO.md) for episode totals, coverage gaps, and the acquisition checklist. The files in `research/` explain the evidence and its limits.

# Use Zen's Home workspace

- Use the existing **Zen browser**, in its **Home workspace**, for this project. Home is the user's personal workspace. The user explicitly corrected an earlier attempt that used Work.
- Home, Work, and Gmail are workspaces in one browser profile. Home is not a separate browser profile named Personal. Do not create a new profile to interpret this preference.
- Keep project and setup tabs in Home. Preserve unrelated tabs and workspaces.
- The Proton extension and its domain rules apply across this Zen profile. Selecting Home does not create a separate VPN configuration.
- When using browser or computer-control tools, select the existing Zen surface. A shell request, another browser, or the in-app browser does not inherit Zen's extension tunnel.

# Existing Proton VPN setup

The setup recorded on October 17, 2026 uses the official Proton VPN Firefox browser extension in Zen. It is installed, pinned, and signed into the user's existing account with VPN Plus. See [research/vpn-setup.md](research/vpn-setup.md) for the original configuration and playback observations.

| Setting | Intended value |
| --- | --- |
| Location | Israel, **Tel Aviv** |
| Split tunneling | Enabled, **Include mode** |
| Included websites | **Only `hop.co.il`, including all its subdomains** |
| Auto-connect | Enabled |

Vimeo, YouTube, and unrelated websites remain outside the include list. Other applications do not use this browser extension's tunnel. This selective routing is intentional. Preserve it when working on the collection; do not switch to a system-wide VPN or add broad website rules as a routine workaround.

Select Tel Aviv by city, rather than depending on a fixed server number. The original setup used IL#734 and later IL#759; assigned servers can change. Check the extension's current connection when regional access is needed instead of assuming an earlier session is still connected.

Login information is stored in 1Password. Use the existing signed-in session when available. If reauthentication is needed, use 1Password through the supported account/browser flow. Never put passwords, session tokens, cookies, or proxy credentials in project files, logs, or generated HTML.

# Discover through Hop, play through the host

1. Switch Zen to Home and open the pinned Proton VPN extension.
2. Confirm connection to Israel, Tel Aviv, and the Hop-only Include rule above.
3. Open the official Hop collection or video page in a Home tab. Hop's region restriction can hide the player when this connection is absent.
4. Obtain the actual embedded Vimeo URL from the accessible Hop page. Preserve its complete privacy hash and any required parameters. A numeric video ID alone can be insufficient. Keep the Hop source URL alongside the direct URL.
5. Open the direct Vimeo watch URL in another Home tab, or use the library's Vimeo action. Vimeo stays outside the VPN rule, so there is no need to disconnect the Hop tunnel for this step.
6. Record playback evidence separately from metadata and episode completeness. If a link fails, check its exact URL, privacy hash, and current availability before changing VPN routing.

The Hop discovery pages are [Rechov Sumsum](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) and [Elmo's Israeli talk show](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/).

One exact Vimeo video, Word of the Day: A hug, had playback startup observed outside the VPN. That does not verify every Vimeo link or complete playback. Public oEmbed metadata confirms titles and durations, not playback or an uncut episode. Some official YouTube links returned country restrictions or generic availability errors; they are not established VPN-free alternatives.

# Files and update workflow

| File | Role |
| --- | --- |
| `library.template.html` | Editable UI source |
| `data/hop-records.json` | Official Hop page metadata |
| `data/hop-youtube-records.json` | Official Hop/Rechov YouTube uploads |
| `data/sesame-records.json` | Classic Rechov and both Shalom Sesame inventories |
| `data/hop-url-manifest.json` | Hop source-page collection inventory |
| `data/hop-player-links.json` | Exact Vimeo URLs discovered from Hop pages and playback evidence |
| `data/vimeo-metadata.json` | Cached public Vimeo oEmbed results |
| `data/*-episode-audit.json` | Episode identity mappings, source confidence, and unresolved tasks |
| `research/` | Cited findings, classification decisions, and setup observations |
| `index.html` | Generated library to open in Zen Home |

Edit the template or source JSON and rebuild. Do not make UI fixes only in generated `index.html`.

Run these commands from the project root after catalog or UI changes:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

The builder embeds `data/*-records.json` and integrates the exact links and explicit playback evidence from `data/hop-player-links.json`. Keep the generated `index.html` with its source changes.

For Hop link collection, [scripts/collect-hop-links.js](scripts/collect-hop-links.js) is a same-origin public-page collector intended to run in an accessible Hop tab in Zen Home. It collects JSON, without downloading video media. Its manifest is embedded in the script; keep it consistent with the source inventory when adding pages. Preserve existing successful links and playback evidence when importing a new report.

To enrich already discovered Vimeo URLs with public metadata, run:

```sh
python3 scripts/enrich-vimeo.py
```

This makes network requests and updates the metadata cache and Hop catalog. Successful cached results are reused unless `--refresh` is supplied. It preserves playback/access evidence. Rebuild afterward and inspect the changes.

The local HTML works without a server and opens playback on the original host. Favorites and manually saved links use browser local storage. Keep the file path and browser context stable, and use the library's JSON backup controls before moving the file or changing how it is opened.

# Evidence and episode counts

- Count upload URLs separately from distinct episode identities. Alternate hosts, duplicate editions, and numbered parts do not create additional episodes.
- Keep original Rechov Sumsum, the later Rechov Sumsum/Shara'a Simsim co-production, modern core seasons, short series, and home-video compilations distinct when calculating coverage.
- Do not infer a full episode from duration alone or from Hop's generic use of the word פרק. A short installment can be complete within its own series without being a complete core Rechov Sumsum broadcast.
- Distinguish metadata checked, playback startup observed, complete playback reviewed, and completeness compared against a reference edition. Record the exact URL, date, and evidence for a stronger claim.
- Preserve original titles, uploader names, source URLs, privacy hashes, and stable catalog IDs. English titles and theme/character tags may be editorial; do not present them as publisher-supplied facts.
- Use primary sources for production totals where available. Keep contradictory totals and uncertain mappings explicit. Annual regulator accounting and current website counts do not automatically establish a lifetime production total.
- Update `TODO.md`, the relevant research note, and the episode audit when a gap is filled or a mapping is resolved. Acquisition and completeness verification are separate tasks.
