import { Loader2 } from 'lucide-react';

export default function CreateInventoryLoading() {
  return (
    <main className="min-h-screen bg-[#18181b] p-6 text-white space-y-6">
      <div className="space-y-1 border-b border-[#27272a] pb-4">
        <div className="h-6 w-48 rounded bg-[#27272a] animate-pulse" />
        <div className="h-3.5 w-64 rounded bg-[#27272a]/60 animate-pulse" />
      </div>

      <div className="max-w-4xl rounded border border-[#27272a] bg-[#1e1e24] p-16 flex items-center justify-center text-xs text-[#a1a1aa] gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-[#d8a868]" />
        <span>Initialisation du formulaire...</span>
      </div>
    </main>
  );
}
