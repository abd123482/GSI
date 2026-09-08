import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { notionClerkAppearance } from '@/lib/notion-theme';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function SignUpPage() {
  const allowPublicSignUp =
    process.env.NEXT_PUBLIC_ALLOW_PUBLIC_SIGN_UP === 'true';

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-[#f6f5f4] p-4 text-[#37352f]">
      {/* Notion-style minimal brand header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="w-11 h-11 rounded-lg bg-[#37352f] text-white font-bold text-xl flex items-center justify-center shadow-xs mb-3 border border-[#252420]">
          S
        </div>
        <h1 className="text-base font-semibold tracking-tight text-[#1a1a1a]">
          Somipharm Workspace
        </h1>
        <p className="text-xs text-[#787671] mt-0.5">
          Portail interne de maintenance et traçabilité
        </p>
      </div>

      {allowPublicSignUp ? (
        <SignUp appearance={notionClerkAppearance} />
      ) : (
        <div className="w-full max-w-sm bg-white border border-[#e5e3df] rounded-xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-10 h-10 rounded-full bg-[#fdf2e9] border border-[#fae5d3] text-[#d35400] flex items-center justify-center mx-auto">
            <ShieldAlert className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[#1a1a1a]">
              Inscriptions publiques désactivées
            </h2>
            <p className="text-xs text-[#5d5b54] leading-relaxed">
              L'accès à cet espace est strictement réservé aux collaborateurs
              Somipharm munis d'une invitation administrative.
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center gap-1.5 w-full px-4 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Retour à la connexion</span>
            </Link>
          </div>

          <div className="pt-3 border-t border-[#ede9e4] text-[11px] text-[#a4a097]">
            Veuillez contacter votre administrateur système pour obtenir un compte.
          </div>
        </div>
      )}
    </main>
  );
}