'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Warehouse,
  Plus,
  Search,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  Pencil,
} from 'lucide-react';
import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import { Stock } from '@/types/stock';
import { CreateStockModal } from '@/components/stock/CreateStockModal';
import { UpdateStockModal } from '@/components/stock/UpdateStockModal';
import { StockDetailModal } from '@/components/stock/StockDetailModal';

export default function StocksPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const { canCreateStock, canUpdateStock } = usePermissions();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  // Fetch stocks query
  const {
    data: stocksData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['stocks', searchTerm, currentPage, limit],
    queryFn: async () => {
      if (searchTerm.trim()) {
        return await StockService.searchStocks(
          api,
          { stockName: searchTerm.trim() },
          { page: currentPage, limit },
        );
      }
      return await StockService.getAllStocks(api, { page: currentPage, limit });
    },
    enabled: isSignedIn && isLoaded,
  });

  const stocks = stocksData?.stocks ?? [];
  const totalStocks = stocksData?.totalStocks ?? 0;
  const totalPages = stocksData?.totalPages ?? 1;

  // KPI Calculations
  const activeCount = stocks.filter((s) => s.stockStatus?.stockStatusName === 'ACTIVE').length;
  const totalShelvesCount = stocks.reduce((acc, s) => acc + (s._count?.shelves ?? s.shelves?.length ?? 0), 0);

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>Chargement des stocks...</span>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#2b2622] text-[#f7f5f0]">
        <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-8 shadow-xl text-center space-y-4">
          <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0] mx-auto">
            <Warehouse className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-medium text-[#f7f5f0]">Authentification Requise</h1>
            <p className="text-xs text-[#c9c0ad]">
              Veuillez vous connecter pour accéder au registre des stocks SomePharm.
            </p>
          </div>
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors cursor-pointer"
            >
              Se connecter
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      {/* Top Banner / Workspace Context */}
      <div className="bg-[#2b2622] border-b border-[#3f3a36]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {/* Breadcrumbs & Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
                <Link href="/" className="hover:text-[#f7f5f0] transition-colors">
                  somepharm
                </Link>
                <span>/</span>
                <span className="text-[#f7f5f0]">stocks</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[3px] bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] flex items-center justify-center">
                  <Warehouse className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                      Gestion des Stocks
                    </h1>
                    <span className="px-1.5 py-0.5 rounded-[2px] bg-[#383330] text-[#dad2c1] border border-[#3f3a36] text-[10px] font-mono">
                      {totalStocks} {totalStocks > 1 ? 'stocks' : 'stock'}
                    </span>
                  </div>
                  <p className="text-xs text-[#c9c0ad] mt-0.5">
                    Organisation des entrepôts et points de stockage principaux de SomePharm
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                disabled={!canCreateStock}
                className="px-3.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouveau Stock</span>
              </button>
            </div>
          </div>

          {/* Metric / KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
            <div className="p-4 bg-[#383330] border border-[#3f3a36] rounded-[4px]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#aea69c]">Total Stocks</div>
              <div className="text-2xl font-normal tracking-tight text-[#f7f5f0] mt-1">{totalStocks}</div>
              <div className="text-[11px] text-[#c9c0ad] mt-0.5">Entrepôts enregistrés</div>
            </div>
            <div className="p-4 bg-[#383330] border border-[#3f3a36] rounded-[4px]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#aea69c]">Stocks Actifs</div>
              <div className="text-2xl font-normal tracking-tight text-[#10b981] mt-1">{activeCount}</div>
              <div className="text-[11px] text-[#c9c0ad] mt-0.5">Opérationnels en temps réel</div>
            </div>
            <div className="p-4 bg-[#383330] border border-[#3f3a36] rounded-[4px]">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#aea69c]">Étagères Associées</div>
              <div className="text-2xl font-normal tracking-tight text-[#f7f5f0] mt-1">
                {totalShelvesCount.toLocaleString()}
              </div>
              <div className="text-[11px] text-[#c9c0ad] mt-0.5">Emplacements physiques rattachés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Search & Filter Toolbar */}
        <div className="p-3 bg-[#383330] border border-[#3f3a36] rounded-[4px] flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#aea69c]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Rechercher par nom de stock..."
              className="w-full pl-9 pr-3.5 py-1.5 bg-[#2b2622] text-[#f7f5f0] text-xs border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-all font-mono"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono text-[#aea69c]">
            <span>Afficher</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-2 py-1 text-xs text-[#f7f5f0] outline-none cursor-pointer"
            >
              <option value={10}>10 par page</option>
              <option value={25}>25 par page</option>
              <option value={50}>50 par page</option>
            </select>
          </div>
        </div>

        {/* Stocks Table */}
        <div className="bg-[#383330] border border-[#3f3a36] rounded-[4px] overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#aea69c]">
              <Loader2 className="w-5 h-5 animate-spin text-[#f7f5f0]" />
              <span>Chargement des stocks...</span>
            </div>
          ) : stocks.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center mx-auto text-[#aea69c]">
                <Warehouse className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-[#f7f5f0]">Aucun stock trouvé</h3>
                <p className="text-xs text-[#c9c0ad] max-w-sm mx-auto">
                  {searchTerm
                    ? `Aucun résultat ne correspond à "${searchTerm}". Essayez un autre terme.`
                    : 'Commencez par créer votre premier emplacement de stock principal.'}
                </p>
              </div>
              {canCreateStock && !searchTerm && (
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(true)}
                  className="px-3.5 py-1.5 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Créer un stock</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#2b2622] border-b border-[#3f3a36] text-[#aea69c] font-mono uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Nom du Stock</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Étagères associées</th>
                    <th className="px-4 py-3">Identifiant (UUID)</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3f3a36]">
                  {stocks.map((stock) => {
                    const status = stock.stockStatus?.stockStatusName ?? 'ACTIVE';
                    const shelfCount = stock._count?.shelves ?? stock.shelves?.length ?? 0;

                    return (
                      <tr
                        key={stock.stockId}
                        className="hover:bg-[#2b2622]/50 transition-colors group cursor-pointer"
                        onClick={() => {
                          setSelectedStockId(stock.stockId);
                          setIsDetailOpen(true);
                        }}
                      >
                        {/* Name */}
                        <td className="px-4 py-3 font-medium text-[#f7f5f0]">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-[2px] bg-[#2b2622] border border-[#3f3a36] text-[#f7f5f0] flex items-center justify-center shrink-0">
                              <Warehouse className="w-3.5 h-3.5" />
                            </div>
                            <span className="group-hover:text-white transition-colors">
                              {stock.stockName}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                              status === 'ACTIVE'
                                ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                                : 'bg-[#2d2212] text-[#f59e0b] border-[#453316]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                status === 'ACTIVE'
                                  ? 'bg-[#10b981]'
                                  : 'bg-[#f59e0b]'
                              }`}
                            />
                            <span>{status}</span>
                          </span>
                        </td>

                        {/* Shelves count */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-xs font-mono text-[#c9c0ad]">
                            <Layers className="w-3.5 h-3.5 text-[#aea69c]" />
                            <span className="text-[#f7f5f0]">
                              {shelfCount.toLocaleString()}
                            </span>
                            <span>{shelfCount > 1 ? 'étagères' : 'étagère'}</span>
                          </div>
                        </td>

                        {/* UUID */}
                        <td className="px-4 py-3 font-mono text-xs text-[#aea69c]">
                          {stock.stockId.slice(0, 8)}...{stock.stockId.slice(-4)}
                        </td>

                        {/* Actions */}
                        <td
                          className="px-4 py-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStockId(stock.stockId);
                                setIsDetailOpen(true);
                              }}
                              className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingStock(stock);
                                setIsUpdateOpen(true);
                              }}
                              disabled={!canUpdateStock}
                              className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Modifier"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-4 py-2.5 bg-[#2b2622] border-t border-[#3f3a36] flex items-center justify-between text-xs text-[#aea69c] font-mono">
              <div>
                Page <span className="text-[#f7f5f0]">{currentPage}</span> /{' '}
                <span className="text-[#f7f5f0]">{totalPages}</span> ({totalStocks}{' '}
                stocks)
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Stock Modal */}
      <CreateStockModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Update Stock Modal */}
      <UpdateStockModal
        stock={editingStock}
        isOpen={isUpdateOpen}
        onClose={() => {
          setIsUpdateOpen(false);
          setEditingStock(null);
        }}
        onSuccess={() => refetch()}
      />

      {/* Detail Stock Modal */}
      <StockDetailModal
        stockId={selectedStockId}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedStockId(null);
        }}
      />
    </main>
  );
}
