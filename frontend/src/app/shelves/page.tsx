'use client';

import { getErrorMessage } from '@/lib/error-message';
import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Layers,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { CreateShelfModal } from '@/components/shelf/CreateShelfModal';
import { ShelfListTable } from '@/components/shelf/ShelfListTable';
import { ShelfDetailModal } from '@/components/shelf/ShelfDetailModal';
import { UpdateShelfModal } from '@/components/shelf/UpdateShelfModal';
import { DeleteShelfModal } from '@/components/shelf/DeleteShelfModal';
import { Shelf } from '@/types/shelf';
import { toast } from 'sonner';

export default function ShelvesPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState<Shelf | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // States for Update and Delete modals
  const [updatingShelf, setUpdatingShelf] = useState<Shelf | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [deletingShelf, setDeletingShelf] = useState<Shelf | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
    isLoading: isShelvesLoading,
    refetch,
    getShelfById,
    canCreateShelf,
  } = useShelves({ page: 1, limit: 10 });

  const { canUpdateShelf, canDeleteShelf } = usePermissions();

  const handleSelectShelf = (shelf: Shelf) => {
    setSelectedShelf(shelf);
    setIsDetailModalOpen(true);
  };

  const handleLookupById = async (id: string) => {
    setIsLookingUp(true);
    try {
      const shelf = await getShelfById(id);
      setSelectedShelf(shelf);
      setIsDetailModalOpen(true);
      toast.success(`Étagère trouvée : ${shelf.shelfName ?? shelf.shelfId}`);
    } catch (err: unknown) {
      toast.error('Recherche par ID échouée', {
        description: getErrorMessage(err, `L'étagère avec le GUID '${id}' est introuvable.`),
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>Chargement des étagères...</span>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#2b2622] text-[#f7f5f0]">
        <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-8 shadow-xl text-center space-y-4">
          <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0] mx-auto">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-medium text-[#f7f5f0]">Connexion requise</h1>
            <p className="text-xs text-[#c9c0ad]">
              Veuillez vous connecter pour accéder au registre des étagères et emplacements SomePharm.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </SignInButton>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-[#2b2622] hover:bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors"
            >
              Accueil
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      {/* Main Workspace Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3f3a36]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
              <Link href="/" className="hover:text-[#f7f5f0] transition-colors">
                somepharm
              </Link>
              <span>/</span>
              <span className="text-[#f7f5f0]">shelves</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                Étagères & Emplacements
              </h1>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-[2px] bg-[#383330] text-[#dad2c1] border border-[#3f3a36]">
                dbo.Shelf
              </span>
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] bg-[#383330] border border-[#3f3a36] text-[#c9c0ad]">
                {canCreateShelf ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                    <span>Création autorisée</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3 text-[#f59e0b]" />
                    <span>Lecture seule</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-[#c9c0ad]">
              Service de maintenance des zones de stockage — Enregistrements physiques persistés dans SQL Server.
            </p>
          </div>

          {/* Action CTA: Warp button-primary */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nouvelle étagère</span>
          </button>
        </div>

        {/* Shelf List Table Component with Pagination, Search by Name, and Single Shelf Lookup */}
        <ShelfListTable
          shelves={shelves}
          totalShelves={totalShelves}
          totalPages={totalPages}
          currentPage={currentPage}
          limit={limit}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onPageChange={setPage}
          onLimitChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          onSelectShelf={handleSelectShelf}
          onLookupById={handleLookupById}
          onOpenUpdate={(shelf) => {
            setUpdatingShelf(shelf);
            setIsUpdateModalOpen(true);
          }}
          onOpenDelete={(shelf) => {
            setDeletingShelf(shelf);
            setIsDeleteModalOpen(true);
          }}
          isLoading={isShelvesLoading}
          onRefresh={refetch}
          onOpenCreateModal={() => setIsModalOpen(true)}
          canCreateShelf={canCreateShelf}
          canUpdateShelf={canUpdateShelf}
          canDeleteShelf={canDeleteShelf}
        />
      </div>

      {/* Creation Modal Component */}
      <CreateShelfModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Update Shelf Modal Component */}
      <UpdateShelfModal
        shelf={updatingShelf}
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setUpdatingShelf(null);
        }}
        onSuccess={() => {
          refetch();
          if (selectedShelf && updatingShelf && selectedShelf.shelfId === updatingShelf.shelfId) {
            getShelfById(selectedShelf.shelfId)
              .then((updated) => setSelectedShelf(updated))
              .catch(() => {});
          }
        }}
      />

      {/* Delete Shelf Modal Component */}
      <DeleteShelfModal
        shelf={deletingShelf}
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingShelf(null);
        }}
        onSuccess={() => {
          refetch();
          if (selectedShelf && deletingShelf && selectedShelf.shelfId === deletingShelf.shelfId) {
            setIsDetailModalOpen(false);
            setSelectedShelf(null);
          }
        }}
      />

      {/* Single Shelf Detail Modal */}
      <ShelfDetailModal
        shelf={selectedShelf}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedShelf(null);
        }}
        onRefresh={refetch}
        onOpenUpdate={(shelf) => {
          setUpdatingShelf(shelf);
          setIsUpdateModalOpen(true);
        }}
        onOpenDelete={(shelf) => {
          setDeletingShelf(shelf);
          setIsDeleteModalOpen(true);
        }}
        canUpdateShelf={canUpdateShelf}
        canDeleteShelf={canDeleteShelf}
        isLoading={isLookingUp}
      />
    </main>
  );
}
