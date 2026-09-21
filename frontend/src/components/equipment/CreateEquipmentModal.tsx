'use client';

import React, { useState } from 'react';
import {
  useForm,
  useWatch,
} from 'react-hook-form';
import {
  zodResolver,
} from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertCircle,
  Barcode,
  Check,
  Copy,
  Info,
  PackagePlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  createDirectEquipmentSchema,
  type CreateDirectEquipmentFormValues,
} from '@/schemas/equipment.schema';

type CreateDirectEquipmentFormInput = z.input<
  typeof createDirectEquipmentSchema
>;
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

function randomHex32(): string {
  if (
    typeof window !== 'undefined' &&
    window.crypto?.getRandomValues
  ) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);

    return values[0]
      .toString(16)
      .toUpperCase()
      .padStart(8, '0');
  }

  return Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .toUpperCase()
    .padStart(8, '0');
}

function generateSerialCodes(count: number): string[] {
  const codes = new Set<string>();

  while (codes.size < count) {
    codes.add(`SN-${randomHex32()}`);
  }

  return [...codes];
}

export const CreateEquipmentModal: React.FC<
  CreateEquipmentModalProps
> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
    /*
     * We only need mutations here, so do not start another equipment list query.
     */
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
      serialList,
      setSerialList,
    ] = useState<string[]>([]);

    const [
      customGenCount,
      setCustomGenCount,
    ] = useState(1);

    const [
      copiedIndex,
      setCopiedIndex,
    ] = useState<number | null>(null);

    const [
      serverError,
      setServerError,
    ] = useState<string | null>(null);

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
      useForm<
        CreateDirectEquipmentFormInput,
        Record<string, never>,
        CreateDirectEquipmentFormValues
      >({
        resolver:
          zodResolver(
            createDirectEquipmentSchema,
          ),

        defaultValues: {
          equipmentName: '',
          hasSerialNumber: false,
          minEquipmentQuantity: 0,
          serialNumbers: [],
        },

        mode: 'onChange',
      });

    const hasSerialNumber =
      useWatch({
        control,
        name: 'hasSerialNumber',
      });

    if (!isOpen) return null;

    const busy =
      isSubmitting ||
      isCreatingEquipment;

    function syncSerials(
      values: string[],
    ) {
      setSerialList(values);

      setValue(
        'serialNumbers',
        values,
        {
          shouldValidate: true,
          shouldDirty: true,
        },
      );
    }

    function handleAutoGenerateSerials(
      count: number,
    ) {
      const validCount =
        Math.max(
          1,
          Math.min(1000, count || 1),
        );

      const existing = new Set(
        serialList.map((value) =>
          value.toUpperCase(),
        ),
      );

      const generated: string[] = [];

      while (
        generated.length < validCount
      ) {
        const code =
          `SN-${randomHex32()}`;

        if (
          !existing.has(
            code.toUpperCase(),
          )
        ) {
          existing.add(
            code.toUpperCase(),
          );
          generated.push(code);
        }
      }

      syncSerials([
        ...serialList,
        ...generated,
      ]);

      toast.success(
        `${validCount} code(s) généré(s)`,
      );
    }

    function handleAddManualSerial() {
      syncSerials([
        ...serialList,
        `SN-${randomHex32()}`,
      ]);
    }

    function handleRemoveSerial(
      index: number,
    ) {
      syncSerials(
        serialList.filter(
          (_, current) =>
            current !== index,
        ),
      );
    }

    function handleSerialChange(
      index: number,
      value: string,
    ) {
      const updated =
        [...serialList];

      updated[index] =
        value.toUpperCase();

      syncSerials(updated);
    }

    async function copySerial(
      index: number,
      code: string,
    ) {
      await navigator.clipboard.writeText(
        code,
      );

      setCopiedIndex(index);

      setTimeout(
        () =>
          setCopiedIndex(null),
        1500,
      );
    }

    function closeAndReset() {
      reset();
      setSerialList([]);
      setServerError(null);
      onClose();
    }

    async function onSubmit(
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
          ? serialList
            .map((value) =>
              value
                .trim()
                .toUpperCase(),
            )
            .filter(Boolean)
          : [];

      if (
        serialNumbers.length > 0 &&
        !canCreateSerialNumber
      ) {
        setServerError(
          "L'article peut être créé, mais la permission 'serial-number.create' est requise pour ajouter les numéros de série.",
        );
        return;
      }

      try {
        await createEquipment({
          equipmentName:
            values.equipmentName.trim(),

          hasSerialNumber:
            Boolean(
              values.hasSerialNumber,
            ),

          minEquipmentQuantity:
            Number(
              values.minEquipmentQuantity ??
              0,
            ),

          serialNumbers:
            serialNumbers.length
              ? serialNumbers
              : undefined,
        });

        toast.success(
          'Article créé',
          {
            description:
              values.hasSerialNumber
                ? serialNumbers.length
                  ? `${serialNumbers.length} identité(s) de série créée(s). Elles sont non affectées jusqu’à une entrée en stock.`
                  : 'Article sérialisé créé sans numéro de série.'
                : 'Le stock physique démarre à 0. Utilisez un mouvement d’entrée pour ajouter du stock.',
          },
        );

        reset();
        setSerialList([]);

        onSuccess?.();
        onClose();
      } catch (error: unknown) {
        const message =
          getErrorMessage(
            error,
            'Échec de la création de l’article.',
          );

        setServerError(message);
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/55 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          className="my-8 w-full max-w-2xl overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3f3a36] bg-[#383330]">
                <PackagePlus className="h-4 w-4" />
              </div>

              <div>
                <h2 className="text-sm font-semibold">
                  Créer un article
                </h2>

                <p className="mt-0.5 text-[11px] text-white/55">
                  Métadonnées uniquement · stock physique initial = 0
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={closeAndReset}
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-5 p-6"
          >
            {serverError && (
              <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <div className="rounded-lg border border-sky-400/20 bg-sky-400/5 p-3">
              <div className="flex gap-2 text-xs text-sky-100">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

                <div className="space-y-1">
                  <p className="font-medium">
                    V3 : la création d’un article ne crée pas de stock.
                  </p>

                  <p className="text-sky-100/70">
                    Après création, utilisez « Nouveau mouvement » → Entrée pour placer les unités dans un emplacement.
                  </p>
                </div>
              </div>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold">
                Nom de l’article *
              </span>

              <input
                type="text"
                {...register(
                  'equipmentName',
                )}
                placeholder="Ex: Écran Dell 24 pouces"
                className={`h-9 w-full rounded-lg border bg-[#2b2622] px-3 text-xs text-white outline-none focus:ring-2 focus:ring-white/15 ${errors.equipmentName
                  ? 'border-rose-400'
                  : 'border-[#3f3a36] focus:border-white'
                  }`}
              />

              {errors.equipmentName && (
                <p className="text-[11px] text-rose-300">
                  {errors.equipmentName.message}
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
                    valueAsNumber: true,
                  },
                )}
                className="h-9 w-full rounded-lg border border-[#3f3a36] bg-[#2b2622] px-3 font-mono text-xs text-white outline-none focus:border-white focus:ring-2 focus:ring-white/15"
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

            <div className="space-y-4 rounded-xl border border-[#3f3a36] bg-[#2b2622]/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Barcode className="h-4 w-4" />

                  <div>
                    <p className="text-xs font-semibold">
                      Article sérialisé
                    </p>

                    <p className="mt-0.5 text-[10px] text-white/55">
                      Chaque unité possède une identité de série.
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex cursor-pointer items-center">
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
                    className="peer sr-only"
                  />

                  <div className="h-5 w-9 rounded-full bg-[#1f1b18] after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-[#57504a] after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full" />
                </label>
              </div>

              {hasSerialNumber && (
                <div className="space-y-3 border-t border-[#3f3a36] pt-3">
                  {!canCreateSerialNumber && (
                    <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-100">
                      Vous pouvez créer l’article sérialisé sans séries, mais l’ajout de codes nécessite la permission{' '}
                      <code>
                        serial-number.create
                      </code>.
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">
                        Numéros de série optionnels
                      </p>

                      <p className="mt-0.5 text-[10px] text-white/50">
                        Les séries créées auront shelfId = null.
                      </p>
                    </div>

                    {canCreateSerialNumber && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-lg border border-[#3f3a36] bg-[#1f1b18] p-0.5">
                          <input
                            type="number"
                            min={1}
                            max={1000}
                            value={
                              customGenCount
                            }
                            onChange={(
                              event,
                            ) =>
                              setCustomGenCount(
                                Math.max(
                                  1,
                                  Math.min(
                                    1000,
                                    Number(
                                      event
                                        .target
                                        .value,
                                    ) ||
                                    1,
                                  ),
                                ),
                              )
                            }
                            className="h-7 w-14 bg-transparent text-center font-mono text-xs outline-none"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              handleAutoGenerateSerials(
                                customGenCount,
                              )
                            }
                            className="flex items-center gap-1.5 rounded-md bg-[#383330] px-2.5 py-1 text-xs hover:bg-[#453f3a]"
                          >
                            <Sparkles className="h-3 w-3 text-emerald-300" />
                            Générer
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={
                            handleAddManualSerial
                          }
                          className="flex items-center gap-1.5 rounded-lg border border-[#3f3a36] bg-[#2b2622] px-2.5 py-1.5 text-xs hover:border-white/25"
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter
                        </button>
                      </div>
                    )}
                  </div>

                  {serialList.length > 0 ? (
                    <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                      {serialList.map(
                        (
                          value,
                          index,
                        ) => (
                          <div
                            key={`serial-${index}`}
                            className="flex items-center gap-2 rounded-lg border border-[#3f3a36] bg-[#2b2622] p-1.5"
                          >
                            <span className="w-8 text-center font-mono text-[10px] text-white/45">
                              #
                              {String(
                                index + 1,
                              ).padStart(
                                2,
                                '0',
                              )}
                            </span>

                            <input
                              value={
                                value
                              }
                              onChange={(
                                event,
                              ) =>
                                handleSerialChange(
                                  index,
                                  event
                                    .target
                                    .value,
                                )
                              }
                              className="h-7 min-w-0 flex-1 border-b border-transparent bg-transparent px-2 font-mono text-xs outline-none focus:border-white/40"
                            />

                            <button
                              type="button"
                              onClick={() =>
                                copySerial(
                                  index,
                                  value,
                                )
                              }
                              className="rounded p-1 text-white/60 hover:text-white"
                            >
                              {copiedIndex ===
                                index ? (
                                <Check className="h-3.5 w-3.5 text-emerald-300" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveSerial(
                                  index,
                                )
                              }
                              className="rounded p-1 text-rose-400 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#3f3a36] bg-[#26221f] p-3 text-center text-xs text-white/45">
                      Aucun numéro de série. Vous pourrez les ajouter plus tard.
                    </div>
                  )}

                  {errors.serialNumbers && (
                    <p className="text-[11px] text-rose-300">
                      {
                        errors
                          .serialNumbers
                          .message
                      }
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#3f3a36] pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={closeAndReset}
                className="h-9 rounded-lg border border-[#3f3a36] px-4 text-xs hover:bg-white/5 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={
                  busy ||
                  !canCreateEquipment
                }
                className="h-9 rounded-lg bg-[#f7f5f0] px-4 text-xs font-semibold text-[#2b2622] hover:bg-[#dad2c1] disabled:opacity-50"
              >
                {busy
                  ? 'Création...'
                  : 'Créer l’article'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
