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
  ClipboardList,
  Loader2,
  Search,
} from 'lucide-react';

import {
  UserAutocomplete,
} from '@/components/users/UserAutocomplete';

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

  if (permissions.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
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
            policyVersion: 3,

            users: [
              {
                userId:
                  parsed.data
                    .users[0]
                    .userId,
                responsibility:
                  'PRIMARY_COUNTER_1',
              },
              {
                userId:
                  parsed.data
                    .users[1]
                    .userId,
                responsibility:
                  'PRIMARY_COUNTER_2',
              },
              {
                userId:
                  parsed.data
                    .users[2]
                    .userId,
                responsibility:
                  'FINAL_CONTROLLER',
              },
            ],

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
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 border-b border-[#3f3a36] pb-4">
          <Link
            href="/inventory"
            className="rounded border border-[#3f3a36] p-2 text-[#aea69c] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <h1 className="text-xl font-semibold">
              Nouvel inventaire
            </h1>

            <p className="mt-1 text-xs text-[#aea69c]">
              3 contrôleurs sont préassignés. C3 ne reçoit une tâche que si C1 et C2 diffèrent sur une unité.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded border border-rose-500/30 bg-rose-950/25 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}

        <section className="space-y-4 rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-5">
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
              className="h-10 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs outline-none focus:border-white/40"
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
                  ? 'border-[#dad2c1] bg-[#f7f5f0] text-[#2b2622]'
                  : 'border-[#3f3a36] bg-[#2b2622]'
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
                  ? 'border-[#dad2c1] bg-[#f7f5f0] text-[#2b2622]'
                  : 'border-[#3f3a36] bg-[#2b2622]'
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

        <section className="space-y-4 rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-5">
          <div>
            <h2 className="text-sm font-semibold">
              Contrôleurs
            </h2>

            <p className="mt-1 text-[10px] text-[#aea69c]">
              Ils doivent être trois utilisateurs distincts.
            </p>
          </div>

          {[
            'Contrôleur 1 — C1',
            'Contrôleur 2 — C2',
            'Contrôleur 3 — C3 conditionnel',
          ].map(
            (
              label,
              index,
            ) => (
              <div
                key={label}
                className="space-y-1.5"
              >
                <span className="text-xs font-semibold">
                  {label}
                </span>

                <UserAutocomplete
                  value={
                    users[index]
                  }
                  onChange={(
                    userId,
                  ) =>
                    setUsers(
                      (current) =>
                        current.map(
                          (
                            value,
                            currentIndex,
                          ) =>
                            currentIndex ===
                            index
                              ? userId
                              : value,
                        ),
                    )
                  }
                  placeholder={`Sélectionner ${label.toLowerCase()}`}
                />
              </div>
            ),
          )}
        </section>

        <section className="space-y-4 rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">
                Périmètre
              </h2>

              <p className="mt-1 text-[10px] text-[#aea69c]">
                {selectedCount} sélection(s)
              </p>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8c827a]" />

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
                className="h-9 w-full rounded border border-[#3f3a36] bg-[#2b2622] pl-9 pr-3 text-xs"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto rounded border border-[#3f3a36]">
            {typeInventory ===
            'ByEquipment' ? (
              filteredEquipments.length ? (
                <div className="divide-y divide-[#3f3a36]">
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
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#383330]/45"
                        >
                          <div>
                            <p className="text-xs font-semibold">
                              {equipment.equipmentName ??
                                'Article'}
                            </p>

                            <p className="mt-0.5 text-[9px] text-[#8c827a]">
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
                        </button>
                      );
                    },
                  )}
                </div>
              ) : (
                <Empty />
              )
            ) : filteredShelves.length ? (
              <div className="divide-y divide-[#3f3a36]">
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
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[#383330]/45"
                      >
                        <div>
                          <p className="text-xs font-semibold">
                            {shelf.shelfName ??
                              'Emplacement'}
                          </p>

                          <p className="mt-0.5 text-[9px] text-[#8c827a]">
                            {shelf.stock
                              ?.stockName ??
                              'Stock'}
                            {' • '}
                            {shelf.stock
                              ?.stockStatus
                              ?.stockStatusName ??
                              'ACTIVE'}
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
            className="rounded border border-[#3f3a36] px-4 py-2 text-xs"
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
            className="inline-flex items-center gap-2 rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
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
    <div className="px-4 py-10 text-center text-xs text-[#8c827a]">
      Aucun élément disponible.
    </div>
  );
}
