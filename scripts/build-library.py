#!/usr/bin/env python3
"""Build the offline video index with embedded research records and the optional episode guide.

Usage: python3 scripts/build-library.py [record-file.json ...] [--guide PATH] [--services PATH] [--output PATH]
With no inputs, reads every data/*-records.json file. The guide defaults to data/episode-guide.json
when that file exists; without it the library is built as a plain uploads index. The licensed services
file (how hoopla, Apple TV and Prime Video are reached) defaults to data/licensed-services.json; without
it licensed listings are labelled without their access terms.
No dependencies or network access are required.
"""
import argparse
import copy
import datetime as dt
import hashlib
import json
import math
import os
import re
import sys
import tempfile
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
KINDS = {"episode", "clip", "collection", "unverified"}
# Record access listings. 'licensed' is an official storefront or library-streaming listing (hoopla, Apple TV, Prime Video);
# data/licensed-services.json says what each service needs. 'direct-link-discovered' is written by apply_player_links().
ACCESS = {"vpn-required", "unavailable", "direct-link-discovered", "licensed"}
# Outcome of a recorded availability check. The UI reads the string form ('country-restricted') or the `status` of the
# object form ({method, checkedAt, status?, result}); the free-text result is evidence for people, not for the app.
# 'country-restricted': failed from outside Israel with a country restriction; 'unavailable': failed with a generic or
# content-claim error; 'region-limited': a free broadcaster stream limited to its service area by a location check.
CHECK_STATUSES = {"country-restricted", "unavailable", "region-limited"}
# Episode-guide contract (summarised in AGENTS.md, "Editing the episode guide"). 'related-series' productions (a related Israeli series or
# broadcast version) are counted separately from core Rechov Sumsum.
FORMATS = {"core", "short-series", "talk-show", "home-video", "related-series", "queue"}
NUMBERINGS = {"documented", "uploader", "inferred", "provisional"}
CONFIDENCES = {"documented", "provisional", "uploader-label"}
TOTAL_CONFIDENCES = {"primary", "secondary", "conflicting", "annual-accounting-only", "current-listing-only"}
# 'possible': a copy that probably is this episode but whose identity is unresolved. It never counts toward coverage,
# evidence or the episode's Watch link.
ROLES = {"whole-candidate", "alternate-edition", "part", "excerpt", "possible"}
CONTAINERS = {"compilation", "listing"}
COUNTED_ROLES = ROLES - {"possible"}
COVERAGES = {"whole-candidate", "parts-only", "excerpt-only", "missing"}
EVIDENCE = ["metadata-checked", "playback-started", "complete-playback-reviewed", "reference-compared"]
# Optional episode fields for a story name quoted from another source; see validate_guide().
STORY_FIELDS = ("storyHe", "storySourceEn", "storySourceHe")
# Optional record and episode field: our Hebrew translation of the editorial English title (or of the original title) for an
# item with no published Hebrew title; see editorial_he_problem().
EDITORIAL_HE = "titleHeEditorial"
# A Hebrew letter (alef to tav, and the presentation forms); points, cantillation and punctuation alone are not a title.
HEBREW_LETTER_RE = re.compile(r"[\u05D0-\u05EA\uFB1D-\uFB4F]")
CLAIM_RE = re.compile(r"^(>=|≥|>|<)?\s*\d+$")
EMPTY_GUIDE = {"productions": [], "episodes": [], "unidentified": {}}


