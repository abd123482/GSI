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
  const { canDeleteSerialNumber } = usePermissions();

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-sm bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3f3a36] bg-[#2b2622]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-200">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-white">
              Supprimer le numéro de série
            </h3>
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
        <div className="p-4 space-y-3">
          {!canDeleteSerialNumber && (
            <div className="p-2.5 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-2 text-xs text-rose-200">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-rose-300" />
              <span>Permission manquante : &apos;serial-number.delete&apos; requise.</span>
            </div>
          )}

          <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg flex items-start gap-2.5 text-xs text-rose-100">
            <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Ajustement automatique du stock</p>
              <p className="text-[11px] leading-relaxed text-rose-200/90">
                La suppression de ce numéro de série décrémentera automatiquement de 1 la quantité en stock de cet équipement.
              </p>
            </div>
          </div>

          <div className="p-3 bg-[#2b2622]/60 rounded-lg border border-[#3f3a36] text-xs space-y-1.5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-white/80 flex items-center gap-1">
                <Barcode className="w-3.5 h-3.5 text-emerald-300" />
                Code :
              </span>
              <code className="font-mono font-bold text-white bg-black/30 px-2 py-0.5 rounded border border-white/20">
                {serialNumber.serialNumberCode}
              </code>
            </div>
            <div className="flex items-center justify-between text-white/70 text-[11px]">
              <span>Statut :</span>
              <span className="font-medium text-white">{serialNumber.serialNumberStatus || 'AVAILABLE'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 bg-[#2b2622] border-t border-[#3f3a36]">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || !canDeleteSerialNumber}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
