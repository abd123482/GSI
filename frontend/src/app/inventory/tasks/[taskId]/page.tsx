'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  useInventoryTask,
  useSaveInventoryTaskDraft,
  useSubmitInventoryTask,
} from '@/hooks/use-inventory';
import { useEquipments } from '@/hooks/use-equipments';
import { useShelves } from '@/hooks/use-shelves';
import { SerialCodeInput } from '@/components/inventory/SerialCodeInput';
import type { CountObservationInput } from '@/types/inventory';
import { getErrorMessage } from '@/lib/error-message';

interface TaskRow {
  id: string;
  equipmentId: string;
  shelfId: string;
  quantity: number;
  code: string;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function InventoryTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params?.taskId as string;

  const taskQuery = useInventoryTask(taskId);
  const saveDraft = useSaveInventoryTaskDraft();
  const submitTask = useSubmitInventoryTask();

  const equipmentsQuery = useEquipments({ page: 1, limit: 500 });
  const shelvesQuery = useShelves({ page: 1, limit: 500 });

  const task = taskQuery.data;
  const isSubmitted = Boolean(task?.status === 'SUBMITTED' || task?.submittedAt);

  const byEquipment = task?.unit?.inventory?.typeInventory === 'ByEquipment';
  const byShelf = task?.unit?.inventory?.typeInventory === 'ByShelf';

