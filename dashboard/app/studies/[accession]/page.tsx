import Link from "next/link";
import { notFound } from "next/navigation";
import { getStudyDetail } from "@/lib/data";
import { GradeBadge } from "@/components/studies/GradeBadge";
import { DVFindingsTable } from "@/components/study-detail/DVFindingsTable";
import { DVStudyHeader } from "@/components/study-detail/DVStudyHeader";
import { DVStudyTabs } from "@/components/study-detail/DVStudyTabs";

export const dynamic = "force-dynamic";

interface StudyDetailPageProps {
  params: Promise<{ accession: string }>;
}

export default async function StudyDetailPage({ params }: StudyDetailPageProps) {
  const { accession } = await params;
  const { findings, pair, summary } = await getStudyDetail(accession);

  if (!summary) {
    return (
      <div className="py-12 text-center">
        <h1 className="text-2xl font-bold mb-2">Исследование не найдено</h1>
        <p className="text-muted-foreground mb-4">
          Нет исследования с номером {accession}.
        </p>
        <Link href="/studies" className="text-sm text-primary hover:underline">
          Все исследования
        </Link>
      </div>
    );
  }

  const reportPair = pair
    ? {
        val_findings: pair.val_findings,
        val_impression: pair.val_impression,
        val_protocol: pair.val_protocol ?? "",
        doc_findings: pair.doc_findings,
        doc_impression: pair.doc_impression,
        doc_findings_en: pair.doc_findings_en ?? "",
        doc_impression_en: pair.doc_impression_en ?? "",
      }
    : undefined;

  return (
    <div className="space-y-6">
      <Link
        href="/studies"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Все исследования
      </Link>

      <DVStudyHeader summary={summary} />

      <DVStudyTabs findings={findings} pair={reportPair} />
    </div>
  );
}
