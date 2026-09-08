import { auth } from '@clerk/nextjs/server';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { AuthStatusCard } from '@/components/auth/AuthStatusCard';

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f6f5f4] text-[#37352f]">
      <div className="w-full max-w-md bg-white border border-[#e5e3df] rounded-xl p-8 shadow-xs text-center space-y-6">
        {/* Notion Workspace Brand Mark */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#37352f] text-white font-bold text-2xl shadow-xs mx-auto">
          Y
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
            Yacine Workspace
          </h1>
          <p className="text-sm text-[#5d5b54]">
            Plateforme interne de maintenance et traçabilité du stock
          </p>
        </div>

        {!userId ? (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </SignInButton>

            {process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGN_UP === 'true' && (
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="flex-1 px-4 py-2.5 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-sm font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Créer un compte
                </button>
              </SignUpButton>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="p-1 rounded-full border border-[#e5e3df]">
              <UserButton />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-[#1a1a1a]">
                Session active
              </h2>
              <p className="text-xs text-[#5d5b54]">
                Vous êtes connecté au portail de maintenance
              </p>
            </div>

            {/* Test & Live verification of Clerk -> NestJS -> SQL Server */}
            <AuthStatusCard />

            {/* Quick Access Cards */}
            <div className="w-full pt-2 space-y-2.5">
              {/* Shelves Module */}
              <a
                href="/shelves"
                className="w-full flex items-center justify-between p-3.5 bg-[#fafaf9] hover:bg-[#f0eeec] border border-[#e5e3df] rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#e6e0f5] border border-[#d6b6f6] flex items-center justify-center text-[#7b3ff2] group-hover:scale-105 transition-transform">
                    <span className="text-sm font-bold">📦</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#1a1a1a]">
                      Gestion des Étagères (Shelf Services)
                    </h3>
                    <p className="text-[11px] text-[#5d5b54]">
                      Créer une étagère, pagination, Zod & tuples SSMS
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#5645d4] group-hover:translate-x-0.5 transition-transform">
                  Ouvrir →
                </span>
              </a>

              {/* Equipment & Serial Numbers Module */}
              <a
                href="/equipment"
                className="w-full flex items-center justify-between p-3.5 bg-[#fafaf9] hover:bg-[#f0eeec] border border-[#e5e3df] rounded-xl text-left transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#dcecfa] border border-[#b2d7f7] flex items-center justify-center text-[#0075de] group-hover:scale-105 transition-transform">
                    <span className="text-sm font-bold">⚡</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#1a1a1a]">
                      Équipements & Numéros de Série
                    </h3>
                    <p className="text-[11px] text-[#5d5b54]">
                      Mouvement d'entrée, codes 32-bit & traçabilité unitaire
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#5645d4] group-hover:translate-x-0.5 transition-transform">
                  Ouvrir →
                </span>
              </a>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-[#ede9e4] text-[11px] text-[#a4a097]">
          Somépharm  • Workspace • Abderrahmane Kassoul
        </div>
      </div>
    </main>
  );
}