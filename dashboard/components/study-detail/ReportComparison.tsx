"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportPair {
  val_findings: string;
  val_impression: string;
  doc_findings: string;
  doc_impression: string;
}

interface ReportComparisonProps {
  pair?: ReportPair;
  showDoctor?: boolean;
  simonmedReport?: string;
}

function ReportSection({ title, findings, impression }: { title: string; findings: string; impression: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Findings
          </h4>
          <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 font-mono text-xs">
            {findings || "No findings text available."}
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Impression
          </h4>
          <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 font-mono text-xs">
            {impression || "No impression text available."}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FullTextSection({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="whitespace-pre-wrap text-sm leading-relaxed bg-muted/30 rounded-md p-3 font-mono text-xs">
          {text || "No report text available."}
        </div>
      </CardContent>
    </Card>
  );
}

export function ReportComparison({ pair, showDoctor = false, simonmedReport }: ReportComparisonProps) {
  const hasPrelim = pair && (pair.val_findings || pair.val_impression);
  const hasSimonmed = simonmedReport && simonmedReport.trim().length > 0;

  if (!hasPrelim && !hasSimonmed) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Report text not available for this study.
      </div>
    );
  }

  // SimonMed comparison mode: our prelim vs SimonMed final
  if (hasSimonmed && !showDoctor) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {hasPrelim ? (
          <ReportSection
            title="Our Prelim Report"
            findings={pair!.val_findings}
            impression={pair!.val_impression}
          />
        ) : (
          <FullTextSection title="Our Prelim Report" text="" />
        )}
        <FullTextSection title="SimonMed Final Report" text={simonmedReport!} />
      </div>
    );
  }

  // Doctor vs Validator mode
  if (showDoctor && pair) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportSection
          title="Validator (Sent to SimonMed)"
          findings={pair.val_findings}
          impression={pair.val_impression}
        />
        <ReportSection
          title="Doctor's Draft"
          findings={pair.doc_findings}
          impression={pair.doc_impression}
        />
      </div>
    );
  }

  // Fallback: just our prelim
  if (hasPrelim) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ReportSection
          title="Our Prelim Report"
          findings={pair!.val_findings}
          impression={pair!.val_impression}
        />
        {hasSimonmed && (
          <FullTextSection title="SimonMed Final Report" text={simonmedReport!} />
        )}
      </div>
    );
  }

  return (
    <div className="py-8 text-center text-muted-foreground">
      Report text not available for this study.
    </div>
  );
}
