'use client';

import React from 'react';
import Link from 'next/link';
import {
  Boxes,
  Barcode,
  AlertTriangle,
  ClipboardCheck,
  ArrowUpRight,
  ShieldAlert,
  CheckCircle2,
  Warehouse,
  Flame,
  AlertOctagon,
} from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

interface DashboardKpiGridProps {
  stats: DashboardStats;
}

export function DashboardKpiGrid({ stats }: DashboardKpiGridProps) {
  const anomaliesOverview = stats?.anomaliesOverview ?? {
    totalAnomalies: 0,
    criticalCount: 0,
    warningCount: 0,
    inventoryIssuesCount: 0,
    stockAlertsCount: 0,
    orphanSerialsCount: 0,
    items: [],
  };

  const stockOverview = {
    totalArticles: stats?.stockOverview?.totalArticles ?? 0,
    totalUnits: stats?.stockOverview?.totalUnits ?? 0,
    totalSerials: stats?.stockOverview?.totalSerials ?? 0,
    serialsWithShelf: stats?.stockOverview?.serialsWithShelf ?? 0,
    unassignedSerials: stats?.stockOverview?.unassignedSerials ?? 0,
    lowStockCount: stats?.stockOverview?.lowStockCount ?? 0,
    outOfStockCount: stats?.stockOverview?.outOfStockCount ?? 0,
    healthyStockCount: stats?.stockOverview?.healthyStockCount ?? 0,
    totalShelves: stats?.stockOverview?.totalShelves ?? 0,
    occupiedShelves: stats?.stockOverview?.occupiedShelves ?? 0,
    emptyShelves: stats?.stockOverview?.emptyShelves ?? 0,
    totalStocks: stats?.stockOverview?.totalStocks ?? 0,
    lowStockItems: stats?.stockOverview?.lowStockItems ?? [],
    outOfStockItems: stats?.stockOverview?.outOfStockItems ?? [],
    stockDistribution: stats?.stockOverview?.stockDistribution ?? [],
  };

  const inventoryOverview = {
    totalInventories: stats?.inventoryOverview?.totalInventories ?? 0,
    activeInventoriesCount: stats?.inventoryOverview?.activeInventoriesCount ?? 0,
    completedInventoriesCount: stats?.inventoryOverview?.completedInventoriesCount ?? 0,
    pendingAdjudications: stats?.inventoryOverview?.pendingAdjudications ?? 0,
    totalWorkUnits: stats?.inventoryOverview?.totalWorkUnits ?? 0,
    convergedWorkUnits: stats?.inventoryOverview?.convergedWorkUnits ?? 0,
    divergentWorkUnits: stats?.inventoryOverview?.divergentWorkUnits ?? 0,
    pendingWorkUnits: stats?.inventoryOverview?.pendingWorkUnits ?? 0,
    accuracyRate: stats?.inventoryOverview?.accuracyRate ?? 100,
    totalIssues: stats?.inventoryOverview?.totalIssues ?? 0,
    openIssuesCount: stats?.inventoryOverview?.openIssuesCount ?? 0,
    resolvedIssuesCount: stats?.inventoryOverview?.resolvedIssuesCount ?? 0,
    activeCampaigns: stats?.inventoryOverview?.activeCampaigns ?? [],
  };

  const serialAssignmentRate =
    stockOverview.totalSerials > 0
      ? Math.round((stockOverview.serialsWithShelf / stockOverview.totalSerials) * 100)
      : 100;

  const shelfOccupancyRate =
    stockOverview.totalShelves > 0
      ? Math.round((stockOverview.occupiedShelves / stockOverview.totalShelves) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Calculs Stock & Volume Physique */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
              Stock & Volume Calculé
            </span>
            <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
              <Boxes className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-[#fafafa]">
                {stockOverview.totalUnits.toLocaleString('fr-FR')}
              </span>
              <span className="text-xs font-mono text-[#a1a1aa]">unités physiques</span>
            </div>

            <p className="text-xs font-mono text-[#f4f4f5]">
              Sur <span className="font-semibold text-white">{stockOverview.totalArticles}</span> références enregistrées
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30">
                {stockOverview.healthyStockCount} sains
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/30">
                {stockOverview.lowStockCount} bas
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/30">
                {stockOverview.outOfStockCount} ruptures
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {stockOverview.totalStocks} dépôt{stockOverview.totalStocks > 1 ? 's' : ''} • {stockOverview.occupiedShelves}/{stockOverview.totalShelves} rayons ({shelfOccupancyRate}%)
          </span>
          <Link
            href="/equipment"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Détails</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 2. Traçabilité S/N & Localisation */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
              Traçabilité S/N
            </span>
            <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
              <Barcode className="w-3.5 h-3.5 text-sky-400" />
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-[#fafafa]">
                {stockOverview.totalSerials.toLocaleString('fr-FR')}
              </span>
              <span className="text-xs font-mono text-[#a1a1aa]">séries actives</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5]">
              <span className="text-[#a1a1aa]">Localisés sur rayon :</span>
              <span className={`font-semibold ${serialAssignmentRate >= 90 ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
                {stockOverview.serialsWithShelf} ({serialAssignmentRate}%)
              </span>
            </div>

            <div className="w-full h-1.5 bg-[#18181b] rounded-full overflow-hidden border border-[#3f3f46]/40">
              <div
                className="h-full bg-sky-400 rounded-full transition-all"
                style={{ width: `${serialAssignmentRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className={stockOverview.unassignedSerials > 0 ? 'text-amber-400 font-medium' : 'text-[#a1a1aa]'}>
            {stockOverview.unassignedSerials} hors rayon / orphelins
          </span>
          <Link
            href="/equipment"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Gérer</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 3. Audits & Conformité d'Inventaire */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
              Exactitude Inventaires
            </span>
            <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-semibold text-white">
                {inventoryOverview.accuracyRate}%
              </span>
              <span className="text-xs font-mono text-[#a1a1aa]">conformité</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5]">
              <span className="text-[#a1a1aa]">Unités évaluées :</span>
              <span className="font-semibold text-white">{inventoryOverview.totalWorkUnits}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono pt-0.5">
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-medium">
                {inventoryOverview.convergedWorkUnits} conformes
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/30 font-medium">
                {inventoryOverview.divergentWorkUnits} désaccords C1/C2
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {inventoryOverview.activeInventoriesCount} active{inventoryOverview.activeInventoriesCount > 1 ? 's' : ''} • {inventoryOverview.completedInventoriesCount} clôturée{inventoryOverview.completedInventoriesCount > 1 ? 's' : ''}
          </span>
          <Link
            href="/inventory"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Campagnes</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 4. Centre des Anomalies & Alertes */}
      <div className={`p-4 rounded-[4px] shadow-2xs relative overflow-hidden group transition-colors flex flex-col justify-between border ${
        anomaliesOverview.criticalCount > 0
          ? 'bg-[#27272a] border-rose-500/40 hover:border-rose-400'
          : anomaliesOverview.totalAnomalies > 0
          ? 'bg-[#27272a] border-amber-500/40 hover:border-amber-400'
          : 'bg-[#27272a] border-[#3f3f46] hover:border-[#52525b]'
      }`}>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
              Anomalies Détectées
            </span>
            <div className={`w-7 h-7 rounded-[3px] border flex items-center justify-center ${
              anomaliesOverview.criticalCount > 0
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
            }`}>
              <AlertOctagon className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2 space-y-1.5">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-semibold ${
                anomaliesOverview.criticalCount > 0
                  ? 'text-rose-400'
                  : anomaliesOverview.totalAnomalies > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}>
                {anomaliesOverview.totalAnomalies}
              </span>
              <span className="text-xs font-mono text-[#a1a1aa]">anomalie{anomaliesOverview.totalAnomalies > 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[#a1a1aa]">Gravité :</span>
              <span className="font-semibold text-rose-400">
                {anomaliesOverview.criticalCount} critique{anomaliesOverview.criticalCount > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono pt-0.5">
              <span className="px-1.5 py-0.5 rounded bg-[#18181b] text-rose-300 border border-rose-500/30">
                {anomaliesOverview.inventoryIssuesCount} inventaire
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#18181b] text-amber-300 border border-amber-500/30">
                {anomaliesOverview.stockAlertsCount} stocks
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#18181b] text-sky-300 border border-sky-500/30">
                {anomaliesOverview.orphanSerialsCount} séries
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {anomaliesOverview.totalAnomalies === 0 ? 'Système 100% conforme' : 'Action requise'}
          </span>
          <a
            href="#anomalies-section"
            className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-0.5 transition-colors font-medium"
          >
            <span>Inspecter</span>
            <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