def values(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


# Host code points the browser's URL parser (WHATWG) rejects. Control characters are refused anywhere, and so is
# leading or trailing whitespace (the browser would strip it, so the stored URL would not be the one opened).
FORBIDDEN_HOST = set(" \t\n#%/:<>?@[\\]^|")
CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
# Record ids are keys of the browser's saved-link and backup objects; these names are refused on import there.
RESERVED_IDS = {"__proto__", "constructor", "prototype"}


def url_problem(value):
    """Why a value is not a public http(s) URL that the app's URL() parser accepts unchanged, or None."""
    if not isinstance(value, str):
        return "not a string"
    if CONTROL_RE.search(value):
        return "control character"
    if value != value.strip():
        return "leading or trailing whitespace"
    if re.search(r"\s", value):
        # The browser would open the %20 form; the stored URL must be the exact, copyable one.
        return "contains whitespace; percent-encode spaces as %20"
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return "not an http(s) URL"
        if parsed.username or parsed.password:
            return "contains credentials"
        parsed.port  # raises ValueError for a non-numeric or out-of-range port
        host = parsed.hostname or ""
        if not host or (not host.startswith("[") and ":" not in host and FORBIDDEN_HOST & set(host)):
            return "invalid host"
        return None
    except ValueError:
        return "invalid port or host"


def valid_url(value):
    """A public http(s) URL that the app's URL() parser also accepts, so no record silently loses its watch link."""
    return url_problem(value) is None


# WHATWG URL serialization, for comparisons only (stored URLs are kept exactly as written). The app compares
# new URL(x).href values, which lowercase the scheme and host, drop default ports and percent-encode non-ASCII and
# a few ASCII characters; two spellings of one URL must merge here as they match there.
PATH_ENCODE = set('"#<>?`{}')
QUERY_ENCODE = set('"#<>\'')
FRAGMENT_ENCODE = set('"<>`')


def _percent_encode(text, extra):
    out = []
    for ch in text:
        if ord(ch) <= 0x20 or ord(ch) >= 0x7f or ch in extra:
            out.append("".join(f"%{b:02X}" for b in ch.encode("utf-8", "surrogatepass")))
        else:
            out.append(ch)
    return "".join(out)


def canonical_url(value):
    if not isinstance(value, str):
        return ""
    try:
        p = urlsplit(value.strip())
        scheme, host = p.scheme.lower(), (p.hostname or "")
        try:
            host = host.encode("idna").decode("ascii") if not host.isascii() else host
        except UnicodeError:
            pass
        if ":" in host:
            host = f"[{host}]"
        port = p.port
        netloc = host + (f":{port}" if port and port != {"http": 80, "https": 443}.get(scheme) else "")
    except ValueError:
        return value
    url = f"{scheme}://{netloc}{_percent_encode(p.path or '/', PATH_ENCODE)}"
    if p.query:
        url += "?" + _percent_encode(p.query, QUERY_ENCODE)
    if p.fragment:
        url += "#" + _percent_encode(p.fragment, FRAGMENT_ENCODE)
    return url


def url_key(value):
    """Merge key: the canonical URL without a trailing slash."""
    return canonical_url(value).rstrip("/")


def enum_ok(value, allowed):
    """Membership test that never raises for unhashable JSON values (lists, objects)."""
    return isinstance(value, str) and value in allowed


def valid_tag(value):
    """A theme or character: a non-empty string, or an object with a string id, en or he."""
    if isinstance(value, str):
        return bool(value.strip())
    return isinstance(value, dict) and any(isinstance(value.get(k), str) and value[k].strip() for k in ("id", "en", "he"))


def check_unicode(value, where):
    """Reject strings that cannot be written as UTF-8 (a lone surrogate from a title cut mid-emoji)."""
    if isinstance(value, str):
        try:
            value.encode("utf-8")
        except UnicodeEncodeError:
            raise ValueError(f"{where}: invalid Unicode (lone surrogate) in {value[:60]!r}") from None
    elif isinstance(value, list):
        for i, item in enumerate(value):
            check_unicode(item, f"{where}[{i}]")
    elif isinstance(value, dict):
        for key, item in value.items():
            check_unicode(key, f"{where} key")
            check_unicode(item, f"{where}.{key}")


def _line_of(text, token):
    match = re.search(r"[:\[,]\s*" + re.escape(token) + r"(?![\w.])", text)
    return f", line {text.count(chr(10), 0, match.start()) + 1}" if match else ""


def parse_json(text, name):
    """json.loads that refuses NaN, Infinity and numbers too large for a double. Python accepts them, but the
    browser's JSON.parse does not, so one such value would leave the built page blank."""
    def constant(token):
        raise ValueError(f"{name}{_line_of(text, token)}: {token} is not a JSON number (use null for an unknown value)")

    def number(token):
        value = float(token)
        if not math.isfinite(value):
            raise ValueError(f"{name}{_line_of(text, token)}: number {token} is too large (it would be written as Infinity)")
        return value
    try:
        return json.loads(text, parse_constant=constant, parse_float=number)
    except json.JSONDecodeError as error:
        raise ValueError(f"{name}: invalid JSON: {error}") from None


def load_json(path):
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{path.name}: invalid JSON: {error}") from None
    return parse_json(text, path.name)


def is_int(value):
    return isinstance(value, int) and not isinstance(value, bool)


def text_problems(obj, fields, where):
    """Display fields must be strings (or absent/null): an object would render as "[object Object]"."""
    return [f"{where}: {field} must be a string or null, got {type(obj[field]).__name__}"
            for field in fields if obj.get(field) is not None and not isinstance(obj[field], str)]


def editorial_he_problem(obj, where, published):
    """titleHeEditorial is our Hebrew translation of the editorial English title (or of the original title) for a record or
    episode that has no published Hebrew title. The Hebrew interface shows it where it would otherwise fall back to English and
    labels it as ours; it is never a published title, so it only fills that gap and is refused beside one of the `published`
    fields (titleHe; on an episode, storyHe too). null means absent; a present value is non-empty text without leading or
    trailing whitespace. Returns a located error, or None."""
    value = obj.get(EDITORIAL_HE)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        return (f"{where}: {EDITORIAL_HE} must be a non-empty string without leading or trailing whitespace, or absent; "
                f"got {value!r}")[:400]
    present = [field for field in published if obj.get(field)]
    if present:
        return (f"{where}: {EDITORIAL_HE} fills only a missing published Hebrew title, but this item has "
                f"{' and '.join(present)}; keep the published title and remove {EDITORIAL_HE}")
    return None


def editorial_he_unlettered(obj):
    """A valid titleHeEditorial with no Hebrew letter (a Latin or digits-only value is probably not a translation)."""
    value = obj.get(EDITORIAL_HE)
    return isinstance(value, str) and bool(value.strip()) and not HEBREW_LETTER_RE.search(value)


# Record-file defaults ({"defaults": {...}, "records": [...]}): fields many records share are written once. The builder
# validates every record with its defaults filled in, and embeds the record without the fields equal to them, with "_d", the
# index of its defaults in payload.recordDefaults; the app fills them back in at start.
DEFAULTABLE = {"series", "production", "language", "sourceType", "notes", "verification", "verifiedAt", "tagEvidence",
               "completenessNote", "availabilityCheck", "matchConfidence"}


def file_defaults(data, name):
    d = data.get("defaults") if isinstance(data, dict) else None
    if d is None:
        return None
    if not isinstance(d, dict) or not d:
        raise ValueError(f"{name}: defaults must be a non-empty object")
    unknown = sorted(set(d) - DEFAULTABLE)
    if unknown:
        raise ValueError(f"{name}: defaults may set only {sorted(DEFAULTABLE)}, not {unknown[0]!r}")
    return d


def compact_record(r, table):
    k = r.get("_d")
    if k is None:
        return r
    d = table[k]
    # The app reads absent themes and characters as empty.
    return {f: v for f, v in r.items() if not (f in d and d[f] == v) and not (f in ("themes", "characters") and v == [])}


def merge_records(existing, incoming):
    for field, value in incoming.items():
        if field in {"themes", "characters"}:
            merged = values(existing.get(field))
            for item in values(value):
                if item not in merged:
                    merged.append(item)
            existing[field] = merged
        elif not existing.get(field) and value:
            existing[field] = value
    return existing


def valid_vimeo_url(value):
    if not valid_url(value):
        return False
    parsed = urlsplit(value)
    return (parsed.scheme == "https"
            and parsed.hostname in {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}
            and bool(re.fullmatch(r"/(?:video/)?\d+(?:/[^\s/]*)?/?", parsed.path)))


def clean_discovery_notes(note, duration_known=False, playback_verified=False):
    """Remove claims superseded by exact link discovery, retaining source notes."""
    if not isinstance(note, str):
        return ""
    note = re.sub(r"(?i)direct Vimeo (?:URLs?|links?) (?:were |was |could |could be |have )?not (?:yet )?(?:been )?extracted[.!]?", "", note)
    note = re.sub(r"(?i)direct Vimeo link pending[.;]?", "", note)
    note = re.sub(r"(?i)Vimeo (?:URLs?|links?) (?:are |were |have )?(?:still )?(?:not (?:yet )?(?:been )?(?:found|extracted|discovered)|missing)[.!]?", "", note)
    if duration_known:
        note = note.replace("The video itself and its duration were not verified.", "Playback has not been checked in full.")
        note = note.replace("The duration was not verified.", "")
    if playback_verified:
        for stale in ("The link has not been tested without a VPN.", "Vimeo playback and access without a VPN have not been checked.", "The video itself and its duration were not verified."):
            note = note.replace(stale, "")
    return re.sub(r"\s+", " ", note).strip(" ;")


def is_hop_page(record):
    return bool(record) and urlsplit(record["url"]).hostname in {"hop.co.il", "www.hop.co.il"}


def collection_run(report, when):
    """The collections[] run a row's time falls in: the first run, by completion time, that ended at or after it."""
    runs = [c for c in report.get("collections") or [] if isinstance(c, dict) and isinstance(c.get("completedAt"), str)]
    if not isinstance(when, str) or not runs:
        return None
    for run in sorted(runs, key=lambda c: c["completedAt"]):
        if when <= run["completedAt"]:
            return run
    return None


def apply_player_links(path, records):
    """Add exact Hop-discovered URLs and preserve explicitly recorded playback evidence."""
    if not path.exists():
        return 0
    report = load_json(path)
    if not isinstance(report, dict) or not isinstance(report.get("records"), list):
        raise ValueError(f"Expected a Hop collector report in {path}")
    # Fields are copied into records (status, attempts, notes), so they must encode as UTF-8 too.
    check_unicode(report, path.name)
    origin = report.get("sourceOrigin", "")
    if urlsplit(origin).hostname not in {"hop.co.il", "www.hop.co.il"}:
        raise ValueError("Hop collector report must identify the official source origin")
    by_id = {r["id"]: r for r in records}
    by_url = {url_key(r["url"]): r for r in records}
    added = 0
    for item in report["records"]:
        if not isinstance(item, dict) or not valid_vimeo_url(item.get("directUrl")):
            continue
        source_url = item.get("url", "")
        if urlsplit(source_url).hostname not in {"hop.co.il", "www.hop.co.il"}:
            continue
        # Match by id, falling back to the page URL when the id names a record that is not a Hop page.
        record = by_id.get(str(item.get("id", "")))
        if not is_hop_page(record):
            record = by_url.get(url_key(source_url))
        if not is_hop_page(record):
            continue
        collected_at = item.get("collectedAt") or report.get("completedAt") or report.get("generatedAt") or "date not recorded"
        run = collection_run(report, collected_at)
        recheck_run = collection_run(report, item.get("recheckedAt"))
        # A run that recorded no per-page times gave its rows the run's completion time.
        run_time_only = bool(run) and run.get("perPageTimes") is False and collected_at == run.get("completedAt")
        when = (f"by {collected_at}, when its collection run completed (that run recorded no per-page times)"
                if run_time_only else f"at {collected_at}")
        # A runtime returned by oEmbed is metadata, never proof of playback.
        # Honor only explicit true evidence attached to this exact watch URL.
        previous_direct = record.get("directUrl")
        matching_previous = record.get("playbackUrl", previous_direct) == item["directUrl"]
        verified = item.get("playbackVerified") is True or (matching_previous and record.get("playbackVerified") is True)
        without_vpn = verified and (item.get("playbackWithoutVpn") is True or (matching_previous and record.get("playbackWithoutVpn") is True))
        checked_at = item.get("playbackVerifiedAt") or (record.get("playbackVerifiedAt") if matching_previous else None)
        check_note = item.get("playbackVerificationNote") or (record.get("playbackVerificationNote") if matching_previous else None)
        record["directUrl"] = item["directUrl"]
        if valid_vimeo_url(item.get("playerUrl")):
            record["playerUrl"] = item["playerUrl"]
        record["sourceAccess"] = record.get("sourceAccess") or record.get("access", "unknown")
        record["access"] = "direct-link-discovered"
        record["playbackVerified"] = bool(verified)
        record["playbackWithoutVpn"] = bool(without_vpn)
        if verified:
            record["playbackUrl"] = item["directUrl"]
            if checked_at:
                record["playbackVerifiedAt"] = checked_at
            if check_note:
                record["playbackVerificationNote"] = check_note
        record["originalVerification"] = record.get("originalVerification") or record.get("verification")
        discovery = f"Exact Vimeo player/watch URL discovered in the public Hop page HTML {when}."
        if without_vpn:
            playback = "Playback startup was observed with Vimeo outside the VPN. The complete video was not watched."
        elif verified:
            playback = "Playback startup was observed. Access without a VPN and complete playback have not been confirmed."
        else:
            playback = "Vimeo playback and access without a VPN have not been checked."
        record["verification"] = "Official Hop metadata checked. " + discovery + " " + playback
        record["directLinkProvenance"] = {
            "collectorFile": path.name,
            "sourceOrigin": origin,
            "sourceUrl": source_url,
            "collectedAt": collected_at,
            # The method of the run this row was read in, not every run's (collections[] in the report).
            "collectionMethod": (run or {}).get("method") or report.get("collectionMethod", "same-origin public Hop page collector"),
            "status": item.get("status", "direct URL present in collector report"),
            "attempts": item.get("attempts", []),
        }
        if run_time_only:
            record["directLinkProvenance"]["collectedAtIs"] = "collection run completion time"
        if isinstance(item.get("recheckedAt"), str):
            record["directLinkProvenance"].update({
                "recheckedAt": item["recheckedAt"],
                "recheckStatus": item.get("recheckStatus"),
                "recheckMethod": (recheck_run or {}).get("method"),
                "recheckAttempts": item.get("recheckAttempts", []),
            })
        old_note = clean_discovery_notes(record.get("notes"), bool(record.get("durationSeconds")), verified)
        on = f"by {collected_at} (its collection run's completion time)" if run_time_only else f"on {collected_at}"
        discovery_note = f"Direct Vimeo link found by the same-origin Hop page collector {on}; the complete privacy URL is preserved. " + playback
        record["notes"] = (old_note + " " if old_note else "") + discovery_note
        added += 1
    return added


# --------------------------------------------------------------------------- episode guide
def coverage_of(roles):
    roles = [r for r in roles if r != "possible"]
    if not roles:
        return "missing"
    if "whole-candidate" in roles or "alternate-edition" in roles:
        return "whole-candidate"
    return "parts-only" if "part" in roles else "excerpt-only"


ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}")


def record_urls(r):
    """A record's URLs in canonical form (the app compares serialized URLs)."""
    return {canonical_url(r.get(f)) for f in ("url", "directUrl", "playerUrl", "playbackUrl", "sourceUrl", "hopUrl")
            if isinstance(r.get(f), str)}


def evidence_detail_problems(detail, level, role_of, by_record):
    """Mirror of the app's evDetail(): every reason a level 3 or 4 claim would be ignored."""
    if not isinstance(detail, dict):
        return ["must be an object {level, recordId, url, checkedAt, noteEn}"]
    out = []
    d_level = detail.get("level")
    if not enum_ok(d_level, EVIDENCE[2:]):
        out.append(f"level must be one of {EVIDENCE[2:]}, got {d_level!r}")
    elif d_level != level:
        out.append(f"level {d_level!r} disagrees with the episode's evidence {level!r}")
    rid = detail.get("recordId")
    whole = [r for r, role in role_of.items() if role in ("whole-candidate", "alternate-edition")]
    if not isinstance(rid, str) or rid not in role_of:
        out.append(f"recordId {rid!r} is not linked to this episode")
    elif role_of[rid] == "possible":
        out.append(f"recordId {rid!r} is a possible copy (identity unresolved), which never carries the episode's evidence")
    elif whole and rid not in whole:
        out.append(f"recordId {rid!r} is a {role_of[rid]}, but the episode has whole or alternate uploads ({', '.join(whole)})")
    url = detail.get("url")
    if not valid_url(url):
        out.append("url must be a public http(s) URL")
    elif isinstance(rid, str) and rid in by_record and canonical_url(url) not in set().union(*(record_urls(r) for r in by_record[rid])):
        out.append(f"url {url!r} is not one of record {rid!r}'s URLs")
    checked = detail.get("checkedAt")
    if not (isinstance(checked, str) and ISO_DATE_RE.match(checked)):
        out.append(f"checkedAt must be an ISO date (YYYY-MM-DD), got {checked!r}")
    if detail.get("noteEn") is not None and not isinstance(detail.get("noteEn"), str):
        out.append("noteEn must be a string")
    return out


