# Rechov Sumsum video index

This is an index of Rechov Sumsum videos, and of where you can watch them. Rechov Sumsum, רחוב סומסום, is the Israeli Sesame Street. The index covers the classic Israeli Educational Television series, the later seasons made with the Israeli children's channel Hop!, both Shalom Sesame series, and Elmo's Israeli talk show, תכנית האירוח של אלמו.

It stores links and metadata only. There is no video in this repository.

## Using it

Open https://jbearak.github.io/sumsum/.

Or clone the repository and open `index.html` in a browser. The file works on its own, with no server and nothing to install.

```sh
git clone https://github.com/jbearak/sumsum.git
```

The interface is in English. The English/עברית switch at the top of the page changes it to Hebrew, laid out right to left.

The Episode guide goes through each series episode by episode. Browse lists every video, clips and songs included, with filters for series, type, theme and character. Videos open on their original site in a new tab.

## Where the videos are

- Free uploads on YouTube, archive.org, Vimeo, Dailymotion and other sites. Some official YouTube uploads failed when checked from outside Israel, and the library marks them.
- Hop!'s official pages. They show their player only to a connection from Israel, for example through a VPN. The library also lists the direct Vimeo links found on those pages. Those open on Vimeo without an Israeli connection, and the library records which ones have been seen to play.
- hoopla, free with a card from a participating public library. You sign in to hoopla with the card. Anyone who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County library cards work too. In hoopla, choose "Westchester Library System" rather than your own library's name. New York Public Library and Brooklyn Public Library cards do not work. Each library sets a small monthly borrowing limit.
- Apple TV's US store and Prime Video, where you buy or rent each programme with an account.

hoopla, Apple TV and Prime Video are services, not free uploads. Library rules, fees and limits change, so check your own library's terms. The "How to watch on hoopla" box on hoopla listings gives every fact's source and the date it was checked.

## Coverage and evidence

Coverage says what kind of link an episode has: the whole programme, parts, excerpts or nothing yet. Evidence says how far someone has checked that link, from its title and length up to watching it in full. A whole-programme link stays unverified until someone watches it to the end.

If you collect these programmes, the Missing episodes and Videos to identify pages, in the menu beside Browse, show what the index lacks and what still needs a name.

## Your stars and marks

Stars, watched marks and Vimeo links you paste are saved in your browser, not in the repository. Browsers keep them per site, so the GitHub Pages copy and a copy opened from your disk have separate lists. To move them, open "About, evidence levels and backup" at the bottom of the page and use its Export backup and Import buttons. Export a backup before you move the file or change browsers.

## Contributing

`index.html` is generated. Edit the JSON files in `data/` or the interface in `library.template.html`, then rebuild and check:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

Both scripts use only the standard libraries of Python 3 and Node.js. Commit the rebuilt `index.html` with your changes.

Read [AGENTS.md](AGENTS.md) and [docs/](docs/) first. They set the rules for numbering episodes, linking uploads and recording evidence. The notes in [research/](research/) cite the sources behind episode totals and identifications. Add links with their source, and never add video files.

This is a personal viewing index. Sesame Workshop, Hop! and the video hosts keep their rights to the programmes.
