'use client';

import {
  useMemo,
  useState,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';

import {
  UserAutocomplete,
} from '@/components/users/UserAutocomplete';

import {
  SerialNumberTooltip,
} from '@/components/inventory/SerialNumberTooltip';

import {
  useCreateInventory,
} from '@/hooks/use-inventory';

import {
  useEquipments,
} from '@/hooks/use-equipments';

import {
  useShelves,
} from '@/hooks/use-shelves';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import {
  createInventorySchema,
} from '@/schemas/inventory.schema';

import {
  getErrorMessage,
} from '@/lib/error-message';

type InventoryType =
  | 'ByEquipment'
  | 'ByShelf';

export default function CreateInventoryPage() {
  const router = useRouter();
  const permissions = usePermissions();
  const createMutation = useCreateInventory();

  const equipmentQuery =
    useEquipments({
      page: 1,
      limit: 100,
    });

  const shelfQuery =
    useShelves({
      page: 1,
      limit: 100,
    });

  const [title, setTitle] =
    useState('');

  const [
    typeInventory,
    setTypeInventory,
  ] =
    useState<InventoryType>(
      'ByEquipment',
    );

  const [users, setUsers] =
    useState([
      '',
      '',
      '',
    ]);

  const [
    selectedEquipmentIds,
    setSelectedEquipmentIds,
  ] =
    useState<string[]>([]);

  const [
    selectedShelfIds,
    setSelectedShelfIds,
  ] =
    useState<string[]>([]);

  const [search, setSearch] =
    useState('');

  const [error, setError] =
    useState<string | null>(
      null,
    );

  const filteredEquipments =
    useMemo(
      () =>
        equipmentQuery.equipments.filter(
          (equipment) =>
            (
              equipment.equipmentName ??
              ''
            )
              .toLowerCase()
              .includes(
                search
                  .trim()
                  .toLowerCase(),
              ),
        ),
      [
        equipmentQuery.equipments,
        search,
      ],
    );

  const filteredShelves =
    useMemo(
      () =>
        shelfQuery.shelves.filter(
          (shelf) =>
            (
              shelf.shelfName ??
              ''
            )
              .toLowerCase()
              .includes(
                search
                  .trim()
                  .toLowerCase(),
              ),
        ),
      [
        shelfQuery.shelves,
        search,
      ],
    );

  const duplicateUserIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of users) {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const dupes = new Set<string>();
    for (const [id, count] of counts.entries()) {
      if (count > 1) dupes.add(id);
    }
    return dupes;
  }, [users]);

  function addController() {
    setUsers((cur) => [...cur, '']);
  }

  function removeController(index: number) {
    if (users.length <= 3) return;
    setUsers((cur) => cur.filter((_, idx) => idx !== index));
  }

  function moveController(from: number, to: number) {
    if (to < 0 || to >= users.length) return;
    setUsers((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  if (permissions.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (!permissions.canCreateInventory) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#27272a] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
          <h1 className="mt-3 text-sm font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-xs text-[#a1a1aa]">La permission inventory.create est requise.</p>
        </div>
      </main>
    );
  }

  async function submit() {
    setError(null);

    if (
      !permissions.canCreateInventory
    ) {
      setError(
        'Permission inventory.create requise.',
      );
      return;
    }

    const parsed =
      createInventorySchema.safeParse(
        {
          title,
          typeInventory,
          users:
            users.map(
              (userId) => ({
                userId,
              }),
            ),
          equipmentIds:
            typeInventory ===
            'ByEquipment'
              ? selectedEquipmentIds
              : undefined,
          shelfIds:
            typeInventory ===
            'ByShelf'
              ? selectedShelfIds
              : undefined,
        },
      );

    if (!parsed.success) {
      setError(
        parsed.error.issues
          .map(
            (issue) =>
              issue.message,
          )
          .join(' • '),
      );
      return;
    }

    try {
      const created =
        await createMutation.mutateAsync(
          {
            title:
              parsed.data.title,
            typeInventory:
              parsed.data.typeInventory,
            policyVersion: 4,

            users: parsed.data.users.map((u) => ({
              userId: u.userId,
            })),

            equipmentIds:
              parsed.data
                .equipmentIds,

            shelfIds:
              parsed.data
                .shelfIds,
          },
        );

      router.push(
        `/inventory/${created.inventoryId}/report`,
      );
    } catch (
      cause: unknown
    ) {
      setError(
        getErrorMessage(
          cause,
          'Impossible de créer l’inventaire.',
        ),
      );
    }
  }

  function toggle(
    id: string,
  ) {
    if (
      typeInventory ===
      'ByEquipment'
    ) {
      setSelectedEquipmentIds(
        (current) =>
          current.includes(id)
            ? current.filter(
                (value) =>
                  value !== id,
              )
            : [
                ...current,
                id,
              ],
      );

      return;
    }

    setSelectedShelfIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (value) =>
                value !== id,
            )
          : [
              ...current,
              id,
            ],
    );
  }

  const selectedCount =
    typeInventory ===
    'ByEquipment'
      ? selectedEquipmentIds.length
      : selectedShelfIds.length;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 border-b border-[#3f3f46] pb-4">
          <Link
            href="/inventory"
            className="rounded border border-[#3f3f46] p-2 text-[#a1a1aa] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <h1 className="text-xl font-semibold">
              Nouvel inventaire
            </h1>

            <p className="mt-1 text-xs text-[#a1a1aa]">
              Minimum 3 contrôleurs distincts requis. Tous les contrôleurs effectuent un comptage complet et indépendant.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-950/25 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <section className="space-y-4 rounded-lg border border-[#3f3f46] bg-[#27272a] p-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold">
              Titre *
            </span>

            <input
              value={title}
              onChange={(
                event,
              ) =>
                setTitle(
                  event.target
                    .value,
                )
              }
              placeholder="Ex: Inventaire trimestriel atelier"
              className="h-10 w-full rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs outline-none focus:border-white/40"
            />
          </label>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setTypeInventory(
                  'ByEquipment',
                );
                setSearch('');
              }}
              className={`rounded border p-4 text-left ${
                typeInventory ===
                'ByEquipment'
                  ? 'border-[#f4f4f5] bg-[#fafafa] text-[#18181b]'
                  : 'border-[#3f3f46] bg-[#18181b]'
              }`}
            >
              <p className="text-xs font-semibold">
                Par article
              </p>

              <p className="mt-1 text-[10px] opacity-60">
                Une unité de travail par article sélectionné.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                setTypeInventory(
                  'ByShelf',
                );
                setSearch('');
              }}
              className={`rounded border p-4 text-left ${
                typeInventory ===
                'ByShelf'
                  ? 'border-[#f4f4f5] bg-[#fafafa] text-[#18181b]'
                  : 'border-[#3f3f46] bg-[#18181b]'
              }`}
            >
              <p className="text-xs font-semibold">
                Par emplacement
              </p>

              <p className="mt-1 text-[10px] opacity-60">
                Une unité de travail par emplacement sélectionné.
              </p>
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-[#3f3f46] bg-[#27272a] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#d8a868]" />
                <h2 className="text-sm font-semibold">
                  Contrôleurs ({users.length})
                </h2>
              </div>
              <p className="mt-1 text-[10px] text-[#a1a1aa]">
                Minimum 3 contrôleurs distincts requis. Tous les contrôleurs sont égaux et comptent l’intégralité du périmètre.
              </p>
            </div>

            <button
              type="button"
              onClick={addController}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded border border-[#3f3f46] bg-[#18181b] px-3 py-1.5 text-xs font-medium text-white hover:border-[#71717a] transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter un contrôleur
            </button>
          </div>

          <div className="space-y-3">
            {users.map((userId, index) => {
              const isDupe = Boolean(userId && duplicateUserIds.has(userId));
              return (
                <div
                  key={index}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded border ${
                    isDupe
                      ? 'border-rose-500/50 bg-rose-950/15'
                      : 'border-[#3f3f46] bg-[#18181b]/60'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:w-36 shrink-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#27272a] text-[11px] font-mono font-semibold text-[#a1a1aa]">
                      {index + 1}
                    </span>
                    <span className="text-xs font-medium">
                      Contrôleur {index + 1}
                    </span>
                  </div>

                  <div className="flex-1">
                    <UserAutocomplete
                      value={userId}
                      onChange={(newUserId) =>
                        setUsers((cur) =>
                          cur.map((val, idx) => (idx === index ? newUserId : val)),
                        )
                      }
                      placeholder={`Sélectionner le contrôleur ${index + 1}`}
                      error={isDupe ? 'Contrôleur déjà sélectionné' : undefined}
                    />
                    {isDupe && (
                      <p className="mt-1 text-[10px] text-rose-400">
                        Ce contrôleur est sélectionné plusieurs fois.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => moveController(index, index - 1)}
                      disabled={index === 0}
                      title="Monter"
                      className="rounded border border-[#3f3f46] p-1.5 text-[#a1a1aa] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveController(index, index + 1)}
                      disabled={index === users.length - 1}
                      title="Descendre"
                      className="rounded border border-[#3f3f46] p-1.5 text-[#a1a1aa] hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeController(index)}
                      disabled={users.length <= 3}
                      title={users.length <= 3 ? 'Minimum 3 contrôleurs requis' : 'Supprimer'}
                      className="rounded border border-[#3f3f46] p-1.5 text-rose-400 hover:bg-rose-950/20 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-[#3f3f46] bg-[#27272a] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Périmètre
              </h2>

              <p className="mt-1 text-[10px] text-[#a1a1aa]">
                {selectedCount} sélection(s)
              </p>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#71717a]" />

              <input
                value={search}
                onChange={(
                  event,
                ) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Rechercher..."
                className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] pl-9 pr-3 text-xs"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded border border-[#3f3f46]">
            {typeInventory ===
            'ByEquipment' ? (
              filteredEquipments.length ? (
                <div className="divide-y divide-[#3f3f46]">
                  {filteredEquipments.map(
                    (
                      equipment,
                    ) => {
                      const checked =
                        selectedEquipmentIds.includes(
                          equipment.equipmentId,
                        );

                      return (
                        <button
                          type="button"
                          key={
                            equipment.equipmentId
                          }
                          onClick={() =>
                            toggle(
                              equipment.equipmentId,
                            )
                          }
                          className="group flex w-full flex-col px-4 py-3 text-left hover:bg-[#27272a]/45"
                        >
                          <div className="flex w-full items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold">
                                {equipment.equipmentName ??
                                  'Article'}
                              </p>

                              <p className="mt-0.5 text-[9px] text-[#71717a]">
                                {equipment.hasSerialNumber
                                  ? 'Sérialisé'
                                  : 'Standard'}
                                {' • '}
                                {
                                  equipment.equipmentStatus
                                }
                              </p>
                            </div>

                            <SelectionBox
                              checked={
                                checked
                              }
                            />
                          </div>

                          {equipment.hasSerialNumber && (
                            <div className="hidden w-full mt-3 cursor-default rounded-md border border-[#3f3f46] bg-[#27272a] shadow-xl group-hover:block" onClick={(e) => e.stopPropagation()}>
                              <SerialNumberTooltip equipmentId={equipment.equipmentId} />
                            </div>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <Empty />
              )
            ) : filteredShelves.length ? (
              <div className="divide-y divide-[#3f3f46]">
                {filteredShelves.map(
                  (shelf) => {
                    const checked =
                      selectedShelfIds.includes(
                        shelf.shelfId,
                      );

                    return (
                      <button
                        type="button"
                        key={
                          shelf.shelfId
                        }
                        onClick={() =>
                          toggle(
                            shelf.shelfId,
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#27272a]/45"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold">
                              {shelf.shelfName ??
                                'Emplacement'}
                            </p>
                            <span
                              className={`rounded border px-1.5 py-0.5 text-[8px] font-semibold ${
                                shelf.status !== false
                                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                  : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                              }`}
                            >
                              {shelf.status !== false ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>

                          <p className="mt-0.5 text-[9px] text-[#71717a]">
                            {shelf.stock
                              ?.stockName ??
                              'Stock'}
                            {' • '}
                            {shelf.stock
                              ?.status !== false
                                ? 'ACTIVE'
                                : 'INACTIVE'}
                          </p>
                        </div>

                        <SelectionBox
                          checked={
                            checked
                          }
                        />
                      </button>
                    );
                  },
                )}
              </div>
            ) : (
              <Empty />
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Link
            href="/inventory"
            className="rounded border border-[#3f3f46] px-4 py-2 text-xs"
          >
            Annuler
          </Link>

          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={
              createMutation.isPending ||
              !permissions.canCreateInventory
            }
            className="inline-flex items-center gap-2 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40"
          >
            {createMutation.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}

            <ClipboardList className="h-3.5 w-3.5" />
            Créer l’inventaire
          </button>
        </div>
      </div>
    </main>
  );
}

function SelectionBox({
  checked,
}: {
  checked: boolean;
}) {
  return (
    <span
      className={`flex h-5 w-5 items-center justify-center rounded border ${
        checked
          ? 'border-emerald-400 bg-emerald-500 text-white'
          : 'border-[#57504a]'
      }`}
    >
      {checked && (
        <Check className="h-3 w-3" />
      )}
    </span>
  );
}

function Empty() {
  return (
    <div className="px-4 py-10 text-center text-xs text-[#71717a]">
      Aucun élément disponible.
    </div>
  );
}
