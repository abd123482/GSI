'use client';

import {
  useState,
} from 'react';
import {
  AlertTriangle,
  Barcode,
  Layers,
  Loader2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';

import type {
  Equipment,
} from '@/types/equipment';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  getErrorMessage,
} from '@/lib/error-message';

interface DeleteEquipmentModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (
    id: string,
  ) => Promise<void>;
  isDeleting: boolean;
  onSuccess?: () => void;
}

export function DeleteEquipmentModal({
  equipment,
  isOpen,
  onClose,
  onDelete,
  isDeleting,
  onSuccess,
}: DeleteEquipmentModalProps) {
  const {
    canDeleteEquipment,
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
    !equipment
  ) {
    return null;
  }

  /**
   * Capture the narrowed value.
   *
   * TypeScript does not always preserve prop narrowing inside nested async
   * callbacks because props can theoretically change between renders.
   */
  const currentEquipment: Equipment =
    equipment;

  const serialCount =
    currentEquipment._count?.serialNumbers ??
    currentEquipment.serialNumbers?.length ??
    (currentEquipment.hasSerialNumber
      ? currentEquipment.equipmentQuantity
      : 0);

  const allocationCount =
    currentEquipment._count?.equipmentShelfs ??
    currentEquipment.equipmentShelfs?.length ??
    0;

  async function handleDelete() {
    setError(null);

    if (!canDeleteEquipment) {
      setError(
        "Permission 'equipment.delete' requise.",
      );
      return;
    }

    try {
      await onDelete(
        currentEquipment.equipmentId,
      );

      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setError(
        getErrorMessage(
          cause,
          'Impossible de supprimer cet article.',
        ),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-equipment-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-rose-300" />

            <h2
              id="delete-equipment-title"
              className="text-sm font-semibold"
            >
              Supprimer l’article
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {error && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2.5 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

            <div className="space-y-1">
              <p className="font-semibold">
                Suppression protégée par l’historique.
              </p>

              <p className="text-[11px] leading-relaxed text-amber-100/75">
                Le backend refusera la suppression si l’article possède un
                historique de mouvements, des numéros de série ou une
                allocation positive.
              </p>

              <p className="text-[11px] leading-relaxed text-amber-100/75">
                Aucun historique de mouvement ne sera supprimé en cascade.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3 text-xs">
            <p className="font-semibold">
              {currentEquipment.equipmentName ??
                currentEquipment.equipmentId}
            </p>

            <div className="flex items-center justify-between text-white/60">
              <span>
                Quantité globale
              </span>

              <span className="font-mono text-white">
                {currentEquipment.equipmentQuantity}
              </span>
            </div>

            <div className="flex items-center justify-between text-white/60">
              <span className="flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" />
                Allocations
              </span>

              <span className="font-mono text-white">
                {allocationCount}
              </span>
            </div>

            {currentEquipment.hasSerialNumber && (
              <div className="flex items-center justify-between text-white/60">
                <span className="flex items-center gap-1">
                  <Barcode className="h-3.5 w-3.5" />
                  Séries
                </span>

                <span className="font-mono text-white">
                  {serialCount}
                </span>
              </div>
            )}

            <div className="border-t border-[#3f3a36] pt-2">
              <span className="block text-[9px] uppercase tracking-wider text-white/35">
                GUID
              </span>

              <code className="mt-1 block truncate font-mono text-[10px] text-white/60">
                {currentEquipment.equipmentId}
              </code>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#3f3a36] bg-[#2b2622] px-5 py-3">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="rounded border border-[#3f3a36] px-3 py-1.5 text-xs transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            Annuler
          </button>

          <button
            type="button"
            disabled={
              isDeleting ||
              !canDeleteEquipment
            }
            onClick={
              handleDelete
            }
            className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}

            {isDeleting
              ? 'Suppression...'
              : 'Supprimer'}
          </button>
        </footer>
      </div>
    </div>
  );
}
