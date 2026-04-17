"use client";

import { useState, useMemo, useEffect } from "react";
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

const SESSION_KEY_DOCTOR = "studies_filter_doctor";
const SESSION_KEY_GRADE = "studies_filter_grade";

interface DVStudyTableProps {
  summaries: DVStudySummary[];
  doctors: DoctorStats[];
}

export function DVStudyTable({ summaries, doctors }: DVStudyTableProps) {
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");

  // Restore filters from sessionStorage on mount
  useEffect(() => {
    setDoctorFilter(sessionStorage.getItem(SESSION_KEY_DOCTOR) ?? "all");
    setGradeFilter(sessionStorage.getItem(SESSION_KEY_GRADE) ?? "all");
  }, []);

  function handleDoctorChange(value: string) {
    setDoctorFilter(value);
    sessionStorage.setItem(SESSION_KEY_DOCTOR, value);
  }

  function handleGradeChange(value: string) {
    setGradeFilter(value);
    sessionStorage.setItem(SESSION_KEY_GRADE, value);
  }

  const filtered = useMemo(() => {
    let result = summaries;
    if (doctorFilter !== "all") {
      result = result.filter((s) => String(s.doctor_id) === doctorFilter);
    }
    if (gradeFilter === "2b-mips") {
      result = result.filter((s) => s.overall_grade === "2b" && s.mips2b_count > 0);
    } else if (gradeFilter === "2b-only") {
      result = result.filter((s) => s.overall_grade === "2b" && s.mips2b_count === 0);
    } else if (gradeFilter !== "all") {
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
          onChange={(e) => handleDoctorChange(e.target.value)}
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
          onChange={(e) => handleGradeChange(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Filter by grade"
        >
          <option value="all">Все оценки</option>
          <option value="1">Grade 1</option>
          <option value="2a">Grade 2a</option>
          <option value="2b-only">Grade 2b (без MIPS)</option>
          <option value="2b-mips">Grade 2b-MIPS</option>
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
            <TableHead className="text-right">G2b</TableHead>
            <TableHead className="text-right">2b-MIPS</TableHead>
            <TableHead>Ключевые расхождения</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                  {s.overall_grade === "2b" && s.mips2b_count > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 border border-amber-300">
                      2b-MIPS
                    </span>
                  ) : (
                    <GradeBadge grade={s.overall_grade} />
                  )}
                </TableCell>
                <TableCell className="text-right">{s.total_findings}</TableCell>
                <TableCell className="text-right">
                  {s.minor_clinical_count > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      {s.minor_clinical_count}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {s.mips2b_count > 0 ? (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                      {s.mips2b_count}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
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
