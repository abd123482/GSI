'use client';

import { useState } from 'react';
import { useAuth, UserButton, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  Layers,
  Plus,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Database,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { CreateShelfModal } from '@/components/shelf/CreateShelfModal';
import { ShelfListTable } from '@/components/shelf/ShelfListTable';
import { ShelfDetailModal } from '@/components/shelf/ShelfDetailModal';
import { UpdateShelfModal } from '@/components/shelf/UpdateShelfModal';
import { DeleteShelfModal } from '@/components/shelf/DeleteShelfModal';
import { REQUIRED_CREATE_PERMISSION } from '@/services/shelf.service';
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

  const {
    permissions,
    roleName,
    canUpdateShelf,
    canDeleteShelf,
    isLoading: isPermsLoading,
  } = usePermissions();

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
    } catch (err: any) {
      toast.error('Recherche par ID échouée', {
        description: err?.message || `L'étagère avec le GUID '${id}' est introuvable.`,
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f6f5f4] text-[#37352f]">
        <div className="flex items-center gap-2 text-sm text-[#787671]">
          <span className="w-2 h-2 rounded-full bg-[#5645d4] animate-ping" />
          Chargement de l'environnement Notion...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#f6f5f4] text-[#37352f]">
        <div className="w-full max-w-md bg-white border border-[#e5e3df] rounded-xl p-8 shadow-xs text-center space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#e6e0f5] border border-[#d6b6f6] flex items-center justify-center text-[#7b3ff2] mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Connexion requise</h1>
            <p className="text-xs text-[#5d5b54]">
              Veuillez vous connecter pour accéder à l'interface des étagères et visualiser les tuples SQL Server.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex-1 px-4 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </SignInButton>
            <Link
              href="/"
              className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-white hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-sm font-medium rounded-lg transition-colors"
            >
              Accueil
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f5f4] text-[#37352f] flex flex-col">
      {/* Notion Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#e5e3df] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[#5d5b54] hover:text-[#1a1a1a] transition-colors font-medium p-1 rounded-md hover:bg-[#f0eeec]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Workspace Somépharm</span>
          </Link>
          <span className="text-[#a4a097]">/</span>
          <span className="text-[#1a1a1a] font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#5645d4]" />
            Étagères (Shelf)
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Permission Status Pill */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              canCreateShelf
                ? 'bg-[#d9f3e1] text-[#1aae39] border-[#a3e5b3]'
                : 'bg-[#ffe8d4] text-[#793400] border-[#fcd3b6]'
            }`}
          >
            {canCreateShelf ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Droit {REQUIRED_CREATE_PERMISSION} accordé</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Droit {REQUIRED_CREATE_PERMISSION} manquant</span>
              </>
            )}
          </div>

          <div className="border-l border-[#ede9e4] pl-3">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Page Notion Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e5e3df]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                Étagères & Emplacements
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#f0eeec] text-[#5d5b54]">
                dbo.Shelf
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#5d5b54]">
              Service de maintenance des zones de stockage — Chaque enregistrement est persisté comme tuple dans SQL Server (SSMS).
            </p>
          </div>

          {/* Action CTA: Notion button-primary (Signature #5645d4 purple, 8px rounded, 14px 500) */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle étagère</span>
          </button>
        </div>

        {/* Feature Context Cards (Notion pastel-tinted cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Fast Zod Validation */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#e6e0f5] text-[#7b3ff2] flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">Contrôle Zod en temps réel</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              Validation synchrone immédiate du nom et de la quantité avant transmission HTTP.
            </p>
          </div>

          {/* Card 2: Security & Token Authorization */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#d9f3e1] text-[#1aae39] flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">Sécurité & Entitlement</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              Vérification proactive du token Clerk et de la permission <code className="font-mono bg-white px-1 py-0.5 rounded text-[10px]">shelf.create</code>.
            </p>
          </div>

          {/* Card 3: SQL Server SSMS Persistance */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#ffe8d4] text-[#dd5b00] flex items-center justify-center text-xs font-bold">
                3
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">Tuples dans SSMS</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              Insertion directe dans SQL Server avec colonnes <code className="font-mono text-[10px]">shelfId</code>, <code className="font-mono text-[10px]">shelfName</code>, <code className="font-mono text-[10px]">shelfQuantity</code>.
            </p>
          </div>
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

      {/* Update Shelf Modal Component (PATCH /shelves/:id) */}
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

      {/* Delete Shelf Modal Component (DELETE /shelves/:id) */}
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

      {/* Single Shelf Detail Modal (Notion Document Design) */}
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
