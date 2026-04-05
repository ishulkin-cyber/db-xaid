"""
analyze_reports.py — Run RADPEER analysis on doctor-validator report pairs

Usage:
    python3 analyze_reports.py [--limit N] [--doctor-id ID]

    --limit N       Process only first N studies (useful for testing)
    --doctor-id ID  Process only studies for this doctor_id

Input:
    analysis/data/doctor_validator_pairs.json

Output:
    analysis/data/dv_findings.json

RADPEER Grading:
    Grade 1  — Concordant (same clinical meaning)
    Grade 2a — Minor Stylistic (wording only, no clinical change)
    Grade 2b — Minor Clinical (finding added/modified, no management change)
    Grade 3  — Significant Underreport (missed finding that changes management)
    Grade 4  — Significant Overreport (false finding causing unnecessary workup)

Requirements:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("ERROR: Missing anthropic. Run: pip install anthropic")
    sys.exit(1)

BASE_DIR = Path(__file__).resolve().parent
PAIRS_FILE = BASE_DIR / "data" / "doctor_validator_pairs.json"
FINDINGS_FILE = BASE_DIR / "data" / "dv_findings.json"

RADPEER_PROMPT = """You are a senior radiologist performing quality assurance (QA) using the RADPEER methodology.

Compare the DOCTOR'S report (Report A) against the VALIDATOR'S report (Report B) at the finding level.

## Step 1 — Extract findings from each report separately

Break each report into atomic findings. A finding is any discrete observation: nodule, effusion, calcification, explicitly noted normal structure, recommendation, etc. Include Findings and Impression sections. Skip Indication/Technique.

## Step 2 — Map findings (chain-of-thought)

List findings from each report as numbered lists, then explicitly map each to its counterpart:
- A1 ↔ B2 — matched
- A3 ↔ (none) — only in A (potential overreport)
- (none) ↔ B4 — only in B (potential underreport)

Complete this mapping BEFORE assigning any grades.

## Step 3 — Grade each finding pair

| Grade | Definition |
|-------|------------|
| 1 | Concordant — same clinical meaning |
| 2a | Minor Stylistic — different wording only, identical clinical content |
| 2b | Minor Clinical — finding added/modified, does NOT change management |
| 3 | Significant Underreport — missed/downgraded finding that WOULD change management |
| 4 | Significant Overreport — false/overcalled finding that would cause unnecessary workup |

Rules:
- Normal findings explicitly stated in one but absent in the other = grade 2a (not underreport), unless clinically meaningful
- Recommendations (e.g., "follow-up CT in 3 months") are findings — grade them
- When uncertain about management impact, err toward the more severe grade

## Input

Doctor's report (Report A):
FINDINGS: {doc_findings}
IMPRESSION: {doc_impression}

Validator's report (Report B):
FINDINGS: {val_findings}
IMPRESSION: {val_impression}

## Output

Do your chain-of-thought reasoning first (Step 1 & 2), then output a JSON array.

