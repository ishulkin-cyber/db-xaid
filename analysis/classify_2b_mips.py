"""
Retrospective classification of Grade 2b findings as MIPS-related or non-MIPS.
Based on MIPS_CONTEXT.md rules.

Does NOT modify dv_findings.json. Outputs to analysis/data/dv_findings_2b_classified.json
and prints a statistics report.
"""

import json
from pathlib import Path
from collections import Counter

DATA_PATH = Path(__file__).parent / "data" / "dv_findings.json"
OUTPUT_PATH = Path(__file__).parent / "data" / "dv_findings_2b_classified.json"


# --- Keyword maps per measure ---

ACRAD44_CATEGORIES = {
    "coronary artery calcification",
    "coronary calcification",
    "coronary artery calcification severity",
    "coronary and vascular calcification",
    "coronary calcification impression detail",
    "coronary calcification in findings section",
}

M364_CATEGORIES = {
    "pulmonary nodule", "pulmonary nodules", "pulmonary micronodule",
    "pulmonary micronodules", "micronodules", "scattered micronodules",
    "left upper lobe nodule", "left lower lobe nodule", "right upper lobe nodule",
    "fleischner recommendation", "fleischner follow-up recommendation",
    "fleischner applicability", "fleischner recommendation — growth assessment",
    "fleischner recommendation for rml nodule", "pulmonary nodule follow-up recommendation",
    "nodule follow-up recommendation", "nodule growth assessment",
    "part-solid nodule", "ground glass nodule", "perifissural nodules",
    "solitary solid nodules", "centrilobular micronodules / bronchiolitis",
    "tree-in-bud nodules / bronchiolitis", "prior nodule status",
    "pulmonary cyst/nodule", "pulmonary nodules — right lower lobe",
    "lung-rads classification", "lung cancer screening recommendation",
    "centrilobular nodules",
}
# Extra: any category containing these substrings maps to 364
M364_SUBSTRINGS = ["nodule", "micronodule", "fleischner", "lung-rads"]

M405_CATEGORIES = {
    "renal cyst", "kidney cyst", "left renal cyst", "renal finding",
    "adrenal gland finding", "adrenal finding", "left adrenal lesion",
    "left adrenal gland thickening", "left adrenal thickening",
}
M405_SUBSTRINGS = ["adrenal", "bosniak", "renal cyst", "kidney cyst"]

M406_CATEGORIES = {
    "thyroid nodule", "thyroid finding", "thyroid lesion", "thyroid abnormality",
    "left thyroid nodule", "right thyroid lesion", "thyroid nodules",
    "substernal thyroid extension",
}
M406_SUBSTRINGS = ["thyroid"]

QMM23_CATEGORIES = {
    "emphysema",
    "centrilobular emphysema",
    "small airways obstruction / copd",
    "lung cancer screening recommendation",
}
QMM23_SUBSTRINGS = ["emphysema"]

# Notes/description keywords that confirm MIPS documentation element is involved
ACRAD44_CONFIRM = ["pcp", "cardiovascular risk", "acr recommendation", "standardized",
                   "cardiac risk", "risk assessment", "consultation"]
M364_CONFIRM = ["fleischner", "follow-up", "no follow-up", "lung-rads", "oncology",
                "threshold", "sub-threshold", "below threshold", "recommendation",
                "interval", "modality", "guideline"]
M405_CONFIRM = ["no follow-up", "no further", "benign", "adenoma", "simple cyst",
                "bosniak", "not require", "no additional workup"]
M406_CONFIRM = ["acr", "white paper", "ultrasound", "follow-up", "no follow-up",
                "not require", "below threshold", "guideline"]
QMM23_CONFIRM = ["ldct", "lung cancer screening", "independent risk factor",
                 "screening recommendation", "low dose ct", "low-dose ct"]

# Non-MIPS overrides (these categories should NOT be MIPS even if substring matches)
NON_MIPS_OVERRIDES = {
    "coronary artery bypass grafting", "cabg",
    "left thyroid lobectomy",           # surgical absence, not a nodule
    "sternal sutures",                  # post-surgical
}


def cat_matches(cat: str, exact_set: set, substrings: list) -> bool:
    cat_l = cat.lower().strip()
    if cat_l in exact_set:
        return True
    return any(s in cat_l for s in substrings)


def notes_confirm(record: dict, keywords: list) -> bool:
    text = " ".join([
        record.get("notes", ""),
        record.get("validator_description", ""),
        record.get("doctor_description", ""),
    ]).lower()
    return any(k in text for k in keywords)


