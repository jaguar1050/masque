#!/usr/bin/env python3
"""faers_prepare.py — cut openFDA drug-event CSV exports into the CSV the MASQUE ETL reads.

Standard library only.

    python app/etl/faers_prepare.py --out faers_reports.csv drug-event-0001-of-0005.json ... drug-event-0005-of-0005.json

Preferred input: the openFDA /drug/event JSON pages exactly as downloaded ({"meta", "results"}).
Also accepted: the same records flattened to CSV, one report per row, with nested fields
serialised as Python-literal lists. The CSV route is fragile: one flattening split long
drug lists across lines and lost records, which the JSON route cannot do.
Field meanings follow the openFDA human-drug field reference (Human_Drug.xlsx).

What this does:
  - keeps a row only if its first field is a FAERS safety report ID and its
    patient.reaction field parses as a list of {reactionmeddrapt: ...}. Lines that are
    fragments of the previous record (a flattening split long drug lists across lines in
    one export file) are counted and dropped, never reinterpreted;
  - keeps one row per safetyreportid (the last one seen; openFDA re-issues reports as
    new versions);
  - writes REACTIONS as the report's MedDRA preferred terms, upper-cased and joined by
    '|', plus SEX (openFDA patientsex: 0 unknown, 1 male, 2 female), RECEIVEDATE and
    the source file;
  - writes WT=1, STRATUM=1 and PSU=<row number>. FAERS is a spontaneous-reporting
    database, not a probability sample: there are no weights and no design. These
    columns let the ETL run with every report counted once and a simple binomial
    variance, which the map declares and the artifact states.
It derives nothing else.
"""
import argparse, ast, csv, datetime as dt, hashlib, json, os, re, sys

csv.field_size_limit(sys.maxsize)
IDRE = re.compile(r"^\d{7}-[\dX]$|^\d{8}$|^\d+-\d+$")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", required=True)
    ap.add_argument("files", nargs="+")
    a = ap.parse_args()
    by_id, per_file = {}, []
    for f in a.files:
        if f.lower().endswith(".json"):
            d = json.load(open(f, encoding="utf-8"))
            meta = d.get("meta", {}); res = d.get("results", [])
            kept = unparsed = 0
            for r in res:
                sid = str(r.get("safetyreportid", "")).strip()
                p = r.get("patient") or {}
                rx = p.get("reaction")
                if not sid or not isinstance(rx, list):
                    unparsed += 1; continue
                pts = [str(x.get("reactionmeddrapt", "")).strip().upper() for x in rx if isinstance(x, dict)]
                sex = str(p.get("patientsex", "")).strip()
                by_id[sid] = {"SAFETYREPORTID": sid, "SEX": sex if sex in ("0", "1", "2") else "",
                              "RECEIVEDATE": str(r.get("receivedate", "")).strip(), "SOURCE": os.path.basename(f),
                              "REACTIONS": "|".join(x for x in pts if x)}
                kept += 1
            per_file.append({"file": os.path.basename(f), "bytes": os.path.getsize(f),
                             "sha256": hashlib.sha256(open(f, "rb").read()).hexdigest(),
                             "records": kept, "recordsWithoutReportIdOrReactions": unparsed,
                             "openfdaMeta": {"last_updated": meta.get("last_updated"), "results": meta.get("results")}})
            print(f"{os.path.basename(f)}: {kept} records of {len(res)} (openFDA total {meta.get('results', {}).get('total')})")
            del d, res
            continue
        kept = frag = unparsed = 0
        with open(f, newline="", encoding="utf-8", errors="replace") as fh:
            r = csv.reader(fh); hdr = next(r); ix = {h: j for j, h in enumerate(hdr) if h}
            for k in ("safetyreportid", "patient.reaction"):
                if k not in ix: sys.exit(f"REFUSED: {f} has no {k} column")
            g = lambda row, k: row[ix[k]] if k in ix and ix[k] < len(row) else ""
            for row in r:
                sid = g(row, "safetyreportid").strip()
                if not IDRE.match(sid):
                    frag += 1; continue
                try:
                    rx = ast.literal_eval(g(row, "patient.reaction"))
                    pts = [str(d.get("reactionmeddrapt", "")).strip().upper() for d in rx if isinstance(d, dict)]
                except (ValueError, SyntaxError):
                    unparsed += 1; continue
                sex = g(row, "patient.patientsex").strip()
                by_id[sid] = {"SAFETYREPORTID": sid, "SEX": sex if sex in ("0", "1", "2") else "",
                              "RECEIVEDATE": g(row, "receivedate").strip(), "SOURCE": os.path.basename(f),
                              "REACTIONS": "|".join(p for p in pts if p)}
                kept += 1
        per_file.append({"file": os.path.basename(f), "bytes": os.path.getsize(f),
                         "sha256": hashlib.sha256(open(f, "rb").read()).hexdigest(),
                         "records": kept, "fragmentLinesDropped": frag, "unparseableReactionField": unparsed})
        print(f"{os.path.basename(f)}: {kept} records, {frag} fragment lines dropped, {unparsed} unparseable")
    rows = list(by_id.values())
    for i, r in enumerate(rows, 1):
        r.update({"WT": "1", "STRATUM": "1", "PSU": str(i)})
    cols = ["SAFETYREPORTID", "SEX", "RECEIVEDATE", "SOURCE", "REACTIONS", "WT", "STRATUM", "PSU"]
    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
    dates = sorted(r["RECEIVEDATE"] for r in rows if r["RECEIVEDATE"].isdigit())
    prov = {"preparedBy": "faers_prepare.py 0.1.0", "preparedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "inputs": per_file, "recordsBeforeDedup": sum(p["records"] for p in per_file), "uniqueReports": len(rows),
            "receiveDateRange": [dates[0], dates[-1]] if dates else None,
            "reportsWithoutReceiveDate": sum(1 for r in rows if not r["RECEIVEDATE"]),
            "output": os.path.basename(a.out), "outputSha256": hashlib.sha256(open(a.out, "rb").read()).hexdigest()}
    with open(os.path.splitext(a.out)[0] + ".provenance.json", "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2)
    print(f"{len(rows)} unique reports (from {prov['recordsBeforeDedup']} records), wrote {a.out}")


if __name__ == "__main__":
    main()
