#!/usr/bin/env python3
"""nhanes_fetch.py — download NHANES public-use components and PROVE they are data.

Standard library only, so it runs on the project machine (Python 3.x, no packages).

    python app/etl/nhanes_fetch.py --out C:\\Healthcare_Data_Extract\\NHANES \\
        --cycle 1999-2000 --cycle 2001-2002 --cycle 2003-2004 \\
        --component DEMO --component BAQ --component MPQ --component AUQ

Why this exists. A previous scrape produced 28 files named *.XPT that were all the
same 20,905-byte CDC "Page Not Found" page: the URL pattern had changed and the
scraper saved whatever came back. This script refuses to do that. Every download is
checked for the SAS XPORT signature before it is kept, HTML is reported as a failure,
and a manifest records the URL that worked, the byte count, the SHA-256 and the
download time, so the ETL's provenance block can cite them.

URL patterns. The CDC restructured wwwn.cdc.gov in 2024. Both the current pattern and
the legacy one are tried, in that order; the manifest says which one answered.

File naming. NHANES suffixes components by cycle letter: none for 1999-2000, _B for
2001-2002, _C for 2003-2004, ... _J for 2017-2018. The 2017-March 2020 pre-pandemic
files are prefixed P_ with no suffix. This script derives the name from the cycle.

Which components. Not every component exists in every cycle — the Balance
questionnaire (BAQ) and the miscellaneous-pain questionnaire that carries the severe
headache / migraine item (MPQ) were fielded in 1999-2004. A component that does not
exist for a cycle comes back as a clean "not found", not as a saved HTML page.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

XPORT_MAGIC = b"HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!"

CYCLES = {
    "1999-2000": ("1999", ""),
    "2001-2002": ("2001", "_B"),
    "2003-2004": ("2003", "_C"),
    "2005-2006": ("2005", "_D"),
    "2007-2008": ("2007", "_E"),
    "2009-2010": ("2009", "_F"),
    "2011-2012": ("2011", "_G"),
    "2013-2014": ("2013", "_H"),
    "2015-2016": ("2015", "_I"),
    "2017-2018": ("2017", "_J"),
    "2017-2020": ("2017", "P_"),   # pre-pandemic combined files, prefixed
    "2021-2023": ("2021", "_L"),
}


def file_name(cycle, component):
    year, suffix = CYCLES[cycle]
    if suffix == "P_":
        return f"P_{component}.xpt"
    return f"{component}{suffix}.xpt"


def candidate_urls(cycle, component):
    year, _ = CYCLES[cycle]
    name = file_name(cycle, component)
    return [
        # current (post-2024) pattern
        f"https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/{year}/DataFiles/{name}",
        # legacy pattern, kept in case the redirect returns
        f"https://wwwn.cdc.gov/Nchs/Nhanes/{cycle}/{name.upper()}",
    ]


def fetch(url, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "masque-nhanes-fetch/1.0 (open-data pipeline)"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, res.headers.get("Content-Type", ""), res.read()


def looks_like_xport(data):
    return data[: len(XPORT_MAGIC)] == XPORT_MAGIC


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True, help="folder to write into (a sub-folder per cycle is created)")
    ap.add_argument("--cycle", action="append", required=True, choices=sorted(CYCLES), help="repeatable")
    ap.add_argument("--component", action="append", required=True, help="repeatable, e.g. DEMO BAQ MPQ AUQ AUX MCQ")
    ap.add_argument("--overwrite", action="store_true", help="re-download files that already verify")
    args = ap.parse_args()

    manifest_path = os.path.join(args.out, "manifest.json")
    manifest = {"fetchedBy": "nhanes_fetch.py 1.0", "files": []}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, encoding="utf-8") as f:
                manifest = json.load(f)
        except (OSError, ValueError):
            pass
    by_key = {(m["cycle"], m["component"]): m for m in manifest.get("files", []) if m.get("ok")}

    failures = 0
    for cycle in args.cycle:
        folder = os.path.join(args.out, cycle)
        os.makedirs(folder, exist_ok=True)
        for component in args.component:
            component = component.upper()
            target = os.path.join(folder, file_name(cycle, component))
            if not args.overwrite and (cycle, component) in by_key and os.path.exists(target):
                with open(target, "rb") as f:
                    if looks_like_xport(f.read(len(XPORT_MAGIC))):
                        print(f"  keep   {cycle} {component}: already verified")
                        continue
            record = {"cycle": cycle, "component": component, "file": os.path.basename(target), "ok": False, "attempts": []}
            for url in candidate_urls(cycle, component):
                try:
                    status, ctype, data = fetch(url)
                except urllib.error.HTTPError as e:
                    record["attempts"].append({"url": url, "result": f"HTTP {e.code}"})
                    continue
                except (urllib.error.URLError, OSError) as e:
                    record["attempts"].append({"url": url, "result": f"error: {e}"})
                    continue
                if not looks_like_xport(data):
                    kind = "HTML page" if data.lstrip()[:15].lower().startswith((b"<!doctype", b"<html")) else f"not SAS XPORT ({ctype or 'no content-type'})"
                    record["attempts"].append({"url": url, "result": f"HTTP {status} but {kind}, {len(data)} bytes — REJECTED"})
                    continue
                with open(target, "wb") as f:
                    f.write(data)
                record.update({
                    "ok": True, "url": url, "bytes": len(data),
                    "sha256": hashlib.sha256(data).hexdigest(),
                    "downloadedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                })
                record["attempts"].append({"url": url, "result": f"HTTP {status}, SAS XPORT verified"})
                print(f"  ok     {cycle} {component}: {len(data):,} bytes  sha256 {record['sha256'][:12]}…")
                break
            if not record["ok"]:
                failures += 1
                print(f"  FAIL   {cycle} {component}: " + "; ".join(a["result"] for a in record["attempts"]))
                if os.path.exists(target):
                    os.remove(target)   # never leave a non-data file with a data name
            manifest["files"] = [m for m in manifest.get("files", []) if (m["cycle"], m["component"]) != (cycle, component)]
            manifest["files"].append(record)

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nmanifest: {manifest_path}")
    if failures:
        print(f"{failures} component(s) not fetched. A component missing for a cycle is expected for content that was not fielded that cycle; an HTML rejection means the URL pattern is stale — check the NHANES data-files page and update candidate_urls().")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
