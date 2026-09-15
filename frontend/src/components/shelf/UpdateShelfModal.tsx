'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateShelfSchema, UpdateShelfFormValues } from '@/schemas/shelf.schema';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { useApi } from '@/hooks/use-api';
import { StockService } from '@/services/stock.service';
import { Stock } from '@/types/stock';
import { REQUIRED_UPDATE_PERMISSION } from '@/services/shelf.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import { Shelf } from '@/types/shelf';
import {
  X,
  Edit3,
  Loader2,
  ShieldAlert,
  Hash,
  Warehouse,
  Database,
  AlertCircle,
} from 'lucide-react';

const DEFAULT_STOCK_ID = '606d4178-e0a8-48b9-be6d-9538fa61135a';

interface UpdateShelfModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateShelfModal(props: UpdateShelfModalProps) {
  if (!props.isOpen || !props.shelf) return null;

  return (
    <UpdateShelfModalContent
      key={`${props.shelf.shelfId}:${props.shelf.shelfName}:${props.shelf.stockId ?? ''}`}
      {...props}
    />
  );
}

function UpdateShelfModalContent({
  shelf,
  isOpen,
  onClose,
  onSuccess,
}: UpdateShelfModalProps) {
  const api = useApi();
  const { updateShelf, isUpdating } = useShelves();
  const { canUpdateShelf, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateShelfFormValues>({
    resolver: zodResolver(updateShelfSchema),
    defaultValues: {
      shelfName: shelf?.shelfName ?? '',
      stockId: shelf?.stockId ?? DEFAULT_STOCK_ID,
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (isOpen) {
      let isMounted = true;
      setIsLoadingStocks(true);
      StockService.getAllStocks(api, { limit: 100 })
        .then((res) => {
          if (isMounted && res?.stocks) {
            setStocks(res.stocks);
          }
        })
        .catch((err) => {
          console.warn('[UpdateShelfModal] Failed to load stocks list:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingStocks(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, api]);

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
    } catch (err: unknown) {
      console.error('[UpdateShelfModal] Update failed:', err);
      setServerError(getErrorMessage(err, 'Échec de la modification de l’étagère.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Modal Surface (#6b7b97 Theme) */}
      <div
        className="w-full max-w-lg bg-[#6b7b97] border border-[#8191ad] text-white rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-shelf-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#455268] flex items-center justify-between bg-[#53627c]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1e2b48] border border-[#3e4f73] flex items-center justify-center text-[#38bdf8]">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="update-shelf-title" className="text-lg font-semibold text-white tracking-tight">
                Modifier l’étagère
              </h2>
              <p className="text-xs text-white/80">
                Mise à jour du tuple SQL Server (PATCH /shelves/:id)
              </p>
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

        {/* Security & Entitlement Warning Banner */}
        {!canUpdateShelf && (
          <div className="mx-6 mt-5 p-3.5 bg-amber-950/50 border border-amber-500/50 rounded-lg flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 space-y-1">
              <p className="font-semibold">Autorisation requise : {REQUIRED_UPDATE_PERMISSION}</p>
              <p>
                Votre rôle ne dispose pas de la permission nécessaire pour exécuter la méthode PATCH sur cette étagère.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 space-y-0.5">
              <p className="font-semibold">Erreur de modification</p>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 text-left">
          {/* Target Shelf UUID info */}
          <div className="p-3 bg-[#586680]/60 border border-[#8191ad] rounded-lg text-xs space-y-1 text-white">
            <div className="flex items-center justify-between text-white/85">
              <span className="font-medium flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-white" />
                Enregistrement SQL Server (shelfId)
              </span>
              <span className="font-mono text-[11px] text-white truncate max-w-[200px]">
                {shelf.shelfId}
              </span>
            </div>
          </div>

          {/* Field: shelfName */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-shelfName"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span>Nom de l’étagère</span>
              <span className="text-[11px] text-white/70">1 à 100 caractères</span>
            </label>
            <input
              id="edit-shelfName"
              type="text"
              disabled={isUpdating || isSubmitting}
              className={`w-full h-11 px-3.5 bg-[#4f5d75] text-white placeholder-white/50 text-sm border rounded-lg transition-all outline-none ${
                errors.shelfName
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30'
                  : 'border-[#8191ad] focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20'
              }`}
              {...register('shelfName')}
            />
            {errors.shelfName && (
              <p className="text-xs text-rose-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.shelfName.message}
              </p>
            )}
          </div>

          {/* Field: stockId (Rattachement Stock) */}
          <div className="space-y-1.5">
            <label
              htmlFor="edit-stockId"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span className="flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-[#38bdf8]" />
                Stock / Entrepôt de rattachement
              </span>
              <span className="text-[11px] text-white/70">dbo.Stock</span>
            </label>
            <div className="relative">
              <select
                id="edit-stockId"
                disabled={isUpdating || isSubmitting || isLoadingStocks}
                className="w-full h-11 px-3.5 bg-[#4f5d75] text-white text-sm border border-[#8191ad] rounded-lg transition-all outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20 cursor-pointer disabled:opacity-50"
                {...register('stockId')}
              >
                {stocks.length > 0 ? (
                  stocks.map((stock) => (
                    <option key={stock.stockId} value={stock.stockId} className="bg-[#4f5d75] text-white">
                      {stock.stockName || 'Stock sans nom'} {stock.stockId === DEFAULT_STOCK_ID ? '(Principal)' : ''}
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_STOCK_ID} className="bg-[#4f5d75] text-white">
                    Stock Principal Yacine
                  </option>
                )}
              </select>
            </div>
            {errors.stockId && (
              <p className="text-xs text-rose-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.stockId.message}
              </p>
            )}
          </div>

          {/* Read-only Shelf Quantity Card */}
          <div className="p-3.5 bg-[#586680]/60 border border-[#8191ad] rounded-lg text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-white" />
                Quantité en stock actuelle
              </span>
              <p className="text-[11px] text-white/75">
                Les stocks sont gérés exclusivement via les mouvements d&apos;entrée et de transfert.
              </p>
            </div>
            <span className="text-base font-bold font-mono px-3 py-1 bg-[#1e2b48] border border-[#3e4f73] rounded-md text-white">
              {shelf.shelfQuantity}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#8191ad]">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating || isSubmitting}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isUpdating || isSubmitting || !canUpdateShelf}
              className="px-4.5 py-2.5 bg-[#1e2b48] hover:bg-[#152037] text-white border border-[#2e3e63] text-sm font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
