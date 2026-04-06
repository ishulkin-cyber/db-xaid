"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GradeTrendPoint } from "@/lib/data";

const STORAGE_KEY = "svod-grade-targets-v2";

type GradeKey = "clinConcordance" | "g2bPct" | "g3PlusPct";

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
    key: "g2bPct",
    label: "Минимальные клинические (G2b)",
    desc: "Расхождения, не влияющие на тактику",
    higherIsBetter: false,
    color: "text-amber-600",
    lineColor: "#f59e0b",
  },
  {
    key: "g3PlusPct",
    label: "Значимые расхождения (G3+)",
    desc: "Пропуски и гипердиагностика, влияющие на тактику",
    higherIsBetter: false,
    color: "text-red-600",
    lineColor: "#ef4444",
  },
];

interface Props {
  mode: "week" | "month" | "year";
  trendData: GradeTrendPoint[];
}

const MODE_LABELS: Record<string, string> = {
  week: "Неделя", month: "Месяц", year: "Год",
};

export function SvodClient({ mode, trendData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [targets, setTargets] = useState<Partial<Record<GradeKey, string>>>({});
  // which lines to show
  const [visible, setVisible] = useState<Record<GradeKey, boolean>>({
    clinConcordance: true,
    g2bPct: true,
    g3PlusPct: true,
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

  function switchMode(m: string) {
    router.push(`${pathname}?mode=${m}`);
  }

  // Current = last period in trend
  const last = trendData[trendData.length - 1];
  const currentValues: Record<GradeKey, number> = {
    clinConcordance: last?.clinConcordance ?? 0,
    g2bPct: last?.g2bPct ?? 0,
    g3PlusPct: last?.g3PlusPct ?? 0,
  };

  // Reference lines for set targets
  const refLines = ROWS.flatMap((row) => {
    if (!visible[row.key]) return [];
    const t = parseFloat(targets[row.key] ?? "");
    if (isNaN(t)) return [];
    return [{ key: row.key, value: t, color: row.lineColor }];
  });

  return (
    <div className="space-y-8">
      {/* Header + mode selector */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Свод</h1>
          <p className="mt-1 text-muted-foreground">
            Динамика качества описаний по грейдам
          </p>
        </div>
        <div className="flex rounded-lg border bg-muted p-0.5 gap-0.5 self-start">
          {(["week", "month", "year"] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

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

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>
            Динамика по{" "}
            {mode === "week" ? "неделям" : mode === "month" ? "месяцам" : "годам"}
          </CardTitle>
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
    </div>
  );
}
