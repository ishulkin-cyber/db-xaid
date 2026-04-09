#!/usr/bin/env python3
"""
fetch_missing_pairs.py — Fetch missing doctor-validator pairs from DB via MCP (SSE).

MCP protocol:
  1. GET /sse → keep SSE stream open, read 'endpoint' event to get messages URL
  2. POST initialize → response via SSE
  3. POST notifications/initialized
  4. POST tools/call execute_sql → response via SSE
  5. Parse: text field may be Python repr with datetime.date → use ast.literal_eval

Usage:
    python3 analysis/fetch_missing_pairs.py
"""

from __future__ import annotations

import asyncio
import ast
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Optional

try:
    import aiohttp
except ImportError:
    print("ERROR: pip install aiohttp")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
PAIRS_FILE = BASE_DIR / "data" / "doctor_validator_pairs.json"

MCP_SSE_URL = "https://api.platform.xaidos.com/mcp/database/sse"
MCP_AUTH = "Basic bWFuYWdlcjpwcmVwYXJlLWFtYmllbnQtc2FuZHJh"


def parse_result_text(text: str) -> list:
    """Parse MCP result text — JSON or Python repr with datetime.date objects."""
    text = text.strip()
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        pass
    # Fix Python repr datetime.date(Y, M, D) → 'YYYY-MM-DD'
    text2 = re.sub(
        r"datetime\.date\((\d+),\s*(\d+),\s*(\d+)\)",
        lambda m: f"'{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}'",
        text,
    )
    try:
        parsed = ast.literal_eval(text2)
        if isinstance(parsed, (list, dict)):
            return parsed if isinstance(parsed, list) else [parsed]
    except Exception as e:
        print(f"  ast.literal_eval failed: {e}")
        print(f"  Text preview: {text[:300]}")
    return []


