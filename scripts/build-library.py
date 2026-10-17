#!/usr/bin/env python3
"""Build the offline video index with embedded research records.

Usage: python3 scripts/build-library.py [record-file.json ...] [--output PATH]
With no inputs, reads every data/*-records.json file.
No dependencies or network access are required.
"""
import argparse
import datetime as dt
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SERIES = {"modern", "classic", "shalom-classic", "shalom-modern", "elmo"}
KINDS = {"episode", "clip", "collection", "unverified"}


def values(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def valid_url(value):
    if not isinstance(value, str):
        return False
    try:
        parsed = urlsplit(value)
        return parsed.scheme in {"http", "https"} and bool(parsed.netloc) and not parsed.username and not parsed.password
    except ValueError:
        return False


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


def apply_player_links(path, records):
    """Add exact Hop-discovered URLs and preserve explicitly recorded playback evidence."""
    if not path.exists():
        return 0
    report = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(report, dict) or not isinstance(report.get("records"), list):
        raise ValueError(f"Expected a Hop collector report in {path}")
    origin = report.get("sourceOrigin", "")
    if urlsplit(origin).hostname not in {"hop.co.il", "www.hop.co.il"}:
        raise ValueError("Hop collector report must identify the official source origin")
    by_id = {r["id"]: r for r in records}
    by_url = {r["url"].rstrip("/"): r for r in records}
    added = 0
    for item in report["records"]:
        if not isinstance(item, dict) or not valid_vimeo_url(item.get("directUrl")):
            continue
        source_url = item.get("url", "")
        if urlsplit(source_url).hostname not in {"hop.co.il", "www.hop.co.il"}:
            continue
        record = by_id.get(str(item.get("id", ""))) or by_url.get(source_url.rstrip("/"))
        if not record or urlsplit(record["url"]).hostname not in {"hop.co.il", "www.hop.co.il"}:
            continue
        collected_at = item.get("collectedAt") or report.get("completedAt") or report.get("generatedAt") or "date not recorded"
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
        discovery = f"Exact Vimeo player/watch URL discovered in the public Hop page HTML at {collected_at}."
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
            "collectionMethod": report.get("collectionMethod", "same-origin public Hop page collector"),
            "status": item.get("status", "direct URL present in collector report"),
            "attempts": item.get("attempts", []),
        }
        old_note = clean_discovery_notes(record.get("notes"), bool(record.get("durationSeconds")), verified)
        discovery_note = f"Direct Vimeo link found by the same-origin Hop page collector on {collected_at}; the complete privacy URL is preserved. " + playback
        record["notes"] = (old_note + " " if old_note else "") + discovery_note
        added += 1
    return added


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "index.html")
    args = parser.parse_args()
    inputs = args.inputs or sorted((ROOT / "data").glob("*-records.json"))
    records = []
    seen = {}
    notices = []
    for path in inputs:
        if not path.is_absolute():
            path = ROOT / path
        if not path.exists():
            notices.append(f"Missing input, skipped: {path.name}")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data.get("records", []) if isinstance(data, dict) else data
        if not isinstance(items, list):
            raise ValueError(f"Expected a record array in {path}")
        for offset, raw in enumerate(items, 1):
            if not isinstance(raw, dict):
                raise ValueError(f"{path.name}, entry {offset}: expected an object")
            r = dict(raw)
            r["url"] = r.get("url") or r.get("sourceUrl") or r.get("directUrl")
            if not valid_url(r["url"]):
                raise ValueError(f"{path.name}, entry {offset}: valid public url required")
            for field in ("sourceUrl", "directUrl"):
                if r.get(field) and not valid_url(r[field]):
                    raise ValueError(f"{path.name}, entry {offset}: invalid {field}")
            if r.get("series") not in SERIES:
                raise ValueError(f"{path.name}, entry {offset}: unknown series {r.get('series')!r}")
            if r.get("kind") not in KINDS:
                raise ValueError(f"{path.name}, entry {offset}: unknown kind {r.get('kind')!r}")
            if not (r.get("titleEn") or r.get("titleHe") or r.get("title")):
                raise ValueError(f"{path.name}, entry {offset}: title required")
            for field in ("themes", "characters"):
                r[field] = values(r.get(field))
            r["id"] = str(r.get("id") or r["url"])
            key = r["url"].rstrip("/")
            if key in seen:
                merge_records(seen[key], r)
            else:
                seen[key] = r
                records.append(r)
    discovered = apply_player_links(ROOT / "data/hop-player-links.json", records)
    payload = {"meta": {"compiledAt": dt.datetime.now(dt.timezone(dt.timedelta(hours=-4))).strftime("%Y-%m-%d"), "schemaVersion": 1, "playerLinksDiscovered": discovered, "playbackVerifiedWithoutVpn": sum(r.get("playbackVerified") is True and r.get("playbackWithoutVpn") is True for r in records), "inputFiles": [p.name for p in inputs]}, "records": records}
    # Escape HTML-significant characters inside the script data block. JSON strings
    # may contain title text copied from public pages, including closing tags.
    embedded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    template = (ROOT / "library.template.html").read_text(encoding="utf-8")
    marker = "__LIBRARY_DATA__"
    if template.count(marker) != 1:
        raise ValueError("Template must contain exactly one library data marker")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(template.replace(marker, embedded), encoding="utf-8")
    print(f"Built {args.output}: {len(records)} records")
    if discovered:
        checked = sum(r.get("playbackVerified") is True for r in records)
        without_vpn = sum(r.get("playbackVerified") is True and r.get("playbackWithoutVpn") is True for r in records)
        print(f"Integrated {discovered} exact Vimeo URLs; {checked} playback startups verified, {without_vpn} outside the VPN")
    for notice in notices:
        print(notice)


if __name__ == "__main__":
    main()
