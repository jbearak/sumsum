#!/usr/bin/env python3
"""Build the US Sesame Street data files from the October 2026 research sweep.

The sweep (eight agents, 19 October 2026) wrote its outputs to a scratch directory, by default .sweep/sesame-street/:
three episode inventories (inv-a, inv-b, inv-c) and five link searches (links-archive, links-yt-official,
links-yt-community, links-streaming, links-other), each with a report.md. research/sesame-street-us.md describes them.

    python3 scripts/import-sesame-street.py [--sweep DIR]

It writes, replacing earlier output of this script:

- data/guide-sesame-street.json: the production, its 4,744 aired episodes and its queue of uploads to identify.
- data/sesame-street-archive-records.json, data/sesame-street-youtube-records.json, data/sesame-street-other-records.json:
  one record per link, with file-level defaults for repeated text.
- data/sesame-street-episode-audit.json: what the guide does not hold: failed discovery requests, services without mapped
  episodes, conflicts, gaps, pilots and specials, and the per-agent statistics.

It also reads data/sesame-street-titles-he.json (our Hebrew translations of the English titles, titleHeEditorial) when
present. It reads only these files and makes no network request. After editing the data by hand, do not run it again
without merging those edits into the sweep first.
"""
import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PROD = "sesame-street"
SERIES = "sesame-street"
LINK_AGENTS = ["links-archive", "links-yt-official", "links-yt-community", "links-streaming", "links-other"]
CHECKED = "2026-10-19"

# Licensed listings by hostname: the service in data/licensed-services.json that serves them. Tubi and the Roku Channel
# are free with ads; the sweep recorded them as free hosts, so they become licensed listings of a free-with-ads service.
LICENSED_HOSTS = {
    "hbomax.com": "hbo-max", "max.com": "hbo-max", "netflix.com": "netflix", "hulu.com": "hulu",
    "itunes.apple.com": "apple-tv", "tv.apple.com": "apple-tv", "primevideo.com": "prime-video",
    "play.google.com": "google-tv", "youtube.com": "youtube-purchase", "tubitv.com": "tubi",
    "therokuchannel.roku.com": "roku-channel", "kanopy.com": "kanopy",
}
# Listings left out: Prime Video's HBO Max channel (an add-on the user does not have, duplicating HBO Max's own listings)
# and Spectrum On Demand (no episode mapped). The audit records them.
SKIP_SERVICES = {"HBO Max on Prime Video Channels", "Spectrum On Demand"}

