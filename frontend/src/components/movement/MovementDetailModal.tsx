'use client';

import {
    ArrowDownToLine,
    ArrowRight,
    ArrowRightLeft,
    ArrowUpFromLine,
    Barcode,
    CalendarClock,
    Copy,
    Hash,
    Package,
    UserRound,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Movement } from '@/types/movement';

interface MovementDetailModalProps {
    movement: Movement | null;
    isOpen: boolean;
    onClose: () => void;
}

type MovementWithCreator = Movement & {
    createdByUser?: {
        userId: string;
        userName: string | null;
        userEmail: string | null;
    } | null;
};

function typeOf(
    movement: Movement,
): 'IN' | 'OUT' | 'TRANSFER' {
    const value =
        movement.mouvementStatus?.toUpperCase();

    if (value === 'IN') return 'IN';
    if (value === 'OUT') return 'OUT';

    return 'TRANSFER';
}

function formatDate(value?: string | null) {
    if (!value) return '—';

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat('fr-DZ', {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(parsed);
}

function routeName(
    shelf:
        | {
            shelfId: string;
            shelfName: string | null;
        }
        | null
        | undefined,
    id: string | null,
) {
    return shelf?.shelfName ?? id ?? '—';
}

export function MovementDetailModal({
    movement,
    isOpen,
    onClose,
}: MovementDetailModalProps) {
    if (!isOpen || !movement) return null;

    const typed = movement as MovementWithCreator;
    const type = typeOf(movement);

    const copyMovementId = async () => {
        await navigator.clipboard.writeText(
            movement.mouvementId,
        );

        toast.success('GUID copié');
    };

    const TypeIcon =
        type === 'IN'
            ? ArrowDownToLine
            : type === 'OUT'
                ? ArrowUpFromLine
                : ArrowRightLeft;

    const typeClass =
        type === 'IN'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : type === 'OUT'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-sky-500/30 bg-sky-500/10 text-sky-300';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[6px] border border-[#3f3a36] bg-[#2f2a26] shadow-2xl">
                <div className="flex items-start justify-between border-b border-[#3f3a36] bg-[#383330]/70 px-5 py-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className={`inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[10px] font-semibold ${typeClass}`}
                            >
                                <TypeIcon className="h-3.5 w-3.5" />
                                {type === 'IN'
                                    ? 'ENTRÉE'
                                    : type === 'OUT'
                                        ? 'SORTIE'
                                        : 'TRANSFERT'}
                            </span>

                            <span className="font-mono text-[10px] text-[#8c827a]">
                                {movement.mouvementId}
                            </span>
                        </div>

                        <h2 className="mt-2 text-lg font-medium text-[#f7f5f0]">
                            Détail du mouvement
                        </h2>

                        <p className="mt-1 text-xs text-[#aea69c]">
                            Un document · une direction ·{' '}
                            {movement.items?.length ?? 0} ligne(s)
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#2b2622] text-[#aea69c] transition-colors hover:text-[#f7f5f0]"
                        aria-label="Fermer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[calc(92vh-145px)] overflow-y-auto p-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <InfoCard
                            icon={CalendarClock}
                            label="Date"
                            value={formatDate(movement.createdAt)}
                        />

                        <InfoCard
                            icon={Package}
                            label="Quantité totale"
                            value={`${movement.mouvementQuantity ?? 0} unité(s)`}
                        />

                        <InfoCard
                            icon={Hash}
                            label="Nombre de lignes"
                            value={`${movement.items?.length ?? 0}`}
                        />

                        <InfoCard
                            icon={UserRound}
                            label="Créé par"
                            value={
                                typed.createdByUser?.userName ??
                                typed.createdByUser?.userEmail ??
                                '—'
                            }
                        />
                    </div>

                    <div className="mt-4 rounded-[4px] border border-[#3f3a36] bg-[#2b2622] p-4">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#8c827a]">
                            Trajet commun
                        </p>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <RouteBox
                                label="Source"
                                value={routeName(
                                    movement.sourceShelf,
                                    movement.sourceShelfId,
                                )}
                            />

                            <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-[#5c544d] sm:rotate-0" />

                            <RouteBox
                                label="Destination"
                                value={routeName(
                                    movement.destinationShelf,
                                    movement.destinationShelfId,
                                )}
                            />
                        </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-[4px] border border-[#3f3a36]">
                        <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#383330]/55 px-4 py-3">
                            <div>
                                <h3 className="text-xs font-semibold text-[#f7f5f0]">
                                    Lignes du mouvement
                                </h3>
                                <p className="mt-0.5 text-[10px] text-[#8c827a]">
                                    Toutes les lignes partagent le même type et le même trajet.
                                </p>
                            </div>

                            <span className="font-mono text-xs text-[#aea69c]">
                                {movement.items?.length ?? 0}
                            </span>
                        </div>

                        <div className="divide-y divide-[#3f3a36]">
                            {(movement.items ?? []).map(
                                (item, index) => (
                                    <div
                                        key={
                                            item.mouvementEquipmentId ??
                                            `${item.equipmentId}-${item.serialNumberId ?? index}`
                                        }
                                        className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)_100px] sm:items-center"
                                    >
                                        <div className="flex h-8 w-8 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#383330] font-mono text-[10px] text-[#aea69c]">
                                            {String(index + 1).padStart(
                                                2,
                                                '0',
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-medium text-[#f7f5f0]">
                                                {item.equipment?.equipmentName ??
                                                    item.equipmentId}
                                            </p>
                                            <p className="mt-1 truncate font-mono text-[10px] text-[#6f665f]">
                                                {item.equipmentId}
                                            </p>
                                        </div>

                                        <div className="min-w-0">
                                            {item.serialNumberId ? (
                                                <>
                                                    <p className="flex items-center gap-1.5 truncate text-xs text-[#c9c0ad]">
                                                        <Barcode className="h-3.5 w-3.5 shrink-0 text-[#8c827a]" />
                                                        {item.serialNumber
                                                            ?.serialNumberCode ??
                                                            item.serialNumberId}
                                                    </p>
                                                    <p className="mt-1 truncate font-mono text-[10px] text-[#6f665f]">
                                                        {item.serialNumberId}
                                                    </p>
                                                </>
                                            ) : (
                                                <span className="text-xs text-[#6f665f]">
                                                    Article quantitatif
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-left sm:text-right">
                                            <span className="inline-flex rounded-[3px] border border-[#3f3a36] bg-[#383330] px-2 py-1 font-mono text-xs font-semibold text-[#f7f5f0]">
                                                {item.mouvementQuantity} u.
                                            </span>
                                        </div>
                                    </div>
                                ),
                            )}

                            {!movement.items?.length && (
                                <div className="px-4 py-8 text-center text-xs text-[#8c827a]">
                                    Aucune ligne enregistrée.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#3f3a36] bg-[#2b2622] px-5 py-3">
                    <button
                        type="button"
                        onClick={copyMovementId}
                        className="inline-flex items-center gap-1.5 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-3 py-2 text-xs text-[#c9c0ad] transition-colors hover:text-[#f7f5f0]"
                    >
                        <Copy className="h-3.5 w-3.5" />
                        Copier GUID
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-[3px] bg-[#f7f5f0] px-4 py-2 text-xs font-medium text-[#2b2622] transition-colors hover:bg-[#dad2c1]"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoCard({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Package;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-[4px] border border-[#3f3a36] bg-[#2b2622] p-3">
            <div className="flex items-center gap-2 text-[#8c827a]">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[10px] uppercase tracking-wider">
                    {label}
                </span>
            </div>
            <p className="mt-2 break-words text-xs font-medium text-[#f7f5f0]">
                {value}
            </p>
        </div>
    );
}

function RouteBox({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div className="min-w-0 flex-1 rounded-[3px] border border-[#3f3a36] bg-[#383330]/55 p-3">
            <p className="text-[10px] uppercase tracking-wider text-[#8c827a]">
                {label}
            </p>
            <p className="mt-1 truncate text-xs font-medium text-[#f7f5f0]">
                {value}
            </p>
        </div>
    );
}