def validate_guide(guide, records, source, series):
    """Validate the episode-guide contract against the merged records. Returns warnings; raises on errors."""
    errors, warnings = [], []
    err = errors.append
    if not isinstance(guide, dict):
        raise ValueError(f"{source}: expected an object with productions, episodes and unidentified")
    for key in ("productions", "episodes"):
        if not isinstance(guide.get(key, []), list):
            err(f"{key} must be an array")
    if not isinstance(guide.get("unidentified", {}), dict):
        err("unidentified must be an object keyed by production id")
    if errors:
        raise ValueError(f"{source}: " + "; ".join(errors))
    by_record = {}
    for r in records:
        by_record.setdefault(r["id"], []).append(r)
    productions = {}
    for i, p in enumerate(guide.get("productions", []), 1):
        where = f"production {i}"
        if not isinstance(p, dict):
            err(f"{where}: expected an object")
            continue
        pid = p.get("id")
        if not isinstance(pid, str) or not pid:
            err(f"{where}: id required")
            continue
        where = f"production {pid!r}"
        if pid in productions:
            err(f"{where}: duplicate id")
        productions[pid] = p
        for problem in text_problems(p, ("nameEn", "nameHe", "years", "expectedTotalNoteEn", "expectedTotalNoteHe",
                                         "numberLabelEn", "numberLabelHe"), where):
            err(problem)
        if not any(isinstance(p.get(k), str) and p[k].strip() for k in ("nameEn", "nameHe")):
            err(f"{where}: nameEn or nameHe required (the production's heading, rail item and page title)")
        # numberLabelEn/He ('IETV no.'): episode codes read "<label> <number>" instead of season and episode codes.
        for k in ("numberLabelEn", "numberLabelHe"):
            if isinstance(p.get(k), str) and not p[k].strip():
                err(f"{where}: {k} must not be empty (omit it for season and episode codes)")
        # numberWidth: episode numbers are shown zero-padded to this many digits (Sesame Street's "Episode 0001").
        width = p.get("numberWidth")
        if width is not None and not (is_int(width) and 1 <= width <= 6):
            err(f"{where}: numberWidth must be an integer from 1 to 6, got {width!r}")
        if not enum_ok(p.get("series"), series):
            err(f"{where}: unknown series {p.get('series')!r} (series are listed in data/series.json)")
        if not enum_ok(p.get("format"), FORMATS):
            err(f"{where}: format must be one of {sorted(FORMATS)}, got {p.get('format')!r}")
        total = p.get("expectedTotal")
        if total is not None and not (is_int(total) and total >= 0):
            err(f"{where}: expectedTotal must be a non-negative integer or null")
        claims = p.get("totalsEvidence", [])
        if not isinstance(claims, list):
            err(f"{where}: totalsEvidence must be an array")
            claims = []
        for j, claim in enumerate(claims, 1):
            cw = f"{where}, totalsEvidence {j}"
            if not isinstance(claim, dict):
                err(f"{cw}: expected an object")
                continue
            value = claim.get("value")
            if not ((is_int(value) and value >= 0) or (isinstance(value, str) and CLAIM_RE.match(value.strip()))):
                err(f"{cw}: value must be an integer or a string such as '>200'")
            if not enum_ok(claim.get("confidence"), TOTAL_CONFIDENCES):
                err(f"{cw}: confidence must be one of {sorted(TOTAL_CONFIDENCES)}")
            # Any url that is present must be renderable ('' and non-strings included), as for sources and altLabels.
            if claim.get("url") is not None and not valid_url(claim["url"]):
                err(f"{cw}: url must be a public http(s) URL ({url_problem(claim['url'])})")
            for problem in text_problems(claim, ("scope", "sourceLabel"), cw):
                err(problem)
            # Without a url the source label is the citation (a printed catalogue); a claim needs one or the other.
            if claim.get("url") is None and not (isinstance(claim.get("sourceLabel"), str) and claim["sourceLabel"].strip()):
                err(f"{cw}: a claim without a url needs a sourceLabel")
        seasons = p.get("seasons", [])
        if not isinstance(seasons, list):
            err(f"{where}: seasons must be an array")
            seasons = []
        season_keys = set()
        for j, s in enumerate(seasons, 1):
            sw = f"{where}, season {j}"
            if not isinstance(s, dict):
                err(f"{sw}: expected an object")
                continue
            key = s.get("season")
            if key is not None and not is_int(key):
                err(f"{sw}: season must be an integer or null")
                key = repr(key)
            if key in season_keys:
                err(f"{sw}: duplicate season {key!r}")
            season_keys.add(key)
            for problem in text_problems(s, ("labelEn", "labelHe"), sw):
                err(problem)
            if s.get("numbering") is not None and not enum_ok(s.get("numbering"), NUMBERINGS):
                err(f"{sw}: numbering must be one of {sorted(NUMBERINGS)}")
            exp = s.get("expectedEpisodes")
            if exp is not None and not (is_int(exp) and exp >= 0):
                err(f"{sw}: expectedEpisodes must be a non-negative integer or null")
            # firstNumber (default 1): the season's strip and its gap and expected cells cover
            # firstNumber .. firstNumber + expectedEpisodes - 1, so a season numbered 66-130 has no false gaps 1-65.
            first = s.get("firstNumber")
            if first is not None and not (is_int(first) and first >= 1):
                err(f"{sw}: firstNumber must be a positive integer (the season's first episode number), got {first!r}")
            # excludedNumbers: numbers inside the season's range that are not episodes (season 45's repeat labels), with a
            # source; the strip, its slots and the Missing page skip them.
            excl = s.get("excludedNumbers")
            if excl is not None:
                if not isinstance(excl, list):
                    err(f"{sw}: excludedNumbers must be an array of {{from, to, sourceLabel, noteEn?}}")
                    excl = []
                for k, x in enumerate(excl, 1):
                    xw = f"{sw}, excludedNumbers {k}"
                    if not isinstance(x, dict) or not (is_int(x.get("from")) and is_int(x.get("to")) and 1 <= x["from"] <= x["to"]):
                        err(f"{xw}: expected {{from, to}} with 1 <= from <= to")
                        continue
                    if not (isinstance(x.get("sourceLabel"), str) and x["sourceLabel"].strip()):
                        err(f"{xw}: sourceLabel required (who says these are not episodes)")
                    for problem in text_problems(x, ("noteEn", "noteHe", "sourceLabel"), xw):
                        err(problem)
    episodes, linked, possible, slot_owner, outside = {}, {}, {}, {}, {}
    alt_legacy, story_notes, editorial_notes = [], [], []
    # Declared numbering ranges per (production, season), for the firstNumber range warning.
    ranges = {}
    for pid, p in productions.items():
        for s in p.get("seasons") if isinstance(p.get("seasons"), list) else []:
            # A malformed season key (a list or an object) is reported above; it must not reach the dict as a key.
            if isinstance(s, dict) and (s.get("season") is None or is_int(s.get("season"))) and \
                    is_int(s.get("firstNumber")) and s["firstNumber"] >= 1:
                exp = s.get("expectedEpisodes") if is_int(s.get("expectedEpisodes")) else None
                skip = sum(x["to"] - x["from"] + 1 for x in s.get("excludedNumbers") or []
                           if isinstance(x, dict) and is_int(x.get("from")) and is_int(x.get("to")))
                ranges[(pid, s.get("season"))] = (s["firstNumber"], s["firstNumber"] + exp - 1 + skip if exp else None)
    out_of_range = []
    excluded = {}
    for pid, p in productions.items():
        for s in p.get("seasons") if isinstance(p.get("seasons"), list) else []:
            if isinstance(s, dict) and isinstance(s.get("excludedNumbers"), list):
                for x in s["excludedNumbers"]:
                    if isinstance(x, dict) and is_int(x.get("from")) and is_int(x.get("to")):
                        for n in range(x["from"], min(x["to"], x["from"] + 10000) + 1):
                            excluded[(pid, s.get("season"), n)] = True
    # Declared season keys per production; episodes outside them are counted against the declared seasons' totals.
    season_defs = {}
    for pid, p in productions.items():
        defs = p.get("seasons") if isinstance(p.get("seasons"), list) else []
        keys = {s.get("season") for s in defs if isinstance(s, dict) and (s.get("season") is None or is_int(s.get("season")))}
        if keys:
            season_defs[pid] = keys
    for i, e in enumerate(guide.get("episodes", []), 1):
        where = f"episode {i}"
        if not isinstance(e, dict):
            err(f"{where}: expected an object")
            continue
        eid = e.get("id")
        if not isinstance(eid, str) or not eid:
            err(f"{where}: id required")
            continue
        where = f"episode {eid!r}"
        if eid in episodes:
            err(f"{where}: duplicate id")
        episodes[eid] = e
        prod = productions.get(e["production"]) if isinstance(e.get("production"), str) else None
        if not prod:
            err(f"{where}: unknown production {e.get('production')!r}")
        elif prod.get("format") == "queue":
            err(f"{where}: episodes cannot belong to the holding queue {prod['id']!r}")
        number, season = e.get("number"), e.get("season")
        if number is not None and not (is_int(number) and number > 0):
            err(f"{where}: number must be a positive integer or null")
        if season is not None and not is_int(season):
            err(f"{where}: season must be an integer or null")
        if not enum_ok(e.get("confidence"), CONFIDENCES):
            err(f"{where}: confidence must be one of {sorted(CONFIDENCES)}")
        for problem in text_problems(e, ("titleEn", "titleHe", "noteEn", "noteHe", "airDate", "summaryEn", "wordOnTheStreet"), where):
            err(problem)
        if prod and is_int(number) and (season is None or is_int(season)) and excluded.get((prod["id"], season, number)):
            err(f"{where}: number {number} is listed in its season's excludedNumbers (not an episode)")
        # A summary is quoted from a named source: summarySource {label, url?, revisionId?}.
        summary_src = e.get("summarySource")
        if e.get("summaryEn") is not None and not (isinstance(summary_src, dict) and isinstance(summary_src.get("label"), str)
                                                   and summary_src["label"].strip()):
            err(f"{where}: summaryEn needs summarySource with a label naming where it is quoted from")
        if summary_src is not None:
            if not isinstance(summary_src, dict):
                err(f"{where}: summarySource must be an object {{label, url?, revisionId?}}")
            elif e.get("summaryEn") is None:
                err(f"{where}: summarySource without summaryEn")
            elif summary_src.get("url") is not None and not valid_url(summary_src["url"]):
                err(f"{where}: summarySource url must be a public http(s) URL ({url_problem(summary_src['url'])})")
        sponsors = e.get("sponsors")
        if sponsors is not None and not (isinstance(sponsors, dict) and set(sponsors) <= {"letters", "numbers"} and
                                         all(isinstance(sponsors.get(k, []), list) and all(isinstance(v, str) and v.strip() and len(v) <= 12
                                             for v in sponsors.get(k, [])) for k in ("letters", "numbers"))
                                         and (sponsors.get("letters") or sponsors.get("numbers"))):
            err(f"{where}: sponsors must be {{letters: [...], numbers: [...]}} with short strings, not both empty")
        guests = e.get("guestStars")
        if guests is not None and not (isinstance(guests, list) and guests and all(isinstance(g, str) and g.strip() for g in guests)):
            err(f"{where}: guestStars must be a non-empty array of names")
        # storyHe: a Hebrew story name quoted verbatim from another source (an archive file label) for an episode whose
        # catalogue title has none. Only the story name is quoted: the label's season and episode prefix, and an uploader's
        # trailing year or "(לא מלא)" note about the file, are not part of it and stay in the episode's altLabels.
        # Hebrew headings use it; the identity card keeps titleHe as the catalogue title and shows
        # storySourceEn/storySourceHe, which name that source. null means absent; a present value is non-empty text.
        story_bad = False
        for field in STORY_FIELDS:
            value = e.get(field)
            if value is not None and not (isinstance(value, str) and value.strip()):
                err(f"{where}: {field} must be a non-empty string or absent, got {value!r}")
                story_bad = True
        story = e.get("storyHe") if isinstance(e.get("storyHe"), str) and e["storyHe"].strip() else None
        if not story_bad and story and e.get("storySourceEn") is None:
            err(f"{where}: storyHe needs storySourceEn naming where the story name comes from "
                "(for example \"archive.org file label (uploader's wording)\")")
        elif not story_bad and not story and (e.get("storySourceEn") is not None or e.get("storySourceHe") is not None):
            err(f"{where}: storySourceEn/storySourceHe name the source of storyHe, which is absent")
        if story:
            title_he = e.get("titleHe").strip() if isinstance(e.get("titleHe"), str) else ""
            if not title_he:
                story_notes.append(f"{eid} (no titleHe)")
            elif story.strip() == title_he:
                story_notes.append(f"{eid} (storyHe repeats titleHe)")
            elif story.strip() in title_he:
                story_notes.append(f"{eid} (titleHe already contains storyHe)")
        # titleHeEditorial: our Hebrew translation of titleEn for an episode with no published Hebrew title (see
        # editorial_he_problem); a published titleHe or storyHe takes its place.
        problem = editorial_he_problem(e, where, ("titleHe", "storyHe"))
        if problem:
            err(problem)
        elif editorial_he_unlettered(e):
            editorial_notes.append(eid)
        sources = e.get("sources", [])
        if not isinstance(sources, list) or any(not isinstance(s, dict) for s in sources):
            err(f"{where}: sources must be objects with an optional public http(s) url")
        else:
            for j, src in enumerate(sources, 1):
                for problem in text_problems(src, ("label",), f"{where}, source {j}"):
                    err(problem)
                # A url that is present must be renderable ('' and non-strings included); omit it for a source without one.
                if src.get("url") is not None and not valid_url(src["url"]):
                    err(f"{where}, source {j}: url must be a public http(s) URL ({url_problem(src['url'])}); omit it when there is none")
                # The url is optional (a tape label or a printed catalogue); without one the label is the source.
                if src.get("url") is None and not (isinstance(src.get("label"), str) and src["label"].strip()):
                    err(f"{where}, source {j}: a source without a url needs a label")
        # altLabels: alternate identifiers from other sources (an uploader's S2E20 broadcast-order label), shown as
        # "Also labelled" and searchable. Contract shape {labelEn, labelHe?, sourceLabel, url?}; the draft shape with a
        # single `label` is accepted with a warning.
        alts = e.get("altLabels")
        if alts is not None and not isinstance(alts, list):
            err(f"{where}: altLabels must be an array of {{labelEn, labelHe?, sourceLabel, url?}}")
            alts = []
        for j, a in enumerate(alts or [], 1):
            aw = f"{where}, altLabels {j}"
            if not isinstance(a, dict):
                err(f"{aw}: expected an object {{labelEn, labelHe?, sourceLabel, url?}}")
                continue
            for problem in text_problems(a, ("labelEn", "labelHe", "sourceLabel", "label"), aw):
                err(problem)
            has = lambda k: isinstance(a.get(k), str) and a[k].strip()
            if not has("labelEn"):
                if has("label"):
                    alt_legacy.append(eid)
                else:
                    err(f"{aw}: labelEn required (for example 'archive.org S2E20')")
            elif not has("sourceLabel"):
                err(f"{aw}: sourceLabel required (who uses this label)")
            if a.get("url") is not None and not valid_url(a["url"]):
                err(f"{aw}: url must be a public http(s) URL ({url_problem(a['url'])})")
        if prod and season_defs.get(prod["id"]) and (season if is_int(season) else None) not in season_defs[prod["id"]]:
            outside.setdefault(prod["id"], []).append(season)
        if prod and is_int(number) and (season is None or is_int(season)) and (prod["id"], season) in ranges:
            lo, hi = ranges[(prod["id"], season)]
            if number < lo or (hi is not None and number > hi):
                out_of_range.append(f"{eid} ({number}; season {season} covers {lo}–{hi if hi is not None else '…'})")
        uploads = e.get("uploads", [])
        if not isinstance(uploads, list):
            err(f"{where}: uploads must be an array")
            uploads = []
        roles, seen, role_of, part_nos = [], set(), {}, []
        for u in uploads:
            rid = u.get("recordId") if isinstance(u, dict) else None
            if not isinstance(rid, str) or rid not in by_record:
                err(f"{where}: upload recordId {rid!r} is not in the records")
                continue
            if len(by_record[rid]) > 1:
                err(f"{where}: upload recordId {rid!r} is ambiguous (several records share it)")
            if not enum_ok(u.get("role"), ROLES):
                err(f"{where}: unknown upload role {u.get('role')!r} for {rid!r} (one of {sorted(ROLES)})")
                continue
            if rid in seen:
                err(f"{where}: record {rid!r} is linked twice")
            # container: the destination holds more than this episode (a 'compilation' video, a service's 'listing' page).
            if u.get("container") is not None and not enum_ok(u.get("container"), CONTAINERS):
                err(f"{where}: upload {rid!r}: container must be one of {sorted(CONTAINERS)}, got {u.get('container')!r}")
            for problem in text_problems(u, ("extentNoteEn",), f"{where}: upload {rid!r}"):
                err(problem)
            part = u.get("part")
            if part is not None:
                if not (is_int(part) and part >= 1):
                    err(f"{where}: upload {rid!r}: part must be a positive integer (the displayed part number), got {part!r}")
                elif u["role"] != "part":
                    warnings.append(f"{where}: upload {rid!r} has part {part} but role {u['role']!r}; only parts show a part number")
                else:
                    part_nos.append(part)
            seen.add(rid)
            roles.append(u["role"])
            role_of[rid] = u["role"]
            (possible if u["role"] == "possible" else linked).setdefault(rid, []).append(eid)
        if len(part_nos) != len(set(part_nos)):
            warnings.append(f"{where}: part numbers repeat ({', '.join(map(str, sorted(part_nos)))})")
        derived = coverage_of(roles)
        if e.get("coverage") is not None and not enum_ok(e.get("coverage"), COVERAGES):
            err(f"{where}: coverage must be one of {sorted(COVERAGES)}")
        elif e.get("coverage") is not None and e["coverage"] != derived:
            err(f"{where}: stated coverage {e['coverage']!r} disagrees with its upload roles ({derived!r})")
        level = e.get("evidence")
        if level is not None and not enum_ok(level, EVIDENCE):
            err(f"{where}: evidence must be one of {EVIDENCE}")
            level = None
        detail = e.get("evidenceDetail")
        if level in EVIDENCE[2:] and detail is None:
            err(f"{where}: {level!r} needs evidenceDetail with level, a linked recordId, that record's url and checkedAt")
        if detail is not None:
            # The UI shows a level 3 or 4 claim only when every part of this agrees, so the builder refuses the rest.
            for problem in evidence_detail_problems(detail, level, role_of, by_record):
                err(f"{where}: evidenceDetail {problem}")
        counted = [rid for rid in seen if role_of.get(rid) != "possible"]
        if level == "playback-started" and not any(r.get("playbackVerified") is True for rid in counted for r in by_record.get(rid, [])):
            warnings.append(f"{where}: evidence 'playback-started' but no linked record has playbackVerified; the UI shows metadata checked")
        if prod and is_int(number) and (season is None or is_int(season)):
            key = (prod["id"], season, number)
            if key in slot_owner:
                warnings.append(f"{where}: shares season {season!r}, number {number} with {slot_owner[key]!r}")
            slot_owner.setdefault(key, eid)
    several = [(rid, eids) for rid, eids in linked.items() if len(eids) > 1]
    if several:
        warnings.append(f"{len(several)} records are linked to several episodes (compilations, listings, shared tapes): " +
                        "; ".join(f"{rid}: {', '.join(eids[:4])}" + (" ..." if len(eids) > 4 else "") for rid, eids in several[:3]) +
                        (" ..." if len(several) > 3 else ""))
    for rid, eids in possible.items():
        if rid in linked:
            warnings.append(f"record {rid!r} is a possible copy of {', '.join(eids)} and is also linked to {', '.join(linked[rid])}")
    if alt_legacy:
        warnings.append(f"{len(alt_legacy)} episodes use the draft altLabels shape {{label, ...}} (first: {alt_legacy[0]!r}); "
                        "the contract is {labelEn, labelHe?, sourceLabel, url?}")
    if story_notes:
        warnings.append(f"{len(story_notes)} episodes with storyHe need a look (it is for a catalogue title without a story name): "
                        + "; ".join(story_notes[:5]) + (" ..." if len(story_notes) > 5 else ""))
    if editorial_notes:
        warnings.append(f"{len(editorial_notes)} episodes have a {EDITORIAL_HE} with no Hebrew letter (it is a Hebrew "
                        "translation of the editorial title): " + ", ".join(editorial_notes[:5])
                        + (" ..." if len(editorial_notes) > 5 else ""))
    if out_of_range:
        warnings.append(f"{len(out_of_range)} numbered episodes fall outside their season's firstNumber range: "
                        + "; ".join(out_of_range[:5]) + (" ..." if len(out_of_range) > 5 else ""))
    for pid, seasons in outside.items():
        keys = ", ".join(sorted({"null" if x is None else str(x) for x in seasons}))
        declared = ", ".join(sorted("null" if x is None else str(x) for x in season_defs[pid]))
        warnings.append(f"production {pid!r}: {len(seasons)} episodes have a season ({keys}) that is not declared in seasons[] "
                        f"({declared}); the app counts them against the declared seasons' expected episodes")
    queued = {}
    for pid, ids in guide.get("unidentified", {}).items():
        if pid not in productions:
            err(f"unidentified: {pid!r} is not a production id")
            continue
        if not isinstance(ids, list):
            err(f"unidentified[{pid!r}]: expected an array of record ids")
            continue
        for rid in ids:
            if not isinstance(rid, str) or rid not in by_record:
                err(f"unidentified[{pid!r}]: record {rid!r} does not exist")
                continue
            if rid in queued:
                err(f"unidentified: record {rid!r} is in two queues ({queued[rid]!r} and {pid!r})")
            elif rid in linked:
                err(f"unidentified[{pid!r}]: record {rid!r} is also linked to {linked[rid][0]!r}")
            queued[rid] = pid
    # An upload is filed under one series; one linked to, or queued under, a production of another series is listed
    # under that series in Browse but counted with the production in the guide. Checked once the guide is otherwise valid.
    if not errors:
        filed = {}
        for rid, eids in linked.items():
            for eid in eids:
                filed.setdefault(rid, set()).add(episodes[eid]["production"])
        for rid, pid in queued.items():
            filed.setdefault(rid, set()).add(pid)
        crossed = sorted(f"{rid} ({r['series']}, in {pid})" for rid, pids in filed.items() for r in by_record.get(rid, [])[:1]
                         for pid in sorted(pids) if productions[pid].get("series") != r["series"])
        if crossed:
            warnings.append(f"{len(crossed)} uploads belong to a production of another series: " + "; ".join(crossed[:5])
                            + (" ..." if len(crossed) > 5 else ""))
    unknown_prod = {}
    for r in records:
        ref = r.get("guideEpisodeId")
        if ref and episodes and ref not in episodes:
            warnings.append(f"record {r['id']!r}: guideEpisodeId {ref!r} is not a guide episode")
        elif ref and ref in episodes and ref not in linked.get(r["id"], []) + possible.get(r["id"], []):
            warnings.append(f"record {r['id']!r}: guideEpisodeId {ref!r} does not list it as an upload")
        if r.get("production") and productions and r["production"] not in productions:
            unknown_prod.setdefault(r["production"], []).append(r["id"])
    # One line per unknown production value (a few hundred records can share one).
    for value, ids in unknown_prod.items():
        warnings.append(f"{len(ids)} records have production {value!r}, which is not a guide production: "
                        + ", ".join(ids[:5]) + (" ..." if len(ids) > 5 else ""))
    if errors:
        shown = errors[:40] + ([f"... and {len(errors) - 40} more"] if len(errors) > 40 else [])
        raise ValueError(f"{source}: invalid episode guide:\n  " + "\n  ".join(shown))
    return warnings


