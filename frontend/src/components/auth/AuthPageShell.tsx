import Link from 'next/link';

type AuthPageShellProps = {
  mode: 'sign-in' | 'sign-up';
  children: React.ReactNode;
};

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#f6f5f4] px-4 py-10 text-[#37352f]">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1a1a1a] text-xl font-bold text-white shadow-xs">
            Y
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1a1a1a]">
            Yacine Workspace
          </h1>
          <p className="mt-1 text-sm text-[#787671]">
            Plateforme de maintenance et de traçabilité
          </p>
        </div>

        <nav aria-label="Authentification" className="mb-5 flex w-full max-w-sm gap-1 rounded-lg border border-[#e5e3df] bg-white p-1">
          <Link
            href="/sign-in"
            aria-current={mode === 'sign-in' ? 'page' : undefined}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${mode === 'sign-in' ? 'bg-[#5645d4] text-white' : 'text-[#5d5b54] hover:bg-[#f0eeec]'}`}
          >
            Se connecter
          </Link>
          <Link
            href="/sign-up"
            aria-current={mode === 'sign-up' ? 'page' : undefined}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${mode === 'sign-up' ? 'bg-[#5645d4] text-white' : 'text-[#5d5b54] hover:bg-[#f0eeec]'}`}
          >
            Créer un compte
          </Link>
        </nav>

        {children}

        {mode === 'sign-up' && (
          <p className="mt-5 max-w-sm text-center text-xs leading-relaxed text-[#787671]">
            Les nouveaux comptes doivent être approuvés par un administrateur avant d&apos;accéder à l&apos;application.
          </p>
        )}
      </div>
    </main>
  );
}
