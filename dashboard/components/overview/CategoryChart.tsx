"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface CategoryChartProps {
  data: {
    category: string;
    total: number;
    discrepancies: number;
    discrepancyRate: number;
  }[];
}

export function CategoryChart({ data }: CategoryChartProps) {
  const chartData = data.map((d) => ({
    name: d.category.length > 25 ? d.category.slice(0, 25) + "..." : d.category,
    fullName: d.category,
    discrepancies: d.discrepancies,
    total: d.total,
    rate: d.discrepancyRate,
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
            tick={{ fontSize: 11 }}
            stroke="#9ca3af"
            width={160}
          />
          <Tooltip
            formatter={(value: unknown, _name: unknown, props: unknown) => {
              const p = props as { payload?: { total?: number; rate?: number } };
              const v = Number(value);
              return [
                `${v} of ${p.payload?.total ?? 0} (${p.payload?.rate ?? 0}%)`,
                "Discrepancies",
              ];
            }}
            labelFormatter={(_label: unknown, payload: unknown) => {
              const items = payload as Array<{ payload?: { fullName?: string } }>;
              return items?.[0]?.payload?.fullName ?? String(_label);
            }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
          <Bar
            dataKey="discrepancies"
            fill="#f59e0b"
            radius={[0, 4, 4, 0]}
            barSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
