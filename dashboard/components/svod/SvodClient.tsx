"use client";

import { useEffect, useState, Suspense } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import Link from "next/link";
import type { GradeTrendPoint, RootCauseData } from "@/lib/data";
import { PeriodSelector } from "@/components/PeriodSelector";
import type { PeriodMode } from "@/lib/period";

const STORAGE_KEY = "svod-grade-targets-v2";

type GradeKey = "clinConcordance" | "g2bNonMipsPct" | "g2bMipsPct" | "g3PlusPct" | "g4Pct";

interface RowDef {
  key: GradeKey;
  label: string;
  desc: string;
  higherIsBetter: boolean;
  color: string;
  lineColor: string;
}

const ROWS: RowDef[] = [
  {
    key: "clinConcordance",
    label: "Клин. конкордантность (G1+G2a)",
    desc: "Находки без клинически значимых расхождений",
    higherIsBetter: true,
    color: "text-blue-600",
    lineColor: "#3b82f6",
  },
  {
    key: "g2bNonMipsPct",
    label: "G2b — мин. клинические",
    desc: "Расхождения, не влияющие на тактику (без MIPS)",
    higherIsBetter: false,
    color: "text-amber-500",
    lineColor: "#f59e0b",
  },
  {
    key: "g2bMipsPct",
    label: "G2b-MIPS — compliance",
    desc: "Расхождения по MIPS/QCDR мерам (ACRad44, 364, 405, 406, QMM23)",
    higherIsBetter: false,
    color: "text-amber-700",
    lineColor: "#b45309",
  },
  {
    key: "g3PlusPct",
    label: "Значимые расхождения (G3)",
    desc: "Пропуски, влияющие на тактику (underreport)",
    higherIsBetter: false,
    color: "text-red-600",
    lineColor: "#ef4444",
  },
  {
    key: "g4Pct",
    label: "Grade 4 — гипердиагностика",
    desc: "Значимые находки в отчёте врача, отсутствующие у валидатора",
    higherIsBetter: false,
    color: "text-orange-600",
    lineColor: "#ea580c",
  },
];

