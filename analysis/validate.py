"""
validate.py — Validate JSON data files before running npm run build

Usage:
    python3 validate.py
"""

import json
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

REQUIRED_FILES = ["dv_findings.json", "doctor_validator_pairs.json"]

VALID_GRADES = {"1", "2a", "2b", "3", "4"}
VALID_DISCREPANCY = {"concordant", "stylistic", "underreport", "overreport"}


def check_findings(data: list) -> list[str]:
    errors = []
    if not isinstance(data, list):
        return ["dv_findings.json must be a JSON array"]

    for i, item in enumerate(data[:10]):  # spot-check first 10
        if "accession_number" not in item:
            errors.append(f"Finding[{i}] missing accession_number")
        if "grade" not in item:
            errors.append(f"Finding[{i}] missing grade")
        elif item["grade"] not in VALID_GRADES:
            errors.append(f"Finding[{i}] invalid grade: {item['grade']}")
        if "discrepancy_type" not in item:
            errors.append(f"Finding[{i}] missing discrepancy_type")
        elif item["discrepancy_type"] not in VALID_DISCREPANCY:
            errors.append(f"Finding[{i}] invalid discrepancy_type: {item['discrepancy_type']}")
        if "doctor_id" not in item:
            errors.append(f"Finding[{i}] missing doctor_id")

    doctors = {f["doctor_id"] for f in data if "doctor_id" in f}
    accessions = {f["accession_number"] for f in data if "accession_number" in f}
    print(f"  → {len(data)} findings, {len(accessions)} studies, {len(doctors)} doctors")
    return errors


def check_pairs(data: list) -> list[str]:
    errors = []
    if not isinstance(data, list):
        return ["doctor_validator_pairs.json must be a JSON array"]

    for i, item in enumerate(data[:10]):
        for field in ["accession_number", "doctor_id", "doc_findings", "val_findings"]:
            if field not in item:
                errors.append(f"Pair[{i}] missing {field}")

    accessions = {p["accession_number"] for p in data if "accession_number" in p}
    print(f"  → {len(data)} pairs, {len(accessions)} unique accessions")
    return errors


def main():
    print("=" * 50)
    print("xAID Internal QA — Data Validation")
    print("=" * 50)

    all_ok = True

    for filename in REQUIRED_FILES:
        filepath = DATA_DIR / filename
        print(f"\nChecking {filename}...")

        if not filepath.exists():
            print(f"  ERROR: File not found: {filepath}")
            all_ok = False
            continue

        try:
            data = json.loads(filepath.read_text())
        except json.JSONDecodeError as e:
            print(f"  ERROR: Invalid JSON: {e}")
            all_ok = False
            continue

        if filename == "dv_findings.json":
            errors = check_findings(data)
        elif filename == "doctor_validator_pairs.json":
            errors = check_pairs(data)
        else:
            errors = []

        if errors:
            for e in errors:
                print(f"  ERROR: {e}")
            all_ok = False
        else:
            print("  OK")

    print()
    if all_ok:
        print("All checks passed. Safe to run: npm run build")
    else:
        print("Validation FAILED. Fix errors before building.")
        sys.exit(1)


if __name__ == "__main__":
    main()
