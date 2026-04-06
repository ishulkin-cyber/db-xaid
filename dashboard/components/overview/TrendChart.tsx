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
import type { TrendDataPoint } from "@/lib/types";
import { formatShortDate } from "@/lib/utils";

interface TrendChartProps {
  data: TrendDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: formatShortDate(d.date),
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={formatted}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="dateLabel"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value: unknown) => `${Number(value)}%`}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "13px" }} />
          <Line
            type="monotone"
            dataKey="concordance"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Concordance"
          />
          <Line
            type="monotone"
            dataKey="clinicalConcordance"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            name="Clinical Concordance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
