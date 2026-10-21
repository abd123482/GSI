import { Loader2 } from 'lucide-react';

export default function InventoryReportLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-[#18181b] text-white p-6 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-[#27272a] animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-48 rounded bg-[#27272a] animate-pulse" />
            <div className="h-3.5 w-32 rounded bg-[#27272a]/60 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 rounded bg-[#27272a] animate-pulse" />
          <div className="h-8 w-28 rounded bg-[#27272a] animate-pulse" />
        </div>
      </div>

      {/* Rounds navigation bar skeleton */}
      <div className="flex items-center gap-2 rounded border border-[#27272a] bg-[#1e1e24] p-3">
        <div className="h-7 w-20 rounded bg-[#27272a] animate-pulse" />
        <div className="h-7 w-20 rounded bg-[#27272a] animate-pulse" />
        <div className="h-7 w-20 rounded bg-[#27272a] animate-pulse" />
      </div>

      {/* Summary KPI Cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded border border-[#27272a] bg-[#1e1e24] p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-[#27272a] animate-pulse" />
            <div className="h-7 w-14 rounded bg-[#27272a] animate-pulse" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="rounded border border-[#27272a] bg-[#1e1e24] overflow-hidden">
        <div className="flex items-center justify-center p-16 text-xs text-[#a1a1aa] gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#d8a868]" />
          <span>Chargement du rapport d&apos;inventaire...</span>
        </div>
      </div>
    </main>
  );
}