class MCPSSEClient:
    """MCP client that keeps SSE stream open and sends requests via POST."""

    def __init__(self, session: aiohttp.ClientSession):
        self.session = session
        self.messages_url: Optional[str] = None
        self._pending: dict[str, asyncio.Future] = {}
        self._sse_ready = asyncio.Event()
        self._sse_resp: Optional[aiohttp.ClientResponse] = None

    async def _sse_listener(self):
        """Background task: read SSE stream and fulfill pending futures.
        Uses readany() to avoid LineTooLong with large JSON payloads.
        """
        headers = {
            "Authorization": MCP_AUTH,
            "Accept": "text/event-stream",
        }
        async with self.session.get(MCP_SSE_URL, headers=headers) as resp:
            resp.raise_for_status()
            event_type = None
            buf = b""
            while True:
                chunk = await resp.content.readany()
                if not chunk:
                    break
                buf += chunk
                # Process complete lines from buffer
                while b"\n" in buf:
                    raw_line, buf = buf.split(b"\n", 1)
                    line = raw_line.decode("utf-8").rstrip("\r")

                    if line.startswith("event:"):
                        event_type = line[6:].strip()
                    elif line.startswith("data:"):
                        data = line[5:].strip()
                        if event_type == "endpoint" or (self.messages_url is None and data.startswith("/")):
                            self.messages_url = data
                            if self.messages_url.startswith("/"):
                                base = MCP_SSE_URL.split("/mcp")[0]
                                self.messages_url = base + self.messages_url
                            print(f"SSE endpoint: {self.messages_url}")
                            self._sse_ready.set()
                        else:
                            try:
                                msg = json.loads(data)
                                msg_id = str(msg.get("id", ""))
                                if msg_id in self._pending:
                                    self._pending[msg_id].set_result(msg)
                            except json.JSONDecodeError:
                                pass
                        event_type = None
                    elif line == "":
                        event_type = None

    async def connect(self):
        """Start SSE listener and wait for endpoint, then initialize."""
        # Start SSE listener as background task
        asyncio.create_task(self._sse_listener())

        # Wait for endpoint URL
        await asyncio.wait_for(self._sse_ready.wait(), timeout=15)

        # Initialize
        init_id = str(uuid.uuid4())
        fut = asyncio.get_event_loop().create_future()
        self._pending[init_id] = fut
        await self._post_raw({
            "jsonrpc": "2.0",
            "id": init_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "xaid-extractor", "version": "1.0"},
            },
        })
        try:
            await asyncio.wait_for(fut, timeout=15)
            print("Initialize OK")
        except asyncio.TimeoutError:
            print("Initialize timed out — continuing anyway")
        finally:
            self._pending.pop(init_id, None)

        # Notify initialized (no response expected)
        await self._post_raw({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {},
        })
        print("MCP handshake done.")

    async def _post_raw(self, payload: dict) -> Optional[aiohttp.ClientResponse]:
        """POST JSON-RPC payload to messages URL."""
        resp = await self.session.post(
            self.messages_url,
            json=payload,
            headers={"Authorization": MCP_AUTH, "Content-Type": "application/json"},
            timeout=aiohttp.ClientTimeout(total=30),
        )
        if resp.status not in (200, 202, 204):
            text = await resp.text()
            print(f"POST HTTP {resp.status}: {text[:200]}")
        return resp

    async def execute_sql(self, sql: str, timeout: float = 60.0) -> list:
        """Execute SQL and return rows as list of dicts."""
        req_id = str(uuid.uuid4())
        fut = asyncio.get_event_loop().create_future()
        self._pending[req_id] = fut

        await self._post_raw({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {
                "name": "execute_sql",
                "arguments": {"sql": sql},
            },
        })

        try:
            result = await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            print(f"  SQL timed out after {timeout}s")
            return []
        finally:
            self._pending.pop(req_id, None)

        # Navigate result structure
        if "error" in result:
            print(f"  SQL error: {result['error']}")
            return []

        inner = result.get("result", result)
        if isinstance(inner, dict) and "content" in inner:
            for item in inner["content"]:
                if item.get("type") == "text":
                    parsed = parse_result_text(item["text"])
                    if isinstance(parsed, list):
                        return parsed
        if isinstance(inner, list):
            return inner
        return []


