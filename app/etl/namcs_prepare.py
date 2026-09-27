#!/usr/bin/env python3
"""namcs_prepare.py — cut one NAMCS public-use year into the CSV the MASQUE ETL reads.

Standard library only (runs on the project machine with no packages).

    python app/etl/namcs_prepare.py --year 2016 --data namcs2016 --out namcs_2016.csv
    python app/etl/namcs_prepare.py --stack namcs_2015.csv namcs_2016.csv namcs_2018.csv namcs_2019.csv --out namcs_2015_2019.csv

NAMCS public-use files are fixed-width text with no column names. Positions come from
app/etl/namcs_layout.json, which is transcribed from each year's NCHS documentation and
cites it. This script:

  - checks every record is long enough for the last field it reads;
  - checks every field against its documented code frame (SEX 1/2, PRDIAG -7/1/2,
    CSTRATM 8 digits, CPSUM 6 digits, PATWT a positive number, AGE 0-99, diagnosis
    codes the documented shape, with the documented special entries such as ZZZ0
    non-codable and ZZZ4 'no diagnosis' treated as no code) and REFUSES the file if more than a handful fail,
    because a wrong layout produces plausible-looking garbage rather than an error;
  - writes DIAGn as recorded, and DIAGn_CONF: the same code, blank when PRDIAGn = 1
    (probable, questionable or rule out). The maps use the _CONF columns so a "rule out
    migraine" is not counted as migraine;
  - writes a provenance JSON with the file's SHA-256, the layout used, and field counts.

It derives nothing else and recodes nothing else. Visits, not people: each row is one
sampled office visit.
"""
import argparse, csv, datetime as dt, hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ICD10 = re.compile(r"^[A-Z][0-9][0-9A-Z][0-9A-Z-]$")
SPECIAL = re.compile(r"^(ZZZ[0-9]|V99[0-9]-?)$")   # documented non-diagnosis entries: non-codable, left before seen, "none", etc.
ICD9 = re.compile(r"^(V[0-9]{2}|E[0-9]{3}|[0-9]{3})[0-9-]{0,2}$")


def stack(paths, out):
    """Pool prepared years: concatenate, add YEAR, divide PATWT by the number of years.

    NCHS recommends combining NAMCS years for rare conditions. Dividing the weight by
    the number of years makes totals annual averages; proportions are unchanged.
    CSTRATM carries the survey year in its digits, so strata stay distinct across years
    and CPSUM is nested within them.
    """
    k = len(paths); rows = []; prov = []
    for p in paths:
        pj = json.load(open(os.path.splitext(p)[0] + ".provenance.json", encoding="utf-8"))
        for r in csv.DictReader(open(p, encoding="utf-8")):
            r["PATWT"] = repr(float(r["PATWT"]) / k); r["YEAR"] = pj["year"]; rows.append(r)
        prov.append({k2: pj[k2] for k2 in ("year", "source", "sourceSha256", "records", "outputSha256")})
    if len({r["CSTRATM"][-5:-3] for r in rows}) < 1:
        sys.exit("REFUSED: no rows")
    cols = list(rows[0].keys())
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(rows)
    with open(os.path.splitext(out)[0] + ".provenance.json", "w", encoding="utf-8") as fh:
        json.dump({"stackedBy": "namcs_prepare.py 0.1.0 --stack", "years": [p["year"] for p in prov], "weightDivisor": k,
                   "components": prov, "records": len(rows),
                   "outputSha256": hashlib.sha256(open(out, "rb").read()).hexdigest()}, fh, indent=2)
    print(f"stacked {k} years, {len(rows)} visits, PATWT divided by {k}, wrote {out}")


