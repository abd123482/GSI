import { auth } from '@clerk/nextjs/server';
import { SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

export default async function Home() {
  const { userId } = await auth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f6f5f4] text-[#37352f]">
      <div className="w-full max-w-md bg-white border border-[#e5e3df] rounded-xl p-8 shadow-xs text-center space-y-6">
        {/* Notion Workspace Brand Mark */}
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-[#37352f] text-white font-bold text-2xl shadow-xs mx-auto">
          S
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
            Somipharm Workspace
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

            <SignUpButton mode="modal">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Créer un compte
              </button>
            </SignUpButton>
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
          </div>
        )}

        <div className="pt-4 border-t border-[#ede9e4] text-[11px] text-[#a4a097]">
          Somipharm S.A. • Workspace v1.0 • Design Notion
        </div>
      </div>
    </main>
  );
}