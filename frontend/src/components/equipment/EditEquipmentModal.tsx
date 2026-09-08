'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Pencil, AlertCircle, Cpu, Layers, Sparkles, Hash } from 'lucide-react';
import { Equipment } from '@/types/equipment';
import {
  updateEquipmentSchema,
  UpdateEquipmentFormValues,
} from '@/schemas/equipment.schema';
import { usePermissions } from '@/hooks/use-permissions';

interface EditEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  onUpdate: (id: string, values: {
    equipmentName?: string;
    equipmentQuantity?: number;
    minEquipmentQuantity?: number;
    hasSerialNumber?: boolean;
  }) => Promise<void>;
  isUpdating: boolean;
}

export function EditEquipmentModal({
  isOpen,
  onClose,
  equipment,
  onUpdate,
  isUpdating,
}: EditEquipmentModalProps) {
  const { canUpdateEquipment } = usePermissions();
  const [convertToStandard, setConvertToStandard] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateEquipmentFormValues>({
    resolver: zodResolver(updateEquipmentSchema),
    defaultValues: {
      equipmentName: '',
      equipmentQuantity: 0,
      minEquipmentQuantity: 0,
      hasSerialNumber: false,
    },
  });

  useEffect(() => {
    if (equipment && isOpen) {
      reset({
        equipmentName: equipment.equipmentName ?? '',
        equipmentQuantity: equipment.equipmentQuantity,
        minEquipmentQuantity: equipment.minequipmentQuantity ?? 0,
        hasSerialNumber: equipment.hasSerialNumber,
      });
      setConvertToStandard(false);
    }
  }, [equipment, isOpen, reset]);

  if (!isOpen || !equipment) return null;

  const isSerialized = equipment.hasSerialNumber && !convertToStandard;

  const onSubmit = async (data: UpdateEquipmentFormValues) => {
    try {
      await onUpdate(equipment.equipmentId, {
        equipmentName: data.equipmentName,
        minEquipmentQuantity: data.minEquipmentQuantity,
        equipmentQuantity: isSerialized ? equipment.equipmentQuantity : data.equipmentQuantity,
        hasSerialNumber: convertToStandard ? false : equipment.hasSerialNumber,
      });
      onClose();
    } catch {
      // Error handled by react-query mutation toast
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border border-[#e5e3df] bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Notion Pastel Cover Header */}
        <div className="h-14 bg-gradient-to-r from-[#ffe8d4] via-[#e6e0f5] to-[#d9f3e1] p-4 flex items-center justify-between border-b border-[#e5e3df]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/90 shadow-sm border border-[#e5e3df] flex items-center justify-center text-[#5645d4]">
              <Pencil className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#37352f]/70">
              Modifier l’équipement
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[#787671] hover:bg-white/60 hover:text-[#1a1a1a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {/* Permission Warning */}
          {!canUpdateEquipment && (
            <div className="mb-4 rounded-lg bg-[#ffe8d4]/60 border border-[#dd5b00]/30 p-3 flex items-start gap-2 text-[#793400] text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Permission manquante :</span> Vous ne détenez pas le droit{' '}
                <code className="bg-white/60 px-1 py-0.5 rounded text-xs">equipment.update</code> pour modifier cet équipement.
              </div>
            </div>
          )}

          {/* Type Badge */}
          <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-[#f6f5f4] border border-[#e5e3df]">
            <Cpu className="w-4 h-4 text-[#5645d4]" />
            <div className="text-xs text-[#5d5b54]">
              <span className="font-medium text-[#1a1a1a]">
                {equipment.hasSerialNumber ? 'Équipement sérialisé' : 'Équipement standard'}
              </span>
              {' • '}
              {equipment.serialNumbers?.length ?? 0} numéro(s) de série enregistré(s)
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Equipment Name */}
            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                Nom de l’équipement <span className="text-[#e03131]">*</span>
              </label>
              <input
                type="text"
                {...register('equipmentName')}
                placeholder="Ex: Oscilloscope Rohde & Schwarz"
                className="w-full h-10 px-3 rounded-md border border-[#c8c4be] bg-white text-sm text-[#1a1a1a] placeholder:text-[#bbb8b1] focus:outline-none focus:border-2 focus:border-[#5645d4] transition-all"
              />
              {errors.equipmentName && (
                <p className="mt-1 text-xs text-[#e03131]">{errors.equipmentName.message}</p>
              )}
            </div>

            {/* Quantity fields */}
            {isSerialized ? (
              <div className="rounded-lg border border-[#e5e3df] bg-[#fafaf9] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#37352f]">Quantité actuelle (liée aux N° de série)</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-[#e6e0f5] text-[#5645d4]">
                    {equipment.equipmentQuantity} unité(s)
                  </span>
                </div>
                <p className="text-[11px] text-[#787671]">
                  Pour cet équipement sérialisé, la quantité totale est automatiquement égale au nombre de numéros de série valides.
                </p>

                {/* Option to convert to non-serialized */}
                <div className="pt-2 border-t border-[#e5e3df]">
                  <button
                    type="button"
                    onClick={() => setConvertToStandard(true)}
                    className="text-xs text-[#dd5b00] hover:text-[#793400] font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Convertir en équipement standard (sans numéros de série)
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-[#37352f] mb-1">
                  Quantité en stock <span className="text-[#e03131]">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    {...register('equipmentQuantity')}
                    className="w-full h-10 px-3 pl-8 rounded-md border border-[#c8c4be] bg-white text-sm text-[#1a1a1a] focus:outline-none focus:border-2 focus:border-[#5645d4] transition-all"
                  />
                  <Hash className="w-4 h-4 text-[#787671] absolute left-2.5 top-3" />
                </div>
                {errors.equipmentQuantity && (
                  <p className="mt-1 text-xs text-[#e03131]">{errors.equipmentQuantity.message}</p>
                )}
              </div>
            )}

            {/* Convert to standard warning & manual quantity input */}
            {convertToStandard && (
              <div className="rounded-lg border border-[#dd5b00]/40 bg-[#ffe8d4]/40 p-3 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#793400]">
                    Conversion en mode standard
                  </span>
                  <button
                    type="button"
                    onClick={() => setConvertToStandard(false)}
                    className="text-[11px] text-[#787671] underline"
                  >
                    Annuler
                  </button>
                </div>
                <p className="text-xs text-[#793400]/80">
                  Tous les numéros de série existants ({equipment.serialNumbers?.length ?? 0}) seront supprimés de la base de données SQL. Définissez la quantité manuelle :
                </p>
                <div>
                  <label className="block text-[11px] font-medium text-[#793400] mb-1">
                    Nouvelle quantité en stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    {...register('equipmentQuantity')}
                    className="w-full h-9 px-3 rounded-md border border-[#dd5b00]/50 bg-white text-sm text-[#1a1a1a] focus:outline-none focus:border-2 focus:border-[#dd5b00]"
                  />
                </div>
              </div>
            )}

            {/* Min Quantity Alert */}
            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                Seuil d’alerte (Quantité minimale)
              </label>
              <input
                type="number"
                min="0"
                {...register('minEquipmentQuantity')}
                className="w-full h-10 px-3 rounded-md border border-[#c8c4be] bg-white text-sm text-[#1a1a1a] focus:outline-none focus:border-2 focus:border-[#5645d4] transition-all"
              />
              {errors.minEquipmentQuantity && (
                <p className="mt-1 text-xs text-[#e03131]">{errors.minEquipmentQuantity.message}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#e5e3df]">
              <button
                type="button"
                onClick={onClose}
                disabled={isUpdating}
                className="px-4 py-2 text-sm font-medium text-[#37352f] bg-transparent border border-[#c8c4be] rounded-lg hover:bg-[#f6f5f4] transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isUpdating || !canUpdateEquipment}
                className="px-5 py-2 text-sm font-medium text-white bg-[#5645d4] rounded-lg hover:bg-[#4534b3] active:bg-[#3a2a99] disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                {isUpdating && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {convertToStandard ? 'Convertir & Enregistrer' : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
