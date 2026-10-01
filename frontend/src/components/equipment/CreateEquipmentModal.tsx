'use client';

import {
  useState,
} from 'react';
import {
  useForm,
  useWatch,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import {
  AlertCircle,
  Barcode,
  Info,
  PackagePlus,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import {
  createDirectEquipmentSchema,
  type CreateDirectEquipmentFormValues,
} from '@/schemas/equipment.schema';

import {
  useEquipments,
} from '@/hooks/use-equipments';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  getErrorMessage,
} from '@/lib/error-message';

interface CreateEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateEquipmentModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEquipmentModalProps) {
  const {
    createEquipment,
    isCreatingEquipment,
  } = useEquipments({
    enabled: false,
  });

  const {
    canCreateEquipment,
    canCreateSerialNumber,
  } = usePermissions();

  const [
    serials,
    setSerials,
  ] =
    useState<string[]>(
      [],
    );

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
    control,
    setValue,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } =
    useForm<CreateDirectEquipmentFormValues>({
      resolver:
        zodResolver(
          createDirectEquipmentSchema,
        ),

      defaultValues: {
        equipmentName: '',
        hasSerialNumber:
          false,
        minEquipmentQuantity:
          0,
        equipmentStatus:
          true,
        serialNumbers: [],
      },
    });

  const serialized =
    useWatch({
      control,
      name:
        'hasSerialNumber',
    });

  if (!isOpen) {
    return null;
  }

  const busy =
    isSubmitting ||
    isCreatingEquipment;

  function syncSerials(
    next: string[],
  ) {
    setSerials(next);

    setValue(
      'serialNumbers',
      next,
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  }

  function addSerialInput() {
    syncSerials([
      ...serials,
      '',
    ]);
  }

  function generateSerialInput() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const code = `SN-${timestamp}-${random}`;
    syncSerials([
      ...serials,
      code,
    ]);
  }

  function close() {
    reset();
    setSerials([]);
    setServerError(null);
    onClose();
  }

  async function submit(
    values: CreateDirectEquipmentFormValues,
  ) {
    setServerError(null);

    if (!canCreateEquipment) {
      setServerError(
        "Permission 'equipment.create' requise.",
      );
      return;
    }

    const serialNumbers =
      values.hasSerialNumber
        ? serials
          .map((code) =>
            code.trim(),
          )
          .filter(Boolean)
        : [];

    if (
      serialNumbers.length &&
      !canCreateSerialNumber
    ) {
      setServerError(
        "Permission 'serial-number.create' requise pour créer les identités de série.",
      );
      return;
    }

    try {
      await createEquipment({
        equipmentName:
          values.equipmentName.trim(),
        hasSerialNumber:
          values.hasSerialNumber,
        minEquipmentQuantity:
          values.minEquipmentQuantity,
        equipmentStatus:
          values.equipmentStatus,
        serialNumbers,
      });

      onSuccess?.();
      close();
    } catch (error: unknown) {
      setServerError(
        getErrorMessage(
          error,
          'Échec de la création de l’article.',
        ),
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <PackagePlus className="h-4 w-4" />

            <div>
              <h2 className="text-sm font-semibold">
                Créer un article
              </h2>

            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={close}
            className="rounded p-1.5 text-white/60 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form
          onSubmit={handleSubmit(
            submit,
          )}
          className="space-y-5 p-6"
        >
          {serverError && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-950/35 p-3 text-xs text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold">
                Nom de l’article *
              </span>

              <input
                {...register(
                  'equipmentName',
                )}
                className="h-10 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 text-xs outline-none focus:border-white/50"
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

            <label className="space-y-1.5">
              <span className="text-xs font-semibold">
                Statut
              </span>

              <select
                {...register(
                  'equipmentStatus',
                )}
                className="h-10 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
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
              className="h-10 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 font-mono text-xs"
            />
          </label>

          <div className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4" />

                <div>
                  <p className="text-xs font-semibold">
                    Article sérialisé
                  </p>


                </div>
              </div>

              <input
                type="checkbox"
                {...register(
                  'hasSerialNumber',
                  {
                    onChange: (
                      event,
                    ) => {
                      if (
                        !event.target
                          .checked
                      ) {
                        syncSerials(
                          [],
                        );
                      }
                    },
                  },
                )}
                className="h-4 w-4"
              />
            </div>

            {serialized && (
              <div className="mt-4 space-y-3 border-t border-[#3f3a36] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold">
                      Numéros de série
                    </p>

                    <p className="mt-0.5 text-[10px] text-white/45">
                      Aucun code n’est généré automatiquement.
                    </p>
                  </div>

                  {canCreateSerialNumber && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={generateSerialInput}
                        className="inline-flex items-center gap-1.5 rounded border border-[#4a4540] bg-[#383330] px-3 py-1.5 text-xs text-sky-300 hover:bg-[#4a4540]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Générer
                      </button>
                      <button
                        type="button"
                        onClick={addSerialInput}
                        className="inline-flex items-center gap-1.5 rounded border border-[#4a4540] bg-[#383330] px-3 py-1.5 text-xs hover:bg-[#4a4540]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Ajouter
                      </button>
                    </div>
                  )}
                </div>

                {serials.length ===
                  0 ? (
                  <div className="rounded-lg border border-dashed border-[#4a4540] p-4 text-center text-[11px] text-white/45">
                    Aucun numéro de série ajouté.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serials.map(
                      (
                        code,
                        index,
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="flex items-center gap-2"
                        >
                          <input
                            value={
                              code
                            }
                            readOnly={code.startsWith('SN-')}
                            onChange={(
                              event,
                            ) => {
                              if (code.startsWith('SN-')) return;
                              const next =
                                [
                                  ...serials,
                                ];

                              next[index] =
                                event.target
                                  .value;

                              syncSerials(
                                next,
                              );
                            }}
                            placeholder={`Code série ${index + 1}`}
                            className={`h-9 min-w-0 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs outline-none focus:border-white/40 ${code.startsWith('SN-') ? 'opacity-60 cursor-not-allowed' : ''
                              }`}
                          />

                          <button
                            type="button"
                            onClick={() =>
                              syncSerials(
                                serials.filter(
                                  (
                                    _,
                                    current,
                                  ) =>
                                    current !==
                                    index,
                                ),
                              )
                            }
                            className="rounded p-2 text-rose-300 hover:bg-rose-950/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>



          <footer className="flex justify-end gap-2 border-t border-[#3f3a36] pt-4">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded border border-[#3f3a36] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                !canCreateEquipment
              }
              className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
            >
              {busy
                ? 'Création...'
                : 'Créer'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
