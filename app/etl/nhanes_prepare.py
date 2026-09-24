#!/usr/bin/env python3
"""nhanes_prepare.py — merge one NHANES cycle's components into the CSV the ETL reads.

Standard library only: it runs on the project machine (Python 3.x, no packages) and
needs no R until the estimation step.

    python app/etl/nhanes_prepare.py --dir C:\\Healthcare_Data_Extract\\NHANES\\2001-2002 \\
        --out ./nhanes_2001_2002.csv

What it does, and does not, do
  - Reads every *.xpt in --dir as SAS XPORT version 5 (the format NHANES publishes),
    converting IBM 370 floating point to IEEE and SAS missing values to empty cells.
  - LEFT-joins every component onto the demographics component (DEMO*) by SEQN. DEMO
    carries the design variables and defines the sample; a respondent absent from a
    questionnaire component keeps empty cells on that component's items, which the
    ETL treats as missing, never as negative.
  - Refuses a file that is not a SAS XPORT file (a failed scrape once saved 28 CDC
    "Page Not Found" pages under .XPT names), a version-8 XPORT (NHANES does not
    publish those; long names would need different parsing), and a directory with no
    DEMO component.
  - Writes the merged CSV and a provenance JSON beside it: every component's name,
    size, SHA-256 and row count, plus the merged row count and the CSV's own SHA-256.
    The ETL hashes the CSV it reads; this JSON lets that hash be traced to CDC files.
  - Recodes nothing and derives nothing. The phenotype map and the ETL own that.
"""

import argparse
import csv
import datetime as dt
import hashlib
import json
import math
import os
import struct
import sys

LIB_HEADER = b"HEADER RECORD*******LIBRARY HEADER RECORD!!!!!!!"
MEMBER_HEADER = b"HEADER RECORD*******MEMBER  HEADER RECORD!!!!!!!"
NAMESTR_HEADER = b"HEADER RECORD*******NAMESTR HEADER RECORD!!!!!!!"
OBS_HEADER = b"HEADER RECORD*******OBS     HEADER RECORD!!!!!!!"
V8_MARKER = b"HEADER RECORD*******LIBV8   HEADER RECORD!!!!!!!"
REC = 80


def ibm_to_double(raw):
    """IBM 370 hexadecimal floating point (2..8 bytes) -> float, or None for SAS missing."""
    b = raw.ljust(8, b"\x00")
    if b[1:] == b"\x00" * 7 and b[0:1] in b"._ABCDEFGHIJKLMNOPQRSTUVWXYZ":
        return None                      # ., ._, .A ... .Z
    if b == b"\x00" * 8:
        return 0.0
    sign = -1.0 if b[0] & 0x80 else 1.0
    exponent = b[0] & 0x7F
    fraction = int.from_bytes(b[1:8], "big")
    if fraction == 0:
        return 0.0
    return sign * math.ldexp(fraction, 4 * (exponent - 64) - 56)


