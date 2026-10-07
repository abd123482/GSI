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
  ShieldAlert,
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
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-[#fafafa]">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des inventaires...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-md rounded-lg border border-[#3f3f46] bg-[#27272a] p-8 text-center">
          <ClipboardList className="mx-auto h-8 w-8" />

          <h1 className="mt-4 text-base font-semibold">
            Connexion requise
          </h1>

          <div className="mt-5">
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]"
              >
                Se connecter
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  if (!permissions.canReadInventory) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#27272a] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
          <h1 className="mt-3 text-sm font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-xs text-[#a1a1aa]">La permission inventory.read est requise.</p>
        </div>
      </main>
    );
  }

  const inventories =
    inventoriesQuery.data
      ?.inventories ?? [];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-[#fafafa]">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 border-b border-[#3f3f46] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#71717a]">
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
                className="inline-flex items-center gap-2 rounded bg-[#fafafa] px-3.5 py-2 text-xs font-semibold text-[#18181b]"
              >
                <Plus className="h-3.5 w-3.5" />
                Nouvel inventaire
              </Link>
            )}

            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-2 rounded border border-[#3f3f46] bg-[#27272a] px-3.5 py-2 text-xs"
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
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#3f3f46] bg-[#27272a] text-[#a1a1aa] disabled:opacity-40"
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

        <div className="overflow-hidden rounded border border-[#3f3f46] bg-[#27272a]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#3f3f46] bg-[#27272a]/55 text-[10px] uppercase tracking-wider text-[#71717a]">
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

              <tbody className="divide-y divide-[#3f3f46]">
                {inventoriesQuery.isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-[#a1a1aa]"
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
                      className="px-4 py-14 text-center text-[#a1a1aa]"
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
                        className="hover:bg-[#27272a]/40"
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

                        <td className="px-4 py-3 text-[#d4d4d8]">
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
                              className="inline-flex rounded p-2 text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"
                              title="Voir le suivi / rapport"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Link>

                            {permissions.canDeleteInventory && (
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

          <div className="flex flex-col gap-3 border-t border-[#3f3f46] bg-[#27272a]/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] text-[#71717a]">
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
                className="h-8 rounded border border-[#3f3f46] bg-[#18181b] px-2 text-[10px]"
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
                className="rounded border border-[#3f3f46] px-3 py-1.5 text-[10px] disabled:opacity-30"
              >
                Préc.
              </button>

              <span className="text-[10px] text-[#a1a1aa]">
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
                className="rounded border border-[#3f3f46] px-3 py-1.5 text-[10px] disabled:opacity-30"
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
