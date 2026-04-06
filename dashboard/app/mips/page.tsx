import { getMIPSOverallStats, getMIPSByDoctor } from "@/lib/data";
import { MIPSClient } from "@/components/mips/MIPSClient";

export default function MIPSPage() {
  const overallStats = getMIPSOverallStats();
  const byDoctor = getMIPSByDoctor();

  return <MIPSClient overallStats={overallStats} byDoctor={byDoctor} />;
}
