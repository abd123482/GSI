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
} from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

interface DashboardKpiGridProps {
  stats: DashboardStats;
}

export function DashboardKpiGrid({ stats }: DashboardKpiGridProps) {
  const { stockOverview, inventoryOverview } = stats;

  const serialAssignmentRate =
    stockOverview.totalSerials > 0
      ? Math.round((stockOverview.serialsWithShelf / stockOverview.totalSerials) * 100)
      : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Articles & Physical Units */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
            Articles & Volume
          </span>
          <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
            <Boxes className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-[#fafafa]">
              {stockOverview.totalArticles.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs font-mono text-[#a1a1aa]">articles</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5] pt-1">
            <span className="text-[#a1a1aa]">Unités en stock :</span>
            <span className="font-medium text-[#10b981]">
              {stockOverview.totalUnits.toLocaleString('fr-FR')} u.
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {stockOverview.totalStocks} entrepôt{stockOverview.totalStocks > 1 ? 's' : ''} • {stockOverview.totalShelves} emplacements
          </span>
          <Link
            href="/equipment"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Voir</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 2. Serial Numbers & Traceability */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
            Traçabilité S/N
          </span>
          <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
            <Barcode className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-[#fafafa]">
              {stockOverview.totalSerials.toLocaleString('fr-FR')}
            </span>
            <span className="text-xs font-mono text-[#a1a1aa]">numéros</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5] pt-1">
            <span className="text-[#a1a1aa]">Assignés aux rayons :</span>
            <span className={`font-medium ${serialAssignmentRate >= 90 ? 'text-[#10b981]' : 'text-[#f59e0b]'}`}>
              {stockOverview.serialsWithShelf} ({serialAssignmentRate}%)
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {stockOverview.totalSerials - stockOverview.serialsWithShelf} non assignés
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

      {/* 3. Low Stock & Reorder Alerts */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
            Santé du Stock & Alertes
          </span>
          <div className={`w-7 h-7 rounded-[3px] border flex items-center justify-center ${
            stockOverview.lowStockCount > 0
              ? 'bg-[#2d1616] border-[#451e1e] text-[#ef4444]'
              : 'bg-[#162b22] border-[#1e3d30] text-[#10b981]'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-mono font-semibold ${
              stockOverview.lowStockCount > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'
            }`}>
              {stockOverview.lowStockCount}
            </span>
            <span className="text-xs font-mono text-[#a1a1aa]">
              article{stockOverview.lowStockCount > 1 ? 's' : ''} critique{stockOverview.lowStockCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5] pt-1">
            <span className="text-[#a1a1aa]">État global :</span>
            <span className={`font-medium ${stockOverview.lowStockCount > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}`}>
              {stockOverview.lowStockCount > 0 ? 'Sous le seuil min' : 'Optimal'}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {stockOverview.lowStockCount > 0 ? 'Réappro. requis' : 'Aucune rupture'}
          </span>
          <Link
            href="/equipment"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Filtrer</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* 4. Inventory Audits & Discrepancies */}
      <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs relative overflow-hidden group hover:border-[#52525b] transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
            Audits & Inventaires
          </span>
          <div className="w-7 h-7 rounded-[3px] bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
            <ClipboardCheck className="w-3.5 h-3.5 text-[#f59e0b]" />
          </div>
        </div>

        <div className="mt-2 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-mono font-semibold text-[#fafafa]">
              {inventoryOverview.activeInventoriesCount}
            </span>
            <span className="text-xs font-mono text-[#a1a1aa]">en cours</span>
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-[#f4f4f5] pt-1">
            <span className="text-[#a1a1aa]">Attente arbitrage :</span>
            <span className={`font-medium ${inventoryOverview.pendingAdjudications > 0 ? 'text-[#f59e0b]' : 'text-[#10b981]'}`}>
              {inventoryOverview.pendingAdjudications} tâche{inventoryOverview.pendingAdjudications > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-[#3f3f46] flex items-center justify-between text-[11px] font-mono">
          <span className="text-[#a1a1aa]">
            {inventoryOverview.completedInventoriesCount} clôturés
          </span>
          <Link
            href="/inventory"
            className="text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-0.5 transition-colors"
          >
            <span>Gérer</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
