import { Badge } from "@/components/ui/badge";
import { gradeColors } from "@/lib/colors";
import type { Grade } from "@/lib/types";

export function GradeBadge({ grade }: { grade: Grade | string }) {
  const colors = gradeColors[grade as Grade];
  if (!colors) return <Badge variant="outline">{grade}</Badge>;
  return <Badge className={colors.badge}>{grade}</Badge>;
}
