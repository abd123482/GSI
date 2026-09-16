'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Barcode, Sparkles, ShieldAlert } from 'lucide-react';
import { SerialNumber } from '@/types/equipment';
import {
  updateSerialNumberSchema,
  UpdateSerialNumberFormValues,
} from '@/schemas/equipment.schema';
import { usePermissions } from '@/hooks/use-permissions';

interface EditSerialNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: SerialNumber | null;
  onUpdate: (id: string, values: {
    serialNumberCode?: string;
    serialNumberStatus?: string;
  }) => Promise<void>;
  isUpdating: boolean;
}

export function EditSerialNumberModal({
  isOpen,
  onClose,
  serialNumber,
  onUpdate,
  isUpdating,
}: EditSerialNumberModalProps) {
  const { canUpdateSerialNumber } = usePermissions();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateSerialNumberFormValues>({
    resolver: zodResolver(updateSerialNumberSchema),
    defaultValues: {
      serialNumberCode: '',
      serialNumberStatus: 'AVAILABLE',
    },
  });

  useEffect(() => {
    if (serialNumber && isOpen) {
      reset({
        serialNumberCode: serialNumber.serialNumberCode ?? '',
        serialNumberStatus: serialNumber.serialNumberStatus || 'AVAILABLE',
      });
    }
  }, [serialNumber, isOpen, reset]);

  if (!isOpen || !serialNumber) return null;

  const generate32BitCode = () => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const hex = array[0].toString(16).toUpperCase().padStart(8, '0');
    setValue('serialNumberCode', `SN-${hex}`, { shouldValidate: true });
  };

  const onSubmit = async (data: UpdateSerialNumberFormValues) => {
    try {
      await onUpdate(serialNumber.serialNumberId, {
        serialNumberCode: data.serialNumberCode.trim(),
        serialNumberStatus: data.serialNumberStatus,
      });
      onClose();
    } catch {
      // Handled by toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 bg-[#2b2622] px-4 flex items-center justify-between border-b border-[#3f3a36]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#2b2622] shadow-sm border border-white/20 flex items-center justify-center text-[#f7f5f0]">
              <Barcode className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-white">
              Modifier le numéro de série
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {!canUpdateSerialNumber && (
            <div className="mb-4 rounded-lg bg-amber-500/20 border border-amber-400/40 p-2.5 flex items-start gap-2 text-amber-200 text-xs">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-300" />
              <span>Permission manquante : &apos;serial-number.update&apos; requise.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Serial Number Code with Auto-Gen button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-white">
                  Code du numéro de série <span className="text-rose-300">*</span>
                </label>
                <button
                  type="button"
                  onClick={generate32BitCode}
                  className="text-[11px] font-medium text-white bg-[#2b2622] hover:bg-[#3f3a36] px-2 py-0.5 rounded border border-white/20 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Générer 32-bit
                </button>
              </div>
              <input
                type="text"
                {...register('serialNumberCode')}
                placeholder="Ex: SN-A1B2C3D4"
                className="w-full h-10 px-3 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white placeholder-white/50 text-sm font-mono focus:outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
              />
              {errors.serialNumberCode && (
                <p className="mt-1 text-xs text-rose-300">{errors.serialNumberCode.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Statut du numéro de série <span className="text-rose-300">*</span>
              </label>
              <select
                {...register('serialNumberStatus')}
                className="w-full h-10 px-3 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white text-sm focus:outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
              >
                <option value="AVAILABLE" className="bg-[#2b2622] text-white">DISPONIBLE (AVAILABLE)</option>
                <option value="IN_USE" className="bg-[#2b2622] text-white">EN UTILISATION (IN_USE)</option>
                <option value="MAINTENANCE" className="bg-[#2b2622] text-white">EN MAINTENANCE (MAINTENANCE)</option>
                <option value="DEFECTIVE" className="bg-[#2b2622] text-white">DÉFECTUEUX (DEFECTIVE)</option>
              </select>
              {errors.serialNumberStatus && (
                <p className="mt-1 text-xs text-rose-300">{errors.serialNumberStatus.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#3f3a36]/50">
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUpdating || !canUpdateSerialNumber}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#2b2622] border border-[#4d4742] rounded-lg hover:bg-[#3f3a36] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isUpdating && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                Actualiser
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
