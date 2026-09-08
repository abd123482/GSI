'use client';

import React from 'react';
import { SerialNumber } from '@/types/equipment';
import { usePermissions } from '@/hooks/use-permissions';
import { X, Trash2, AlertTriangle, ShieldAlert, Barcode, Loader2 } from 'lucide-react';

interface DeleteSerialNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: SerialNumber | null;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
}

export function DeleteSerialNumberModal({
  isOpen,
  onClose,
  serialNumber,
  onDelete,
  isDeleting,
}: DeleteSerialNumberModalProps) {
  const { canDeleteSerialNumber, roleName } = usePermissions();

  if (!isOpen || !serialNumber) return null;

  const handleDelete = async () => {
    try {
      await onDelete(serialNumber.serialNumberId);
      onClose();
    } catch {
      // Handled by toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e3df] bg-[#fafaf9]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#ffe8d4] border border-[#dd5b00]/30 flex items-center justify-center text-[#dd5b00]">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-[#1a1a1a]">
              Supprimer le numéro de série
            </h3>
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
        <div className="p-4 space-y-3">
          {!canDeleteSerialNumber && (
            <div className="p-2.5 bg-[#fde0ec] border border-[#ff64c8]/40 rounded-lg flex items-start gap-2 text-xs text-[#a02e6d]">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Permission manquante : 'serial-number.delete' requise.</span>
            </div>
          )}

          <div className="p-3 bg-[#fef7d6] border border-[#f5d75e] rounded-lg flex items-start gap-2.5 text-xs text-[#523410]">
            <AlertTriangle className="w-4 h-4 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Ajustement automatique du stock</p>
              <p className="text-[11px] leading-relaxed text-[#523410]/90">
                La suppression de ce numéro de série décrémentera automatiquement de 1 la quantité en stock de cet équipement.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#f6f5f4] rounded-lg border border-[#e5e3df] text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#787671] flex items-center gap-1">
                <Barcode className="w-3.5 h-3.5 text-[#5645d4]" />
                Code :
              </span>
              <code className="font-mono font-bold text-[#1a1a1a] bg-white px-2 py-0.5 rounded border border-[#e5e3df]">
                {serialNumber.serialNumberCode}
              </code>
            </div>
            <div className="flex items-center justify-between text-[#787671] text-[11px]">
              <span>Statut :</span>
              <span className="font-medium text-[#1a1a1a]">{serialNumber.serialNumberStatus || 'AVAILABLE'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#fafaf9] border-t border-[#e5e3df]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-medium text-[#5d5b54] bg-white border border-[#c8c4be] rounded-lg hover:bg-[#f6f5f4] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || !canDeleteSerialNumber}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#e03131] hover:bg-[#c92a2a] active:bg-[#b02525] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Suppression...
              </>
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                Supprimer
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
