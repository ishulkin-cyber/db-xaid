"""
enrich_pairs_metadata.py — Fetch missing doctor_id, doctor_name, exam_date for ungraded pairs.

Reuses MCPSSEClient from fetch_missing_pairs.py.
"""

from __future__ import annotations

import asyncio
import sys
import json
from pathlib import Path

# Reuse the working MCP client from fetch_missing_pairs
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_missing_pairs import MCPSSEClient, parse_result_text

try:
    import aiohttp
except ImportError:
    print("ERROR: pip install aiohttp")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
PAIRS_FILE = BASE_DIR / "data" / "doctor_validator_pairs.json"
FINDINGS_FILE = BASE_DIR / "data" / "dv_findings.json"

MCP_SSE_URL = "https://api.platform.xaidos.com/mcp/database/sse"
MCP_AUTH = "Basic bWFuYWdlcjpwcmVwYXJlLWFtYmllbnQtc2FuZHJh"


async def main():
    with open(PAIRS_FILE) as f:
        pairs = json.load(f)
    with open(FINDINGS_FILE) as f:
        findings = json.load(f)

    graded = set(d["accession_number"] for d in findings)
    ungraded = [p for p in pairs if str(p["accession_number"]) not in graded]
    print(f"Total pairs: {len(pairs)} | Graded: {len(graded)} | Ungraded: {len(ungraded)}")

    need_meta = [p for p in ungraded if not p.get("doctor_id") or not p.get("exam_date")]
    print(f"Need metadata: {len(need_meta)}")

    if not need_meta:
        print("Nothing to enrich.")
        return

    accessions = [str(p["accession_number"]) for p in need_meta]
    acc_list = ", ".join(f"'{a}'" for a in accessions)

    sql = f"""
        SELECT
            s.accession_number,
            s.study_datetime::date::text AS exam_date,
            t.reporting_radiologist_id AS doctor_id,
            CONCAT(u_doc.first_name, ' ', u_doc.last_name) AS doctor_name
        FROM studies s
        JOIN tasks t ON t.study_id = s.id
        LEFT JOIN users u_doc ON u_doc.id = t.reporting_radiologist_id
        WHERE s.accession_number IN ({acc_list})
          AND t.validating_radiologist_id IS NOT NULL
        ORDER BY s.accession_number
    """

    print("Connecting to MCP...")
    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        client = MCPSSEClient(session)
        await client.connect()

        print("Querying metadata...")
        rows = await client.execute_sql(sql, timeout=30)
        print(f"Got {len(rows)} rows")

    # build lookup
    meta = {}
    for row in rows:
        acc = str(row.get("accession_number", ""))
        meta[acc] = {
            "doctor_id": row.get("doctor_id"),
            "doctor_name": row.get("doctor_name"),
            "exam_date": str(row.get("exam_date", ""))[:10] if row.get("exam_date") else None,
        }

    # update pairs in place
    updated = 0
    for p in pairs:
        acc = str(p["accession_number"])
        if acc not in meta:
            continue
        m = meta[acc]
        changed = False
        if not p.get("doctor_id") and m["doctor_id"]:
            p["doctor_id"] = m["doctor_id"]
            changed = True
        if not p.get("doctor_name") and m["doctor_name"]:
            p["doctor_name"] = m["doctor_name"]
            changed = True
        if not p.get("exam_date") and m["exam_date"]:
            p["exam_date"] = m["exam_date"]
            changed = True
        if changed:
            updated += 1

    with open(PAIRS_FILE, "w") as f:
        json.dump(pairs, f, ensure_ascii=False, indent=2)

    print(f"Updated {updated} pairs → saved to {PAIRS_FILE}")

    still_missing = [p for p in pairs if str(p["accession_number"]) in set(accessions)
                     and (not p.get("doctor_id") or not p.get("exam_date"))]
    if still_missing:
        print(f"Still missing metadata for {len(still_missing)} pairs:")
        for p in still_missing[:10]:
            print(f"  ACC {p['accession_number']} | doctor_id={p.get('doctor_id')} | exam_date={p.get('exam_date')}")
    else:
        print("All pairs now have metadata.")


if __name__ == "__main__":
    asyncio.run(main())