def guide_counts(guide, goal_series):
    prods = {p["id"]: p for p in guide["productions"]}
    roles = {e["id"]: [u["role"] for u in e.get("uploads", [])] for e in guide["episodes"]}
    core, other = Counter(), Counter()
    for e in guide["episodes"]:
        p = prods[e["production"]]
        bucket = core if p["format"] == "core" and p["series"] in goal_series else other
        bucket[coverage_of(roles[e["id"]])] += 1
    return {
        "productions": len(prods),
        "episodes": len(guide["episodes"]),
        "coreRechovCoverage": dict(sorted(core.items())),
        "otherCoverage": dict(sorted(other.items())),
        "queue": sum(len(ids) for ids in guide["unidentified"].values()),
        "possibleCopies": sum(r == "possible" for rs in roles.values() for r in rs),
    }


def load_guide(path, records, explicit, series, parts=()):
    """The guide, and with the default guide its parts (data/guide-*.json, in name order): each part adds productions,
    episodes and queues, and the merged guide is validated as one, so a duplicate id across parts is refused."""
    if not path.exists():
        if explicit:
            raise ValueError(f"Guide file not found: {path}")
        return None, None, []
    digest = hashlib.sha256()
    guide = None
    for part in [path, *parts]:
        raw = part.read_bytes()
        digest.update(part.name.encode("utf-8") + b"\0" + raw)
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as error:
            raise ValueError(f"{part.name}: invalid JSON: {error}") from None
        data = parse_json(text, part.name)
        check_unicode(data, part.name)
        if not isinstance(data, dict):
            raise ValueError(f"{part.name}: expected an object with productions, episodes and unidentified")
        # With parts to merge, every file (the base too) must have the merged keys' types before merging; a guide alone
        # is checked by validate_guide().
        for key, kind in (("productions", list), ("episodes", list), ("unidentified", dict)):
            if parts and not isinstance(data.get(key, kind()), kind):
                raise ValueError(f"{part.name}: {key} must be {'an array' if kind is list else 'an object'}")
        if guide is None:
            guide = data
            continue
        for key, kind in (("productions", list), ("episodes", list), ("unidentified", dict)):
            value = data.get(key, kind())
            if kind is list:
                guide[key] = [*guide.get(key, []), *value]
            else:
                clash = sorted(set(value) & set(guide.get(key, {})))
                if clash:
                    raise ValueError(f"{part.name}: unidentified[{clash[0]!r}] is already in an earlier guide file")
                guide[key] = {**guide.get(key, {}), **value}
    name = path.name if not parts else path.name + " + " + ", ".join(x.name for x in parts)
    warnings = validate_guide(guide, records, name, series)
    guide = {**guide, "productions": guide.get("productions", []), "episodes": guide.get("episodes", []),
             "unidentified": guide.get("unidentified", {})}
    return guide, digest.hexdigest(), warnings


