import { useCallback, useEffect, useState } from "react";
import { addDays, format, subDays, subMonths, subYears } from "date-fns";
import { api } from "./api";
import type {
  DoctorDetail,
  OverviewData,
  PeriodPreset,
  QualityTableData,
  Tab,
  ViewMode,
  WorkloadData,
} from "./types";
import Header from "./components/Header";
import PeriodSelector from "./components/PeriodSelector";
import StatsCards from "./components/StatsCards";
import QualityTable from "./components/QualityTable";
import DoctorDetailPanel from "./components/DoctorDetail";
import WorkloadView from "./components/WorkloadView";
import ReportComparison from "./components/ReportComparison";
import MethodologyModal from "./components/MethodologyModal";

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function periodDates(preset: PeriodPreset): [Date, Date] {
  const today = new Date();
  switch (preset) {
    case "day":
      return [today, today];
    case "week":
      return [subDays(today, 6), today];
    case "month":
      return [subDays(today, 29), today];
    case "year":
      return [subYears(today, 1), today];
    case "all":
    default:
      return [subMonths(today, 6), today];
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>("quality");
  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("days");
  const [showMethodology, setShowMethodology] = useState(false);

  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null);
  const [comparisonTaskId, setComparisonTaskId] = useState<number | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [qualityTable, setQualityTable] = useState<QualityTableData | null>(null);
  const [workloadData, setWorkloadData] = useState<WorkloadData | null>(null);
  const [doctorDetail, setDoctorDetail] = useState<DoctorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [start, end] = customStart && customEnd
    ? [customStart, customEnd]
    : periodDates(preset);

  const startStr = isoDate(start);
  const endStr = isoDate(end);

  const loadMain = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "quality") {
        const [ov, qt] = await Promise.all([
          api.overview(startStr, endStr),
          api.qualityTable(startStr, endStr, viewMode),
        ]);
        setOverview(ov);
        setQualityTable(qt);
      } else {
        const wd = await api.workload(startStr, endStr, viewMode);
        setWorkloadData(wd);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  }, [tab, startStr, endStr, viewMode]);

  useEffect(() => {
    loadMain();
  }, [loadMain]);

  useEffect(() => {
    if (!selectedDoctorId) {
      setDoctorDetail(null);
      return;
    }
    setDetailLoading(true);
    api
      .doctorDetail(selectedDoctorId, startStr, endStr)
      .then(setDoctorDetail)
      .catch(() => setDoctorDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedDoctorId, startStr, endStr]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <Header
        onMethodologyClick={() => setShowMethodology(true)}
        tab={tab}
        onTabChange={setTab}
      />

      <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center gap-4">
        <PeriodSelector
          preset={preset}
          onPresetChange={(p) => { setPreset(p); setCustomStart(null); setCustomEnd(null); }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          customStart={customStart}
          customEnd={customEnd}
          onCustomRange={(s, e) => { setCustomStart(s); setCustomEnd(e); setPreset("all"); }}
        />
      </div>

      {tab === "quality" && (
        <>
          <div className="px-4 pt-4">
            <StatsCards overview={overview} loading={loading} />
          </div>

          <div className="px-4 py-4">
            {error ? (
              <div className="text-red-400 p-4 bg-red-400/10 rounded-lg">{error}</div>
            ) : (
              <div className="flex gap-4">
                <div className={selectedDoctorId ? "flex-1 min-w-0" : "w-full"}>
                  <QualityTable
                    data={qualityTable}
                    loading={loading}
                    selectedDoctorId={selectedDoctorId}
                    onDoctorSelect={setSelectedDoctorId}
                    onTaskClick={setComparisonTaskId}
                  />
                </div>
                {selectedDoctorId && (
                  <div className="w-[520px] shrink-0">
                    <DoctorDetailPanel
                      detail={doctorDetail}
                      loading={detailLoading}
                      onClose={() => setSelectedDoctorId(null)}
                      onTaskClick={setComparisonTaskId}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "workload" && (
        <div className="px-4 py-4">
          {error ? (
            <div className="text-red-400 p-4 bg-red-400/10 rounded-lg">{error}</div>
          ) : (
            <WorkloadView data={workloadData} loading={loading} />
          )}
        </div>
      )}

      {comparisonTaskId && (
        <ReportComparison
          taskId={comparisonTaskId}
          onClose={() => setComparisonTaskId(null)}
        />
      )}

      {showMethodology && (
        <MethodologyModal onClose={() => setShowMethodology(false)} />
      )}
    </div>
  );
}
