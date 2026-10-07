'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  useQuery,
} from '@tanstack/react-query';
import {
  useForm,
} from 'react-hook-form';
import {
  AlertCircle,
  Barcode,
  Info,
  Pencil,
  X,
} from 'lucide-react';

import type {
  Equipment,
  UpdateEquipmentInput,
} from '@/types/equipment';

import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  useApi,
} from '@/hooks/use-api';
import {
  EquipmentService,
} from '@/services/equipment.service';
import {
  getErrorMessage,
} from '@/lib/error-message';

interface EditEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  onUpdate: (
    id: string,
    values: UpdateEquipmentInput,
  ) => Promise<void>;
  isUpdating: boolean;
}

interface BasicForm {
  equipmentName: string;
  minEquipmentQuantity: number;
  equipmentStatus: boolean;
}

export function EditEquipmentModal({
  isOpen,
  onClose,
  equipment,
  onUpdate,
  isUpdating,
}: EditEquipmentModalProps) {
  const api = useApi();

  const {
    permissions,
    canUpdateEquipment,
  } = usePermissions();

  const [
    serverError,
    setServerError,
  ] =
    useState<string | null>(
      null,
    );



  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: {
      isSubmitting,
    },
  } = useForm<BasicForm>({
    defaultValues: {
      equipmentName: '',
      minEquipmentQuantity:
        0,
      equipmentStatus:
        true,
    },
  });



  useEffect(() => {
    if (!equipment) {
      return;
    }

    reset({
      equipmentName:
        equipment.equipmentName ??
        '',
      minEquipmentQuantity:
        equipment.minequipmentQuantity,
      equipmentStatus:
        equipment.equipmentStatus ??
        true,
    });

    setServerError(
      null,
    );
  }, [
    equipment,
    isOpen,
    reset,
  ]);



  if (
    !isOpen ||
    !equipment
  ) {
    return null;
  }

  const currentEquipment =
    equipment;

  const busy =
    isUpdating ||
    isSubmitting;

  async function submit(
    values: BasicForm,
  ) {
    setServerError(null);

    if (!canUpdateEquipment) {
      setServerError(
        "Permission 'equipment.update' requise.",
      );
      return;
    }



    const payload:
      UpdateEquipmentInput =
      {};

    const nextName =
      values.equipmentName.trim();

    if (
      nextName !==
      (
        currentEquipment.equipmentName ??
        ''
      )
    ) {
      payload.equipmentName =
        nextName;
    }

    if (
      values.minEquipmentQuantity !==
      currentEquipment.minequipmentQuantity
    ) {
      payload.minEquipmentQuantity =
        Number(
          values.minEquipmentQuantity,
        );
    }

    if (
      (values.equipmentStatus) !==
      currentEquipment.equipmentStatus
    ) {
      payload.equipmentStatus =
        values.equipmentStatus;
    }



    if (
      Object.keys(
        payload,
      ).length === 0
    ) {
      onClose();
      return;
    }

    try {
      await onUpdate(
        currentEquipment.equipmentId,
        payload,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Pencil className="h-4 w-4" />

            <div>
              <h2 className="text-sm font-semibold">
                Modifier l’article
              </h2>

            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded p-1.5 text-white/60 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit(
            submit,
          )}
          className="space-y-5 p-5"
        >
          {serverError && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/35 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold">
                Nom
              </span>

              <input
                {...register(
                  'equipmentName',
                )}
                className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold">
                Statut
              </span>

              <select
                {...register(
                  'equipmentStatus',
                )}
                className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs"
              >
                <option value="true">
                  ACTIVE
                </option>
                <option value="false">
                  INACTIVE
                </option>
              </select>
            </label>
          </div>

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
              className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 font-mono text-xs"
            />
          </label>


          {equipment.hasSerialNumber ? (
            <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/55 p-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4" />

                <div>
                  <p className="text-xs font-semibold">
                    Article sérialisé
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/45">
                    Cet article gère son stock via les numéros de série.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/55 p-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4" />

                <div>
                  <p className="text-xs font-semibold">
                    Article standard
                  </p>
                  <p className="mt-0.5 text-[10px] text-white/45">
                    Cet article gère son stock de manière quantitative.
                  </p>
                </div>
              </div>
            </div>
          )}

          <footer className="flex justify-end gap-2 border-t border-[#3f3f46] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded border border-[#3f3f46] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                !canUpdateEquipment
              }
              className="rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40"
            >
              {busy
                ? 'Enregistrement...'
                : 'Enregistrer'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
