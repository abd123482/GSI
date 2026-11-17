'use client';

import React from 'react';
import { SignInButton, SignUpButton } from '@clerk/nextjs';
import {
  Boxes,
  Layers,
  ClipboardCheck,
  LogIn,
  UserPlus,
  ArrowRight,
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

        {/* Call to Action: Choix d'authentification */}
        <div className="pt-4 border-t border-[#3f3f46] space-y-4">
          <p className="text-xs font-mono text-[#a1a1aa]">
            Accéder à la plateforme :
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
            {/* Option 1: Compte existant */}
            <SignInButton mode="modal">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3.5 bg-[#fafafa] hover:bg-[#f4f4f5] text-[#18181b] rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.01] text-left group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#18181b]/10 text-[#18181b] shrink-0">
                  <LogIn className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Se connecter</span>
                    <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <span className="text-[11px] text-zinc-600 block truncate">
                    J&apos;ai déjà un compte
                  </span>
                </div>
              </button>
            </SignInButton>

            {/* Option 2: Nouveau compte */}
            <SignUpButton mode="modal">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3.5 bg-[#18181b] hover:bg-[#27272a] border border-[#3f3f46] hover:border-zinc-500 text-[#fafafa] rounded-xl shadow-md transition-all cursor-pointer hover:scale-[1.01] text-left group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Créer un compte</span>
                    <ArrowRight className="w-4 h-4 text-emerald-400/70 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </div>
                  <span className="text-[11px] text-[#a1a1aa] block truncate">
                    Nouveau compte (sans compte)
                  </span>
                </div>
              </button>
            </SignUpButton>
          </div>

          <p className="text-[11px] font-mono text-[#71717a]">
            Accès sécurisé par authentification unifiée & rôles RBAC.
          </p>
        </div>
      </div>
    </div>
  );
}
