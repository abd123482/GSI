'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Layers, Loader2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';

import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { CreateShelfModal } from '@/components/shelf/CreateShelfModal';
import { DeleteShelfModal } from '@/components/shelf/DeleteShelfModal';
import { ShelfDetailModal } from '@/components/shelf/ShelfDetailModal';
import { ShelfListTable } from '@/components/shelf/ShelfListTable';
import { UpdateShelfModal } from '@/components/shelf/UpdateShelfModal';
import type { Shelf } from '@/types/shelf';

export default function ShelvesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updatingShelf, setUpdatingShelf] = useState<Shelf | null>(null);
  const [deletingShelf, setDeletingShelf] = useState<Shelf | null>(null);

  const {
    shelves,
    totalShelves,
    totalPages,
    currentPage,
    limit,
    searchTerm,
    setSearchTerm,
    setPage,
    setLimit,
    isLoading,
    isFetching,
    refetch,
    canCreateShelf,
  } = useShelves({ page: 1, limit: 12 });

  const { canUpdateShelf, canDeleteShelf } = usePermissions();

  if (!isLoaded) {
    return <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-[#f7f5f0]"><div className="flex items-center gap-2 text-xs text-[#aea69c]"><Loader2 className="h-4 w-4 animate-spin" />Chargement des emplacements...</div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-[#3f3a36] bg-[#383330] p-8 text-center">
          <Layers className="mx-auto h-8 w-8" />
          <div><h1 className="text-base font-semibold">Connexion requise</h1><p className="mt-1 text-xs text-[#c9c0ad]">Connectez-vous pour accéder aux emplacements.</p></div>
          <SignInButton mode="modal"><button type="button" className="w-full rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622]">Se connecter</button></SignInButton>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#3f3a36] pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#aea69c]"><Link href="/" className="hover:text-white">somepharm</Link><span>/</span><span className="text-white">emplacements</span></div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-normal tracking-tight">Gestion des Emplacements</h1>
              <span className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] bg-[#383330] px-2 py-1 text-[10px] text-[#c9c0ad]">
                {canCreateShelf ? <><ShieldCheck className="h-3 w-3 text-emerald-300" />Création autorisée</> : <><ShieldAlert className="h-3 w-3 text-amber-300" />Lecture seule</>}
              </span>
            </div>
          </div>
        </div>

        <ShelfListTable
          shelves={shelves}
          totalShelves={totalShelves}
          totalPages={totalPages}
          currentPage={currentPage}
          limit={limit}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onPageChange={setPage}
          onLimitChange={(nextLimit) => { setLimit(nextLimit); setPage(1); }}
          onSelectShelf={(shelf) => { setSelectedShelf(shelf); setIsDetailOpen(true); }}
          onOpenUpdate={setUpdatingShelf}
          onOpenDelete={setDeletingShelf}
          isLoading={isLoading || isFetching}
          onRefresh={() => { void refetch(); }}
          onOpenCreateModal={() => setIsCreateOpen(true)}
          canCreateShelf={canCreateShelf}
          canUpdateShelf={canUpdateShelf}
          canDeleteShelf={canDeleteShelf}
        />
      </div>

      <CreateShelfModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={() => { void refetch(); }} />
      <ShelfDetailModal shelf={selectedShelf} isOpen={isDetailOpen} onClose={() => { setIsDetailOpen(false); setSelectedShelf(null); }} onRefresh={() => { void refetch(); }} isLoading={isFetching} />
      <UpdateShelfModal shelf={updatingShelf} isOpen={Boolean(updatingShelf)} onClose={() => setUpdatingShelf(null)} onSuccess={() => { setUpdatingShelf(null); void refetch(); }} />
      <DeleteShelfModal shelf={deletingShelf} isOpen={Boolean(deletingShelf)} onClose={() => setDeletingShelf(null)} onSuccess={() => { setDeletingShelf(null); void refetch(); }} />
    </main>
  );
}
