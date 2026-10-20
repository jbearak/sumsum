# Attribution for quoted text

## Muppet Wiki episode summaries

`summaryEn` in `data/guide-sesame-street.json` is the opening one or two sentences of an episode's summary (or of its first scene, where the label says so) on Muppet Wiki, quoted verbatim. Each episode's `summarySource` names Muppet Wiki and the page revision read (`revisionId`); the episode's first source is the page. The library shows each excerpt with a link to that revision and to the licence.

- Licence: Muppet Wiki's community content is available under CC BY-SA. On 2026-10-19 the wiki's site information (`https://muppet.fandom.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo`) gave the rights text `CC-BY-SA` and the licence page `https://www.fandom.com/licensing`. That page refused an automated request (HTTP 402), so the licence version was not read from it.
- Changes: the excerpts are shortened to their opening sentences and otherwise unchanged.
- Authors: the contributors listed in each page's history on Muppet Wiki.

Other episode details (air dates, sponsors, word on the street, guest stars) are facts compiled from the same pages and the other sources the guide cites.
