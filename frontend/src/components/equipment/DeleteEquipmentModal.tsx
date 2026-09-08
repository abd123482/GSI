'use client';

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
    } catch (err: any) {
      console.error('[DeleteEquipmentModal] Delete failed:', err);
      setError(err.message || 'Impossible de supprimer cet équipement.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-equipment-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e3df] bg-[#fafaf9]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ffe8d4] border border-[#dd5b00]/30 flex items-center justify-center text-[#dd5b00]">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <h3 id="delete-equipment-title" className="text-sm font-semibold text-[#1a1a1a]">
                Supprimer l’équipement
              </h3>
              <p className="text-[11px] text-[#787671]">Confirmation de suppression définitive</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#787671] hover:text-[#1a1a1a] hover:bg-[#f0eeec] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Permission Guard Error */}
          {error && (
            <div className="p-3 bg-[#fde0ec] border border-[#ff64c8]/40 rounded-lg flex items-start gap-2.5 text-xs text-[#a02e6d]">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warning Banner */}
          <div className="p-3.5 bg-[#fef7d6] border border-[#f5d75e] rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="text-xs text-[#523410] space-y-1">
              <p className="font-semibold">Attention : Cette action est irréversible.</p>
              <p className="text-[11px] leading-relaxed">
                L’équipement <span className="font-bold">"{equipment.equipmentName}"</span> sera définitivement supprimé de la base de données SQL Server.
              </p>
            </div>
          </div>

          {/* Record Details */}
          <div className="p-3 bg-[#f6f5f4] rounded-lg border border-[#e5e3df] space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#5d5b54]">
              <span className="flex items-center gap-1.5 font-medium">
                <Cpu className="w-3.5 h-3.5 text-[#787671]" />
                Nom de l’équipement :
              </span>
              <span className="font-semibold text-[#1a1a1a]">{equipment.equipmentName}</span>
            </div>
            <div className="flex items-center justify-between text-[#5d5b54]">
              <span className="flex items-center gap-1.5 font-medium">
                <Layers className="w-3.5 h-3.5 text-[#787671]" />
                Quantité en stock :
              </span>
              <span className="font-semibold text-[#1a1a1a]">{equipment.equipmentQuantity} unité(s)</span>
            </div>
            {equipment.hasSerialNumber && (
              <div className="flex items-center justify-between text-[#5d5b54]">
                <span className="flex items-center gap-1.5 font-medium">
                  <Barcode className="w-3.5 h-3.5 text-[#5645d4]" />
                  Numéros de série enfants :
                </span>
                <span className="font-semibold px-2 py-0.5 rounded bg-[#e6e0f5] text-[#5645d4]">
                  {serialCount} code(s) (seront également supprimés)
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[#787671] text-[11px] pt-1 border-t border-[#e5e3df]">
              <span>UUID :</span>
              <code className="font-mono text-[10px]">{equipment.equipmentId}</code>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3.5 bg-[#fafaf9] border-t border-[#e5e3df]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 text-xs font-medium text-[#5d5b54] bg-white border border-[#c8c4be] rounded-lg hover:bg-[#f6f5f4] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || !canDeleteEquipment}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#e03131] hover:bg-[#c92a2a] active:bg-[#b02525] rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
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
