"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
interface AcceptanceDayData {
  date: string;
  acceptedAsIs: number;
  max2a: number;
  withChanges: number;
  byValidator: { name: string; accepted: number; max2a: number; changes: number }[];
  byAttending: { name: string; accepted: number; max2a: number; changes: number }[];
}

interface AcceptanceChartProps {
  data: AcceptanceDayData[];
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload || !payload.length) return null;

  // Find the original data point to get byPerson
  const dataPoint = (payload[0] as unknown as { payload: AcceptanceDayData & { date: string } })?.payload;
  const byValidator = dataPoint?.byValidator;
  const byAttending = dataPoint?.byAttending;

  function PersonBreakdown({ title, persons }: { title: string; persons: { name: string; accepted: number; max2a: number; changes: number }[] }) {
    if (!persons || persons.length === 0) return null;
    return (
      <div className="border-t mt-1.5 pt-1.5">
        <p className="text-muted-foreground font-medium mb-1">{title}:</p>
        {persons.map((p) => {
          const total = p.accepted + p.max2a + p.changes;
          return (
            <div key={p.name} className="flex items-center gap-2 py-0.5">
              <span className="truncate max-w-[120px]">{p.name.split(",")[0]}</span>
              <span className="ml-auto flex gap-2 text-[10px]">
                {p.accepted > 0 && <span className="text-emerald-600">{p.accepted} acc</span>}
                {p.max2a > 0 && <span className="text-blue-600">{p.max2a} 2a</span>}
                {p.changes > 0 && <span className="text-amber-600">{p.changes} 2b+</span>}
                <span className="text-muted-foreground">({total})</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-xs max-w-[300px]">
      <p className="font-semibold mb-1.5">Date: {label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium">{p.value}</span>
        </div>
      ))}
      <PersonBreakdown title="By Validator" persons={byValidator ?? []} />
      <PersonBreakdown title="By Attending" persons={byAttending ?? []} />
    </div>
  );
}

export function AcceptanceChart({ data }: AcceptanceChartProps) {
  const chartData = data.map((d) => ({
    date: d.date.slice(5),
    "Accepted as-is": d.acceptedAsIs,
    "Max Grade 2a": d.max2a,
    "Grade 2b+": d.withChanges,
    byValidator: d.byValidator,
    byAttending: d.byAttending,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Bar dataKey="Accepted as-is" stackId="a" fill="#10b981" radius={0} />
          <Bar dataKey="Max Grade 2a" stackId="a" fill="#3b82f6" radius={0} />
          <Bar dataKey="Grade 2b+" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