The JSON array must be the LAST thing in your response. Each element:
{{
  "finding_category": "e.g. Pulmonary nodule, Pleural effusion, Lymphadenopathy",
  "anatomical_location": "e.g. Right lower lobe, Mediastinum, Bilateral",
  "in_doctor_report": true/false,
  "in_validator_report": true/false,
  "doctor_description": "exact text from doctor or empty string",
  "validator_description": "exact text from validator or empty string",
  "discrepancy_type": "concordant|stylistic|underreport|overreport",
  "grade": "1|2a|2b|3|4",
  "management_impact": "None|Low|Medium|High",
  "notes": "one-line clinical explanation"
}}"""


def analyze_pair(
    client: anthropic.Anthropic,
    accession: str,
    doctor_id: int,
    doctor_name: str,
    doc_findings: str,
    doc_impression: str,
    val_findings: str,
    val_impression: str,
    exam_date: str = "",
) -> list[dict]:
    """Run RADPEER analysis for one study pair. Returns list of finding dicts."""
    prompt = RADPEER_PROMPT.format(
        doc_findings=doc_findings or "(empty)",
        doc_impression=doc_impression or "(empty)",
        val_findings=val_findings or "(empty)",
        val_impression=val_impression or "(empty)",
    )

    for attempt in range(3):
        try:
            response = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=8192,
                messages=[{"role": "user", "content": prompt}],
            )
            text = response.content[0].text.strip()

            # The prompt uses chain-of-thought before the JSON array.
            # Extract the last JSON array in the response.
            import re as _re
            # Find the last [...] block (possibly multiline)
            json_matches = list(_re.finditer(r'\[[\s\S]*?\]', text))
            if json_matches:
                text = json_matches[-1].group(0)
            elif "```" in text:
                # Strip markdown code block
                lines = text.split("\n")
                start = next((i for i, l in enumerate(lines) if l.strip().startswith("```")), 0) + 1
                end = next((i for i in range(len(lines) - 1, 0, -1) if lines[i].strip() == "```"), len(lines))
                text = "\n".join(lines[start:end])

            findings_raw = json.loads(text)
            if not isinstance(findings_raw, list):
                raise ValueError("Expected JSON array")

            # Add metadata to each finding
            findings = []
            for f in findings_raw:
                if not isinstance(f, dict):
                    continue
                findings.append({
                    "accession_number": accession,
                    "doctor_id": doctor_id,
                    "doctor_name": doctor_name,
                    "exam_date": exam_date,
                    "finding_category": f.get("finding_category", ""),
                    "anatomical_location": f.get("anatomical_location", ""),
                    "in_doctor_report": f.get("in_doctor_report", False),
                    "in_validator_report": f.get("in_validator_report", False),
                    "doctor_description": f.get("doctor_description", ""),
                    "validator_description": f.get("validator_description", ""),
                    "discrepancy_type": f.get("discrepancy_type", "concordant"),
                    "grade": f.get("grade", "1"),
                    "management_impact": f.get("management_impact", "None"),
                    "notes": f.get("notes", ""),
                })
            return findings

        except (json.JSONDecodeError, ValueError) as e:
            print(f"    Parse error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(2)
        except anthropic.RateLimitError:
            print(f"    Rate limit hit, waiting 30s...")
            time.sleep(30)
        except Exception as e:
            print(f"    Error (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                time.sleep(5)

    print(f"    FAILED after 3 attempts, skipping {accession}")
    return []


def main():
    parser = argparse.ArgumentParser(description="Analyze doctor-validator pairs with RADPEER grading")
    parser.add_argument("--limit", type=int, default=None, help="Process only first N studies")
    parser.add_argument("--doctor-id", type=int, default=None, help="Process only this doctor_id")
    parser.add_argument("--skip-existing", action="store_true", default=True,
                        help="Skip accessions already in dv_findings.json (default: True)")
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set")
        print("Run: export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    if not PAIRS_FILE.exists():
        print(f"ERROR: {PAIRS_FILE} not found. Run extract_from_db.py first.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    print("=" * 60)
    print("xAID Internal QA — RADPEER Analysis")
    print("=" * 60)

    pairs = json.loads(PAIRS_FILE.read_text())
    print(f"Loaded {len(pairs)} pairs from {PAIRS_FILE}")

    # Filter by doctor_id if specified
    if args.doctor_id:
        pairs = [p for p in pairs if p.get("doctor_id") == args.doctor_id]
        print(f"Filtered to doctor_id={args.doctor_id}: {len(pairs)} pairs")

    # Load existing findings to support incremental runs
    existing_findings: list[dict] = []
    existing_accessions: set[str] = set()
    if FINDINGS_FILE.exists() and args.skip_existing:
        existing_findings = json.loads(FINDINGS_FILE.read_text())
        existing_accessions = {f["accession_number"] for f in existing_findings}
        print(f"Existing findings: {len(existing_findings)} (covering {len(existing_accessions)} studies)")

    # Skip already-processed studies
    pairs_to_process = [
        p for p in pairs
        if p["accession_number"] not in existing_accessions
    ]
    if args.limit:
        pairs_to_process = pairs_to_process[: args.limit]

    print(f"Studies to process: {len(pairs_to_process)}")
    print()

    if not pairs_to_process:
        print("Nothing to process. Use --skip-existing=false to reanalyze.")
        return

    new_findings: list[dict] = []
    for i, pair in enumerate(pairs_to_process):
        accession = pair["accession_number"]
        doctor_id = int(pair.get("doctor_id", 0))
        doctor_name = pair.get("doctor_name", "")
        exam_date = pair.get("exam_date", "")

        print(f"[{i + 1}/{len(pairs_to_process)}] {accession} — {doctor_name}")

        findings = analyze_pair(
            client=client,
            accession=accession,
            doctor_id=doctor_id,
            doctor_name=doctor_name,
            doc_findings=pair.get("doc_findings", ""),
            doc_impression=pair.get("doc_impression", ""),
            val_findings=pair.get("val_findings", ""),
            val_impression=pair.get("val_impression", ""),
            exam_date=exam_date,
        )

        if findings:
            new_findings.extend(findings)
            grades = [f["grade"] for f in findings]
            from collections import Counter
            grade_dist = dict(Counter(grades))
            print(f"    {len(findings)} findings: {grade_dist}")
        else:
            print(f"    No findings returned")

        # Save incrementally every 10 studies
        if (i + 1) % 10 == 0:
            all_findings = existing_findings + new_findings
            FINDINGS_FILE.write_text(json.dumps(all_findings, indent=2, ensure_ascii=False))
            print(f"  [checkpoint] Saved {len(all_findings)} total findings")

        # Polite delay between API calls
        time.sleep(0.5)

    # Final save
    all_findings = existing_findings + new_findings
    FINDINGS_FILE.write_text(json.dumps(all_findings, indent=2, ensure_ascii=False))

    print()
    print("=" * 60)
    print(f"Analysis complete!")
    print(f"Total findings saved: {len(all_findings)}")
    print(f"New findings this run: {len(new_findings)}")
    print(f"Output: {FINDINGS_FILE}")
    print()
    print("Next step: cd dashboard && npm run build && npm start")


if __name__ == "__main__":
    main()
