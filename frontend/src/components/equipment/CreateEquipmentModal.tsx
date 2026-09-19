'use client';

import React, { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PackagePlus,
  X,
  Barcode,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  createDirectEquipmentSchema,
  CreateDirectEquipmentFormValues,
} from '@/schemas/equipment.schema';
import { useEquipments } from '@/hooks/use-equipments';
import { usePermissions } from '@/hooks/use-permissions';
import { useShelves } from '@/hooks/use-shelves';

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

interface CreateEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateEquipmentModal: React.FC<CreateEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { createEquipment, isCreatingEquipment } = useEquipments();
  const { canCreateEquipment } = usePermissions();
  const { shelves } = useShelves({ limit: 100 });

  const [serialList, setSerialList] = useState<string[]>([]);
  const [customGenCount, setCustomGenCount] = useState<number>(1);
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
      equipmentQuantity: 0,
      minEquipmentQuantity: 0,
      serialNumbers: [],
      shelfId: '',
    },
    mode: 'onChange',
  });

  const hasSerialNumber = useWatch({ control, name: 'hasSerialNumber' });
  const selectedShelfId = useWatch({ control, name: 'shelfId' });

  // Auto-generate serial codes on demand
  const handleAutoGenerateSerials = (count: number) => {
    const validCount = Math.max(1, Math.min(200, count || 1));
    const newCodes = generateSerialCodes(validCount);
    const updated = [...serialList, ...newCodes];
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: true });
    toast.success(`${validCount} code(s) généré(s)`);
  };

  const handleAddManualSerial = () => {
    const newCode = `SN-${generate32BitRandomCode()}`;
    const updated = [...serialList, newCode];
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: true });
  };

  const handleRemoveSerial = (index: number) => {
    const updated = serialList.filter((_, idx) => idx !== index);
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: true });
  };

  if (!isOpen) return null;

  const handleManualSerialChange = (index: number, value: string) => {
    const updated = [...serialList];
    updated[index] = value.toUpperCase();
    setSerialList(updated);
    setValue('serialNumbers', updated, { shouldValidate: true });
  };

  const handleCopySerial = (index: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const onSubmit = async (values: CreateDirectEquipmentFormValues) => {
    setServerError(null);

    if (!canCreateEquipment) {
      setServerError("Action interdite : Vous n'avez pas le droit de créer un article.");
      return;
    }

    try {
      const serialsToSubmit = values.hasSerialNumber
        ? (values.serialNumbers && values.serialNumbers.length > 0
            ? values.serialNumbers
            : serialList
          )
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
        : undefined;

      const finalQuantity = values.hasSerialNumber
        ? (serialsToSubmit?.length || 0)
        : Number(values.equipmentQuantity || 0);

      const chosenShelfId = values.shelfId && values.shelfId.trim() !== '' ? values.shelfId.trim() : undefined;

      await createEquipment({
        equipmentName: values.equipmentName.trim(),
        hasSerialNumber: Boolean(values.hasSerialNumber),
        equipmentQuantity: finalQuantity,
        minEquipmentQuantity: Number(values.minEquipmentQuantity ?? 0),
        serialNumbers: serialsToSubmit && serialsToSubmit.length > 0 ? serialsToSubmit : undefined,
        shelfId: chosenShelfId,
      });

      reset();
      setSerialList([]);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      console.error('[CreateEquipmentModal] Submit failed:', err);
      const msg = err instanceof Error ? err.message : 'Échec de la création de l’article.';
      setServerError(msg);
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
                Créer un article
              </h2>
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

          {/* Article Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white">
              Nom de l’article *
            </label>
            <input
              type="text"
              {...register('equipmentName')}
              placeholder="Ex: Barcode Scanner Acer M0139"
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
              {hasSerialNumber ? (
                <div className="w-full h-9 px-3 bg-[#26221f] border border-[#3f3a36] rounded-lg text-xs font-mono text-white flex items-center justify-between">
                  <span className="text-emerald-300 font-semibold">{serialList.length} unité(s)</span>
                </div>
              ) : (
                <input
                  type="number"
                  min="0"
                  {...register('equipmentQuantity', { valueAsNumber: true })}
                  className={`w-full h-9 px-3 bg-[#2b2622] border rounded-lg text-xs font-mono text-white focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none transition-colors ${
                    errors.equipmentQuantity
                      ? 'border-rose-400 focus:border-rose-400'
                      : 'border-[#3f3a36]'
                  }`}
                />
              )}
              {errors.equipmentQuantity && (
                <p className="text-[11px] text-rose-300">{errors.equipmentQuantity.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white">
                Quantité minimale
              </label>
              <input
                type="number"
                min="0"
                {...register('minEquipmentQuantity', { valueAsNumber: true })}
                className="w-full h-9 px-3 bg-[#2b2622] border border-[#3f3a36] rounded-lg text-xs font-mono text-white focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Initial Emplacement Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Emplacement initial (Optionnel)</span>
            </label>
            <select
              {...register('shelfId')}
              className={`w-full h-9 px-3 bg-[#2b2622] border rounded-lg text-xs text-white focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none transition-colors cursor-pointer ${
                errors.shelfId ? 'border-rose-400 focus:border-rose-400' : 'border-[#3f3a36]'
              }`}
            >
              <option value="">-- Aucun (Stock non assigné) --</option>
              {shelves.map((sh) => (
                <option key={sh.shelfId} value={sh.shelfId}>
                  {sh.shelfName} ({sh.shelfQuantity ?? 0} en stock)
                </option>
              ))}
            </select>
            {errors.shelfId && (
              <p className="text-[11px] text-rose-300">{errors.shelfId.message}</p>
            )}
          </div>

          {/* Serialized Mode Toggle Card */}
          <div className="p-4 bg-[#2b2622]/60 border border-[#3f3a36] rounded-xl space-y-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Barcode className="w-4 h-4 text-white" />
                <h3 className="text-xs font-semibold text-white">
                  Cet article possède des numéros de série
                </h3>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('hasSerialNumber', {
                    onChange: (event) => {
                      if (event.target.checked) {
                        setValue('equipmentQuantity', 0);
                        setSerialList([]);
                        setValue('serialNumbers', []);
                      } else {
                        setValue('equipmentQuantity', 1);
                        setSerialList([]);
                        setValue('serialNumbers', []);
                      }
                    },
                  })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2b2622] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#3f3a36] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2b2622]"></div>
              </label>
            </div>

            {/* Serialized Configuration Area */}
            {hasSerialNumber && (
              <div className="pt-3 border-t border-[#3f3a36] space-y-3 animate-in fade-in duration-150">
                {/* Controls: Count generator + Manual add */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">
                      Numéros de série ({serialList.length}) :
                    </span>
                    {serialList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSerialList([]);
                          setValue('serialNumbers', []);
                        }}
                        className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Effacer tout
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Count input + Generate button */}
                    <div className="flex items-center bg-[#2b2622] border border-[#3f3a36] rounded-lg p-0.5">
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={customGenCount}
                        onChange={(e) => setCustomGenCount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 h-7 bg-transparent text-center font-mono text-xs text-white outline-none"
                        title="Nombre de codes à générer"
                      />
                      <button
                        type="button"
                        onClick={() => handleAutoGenerateSerials(customGenCount)}
                        className="px-2.5 py-1 bg-[#383330] hover:bg-[#453f3a] text-xs text-white font-medium rounded-md flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                      >
                        <Sparkles className="w-3 h-3 text-emerald-300" />
                        <span>Générer</span>
                      </button>
                    </div>

                    {/* Manual add button */}
                    <button
                      type="button"
                      onClick={handleAddManualSerial}
                      className="px-2.5 py-1.5 bg-[#2b2622] border border-[#3f3a36] hover:border-white/30 rounded-lg text-xs text-white font-medium flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3 h-3 text-white" />
                      <span>Ajouter</span>
                    </button>
                  </div>
                </div>

                {/* List of serial numbers */}
                {serialList.length === 0 ? (
                  <div className="py-3 px-3 bg-[#26221f] border border-[#3f3a36] rounded-lg text-center text-xs text-white/60">
                    Aucun numéro de série ajouté (quantité = 0).
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {serialList.map((currentVal, idx) => (
                      <div
                        key={`sn-input-${idx}`}
                        className="flex items-center gap-2 p-1.5 bg-[#2b2622] border border-[#3f3a36] rounded-lg text-xs text-white"
                      >
                        <span className="w-8 font-mono font-semibold text-white/60 text-center text-[11px]">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleManualSerialChange(idx, e.target.value)}
                          placeholder="Code de série..."
                          className="flex-1 h-7 px-2 bg-transparent font-mono text-xs text-white outline-none border-b border-transparent focus:border-white/50"
                        />
                        {currentVal && (
                          <button
                            type="button"
                            onClick={() => handleCopySerial(idx, currentVal)}
                            className="p-1 text-white/70 hover:text-white rounded transition-colors cursor-pointer"
                            title="Copier le code"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveSerial(idx)}
                          className="p-1 text-rose-400/80 hover:text-rose-300 rounded transition-colors cursor-pointer"
                          title="Supprimer ce code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {errors.serialNumbers && (
                  <p className="text-[11px] text-rose-300 font-medium">
                    {errors.serialNumbers.message}
                  </p>
                )}
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
                  <span>Créer l’article</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
