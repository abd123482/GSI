'use client';

import { useMemo } from 'react';
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Eye,
  Hash,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Warehouse,
} from 'lucide-react';

import type { Shelf } from '@/types/shelf';

interface ShelfListTableProps {
  shelves: Shelf[];
  totalShelves: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSelectShelf: (shelf: Shelf) => void;
  onOpenUpdate?: (shelf: Shelf) => void;
  onOpenDelete?: (shelf: Shelf) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  canCreateShelf: boolean;
  canUpdateShelf?: boolean;
  canDeleteShelf?: boolean;
}

export function ShelfListTable({
  shelves,
  totalShelves,
  totalPages,
  currentPage,
  limit,
  searchTerm,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onSelectShelf,
  onOpenUpdate,
  onOpenDelete,
  isLoading,
  onRefresh,
  onOpenCreateModal,
  canCreateShelf,
  canUpdateShelf = true,
  canDeleteShelf = true,
}: ShelfListTableProps) {
  const startItem = totalShelves === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalShelves);

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
  }, [currentPage, totalPages]);

  return (
    <div className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#383330]">
      <div className="flex flex-col gap-3 border-b border-[#3f3a36] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aea69c]" />
          <input
            value={searchTerm}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher par nom d’emplacement..."
            className="h-9 w-full rounded border border-[#3f3a36] bg-[#2b2622] pl-9 pr-3 text-xs text-[#f7f5f0] outline-none placeholder:text-[#aea69c] focus:border-[#dad2c1]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-9 rounded border border-[#3f3a36] bg-[#2b2622] px-2 text-xs text-[#f7f5f0]"
          >
            <option value={6}>6 / page</option>
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>

          <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex h-9 items-center gap-1.5 rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs text-[#dad2c1] disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>

          {canCreateShelf && (
            <button type="button" onClick={onOpenCreateModal} className="inline-flex h-9 items-center gap-1.5 rounded bg-[#f7f5f0] px-3 text-xs font-semibold text-[#2b2622]">
              <Plus className="h-3.5 w-3.5" />Nouvel emplacement
            </button>
          )}
        </div>
      </div>

      <div className="p-4">
        {isLoading && shelves.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-[#aea69c]">
            <RefreshCw className="h-4 w-4 animate-spin" />Chargement des emplacements...
          </div>
        ) : shelves.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#4b4540] bg-[#2b2622]/45 p-6 text-center">
            <Boxes className="h-7 w-7 text-[#aea69c]" />
            <p className="text-sm font-medium text-[#f7f5f0]">Aucun emplacement disponible</p>
            <p className="text-xs text-[#aea69c]">{searchTerm ? 'Aucun emplacement ne correspond à cette recherche.' : 'Créez un emplacement dans un stock ACTIVE.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shelves.map((shelf, index) => {
              const globalIndex = (currentPage - 1) * limit + index + 1;
              const stockStatus = shelf.stock?.stockStatus?.stockStatusName ?? 'ACTIVE';

              return (
                <article key={shelf.shelfId} className="group overflow-hidden rounded-lg border border-[#45403c] bg-[#2b2622] transition hover:border-[#6b625b]">
                  <button type="button" onClick={() => onSelectShelf(shelf)} className="w-full p-4 text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#4a4540] bg-[#383330]">
                          <Layers className="h-5 w-5 text-[#dad2c1]" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-[#f7f5f0]">{shelf.shelfName ?? 'Emplacement sans nom'}</h3>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-[11px] text-[#aea69c]">
                            <Warehouse className="h-3 w-3 shrink-0" />{shelf.stock?.stockName ?? 'Stock'}
                          </p>
                        </div>
                      </div>
                      <span className="rounded border border-[#4a4540] bg-[#383330] px-1.5 py-0.5 font-mono text-[10px] text-[#aea69c]">#{String(globalIndex).padStart(2, '0')}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded border border-[#403b37] bg-[#383330]/65 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-[#8f867d]">Quantité</p>
                        <p className="mt-1 flex items-center gap-1.5 font-mono text-sm font-semibold"><Hash className="h-3.5 w-3.5 text-[#aea69c]" />{shelf.shelfQuantity}</p>
                      </div>
                      <div className="rounded border border-[#403b37] bg-[#383330]/65 p-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-[#8f867d]">Stock</p>
                        <p className={`mt-1 text-xs font-semibold ${stockStatus === 'ACTIVE' ? 'text-emerald-300' : 'text-amber-300'}`}>{stockStatus}</p>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center justify-end gap-1 border-t border-[#403b37] px-3 py-2">
                    <button type="button" onClick={() => onSelectShelf(shelf)} className="rounded p-2 text-[#aea69c] hover:bg-[#383330] hover:text-white" title="Voir"><Eye className="h-3.5 w-3.5" /></button>
                    {onOpenUpdate && (
                      <button type="button" onClick={() => onOpenUpdate(shelf)} disabled={!canUpdateShelf} className="rounded p-2 text-[#aea69c] hover:bg-[#383330] hover:text-white disabled:opacity-30" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button>
                    )}
                    {onOpenDelete && (
                      <button type="button" onClick={() => onOpenDelete(shelf)} disabled={!canDeleteShelf} className="rounded p-2 text-rose-300 hover:bg-rose-950/25 disabled:opacity-30" title="Supprimer"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#3f3a36] bg-[#2b2622] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[#aea69c]">{startItem}–{endItem} sur {totalShelves} emplacement{totalShelves > 1 ? 's' : ''}</p>
        <div className="flex items-center gap-1">
          <button type="button" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className="rounded border border-[#3f3a36] p-2 text-[#aea69c] disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
          {pageNumbers.map((page) => (
            <button type="button" key={page} onClick={() => onPageChange(page)} className={`h-8 min-w-8 rounded border px-2 text-xs ${page === currentPage ? 'border-[#dad2c1] bg-[#f7f5f0] text-[#2b2622]' : 'border-[#3f3a36] text-[#aea69c]'}`}>{page}</button>
          ))}
          <button type="button" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className="rounded border border-[#3f3a36] p-2 text-[#aea69c] disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
