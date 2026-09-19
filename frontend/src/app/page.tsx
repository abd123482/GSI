'use client';

import React from 'react';
import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/use-permissions';
import { useDashboard } from '@/hooks/use-dashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardKpiGrid } from '@/components/dashboard/DashboardKpiGrid';
import { DashboardCharts } from '@/components/dashboard/DashboardCharts';
import { DashboardTables } from '@/components/dashboard/DashboardTables';
import { DashboardRestrictedView } from '@/components/dashboard/DashboardRestrictedView';
import { DashboardGuestView } from '@/components/dashboard/DashboardGuestView';

export default function HomePage() {
  const { isSignedIn, isLoaded } = useAuth();
  const {
    authUser,
    roleName,
    isAdmin,
    canReadDashboard,
    canCreateEquipment,
    canCreateInventory,
    canManageRoles,
    canReadEquipment,
    canReadShelf,
    canReadStock,
    canReadInventory,
    isLoading: isAuthLoading,
  } = usePermissions();

  const {
    stats,
    isLoading: isDashboardLoading,
    refetch,
    isRefetching,
  } = useDashboard();

  // 1. Loading State
  if (!isLoaded || isAuthLoading) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>Chargement de l'espace Somépharm...</span>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated Guest View
  if (!isSignedIn) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
        <DashboardGuestView />
      </main>
    );
  }

  // 3. Authenticated but lacks dashboard.read Permission
  if (!canReadDashboard) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
        <DashboardRestrictedView
          userName={authUser?.userName}
          roleName={roleName}
          canReadEquipment={canReadEquipment}
          canReadShelves={canReadShelf}
          canReadStock={canReadStock}
          canReadInventory={canReadInventory}
        />
      </main>
    );
  }

  // 4. Authorized Executive Dashboard View (Admin or dashboard.read)
  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <DashboardHeader
          userName={authUser?.userName}
          roleName={roleName}
          isAdmin={isAdmin}
        />

        {isDashboardLoading && !stats ? (
          <div className="py-24 flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#aea69c]">
            <Loader2 className="w-5 h-5 animate-spin text-[#f7f5f0]" />
            <span>Chargement des indicateurs et graphiques du tableau de bord...</span>
          </div>
        ) : stats ? (
          <>
            {/* Row 1: KPI Cards Grid */}
            <DashboardKpiGrid stats={stats} />

            {/* Row 2: Recharts Visualizations (Flux & Entrepôts) */}
            <DashboardCharts stats={stats} />

            {/* Row 3: Operational Data Tables (Mouvements, Inventaires, Alertes) */}
            <DashboardTables stats={stats} />
          </>
        ) : (
          <div className="py-20 text-center text-xs font-mono text-rose-400 bg-[#2d1616] border border-[#451e1e] rounded p-6">
            Impossible de charger les données du tableau de bord. Veuillez vérifier votre connexion au serveur backend.
          </div>
        )}
      </div>
    </main>
  );
}