def main():
    if "--stack" in sys.argv:
        i = sys.argv.index("--stack"); j = sys.argv.index("--out")
        return stack(sys.argv[i + 1:j], sys.argv[j + 1])
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--year", required=True)
    ap.add_argument("--data", required=True, help="the fixed-width public-use file, e.g. namcs2016")
    ap.add_argument("--out", required=True)
    ap.add_argument("--layout", default=os.path.join(HERE, "namcs_layout.json"))
    a = ap.parse_args()

    layout = json.load(open(a.layout, encoding="utf-8"))
    if a.year not in layout:
        sys.exit(f"REFUSED: no layout for {a.year} in {a.layout}")
    L = {k: v for k, v in layout[a.year].items() if isinstance(v, list)}
    icd9 = layout[a.year].get("icd", "").startswith("ICD-9")
    need = max(end for _, end in L.values())

    raw = open(a.data, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    lines = raw.decode("latin-1").splitlines()
    fails = {k: 0 for k in list(L) + ["LENGTH"]}
    out_rows = []
    diag_codes = 0; probable = 0
    for ln in lines:
        if not ln.strip():
            continue
        if len(ln) < need:
            fails["LENGTH"] += 1; continue
        f = {k: ln[s - 1:e].strip() for k, (s, e) in L.items()}
        if f["SEX"] not in ("1", "2"): fails["SEX"] += 1
        if not re.fullmatch(r"\d{8}", f["CSTRATM"]): fails["CSTRATM"] += 1
        if not re.fullmatch(r"\d{6}", f["CPSUM"]): fails["CPSUM"] += 1
        try:
            if float(f["PATWT"]) <= 0: fails["PATWT"] += 1
        except ValueError:
            fails["PATWT"] += 1
        if not (f["AGE"].isdigit() and 0 <= int(f["AGE"]) <= 99): fails["AGE"] += 1
        row = {"AGE": f["AGE"], "SEX": f["SEX"], "CSTRATM": f["CSTRATM"], "CPSUM": f["CPSUM"], "PATWT": f["PATWT"]}
        for i in range(1, 6):
            d, p = f[f"DIAG{i}"], f[f"PRDIAG{i}"]
            p = p.lstrip("0") or "0"          # the file zero-pads the flag: "01", "02"
            if p not in ("-7", "-9", "1", "2"): fails[f"PRDIAG{i}"] += 1
            if d in ("-9", ""):
                d = ""
            elif SPECIAL.match(d):
                d = ""                           # not a diagnosis; never matches a concept
            elif not (ICD9 if icd9 else ICD10).match(d):
                fails[f"DIAG{i}"] += 1
            if d: diag_codes += 1
            if d and p == "1": probable += 1
            row[f"DIAG{i}"] = d
            row[f"DIAG{i}_CONF"] = "" if p == "1" else d
        out_rows.append(row)

    n = len(out_rows)
    bad = {k: v for k, v in fails.items() if v}
    # A correct layout gives essentially zero failures; allow a tiny tolerance for
    # documented special values, refuse anything that looks like a shifted layout.
    if not n or any(v > max(5, n // 1000) for v in bad.values()):
        sys.exit(f"REFUSED: {n} records, field checks failed {bad}. The layout does not match this file; check namcs_layout.json against the {a.year} documentation.")

    cols = ["AGE", "SEX", "CSTRATM", "CPSUM", "PATWT"] + [c for i in range(1, 6) for c in (f"DIAG{i}", f"DIAG{i}_CONF")]
    with open(a.out, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader(); w.writerows(out_rows)
    out_sha = hashlib.sha256(open(a.out, "rb").read()).hexdigest()
    prov = {"preparedBy": "namcs_prepare.py 0.1.0", "preparedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "year": a.year, "source": os.path.basename(a.data), "sourceBytes": len(raw), "sourceSha256": sha,
            "layout": layout[a.year], "records": n, "fieldCheckFailures": bad,
            "diagnosisCodesRecorded": diag_codes, "diagnosesFlaggedProbable": probable,
            "output": os.path.basename(a.out), "outputSha256": out_sha}
    with open(os.path.splitext(a.out)[0] + ".provenance.json", "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2)
    print(f"{a.year}: {n} visits, field-check failures {bad or 'none'}, {diag_codes} diagnosis codes ({probable} flagged probable/rule-out), wrote {a.out}")


if __name__ == "__main__":
    main()
