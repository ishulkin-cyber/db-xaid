import { getGradeTrendData } from "@/lib/data";
import { SvodClient } from "@/components/svod/SvodClient";

interface SearchParams {
  mode?: string;
}

export default function SvodPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = searchParams.mode ?? "month";
  const mode = (["week", "month", "year"].includes(raw) ? raw : "month") as "week" | "month" | "year";

  const trendData = getGradeTrendData(mode);

  return <SvodClient mode={mode} trendData={trendData} />;
}
