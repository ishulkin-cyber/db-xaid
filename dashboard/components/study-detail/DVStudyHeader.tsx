import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { GradeBadge } from "@/components/studies/GradeBadge";
import type { DVStudySummary } from "@/lib/types";

interface DVStudyHeaderProps {
  summary: DVStudySummary;
}

export function DVStudyHeader({ summary }: DVStudyHeaderProps) {
  const {
    accession_number,
    doctor_name,
    doctor_id,
    overall_grade,
    total_findings,
    concordant_count,
    discrepancy_count,
    significant_underreport_count,
    significant_overreport_count,
    key_discrepancies,
  } = summary;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold font-mono">{accession_number}</h2>
              <GradeBadge grade={overall_grade} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Врач</span>
                <p className="font-medium">
                  <Link
                    href={`/doctors/${doctor_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {doctor_name}
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="text-center">
              <p className="text-2xl font-bold">{total_findings}</p>
              <p className="text-xs text-muted-foreground">Находок</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-600">{concordant_count}</p>
              <p className="text-xs text-muted-foreground">Конкорд.</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{discrepancy_count}</p>
              <p className="text-xs text-muted-foreground">Расхожд.</p>
            </div>
            {(significant_underreport_count > 0 || significant_overreport_count > 0) && (
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {significant_underreport_count + significant_overreport_count}
                </p>
                <p className="text-xs text-muted-foreground">Знач. (3+)</p>
              </div>
            )}
          </div>
        </div>

        {key_discrepancies.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Ключевые расхождения
            </p>
            <ul className="space-y-1">
              {key_discrepancies.map((d, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-orange-500 mt-0.5 shrink-0">&#8226;</span>
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
