'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Save, ShieldAlert, Warehouse, X } from 'lucide-react';

import { updateStockSchema, type UpdateStockFormValues } from '@/schemas/stock.schema';
import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import type { Stock } from '@/types/stock';
import { getErrorMessage } from '@/lib/error-message';

interface UpdateStockModalProps {
  stock: Stock | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UpdateStockModal(props: UpdateStockModalProps) {
  if (!props.isOpen || !props.stock) return null;
  return <UpdateStockModalContent key={`${props.stock.stockId}:${props.stock.status ?? true}`} {...props} />;
}

function UpdateStockModalContent({ stock, onClose, onSuccess }: UpdateStockModalProps) {
  const api = useApi();
  const { canUpdateStock, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateStockFormValues>({
    resolver: zodResolver(updateStockSchema),
    defaultValues: {
      stockName: stock?.stockName ?? '',
      stockStatus: stock?.status ?? true,
    },
  });

  if (!stock) return null;
  const currentStock = stock;
  const busy = saving || isSubmitting;

  async function submit(values: UpdateStockFormValues) {
    setServerError(null);
    if (!canUpdateStock) {
      setServerError(`Action interdite : votre rôle (${roleName ?? 'Utilisateur'}) ne permet pas de modifier ce stock.`);
      return;
    }

    try {
      setSaving(true);
      await StockService.updateStock(api, currentStock.stockId, {
        stockName: values.stockName?.trim(),
        status: values.stockStatus,
      });
      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setServerError(getErrorMessage(cause, 'Erreur lors de la modification du stock.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div className="flex items-center gap-3"><Warehouse className="h-5 w-5" /><div><h2 className="text-sm font-semibold">Modifier le stock</h2><p className="mt-0.5 text-[10px] text-white/45">{stock.stockName ?? 'Stock'}</p></div></div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1.5 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>

        {!canUpdateStock && <div className="flex gap-2 border-b border-amber-500/30 bg-amber-950/25 px-5 py-3 text-xs text-amber-200"><ShieldAlert className="h-4 w-4 shrink-0" />Permission stock.update requise.</div>}

        <form onSubmit={handleSubmit(submit)} className="space-y-5 p-5">
          {serverError && <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{serverError}</div>}
          <label className="block space-y-1.5"><span className="text-xs font-semibold">Nom du stock *</span><input {...register('stockName')} className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs outline-none focus:border-white/50" />{errors.stockName && <p className="text-[11px] text-rose-300">{errors.stockName.message}</p>}</label>
          <label className="block space-y-1.5"><span className="text-xs font-semibold">Statut</span><select {...register('stockStatus')} className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"><option value="true">ACTIVE</option><option value="false">INACTIVE</option></select></label>
          <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/55 p-3 text-xs text-[#c9c0ad]">Emplacements rattachés : <span className="font-mono text-white">{stock._count?.shelves ?? stock.shelves?.length ?? 0}</span></div>
          <footer className="flex justify-end gap-2 border-t border-[#3f3a36] pt-4"><button type="button" onClick={onClose} disabled={busy} className="rounded border border-[#3f3a36] px-4 py-2 text-xs">Annuler</button><button type="submit" disabled={busy || !canUpdateStock} className="inline-flex items-center gap-1.5 rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}Enregistrer</button></footer>
        </form>
      </div>
    </div>
  );
}
