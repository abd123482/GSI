'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createStockSchema, CreateStockFormValues } from '@/schemas/stock.schema';
import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import {
  X,
  Plus,
  Loader2,
  ShieldAlert,
  Warehouse,
  AlertCircle,
  Database,
} from 'lucide-react';

interface CreateStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateStockModal({ isOpen, onClose, onSuccess }: CreateStockModalProps) {
  const api = useApi();
  const { canCreateStock, roleName } = usePermissions();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStockFormValues>({
    resolver: zodResolver(createStockSchema),
    defaultValues: {
      stockName: '',
      stockStatus: 'ACTIVE',
    },
    mode: 'onChange',
  });

  if (!isOpen) return null;

  const onSubmit = async (values: CreateStockFormValues) => {
    setServerError(null);

    if (!canCreateStock) {
      setServerError(
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne dispose pas de la permission requise pour créer un stock.`,
      );
      return;
    }

    try {
      setIsSubmittingManual(true);
      await StockService.createStock(api, {
        stockName: values.stockName.trim(),
        stockStatus: values.stockStatus,
      });

      reset();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, 'Erreur lors de la création du stock'));
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const isBusy = isSubmitting || isSubmittingManual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111]/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden transform transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#3f3a36] bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] text-[#f7f5f0] flex items-center justify-center shadow-2xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-white leading-tight">
                Nouveau Stock / Entrepôt
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                Enregistrer un nouvel emplacement de stockage principal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Advisory Banner */}
        {!canCreateStock && (
          <div className="px-6 py-3 bg-amber-950/50 border-b border-amber-500/50 flex items-start gap-2.5 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-300 mt-0.5" />
            <div>
              <span className="font-semibold">Droits insuffisants : </span>
              Votre profil ({roleName ?? 'Utilisateur'}) ne possède pas la permission de création de stock.
            </div>
          </div>
        )}

        {/* Server / Validation Error Feedback */}
        {serverError && (
          <div className="m-6 mb-0 p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-lg text-xs text-rose-200 flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-300 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5 text-left">
          {/* Field: stockName */}
          <div className="space-y-1.5">
            <label
              htmlFor="stockName"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span>Nom du Stock <span className="text-rose-300">*</span></span>
              <span className="text-[11px] text-white/70">5 à 50 caractères</span>
            </label>
            <input
              id="stockName"
              type="text"
              disabled={isBusy}
              placeholder="ex: Stock Principal Yacine, Entrepôt Ouest..."
              className={`w-full h-11 px-3.5 bg-[#2b2622] text-white placeholder-white/50 text-sm border rounded-lg transition-all outline-none ${
                errors.stockName
                  ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/30'
                  : 'border-[#3f3a36] focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20'
              }`}
              {...register('stockName')}
            />
            {errors.stockName && (
              <p className="text-xs text-rose-300 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.stockName.message}
              </p>
            )}
          </div>

          {/* Field: stockStatus */}
          <div className="space-y-1.5">
            <label
              htmlFor="stockStatus"
              className="flex items-center justify-between text-xs font-medium text-white"
            >
              <span>Statut opérationnel</span>
              <span className="text-[11px] text-white/70">Table StockStatus</span>
            </label>
            <select
              id="stockStatus"
              disabled={isBusy}
              className="w-full h-11 px-3.5 bg-[#2b2622] text-white text-sm border border-[#3f3a36] rounded-lg transition-all outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
              {...register('stockStatus')}
            >
              <option value="ACTIVE" className="bg-[#2b2622] text-white">ACTIVE (En activité)</option>
              <option value="INACTIVE" className="bg-[#2b2622] text-white">INACTIVE (En pause)</option>
              <option value="ARCHIVED" className="bg-[#2b2622] text-white">ARCHIVED (Archivé)</option>
            </select>
          </div>


          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#3f3a36]">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isBusy || !canCreateStock}
              className="px-4.5 py-2.5 bg-[#2b2622] hover:bg-[#3f3a36] text-white border border-[#4d4742] text-sm font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? (
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
