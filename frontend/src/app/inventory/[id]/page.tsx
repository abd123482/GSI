'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function InventoryIdRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  useEffect(() => {
    if (id) {
      router.replace(`/inventory/${id}/report`);
    } else {
      router.replace('/inventory');
    }
  }, [id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
      <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
    </div>
  );
}
