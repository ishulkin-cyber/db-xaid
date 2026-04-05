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
import type { Grade } from "@/lib/types";
import { gradeChartColors } from "@/lib/colors";

interface GradeDistributionProps {
  data: { grade: Grade; count: number; label: string }[];
}

export function GradeDistribution({ data }: GradeDistributionProps) {
  const chartData = data.map((d) => ({
    name: `Grade ${d.grade} (${d.count})`,
    count: d.count,
    grade: d.grade,
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            width={180}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28}>
            {chartData.map((entry) => (
              <Cell
                key={entry.grade}
                fill={gradeChartColors[entry.grade as Grade]}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
