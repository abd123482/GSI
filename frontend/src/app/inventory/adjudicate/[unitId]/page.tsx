'use client';

import {
  useEffect,
} from 'react';
import {
  useRouter,
} from 'next/navigation';
import {
  Loader2,
} from 'lucide-react';

/**
 * Manual adjudication is no longer part of the current workflow.
 *
 * C1/C2 mismatch creates a normal C3 counting task for that work unit.
 */
export default function LegacyAdjudicationRedirectPage() {
  const router =
    useRouter();

  useEffect(() => {
    router.replace(
      '/inventory/tasks',
    );
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-white">
      <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Redirection vers les tâches C1/C2/C3...
      </div>
    </main>
  );
}
