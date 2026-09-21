'use client';

import {
    ArrowDownToLine,
    ArrowRight,
    ArrowRightLeft,
    ArrowUpFromLine,
    ChevronLeft,
    ChevronRight,
    Eye,
    Loader2,
    Package,
} from 'lucide-react';

import type { Movement } from '@/types/movement';

interface MovementListTableProps {
    movements: Movement[];
    totalMovements: number;
    currentPage: number;
    totalPages: number;
    limit: number;
    isLoading?: boolean;
    isFetching?: boolean;
    onPageChange: (page: number) => void;
    onSelectMovement: (movement: Movement) => void;
}

type MovementWithCreator = Movement & {
    createdByUser?: {
        userId: string;
        userName: string | null;
        userEmail: string | null;
    } | null;
};

function movementType(
    movement: Movement,
): 'IN' | 'OUT' | 'TRANSFER' {
    const status = movement.mouvementStatus?.toUpperCase();

    if (status === 'IN') return 'IN';
    if (status === 'OUT') return 'OUT';

    return 'TRANSFER';
}

function MovementTypeBadge({
    movement,
}: {
    movement: Movement;
}) {
    const type = movementType(movement);

    if (type === 'IN') {
        return (
            <span className="inline-flex items-center gap-1 rounded-[3px] border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                <ArrowDownToLine className="h-3 w-3" />
                ENTRÉE
            </span>
        );
    }

    if (type === 'OUT') {
        return (
            <span className="inline-flex items-center gap-1 rounded-[3px] border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300">
                <ArrowUpFromLine className="h-3 w-3" />
                SORTIE
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 rounded-[3px] border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
            <ArrowRightLeft className="h-3 w-3" />
            TRANSFERT
        </span>
    );
}

function formatDate(value?: string | null) {
    if (!value) return '—';

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('fr-DZ', {
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(parsed);
}

function sourceName(movement: Movement) {
    return movement.sourceShelf?.shelfName ??
        movement.sourceShelfId ??
        '—';
}

function destinationName(movement: Movement) {
    return movement.destinationShelf?.shelfName ??
        movement.destinationShelfId ??
        '—';
}

export function MovementListTable({
    movements,
    totalMovements,
    currentPage,
    totalPages,
    limit,
    isLoading = false,
    isFetching = false,
    onPageChange,
    onSelectMovement,
}: MovementListTableProps) {
    if (isLoading) {
        return (
            <div className="flex min-h-64 items-center justify-center rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
                <div className="flex items-center gap-2 text-xs text-[#aea69c]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Chargement des mouvements...
                </div>
            </div>
        );
    }

    if (!movements.length) {
        return (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] px-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-[4px] border border-[#3f3a36] bg-[#383330]">
                    <ArrowRightLeft className="h-5 w-5 text-[#aea69c]" />
                </div>
                <div>
                    <p className="text-sm font-medium text-[#f7f5f0]">
                        Aucun mouvement
                    </p>
                    <p className="mt-1 text-xs text-[#8c827a]">
                        Aucun document ne correspond aux filtres actuels.
                    </p>
                </div>
            </div>
        );
    }

    const start = (currentPage - 1) * limit + 1;
    const end = Math.min(
        currentPage * limit,
        totalMovements,
    );

    return (
        <div className="overflow-hidden rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse">
                    <thead className="border-b border-[#3f3a36] bg-[#383330]/60">
                        <tr className="text-left text-[10px] uppercase tracking-wider text-[#8c827a]">
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium">Type</th>
                            <th className="px-4 py-3 font-medium">Trajet</th>
                            <th className="px-4 py-3 font-medium">Lignes</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Quantité
                            </th>
                            <th className="px-4 py-3 font-medium">Utilisateur</th>
                            <th className="w-14 px-4 py-3" />
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-[#3f3a36]">
                        {movements.map((movement) => {
                            const typed =
                                movement as MovementWithCreator;

                            return (
                                <tr
                                    key={movement.mouvementId}
                                    onClick={() =>
                                        onSelectMovement(movement)
                                    }
                                    className="cursor-pointer transition-colors hover:bg-[#383330]/55"
                                >
                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#c9c0ad]">
                                        {formatDate(movement.createdAt)}
                                    </td>

                                    <td className="px-4 py-3">
                                        <MovementTypeBadge
                                            movement={movement}
                                        />
                                    </td>

                                    <td className="px-4 py-3">
                                        <div className="flex min-w-52 items-center gap-2 text-xs">
                                            <span className="max-w-32 truncate text-[#c9c0ad]">
                                                {sourceName(movement)}
                                            </span>
                                            <ArrowRight className="h-3 w-3 shrink-0 text-[#5c544d]" />
                                            <span className="max-w-32 truncate text-[#f7f5f0]">
                                                {destinationName(movement)}
                                            </span>
                                        </div>
                                    </td>

                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5 text-xs text-[#c9c0ad]">
                                            <Package className="h-3.5 w-3.5 text-[#8c827a]" />
                                            {movement.items?.length ?? 0}
                                        </span>
                                    </td>

                                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#f7f5f0]">
                                        {movement.mouvementQuantity ?? 0}
                                    </td>

                                    <td className="px-4 py-3 text-xs text-[#aea69c]">
                                        {typed.createdByUser?.userName ??
                                            typed.createdByUser?.userEmail ??
                                            '—'}
                                    </td>

                                    <td className="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onSelectMovement(movement);
                                            }}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#383330] text-[#aea69c] transition-colors hover:text-[#f7f5f0]"
                                            title="Voir le mouvement"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="divide-y divide-[#3f3a36] md:hidden">
                {movements.map((movement) => {
                    const typed =
                        movement as MovementWithCreator;

                    return (
                        <button
                            key={movement.mouvementId}
                            type="button"
                            onClick={() =>
                                onSelectMovement(movement)
                            }
                            className="block w-full p-4 text-left transition-colors hover:bg-[#383330]/55"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <MovementTypeBadge
                                        movement={movement}
                                    />
                                    <p className="mt-2 text-xs text-[#8c827a]">
                                        {formatDate(movement.createdAt)}
                                    </p>
                                </div>

                                <span className="font-mono text-sm font-semibold text-[#f7f5f0]">
                                    {movement.mouvementQuantity ?? 0} u.
                                </span>
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-xs">
                                <span className="truncate text-[#c9c0ad]">
                                    {sourceName(movement)}
                                </span>
                                <ArrowRight className="h-3 w-3 shrink-0 text-[#5c544d]" />
                                <span className="truncate text-[#f7f5f0]">
                                    {destinationName(movement)}
                                </span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[11px] text-[#8c827a]">
                                <span>
                                    {movement.items?.length ?? 0} ligne(s)
                                </span>
                                <span>
                                    {typed.createdByUser?.userName ??
                                        typed.createdByUser?.userEmail ??
                                        '—'}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col gap-3 border-t border-[#3f3a36] bg-[#2b2622]/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-[11px] text-[#8c827a]">
                    {isFetching && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    )}
                    <span>
                        {start}–{end} sur {totalMovements}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        disabled={currentPage <= 1 || isFetching}
                        onClick={() =>
                            onPageChange(
                                Math.max(1, currentPage - 1),
                            )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-2.5 text-xs text-[#c9c0ad] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Précédent
                    </button>

                    <span className="min-w-16 text-center font-mono text-xs text-[#aea69c]">
                        {currentPage} / {Math.max(totalPages, 1)}
                    </span>

                    <button
                        type="button"
                        disabled={
                            currentPage >= totalPages ||
                            isFetching
                        }
                        onClick={() =>
                            onPageChange(
                                Math.min(
                                    totalPages,
                                    currentPage + 1,
                                ),
                            )
                        }
                        className="inline-flex h-8 items-center gap-1 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-2.5 text-xs text-[#c9c0ad] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        Suivant
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
