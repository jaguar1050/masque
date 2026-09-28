#!/usr/bin/env python3
"""meps_prepare.py — build the person-level CSV the MASQUE ETL reads from one MEPS year.

Needs pyreadstat to read the SAS V9 (.sas7bdat) public-use files:  pip install pyreadstat

    python app/etl/meps_prepare.py --year 2019 --map app/etl/phenotype_map_meps_2019_sinus.json \
        --fyc h216.sas7bdat --cond h214.sas7bdat --clnk h213if1.sas7bdat \
        --ob h213g.sas7bdat --op h213f.sas7bdat --er h213e.sas7bdat --ip h213d.sas7bdat --rx h213a.sas7bdat \
        --out meps_2019.csv

One row per person on the Full-Year Consolidated file, with:
  DUPERSID, SEX, AGELAST, PERWT (PERWTyyF), VARSTR, VARPSU, TOTEXP (TOTEXPyy),
  CONDS  — the person's condition codes (ICD10CDX, 3 characters on the public file) joined by '|';
  COST_<concept> — for each concept the map lists under `costConcepts`: the sum of expenditures
           (all payers) of every distinct event linked to any of the person's conditions whose code
           starts with one of that concept's prefixes, over office-based, outpatient, emergency,
           inpatient and prescribed-medicine events. Links come from the Condition-Event Link file;
           prescribed medicines link through LINKIDX.

Attribution is deliberately simple and stated in the artifact: an event linked to the concept is
counted in full even when it is also linked to other conditions, so COST_ is an upper bound on
spending for that concept. Home health events are not included (file not supplied). The concept
code prefixes are read from the map, so the definition lives in one place.
"""
import argparse, datetime as dt, hashlib, json, os, sys
import pyreadstat

EVENT_FILES = {"ob": ("OBXP{yy}X", 1), "op": ("OPXP{yy}X", 2), "er": ("ERXP{yy}X", 3), "ip": ("IPXP{yy}X", 4)}


def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for k in ("year", "map", "fyc", "cond", "clnk", "ob", "op", "er", "ip", "rx", "out"):
        ap.add_argument(f"--{k}", required=True)
    a = ap.parse_args()
    yy = a.year[2:]
    mp = json.load(open(a.map, encoding="utf-8"))
    concepts = {k: v for k, v in mp["phenotype_concepts"].items() if isinstance(v, dict)}
    cost_concepts = mp.get("costConcepts", [])
    for c in cost_concepts:
        if c not in concepts or not concepts[c].get("positivePrefixes"):
            sys.exit(f"REFUSED: costConcepts lists {c}, which has no positivePrefixes in the map")

    wt, xp_tot = f"PERWT{yy}F", f"TOTEXP{yy}"
    fyc, _ = pyreadstat.read_sas7bdat(a.fyc, usecols=["DUPERSID", "SEX", "AGELAST", wt, "VARSTR", "VARPSU", xp_tot])
    cond, _ = pyreadstat.read_sas7bdat(a.cond, usecols=["DUPERSID", "CONDIDX", "ICD10CDX"])
    clnk, _ = pyreadstat.read_sas7bdat(a.clnk, usecols=["CONDIDX", "EVNTIDX", "EVENTYPE"])

    codes = cond.groupby("DUPERSID")["ICD10CDX"].apply(lambda s: "|".join(sorted(set(x for x in s if isinstance(x, str) and x[:1].isalpha()))))

    # event expenditures keyed by EVNTIDX
    exp = {}
    for key, (var, _) in EVENT_FILES.items():
        v = var.format(yy=yy)
        ev, _ = pyreadstat.read_sas7bdat(getattr(a, key), usecols=["EVNTIDX", v])
        exp.update(dict(zip(ev["EVNTIDX"], ev[v].clip(lower=0))))
    rx, _ = pyreadstat.read_sas7bdat(a.rx, usecols=["LINKIDX", f"RXXP{yy}X"])
    exp.update(rx.groupby("LINKIDX")[f"RXXP{yy}X"].sum().clip(lower=0).to_dict())

    cond_person = dict(zip(cond["CONDIDX"], cond["DUPERSID"]))
    cond_code = dict(zip(cond["CONDIDX"], cond["ICD10CDX"]))
    out_cols = {}
    unlinked = {}
    for c in cost_concepts:
        pre = tuple(concepts[c]["positivePrefixes"])
        cidx = {k for k, code in cond_code.items() if isinstance(code, str) and code.startswith(pre)}
        links = clnk[clnk["CONDIDX"].isin(cidx)].copy()
        links["DUPERSID"] = links["CONDIDX"].map(cond_person)
        links = links.drop_duplicates(["DUPERSID", "EVNTIDX"])          # an event counts once per person
        links["EXP"] = links["EVNTIDX"].map(exp)
        unlinked[c] = {"linkedEvents": int(len(links)), "eventsWithoutExpenditureRecord": int(links["EXP"].isna().sum()),
                       "byEventType": {str(int(k)): int(v) for k, v in links["EVENTYPE"].value_counts().items()}}
        out_cols[f"COST_{c.upper()}"] = links.groupby("DUPERSID")["EXP"].sum(min_count=1)

    df = fyc.rename(columns={wt: "PERWT", xp_tot: "TOTEXP"})
    df["CONDS"] = df["DUPERSID"].map(codes).fillna("")
    for col, s in out_cols.items():
        df[col] = df["DUPERSID"].map(s).fillna(0.0)      # no linked event = zero spending on that concept
    df.to_csv(a.out, index=False)
    prov = {"preparedBy": "meps_prepare.py 0.1.0", "preparedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "year": a.year, "map": os.path.basename(a.map), "costConcepts": cost_concepts, "links": unlinked,
            "inputs": {k: {"file": os.path.basename(getattr(a, k)), "sha256": sha(getattr(a, k))} for k in ("fyc", "cond", "clnk", "ob", "op", "er", "ip", "rx")},
            "persons": int(len(df)), "personsWithPositiveWeight": int((df["PERWT"] > 0).sum()),
            "output": os.path.basename(a.out), "outputSha256": sha(a.out)}
    with open(os.path.splitext(a.out)[0] + ".provenance.json", "w", encoding="utf-8") as fh:
        json.dump(prov, fh, indent=2)
    print(f"{a.year}: {len(df)} persons ({prov['personsWithPositiveWeight']} with positive weight); cost links {unlinked}; wrote {a.out}")


if __name__ == "__main__":
    main()
