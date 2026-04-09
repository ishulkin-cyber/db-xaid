#!/usr/bin/env python3
"""
merge_graded_findings.py — Merge new graded findings into dv_findings.json.

Usage:
    python3 analysis/merge_graded_findings.py

Reads all graded_chunk_*.json from 1.3/grading/, merges with
analysis/data/dv_findings.json, deduplicates by accession_number,
and writes back. Then runs MIPS classifier.
"""

from __future__ import annotations

import json
import glob
import subprocess
from pathlib import Path
from collections import Counter

BASE_DIR = Path(__file__).resolve().parent
FINDINGS_FILE = BASE_DIR / "data" / "dv_findings.json"
GRADING_DIR = BASE_DIR.parent / "1.3" / "grading"

REQUIRED_FIELDS = {
    "accession_number", "finding_category", "anatomical_location",
    "in_doctor_report", "in_validator_report", "doctor_description",
    "validator_description", "discrepancy_type", "grade",
    "management_impact", "notes", "doctor_name", "doctor_id", "exam_date",
}

VALID_GRADES = {"1", "2a", "2b", "3", "4"}
VALID_DISCREPANCY_TYPES = {"underreport", "overreport", "characterization", "concordant"}


def validate_finding(f: dict) -> list[str]:
    errors = []
    missing = REQUIRED_FIELDS - set(f.keys())
    if missing:
        errors.append(f"Missing fields: {missing}")
    if str(f.get("grade", "")) not in VALID_GRADES:
        errors.append(f"Invalid grade: {f.get('grade')}")
    if f.get("discrepancy_type") not in VALID_DISCREPANCY_TYPES:
        errors.append(f"Invalid discrepancy_type: {f.get('discrepancy_type')}")
    return errors


def main():
    # Load existing findings
    existing = json.loads(FINDINGS_FILE.read_text())
    existing_accs = {f["accession_number"] for f in existing}
    print(f"Existing findings: {len(existing)} across {len(existing_accs)} studies")

    # Load all graded chunks
    chunk_files = sorted(GRADING_DIR.glob("graded_chunk_*.json"))
    print(f"Found {len(chunk_files)} graded chunk files")

    new_findings = []
    validation_errors = 0

    for chunk_file in chunk_files:
        try:
            chunk = json.loads(chunk_file.read_text())
            if not isinstance(chunk, list):
                print(f"  WARNING: {chunk_file.name} is not a list, skipping")
                continue
            valid = 0
            for f in chunk:
                errors = validate_finding(f)
                if errors:
                    print(f"  VALIDATION ERROR in {chunk_file.name}: {errors}")
                    validation_errors += 1
                else:
                    # Normalize
                    f["grade"] = str(f["grade"])
                    f["accession_number"] = str(f["accession_number"])
                    f["doctor_id"] = int(f.get("doctor_id") or 0)
                    new_findings.append(f)
                    valid += 1
            print(f"  {chunk_file.name}: {valid} valid findings ({len(chunk) - valid} errors)")
        except Exception as e:
            print(f"  ERROR reading {chunk_file.name}: {e}")

    if not new_findings:
        print("No new findings to merge.")
        return

    # Find new accession numbers
    new_accs = {f["accession_number"] for f in new_findings}
    truly_new_accs = new_accs - existing_accs
    print(f"\nNew findings: {len(new_findings)} across {len(new_accs)} studies")
    print(f"New studies (not in existing): {len(truly_new_accs)}")
    print(f"Validation errors skipped: {validation_errors}")

    # Remove any existing findings for studies being re-graded
    # (in case we're replacing old grades)
    replaced = [f for f in existing if f["accession_number"] in new_accs]
    if replaced:
        print(f"Replacing {len(replaced)} existing findings for {len(new_accs & existing_accs)} re-graded studies")
        existing = [f for f in existing if f["accession_number"] not in new_accs]

    # Merge
    merged = existing + new_findings
    merged.sort(key=lambda f: (f.get("exam_date", ""), f.get("accession_number", "")), reverse=True)

    # Grade distribution
    grade_dist = Counter(f["grade"] for f in merged)
    print(f"\nMerged: {len(merged)} total findings")
    for g in ["1", "2a", "2b", "3", "4"]:
        print(f"  Grade {g}: {grade_dist.get(g, 0)}")

    # Save
    FINDINGS_FILE.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
    print(f"\nSaved to {FINDINGS_FILE}")

    # Run MIPS classifier
    print("\nRunning MIPS classifier...")
    result = subprocess.run(
        ["python3", str(BASE_DIR / "classify_2b_mips.py")],
        cwd=str(BASE_DIR.parent),
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(result.stdout)
    else:
        print(f"MIPS classifier error: {result.stderr}")

    print("\nDone. Next step: cd dashboard && npm run build")


if __name__ == "__main__":
    main()
