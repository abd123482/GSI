'use client';

import { useState } from 'react';
import { useAuth, UserButton, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Plus,
  PackagePlus,
  Cpu,
  Barcode,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useEquipments } from '@/hooks/use-equipments';
import { usePermissions } from '@/hooks/use-permissions';
import { EquipmentListTable } from '@/components/equipment/EquipmentListTable';
import { CreateEquipmentMovementModal } from '@/components/equipment/CreateEquipmentMovementModal';
import { EquipmentDetailModal } from '@/components/equipment/EquipmentDetailModal';
import { EditEquipmentModal } from '@/components/equipment/EditEquipmentModal';
import { DeleteEquipmentModal } from '@/components/equipment/DeleteEquipmentModal';
import { EditSerialNumberModal } from '@/components/equipment/EditSerialNumberModal';
import { DeleteSerialNumberModal } from '@/components/equipment/DeleteSerialNumberModal';
import { REQUIRED_MOVEMENT_CREATE_PERMISSION } from '@/services/equipment.service';
import { Equipment, SerialNumber } from '@/types/equipment';
import { toast } from 'sonner';

export default function EquipmentPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);

  // Edit / Delete modals state
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [deletingEquipment, setDeletingEquipment] = useState<Equipment | null>(null);
  const [editingSerialNumber, setEditingSerialNumber] = useState<SerialNumber | null>(null);
  const [deletingSerialNumber, setDeletingSerialNumber] = useState<SerialNumber | null>(null);

  const {
    equipments,
    totalEquipments,
    totalPages,
    currentPage,
    limit,
    searchTerm,
    setSearchTerm,
    setPage,
    setLimit,
    isLoading: isEquipmentsLoading,
    refetch,
    getEquipmentById,
    canCreateMovement,
    updateEquipment,
    isUpdating,
    deleteEquipment,
    isDeleting,
    updateSerialNumber,
    isUpdatingSerialNumber,
    deleteSerialNumber,
    isDeletingSerialNumber,
  } = useEquipments({ page: 1, limit: 10 });

  const {
    roleName,
    isLoading: isPermsLoading,
    canUpdateEquipment,
    canDeleteEquipment,
    canUpdateSerialNumber,
    canDeleteSerialNumber,
  } = usePermissions();

  const handleSelectEquipment = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setIsDetailModalOpen(true);
  };

  const handleLookupById = async (id: string) => {
    setIsLookingUp(true);
    try {
      const equip = await getEquipmentById(id);
      setSelectedEquipment(equip);
      setIsDetailModalOpen(true);
      toast.success(`Équipement trouvé : ${equip.equipmentName ?? equip.equipmentId}`);
    } catch (err: any) {
      toast.error('Recherche échouée', {
        description: err?.message || `L'équipement avec le GUID '${id}' est introuvable.`,
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
            <Cpu className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-[#1a1a1a]">Connexion requise</h1>
            <p className="text-xs text-[#5d5b54]">
              Veuillez vous connecter pour gérer les équipements, numéros de série et mouvements d’entrée.
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
            <Cpu className="w-3.5 h-3.5 text-[#5645d4]" />
            Équipements & Numéros de Série
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Permission Status Pill */}
          <div
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              canCreateMovement
                ? 'bg-[#d9f3e1] text-[#1aae39] border-[#a3e5b3]'
                : 'bg-[#ffe8d4] text-[#793400] border-[#fcd3b6]'
            }`}
          >
            {canCreateMovement ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Droit {REQUIRED_MOVEMENT_CREATE_PERMISSION} accordé</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Droit {REQUIRED_MOVEMENT_CREATE_PERMISSION} manquant</span>
              </>
            )}
          </div>

          <div className="border-l border-[#ede9e4] pl-3">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Page Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#e5e3df]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a]">
                Équipements & Numéros de Série
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#f0eeec] text-[#5d5b54]">
                dbo.Equipment • dbo.SerialNumber
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#5d5b54]">
              Inventaire unitaire et par lots — Chaque entrée externe initialise un mouvement avec source nulle et étagère optionnelle.
            </p>
          </div>

          {/* Action CTA: Notion button-primary (Signature #5645d4 purple, 8px rounded) */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4.5 py-2.5 bg-[#5645d4] hover:bg-[#4534b3] active:bg-[#3a2a99] text-white text-sm font-medium rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Nouveau mouvement d'entrée</span>
          </button>
        </div>

        {/* Feature Context Cards (Notion pastel-tinted cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: 32-bit Code Generator */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#e6e0f5] text-[#7b3ff2] flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">Génération 32-bit aléatoire</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              Choix direct entre la saisie manuelle ou la génération automatique de codes 32-bit uniques (8 hexadécimaux).
            </p>
          </div>

          {/* Card 2: Nullable Destination Shelf */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#d9f3e1] text-[#1aae39] flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">Mouvement source nulle</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              La source du mouvement est automatiquement <code className="font-mono bg-white px-1 py-0.5 rounded text-[10px]">NULL</code> et l'étagère de destination peut rester non assignée.
            </p>
          </div>

          {/* Card 3: Child Serial Numbers in SSMS */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-[#ffe8d4] text-[#dd5b00] flex items-center justify-center text-xs font-bold">
                3
              </span>
              <h3 className="text-xs font-semibold text-[#1a1a1a]">S/N Enfants dans SSMS</h3>
            </div>
            <p className="text-[11px] text-[#5d5b54] leading-relaxed">
              Chaque numéro de série enfant est persisté de manière unitaire et rattaché à son équipement parent.
            </p>
          </div>
        </div>

        {/* Equipment List Table Component */}
        <EquipmentListTable
          equipments={equipments}
          totalEquipments={totalEquipments}
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
          onSelectEquipment={handleSelectEquipment}
          onEditEquipment={(equip) => setEditingEquipment(equip)}
          onDeleteEquipment={(equip) => setDeletingEquipment(equip)}
          onEditSerialNumber={(sn) => setEditingSerialNumber(sn)}
          onDeleteSerialNumber={(sn) => setDeletingSerialNumber(sn)}
          onLookupById={handleLookupById}
          isLoading={isEquipmentsLoading}
          onRefresh={refetch}
          onOpenCreateModal={() => setIsModalOpen(true)}
          canCreateMovement={canCreateMovement}
          canUpdateEquipment={canUpdateEquipment}
          canDeleteEquipment={canDeleteEquipment}
          canUpdateSerialNumber={canUpdateSerialNumber}
          canDeleteSerialNumber={canDeleteSerialNumber}
        />
      </div>

      {/* Entry Movement Creation Modal Component */}
      <CreateEquipmentMovementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => refetch()}
      />

      {/* Equipment Detail Modal Component (Notion Document Design) */}
      <EquipmentDetailModal
        equipment={selectedEquipment}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedEquipment(null);
        }}
        onRefresh={refetch}
        isLoading={isLookingUp}
      />

      {/* Edit Equipment Modal Component */}
      <EditEquipmentModal
        isOpen={!!editingEquipment}
        onClose={() => setEditingEquipment(null)}
        equipment={editingEquipment}
        onUpdate={async (id, values) => {
          await updateEquipment({ id, input: values });
          refetch();
        }}
        isUpdating={isUpdating}
      />

      {/* Delete Equipment Modal Component */}
      <DeleteEquipmentModal
        isOpen={!!deletingEquipment}
        onClose={() => setDeletingEquipment(null)}
        equipment={deletingEquipment}
        onDelete={async (id) => {
          await deleteEquipment(id);
          refetch();
        }}
        isDeleting={isDeleting}
      />

      {/* Edit Serial Number Modal Component */}
      <EditSerialNumberModal
        isOpen={!!editingSerialNumber}
        onClose={() => setEditingSerialNumber(null)}
        serialNumber={editingSerialNumber}
        onUpdate={async (id, values) => {
          await updateSerialNumber({ id, input: values });
          refetch();
        }}
        isUpdating={isUpdatingSerialNumber}
      />

      {/* Delete Serial Number Modal Component */}
      <DeleteSerialNumberModal
        isOpen={!!deletingSerialNumber}
        onClose={() => setDeletingSerialNumber(null)}
        serialNumber={deletingSerialNumber}
        onDelete={async (id) => {
          await deleteSerialNumber(id);
          refetch();
        }}
        isDeleting={isDeletingSerialNumber}
      />
    </main>
  );
}
