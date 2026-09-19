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
      <div className="p-6 bg-[#383330] border border-[#3f3a36] rounded-xl text-left space-y-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#f7f5f0]">
              Bienvenue sur Somépharm Maintenance, {userName || 'Utilisateur'}
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
              <span>Rôle assigné :</span>
              <span className="text-[#dad2c1] font-bold uppercase">{roleName || 'STANDARD'}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#c9c0ad] leading-relaxed pt-1">
          L'accès au <strong>Tableau de Bord Exécutif</strong> est réservé aux administrateurs ou aux rôles disposant de la permission <code className="text-[#f7f5f0] bg-[#2b2622] px-1 py-0.5 rounded">dashboard.read</code>. Vous pouvez néanmoins accéder directement aux modules opérationnels qui vous sont attribués ci-dessous :
        </p>
      </div>

      {/* Allowed Modules Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {canReadEquipment && (
          <Link
            href="/equipment"
            className="p-5 bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] hover:border-[#4d4742] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
                <Boxes className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#f7f5f0] group-hover:text-white">
                Articles & Numéros de Série
              </h3>
              <p className="text-xs text-[#aea69c]">
                Consulter les fiches matériel, quantités physiques et traçabilité par codes barres.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#dad2c1] group-hover:text-[#f7f5f0] gap-1">
              <span>Accéder au registre</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadShelves && (
          <Link
            href="/shelves"
            className="p-5 bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] hover:border-[#4d4742] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#f7f5f0] group-hover:text-white">
                Gestion des Emplacements
              </h3>
              <p className="text-xs text-[#aea69c]">
                Cartographie des étagères et rangement physique par zone de stockage.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#dad2c1] group-hover:text-[#f7f5f0] gap-1">
              <span>Consulter les rayons</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadStock && (
          <Link
            href="/stocks"
            className="p-5 bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] hover:border-[#4d4742] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
                <Warehouse className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#f7f5f0] group-hover:text-white">
                Entrepôts & Dépôts
              </h3>
              <p className="text-xs text-[#aea69c]">
                Vue d'ensemble des entrepôts et zones de stockage principales.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#dad2c1] group-hover:text-[#f7f5f0] gap-1">
              <span>Voir les dépôts</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}

        {canReadInventory && (
          <Link
            href="/inventory"
            className="p-5 bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] hover:border-[#4d4742] rounded-xl transition-all group shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="w-9 h-9 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0]">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm text-[#f7f5f0] group-hover:text-white">
                Inventaires & Missions
              </h3>
              <p className="text-xs text-[#aea69c]">
                Participer aux campagnes de comptage et de réconciliation sur le terrain.
              </p>
            </div>
            <div className="mt-4 flex items-center text-xs font-mono text-[#dad2c1] group-hover:text-[#f7f5f0] gap-1">
              <span>Mes tâches de comptage</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
