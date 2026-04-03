"""
Dashboard backend — FastAPI.
Python 3.9 compatible.
"""

import asyncio
import logging
import os
import sqlite3
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import date, timedelta
from typing import Any, Dict, List, Literal, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from grading import CATEGORY_LABELS_RU, GradingService
from mcp_client import MCPClient

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s: %(message)s")
logger = logging.getLogger(__name__)

mcp: MCPClient
grading: GradingService

# ── In-memory TTL cache for MCP query results ──────────────────────────────────
_TASK_CACHE_TTL = 60  # seconds
_task_cache: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}
_task_cache_inflight: Dict[str, "asyncio.Future[List[Dict[str, Any]]]"] = {}


_CACHE_DB = os.getenv("CACHE_DB_PATH", "./grades_cache.db")

def _init_translation_cache():
    con = sqlite3.connect(_CACHE_DB)
    con.execute("""
        CREATE TABLE IF NOT EXISTS val_ru_translations (
            task_id INTEGER PRIMARY KEY,
            findings_ru TEXT,
            impression_ru TEXT,
            finding_highlights TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    # Add finding_highlights column to existing tables (idempotent)
    try:
        con.execute("ALTER TABLE val_ru_translations ADD COLUMN finding_highlights TEXT")
    except Exception:
        pass
    con.commit()
    con.close()

def _get_cached_translation(task_id: int) -> Optional[Dict[str, Any]]:
    con = sqlite3.connect(_CACHE_DB)
    row = con.execute(
        "SELECT findings_ru, impression_ru, finding_highlights FROM val_ru_translations WHERE task_id = ?",
        (task_id,)
    ).fetchone()
    con.close()
    if row:
        import json as _json
        highlights = {}
        if row[2]:
            try:
                highlights = _json.loads(row[2])
            except Exception:
                pass
        return {"findings_ru": row[0] or "", "impression_ru": row[1] or "", "finding_highlights": highlights}
    return None

def _save_translation_cache(task_id: int, findings_ru: str, impression_ru: str, finding_highlights: Dict[str, str]):
    import json as _json
    con = sqlite3.connect(_CACHE_DB)
    con.execute(
        "INSERT OR REPLACE INTO val_ru_translations (task_id, findings_ru, impression_ru, finding_highlights) VALUES (?,?,?,?)",
        (task_id, findings_ru, impression_ru, _json.dumps(finding_highlights, ensure_ascii=False)),
    )
    con.commit()
    con.close()

def _translate_en_to_ru_sync(text_en: str) -> str:
    """Translate text EN→RU using Google Translate (no API key required)."""
    try:
        from deep_translator import GoogleTranslator
        # Google Translate has a ~5000 char limit per request — chunk if needed
        MAX_CHUNK = 4500
        if len(text_en) <= MAX_CHUNK:
            return GoogleTranslator(source="en", target="ru").translate(text_en) or ""
        # Split on double newline to keep paragraph structure
        paragraphs = text_en.split("\n\n")
        translated_parts: List[str] = []
        chunk = ""
        for para in paragraphs:
            if len(chunk) + len(para) + 2 > MAX_CHUNK:
                if chunk:
                    translated_parts.append(
                        GoogleTranslator(source="en", target="ru").translate(chunk) or chunk
                    )
                chunk = para
            else:
                chunk = (chunk + "\n\n" + para).lstrip()
        if chunk:
            translated_parts.append(
                GoogleTranslator(source="en", target="ru").translate(chunk) or chunk
            )
        return "\n\n".join(translated_parts)
    except Exception as exc:
        logger.warning("Translation failed: %s", exc)
        return ""

async def _translate_en_to_ru(text_en: str) -> str:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _translate_en_to_ru_sync, text_en)

_AUTO_GRADE_INTERVAL = int(os.getenv("AUTO_GRADE_INTERVAL_SEC", "300"))  # 5 min default


async def _auto_grade_loop() -> None:
    """Background task: grade any newly delivered tasks (version_count > 1) not yet in cache."""
    # Wait for MCP to be ready before first run
    await asyncio.sleep(15)
    while True:
        try:
            await _run_auto_grade_pass()
        except Exception as exc:
            logger.warning("Auto-grade pass failed: %s", exc)
        await asyncio.sleep(_AUTO_GRADE_INTERVAL)


async def _run_auto_grade_pass() -> None:
    """Find ungraded tasks with multiple versions and grade them."""
    if not mcp._ready.is_set():
        return
    try:
        rows = await mcp.execute_sql("""
            SELECT t.id AS task_id,
                   (SELECT COUNT(*) FROM reports r WHERE r.task_id = t.id) AS version_count
            FROM tasks t
            WHERE t.reporting_radiologist_id IS NOT NULL
              AND (SELECT COUNT(*) FROM reports r WHERE r.task_id = t.id) > 1
            ORDER BY t.id DESC
            LIMIT 50
        """)
    except Exception as exc:
        logger.warning("Auto-grade query failed: %s", exc)
        return

    task_ids = [r["task_id"] for r in rows]
    if not task_ids:
        return

    cached = grading.get_cached_many(task_ids)
    ungraded = [r["task_id"] for r in rows if r["task_id"] not in cached]

    if not ungraded:
        return

    logger.info("Auto-grade: found %d ungraded tasks with multiple versions", len(ungraded))
    for task_id in ungraded:
        try:
            reports = await _get_task_reports(task_id)
            if not reports or len(reports) < 2:
                continue
            await grading.grade_task(task_id, reports[0], reports[-1])
            logger.info("Auto-graded task %d", task_id)
        except Exception as exc:
            logger.warning("Auto-grade failed for task %d: %s", task_id, exc)
        await asyncio.sleep(1)  # gentle pacing


@asynccontextmanager
async def lifespan(app: FastAPI):
    global mcp, grading
    _init_translation_cache()
    mcp = MCPClient()
    grading = GradingService()
    # Connect in background — don't block startup
    asyncio.create_task(_connect_mcp())
    asyncio.create_task(_auto_grade_loop())
    yield
    await mcp.disconnect()


async def _connect_mcp() -> None:
    global mcp
    try:
        await mcp.connect()
    except Exception as exc:
        logger.warning("MCP connect failed at startup: %s — will retry on first request", exc)


app = FastAPI(title="XAID Dashboard API", lifespan=lifespan)

cors_origins = os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Helpers ──────────────────────────────────────────────────────────────────

DAY_NAMES_RU = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"]


def _date_range(start: date, end: date) -> List[date]:
    out: List[date] = []
    d = start
    while d <= end:
        out.append(d)
        d += timedelta(days=1)
    return out


def _week_range(start: date, end: date) -> List[date]:
    seen = set()
    d = start
    while d <= end:
        monday = d - timedelta(days=d.weekday())
        seen.add(monday)
        d += timedelta(days=7)
    return sorted(seen)


def _day_label(d: date) -> str:
    return f"{d.day:02d}.{d.month:02d} {DAY_NAMES_RU[d.weekday()]}"


def _week_label(d: date) -> str:
    end = d + timedelta(days=6)
    return f"{d.day:02d}.{d.month:02d}–{end.day:02d}.{end.month:02d}"


def _safe_date(d_str: Optional[str], default: date) -> date:
    if not d_str:
        return default
    try:
        return date.fromisoformat(d_str)
    except ValueError:
        return default


# ─── SQL helpers ──────────────────────────────────────────────────────────────

async def _ensure_mcp() -> None:
    """Reconnect MCP if not ready (startup connection may still be in progress)."""
    if not mcp._ready.is_set():
        logger.info("Waiting for MCP connection...")
        try:
            await asyncio.wait_for(mcp._ready.wait(), timeout=25.0)
        except asyncio.TimeoutError:
            raise HTTPException(status_code=503, detail="MCP not connected — DB unavailable")
    if not mcp._messages_url:
        raise HTTPException(status_code=503, detail="MCP connection failed — check MCP_URL")


async def _get_delivered_tasks(start: date, end: date) -> List[Dict[str, Any]]:
    cache_key = f"{start.isoformat()}_{end.isoformat()}"
    now = time.monotonic()

    # Return cached result if still fresh
    if cache_key in _task_cache:
        ts, data = _task_cache[cache_key]
        if now - ts < _TASK_CACHE_TTL:
            return data

    # Deduplicate concurrent calls for the same key
    if cache_key in _task_cache_inflight:
        return await _task_cache_inflight[cache_key]

    loop = asyncio.get_event_loop()
    fut: asyncio.Future[List[Dict[str, Any]]] = loop.create_future()
    _task_cache_inflight[cache_key] = fut
    try:
        result = await _fetch_delivered_tasks(start, end)
        _task_cache[cache_key] = (time.monotonic(), result)
        fut.set_result(result)
        return result
    except Exception as exc:
        fut.set_exception(exc)
        raise
    finally:
        _task_cache_inflight.pop(cache_key, None)


async def _fetch_delivered_tasks(start: date, end: date) -> List[Dict[str, Any]]:
    await _ensure_mcp()
    # Attribution rule: if study arrived before midnight but description was done after midnight,
    # the task is attributed to the study arrival date (not the delivery date).
    # delivered_date = DATE(task_created event AT TIME ZONE 'Europe/Moscow')
    # Filter range also based on study arrival date, not delivery date.
    q = f"""
    SELECT
        t.id AS task_id,
        t.reporting_radiologist_id AS rad_id,
        u_r.first_name || ' ' || u_r.last_name AS rad_name,
        t.validating_radiologist_id AS val_id,
        u_v.first_name || ' ' || u_v.last_name AS val_name,
        (te_created.created_at + INTERVAL '3 hours')::date::text AS delivered_date,
        (SELECT MAX(r.version) FROM reports r WHERE r.task_id = t.id) AS max_version,
        (SELECT COUNT(r.id) FROM reports r WHERE r.task_id = t.id) AS version_count
    FROM tasks t
    JOIN users u_r ON t.reporting_radiologist_id = u_r.id
    LEFT JOIN users u_v ON t.validating_radiologist_id = u_v.id
    JOIN task_events te_delivered ON te_delivered.task_id = t.id
        AND te_delivered.data->>'action' = 'task_report_delivered'
    JOIN task_events te_created ON te_created.task_id = t.id
        AND te_created.data->>'action' = 'task_created'
    WHERE (te_created.created_at + INTERVAL '3 hours')::date >= '{start.isoformat()}'
      AND (te_created.created_at + INTERVAL '3 hours')::date <= '{end.isoformat()}'
      AND t.reporting_radiologist_id IS NOT NULL
    ORDER BY te_delivered.created_at DESC
    """
    return await mcp.execute_sql(q)


async def _get_task_reports(task_id: int) -> List[Dict[str, Any]]:
    await _ensure_mcp()
    q = f"""
    SELECT
        r.id, r.task_id, r.version, r.author_id,
        r.protocol, r.findings, r.impression,
        r.protocol_en, r.findings_en, r.impression_en,
        u.first_name || ' ' || u.last_name AS author_name,
        r.created_at::text AS created_at
    FROM reports r
    JOIN users u ON r.author_id = u.id
    WHERE r.task_id = {task_id}
    ORDER BY r.version ASC
    """
    return await mcp.execute_sql(q)


async def _get_schedule_entries(start: date, end: date) -> List[Dict[str, Any]]:
    await _ensure_mcp()
    q = f"""
    SELECT user_id, doctor_name, schedule_date::text, shift_hours
    FROM schedule_entries
    WHERE schedule_date >= '{start.isoformat()}'
      AND schedule_date <= '{end.isoformat()}'
    ORDER BY schedule_date, doctor_name
    """
    return await mcp.execute_sql(q)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/doctors")
async def list_doctors():
    q = """
    SELECT DISTINCT u.id, u.first_name || ' ' || u.last_name AS name
    FROM users u
    JOIN tasks t ON t.reporting_radiologist_id = u.id
    ORDER BY name
    """
    return await mcp.execute_sql(q)


@app.get("/api/quality/overview")
async def quality_overview(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    today = date.today()
    start = _safe_date(start_date, today - timedelta(days=30))
    end = _safe_date(end_date, today)

    tasks = await _get_delivered_tasks(start, end)
    total = len(tasks)
    if total == 0:
        return {
            "total_tasks": 0, "omission_count": 0, "omission_rate": 0.0,
            "grade_1_tasks": 0, "grade_2a_tasks": 0, "grade_2b_tasks": 0,
            "grade_2b_count": 0, "grade_2b_rate": 0.0,
            "grade_3_tasks": 0, "grade_3_count": 0, "grade_3_rate": 0.0,
            "grade_4_tasks": 0,
            "graded_count": 0, "ungraded_count": 0,
            "period": {"start": start.isoformat(), "end": end.isoformat()},
        }

    task_ids = [t["task_id"] for t in tasks]
    cached = grading.get_cached_many(task_ids)

    omission_count = 0
    grade_1_tasks = 0
    grade_2a_tasks = 0
    grade_2b_tasks = 0
    grade_3_tasks = 0
    grade_4_tasks = 0

    for t in tasks:
        tid = t["task_id"]
        if tid in cached:
            s = cached[tid]["summary"]
            if s.get("has_omissions"):
                omission_count += 1
            og = cached[tid].get("overall_grade", "1")
            if og == "1":    grade_1_tasks += 1
            elif og == "2a": grade_2a_tasks += 1
            elif og == "2b": grade_2b_tasks += 1
            elif og == "3":  grade_3_tasks += 1
            elif og == "4":  grade_4_tasks += 1
        elif int(t.get("max_version") or 1) > 1:
            omission_count += 1

    return {
        "total_tasks": total,
        "omission_count": omission_count,
        "omission_rate": round(omission_count / total, 4),
        "grade_1_tasks": grade_1_tasks,
        "grade_2a_tasks": grade_2a_tasks,
        "grade_2b_tasks": grade_2b_tasks,
        "grade_2b_count": grade_2b_tasks,
        "grade_2b_rate": round(grade_2b_tasks / total, 4),
        "grade_3_tasks": grade_3_tasks,
        "grade_3_count": grade_3_tasks,
        "grade_3_rate": round(grade_3_tasks / total, 4),
        "grade_4_tasks": grade_4_tasks,
        "graded_count": len(cached),
        "ungraded_count": total - len(cached),
        "period": {"start": start.isoformat(), "end": end.isoformat()},
    }


@app.get("/api/quality/table")
async def quality_table(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    view: Literal["days", "weeks"] = Query("days"),
):
    today = date.today()
    start = _safe_date(start_date, today - timedelta(days=11))
    end = _safe_date(end_date, today)

    tasks = await _get_delivered_tasks(start, end)
    task_ids = [t["task_id"] for t in tasks]
    cached = grading.get_cached_many(task_ids)

    if view == "weeks":
        col_dates = _week_range(start, end)
        col_labels = [_week_label(d) for d in col_dates]
    else:
        col_dates = _date_range(start, end)
        col_labels = [_day_label(d) for d in col_dates]

    col_keys = [d.isoformat() for d in col_dates]

    def _col_key(task_date_str: str) -> str:
        try:
            d = date.fromisoformat(str(task_date_str))
        except Exception:
            return str(task_date_str)
        if view == "weeks":
            return (d - timedelta(days=d.weekday())).isoformat()
        return d.isoformat()

    def _empty_cell() -> Dict[str, Any]:
        return {"tasks": 0, "omissions": 0, "grade_2b": 0, "grade_3": 0, "tasks_ids": []}

    doctor_data: Dict[int, Dict[str, Dict[str, Any]]] = defaultdict(
        lambda: defaultdict(_empty_cell)
    )
    doctor_names: Dict[int, str] = {}

    for t in tasks:
        rid = t["rad_id"]
        doctor_names[rid] = t["rad_name"]
        dk = _col_key(str(t["delivered_date"]))
        cell = doctor_data[rid][dk]
        cell["tasks"] += 1
        cell["tasks_ids"].append(t["task_id"])

        tid = t["task_id"]
        if tid in cached:
            s = cached[tid]["summary"]
            if s.get("has_omissions"):
                cell["omissions"] += 1
            cell["grade_2b"] += s.get("grade_2b_count", 0)
            cell["grade_3"] += s.get("grade_3_count", 0)
        elif int(t.get("max_version") or 1) > 1:
            cell["omissions"] += 1

    doctors_out: List[Dict[str, Any]] = []
    for rid, cells in doctor_data.items():
        total_tasks = sum(c["tasks"] for c in cells.values())
        total_omissions = sum(c["omissions"] for c in cells.values())
        total_g3 = sum(c["grade_3"] for c in cells.values())
        omission_rate = round(total_omissions / total_tasks, 4) if total_tasks else 0.0

        days_out: Dict[str, Any] = {}
        for ck in col_keys:
            cell = cells.get(ck)
            if not cell or cell["tasks"] == 0:
                days_out[ck] = None
            else:
                rate = round(cell["omissions"] / cell["tasks"], 4)
                days_out[ck] = {
                    "tasks": cell["tasks"],
                    "omissions": cell["omissions"],
                    "omission_rate": rate,
                    "grade_3_count": cell["grade_3"],
                    "task_ids": cell["tasks_ids"],
                }

        doctors_out.append({
            "id": rid,
            "name": doctor_names[rid],
            "total": {
                "tasks": total_tasks,
                "omissions": total_omissions,
                "omission_rate": omission_rate,
                "grade_3_count": total_g3,
            },
            "days": days_out,
        })

    doctors_out.sort(key=lambda d: d["total"]["tasks"], reverse=True)

    return {
        "col_keys": col_keys,
        "col_labels": col_labels,
        "doctors": doctors_out,
        "view": view,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
    }


@app.get("/api/doctor/{doctor_id}/detail")
async def doctor_detail(
    doctor_id: int,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
):
    today = date.today()
    start = _safe_date(start_date, today - timedelta(days=30))
    end = _safe_date(end_date, today)

    tasks = await _get_delivered_tasks(start, end)
    doctor_tasks = [t for t in tasks if t["rad_id"] == doctor_id]

    if not doctor_tasks:
        raise HTTPException(status_code=404, detail="No tasks found for doctor in period")

    task_ids = [t["task_id"] for t in doctor_tasks]
    cached = grading.get_cached_many(task_ids)
    doctor_name = doctor_tasks[0]["rad_name"]

    summary_totals: Dict[str, int] = {
        "grade_1_count": 0, "grade_2a_count": 0, "grade_2b_count": 0,
        "grade_3_count": 0, "grade_4_count": 0, "total_findings": 0,
    }
    category_counts: Dict[str, int] = defaultdict(int)
    category_g3_counts: Dict[str, int] = defaultdict(int)
    missed_findings: List[Dict[str, Any]] = []
    graded_task_count = 0
    clinical_concordance_sum = 0.0

    for t in doctor_tasks:
        tid = t["task_id"]
        if tid not in cached:
            continue
        g = cached[tid]
        s = g["summary"]
        graded_task_count += 1
        for k in summary_totals:
            summary_totals[k] += s.get(k, 0)
        clinical_concordance_sum += s.get("clinical_concordance_rate", 1.0)

        for f in g["findings"]:
            grade = f.get("grade", "1")
            if grade in ("2b", "3", "4"):
                cat = f.get("category", "other")
                category_counts[cat] += 1
                if grade in ("3", "4"):
                    category_g3_counts[cat] += 1
                # Reconstruct display text from whatever fields are populated
                finding_text = (f.get("finding_text") or "").strip()
                if not finding_text:
                    finding_text = (f.get("validator_text") or f.get("radiologist_text") or "").strip()
                if not finding_text:
                    finding_text = (f.get("location") or "").strip()
                if not finding_text:
                    # management_impact is sometimes a string description (grading artifact)
                    mi = f.get("management_impact")
                    if isinstance(mi, str) and len(mi) > 4:
                        finding_text = mi
                if not finding_text:
                    finding_text = f.get("grade_label") or f"Grade {grade} находка"
                missed_findings.append({
                        "date": str(t["delivered_date"]),
                        "task_id": tid,
                        "grade": grade,
                        "category": f.get("category", "other"),
                        "category_label": f.get("category_label", ""),
                        "finding_text": finding_text,
                        "management_impact": bool(f.get("management_impact")),
                        "location": f.get("location", ""),
                    })

    total_tasks = len(doctor_tasks)
    total_omissions = sum(
        1 for t in doctor_tasks
        if (t["task_id"] in cached and cached[t["task_id"]]["has_omissions"])
        or (t["task_id"] not in cached and int(t.get("max_version") or 1) > 1)
    )
    omission_rate = round(total_omissions / total_tasks, 4) if total_tasks else 0.0
    clinical_concordance: Optional[float] = (
        round(clinical_concordance_sum / graded_task_count, 4)
        if graded_task_count else None
    )

    by_date: Dict[str, Dict[str, int]] = defaultdict(lambda: {"tasks": 0, "omissions": 0})
    for t in doctor_tasks:
        dk = str(t["delivered_date"])
        by_date[dk]["tasks"] += 1
        tid = t["task_id"]
        if tid in cached and cached[tid]["has_omissions"]:
            by_date[dk]["omissions"] += 1
        elif tid not in cached and int(t.get("max_version") or 1) > 1:
            by_date[dk]["omissions"] += 1

    trend_data = [
        {
            "date": dk,
            "tasks": v["tasks"],
            "omissions": v["omissions"],
            "omission_rate": round(v["omissions"] / v["tasks"], 4) if v["tasks"] else 0.0,
        }
        for dk, v in sorted(by_date.items())
    ]

    category_breakdown = [
        {"category": cat, "label": CATEGORY_LABELS_RU.get(cat, cat), "count": cnt, "grade_3_count": category_g3_counts.get(cat, 0)}
        for cat, cnt in sorted(category_counts.items(), key=lambda x: -x[1])
    ]

    missed_findings.sort(key=lambda f: f["date"], reverse=True)

    return {
        "id": doctor_id,
        "name": doctor_name,
        "stats": {
            "total_tasks": total_tasks,
            "graded_tasks": graded_task_count,
            "omission_rate": omission_rate,
            "total_omissions": total_omissions,
            "grade_3_count": summary_totals["grade_3_count"],
            "clinical_concordance": clinical_concordance,
        },
        "grade_distribution": summary_totals,
        "trend_data": trend_data,
        "category_breakdown": category_breakdown,
        "missed_findings": missed_findings,
    }


@app.get("/api/task/{task_id}/reports")
async def get_task_reports(task_id: int):
    reports = await _get_task_reports(task_id)
    if not reports:
        raise HTTPException(status_code=404, detail="Reports not found")
    rad_report = reports[0]
    val_report = reports[-1]
    cached = grading.get_cached(task_id)
    return {
        "task_id": task_id,
        "radiologist_report": rad_report,
        "validator_report": val_report if len(reports) > 1 else None,
        "all_versions": len(reports),
        "grade": cached,
    }


@app.get("/api/task/{task_id}/translate")
async def translate_validator(task_id: int):
    """Return Russian translation of the validator's EN findings+impression + finding highlight phrases.
    Uses SQLite cache; translates via Google Translate on first request."""
    cached = _get_cached_translation(task_id)
    # Return cached only if it has finding_highlights populated
    if cached and cached.get("finding_highlights"):
        return {"task_id": task_id, "cached": True, **cached}

    reports = await _get_task_reports(task_id)
    if not reports or len(reports) < 2:
        raise HTTPException(status_code=404, detail="No validator report found")

    val = reports[-1]
    findings_en = (val.get("findings_en") or "").strip()
    impression_en = (val.get("impression_en") or "").strip()

    if not findings_en and not impression_en:
        raise HTTPException(status_code=422, detail="Validator has no English text to translate")

    # Use cached protocol translation if already stored, otherwise translate
    findings_ru = cached["findings_ru"] if cached and cached.get("findings_ru") else (
        await _translate_en_to_ru(findings_en) if findings_en else ""
    )
    impression_ru = cached["impression_ru"] if cached and cached.get("impression_ru") else (
        await _translate_en_to_ru(impression_en) if impression_en else ""
    )

    # Translate each finding's validator_text (EN snippet) → RU for inline highlighting
    import json as _json
    grade_cache = grading.get_cached(task_id)
    finding_highlights: Dict[str, str] = {}
    if grade_cache:
        for f in grade_cache.get("findings", []):
            fid = str(f.get("id", ""))
            vtxt = (f.get("validator_text") or "").strip()
            if vtxt and fid:
                ru = await _translate_en_to_ru(vtxt)
                if ru:
                    finding_highlights[fid] = ru
                await asyncio.sleep(0.3)  # gentle rate-limiting between snippet calls

    _save_translation_cache(task_id, findings_ru, impression_ru, finding_highlights)
    return {"task_id": task_id, "cached": False, "findings_ru": findings_ru,
            "impression_ru": impression_ru, "finding_highlights": finding_highlights}


@app.post("/api/task/{task_id}/grade")
async def grade_task(task_id: int):
    reports = await _get_task_reports(task_id)
    if not reports:
        raise HTTPException(status_code=404, detail="Reports not found")
    if len(reports) < 2:
        raise HTTPException(
            status_code=422, detail="Task has only one report version — nothing to compare"
        )
    return await grading.grade_task(task_id, reports[0], reports[-1])


@app.get("/api/workload")
async def workload(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    view: Literal["days", "weeks"] = Query("days"),
):
    today = date.today()
    start = _safe_date(start_date, today - timedelta(days=11))
    end = _safe_date(end_date, today)

    tasks = await _get_delivered_tasks(start, end)
    schedule = await _get_schedule_entries(start, end)

    if view == "weeks":
        col_dates = _week_range(start, end)
        col_labels = [_week_label(d) for d in col_dates]
    else:
        col_dates = _date_range(start, end)
        col_labels = [_day_label(d) for d in col_dates]
    col_keys = [d.isoformat() for d in col_dates]

    def _col_key(d_str: str) -> str:
        try:
            d = date.fromisoformat(str(d_str))
        except Exception:
            return str(d_str)
        if view == "weeks":
            return (d - timedelta(days=d.weekday())).isoformat()
        return d.isoformat()

    schedule_map: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for entry in schedule:
        uid = entry.get("user_id")
        sd = str(entry.get("schedule_date", ""))
        hours = int(entry.get("shift_hours", 0) or 0)
        if uid and sd:
            schedule_map[uid][_col_key(sd)] += hours

    task_map: Dict[int, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
    doctor_names: Dict[int, str] = {}
    for t in tasks:
        rid = t["rad_id"]
        doctor_names[rid] = t["rad_name"]
        dk = _col_key(str(t["delivered_date"]))
        task_map[rid][dk] += 1

    all_ids = set(task_map.keys()) | set(schedule_map.keys())
    doctors_out: List[Dict[str, Any]] = []

    for rid in all_ids:
        name = doctor_names.get(rid, f"User #{rid}")
        total_tasks = sum(task_map[rid].values())
        total_hours = sum(schedule_map[rid].values())
        active_days = sum(1 for v in task_map[rid].values() if v > 0)
        avg_per_day = round(total_tasks / active_days, 1) if active_days else 0.0

        days_out: Dict[str, Any] = {}
        for ck in col_keys:
            t_cnt = task_map[rid].get(ck, 0)
            h_cnt = schedule_map[rid].get(ck, 0)
            days_out[ck] = {"tasks": t_cnt, "hours": h_cnt} if (t_cnt or h_cnt) else None

        doctors_out.append({
            "id": rid,
            "name": name,
            "total": {
                "tasks": total_tasks,
                "hours": total_hours,
                "active_days": active_days,
                "avg_per_day": avg_per_day,
            },
            "days": days_out,
        })

    doctors_out.sort(key=lambda d: d["total"]["tasks"], reverse=True)

    return {
        "col_keys": col_keys,
        "col_labels": col_labels,
        "doctors": doctors_out,
        "view": view,
        "period": {"start": start.isoformat(), "end": end.isoformat()},
    }


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def serve_dashboard():
    html_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "..", "static", "index.html"
    )
    with open(html_path, encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/debug/events", include_in_schema=False)
async def debug_events():
    r1 = await mcp.execute_sql("SELECT DISTINCT data->>'action' as action, COUNT(*) as cnt FROM task_events GROUP BY 1 ORDER BY 2 DESC LIMIT 20")
    r2 = await mcp.execute_sql("SELECT MIN(created_at), MAX(created_at), COUNT(*) FROM task_events")
    r3 = await mcp.execute_sql("SELECT COUNT(*) as cnt FROM tasks WHERE reporting_radiologist_id IS NOT NULL")
    return {"actions": r1, "date_range": r2, "tasks_with_rad": r3}


@app.get("/api/debug/schema", include_in_schema=False)
async def debug_schema():
    cols = await mcp.execute_sql("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='task_events' ORDER BY ordinal_position")
    sample = await mcp.execute_sql("SELECT * FROM task_events LIMIT 1")
    return {"columns": cols, "sample": sample}
