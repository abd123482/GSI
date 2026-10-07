'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  Loader2,
  Warehouse,
  X,
} from 'lucide-react';

import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';

interface StockDetailModalProps {
  stockId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StockDetailModal({ stockId, isOpen, onClose }: StockDetailModalProps) {
  const api = useApi();
  const { data: stock, isLoading, error } = useQuery({
    queryKey: ['stock-detail', stockId],
    queryFn: () => StockService.getStockById(api, stockId!),
    enabled: isOpen && Boolean(stockId),
    staleTime: 10_000,
  });

  if (!isOpen || !stockId) return null;
  const status = stock?.status ?? true ? 'ACTIVE' : 'INACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#3f3f46] bg-[#27272a]"><Warehouse className="h-5 w-5" /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{stock?.stockName ?? 'Détails du stock'}</h2>
                {stock && (
                  <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold ${status === 'ACTIVE' ? 'border-emerald-400/30 bg-emerald-950/30 text-emerald-200' : 'border-amber-400/30 bg-amber-950/30 text-amber-200'}`}>
                    {status === 'ACTIVE' ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{status}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-white/45">Aucun identifiant technique n’est affiché.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-950/25 p-4 text-xs text-rose-200">Impossible de charger ce stock.</div>
          ) : stock ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/60 p-4"><p className="flex items-center justify-between text-xs text-[#a1a1aa]">Emplacements associés<Layers className="h-4 w-4" /></p><p className="mt-2 text-2xl font-semibold">{stock._count?.shelves ?? stock.shelves?.length ?? 0}</p></div>
                <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/60 p-4"><p className="text-xs text-[#a1a1aa]">Statut opérationnel</p><p className={`mt-2 text-sm font-semibold ${status === 'ACTIVE' ? 'text-emerald-300' : 'text-amber-300'}`}>{status}</p></div>
              </div>

              <section className="space-y-3">
                <div className="flex items-center justify-between"><h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"><Layers className="h-3.5 w-3.5" />Emplacements</h3></div>
                {!stock.shelves || stock.shelves.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#4a4540] bg-[#18181b]/35 p-6 text-center text-xs text-[#a1a1aa]">Aucun emplacement rattaché à ce stock.</div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-[#3f3f46]">
                    <div className="divide-y divide-[#3f3f46]">
                      {stock.shelves.map((shelf) => (
                        <div key={shelf.shelfId} className="flex items-center justify-between gap-3 bg-[#18181b]/55 px-4 py-3 text-xs">
                          <span className="truncate font-medium">{shelf.shelfName ?? 'Emplacement sans nom'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-[#3f3f46] bg-[#18181b] px-5 py-3"><button type="button" onClick={onClose} className="rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]">Fermer</button></footer>
      </div>
    </div>
  );
}
