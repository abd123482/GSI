'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  useForm,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Barcode,
  Info,
  Pencil,
  X,
} from 'lucide-react';

import type {
  Equipment,
} from '@/types/equipment';
import {
  updateEquipmentSchema,
  type UpdateEquipmentFormValues,
} from '@/schemas/equipment.schema';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  getErrorMessage,
} from '@/lib/error-message';

interface EditEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;

  /**
   * Compatibility shape with EquipmentPage/use-equipments.
   * This modal now sends ONLY equipmentName/minEquipmentQuantity.
   */
  onUpdate: (
    id: string,
    values: {
      equipmentName?: string;
      equipmentQuantity?: number;
      minEquipmentQuantity?: number;
      hasSerialNumber?: boolean;
    },
  ) => Promise<void>;

  isUpdating: boolean;
}

export function EditEquipmentModal({
  isOpen,
  onClose,
  equipment,
  onUpdate,
  isUpdating,
}: EditEquipmentModalProps) {
  const {
    canUpdateEquipment,
  } = usePermissions();

  const [
    serverError,
    setServerError,
  ] = useState<string | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<UpdateEquipmentFormValues>({
      resolver:
        zodResolver(
          updateEquipmentSchema,
        ),

      defaultValues: {
        equipmentName:
          equipment?.equipmentName ??
          '',

        minEquipmentQuantity:
          equipment?.minequipmentQuantity ??
          0,
      },
    });

  useEffect(() => {
    if (!equipment) return;

    reset({
      equipmentName:
        equipment.equipmentName ??
        '',

      minEquipmentQuantity:
        equipment.minequipmentQuantity ??
        0,
    });

    setServerError(null);
  }, [
    equipment,
    reset,
    isOpen,
  ]);

  if (
    !isOpen ||
    !equipment
  ) {
    return null;
  }

  // Capture the narrowed value so TypeScript keeps it non-null inside async handlers.
  const currentEquipment = equipment;

  const busy =
    isUpdating ||
    isSubmitting;

  async function submit(
    values: UpdateEquipmentFormValues,
  ) {
    setServerError(null);

    if (!canUpdateEquipment) {
      setServerError(
        "Permission 'equipment.update' requise.",
      );
      return;
    }

    try {
      await onUpdate(
        currentEquipment.equipmentId,
        {
          equipmentName:
            values.equipmentName?.trim(),

          minEquipmentQuantity:
            values.minEquipmentQuantity,
        },
      );

      onClose();
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(
          error,
          'Impossible de modifier cet article.',
        ),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Pencil className="h-4 w-4" />

            <div>
              <h2 className="text-sm font-semibold">
                Modifier l’article
              </h2>

              <p className="mt-0.5 text-[10px] text-white/50">
                Métadonnées uniquement
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(
            submit,
          )}
          className="space-y-5 p-5"
        >
          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-3">
            <div className="flex gap-2 text-[11px] text-sky-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

              <p>
                La quantité en stock ne se modifie plus depuis cette fiche.
                Utilisez un mouvement IN, OUT ou TRANSFER.
              </p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Nom de l’article
            </span>

            <input
              {...register(
                'equipmentName',
              )}
              className={`h-9 w-full rounded-lg border bg-[#2b2622] px-3 text-xs outline-none focus:ring-2 focus:ring-white/15 ${errors.equipmentName
                  ? 'border-rose-400'
                  : 'border-[#3f3a36] focus:border-white'
                }`}
            />

            {errors.equipmentName && (
              <p className="text-[11px] text-rose-300">
                {
                  errors
                    .equipmentName
                    .message
                }
              </p>
            )}
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Quantité minimale
            </span>

            <input
              type="number"
              min={0}
              step={1}
              {...register(
                'minEquipmentQuantity',
                {
                  valueAsNumber:
                    true,
                },
              )}
              className="h-9 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 font-mono text-xs outline-none focus:border-white focus:ring-2 focus:ring-white/15"
            />

            {errors.minEquipmentQuantity && (
              <p className="text-[11px] text-rose-300">
                {
                  errors
                    .minEquipmentQuantity
                    .message
                }
              </p>
            )}
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ReadOnlyField
              label="Mode"
              value={
                currentEquipment.hasSerialNumber
                  ? 'Sérialisé'
                  : 'Standard'
              }
              icon={
                <Barcode className="h-3.5 w-3.5" />
              }
            />

            <ReadOnlyField
              label={
                currentEquipment.hasSerialNumber
                  ? 'Identités série'
                  : 'Stock global'
              }
              value={String(
                currentEquipment.hasSerialNumber
                  ? currentEquipment._count
                    ?.serialNumbers ??
                  equipment
                    .equipmentQuantity
                  : equipment
                    .equipmentQuantity,
              )}
            />
          </div>

          <p className="text-[10px] leading-relaxed text-white/45">
            Le mode Standard/Sérialisé est immuable après création afin de préserver l’historique et les règles de stock.
          </p>

          <div className="flex items-center justify-end gap-2 border-t border-[#3f3a36] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-9 rounded-lg border border-[#3f3a36] px-4 text-xs hover:bg-white/5 disabled:opacity-50"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                !canUpdateEquipment
              }
              className="h-9 rounded-lg bg-[#f7f5f0] px-4 text-xs font-semibold text-[#2b2622] hover:bg-[#dad2c1] disabled:opacity-50"
            >
              {busy
                ? 'Enregistrement...'
                : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/70 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45">
        {icon}
        {label}
      </div>

      <p className="mt-1.5 font-mono text-xs font-semibold text-white">
        {value}
      </p>
    </div>
  );
}
