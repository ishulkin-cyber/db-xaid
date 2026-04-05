export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-7 w-32 rounded bg-slate-200" />
        <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
      </div>
      <div className="rounded-lg border bg-white">
        <div className="p-4 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 w-16 rounded bg-slate-100" />
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-4 flex-1 rounded bg-slate-100" />
              <div className="h-4 w-12 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
