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
          <TableHead>{"Doctor's Description"}</TableHead>
          <TableHead>{"Validator's Description"}</TableHead>
          <TableHead className="w-20">Grade</TableHead>
          <TableHead>Обоснование</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((f, i) => {
          const colors = gradeColors[f.grade as Grade];
          const isConcordant = f.grade === "1";

          return (
            <TableRow
              key={i}
              className={cn("align-top", isConcordant && "text-muted-foreground")}
            >
              <TableCell
                className={cn("border-l-4", colors ? colors.border : "border-transparent")}
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
                {f.doctor_description || "—"}
              </TableCell>
              <TableCell className="whitespace-normal max-w-[300px]">
                {f.validator_description || "—"}
              </TableCell>
              <TableCell>
                <GradeBadge grade={f.grade} mipsRelated={f.mips_related} />
              </TableCell>
              <TableCell className="whitespace-normal max-w-[280px] text-xs text-muted-foreground">
                {f.management_impact || "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
