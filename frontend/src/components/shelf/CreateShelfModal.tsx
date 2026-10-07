'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Info, Layers, Loader2, Plus, Warehouse, X } from 'lucide-react';

import { createShelfSchema, type CreateShelfFormValues } from '@/schemas/shelf.schema';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { useApi } from '@/hooks/use-api';
import { StockService } from '@/services/stock.service';
import type { Stock } from '@/types/stock';
import { getErrorMessage } from '@/lib/error-message';

interface CreateShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateShelfModal({ isOpen, onClose, onSuccess }: CreateShelfModalProps) {
  const api = useApi();
  const { createShelf, isCreating } = useShelves({ enabled: false });
  const { canCreateShelf } = usePermissions();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateShelfFormValues>({
    resolver: zodResolver(createShelfSchema),
    defaultValues: { shelfName: '', stockId: '', status: true },
  });

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoadingStocks(true);
    setServerError(null);

    StockService.getActiveStocks(api, { page: 1, limit: 100 })
      .then((result) => {
        if (active) setStocks(result.stocks);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStocks([]);
        setServerError(
          getErrorMessage(cause, 'Impossible de charger les stocks actifs.'),
        );
      })
      .finally(() => {
        if (active) setLoadingStocks(false);
      });

    return () => {
      active = false;
    };
  }, [api, isOpen]);

  useEffect(() => {
    if (!isOpen) reset({ shelfName: '', stockId: '', status: true });
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const busy = isCreating || isSubmitting;

  async function submit(values: CreateShelfFormValues) {
    setServerError(null);
    if (!canCreateShelf) {
      setServerError("Permission 'shelf.create' requise.");
      return;
    }

    try {
      await createShelf({
        shelfName: values.shelfName.trim(),
        stockId: values.stockId,
        status: values.status,
      });
      reset({ shelfName: '', stockId: '', status: true });
      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setServerError(
        getErrorMessage(cause, 'Échec de la création de l’emplacement.'),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4" />
            Nouvel emplacement
          </h2>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit(submit)} className="space-y-4 p-5">
          {serverError && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">Nom de l’emplacement *</span>
            <input
              {...register('shelfName')}
              placeholder="Ex: Rayon A-01"
              className="h-10 w-full rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 text-xs outline-none focus:border-white/50"
            />
            {errors.shelfName && <p className="text-[11px] text-rose-300">{errors.shelfName.message}</p>}
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">Statut de l'emplacement</span>
            <select
              {...register('status', {
                setValueAs: (v) => v === 'true',
              })}
              disabled={busy}
              className="h-10 w-full rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 text-xs outline-none focus:border-white/50"
            >
              <option value="true">Actif (ACTIVE)</option>
              <option value="false">Inactif (INACTIVE)</option>
            </select>
            {errors.status && <p className="text-[11px] text-rose-300">{errors.status.message}</p>}
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Warehouse className="h-3.5 w-3.5" />
              Stock actif *
            </span>
            <select
              {...register('stockId')}
              disabled={busy || loadingStocks}
              className="h-10 w-full rounded-lg border border-[#3f3f46] bg-[#18181b] px-3 text-xs outline-none focus:border-white/50"
            >
              <option value="">Sélectionnez un stock actif</option>
              {stocks.map((stock) => (
                <option key={stock.stockId} value={stock.stockId}>
                  {stock.stockName ?? 'Stock sans nom'}
                </option>
              ))}
            </select>
            {errors.stockId && <p className="text-[11px] text-rose-300">{errors.stockId.message}</p>}
          </label>

          {!loadingStocks && stocks.length === 0 && (
            <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-[11px] text-amber-100">
              Aucun stock ACTIVE n’est disponible. Activez ou créez un stock avant de créer un emplacement.
            </div>
          )}

          <div className="flex gap-2 rounded-lg border border-sky-400/20 bg-sky-400/5 p-3 text-[11px] text-sky-100">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Un emplacement doit toujours appartenir à un stock ACTIVE.</p>
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#3f3f46] pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="rounded border border-[#3f3f46] px-4 py-2 text-xs">Annuler</button>
            <button
              type="submit"
              disabled={busy || !canCreateShelf || stocks.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Créer
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
