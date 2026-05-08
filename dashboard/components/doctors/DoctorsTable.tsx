"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { DoctorGradeBar } from "@/components/doctors/DoctorGradeBar";
import type { DoctorStats } from "@/lib/types";

type SortKey =
  | "name" | "studies" | "findings" | "concordance"
  | "g2a" | "g2b" | "g2b_mips" | "g3" | "g4a" | "g4b";

type SortDir = "asc" | "desc";

function Delta({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const diff = curr - prev;
  if (diff === 0) return <span className="text-xs text-muted-foreground ml-1">±0</span>;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`ml-1 text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {diff > 0 ? "▲" : "▼"}{Math.abs(diff)}
    </span>
  );
}

function PctDelta({ curr, prev, invert = false }: { curr: number; prev: number; invert?: boolean }) {
  const diff = Math.round((curr - prev) * 10) / 10;
  if (diff === 0) return null;
  const good = invert ? diff < 0 : diff > 0;
  return (
    <span className={`text-xs font-medium ${good ? "text-emerald-600" : "text-red-600"}`}>
      {diff > 0 ? " ▲" : " ▼"}{Math.abs(diff)}%
    </span>
  );
}

interface DoctorsTableProps {
  doctors: DoctorStats[];
  mips2bByDoctor: Record<number, number>;
  prevDoctorMap: Record<number, DoctorStats>;
  prevMips2bByDoctor: Record<number, number> | null;
  compareEnabled: boolean;
}

function SortIcon({ col, active, dir }: { col: string; active: boolean; dir: SortDir }) {
  if (!active) return <span className="ml-1 text-muted-foreground/40 text-[10px]">↕</span>;
  return <span className="ml-1 text-[10px]">{dir === "asc" ? "↑" : "↓"}</span>;
}

export function DoctorsTable({
  doctors,
  mips2bByDoctor,
  prevDoctorMap,
  prevMips2bByDoctor,
  compareEnabled,
}: DoctorsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("concordance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function th(label: string, key: SortKey, className = "text-right cursor-pointer select-none hover:text-foreground") {
    return (
      <TableHead className={className} onClick={() => handleSort(key)}>
        {label}<SortIcon col={key} active={sortKey === key} dir={sortDir} />
      </TableHead>
    );
  }

  const sorted = useMemo(() => {
    return [...doctors].sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === "name") {
        return sortDir === "asc"
          ? a.doctor_name.localeCompare(b.doctor_name, "ru")
          : b.doctor_name.localeCompare(a.doctor_name, "ru");
      }
      if (sortKey === "studies")    { av = a.total_studies;    bv = b.total_studies; }
      if (sortKey === "findings")   { av = a.total_findings;   bv = b.total_findings; }
      if (sortKey === "concordance"){ av = a.clinicalConcordance; bv = b.clinicalConcordance; }
      if (sortKey === "g2a")        { av = a.grade2a;          bv = b.grade2a; }
      if (sortKey === "g2b")        { av = a.grade2b;          bv = b.grade2b; }
      if (sortKey === "g2b_mips")   { av = mips2bByDoctor[a.doctor_id] ?? 0; bv = mips2bByDoctor[b.doctor_id] ?? 0; }
      if (sortKey === "g3")         { av = a.grade3;           bv = b.grade3; }
      if (sortKey === "g4a")        { av = a.grade4a;          bv = b.grade4a; }
      if (sortKey === "g4b")        { av = a.grade4 + a.grade4b; bv = b.grade4 + b.grade4b; }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [doctors, sortKey, sortDir, mips2bByDoctor]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead
            className="cursor-pointer select-none hover:text-foreground"
            onClick={() => handleSort("name")}
          >
            Врач<SortIcon col="name" active={sortKey === "name"} dir={sortDir} />
          </TableHead>
          {th("Исследования", "studies")}
          {th("Находки", "findings")}
          {th("Клин. конкорд. %", "concordance")}
          {th("2a", "g2a")}
          {th("2b", "g2b")}
          {th("2b-MIPS", "g2b_mips")}
          {th("3", "g3")}
          {th("4a", "g4a")}
          {th("4b", "g4b")}
          <TableHead>Распределение</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((doc, idx) => {
          const prev = prevDoctorMap[doc.doctor_id];
          const docMips = mips2bByDoctor[doc.doctor_id] ?? 0;
          const prevDocMips = prevMips2bByDoctor?.[doc.doctor_id] ?? 0;
          return (
            <TableRow key={doc.doctor_id}>
              <TableCell className="text-muted-foreground font-medium">{idx + 1}</TableCell>
              <TableCell>
                <Link href={`/doctors/${doc.doctor_id}`} className="font-medium text-blue-600 hover:underline">
                  {doc.doctor_name}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                {doc.total_studies}
                {prev && <Delta curr={doc.total_studies} prev={prev.total_studies} />}
              </TableCell>
              <TableCell className="text-right">{doc.total_findings}</TableCell>
              <TableCell className="text-right">
                <span className={
                  doc.clinicalConcordance >= 80 ? "text-emerald-600 font-semibold"
                  : doc.clinicalConcordance >= 60 ? "text-amber-600 font-semibold"
                  : "text-red-600 font-semibold"
                }>
                  {doc.clinicalConcordance}%
                </span>
                {prev && <PctDelta curr={doc.clinicalConcordance} prev={prev.clinicalConcordance} />}
              </TableCell>
              <TableCell className="text-right">
                {doc.grade2a > 0
                  ? <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{doc.grade2a}</span>
                  : <span className="text-muted-foreground">0</span>}
              </TableCell>
              <TableCell className="text-right">
                {doc.grade2b > 0
                  ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">{doc.grade2b}</span>
                  : <span className="text-muted-foreground">0</span>}
                {prev && prev.total_findings > 0 && (
                  <PctDelta
                    curr={Math.round(doc.grade2b / doc.total_findings * 1000) / 10}
                    prev={Math.round(prev.grade2b / prev.total_findings * 1000) / 10}
                    invert
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {docMips > 0
                  ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{docMips}</span>
                  : <span className="text-muted-foreground">0</span>}
                {prevMips2bByDoctor && prev && prev.total_findings > 0 && (
                  <PctDelta
                    curr={Math.round(docMips / doc.total_findings * 1000) / 10}
                    prev={Math.round(prevDocMips / prev.total_findings * 1000) / 10}
                    invert
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {doc.grade3 > 0
                  ? <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{doc.grade3}</span>
                  : <span className="text-muted-foreground">0</span>}
                {prev && prev.total_findings > 0 && (
                  <PctDelta
                    curr={Math.round(doc.grade3 / doc.total_findings * 1000) / 10}
                    prev={Math.round(prev.grade3 / prev.total_findings * 1000) / 10}
                    invert
                  />
                )}
              </TableCell>
              <TableCell className="text-right">
                {doc.grade4a > 0
                  ? <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{doc.grade4a}</span>
                  : <span className="text-muted-foreground">0</span>}
              </TableCell>
              <TableCell className="text-right">
                {(doc.grade4 + doc.grade4b) > 0
                  ? <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">{doc.grade4 + doc.grade4b}</span>
                  : <span className="text-muted-foreground">0</span>}
                {prev && prev.total_findings > 0 && (
                  <PctDelta
                    curr={Math.round((doc.grade4 + doc.grade4b) / doc.total_findings * 1000) / 10}
                    prev={Math.round((prev.grade4 + prev.grade4b) / prev.total_findings * 1000) / 10}
                    invert
                  />
                )}
              </TableCell>
              <TableCell>
                <DoctorGradeBar
                  grade1={doc.grade1}
                  grade2a={doc.grade2a}
                  grade2b={doc.grade2b}
                  grade2bMips={docMips}
                  grade3={doc.grade3}
                  grade4={doc.grade4}
                  grade4a={doc.grade4a}
                  grade4b={doc.grade4b}
                  total={doc.total_findings}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
