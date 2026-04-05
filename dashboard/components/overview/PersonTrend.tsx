"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface PersonTrendProps {
  data: {
    date: string;
    persons: Record<string, number>; // name → clinical concordance %
  }[];
  label: string; // "Attending" or "Validator"
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function PersonTrend({ data }: PersonTrendProps) {
  if (data.length === 0) return null;

  const allPersons = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.persons)))
  ).filter((p) => p !== "Unknown");

  const chartData = data.map((d) => ({
    date: d.date.slice(5), // "03-16"
    ...d.persons,
  }));

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
            formatter={(value: unknown) => [`${Number(value).toFixed(1)}%`, ""]}
            labelFormatter={(l) => `Date: ${l}`}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {allPersons.map((person, i) => (
            <Line
              key={person}
              type="monotone"
              dataKey={person}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
