'use client';

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
  Database,
  Hash,
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
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne possède pas la permission '${REQUIRED_DELETE_PERMISSION}' pour supprimer cette étagère.`,
      );
      setError(err.message);
      throw err;
    }

    try {
      await deleteShelf(shelf.shelfId);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[DeleteShelfModal] Delete failed:', err);
      setError(err.message || 'Impossible de supprimer cette étagère.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Notion Danger Card Modal */}
      <div
        className="w-full max-w-md bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-shelf-title"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#e5e3df] flex items-center justify-between bg-[#fafaf9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#fde0ec] border border-[#ff64c8] flex items-center justify-center text-[#e03131]">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="delete-shelf-title" className="text-base font-semibold text-[#1a1a1a]">
                Supprimer l’étagère
              </h2>
              <p className="text-xs text-[#5d5b54]">
                Suppression du tuple SQL Server (DELETE /shelves/:id)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#787671] hover:text-[#1a1a1a] p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Security Alert if lacking permission */}
          {!canDeleteShelf && (
            <div className="p-3.5 bg-[#ffe8d4] border border-[#f5d75e] rounded-lg flex items-start gap-3 text-left">
              <ShieldAlert className="w-5 h-5 text-[#dd5b00] shrink-0 mt-0.5" />
              <div className="text-xs text-[#793400] space-y-1">
                <p className="font-semibold">Autorisation requise : {REQUIRED_DELETE_PERMISSION}</p>
                <p>
                  Votre compte ne dispose pas des droits de suppression. L'opération sera bloquée.
                </p>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3.5 bg-[#fde0ec] border border-[#ff64c8] rounded-lg flex items-start gap-2.5 text-xs text-[#a02e6d]">
              <AlertTriangle className="w-4 h-4 text-[#e03131] shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Warning text */}
          <p className="text-xs text-[#5d5b54] leading-relaxed">
            Êtes-vous sûr de vouloir supprimer définitivement l’étagère suivante ? Cette action retirera la ligne de la table <code className="bg-[#f0eeec] px-1 py-0.5 rounded font-mono text-[#1a1a1a]">dbo.Shelf</code>.
          </p>

          {/* Target Shelf Summary Box */}
          <div className="p-3.5 bg-[#f6f5f4] border border-[#e5e3df] rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium">
              <span className="text-[#1a1a1a] text-sm font-semibold truncate">
                {shelf.shelfName ?? 'Étagère sans nom'}
              </span>
              <span className="px-2 py-0.5 rounded bg-white border border-[#e5e3df] font-mono text-[11px] text-[#5645d4]">
                {shelf.shelfQuantity} unités
              </span>
            </div>
            <div className="text-[11px] font-mono text-[#787671] truncate">
              ID: {shelf.shelfId}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#ede9e4]">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting || !canDeleteShelf}
              className="px-4 py-2 bg-[#e03131] hover:bg-[#c92a2a] text-white text-xs font-medium rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Suppression...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer définitivement</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
