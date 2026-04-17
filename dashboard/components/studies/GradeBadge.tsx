import { Badge } from "@/components/ui/badge";
import { gradeColors } from "@/lib/colors";
import type { Grade } from "@/lib/types";

export function GradeBadge({ grade, mipsRelated }: { grade: Grade | string; mipsRelated?: boolean }) {
  if (grade === "2b" && mipsRelated) {
    return (
      <Badge className="bg-amber-200 text-amber-900 border border-amber-500">
        2b-MIPS
      </Badge>
    );
  }
  const colors = gradeColors[grade as Grade];
  if (!colors) return <Badge variant="outline">{grade}</Badge>;
  return <Badge className={colors.badge}>{grade}</Badge>;
}
