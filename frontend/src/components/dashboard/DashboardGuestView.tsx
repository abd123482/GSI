'use client';

import React from 'react';
import { SignInButton } from '@clerk/nextjs';
import {
  Boxes,
  Layers,
  ClipboardCheck,
  ShieldCheck,
  Lock,
  ArrowRight,
  Activity,
  Terminal,
} from 'lucide-react';

export function DashboardGuestView() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[calc(100vh-3.5rem)]">
      <div className="w-full max-w-2xl bg-[#27272a] border border-[#3f3f46] rounded-2xl p-8 sm:p-12 shadow-2xl text-center space-y-8 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand Icon & Chip */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#18181b] border border-[#3f3f46] text-xs font-mono text-[#f4f4f5]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Plateforme de Gestion & Traçabilité Somépharm</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-semibold text-[#fafafa] tracking-tight">
            Système Central de Maintenance & Stocks
          </h1>

          <p className="text-sm text-[#d4d4d8] max-w-lg mx-auto leading-relaxed">
            Contrôle d'inventaire, traçabilité des numéros de série, gestion des emplacements et réconciliations en temps réel.
          </p>
        </div>

        {/* Feature Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
          <div className="p-4 bg-[#18181b] border border-[#3f3f46] rounded-xl space-y-1.5">
            <Boxes className="w-5 h-5 text-[#10b981]" />
            <h3 className="text-xs font-mono font-medium text-[#fafafa]">Stock & Articles</h3>
            <p className="text-[11px] text-[#a1a1aa]">Suivi des flux IN/OUT et alertes seuils min.</p>
          </div>

          <div className="p-4 bg-[#18181b] border border-[#3f3f46] rounded-xl space-y-1.5">
            <Layers className="w-5 h-5 text-[#38bdf8]" />
            <h3 className="text-xs font-mono font-medium text-[#fafafa]">Emplacements</h3>
            <p className="text-[11px] text-[#a1a1aa]">Cartographie par étagère et entrepôt.</p>
          </div>

          <div className="p-4 bg-[#18181b] border border-[#3f3f46] rounded-xl space-y-1.5">
            <ClipboardCheck className="w-5 h-5 text-[#f59e0b]" />
            <h3 className="text-xs font-mono font-medium text-[#fafafa]">Audits d'Inventaire</h3>
            <p className="text-[11px] text-[#a1a1aa]">Comptage aveugle et arbitrage des écarts.</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="pt-2 border-t border-[#3f3f46]">
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#fafafa] hover:bg-[#f4f4f5] text-[#18181b] text-sm font-semibold rounded-lg shadow-md transition-all cursor-pointer hover:scale-[1.01]"
            >
              <Lock className="w-4 h-4" />
              <span>Se connecter à votre espace Somépharm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </SignInButton>
          <p className="text-[11px] font-mono text-[#a1a1aa] mt-2.5">
            Accès sécurisé par authentification unifiée & rôles RBAC.
          </p>
        </div>
      </div>
    </div>
  );
}
