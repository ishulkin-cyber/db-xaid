import {
  getGradeTrendData,
  getDVFindings,
  filterFindingsByDateRange,
  getDoctorStatsListFromFindings,
  getMIPS2bCountsByDoctor,
  getRootCauseData,
} from "@/lib/data";
import { SvodClient } from "@/components/svod/SvodClient";
import {
  getPeriodRange,
  shiftPeriod,
  currentRef,
  type PeriodMode,
} from "@/lib/period";
import { parseISO, getISOWeek, getYear } from "date-fns";

function toPeriodKey(ref: string, mode: PeriodMode): string {
  if (mode === "year")  return ref.slice(0, 4);
  if (mode === "month") return ref.slice(0, 7);
  const d = parseISO(ref);
  return `${getYear(d)}-W${String(getISOWeek(d)).padStart(2, "0")}`;
}

interface SearchParams {
  period?: string;
  ref?: string;
  compare?: string;
}

export default async function SvodPage({ searchParams }: { searchParams: SearchParams }) {
  const rawMode = searchParams.period ?? "month";
  const mode = (["week", "month", "year"].includes(rawMode) ? rawMode : "month") as PeriodMode;

  const ref = searchParams.ref ?? currentRef(mode);
  const compareEnabled = searchParams.compare === "1";

  const range    = getPeriodRange(mode, ref);
  const prevRef  = shiftPeriod(mode, ref, -1);
  const prevRange = getPeriodRange(mode, prevRef);

  const [allTrendData, allFindings] = await Promise.all([
    getGradeTrendData(mode),
    getDVFindings(),
  ]);

  const currentKey = toPeriodKey(ref, mode);
  const prevKey    = toPeriodKey(prevRef, mode);

  const currentPoint = allTrendData.find((p) => p.period === currentKey) ?? null;
  const prevPoint    = compareEnabled
    ? (allTrendData.find((p) => p.period === prevKey) ?? null)
    : null;

  const periodFindings = filterFindingsByDateRange(allFindings, range.start, range.end);
  const prevPeriodFindings: typeof periodFindings | null = compareEnabled
    ? filterFindingsByDateRange(allFindings, prevRange.start, prevRange.end)
    : null;

  const doctors = getDoctorStatsListFromFindings(periodFindings);
  const mips2bByDoctor = await getMIPS2bCountsByDoctor(periodFindings);

  function buildImpact(
    docList: ReturnType<typeof getDoctorStatsListFromFindings>,
    mipsMap: Map<number, number>,
  ) {
    return docList.map((d) => ({
      doctor_id:      d.doctor_id,
      doctor_name:    d.doctor_name,
      total_studies:  d.total_studies,
      total_findings: d.total_findings,
      grade3plus:     d.grade3 + d.grade4,
      grade3plusPct:  d.total_findings > 0
        ? Math.round((d.grade3 + d.grade4) / d.total_findings * 1000) / 10
        : 0,
      mips2b:    mipsMap.get(d.doctor_id) ?? 0,
      mips2bPct: d.total_findings > 0
        ? Math.round((mipsMap.get(d.doctor_id) ?? 0) / d.total_findings * 1000) / 10
        : 0,
      clinConcordance: d.clinicalConcordance,
    }));
  }

  const doctorImpact = buildImpact(doctors, mips2bByDoctor)
    .sort((a, b) => b.grade3plus - a.grade3plus || b.mips2b - a.mips2b)
    .slice(0, 7);

  let prevDoctorImpactMap: Map<number, (typeof doctorImpact)[0]> = new Map();
  if (compareEnabled && prevPeriodFindings) {
    const prevDoctors     = getDoctorStatsListFromFindings(prevPeriodFindings);
    const prevMips2bByDoc = await getMIPS2bCountsByDoctor(prevPeriodFindings);
    const prevImpact      = buildImpact(prevDoctors, prevMips2bByDoc);
    prevDoctorImpactMap   = new Map(prevImpact.map((d) => [d.doctor_id, d]));
  }

  const rootCause = await getRootCauseData(periodFindings, prevPeriodFindings);

  return (
    <SvodClient
      mode={mode}
      ref_={ref}
      compareEnabled={compareEnabled}
      periodLabel={range.label}
      prevPeriodLabel={prevRange.label}
      trendData={allTrendData}
      currentPoint={currentPoint}
      prevPoint={prevPoint}
      doctorImpact={doctorImpact}
      prevDoctorImpactMap={Object.fromEntries(prevDoctorImpactMap)}
      rootCause={rootCause}
    />
  );
}
