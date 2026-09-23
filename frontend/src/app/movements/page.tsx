'use client';

import {
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import {
  SignInButton,
  useAuth,
} from '@clerk/nextjs';
import {
  ArrowRightLeft,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

import {
  useMovements,
} from '@/hooks/use-movements';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import type {
  Movement,
  MovementType,
} from '@/types/movement';

import {
  MovementListTable,
} from '@/components/movement/MovementListTable';

import {
  MovementDetailModal,
} from '@/components/movement/MovementDetailModal';

import {
  CreateMovementModal,
} from '@/components/movement/CreateMovementModal';

export default function MovementsPage() {
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

  const [
    movementType,
    setMovementType,
  ] =
    useState<
      MovementType | ''
    >('');

  const [
    selectedMovement,
    setSelectedMovement,
  ] =
    useState<Movement | null>(
      null,
    );

  const [
    createOpen,
    setCreateOpen,
  ] = useState(false);

  const query =
    useMemo(
      () => ({
        page,
        limit,
        movementType:
          movementType ||
          undefined,
      }),
      [
        page,
        limit,
        movementType,
      ],
    );

  const movementsQuery =
    useMovements(
      query,
      Boolean(
        isLoaded &&
        isSignedIn &&
        !permissions.isLoading &&
        permissions.canReadMovement,
      ),
    );

  if (
    !isLoaded ||
    permissions.isLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs text-[#aea69c]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des mouvements...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-md rounded-lg border border-[#3f3a36] bg-[#383330] p-8 text-center">
          <ArrowRightLeft className="mx-auto h-8 w-8" />

          <h1 className="mt-4 text-base font-semibold">
            Connexion requise
          </h1>

          <p className="mt-2 text-xs text-[#c9c0ad]">
            Connectez-vous pour consulter les mouvements.
          </p>

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
    !permissions.canReadMovement
  ) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#2f2a26] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />

          <h1 className="mt-3 text-sm font-semibold">
            Accès non autorisé
          </h1>

          <p className="mt-2 text-xs text-[#aea69c]">
            La permission movement.read est requise.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
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
                mouvements
              </span>
            </div>

            <h1 className="text-2xl font-normal tracking-tight">
              Mouvements
            </h1>

          </div>

          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={() => {
                void movementsQuery.refetch();
              }}
              disabled={
                movementsQuery.isFetching
              }
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-[#3f3a36] bg-[#383330] text-[#aea69c] disabled:opacity-50"
              title="Actualiser"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${movementsQuery.isFetching
                    ? 'animate-spin'
                    : ''
                  }`}
              />
            </button>
          </div>
        </div>

        <section className="flex flex-col gap-3 rounded border border-[#3f3a36] bg-[#2f2a26] p-4 sm:flex-row sm:items-end">
          <label className="block min-w-52">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#8c827a]">
              Type
            </span>

            <select
              value={
                movementType
              }
              onChange={(
                event,
              ) => {
                setMovementType(
                  event.target
                    .value as
                  | MovementType
                  | '',
                );
                setPage(1);
              }}
              className="h-9 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
            >
              <option value="">
                Tous
              </option>
              <option value="IN">
                Entrées
              </option>
              <option value="OUT">
                Sorties
              </option>
              <option value="TRANSFER">
                Transferts
              </option>
            </select>
          </label>

          <label className="block w-32">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#8c827a]">
              Par page
            </span>

            <select
              value={limit}
              onChange={(
                event,
              ) => {
                setLimit(
                  Number(
                    event.target
                      .value,
                  ),
                );
                setPage(1);
              }}
              className="h-9 w-full rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"
            >
              <option value={10}>
                10
              </option>
              <option value={20}>
                20
              </option>
              <option value={50}>
                50
              </option>
            </select>
          </label>

          {permissions.canCreateMovement && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded bg-[#f7f5f0] px-3 text-xs font-semibold text-[#2b2622] sm:ml-auto sm:mt-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau mouvement
            </button>
          )}
        </section>

        <MovementListTable
          movements={
            movementsQuery.data
              ?.movements ?? []
          }
          totalMovements={
            movementsQuery.data
              ?.totalMovements ?? 0
          }
          currentPage={
            movementsQuery.data
              ?.currentPage ?? page
          }
          totalPages={
            movementsQuery.data
              ?.totalPages ?? 1
          }
          limit={
            movementsQuery.data
              ?.limit ?? limit
          }
          isLoading={
            movementsQuery.isLoading
          }
          isFetching={
            movementsQuery.isFetching
          }
          onPageChange={
            setPage
          }
          onSelectMovement={
            setSelectedMovement
          }
        />
      </div>

      <MovementDetailModal
        movement={
          selectedMovement
        }
        isOpen={
          Boolean(
            selectedMovement,
          )
        }
        onClose={() =>
          setSelectedMovement(
            null,
          )
        }
      />

      <CreateMovementModal
        isOpen={
          createOpen
        }
        onClose={() =>
          setCreateOpen(
            false,
          )
        }
        onSuccess={() => {
          setCreateOpen(
            false,
          );
          void movementsQuery.refetch();
        }}
      />
    </main>
  );
}
