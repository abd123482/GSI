'use client';

import {
  useState,
} from 'react';
import {
  SignInButton,
  useAuth,
} from '@clerk/nextjs';
import Link from 'next/link';
import {
  ClipboardList,
  Eye,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';

import {
  useDeleteInventory,
  useInventories,
  useLaunchInventory,
} from '@/hooks/use-inventory';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import type {
  InventoryStatus,
} from '@/types/inventory';

function statusClass(
  status: InventoryStatus,
) {
  switch (status) {
    case 'DRAFT':
      return 'border-slate-400/25 bg-slate-500/10 text-slate-200';
    case 'IN_PROGRESS':
      return 'border-sky-400/25 bg-sky-500/10 text-sky-200';
    case 'COMPLETED':
      return 'border-amber-400/25 bg-amber-500/10 text-amber-200';
    case 'FINALIZED':
      return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200';
    default:
      return 'border-rose-400/25 bg-rose-500/10 text-rose-200';
  }
}

export default function InventoryPage() {
  const {
    isLoaded,
    isSignedIn,
  } = useAuth();

  const permissions =
    usePermissions();

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    limit,
    setLimit,
  ] = useState(20);

  const inventoriesQuery =
    useInventories(
      page,
      limit,
    );

  const launchMutation =
    useLaunchInventory();

  const deleteMutation =
    useDeleteInventory();

  if (
    !isLoaded ||
    permissions.isLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs text-[#aea69c]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des inventaires...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-md rounded-lg border border-[#3f3a36] bg-[#383330] p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8" />

          <h1 className="mt-4 text-base font-semibold">
            Connexion requise
          </h1>

          <div className="mt-5">
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622]"
              >
                Se connecter
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  if (
    !permissions.canReadInventory
  ) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="rounded border border-amber-400/25 bg-[#2f2a26] p-6 text-sm">
          Permission inventory.read requise.
        </div>
      </main>
    );
  }

  const inventories =
    inventoriesQuery.data
      ?.inventories ?? [];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-[#3f3a36] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#8c827a]">
              <Link
                href="/"
                className="hover:text-white"
              >
                somepharm
              </Link>

              <span>/</span>

              <span className="text-white">
                inventaires
              </span>
            </div>

            <h1 className="text-2xl font-normal tracking-tight">
              Inventaires
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {permissions.canCreateInventory && (
              <Link
                href="/inventory/create"
                className="inline-flex items-center gap-2 rounded bg-[#f7f5f0] px-3.5 py-2 text-xs font-semibold text-[#2b2622]"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvel inventaire
              </Link>
            )}

            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-2 rounded border border-[#3f3a36] bg-[#383330] px-3.5 py-2 text-xs"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Mes tâches
            </Link>

            <button
              type="button"
              onClick={() => {
                void inventoriesQuery.refetch();
              }}
              disabled={
                inventoriesQuery.isFetching
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#3f3a36] bg-[#383330] text-[#aea69c] disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${inventoriesQuery.isFetching
                    ? 'animate-spin'
                    : ''
                  }`}
              />
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded border border-[#3f3a36] bg-[#2f2a26]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#3f3a36] bg-[#383330]/55 text-[10px] uppercase tracking-wider text-[#8c827a]">
                <tr>
                  <th className="px-4 py-3">
                    Inventaire
                  </th>
                  <th className="px-4 py-3">
                    Type
                  </th>
                  <th className="px-4 py-3">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-center">
                    Unités
                  </th>
                  <th className="px-4 py-3 text-center">
                    Problèmes
                  </th>
                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#3f3a36]">
                {inventoriesQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-[#aea69c]"
                    >
                      <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
                      Chargement...
                    </td>
                  </tr>
                ) : inventories.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-[#aea69c]"
                    >
                      Aucun inventaire.
                    </td>
                  </tr>
                ) : (
                  inventories.map(
                    (inventory) => (
                      <tr
                        key={
                          inventory.inventoryId
                        }
                        className="hover:bg-[#383330]/40"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold">
                              {
                                inventory.title
                              }
                            </p>

                            <p className="mt-0.5 text-[9px] text-white/35">
                              Politique v
                              {inventory.policyVersion ??
                                3}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-[#c9c0ad]">
                          {inventory.typeInventory ===
                            'ByEquipment'
                            ? 'Par article'
                            : 'Par emplacement'}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`rounded border px-2 py-1 text-[10px] font-semibold ${statusClass(
                              inventory.status,
                            )}`}
                          >
                            {
                              inventory.status
                            }
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center font-mono">
                          {inventory.workUnits
                            ?.length ??
                            0}
                        </td>

                        <td className="px-4 py-3 text-center font-mono">
                          {inventory._count
                            ?.investigationIssues ??
                            0}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {inventory.status ===
                              'DRAFT' &&
                              permissions.canLaunchInventory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void launchMutation.mutateAsync(
                                      inventory.inventoryId,
                                    );
                                  }}
                                  disabled={
                                    launchMutation.isPending
                                  }
                                  className="rounded p-2 text-emerald-300 hover:bg-emerald-950/20"
                                  title="Lancer"
                                >
                                  <PlayCircle className="h-3.5 w-3.5" />
                                </button>
                              )}

                            <Link
                              href={`/inventory/${inventory.inventoryId}/report`}
                              className="inline-flex rounded p-2 text-[#aea69c] hover:bg-[#383330] hover:text-white"
                              title="Voir le suivi / rapport"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>

                            {inventory.status ===
                              'DRAFT' &&
                              permissions.canDeleteInventory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Supprimer l'inventaire "${inventory.title}" ?`,
                                      )
                                    ) {
                                      void deleteMutation.mutateAsync(
                                        inventory.inventoryId,
                                      );
                                    }
                                  }}
                                  disabled={
                                    deleteMutation.isPending
                                  }
                                  className="rounded p-2 text-rose-300 hover:bg-rose-950/20"
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#3f3a36] bg-[#383330]/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-[#8c827a]">
              {inventoriesQuery.data
                ?.totalInventories ??
                0}{' '}
              inventaire(s)
            </p>

            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(
                  event,
                ) => {
                  setLimit(
                    Number(
                      event.target.value,
                    ),
                  );
                  setPage(1);
                }}
                className="h-8 rounded border border-[#3f3a36] bg-[#2b2622] px-2 text-[10px]"
              >
                <option value={10}>
                  10 / page
                </option>
                <option value={20}>
                  20 / page
                </option>
                <option value={50}>
                  50 / page
                </option>
              </select>

              <button
                type="button"
                disabled={
                  page <= 1
                }
                onClick={() =>
                  setPage(
                    page - 1,
                  )
                }
                className="rounded border border-[#3f3a36] px-3 py-1.5 text-[10px] disabled:opacity-30"
              >
                Préc.
              </button>

              <span className="text-[10px] text-[#aea69c]">
                {page} /{' '}
                {Math.max(
                  inventoriesQuery.data
                    ?.totalPages ??
                  1,
                  1,
                )}
              </span>

              <button
                type="button"
                disabled={
                  page >=
                  (
                    inventoriesQuery.data
                      ?.totalPages ??
                    1
                  )
                }
                onClick={() =>
                  setPage(
                    page + 1,
                  )
                }
                className="rounded border border-[#3f3a36] px-3 py-1.5 text-[10px] disabled:opacity-30"
              >
                Suiv.
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
