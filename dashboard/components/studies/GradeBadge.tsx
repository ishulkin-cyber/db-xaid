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
  if (grade === "4") {
    return <Badge className="bg-rose-200 text-rose-900 border border-rose-600">4b</Badge>;
  }
  if (grade === "4a") {
    return <Badge className="bg-orange-100 text-orange-800 border border-orange-400">4a</Badge>;
  }
  if (grade === "4b") {
    return <Badge className="bg-rose-200 text-rose-900 border border-rose-600">4b</Badge>;
  }
  const colors = gradeColors[grade as Grade];
  if (!colors) return <Badge variant="outline">{grade}</Badge>;
  return <Badge className={colors.badge}>{grade}</Badge>;
}
