'use client';

import {
  useEffect,
  useState,
} from 'react';
import Link from 'next/link';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  ArrowLeft,
  Barcode,
  Loader2,
  Package,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';

import {
  useInventoryTask,
  useSaveInventoryTaskDraft,
  useSubmitInventoryTask,
} from '@/hooks/use-inventory';

import {
  useEquipments,
} from '@/hooks/use-equipments';

import {
  useShelves,
} from '@/hooks/use-shelves';

import type {
  CountObservationInput,
} from '@/types/inventory';

import {
  getErrorMessage,
} from '@/lib/error-message';

interface StandardRow {
  id: string;
  equipmentId: string;
  shelfId: string;
  quantity: number;
}

interface SerialRow {
  id: string;
  code: string;
  shelfId: string;
}

function newId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function purposeText(
  purpose?: string,
) {
  if (purpose === 'PRIMARY_1') {
    return 'C1';
  }

  if (purpose === 'PRIMARY_2') {
    return 'C2';
  }

  return 'C3';
}

export default function InventoryTaskPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const taskId =
    params?.taskId as string;

  const taskQuery =
    useInventoryTask(taskId);

  const saveDraft =
    useSaveInventoryTaskDraft();

  const submitTask =
    useSubmitInventoryTask();

  const equipments =
    useEquipments({
      page: 1,
      limit: 100,
    });

  const shelves =
    useShelves({
      page: 1,
      limit: 100,
    });

  const [
    standardRows,
    setStandardRows,
  ] =
    useState<StandardRow[]>([]);

  const [
    serialRows,
    setSerialRows,
  ] =
    useState<SerialRow[]>([]);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const task =
    taskQuery.data;

  const byEquipment =
    task?.unit.inventory.typeInventory ===
    'ByEquipment';

  const byShelf =
    task?.unit.inventory.typeInventory ===
    'ByShelf';

  useEffect(() => {
    if (!task) {
      return;
    }

    if (task.draftData) {
      try {
        const parsed =
          JSON.parse(
            task.draftData,
          ) as {
            observations?: CountObservationInput[];
          };

        const standard:
          StandardRow[] = [];

        const serial:
          SerialRow[] = [];

        for (
          const observation of
          parsed.observations ?? []
        ) {
          if (
            observation.scannedSerialCode
          ) {
            serial.push({
              id: newId(),
              code:
                observation.scannedSerialCode,
              shelfId:
                observation.observedShelfId ??
                observation.shelfId ??
                '',
            });
          } else {
            standard.push({
              id: newId(),
              equipmentId:
                observation.observedEquipmentId ??
                observation.equipmentId ??
                '',
              shelfId:
                observation.observedShelfId ??
                observation.shelfId ??
                '',
              quantity:
                observation.quantityCalculated ??
                0,
            });
          }
        }

        setStandardRows(
          standard,
        );
        setSerialRows(
          serial,
        );

        return;
      } catch {
        // Fall back to a clean form.
      }
    }

    if (
      task.isSerialized
    ) {
      setSerialRows([
        {
          id: newId(),
          code: '',
          shelfId: '',
        },
      ]);
    } else {
      setStandardRows([
        {
          id: newId(),
          equipmentId:
            task.unit.equipmentId ??
            '',
          shelfId:
            task.unit.shelfId ??
            '',
          quantity: 0,
        },
      ]);
    }
  }, [task]);

  if (
    taskQuery.isLoading ||
    !task
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  const busy =
    saveDraft.isPending ||
    submitTask.isPending;

  const scopeShelf =
    shelves.shelves.find(
      (shelf) =>
        shelf.shelfId ===
        task.unit.shelfId,
    );

  function buildObservations():
    CountObservationInput[] {
    if (!task) {
      return [];
    }

    const standard =
      standardRows
        .filter(
          (row) =>
            row.equipmentId &&
            row.quantity >= 0,
        )
        .map(
          (row) => ({
            equipmentId:
              byEquipment
                ? task.unit.equipmentId ??
                  row.equipmentId
                : row.equipmentId,

            observedEquipmentId:
              byShelf
                ? row.equipmentId
                : undefined,

            shelfId:
              byShelf
                ? task.unit.shelfId ??
                  undefined
                : row.shelfId ||
                  undefined,

            observedShelfId:
              byEquipment
                ? row.shelfId ||
                  undefined
                : task.unit.shelfId ??
                  undefined,

            quantityCalculated:
              row.quantity,

            isExplicitZero:
              row.quantity === 0,
          }),
        );

    const serial =
      serialRows
        .filter(
          (row) =>
            row.code.trim(),
        )
        .map(
          (row) => ({
            equipmentId:
              byEquipment
                ? task.unit.equipmentId ??
                  undefined
                : undefined,

            shelfId:
              byShelf
                ? task.unit.shelfId ??
                  undefined
                : row.shelfId ||
                  undefined,

            observedShelfId:
              byEquipment
                ? row.shelfId ||
                  undefined
                : task.unit.shelfId ??
                  undefined,

            scannedSerialCode:
              row.code.trim(),

            quantityCalculated:
              1,
          }),
        );

    return [
      ...standard,
      ...serial,
    ];
  }

  async function persist(
    submit: boolean,
  ) {
    setError(null);

    const observations =
      buildObservations();

    if (
      submit &&
      observations.length === 0
    ) {
      setError(
        'Ajoutez au moins une observation.',
      );
      return;
    }

    try {
      if (submit) {
        await submitTask.mutateAsync({
          taskId,
          data: {
            observations,
          },
        });

        router.push(
          '/inventory/tasks',
        );
      } else {
        await saveDraft.mutateAsync({
          taskId,
          data: {
            isDraft: true,
            observations,
          },
        });
      }
    } catch (
      cause: unknown
    ) {
      setError(
        getErrorMessage(
          cause,
          'Impossible d’enregistrer cette tâche.',
        ),
      );
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <header className="flex items-start gap-3 border-b border-[#3f3a36] pb-4">
          <Link
            href="/inventory/tasks"
            className="rounded border border-[#3f3a36] p-2 text-[#aea69c] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">
                {task.scopeLabel ??
                  `Unité #${task.unit.unitOrder + 1}`}
              </h1>

              <span
                className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                  task.purpose === 'FINAL_RECOUNT'
                    ? 'border-violet-400/30 bg-violet-950/20 text-violet-200'
                    : 'border-sky-400/30 bg-sky-950/20 text-sky-200'
                }`}
              >
                {purposeText(
                  task.purpose,
                )}
              </span>
            </div>

            <p className="mt-1 text-xs text-[#aea69c]">
              {task.unit.inventory.title}
              {' • '}
              Unité #{task.unit.unitOrder + 1}
            </p>
          </div>
        </header>

        {task.purpose ===
          'FINAL_RECOUNT' && (
          <div className="rounded border border-violet-400/25 bg-violet-950/15 p-3 text-xs text-violet-100">
            C1 et C2 ont donné des résultats différents pour cette unité. Votre résultat C3 deviendra le résultat accepté.
          </div>
        )}

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-950/25 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {byShelf && (
          <div className="rounded border border-[#3f3a36] bg-[#2f2a26] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#8c827a]">
              Emplacement contrôlé
            </p>

            <p className="mt-1 text-sm font-semibold">
              {scopeShelf?.shelfName ??
                task.scopeLabel ??
                'Emplacement'}
            </p>
          </div>
        )}

        {(!task.isSerialized ||
          byShelf) && (
          <section className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#2f2a26]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] px-4 py-3">
              <div>
                <h2 className="flex items-center gap-1.5 text-xs font-semibold">
                  <Package className="h-3.5 w-3.5" />
                  Comptage quantitatif
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setStandardRows(
                    (current) => [
                      ...current,
                      {
                        id: newId(),
                        equipmentId:
                          task.unit.equipmentId ??
                          '',
                        shelfId:
                          task.unit.shelfId ??
                          '',
                        quantity: 0,
                      },
                    ],
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </button>
            </div>

            <div className="divide-y divide-[#3f3a36]">
              {standardRows.map(
                (row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_120px_38px]"
                  >
                    {byShelf ? (
                      <select
                        value={
                          row.equipmentId
                        }
                        onChange={(
                          event,
                        ) =>
                          setStandardRows(
                            (current) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        equipmentId:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                        }
                        className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs"
                      >
                        <option value="">
                          Article observé
                        </option>

                        {equipments.equipments.map(
                          (
                            equipment,
                          ) => (
                            <option
                              key={equipment.equipmentId}
                              value={equipment.equipmentId}
                            >
                              {equipment.equipmentName ??
                                'Article'}
                            </option>
                          ),
                        )}
                      </select>
                    ) : (
                      <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                        {task.scopeLabel}
                      </div>
                    )}

                    {byEquipment ? (
                      <select
                        value={
                          row.shelfId
                        }
                        onChange={(
                          event,
                        ) =>
                          setStandardRows(
                            (current) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        shelfId:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                        }
                        className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs"
                      >
                        <option value="">
                          Emplacement observé
                        </option>

                        {shelves.shelves.map(
                          (shelf) => (
                            <option
                              key={shelf.shelfId}
                              value={shelf.shelfId}
                            >
                              {shelf.shelfName ??
                                'Emplacement'}
                            </option>
                          ),
                        )}
                      </select>
                    ) : (
                      <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                        {scopeShelf?.shelfName ??
                          'Emplacement'}
                      </div>
                    )}

                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={
                        row.quantity
                      }
                      onChange={(
                        event,
                      ) =>
                        setStandardRows(
                          (current) =>
                            current.map(
                              (
                                item,
                              ) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      quantity:
                                        Math.max(
                                          0,
                                          Number(
                                            event.target.value,
                                          ) || 0,
                                        ),
                                    }
                                  : item,
                            ),
                        )
                      }
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setStandardRows(
                          (current) =>
                            current.filter(
                              (
                                item,
                              ) =>
                                item.id !== row.id,
                            ),
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        {(task.isSerialized ||
          byShelf) && (
          <section className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#2f2a26]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold">
                <Barcode className="h-3.5 w-3.5" />
                Numéros de série observés
              </h2>

              <button
                type="button"
                onClick={() =>
                  setSerialRows(
                    (current) => [
                      ...current,
                      {
                        id: newId(),
                        code: '',
                        shelfId:
                          task.unit.shelfId ??
                          '',
                      },
                    ],
                  )
                }
                className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
              >
                <Plus className="h-3 w-3" />
                Ajouter
              </button>
            </div>

            <div className="divide-y divide-[#3f3a36]">
              {serialRows.map(
                (row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_38px]"
                  >
                    <input
                      value={row.code}
                      onChange={(
                        event,
                      ) =>
                        setSerialRows(
                          (current) =>
                            current.map(
                              (
                                item,
                              ) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      code:
                                        event.target.value,
                                    }
                                  : item,
                            ),
                        )
                      }
                      placeholder="Code série observé"
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    {byEquipment ? (
                      <select
                        value={row.shelfId}
                        onChange={(
                          event,
                        ) =>
                          setSerialRows(
                            (current) =>
                              current.map(
                                (
                                  item,
                                ) =>
                                  item.id === row.id
                                    ? {
                                        ...item,
                                        shelfId:
                                          event.target.value,
                                      }
                                    : item,
                              ),
                          )
                        }
                        className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs"
                      >
                        <option value="">
                          Emplacement observé
                        </option>

                        {shelves.shelves.map(
                          (shelf) => (
                            <option
                              key={shelf.shelfId}
                              value={shelf.shelfId}
                            >
                              {shelf.shelfName ??
                                'Emplacement'}
                            </option>
                          ),
                        )}
                      </select>
                    ) : (
                      <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                        {scopeShelf?.shelfName ??
                          'Emplacement'}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setSerialRows(
                          (current) =>
                            current.filter(
                              (
                                item,
                              ) =>
                                item.id !== row.id,
                            ),
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ),
              )}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-2 border-t border-[#3f3a36] pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => {
              void persist(false);
            }}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded border border-[#3f3a36] bg-[#383330] px-4 py-2 text-xs disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            Brouillon
          </button>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  'Soumettre définitivement ce comptage ?',
                )
              ) {
                void persist(true);
              }
            }}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
          >
            {submitTask.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Soumettre
          </button>
        </div>
      </div>
    </main>
  );
}
