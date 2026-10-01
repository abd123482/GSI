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
            value={searchTerm === 'status:ACTIVE' ? 'ACTIVE' : searchTerm === 'status:INACTIVE' ? 'INACTIVE' : 'ALL'}
            onChange={(event) => {
              if (event.target.value === 'ALL') {
                onSearchChange('');
              } else {
                onSearchChange(`status:${event.target.value}`);
              }
            }}
            className="h-9 rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs text-[#f7f5f0]"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>

          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value))}
            className="h-9 rounded border border-[#3f3a36] bg-[#2b2622] px-2 text-xs text-[#f7f5f0]"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] uppercase tracking-wide text-[#aea69c]">
                <tr>
                  <th className="px-4 py-3">Emplacement</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-center">Quantité</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3f3a36]">
                {shelves.map((shelf, index) => {
                  const globalIndex = (currentPage - 1) * limit + index + 1;
                  const stockName = shelf.stock?.stockName ?? 'Stock inconnu';
                  const shelfStatus = shelf.status !== false ? 'ACTIVE' : 'INACTIVE';

                  return (
                    <tr key={shelf.shelfId} className="group transition hover:bg-[#332e29]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded border border-[#403b37] bg-[#2b2622]">
                            <Layers className="h-4 w-4 text-[#dad2c1]" />
                          </div>
                          <div>
                            <p className="font-semibold text-[#f7f5f0]">{shelf.shelfName ?? 'Emplacement sans nom'}</p>
                            <p className="text-[10px] font-mono text-[#aea69c]">#{String(globalIndex).padStart(2, '0')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[#aea69c]">
                          <Warehouse className="h-3.5 w-3.5" />
                          <span>{stockName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          shelfStatus === 'ACTIVE' 
                            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' 
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                        }`}>
                          <span className={`h-1 w-1 rounded-full ${shelfStatus === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          {shelfStatus === 'ACTIVE' ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded bg-[#2b2622] px-2 py-1 font-mono font-medium border border-[#403b37]">
                          {shelf.shelfQuantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => onSelectShelf(shelf)} className="rounded p-1.5 text-[#aea69c] hover:bg-[#2b2622] hover:text-white" title="Voir">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {onOpenUpdate && (
                            <button type="button" onClick={() => onOpenUpdate(shelf)} disabled={!canUpdateShelf} className="rounded p-1.5 text-[#aea69c] hover:bg-[#2b2622] hover:text-white disabled:opacity-30" title="Modifier">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onOpenDelete && (
                            <button type="button" onClick={() => onOpenDelete(shelf)} disabled={!canDeleteShelf} className="rounded p-1.5 text-rose-400 hover:bg-rose-950/30 disabled:opacity-30" title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