function PctDelta({
  curr, prev, invert = false,
}: {
  curr: number; prev: number; invert?: boolean;
}) {
  const diff = Math.round((curr - prev) * 10) / 10;
  if (diff === 0) return null;
  const positive = diff > 0;
  const good = invert ? !positive : positive;
  return (
    <span className={`ml-1 text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {positive ? "▲" : "▼"}{Math.abs(diff)}%
    </span>
  );
}

interface DoctorImpact {
  doctor_id: number;
  doctor_name: string;
  total_studies: number;
  total_findings: number;
  grade3plus: number;
  grade3plusPct: number;
  mips2b: number;
  mips2bPct: number;
  clinConcordance: number;
}

interface Props {
  mode: PeriodMode;
  ref_: string;
  compareEnabled: boolean;
  periodLabel: string;
  prevPeriodLabel: string;
  trendData: GradeTrendPoint[];
  currentPoint: GradeTrendPoint | null;
  prevPoint: GradeTrendPoint | null;
  doctorImpact: DoctorImpact[];
  prevDoctorImpactMap: Record<number, DoctorImpact>;
  rootCause: RootCauseData;
}

export function SvodClient({
  mode, ref_, compareEnabled, periodLabel, prevPeriodLabel,
  trendData, currentPoint, prevPoint, doctorImpact, prevDoctorImpactMap, rootCause,
}: Props) {
  const [targets, setTargets] = useState<Partial<Record<GradeKey, string>>>({});
  const [visible, setVisible] = useState<Record<GradeKey, boolean>>({
    clinConcordance: true,
    g2bNonMipsPct: true,
    g2bMipsPct: true,
    g3PlusPct: true,
    g4Pct: true,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setTargets(JSON.parse(saved));
  }, []);

  function saveTarget(key: GradeKey, val: string) {
    const next = { ...targets, [key]: val };
    setTargets(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  // Current = selected period point, fallback to last in trend
  const fallback = trendData[trendData.length - 1];
  const point = currentPoint ?? fallback;

  const currentValues: Record<GradeKey, number> = {
    clinConcordance: point?.clinConcordance ?? 0,
    g2bNonMipsPct:  point?.g2bNonMipsPct ?? 0,
    g2bMipsPct:     point?.g2bMipsPct ?? 0,
    g3PlusPct:      point?.g3PlusPct ?? 0,
    g4Pct:          point?.g4Pct ?? 0,
  };

  const prevValues: Record<GradeKey, number> | null = prevPoint ? {
    clinConcordance: prevPoint.clinConcordance,
    g2bNonMipsPct:  prevPoint.g2bNonMipsPct,
    g2bMipsPct:     prevPoint.g2bMipsPct,
    g3PlusPct:      prevPoint.g3PlusPct,
    g4Pct:          prevPoint.g4Pct,
  } : null;

  // Reference lines for set targets
  const refLines = ROWS.flatMap((row) => {
    if (!visible[row.key]) return [];
    const t = parseFloat(targets[row.key] ?? "");
    if (isNaN(t)) return [];
    return [{ key: row.key, value: t, color: row.lineColor }];
  });

  const chartMode = mode === "week" ? "неделям" : mode === "month" ? "месяцам" : "годам";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Свод</h1>
          <p className="mt-1 text-muted-foreground">
            Динамика качества описаний по грейдам
          </p>
        </div>
      </div>

      {/* Period selector */}
      <Suspense>
        <PeriodSelector
          mode={mode}
          ref_={ref_}
          label={periodLabel}
          compareEnabled={compareEnabled}
        />
      </Suspense>

      {compareEnabled && (
        <p className="text-sm text-muted-foreground">
          Сравнение:{" "}
          <span className="font-medium text-foreground">{periodLabel}</span>
          {" "} vs{" "}
          <span className="font-medium text-foreground">{prevPeriodLabel}</span>
        </p>
      )}

      {/* Target settings */}
      <Card>
        <CardHeader>
          <CardTitle>Целевые показатели</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground w-8"></th>
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Метрика</th>
                <th className="py-2 px-4 text-right font-medium text-muted-foreground">Текущее</th>
                {compareEnabled && (
                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">
                    Δ vs {prevPeriodLabel}
                  </th>
                )}
                <th className="py-2 px-4 text-right font-medium text-muted-foreground">Цель %</th>
                <th className="py-2 pl-4 text-center font-medium text-muted-foreground">Статус</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const curr = currentValues[row.key];
                const raw = targets[row.key];
                const target = raw !== undefined && raw !== "" ? parseFloat(raw) : NaN;
                const hasTarget = !isNaN(target);
                const ok = hasTarget &&
                  (row.higherIsBetter ? curr >= target : curr <= target);
                return (
                  <tr key={row.key} className="border-b last:border-0">
                    {/* Toggle visibility */}
                    <td className="py-3 pr-2">
                      <button
                        onClick={() =>
                          setVisible((v) => ({ ...v, [row.key]: !v[row.key] }))
                        }
                        className="flex items-center"
                        title={visible[row.key] ? "Скрыть на графике" : "Показать на графике"}
                      >
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{
                            background: row.lineColor,
                            opacity: visible[row.key] ? 1 : 0.25,
                          }}
                        />
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.desc}</p>
                    </td>
                    <td className={`py-3 px-4 text-right text-lg font-bold ${row.color}`}>
                      {curr}%
                    </td>
                    {compareEnabled && (
                      <td className="py-3 px-4 text-right">
                        {prevValues ? (
                          <PctDelta
                            curr={curr}
                            prev={prevValues[row.key]}
                            invert={!row.higherIsBetter}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={targets[row.key] ?? ""}
                          placeholder="—"
                          onChange={(e) => saveTarget(row.key, e.target.value)}
                          className="w-20 rounded border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </td>
                    <td className="py-3 pl-4 text-center">
                      {!hasTarget ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : ok ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          ✓ Достигнута
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                          ✗ Не достигнута
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Цели сохраняются в браузере и отображаются на графике пунктиром.
          </p>
        </CardContent>
      </Card>

      {/* Root Cause Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Анализ причин</CardTitle>
          <p className="text-sm text-muted-foreground">
            Почему показатели не укладываются в цели
          </p>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Row 1: G3+ categories + MIPS measures */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

            {/* G3+ top categories */}
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Топ категорий значимых пропусков (G3+)
              </p>
              {rootCause.g3TopCategories.length === 0 ? (
                <p className="text-sm text-emerald-600">Нет G3+ за период ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {rootCause.g3TopCategories.map(({ category, count, pct }) => (
                    <div key={category} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <span className="truncate text-foreground">{category}</span>
                          <span className="ml-2 text-muted-foreground shrink-0">{count} ({pct}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MIPS top measures */}
            <div>
              <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-700" />
                Топ нарушений MIPS (2b-MIPS)
              </p>
              {rootCause.mipsTopMeasures.length === 0 ? (
                <p className="text-sm text-emerald-600">Нет MIPS-нарушений за период ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {rootCause.mipsTopMeasures.map(({ measure, label, count }) => (
                    <div key={measure} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <div>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{measure}</span>
                        <span>{label}</span>
                      </div>
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 ml-2 shrink-0">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Concentration + Mix effect */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t">

            {/* G3+ concentration */}
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">Концентрация G3+</p>
              {rootCause.g3Concentration === null ? (
                <p className="text-sm text-emerald-600 font-medium">G3+ отсутствуют ✓</p>
              ) : rootCause.g3Concentration.isSystemic ? (
                <>
                  <p className="text-sm font-semibold text-amber-700">⚠ Системная проблема</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    G3+ распределены между несколькими врачами. Лидер:{" "}
                    <Link href={`/doctors/${rootCause.g3Concentration.topDoctorId}`} className="text-blue-600 hover:underline">
                      {rootCause.g3Concentration.topDoctorName}
                    </Link>{" "}
                    ({rootCause.g3Concentration.topCount} из {rootCause.g3Concentration.totalG3}, {rootCause.g3Concentration.topPct}%)
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-700">⚡ Индивидуальная проблема</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Link href={`/doctors/${rootCause.g3Concentration.topDoctorId}`} className="text-blue-600 hover:underline">
                      {rootCause.g3Concentration.topDoctorName}
                    </Link>{" "}
                    отвечает за {rootCause.g3Concentration.topPct}% всех G3+ ({rootCause.g3Concentration.topCount} из {rootCause.g3Concentration.totalG3})
                  </p>
                </>
              )}
            </div>

            {/* Mix effect */}
            <div className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground mb-1">Эффект состава</p>
              <p className="text-sm font-semibold">
                {rootCause.mixEffect.currLowPct}% находок
                <span className="font-normal text-muted-foreground ml-1">
                  от врачей с конкорд. &lt;40%
                </span>
              </p>
              {rootCause.mixEffect.changed !== null && (
                <p className={`text-xs mt-1 ${rootCause.mixEffect.changed > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {rootCause.mixEffect.changed > 0 ? "▲" : "▼"}{Math.abs(rootCause.mixEffect.changed)}% vs {prevPeriodLabel}
                  {rootCause.mixEffect.changed > 10 && (
                    <span className="ml-1 text-amber-700">— объясняет часть снижения</span>
                  )}
                </p>
              )}
              {rootCause.mixEffect.currLowPct === 0 && (
                <p className="text-xs text-emerald-600 mt-1">Все врачи выше порога ✓</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Динамика по {chartMode}</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length < 2 ? (
            <p className="py-8 text-center text-muted-foreground text-sm">
              Недостаточно данных для отображения динамики
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={trendData} margin={{ top: 8, right: 40, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                />
                <Tooltip
                  formatter={(value, name) => {
                    const key = String(name ?? "");
                    const row = ROWS.find((r) => r.key === key);
                    return [`${value}%`, row?.label ?? key];
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend
                  formatter={(value) => {
                    const row = ROWS.find((r) => r.key === value);
                    return row?.label ?? value;
                  }}
                  wrapperStyle={{ fontSize: 12 }}
                />
                {/* Highlight current period */}
                {point && (
                  <ReferenceLine
                    x={point.label}
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                  />
                )}
                {ROWS.map((row) =>
                  visible[row.key] ? (
                    <Line
                      key={row.key}
                      type="monotone"
                      dataKey={row.key}
                      stroke={row.lineColor}
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  ) : null
                )}
                {refLines.map(({ key, value, color }) => (
                  <ReferenceLine
                    key={`ref-${key}`}
                    y={value}
                    stroke={color}
                    strokeDasharray="8 4"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    label={{
                      value: `цель ${value}%`,
                      fontSize: 11,
                      fill: color,
                      position: "insideTopRight",
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Period breakdown table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Данные по{" "}
            {mode === "week" ? "неделям" : mode === "month" ? "месяцам" : "годам"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Все периоды, от новых к старым
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {trendData.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-6 text-left font-medium">Период</th>
                    <th className="py-2 px-3 text-right font-medium">Находок</th>
                    {ROWS.map((row) => (
                      <th key={row.key} className="py-2 px-3 text-right font-medium whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="inline-block h-2 w-2 rounded-sm flex-shrink-0"
                            style={{ background: row.lineColor }}
                          />
                          {row.key === "clinConcordance" ? "Конкорд." :
                           row.key === "g2bNonMipsPct" ? "G2b" :
                           row.key === "g2bMipsPct" ? "2b-MIPS" :
                           row.key === "g3PlusPct" ? "G3" : "G4"}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...trendData].reverse().map((p) => {
                    const isCurrent = point?.period === p.period;
                    return (
                      <tr
                        key={p.period}
                        className={`border-b last:border-0 ${isCurrent ? "bg-indigo-50" : "hover:bg-muted/30"}`}
                      >
                        <td className={`py-2 pr-6 font-medium tabular-nums ${isCurrent ? "text-indigo-700" : ""}`}>
                          {p.label}
                          {isCurrent && (
                            <span className="ml-2 text-xs text-indigo-500">← выбран</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                          {p.totalFindings}
                        </td>
                        {ROWS.map((row) => {
                          const val = p[row.key];
                          const isGood = row.higherIsBetter ? val >= 70 : val <= 10;
                          const isBad  = row.higherIsBetter ? val < 40  : val > 20;
                          return (
                            <td key={row.key} className="py-2 px-3 text-right tabular-nums">
                              <span className={
                                isGood ? "text-emerald-600 font-medium" :
                                isBad  ? "text-red-600 font-medium" :
                                "text-muted-foreground"
                              }>
                                {val}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctor impact table */}
      <Card>
        <CardHeader>
          <CardTitle>Врачи с наибольшим негативным влиянием</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ранжировано по количеству значимых пропусков (G3+), затем по MIPS-нарушениям
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pr-4 text-left font-medium">#</th>
                <th className="py-2 pr-4 text-left font-medium">Врач</th>
                <th className="py-2 px-3 text-right font-medium">Исслед.</th>
                <th className="py-2 px-3 text-right font-medium">Находок</th>
                <th className="py-2 px-3 text-right font-medium">G3+ (кол.)</th>
                <th className="py-2 px-3 text-right font-medium">G3+ (%)</th>
                <th className="py-2 px-3 text-right font-medium">2b-MIPS</th>
                <th className="py-2 pl-3 text-right font-medium">Клин. конкорд.</th>
              </tr>
            </thead>
            <tbody>
              {doctorImpact.map((d, idx) => {
                const prev = compareEnabled ? prevDoctorImpactMap[d.doctor_id] : undefined;
                return (
                  <tr key={d.doctor_id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 pr-4 text-muted-foreground font-medium">{idx + 1}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/doctors/${d.doctor_id}`} className="font-medium text-blue-600 hover:underline">
                        {d.doctor_name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{d.total_studies}</td>
                    <td className="py-2.5 px-3 text-right text-muted-foreground">{d.total_findings}</td>
                    <td className="py-2.5 px-3 text-right">
                      {d.grade3plus > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          {d.grade3plus}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={d.grade3plusPct > 5 ? "font-semibold text-red-600" : "text-muted-foreground"}>
                        {d.grade3plusPct}%
                      </span>
                      {prev && (
                        <PctDelta curr={d.grade3plusPct} prev={prev.grade3plusPct} invert />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {d.mips2b > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                          {d.mips2b}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                      {prev && (
                        <PctDelta curr={d.mips2bPct} prev={prev.mips2bPct} invert />
                      )}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <span className={
                        d.clinConcordance >= 60 ? "text-emerald-600 font-semibold" :
                        d.clinConcordance >= 40 ? "text-amber-600 font-semibold" :
                        "text-red-600 font-semibold"
                      }>
                        {d.clinConcordance}%
                      </span>
                      {prev && (
                        <PctDelta curr={d.clinConcordance} prev={prev.clinConcordance} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
