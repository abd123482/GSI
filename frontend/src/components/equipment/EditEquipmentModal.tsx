'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X,
  Pencil,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Hash,
  Barcode,
  RefreshCw,
  Copy,
  Check,
} from 'lucide-react';
import { Equipment } from '@/types/equipment';
import {
  updateEquipmentSchema,
  UpdateEquipmentFormValues,
} from '@/schemas/equipment.schema';
import { usePermissions } from '@/hooks/use-permissions';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

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

export function EditEquipmentModal(props: EditEquipmentModalProps) {
  if (!props.isOpen || !props.equipment) return null;

  const equipment = props.equipment;
  return (
    <EditEquipmentModalContent
      key={`${equipment.equipmentId}:${equipment.equipmentName}:${equipment.equipmentQuantity}:${equipment.minequipmentQuantity}:${equipment.hasSerialNumber}`}
      {...props}
    />
  );
}

function EditEquipmentModalContent({
  isOpen,
  onClose,
  equipment,
  onUpdate,
  isUpdating,
}: EditEquipmentModalProps) {
  const api = useApi();
  const { canUpdateEquipment } = usePermissions();

  // Mode state: whether the equipment will have a serial number
  const initialCount = equipment?.equipmentQuantity && equipment.equipmentQuantity > 0
    ? equipment.equipmentQuantity
    : 1;
  const [hasSerialNumber, setHasSerialNumber] = useState(equipment?.hasSerialNumber ?? false);
  const [serialCount, setSerialCount] = useState(initialCount);
  const [serialList, setSerialList] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSubmittingInternal, setIsSubmittingInternal] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<UpdateEquipmentFormValues>({
    resolver: zodResolver(updateEquipmentSchema),
    defaultValues: {
      equipmentName: equipment?.equipmentName ?? '',
      equipmentQuantity: equipment?.equipmentQuantity ?? 0,
      minEquipmentQuantity: equipment?.minequipmentQuantity ?? 0,
      hasSerialNumber: equipment?.hasSerialNumber ?? false,
    },
  });

  if (!isOpen || !equipment) return null;

  const originalHasSerialNumber = equipment.hasSerialNumber;
  const isConvertingToSerialized = !originalHasSerialNumber && hasSerialNumber;
  const isConvertingToStandard = originalHasSerialNumber && !hasSerialNumber;

  // Handler when user clicks toggle
  const handleToggleHasSerialNumber = (checked: boolean) => {
    setHasSerialNumber(checked);
    setValue('hasSerialNumber', checked);

    if (checked && !originalHasSerialNumber) {
      // Transitioning standard -> serialized
      const count = Math.max(1, Number(serialCount) || 1);
      setSerialList(generateSerialCodes(count));
    }
  };

  // Regenerate serial codes
  const handleRegenerateCodes = () => {
    const codes = generateSerialCodes(serialList.length);
    setSerialList(codes);
    toast.success(`${codes.length} code(s) 32-bit régénéré(s) !`);
  };

  // Adjust count of serials to generate
  const handleSerialCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(500, newCount));
    setSerialCount(validCount);
    setSerialList(generateSerialCodes(validCount));
  };

  const handleCopySerial = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    toast.success('Code copié !');
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const onSubmit = async (data: UpdateEquipmentFormValues) => {
    setIsSubmittingInternal(true);
    try {
      if (isConvertingToSerialized) {
        // Validate serials
        const trimmed = serialList.map((s) => s.trim().toUpperCase());
        const hasEmpty = trimmed.some((s) => s.length === 0);
        if (hasEmpty) {
          toast.error('Erreur', { description: 'Tous les numéros de série doivent être renseignés.' });
          setIsSubmittingInternal(false);
          return;
        }
        const uniqueSet = new Set(trimmed);
        if (uniqueSet.size !== trimmed.length) {
          toast.error('Erreur', { description: 'Certains numéros de série sont en double.' });
          setIsSubmittingInternal(false);
          return;
        }

        // 1. Update equipment scalar fields and toggle hasSerialNumber = true (quantity reset to 0 so batch adds exact count)
        await onUpdate(equipment.equipmentId, {
          equipmentName: data.equipmentName?.trim(),
          minEquipmentQuantity: data.minEquipmentQuantity,
          equipmentQuantity: 0,
          hasSerialNumber: true,
        });

        // 2. Create the child serial numbers via batch endpoint
        await api.post('/serial-number/batch', {
          equipmentId: equipment.equipmentId,
          serialNumberCodes: trimmed,
          serialNumberStatus: 'AVAILABLE',
        });

        toast.success('Conversion réussie', {
          description: `Article converti en sérialisé avec ${trimmed.length} numéro(s) de série.`,
        });
      } else if (isConvertingToStandard) {
        // Converting serialized -> standard: deletes serial numbers and sets scalar quantity
        await onUpdate(equipment.equipmentId, {
          equipmentName: data.equipmentName?.trim(),
          minEquipmentQuantity: data.minEquipmentQuantity,
          equipmentQuantity: Number(data.equipmentQuantity ?? equipment.equipmentQuantity),
          hasSerialNumber: false,
        });

        toast.success('Conversion réussie', {
          description: 'Article converti en mode standard (sans numéros de série).',
        });
      } else {
        // Preserving same mode
        await onUpdate(equipment.equipmentId, {
          equipmentName: data.equipmentName?.trim(),
          minEquipmentQuantity: data.minEquipmentQuantity,
          ...(hasSerialNumber
            ? {}
            : { equipmentQuantity: Number(data.equipmentQuantity) }),
          hasSerialNumber,
        });
      }

      onClose();
    } catch (err: unknown) {
      toast.error('Échec de la modification', {
        description: getErrorMessage(err, 'Une erreur est survenue.'),
      });
    } finally {
      setIsSubmittingInternal(false);
    }
  };

  const isBusy = isUpdating || isSubmittingInternal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 h-14 bg-[#2b2622] px-5 py-4 flex items-center justify-between border-b border-[#3f3a36]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2b2622] shadow-sm border border-white/20 flex items-center justify-center text-[#f7f5f0]">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-white">
                Modifier l’article
              </span>
              <p className="text-[11px] text-white/70">{equipment.equipmentName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Permission Warning */}
          {!canUpdateEquipment && (
            <div className="rounded-lg bg-amber-500/20 border border-amber-400/40 p-3 flex items-start gap-2 text-amber-100 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Permission manquante :</span> Vous ne détenez pas le droit{' '}
                <code className="bg-black/30 px-1 py-0.5 rounded text-xs">equipment.update</code> pour modifier cet article.
              </div>
            </div>
          )}

          {/* Interactive Serialized Toggle Card */}
          <div className="p-4 rounded-xl border border-[#3f3a36] bg-[#2b2622]/60 transition-all">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    hasSerialNumber
                      ? 'bg-[#2b2622] text-[#f7f5f0] border border-white/20'
                      : 'bg-black/20 text-white/60 border border-white/15'
                  }`}
                >
                  <Barcode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <span>Gestion par numéros de série</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium tracking-wide ${
                        hasSerialNumber
                          ? 'bg-[#2b2622] text-emerald-300 border border-emerald-400/30'
                          : 'bg-black/30 text-white/70 border border-white/20'
                      }`}
                    >
                      {hasSerialNumber ? 'Sérialisé' : 'Standard'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/70 mt-0.5">
                    {hasSerialNumber
                      ? 'Chaque unité possède son propre numéro de série unique.'
                      : 'Suivi par quantité globale sans numéros de série individuels.'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={hasSerialNumber}
                  onChange={(e) => handleToggleHasSerialNumber(e.target.checked)}
                  disabled={!canUpdateEquipment || isBusy}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-black/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2b2622]" />
              </label>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Equipment Name */}
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Nom de l’article <span className="text-rose-300">*</span>
              </label>
              <input
                type="text"
                {...register('equipmentName')}
                placeholder="Ex: Barcode Scanner Epson M0289"
                disabled={!canUpdateEquipment || isBusy}
                className="w-full h-10 px-3 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white placeholder-white/50 text-sm focus:outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
              />
              {errors.equipmentName && (
                <p className="mt-1 text-xs text-rose-300">{errors.equipmentName.message}</p>
              )}
            </div>

            {/* Mode 1: Converting Standard -> Serialized */}
            {isConvertingToSerialized && (
              <div className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/70 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    Conversion en article sérialisé
                  </span>
                  <span className="text-[11px] text-[#f7f5f0] bg-[#2b2622] px-2 py-0.5 rounded font-medium border border-[#38bdf8]/30">
                    {serialList.length} code(s) requis
                  </span>
                </div>

                <p className="text-xs text-white/80">
                  Des numéros de série 32-bit uniques vont être générés et enregistrés pour chaque exemplaire.
                </p>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-white font-medium shrink-0">
                    Quantité à sérialiser :
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={serialCount}
                    onChange={(e) => handleSerialCountChange(parseInt(e.target.value, 10) || 1)}
                    className="w-20 h-8 px-2 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white text-xs font-mono font-medium text-center focus:outline-none focus:border-white"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerateCodes}
                    className="ml-auto px-2.5 py-1 text-xs font-medium text-white bg-[#2b2622] border border-white/20 rounded-md hover:bg-[#3f3a36] transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Régénérer les codes
                  </button>
                </div>

                {/* Preview list */}
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 border border-[#3f3a36]/60 rounded-lg p-2 bg-[#2b2622]/50">
                  {serialList.map((code, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2.5 py-1 bg-[#2b2622] border border-[#3f3a36] rounded text-xs font-mono text-white"
                    >
                      <span className="text-[11px] text-white/60">#{idx + 1}</span>
                      <span className="font-semibold text-emerald-300">{code}</span>
                      <button
                        type="button"
                        onClick={() => handleCopySerial(code, idx)}
                        className="text-white/70 hover:text-white p-0.5 rounded cursor-pointer"
                        title="Copier le code"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mode 2: Converting Serialized -> Standard */}
            {isConvertingToStandard && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Confirmation : Conversion en article standard</span>
                </div>
                <p className="text-xs text-amber-100/90 leading-relaxed">
                  Attention : les <strong>{equipment.serialNumbers?.length ?? equipment.equipmentQuantity}</strong> numéros de série existants seront <strong>définitivement supprimés</strong> de la base de données.
                </p>
                <div>
                  <label className="block text-xs font-medium text-amber-200 mb-1">
                    Quantité globale en stock conservée <span className="text-rose-300">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      {...register('equipmentQuantity', { valueAsNumber: true })}
                      className="w-full h-10 px-3 pl-8 rounded-lg border border-amber-400/40 bg-[#2b2622] text-white text-sm focus:outline-none focus:border-white"
                    />
                    <Hash className="w-4 h-4 text-white/60 absolute left-2.5 top-3" />
                  </div>
                </div>
              </div>
            )}

            {/* Mode 3: Already Serialized & Staying Serialized */}
            {!isConvertingToSerialized && !isConvertingToStandard && hasSerialNumber && (
              <div className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-white">Quantité en stock</span>
                  <span className="font-semibold px-2 py-0.5 rounded bg-[#2b2622] text-emerald-300 border border-emerald-400/30">
                    {equipment.equipmentQuantity} exemplaire(s)
                  </span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  La quantité d’un article sérialisé correspond au nombre de numéros de série actifs enregistrés ({equipment.serialNumbers?.length ?? 0}). Les unités individuelles peuvent être gérées depuis la fiche détaillée de l&apos;article.
                </p>
              </div>
            )}

            {/* Mode 4: Already Standard & Staying Standard */}
            {!isConvertingToSerialized && !isConvertingToStandard && !hasSerialNumber && (
              <div>
                <label className="block text-xs font-medium text-white mb-1">
                  Quantité en stock <span className="text-rose-300">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    {...register('equipmentQuantity', { valueAsNumber: true })}
                    disabled={!canUpdateEquipment || isBusy}
                    className="w-full h-10 px-3 pl-8 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white placeholder-white/50 text-sm focus:outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
                  />
                  <Hash className="w-4 h-4 text-white/60 absolute left-2.5 top-3" />
                </div>
                {errors.equipmentQuantity && (
                  <p className="mt-1 text-xs text-rose-300">{errors.equipmentQuantity.message}</p>
                )}
              </div>
            )}

            {/* Min Quantity Alert */}
            <div>
              <label className="block text-xs font-medium text-white mb-1">
                Seuil d’alerte (Quantité minimale)
              </label>
              <input
                type="number"
                min="0"
                {...register('minEquipmentQuantity', { valueAsNumber: true })}
                disabled={!canUpdateEquipment || isBusy}
                className="w-full h-10 px-3 rounded-lg border border-[#3f3a36] bg-[#2b2622] text-white placeholder-white/50 text-sm focus:outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20 transition-all"
              />
              {errors.minEquipmentQuantity && (
                <p className="mt-1 text-xs text-rose-300">{errors.minEquipmentQuantity.message}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#3f3a36]/50">
              <button
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="px-4 py-2 text-xs font-medium text-white bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isBusy || !canUpdateEquipment}
                className="px-5 py-2 text-xs font-medium text-white bg-[#2b2622] border border-[#4d4742] rounded-lg hover:bg-[#3f3a36] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                {isBusy && (
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                )}
                {isConvertingToSerialized
                  ? 'Convertir en sérialisé & Enregistrer'
                  : isConvertingToStandard
                  ? 'Convertir en standard & Enregistrer'
                  : 'Enregistrer les modifications'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
