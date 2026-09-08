'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createEntryMovementWithEquipmentSchema,
  CreateEntryMovementWithEquipmentFormValues,
} from '@/schemas/equipment.schema';
import { useEquipments } from '@/hooks/use-equipments';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { REQUIRED_MOVEMENT_CREATE_PERMISSION } from '@/services/equipment.service';
import { InsufficientPermissionException } from '@/services/shelf.errors';
import {
  X,
  Plus,
  Loader2,
  ShieldAlert,
  Layers,
  Hash,
  Sparkles,
  RefreshCw,
  Cpu,
  Barcode,
  Check,
  Copy,
  AlertCircle,
  PackagePlus,
  Sliders,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';

interface CreateEquipmentMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Generates a cryptographically strong 32-bit random hex code (8 hex digits, 0x00000000 - 0xFFFFFFFF)
 */
function generate32BitRandomCode(): string {
  const array = new Uint32Array(1);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
    return array[0].toString(16).toUpperCase().padStart(8, '0');
  }
  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, '0');
}

export function CreateEquipmentMovementModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEquipmentMovementModalProps) {
  const { createEntryMovement, isCreating, canCreateMovement } = useEquipments();
  const { shelves } = useShelves({ limit: 100 });
  const { roleName } = usePermissions();

  const [serialGenMode, setSerialGenMode] = useState<'auto' | 'manual'>('auto');
  const [serialList, setSerialList] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEntryMovementWithEquipmentFormValues>({
    resolver: zodResolver(createEntryMovementWithEquipmentSchema),
    defaultValues: {
      equipmentName: '',
      hasSerialNumber: false,
      equipmentQuantity: 1,
      minEquipmentQuantity: 0,
      destinationShelfId: '',
      serialNumbers: [],
    },
    mode: 'onChange',
  });

  const hasSerialNumber = watch('hasSerialNumber');
  const quantity = watch('equipmentQuantity') || 1;

  // Whenever hasSerialNumber is turned on or quantity changes in auto-mode, generate unique 32-bit codes
  const handleAutoGenerateSerials = (count: number) => {
    const codes = new Set<string>();
    while (codes.size < count) {
      codes.add(`SN-${generate32BitRandomCode()}`);
    }
    const arr = Array.from(codes);
    setSerialList(arr);
    setValue('serialNumbers', arr, { shouldValidate: true });
    toast.success(`${count} code(s) 32-bit généré(s) aléatoirement !`);
  };

  useEffect(() => {
    if (hasSerialNumber && serialGenMode === 'auto') {
      const targetCount = Math.max(1, Number(quantity));
      if (serialList.length !== targetCount) {
        const codes = new Set<string>();
        while (codes.size < targetCount) {
          codes.add(`SN-${generate32BitRandomCode()}`);
        }
        const arr = Array.from(codes);
        setSerialList(arr);
        setValue('serialNumbers', arr, { shouldValidate: true });
      }
    }
  }, [hasSerialNumber, quantity, serialGenMode, setValue]);

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
    // Pad or trim list to match quantity
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

  const onSubmit = async (values: CreateEntryMovementWithEquipmentFormValues) => {
    setServerError(null);

    // Permission guard check
    if (!canCreateMovement) {
      const err = new InsufficientPermissionException(
        REQUIRED_MOVEMENT_CREATE_PERMISSION,
        `Action interdite : Votre rôle (${roleName ?? 'Utilisateur'}) ne possède pas la permission '${REQUIRED_MOVEMENT_CREATE_PERMISSION}' pour enregistrer un mouvement d'entrée.`,
      );
      setServerError(err.message);
      throw err;
    }

    try {
      await createEntryMovement({
        equipmentName: values.equipmentName.trim(),
        hasSerialNumber: values.hasSerialNumber,
        equipmentQuantity: Number(values.equipmentQuantity),
        minEquipmentQuantity: Number(values.minEquipmentQuantity ?? 0),
        destinationShelfId: values.destinationShelfId || null,
        serialNumbers: values.hasSerialNumber ? serialList : undefined,
      });

      reset();
      setSerialList([]);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('[CreateEquipmentMovementModal] Submit failed:', err);
      setServerError(err.message || 'Échec de la création de l’équipement en mouvement.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-equipment-title"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-[#e5e3df] flex items-center justify-between bg-[#fafaf9]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e6e0f5] border border-[#d6b6f6] flex items-center justify-center text-[#7b3ff2]">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="create-equipment-title" className="text-base font-semibold text-[#1a1a1a]">
                Mouvement d’entrée & Nouvel équipement
              </h2>
              <p className="text-xs text-[#5d5b54]">
                Source : <code className="font-mono bg-[#f0eeec] px-1 py-0.5 rounded text-[10px]">NULL</code> (Entrée externe) • Destination personnalisable
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#787671] hover:text-[#1a1a1a] hover:bg-[#ede9e4] p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Warning Banner if lacking permission */}
        {!canCreateMovement && (
          <div className="mx-6 mt-4 p-3.5 bg-[#ffe8d4] border border-[#f5d75e] rounded-lg flex items-start gap-3 text-left">
            <ShieldAlert className="w-5 h-5 text-[#dd5b00] shrink-0 mt-0.5" />
            <div className="text-xs text-[#793400] space-y-1">
              <p className="font-semibold">Autorisation requise : {REQUIRED_MOVEMENT_CREATE_PERMISSION}</p>
              <p>
                Votre rôle ne dispose pas de la permission requise pour créer des mouvements d'équipement.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {serverError && (
          <div className="mx-6 mt-4 p-3.5 bg-[#fde0ec] border border-[#ff64c8] rounded-lg flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-[#e03131] shrink-0 mt-0.5" />
            <div className="text-xs text-[#a02e6d] space-y-0.5">
              <p className="font-semibold">Erreur d'enregistrement</p>
              <p>{serverError}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
          {/* 1. Equipment Name */}
          <div className="space-y-1.5">
            <label htmlFor="equipmentName" className="block text-xs font-semibold text-[#1a1a1a]">
              Nom de l'équipement <span className="text-[#e03131]">*</span>
            </label>
            <input
              id="equipmentName"
              type="text"
              {...register('equipmentName')}
              placeholder="ex. Serveur Dell PowerEdge R740, Écran 24 pouces..."
              className={`w-full h-11 px-3.5 bg-white text-sm border rounded-lg outline-none transition-all ${
                errors.equipmentName
                  ? 'border-[#e03131] ring-1 ring-[#e03131]'
                  : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]'
              }`}
            />
            {errors.equipmentName && (
              <p className="text-[11px] text-[#e03131] font-medium flex items-center gap-1">
                <span>⚠</span>
                <span>{errors.equipmentName.message}</span>
              </p>
            )}
          </div>

          {/* 2. Quantities Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div className="space-y-1.5">
              <label htmlFor="equipmentQuantity" className="block text-xs font-semibold text-[#1a1a1a]">
                Quantité reçue <span className="text-[#e03131]">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#787671]" />
                <input
                  id="equipmentQuantity"
                  type="number"
                  min="1"
                  {...register('equipmentQuantity', { valueAsNumber: true })}
                  className={`w-full h-11 pl-9 pr-3 bg-white text-sm border rounded-lg outline-none transition-all ${
                    errors.equipmentQuantity
                      ? 'border-[#e03131] ring-1 ring-[#e03131]'
                      : 'border-[#c8c4be] focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]'
                  }`}
                />
              </div>
              {errors.equipmentQuantity && (
                <p className="text-[11px] text-[#e03131] font-medium">
                  {errors.equipmentQuantity.message}
                </p>
              )}
            </div>

            {/* Min Quantity */}
            <div className="space-y-1.5">
              <label htmlFor="minEquipmentQuantity" className="block text-xs font-semibold text-[#1a1a1a]">
                Seuil d'alerte stock minimal
              </label>
              <div className="relative">
                <Sliders className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#787671]" />
                <input
                  id="minEquipmentQuantity"
                  type="number"
                  min="0"
                  {...register('minEquipmentQuantity', { valueAsNumber: true })}
                  placeholder="0"
                  className="w-full h-11 pl-9 pr-3 bg-white text-sm border border-[#c8c4be] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]"
                />
              </div>
            </div>
          </div>

          {/* 3. Destination Shelf Selector (Nullable point: can be left unassigned!) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="destinationShelfId" className="block text-xs font-semibold text-[#1a1a1a]">
                Étagère d’affectation (Destination)
              </label>
              <span className="text-[11px] text-[#5d5b54]">
                Optionnel : peut rester non assigné
              </span>
            </div>
            <div className="relative">
              <Layers className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#787671]" />
              <select
                id="destinationShelfId"
                {...register('destinationShelfId')}
                className="w-full h-11 pl-9 pr-8 bg-white text-xs border border-[#c8c4be] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4] appearance-none cursor-pointer"
              >
                <option value="">-- Aucune étagère (Stock en transit / Non assigné) --</option>
                {shelves.map((shelf) => (
                  <option key={shelf.shelfId} value={shelf.shelfId}>
                    {shelf.shelfName ?? 'Étagère sans nom'} ({shelf.shelfQuantity} unités stockées)
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[#787671]">
              Si vous ne sélectionnez aucune étagère, l'équipement sera créé sans assignation directe à un rack.
            </p>
          </div>

          {/* 4. Serial Numbers Toggle */}
          <div className="p-4 bg-[#fafaf9] border border-[#e5e3df] rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Barcode className="w-4 h-4 text-[#5645d4]" />
                <div>
                  <h3 className="text-xs font-semibold text-[#1a1a1a]">
                    Cet équipement possède des numéros de série
                  </h3>
                  <p className="text-[11px] text-[#5d5b54]">
                    Traçabilité unitaire de chaque exemplaire ({quantity} requis)
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  {...register('hasSerialNumber')}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#ede9e4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#c8c4be] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5645d4]"></div>
              </label>
            </div>

            {/* Serial Numbers Configuration Area */}
            {hasSerialNumber && (
              <div className="pt-3 border-t border-[#e5e3df] space-y-4 animate-in fade-in duration-150">
                {/* Mode Selector Pill Tabs */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#1a1a1a]">
                    Mode de renseignement des numéros :
                  </span>
                  <div className="inline-flex p-0.5 bg-[#f0eeec] border border-[#e5e3df] rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={handleSwitchToAuto}
                      className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        serialGenMode === 'auto'
                          ? 'bg-white text-[#1a1a1a] shadow-xs'
                          : 'text-[#787671] hover:text-[#1a1a1a]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#7b3ff2]" />
                      <span>Auto-générer (32-bit aléatoire)</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSwitchToManual}
                      className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                        serialGenMode === 'manual'
                          ? 'bg-white text-[#1a1a1a] shadow-xs'
                          : 'text-[#787671] hover:text-[#1a1a1a]'
                      }`}
                    >
                      <Sliders className="w-3.5 h-3.5 text-[#5645d4]" />
                      <span>Saisie manuelle</span>
                    </button>
                  </div>
                </div>

                {/* Auto Generation CTA Banner */}
                {serialGenMode === 'auto' && (
                  <div className="p-3 bg-[#e6e0f5]/60 border border-[#d6b6f6] rounded-lg flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-[#391c57]">
                      <Sparkles className="w-4 h-4 text-[#7b3ff2] shrink-0" />
                      <span>
                        Génération cryptographique de {quantity} code(s) 32-bit uniques (8 hexadécimaux).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAutoGenerateSerials(Math.max(1, Number(quantity)))}
                      className="px-2.5 py-1 bg-white hover:bg-[#ede9e4] border border-[#d6b6f6] rounded-md text-xs font-medium text-[#7b3ff2] transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Régénérer</span>
                    </button>
                  </div>
                )}

                {/* Serial Numbers Input / Review List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {Array.from({ length: Math.max(1, Number(quantity)) }).map((_, idx) => {
                    const currentVal = serialList[idx] || '';
                    return (
                      <div
                        key={`sn-input-${idx}`}
                        className="flex items-center gap-2 p-2 bg-white border border-[#e5e3df] rounded-lg text-xs"
                      >
                        <span className="w-8 font-mono font-semibold text-[#787671] text-center">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <input
                          type="text"
                          value={currentVal}
                          onChange={(e) => handleManualSerialChange(idx, e.target.value)}
                          placeholder={`Code 32-bit ex. SN-${generate32BitRandomCode()}`}
                          className="flex-1 h-8 px-2.5 bg-transparent font-mono text-xs text-[#1a1a1a] outline-none border-b border-transparent focus:border-[#5645d4]"
                        />
                        {currentVal && (
                          <button
                            type="button"
                            onClick={() => handleCopySerial(idx, currentVal)}
                            className="p-1 text-[#787671] hover:text-[#1a1a1a] rounded transition-colors cursor-pointer"
                            title="Copier le code"
                          >
                            {copiedIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {errors.serialNumbers && (
                  <p className="text-[11px] text-[#e03131] font-medium">
                    {errors.serialNumbers.message}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#ede9e4] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isCreating}
              className="px-4 py-2.5 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isCreating || !canCreateMovement}
              className="px-5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-xs font-medium rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting || isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement du mouvement...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Enregistrer l'entrée & Équipement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
