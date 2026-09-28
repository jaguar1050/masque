#!/usr/bin/env python3
"""meps_pool.py — stack person-level CSVs from meps_prepare.py into one pooled MEPS file.

    python app/etl/meps_pool.py --out meps_2019_2021.csv meps_2019.csv meps_2020.csv meps_2021.csv
    python app/etl/meps_pool.py --hc036 h36u24.dat --out meps_2019_2021_hc036.csv meps_2019.csv ...

Follows AHRQ's HC-036 documentation (1996-2024 Pooled Linkage Variance Estimation File,
August 2026), sections C-1 to C-4:

  * Records are stacked, not de-duplicated: a person in the sample for two or three of the
    pooled years contributes one record per year. AHRQ: valid, because each year is designed
    to be nationally representative.
  * PERWT is divided by the number of years pooled, so a total is an average annual total.
    Means and proportions are unchanged by the division.
  * Variance structure. When every pooled year is 2019 or later, AHRQ directs analysts to use
    the annual files' VARSTR/VARPSU, which share a common structure from 2019 on; those are
    kept as they are. With --hc036, STRA9624 and PSU9624 are attached as well, merged by
    DUPERSID and PANEL. AHRQ requires them when pooling across the 2018/2019 boundary or
    with years before 2002, and says the two structures must never be combined. This script
    attaches both as separate columns; a map names one pair.
  * Subpopulations stay flags on the full file (C-5); nothing here drops a record.

PANEL is not on the prepared CSV. For 2018 and later DUPERSID begins with the two-digit
panel number; this is checked against HC-036 for every record, and the script refuses the
file if a year before 2018 is given, or if any record fails to match exactly one HC-036 row.

Standard library only.
"""
import argparse, csv, datetime as dt, hashlib, json, os, sys


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def read_hc036(path):
    """Positions from the HC-036 codebook (June 18, 2026): DUPERSID 11-20, PANEL 21-22,
    STRA9624 52-55, PSU9624 56. Returns {(DUPERSID, PANEL): (STRA9624, PSU9624)}."""
    out = {}
    with open(path, "r", encoding="ascii", newline="") as f:
        for n, line in enumerate(f, 1):
            line = line.rstrip("\r\n")
            if len(line) != 56:
                sys.exit(f"HC-036 line {n}: {len(line)} characters, expected 56 — not the h36u24 layout")
            key = (line[10:20], int(line[20:22]))
            if key in out:
                sys.exit(f"HC-036 line {n}: DUPERSID+PANEL {key} appears twice")
            out[key] = (int(line[51:55]), int(line[55]))
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("inputs", nargs="+", help="per-year CSVs from meps_prepare.py, each with its .provenance.json beside it")
    ap.add_argument("--out", required=True)
    ap.add_argument("--hc036", help="h36u24.dat, to attach STRA9624/PSU9624")
    a = ap.parse_args()

    years, prov = [], []
    for p in a.inputs:
        pp = os.path.splitext(p)[0] + ".provenance.json"
        if not os.path.exists(pp):
            sys.exit(f"{p}: no provenance file {pp}; pool only files written by meps_prepare.py")
        meta = json.load(open(pp, encoding="utf-8"))
        years.append(str(meta["year"]))
        prov.append({"file": os.path.basename(p), "sha256": sha(p), "year": meta["year"], "provenance": meta})
    if len(set(years)) != len(years):
        sys.exit(f"a year is given twice: {years}")
    if min(int(y) for y in years) < 2018:
        sys.exit("PANEL is derived from DUPERSID, which carries the panel only from 2018 on")
    k = len(years)

    hc = read_hc036(a.hc036) if a.hc036 else None
    header, rows = None, []
    for p, y in zip(a.inputs, years):
        with open(p, encoding="utf-8", newline="") as f:
            r = csv.DictReader(f)
            if header is None:
                header = list(r.fieldnames)
            elif list(r.fieldnames) != header:
                sys.exit(f"{p}: columns differ from {a.inputs[0]}; prepare every year with the same map")
            for row in r:
                row["YEAR"] = y
                row["PERWT"] = repr(float(row["PERWT"]) / k)
                if hc is not None:
                    key = (row["DUPERSID"], int(row["DUPERSID"][:2]))
                    if key not in hc:
                        sys.exit(f"{p}: {key} not on HC-036")
                    row["STRA9624"], row["PSU9624"] = hc[key]
                rows.append(row)

    cols = header + ["YEAR"] + (["STRA9624", "PSU9624"] if hc is not None else [])
    with open(a.out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)

    distinct = len({r["DUPERSID"] for r in rows})
    meta = {
        "preparedBy": "meps_pool.py 0.1.0",
        "preparedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "years": years, "yearsPooled": k,
        "weight": f"PERWT divided by {k}: totals are average annual totals",
        "records": len(rows), "distinctPersons": distinct,
        "hc036": {"file": os.path.basename(a.hc036), "sha256": sha(a.hc036)} if a.hc036 else None,
        "inputs": prov,
        "output": os.path.basename(a.out), "outputSha256": sha(a.out),
    }
    json.dump(meta, open(os.path.splitext(a.out)[0] + ".provenance.json", "w", encoding="utf-8"), indent=2)
    print(f"{k} years, {len(rows)} records, {distinct} distinct persons; wrote {a.out}")


if __name__ == "__main__":
    main()
