"use client";

import { useState, useMemo } from "react";
import { parseReportSections, type ReportSection, type DiffSegment } from "@/lib/report-diff";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";

interface ReportDiffProps {
  doctorText: string;
  validatorText: string;
  /** Pass empty string (or omit) for 2-way Doctor vs Validator mode */
  simonmedText?: string;
  showDoctor?: boolean;
}

type ComparisonPair = "doctor-validator" | "validator-simonmed" | "doctor-simonmed";
type ChangeLevel = "identical" | "stylistic" | "minor" | "significant";
type ColumnKey = "doctor" | "validator" | "simonmed";

const pairLabels: Record<ComparisonPair, string> = {
  "doctor-validator": "Doctor vs Validator",
  "validator-simonmed": "Validator vs SimonMed",
  "doctor-simonmed": "Doctor vs SimonMed",
};

const changeLevelStyle: Record<ChangeLevel, { dot: string; label: string }> = {
  identical:   { dot: "bg-emerald-500", label: "Identical" },
  stylistic:   { dot: "bg-blue-400",    label: "Stylistic" },
  minor:       { dot: "bg-amber-500",   label: "Minor" },
  significant: { dot: "bg-red-500",     label: "Significant" },
};

interface MatchedRow {
  heading: string;
  doctor:    ReportSection | null;
  validator: ReportSection | null;
  simonmed:  ReportSection | null;
}

function classifyChange(a: string, b: string): ChangeLevel {
  if (!a && !b) return "identical";
  if (a.trim() === b.trim()) return "identical";
  const na = a.toLowerCase().replace(/\s+/g, " ").trim();
  const nb = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (na === nb) return "stylistic";
  const changes = diffWords(a.trim(), b.trim(), { ignoreCase: false });
  const total   = changes.reduce((s, c) => s + c.value.split(/\s+/).filter(Boolean).length, 0);
  const changed = changes.filter((c) => c.added || c.removed)
    .reduce((s, c) => s + c.value.split(/\s+/).filter(Boolean).length, 0);
  const ratio = changed / Math.max(total, 1);
  if (ratio < 0.15) return "stylistic";
  if (ratio < 0.4)  return "minor";
  return "significant";
}

function computeWordDiff(left: string, right: string): { leftSegs: DiffSegment[]; rightSegs: DiffSegment[] } {
  const changes = diffWords(left.trim(), right.trim(), { ignoreCase: false });
  const leftSegs:  DiffSegment[] = [];
  const rightSegs: DiffSegment[] = [];
  for (const c of changes) {
    if (c.added)        rightSegs.push({ text: c.value, type: "added" });
    else if (c.removed) leftSegs.push({ text: c.value, type: "removed" });
    else {
      leftSegs.push({ text: c.value, type: "equal" });
      rightSegs.push({ text: c.value, type: "equal" });
    }
  }
  return { leftSegs, rightSegs };
}

function DiffSpan({ segments, side }: { segments: DiffSegment[]; side: "left" | "right" }) {
  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === "equal") return <span key={i}>{seg.text}</span>;
        if (seg.type === "removed" && side === "left")
          return <span key={i} className="bg-red-200/80 text-red-900 rounded-sm">{seg.text}</span>;
        if (seg.type === "added" && side === "right")
          return <span key={i} className="bg-emerald-200/80 text-emerald-900 rounded-sm">{seg.text}</span>;
        return null;
      })}
    </span>
  );
}

function matchSections(doc: ReportSection[], val: ReportSection[], sm: ReportSection[]): MatchedRow[] {
  const seen = new Set<string>();
  const allNorm: string[] = [];
  for (const s of [...doc, ...val, ...sm]) {
    if (!seen.has(s.normalizedHeading)) {
      seen.add(s.normalizedHeading);
      allNorm.push(s.normalizedHeading);
    }
  }
  const docMap = new Map(doc.map((s) => [s.normalizedHeading, s]));
  const valMap = new Map(val.map((s) => [s.normalizedHeading, s]));
  const smMap  = new Map(sm.map((s)  => [s.normalizedHeading, s]));
  return allNorm.map((norm) => {
    const d = docMap.get(norm) ?? null;
    const v = valMap.get(norm) ?? null;
    const s = smMap.get(norm)  ?? null;
    const heading = d?.heading ?? v?.heading ?? s?.heading ?? norm;
    return { heading, doctor: d, validator: v, simonmed: s };
  });
}

