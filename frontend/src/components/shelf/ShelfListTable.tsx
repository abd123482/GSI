'use client';

import { useState } from 'react';
import { Shelf } from '@/types/shelf';
import {
  Search,
  RefreshCw,
  Copy,
  Check,
  Database,
  Hash,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Table as TableIcon,
  Eye,
  ArrowRight,
  Pencil,
  Trash2,
  Plus,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';

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
  onLookupById?: (id: string) => void;
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
  onLookupById,
  onOpenUpdate,
  onOpenDelete,
  isLoading,
  onRefresh,
  onOpenCreateModal,
  canCreateShelf,
  canUpdateShelf = true,
  canDeleteShelf = true,
}: ShelfListTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [idLookupInput, setIdLookupInput] = useState('');

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('Identifiant copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idLookupInput.trim()) return;
    if (onLookupById) {
      onLookupById(idLookupInput.trim());
    }
  };

  // Calculate indexing ranges
  const startItem = totalShelves === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalShelves);

  return (
    <div className="w-full bg-[#383330] border border-[#3f3a36] rounded-[4px] shadow-xs overflow-hidden text-left space-y-0">
      {/* Table Toolbar & Search by Name */}
      <div className="p-3 border-b border-[#3f3a36] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-[#383330]">
        {/* Search by Name input */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#aea69c]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom d'étagère..."
              className="w-full h-8 pl-8 pr-7 bg-[#2b2622] text-xs font-mono text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#aea69c] hover:text-[#f7f5f0] cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Quick UUID Lookup Input */}
        <form
          onSubmit={handleLookupSubmit}
          className="flex items-center gap-1.5 w-full sm:w-auto max-w-sm"
        >
          <div className="relative flex-1">
            <Database className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#aea69c]" />
            <input
              type="text"
              value={idLookupInput}
              onChange={(e) => setIdLookupInput(e.target.value)}
              placeholder="Inspecter par UUID..."
              className="w-full h-8 pl-8 pr-2 bg-[#2b2622] text-xs font-mono text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!idLookupInput.trim() || isLoading}
            className="h-8 px-2.5 bg-[#2b2622] hover:bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
            title="Consulter l'étagère par UUID (GET /shelves/:id)"
          >
            <span>Ouvrir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        {/* View Mode & Page Limit & Refresh Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-between lg:justify-end">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center bg-[#2b2622] p-0.5 rounded-[3px] border border-[#3f3a36]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded-[2px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] shadow-xs'
                  : 'text-[#aea69c] hover:text-[#f7f5f0]'
              }`}
              title="Vue Liste / Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded-[2px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] shadow-xs'
                  : 'text-[#aea69c] hover:text-[#f7f5f0]'
              }`}
              title="Vue Galerie / Cartes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Galerie</span>
            </button>
          </div>

          {/* Page size limit selector */}
          <div className="flex items-center gap-1.5 text-xs text-[#c9c0ad]">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] text-xs font-mono text-[#f7f5f0] outline-none focus:border-[#f7f5f0] cursor-pointer"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 bg-[#2b2622] hover:bg-[#383330] text-[#c9c0ad] hover:text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            title="Rafraîchir depuis SQL Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#f7f5f0]' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main View: Table View OR Grid View */}
      {viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[11px] font-mono text-[#aea69c] tracking-wider uppercase">
                <th className="py-2.5 px-4 w-16 text-center">Index</th>
                <th className="py-2.5 px-4">Étagère & Emplacement</th>
                <th className="py-2.5 px-4 text-center">Quantité Stockée</th>
                <th className="py-2.5 px-4">UUID (dbo.Shelf)</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3f3a36] text-xs text-[#f7f5f0]">
              {isLoading && shelves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#aea69c]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#f7f5f0]" />
                      <p className="text-xs font-mono">Chargement des étagères...</p>
                    </div>
                  </td>
                </tr>
              ) : shelves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-[#aea69c]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#aea69c]">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#f7f5f0]">Aucune étagère trouvée</p>
                        <p className="text-xs text-[#c9c0ad] max-w-sm">
                          {searchTerm
                            ? `Aucune étagère ne correspond à "${searchTerm}".`
                            : 'Aucun tuple d’étagère présent dans SQL Server pour le moment.'}
                        </p>
                      </div>
                      {canCreateShelf && !searchTerm && (
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="mt-1 px-3.5 py-1.5 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] rounded-[3px] text-xs font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Créer une étagère</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                shelves.map((shelf, idx) => {
                  const globalIndex = (currentPage - 1) * limit + idx + 1;
                  const formattedIndex = String(globalIndex).padStart(2, '0');

                  return (
                    <tr
                      key={shelf.shelfId}
                      onClick={() => onSelectShelf(shelf)}
                      className="hover:bg-[#2b2622]/50 transition-colors group cursor-pointer"
                    >
                      {/* 1. Global Index Number */}
                      <td className="py-3 px-4 text-center font-mono text-xs text-[#aea69c]">
                        <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[#2b2622] border border-[#3f3a36] text-[#dad2c1] text-[10px]">
                          #{formattedIndex}
                        </span>
                      </td>

                      {/* 2. Shelf Name */}
                      <td className="py-3 px-4 font-medium text-[#f7f5f0]">
                        <div className="flex items-center gap-2.5">
                          <div className="min-w-0">
                            <p className="font-medium text-xs text-[#f7f5f0] truncate max-w-xs group-hover:text-white transition-colors">
                              {shelf.shelfName ?? 'Étagère sans nom'}
                            </p>
                            <span className="text-[11px] font-mono text-[#aea69c] flex items-center gap-1">
                              <span>Emplacement</span>
                              {shelf.stock?.stockName && (
                                <>
                                  <span>•</span>
                                  <span className="text-[#f7f5f0] flex items-center gap-0.5">
                                    <Warehouse className="w-3 h-3" />
                                    {shelf.stock.stockName}
                                  </span>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-[#dad2c1]">
                                RACK-{formattedIndex}
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Quantity Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                            shelf.shelfQuantity > 0
                              ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                              : 'bg-[#2d1616] text-[#ef4444] border-[#451e1e]'
                          }`}
                        >
                          <Hash className="w-3 h-3" />
                          <span>
                            {shelf.shelfQuantity} {shelf.shelfQuantity > 1 ? 'unités' : 'unité'}
                          </span>
                        </span>
                      </td>

                      {/* 4. GUID (shelfId) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-[#aea69c]">
                          <span className="truncate max-w-[160px]">{shelf.shelfId}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, shelf.shelfId)}
                            className="p-1 text-[#aea69c] hover:text-[#f7f5f0] rounded-[2px] hover:bg-[#2b2622] transition-colors cursor-pointer"
                            title="Copier le GUID SQL Server"
                          >
                            {copiedId === shelf.shelfId ? (
                              <Check className="w-3.5 h-3.5 text-[#10b981]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 5. Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectShelf(shelf)}
                            className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer"
                            title="Consulter les détails"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenUpdate && onOpenUpdate(shelf)}
                            disabled={!canUpdateShelf}
                            className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canUpdateShelf ? "Modifier l'étagère" : "Permission manquante"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDelete && onOpenDelete(shelf)}
                            disabled={!canDeleteShelf}
                            className="p-1.5 rounded-[2px] text-[#ef4444] hover:bg-[#2d1616] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={canDeleteShelf ? "Supprimer l'étagère" : "Permission manquante"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* GALLERY / GRID VIEW */
        <div className="p-4 bg-[#2b2622]">
          {isLoading && shelves.length === 0 ? (
            <div className="py-14 text-center text-[#aea69c] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#f7f5f0]" />
              <p className="text-xs font-mono">Chargement des cartes étagères...</p>
            </div>
          ) : shelves.length === 0 ? (
            <div className="py-14 text-center text-[#aea69c] flex flex-col items-center justify-center gap-2">
              <Archive className="w-8 h-8 text-[#aea69c]" />
              <p className="text-sm font-medium text-[#f7f5f0]">Aucune étagère disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shelves.map((shelf, idx) => {
                const globalIndex = (currentPage - 1) * limit + idx + 1;
                const formattedIndex = String(globalIndex).padStart(2, '0');

                return (
                  <div
                    key={shelf.shelfId}
                    onClick={() => onSelectShelf(shelf)}
                    className="bg-[#383330] border border-[#3f3a36] hover:border-[#4d4742] rounded-[4px] p-4 shadow-xs transition-all text-left space-y-3 relative group cursor-pointer"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="px-1.5 py-0.5 rounded-[2px] bg-[#2b2622] border border-[#3f3a36] text-[10px] font-mono text-[#dad2c1]">
                        INDEX #{formattedIndex}
                      </span>
                      <span className="text-[10px] font-mono text-[#aea69c]">
                        dbo.Shelf
                      </span>
                    </div>

                    {/* Title */}
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-xs text-[#f7f5f0] truncate group-hover:text-white transition-colors">
                          {shelf.shelfName ?? 'Étagère sans nom'}
                        </h3>
                      </div>
                    </div>

                    {/* Stats & Quantity */}
                    <div className="pt-2 border-t border-[#3f3a36] flex items-center justify-between text-xs">
                      <span className="text-[#aea69c] font-mono text-[11px] flex items-center gap-1">
                        {shelf.stock?.stockName ? (
                          <>
                            <Warehouse className="w-3 h-3 text-[#f7f5f0]" />
                            <span className="text-[#f7f5f0] truncate max-w-[110px]">{shelf.stock.stockName}</span>
                          </>
                        ) : (
                          'Stock initial :'
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-mono border ${
                          shelf.shelfQuantity > 0
                            ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                            : 'bg-[#2d1616] text-[#ef4444] border-[#451e1e]'
                        }`}
                      >
                        {shelf.shelfQuantity} unités
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-[#2b2622] border border-[#3f3a36] rounded-[3px] p-2 flex items-center justify-between text-[11px] font-mono text-[#aea69c]">
                      <span className="truncate max-w-[140px]">{shelf.shelfId}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(e, shelf.shelfId)}
                          className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors"
                          title="Copier le GUID"
                        >
                          {copiedId === shelf.shelfId ? (
                            <Check className="w-3.5 h-3.5 text-[#10b981]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectShelf(shelf)}
                          className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors"
                          title="Voir les détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenUpdate?.(shelf)}
                          disabled={!canUpdateShelf}
                          className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={canUpdateShelf ? "Modifier" : "Permission manquante"}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenDelete?.(shelf)}
                          disabled={!canDeleteShelf}
                          className="p-1 text-[#ef4444] hover:bg-[#2d1616] rounded-[2px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={canDeleteShelf ? "Supprimer" : "Permission manquante"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-4 py-2.5 bg-[#2b2622] border-t border-[#3f3a36] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#aea69c] font-mono">
          <div>
            Page <span className="text-[#f7f5f0]">{currentPage}</span> /{' '}
            <span className="text-[#f7f5f0]">{totalPages}</span> ({totalShelves} étagères)
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Première page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Page précédente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page buttons */}
            <div className="flex items-center gap-1 px-1">
              {(() => {
                const pages: number[] = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= Math.max(totalPages, 1); i++) pages.push(i);
                } else if (currentPage <= 3) {
                  pages.push(1, 2, 3, 4, 5);
                } else if (currentPage >= totalPages - 2) {
                  for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2);
                }

                return pages.map((pageNum) => {
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={`page-btn-${pageNum}`}
                      type="button"
                      onClick={() => onPageChange(pageNum)}
                      disabled={isLoading}
                      className={`w-6 h-6 rounded-[2px] text-xs font-mono transition-colors cursor-pointer flex items-center justify-center ${
                        isActive
                          ? 'bg-[#f7f5f0] text-[#2b2622] font-semibold'
                          : 'bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] border border-[#3f3a36]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Page suivante"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Dernière page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
