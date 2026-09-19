'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createShelfSchema, CreateShelfFormValues } from '@/schemas/shelf.schema';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { useApi } from '@/hooks/use-api';
import { StockService } from '@/services/stock.service';
import { Stock } from '@/types/stock';
import { REQUIRED_CREATE_PERMISSION } from '@/services/shelf.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import {
  X,
  Plus,
  Loader2,
  ShieldAlert,
  Layers,
  Hash,
  Warehouse,
  Database,
  AlertCircle,
} from 'lucide-react';

const DEFAULT_STOCK_ID = '606d4178-e0a8-48b9-be6d-9538fa61135a';

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateShelfModal({ isOpen, onClose, onSuccess }: CreateShelfModalProps) {
  const api = useApi();
  const { createShelf, isCreating } = useShelves();
  const { canCreateShelf, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [isLoadingStocks, setIsLoadingStocks] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShelfFormValues>({
    resolver: zodResolver(createShelfSchema),
    defaultValues: {
      shelfName: '',
      shelfCode: '',
      stockId: DEFAULT_STOCK_ID,
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
          console.warn('[CreateShelfModal] Failed to load stocks list:', err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingStocks(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, api]);

  if (!isOpen) return null;

  const onSubmit = async (values: CreateShelfFormValues) => {
    setServerError(null);

    // Explicit client-side permission enforcement check
    if (!canCreateShelf) {
      const err = new InsufficientPermissionException(
        REQUIRED_CREATE_PERMISSION,
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne dispose pas de la permission '${REQUIRED_CREATE_PERMISSION}' requise pour insérer un nouvel emplacement.`,
      );
      setServerError(err.message);
      throw err;
    }

    try {
      await createShelf(values);
      reset();
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[CreateShelfModal] Failed to submit shelf:', err);
      setServerError(getErrorMessage(err, 'Échec de la création de l’emplacement'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Modal Surface (#6b7b97 Theme) */}
      <div
        className="w-full max-w-lg bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#3f3a36] flex items-center justify-between bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-semibold text-white tracking-tight">
                Nouvel emplacement
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer la fenêtre"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security & Entitlement Check Banner */}
        {!canCreateShelf && (
          <div className="mx-6 mt-5 p-3.5 bg-amber-950/50 border border-amber-500/50 rounded-lg flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200 space-y-1">
              <p className="font-semibold">Autorisation requise : {REQUIRED_CREATE_PERMISSION}</p>
              <p>
                Votre compte actuel ne possède pas la permission nécessaire pour créer un enregistrement dans
                la table <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-white">Shelf</code>.
                Toute tentative d’écriture lèvera une exception de sécurité.
              </p>
            </div>
          </div>
        )}

        {/* Server or Exception Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-3 text-left animate-in shake-1">
            <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200 space-y-0.5">
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
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span>Nom de l’emplacement <span className="text-rose-300">*</span></span>
              <span className="text-[11px] text-white/70">ex: Emplacement A-01, Zone Nord</span>
            </label>
            <div className="relative">
              <input
                id="shelfName"
                type="text"
                disabled={isCreating || isSubmitting}
                placeholder="Entrez le nom ou l'identifiant visuel..."
                className={`w-full h-11 px-3.5 bg-[#2b2622] text-white placeholder-white/50 text-sm border rounded-lg transition-all outline-none ${
                  errors.shelfName
                    ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30'
                    : 'border-[#3f3a36] focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20'
                }`}
                {...register('shelfName')}
              />
            </div>
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
              htmlFor="stockId"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span className="flex items-center gap-1.5">
                <Warehouse className="w-3.5 h-3.5 text-[#f7f5f0]" />
                Stock / Entrepôt de rattachement
              </span>
              <span className="text-[11px] text-white/70">Par défaut : Principal</span>
            </label>
            <div className="relative">
              <select
                id="stockId"
                disabled={isCreating || isSubmitting || isLoadingStocks}
                className="w-full h-11 px-3.5 bg-[#2b2622] text-white text-sm border border-[#3f3a36] rounded-lg transition-all outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 cursor-pointer disabled:opacity-50"
                {...register('stockId')}
              >
                {stocks.length > 0 ? (
                  stocks.map((stock) => (
                    <option key={stock.stockId} value={stock.stockId} className="bg-[#2b2622] text-white">
                      {stock.stockName || 'Stock sans nom'} {stock.stockId === DEFAULT_STOCK_ID ? '(Par défaut)' : ''}
                    </option>
                  ))
                ) : (
                  <option value={DEFAULT_STOCK_ID} className="bg-[#2b2622] text-white">
                    Stock Principal Yacine (Par défaut)
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

          {/* Stock Info Note: Decoupled Stock Management */}
          <div className="p-3.5 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg text-xs flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-white" />
                Stock initial (Quantité : 0)
              </span>
              <p className="text-[11px] text-white/75">
                Chaque nouvel emplacement est initialisé à 0. Les stocks sont alimentés exclusivement via les mouvements d&apos;entrée.
              </p>
            </div>
          </div>

          {/* Optional Code reference */}
          <div className="space-y-1.5">
            <label
              htmlFor="shelfCode"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span>Code de repérage interne (Optionnel)</span>
              <span className="text-[11px] text-white/70">Code barre / QR Code</span>
            </label>
            <input
              id="shelfCode"
              type="text"
              disabled={isCreating || isSubmitting}
              placeholder="ex: SH-001-A"
              className="w-full h-11 px-3.5 bg-[#2b2622] text-white placeholder-white/50 text-sm border border-[#3f3a36] rounded-lg transition-all outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
              {...register('shelfCode')}
            />
          </div>


          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#3f3a36]">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating || isSubmitting}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isCreating || isSubmitting || !canCreateShelf}
              className="px-4.5 py-2.5 bg-[#2b2622] hover:bg-[#3f3a36] text-white border border-[#4d4742] text-sm font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating || isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Créer l’emplacement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
