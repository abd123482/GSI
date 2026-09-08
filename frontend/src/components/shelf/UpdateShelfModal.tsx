'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateShelfSchema, UpdateShelfFormValues } from '@/schemas/shelf.schema';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { REQUIRED_UPDATE_PERMISSION } from '@/services/shelf.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import { Shelf } from '@/types/shelf';
import {
  X,
  Edit3,
  Loader2,
  ShieldAlert,
  Layers,
  Hash,
  Database,
  AlertCircle,
} from 'lucide-react';

interface UpdateShelfModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateShelfModal({
  shelf,
  isOpen,
  onClose,
  onSuccess,
}: UpdateShelfModalProps) {
  const { updateShelf, isUpdating } = useShelves();
  const { canUpdateShelf, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateShelfFormValues>({
    resolver: zodResolver(updateShelfSchema),
    defaultValues: {
      shelfName: shelf?.shelfName ?? '',
      shelfQuantity: shelf?.shelfQuantity ?? 0,
    },
    mode: 'onChange',
  });

  // Keep form values in sync when selected shelf changes
  useEffect(() => {
    if (shelf) {
      reset({
        shelfName: shelf.shelfName ?? '',
        shelfQuantity: shelf.shelfQuantity ?? 0,
      });
      setServerError(null);
    }
  }, [shelf, reset]);

  if (!isOpen || !shelf) return null;

  const onSubmit = async (values: UpdateShelfFormValues) => {
    setServerError(null);

    // Client-side permission guard check
    if (!canUpdateShelf) {
      const err = new InsufficientPermissionException(
        REQUIRED_UPDATE_PERMISSION,
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne possède pas la permission '${REQUIRED_UPDATE_PERMISSION}' pour modifier cette étagère.`,
      );
      setServerError(err.message);
      throw err;
    }

    try {
      await updateShelf({
        id: shelf.shelfId,
        data: values,
      });
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[UpdateShelfModal] Update failed:', err);
      setServerError(err.message || 'Échec de la modification de l’étagère.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Notion Card Modal Surface */}
      <div
        className="w-full max-w-lg bg-white border border-[#e5e3df] rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-shelf-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#e5e3df] flex items-center justify-between bg-[#fafaf9]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#dcecfa] border border-[#b2d7f7] flex items-center justify-center text-[#0075de]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="update-shelf-title" className="text-lg font-semibold text-[#1a1a1a] tracking-tight">
                Modifier l’étagère
              </h2>
              <p className="text-xs text-[#5d5b54]">
                Mise à jour du tuple SQL Server (PATCH /shelves/:id)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#787671] hover:text-[#1a1a1a] hover:bg-[#ede9e4] p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security & Entitlement Warning Banner */}
        {!canUpdateShelf && (
          <div className="mx-6 mt-5 p-3.5 bg-[#ffe8d4] border border-[#f5d75e] rounded-lg flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="text-xs text-[#793400] space-y-1">
              <p className="font-semibold">Autorisation requise : {REQUIRED_UPDATE_PERMISSION}</p>
              <p>
                Votre rôle ne dispose pas de la permission nécessaire pour exécuter la méthode PATCH sur cette étagère.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-[#fde0ec] border border-[#ff64c8] rounded-lg flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-[#e03131] shrink-0 mt-0.5" />
            <div className="text-xs text-[#a02e6d] space-y-0.5">
              <p className="font-semibold">Erreur de modification</p>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 text-left">
          {/* Target Shelf UUID info */}
          <div className="p-3 bg-[#f6f5f4] border border-[#e5e3df] rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between text-[#5d5b54]">
              <span className="font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#5645d4]" />
                Enregistrement SQL Server (shelfId)
              </span>
              <span className="font-mono text-[11px] text-[#1a1a1a] truncate max-w-[200px]">
                {shelf.shelfId}
              </span>
            </div>
          </div>

          {/* Field: shelfName */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-shelfName"
              className="flex items-center justify-between text-xs font-medium text-[#37352f]"
            >
              <span>Nom de l’étagère</span>
              <span className="text-[11px] text-[#787671]">1 à 100 caractères</span>
            </label>
            <input
              id="edit-shelfName"
              type="text"
              disabled={isUpdating || isSubmitting}
              className={`w-full h-11 px-3.5 bg-white text-[#1a1a1a] text-sm border rounded-lg transition-all outline-none ${
                errors.shelfName
                  ? 'border-[#e03131] focus:ring-2 focus:ring-[#e03131]/20'
                  : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-2 focus:ring-[#5645d4]/20'
              }`}
              {...register('shelfName')}
            />
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
              htmlFor="edit-shelfQuantity"
              className="flex items-center justify-between text-xs font-medium text-[#37352f]"
            >
              <span>Quantité en stock</span>
              <span className="text-[11px] text-[#787671]">Nombre entier ≥ 0</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#787671]">
                <Hash className="w-4 h-4" />
              </div>
              <input
                id="edit-shelfQuantity"
                type="number"
                min="0"
                step="1"
                disabled={isUpdating || isSubmitting}
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

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#ede9e4]">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating || isSubmitting}
              className="px-4 py-2.5 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isUpdating || isSubmitting || !canUpdateShelf}
              className="px-4.5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdating || isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
