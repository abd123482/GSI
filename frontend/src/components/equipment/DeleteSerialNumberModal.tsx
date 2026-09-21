'use client';

import {
  useState,
} from 'react';
import {
  AlertTriangle,
  Barcode,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

import type {
  SerialNumber,
} from '@/types/equipment';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  getErrorMessage,
} from '@/lib/error-message';

interface DeleteSerialNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: SerialNumber | null;
  onDelete: (
    id: string,
  ) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteSerialNumberModal({
  isOpen,
  onClose,
  serialNumber,
  onDelete,
  isDeleting,
}: DeleteSerialNumberModalProps) {
  const {
    canDeleteSerialNumber,
  } = usePermissions();

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  if (
    !isOpen ||
    !serialNumber
  ) {
    return null;
  }

  // Capture the narrowed value so TypeScript keeps it non-null inside async handlers.
  const currentSerialNumber = serialNumber;

  const currentlyPlaced =
    Boolean(
      currentSerialNumber.shelfId,
    );

  async function handleDelete() {
    setError(null);

    if (!canDeleteSerialNumber) {
      setError(
        "Permission 'serial-number.delete' requise.",
      );
      return;
    }

    try {
      await onDelete(
        currentSerialNumber.serialNumberId,
      );

      onClose();
    } catch (cause: unknown) {
      setError(
        getErrorMessage(
          cause,
          'Impossible de supprimer ce numéro de série.',
        ),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-4 py-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold">
            <Trash2 className="h-4 w-4 text-rose-300" />
            Supprimer le numéro de série
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          {error && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="space-y-1">
              {currentlyPlaced ? (
                <p>
                  Ce numéro est encore dans un emplacement. Effectuez d’abord
                  un mouvement OUT. La suppression sera refusée tant que
                  <code> shelfId </code>
                  n’est pas nul.
                </p>
              ) : (
                <p>
                  Le numéro n’est plus affecté à un emplacement. Le backend
                  refusera néanmoins la suppression s’il possède déjà un
                  historique de mouvements.
                </p>
              )}

              <p className="text-amber-100/70">
                Une suppression autorisée décrémente la quantité globale de
                l’article sérialisé d’une identité.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-white/55">
                <Barcode className="h-3.5 w-3.5" />
                Code
              </span>

              <code className="truncate font-mono font-semibold">
                {currentSerialNumber.serialNumberCode ??
                  currentSerialNumber.serialNumberId}
              </code>
            </div>

            <div className="mt-2 flex items-center justify-between text-white/55">
              <span>
                Emplacement
              </span>
              <span className="truncate text-white">
                {currentSerialNumber.shelf?.shelfName ??
                  currentSerialNumber.shelfId ??
                  'Non affecté'}
              </span>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#3f3a36] bg-[#2b2622] px-4 py-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded border border-[#3f3a36] px-3 py-1.5 text-xs"
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={
              isDeleting ||
              !canDeleteSerialNumber ||
              currentlyPlaced
            }
            onClick={
              handleDelete
            }
            className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3.5 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Supprimer
          </button>
        </footer>
      </div>
    </div>
  );
}
