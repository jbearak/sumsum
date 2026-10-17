# VPN setup and playback checks

Configured on October 17, 2026, in Zen's Home workspace on this Mac.

## Routing

The official Proton VPN browser extension is installed and pinned in Zen. It is signed into the existing Proton account. The browser showed an active VPN Plus plan and a connection to Israel, Tel Aviv, server IL#734 during collection. Tel Aviv was then selected explicitly as the city, reconnecting to IL#759 for the final configuration.

Split tunneling is enabled in **Include mode**, with `hop.co.il` and all its subdomains as the sole selected website. Auto-connect is enabled. Vimeo, its media domains, YouTube, and unrelated websites are outside this include list. Other applications do not use this browser extension's tunnel.

Zen's Home, Work, and Gmail spaces share the browser extension. The setup and library tabs belong in Home. The extension's domain rule applies throughout that Zen profile, including a Hop link opened from another workspace.

This uses the [official Firefox extension linked by Proton](https://protonvpn.com/support/browser-extensions). Proton documents domain include mode in its [split-tunneling instructions](https://protonvpn.com/support/protonvpn-split-tunneling). The browser extension operates independently of the desktop VPN app.

## Observed playback

The official Hop page for [Word of the day: A hug](https://hop.co.il/shows/%D7%A8%D7%97%D7%95%D7%91-%D7%A1%D7%95%D7%9E%D7%A1%D7%95%D7%9D-%D7%9E%D7%99%D7%9C%D7%AA-%D7%94%D7%99%D7%95%D7%9D/%D7%A2%D7%95%D7%A0%D7%94-1%D7%97%D7%91%D7%95%D7%A7/) loaded its embedded Vimeo player through the Hop-only tunnel. The player advanced to 00:58 of 06:14 before being paused.

Its exact [unlisted Vimeo link](https://vimeo.com/916707529/6cdb440a7c) was then opened directly in a new Home tab. The player advanced to 00:14 of 06:14 while Vimeo remained outside the VPN include list. It was paused after the check. This verifies the requested discovery-through-Hop, direct-playback-through-Vimeo workflow for this video.

Vimeo's public oEmbed endpoint also returned the Hoptv title and a 374-second runtime over the normal shell connection. This metadata check is separate from playback verification. Other catalog links have their individual verification status recorded in the data.

## Using the local library

Open `index.html` in Zen's Home workspace. Its search and filters work from the local file without a server. The language button switches all interface controls between English and Hebrew. Playback opens the original video host in a new tab.

The Full episodes filter uses source descriptions and explicit full-episode listings. Long uploads whose completeness is only inferred appear under Unconfirmed episodes. Tags come from source titles and descriptions, so a character may appear in an item that has no character tag.

Favorites and manually saved Vimeo links stay in the browser's local storage. The backup controls export them as JSON. Keep the HTML file at the same location to retain the same local-file storage context.

No VPN passwords, account tokens, or proxy credentials are included in the HTML or catalog files. The catalog contains links and metadata, not downloaded video media.
