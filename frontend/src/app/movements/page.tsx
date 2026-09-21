'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SignInButton, useAuth } from '@clerk/nextjs';
import {
    ArrowRightLeft,
    Cpu,
    Loader2,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
} from 'lucide-react';

import {
    useMovements,
    type MovementTypeV3,
} from '@/hooks/use-movements';
import { usePermissions } from '@/hooks/use-permissions';
import type { Movement } from '@/types/movement';
import { MovementListTable } from '@/components/movement/MovementListTable';
import { MovementDetailModal } from '@/components/movement/MovementDetailModal';

export default function MovementsPage() {
    const { isLoaded, isSignedIn } = useAuth();
    const {
        isAdmin,
        hasPermission,
        isLoading: isPermissionsLoading,
    } = usePermissions();

    const canReadMovement =
        isAdmin || hasPermission('movement.read');

    const canCreateMovement =
        isAdmin || hasPermission('movement.create');

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [movementType, setMovementType] =
        useState<MovementTypeV3 | ''>('');

    const [selectedMovement, setSelectedMovement] =
        useState<Movement | null>(null);

    const query = useMemo(
        () => ({
            page,
            limit,
            movementType:
                movementType || undefined,
        }),
        [page, limit, movementType],
    );

    const movementsQuery = useMovements(
        query,
        Boolean(
            isLoaded &&
            isSignedIn &&
            !isPermissionsLoading &&
            canReadMovement,
        ),
    );

    if (!isLoaded || isPermissionsLoading) {
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
                <div className="w-full max-w-md rounded-[4px] border border-[#3f3a36] bg-[#383330] p-8 text-center shadow-xl">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#2b2622]">
                        <ArrowRightLeft className="h-5 w-5" />
                    </div>

                    <h1 className="mt-4 text-base font-medium">
                        Connexion requise
                    </h1>

                    <p className="mt-2 text-xs text-[#c9c0ad]">
                        Connectez-vous pour consulter les mouvements de stock.
                    </p>

                    <div className="mt-5">
                        <SignInButton mode="modal">
                            <button
                                type="button"
                                className="w-full rounded-[3px] bg-[#f7f5f0] px-4 py-2 text-xs font-medium text-[#2b2622] hover:bg-[#dad2c1]"
                            >
                                Se connecter
                            </button>
                        </SignInButton>
                    </div>
                </div>
            </main>
        );
    }

    if (!canReadMovement) {
        return (
            <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
                <div className="w-full max-w-lg rounded-[4px] border border-amber-500/25 bg-[#2f2a26] p-7 text-center">
                    <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
                    <h1 className="mt-3 text-sm font-semibold">
                        Accès aux mouvements non autorisé
                    </h1>
                    <p className="mt-2 text-xs text-[#aea69c]">
                        La permission{' '}
                        <code className="text-amber-300">
                            movement.read
                        </code>{' '}
                        est requise.
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
                                className="hover:text-[#f7f5f0]"
                            >
                                somepharm
                            </Link>
                            <span>/</span>
                            <span className="text-[#f7f5f0]">
                                mouvements
                            </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl font-normal tracking-tight sm:text-2xl">
                                Mouvements de stock
                            </h1>

                            <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#3f3a36] bg-[#383330] px-2 py-0.5 font-mono text-[10px] text-[#c9c0ad]">
                                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                                V3
                            </span>
                        </div>

                        <p className="mt-1 text-xs text-[#aea69c]">
                            Un mouvement possède un type et un trajet communs à toutes ses lignes.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {canCreateMovement && (
                            <Link
                                href="/equipment"
                                className="inline-flex items-center gap-2 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-3 py-2 text-xs font-medium text-[#f7f5f0] transition-colors hover:bg-[#3f3a36]"
                                title="Ouvrir la page Articles pour créer un mouvement"
                            >
                                <Cpu className="h-3.5 w-3.5 text-[#aea69c]" />
                                Nouveau mouvement
                            </Link>
                        )}

                        <button
                            type="button"
                            onClick={() =>
                                movementsQuery.refetch()
                            }
                            disabled={
                                movementsQuery.isFetching
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#383330] text-[#aea69c] transition-colors hover:text-[#f7f5f0] disabled:opacity-50"
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

                <section className="flex flex-col gap-3 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] p-4 sm:flex-row sm:items-end">
                    <label className="block min-w-52">
                        <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[#8c827a]">
                            Type
                        </span>

                        <select
                            value={movementType}
                            onChange={(event) => {
                                setMovementType(
                                    event.target.value as
                                    | MovementTypeV3
                                    | '',
                                );
                                setPage(1);
                            }}
                            className="h-9 w-full rounded-[3px] border border-[#3f3a36] bg-[#2b2622] px-3 text-xs text-[#f7f5f0] outline-none focus:border-[#aea69c]"
                        >
                            <option value="">
                                Tous les mouvements
                            </option>
                            <option value="IN">Entrées</option>
                            <option value="OUT">Sorties</option>
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
                            onChange={(event) => {
                                setLimit(
                                    Number(event.target.value),
                                );
                                setPage(1);
                            }}
                            className="h-9 w-full rounded-[3px] border border-[#3f3a36] bg-[#2b2622] px-3 text-xs text-[#f7f5f0] outline-none focus:border-[#aea69c]"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </label>

                    <div className="sm:ml-auto">
                        <p className="text-xs text-[#8c827a]">
                            Total :{' '}
                            <span className="font-mono font-semibold text-[#f7f5f0]">
                                {movementsQuery.data?.totalMovements ??
                                    0}
                            </span>
                        </p>
                    </div>
                </section>

                {movementsQuery.isError ? (
                    <div className="rounded-[4px] border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
                        Impossible de charger les mouvements.
                        <button
                            type="button"
                            onClick={() =>
                                movementsQuery.refetch()
                            }
                            className="ml-2 underline"
                        >
                            Réessayer
                        </button>
                    </div>
                ) : (
                    <MovementListTable
                        movements={
                            movementsQuery.data?.movements ??
                            []
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
                            movementsQuery.data?.totalPages ??
                            1
                        }
                        limit={
                            movementsQuery.data?.limit ??
                            limit
                        }
                        isLoading={
                            movementsQuery.isLoading
                        }
                        isFetching={
                            movementsQuery.isFetching
                        }
                        onPageChange={setPage}
                        onSelectMovement={
                            setSelectedMovement
                        }
                    />
                )}
            </div>

            <MovementDetailModal
                movement={selectedMovement}
                isOpen={Boolean(selectedMovement)}
                onClose={() =>
                    setSelectedMovement(null)
                }
            />
        </main>
    );
}
