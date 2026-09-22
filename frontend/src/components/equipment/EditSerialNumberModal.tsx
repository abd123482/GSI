'use client';

import {
  useEffect,
} from 'react';
import {
  useForm,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import {
  Barcode,
  LockKeyhole,
  ShieldAlert,
  X,
} from 'lucide-react';

import type {
  SerialNumber,
} from '@/types/equipment';

import {
  updateSerialNumberSchema,
  type UpdateSerialNumberFormValues,
} from '@/schemas/equipment.schema';

import {
  usePermissions,
} from '@/hooks/use-permissions';

interface EditSerialNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  serialNumber: SerialNumber | null;
  onUpdate: (
    id: string,
    values: {
      serialNumberStatus: string;
    },
  ) => Promise<void>;
  isUpdating: boolean;
}

export function EditSerialNumberModal({
  isOpen,
  onClose,
  serialNumber,
  onUpdate,
  isUpdating,
}: EditSerialNumberModalProps) {
  const {
    canUpdateSerialNumber,
  } = usePermissions();

  const {
    register,
    handleSubmit,
    reset,
  } =
    useForm<UpdateSerialNumberFormValues>({
      resolver:
        zodResolver(
          updateSerialNumberSchema,
        ),

      defaultValues: {
        serialNumberStatus:
          'AVAILABLE',
      },
    });

  useEffect(() => {
    if (
      serialNumber &&
      isOpen
    ) {
      reset({
        serialNumberStatus:
          serialNumber.serialNumberStatus ??
          'AVAILABLE',
      });
    }
  }, [
    serialNumber,
    isOpen,
    reset,
  ]);

  if (
    !isOpen ||
    !serialNumber
  ) {
    return null;
  }

  async function submit(
    data: UpdateSerialNumberFormValues,
  ) {
    await onUpdate(
      serialNumber!.serialNumberId,
      {
        serialNumberStatus:
          data.serialNumberStatus,
      },
    );

    onClose();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div className="flex items-center gap-2">
            <Barcode className="h-4 w-4" />
            <span className="text-sm font-semibold">
              Modifier le statut
            </span>
          </div>

          <button
            type="button"
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
          className="space-y-4 p-5"
        >
          {!canUpdateSerialNumber && (
            <div className="flex gap-2 rounded border border-amber-400/30 bg-amber-950/20 p-3 text-xs text-amber-200">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              Permission serial-number.update requise.
            </div>
          )}

          <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/60 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
              <LockKeyhole className="h-3.5 w-3.5" />
              Code immuable
            </div>

            <p className="mt-2 font-mono text-xs font-semibold">
              {
                serialNumber.serialNumberCode
              }
            </p>

            <p className="mt-1 text-[10px] text-white/45">
              Le code ne peut plus être modifié après création.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Statut
            </span>

            <select
              {...register(
                'serialNumberStatus',
              )}
              className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
            >
              <option value="AVAILABLE">
                AVAILABLE
              </option>
              <option value="IN_USE">
                IN_USE
              </option>
              <option value="MAINTENANCE">
                MAINTENANCE
              </option>
              <option value="DEFECTIVE">
                DEFECTIVE
              </option>
              <option value="INACTIVE">
                INACTIVE
              </option>
            </select>
          </label>

          <footer className="flex justify-end gap-2 border-t border-[#3f3a36] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className="rounded border border-[#3f3a36] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                isUpdating ||
                !canUpdateSerialNumber
              }
              className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
            >
              {isUpdating
                ? 'Enregistrement...'
                : 'Enregistrer'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