async def main():
    current = json.loads(PAIRS_FILE.read_text())
    current_accs = {str(p["accession_number"]) for p in current}
    print(f"Current pairs: {len(current_accs)}")

    connector = aiohttp.TCPConnector(ssl=False)
    async with aiohttp.ClientSession(connector=connector) as session:
        mcp = MCPSSEClient(session)
        await mcp.connect()

        # Step 1: Get all validated study accession numbers from DB
        print("\nQuerying all validated studies...")
        rows = await mcp.execute_sql("""
            SELECT
                s.accession_number,
                s.study_datetime::date::text AS exam_date,
                s.description AS exam_description,
                s.patient_age,
                s.patient_sex,
                t.id AS task_id,
                t.reporting_radiologist_id AS doctor_id,
                u_doc.first_name || ' ' || u_doc.last_name AS doctor_name
            FROM studies s
            JOIN tasks t ON t.study_id = s.id
            JOIN reports r_doc
                ON r_doc.task_id = t.id
                AND r_doc.author_id = t.reporting_radiologist_id
            JOIN reports r_val
                ON r_val.task_id = t.id
                AND r_val.author_id = t.validating_radiologist_id
            LEFT JOIN users u_doc ON u_doc.id = t.reporting_radiologist_id
            WHERE
                t.validating_radiologist_id IS NOT NULL
                AND r_doc.findings_en IS NOT NULL
                AND r_val.findings_en IS NOT NULL
                AND r_doc.findings_en != ''
                AND r_val.findings_en != ''
            ORDER BY s.study_datetime DESC
        """, timeout=90)

        print(f"DB has {len(rows)} validated studies")
        if rows:
            print(f"Sample row keys: {list(rows[0].keys())}")

        # Step 2: Find missing
        db_accs = {str(r.get("accession_number", "")) for r in rows}
        missing_accs = db_accs - current_accs - {""}
        print(f"Missing from our file: {len(missing_accs)}")

        if not missing_accs:
            print("Nothing to fetch — all pairs already present!")
            return

        # Build task_id lookup for missing
        missing_rows = [r for r in rows if str(r.get("accession_number", "")) in missing_accs]
        print(f"Will fetch full reports for {len(missing_rows)} studies")

        # Step 3: Fetch full reports in batches of 10
        new_pairs = []
        batch_size = 10
        batches = [missing_rows[i:i+batch_size] for i in range(0, len(missing_rows), batch_size)]

        for batch_idx, batch in enumerate(batches):
            task_ids = [str(r["task_id"]) for r in batch]
            print(f"\nBatch {batch_idx+1}/{len(batches)}: {len(task_ids)} studies")

            ids_str = ", ".join(task_ids)
            results = await mcp.execute_sql(f"""
                SELECT
                    s.accession_number,
                    s.study_datetime::date::text AS exam_date,
                    s.description AS exam_description,
                    s.patient_age,
                    s.patient_sex,
                    t.id AS task_id,
                    t.reporting_radiologist_id AS doctor_id,
                    u_doc.first_name || ' ' || u_doc.last_name AS doctor_name,
                    r_doc.findings_en AS doc_findings,
                    r_doc.impression_en AS doc_impression,
                    r_val.findings_en AS val_findings,
                    r_val.impression_en AS val_impression,
                    r_val.protocol_en AS val_protocol
                FROM tasks t
                JOIN studies s ON s.id = t.study_id
                JOIN reports r_doc
                    ON r_doc.task_id = t.id
                    AND r_doc.author_id = t.reporting_radiologist_id
                JOIN reports r_val
                    ON r_val.task_id = t.id
                    AND r_val.author_id = t.validating_radiologist_id
                LEFT JOIN users u_doc ON u_doc.id = t.reporting_radiologist_id
                WHERE t.id IN ({ids_str})
            """)
            print(f"  Got {len(results)} rows")

            for r in results:
                acc = str(r.get("accession_number", ""))
                if not acc or acc in current_accs:
                    continue
                new_pairs.append({
                    "accession_number": acc,
                    "doctor_id": int(r.get("doctor_id", 0) or 0),
                    "doctor_name": str(r.get("doctor_name", "") or ""),
                    "doc_findings": str(r.get("doc_findings", "") or ""),
                    "doc_impression": str(r.get("doc_impression", "") or ""),
                    "val_findings": str(r.get("val_findings", "") or ""),
                    "val_impression": str(r.get("val_impression", "") or ""),
                    "val_protocol": str(r.get("val_protocol", "") or ""),
                    "exam_date": str(r.get("exam_date", "") or ""),
                    "exam_description": str(r.get("exam_description", "") or ""),
                    "patient_age": r.get("patient_age"),
                    "patient_sex": str(r.get("patient_sex", "") or ""),
                    "doc_findings_en": "",
                    "doc_impression_en": "",
                })

            await asyncio.sleep(0.3)

        print(f"\nSuccessfully fetched: {len(new_pairs)} new pairs")

        if not new_pairs:
            print("No new pairs fetched — check logs above for errors.")
            return

        # Step 4: Merge and save
        merged = current + new_pairs
        merged.sort(key=lambda p: p.get("exam_date", ""), reverse=True)

        PAIRS_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
        print(f"\nSaved {len(merged)} pairs to {PAIRS_FILE}")
        print(f"Added {len(new_pairs)} new pairs:")
        for p in new_pairs[:10]:
            print(f"  {p['accession_number']} | {p['exam_date']} | {p['doctor_name']}")
        if len(new_pairs) > 10:
            print(f"  ... and {len(new_pairs) - 10} more")


if __name__ == "__main__":
    asyncio.run(main())
