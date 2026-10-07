'use client';

import React from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Boxes,
  Layers,
  ClipboardList,
  Warehouse,
  ArrowRight,
  User,
} from 'lucide-react';

interface DashboardRestrictedViewProps {
  userName?: string | null;
  roleName?: string | null;
  canReadEquipment?: boolean;
  canReadShelves?: boolean;
  canReadStock?: boolean;
  canReadInventory?: boolean;
}

export function DashboardRestrictedView({
  userName,
  roleName,
  canReadEquipment = true,
  canReadShelves = true,
  canReadStock = true,
  canReadInventory = true,
}: DashboardRestrictedViewProps) {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      {/* Notice Card */}
      <div className="p-6 bg-[#27272a] border border-[#3f3f46] rounded-xl text-left space-y-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#fafafa]">
              Bienvenue sur Somépharm Maintenance, {userName || 'Utilisateur'}
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono text-[#a1a1aa]">
              <span>Rôle assigné :</span>
              <span className="text-[#f4f4f5] font-bold uppercase">{roleName || 'STANDARD'}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#d4d4d8] leading-relaxed pt-1">
          L'accès au <strong>Tableau de Bord Exécutif</strong> est réservé aux administrateurs ou aux rôles disposant de la permission <code className="text-[#fafafa] bg-[#18181b] px-1 py-0.5 rounded">dashboard.read</code>. Vous pouvez néanmoins accéder directement aux modules opérationnels qui vous sont attribués ci-dessous :
        </p>
      </div>

      {/* Allowed Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {canReadEquipment && (
          <Link
            href="/equipment"
            className="p-5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] hover:border-[#52525b] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#fafafa] group-hover:text-white">
                Articles & Numéros de Série
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Consulter les fiches matériel, quantités physiques et traçabilité par codes barres.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#f4f4f5] group-hover:text-[#fafafa] gap-1">
              <span>Accéder au registre</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadShelves && (
          <Link
            href="/shelves"
            className="p-5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] hover:border-[#52525b] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#fafafa] group-hover:text-white">
                Gestion des Emplacements
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Cartographie des étagères et rangement physique par zone de stockage.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#f4f4f5] group-hover:text-[#fafafa] gap-1">
              <span>Consulter les rayons</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadStock && (
          <Link
            href="/stocks"
            className="p-5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] hover:border-[#52525b] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
                <Warehouse className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#fafafa] group-hover:text-white">
                Entrepôts & Dépôts
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Vue d'ensemble des entrepôts et zones de stockage principales.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#f4f4f5] group-hover:text-[#fafafa] gap-1">
              <span>Voir les dépôts</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadInventory && (
          <Link
            href="/inventory"
            className="p-5 bg-[#27272a] hover:bg-[#3f3f46] border border-[#3f3f46] hover:border-[#52525b] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#3f3f46] flex items-center justify-center text-[#fafafa]">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#fafafa] group-hover:text-white">
                Inventaires & Missions
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Participer aux campagnes de comptage et de réconciliation sur le terrain.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#f4f4f5] group-hover:text-[#fafafa] gap-1">
              <span>Mes tâches de comptage</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
