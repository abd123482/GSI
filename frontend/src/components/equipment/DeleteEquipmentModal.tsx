'use client';

import { getErrorMessage } from '@/lib/error-message';

import React, { useState } from 'react';
import { Equipment } from '@/types/equipment';
import { usePermissions } from '@/hooks/use-permissions';
import {
  X,
  Trash2,
  Loader2,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Layers,
  Barcode,
} from 'lucide-react';

interface DeleteEquipmentModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
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
  const { canDeleteEquipment, roleName } = usePermissions();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !equipment) return null;

  const serialCount = equipment.serialNumbers?.length ?? 0;

  const handleDelete = async () => {
    setError(null);

    if (!canDeleteEquipment) {
      setError(
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne possède pas la permission 'equipment.delete' pour supprimer cet équipement.`,
      );
      return;
    }

    try {
      await onDelete(equipment.equipmentId);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[DeleteEquipmentModal] Delete failed:', err);
      setError(getErrorMessage(err, 'Impossible de supprimer cet équipement.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-equipment-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#3f3a36] bg-[#2b2622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-200">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-equipment-title" className="text-sm font-semibold text-white">
                Supprimer l’équipement
              </h3>
              <p className="text-[11px] text-white/70">Confirmation de suppression définitive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Permission Guard Error */}
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warning Banner */}
          <div className="p-3.5 bg-rose-950/40 border border-rose-500/40 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-100 space-y-1">
              <p className="font-semibold">Attention : Cette action est irréversible.</p>
              <p className="text-[11px] leading-relaxed text-rose-200/90">
                L’équipement <span className="font-bold text-white">&quot;{equipment.equipmentName}&quot;</span> sera définitivement supprimé de la base de données SQL Server.
              </p>
            </div>
          </div>

          {/* Record Details */}
          <div className="p-3 bg-[#2b2622]/60 rounded-lg border border-[#3f3a36] space-y-2 text-xs">
            <div className="flex items-center justify-between text-white/80">
              <span className="flex items-center gap-1.5 font-medium text-white/90">
                <Cpu className="w-3.5 h-3.5 text-white/70" />
                Nom de l’équipement :
              </span>
              <span className="font-semibold text-white">{equipment.equipmentName}</span>
            </div>
            <div className="flex items-center justify-between text-white/80">
              <span className="flex items-center gap-1.5 font-medium text-white/90">
                <Layers className="w-3.5 h-3.5 text-white/70" />
                Quantité en stock :
              </span>
              <span className="font-semibold text-white">{equipment.equipmentQuantity} unité(s)</span>
            </div>
            {equipment.hasSerialNumber && (
              <div className="flex items-center justify-between text-white/80">
                <span className="flex items-center gap-1.5 font-medium text-white/90">
                  <Barcode className="w-3.5 h-3.5 text-emerald-300" />
                  Numéros de série enfants :
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-[#2b2622] text-emerald-300 border border-emerald-400/30">
                  {serialCount} code(s) (seront également supprimés)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-white/60 text-[11px] pt-1 border-t border-white/15">
              <span>UUID :</span>
              <code className="font-mono text-[10px] text-white/90">{equipment.equipmentId}</code>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#2b2622] border-t border-[#3f3a36]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || !canDeleteEquipment}
            className="px-4 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer définitivement
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
