'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import { Layers, Loader2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';

import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import dynamic from 'next/dynamic';
import { ShelfListTable } from '@/components/shelf/ShelfListTable';

const CreateShelfModal = dynamic(() => import('@/components/shelf/CreateShelfModal').then(m => m.CreateShelfModal));
const DeleteShelfModal = dynamic(() => import('@/components/shelf/DeleteShelfModal').then(m => m.DeleteShelfModal));
const ShelfDetailModal = dynamic(() => import('@/components/shelf/ShelfDetailModal').then(m => m.ShelfDetailModal));
const UpdateShelfModal = dynamic(() => import('@/components/shelf/UpdateShelfModal').then(m => m.UpdateShelfModal));
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

  const { canUpdateShelf, canDeleteShelf, canReadShelf, isLoading: permissionsLoading } = usePermissions();

  if (!isLoaded || permissionsLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-[#fafafa]"><div className="flex items-center gap-2 text-xs text-[#a1a1aa]"><Loader2 className="h-4 w-4 animate-spin" />Chargement des emplacements...</div></main>;
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-[#3f3f46] bg-[#27272a] p-8 text-center">
          <Layers className="mx-auto h-8 w-8" />
          <div><h1 className="text-base font-semibold">Connexion requise</h1><p className="mt-1 text-xs text-[#d4d4d8]">Connectez-vous pour accéder aux emplacements.</p></div>
          <SignInButton mode="modal"><button type="button" className="w-full rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]">Se connecter</button></SignInButton>
        </div>
      </main>
    );
  }

  if (!canReadShelf) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#27272a] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
          <h1 className="mt-3 text-sm font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-xs text-[#a1a1aa]">La permission shelf.read est requise.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-[#fafafa]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#3f3f46] pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#a1a1aa]"><Link href="/" className="hover:text-white">somepharm</Link><span>/</span><span className="text-white">emplacements</span></div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-normal tracking-tight">Gestion des Emplacements</h1>
              <span className="inline-flex items-center gap-1.5 rounded border border-[#3f3f46] bg-[#27272a] px-2 py-1 text-[10px] text-[#d4d4d8]">
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
