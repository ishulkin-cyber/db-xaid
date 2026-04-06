"""
extract_from_db.py — Extract doctor-validator report pairs from prod DB via MCP

Usage:
    python3 extract_from_db.py

Output:
    analysis/data/doctor_validator_pairs.json

The script connects to the production database MCP server using SSE protocol
and queries the studies/tasks/reports tables to extract matched pairs of
doctor (initial report) and validator (reviewed report) for all studies
where both versions exist and are in English.

Requirements:
    pip install requests sseclient-py

MCP endpoint: https://api.platform.xaidos.com/mcp/database/sse
Auth: Basic bWFuYWdlcjpwcmVwYXJlLWFtYmllbnQtc2FuZHJh
"""

import json
import sys
import time
import uuid
from pathlib import Path

try:
    import requests
    import sseclient
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install requests sseclient-py")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
OUT_FILE = BASE_DIR / "data" / "doctor_validator_pairs.json"

MCP_SSE_URL = "https://api.platform.xaidos.com/mcp/database/sse"
MCP_AUTH = "Basic bWFuYWdlcjpwcmVwYXJlLWFtYmllbnQtc2FuZHJh"

HEADERS = {
    "Authorization": MCP_AUTH,
    "Accept": "text/event-stream",
    "Content-Type": "application/json",
}

# SQL query to extract doctor-validator pairs for all studies
# - doctor report: author_id = reporting_radiologist_id, version = 1 (initial)
# - validator report: author_id = validating_radiologist_id (the reviewer's version)
EXTRACT_SQL = """
SELECT
    s.accession_number,
    s.exam_date::text AS exam_date,
    s.description AS exam_description,
    s.patient_age,
    s.patient_sex,
    t.reporting_radiologist_id AS doctor_id,
    u_doc.full_name AS doctor_name,
    r_doc.findings_en AS doc_findings,
    r_doc.impression_en AS doc_impression,
    r_val.findings_en AS val_findings,
    r_val.impression_en AS val_impression,
    r_val.protocol_en AS val_protocol
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
ORDER BY s.exam_date DESC
LIMIT 1000
"""