def read_xport(path):
    """Returns (member_name, columns, rows) for a single-member SAS XPORT v5 file."""
    with open(path, "rb") as f:
        data = f.read()
    if data[: len(LIB_HEADER)] != LIB_HEADER:
        if data[: len(V8_MARKER)] == V8_MARKER:
            raise ValueError(f"{os.path.basename(path)} is SAS XPORT version 8; NHANES publishes version 5")
        head = data[:200].lstrip().lower()
        kind = "an HTML page" if head.startswith((b"<!doctype", b"<html")) else "not a SAS XPORT file"
        raise ValueError(f"{os.path.basename(path)} is {kind}. Re-fetch it with nhanes_fetch.py, which verifies what it saves.")
    pos = 3 * REC                                            # library header + two real headers
    if data[pos: pos + len(MEMBER_HEADER)] != MEMBER_HEADER:
        raise ValueError(f"{os.path.basename(path)}: member header not where expected")
    namestr_len = int(data[pos + 74: pos + 78])              # 140 normally, 136 on VAX
    pos += REC                                               # member header
    pos += REC                                               # DSCRPTR header
    member_name = data[pos + 8: pos + 16].decode("latin-1").strip()
    pos += 2 * REC                                           # two member descriptor records
    if data[pos: pos + len(NAMESTR_HEADER)] != NAMESTR_HEADER:
        raise ValueError(f"{os.path.basename(path)}: NAMESTR header not where expected")
    nvars = int(data[pos + 54: pos + 58])
    pos += REC
    columns = []
    for i in range(nvars):
        ns = data[pos + i * namestr_len: pos + (i + 1) * namestr_len]
        ntype, _, nlng, _ = struct.unpack(">hhhh", ns[0:8])
        name = ns[8:16].decode("latin-1").strip()
        npos = struct.unpack(">i", ns[84:88])[0]
        columns.append((name, ntype, nlng, npos))
    pos += nvars * namestr_len
    if pos % REC:
        pos += REC - (pos % REC)                             # namestr block is padded to 80
    if data[pos: pos + len(OBS_HEADER)] != OBS_HEADER:
        raise ValueError(f"{os.path.basename(path)}: OBS header not where expected")
    pos += REC
    rec_len = sum(c[2] for c in columns)
    if rec_len <= 0:
        raise ValueError(f"{os.path.basename(path)}: zero-length observation record")
    rows = []
    blank = b" " * rec_len
    while pos + rec_len <= len(data):
        chunk = data[pos: pos + rec_len]
        if chunk == blank and len(data) - pos < REC:
            break                                            # trailing padding to the 80-byte boundary
        row = []
        for name, ntype, nlng, npos in columns:
            field = chunk[npos: npos + nlng]
            if ntype == 1:
                v = ibm_to_double(field)
                row.append("" if v is None else (str(int(v)) if v == int(v) and abs(v) < 1e15 else repr(v)))
            else:
                row.append(field.decode("latin-1").rstrip())
        rows.append(row)
        pos += rec_len
    return member_name, [c[0].upper() for c in columns], rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", required=True, help="folder holding one cycle's .xpt components")
    ap.add_argument("--out", required=True, help="merged CSV to write; a .provenance.json is written beside it")
    args = ap.parse_args()

    files = sorted(f for f in os.listdir(args.dir) if f.lower().endswith(".xpt"))
    if not files:
        sys.exit(f"No .xpt files in {args.dir}")

    components = {}
    provenance = []
    for name in files:
        path = os.path.join(args.dir, name)
        try:
            member, cols, rows = read_xport(path)
        except ValueError as e:
            sys.exit(f"REFUSED: {e}")
        if "SEQN" not in cols:
            sys.exit(f"REFUSED: {name} has no SEQN column and cannot be merged")
        key = os.path.splitext(name)[0].upper()
        components[key] = (cols, rows)
        with open(path, "rb") as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        provenance.append({"file": name, "member": member, "bytes": os.path.getsize(path), "sha256": digest,
                           "rows": len(rows), "columns": len(cols)})
        print(f"  read {key:<12} {len(rows):>6} rows  {len(cols):>4} cols")

    demo_keys = [k for k in components if k.startswith("DEMO") or k.startswith("P_DEMO")]
    if not demo_keys:
        sys.exit("REFUSED: no DEMO component; demographics carry the design variables and define the sample.")
    demo_key = demo_keys[0]

    cols, rows = components[demo_key]
    seqn_i = cols.index("SEQN")
    merged_cols = list(cols)
    merged = {r[seqn_i]: list(r) for r in rows}
    if len(merged) != len(rows):
        sys.exit(f"REFUSED: SEQN is not unique in {demo_key}")
    order = [r[seqn_i] for r in rows]

    for key in components:
        if key == demo_key:
            continue
        ccols, crows = components[key]
        ci = ccols.index("SEQN")
        keep = [(j, c) for j, c in enumerate(ccols) if c != "SEQN" and c not in merged_cols]   # first component wins
        merged_cols.extend(c for _, c in keep)
        by_seqn = {}
        for r in crows:
            if r[ci] in by_seqn:
                sys.exit(f"REFUSED: SEQN {r[ci]} repeats in {key}; that component has multiple rows per respondent and needs collapsing before use.")
            by_seqn[r[ci]] = r
        for seqn in order:
            r = by_seqn.get(seqn)
            merged[seqn].extend([r[j] if r else "" for j, _ in keep])
        print(f"  merged {key:<10} {sum(1 for s in order if s in by_seqn):>6} of {len(order)} DEMO respondents matched")

    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(merged_cols)
        for seqn in order:
            w.writerow(merged[seqn])
    with open(args.out, "rb") as f:
        out_hash = hashlib.sha256(f.read()).hexdigest()

    prov = {"preparedBy": "nhanes_prepare.py 0.1.0",
            "preparedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "directory": os.path.abspath(args.dir), "demographicsComponent": demo_key,
            "components": provenance, "mergedRows": len(order), "mergedColumns": len(merged_cols),
            "output": os.path.basename(args.out), "outputSha256": out_hash}
    prov_path = os.path.splitext(args.out)[0] + ".provenance.json"
    with open(prov_path, "w", encoding="utf-8") as f:
        json.dump(prov, f, indent=2)
    print(f"wrote {args.out} ({len(order)} rows, {len(merged_cols)} columns) and {os.path.basename(prov_path)}")


if __name__ == "__main__":
    main()
