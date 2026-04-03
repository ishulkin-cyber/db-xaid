import { useEffect, useState } from "react";
import { api } from "../api";
import type { GradeResult, TaskReports } from "../types";

interface Props {
  taskId: number;
  onClose: () => void;
}

const SECTION_ORDER = [
  "INDICATION", "COMPARISON", "TECHNIQUE", "RADIATION DOSE",
  "LUNGS AND PLEURA", "MEDIASTINUM", "HEART", "AORTA",
  "PLEURA", "CHEST WALL", "UPPER ABDOMEN", "IMPRESSION", "RECOMMENDATION",
];

const GRADE_COLORS: Record<string, string> = {
  "1": "#4ade80",
  "2a": "#60a5fa",
  "2b": "#fb923c",
  "3": "#f87171",
  "4": "#c084fc",
};

const GRADE_LABELS: Record<string, string> = {
  "1": "Concordant", "2a": "Stylistic", "2b": "Minor", "3": "Missed", "4": "Overreport",
};

// Map finding category → keywords that appear in section headers (RU or EN)
const CATEGORY_SECTION_KEYWORDS: Record<string, string[]> = {
  lung:        ["LUNG", "PLEURA", "ЛЕГК", "ПЛЕВР", "НАХОДК", "FINDINGS"],
  cardiac:     ["HEART", "CARDIAC", "СЕРДЦ", "ПЕРИКАРД"],
  vascular:    ["AORTA", "VESSEL", "АОРТ", "СОСУД", "GREAT"],
  mediastinum: ["MEDIAST", "HILA", "СРЕДОСТ", "КОРН", "ЛИМФ"],
  bone:        ["CHEST WALL", "OSSEOUS", "BONE", "КОСТН", "ГРУДН"],
  abdomen:     ["ABDOMEN", "БРЮШН", "UPPER"],
  impression:  ["IMPRESSION", "ЗАКЛЮЧ", "РЕКОМЕН", "RECOMMENDATION"],
};

function parseSection(text: string | null): Record<string, string> {
  if (!text) return {};
  const sections: Record<string, string> = {};
  const lines = text.split("\n");
  let current = "GENERAL";
  let buf: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ /&]+):?\s*$/);
    if (match) {
      if (buf.length) sections[current] = buf.join("\n").trim();
      current = match[1].trim();
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) sections[current] = buf.join("\n").trim();
  return sections;
}

const GRADE_ORDER = ["4", "3", "2b", "2a", "1"];
function worstGrade(grades: string[]): string | null {
  for (const g of GRADE_ORDER) {
    if (grades.includes(g)) return g;
  }
  return null;
}

