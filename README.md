# Rechov Sumsum video index

This is an index of Rechov Sumsum, Shalom Sesame and Elmo's Israeli talk show videos, and of where you can watch them. Rechov Sumsum, רחוב סומסום, is the Israeli Sesame Street. The index covers the classic Israeli Educational Television series and the later seasons made with the Israeli children's channel Hop!. Shalom Sesame is a separate show: two English-language series about Israel and Jewish life. Elmo's talk show is תכנית האירוח של אלמו.

It stores links and metadata only. There is no video in this repository.

## Using it

Open https://jbearak.github.io/sumsum/.

Or clone the repository and open `index.html` in a browser. The file works on its own, with no server and nothing to install. Clone the branch that GitHub Pages publishes, because the default branch, `main`, still has an older version of the library:

```sh
git clone --branch t3/expand-rechov-catalog-improve-ui https://github.com/jbearak/sumsum.git
```

The interface is in English. The English/עברית switch at the top of the page changes it to Hebrew, laid out right to left.

The Episode guide goes through each series episode by episode. Browse lists every video, clips and songs included, with filters for series, type, theme and character. Videos open on their original site in a new tab.

## Where the videos are

- Free uploads on YouTube, archive.org, Vimeo, Dailymotion and other sites. Most of these links have not been tested by playing each one. Some uploads, official and community, failed when checked, some only from outside Israel, and a few free streams play only inside their own service area. The library marks each of these.
- Hop!'s official pages. They show their player only to a connection from Israel, for example through a VPN. The library also lists the direct Vimeo links found on those pages. Those open on Vimeo without an Israeli connection, and the library records which ones have been seen to play.
- hoopla, a streaming service that is free with a card from a participating public library. You sign in to hoopla with the card. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County library cards work too; in hoopla, choose "Westchester Library System" rather than your own library's name. New York Public Library and Brooklyn Public Library cards do not work. Elsewhere, look up your own library in hoopla. Each library sets a small monthly borrowing limit.
- Apple TV's US store and Prime Video, where you buy or rent each programme with an account.

hoopla, Apple TV and Prime Video are library or paid services, not free uploads. So far their listings are mostly the 2010 Shalom Sesame series, so use the "Where it plays" filter to see what a service has before you sign up. Library rules, fees and limits change. The "How to watch on hoopla" box on hoopla listings gives every fact's source and the date it was checked.

## Coverage and evidence

Coverage says what kind of link an episode has: the whole programme, parts, excerpts or nothing yet. Evidence says how far someone has checked that link: its title and length, playback starting, watching it in full, or comparing it with a reference edition. A whole-programme link stays unverified until someone watches it to the end.

If you collect these programmes, the Missing episodes and Videos to identify pages, in the menu beside Browse, show what the index lacks and what still needs a name.

## Your stars and marks

Stars, watched marks and Vimeo links you paste are saved in your browser, not in the repository. Browsers keep them per site, so the GitHub Pages copy and a copy opened from your disk have separate lists. To move them, open "About, evidence levels and backup" at the bottom of the page and use its Export backup and Import backup buttons. Export a backup before you move the file or change browsers.

## Contributing

First read [docs/episode-guide.md](docs/episode-guide.md) and [AGENTS.md](AGENTS.md). They are written for the AI agents that maintain the index, and their parts about Zen, Proton VPN and 1Password describe the maintainer's own setup. Their rules for numbering episodes, linking uploads and recording evidence apply to everyone. The notes in [research/](research/) cite the sources behind episode totals and identifications.

`index.html` is generated. Edit the JSON files in `data/` or the interface in `library.template.html`, then rebuild and check:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

Both scripts use only the standard libraries of Python 3 and Node.js. Commit the rebuilt `index.html` with your changes. Add links with their source, and never add video files.

This is a personal viewing index. Rights to the programmes stay with their owners.