def classify_record(record: dict) -> tuple[bool, str | None]:
    """Returns (mips_related, mips_measure_id | None)."""
    cat = record.get("finding_category", "").lower().strip()

    # Hard overrides
    if any(o in cat for o in NON_MIPS_OVERRIDES):
        return False, None

    # ACRad44 — coronary calcification
    if cat_matches(cat, ACRAD44_CATEGORIES, ["coronary"]):
        # CABG is not a CAC finding
        if "bypass" in cat or "cabg" in cat:
            return False, None
        # CAC records are always MIPS-scope; MIPS-2b if severity or recommendation differs
        return True, "ACRad44"

    # 364 — pulmonary nodules / Fleischner
    # Exclude thyroid even if "nodule" substring present
    if "thyroid" not in cat and cat_matches(cat, M364_CATEGORIES, M364_SUBSTRINGS):
        # Confirm it's about a documentation/recommendation element
        if notes_confirm(record, M364_CONFIRM):
            return True, "364"
        # Even without explicit keyword, pulmonary nodule omission touches 364 scope
        return True, "364"

    # 405 — benign abdominal lesions
    if cat_matches(cat, M405_CATEGORIES, M405_SUBSTRINGS):
        return True, "405"

    # 406 — thyroid nodules
    if cat_matches(cat, M406_CATEGORIES, M406_SUBSTRINGS):
        # surgical absence of lobe is non-MIPS
        if "lobectomy" in cat or "lobectomy" in record.get("notes", "").lower():
            return False, None
        return True, "406"

    # QMM23 — emphysema + LDCT
    if cat_matches(cat, QMM23_CATEGORIES, QMM23_SUBSTRINGS):
        # Only MIPS-2b if LDCT recommendation element is involved
        if notes_confirm(record, QMM23_CONFIRM):
            return True, "QMM23"
        # Pure emphysema characterization difference (severity, type) without LDCT → non-MIPS
        return False, None

    return False, None


def main():
    with open(DATA_PATH) as f:
        data = json.load(f)

    grade_2b = [r for r in data if r.get("grade") == "2b"]

    classified = []
    for r in grade_2b:
        mips_related, measure = classify_record(r)
        classified.append({
            **r,
            "mips_related": mips_related,
            "mips_measure": measure,
        })

    # Save output
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(classified, f, indent=2, ensure_ascii=False)

    # --- Statistics ---
    total = len(classified)
    mips = [r for r in classified if r["mips_related"]]
    non_mips = [r for r in classified if not r["mips_related"]]

    measure_counts = Counter(r["mips_measure"] for r in mips)
    doctor_mips = Counter(r["doctor_name"] for r in mips)
    doctor_non_mips = Counter(r["doctor_name"] for r in non_mips)
    doctor_total_2b = Counter(r["doctor_name"] for r in classified)

    print("=" * 60)
    print("  RETROSPECTIVE MIPS 2b CLASSIFICATION — STATISTICS")
    print("=" * 60)

    print(f"\nTotal Grade 2b findings: {total}")
    print(f"  2b-MIPS:     {len(mips):3d}  ({100*len(mips)/total:.1f}%)")
    print(f"  2b-non-MIPS: {len(non_mips):3d}  ({100*len(non_mips)/total:.1f}%)")

    print("\n--- 2b-MIPS by measure ---")
    for measure in ["ACRad44", "364", "405", "406", "QMM23"]:
        n = measure_counts.get(measure, 0)
        pct = 100 * n / len(mips) if mips else 0
        labels = {
            "ACRad44": "Coronary artery calcification",
            "364":     "Pulmonary nodules / Fleischner",
            "405":     "Benign abdominal lesions",
            "406":     "Thyroid nodules <1 cm",
            "QMM23":   "Emphysema + LDCT screening",
        }
        print(f"  {measure:8s}  {n:3d}  ({pct:.1f}%)  {labels[measure]}")

    print("\n--- 2b-MIPS per doctor (top 10) ---")
    print(f"  {'Doctor':<25} {'Total 2b':>8} {'MIPS 2b':>8} {'MIPS %':>7}")
    print(f"  {'-'*25} {'-'*8} {'-'*8} {'-'*7}")
    for doctor, total_count in doctor_total_2b.most_common(10):
        mips_count = doctor_mips.get(doctor, 0)
        pct = 100 * mips_count / total_count if total_count else 0
        print(f"  {doctor:<25} {total_count:>8} {mips_count:>8} {pct:>6.1f}%")

    print("\n--- 2b-non-MIPS: top categories ---")
    non_mips_cats = Counter(r["finding_category"] for r in non_mips)
    for cat, n in non_mips_cats.most_common(15):
        print(f"  {n:3d}  {cat}")

    print("\n--- 2b-MIPS: top categories ---")
    mips_cats = Counter(r["finding_category"] for r in mips)
    for cat, n in mips_cats.most_common(15):
        print(f"  {n:3d}  {cat}")

    print(f"\nOutput saved to: {OUTPUT_PATH}")
    print("=" * 60)


if __name__ == "__main__":
    main()