export default function ReportComparison({ taskId, onClose }: Props) {
  const [reports, setReports] = useState<TaskReports | null>(null);
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api.taskReports(taskId)
      .then((r) => {
        setReports(r);
        if (r.grade) setGradeResult(r.grade);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [taskId]);

  async function doGrade() {
    setGrading(true);
    try {
      const result = await api.gradeTask(taskId);
      setGradeResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка грейдинга");
    } finally {
      setGrading(false);
    }
  }

  const rad = reports?.radiologist_report;
  const val = reports?.validator_report;

  const radText = rad
    ? [rad.protocol, rad.findings, rad.impression].filter(Boolean).join("\n\n")
    : null;
  const valTextRu = val
    ? [val.protocol, val.findings, val.impression].filter(Boolean).join("\n\n")
    : null;
  const valTextEn = val
    ? [val.protocol_en, val.findings_en, val.impression_en].filter(Boolean).join("\n\n")
    : null;

  const radSections = parseSection(radText);
  const valRuSections = parseSection(valTextRu);
  const valEnSections = parseSection(valTextEn);

  const allKeys = [
    ...SECTION_ORDER.filter((s) => radSections[s] || valRuSections[s] || valEnSections[s]),
    ...Object.keys({ ...radSections, ...valRuSections, ...valEnSections }).filter(
      (k) => !SECTION_ORDER.includes(k) && k !== "GENERAL"
    ),
  ];

  // Return all findings that belong to a section key (by category keyword match)
  function findingsForSection(sectionKey: string) {
    if (!gradeResult) return [];
    const keyUpper = sectionKey.toUpperCase();
    return gradeResult.findings.filter((f) => {
      const cat = (f.category ?? "").toLowerCase();
      const keywords = CATEGORY_SECTION_KEYWORDS[cat] ?? [];
      // section key matches one of this category's keywords
      const sectionMatchesCat = keywords.some((kw) => keyUpper.includes(kw));
      // OR finding's location/category string matches the section key
      const locMatch = (f.location ?? "").toUpperCase().split(/[,\s]+/).some((w) => w.length > 2 && keyUpper.includes(w));
      const catMatch = keyUpper.includes(cat.toUpperCase());
      return sectionMatchesCat || locMatch || catMatch;
    });
  }

  // For sections that don't have a category match, collect ungrouped findings
  function ungroupedFindings() {
    if (!gradeResult) return [];
    const grouped = new Set<number>();
    for (const key of allKeys) {
      findingsForSection(key).forEach((f) => grouped.add(f.id));
    }
    return gradeResult.findings.filter((f) => !grouped.has(f.id));
  }

  const gs = gradeResult?.summary;
  const concordanceItems = gs
    ? [
        { n: gs.grade_1_count, label: "совпадают", color: "#4ade80" },
        { n: gs.grade_2a_count, label: "стилистика", color: "#60a5fa" },
        { n: gs.grade_2b_count, label: "minor", color: "#fb923c" },
        { n: gs.grade_3_count, label: "пропуски", color: "#f87171" },
        { n: gs.grade_4_count, label: "overreport", color: "#c084fc" },
      ].filter((x) => x.n > 0)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#141414] border border-zinc-700 rounded-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">
              Сравнение протоколов — задача #{taskId}
            </span>
            {gradeResult && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                {concordanceItems.map((c) => (
                  <span key={c.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    {c.n} {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!gradeResult && val && (
              <button
                onClick={doGrade}
                disabled={grading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm text-white transition-colors"
              >
                {grading ? "Грейдинг..." : "Проградировать (RADPEER)"}
              </button>
            )}
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-lg">✕</button>
          </div>
        </div>

        {error && <div className="px-5 py-2 bg-red-400/10 text-red-400 text-sm">{error}</div>}

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">Загрузка...</div>
        ) : !reports ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">Протоколы не найдены</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Column headers */}
            <div className="sticky top-0 grid grid-cols-3 bg-[#141414] z-10 border-b border-zinc-800">
              <div className="px-5 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Врач-описывающий <span className="text-zinc-600 font-normal normal-case">(RU)</span>
              </div>
              <div className="px-5 py-2 text-xs font-semibold text-green-400 uppercase tracking-wider border-l border-zinc-800">
                Валидатор (итоговый RU)
              </div>
              <div className="px-5 py-2 text-xs font-semibold text-purple-400 uppercase tracking-wider border-l border-zinc-800">
                Валидатор (оригинал EN)
              </div>
            </div>

            {allKeys.length > 0 ? (
              allKeys.map((key) => {
                const radVal = radSections[key];
                const valRuVal = valRuSections[key];
                const valEnVal = valEnSections[key];
                const isDiff = radVal !== valRuVal;

                const sectionFindings = findingsForSection(key);
                const sectionWorstGrade = worstGrade(sectionFindings.map((f) => f.grade));
                const highlightColor = sectionWorstGrade ? GRADE_COLORS[sectionWorstGrade] : null;

                // Only show non-grade-1 findings as inline annotations
                const annotationFindings = sectionFindings.filter((f) => f.grade !== "1");

                return (
                  <div key={key} className="border-b border-zinc-800/50">
                    {/* Section label row */}
                    <div className={`px-5 py-1.5 flex items-center gap-2 ${isDiff || highlightColor ? "bg-zinc-800/30" : ""}`}>
                      <span
                        className="text-xs font-semibold uppercase tracking-wider"
                        style={{ color: highlightColor ?? (isDiff ? "#facc15" : "#71717a") }}
                      >
                        {key}
                      </span>
                      {sectionWorstGrade && (
                        <span
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                          style={{
                            background: GRADE_COLORS[sectionWorstGrade] + "25",
                            color: GRADE_COLORS[sectionWorstGrade],
                            border: `1px solid ${GRADE_COLORS[sectionWorstGrade]}50`,
                          }}
                        >
                          G{sectionWorstGrade} · {GRADE_LABELS[sectionWorstGrade]}
                        </span>
                      )}
                    </div>

                    {/* Three columns */}
                    <div className="grid grid-cols-3">
                      {/* Doctor RU */}
                      <div className="px-5 pb-3 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {radVal || <span className="text-zinc-700 italic">—</span>}
                      </div>

                      {/* Validator RU — highlighted if has findings */}
                      <div
                        className="px-5 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap border-l border-zinc-800"
                        style={
                          highlightColor
                            ? {
                                borderLeft: `3px solid ${highlightColor}60`,
                                background: highlightColor + "08",
                                color: sectionWorstGrade === "3" || sectionWorstGrade === "4"
                                  ? "#fca5a5"
                                  : sectionWorstGrade === "2b"
                                  ? "#fed7aa"
                                  : "#d1fae5",
                              }
                            : isDiff
                            ? { color: "#bbf7d0" }
                            : { color: "#d4d4d8" }
                        }
                      >
                        {valRuVal || <span className="text-zinc-700 italic">—</span>}

                        {/* Inline finding annotations */}
                        {annotationFindings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {annotationFindings.map((f) => {
                              const c = GRADE_COLORS[f.grade] ?? "#9ca3af";
                              return (
                                <div
                                  key={f.id}
                                  className="flex gap-1.5 items-start p-1.5 rounded text-[11px]"
                                  style={{ background: c + "15", border: `1px solid ${c}30` }}
                                >
                                  <span
                                    className="shrink-0 font-bold px-1 py-0.5 rounded text-[10px]"
                                    style={{ background: c + "30", color: c }}
                                  >
                                    G{f.grade}
                                  </span>
                                  <div style={{ color: c }}>
                                    <div className="font-medium">{f.finding_text}</div>
                                    {f.validator_text && f.validator_text !== f.finding_text && (
                                      <div className="opacity-75 mt-0.5">{f.validator_text}</div>
                                    )}
                                    {f.management_impact && (
                                      <div className="opacity-60 mt-0.5 text-orange-300">{f.management_impact}</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Validator EN — section-level highlight only */}
                      <div
                        className="px-5 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap border-l border-zinc-800"
                        style={
                          highlightColor
                            ? {
                                borderLeft: `3px solid ${highlightColor}60`,
                                background: highlightColor + "08",
                                color: "#e9d5ff",
                              }
                            : { color: "#e9d5ff" }
                        }
                      >
                        {valEnVal || <span className="text-zinc-700 italic">—</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-3">
                <div className="px-5 py-4 font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {radText || <span className="text-zinc-600">Нет текста</span>}
                </div>
                <div className="px-5 py-4 font-mono text-xs text-green-200 leading-relaxed whitespace-pre-wrap border-l border-zinc-800">
                  {valTextRu || <span className="text-zinc-600">Нет перевода</span>}
                </div>
                <div className="px-5 py-4 font-mono text-xs text-purple-200 leading-relaxed whitespace-pre-wrap border-l border-zinc-800">
                  {valTextEn || <span className="text-zinc-600">Нет текста валидатора</span>}
                </div>
              </div>
            )}

            {/* Ungrouped findings (impression/other that didn't match any section) */}
            {(() => {
              const unmatched = ungroupedFindings().filter((f) => f.grade !== "1");
              if (!unmatched.length) return null;
              return (
                <div className="px-5 py-4 border-t border-zinc-700">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                    Прочие находки (RADPEER)
                  </h3>
                  <div className="space-y-1.5">
                    {unmatched.map((f) => {
                      const c = GRADE_COLORS[f.grade] ?? "#9ca3af";
                      return (
                        <div
                          key={f.id}
                          className="flex gap-2 p-2 rounded text-xs"
                          style={{ background: c + "12", border: `1px solid ${c}25` }}
                        >
                          <span
                            className="shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: c + "30", color: c }}
                          >
                            G{f.grade}
                          </span>
                          <div style={{ color: c }}>
                            <span className="font-medium">{f.finding_text}</span>
                            {f.management_impact && (
                              <span className="ml-2 text-orange-300 opacity-75">{f.management_impact}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
