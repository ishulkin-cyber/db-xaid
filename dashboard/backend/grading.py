"""
RADPEER-adapted grading service.
Compares radiologist report (Russian) vs validator/attending report (English)
using the Claude API (primary) or rule-based fallback (when no API key).
"""

import json
import logging
import os
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import anthropic

logger = logging.getLogger(__name__)

# ─── RADPEER system prompt (mirrors xaid-shared-skills/radpeer-grade) ─────────

GRADING_SYSTEM_PROMPT = """You are an expert radiologist and quality assurance specialist comparing two chest CT radiology reports using the RADPEER-adapted grading system.

## Your Task
Compare Report A (preliminary radiologist report, may be in Russian) with Report B (final attending/validator report, in English) finding by finding.

## Grading Scale
- Grade 1: Concordant — Same clinical meaning, even if language or wording differs.
- Grade 2a: Minor Stylistic — Wording/formatting differences only; no change in clinical meaning.
- Grade 2b: Minor Clinical — Finding added or modified, but NO management change. Different measurement, added qualifier, minor description change.
- Grade 3: Significant Underreport — Report A MISSED a finding present in Report B that CHANGES clinical management (further workup, follow-up, treatment change).
- Grade 4: Significant Overreport — Report A INCORRECTLY described a finding that Report B determined is absent, potentially causing unnecessary workup.

## Finding Categories (use exactly these string values)
- "nodules" — Pulmonary nodules, masses, consolidation, infiltrates, air space disease
- "parenchyma" — Lung parenchyma: ground-glass opacities, interstitial changes, emphysema, fibrosis, air trapping, bronchiectasis
- "lymph_nodes" — Lymph nodes: mediastinal, hilar, paratracheal, subcarinal, axillary
- "pleura" — Pleural effusion, pleural thickening, pleural plaques, pneumothorax
- "cardiac" — Heart size/shape, pericardium, coronary calcifications, cardiac masses
- "vascular" — Aorta, pulmonary arteries, great vessels, aneurysm, stenosis
- "bone" — Ribs, vertebrae, sternum, clavicles, scapulae, bone lesions, fractures
- "degenerative" — Degenerative/spondylotic changes, osteophytes, endplate changes, facet arthropathy
- "other" — Soft tissue, thyroid, breast, extrathoracic findings, technical factors, incidentalomas

## Management-Changing Criteria (Grade 3 triggers — be strict)
- Nodule >= 6 mm not mentioned or significantly mis-described
- Mediastinal/hilar lymphadenopathy short axis >10 mm not mentioned
- New consolidation, mass, or infiltrate not mentioned
- Pleural effusion (moderate or large) not mentioned
- Pneumothorax not mentioned
- Aortic aneurysm, dissection, or significant stenosis not mentioned
- Suspicious or destructive bone lesion not mentioned
- Significant extrathoracic finding (breast mass, adrenal lesion, hepatic lesion) not mentioned
- Any finding for which Report B explicitly recommends further workup that Report A omitted

## Rules
1. Extract ALL atomic findings from both reports — do NOT skip concordant normals.
2. Russian text in Report A and English text in Report B describing the same finding = Grade 1 (language is NOT a discrepancy).
3. Measurement differences <= 2 mm or minor descriptor differences = Grade 2b, not Grade 3.
4. Findings explicitly stated negative in both reports = Grade 1.
5. Be exhaustive and err on the side of completeness.

## Output Format
Respond ONLY with valid JSON. No markdown, no explanation, no code fences — raw JSON only.

{
  "findings": [
    {
      "id": 1,
      "category": "nodules",
      "finding_text": "Brief finding description in Russian",
      "radiologist_text": "Exact relevant text from Report A (Russian), or null if absent",
      "validator_text": "Exact relevant text from Report B (English), or null if absent",
      "grade": "1",
      "grade_label": "Concordant",
      "management_impact": null,
      "location": "Anatomical location in Russian"
    }
  ],
  "summary": {
    "grade_1_count": 0,
    "grade_2a_count": 0,
    "grade_2b_count": 0,
    "grade_3_count": 0,
    "grade_4_count": 0,
    "total_findings": 0,
    "has_omissions": false,
    "overall_grade": "1",
    "concordance_rate": 0.0,
    "clinical_concordance_rate": 0.0
  }
}"""

