# Rechov Sumsum video index

This is an index of Rechov Sumsum, Shalom Sesame and Elmo's Israeli talk show videos, and of where you can watch them. Rechov Sumsum, רחוב סומסום, is the Israeli Sesame Street, mostly in Hebrew. The index covers the classic Israeli Educational Television series and the later seasons made with the Israeli children's channel Hop!. Shalom Sesame is a separate show: two English-language series about Israel and Jewish life. Elmo's talk show is תכנית האירוח של אלמו.

It stores links and metadata only. There is no video in this repository.

## Using it

Open https://jbearak.github.io/sumsum/.

Or clone the repository and open `index.html` in a browser. The file works on its own, with no server and nothing to install.

```sh
git clone https://github.com/jbearak/sumsum.git
```

The interface is in English. The English/עברית switch at the top of the page changes it to Hebrew, laid out right to left.

The Episode guide goes through each series episode by episode. Browse lists every video, clips and songs included, with filters for series, type, where it plays, theme and character. Videos open on their original site in a new tab.

Each episode's coverage label (Whole link, Parts only, Excerpts only or Missing) says what is linked, and its evidence label (Metadata checked, Playback started, Watched in full or Compared with a reference) says how far that link has been checked.

## Where the videos are

- Free uploads on YouTube, archive.org, Vimeo, Dailymotion and other sites. Most of these links have not been checked by playing them. The library marks the links that failed when checked, including some blocked outside Israel, and any free broadcaster stream that plays only inside its service area.
- Hop!'s official pages. They show their player only to a connection from Israel, for example through a VPN. The library also gives the direct Vimeo link found on each page. These links open on Vimeo without an Israeli connection, but most have not yet been checked by playing them.
- hoopla, a streaming service that is free with a card from a participating public library. You sign in to hoopla with the card. Anyone 12 or older who lives, works, goes to school or owns property in New York State can apply online for a free Queens Public Library eCard. Westchester County library cards work too; in hoopla, choose "Westchester Library System" rather than your own library's name. New York Public Library and Brooklyn Public Library cards do not work. Elsewhere, look up your own library in hoopla. Each library sets a small monthly borrowing limit.
- Apple TV's US store and Prime Video, where you buy or rent each programme with an account.

hoopla, Apple TV and Prime Video are library or paid services, not free uploads. So far their listings are mostly the 2010 Shalom Sesame series, so use the "Where it plays" filter in Browse to see what a service has before you sign up. Library rules, fees and limits change. The "How to watch on hoopla" box on hoopla listings gives every fact's source and the date it was checked.

## Your stars and marks

Stars, watched marks and any Vimeo link you paste into a Hop! listing are saved in your browser, not in the repository. Browsers keep them per site, so the GitHub Pages copy and a copy opened from your disk have separate lists. To move them, open "About, evidence levels and backup" at the bottom of the page and use its Export backup and Import backup or collector report buttons. Export a backup before you move the file or change browsers.

## Contributing

If you collect these programmes, the Missing episodes and Videos to identify pages, in the menu beside Browse, show what the index lacks and what still needs a name.

First read [AGENTS.md](AGENTS.md) and the doc in [docs/](docs/) that covers your change; AGENTS.md lists them. They are written for the AI agents that maintain the index, and their parts about Zen, Proton VPN and 1Password describe the maintainer's own setup. Their rules for numbering episodes, linking uploads and recording evidence apply to everyone. The notes in [research/](research/) cite the sources behind episode totals and identifications.

`index.html` is generated. Edit the JSON files in `data/` or the interface in `library.template.html`, then rebuild and check:

```sh
python3 scripts/build-library.py
node scripts/check-library.cjs
```

Both scripts use only the standard libraries of Python 3 and Node.js. Commit the rebuilt `index.html` with your changes. Add links with their source, and never add video files.

This is a personal viewing index. Rights to the programmes stay with their owners.
