import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import type { DoctorDetail, MissedFinding } from "../types";

interface Props {
  detail: DoctorDetail | null;
  loading: boolean;
  onClose: () => void;
  onTaskClick: (taskId: number) => void;
}

const GRADE_COLORS = {
  "1": "#4ade80",
  "2a": "#60a5fa",
  "2b": "#fb923c",
  "3": "#f87171",
  "4": "#c084fc",
};

function GradeBadge({ grade }: { grade: string }) {
  const color = GRADE_COLORS[grade as keyof typeof GRADE_COLORS] ?? "#9ca3af";
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
      style={{ background: color + "30", color }}
    >
      G{grade}
    </span>
  );
}

function pct(n: number | null | undefined) {
  if (n == null) return "—";
  return Math.round(n * 100) + "%";
}

function FindingRow({ f, onTaskClick }: { f: MissedFinding; onTaskClick: (id: number) => void }) {
  const day = f.date.slice(5).replace("-", ".");
  return (
    <div
      className="flex items-start gap-2 py-2 border-b border-zinc-800/60 cursor-pointer hover:bg-zinc-800/20 px-2 rounded transition-colors"
      onClick={() => onTaskClick(f.task_id)}
    >
      <span className="text-xs text-zinc-500 w-10 shrink-0 pt-0.5">{day}</span>
      <GradeBadge grade={f.grade} />
      {f.management_impact && (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400">
          КМ
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-200 leading-snug">{f.finding_text}</p>
        {f.location && <p className="text-[10px] text-zinc-500 mt-0.5">[{f.category_label}]</p>}
      </div>
    </div>
  );
}

export default function DoctorDetailPanel({ detail, loading, onClose, onTaskClick }: Props) {
  if (loading) {
    return (
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-4 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-32 bg-zinc-800 rounded" />
          <div className="h-4 w-full bg-zinc-800 rounded" />
          <div className="h-40 bg-zinc-800 rounded" />
          <div className="h-40 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { stats, grade_distribution: gd, trend_data, category_breakdown, missed_findings } = detail;

  // Grade distribution bar widths
  const total = gd.total_findings || 1;
  const bars = [
    { key: "grade_1_count", color: "#4ade80", label: `Grade 1 Concordant: ${gd.grade_1_count}` },
    { key: "grade_2a_count", color: "#60a5fa", label: `Grade 2a Stylistic: ${gd.grade_2a_count}` },
    { key: "grade_2b_count", color: "#fb923c", label: `Grade 2b Clinical: ${gd.grade_2b_count}` },
    { key: "grade_3_count", color: "#f87171", label: `Grade 3 Underreport: ${gd.grade_3_count}` },
    { key: "grade_4_count", color: "#c084fc", label: `Grade 4 Overreport: ${gd.grade_4_count}` },
  ] as const;

  const omissionPct20 = 0.2; // reference line

  return (
    <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[calc(100vh-160px)] sticky top-4">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 shrink-0" />
            <span className="font-semibold text-white">{detail.name}</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex gap-4 flex-wrap">
          <Stat value={pct(stats.omission_rate)} label="% с пропуском" color="text-orange-400" />
          <Stat value={stats.grade_3_count} label="Grade 3" color="text-red-400" />
          <Stat value={pct(stats.clinical_concordance)} label="Клин. конкорд." />
          <Stat value={stats.total_omissions} label="Всего пропусков" color="text-orange-300" />
        </div>

        {/* Grade distribution bar */}
        <div className="mt-3">
          <div className="flex h-2 rounded-full overflow-hidden gap-px">
            {bars.map(({ key, color }) => {
              const count = gd[key];
              const w = (count / total) * 100;
              return w > 0 ? (
                <div key={key} style={{ width: `${w}%`, background: color }} />
              ) : null;
            })}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {bars.map(({ key, color, label }) => (
              <span key={key} className="flex items-center gap-1 text-[10px] text-zinc-400">
                <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* Trend chart */}
        {trend_data.length > 1 && (
          <div>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend_data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => v.slice(5).replace("-", ".")}
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => Math.round(v * 100) + "%"}
                    tick={{ fill: "#71717a", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 1.05]}
                  />
                  <Tooltip
                    contentStyle={{ background: "#1a1a1a", border: "1px solid #3f3f3f", fontSize: 11 }}
                    formatter={(v: number) => [Math.round(v * 100) + "%", "Пропуск"]}
                    labelFormatter={(l: string) => l.slice(5).replace("-", ".")}
                  />
                  <ReferenceLine
                    y={omissionPct20}
                    stroke="#eab308"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="omission_rate"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#f97316" }}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Two-column: category breakdown + missed findings */}
        <div className="flex gap-3">
          {/* Category breakdown */}
          {category_breakdown.length > 0 && (
            <div className="w-44 shrink-0">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                Паттерн пропусков
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={category_breakdown}
                    layout="vertical"
                    margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={{ fill: "#a1a1aa", fontSize: 9 }}
                      width={90}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "#1a1a1a", border: "1px solid #3f3f3f", fontSize: 11 }}
                    />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {category_breakdown.map((_, i) => (
                        <Cell key={i} fill={`hsl(${20 + i * 25}, 80%, 55%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* AI summary box */}
              {missed_findings.length > 0 && (
                <div className="mt-2 p-2 bg-zinc-800/50 rounded text-[10px] text-zinc-400 leading-relaxed">
                  <strong className="text-zinc-300">Ведущий паттерн:</strong>{" "}
                  {category_breakdown
                    .slice(0, 2)
                    .map((c) => `пропуск ${c.label.toLowerCase()} (${c.count} случая)`)
                    .join(" и ")}
                  {". "}
                  {stats.grade_3_count > 0 && (
                    <>Значимо: <strong className="text-orange-400">{stats.grade_3_count} пропуска Grade 3</strong>.</>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Missed findings list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Список пропущенных находок
              </h4>
              <span className="text-[10px] flex items-center gap-1 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-red-400" /> G3 — значимый
              </span>
              <span className="text-[10px] flex items-center gap-1 text-zinc-500">
                <span className="w-2 h-2 rounded-full bg-orange-400" /> G2b — минорный
              </span>
            </div>
            <div className="space-y-0">
              {missed_findings.slice(0, 20).map((f, i) => (
                <FindingRow key={i} f={f} onTaskClick={onTaskClick} />
              ))}
              {missed_findings.length === 0 && (
                <p className="text-zinc-600 text-xs">Нет данных (задачи не проградированы)</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div>
      <div className={`text-base font-bold ${color ?? "text-white"}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}