CATEGORY_LABELS_RU: Dict[str, str] = {
    "nodules": "Узелки / образования",
    "parenchyma": "Лёгочная паренхима",
    "lymph_nodes": "Лимфоузлы",
    "pleura": "Плевра / выпот",
    "cardiac": "Кардиальная патология",
    "vascular": "Сосудистая патология",
    "bone": "Костная патология",
    "degenerative": "Дегенеративные изменения",
    "other": "Прочие",
}


# ─── SQLite cache ──────────────────────────────────────────────────────────────

def _get_cache_conn(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE IF NOT EXISTS report_grades (
            task_id INTEGER PRIMARY KEY,
            graded_at TEXT NOT NULL,
            radiologist_report_id INTEGER,
            validator_report_id INTEGER,
            overall_grade TEXT,
            has_omissions INTEGER,
            findings_json TEXT,
            summary_json TEXT
        )
    """)
    conn.commit()
    return conn


# ─── Rule-based fallback grader ───────────────────────────────────────────────

_MEASUREMENT_RE = re.compile(
    r'\b(\d+(?:[.,]\d+)?)\s*(?:[×xхXX])\s*(\d+(?:[.,]\d+)?)'
    r'(?:\s*(?:[×xхXX])\s*(\d+(?:[.,]\d+)?))?\s*(?:мм|см|mm|cm)\b'
    r'|\b(\d+(?:[.,]\d+)?)\s*(?:мм|см|mm|cm)\b',
    re.IGNORECASE,
)

# EN term → RU equivalents for cross-language matching
_EN_RU: List[Tuple[str, List[str]]] = [
    ("nodule",          ["узел", "узелок", "очаг"]),
    ("mass",            ["образование", "масса"]),
    ("consolidation",   ["консолидац", "уплотнен"]),
    ("ground-glass",    ["матов", "ГГО"]),
    ("effusion",        ["выпот"]),
    ("pneumothorax",    ["пневмоторакс"]),
    ("emphysema",       ["эмфизем"]),
    ("fibrosis",        ["фиброз"]),
    ("lymph node",      ["лимфоузел", "лимф"]),
    ("lymphadenopathy", ["лимфаденопатия"]),
    ("atelectasis",     ["ателектаз"]),
    ("bronchiectasis",  ["бронхоэктаз"]),
    ("aneurysm",        ["аневризм"]),
    ("calcification",   ["кальцинат", "кальцификац"]),
    ("pleural",         ["плевр"]),
    ("pericardial",     ["перикард"]),
    ("aortic",          ["аорт"]),
    ("fracture",        ["перелом"]),
    ("hemangioma",      ["гемангиом"]),
    ("metastasis",      ["метастаз"]),
    ("pneumonia",       ["пневмони", "бронхопневмони"]),
    ("malignant",       ["злокачеств"]),
    ("adenopathy",      ["аденопатия"]),
]

# Management-change keywords (EN) — Grade 3 if in validator but absent in rad
_MANAGEMENT_EN = {
    "follow-up", "surveillance", "biopsy", "recommend", "consult",
    "ultrasound recommended", "refer", "additional imaging", "workup",
    "urgent", "emergent", "suspicious for", "worrisome", "fleischner",
}

# Sentence terminators
_SENT_RE = re.compile(r'(?<=[.!?])\s+|(?<=\n)')


def _extract_measurements(text: str) -> List[float]:
    """Return list of numeric measurements (first dimension) from text in mm."""
    out: List[float] = []
    for m in _MEASUREMENT_RE.finditer(text):
        val_str = m.group(1) or m.group(4)
        if val_str:
            try:
                val = float(val_str.replace(",", "."))
                # Assume cm if token contains cm, else mm
                token = m.group(0)
                if "см" in token or "cm" in token.lower():
                    val *= 10.0
                out.append(val)
            except ValueError:
                pass
    return out


def _has_management_keyword(text: str) -> bool:
    tl = text.lower()
    return any(kw in tl for kw in _MANAGEMENT_EN)


def _en_term_in_rad_ru(en_sentence: str, rad_ru: str) -> Tuple[List[str], List[str]]:
    """Return (matched_terms, unmatched_terms) for known EN→RU medical terms."""
    en_lower = en_sentence.lower()
    rad_lower = rad_ru.lower()
    matched, unmatched = [], []
    for en_term, ru_alts in _EN_RU:
        if en_term in en_lower:
            if any(ru in rad_lower for ru in ru_alts):
                matched.append(en_term)
            else:
                unmatched.append(en_term)
    return matched, unmatched


def _grade_sentence_vs_rad(en_sentence: str, rad_ru: str) -> str:
    """Grade a single EN validator sentence against the full RAD RU text."""
    _, unmatched = _en_term_in_rad_ru(en_sentence, rad_ru)
    if not unmatched:
        return "1"  # All terms found in rad

    is_management = _has_management_keyword(en_sentence)
    val_meas = _extract_measurements(en_sentence)
    rad_meas = _extract_measurements(rad_ru)

    # Check if any validator measurement is NOT close to any rad measurement
    new_measurement = val_meas and not any(
        abs(vm - rm) <= 2.0
        for vm in val_meas
        for rm in rad_meas
    )

    if is_management and unmatched:
        # Potentially Grade 3 — check management-change criteria
        en_lower = en_sentence.lower()
        g3_triggers = [
            "follow-up" in en_lower and any(t in unmatched for t in
                ["nodule", "mass", "lesion", "lymph node"]),
            "biopsy" in en_lower,
            "ultrasound recommended" in en_lower,
            "refer" in en_lower,
            "additional imaging" in en_lower,
        ]
        if any(g3_triggers):
            return "3"
        return "2b"

    if new_measurement:
        return "2b"

    return "2b"  # Unmatched terms without management trigger = minor clinical


def _rule_based_grade(
    rad_text: str,
    val_en_text: str,
) -> Dict[str, Any]:
    """
    Compare radiologist RU text vs validator EN text using heuristic rules.
    Returns a findings/summary dict in the same format as the Claude grader.
    """
    # Split validator EN into sentences (rough split)
    sentences = [s.strip() for s in re.split(r'\n|(?<=\.)\s+', val_en_text) if len(s.strip()) > 20]

    findings: List[Dict[str, Any]] = []
    fid = 0

    for sent in sentences:
        fid += 1
        grade = _grade_sentence_vs_rad(sent, rad_text)

        # Assign category by keywords
        sl = sent.lower()
        cat = "other"
        if any(t in sl for t in ["nodule", "mass", "consolidation", "opacity", "infiltrat"]):
            cat = "nodules"
        elif any(t in sl for t in ["ground-glass", "emphysema", "fibrosis", "atelectasis", "bronchiect", "parenchyma"]):
            cat = "parenchyma"
        elif any(t in sl for t in ["lymph node", "lymphadenop", "hilar", "mediastinal"]):
            cat = "lymph_nodes"
        elif any(t in sl for t in ["pleural", "effusion", "pneumothorax"]):
            cat = "pleura"
        elif any(t in sl for t in ["cardiac", "heart", "pericardial", "coronary"]):
            cat = "cardiac"
        elif any(t in sl for t in ["aorta", "aortic", "pulmonary artery", "vessel", "aneurysm"]):
            cat = "vascular"
        elif any(t in sl for t in ["rib", "vertebra", "vertebrae", "bone", "fracture", "hemangioma"]):
            cat = "bone"
        elif any(t in sl for t in ["degenerative", "spondylosis", "osteophyte"]):
            cat = "degenerative"

        grade_labels = {
            "1": "Concordant", "2a": "Minor Stylistic", "2b": "Minor Clinical",
            "3": "Significant Underreport", "4": "Significant Overreport",
        }

        findings.append({
            "id": fid,
            "category": cat,
            "category_label": CATEGORY_LABELS_RU.get(cat, cat),
            "finding_text": sent[:120],
            "radiologist_text": None,
            "validator_text": sent,
            "grade": grade,
            "grade_label": grade_labels.get(grade, ""),
            "management_impact": sent if grade == "3" else None,
            "location": "",
        })

    # If no findings extracted, mark as grade 1 with one placeholder
    if not findings:
        findings = [{
            "id": 1, "category": "other", "category_label": CATEGORY_LABELS_RU["other"],
            "finding_text": "Автоматическое сравнение не выявило расхождений",
            "radiologist_text": None, "validator_text": None,
            "grade": "1", "grade_label": "Concordant",
            "management_impact": None, "location": "",
        }]

    total = len(findings)
    counts: Dict[str, int] = {"1": 0, "2a": 0, "2b": 0, "3": 0, "4": 0}
    for f in findings:
        counts[f["grade"]] = counts.get(f["grade"], 0) + 1

    has_omissions = counts["2b"] > 0 or counts["3"] > 0 or counts["4"] > 0
    overall = "1"
    for w in ("4", "3", "2b", "2a"):
        if counts[w] > 0:
            overall = w
            break

    summary = {
        "grade_1_count": counts["1"],
        "grade_2a_count": counts["2a"],
        "grade_2b_count": counts["2b"],
        "grade_3_count": counts["3"],
        "grade_4_count": counts["4"],
        "total_findings": total,
        "has_omissions": has_omissions,
        "overall_grade": overall,
        "concordance_rate": round(counts["1"] / total, 4),
        "clinical_concordance_rate": round((counts["1"] + counts["2a"]) / total, 4),
    }
    return {"findings": findings, "summary": summary}


# ─── Grading service ──────────────────────────────────────────────────────────

class GradingService:
    def __init__(self) -> None:
        self._api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        self._client = anthropic.AsyncAnthropic(api_key=self._api_key) if self._api_key else None
        self._db_path = os.getenv("CACHE_DB_PATH", "./grades_cache.db")
        conn = _get_cache_conn(self._db_path)
        conn.close()

    # ── Cache helpers ──────────────────────────────────────────────────────────

    def get_cached(self, task_id: int) -> Optional[Dict[str, Any]]:
        conn = _get_cache_conn(self._db_path)
        try:
            row = conn.execute(
                "SELECT * FROM report_grades WHERE task_id = ?", (task_id,)
            ).fetchone()
            if not row:
                return None
            return {
                "task_id": row["task_id"],
                "graded_at": row["graded_at"],
                "overall_grade": row["overall_grade"],
                "has_omissions": bool(row["has_omissions"]),
                "findings": json.loads(row["findings_json"]),
                "summary": json.loads(row["summary_json"]),
            }
        finally:
            conn.close()

    def get_cached_many(self, task_ids: List[int]) -> Dict[int, Dict[str, Any]]:
        if not task_ids:
            return {}
        conn = _get_cache_conn(self._db_path)
        try:
            placeholders = ",".join("?" * len(task_ids))
            rows = conn.execute(
                f"SELECT * FROM report_grades WHERE task_id IN ({placeholders})",
                task_ids,
            ).fetchall()
            result: Dict[int, Dict[str, Any]] = {}
            for row in rows:
                result[row["task_id"]] = {
                    "task_id": row["task_id"],
                    "graded_at": row["graded_at"],
                    "overall_grade": row["overall_grade"],
                    "has_omissions": bool(row["has_omissions"]),
                    "findings": json.loads(row["findings_json"]),
                    "summary": json.loads(row["summary_json"]),
                }
            return result
        finally:
            conn.close()

    def _save_grade(
        self,
        task_id: int,
        rad_report_id: Optional[int],
        val_report_id: Optional[int],
        grade_result: Dict[str, Any],
    ) -> None:
        conn = _get_cache_conn(self._db_path)
        try:
            summary = grade_result.get("summary", {})
            conn.execute(
                """INSERT OR REPLACE INTO report_grades
                   (task_id, graded_at, radiologist_report_id, validator_report_id,
                    overall_grade, has_omissions, findings_json, summary_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    task_id,
                    datetime.now(timezone.utc).isoformat(),
                    rad_report_id,
                    val_report_id,
                    summary.get("overall_grade", "1"),
                    int(summary.get("has_omissions", False)),
                    json.dumps(grade_result.get("findings", []), ensure_ascii=False),
                    json.dumps(summary, ensure_ascii=False),
                ),
            )
            conn.commit()
        finally:
            conn.close()

    # ── Core grading ──────────────────────────────────────────────────────────

    def _build_report_text(self, report: Dict[str, Any], english: bool = False) -> str:
        parts = []
        if english:
            for field in ("protocol_en", "findings_en", "impression_en"):
                val = (report.get(field) or "").strip()
                if val:
                    label = field.replace("_en", "").upper()
                    parts.append(f"[{label}]\n{val}")
        else:
            for field in ("protocol", "findings", "impression"):
                val = (report.get(field) or "").strip()
                if val:
                    parts.append(f"[{field.upper()}]\n{val}")
        return "\n\n".join(parts) if parts else "(empty report)"

    async def grade_task(
        self,
        task_id: int,
        radiologist_report: Dict[str, Any],
        validator_report: Dict[str, Any],
    ) -> Dict[str, Any]:
        cached = self.get_cached(task_id)
        if cached:
            return cached

        rad_text = self._build_report_text(radiologist_report, english=False)
        val_text = self._build_report_text(validator_report, english=True)
        if val_text == "(empty report)":
            val_text = self._build_report_text(validator_report, english=False)

        # ── Try Claude API; fall back to rule-based grader ─────────────────────
        if not self._api_key or not self._client:
            logger.info("No API key — using rule-based grader for task %d", task_id)
            result = _rule_based_grade(rad_text, val_text)
        else:
            user_message = (
                "Compare these two radiology reports and grade each finding:\n\n"
                f"## Report A — Radiologist (Preliminary)\n{rad_text}\n\n"
                f"## Report B — Validator/Attending (Final)\n{val_text}"
            )
            logger.info("Grading task %d via Claude API", task_id)
            try:
                response = await self._client.messages.create(
                    model="claude-sonnet-4-6",
                    max_tokens=4096,
                    system=GRADING_SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_message}],
                )
                raw = response.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                    raw = raw.strip()
                result = json.loads(raw)
            except Exception as api_err:
                logger.warning("Claude API failed for task %d: %s — falling back to rule-based", task_id, api_err)
                result = _rule_based_grade(rad_text, val_text)

        for f in result.get("findings", []):
            f["category_label"] = CATEGORY_LABELS_RU.get(
                f.get("category", ""), f.get("category", "")
            )

        summary = result.get("summary", {})
        total = summary.get("total_findings", 0) or 1
        g1 = summary.get("grade_1_count", 0)
        g2a = summary.get("grade_2a_count", 0)
        summary["concordance_rate"] = round(g1 / total, 4)
        summary["clinical_concordance_rate"] = round((g1 + g2a) / total, 4)
        summary["has_omissions"] = (
            summary.get("grade_2b_count", 0) > 0
            or summary.get("grade_3_count", 0) > 0
            or summary.get("grade_4_count", 0) > 0
        )

        self._save_grade(
            task_id,
            radiologist_report.get("id"),
            validator_report.get("id"),
            result,
        )
        logger.info(
            "Task %d graded: overall=%s", task_id, summary.get("overall_grade")
        )
        return {
            "task_id": task_id,
            "graded_at": datetime.now(timezone.utc).isoformat(),
            "overall_grade": summary.get("overall_grade", "1"),
            "has_omissions": summary["has_omissions"],
            "findings": result.get("findings", []),
            "summary": summary,
        }
