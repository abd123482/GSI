import { SignUp } from '@clerk/nextjs';
import { notionClerkAppearance } from '@/lib/notion-theme';

export default function SignUpPage() {
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
          Création de compte collaborateur
        </p>
      </div>

      {/* Notion styled SignUp card */}
      <SignUp appearance={notionClerkAppearance} />
    </main>
  );
}