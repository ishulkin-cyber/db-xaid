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
import type { DVFinding, Grade } from "@/lib/types";

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
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => {
          const colors = gradeColors[f.grade as Grade];
          const isConcordant = f.grade === "1";

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
                <GradeBadge grade={f.grade} />
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
