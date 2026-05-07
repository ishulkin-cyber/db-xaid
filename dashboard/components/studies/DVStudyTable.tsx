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
import type { DVStudySummary, DoctorStats } from "@/lib/types";

const SESSION_KEY_DOCTOR = "studies_filter_doctor";

function readSession(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "all";
  } catch {
    return "all";
  }
}

interface DVStudyTableProps {
  summaries: DVStudySummary[];
  doctors: DoctorStats[];
}

function GradeCell({ count, color }: { count: number; color: string }) {
  if (count === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {count}
    </span>
  );
}

export function DVStudyTable({ summaries, doctors }: DVStudyTableProps) {
  const [doctorFilter, setDoctorFilter] = useState<string>(
    () => readSession(SESSION_KEY_DOCTOR)
  );

  function handleDoctorChange(value: string) {
    setDoctorFilter(value);
    try { sessionStorage.setItem(SESSION_KEY_DOCTOR, value); } catch {}
  }

  const filtered = useMemo(() => {
    if (doctorFilter === "all") return summaries;
    return summaries.filter((s) => String(s.doctor_id) === doctorFilter);
  }, [summaries, doctorFilter]);

  return (
    <div className="space-y-4">
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

        <span className="text-sm text-muted-foreground">
          {filtered.length} из {summaries.length} исследований
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Номер</TableHead>
            <TableHead>Врач</TableHead>
            <TableHead className="text-right">Находки</TableHead>
            <TableHead className="text-right">2a</TableHead>
            <TableHead className="text-right">2b</TableHead>
            <TableHead className="text-right">2b-MIPS</TableHead>
            <TableHead className="text-right">3</TableHead>
            <TableHead className="text-right">4a</TableHead>
            <TableHead className="text-right">4b</TableHead>
            <TableHead>Ключевые расхождения</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
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
                <TableCell className="text-right">{s.total_findings}</TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.stylistic_count} color="bg-blue-100 text-blue-700" />
                </TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.minor_clinical_count} color="bg-amber-100 text-amber-800" />
                </TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.mips2b_count} color="bg-amber-100 text-amber-900 border border-amber-300" />
                </TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.significant_underreport_count} color="bg-red-100 text-red-700" />
                </TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.minor_overreport_count} color="bg-orange-100 text-orange-700" />
                </TableCell>
                <TableCell className="text-right">
                  <GradeCell count={s.significant_overreport_count} color="bg-rose-100 text-rose-800" />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {s.key_discrepancies.join(", ") || "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
