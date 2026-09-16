'use client';

import { getErrorMessage } from '@/lib/error-message';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createDirectEquipmentSchema,
  CreateDirectEquipmentFormValues,
} from '@/schemas/equipment.schema';
import { useEquipments } from '@/hooks/use-equipments';
import { usePermissions } from '@/hooks/use-permissions';
import {
  PackagePlus,
  X,
  Sparkles,
  Barcode,
  Layers,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Generates a random 32-bit hexadecimal string (8 hex chars).
 */
function generate32BitRandomCode(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const uint32 = new Uint32Array(1);
    window.crypto.getRandomValues(uint32);
    return uint32[0].toString(16).toUpperCase().padStart(8, '0');
  }
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, '0');
}

function generateSerialCodes(count: number): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`SN-${generate32BitRandomCode()}`);
  }
  return Array.from(codes);
}

export const CreateEquipmentModal: React.FC<CreateEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createEquipment, isCreatingEquipment } = useEquipments();
  const { canCreateEquipment } = usePermissions();

  const [serialGenMode, setSerialGenMode] = useState<'auto' | 'manual'>('auto');
  const [serialList, setSerialList] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateDirectEquipmentFormValues>({
    resolver: zodResolver(createDirectEquipmentSchema),
    defaultValues: {
      equipmentName: '',
      hasSerialNumber: false,
      equipmentQuantity: 1,
      minEquipmentQuantity: 0,
      serialNumbers: [],
    },
    mode: 'onChange',
  });

  const hasSerialNumber = useWatch({ control, name: 'hasSerialNumber' });
  const quantity = useWatch({ control, name: 'equipmentQuantity' }) || 1;

  // Auto-generate serial codes on demand or when quantity changes
  const handleAutoGenerateSerials = (count: number) => {
    const arr = generateSerialCodes(count);
    setSerialList(arr);
    setValue('serialNumbers', arr, { shouldValidate: true });
    toast.success(`${count} code(s) 32-bit généré(s) aléatoirement !`);
  };

  const syncSerialCount = (count: number) => {
    const targetCount = Math.max(1, Number(count) || 1);
    if (serialList.length === targetCount) return;

    const updated = serialGenMode === 'auto'
      ? generateSerialCodes(targetCount)
      : [...serialList, ...Array(Math.max(0, targetCount - serialList.length)).fill('')].slice(0, targetCount);
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: serialGenMode === 'auto' });
  };

  if (!isOpen) return null;

  const handleManualSerialChange = (index: number, value: string) => {
    const updated = [...serialList];
    updated[index] = value.toUpperCase();
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: true });
  };

  const handleSwitchToManual = () => {
    setSerialGenMode('manual');
    const targetCount = Math.max(1, Number(quantity));
    const updated = [...serialList];
    while (updated.length < targetCount) {
      updated.push(`SN-${generate32BitRandomCode()}`);
    }
    setSerialList(updated.slice(0, targetCount));
    setValue('serialNumbers', updated.slice(0, targetCount), { shouldValidate: true });
  };

  const handleSwitchToAuto = () => {
    setSerialGenMode('auto');
    handleAutoGenerateSerials(Math.max(1, Number(quantity)));
  };

  const handleCopySerial = (index: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const onSubmit = async (values: CreateDirectEquipmentFormValues) => {
    setServerError(null);

    if (!canCreateEquipment) {
      setServerError("Action interdite : Vous n'avez pas le droit de créer un équipement.");
      return;
    }

    try {
      const serialsToSubmit = values.hasSerialNumber
        ? values.serialNumbers && values.serialNumbers.length > 0
          ? values.serialNumbers.map((s) => s.trim().toUpperCase())
          : serialList.map((s) => s.trim().toUpperCase())
        : undefined;

      await createEquipment({
        equipmentName: values.equipmentName.trim(),
        hasSerialNumber: Boolean(values.hasSerialNumber),
        equipmentQuantity: Number(values.equipmentQuantity),
        minEquipmentQuantity: Number(values.minEquipmentQuantity ?? 0),
        serialNumbers: serialsToSubmit,
      });

      reset();
      setSerialList([]);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[CreateEquipmentModal] Submit failed:', err);
      setServerError(getErrorMessage(err, 'Échec de la création de l’équipement.'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3f3a36] flex items-center justify-between bg-[#2b2622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
              <PackagePlus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Créer un équipement
              </h2>
              <p className="text-xs text-white/80">
                Enregistrement direct au stock (assignation aux étagères gérée via les mouvements)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {serverError && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/50 rounded-lg flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-300" />
              <div className="flex-1">{serverError}</div>
            </div>
          )}

          {/* Equipment Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white flex items-center justify-between">
              <span>Nom de l’équipement *</span>
              <span className="text-[11px] text-white/70 font-normal">Identifiant unique du modèle</span>
            </label>
            <input
              type="text"
              {...register('equipmentName')}
              placeholder="Ex: Tensiomètre Électronique Omron M3"
              className={`w-full h-9 px-3 bg-[#2b2622] border rounded-lg text-xs text-white placeholder-white/50 focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none transition-colors ${
                errors.equipmentName
                  ? 'border-rose-400 focus:border-rose-400'
                  : 'border-[#3f3a36]'
              }`}
            />
            {errors.equipmentName && (
              <p className="text-[11px] text-rose-300">{errors.equipmentName.message}</p>
            )}
          </div>

          {/* Quantities Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white">
                Quantité en stock *
              </label>
              <input
                type="number"
                min={hasSerialNumber ? '1' : '0'}
                {...register('equipmentQuantity', {
                  valueAsNumber: true,
                  onChange: (event) => {
                    if (hasSerialNumber) syncSerialCount(Number(event.target.value));
                  },
                })}
                className={`w-full h-9 px-3 bg-[#2b2622] border rounded-lg text-xs font-mono text-white focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none transition-colors ${
                  errors.equipmentQuantity
                    ? 'border-rose-400 focus:border-rose-400'
                    : 'border-[#3f3a36]'
                }`}
              />
              {errors.equipmentQuantity && (
                <p className="text-[11px] text-rose-300">{errors.equipmentQuantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white flex items-center justify-between">
                <span>Quantité minimale</span>
                <span className="text-[11px] text-white/70 font-normal">Seuil d’alerte</span>
              </label>
              <input
                type="number"
                min="0"
                {...register('minEquipmentQuantity', { valueAsNumber: true })}
                className="w-full h-9 px-3 bg-[#2b2622] border border-[#3f3a36] rounded-lg text-xs font-mono text-white focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Serialized Mode Toggle Card */}
          <div className="p-4 bg-[#2b2622]/60 border border-[#3f3a36] rounded-xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Barcode className="w-4 h-4 text-white" />
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    Cet équipement possède des numéros de série
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Traçabilité unitaire de chaque exemplaire ({quantity} requis)
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('hasSerialNumber', {
                    onChange: (event) => {
                      if (event.target.checked) syncSerialCount(Number(quantity));
                    },
                  })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2b2622] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#3f3a36] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2b2622]"></div>
              </label>
            </div>

            {/* Serialized Configuration Area */}
            {hasSerialNumber ? (
              <div className="pt-3 border-t border-[#3f3a36] space-y-4 animate-in fade-in duration-150">
                {/* Mode Selector Pill Tabs */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white">
                    Génération des numéros :
                  </span>
                  <div className="inline-flex p-0.5 bg-[#2b2622] border border-[#3f3a36] rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={handleSwitchToAuto}
                      className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        serialGenMode === 'auto'
                          ? 'bg-[#2b2622] text-white border border-[#3f3a36] shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#f7f5f0]" />
                      <span>Auto-générer (32-bit aléatoire)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToManual}
                      className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        serialGenMode === 'manual'
                          ? 'bg-[#2b2622] text-white border border-[#3f3a36] shadow-xs'
                          : 'text-white/80 hover:text-white'
                      }`}
                    >
                      <Barcode className="w-3.5 h-3.5 text-[#f7f5f0]" />
                      <span>Saisie manuelle</span>
                    </button>
                  </div>
                </div>

                {/* Auto Generation Banner */}
                {serialGenMode === 'auto' && (
                  <div className="p-3 bg-[#2b2622] border border-[#3f3a36] rounded-lg flex items-center justify-between gap-3 text-xs text-white">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#f7f5f0] shrink-0" />
                      <span>
                        Génération cryptographique de {quantity} code(s) 32-bit uniques (8 hexadécimaux).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateSerials(Math.max(1, Number(quantity)))}
                      className="px-2.5 py-1 bg-white/15 hover:bg-white/25 border border-white/30 rounded-md text-xs font-medium text-white transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Régénérer</span>
                    </button>
                  </div>
                )}

                {/* Serial Numbers Input / Review List */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {Array.from({ length: Math.max(1, Number(quantity)) }).map((_, idx) => {
                    const currentVal = serialList[idx] || '';
                    return (
                      <div
                        key={`sn-input-${idx}`}
                        className="flex items-center gap-2 p-2 bg-[#2b2622] border border-[#3f3a36] rounded-lg text-xs text-white"
                      >
                        <span className="w-8 font-mono font-semibold text-white/70 text-center">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleManualSerialChange(idx, e.target.value)}
                          placeholder={`Code 32-bit ex. SN-${generate32BitRandomCode()}`}
                          className="flex-1 h-8 px-2.5 bg-transparent font-mono text-xs text-white outline-none border-b border-transparent focus:border-white"
                        />
                        {currentVal && (
                          <button
                            type="button"
                            onClick={() => handleCopySerial(idx, currentVal)}
                            className="p-1 text-white/80 hover:text-white rounded transition-colors cursor-pointer"
                            title="Copier le code"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="p-2.5 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg flex items-center gap-2 text-[11px] text-white/90">
                  <Layers className="w-3.5 h-3.5 text-white shrink-0" />
                  <span>Les numéros de série seront créés sans étagère. L&apos;affectation aux étagères s&apos;effectue via les mouvements.</span>
                </div>

                {errors.serialNumbers && (
                  <p className="text-[11px] text-rose-300 font-medium">
                    {errors.serialNumbers.message}
                  </p>
                )}
              </div>
            ) : (
              /* Non-Serialized Informative Box */
              <div className="pt-3 border-t border-[#3f3a36]">
                <div className="p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg flex items-start gap-2.5 text-xs text-white/90">
                  <Layers className="w-4 h-4 text-white shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Stock initial non assigné</span>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      L&apos;équipement sera créé avec une quantité de <strong>{quantity}</strong>. Pour affecter ou distribuer ce stock sur une ou plusieurs étagères, effectuez un <strong>Mouvement d&apos;Entrée (IN)</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#3f3a36] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isCreatingEquipment}
              className="px-4 py-2 text-xs font-medium text-white bg-white/15 hover:bg-white/25 border border-white/30 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCreatingEquipment}
              className="px-4 py-2 bg-[#2b2622] hover:bg-[#3f3a36] text-white border border-[#4d4742] rounded-lg text-xs font-medium transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isCreatingEquipment ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Création en cours...</span>
                </>
              ) : (
                <>
                  <PackagePlus className="w-4 h-4" />
                  <span>Créer l’équipement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
