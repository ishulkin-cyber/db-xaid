import { cn } from "@/lib/utils";

interface PeriodRow {
  name: string;
  week1: { concordance: number; clinicalConcordance: number; studies: number };
  week2: { concordance: number; clinicalConcordance: number; studies: number };
}

interface PeriodComparisonProps {
  data: PeriodRow[];
  label: string;
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">-</span>;
  const positive = value > 0;
  return (
    <span className={cn("text-xs font-medium", positive ? "text-emerald-600" : "text-red-600")}>
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

export function PeriodComparison({ data, label }: PeriodComparisonProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-muted-foreground text-xs">
          <th className="text-left py-2 font-medium">{label}</th>
          <th className="text-center py-2 font-medium" colSpan={2}>Week 1 (Mar 16-20)</th>
          <th className="text-center py-2 font-medium" colSpan={2}>Week 2 (Mar 23-25)</th>
          <th className="text-center py-2 font-medium">Delta</th>
        </tr>
        <tr className="border-b text-muted-foreground text-[10px]">
          <th></th>
          <th className="text-center py-1">Studies</th>
          <th className="text-center py-1">Clin. Conc.</th>
          <th className="text-center py-1">Studies</th>
          <th className="text-center py-1">Clin. Conc.</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const delta = row.week2.studies > 0 && row.week1.studies > 0
            ? row.week2.clinicalConcordance - row.week1.clinicalConcordance
            : 0;
          return (
            <tr key={row.name} className="border-b last:border-b-0">
              <td className="py-2.5 font-medium">{row.name}</td>
              <td className="text-center">{row.week1.studies || "-"}</td>
              <td className="text-center font-medium">
                {row.week1.studies > 0 ? `${row.week1.clinicalConcordance.toFixed(1)}%` : "-"}
              </td>
              <td className="text-center">{row.week2.studies || "-"}</td>
              <td className="text-center font-medium">
                {row.week2.studies > 0 ? `${row.week2.clinicalConcordance.toFixed(1)}%` : "-"}
              </td>
              <td className="text-center">
                {row.week1.studies > 0 && row.week2.studies > 0 ? <Delta value={delta} /> : "-"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
