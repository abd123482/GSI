'use client';

import { useQuery } from '@tanstack/react-query';
import { StockService } from '@/services/stock.service';
import { useApi } from '@/hooks/use-api';
import {
  X,
  Warehouse,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface StockDetailModalProps {
  stockId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StockDetailModal({ stockId, isOpen, onClose }: StockDetailModalProps) {
  const api = useApi();

  const { data: stock, isLoading, error } = useQuery({
    queryKey: ['stock-detail', stockId],
    queryFn: () => (stockId ? StockService.getStockById(api, stockId) : null),
    enabled: isOpen && !!stockId,
    staleTime: 10 * 1000,
  });

  if (!isOpen || !stockId) return null;

  const statusName = stock?.stockStatus?.stockStatusName || 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#111]/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col text-left"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#3f3a36] bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2b2622] border border-[#3f3a36] text-[#f7f5f0] flex items-center justify-center shadow-2xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white leading-tight">
                  {stock?.stockName ?? 'Détails du Stock'}
                </h2>
                {stock && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                      statusName === 'ACTIVE'
                        ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-400/40'
                        : statusName === 'INACTIVE'
                        ? 'bg-amber-950/40 text-amber-200 border border-amber-400/40'
                        : 'bg-slate-900/40 text-slate-200 border border-slate-400/40'
                    }`}
                  >
                    {statusName === 'ACTIVE' && <CheckCircle2 className="w-3 h-3" />}
                    {statusName === 'INACTIVE' && <AlertTriangle className="w-3 h-3" />}
                    {statusName === 'ARCHIVED' && <Archive className="w-3 h-3" />}
                    {statusName}
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 mt-0.5 font-mono">
                UUID : {stockId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-md transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
              <span>Chargement des détails du stock...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-rose-950/50 border border-rose-500/50 text-rose-200 text-xs">
              Impossible de charger les données de ce stock.
            </div>
          ) : stock ? (
            <>
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-[#2b2622]/60 border border-[#3f3a36] space-y-1 text-white">
                  <div className="flex items-center justify-between text-xs text-white/85">
                    <span>Emplacements associés</span>
                    <Layers className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {stock._count?.shelves ?? stock.shelves?.length ?? 0}
                  </div>
                  <p className="text-[11px] text-white/80">
                    Emplacements physiques rattachés
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[#2b2622]/60 border border-[#3f3a36] space-y-1 text-white">
                  <div className="flex items-center justify-between text-xs text-white/85">
                    <span>Statut</span>
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5 pt-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{statusName}</span>
                  </div>
                </div>
              </div>

              {/* Associated Shelves Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-white" />
                    Emplacements contenus dans ce stock ({stock.shelves?.length ?? 0})
                  </h3>
                  <Link
                    href="/shelves"
                    className="text-xs text-white hover:text-white/80 underline flex items-center gap-1 font-medium"
                  >
                    <span>Voir tous les emplacements</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {(!stock.shelves || stock.shelves.length === 0) ? (
                  <div className="p-6 text-center border border-dashed border-[#3f3a36] rounded-lg text-xs text-white/80 bg-[#2b2622]/30">
                    Aucun emplacement rattaché pour le moment à cet entrepôt.
                  </div>
                ) : (
                  <div className="border border-[#3f3a36] rounded-lg overflow-hidden max-h-60 overflow-y-auto bg-[#2b2622]/60">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#2b2622] text-white font-medium border-b border-[#3f3a36]">
                        <tr>
                          <th className="px-3 py-2">Nom de l&apos;emplacement</th>
                          <th className="px-3 py-2 text-right">Quantité d&apos;articles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#455268]">
                        {stock.shelves.map((sh) => (
                          <tr key={sh.shelfId} className="hover:bg-white/10 transition-colors">
                            <td className="px-3 py-2.5 font-medium text-white">
                              {sh.shelfName || 'Emplacement sans nom'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-white/90">
                              <span className="px-2 py-0.5 rounded-full bg-[#2b2622] border border-[#3f3a36] text-white">
                                {sh.shelfQuantity} {sh.shelfQuantity > 1 ? 'unités' : 'unité'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#2b2622] border-t border-[#3f3a36] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4.5 py-2 bg-[#2b2622] hover:bg-[#3f3a36] text-white border border-[#4d4742] text-xs font-medium rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
