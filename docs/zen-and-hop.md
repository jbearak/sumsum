# Zen, Proton VPN and Hop links

Read this before browser, VPN or Hop work. The rules are in [AGENTS.md](../AGENTS.md#zen-proton-vpn-and-hop). [research/vpn-setup.md](../research/vpn-setup.md) records the setup and each check as observed, and [research/hop.md](../research/hop.md) the Hop inventory and collection runs.

## Zen's Home workspace

Home, Work and Gmail are workspaces in one Zen browser profile. Home is the user's personal workspace; the user corrected an earlier attempt that used Work. It is not a separate profile named Personal.

The Proton extension and its domain rule apply across that profile. Selecting Home does not create a separate VPN configuration, and a Hop link opened from another workspace also goes through the tunnel.

## Proton VPN extension

The official Proton VPN Firefox extension is installed and pinned in Zen, signed into the user's account with VPN Plus.

| Setting | Intended value |
| --- | --- |
| Location | Israel, **Tel Aviv** |
| Split tunneling | Enabled, **Include mode** |
| Included websites | **Only `hop.co.il`, including all its subdomains** |
| Auto-connect | Enabled |

Vimeo, YouTube and unrelated websites stay outside the include list. Other applications do not use the extension's tunnel.

Assigned servers change: IL#734 and then IL#759 on 2026-10-17, IL#751 on 2026-10-18. On 2026-10-18 the extension was found disconnected despite auto-connect, and was reconnected to Tel Aviv from Recents.

## Discover through Hop, play through the host

1. Switch Zen to Home and open the pinned Proton VPN extension.
2. Confirm the connection to Israel, Tel Aviv, and the Hop-only Include rule.
3. Open the official Hop collection or video page in a Home tab. Without the Israeli connection, Hop's region restriction can hide the player.
4. Take the embedded Vimeo URL from the Hop page, with its complete privacy hash and any required parameters; a numeric video id alone can be insufficient. Keep the Hop source URL alongside it.
5. Open the direct Vimeo URL in another Home tab, or use the library's Vimeo action. Vimeo is outside the VPN rule, so the Hop tunnel can stay connected.
6. Record playback evidence separately from metadata and episode completeness. If a link fails, check its exact URL, privacy hash and current availability before changing VPN routing.

Hop's discovery pages are [Rechov Sumsum](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D/) and [Elmo's Israeli talk show](https://hop.co.il/shows/%D7%AA%D7%9B%D7%A0%D7%99%D7%AA-%D7%94%D7%90%D7%99%D7%A8%D7%95%D7%97-%D7%A9%D7%9C-%D7%90%D7%9C%D7%9E%D7%95/).

## Hop link collector

[scripts/collect-hop-links.js](../scripts/collect-hop-links.js) runs in the console of an accessible Hop tab in Zen Home. It reads public Hop pages from the same origin and produces a JSON report, left in `window.hopCollectorResult` and offered as a download. It downloads no video media.

- Its manifest is embedded in the script. Keep it in the same order as `data/hop-url-manifest.json` and `data/hop-records.json` when adding pages.
- Every manifest page had its Vimeo link as of 2026-10-18. [TODO.md](../TODO.md#collecting-links-for-hop-pages-added-later) has the steps for pages added later, including how to merge a report under the rule in [AGENTS.md](../AGENTS.md#files-and-build).

[AGENTS.md](../AGENTS.md#zen-proton-vpn-and-hop) allows a computer-wide VPN for this task. No Proton desktop app was installed as of 2026-10-18, so that route would first need an install and sign-in.

## Driving Zen from the shell

Screen capture from T3 Code raises a macOS prompt to "bypass the private window picker". That permission is the user's decision; never click it. Without that permission, capture shows only T3's own windows.

The macOS accessibility API works instead. System Events has Accessibility permission (it does the toolbar click below), and the Swift helper needs the app that runs it to be trusted too. Run these commands with the sandbox disabled.

- [ax.swift](ax.swift) is a small helper that walks `AXChildren` quickly. Compile it with `swiftc -o "$TMPDIR/ax" docs/ax.swift`. `ax dump <app> [depth] [filter]` prints the tree; `ax press <app> <label substring>` presses the first match. It also has `click <x> <y>` and `setvalue <app> <substring> <value>`. AppleScript's `entire contents` is too slow on large pages and times out.
- Proton's toolbar button label reads "Proton VPN: Unprotected" or "Proton VPN: Protected - IL#nnn". AXPress on that button did not open the popup; a System Events click at its centre did.
- The popup is an AXPopover. Its buttons, such as "Connect to Tel Aviv", "Features" and "Configure split tunneling", respond to AXPress.
- Cmd+T opens a tab in the active workspace. Confirm the Home group in the sidebar's accessibility tree. Dismiss Firefox's "Translate this page?" popover with Escape.
- Cmd+Opt+K opens the console. Pasting with `pbcopy` and then Cmd+V worked, with no "allow pasting" guard. Copy results out with `copy(JSON.stringify(window.hopCollectorResult))` in the console, then `pbpaste` in the shell.
- The shell cannot read `~/Downloads` (macOS privacy controls), so take the collector report from the console rather than from its download.
