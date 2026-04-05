import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ValidatorStats {
  name: string;
  studies: number;
  totalFindings: number;
  concordance: number;
  clinicalConcordance: number;
  grade3Plus: number;
}

interface ValidatorTableProps {
  data: ValidatorStats[];
}

function concordanceColor(value: number): string {
  if (value >= 80) return "text-emerald-600";
  if (value >= 50) return "text-amber-600";
  return "text-red-600";
}

export function ValidatorTable({ data }: ValidatorTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Validator</TableHead>
          <TableHead className="text-right">Studies</TableHead>
          <TableHead className="text-right">Concordance</TableHead>
          <TableHead className="text-right">Clinical Conc.</TableHead>
          <TableHead className="text-right">Grade 3+</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.name}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right">{row.studies}</TableCell>
            <TableCell
              className={cn("text-right font-medium", concordanceColor(row.concordance))}
            >
              {row.concordance}%
            </TableCell>
            <TableCell
              className={cn(
                "text-right font-medium",
                concordanceColor(row.clinicalConcordance)
              )}
            >
              {row.clinicalConcordance}%
            </TableCell>
            <TableCell className="text-right">
              {row.grade3Plus > 0 ? (
                <Badge variant="destructive">{row.grade3Plus}</Badge>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
