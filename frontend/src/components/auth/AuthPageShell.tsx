import Link from 'next/link';

import { GSILogo } from '@/components/navigation/GSILogo';

type AuthPageShellProps = {
  mode: 'sign-in' | 'sign-up';
  children: React.ReactNode;
};

const SWITCH_LINKS = {
  'sign-in': {
    prompt: 'Pas encore de compte ?',
    action: 'Créer un compte',
    href: '/sign-up',
  },
  'sign-up': {
    prompt: 'Vous avez déjà un compte ?',
    action: 'Se connecter',
    href: '/sign-in',
  },
} as const;

export function AuthPageShell({ mode, children }: AuthPageShellProps) {
  const switchLink = SWITCH_LINKS[mode];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#18181b] px-4 py-12 text-[#fafafa]">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <GSILogo className="h-8 w-auto" />

        <div className="w-full">{children}</div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-[#a1a1aa]">
            {switchLink.prompt}{' '}
            <Link
              href={switchLink.href}
              className="font-medium text-[#fafafa] underline underline-offset-4 hover:text-[#f4f4f5]"
            >
              {switchLink.action}
            </Link>
          </p>

          {mode === 'sign-up' && (
            <p className="max-w-xs text-[11px] leading-relaxed text-[#71717a]">
              Les nouveaux comptes doivent être approuvés par un administrateur
              avant d&apos;accéder à l&apos;application.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
