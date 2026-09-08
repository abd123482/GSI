'use client';

import { useState } from 'react';
import { Shelf } from '@/types/shelf';
import { getShelfVisualTheme } from './shelf-icons';
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
  Sparkles,
  Layers,
  Eye,
  ArrowRight,
  Filter,
  Edit3,
  Trash2,
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
    <div className="w-full bg-white border border-[#e5e3df] rounded-xl shadow-xs overflow-hidden text-left space-y-0">
      {/* Table Toolbar & Search by Name (with Pagination) */}
      <div className="p-4 border-b border-[#e5e3df] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-[#fafaf9]">
        {/* Search by Name input */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#787671]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom (GET /shelves/search avec pagination)..."
              className="w-full h-9 pl-9 pr-8 bg-white text-xs border border-[#c8c4be] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#787671] hover:text-[#1a1a1a] cursor-pointer"
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
            <Database className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787671]" />
            <input
              type="text"
              value={idLookupInput}
              onChange={(e) => setIdLookupInput(e.target.value)}
              placeholder="Inspecter par UUID..."
              className="w-full h-9 pl-8 pr-2 bg-white text-xs font-mono border border-[#e5e3df] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]"
            />
          </div>
          <button
            type="submit"
            disabled={!idLookupInput.trim() || isLoading}
            className="h-9 px-3 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
            title="Consulter l'étagère par UUID (GET /shelves/:id)"
          >
            <span>Ouvrir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        {/* View Mode & Page Limit & Refresh Controls */}
        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* View Mode Toggle: Notion Segmented Tab */}
          <div className="inline-flex items-center bg-[#f0eeec] p-0.5 rounded-lg border border-[#e5e3df]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#1a1a1a] shadow-xs'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
              title="Vue Liste / Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#1a1a1a] shadow-xs'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
              title="Vue Galerie / Cartes avec Icônes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Galerie</span>
            </button>
          </div>

          {/* Page size limit selector */}
          <div className="flex items-center gap-1.5 text-xs text-[#5d5b54]">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-white border border-[#c8c4be] rounded-md text-xs font-medium text-[#1a1a1a] outline-none focus:border-[#5645d4]"
            >
              <option value={5}>5 par page</option>
              <option value={10}>10 par page</option>
              <option value={20}>20 par page</option>
              <option value={50}>50 par page</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 bg-white hover:bg-[#f6f5f4] active:bg-[#ede9e4] text-[#37352f] border border-[#e5e3df] rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Rafraîchir depuis SQL Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#5645d4]' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main View: Table View OR Grid View */}
      {viewMode === 'table' ? (
        /* TABLE VIEW WITH INDEXING AND BEAUTIFUL ICONS */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e5e3df] bg-[#f6f5f4] text-[11px] font-semibold text-[#5d5b54] tracking-wider uppercase">
                <th className="py-2.5 px-4 w-16 text-center">Index</th>
                <th className="py-2.5 px-4">Étagère & Icône Visuelle</th>
                <th className="py-2.5 px-4 text-center">Quantité Stockée</th>
                <th className="py-2.5 px-4">UUID (dbo.Shelf SSMS)</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ede9e4] text-xs text-[#1a1a1a]">
              {isLoading && shelves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[#787671]">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <RefreshCw className="w-6 h-6 animate-spin text-[#5645d4]" />
                      <p className="text-sm font-medium">Chargement et recherche des étagères...</p>
                    </div>
                  </td>
                </tr>
              ) : shelves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center text-[#787671]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#fafaf9] border border-[#e5e3df] flex items-center justify-center text-[#a4a097]">
                        <Archive className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-[#1a1a1a]">Aucune étagère trouvée</p>
                        <p className="text-xs text-[#5d5b54]">
                          {searchTerm
                            ? `Aucune étagère ne correspond à "${searchTerm}".`
                            : 'Aucun tuple d’étagère présent dans SQL Server pour le moment.'}
                        </p>
                      </div>
                      {canCreateShelf && !searchTerm && (
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="mt-2 px-3.5 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        >
                          Créer une première étagère
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                shelves.map((shelf, idx) => {
                  const globalIndex = (currentPage - 1) * limit + idx + 1;
                  const formattedIndex = String(globalIndex).padStart(2, '0');
                  const visualTheme = getShelfVisualTheme(shelf.shelfName, idx);
                  const IconComp = visualTheme.icon;

                  return (
                    <tr
                      key={shelf.shelfId}
                      onClick={() => onSelectShelf(shelf)}
                      className="hover:bg-[#fafaf9] transition-colors group cursor-pointer"
                    >
                      {/* 1. Global Index Number */}
                      <td className="py-3 px-4 text-center font-mono text-xs font-semibold text-[#787671]">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#f0eeec] border border-[#e5e3df]">
                          #{formattedIndex}
                        </span>
                      </td>

                      {/* 2. Beautiful Icon + Shelf Name */}
                      <td className="py-3 px-4 font-medium text-[#1a1a1a]">
                        <div className="flex items-center gap-3">
                          {/* Beautiful Custom Icon Box with Pastel Tint */}
                          <div
                            className={`w-9 h-9 rounded-lg ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                            title={visualTheme.label}
                          >
                            <IconComp className="w-4.5 h-4.5" />
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-[#1a1a1a] truncate max-w-xs group-hover:text-[#5645d4] transition-colors">
                              {shelf.shelfName ?? 'Étagère sans nom'}
                            </p>
                            <span className="text-[11px] text-[#787671] flex items-center gap-1">
                              <span>Emplacement physique</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] text-[#5645d4]">
                                RACK-{formattedIndex}
                              </span>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Quantity Badge */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            shelf.shelfQuantity > 0
                              ? 'bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]'
                              : 'bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2]'
                          }`}
                        >
                          <Hash className="w-3 h-3" />
                          {shelf.shelfQuantity} {shelf.shelfQuantity > 1 ? 'unités' : 'unité'}
                        </span>
                      </td>

                      {/* 4. GUID (shelfId) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#5d5b54]">
                          <span className="truncate max-w-[190px]">{shelf.shelfId}</span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, shelf.shelfId)}
                            className="p-1 text-[#a4a097] hover:text-[#1a1a1a] rounded hover:bg-[#ede9e4] transition-colors cursor-pointer"
                            title="Copier le GUID SQL Server"
                          >
                            {copiedId === shelf.shelfId ? (
                              <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 5. Actions: Inspect, Update, Delete */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectShelf(shelf)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#ede9e4] border border-[#e5e3df] text-xs font-medium text-[#37352f] transition-colors cursor-pointer"
                            title="Ouvrir la fiche détaillée Notion"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#5645d4]" />
                            <span>Fiche</span>
                          </button>

                          {/* Button for Update (@Patch(':id')) */}
                          <button
                            type="button"
                            onClick={() => onOpenUpdate && onOpenUpdate(shelf)}
                            disabled={!canUpdateShelf}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#ede9e4] border border-[#e5e3df] text-xs font-medium text-[#0075de] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={canUpdateShelf ? "Modifier l'étagère (shelf.update)" : "Permission 'shelf.update' manquante"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Modifier</span>
                          </button>

                          {/* Button for Delete (@Delete(':id')) */}
                          <button
                            type="button"
                            onClick={() => onOpenDelete && onOpenDelete(shelf)}
                            disabled={!canDeleteShelf}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#fde0ec] border border-[#e5e3df] text-xs font-medium text-[#e03131] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={canDeleteShelf ? "Supprimer l'étagère (shelf.delete)" : "Permission 'shelf.delete' manquante"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Supprimer</span>
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
        /* GALLERY / GRID VIEW SHOWCASING BEAUTIFUL ICONS INSIDE EACH SHELF */
        <div className="p-5 bg-[#fafaf9]">
          {isLoading && shelves.length === 0 ? (
            <div className="py-14 text-center text-[#787671] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#5645d4]" />
              <p className="text-sm font-medium">Chargement des cartes étagères...</p>
            </div>
          ) : shelves.length === 0 ? (
            <div className="py-14 text-center text-[#787671] flex flex-col items-center justify-center gap-2">
              <Archive className="w-8 h-8 text-[#a4a097]" />
              <p className="text-sm font-medium text-[#1a1a1a]">Aucune étagère disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shelves.map((shelf, idx) => {
                const globalIndex = (currentPage - 1) * limit + idx + 1;
                const formattedIndex = String(globalIndex).padStart(2, '0');
                const visualTheme = getShelfVisualTheme(shelf.shelfName, idx);
                const IconComp = visualTheme.icon;

                return (
                  <div
                    key={shelf.shelfId}
                    onClick={() => onSelectShelf(shelf)}
                    className="bg-white border border-[#e5e3df] hover:border-[#5645d4] rounded-xl p-5 shadow-xs hover:shadow-md transition-all text-left space-y-4 relative group cursor-pointer"
                  >
                    {/* Corner Index Tag */}
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-[#f0eeec] text-[11px] font-mono font-bold text-[#5d5b54]">
                        INDEX #{formattedIndex}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#e6e0f5] text-[#5645d4] font-medium">
                        dbo.Shelf
                      </span>
                    </div>

                    {/* Beautiful Large Icon and Title */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-12 h-12 rounded-xl ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shadow-xs shrink-0 group-hover:scale-105 transition-transform`}
                      >
                        <IconComp className="w-6 h-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm text-[#1a1a1a] truncate group-hover:text-[#5645d4] transition-colors">
                          {shelf.shelfName ?? 'Étagère sans nom'}
                        </h3>
                        <p className="text-xs text-[#5d5b54] truncate mt-0.5">
                          {visualTheme.label}
                        </p>
                      </div>
                    </div>

                    {/* Stats & Quantity */}
                    <div className="pt-2 border-t border-[#ede9e4] flex items-center justify-between text-xs">
                      <span className="text-[#787671]">Stock initial :</span>
                      <span
                        className={`font-semibold px-2.5 py-0.5 rounded-full text-xs ${
                          shelf.shelfQuantity > 0
                            ? 'bg-[#d9f3e1] text-[#1aae39]'
                            : 'bg-[#ffe8d4] text-[#dd5b00]'
                        }`}
                      >
                        {shelf.shelfQuantity} unités
                      </span>
                    </div>

                    {/* Action Bar */}
                    <div className="bg-[#fafaf9] border border-[#ede9e4] rounded-lg p-2 flex items-center justify-between text-[11px] font-mono text-[#5d5b54]">
                      <span className="truncate max-w-[150px]">{shelf.shelfId}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(e, shelf.shelfId)}
                          className="p-1 hover:text-[#1a1a1a] hover:bg-white rounded transition-colors"
                          title="Copier le GUID"
                        >
                          {copiedId === shelf.shelfId ? (
                            <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectShelf(shelf);
                          }}
                          className="p-1 hover:text-[#5645d4] hover:bg-white rounded transition-colors"
                          title="Voir la fiche détaillée"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#5645d4]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenUpdate && onOpenUpdate(shelf);
                          }}
                          disabled={!canUpdateShelf}
                          className="p-1 hover:text-[#0075de] hover:bg-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={canUpdateShelf ? "Modifier l'étagère" : "Permission manquante"}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#0075de]" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDelete && onOpenDelete(shelf);
                          }}
                          disabled={!canDeleteShelf}
                          className="p-1 hover:text-[#e03131] hover:bg-[#fde0ec] rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={canDeleteShelf ? "Supprimer l'étagère" : "Permission manquante"}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#e03131]" />
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

      {/* Pagination Footer: Notion Style */}
      <div className="p-4 border-t border-[#e5e3df] bg-[#fafaf9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5d5b54]">
        <div>
          <span>
            Affichage de <strong className="text-[#1a1a1a] font-semibold">{startItem}</strong> à{' '}
            <strong className="text-[#1a1a1a] font-semibold">{endItem}</strong> sur{' '}
            <strong className="text-[#1a1a1a] font-semibold">{totalShelves}</strong> étagères
            {searchTerm && <span> (filtré par &quot;{searchTerm}&quot;)</span>}
          </span>
        </div>

        {/* Pagination Navigation Controls */}
        <div className="flex items-center gap-1.5">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white text-[#37352f] hover:bg-[#f0eeec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Première page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="px-2.5 py-1.5 rounded-md border border-[#e5e3df] bg-white text-[#37352f] hover:bg-[#f0eeec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          {/* Page Number Chips */}
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
                    className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#5645d4] text-white'
                        : 'bg-white border border-[#e5e3df] text-[#1a1a1a] hover:bg-[#f0eeec]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              });
            })()}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="px-2.5 py-1.5 rounded-md border border-[#e5e3df] bg-white text-[#37352f] hover:bg-[#f0eeec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-1 font-medium"
          >
            <span className="hidden sm:inline">Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white text-[#37352f] hover:bg-[#f0eeec] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Dernière page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
