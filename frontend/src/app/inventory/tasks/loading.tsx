import { Loader2 } from 'lucide-react';

export default function InventoryTasksLoading() {
  return (
    <main className="min-h-screen bg-[#18181b] p-6 text-white space-y-6">
      <div className="space-y-1 border-b border-[#27272a] pb-4">
        <div className="h-6 w-44 rounded bg-[#27272a] animate-pulse" />
        <div className="h-3.5 w-72 rounded bg-[#27272a]/60 animate-pulse" />
      </div>

      <div className="rounded border border-[#27272a] bg-[#1e1e24] p-16 flex items-center justify-center text-xs text-[#a1a1aa] gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#d8a868]" />
        <span>Chargement de vos tâches de comptage...</span>
      </div>
    </main>
  );
}
