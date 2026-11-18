'use client';

import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/nextjs';
import { warpClerkAppearance } from '@/lib/warp-theme';
import { GSILogo } from '@/components/navigation/GSILogo';
import { LogIn, UserPlus } from 'lucide-react';

export function DashboardGuestView() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 min-h-screen bg-[#18181b]">
      <div className="w-full max-w-[420px] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        {/* Logo directly above the login panel */}
        <div className="mb-6 flex flex-col items-center">
          <GSILogo className="h-16 sm:h-20 w-auto drop-shadow-lg" />
        </div>

        {/* Switcher Tab between Login & Registration */}
        <div className="w-full grid grid-cols-2 rounded-xl bg-[#27272a] p-1 border border-[#3f3f46] mb-4 shadow-sm">
          <button
            type="button"
            onClick={() => setMode('sign-in')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
              mode === 'sign-in'
                ? 'bg-[#fafafa] text-[#18181b] shadow-md'
                : 'text-[#a1a1aa] hover:text-[#fafafa]'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Connexion</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('sign-up')}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all cursor-pointer ${
              mode === 'sign-up'
                ? 'bg-[#fafafa] text-[#18181b] shadow-md'
                : 'text-[#a1a1aa] hover:text-[#fafafa]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Inscription</span>
          </button>
        </div>

        {/* Embedded Clerk Form (Login or Register) */}
        <div className="w-full flex justify-center">
          {mode === 'sign-in' ? (
            <SignIn
              routing="hash"
              forceRedirectUrl="/"
              appearance={warpClerkAppearance}
            />
          ) : (
            <SignUp
              routing="hash"
              forceRedirectUrl="/"
              appearance={warpClerkAppearance}
            />
          )}
        </div>
      </div>
    </div>
  );
}
