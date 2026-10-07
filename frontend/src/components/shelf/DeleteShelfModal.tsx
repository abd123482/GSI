'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, ShieldAlert, Trash2, X } from 'lucide-react';

import type { Shelf } from '@/types/shelf';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/error-message';

interface DeleteShelfModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteShelfModal({ shelf, isOpen, onClose, onSuccess }: DeleteShelfModalProps) {
  const { deleteShelf, isDeleting } = useShelves({ enabled: false });
  const { canDeleteShelf } = usePermissions();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !shelf) return null;

  async function handleDelete() {
    setError(null);
    if (!canDeleteShelf) {
      setError("Permission 'shelf.delete' requise.");
      return;
    }

    try {
      await deleteShelf(shelf!.shelfId);
      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setError(getErrorMessage(cause, 'Impossible de supprimer cet emplacement.'));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><Trash2 className="h-4 w-4 text-rose-300" />Supprimer l’emplacement</h2>
          <button type="button" onClick={onClose} className="rounded p-1.5 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 p-5">
          {error && <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div>}
          <div className="flex gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1"><p className="font-semibold">Suppression protégée.</p><p>Le backend refusera la suppression si l’emplacement contient du stock, un numéro de série ou un historique de mouvements.</p></div>
          </div>
          <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/65 p-3 text-xs">
            <p className="font-semibold">{shelf.shelfName ?? 'Emplacement sans nom'}</p>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#3f3f46] bg-[#18181b] px-5 py-3">
          <button type="button" onClick={onClose} disabled={isDeleting} className="rounded border border-[#3f3f46] px-3 py-1.5 text-xs">Annuler</button>
          <button type="button" onClick={handleDelete} disabled={isDeleting || !canDeleteShelf} className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3.5 py-1.5 text-xs disabled:opacity-40">
            {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Supprimer
          </button>
        </footer>
      </div>
    </div>
  );
}
