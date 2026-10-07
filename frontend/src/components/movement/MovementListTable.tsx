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

import type {
  Movement,
} from '@/types/movement';

interface MovementListTableProps {
  movements: Movement[];
  totalMovements: number;
  currentPage: number;
  totalPages: number;
  limit: number;
  isLoading?: boolean;
  isFetching?: boolean;
  onPageChange: (
    page: number,
  ) => void;
  onSelectMovement: (
    movement: Movement,
  ) => void;
}

function movementType(movement: any): 'IN' | 'OUT' | 'TRANSFER' {
  return movement.mouvementStatus ? 'OUT' : 'IN';
}

function typeBadge(
  movement: Movement,
) {
  const type =
    movementType(
      movement,
    );

  if (type === 'IN') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
        <ArrowDownToLine className="h-3 w-3" />
        ENTRÉE
      </span>
    );
  }

  if (type === 'OUT') {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-300">
        <ArrowUpFromLine className="h-3 w-3" />
        SORTIE
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-300">
      <ArrowRightLeft className="h-3 w-3" />
      TRANSFERT
    </span>
  );
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'fr-DZ',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function routeName(
  shelf:
    | {
        shelfName:
          string | null;
      }
    | null
    | undefined,
  externalText: string,
) {
  return (
    shelf?.shelfName ??
    externalText
  );
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
      <div className="flex min-h-64 items-center justify-center rounded border border-[#3f3f46] bg-[#27272a]">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement des mouvements...
        </div>
      </div>
    );
  }

  if (!movements.length) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded border border-[#3f3f46] bg-[#27272a] px-6 text-center">
        <ArrowRightLeft className="h-7 w-7 text-[#a1a1aa]" />

        <div>
          <p className="text-sm font-medium">
            Aucun mouvement
          </p>

          <p className="mt-1 text-xs text-[#71717a]">
            Aucun mouvement ne correspond aux filtres actuels.
          </p>
        </div>
      </div>
    );
  }

  const start =
    (currentPage - 1) *
      limit +
    1;

  const end =
    Math.min(
      currentPage *
        limit,
      totalMovements,
    );

  return (
    <div className="overflow-hidden rounded border border-[#3f3f46] bg-[#27272a]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-[#3f3f46] bg-[#27272a]/60">
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#71717a]">
              <th className="px-4 py-3 font-medium">
                Date d'effet
              </th>
              <th className="px-4 py-3 font-medium">
                Créé le
              </th>
              <th className="px-4 py-3 font-medium">
                Type
              </th>
              <th className="px-4 py-3 font-medium">
                Trajet
              </th>
              <th className="px-4 py-3 font-medium">
                Lignes
              </th>
              <th className="px-4 py-3 text-right font-medium">
                Quantité
              </th>
              <th className="px-4 py-3 font-medium">
                Origine
              </th>
              <th className="w-14 px-4 py-3" />
            </tr>
          </thead>

          <tbody className="divide-y divide-[#3f3f46]">
            {movements.map(
              (movement) => (
                <tr
                  key={
                    movement.mouvementId
                  }
                  onClick={() =>
                    onSelectMovement(
                      movement,
                    )
                  }
                  className="cursor-pointer hover:bg-[#27272a]/55"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#d4d4d8]">
                    {formatDate(
                      movement.happenedAt,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[#71717a]">
                    {formatDate(
                      movement.createdAt,
                    )}
                  </td>

                  <td className="px-4 py-3">
                    {typeBadge(
                      movement,
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex min-w-52 items-center gap-2 text-xs">
                      <span className="max-w-32 truncate text-[#d4d4d8]">
                        {routeName(
                          movement.items?.[0]?.sourceShelf,
                          'Extérieur',
                        )}
                      </span>

                      <ArrowRight className="h-3 w-3 shrink-0 text-[#5c544d]" />

                      <span className="max-w-32 truncate">
                        {routeName(
                          movement.items?.[0]?.destinationShelf,
                          'Extérieur',
                        )}
                      </span>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-[#d4d4d8]">
                      <Package className="h-3.5 w-3.5" />
                      {movement.items
                        ?.length ??
                        0}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                    {(movement.items?.reduce((acc, item) => acc + (item.equipmentQuantity ?? 0), 0) ?? 0) ??
                      0}
                  </td>

                  <td className="px-4 py-3">
                    <span className="text-[10px] text-[#d4d4d8]">
                      {movement.origin === false
                        ? 'Ajustement inventaire'
                        : 'Utilisateur'}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(
                        event,
                      ) => {
                        event.stopPropagation();
                        onSelectMovement(
                          movement,
                        );
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#3f3f46] bg-[#27272a] text-[#a1a1aa] hover:text-white"
                      title="Voir"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#3f3f46] bg-[#27272a]/40 px-4 py-3">
        <span className="text-[10px] text-[#71717a]">
          {start}–{end} sur{' '}
          {totalMovements}
          {isFetching &&
            ' • actualisation...'}
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              currentPage <= 1
            }
            onClick={() =>
              onPageChange(
                currentPage - 1,
              )
            }
            className="rounded border border-[#3f3f46] p-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="text-[10px] text-[#a1a1aa]">
            {currentPage} /{' '}
            {Math.max(
              totalPages,
              1,
            )}
          </span>

          <button
            type="button"
            disabled={
              currentPage >=
              totalPages
            }
            onClick={() =>
              onPageChange(
                currentPage + 1,
              )
            }
            className="rounded border border-[#3f3f46] p-2 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

