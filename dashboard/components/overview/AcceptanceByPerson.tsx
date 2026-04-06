import { cn } from "@/lib/utils";

interface AcceptanceByPersonProps {
  data: {
    name: string;
    total: number;
    acceptedAsIs: number;
    max2a: number;
    withChanges: number;
  }[];
  label: string;
}

export function AcceptanceByPerson({ data, label }: AcceptanceByPersonProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b text-muted-foreground text-xs">
          <th className="text-left py-2 font-medium">{label}</th>
          <th className="text-center py-2 font-medium">Total</th>
          <th className="text-center py-2 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />
            Accepted
          </th>
          <th className="text-center py-2 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500 mr-1" />
            Max 2a
          </th>
          <th className="text-center py-2 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1" />
            2b+
          </th>
          <th className="text-center py-2 font-medium">Accept Rate</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row) => {
          const acceptRate = row.total > 0
            ? ((row.acceptedAsIs + row.max2a) / row.total * 100).toFixed(0)
            : "0";
          return (
            <tr key={row.name} className="border-b last:border-b-0">
              <td className="py-2.5 font-medium">{row.name}</td>
              <td className="text-center">{row.total}</td>
              <td className="text-center text-emerald-600 font-medium">{row.acceptedAsIs}</td>
              <td className="text-center text-blue-600 font-medium">{row.max2a}</td>
              <td className="text-center text-amber-600 font-medium">{row.withChanges}</td>
              <td className={cn(
                "text-center font-medium",
                Number(acceptRate) >= 80 ? "text-emerald-600" : Number(acceptRate) >= 60 ? "text-amber-600" : "text-red-600"
              )}>
                {acceptRate}%
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
