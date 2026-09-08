'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Barcode, Sparkles, AlertCircle, ShieldAlert } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[#e5e3df] bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-12 bg-gradient-to-r from-[#e6e0f5] to-[#dcecfa] px-4 flex items-center justify-between border-b border-[#e5e3df]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-white/90 shadow-sm border border-[#e5e3df] flex items-center justify-center text-[#5645d4]">
              <Barcode className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#37352f]/80">
              Modifier le numéro de série
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#787671] hover:bg-white/60 hover:text-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {!canUpdateSerialNumber && (
            <div className="mb-4 rounded-lg bg-[#ffe8d4]/60 border border-[#dd5b00]/30 p-2.5 flex items-start gap-2 text-[#793400] text-xs">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Permission manquante : 'serial-number.update' requise.</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Serial Number Code with Auto-Gen button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#37352f]">
                  Code du numéro de série <span className="text-[#e03131]">*</span>
                </label>
                <button
                  type="button"
                  onClick={generate32BitCode}
                  className="text-[11px] font-medium text-[#5645d4] hover:text-[#4534b3] flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Générer 32-bit
                </button>
              </div>
              <input
                type="text"
                {...register('serialNumberCode')}
                placeholder="Ex: SN-A1B2C3D4"
                className="w-full h-10 px-3 rounded-md border border-[#c8c4be] bg-white text-sm font-mono text-[#1a1a1a] focus:outline-none focus:border-2 focus:border-[#5645d4] transition-all"
              />
              {errors.serialNumberCode && (
                <p className="mt-1 text-xs text-[#e03131]">{errors.serialNumberCode.message}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                Statut du numéro de série <span className="text-[#e03131]">*</span>
              </label>
              <select
                {...register('serialNumberStatus')}
                className="w-full h-10 px-3 rounded-md border border-[#c8c4be] bg-white text-sm text-[#1a1a1a] focus:outline-none focus:border-2 focus:border-[#5645d4] transition-all"
              >
                <option value="AVAILABLE">DISPONIBLE (AVAILABLE)</option>
                <option value="IN_USE">EN UTILISATION (IN_USE)</option>
                <option value="MAINTENANCE">EN MAINTENANCE (MAINTENANCE)</option>
                <option value="DEFECTIVE">DÉFECTUEUX (DEFECTIVE)</option>
              </select>
              {errors.serialNumberStatus && (
                <p className="mt-1 text-xs text-[#e03131]">{errors.serialNumberStatus.message}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#e5e3df]">
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                className="px-3.5 py-1.5 text-xs font-medium text-[#37352f] bg-transparent border border-[#c8c4be] rounded-lg hover:bg-[#f6f5f4] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUpdating || !canUpdateSerialNumber}
                className="px-4 py-1.5 text-xs font-medium text-white bg-[#5645d4] rounded-lg hover:bg-[#4534b3] active:bg-[#3a2a99] disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-sm"
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
