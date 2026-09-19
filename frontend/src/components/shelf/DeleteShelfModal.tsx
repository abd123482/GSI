'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState } from 'react';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { REQUIRED_DELETE_PERMISSION } from '@/services/shelf.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import { Shelf } from '@/types/shelf';
import {
  X,
  Trash2,
  Loader2,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';

interface DeleteShelfModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DeleteShelfModal({
  shelf,
  isOpen,
  onClose,
  onSuccess,
}: DeleteShelfModalProps) {
  const { deleteShelf, isDeleting } = useShelves();
  const { canDeleteShelf, roleName } = usePermissions();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !shelf) return null;

  const handleDelete = async () => {
    setError(null);

    // Client-side permission guard check
    if (!canDeleteShelf) {
      const err = new InsufficientPermissionException(
        REQUIRED_DELETE_PERMISSION,
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne possède pas la permission '${REQUIRED_DELETE_PERMISSION}' pour supprimer cet emplacement.`,
      );
      setError(err.message);
      throw err;
    }

    try {
      await deleteShelf(shelf.shelfId);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[DeleteShelfModal] Delete failed:', err);
      setError(getErrorMessage(err, 'Impossible de supprimer cet emplacement.'));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Danger Card Modal (#6b7b97 Theme) */}
      <div
        className="w-full max-w-md bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-shelf-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#3f3a36] flex items-center justify-between bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-500/50 flex items-center justify-center text-rose-300">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-shelf-title" className="text-base font-semibold text-white">
                Supprimer l’emplacement
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Security Alert if lacking permission */}
          {!canDeleteShelf && (
            <div className="p-3.5 bg-amber-950/50 border border-amber-500/50 rounded-lg flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200 space-y-1">
                <p className="font-semibold">Autorisation requise : {REQUIRED_DELETE_PERMISSION}</p>
                <p>
                  Votre compte ne dispose pas des droits de suppression. L&apos;opération sera bloquée.
                </p>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-2.5 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Warning text */}
          <p className="text-xs text-white/90 leading-relaxed">
            Êtes-vous sûr de vouloir supprimer définitivement cet emplacement ? Cette action est irréversible.
          </p>

          {/* Target Shelf Summary Box */}
          <div className="p-3.5 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg space-y-2 text-xs text-white">
            <div className="flex items-center justify-between font-medium">
              <span className="text-white text-sm font-semibold truncate">
                {shelf.shelfName ?? 'Emplacement sans nom'}
              </span>
              <span className="px-2 py-0.5 rounded bg-[#2b2622] border border-[#3f3a36] font-mono text-[11px] text-white">
                {shelf.shelfQuantity} unités
              </span>
            </div>
            <div className="text-[11px] font-mono text-white/80 truncate">
              ID: {shelf.shelfId}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#3f3a36]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || !canDeleteShelf}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Suppression...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer l’emplacement</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
