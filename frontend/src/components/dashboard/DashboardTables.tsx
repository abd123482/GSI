'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  ClipboardList,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

interface DashboardTablesProps {
  stats: DashboardStats;
}

export function DashboardTables({ stats }: DashboardTablesProps) {
  const { movementOverview, inventoryOverview, stockOverview } = stats;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Panel 1: Recent Movements (Takes 2 cols on lg screens) */}
      <div className="lg:col-span-2 p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#f4f4f5]" />
            <h2 className="text-xs font-mono font-medium text-[#fafafa] uppercase tracking-wider">
              Derniers Mouvements Enregistrés
            </h2>
          </div>
          <Link
            href="/equipment"
            className="text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-1 transition-colors"
          >
            <span>Historique complet</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {movementOverview.recentMovements.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-[#a1a1aa]">
            Aucun mouvement récent enregistré.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#18181b] border-b border-[#3f3f46] text-[#a1a1aa] text-[10px] uppercase">
                <tr>
                  <th className="py-2 px-2.5">Type</th>
                  <th className="py-2 px-2.5">Article</th>
                  <th className="py-2 px-2.5 text-center">Quantité</th>
                  <th className="py-2 px-2.5">Trajet Emplacement</th>
                  <th className="py-2 px-2.5">N° Série</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3f3f46]/60 text-[#f4f4f5]">
                {movementOverview.recentMovements.flatMap(header =>
                  header.items?.length ? header.items.map(item => ({ ...header, ...item, rowKey: item.mouvementEquipmentId })) : [{ ...header, rowKey: header.mouvementId }],
                ).map((m) => {
                  const typeUpper = m.mouvementStatus ? 'OUT' : 'IN';
                  const isIN = typeUpper === 'IN';
                  const isOUT = typeUpper === 'OUT';

                  return (
                    <tr key={m.rowKey} className="hover:bg-[#18181b]/50 transition-colors">
                      {/* Type Badge */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-[2px] text-[10px] font-bold border ${
                            isIN
                              ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                              : isOUT
                              ? 'bg-[#2d1616] text-[#ef4444] border-[#451e1e]'
                              : 'bg-[#152836] text-[#38bdf8] border-[#1c3c54]'
                          }`}
                        >
                          {m.mouvementStatus ? 'OUT' : 'IN'}
                        </span>
                      </td>

                      {/* Equipment Name */}
                      <td className="py-2 px-2.5 whitespace-nowrap font-medium text-[#fafafa] max-w-[180px] truncate">
                        {m.equipmentName}
                        <div className="text-[9px] text-[#a1a1aa]" title={m.mouvementId}>Mvt {m.mouvementId.slice(0, 8)}</div>
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap font-bold">
                        {m.mouvementQuantity} u.
                      </td>

                      {/* Path */}
                      <td className="py-2 px-2.5 whitespace-nowrap text-[11px] text-[#a1a1aa]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#f4f4f5]">{m.sourceShelfName || 'Externe'}</span>
                          <span>→</span>
                          <span className="text-[#fafafa] font-medium">{m.destinationShelfName || 'Sortie'}</span>
                        </div>
                      </td>

                      {/* Serial Number */}
                      <td className="py-2 px-2.5 whitespace-nowrap text-[11px]">
                        {m.serialNumberCode ? (
                          <span className="text-[#fafafa] bg-[#18181b] px-1.5 py-0.5 rounded border border-[#3f3f46]">
                            {m.serialNumberCode}
                          </span>
                        ) : (
                          <span className="text-[#a1a1aa]/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Panel 2 & 3: Right Column (Inventories & Low Stock Alerts) */}
      <div className="space-y-4">
        {/* Active Inventories */}
        <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#f59e0b]" />
              <h2 className="text-xs font-mono font-medium text-[#fafafa] uppercase tracking-wider">
                Campagnes d&apos;Inventaire
              </h2>
            </div>
            <Link
              href="/inventory"
              className="text-[11px] font-mono text-[#a1a1aa] hover:text-[#fafafa] inline-flex items-center gap-1 transition-colors"
            >
              <span>Voir tout</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {inventoryOverview.activeCampaigns.length === 0 ? (
            <div className="py-6 text-center text-xs font-mono text-[#a1a1aa]">
              Aucune campagne d&apos;inventaire active.
            </div>
          ) : (
            <div className="space-y-2.5">
              {inventoryOverview.activeCampaigns.map((inv) => (
                <Link
                  key={inv.inventoryId}
                  href={`/inventory`}
                  className="block p-2.5 bg-[#18181b] hover:bg-[#322c28] border border-[#3f3f46] rounded-[3px] transition-colors"
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-medium text-[#fafafa] truncate max-w-[170px]">
                      {inv.title}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/50 text-amber-300 border border-amber-500/30">
                      {inv.status}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#a1a1aa]">
                      <span>Comptage ({inv.completedWorkUnits}/{inv.totalWorkUnits})</span>
                      <span className="font-bold text-[#fafafa]">{inv.progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#1a1715] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#f59e0b] rounded-full transition-all duration-300"
                        style={{ width: `${inv.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="p-4 bg-[#27272a] border border-[#3f3f46] rounded-[4px] shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
              <h2 className="text-xs font-mono font-medium text-[#fafafa] uppercase tracking-wider">
                Articles sous seuil d&apos;alerte
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[#ef4444] font-semibold">
              {stockOverview.lowStockCount} alerte{stockOverview.lowStockCount > 1 ? 's' : ''}
            </span>
          </div>

          {stockOverview.lowStockItems.length === 0 ? (
            <div className="py-4 text-center text-xs font-mono text-[#10b981] flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Tous les articles respectent le seuil minimum.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {stockOverview.lowStockItems.map((item) => (
                <div
                  key={item.equipmentId}
                  className="p-2 bg-[#18181b] border border-[#451e1e] rounded-[3px] flex items-center justify-between text-xs font-mono"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-[#fafafa] truncate max-w-[150px]">
                      {item.equipmentName}
                    </p>
                    <p className="text-[10px] text-[#a1a1aa]">
                      Seuil min : {item.minequipmentQuantity} u.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-[#2d1616] text-[#ef4444] border border-[#451e1e] font-bold text-xs">
                      {item.equipmentQuantity} u.
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
