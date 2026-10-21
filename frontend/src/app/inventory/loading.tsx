import { Loader2 } from 'lucide-react';

export default function InventoryLoading() {
  return (
    <main className="min-h-screen bg-[#18181b] p-6 text-white space-y-6">
      <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
        <div className="space-y-1">
          <div className="h-6 w-36 rounded bg-[#27272a] animate-pulse" />
          <div className="h-3.5 w-64 rounded bg-[#27272a]/60 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded bg-[#27272a] animate-pulse" />
      </div>

      <div className="rounded border border-[#27272a] bg-[#1e1e24] overflow-hidden">
        <div className="flex items-center justify-center p-20 text-xs text-[#a1a1aa] gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#d8a868]" />
          <span>Chargement des inventaires...</span>
        </div>
      </div>
    </main>
  );
}