function SectionRow({
  row,
  pair,
  columns,
}: {
  row: MatchedRow;
  pair: ComparisonPair;
  columns: ColumnKey[];
}) {
  const leftKey:  ColumnKey = pair === "validator-simonmed" ? "validator" : "doctor";
  const rightKey: ColumnKey = pair === "doctor-validator"   ? "validator" : "simonmed";

  const leftContent  = row[leftKey]?.content  ?? "";
  const rightContent = row[rightKey]?.content ?? "";
  const level = classifyChange(leftContent, rightContent);
  const style = changeLevelStyle[level];
  const isIdentical = level === "identical";

  const { leftSegs, rightSegs } = isIdentical
    ? { leftSegs: [], rightSegs: [] }
    : computeWordDiff(leftContent, rightContent);

  const gridCols = columns.length === 2 ? "grid-cols-2" : "grid-cols-3";

  function renderCell(col: ColumnKey) {
    const content = row[col]?.content ?? "";
    const isInPair = col === leftKey || col === rightKey;
    if (!content)
      return <span className="text-muted-foreground italic">Not present</span>;
    if (!isInPair || isIdentical)
      return <span className={isIdentical && isInPair ? "text-muted-foreground" : ""}>{content}</span>;
    if (col === leftKey)  return <DiffSpan segments={leftSegs}  side="left" />;
    return <DiffSpan segments={rightSegs} side="right" />;
  }

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
        <span className={cn("h-2 w-2 rounded-full shrink-0", style.dot)} />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {row.heading}
        </span>
        {!isIdentical && (
          <span className="text-[10px] text-muted-foreground ml-auto">{style.label}</span>
        )}
      </div>
      <div className={cn("grid divide-x", gridCols)}>
        {columns.map((col) => (
          <div key={col} className="p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap">
            {renderCell(col)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportDiff({
  doctorText,
  validatorText,
  simonmedText = "",
  showDoctor = true,
}: ReportDiffProps) {
  // 2-way mode when simonmedText is empty
  const twoWay = !simonmedText.trim();

  const defaultPair: ComparisonPair = "doctor-validator";
  const [pair, setPair] = useState<ComparisonPair>(defaultPair);

  const availablePairs: ComparisonPair[] = twoWay
    ? ["doctor-validator"]
    : showDoctor
    ? ["doctor-validator", "validator-simonmed", "doctor-simonmed"]
    : ["validator-simonmed"];

  const docSections = useMemo(() => parseReportSections(doctorText),    [doctorText]);
  const valSections = useMemo(() => parseReportSections(validatorText), [validatorText]);
  const smSections  = useMemo(() => parseReportSections(simonmedText),  [simonmedText]);

  const rows = useMemo(
    () => matchSections(showDoctor ? docSections : [], valSections, twoWay ? [] : smSections),
    [docSections, valSections, smSections, showDoctor, twoWay]
  );

  // Stats for the selected pair
  const stats = useMemo(() => {
    const leftKey:  ColumnKey = pair === "validator-simonmed" ? "validator" : "doctor";
    const rightKey: ColumnKey = pair === "doctor-validator"   ? "validator" : "simonmed";
    const counts = { identical: 0, stylistic: 0, minor: 0, significant: 0 };
    for (const r of rows) {
      const l  = r[leftKey]?.content  ?? "";
      const rv = r[rightKey]?.content ?? "";
      counts[classifyChange(l, rv)]++;
    }
    return counts;
  }, [rows, pair]);

  // Column setup
  const columnHeaders: { key: ColumnKey; label: string }[] = twoWay
    ? [
        { key: "doctor",    label: "Doctor (EN)" },
        { key: "validator", label: "Validator (EN)" },
      ]
    : showDoctor
    ? [
        { key: "doctor",    label: "Doctor (EN)" },
        { key: "validator", label: "Validator's Version" },
        { key: "simonmed",  label: "SimonMed Final" },
      ]
    : [
        { key: "validator", label: "Validator's Version" },
        { key: "simonmed",  label: "SimonMed Final" },
      ];

  const columns: ColumnKey[] = columnHeaders.map((h) => h.key);
  const gridCols = columns.length === 2 ? "grid-cols-2" : "grid-cols-3";

  const leftKey:  ColumnKey = pair === "validator-simonmed" ? "validator" : "doctor";
  const rightKey: ColumnKey = pair === "doctor-validator"   ? "validator" : "simonmed";

  return (
    <div className="space-y-3">
      {/* Legend + pair selector */}
      <div className="flex items-center gap-4 flex-wrap">
        {availablePairs.length > 1 && (
          <div className="flex gap-1">
            {availablePairs.map((p) => (
              <button
                key={p}
                onClick={() => setPair(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                  pair === p
                    ? "bg-foreground text-background border-foreground"
                    : "bg-white text-muted-foreground border-border hover:bg-slate-50"
                )}
              >
                {pairLabels[p]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3 text-xs text-muted-foreground ml-auto flex-wrap">
          {(["identical", "stylistic", "minor", "significant"] as ChangeLevel[]).map(
            (level) =>
              stats[level] > 0 && (
                <span key={level} className="flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", changeLevelStyle[level].dot)} />
                  {stats[level]} {changeLevelStyle[level].label.toLowerCase()}
                </span>
              )
          )}
        </div>
      </div>

      {/* Column headers */}
      <div className={cn("grid divide-x border rounded-t-lg bg-muted/50", gridCols)}>
        {columnHeaders.map(({ key, label }) => {
          const isCompared = key === leftKey || key === rightKey;
          return (
            <div key={key} className={cn("px-3 py-2 text-sm font-semibold", !isCompared && "text-muted-foreground")}>
              {label}
              {isCompared && (
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {key === leftKey ? "(base)" : "(compared)"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Rows */}
      <div className="border rounded-b-lg overflow-hidden -mt-3">
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Нет секций для сравнения
          </div>
        ) : (
          rows.map((row, i) => (
            <SectionRow key={i} row={row} pair={pair} columns={columns} />
          ))
        )}
      </div>
    </div>
  );
}