  const [rows, setRows] = useState<TaskRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);

  // Load from draftData on initial load
  useEffect(() => {
    if (!task) return;

    if (task.draftData) {
      try {
        const parsed = JSON.parse(task.draftData) as {
          observations?: CountObservationInput[];
        };

        const initialRows: TaskRow[] = [];

        for (const obs of parsed.observations ?? []) {
          const sId = obs.observedShelfId ?? obs.shelfId ?? '';
          const eId = obs.observedEquipmentId ?? obs.equipmentId ?? '';

          if (obs.scannedSerialCode) {
            initialRows.push({
              id: newId(),
              equipmentId: eId || (task.unit.equipmentId ?? ''),
              shelfId: sId || (task.unit.shelfId ?? ''),
              quantity: 1,
              code: obs.scannedSerialCode,
            });
          } else {
            initialRows.push({
              id: newId(),
              equipmentId: eId || (task.unit.equipmentId ?? ''),
              shelfId: sId || (task.unit.shelfId ?? ''),
              quantity: obs.quantityCalculated ?? 0,
              code: '',
            });
          }
        }

        setRows(initialRows);
        setIsSaved(true);
        return;
      } catch {
        // Fall back to clean state
      }
    }

    // Default row if none exists
    if (byEquipment && task.unit.equipmentId) {
      if (task.isSerialized) {
        setRows([
          {
            id: newId(),
            equipmentId: task.unit.equipmentId,
            shelfId: '',
            quantity: 1,
            code: '',
          },
        ]);
      } else {
        setRows([
          {
            id: newId(),
            equipmentId: task.unit.equipmentId,
            shelfId: '',
            quantity: 0,
            code: '',
          },
        ]);
      }
    } else if (byShelf && task.unit.shelfId) {
      setRows([]);
    }
  }, [task, byEquipment, byShelf]);

  const busy = saveDraft.isPending || submitTask.isPending;

  const scopeEquipment = equipmentsQuery.equipments.find(
    (e) => e.equipmentId === task?.unit.equipmentId,
  );
  const scopeShelf = shelvesQuery.shelves.find(
    (s) => s.shelfId === task?.unit.shelfId,
  );

  function buildObservations(): CountObservationInput[] {
    if (!task) return [];

    const currentShelfId = task.unit.shelfId ?? undefined;
    const currentEquipmentId = task.unit.equipmentId ?? undefined;

    const observations: CountObservationInput[] = [];

    for (const row of rows) {
      const eqId = byEquipment ? currentEquipmentId : row.equipmentId;
      const shId = byShelf ? currentShelfId : (row.shelfId || undefined);

      if (!eqId || !shId) continue;

      const eq = equipmentsQuery.equipments.find((e) => e.equipmentId === eqId);
      const isSerializedItem = Boolean(eq?.hasSerialNumber || (byEquipment && task.isSerialized));

      if (isSerializedItem) {
        if (row.code.trim()) {
          observations.push({
            equipmentId: eqId,
            observedEquipmentId: eqId,
            shelfId: shId,
            observedShelfId: shId,
            scannedSerialCode: row.code.trim(),
            quantityCalculated: 1,
          });
        }
      } else {
        observations.push({
          equipmentId: eqId,
          observedEquipmentId: eqId,
          shelfId: shId,
          observedShelfId: shId,
          quantityCalculated: Math.max(0, Math.floor(row.quantity)),
          isExplicitZero: row.quantity === 0,
        });
      }
    }

    return observations;
  }

  async function persist(submit: boolean, confirmEmpty: boolean = false) {
    setError(null);
    const observations = confirmEmpty ? [] : buildObservations();

    if (submit && !confirmEmpty) {
      if (byShelf) {
        const incompleteRows = rows.some((r) => {
          if (!r.equipmentId) return true;
          const eq = equipmentsQuery.equipments.find((e) => e.equipmentId === r.equipmentId);
          if (eq?.hasSerialNumber && !r.code.trim()) return true;
          return false;
        });

        if (incompleteRows) {
          setError(
            'Veuillez renseigner tous les articles sélectionnés et saisir le numéro de série pour les articles sérialisés.',
          );
          return;
        }
      } else if (byEquipment) {
        const incompleteRows = rows.some((r) => {
          if (!r.shelfId) return true;
          if (task?.isSerialized && !r.code.trim()) return true;
          return false;
        });

        if (incompleteRows) {
          setError(
            task?.isSerialized
              ? 'Veuillez renseigner le numéro de série et l’emplacement pour chaque ligne.'
              : 'Veuillez sélectionner un emplacement pour chaque ligne.',
          );
          return;
        }
      }

      if (observations.length === 0) {
        setError(
          'Veuillez saisir au moins une observation ou confirmer explicitement un comptage vide (0 article).'
        );
        return;
      }
    }

    try {
      if (submit) {
        await submitTask.mutateAsync({
          taskId,
          data: {
            observations,
            isDraft: false,
          },
        });
        router.push('/inventory/tasks');
      } else {
        await saveDraft.mutateAsync({
          taskId,
          data: {
            observations,
            isDraft: true,
          },
        });
        setIsSaved(true);
      }
    } catch (cause: unknown) {
      setError(getErrorMessage(cause, 'Impossible d’enregistrer cette tâche.'));
    }
  }

  if (taskQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-white">
        <Loader2 className="h-5 w-5 animate-spin text-[#d8a868]" />
      </main>
    );
  }

  if (taskQuery.isError || !task) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#18181b] p-6 text-white space-y-4">
        <p className="text-rose-400">Erreur lors du chargement de la tâche ou accès refusé.</p>
        <Link href="/inventory/tasks" className="text-sm underline text-[#a1a1aa] hover:text-white">
          Retour aux tâches
        </Link>
      </main>
    );
  }

  if (task.status === 'WAITING_PREVIOUS' || task.isReady === false) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#18181b] p-6 text-white space-y-4">
        <div className="flex flex-col items-center max-w-md rounded-lg border border-amber-500/30 bg-amber-950/20 p-6 text-center space-y-3">
          <Clock className="h-8 w-8 text-amber-400" />
          <h2 className="text-base font-semibold text-amber-200">Unité en attente du contrôleur précédent</h2>
          <p className="text-xs text-amber-300/80">
            Cette unité ({task.scopeLabel ?? `Unité #${task.unit.unitOrder + 1}`}) n&apos;est pas encore disponible. Le contrôleur précédent doit terminer son comptage sur cette unité.
            Vous recevrez une notification dès qu&apos;elle sera prête.
          </p>
          <Link
            href="/inventory/tasks"
            className="mt-2 inline-flex items-center gap-1.5 rounded bg-amber-500 px-4 py-2 text-xs font-semibold text-zinc-950 hover:bg-amber-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour à mes tâches
          </Link>
        </div>
      </main>
    );
  }

  const controllerSequence = (task.sequence ?? 0) + 1;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {/* En-tête */}
        <header className="flex flex-col gap-4 border-b border-[#3f3f46] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/inventory/tasks"
              className="rounded border border-[#3f3f46] p-2 text-[#a1a1aa] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {task.scopeLabel ?? `Unité #${task.unit.unitOrder + 1}`}
                </h1>

                <span className="rounded border border-sky-400/30 bg-sky-950/20 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                  Contrôleur {controllerSequence}
                </span>

                {isSubmitted ? (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-950/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Soumis
                  </span>
                ) : isSaved ? (
                  <span className="inline-flex items-center gap-1 rounded border border-[#3f3f46] bg-[#27272a] px-2 py-0.5 text-[10px] text-[#a1a1aa]">
                    <ShieldCheck className="h-3 w-3 text-emerald-400" />
                    Brouillon à jour
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-300">
                    <Clock className="h-3 w-3" />
                    Modifications non enregistrées
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#a1a1aa]">
                {task.unit.inventory.title} • Tour {task.unit.inventory.roundNumber ?? 1} • Unité #{task.unit.unitOrder + 1}
              </p>
            </div>
          </div>

          <div className="text-xs text-[#a1a1aa] bg-[#27272a] px-3 py-1.5 rounded border border-[#3f3f46]">
            Comptage à l’aveugle strict • Comptez uniquement ce que vous observez physiquement
          </div>
        </header>

        {isSubmitted && (
          <div className="rounded border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>
              Ce comptage a été validé et soumis définitivement. Les observations ci-dessous sont enregistrées et immuables.
            </span>
          </div>
        )}

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-950/25 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Détails du périmètre */}
        {byEquipment && (
          <div className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#71717a]">Article à inventorier</p>
            <p className="mt-1 text-base font-semibold text-white">
              {scopeEquipment?.equipmentName ?? task.scopeLabel ?? 'Article'}
            </p>
            <p className="mt-1 text-xs text-[#a1a1aa]">
              {task.isSerialized
                ? 'Cet article comporte des numéros de série. Scannez ou saisissez chaque numéro de série observé et son emplacement.'
                : 'Article standard : indiquez la quantité observée pour chaque emplacement où cet article est présent.'}
            </p>
          </div>
        )}

        {byShelf && (
          <div className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4">
            <p className="text-[10px] uppercase tracking-wider text-[#71717a]">Emplacement à inventorier</p>
            <p className="mt-1 text-base font-semibold text-white">
              {scopeShelf?.shelfName ?? task.scopeLabel ?? 'Emplacement'}
            </p>
            <p className="mt-1 text-xs text-[#a1a1aa]">
              Indiquez l’intégralité des articles (standard et avec numéro de série) physiquement observés dans cet emplacement.
            </p>
          </div>
        )}

        {/* SECTION UNIQUE POUR INVENTAIRE PAR EMPLACEMENT (ALL IN ONE) */}
        {byShelf && (
          <section className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#27272a]">
            <div className="flex items-center justify-between border-b border-[#3f3f46] px-4 py-3 bg-[#27272a]/70">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#d8a868]" />
                <div>
                  <h2 className="text-xs font-semibold">
                    Articles observés sur cet emplacement
                  </h2>
                  <p className="text-[11px] text-[#a1a1aa]">
                    Consignez tous les articles (standard ou avec numéro de série) présents sur cet emplacement
                  </p>
                </div>
              </div>

              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => {
                    const lastRow = rows[rows.length - 1];
                    const lastEq = lastRow
                      ? equipmentsQuery.equipments.find((e) => e.equipmentId === lastRow.equipmentId)
                      : null;
                    const defaultEqId = lastEq?.hasSerialNumber ? lastRow.equipmentId : '';

                    setRows((cur) => [
                      ...cur,
                      {
                        id: newId(),
                        equipmentId: defaultEqId,
                        shelfId: task.unit.shelfId ?? '',
                        quantity: 1,
                        code: '',
                      },
                    ]);
                    setIsSaved(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-[#d8a868] px-3 py-1.5 text-xs font-medium text-[#18181b] hover:bg-[#e0b479] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un article
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-[#3f3f46] p-8 text-center text-xs text-[#71717a]">
                  <Package className="h-8 w-8 text-[#52525b]" />
                  <p className="text-sm font-medium text-[#d4d4d8]">
                    Aucun article consigné pour cet emplacement
                  </p>
                  <p className="max-w-md text-xs text-[#71717a]">
                    Ajoutez chaque article présent sur cet emplacement. Pour les articles standard, indiquez la quantité observée. Pour les articles sérialisés, saisissez ou scannez le numéro de série.
                  </p>
                  {!isSubmitted && (
                    <button
                      type="button"
                      onClick={() => {
                        setRows([
                          {
                            id: newId(),
                            equipmentId: '',
                            shelfId: task.unit.shelfId ?? '',
                            quantity: 1,
                            code: '',
                          },
                        ]);
                        setIsSaved(false);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-medium text-[#d8a868] hover:border-[#d8a868] hover:text-[#d8a868] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter un premier article
                    </button>
                  )}
                </div>
              ) : (
                rows.map((row, idx) => {
                  const selectedEq = equipmentsQuery.equipments.find(
                    (e) => e.equipmentId === row.equipmentId,
                  );
                  const isSerialized = Boolean(selectedEq?.hasSerialNumber);

                  return (
                    <div
                      key={row.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-[#3f3f46] bg-[#18181b]/50 transition-colors hover:border-[#52525b]"
                    >
                      <span className="w-6 text-right font-mono text-[11px] text-[#71717a] hidden sm:block">
                        {idx + 1}.
                      </span>

                      {/* Sélecteur d'article */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] uppercase tracking-wider text-[#71717a]">
                            Article observé
                          </label>
                          {selectedEq && (
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                isSerialized
                                  ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {isSerialized ? 'Sérialisé' : 'Standard'}
                            </span>
                          )}
                        </div>
                        <select
                          disabled={isSubmitted || equipmentsQuery.isLoading}
                          value={row.equipmentId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRows((cur) =>
                              cur.map((item) =>
                                item.id === row.id
                                  ? { ...item, equipmentId: val, code: '', quantity: 1 }
                                  : item,
                              ),
                            );
                            setIsSaved(false);
                          }}
                          className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                        >
                          <option value="">
                            {equipmentsQuery.isLoading
                              ? 'Chargement des articles...'
                              : equipmentsQuery.isError
                                ? 'Erreur de chargement des articles'
                                : equipmentsQuery.equipments.length === 0
                                  ? 'Aucun article trouvé'
                                  : 'Sélectionnez un article...'}
                          </option>
                          <optgroup label="Articles standard">
                            {equipmentsQuery.equipments
                              .filter((e) => !e.hasSerialNumber)
                              .map((e) => (
                                <option key={e.equipmentId} value={e.equipmentId}>
                                  {e.equipmentName}
                                </option>
                              ))}
                          </optgroup>
                          <optgroup label="Articles avec numéro de série">
                            {equipmentsQuery.equipments
                              .filter((e) => e.hasSerialNumber)
                              .map((e) => (
                                <option key={e.equipmentId} value={e.equipmentId}>
                                  {e.equipmentName} (Sérialisé)
                                </option>
                              ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Saisie quantité ou code série */}
                      <div className="w-full sm:w-64">
                        {isSerialized ? (
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                              Numéro de série
                            </label>
                            <SerialCodeInput
                              value={row.code}
                              onChange={(value) => {
                                setRows((cur) =>
                                  cur.map((item) =>
                                    item.id === row.id ? { ...item, code: value } : item,
                                  ),
                                );
                                setIsSaved(false);
                              }}
                              placeholder="Code série (ex: SN-...)"
                              className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 font-mono text-xs text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                            />
                          </div>
                        ) : selectedEq ? (
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                              Quantité observée
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={1}
                              disabled={isSubmitted}
                              value={row.quantity}
                              onChange={(e) => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                setRows((cur) =>
                                  cur.map((item) =>
                                    item.id === row.id ? { ...item, quantity: val } : item,
                                  ),
                                );
                                setIsSaved(false);
                              }}
                              className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs font-mono text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                              Détail
                            </label>
                            <div className="flex h-9 items-center rounded border border-dashed border-[#3f3f46] bg-[#18181b]/30 px-3 text-[11px] text-[#71717a]">
                              Sélectionnez d’abord un article
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Supprimer */}
                      {!isSubmitted && (
                        <div className="self-end sm:self-center pt-2 sm:pt-4">
                          <button
                            type="button"
                            onClick={() => {
                              setRows((cur) => cur.filter((item) => item.id !== row.id));
                              setIsSaved(false);
                            }}
                            className="rounded p-2 text-rose-400 hover:bg-rose-950/20 transition-colors"
                            title="Supprimer cette ligne"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* SECTION INVENTAIRE PAR ARTICLE (BY EQUIPMENT) */}
        {byEquipment && (
          <section className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#27272a]">
            <div className="flex items-center justify-between border-b border-[#3f3f46] px-4 py-3 bg-[#27272a]/70">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#d8a868]" />
                <div>
                  <h2 className="text-xs font-semibold">
                    {task.isSerialized ? 'Numéros de série observés' : 'Comptage quantitatif par emplacement'}
                  </h2>
                  <p className="text-[11px] text-[#a1a1aa]">
                    {task.isSerialized
                      ? 'Scannez ou saisissez chaque numéro de série et son emplacement'
                      : 'Indiquez la quantité observée pour chaque emplacement où cet article est présent'}
                  </p>
                </div>
              </div>

              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => {
                    setRows((cur) => [
                      ...cur,
                      {
                        id: newId(),
                        equipmentId: task.unit.equipmentId ?? '',
                        shelfId: '',
                        quantity: task.isSerialized ? 1 : 0,
                        code: '',
                      },
                    ]);
                    setIsSaved(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded bg-[#d8a868] px-3 py-1.5 text-xs font-medium text-[#18181b] hover:bg-[#e0b479] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {task.isSerialized ? 'Ajouter une série' : 'Ajouter un emplacement'}
                </button>
              )}
            </div>

            <div className="p-4 space-y-3">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded border border-dashed border-[#3f3f46] p-8 text-center text-xs text-[#71717a]">
                  <p className="text-sm font-medium text-[#d4d4d8]">
                    {task.isSerialized ? 'Aucun numéro de série consigné' : 'Aucun emplacement consigné'}
                  </p>
                  {!isSubmitted && (
                    <button
                      type="button"
                      onClick={() => {
                        setRows([
                          {
                            id: newId(),
                            equipmentId: task.unit.equipmentId ?? '',
                            shelfId: '',
                            quantity: task.isSerialized ? 1 : 0,
                            code: '',
                          },
                        ]);
                        setIsSaved(false);
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 rounded border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-medium text-[#d8a868] hover:border-[#d8a868] hover:text-[#d8a868]"
                    >
                      <Plus className="h-3 w-3" />
                      {task.isSerialized ? 'Ajouter une première série' : 'Ajouter un premier emplacement'}
                    </button>
                  )}
                </div>
              ) : (
                rows.map((row, idx) => (
                  <div
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-[#3f3f46] bg-[#18181b]/50"
                  >
                    <span className="w-6 text-right font-mono text-[11px] text-[#71717a] hidden sm:block">
                      {idx + 1}.
                    </span>

                    {task.isSerialized ? (
                      <>
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                            Code série scanné / saisi
                          </label>
                          <SerialCodeInput
                            value={row.code}
                            onChange={(value) => {
                              setRows((cur) =>
                                cur.map((item) =>
                                  item.id === row.id ? { ...item, code: value } : item,
                                ),
                              );
                              setIsSaved(false);
                            }}
                            placeholder="Code série observé (ex: SN-...)"
                            className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 font-mono text-xs text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                          />
                        </div>

                        <div className="w-full sm:w-56">
                          <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                            Emplacement observé
                          </label>
                          <select
                            disabled={isSubmitted}
                            value={row.shelfId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((cur) =>
                                cur.map((item) =>
                                  item.id === row.id ? { ...item, shelfId: val } : item,
                                ),
                              );
                              setIsSaved(false);
                            }}
                            className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                          >
                            <option value="">Sélectionnez un emplacement...</option>
                            {shelvesQuery.shelves.map((s) => (
                              <option key={s.shelfId} value={s.shelfId}>
                                {s.shelfName}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1">
                          <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                            Emplacement observé
                          </label>
                          <select
                            disabled={isSubmitted}
                            value={row.shelfId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRows((cur) =>
                                cur.map((item) =>
                                  item.id === row.id ? { ...item, shelfId: val } : item,
                                ),
                              );
                              setIsSaved(false);
                            }}
                            className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                          >
                            <option value="">Sélectionnez un emplacement...</option>
                            {shelvesQuery.shelves.map((s) => (
                              <option key={s.shelfId} value={s.shelfId}>
                                {s.shelfName}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-44">
                          <label className="block text-[10px] uppercase tracking-wider text-[#71717a] mb-1">
                            Quantité observée
                          </label>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            disabled={isSubmitted}
                            value={row.quantity}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setRows((cur) =>
                                cur.map((item) =>
                                  item.id === row.id ? { ...item, quantity: val } : item,
                                ),
                              );
                              setIsSaved(false);
                            }}
                            className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs font-mono text-white focus:border-[#d8a868] focus:outline-none disabled:opacity-60"
                          />
                        </div>
                      </>
                    )}

                    {!isSubmitted && (
                      <div className="self-end sm:self-center pt-2 sm:pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setRows((cur) => cur.filter((item) => item.id !== row.id));
                            setIsSaved(false);
                          }}
                          className="rounded p-2 text-rose-400 hover:bg-rose-950/20 transition-colors"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Barre d'action */}
        {!isSubmitted ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[#3f3f46] pt-4">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    'Confirmez-vous avoir inspecté cette unité et constaté qu’AUCUN article (0) n’est présent physiquement ?'
                  )
                ) {
                  void persist(true, true);
                }
              }}
              disabled={busy}
              className="inline-flex items-center justify-center gap-1.5 rounded border border-rose-500/40 bg-rose-950/20 px-3.5 py-2 text-xs font-medium text-rose-300 hover:bg-rose-950/40 disabled:opacity-40 transition-colors"
            >
              Confirmer 0 article (comptage vide)
            </button>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => void persist(false)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded border border-[#3f3f46] bg-[#27272a] px-4 py-2 text-xs text-white hover:border-[#71717a] disabled:opacity-40 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Enregistrer brouillon
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Voulez-vous soumettre définitivement votre comptage pour cette unité ?')) {
                    void persist(true, false);
                  }
                }}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] hover:bg-white disabled:opacity-40 transition-colors"
              >
                {submitTask.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Soumettre mon comptage
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end border-t border-[#3f3f46] pt-4">
            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-2 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]"
            >
              Retour à la liste des tâches
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