# The series registry (data/series.json): the guide rail's families, the series every record and production names, and
# the core broadcast series counted toward the core Rechov Sumsum goal. The app reads all of it from the payload.
SERIES_FIELDS = ("id", "en", "he", "family", "searchPrefix", "searchLanguage")


def load_table(path):
    """load_json for a required, hand-edited table: a missing file or a key repeated within one object (json.loads keeps
    the later value silently) is refused with the file's name."""
    if not path.is_file():
        raise ValueError(f"{path.name}: not found ({path})")
    data = load_json(path)

    def unique(pairs):
        keys = [k for k, _ in pairs]
        repeated = next((k for k in keys if keys.count(k) > 1), None)
        if repeated is not None:
            raise ValueError(f"{path.name}: key {repeated!r} appears twice in one object")
        return dict(pairs)
    json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)
    return data


def load_series(path):
    data = load_table(path)
    name = path.name
    if not isinstance(data, dict):
        raise ValueError(f"{name}: expected an object with families, series and goal")
    families, series, goal = data.get("families"), data.get("series"), data.get("goal")
    for key, value in (("families", families), ("series", series), ("goal", goal)):
        if not isinstance(value, list) or not value:
            raise ValueError(f"{name}: {key} must be a non-empty array")
    seen = set()
    for i, f in enumerate(families, 1):
        where = f"{name}, family {i}"
        if not isinstance(f, dict) or not isinstance(f.get("id"), str) or not SLUG_RE.match(f["id"]):
            raise ValueError(f"{where}: id must be a lowercase slug")
        if f["id"] in seen:
            raise ValueError(f"{where}: duplicate family id {f['id']!r}")
        seen.add(f["id"])
        problem = _pair_problem(f, f"{name}, family {f['id']!r}")
        if problem:
            raise ValueError(problem)
    family_of = {}
    for i, s in enumerate(series, 1):
        where = f"{name}, series {i}"
        if not isinstance(s, dict) or not isinstance(s.get("id"), str) or not SLUG_RE.match(s["id"]):
            raise ValueError(f"{where}: id must be a lowercase slug")
        where = f"{name}, series {s['id']!r}"
        if s["id"] in family_of or s["id"] in RESERVED_IDS:
            raise ValueError(f"{where}: duplicate or reserved series id")
        # The app keys a table by series id; an all-digit key would sort before the others and break the listed order.
        if s["id"].isdigit():
            raise ValueError(f"{where}: an id needs a letter (an all-digit id would not keep its place in the order)")
        problem = _pair_problem(s, where)
        if problem:
            raise ValueError(problem)
        if not enum_ok(s.get("family"), seen):
            raise ValueError(f"{where}: family {s.get('family')!r} is not listed in families")
        if not _nonempty(s.get("searchPrefix")):
            raise ValueError(f"{where}: searchPrefix must be non-empty text")
        if s.get("searchLanguage") not in ("he", "en"):
            raise ValueError(f"{where}: searchLanguage must be 'he' or 'en'")
        family_of[s["id"]] = s["family"]
    rows = []
    for i, g in enumerate(goal, 1):
        where = f"{name}, goal row {i}"
        if not isinstance(g, dict) or not enum_ok(g.get("series"), family_of):
            raise ValueError(f"{where}: series must be a listed series id")
        if g["series"] in rows:
            raise ValueError(f"{where}: series {g['series']!r} is listed twice")
        problem = _pair_problem(g, where)
        if problem:
            raise ValueError(problem)
        rows.append(g["series"])
    # The panel is about one family's core broadcasts ("Rechov Sumsum core broadcasts").
    if len({family_of[x] for x in rows}) > 1:
        raise ValueError(f"{name}: goal series must belong to one family")
    return {"families": [{k: f[k] for k in ("id", "en", "he")} for f in families],
            "series": [{k: s[k] for k in SERIES_FIELDS} for s in series],
            "goal": [{k: g[k] for k in ("series", "en", "he")} for g in goal]}


# Tag vocabulary (data/vocabulary.json): editorial English and Hebrew names for theme and character tags, keyed by the
# lowercase tag. The app looks tags up by their lowercase or normalised form, so a key with capitals would never match.
def load_vocabulary(path):
    data = load_table(path)
    tags = data.get("tags") if isinstance(data, dict) else None
    if not isinstance(tags, dict) or not tags:
        raise ValueError(f"{path.name}: expected an object with a non-empty tags object")
    for key, pair in tags.items():
        where = f"{path.name}, tag {key!r}"
        if not key.strip() or key != key.lower() or key != key.strip() or key in RESERVED_IDS:
            raise ValueError(f"{where}: keys are non-empty lowercase tags without outer spaces (not a reserved name)")
        if not (isinstance(pair, list) and len(pair) == 2 and all(_nonempty(v) for v in pair)):
            raise ValueError(f"{where}: expected [English, Hebrew] names")
        if not HEBREW_RE.search(pair[1]):
            raise ValueError(f"{where}: the Hebrew name has no Hebrew letters")
    return {"tags": tags}


