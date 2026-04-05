import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gradeColors } from "@/lib/colors";
import type { Grade } from "@/lib/types";

const grades: { grade: Grade; label: string; definition: string }[] = [
  {
    grade: "1",
    label: "Concordant",
    definition:
      "Same clinical meaning. The preliminary and final reports convey the same diagnostic information, even if worded differently.",
  },
  {
    grade: "2a",
    label: "Minor Stylistic",
    definition:
      "Wording or formatting differences only. No change in clinical meaning. Examples: added counseling language, reformulated sentences, different terminology for the same finding.",
  },
  {
    grade: "2b",
    label: "Minor Clinical",
    definition:
      "Finding added or modified, but no management change. The clinical meaning differs slightly but would not alter patient care. Examples: different measurement, added detail about a known finding.",
  },
  {
    grade: "3",
    label: "Significant Underreport",
    definition:
      "Missed finding that changes clinical management. The doctor's draft failed to identify a finding that the validator added, and this finding would change the recommended follow-up or workup.",
  },
  {
    grade: "4",
    label: "Significant Overreport",
    definition:
      "False finding causing unnecessary workup. The doctor's draft included a finding or recommendation that was not confirmed by the validator, potentially leading to unnecessary procedures or anxiety.",
  },
];

export function MethodologyContent() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Methodology</h1>
        <p className="mt-1 text-muted-foreground">
          RADPEER-Adapted Grading System for Radiology Report Quality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            This dashboard measures the quality of radiology reports by
            comparing doctor drafts against validator-corrected final reports.
            The analysis uses an adapted version of the{" "}
            <strong>RADPEER</strong> scoring system, applied at the{" "}
            <strong>individual finding level</strong> rather than the whole
            report level.
          </p>
          <p>
            Each radiology report is broken down into its constituent findings
            (e.g., pulmonary nodules, coronary calcification, lymphadenopathy).
            Each finding is then compared between the doctor&apos;s draft and
            the validator&apos;s final report, and assigned a grade from 1 to 4.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Grading Scale</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Grade</TableHead>
                <TableHead className="w-[180px]">Label</TableHead>
                <TableHead>Definition</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map(({ grade, label, definition }) => {
                const colors = gradeColors[grade];
                return (
                  <TableRow key={grade}>
                    <TableCell>
                      <Badge className={colors.badge}>{grade}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{label}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {definition}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <div>
            <h3 className="font-semibold">Concordance Rate</h3>
            <p className="text-muted-foreground">
              Percentage of findings graded as 1 (exact concordance). Measures
              how often our preliminary reports match the final report exactly in
              clinical meaning.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Clinical Concordance Rate</h3>
            <p className="text-muted-foreground">
              Percentage of findings graded as 1 or 2a (concordant + minor
              stylistic). This is the primary quality metric — it captures all
              findings where clinical meaning is preserved, regardless of
              stylistic differences.
            </p>
          </div>
          <div>
            <h3 className="font-semibold">Significant Discrepancy Rate</h3>
            <p className="text-muted-foreground">
              Percentage of findings graded as 3 or 4. These represent
              clinically meaningful differences that could affect patient
              management.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study Design</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-relaxed">
          <p>
            <strong>Modality:</strong> CT Chest (without contrast)
          </p>
          <p>
            <strong>Workflow:</strong> Doctors write preliminary reports.
            Validators review and correct these reports. Each finding is
            compared between the doctor&apos;s draft and the validator&apos;s
            corrected version, and assigned a RADPEER grade from 1 to 4.
          </p>
          <p>
            <strong>Metric focus:</strong> Clinical concordance (Grade 1 + 2a)
            is the primary quality metric. Grades 3 and 4 represent clinically
            significant differences requiring attention.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
