import { getMIPSOverallStats, getMIPSByDoctor } from "@/lib/data";

export const dynamic = "force-dynamic";
import { MIPSClient } from "@/components/mips/MIPSClient";

export default async function MIPSPage() {
  const [overallStats, byDoctor] = await Promise.all([
    getMIPSOverallStats(),
    getMIPSByDoctor(),
  ]);

  return <MIPSClient overallStats={overallStats} byDoctor={byDoctor} />;
}