# Licensed services (data/licensed-services.json): how each licensed service is reached, with sourced facts. A record with
# access 'licensed' is matched to a service by its link's hostname. 'library-card': free with a participating public
# library's card (hoopla); 'purchase-or-rent': bought or rented with an account (Apple TV, Prime Video); 'subscription':
# included with a paid subscription ('subscribed': true marks one the user already has, offered like a free link);
# 'free-with-ads': free to watch with advertising (Tubi).
SERVICE_MODELS = ("library-card", "subscription", "free-with-ads", "purchase-or-rent")
SOURCE_KINDS = {"library-page", "service-page", "secondary", "user-observation"}
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HOST_RE = re.compile(r"^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$")
DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
HEBREW_RE = re.compile(r"[֐-׿]")


def _nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def _pair_problem(value, where):
    """An {en, he} display pair: both non-empty strings, and the Hebrew one written in Hebrew."""
    if not isinstance(value, dict) or not _nonempty(value.get("en")) or not _nonempty(value.get("he")):
        return f"{where} must be {{en, he}} with non-empty strings"
    if not HEBREW_RE.search(value["he"]):
        return f"{where}.he has no Hebrew letters"
    return None


def _day_ok(value):
    if not (isinstance(value, str) and DAY_RE.match(value)):
        return False
    try:
        dt.date.fromisoformat(value)
        return True
    except ValueError:
        return False


# Link priority (data/link-priority.json): the order in which an entry's copies are offered, highest first. Every tier is
# listed exactly once; links that failed a check always come last, after every tier. The app classifies each link into one
# tier: licensed listings by their service (subscribed, library-card, free-with-ads, or paid: purchase, rental or a
# subscription the user does not have), links needing the Israel VPN as vpn, region-limited free streams as free-with-ads,
# and other links by host (archive.org, YouTube, Vimeo, or other-free for every other host).
LINK_TIERS = ("archive", "youtube", "subscribed", "vimeo", "other-free", "vpn", "library-card", "free-with-ads", "paid")


def load_link_priority(path):
    data = load_table(path)
    tiers = data.get("tiers") if isinstance(data, dict) else None
    if not isinstance(tiers, list) or sorted(map(str, tiers)) != sorted(LINK_TIERS) or len(tiers) != len(LINK_TIERS):
        raise ValueError(f"{path.name}: tiers must list each of {list(LINK_TIERS)} exactly once, got {tiers!r}")
    return {"tiers": tiers}


def validate_services(data, name):
    """Refuse a malformed licensed-services file with a located message; return the hostname -> service id map."""
    if not isinstance(data, dict) or not isinstance(data.get("services"), list) or not data["services"]:
        raise ValueError(f"{name}: expected an object with a non-empty services list")
    if not _day_ok(data.get("checkedAt")):
        raise ValueError(f"{name}: checkedAt must be a date (YYYY-MM-DD)")
    # A fact cannot have been checked after the build that embeds it (one day of slack for a date written in UTC).
    latest, today = (dt.date.today() + dt.timedelta(days=1)).isoformat(), dt.date.today().isoformat()
    if data["checkedAt"] > latest:
        raise ValueError(f"{name}: checkedAt {data['checkedAt']} is after the build date {today}")
    ids, hosts = set(), {}
    for k, s in enumerate(data["services"], 1):
        where = f"{name}, service {k}"
        if not isinstance(s, dict):
            raise ValueError(f"{where}: expected an object")
        sid = s.get("id")
        if not (isinstance(sid, str) and SLUG_RE.match(sid)) or sid in RESERVED_IDS:
            raise ValueError(f"{where}: id must be a lowercase slug, got {sid!r}")
        if sid in ids:
            raise ValueError(f"{where}: duplicate service id {sid!r}")
        ids.add(sid)
        where = f"{name}, service {sid!r}"
        if not _nonempty(s.get("name")):
            raise ValueError(f"{where}: name must be a non-empty string")
        if not enum_ok(s.get("model"), SERVICE_MODELS):
            raise ValueError(f"{where}: model must be one of {list(SERVICE_MODELS)}, got {s.get('model')!r}")
        if s.get("subscribed") is not None and (s["subscribed"] is not True or s["model"] != "subscription"):
            raise ValueError(f"{where}: subscribed may only be true, on a subscription service")
        if not isinstance(s.get("hosts"), list) or not s["hosts"]:
            raise ValueError(f"{where}: hosts must be a non-empty list of hostnames")
        for h in s["hosts"]:
            if not (isinstance(h, str) and HOST_RE.match(h)) or h.startswith("www."):
                raise ValueError(f"{where}: host {h!r} must be a bare lowercase hostname without www. or a scheme")
            if h in hosts:
                raise ValueError(f"{where}: host {h!r} is already claimed by service {hosts[h]!r}")
            hosts[h] = sid
        problem = _pair_problem(s.get("summary"), where + ": summary")
        if problem:
            raise ValueError(problem)
        sources = s.get("sources")
        if not isinstance(sources, list) or not sources:
            raise ValueError(f"{where}: sources must be a non-empty list")
        source_ids = set()
        for j, src in enumerate(sources, 1):
            sw = f"{where}, source {j}"
            if not isinstance(src, dict) or not (isinstance(src.get("id"), str) and SLUG_RE.match(src["id"])):
                raise ValueError(f"{sw}: expected an object with a slug id")
            if src["id"] in source_ids:
                raise ValueError(f"{sw}: duplicate source id {src['id']!r}")
            source_ids.add(src["id"])
            sw = f"{where}, source {src['id']!r}"
            if not enum_ok(src.get("kind"), SOURCE_KINDS):
                raise ValueError(f"{sw}: kind must be one of {sorted(SOURCE_KINDS)}, got {src.get('kind')!r}")
            if not _day_ok(src.get("checkedAt")):
                raise ValueError(f"{sw}: checkedAt must be a date (YYYY-MM-DD)")
            if not _nonempty(src.get("title")) or not _nonempty(src.get("finding")):
                raise ValueError(f"{sw}: title and finding must be non-empty strings")
            # Every source but the user's own observation is a public page.
            if src["kind"] != "user-observation" and not valid_url(src.get("url")):
                raise ValueError(f"{sw}: a {src['kind']} needs a valid public url ({url_problem(src.get('url'))})")
            if src.get("url") is not None and not valid_url(src["url"]):
                raise ValueError(f"{sw}: invalid url ({url_problem(src['url'])})")

        def cited(refs, at):
            if not isinstance(refs, list) or not refs:
                raise ValueError(f"{at}: sources must name at least one source id")
            unknown = [x for x in refs if x not in source_ids]
            if unknown:
                raise ValueError(f"{at}: unknown source id {unknown[0]!r}")

        def link_problem(link, at):
            if link is None:
                return
            if not isinstance(link, dict) or not valid_url(link.get("url")):
                raise ValueError(f"{at}: link must be {{url, label}} with a valid public url")
            problem = _pair_problem(link.get("label"), at + ": link label")
            if problem:
                raise ValueError(problem)

        how = s.get("howTo")
        if how is not None:
            if not isinstance(how, dict) or not isinstance(how.get("steps", []), list):
                raise ValueError(f"{where}: howTo must be {{headline, steps}}")
            for j, step in enumerate([how.get("headline")] + how.get("steps", [])):
                at = f"{where}, howTo " + ("headline" if j == 0 else f"step {j}")
                problem = _pair_problem(step, at)
                if problem:
                    raise ValueError(problem)
                link_problem(step.get("link"), at)
                cited(step.get("sources"), at)
        if s["model"] == "library-card" and how is None and s.get("libraries") is None:
            # A library-card service described only by its own library lookup (Kanopy): no how-to box, so no library facts to
            # tie to it; its summary says what was not checked.
            if not valid_url(s.get("lookupUrl")):
                raise ValueError(f"{where}: a library-card service needs howTo, or at least a valid lookupUrl ({url_problem(s.get('lookupUrl'))})")
        elif s["model"] == "library-card":
            if how is None:
                raise ValueError(f"{where}: a library-card service with libraries needs howTo")
            if not valid_url(s.get("lookupUrl")):
                raise ValueError(f"{where}: a library-card service needs a valid lookupUrl ({url_problem(s.get('lookupUrl'))})")
            libs = s.get("libraries")
            if not isinstance(libs, list) or not libs:
                raise ValueError(f"{where}: a library-card service needs a libraries list")
            lib_ids = set()
            for j, lib in enumerate(libs, 1):
                at = f"{where}, library {j}"
                if not isinstance(lib, dict) or not (isinstance(lib.get("id"), str) and SLUG_RE.match(lib["id"])):
                    raise ValueError(f"{at}: expected an object with a slug id")
                if lib["id"] in lib_ids:
                    raise ValueError(f"{at}: duplicate library id {lib['id']!r}")
                lib_ids.add(lib["id"])
                at = f"{where}, library {lib['id']!r}"
                problem = _pair_problem(lib.get("name"), at + ": name")
                if problem:
                    raise ValueError(problem)
                if not isinstance(lib.get("participates"), bool):
                    raise ValueError(f"{at}: participates must be true or false")
                for m, member in enumerate(lib.get("members") or []):
                    problem = _pair_problem(member, f"{at}: member {m + 1}")
                    if problem:
                        raise ValueError(problem)
                if lib.get("note") is not None and not _nonempty(lib["note"]):
                    raise ValueError(f"{at}: note must be a non-empty string")
                cited(lib.get("sources"), at)
            if not any(lib["participates"] for lib in libs):
                raise ValueError(f"{where}: name at least one participating library")
            # The how-to box shows the steps' prose, so the structured facts must agree with it: each library is named by a
            # step that lists it (in both languages) and says whether its cards work, and the lookup link is a step's link.
            steps = how.get("steps", [])
            if not steps:
                raise ValueError(f"{where}: a library-card service needs at least one howTo step")
            by_lib, named = {lib["id"]: lib for lib in libs}, set()
            for j, step in enumerate([how.get("headline")] + steps):
                at = f"{where}, howTo " + ("headline" if j == 0 else f"step {j}")
                listed = step.get("libraries")
                if listed is None:
                    if "participates" in step:
                        raise ValueError(f"{at}: participates describes the libraries listed in libraries, which is absent")
                    continue
                if not isinstance(listed, list) or not listed or not all(isinstance(x, str) for x in listed):
                    raise ValueError(f"{at}: libraries must be a non-empty list of library ids")
                if not isinstance(step.get("participates"), bool):
                    raise ValueError(f"{at}: a step that lists libraries says whether their cards work (participates true or false)")
                for lid in listed:
                    lib = by_lib.get(lid)
                    if lib is None:
                        raise ValueError(f"{at}: unknown library id {lid!r}")
                    if lib["participates"] != step["participates"]:
                        raise ValueError(f"{at}: says library {lid!r} {'participates' if step['participates'] else 'does not participate'}"
                                         f", but its libraries entry has participates {str(lib['participates']).lower()}")
                    choice = lib.get("hooplaChoice") if isinstance(lib.get("hooplaChoice"), str) else None
                    for lang in ("en", "he"):
                        names = [lib["name"][lang]] + ([choice] if choice else [])
                        if not any(n in step[lang] for n in names):
                            raise ValueError(f"{at}: lists library {lid!r} but its {lang} text does not name it ({' or '.join(map(repr, names))})")
                        for member in lib.get("members") or []:
                            if member[lang] not in step[lang]:
                                raise ValueError(f"{at}: lists library {lid!r} but its {lang} text does not name its member {member[lang]!r}")
                    named.add(lid)
            unnamed = [lib["id"] for lib in libs if lib["id"] not in named]
            if unnamed:
                raise ValueError(f"{where}: library {unnamed[0]!r} is not listed by any howTo step, so the how-to box does not say it")
            links = [step["link"]["url"] for step in [how.get("headline")] + steps if isinstance(step.get("link"), dict)]
            if s["lookupUrl"] not in links:
                raise ValueError(f"{where}: lookupUrl {s['lookupUrl']!r} is not the link of any howTo step")
        dated = [(f"source {x.get('id')!r} checkedAt", x.get("checkedAt")) for x in sources] \
            + [(f"lead {j} checkedAt", x.get("checkedAt")) for j, x in enumerate(s.get("leads") or [], 1) if isinstance(x, dict)]
        for label, value in dated:
            if isinstance(value, str) and value > latest:
                raise ValueError(f"{where}: {label} {value} is after the build date {today}")
        for j, lead in enumerate(s.get("leads") or [], 1):
            at = f"{where}, lead {j}"
            if not isinstance(lead, dict) or not valid_url(lead.get("url")) or not _day_ok(lead.get("checkedAt")) \
                    or not _nonempty(lead.get("note")):
                raise ValueError(f"{at}: a lead needs a valid url, a checkedAt date and a note")
    return hosts


