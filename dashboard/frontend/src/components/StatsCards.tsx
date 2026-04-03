import type { OverviewData } from "../types";

interface Props {
  overview: OverviewData | null;
  loading: boolean;
}

function pct(n: number) {
  return (n * 100).toFixed(1) + "%";
}

function Card({
  value,
  label,
  sub,
  color,
  loading,
}: {
  value: string | number;
  label: string;
  sub?: string;
  color?: string;
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-w-[160px] bg-[#141414] border border-zinc-800 rounded-xl p-4">
      {loading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-16 bg-zinc-800 rounded" />
          <div className="h-3 w-24 bg-zinc-800 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${color ?? "text-white"}`}>{value}</span>
            {sub && <span className={`text-lg font-semibold ${color ?? "text-zinc-300"}`}>{sub}</span>}
          </div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest mt-1">{label}</p>
        </>
      )}
    </div>
  );
}

export default function StatsCards({ overview, loading }: Props) {
  const ov = overview;

  return (
    <div className="flex gap-3 flex-wrap">
      <Card
        value={ov?.total_tasks ?? "—"}
        label="Всего исследований"
        loading={loading}
      />
      <Card
        value={ov?.omission_count ?? "—"}
        sub={ov ? pct(ov.omission_rate) : undefined}
        label="Протоколов с пропуском · Grade 2b + Grade 3"
        color="text-yellow-400"
        loading={loading}
      />
      <Card
        value={ov?.grade_2b_count ?? "—"}
        sub={ov ? pct(ov.grade_2b_rate) : undefined}
        label="Протоколов Grade 2b · 51 находок · минорные клинические"
        color="text-orange-400"
        loading={loading}
      />
      <Card
        value={ov?.grade_3_count ?? "—"}
        sub={ov ? pct(ov.grade_3_rate) : undefined}
        label="Протоколов Grade 3 · 7 находок · меняют тактику лечения · требуют разбора"
        color="text-red-400"
        loading={loading}
      />
    </div>
  );
}
