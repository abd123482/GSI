'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Barcode,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Filter,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

interface DashboardAnomaliesHubProps {
  stats: DashboardStats;
}

type AnomalyFilter = 'ALL' | 'INVENTORY' | 'STOCK' | 'SERIAL';

export function DashboardAnomaliesHub({ stats }: DashboardAnomaliesHubProps) {
  const { anomaliesOverview, inventoryOverview, stockOverview } = stats;
  const [filter, setFilter] = useState<AnomalyFilter>('ALL');

  const filteredItems = useMemo(() => {
    return anomaliesOverview.items.filter((item) => {
      if (filter === 'ALL') return true;
      if (filter === 'INVENTORY') {
        return item.category === 'DISAGREEMENT' || item.category === 'STOCK_VARIANCE';
      }
      if (filter === 'STOCK') {
        return item.category === 'OUT_OF_STOCK' || item.category === 'LOW_STOCK';
      }
      if (filter === 'SERIAL') {
        return item.category === 'ORPHAN_SERIAL';
      }
      return true;
    });
  }, [anomaliesOverview.items, filter]);

  return (
    <section
      id="anomalies-section"
      className="p-5 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-sm space-y-4"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3f3f46]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[3px] bg-rose-950/40 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <AlertOctagon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-white tracking-wide flex items-center gap-2">
              <span>Centre des Anomalies & Écarts Détectés</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                anomaliesOverview.totalAnomalies > 0
                  ? 'bg-rose-950/50 text-rose-300 border border-rose-500/30'
                  : 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/30'
              }`}>
                {anomaliesOverview.totalAnomalies} active{anomaliesOverview.totalAnomalies > 1 ? 's' : ''}
              </span>
            </h2>
            <p className="text-xs text-[#a1a1aa] mt-0.5 font-mono">
              Contrôle continu : désaccords C1/C2 d&apos;inventaire, ruptures de stock, seuils minimum et séries orphelines.
            </p>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-[#18181b] border border-rose-500/30 text-rose-400 font-medium">
            {anomaliesOverview.criticalCount} critiques
          </span>
          <span className="px-2.5 py-1 rounded bg-[#18181b] border border-amber-500/30 text-amber-400 font-medium">
            {anomaliesOverview.warningCount} avertissements
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-[3px] transition-colors cursor-pointer border ${
            filter === 'ALL'
              ? 'bg-[#fafafa] text-[#18181b] font-semibold border-white'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border-[#3f3f46]'
          }`}
        >
          Toutes ({anomaliesOverview.totalAnomalies})
        </button>

        <button
          type="button"
          onClick={() => setFilter('INVENTORY')}
          className={`px-3 py-1.5 rounded-[3px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
            filter === 'INVENTORY'
              ? 'bg-[#fafafa] text-[#18181b] font-semibold border-white'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border-[#3f3f46]'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
          <span>Inventaire & Désaccords ({anomaliesOverview.inventoryIssuesCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('STOCK')}
          className={`px-3 py-1.5 rounded-[3px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
            filter === 'STOCK'
              ? 'bg-[#fafafa] text-[#18181b] font-semibold border-white'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border-[#3f3f46]'
          }`}
        >
          <Boxes className="w-3.5 h-3.5 text-rose-400" />
          <span>Ruptures & Stocks Critiques ({anomaliesOverview.stockAlertsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('SERIAL')}
          className={`px-3 py-1.5 rounded-[3px] transition-colors cursor-pointer border flex items-center gap-1.5 ${
            filter === 'SERIAL'
              ? 'bg-[#fafafa] text-[#18181b] font-semibold border-white'
              : 'bg-[#18181b] text-[#a1a1aa] hover:text-white border-[#3f3f46]'
          }`}
        >
          <Barcode className="w-3.5 h-3.5 text-sky-400" />
          <span>Séries Orphelines ({anomaliesOverview.orphanSerialsCount})</span>
        </button>
      </div>

      {/* Anomalies List */}
      {filteredItems.length === 0 ? (
        <div className="py-10 bg-[#18181b] border border-[#3f3f46]/70 rounded-[4px] flex flex-col items-center justify-center text-center p-6 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white font-mono">Aucune anomalie dans cette catégorie</h3>
          <p className="text-xs text-[#a1a1aa] font-mono max-w-md">
            Tous les indicateurs et enregistrements vérifiés respectent les règles de validation et seuils opérationnels.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="bg-[#18181b] border-b border-[#3f3f46] text-[#a1a1aa] text-[10px] uppercase">
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Gravité</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Type d&apos;Anomalie</th>
                <th className="py-2.5 px-3">Description & Contexte</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Source</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3f3f46]/60 text-[#f4f4f5]">
              {filteredItems.map((anomaly) => {
                const isCritical = anomaly.severity === 'CRITICAL';
                const isDisagreement = anomaly.category === 'DISAGREEMENT';
                const isStockVariance = anomaly.category === 'STOCK_VARIANCE';
                const isOutOfStock = anomaly.category === 'OUT_OF_STOCK';
                const isLowStock = anomaly.category === 'LOW_STOCK';
                const isOrphanSerial = anomaly.category === 'ORPHAN_SERIAL';

                let actionHref = '/equipment';
                let actionLabel = 'Voir article';

                if (isDisagreement || isStockVariance) {
                  actionHref = '/inventory';
                  actionLabel = 'Voir inventaire';
                } else if (isOrphanSerial) {
                  actionHref = '/equipment';
                  actionLabel = 'Traçabilité';
                }

                return (
                  <tr key={anomaly.id} className="hover:bg-[#18181b]/50 transition-colors">
                    {/* Severity */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          isCritical
                            ? 'bg-rose-950/40 text-rose-300 border-rose-500/40'
                            : 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>{isCritical ? 'CRITIQUE' : 'ATTENTION'}</span>
                      </span>
                    </td>

                    {/* Category Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isDisagreement && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-950/50 text-purple-300 border border-purple-500/30">
                          DÉSACCORD C1 ≠ C2
                        </span>
                      )}
                      {isStockVariance && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-950/50 text-amber-300 border border-amber-500/30">
                          ÉCART INVENTAIRE
                        </span>
                      )}
                      {isOutOfStock && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/50 text-rose-300 border border-rose-500/30">
                          RUPTURE DE STOCK
                        </span>
                      )}
                      {isLowStock && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-orange-950/50 text-orange-300 border border-orange-500/30">
                          SEUIL MINIMUM
                        </span>
                      )}
                      {isOrphanSerial && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950/50 text-sky-300 border border-sky-500/30">
                          SÉRIE HORS RAYON
                        </span>
                      )}
                    </td>

                    {/* Description */}
                    <td className="py-3 px-3">
                      <p className="font-medium text-white">{anomaly.title}</p>
                      <p className="text-[11px] text-[#a1a1aa] mt-0.5 leading-relaxed">
                        {anomaly.description}
                      </p>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-3 whitespace-nowrap text-[#a1a1aa] text-[11px]">
                      {anomaly.source === 'INVENTORY_AUDIT' && 'Audit Inventaire'}
                      {anomaly.source === 'STOCK_LEVEL' && 'Niveaux de Stock'}
                      {anomaly.source === 'TRACEABILITY' && 'Traçabilité S/N'}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <Link
                        href={actionHref}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#18181b] hover:bg-[#322c28] border border-[#3f3f46] hover:border-zinc-400 text-white text-[11px] font-medium rounded transition-colors"
                      >
                        <span>{actionLabel}</span>
                        <ArrowRight className="w-3 h-3 text-[#a1a1aa]" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