def service_host(url, hosts):
    """The service id whose hostname (or a parent domain) serves this URL, mirroring the app's lookup."""
    host = (urlsplit(url).hostname or "").removeprefix("www.")
    for h, sid in hosts.items():
        if host == h or host.endswith("." + h):
            return sid
    return None


def load_services(path, records, explicit):
    if not path.exists():
        if explicit:
            raise ValueError(f"Licensed services file not found: {path}")
        return None, None, []
    raw = path.read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"{path.name}: invalid JSON: {error}") from None
    data = parse_json(text, path.name)
    check_unicode(data, path.name)
    hosts = validate_services(data, path.name)
    warnings = []
    used = Counter()
    for r in records:
        if r.get("access") != "licensed":
            continue
        sid = service_host(r.get("directUrl") or r["url"], hosts)
        if sid is None:
            warnings.append(f"licensed record {r['id']!r} ({urlsplit(r['url']).hostname}) matches no service in {path.name}; "
                            "the app labels it as a licensed listing without access terms")
        else:
            used[sid] += 1
    for s in data["services"]:
        if not used[s["id"]]:
            warnings.append(f"service {s['id']!r} in {path.name} has no licensed record")
    return data, hashlib.sha256(raw).hexdigest(), warnings


RECORD_TEXT = ("titleEn", "titleHe", "title", "originalTitle", "uploader", "subseriesEn", "subseriesHe", "description",
               "descriptionHe", "completenessNote", "playbackVerificationNote")


def validate_record_fields(r, where):
    if r.get("access") is not None and not enum_ok(r["access"], ACCESS):
        raise ValueError(f"{where}: access must be one of {sorted(ACCESS)} (or absent), got {r['access']!r}")
    check = r.get("availabilityCheck")
    if check is not None:
        status = check.get("status") if isinstance(check, dict) else check
        if not isinstance(check, (str, dict)) or (status is not None and not enum_ok(status, CHECK_STATUSES)):
            raise ValueError(f"{where}: availabilityCheck must be one of {sorted(CHECK_STATUSES)} or an object whose optional "
                             f"status is one of them, got {check!r}"[:400])
        if isinstance(check, dict):
            problems = text_problems(check, ("method", "checkedAt", "result"), where + ", availabilityCheck")
            if problems:
                raise ValueError(problems[0])
    for field in ("season", "episodeNumber"):
        if r.get(field) is not None and not is_int(r[field]):
            raise ValueError(f"{where}: {field} must be an integer or null")
    for field in ("production", "guideEpisodeId"):
        if r.get(field) is not None and not isinstance(r[field], str):
            raise ValueError(f"{where}: {field} must be a string")
    problems = text_problems(r, RECORD_TEXT, where)
    # titleHeEditorial: our Hebrew translation of titleEn (or of originalTitle) for an upload with no published Hebrew title.
    editorial = editorial_he_problem(r, where, ("titleHe",))
    if editorial:
        problems.append(editorial)
    notes = r.get("notes")
    if notes is not None and not (isinstance(notes, str) or (isinstance(notes, dict) and all(
            k in ("en", "he") and (v is None or isinstance(v, str)) for k, v in notes.items()))):
        problems.append(f"{where}: notes must be a string or {{en, he}} with string values")
    if problems:
        raise ValueError(problems[0])


