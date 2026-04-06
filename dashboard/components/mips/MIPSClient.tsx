"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MIPSStat, DoctorMIPSStat } from "@/lib/types";

// ---- types mirroring getMIPSOverallStats return shape ----

interface OverallStats {
  total949: number;
  total2b: number;
  mips2b: number;
  nonMips2b: number;
  mipsPctOfAll: number;
  mipsPctOf2b: number;
  byMeasure: MIPSStat[];
}

interface Props {
  overallStats: OverallStats;
  byDoctor: DoctorMIPSStat[];
}

// ---- colour palette for bars ----

const MEASURE_COLORS: Record<string, string> = {
  "364":    "#3b82f6",
  ACRad44:  "#8b5cf6",
  "406":    "#f59e0b",
  "405":    "#10b981",
  QMM23:   "#ef4444",
};

function measureColor(measure: string): string {
  return MEASURE_COLORS[measure] ?? "#94a3b8";
}

// ---- MIPS% cell colour ----

function mipsPctClass(pct: number): string {
  if (pct >= 40) return "text-red-600 font-semibold";
  if (pct >= 20) return "text-amber-600 font-semibold";
  return "text-emerald-600 font-semibold";
}

// ---- small measure badge ----

function MeasureBadge({ measure, count }: { measure: string; count: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: measureColor(measure) }}
    >
      {measure} ×{count}
    </span>
  );
}

// ---- custom tooltip for bar chart ----

interface TooltipPayloadItem {
  payload: MIPSStat;
}

function CustomBarTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-white p-3 text-sm shadow-md">
      <p className="font-semibold">{d.label}</p>
      <p className="text-muted-foreground">Мера: {d.measure}</p>
      <p>Находок: <span className="font-medium">{d.count}</span></p>
      <p>% от 2b: <span className="font-medium">{d.pctOf2b}%</span></p>
      <p>% от всех: <span className="font-medium">{d.pctOfAll}%</span></p>
    </div>
  );
}

// ---- main component ----

export function MIPSClient({ overallStats, byDoctor }: Props) {
  const { total949, total2b, mips2b, mipsPctOfAll, byMeasure } = overallStats;

  const topMeasure = byMeasure[0];
  const topDoctor = byDoctor[0];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">MIPS-совместимые находки</h1>
        <p className="mt-1 text-muted-foreground">
          Находки 2b-грейда, связанные с мерами качества MIPS (из {total949} всего)
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              2b-MIPS находок
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{mips2b}</p>
            <p className="mt-1 text-xs text-muted-foreground">из {total2b} находок 2b-грейда</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              % от всех находок
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">{mipsPctOfAll}%</p>
            <p className="mt-1 text-xs text-muted-foreground">от {total949} находок</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Топ мера
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topMeasure ? (
              <>
                <p className="text-xl font-bold">{topMeasure.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Мера {topMeasure.measure} — {topMeasure.count} находок
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Наиболее затронутый врач
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topDoctor ? (
              <>
                <p className="text-xl font-bold">{topDoctor.doctor_name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  MIPS%: {topDoctor.mipsPct}% ({topDoctor.mips2b} из {topDoctor.total2b})
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar chart by measure */}
      <Card>
        <CardHeader>
          <CardTitle>Распределение по мерам MIPS</CardTitle>
        </CardHeader>
        <CardContent>
          {byMeasure.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={byMeasure}
                layout="vertical"
                margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={200}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={36}>
                  {byMeasure.map((entry) => (
                    <Cell key={entry.measure} fill={measureColor(entry.measure)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Doctor MIPS table */}
      <Card>
        <CardHeader>
          <CardTitle>MIPS-комплаенс по врачам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium text-muted-foreground">Врач</th>
                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">Всего 2b</th>
                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">2b-MIPS</th>
                  <th className="py-2 px-4 text-right font-medium text-muted-foreground">MIPS%</th>
                  <th className="py-2 pl-4 text-left font-medium text-muted-foreground">Разбивка по мерам</th>
                </tr>
              </thead>
              <tbody>
                {byDoctor.map((row) => (
                  <tr key={row.doctor_id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-3 pr-4 font-medium">{row.doctor_name}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{row.total2b}</td>
                    <td className="py-3 px-4 text-right tabular-nums">{row.mips2b}</td>
                    <td className={`py-3 px-4 text-right tabular-nums ${mipsPctClass(row.mipsPct)}`}>
                      {row.mipsPct}%
                    </td>
                    <td className="py-3 pl-4">
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(row.byMeasure).map(([measure, count]) => (
                          <MeasureBadge key={measure} measure={measure} count={count} />
                        ))}
                        {Object.keys(row.byMeasure).length === 0 && (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Цвет MIPS%: красный &gt;40%, янтарный 20–40%, зелёный &lt;20%. Сортировка по убыванию MIPS%.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
