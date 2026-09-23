/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import {
  useEffect,
  useMemo,
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
  Warehouse,
} from 'lucide-react';

import {
  useInventoryTask,
  useSaveInventoryTaskDraft,
  useSubmitInventoryTask,
} from '@/hooks/use-inventory';

import {
  useEquipments,
  useEquipmentAllocations,
} from '@/hooks/use-equipments';

import {
  useShelves,
} from '@/hooks/use-shelves';

import {
  SerialCodeInput,
} from '@/components/inventory/SerialCodeInput';

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
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const taskQuery = useInventoryTask(taskId);
  const saveDraft = useSaveInventoryTaskDraft();
  const submitTask = useSubmitInventoryTask();

  const equipments = useEquipments({
    page: 1,
    limit: 100,
  });

  const shelves = useShelves({
    page: 1,
    limit: 100,
  });

  const allocations = useEquipmentAllocations(
    taskQuery.data?.unit.equipmentId ?? '',
    taskQuery.data?.unit.inventory.typeInventory === 'ByEquipment'
  );

  const task = taskQuery.data;

  const byEquipment =
    task?.unit.inventory.typeInventory === 'ByEquipment';

  const byShelf =
    task?.unit.inventory.typeInventory === 'ByShelf';

  const expectedShelves = useMemo(() => {
    if (task?.expectedShelves && task.expectedShelves.length > 0) {
      return task.expectedShelves;
    }
    return (
      allocations.data?.equipmentShelfs?.map((a) => ({
        shelfId: a.shelfId,
        shelfName: a.shelf?.shelfName ?? 'Emplacement',
        quantity: a.equipmentQuantity,
      })) ?? []
    );
  }, [task?.expectedShelves, allocations.data?.equipmentShelfs]);

  const [standardRows, setStandardRows] = useState<StandardRow[]>([]);
  const [serialRows, setSerialRows] = useState<SerialRow[]>([]);
  const [selectedAdditionalShelves, setSelectedAdditionalShelves] = useState<string[]>([]);
  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [shelfToAdd, setShelfToAdd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task) {
      return;
    }

    if (task.draftData) {
      try {
        const parsed = JSON.parse(task.draftData) as {
          observations?: CountObservationInput[];
        };

        const standard: StandardRow[] = [];
        const serial: SerialRow[] = [];
        const extraShelves: string[] = [];

        for (const observation of parsed.observations ?? []) {
          const sId = observation.observedShelfId ?? observation.shelfId ?? '';
          if (sId && !expectedShelves.some((e) => e.shelfId === sId)) {
            extraShelves.push(sId);
          }

          if (observation.scannedSerialCode) {
            serial.push({
              id: newId(),
              code: observation.scannedSerialCode,
              shelfId: sId,
            });
          } else {
            standard.push({
              id: newId(),
              equipmentId:
                observation.observedEquipmentId ?? observation.equipmentId ?? '',
              shelfId: sId,
              quantity: observation.quantityCalculated ?? 0,
            });
          }
        }

        setStandardRows(standard);
        setSerialRows(serial);
        if (extraShelves.length > 0) {
          setSelectedAdditionalShelves((cur) =>
            Array.from(new Set([...cur, ...extraShelves]))
          );
        }
        return;
      } catch {
        // Fall back to clean state
      }
    }

    if (byEquipment) {
      if (task.isSerialized) {
        setSerialRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({
              id: newId(),
              code: '',
              shelfId: s.shelfId,
            }));
          }
          return [];
        });
      } else {
        setStandardRows((current) => {
          if (current.length > 0) return current;
          if (expectedShelves.length > 0) {
            return expectedShelves.map((s) => ({
              id: newId(),
              equipmentId: task.unit.equipmentId ?? '',
              shelfId: s.shelfId,
              quantity: 0,
            }));
          }
          return [];
        });
      }
    } else {
      if (task.isSerialized) {
        setSerialRows((current) =>
          current.length > 0
            ? current
            : [
                {
                  id: newId(),
                  code: '',
                  shelfId: task.unit.shelfId ?? '',
                },
              ]
        );
      } else {
        setStandardRows((current) =>
          current.length > 0
            ? current
            : [
                {
                  id: newId(),
                  equipmentId: '',
                  shelfId: task.unit.shelfId ?? '',
                  quantity: 0,
                },
              ]
        );
      }
    }
  }, [task, byEquipment, expectedShelves]);

  if (taskQuery.isLoading || !task) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  const busy = saveDraft.isPending || submitTask.isPending;

  const scopeShelf = shelves.shelves.find(
    (shelf) => shelf.shelfId === task.unit.shelfId,
  );

  const scopeEquipment = equipments.equipments.find(
    (equipment) => equipment.equipmentId === task.unit.equipmentId,
  );

  function buildObservations(): CountObservationInput[] {
    if (!task) {
      return [];
    }

    const standard = standardRows
      .filter((row) => (byEquipment ? row.shelfId : row.equipmentId))
      .map((row) => ({
        equipmentId: byEquipment
          ? task.unit.equipmentId ?? row.equipmentId
          : row.equipmentId,
        observedEquipmentId: byShelf ? row.equipmentId : undefined,
        shelfId: byShelf ? task.unit.shelfId ?? undefined : row.shelfId || undefined,
        observedShelfId: byEquipment ? row.shelfId || undefined : task.unit.shelfId ?? undefined,
        quantityCalculated: row.quantity,
        isExplicitZero: row.quantity === 0,
      }));

    const serial = serialRows
      .filter((row) => row.code.trim())
      .map((row) => ({
        equipmentId: byEquipment ? task.unit.equipmentId ?? undefined : undefined,
        shelfId: byShelf ? task.unit.shelfId ?? undefined : row.shelfId || undefined,
        observedShelfId: byEquipment ? row.shelfId || undefined : task.unit.shelfId ?? undefined,
        scannedSerialCode: row.code.trim(),
        quantityCalculated: 1,
      }));

    return [...standard, ...serial];
  }

  async function persist(submit: boolean) {
    setError(null);
    const observations = buildObservations();

    if (submit && observations.length === 0) {
      setError('Ajoutez au moins une observation ou vérification.');
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

        router.push('/inventory/tasks');
      } else {
        await saveDraft.mutateAsync({
          taskId,
          data: {
            isDraft: true,
            observations,
          },
        });
      }
    } catch (cause: unknown) {
      setError(
        getErrorMessage(
          cause,
          'Impossible d’enregistrer cette tâche.',
        ),
      );
    }
  }

  const renderedShelfIds = Array.from(
    new Set([
      ...expectedShelves.map((a) => a.shelfId),
      ...standardRows.map((r) => r.shelfId).filter(Boolean),
      ...serialRows.map((r) => r.shelfId).filter(Boolean),
      ...selectedAdditionalShelves,
    ])
  );

  function addSerialRow(shelfId: string = '') {
    setSerialRows((current) => [
      ...current,
      {
        id: newId(),
        code: '',
        shelfId,
      },
    ]);
  }

  function addStandardRow(shelfId: string = '') {
    setStandardRows((current) => [
      ...current,
      {
        id: newId(),
        equipmentId: task?.unit.equipmentId ?? '',
        shelfId,
        quantity: 0,
      },
    ]);
  }

  function removeAdditionalShelf(shelfId: string) {
    setSelectedAdditionalShelves((cur) => cur.filter((id) => id !== shelfId));
    setStandardRows((cur) => cur.filter((r) => r.shelfId !== shelfId));
    setSerialRows((cur) => cur.filter((r) => r.shelfId !== shelfId));
  }

  function confirmAddShelf() {
    if (!shelfToAdd) return;
    setSelectedAdditionalShelves((cur) => Array.from(new Set([...cur, shelfToAdd])));
    if (task?.isSerialized) {
      setSerialRows((cur) => [
        ...cur,
        { id: newId(), code: '', shelfId: shelfToAdd },
      ]);
    } else {
      setStandardRows((cur) => {
        if (cur.some((r) => r.shelfId === shelfToAdd)) return cur;
        return [
          ...cur,
          {
            id: newId(),
            equipmentId: task?.unit.equipmentId ?? '',
            shelfId: shelfToAdd,
            quantity: 0,
          },
        ];
      });
    }
    setShelfToAdd('');
    setIsAddingShelf(false);
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
                {task.scopeLabel ?? `Unité #${task.unit.unitOrder + 1}`}
              </h1>

              <span
                className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                  task.purpose === 'FINAL_RECOUNT'
                    ? 'border-violet-400/30 bg-violet-950/20 text-violet-200'
                    : 'border-sky-400/30 bg-sky-950/20 text-sky-200'
                }`}
              >
                {purposeText(task.purpose)}
              </span>
            </div>

            <p className="mt-1 text-xs text-[#aea69c]">
              {task.unit.inventory.title}
              {' • '}
              Unité #{task.unit.unitOrder + 1}
            </p>
          </div>
        </header>

        {task.purpose === 'FINAL_RECOUNT' && (
          <div className="rounded border border-violet-400/25 bg-violet-950/15 p-3 text-xs text-violet-100">
            C1 et C2 ont donné des résultats différents pour cette unité. Votre résultat C3 deviendra le résultat accepté.
          </div>
        )}

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-950/25 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {byEquipment && (
          <div className="rounded border border-[#3f3a36] bg-[#2f2a26] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#8c827a]">
              Article contrôlé
            </p>

            <p className="mt-1 text-sm font-semibold">
              {scopeEquipment?.equipmentName ??
                task.scopeLabel ??
                'Article'}
            </p>

            {expectedShelves.length > 0 && (
              <div className="mt-3 border-t border-[#3f3a36] pt-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-[#8c827a]">
                  Emplacements attendus ({expectedShelves.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {expectedShelves.map((allocation) => (
                    <span
                      key={allocation.shelfId}
                      className="inline-flex items-center rounded border border-[#3f3a36] bg-[#1f1b18] px-2 py-0.5 text-[10px] text-emerald-100"
                    >
                      {allocation.shelfName} ({allocation.quantity ?? 0})
                    </span>
                  ))}
                </div>
              </div>
            )}
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

        {/* SECTION COMPTAGE QUANTITATIF (NON-SERIALISÉ) */}
        {!task.isSerialized && (
          <section className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#2f2a26]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold">
                <Package className="h-3.5 w-3.5" />
                Comptage quantitatif par emplacement
              </h2>
              {byShelf && (
                <button
                  type="button"
                  onClick={() => addStandardRow(task.unit.shelfId ?? '')}
                  className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              )}
            </div>

            <div className="divide-y divide-[#3f3a36]">
              {byEquipment ? (
                <div className="p-4 space-y-4">
                  {renderedShelfIds.length === 0 ? (
                    <div className="rounded border border-[#3f3a36] bg-[#26221f] p-4 text-center text-xs text-white/50">
                      Aucun emplacement attendu pour cet article. Utilisez le bouton ci-dessous pour ajouter un emplacement.
                    </div>
                  ) : (
                    renderedShelfIds.map((shelfId) => {
                      const shelf = shelves.shelves.find((s) => s.shelfId === shelfId);
                      const expected = expectedShelves.find((a) => a.shelfId === shelfId);
                      const isAdditional = !expected;
                      const row = standardRows.find((r) => r.shelfId === shelfId);

                      return (
                        <div
                          key={shelfId}
                          className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#26221f]"
                        >
                          <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#1f1b18] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4 text-amber-400" />
                              <h3 className="text-sm font-semibold text-white">
                                {expected?.shelfName ?? shelf?.shelfName ?? 'Emplacement'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {expected ? (
                                <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                  Attendu : {expected.quantity ?? 0}
                                </span>
                              ) : (
                                <span className="rounded border border-amber-500/20 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                                  Emplacement supplémentaire
                                </span>
                              )}
                              {isAdditional && (
                                <button
                                  type="button"
                                  onClick={() => removeAdditionalShelf(shelfId)}
                                  title="Retirer cet emplacement supplémentaire"
                                  className="ml-1 rounded p-1 text-white/40 transition hover:bg-rose-950/30 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <label className="text-xs text-white/70">
                                Quantité comptée dans cet emplacement :
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={row?.quantity ?? 0}
                                  onChange={(event) => {
                                    const val = Math.max(0, Number(event.target.value) || 0);
                                    setStandardRows((current) => {
                                      const exists = current.some((r) => r.shelfId === shelfId);
                                      if (exists) {
                                        return current.map((r) =>
                                          r.shelfId === shelfId ? { ...r, quantity: val } : r
                                        );
                                      }
                                      return [
                                        ...current,
                                        {
                                          id: newId(),
                                          equipmentId: task.unit.equipmentId ?? '',
                                          shelfId,
                                          quantity: val,
                                        },
                                      ];
                                    });
                                  }}
                                  className="h-10 w-28 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-sm font-semibold text-white focus:border-amber-500 focus:outline-none"
                                />
                                <span className="text-xs text-white/50">unités</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* BOUTON EN BAS POUR AJOUTER UN EMPLACEMENT */}
                  <div className="pt-2">
                    {!isAddingShelf ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#4a423a] bg-[#26221f]/50 p-6 text-center">
                        <p className="mb-3 text-xs text-white/60">
                          Vous avez trouvé cet article dans un autre emplacement ?
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAddingShelf(true)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#4a423a] bg-[#1f1b18] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:border-amber-500/50 hover:bg-[#2c2724] hover:text-amber-300"
                        >
                          <Plus className="h-4 w-4 text-amber-400" />
                          Ajouter un autre emplacement
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[#4a423a] bg-[#26221f] p-5 shadow-lg">
                        <h4 className="mb-1 text-xs font-semibold text-white">Ajouter un autre emplacement</h4>
                        <p className="mb-3 text-[11px] text-white/50">
                          Sélectionnez l&apos;emplacement supplémentaire où vous observez cet article.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={shelfToAdd}
                            onChange={(e) => setShelfToAdd(e.target.value)}
                            className="h-10 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Sélectionnez l&apos;emplacement...</option>
                            {shelves.shelves
                              .filter((s) => !renderedShelfIds.includes(s.shelfId))
                              .map((s) => (
                                <option key={s.shelfId} value={s.shelfId}>
                                  {s.shelfName}
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!shelfToAdd}
                              onClick={confirmAddShelf}
                              className="h-10 rounded bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingShelf(false);
                                setShelfToAdd('');
                              }}
                              className="h-10 rounded border border-[#3f3a36] px-3 text-xs text-white/70 hover:bg-white/5"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                standardRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_120px_38px]"
                  >
                    <select
                      value={row.equipmentId}
                      onChange={(event) =>
                        setStandardRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, equipmentId: event.target.value }
                              : item
                          )
                        )
                      }
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs"
                    >
                      <option value="">Sélectionnez un article</option>
                      {equipments.equipments.map((equipment) => (
                        <option key={equipment.equipmentId} value={equipment.equipmentId}>
                          {equipment.equipmentName}
                        </option>
                      ))}
                    </select>

                    <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                      {scopeShelf?.shelfName ?? 'Emplacement'}
                    </div>

                    <input
                      type="number"
                      min={0}
                      value={row.quantity}
                      onChange={(event) =>
                        setStandardRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  quantity: Math.max(0, Number(event.target.value) || 0),
                                }
                              : item
                          )
                        )
                      }
                      className="h-9 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setStandardRows((current) =>
                          current.filter((item) => item.id !== row.id)
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* SECTION NUMÉROS DE SÉRIE (SERIALISÉ) */}
        {task.isSerialized && (
          <section className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#2f2a26]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] px-4 py-3">
              <h2 className="flex items-center gap-1.5 text-xs font-semibold">
                <Barcode className="h-3.5 w-3.5" />
                Numéros de série observés par emplacement
              </h2>
              {byShelf && (
                <button
                  type="button"
                  onClick={() => addSerialRow(task.unit.shelfId ?? '')}
                  className="inline-flex items-center gap-1 rounded border border-[#3f3a36] px-2 py-1 text-[10px]"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              )}
            </div>

            <div className="divide-y divide-[#3f3a36]">
              {byEquipment ? (
                <div className="p-4 space-y-4">
                  {renderedShelfIds.length === 0 ? (
                    <div className="rounded border border-[#3f3a36] bg-[#26221f] p-4 text-center text-xs text-white/50">
                      Aucun emplacement attendu pour cet article. Utilisez le bouton ci-dessous pour ajouter un emplacement.
                    </div>
                  ) : (
                    renderedShelfIds.map((shelfId) => {
                      const shelf = shelves.shelves.find((s) => s.shelfId === shelfId);
                      const expected = expectedShelves.find((a) => a.shelfId === shelfId);
                      const isAdditional = !expected;
                      const rowsInShelf = serialRows.filter((r) => r.shelfId === shelfId);
                      const scannedCount = rowsInShelf.filter((r) => r.code.trim()).length;

                      return (
                        <div
                          key={shelfId}
                          className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#26221f]"
                        >
                          <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#1f1b18] px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Warehouse className="h-4 w-4 text-amber-400" />
                              <h3 className="text-sm font-semibold text-white">
                                {expected?.shelfName ?? shelf?.shelfName ?? 'Emplacement'}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              {expected ? (
                                <span className="rounded border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                                  Attendu : {expected.quantity ?? 0}
                                </span>
                              ) : (
                                <span className="rounded border border-amber-500/20 bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                                  Emplacement supplémentaire
                                </span>
                              )}
                              <span
                                className={`rounded border px-2 py-0.5 text-xs font-medium ${
                                  expected && scannedCount === expected.quantity
                                    ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'
                                    : 'border-white/10 bg-white/5 text-white/70'
                                }`}
                              >
                                Observé : {scannedCount}
                              </span>
                              {isAdditional && (
                                <button
                                  type="button"
                                  onClick={() => removeAdditionalShelf(shelfId)}
                                  title="Retirer cet emplacement supplémentaire"
                                  className="ml-1 rounded p-1 text-white/40 transition hover:bg-rose-950/30 hover:text-rose-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="p-4 space-y-3">
                            {rowsInShelf.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-4 text-center">
                                <p className="mb-2 text-xs text-white/40">
                                  Aucun numéro de série saisi pour cet emplacement.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => addSerialRow(shelfId)}
                                  className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-white/5"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Saisir un code série
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-2">
                                  {rowsInShelf.map((row, idx) => (
                                    <div key={row.id} className="flex items-center gap-2">
                                      <span className="w-6 text-right font-mono text-[11px] text-white/40">
                                        {idx + 1}.
                                      </span>
                                      <SerialCodeInput
                                        value={row.code}
                                        onChange={(value) =>
                                          setSerialRows((current) =>
                                            current.map((item) =>
                                              item.id === row.id ? { ...item, code: value } : item
                                            )
                                          )
                                        }
                                        placeholder="Code série observé (ex: SN-...)"
                                        className="h-9 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSerialRows((current) =>
                                            current.filter((item) => item.id !== row.id)
                                          )
                                        }
                                        title="Supprimer ce numéro"
                                        className="flex h-9 w-9 items-center justify-center rounded text-rose-400 transition hover:bg-rose-950/30"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2">
                                  <button
                                    type="button"
                                    onClick={() => addSerialRow(shelfId)}
                                    className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/5 hover:text-white"
                                  >
                                    <Plus className="h-3.5 w-3.5 text-amber-400" />
                                    Ajouter un autre numéro de série
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* BOUTON EN BAS POUR AJOUTER UN EMPLACEMENT */}
                  <div className="pt-2">
                    {!isAddingShelf ? (
                      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#4a423a] bg-[#26221f]/50 p-6 text-center">
                        <p className="mb-3 text-xs text-white/60">
                          Vous avez trouvé un numéro de série dans un autre emplacement ?
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAddingShelf(true)}
                          className="inline-flex items-center gap-2 rounded-lg border border-[#4a423a] bg-[#1f1b18] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:border-amber-500/50 hover:bg-[#2c2724] hover:text-amber-300"
                        >
                          <Plus className="h-4 w-4 text-amber-400" />
                          Ajouter un autre emplacement
                        </button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-[#4a423a] bg-[#26221f] p-5 shadow-lg">
                        <h4 className="mb-1 text-xs font-semibold text-white">Ajouter un autre emplacement</h4>
                        <p className="mb-3 text-[11px] text-white/50">
                          Sélectionnez l&apos;emplacement supplémentaire où vous observez des numéros de série de cet article.
                        </p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <select
                            value={shelfToAdd}
                            onChange={(e) => setShelfToAdd(e.target.value)}
                            className="h-10 flex-1 rounded border border-[#3f3a36] bg-[#1f1b18] px-3 text-xs text-white focus:border-amber-500 focus:outline-none"
                          >
                            <option value="">Sélectionnez l&apos;emplacement...</option>
                            {shelves.shelves
                              .filter((s) => !renderedShelfIds.includes(s.shelfId))
                              .map((s) => (
                                <option key={s.shelfId} value={s.shelfId}>
                                  {s.shelfName}
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={!shelfToAdd}
                              onClick={confirmAddShelf}
                              className="h-10 rounded bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40"
                            >
                              Ajouter
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingShelf(false);
                                setShelfToAdd('');
                              }}
                              className="h-10 rounded border border-[#3f3a36] px-3 text-xs text-white/70 hover:bg-white/5"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                serialRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-[1fr_1fr_38px]"
                  >
                    <SerialCodeInput
                      value={row.code}
                      onChange={(value) =>
                        setSerialRows((current) =>
                          current.map((item) =>
                            item.id === row.id
                              ? { ...item, code: value }
                              : item
                          )
                        )
                      }
                      placeholder="Code série observé"
                      className="h-9 w-full rounded border border-[#3f3a36] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <div className="flex h-9 items-center rounded border border-[#3f3a36] bg-[#383330]/50 px-3 text-xs">
                      {scopeShelf?.shelfName ?? 'Emplacement'}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSerialRows((current) =>
                          current.filter((item) => item.id !== row.id)
                        )
                      }
                      className="inline-flex h-9 w-9 items-center justify-center rounded text-rose-300 hover:bg-rose-950/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
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
