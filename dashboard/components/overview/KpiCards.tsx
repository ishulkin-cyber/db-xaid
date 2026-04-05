import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface KpiCardsProps {
  concordance: number;
  significantRate: number;
  totalFindings: number;
  totalStudies: number;
  studiesAccepted: number;
}

export function KpiCards({
  concordance,
  significantRate,
  totalFindings,
  totalStudies,
  studiesAccepted,
}: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Clinical Concordance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-emerald-600">{concordance}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Significant Discrepancy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={`text-3xl font-bold ${
              significantRate > 0 ? "text-orange-600" : "text-emerald-600"
            }`}
          >
            {significantRate}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Findings Analyzed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalFindings}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Studies Reviewed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{totalStudies}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {studiesAccepted} accepted as-is
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
