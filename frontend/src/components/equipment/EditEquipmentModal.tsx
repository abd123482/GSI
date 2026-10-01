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
  EquipmentConversionSerialInput,
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
  convertToSerialized: boolean;
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

  const [
    conversionCodes,
    setConversionCodes,
  ] =
    useState<
      EquipmentConversionSerialInput[]
    >([]);

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
      convertToSerialized:
        false,
    },
  });

  const conversionEnabled =
    watch(
      'convertToSerialized',
    );

  const allocationQuery =
    useQuery({
      queryKey: [
        'equipment-conversion-allocations',
        equipment?.equipmentId,
      ],

      queryFn: () =>
        EquipmentService.getEquipmentShelves(
          api,
          equipment!
            .equipmentId,
          permissions,
        ),

      enabled:
        isOpen &&
        Boolean(
          equipment &&
          !equipment.hasSerialNumber,
        ),

      staleTime: 10_000,
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
      convertToSerialized:
        false,
    });

    setConversionCodes(
      [],
    );

    setServerError(
      null,
    );
  }, [
    equipment,
    isOpen,
    reset,
  ]);

  useEffect(() => {
    if (
      !conversionEnabled ||
      !allocationQuery.data ||
      equipment
        ?.hasSerialNumber
    ) {
      if (
        !conversionEnabled
      ) {
        setConversionCodes(
          [],
        );
      }

      return;
    }

    const rows:
      EquipmentConversionSerialInput[] =
      [];

    for (
      const allocation of
      allocationQuery.data
        .equipmentShelfs ?? []
    ) {
      for (
        let index = 0;
        index <
        allocation.equipmentQuantity;
        index += 1
      ) {
        rows.push({
          serialNumberCode:
            '',
          shelfId:
            allocation.shelfId,
        });
      }
    }

    setConversionCodes(
      rows,
    );
  }, [
    conversionEnabled,
    allocationQuery.data,
    equipment?.hasSerialNumber,
  ]);

  const shelfNameById =
    useMemo(
      () =>
        new Map(
          (
            allocationQuery.data
              ?.equipmentShelfs ??
            []
          ).map(
            (allocation) => [
              allocation.shelfId,
              allocation.shelf
                ?.shelfName ??
              'Emplacement',
            ],
          ),
        ),
      [
        allocationQuery.data,
      ],
    );

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

  const conversionBlocked =
    conversionEnabled &&
    equipment.equipmentQuantity >
    0 &&
    (
      !allocationQuery.data ||
      allocationQuery.data
        .unallocatedQuantity >
      0 ||
      allocationQuery.data
        .totalAllocated !==
      equipment.equipmentQuantity
    );

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

    if (
      values.convertToSerialized &&
      conversionBlocked
    ) {
      setServerError(
        'La conversion nécessite que toute la quantité physique soit répartie dans des emplacements.',
      );
      return;
    }

    if (
      values.convertToSerialized &&
      conversionCodes.some(
        (row) =>
          !row.serialNumberCode.trim(),
      )
    ) {
      setServerError(
        'Saisissez manuellement un code pour chaque unité physique avant la conversion.',
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
      values.convertToSerialized &&
      !currentEquipment.hasSerialNumber
    ) {
      payload.hasSerialNumber =
        true;

      payload.conversionSerials =
        conversionCodes.map(
          (row) => ({
            serialNumberCode:
              row.serialNumberCode.trim(),
            shelfId:
              row.shelfId,
          }),
        );
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
      <div className="my-8 w-full max-w-2xl overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
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
                className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
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
                className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
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
              className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 font-mono text-xs"
            />
          </label>


          {equipment.hasSerialNumber ? (
            <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/55 p-4">
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4" />

                <div>
                  <p className="text-xs font-semibold">
                    Article sérialisé
                  </p>

                  <p className="mt-0.5 text-[10px] text-white/45">
                    La conversion Sérialisé → Standard est bloquée pour préserver l’intégrité des séries et de l’historique.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-lg border border-[#3f3a36] bg-[#2b2622]/55 p-4">
              <label className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Barcode className="h-4 w-4" />

                  <div>
                    <p className="text-xs font-semibold">
                      Convertir en article sérialisé
                    </p>

                  </div>
                </div>

                <input
                  type="checkbox"
                  {...register(
                    'convertToSerialized',
                  )}
                  className="h-4 w-4"
                />
              </label>

              {conversionEnabled && (
                <div className="space-y-3 border-t border-[#3f3a36] pt-4">
                  {allocationQuery.isLoading ? (
                    <p className="text-xs text-white/50">
                      Chargement des allocations actuelles...
                    </p>
                  ) : conversionBlocked ? (
                    <div className="rounded border border-amber-400/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">
                      Conversion indisponible : la quantité globale doit être entièrement représentée par les allocations actuelles.
                    </div>
                  ) : equipment.equipmentQuantity ===
                    0 ? (
                    <div className="rounded border border-emerald-400/20 bg-emerald-950/15 p-3 text-[11px] text-emerald-200">
                      Quantité physique = 0. La conversion ne nécessite aucun numéro de série initial.
                    </div>
                  ) : (
                    <>
                      <p className="text-[11px] text-white/55">
                        Saisissez exactement {equipment.equipmentQuantity} code(s), un par unité physique. L’emplacement est conservé automatiquement.
                      </p>

                      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                        {conversionCodes.map(
                          (
                            row,
                            index,
                          ) => (
                            <div
                              key={`${row.shelfId}:${index}`}
                              className="grid grid-cols-[minmax(0,1fr)_minmax(120px,180px)] gap-2"
                            >
                              <input
                                value={
                                  row.serialNumberCode
                                }
                                onChange={(
                                  event,
                                ) => {
                                  const next =
                                    [
                                      ...conversionCodes,
                                    ];

                                  next[index] =
                                  {
                                    ...row,
                                    serialNumberCode:
                                      event.target
                                        .value,
                                  };

                                  setConversionCodes(
                                    next,
                                  );
                                }}
                                placeholder={`Code série ${index + 1}`}
                                className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                              />

                              <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330] px-3 text-[10px] text-white/55">
                                {shelfNameById.get(
                                  row.shelfId,
                                ) ??
                                  'Emplacement'}
                              </div>
                            </div>
                          ),
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <footer className="flex justify-end gap-2 border-t border-[#3f3a36] pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="rounded border border-[#3f3a36] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={
                busy ||
                !canUpdateEquipment
              }
              className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
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
