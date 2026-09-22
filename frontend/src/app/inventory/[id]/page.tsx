'use client';

import {
  useEffect,
} from 'react';
import {
  useParams,
  useRouter,
} from 'next/navigation';
import {
  Loader2,
} from 'lucide-react';

export default function InventoryIdRedirectPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const inventoryId =
    params?.id as string;

  useEffect(() => {
    if (inventoryId) {
      router.replace(
        `/inventory/${inventoryId}/report`,
      );
    } else {
      router.replace(
        '/inventory',
      );
    }
  }, [
    inventoryId,
    router,
  ]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
      <Loader2 className="h-5 w-5 animate-spin" />
    </main>
  );
}
