# Library views, routes and storage

Read this before changing `library.template.html`. What the UI must preserve is in [AGENTS.md](../AGENTS.md#project-purpose). Display rules tied to the guide data are in [episode-guide.md](episode-guide.md): episode headings and the Catalogue title, the licensed service named on Watch labels, access lines, filters and notes, and the availability status the library reads.

## Views and routes

The views nav has three items: Episode guide, Browse and Starred.

Browse (`#/browse`) lists every upload with the filters. The old All uploads route, `#/uploads`, still lands there with its filters. The arrow beside Browse opens a menu of three pages:

- **Identified videos** (`#/browse/identified`): every upload that is not awaiting identification, with the same filters.
- **Videos to identify** (`#/browse/unidentified`): uploads in a production's `unidentified` queue and uploads linked only as `possible` copies, by production. `?prod=` shows one production.
- **Missing episodes** (`#/browse/missing`): documented episodes without a whole copy (missing, then parts or excerpts only), then expected places not identified yet.

Identified videos and Videos to identify together hold every upload. Both are defined from the guide data, never from durations.

The Research to-do page (`#/todo`, formerly To find) is linked from the footer and from the Videos to identify and Missing episodes pages. It holds the whole links to check by playback and the JSON export, whose file name and format still say `sumsum-to-find`.

## Browser storage

The file works without a server and opens playback on the original host. Stars, pasted Vimeo links and watched marks live in local storage; [AGENTS.md](../AGENTS.md#files-and-build) says how to keep them. The JSON backup controls are in the library's "About, evidence levels and backup" section.
