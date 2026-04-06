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

interface CategoryBreakdownProps {
  doctors: { name: string; categories: Record<string, number> }[];
}

export function CategoryBreakdown({ doctors }: CategoryBreakdownProps) {
  // Collect all unique categories across all doctors
  const allCategories = Array.from(
    new Set(doctors.flatMap((d) => Object.keys(d.categories)))
  );

  const chartData = doctors.map((d) => {
    const entry: Record<string, string | number> = { name: d.name };
    for (const cat of allCategories) {
      entry[cat] = d.categories[cat] ?? 0;
    }
    return entry;
  });

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            horizontal={false}
          />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            width={140}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload) return null;
              const nonZero = payload.filter((p) => Number(p.value) > 0);
              if (nonZero.length === 0) return null;
              return (
                <div className="rounded-lg border bg-white px-3 py-2 shadow-md text-sm">
                  <p className="font-medium mb-1">{label}</p>
                  {nonZero.map((p) => (
                    <div key={p.dataKey as string} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-muted-foreground">
                        {formatCategoryLabel(p.dataKey as string)}
                      </span>
                      <span className="ml-auto font-medium">{p.value}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {/* Legend omitted — too many categories; tooltip shows details on hover */}
          {allCategories.map((cat) => (
            <Bar
              key={cat}
              dataKey={cat}
              stackId="stack"
              fill={categoryColors[cat] ?? "#94a3b8"}
              radius={0}
              barSize={28}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
