import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import type { WorkloadData, WorkloadCell } from "../types";

interface Props {
  data: WorkloadData | null;
  loading: boolean;
}

const DOCTOR_COLORS = [
  "#60a5fa", "#4ade80", "#f97316", "#a78bfa", "#f472b6",
  "#34d399", "#fb923c", "#818cf8", "#e879f9", "#2dd4bf",
];

function Cell2({ cell }: { cell: WorkloadCell | null }) {
  if (!cell || cell.tasks === 0) {
    return <td className="px-2 py-2 text-center text-zinc-700 text-xs">—</td>;
  }
  return (
    <td className="px-2 py-2 text-center">
      <div className="text-sm font-semibold text-blue-300">{cell.tasks}</div>
      {cell.hours > 0 && (
        <div className="text-[10px] text-zinc-500">{cell.hours}ч</div>
      )}
    </td>
  );
}

export default function WorkloadView({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-zinc-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.doctors.length === 0) {
    return (
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-6 text-zinc-500 text-center">
        Нет данных за выбранный период
      </div>
    );
  }

  // Chart data: per column, stacked by doctor
  const chartData = data.col_keys.map((ck, i) => {
    const point: Record<string, number | string> = { date: data.col_labels[i] };
    for (const doc of data.doctors) {
      point[`doc_${doc.id}`] = doc.days[ck]?.tasks ?? 0;
    }
    return point;
  });

  return (
    <div className="space-y-4">
      {/* Chart */}
      <div className="bg-[#141414] border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">
          Нагрузка по дням (кол-во исследований)
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #3f3f3f", fontSize: 11 }}
              />
              {data.doctors.map((doc, i) => (
                <Bar
                  key={doc.id}
                  dataKey={`doc_${doc.id}`}
                  name={doc.name}
                  stackId="a"
                  fill={DOCTOR_COLORS[i % DOCTOR_COLORS.length]}
                  radius={i === data.doctors.length - 1 ? [3, 3, 0, 0] : undefined}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-2">
          {data.doctors.map((doc, i) => (
            <span key={doc.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }}
              />
              {doc.name}
            </span>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#141414] border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="sticky left-0 bg-[#141414] z-10 px-4 py-2 text-left text-xs text-zinc-500 uppercase tracking-wider w-48">
                  Врач
                </th>
                <th className="px-3 py-2 text-right text-xs text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                  Итого
                </th>
                <th className="px-3 py-2 text-right text-xs text-zinc-500 whitespace-nowrap">
                  Ср/день
                </th>
                {data.col_labels.map((label, i) => (
                  <th
                    key={data.col_keys[i]}
                    className="px-2 py-2 text-center text-xs text-zinc-500 whitespace-nowrap min-w-[80px]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.doctors.map((doc, i) => (
                <tr key={doc.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/20 transition-colors">
                  <td className="sticky left-0 bg-inherit z-10 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: DOCTOR_COLORS[i % DOCTOR_COLORS.length] }}
                      />
                      <span className="font-medium text-white">{doc.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="text-base font-bold text-blue-300">{doc.total.tasks}</div>
                    {doc.total.hours > 0 && (
                      <div className="text-[10px] text-zinc-500">{doc.total.hours}ч план</div>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-zinc-400">
                    {doc.total.avg_per_day}
                  </td>
                  {data.col_keys.map((ck) => (
                    <Cell2 key={ck} cell={doc.days[ck] ?? null} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
