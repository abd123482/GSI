'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Warehouse,
} from 'lucide-react';

import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import type { Stock, StockStatusName } from '@/types/stock';
import { CreateStockModal } from '@/components/stock/CreateStockModal';
import { StockDetailModal } from '@/components/stock/StockDetailModal';
import { UpdateStockModal } from '@/components/stock/UpdateStockModal';

type StatusFilter = 'ALL' | StockStatusName;

export default function StocksPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const api = useApi();
  const { canCreateStock, canUpdateStock, canReadStock, isLoading: permissionsLoading } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['stocks', searchTerm, statusFilter, currentPage, limit],
    queryFn: () => {
      if (searchTerm.trim() || statusFilter !== 'ALL') {
        return StockService.searchStocks(
          api,
          {
            stockName: searchTerm.trim() || undefined,
            stockStatus: statusFilter === 'ALL' ? undefined : statusFilter,
          },
          { page: currentPage, limit },
        );
      }
      return StockService.getAllStocks(api, { page: currentPage, limit });
    },
    enabled: Boolean(isSignedIn && isLoaded && !permissionsLoading && canReadStock),
    placeholderData: keepPreviousData,
  });

  const stocks = data?.stocks ?? [];
  const totalStocks = data?.totalStocks ?? 0;
  const totalPages = data?.totalPages ?? 1;

  if (!isLoaded || permissionsLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-[#f7f5f0]"><div className="flex items-center gap-2 text-xs text-[#aea69c]"><Loader2 className="h-4 w-4 animate-spin" />Chargement des stocks...</div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-[#3f3a36] bg-[#383330] p-8 text-center"><Warehouse className="mx-auto h-8 w-8" /><h1 className="text-base font-semibold">Connexion requise</h1><SignInButton mode="modal"><button type="button" className="w-full rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622]">Se connecter</button></SignInButton></div>
      </main>
    );
  }

  if (!canReadStock) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#2f2a26] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
          <h1 className="mt-3 text-sm font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-xs text-[#aea69c]">La permission stock.read est requise.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#3f3a36] pb-4 sm:flex-row sm:items-center">
          <div><div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#aea69c]"><Link href="/" className="hover:text-white">somepharm</Link><span>/</span><span className="text-white">stocks</span></div><h1 className="text-2xl font-normal tracking-tight">Gestion des Stocks</h1></div>
        </div>


        <div className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#383330]">
          <div className="flex flex-col gap-3 border-b border-[#3f3a36] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-lg"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#aea69c]" /><input value={searchTerm} onChange={(event) => { setSearchTerm(event.target.value); setCurrentPage(1); }} placeholder="Rechercher un stock par nom..." className="h-9 w-full rounded border border-[#3f3a36] bg-[#2b2622] pl-9 pr-3 text-xs outline-none placeholder:text-[#aea69c]" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setCurrentPage(1); }} className="h-9 rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"><option value="ALL">Tous les statuts</option><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select>
              <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setCurrentPage(1); }} className="h-9 rounded border border-[#3f3a36] bg-[#2b2622] px-3 text-xs"><option value={10}>10 / page</option><option value={20}>20 / page</option><option value={50}>50 / page</option></select>
              
              {canCreateStock && (
                <button 
                  type="button" 
                  onClick={() => setIsCreateOpen(true)} 
                  className="inline-flex h-9 items-center justify-center gap-2 rounded bg-[#f7f5f0] px-3 text-xs font-semibold text-[#2b2622]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nouveau stock
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] uppercase tracking-wide text-[#aea69c]"><tr><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Emplacements</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
              <tbody className="divide-y divide-[#3f3a36]">
                {isLoading && stocks.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-14 text-center text-[#aea69c]"><Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />Chargement...</td></tr>
                ) : stocks.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-14 text-center text-[#aea69c]">Aucun stock disponible.</td></tr>
                ) : stocks.map((stock) => {
                  const status = stock.stockStatus?.stockStatusName ?? 'ACTIVE';
                  const shelves = stock._count?.shelves ?? stock.shelves?.length ?? 0;
                  return (
                    <tr key={stock.stockId} className="hover:bg-[#2f2a26]">
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded border border-[#45403c] bg-[#2b2622]"><Warehouse className="h-4 w-4" /></div><span className="font-semibold">{stock.stockName ?? 'Stock sans nom'}</span></div></td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded border px-2 py-1 text-[10px] font-semibold ${status === 'ACTIVE' ? 'border-emerald-400/25 bg-emerald-950/25 text-emerald-300' : 'border-amber-400/25 bg-amber-950/25 text-amber-300'}`}>{status}</span></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-[#c9c0ad]"><Layers className="h-3.5 w-3.5" />{shelves}</span></td>
                      <td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => setSelectedStockId(stock.stockId)} className="rounded p-2 text-[#aea69c] hover:bg-[#2b2622] hover:text-white" title="Voir"><Eye className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setEditingStock(stock)} disabled={!canUpdateStock} className="rounded p-2 text-[#aea69c] hover:bg-[#2b2622] hover:text-white disabled:opacity-30" title="Modifier"><Pencil className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#3f3a36] bg-[#2b2622] px-4 py-3"><p className="text-[11px] text-[#aea69c]">{totalStocks} stock{totalStocks > 1 ? 's' : ''}{isFetching ? ' • actualisation...' : ''}</p><div className="flex items-center gap-1"><button type="button" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => page - 1)} className="rounded border border-[#3f3a36] p-2 disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button><span className="px-2 text-[11px] text-[#aea69c]">{currentPage} / {Math.max(1, totalPages)}</span><button type="button" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((page) => page + 1)} className="rounded border border-[#3f3a36] p-2 disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button></div></div>
        </div>
      </div>

      <CreateStockModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => { void refetch(); }} />
      <StockDetailModal stockId={selectedStockId} isOpen={Boolean(selectedStockId)} onClose={() => setSelectedStockId(null)} />
      <UpdateStockModal stock={editingStock} isOpen={Boolean(editingStock)} onClose={() => setEditingStock(null)} onSuccess={() => { setEditingStock(null); void refetch(); }} />
    </main>
  );
}
