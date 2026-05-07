import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { GradeBadge } from "@/components/studies/GradeBadge";
import { gradeColors } from "@/lib/colors";
import { cn } from "@/lib/utils";
import type { DVFinding, Grade, ReportingStandardGrade } from "@/lib/types";

const REPORTING_BADGE: Record<ReportingStandardGrade, { label: string; className: string }> = {
  compliant:     { label: "\u2713",         className: "text-emerald-700 font-semibold" },
  partial:       { label: "\u0427\u0430\u0441\u0442\u0438\u0447\u043d\u043e",  className: "text-amber-600 text-xs" },
  non_compliant: { label: "\u041d\u0430\u0440\u0443\u0448\u0435\u043d",   className: "text-red-600 text-xs font-semibold" },
  not_assessed:  { label: "\u2014",         className: "text-muted-foreground text-xs" },
};

function parseViolationCode(v: string): string {
  return v.split(":")[0].trim().replace(/_/g, " ");
}

export function DVFindingsTable({ findings }: { findings: DVFinding[] }) {
  if (findings.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        No doctor vs validator findings for this study.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Doctor&apos;s Description</TableHead>
          <TableHead>Validator&apos;s Description</TableHead>
          <TableHead className="w-20">Grade</TableHead>
          <TableHead className="w-28">\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => {
          const colors = gradeColors[f.grade as Grade];
          const isConcordant = f.grade === "1";
          const rsg = f.reporting_standard_grade as ReportingStandardGrade | undefined;
          const rsgStyle = rsg ? REPORTING_BADGE[rsg] : null;
          const violations = f.reporting_violations ?? [];

          return (
            <TableRow
              key={i}
              className={cn(
                "align-top",
                isConcordant && "text-muted-foreground"
              )}
            >
              <TableCell
                className={cn(
                  "border-l-4",
                  colors ? colors.border : "border-transparent"
                )}
              >
                {i + 1}
              </TableCell>
              <TableCell className="font-medium whitespace-normal min-w-[120px]">
                {f.finding_category}
                {f.anatomical_location && (
                  <span className="block text-xs text-muted-foreground">
                    {f.anatomical_location}
                  </span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal max-w-[300px]">
                {f.doctor_description || "\u2014"}
              </TableCell>
              <TableCell className="whitespace-normal max-w-[300px]">
                {f.validator_description || "\u2014"}
              </TableCell>
              <TableCell>
                <GradeBadge grade={f.grade} mipsRelated={f.mips_related} />
              </TableCell>
              <TableCell className="whitespace-normal min-w-[100px]">
                {rsgStyle && (
                  <span className={rsgStyle.className}>{rsgStyle.label}</span>
                )}
                {violations.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {violations.map((v, vi) => (
                      <li
                        key={vi}
                        title={v}
                        className="text-[10px] text-muted-foreground truncate max-w-[110px] cursor-help"
                      >
                        {parseViolationCode(v)}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              <TableCell className="whitespace-normal max-w-[250px] text-xs">
                {f.notes || "\u2014"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