class MCPClient:
    """Minimal synchronous MCP client over HTTP+SSE."""

    def __init__(self, sse_url: str, auth: str):
        self.sse_url = sse_url
        self.auth = auth
        self.session_id: str | None = None
        self.messages_url: str | None = None

    def connect(self) -> bool:
        """Establish SSE connection and capture session endpoint."""
        print("Connecting to MCP server...")
        try:
            response = requests.get(
                self.sse_url,
                headers={"Authorization": self.auth, "Accept": "text/event-stream"},
                stream=True,
                timeout=30,
            )
            response.raise_for_status()
            client = sseclient.SSEClient(response)

            # The first event from the server gives us the messages endpoint
            for event in client.events():
                if event.event == "endpoint":
                    self.messages_url = event.data.strip()
                    print(f"Got messages endpoint: {self.messages_url}")
                    return True
                elif event.data:
                    # Try to parse as JSON to get endpoint
                    try:
                        data = json.loads(event.data)
                        if "endpoint" in data:
                            self.messages_url = data["endpoint"]
                            return True
                    except json.JSONDecodeError:
                        pass
                # Only read first event
                break
        except Exception as e:
            print(f"ERROR connecting: {e}")
        return False

    def call_tool(self, tool_name: str, arguments: dict) -> dict | None:
        """Send a tool call and wait for response."""
        if not self.messages_url:
            print("ERROR: Not connected to MCP server")
            return None

        request_id = str(uuid.uuid4())
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments,
            },
        }

        # For SSE-based MCP we need to POST and receive response via SSE
        # Some MCP servers support a simpler synchronous HTTP endpoint too
        # Try the POST-based approach first
        base_url = self.sse_url.replace("/sse", "")
        post_url = f"{base_url}/messages"
        if self.messages_url:
            post_url = self.messages_url

        try:
            resp = requests.post(
                post_url,
                json=payload,
                headers={"Authorization": self.auth, "Content-Type": "application/json"},
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                if "result" in data:
                    return data["result"]
                elif "error" in data:
                    print(f"MCP error: {data['error']}")
            else:
                print(f"HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"ERROR calling tool: {e}")
        return None


def execute_sql_via_mcp(sql: str) -> list[dict]:
    """Execute SQL and return rows as list of dicts."""
    client = MCPClient(MCP_SSE_URL, MCP_AUTH)

    # Try direct HTTP approach (simpler, works if server supports it)
    # MCP tools/call over HTTP
    request_id = str(uuid.uuid4())
    payload = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/call",
        "params": {
            "name": "execute_sql",
            "arguments": {"query": sql},
        },
    }

    # Try multiple endpoint patterns
    endpoints = [
        MCP_SSE_URL.replace("/sse", "/messages"),
        MCP_SSE_URL.replace("/sse", ""),
        MCP_SSE_URL,
    ]

    for url in endpoints:
        try:
            print(f"Trying endpoint: {url}")
            resp = requests.post(
                url,
                json=payload,
                headers={
                    "Authorization": MCP_AUTH,
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                timeout=60,
            )
            if resp.status_code == 200:
                data = resp.json()
                if "result" in data:
                    result = data["result"]
                    # Parse the content from MCP tool result
                    if isinstance(result, dict) and "content" in result:
                        for item in result["content"]:
                            if item.get("type") == "text":
                                return json.loads(item["text"])
                    elif isinstance(result, list):
                        return result
                    elif isinstance(result, dict) and "rows" in result:
                        return result["rows"]
                print(f"Unexpected result format: {str(data)[:200]}")
            else:
                print(f"HTTP {resp.status_code}: {resp.text[:100]}")
        except Exception as e:
            print(f"  Error: {e}")

    return []


def normalize_row(row: dict) -> dict:
    """Normalize a database row to match our expected schema."""
    return {
        "accession_number": str(row.get("accession_number", "")),
        "doctor_id": int(row.get("doctor_id", 0)),
        "doctor_name": row.get("doctor_name", ""),
        "doc_findings": row.get("doc_findings", "") or "",
        "doc_impression": row.get("doc_impression", "") or "",
        "val_findings": row.get("val_findings", "") or "",
        "val_impression": row.get("val_impression", "") or "",
        "val_protocol": row.get("val_protocol", "") or "",
        "exam_date": row.get("exam_date", ""),
        "exam_description": row.get("exam_description", ""),
        "patient_age": row.get("patient_age"),
        "patient_sex": row.get("patient_sex", ""),
    }


def main():
    print("=" * 60)
    print("xAID Internal QA — Extract Doctor-Validator Pairs from DB")
    print("=" * 60)
    print()

    print(f"Running SQL query against production database...")
    rows = execute_sql_via_mcp(EXTRACT_SQL)

    if not rows:
        print()
        print("WARNING: No data returned from database.")
        print("Possible reasons:")
        print("  1. MCP server is not reachable (check VPN/network)")
        print("  2. Authentication failed")
        print("  3. No doctor-validator pairs exist matching the query")
        print()
        print("The existing seed data in analysis/data/ will be used.")
        sys.exit(1)

    print(f"Retrieved {len(rows)} study pairs from database.")

    pairs = [normalize_row(r) for r in rows]

    # Filter out pairs with empty reports
    pairs = [
        p for p in pairs
        if p["doc_findings"].strip() and p["val_findings"].strip()
    ]
    print(f"Valid pairs (non-empty reports): {len(pairs)}")

    # Save
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(pairs, indent=2, ensure_ascii=False))
    print(f"\nSaved to: {OUT_FILE}")
    print(f"\nNext step: run analyze_reports.py to generate RADPEER graded findings.")


if __name__ == "__main__":
    main()
