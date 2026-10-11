'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Plus, ShieldAlert, Warehouse, X } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createStockSchema, type CreateStockFormValues } from '@/schemas/stock.schema';
import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import { getErrorMessage } from '@/lib/error-message';

interface CreateStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateStockModal({ isOpen, onClose, onSuccess }: CreateStockModalProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { canCreateStock, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStockFormValues>({
    resolver: zodResolver(createStockSchema),
    defaultValues: { stockName: '', stockStatus: true },
  });

  if (!isOpen) return null;
  const busy = saving || isSubmitting;

  async function submit(values: CreateStockFormValues) {
    setServerError(null);
    if (!canCreateStock) {
      setServerError(`Action interdite : votre rôle (${roleName ?? 'Utilisateur'}) ne permet pas de créer un stock.`);
      return;
    }

    try {
      setSaving(true);
      await StockService.createStock(api, {
        stockName: values.stockName.trim(),
        status: values.stockStatus,
      });
      reset({ stockName: '', stockStatus: true });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stocks'] }),
        queryClient.invalidateQueries({ queryKey: ['movement-create'] }),
      ]);
      toast.success('Stock créé avec succès');
      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setServerError(getErrorMessage(cause, 'Erreur lors de la création du stock.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
          <div className="flex items-center gap-3"><Warehouse className="h-5 w-5" /><div><h2 className="text-sm font-semibold">Nouveau stock</h2><p className="mt-0.5 text-[10px] text-white/45">Statuts autorisés : ACTIVE / INACTIVE</p></div></div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded p-1.5 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>

        {!canCreateStock && <div className="flex gap-2 border-b border-amber-500/30 bg-amber-950/25 px-5 py-3 text-xs text-amber-200"><ShieldAlert className="h-4 w-4 shrink-0" />Permission stock.create requise.</div>}

        <form onSubmit={handleSubmit(submit)} className="space-y-5 p-5">
          {serverError && <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200"><AlertCircle className="h-4 w-4 shrink-0" />{serverError}</div>}

          <label className="block space-y-1.5"><span className="text-xs font-semibold">Nom du stock *</span><input {...register('stockName')} className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs outline-none focus:border-white/50" placeholder="Ex: Stock Principal" />{errors.stockName && <p className="text-[11px] text-rose-300">{errors.stockName.message}</p>}</label>

          <label className="block space-y-1.5"><span className="text-xs font-semibold">Statut</span><select {...register('stockStatus')} className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs"><option value="true">ACTIVE</option><option value="false">INACTIVE</option></select></label>

          <footer className="flex justify-end gap-2 border-t border-[#3f3f46] pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="rounded border border-[#3f3f46] px-4 py-2 text-xs">Annuler</button>
            <button type="submit" disabled={busy || !canCreateStock} className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Créer le stock</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
