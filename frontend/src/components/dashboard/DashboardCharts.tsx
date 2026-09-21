'use client';

import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from 'recharts';
import { ArrowRightLeft, Warehouse } from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

interface DashboardChartsProps {
  stats: DashboardStats;
}

export function DashboardCharts({ stats }: DashboardChartsProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { movementOverview, stockOverview } = stats;

  const movementData = [
    {
      name: 'Entrées (IN)',
      count: movementOverview.inCount,
      fill: '#10b981',
      description: 'Réceptions et créations',
    },
    {
      name: 'Sorties (OUT)',
      count: movementOverview.outCount,
      fill: '#ef4444',
      description: 'Consommation & maintenance',
    },
    {
      name: 'Transferts',
      count: movementOverview.transferCount,
      fill: '#38bdf8',
      description: 'Déplacements inter-rayons',
    },
    ...(movementOverview.mixedCount ? [{
      name: 'Mixtes', count: movementOverview.mixedCount, fill: '#a78bfa',
      description: 'Un document avec plusieurs directions',
    }] : []),
    ...(movementOverview.otherCount ? [{
      name: 'Autres', count: movementOverview.otherCount, fill: '#aea69c',
      description: 'Statuts historiques',
    }] : []),
  ];

  const warehouseData = stockOverview.stockDistribution.map((s) => ({
    name: s.stockName.length > 18 ? `${s.stockName.substring(0, 16)}...` : s.stockName,
    fullName: s.stockName,
    units: s.totalUnits,
    shelves: s.shelvesCount,
  }));

  if (!isMounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-72 bg-[#383330] border border-[#3f3a36] rounded-[4px] animate-pulse" />
        <div className="h-72 bg-[#383330] border border-[#3f3a36] rounded-[4px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Movement Volume Chart */}
      <div className="p-4 bg-[#383330] border border-[#3f3a36] rounded-[4px] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4 text-[#dad2c1]" />
            <h2 className="text-xs font-mono font-medium text-[#f7f5f0] uppercase tracking-wider">
              Flux des Mouvements de Stock
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#aea69c]">
            {movementOverview.totalMovements} mouvement{movementOverview.totalMovements > 1 ? 's' : ''} au total
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          {movementOverview.totalMovements === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-[#aea69c]">
              Aucun mouvement enregistré pour le moment.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3a36" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#aea69c"
                  tick={{ fill: '#aea69c', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#aea69c"
                  tick={{ fill: '#aea69c', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#2b2622] border border-[#3f3a36] p-2.5 rounded-[3px] shadow-xl text-xs font-mono">
                          <p className="font-semibold text-white">{data.name}</p>
                          <p className="text-[11px] text-[#aea69c]">{data.description}</p>
                          <p className="text-sm font-bold mt-1" style={{ color: data.fill }}>
                            {data.count} transaction{data.count > 1 ? 's' : ''}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {movementData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* 2. Stock Distribution by Warehouse */}
      <div className="p-4 bg-[#383330] border border-[#3f3a36] rounded-[4px] shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-[#dad2c1]" />
            <h2 className="text-xs font-mono font-medium text-[#f7f5f0] uppercase tracking-wider">
              Répartition du Stock par Dépôt
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#aea69c]">
            {warehouseData.length} entrepôt{warehouseData.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="h-56 w-full pt-2">
          {warehouseData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-[#aea69c]">
              Aucun entrepôt configuré.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={warehouseData}
                layout="vertical"
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3a36" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="#aea69c"
                  tick={{ fill: '#aea69c', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#aea69c"
                  tick={{ fill: '#f7f5f0', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#2b2622] border border-[#3f3a36] p-2.5 rounded-[3px] shadow-xl text-xs font-mono">
                          <p className="font-semibold text-white">{data.fullName}</p>
                          <p className="text-[11px] text-[#aea69c] mt-0.5">{data.shelves} emplacements physiques</p>
                          <p className="text-sm font-bold text-[#10b981] mt-1">
                            {data.units} unité{data.units > 1 ? 's' : ''}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="units" fill="#d97706" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
