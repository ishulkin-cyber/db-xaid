"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GradeBadge } from "@/components/studies/GradeBadge";
import type { DVStudySummary, DoctorStats } from "@/lib/types";

interface DVStudyTableProps {
  summaries: DVStudySummary[];
  doctors: DoctorStats[];
}

export function DVStudyTable({ summaries, doctors }: DVStudyTableProps) {
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = summaries;
    if (doctorFilter !== "all") {
      result = result.filter((s) => String(s.doctor_id) === doctorFilter);
    }
    if (gradeFilter !== "all") {
      result = result.filter((s) => s.overall_grade === gradeFilter);
    }
    return result;
  }, [summaries, doctorFilter, gradeFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Filter by doctor"
        >
          <option value="all">Все врачи</option>
          {doctors.map((d) => (
            <option key={d.doctor_id} value={String(d.doctor_id)}>
              {d.doctor_name}
            </option>
          ))}
        </select>

        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Filter by grade"
        >
          <option value="all">Все оценки</option>
          <option value="1">Grade 1</option>
          <option value="2a">Grade 2a</option>
          <option value="2b">Grade 2b</option>
          <option value="3">Grade 3</option>
          <option value="4">Grade 4</option>
        </select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} из {summaries.length} исследований
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Номер</TableHead>
            <TableHead>Врач</TableHead>
            <TableHead>Оценка</TableHead>
            <TableHead className="text-right">Находки</TableHead>
            <TableHead className="text-right">Расхождения</TableHead>
            <TableHead>Ключевые расхождения</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                Нет исследований по выбранным фильтрам.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((s) => (
              <TableRow key={s.accession_number}>
                <TableCell>
                  <Link
                    href={`/studies/${s.accession_number}`}
                    className="font-mono text-sm text-blue-600 hover:underline"
                  >
                    {s.accession_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/doctors/${s.doctor_id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {s.doctor_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <GradeBadge grade={s.overall_grade} />
                </TableCell>
                <TableCell className="text-right">{s.total_findings}</TableCell>
                <TableCell className="text-right">{s.discrepancy_count}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {s.key_discrepancies.join(", ") || "\u2014"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
