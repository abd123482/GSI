'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface DashboardHeaderProps {
  userName?: string | null;
  roleName?: string | null;
  isAdmin?: boolean;
}

export function DashboardHeader({
  userName,
  roleName,
  isAdmin,
}: DashboardHeaderProps) {
  const todayFormatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3f3f46]">
      {/* Title & Identity */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa] font-mono">
          <span>somepharm</span>
          <span>/</span>
          <span className="text-[#fafafa]">tableau de bord</span>
          <span className="text-white/30">•</span>
          <span className="capitalize">{todayFormatted}</span>
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-0.5">
          <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#fafafa]">
            Tableau de Bord Exécutif
          </h1>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[2px] font-mono text-[11px] bg-[#162b22] border border-[#1e3d30] text-[#10b981]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isAdmin ? 'ADMINISTRATEUR SUPRÊME' : (roleName || 'UTILISATEUR AUTORISÉ')}</span>
          </div>
        </div>

        <p className="text-xs text-[#d4d4d8]">
          Vue d'ensemble et contrôle en temps réel du stock, de la traçabilité et des audits d'inventaire.
        </p>
      </div>
    </div>
  );
}
