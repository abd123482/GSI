'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createShelfSchema, CreateShelfFormValues } from '@/schemas/shelf.schema';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { REQUIRED_CREATE_PERMISSION } from '@/services/shelf.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import {
  X,
  Plus,
  Loader2,
  ShieldAlert,
  Layers,
  Hash,
  Database,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateShelfModal({ isOpen, onClose, onSuccess }: CreateShelfModalProps) {
  const { createShelf, isCreating } = useShelves();
  const { canCreateShelf, permissions, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShelfFormValues>({
    resolver: zodResolver(createShelfSchema),
    defaultValues: {
      shelfName: '',
      shelfQuantity: 0,
      shelfCode: '',
    },
    mode: 'onChange',
  });

  if (!isOpen) return null;

  const onSubmit = async (values: CreateShelfFormValues) => {
    setServerError(null);

    // Explicit client-side permission enforcement check
    if (!canCreateShelf) {
      const err = new InsufficientPermissionException(
        REQUIRED_CREATE_PERMISSION,
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne dispose pas de la permission '${REQUIRED_CREATE_PERMISSION}' requise pour insérer une nouvelle étagère.`,
      );
      setServerError(err.message);
      throw err;
    }

    try {
      await createShelf(values);
      reset();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[CreateShelfModal] Failed to submit shelf:', err);
      setServerError(err.message || 'Échec de la création de l’étagère');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Notion Card Modal Surface (12px rounded, 1px solid hairline, subtle elevation) */}
      <div
        className="w-full max-w-lg bg-white border border-[#e5e3df] rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#e5e3df] flex items-center justify-between bg-[#fafaf9]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#e6e0f5] border border-[#d6b6f6] flex items-center justify-center text-[#7b3ff2]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-[#1a1a1a] tracking-tight">
                Nouvelle étagère
              </h2>
              <p className="text-xs text-[#5d5b54]">
                Création d’un tuple d’emplacement physique pour SQL Server (SSMS)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#787671] hover:text-[#1a1a1a] hover:bg-[#ede9e4] p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer la fenêtre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security & Entitlement Check Banner */}
        {!canCreateShelf && (
          <div className="mx-6 mt-5 p-3.5 bg-[#ffe8d4] border border-[#f5d75e] rounded-lg flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="text-xs text-[#793400] space-y-1">
              <p className="font-semibold">Autorisation requise : {REQUIRED_CREATE_PERMISSION}</p>
              <p>
                Votre compte actuel ne possède pas la permission nécessaire pour créer un enregistrement dans
                la table <code className="bg-white/80 px-1 py-0.5 rounded font-mono">Shelf</code>.
                Toute tentative d’écriture lèvera une exception de sécurité.
              </p>
            </div>
          </div>
        )}

        {/* Server or Exception Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-[#fde0ec] border border-[#ff64c8] rounded-lg flex items-start gap-3 text-left animate-in shake-1">
            <AlertCircle className="w-5 h-5 text-[#e03131] shrink-0 mt-0.5" />
            <div className="text-xs text-[#a02e6d] space-y-0.5">
              <p className="font-semibold">Erreur de création</p>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 text-left">
          {/* Field: shelfName */}
          <div className="space-y-1.5">
            <label
              htmlFor="shelfName"
              className="flex items-center justify-between text-xs font-medium text-[#37352f]"
            >
              <span>Nom de l’étagère <span className="text-[#e03131]">*</span></span>
              <span className="text-[11px] text-[#787671]">ex: Rayon A-01, Étagère Nord</span>
            </label>
            <div className="relative">
              <input
                id="shelfName"
                type="text"
                disabled={isCreating || isSubmitting}
                placeholder="Entrez le nom ou l'identifiant visuel..."
                className={`w-full h-11 px-3.5 bg-white text-[#1a1a1a] text-sm border rounded-lg transition-all outline-none ${
                  errors.shelfName
                    ? 'border-[#e03131] focus:ring-2 focus:ring-[#e03131]/20'
                    : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-2 focus:ring-[#5645d4]/20'
                }`}
                {...register('shelfName')}
              />
            </div>
            {errors.shelfName && (
              <p className="text-xs text-[#e03131] flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.shelfName.message}
              </p>
            )}
          </div>

          {/* Field: shelfQuantity */}
          <div className="space-y-1.5">
            <label
              htmlFor="shelfQuantity"
              className="flex items-center justify-between text-xs font-medium text-[#37352f]"
            >
              <span>Capacité / Quantité initiale <span className="text-[#e03131]">*</span></span>
              <span className="text-[11px] text-[#787671]">Stock initial (entier ≥ 0)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#787671]">
                <Hash className="w-4 h-4" />
              </div>
              <input
                id="shelfQuantity"
                type="number"
                min="0"
                step="1"
                disabled={isCreating || isSubmitting}
                placeholder="0"
                className={`w-full h-11 pl-10 pr-3.5 bg-white text-[#1a1a1a] text-sm border rounded-lg transition-all outline-none ${
                  errors.shelfQuantity
                    ? 'border-[#e03131] focus:ring-2 focus:ring-[#e03131]/20'
                    : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-2 focus:ring-[#5645d4]/20'
                }`}
                {...register('shelfQuantity')}
              />
            </div>
            {errors.shelfQuantity && (
              <p className="text-xs text-[#e03131] flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.shelfQuantity.message}
              </p>
            )}
          </div>

          {/* Optional Code reference */}
          <div className="space-y-1.5">
            <label
              htmlFor="shelfCode"
              className="flex items-center justify-between text-xs font-medium text-[#37352f]"
            >
              <span>Code de repérage interne (Optionnel)</span>
              <span className="text-[11px] text-[#a4a097]">Code barre / QR Code</span>
            </label>
            <input
              id="shelfCode"
              type="text"
              disabled={isCreating || isSubmitting}
              placeholder="ex: SH-001-A"
              className="w-full h-11 px-3.5 bg-white text-[#1a1a1a] text-sm border border-[#e5e3df] rounded-lg transition-all outline-none focus:border-[#5645d4] focus:ring-2 focus:ring-[#5645d4]/20"
              {...register('shelfCode')}
            />
          </div>

          {/* Live Tuple Preview matching SQL Server format */}
          <div className="p-3 bg-[#f6f5f4] border border-[#e5e3df] rounded-lg space-y-1 text-xs">
            <div className="flex items-center justify-between text-[#5d5b54]">
              <span className="font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#5645d4]" />
                Aperçu du tuple SQL Server (SSMS)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e6e0f5] text-[#5645d4] font-mono">
                dbo.Shelf
              </span>
            </div>
            <p className="text-[11px] text-[#787671] font-mono truncate">
              INSERT INTO Shelf (shelfId, shelfName, shelfQuantity) VALUES (NEWID(), ...)
            </p>
          </div>

          {/* Action Buttons: Notion button-primary (8px rounded, #5645d4 Notion purple) */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#ede9e4]">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating || isSubmitting}
              className="px-4 py-2.5 bg-transparent hover:bg-[#f0eeec] active:bg-[#e5e3df] text-[#1a1a1a] border border-[#c8c4be] text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isCreating || isSubmitting || !canCreateShelf}
              className="px-4.5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Créer l’étagère</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