# Characters named in an episode's summary, editorial tags (data/vocabulary.json). Names shared with the Israeli dub keep
# that tag (Big Bird is 'big bird', whose Hebrew name is the dub's).
CHARACTERS = [
    ("elmo", r"\bElmo\b"), ("big bird", r"\bBig Bird\b"), ("cookie monster", r"\bCookie Monster\b"), ("oscar", r"\bOscar\b"),
    ("grover", r"\bGrover\b"), ("bert", r"\bBert\b"), ("ernie", r"\bErnie\b"), ("count", r"\bThe Count\b|\bCount von Count\b"),
    ("telly", r"\bTelly\b"), ("zoe", r"\bZoe\b"), ("rosita", r"\bRosita\b"), ("abby cadabby", r"\bAbby\b"),
    ("snuffy", r"\bSnuffy\b|\bSnuffleupagus\b"), ("kermit", r"\bKermit\b"), ("baby bear", r"\bBaby Bear\b"),
    ("prairie dawn", r"\bPrairie Dawn\b"), ("herry monster", r"\bHerry\b"), ("julia", r"\bJulia\b"),
    ("gabrielle", r"\bGabrielle\b"), ("tango", r"\bTango\b"), ("gordon", r"\bGordon\b"), ("susan", r"\bSusan\b"),
    ("maria", r"\bMaria\b"), ("luis", r"\bLuis\b"), ("bob", r"\bBob\b"), ("mr. hooper", r"\bMr\. Hooper\b"),
    ("linda", r"\bLinda\b"), ("gina", r"\bGina\b"), ("alan", r"\bAlan\b"), ("chris", r"\bChris\b"),
    ("sherlock hemlock", r"\bSherlock Hemlock\b"), ("slimey", r"\bSlimey\b"), ("murray", r"\bMurray\b"),
]
CHAR_RE = [(k, re.compile(p)) for k, p in CHARACTERS]
MUSIC_RE = re.compile(r"\bsongs?\b|\bsings?\b|\bsinging\b|\bmusic\b|\bmusical\b", re.I)


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def short_hash(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def host_of(url):
    return (urlsplit(url).hostname or "").removeprefix("www.")


def service_of(url):
    h = host_of(url)
    for host, sid in LICENSED_HOSTS.items():
        if h == host or h.endswith("." + host):
            return sid
    return None


def record_id(c):
    url = c["url"]
    h = host_of(url)
    parts = urlsplit(url)
    if h in ("youtube.com", "m.youtube.com", "youtu.be"):
        vid = (parse_qs(parts.query).get("v") or [""])[0] or parts.path.strip("/").split("/")[-1]
        if re.fullmatch(r"[\w-]{11}", vid):
            return "yt-" + vid
    if h == "archive.org":
        seg = [unquote(s) for s in parts.path.split("/") if s]
        if len(seg) >= 2 and seg[0] == "details":
            return "ia-" + seg[1] + ("-" + short_hash(url) if len(seg) > 2 else "")
    if h in ("dailymotion.com", "dai.ly"):
        m = re.search(r"/video/([a-z0-9]+)", parts.path)
        if m:
            return "dm-" + m.group(1)
    return "web-" + short_hash(url)


def chars_in(text):
    return [k for k, rx in CHAR_RE if text and rx.search(text)]


def clean(value):
    return value.strip() if isinstance(value, str) and value.strip() else None


def ep_id(number):
    return f"{PROD}-{number}"


def season_label(s):
    years = (s.get("years") or "").replace("-", "–")
    return f"Season {s['season']} · {years}".strip(" ·"), f"עונה {s['season']} · {years}".strip(" ·")


def summary_label(src):
    # The three inventories describe the excerpt differently: section "... SCENE 1 ..." (inv-a, inv-b), or excerptBasis
    # "first street-scene description ..." (inv-c); one quotes the first listed insert.
    section = ((src or {}).get("section") or "") + " " + ((src or {}).get("excerptBasis") or "")
    if "SCENE 1" in section or "street-scene" in section:
        return "Muppet Wiki, first scene", "first-scene"
    if "first listed insert" in section:
        return "Muppet Wiki, first insert", "first-insert"
    return "Muppet Wiki", "summary"


def episode_rows(inventories):
    episodes, seasons, specials, conflicts, gaps, out_of_scope = [], [], [], [], [], []
    for inv in inventories:
        episodes += inv["episodes"]
        seasons += inv["seasons"]
        specials += inv.get("specials", [])
        conflicts += [dict(c, inventory=inv["agent"]) if isinstance(c, dict) else {"inventory": inv["agent"], "text": c}
                      for c in inv.get("conflicts", [])]
        gaps += [dict(g, inventory=inv["agent"]) if isinstance(g, dict) else {"inventory": inv["agent"], "text": g}
                 for g in inv.get("gaps", [])]
        out_of_scope += inv.get("outOfScope", [])
    aired = [e for e in episodes if e.get("airDate")]
    return aired, [e for e in episodes if not e.get("airDate")], seasons, specials, conflicts, gaps, out_of_scope


def build_production(seasons, aired):
    numbers = defaultdict(list)
    for e in aired:
        numbers[e["season"]].append(int(e["number"]))
    rows = []
    for s in sorted((s for s in seasons if s["season"] in numbers), key=lambda s: s["season"]):
        ns = sorted(numbers[s["season"]])
        en, he = season_label(s)
        row = {"season": s["season"], "firstNumber": ns[0], "expectedEpisodes": len(ns), "labelEn": en, "labelHe": he,
               "numbering": "documented"}
        holes = sorted(set(range(ns[0], ns[-1] + 1)) - set(ns))
        if holes:
            # Numbers inside the season's range that are not episodes (season 45's repeat labels 4527-4551).
            runs, start = [], holes[0]
            for a, b in zip(holes, holes[1:] + [None]):
                if b != a + 1:
                    runs.append([start, a])
                    start = b
            row["excludedNumbers"] = [{"from": a, "to": b, "noteEn": s.get("notes") or "Not episode numbers.",
                                       "sourceLabel": "Muppet Wiki season page, read by the sweep (inv-c)"} for a, b in runs]
        rows.append(row)
    total = len(aired)
    return {
        "id": PROD, "series": SERIES, "format": "core",
        "numberLabelEn": "Episode", "numberLabelHe": "פרק", "numberWidth": 4,
        "nameEn": "Sesame Street", "nameHe": "רחוב סומסום האמריקאי",
        "years": "1969–2026", "order": 30, "expectedTotal": total,
        "expectedTotalNoteEn": (f"{total:,} episodes aired from Episode 0001 (10 November 1969) through season 56 (2025–26, last aired 8 June 2026), the sum of "
                                "the Muppet Wiki season guides; Wikipedia gives the same total. Season 57 is announced for 23 November "
                                "2026 on Netflix and PBS KIDS and has not aired. The 1969 test pilots, specials and spin-off series are "
                                "not counted. Season 45 is numbered 4501–4526 and 4552; 4527–4551 are repeat labels, not episodes."),
        "expectedTotalNoteHe": (f"{total:,} פרקים שודרו, מפרק 0001 (10 בנובמבר 1969) ועד עונה 56 (2025–26, שודרה לאחרונה ב־8 ביוני 2026): סכום מדריכי העונות של Muppet Wiki; "
                                "גם ויקיפדיה מונה כך. עונה 57 הוכרזה ל־23 בנובמבר 2026 ב־Netflix וב־PBS KIDS ועוד לא שודרה. פרקי הניסיון "
                                "מ־1969, תכניות מיוחדות וסדרות נלוות אינם נספרים. עונה 45 ממוספרת 4501–4526 ו־4552; 4527–4551 הן תוויות "
                                "של שידורים חוזרים, לא פרקים."),
        "totalsEvidence": [
            {"value": total, "confidence": "secondary", "scope": "aired episodes, seasons 1–56 (sum of the season guides)",
             "sourceLabel": "Muppet Wiki, Sesame Street season episode guides (read 2026-10-19)",
             "url": "https://muppet.fandom.com/wiki/Sesame_Street_seasons"},
            {"value": total, "confidence": "secondary", "scope": "episodes through season 56",
             "sourceLabel": "Wikipedia, Sesame Street (revision read 2026-10-19)", "url": "https://en.wikipedia.org/wiki/Sesame_Street"},
        ],
        "seasons": rows,
    }


def build_episode(e):
    number = int(e["number"])
    row = {"id": ep_id(e["number"]), "production": PROD, "season": e["season"], "number": number, "airDate": e["airDate"],
           "confidence": e.get("confidence") if e.get("confidence") in ("documented", "provisional") else "documented"}
    sources = []
    if clean(e.get("titleEn")):
        row["titleEn"] = e["titleEn"].strip()
        ts = e.get("titleSource") or {}
        if ts.get("url") or ts.get("label"):
            sources.append({k: ts[k] for k in ("label", "url") if clean(ts.get(k))})
    summary = clean(e.get("summaryEn"))
    if summary:
        label, kind = summary_label(e.get("summarySource"))
        src = e.get("summarySource") or {}
        row["summaryEn"] = summary
        row["summarySource"] = {"label": label, "url": src.get("url"),
                                **({"revisionId": src["revisionId"]} if src.get("revisionId") else {})}
    sp = e.get("sponsors") or {}
    letters, nums = [x for x in sp.get("letters") or [] if clean(x)], [x for x in sp.get("numbers") or [] if clean(x)]
    if letters or nums:
        row["sponsors"] = {"letters": letters, "numbers": nums}
    word = clean(e.get("wordOnTheStreet"))
    if word:
        row["wordOnTheStreet"] = word.rstrip(".")
    guests = [g.strip() for g in e.get("guestStars") or [] if clean(g)]
    if guests:
        row["guestStars"] = guests
    # Muppet Wiki's descriptive plot labels ("Block party on Sesame Street") are not titles; they help find an upload.
    alts = [{"labelEn": a["labelEn"], "sourceLabel": "Muppet Wiki, descriptive label (not a published title)"
             if "descriptive" in (a.get("sourceLabel") or "") else a.get("sourceLabel")}
            | ({"url": a["url"]} if clean(a.get("url")) and "descriptive" not in (a.get("sourceLabel") or "") else {})
            for a in e.get("altLabels") or [] if clean(a.get("labelEn"))]
    alts = [a for a in alts if a.get("labelEn") and a.get("sourceLabel")]
    if alts:
        row["altLabels"] = alts
    for s in e.get("sources") or []:
        item = {k: s[k] for k in ("label", "url") if clean(s.get(k))}
        if item and item not in sources:
            sources.append(item)
    row["sources"] = sources
    note = clean(e.get("notes"))
    if note:
        row["noteEn"] = note
    row["uploads"] = []
    return row


# Links the sweep matched to an episode that are not Sesame Street episodes (found by the research note's review): left out of
# the records and listed in the audit.
REJECTED = {
    "ia-youtube-1fb7lHcgE8s-f4e2249048": "An unrelated talk show titled '... | Ep 231', matched to 0231 by its number; Muppet Wiki reports 0231 as lost.",
    "ia-yt-5s.com-childrens-television-lost-media-a-compilation-of-classic-mysteries-b09f7d9a2c":
        "A lost-media discussion video, not a copy of 0847.",
}


def relationships(c, aired_numbers):
    """[(number, role, part, container, extent note)] for one candidate, and whether it waits for identification."""
    role0, nums = c.get("proposedRole"), [n for n in c.get("episodeNumbers") or [] if n in aired_numbers]
    if role0 == "unmatched" or not nums:
        return [], True
    unverified = set(c.get("unverifiedEpisodeNumbers") or [])
    text = " ".join(x for x in (c.get("completenessNote"), c.get("notes")) if isinstance(x, str))
    incomplete = set(re.findall(r"\b(\d{4}) incomplete\b", text)) | set(re.findall(r"mark (\d{4}) incomplete", text))
    multi = len(nums) > 1 and role0 in ("whole-candidate", "compilation", "alternate-edition")
    container = ("listing" if c.get("access") == "licensed" else "compilation") if multi else None
    part = c["part"].get("number") if role0 == "part" and isinstance(c.get("part"), dict) else None
    out = []
    for n in nums:
        if n in unverified or c.get("compositionStatus") == "unresolved" or role0 == "possible":
            out.append((n, "possible", None, container, None))
        elif n in incomplete:
            out.append((n, "excerpt", None, container, "The file label marks this episode incomplete within the block."))
        elif role0 == "compilation":
            out.append((n, "whole-candidate", None, container, None))
        elif role0 in ("whole-candidate", "alternate-edition", "excerpt"):
            out.append((n, role0, None, container, None))
        elif role0 == "part":
            out.append((n, "part", part if isinstance(part, int) and part > 0 else None, container, None))
    waits = all(r[1] == "possible" for r in out)
    return out, waits


def kind_for(rels, waits, multi):
    roles = {r[1] for r in rels}
    if waits or not roles:
        return "unverified"
    if multi and roles & {"whole-candidate", "alternate-edition"}:
        return "collection"
    if roles & {"whole-candidate", "alternate-edition"}:
        return "episode"
    return "clip"


def build_record(c, rels, waits, episodes_by_number):
    url = c["url"]
    sid = service_of(url)
    licensed = c.get("access") == "licensed" or sid in ("tubi", "roku-channel")
    title = clean(c.get("originalTitle")) or clean(c.get("fileName")) or "Sesame Street"
    multi = len({r[0] for r in rels}) > 1
    r = {"id": record_id(c), "url": url}
    # The page where the sweep found a link (a channel, playlist or item) is evidence, kept in the link-evidence file.
    r["kind"] = kind_for(rels, waits, multi)
    r["titleEn"] = title
    dur = c.get("durationSeconds")
    if isinstance(dur, (int, float)) and dur > 0:
        r["durationSeconds"] = int(round(dur))
    for k in ("uploader", "uploaderUrl", "uploadDate"):
        if clean(c.get(k)):
            r[k] = c[k].strip()
    if c.get("sourceType") == "official":
        r["sourceType"] = "official"
    if licensed and sid:
        r["access"] = "licensed"
    if clean(c.get("thumbnailUrl")) and host_of(url) not in ("youtube.com", "archive.org"):
        r["thumbnailUrl"] = c["thumbnailUrl"]
    counted = sorted({n for n, role, *_ in rels if role in ("whole-candidate", "alternate-edition", "part")})
    if len(counted) == 1:
        r["guideEpisodeId"] = ep_id(counted[0])
    if c.get("matchConfidence") in ("medium", "low"):
        r["matchConfidence"] = c["matchConfidence"]
    check = c.get("availabilityCheck") or {}
    if check.get("status"):
        r["availabilityCheck"] = {"method": check.get("method") or "sweep metadata check", "checkedAt": check.get("checkedAt") or CHECKED,
                                  "status": check["status"], "result": (check.get("result") or "")[:400]}
    note = clean(c.get("completenessNote"))
    if note and not note.startswith("Metadata checked only."):
        r["completenessNote"] = note if len(note) <= 300 else note[:297].rsplit(" ", 1)[0] + " …"
    labels = [a.get("labelEn") for a in c.get("altLabels") or [] if isinstance(a, dict) and clean(a.get("labelEn"))]
    if labels:
        r["altLabelsEn"] = labels[:6]
    # Editorial tags: characters named in the summary of the episode it is a whole copy or part of, else in its own title.
    summary_text = " ".join(episodes_by_number[n].get("summaryEn", "") for n in counted) if counted else title
    chars = chars_in(summary_text) or chars_in(title)
    if chars:
        r["characters"] = chars
    if MUSIC_RE.search(title):
        r["themes"] = ["music"]
    return r


def archive_item_page(url):
    seg = [s for s in urlsplit(url).path.split("/") if s]
    return f"https://archive.org/details/{seg[1]}" if len(seg) >= 2 and seg[0] == "details" else None


def evidence_of(c, rec):
    """What the sweep recorded for a link beyond the record: how its episode was identified, and its extent."""
    e = {"url": c["url"], "agent": c["_agent"]}
    # Not the uploader's raw description (HTML that can carry third-party share links) or the completeness note (the record has it).
    for k in ("matchBasis", "matchSources", "episodeNumbers", "unverifiedEpisodeNumbers", "compositionStatus",
              "fileName", "listedEpisodes", "notes"):
        v = c.get(k)
        if v not in (None, "", [], {}):
            e[k] = v[:500] if isinstance(v, str) else v
    e.update(provenance(c))
    return e


def provenance(c):
    """Where the sweep found a link: the page it was listed on (when it is not the link itself or, for an archive.org file,
    its item page), the playlists and searches that surfaced it, and other files of the same item."""
    out = {}
    src, url = c.get("sourceUrl"), c.get("url") or ""
    seg = urlsplit(url).path.split("/")
    item = "https://archive.org/details/" + seg[2] if host_of(url) == "archive.org" and len(seg) > 2 and seg[1] == "details" else None
    if src and src not in (url, item):
        out["sourceUrl"] = src
    for k in ("sourcePlaylists", "duplicateFileUrls"):
        if c.get(k) not in (None, "", [], {}):
            out[k] = c[k]
    # The listing pages searched, without the sweep's scratch-file pointers (not tracked) or its single check date.
    found = [{k: x[k] for k in ("spec", "kind") if x.get(k)} for x in c.get("discoverySources") or [] if isinstance(x, dict)]
    if found:
        out["discoverySources"] = found
    return out


def defaults_for(agent_names):
    return {
        "series": SERIES, "production": PROD, "language": "en", "sourceType": "community",
        "notes": "Community upload. The uploader is not verified as the rights holder; availability may change.",
        "verification": ("Public metadata read by the October 2026 Sesame Street sweep (" + ", ".join(agent_names) +
                         "); title, link, uploader and listed duration checked; playback not tested."),
        "verifiedAt": CHECKED, "matchConfidence": "high",
        "tagEvidence": "Characters named in the Muppet Wiki summary of the episode, or in the upload's title; editorial and not exhaustive.",
        "completenessNote": "Metadata checked only. No playback, end-to-end review or reference comparison.",
        "availabilityCheck": {"method": "listing read by the sweep (metadata only)", "checkedAt": CHECKED,
                              "result": "Listed; no failure recorded. Not a playback check."},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sweep", type=Path, default=ROOT / ".sweep/sesame-street")
    args = ap.parse_args()
    sweep = args.sweep
    inventories = [load(sweep / a / "inventory.json") for a in ("inv-a", "inv-b", "inv-c")]
    aired, unaired, seasons, specials, conflicts, gaps, out_of_scope = episode_rows(inventories)
    aired_numbers = {e["number"] for e in aired}
    episodes = {e["number"]: build_episode(e) for e in sorted(aired, key=lambda e: int(e["number"]))}
    production = build_production(seasons, aired)
    # Our Hebrew translations of the English titles (titleHeEditorial), kept in their own tracked file so a re-import keeps them.
    he_path = ROOT / "data/sesame-street-titles-he.json"
    he_titles = load(he_path)["titles"] if he_path.exists() else {}
    for e in episodes.values():
        he = he_titles.get(e["id"])
        if he and e.get("titleEn"):
            e["titleHeEditorial"] = he.strip()
    stray = sorted(k for k in he_titles if k not in {e["id"] for e in episodes.values() if e.get("titleEn")})
    if stray:
        raise SystemExit(f"{he_path.name}: titles for episodes without an English title or not in the guide: {', '.join(stray[:5])}")

    files = {"archive": [], "youtube": [], "other": []}
    queue, seen_ids, by_url = [], {}, {}
    link_files = {a: load(sweep / a / "links.json") for a in LINK_AGENTS}
    stats = Counter()
    evidence, rejected = {}, []
    for agent, data in link_files.items():
        for c in data["candidates"]:
            c["_agent"] = agent
            if c["url"] in by_url:
                stats["duplicate url skipped"] += 1
                # The same link found again (by another search or agent): its discovery provenance stays with the record.
                also = {"agent": agent, **provenance(c)}
                evidence[by_url[c["url"]]["id"]].setdefault("alsoFoundBy", []).append(also)
                continue
            if host_of(c["url"]) == "primevideo.com" and "HBO Max add-on" in (c.get("notes") or ""):
                stats["Prime Video HBO Max channel skipped"] += 1
                continue
            if host_of(c["url"]).endswith("spectrum.net"):
                stats["Spectrum skipped"] += 1
                continue
            rels, waits = relationships(c, aired_numbers)
            rec = build_record(c, rels, waits, episodes)
            if rec["id"] in REJECTED:
                rejected.append({"id": rec["id"], "url": c["url"], "reason": REJECTED[rec["id"]]})
                stats["rejected after review"] += 1
                continue
            if rec["id"] in seen_ids:
                rec["id"] = rec["id"] + "-" + short_hash(c["url"])[:6]
            seen_ids[rec["id"]] = c["url"]
            evidence[rec["id"]] = evidence_of(c, rec)
            by_url[c["url"]] = rec
            h = host_of(c["url"])
            files["archive" if h == "archive.org" else "youtube" if h == "youtube.com" and rec.get("access") != "licensed" else "other"].append(rec)
            for n, role, part, container, extent in rels:
                u = {"recordId": rec["id"], "role": role}
                if part:
                    u["part"] = part
                if container:
                    u["container"] = container
                if extent:
                    u["extentNoteEn"] = extent
                episodes[n]["uploads"].append(u)
            if waits:
                queue.append(rec["id"])
            stats[agent] += 1

    # One upload per record per episode (a record can carry the same number twice in a sweep's list).
    for e in episodes.values():
        seen, ups = set(), []
        for u in e["uploads"]:
            if u["recordId"] in seen:
                continue
            seen.add(u["recordId"])
            ups.append(u)
        e["uploads"] = ups

    guide = {"note": ("US Sesame Street, imported by scripts/import-sesame-street.py from the October 2026 sweep. Episode numbers "
                      "are the production numbers published by Sesame Workshop and Muppet Wiki; uploader, service and DVD numbering "
                      "are alternate labels."),
             "productions": [production], "episodes": list(episodes.values()), "unidentified": {PROD: queue}}
    write(ROOT / "data/guide-sesame-street.json", guide)
    names = {"archive": ["links-archive"], "youtube": ["links-yt-official", "links-yt-community"],
             "other": ["links-streaming", "links-other"]}
    # A completeness note many links share is written once, in completenessNotes, and named by the record's completenessStatus.
    counts = Counter(r.get("completenessNote") for recs in files.values() for r in recs if r.get("completenessNote"))
    table = {}
    for text, n in counts.most_common():
        if n >= 5:
            table[text] = f"ss-{len(table) + 1:02d}"
    for k, recs in files.items():
        for r in recs:
            code = table.get(r.get("completenessNote"))
            if code:
                del r["completenessNote"]
                r["completenessStatus"] = code
        used = {r["completenessStatus"] for r in recs if r.get("completenessStatus")}
        d = defaults_for(names[k])
        write(ROOT / f"data/sesame-street-{k}-records.json",
              {"note": f"US Sesame Street links from the October 2026 sweep ({', '.join(names[k])}). `defaults` applies to every record "
                       "that does not set the field; `completenessNotes` holds the completeness note named by a record's "
                       "completenessStatus. titleEn is the upload's or listing's own title.",
               "defaults": d, "completenessNotes": {code: text for text, code in table.items() if code in used}, "records": recs})
    audit = {
        "note": "US Sesame Street: what the guide and records do not hold, from the October 2026 sweep. See research/sesame-street-us.md.",
        "generatedAt": CHECKED,
        "unairedOrAnnounced": unaired, "pilotsAndSpecials": specials, "inventoryConflicts": conflicts, "inventoryGaps": gaps,
        "outOfScope": out_of_scope + [x for d in link_files.values() for x in d.get("outOfScope", [])],
        "linkGaps": {a: d.get("gaps", []) for a, d in link_files.items()},
        "failedDiscovery": {a: d.get("failedChecks", []) for a, d in link_files.items() if d.get("failedChecks")},
        "servicesFound": link_files["links-streaming"].get("servicesFound", []),
        "linkConflicts": link_files["links-streaming"].get("conflicts", []),
        "rejectedLinks": rejected,
        "importStats": dict(stats),
    }
    write(ROOT / "data/sesame-street-episode-audit.json", audit)
    # One line per link, so a change to one link is a one-line diff.
    lines = [json.dumps(k, ensure_ascii=False) + ": " + json.dumps(v, ensure_ascii=False, separators=(",", ":")) for k, v in evidence.items()]
    note = ("How the October 2026 sweep identified each US Sesame Street link, keyed by record id: the match basis and its sources, "
            "the extent notes, and the episode numbers it named. Not embedded in the library.")
    (ROOT / "data/sesame-street-link-evidence.json").write_text(
        '{"note": ' + json.dumps(note) + ',\n"evidence": {\n' + ",\n".join(lines) + "\n}}\n", encoding="utf-8")
    cov = Counter()
    for e in episodes.values():
        roles = {u["role"] for u in e["uploads"]}
        cov["whole-candidate" if roles & {"whole-candidate", "alternate-edition"} else "parts-only" if "part" in roles
            else "excerpt-only" if "excerpt" in roles else "missing"] += 1
    print(f"{len(episodes)} episodes, {sum(len(v) for v in files.values())} records "
          f"({', '.join(f'{k} {len(v)}' for k, v in files.items())}), {len(queue)} queued; coverage {dict(cov)}; {dict(stats)}")


def write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
