"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";

const categoryColors: Record<string, string> = {
  nodule: "#ef4444",
  bone_lesion: "#f97316",
  vascular: "#3b82f6",
  soft_tissue: "#8b5cf6",
  cardiac: "#ec4899",
  interstitial_lung: "#14b8a6",
  gastrointestinal: "#f59e0b",
  breast: "#d946ef",
  airway: "#06b6d4",
};

function formatCategoryLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface CategoryPieProps {
  data: { name: string; value: number }[];
}

const RADIAN = Math.PI / 180;

function renderLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const innerRadius = Number(props.innerRadius ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const percent = Number(props.percent ?? 0);
  const name = String(props.name ?? "");

  const radius = innerRadius + (outerRadius - innerRadius) * 1.4;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      fontSize={12}
    >
      {formatCategoryLabel(name)} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

export function CategoryPie({ data }: CategoryPieProps) {
  const filteredData = data.filter((d) => d.value > 0);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filteredData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={85}
            dataKey="value"
            label={renderLabel}
            labelLine={false}
          >
            {filteredData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={categoryColors[entry.name] ?? "#94a3b8"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              Number(value),
              formatCategoryLabel(String(name)),
            ]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              fontSize: "13px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