# Host video keys, mirroring the app's videoRefs() for the hosts where one video has several URL spellings.
def video_key(url):
    try:
        p = urlsplit(url)
    except ValueError:
        return None
    host = (p.hostname or "").removeprefix("www.").removeprefix("m.")
    seg = [x for x in p.path.split("/") if x]
    if host in {"youtube.com", "youtu.be", "youtube-nocookie.com"}:
        query = dict(x.split("=", 1) for x in p.query.split("&") if "=" in x)
        embedded = seg[1] if len(seg) > 1 and seg[0] in {"shorts", "embed", "live", "v"} else ""
        vid = seg[0] if host == "youtu.be" and seg else query.get("v") or embedded
        return "youtube:" + vid if re.fullmatch(r"[\w-]{11}", vid or "") else None
    if host.endswith("vimeo.com"):
        vid = next((x for x in seg if re.fullmatch(r"\d{5,}", x)), None)
        return "vimeo:" + vid if vid else None
    if host.endswith("archive.org") and len(seg) > 2 and seg[0] in {"details", "embed", "download", "stream"}:
        return "archive:" + unquote("/".join(seg[1:]))
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "index.html")
    parser.add_argument("--guide", type=Path, help="episode guide JSON (default: data/episode-guide.json if it exists)")
    parser.add_argument("--guide-part", type=Path, action="append", default=None,
                        help="a guide part to merge into --guide (repeatable; default: data/guide-*.json with the default guide)")
    parser.add_argument("--series", type=Path, default=ROOT / "data/series.json", help="series registry JSON")
    parser.add_argument("--vocabulary", type=Path, default=ROOT / "data/vocabulary.json", help="tag vocabulary JSON")
    parser.add_argument("--link-priority", type=Path, default=ROOT / "data/link-priority.json",
                        help="link priority JSON (the order of an entry's copies)")
    parser.add_argument("--services", type=Path,
                        help="licensed services JSON (default: data/licensed-services.json if it exists)")
    args = parser.parse_args()
    inputs = args.inputs or sorted((ROOT / "data").glob("*-records.json"))
    series_path = args.series if args.series.is_absolute() else ROOT / args.series
    registry = load_series(series_path)
    series_ids = {s["id"] for s in registry["series"]}
    vocabulary_path = args.vocabulary if args.vocabulary.is_absolute() else ROOT / args.vocabulary
    vocabulary = load_vocabulary(vocabulary_path)
    priority_path = args.link_priority if args.link_priority.is_absolute() else ROOT / args.link_priority
    link_priority = load_link_priority(priority_path)
    records = []
    seen = {}
    origin = {}  # record id -> (url, "file, entry n") of its first occurrence, for duplicate-id errors
    default_table, standard_notes = [], {}
    entries = {}  # url key -> [("file, entry n", fields present)] for each entry merged into that upload
    notices = []
    for path in inputs:
        if not path.is_absolute():
            path = ROOT / path
        if not path.exists():
            notices.append(f"Missing input, skipped: {path.name}")
            continue
        data = load_json(path)
        items = data.get("records", []) if isinstance(data, dict) else data
        if not isinstance(items, list):
            raise ValueError(f"Expected a record array in {path}")
        defaults = file_defaults(data, path.name)
        if defaults is not None:
            default_table.append(defaults)
        # completenessNotes: {status code: note}, the note of each record whose completenessStatus names it and that has no
        # completenessNote of its own (meta.standardCompletenessNotes; the record page shows it).
        table = data.get("completenessNotes") if isinstance(data, dict) else None
        if table is not None:
            if not isinstance(table, dict) or not all(isinstance(k, str) and isinstance(v, str) and v.strip() for k, v in table.items()):
                raise ValueError(f"{path.name}: completenessNotes must map status codes to non-empty notes")
            for code, note in table.items():
                if code in standard_notes and standard_notes[code] != note:
                    raise ValueError(f"{path.name}: completenessNotes {code!r} differs from the same code in an earlier file")
                standard_notes[code] = note
        for offset, raw in enumerate(items, 1):
            if not isinstance(raw, dict):
                raise ValueError(f"{path.name}, entry {offset}: expected an object")
            check_unicode(raw, f"{path.name}, entry {offset}")
            if "_d" in raw:
                raise ValueError(f"{path.name}, entry {offset}: _d is reserved (the builder sets it)")
            r = {**copy.deepcopy(defaults), **raw, "_d": len(default_table) - 1} if defaults is not None else dict(raw)
            # Any public http(s) page is accepted (YouTube, Vimeo, Hop, Internet Archive, Dailymotion,
            # Facebook, Kan, ok.ru and others); hosts are recognised later by hostname.
            r["url"] = r.get("url") or r.get("sourceUrl") or r.get("directUrl")
            if not valid_url(r["url"]):
                raise ValueError(f"{path.name}, entry {offset}: valid public url required ({url_problem(r['url'])})")
            for field in ("sourceUrl", "directUrl"):
                if r.get(field) and not valid_url(r[field]):
                    raise ValueError(f"{path.name}, entry {offset}: invalid {field} ({url_problem(r[field])})")
            if not enum_ok(r.get("series"), series_ids):
                raise ValueError(f"{path.name}, entry {offset}: unknown series {r.get('series')!r} "
                                 f"(series are listed in {series_path.name})")
            if not enum_ok(r.get("kind"), KINDS):
                raise ValueError(f"{path.name}, entry {offset}: unknown kind {r.get('kind')!r}")
            if not (r.get("titleEn") or r.get("titleHe") or r.get("title")):
                raise ValueError(f"{path.name}, entry {offset}: title required")
            validate_record_fields(r, f"{path.name}, entry {offset}")
            for field in ("themes", "characters"):
                r[field] = values(r.get(field))
                bad = [v for v in r[field] if not valid_tag(v)]
                if bad:
                    raise ValueError(f"{path.name}, entry {offset}: {field} entries must be non-empty strings or objects "
                                     f"with a string id, en or he; got {bad[0]!r}")
            # Without an explicit id the URL is the id; the app encodes ids in its routes.
            r["id"] = str(r.get("id") or r["url"])
            where = f"{path.name}, entry {offset}"
            if r["id"] in RESERVED_IDS:
                raise ValueError(f"{where}: record id {r['id']!r} is reserved (saved links and backups are keyed by id)")
            # Two spellings of one URL (raw Hebrew or %-escapes, host case, default port) are one upload.
            key = url_key(r["url"])
            # Which entry holds each field, so a refusal after merging names the entries involved.
            entries.setdefault(key, []).append((where, {f for f, v in r.items() if v not in (None, "", [], {})}))
            if key in seen:
                merge_records(seen[key], r)
                continue
            # One id must name one upload: links, playback evidence, favorites and guide references are keyed by id.
            if r["id"] in origin and url_key(origin[r["id"]][0]) != key:
                first_url, first_where = origin[r["id"]]
                raise ValueError(f"record id {r['id']!r} is shared by different URLs: {first_url} ({first_where}) "
                                 f"and {r['url']} ({where})")
            origin.setdefault(r["id"], (r["url"], where))
            seen[key] = r
            records.append(r)
    # Merging fills empty fields from later entries for the same URL, so one entry's titleHeEditorial can meet another's titleHe.
    for r in records:
        if not editorial_he_problem(r, "", ("titleHe",)):
            continue
        held = entries.get(url_key(r["url"]), [])
        holder = lambda field: next((w for w, fields in held if field in fields), "an entry")
        raise ValueError(f"record {r['id']!r}: {holder(EDITORIAL_HE)} has {EDITORIAL_HE} and {holder('titleHe')} (the same URL, "
                         f"merged into one upload) has titleHe. {EDITORIAL_HE} fills only a missing published Hebrew title; "
                         f"keep the published title and remove {EDITORIAL_HE} from {holder(EDITORIAL_HE)}")
    unlettered = [r["id"] for r in records if editorial_he_unlettered(r)]
    if unlettered:
        notices.append(f"Warning: {len(unlettered)} records have a {EDITORIAL_HE} with no Hebrew letter (it is a Hebrew "
                       f"translation of the editorial title): {', '.join(unlettered[:5])}" + (" ..." if len(unlettered) > 5 else ""))
    discovered = apply_player_links(ROOT / "data/hop-player-links.json", records)
    same_video = {}
    for r in records:
        k = video_key(r.get("directUrl") or r["url"])
        if k:
            same_video.setdefault(k, []).append(r["id"])
    shared = [(k, ids) for k, ids in same_video.items() if len(ids) > 1]
    if shared:
        notices.append(f"Warning: {len(shared)} videos are linked by more than one record (different URLs for one video): " +
                       "; ".join(f"{k}: {', '.join(ids)}" for k, ids in shared[:5]) + (" ..." if len(shared) > 5 else ""))
    unchecked_urls = [r["id"] for r in records if r.get("playbackVerified") is True and not r.get("playbackUrl")]
    if unchecked_urls:
        notices.append(f"Warning: {len(unchecked_urls)} records have playbackVerified without playbackUrl; the app shows "
                       f"playback evidence only for the exact URL that was checked: {', '.join(unchecked_urls[:5])}")

    guide_path = args.guide or ROOT / "data/episode-guide.json"
    if not guide_path.is_absolute():
        guide_path = ROOT / guide_path
    # Guide parts join the default guide only: an explicit --guide is the whole guide (fixtures and tests).
    guide_parts = sorted((ROOT / "data").glob("guide-*.json")) if args.guide is None else []
    if args.guide_part is not None:
        guide_parts = [x if x.is_absolute() else ROOT / x for x in args.guide_part]
        for x in guide_parts:
            if not x.exists():
                raise ValueError(f"Guide part not found: {x}")
    guide, guide_sha, guide_warnings = load_guide(guide_path, records, explicit=args.guide is not None, parts=guide_parts,
                                                   series=series_ids)
    services_path = args.services or ROOT / "data/licensed-services.json"
    if not services_path.is_absolute():
        services_path = ROOT / services_path
    services, services_sha, services_warnings = load_services(services_path, records, explicit=args.services is not None)
    meta = {
        "compiledAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=-4))).strftime("%Y-%m-%d"),
        "schemaVersion": 1,
        "playerLinksDiscovered": discovered,
        "playbackVerifiedWithoutVpn": sum(r.get("playbackVerified") is True and r.get("playbackWithoutVpn") is True for r in records),
        "inputFiles": [p.name for p in inputs],
        "seriesFile": series_path.name,
        "vocabularyFile": vocabulary_path.name,
        "linkPriorityFile": priority_path.name,
        **({"standardCompletenessNotes": standard_notes} if standard_notes else {}),
    }
    if guide is not None:
        meta.update({"guideFile": guide_path.name, "guideParts": [x.name for x in guide_parts], "guideSha256": guide_sha, "guideCounts": guide_counts(guide, {g["series"] for g in registry["goal"]})})
    else:
        notices.append(f"No episode guide ({guide_path.name} not found): embedded an empty guide; the app opens on All uploads.")
    if services is not None:
        meta.update({"servicesFile": services_path.name, "servicesSha256": services_sha})
    else:
        notices.append(f"No licensed services file ({services_path.name} not found): licensed listings are labelled without "
                       "their access terms.")
    payload = {"meta": meta, "series": registry, "vocabulary": vocabulary, "linkPriority": link_priority,
               "recordDefaults": default_table, "records": [compact_record(r, default_table) for r in records], "guide": guide if guide is not None else EMPTY_GUIDE}
    if services is not None:
        payload["services"] = services
    # Escape HTML-significant characters inside the script data block. JSON strings
    # may contain title text copied from public pages, including closing tags.
    try:
        # allow_nan=False: the browser's JSON.parse rejects NaN and Infinity, which would leave the page blank.
        dumped = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
    except ValueError as error:
        raise ValueError(f"the library data contains a non-finite number (NaN or Infinity): {error}") from None
    embedded = dumped.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = (ROOT / "library.template.html").read_text(encoding="utf-8")
    marker = "__LIBRARY_DATA__"
    if template.count(marker) != 1:
        raise ValueError("Template must contain exactly one library data marker")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    # Write atomically: a failed build never truncates the previous output.
    data = template.replace(marker, embedded).encode("utf-8")
    fd, tmp = tempfile.mkstemp(prefix="." + args.output.name + ".", suffix=".tmp", dir=args.output.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
        umask = os.umask(0)
        os.umask(umask)
        os.chmod(tmp, args.output.stat().st_mode & 0o777 if args.output.exists() else 0o666 & ~umask)
        os.replace(tmp, args.output)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise
    print(f"Built {args.output}: {len(records)} records")
    edited = sum(isinstance(r.get(EDITORIAL_HE), str) for r in records)
    if edited:
        print(f"Editorial Hebrew titles ({EDITORIAL_HE}): {edited} records")
    if discovered:
        checked = sum(r.get("playbackVerified") is True for r in records)
        without_vpn = sum(r.get("playbackVerified") is True and r.get("playbackWithoutVpn") is True for r in records)
        print(f"Integrated {discovered} exact Vimeo URLs; {checked} playback startups verified, {without_vpn} outside the VPN")
    hosts = Counter((urlsplit(r.get("directUrl") or r["url"]).hostname or "").removeprefix("www.") for r in records)
    print("Watch hosts: " + ", ".join(f"{h} {n}" for h, n in hosts.most_common()))
    if guide is not None:
        c = meta["guideCounts"]
        fmt = lambda d: ", ".join(f"{k} {v}" for k, v in d.items()) or "none"
        print(f"Guide {guide_path.name}: {c['productions']} productions, {c['episodes']} episodes, {c['queue']} uploads awaiting identification"
              + (f", {c['possibleCopies']} possible copies (not counted)" if c["possibleCopies"] else ""))
        print(f"  Core Rechov Sumsum: {fmt(c['coreRechovCoverage'])}")
        print(f"  Other formats and series (counted separately): {fmt(c['otherCoverage'])}")
        stories = sum(isinstance(e.get("storyHe"), str) and bool(e["storyHe"].strip()) for e in guide["episodes"])
        if stories:
            print(f"  Hebrew story names from other sources (storyHe): {stories} episodes")
        edited = sum(isinstance(e.get(EDITORIAL_HE), str) for e in guide["episodes"])
        if edited:
            print(f"  Editorial Hebrew titles ({EDITORIAL_HE}): {edited} episodes")
        for warning in guide_warnings:
            print(f"  Warning: {warning}")
    if services is not None:
        print(f"Licensed services {services_path.name}: " + ", ".join(f"{x['name']} ({x['model']})" for x in services["services"]))
        for warning in services_warnings:
            print(f"  Warning: {warning}")
    for notice in notices:
        print(notice)


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        # Validation errors name the file, entry and field; the previous output is left untouched.
        print(f"Build failed: {error}", file=sys.stderr)
        sys.exit(1)
