#!/usr/bin/env python3
"""Read public Vimeo oEmbed metadata for exact URLs captured from official Hop pages.

Downloads metadata JSON only. Existing successful results are cached. This updates
catalog duration, thumbnail and Vimeo title fields, and never changes playback
verification or the catalog builder's direct-link/access fields.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ENDPOINT = "https://vimeo.com/api/oembed.json"


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load(path, default=None):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def valid_vimeo_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlsplit(value)
    return (parsed.scheme == "https"
            and parsed.hostname in {"vimeo.com", "www.vimeo.com", "player.vimeo.com"}
            and parsed.username is None and parsed.password is None
            and bool(re.fullmatch(r"/(?:video/)?\d+(?:/[^\s/]*)?/?", parsed.path)))


def fetch_metadata(url):
    request_url = ENDPOINT + "?" + urlencode({"url": url})
    attempts = []
    for attempt in range(1, 4):
        try:
            request = Request(request_url, headers={
                "User-Agent": "SumsumLibraryCatalog/1.0 (public video metadata)",
                "Accept": "application/json",
            })
            with urlopen(request, timeout=25) as response:
                payload = json.load(response)
            if payload.get("provider_name") != "Vimeo" or not payload.get("video_id"):
                raise ValueError("Response does not identify Vimeo video metadata")
            attempts.append({"attempt": attempt, "status": "ok"})
            return {"url": url, "requestUrl": request_url, "retrievedAt": now(),
                    "status": "ok", "attempts": attempts, "metadata": payload}
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            http_status = error.code if isinstance(error, HTTPError) else None
            attempts.append({"attempt": attempt, "status": "error", "httpStatus": http_status,
                             "error": str(error)})
            if attempt == 3 or (http_status and http_status != 429 and http_status < 500):
                return {"url": url, "requestUrl": request_url, "retrievedAt": now(),
                        "status": "error", "attempts": attempts, "error": str(error)}
            time.sleep(0.75 * (2 ** (attempt - 1)))
    raise RuntimeError("Unreachable retry state")


def full_word_episode_sources(path):
    """Only titles explicitly labelled full episodes establish complete format."""
    result = {}
    for record in load(path, []):
        if (record.get("subseriesHe") == "מילת היום 2023"
                and record.get("kind") == "episode"
                and "פרקים מלאים" in record.get("titleHe", "")
                and isinstance(record.get("episodeNumber"), int)):
            result[record["episodeNumber"]] = record
    return result


def enrich_catalog(catalog_path, report, metadata_by_url, youtube_path):
    # Reload immediately before writing so concurrent builders cannot lose edits
    # made while the network requests were running.
    records = load(catalog_path, [])
    by_id = {str(r.get("id")): r for r in records}
    by_post = {r.get("hopId"): r for r in records if r.get("hopId") is not None}
    full_words = full_word_episode_sources(youtube_path)
    updated = 0
    for item in report["records"]:
        url = item.get("directUrl")
        entry = metadata_by_url.get(url)
        if not entry or entry.get("status") != "ok":
            continue
        record = by_id.get(str(item.get("id"))) or by_post.get(item.get("hopId"))
        if not record:
            continue
        meta = entry["metadata"]
        duration = meta.get("duration")
        if isinstance(duration, (int, float)) and not isinstance(duration, bool) and duration > 0:
            record["durationSeconds"] = duration
            record["durationMetadataVerified"] = True
            record["durationSourceUrl"] = entry["requestUrl"]
        if isinstance(meta.get("title"), str):
            record["titleVimeo"] = meta["title"]
        thumbnail = meta.get("thumbnail_url")
        if isinstance(thumbnail, str) and urlsplit(thumbnail).scheme == "https":
            if record.get("thumbnailUrl") and record["thumbnailUrl"] != thumbnail:
                record.setdefault("thumbnailHopUrl", record["thumbnailUrl"])
            record["thumbnailUrl"] = thumbnail
        record["vimeoMetadataProvenance"] = {
            "source": "Vimeo public oEmbed",
            "sourceUrl": entry["requestUrl"],
            "videoUrl": url,
            "videoId": meta.get("video_id"),
            "authorName": meta.get("author_name"),
            "authorUrl": meta.get("author_url"),
            "retrievedAt": entry["retrievedAt"],
            "collectorSourceUrl": item.get("url"),
            "metadataOnly": True,
        }
        # Vimeo metadata does not by itself verify end-to-end playback.
        note = record.get("notes", "")
        if isinstance(note, str):
            note = note.replace(" The video itself and its duration were not verified.", "")
            note = note.replace("complete program status and running time are unverified.",
                                "complete program status is unverified.")
            if "Vimeo public metadata supplies the running time" not in note:
                note += " Vimeo public metadata supplies the running time and thumbnail; this metadata lookup does not verify video playback."
            record["notes"] = note.strip()
        if record.get("subseriesHe") == "מילת היום 2023":
            source = full_words.get(record.get("episodeNumber"))
            hop_title = {"חבוק": "חיבוק", "תקוה": "תקווה"}.get(record.get("titleHe"), record.get("titleHe", ""))
            if source and hop_title and hop_title in source.get("titleHe", ""):
                record["kind"] = "episode"
                record["programFormat"] = "short-form"
                record["kindVerification"] = {
                    "basis": "Corresponding official YouTube title explicitly labels the same titled and numbered Word of the Day installment as a full episode.",
                    "sourceUrl": source["url"], "sourceTitleHe": source["titleHe"],
                    "durationIsNotClassificationBasis": True,
                }
        updated += 1
    write_json(catalog_path, records)
    return updated


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, default=root / "data/hop-player-links.json")
    parser.add_argument("--catalog", type=Path, default=root / "data/hop-records.json")
    parser.add_argument("--output", type=Path, default=root / "data/vimeo-metadata.json")
    parser.add_argument("--youtube", type=Path, default=root / "data/hop-youtube-records.json")
    parser.add_argument("--refresh", action="store_true", help="Refresh successful cached metadata too")
    args = parser.parse_args()
    if not args.report.exists():
        parser.error(f"Collector report does not exist yet: {args.report}")
    report = load(args.report)
    if not isinstance(report, dict) or not isinstance(report.get("records"), list):
        parser.error("Expected a Hop collector report with a records array")
    if urlsplit(report.get("sourceOrigin", "")).hostname not in {"hop.co.il", "www.hop.co.il"}:
        parser.error("Collector report must identify an official Hop source origin")
    urls = sorted({r["directUrl"] for r in report["records"]
                   if isinstance(r, dict) and valid_vimeo_url(r.get("directUrl"))
                   and urlsplit(r.get("url", "")).hostname in {"hop.co.il", "www.hop.co.il"}})
    existing = load(args.output, {})
    cache = {r["url"]: r for r in existing.get("items", [])
             if isinstance(r, dict) and r.get("status") == "ok" and r.get("url") in urls}
    metadata = {} if args.refresh else dict(cache)
    pending = [url for url in urls if url not in metadata]
    print(f"Reading metadata for {len(urls)} exact Vimeo URLs; {len(metadata)} cached, {len(pending)} pending.", flush=True)
    with ThreadPoolExecutor(max_workers=3) as workers:
        futures = {workers.submit(fetch_metadata, url): url for url in pending}
        for index, future in enumerate(as_completed(futures), 1):
            entry = future.result()
            metadata[entry["url"]] = entry
            if index % 20 == 0 or index == len(pending):
                ok = sum(r.get("status") == "ok" for r in metadata.values())
                print(f"Checked {index}/{len(pending)} pending URLs; {ok} successful metadata responses.", flush=True)
    items = [metadata[url] for url in urls]
    summary = {"uniqueUrls": len(urls), "successful": sum(r.get("status") == "ok" for r in items),
               "failed": sum(r.get("status") != "ok" for r in items)}
    output = {"generatedAt": now(), "source": "Vimeo public oEmbed", "endpoint": ENDPOINT,
              "collectorReport": str(args.report), "mediaDownloaded": False,
              "summary": summary, "items": items}
    write_json(args.output, output)
    updated = enrich_catalog(args.catalog, report, metadata, args.youtube)
    print(f"Saved {args.output}; enriched {updated} Hop records. Playback/access fields were preserved.", flush=True)


if __name__ == "__main__":
    main()
