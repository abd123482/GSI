'use client';

import {
  getErrorMessage,
} from '@/lib/error-message';
import {
  useState,
} from 'react';
import {
  SignInButton,
  useAuth,
} from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  PackagePlus,
  Cpu,
  Loader2,
} from 'lucide-react';
import {
  useEquipments,
} from '@/hooks/use-equipments';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  EquipmentListTable,
} from '@/components/equipment/EquipmentListTable';
import {
  CreateEquipmentModal,
} from '@/components/equipment/CreateEquipmentModal';
import {
  CreateMovementModal,
} from '@/components/equipment/CreateMovementModal';
import {
  EquipmentDetailModal,
} from '@/components/equipment/EquipmentDetailModal';
import {
  EditEquipmentModal,
} from '@/components/equipment/EditEquipmentModal';
import {
  DeleteEquipmentModal,
} from '@/components/equipment/DeleteEquipmentModal';
import {
  EditSerialNumberModal,
} from '@/components/equipment/EditSerialNumberModal';
import {
  DeleteSerialNumberModal,
} from '@/components/equipment/DeleteSerialNumberModal';
import {
  ViewEquipmentShelvesModal,
} from '@/components/equipment/ViewEquipmentShelvesModal';
import type {
  Equipment,
  SerialNumber,
} from '@/types/equipment';
import {
  toast,
} from 'sonner';

export default function EquipmentPage() {
  const {
    isSignedIn,
    isLoaded,
  } = useAuth();

  const {
    canCreateEquipment,
    canUpdateEquipment,
    canDeleteEquipment,

    canCreateMovement,

    canUpdateSerialNumber,
    canDeleteSerialNumber,
  } = usePermissions();

  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false);

  const [
    selectedEquipment,
    setSelectedEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

  const [
    isDetailModalOpen,
    setIsDetailModalOpen,
  ] = useState(false);

  const [
    isLookingUp,
    setIsLookingUp,
  ] = useState(false);

  /*
   * Movement modal state.
   */
  const [
    isMovementModalOpen,
    setIsMovementModalOpen,
  ] = useState(false);

  const [
    movementEquipment,
    setMovementEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

  /*
   * Edit / Delete / View Shelves modal state.
   */
  const [
    editingEquipment,
    setEditingEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

  const [
    deletingEquipment,
    setDeletingEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

  const [
    editingSerialNumber,
    setEditingSerialNumber,
  ] =
    useState<SerialNumber | null>(
      null,
    );

  const [
    deletingSerialNumber,
    setDeletingSerialNumber,
  ] =
    useState<SerialNumber | null>(
      null,
    );

  const [
    viewShelvesEquipment,
    setViewShelvesEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

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

    isLoading:
    isEquipmentsLoading,

    refetch,

    getEquipmentById,

    updateEquipment,
    isUpdating,

    deleteEquipment,
    isDeleting,

    updateSerialNumber,
    isUpdatingSerialNumber,

    deleteSerialNumber,
    isDeletingSerialNumber,
  } = useEquipments({
    page: 1,
    limit: 10,
  });

  const handleSelectEquipment = (
    equipment: Equipment,
  ) => {
    setSelectedEquipment(
      equipment,
    );
    setIsDetailModalOpen(
      true,
    );
  };

  const handleLookupById =
    async (id: string) => {
      setIsLookingUp(true);

      try {
        const equip =
          await getEquipmentById(
            id,
          );

        setSelectedEquipment(
          equip,
        );

        setIsDetailModalOpen(
          true,
        );

        toast.success(
          `Article trouvé : ${equip.equipmentName ??
          equip.equipmentId
          }`,
        );
      } catch (err: unknown) {
        toast.error(
          'Recherche échouée',
          {
            description:
              getErrorMessage(
                err,
                `L'article avec le GUID '${id}' est introuvable.`,
              ),
          },
        );
      } finally {
        setIsLookingUp(
          false,
        );
      }
    };

  function openMovement(
    equipment:
      | Equipment
      | null = null,
  ) {
    if (!canCreateMovement) {
      toast.error(
        'Permission refusée',
        {
          description:
            "La permission 'movement.create' est requise pour enregistrer un mouvement.",
        },
      );

      return;
    }

    setMovementEquipment(
      equipment,
    );

    setIsMovementModalOpen(
      true,
    );
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>
            Chargement des articles...
          </span>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#2b2622] text-[#f7f5f0]">
        <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-8 shadow-xl text-center space-y-4">
          <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0] mx-auto">
            <Cpu className="w-5 h-5" />
          </div>

          <div className="space-y-1">
            <h1 className="text-base font-medium text-[#f7f5f0]">
              Connexion requise
            </h1>

            <p className="text-xs text-[#c9c0ad]">
              Veuillez vous connecter pour gérer les articles,
              numéros de série et mouvements.
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
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3f3a36]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
              <Link
                href="/"
                className="hover:text-[#f7f5f0] transition-colors"
              >
                somepharm
              </Link>

              <span>/</span>

              <span className="text-[#f7f5f0]">
                articles
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                Articles & Numéros de Série
              </h1>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] bg-[#383330] border border-[#3f3a36] text-[#c9c0ad]">
                {canCreateEquipment ? (
                  <>
                    <ShieldCheck className="w-3 h-3 text-[#10b981]" />
                    <span>
                      Création article autorisée
                    </span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-3 h-3 text-[#f59e0b]" />
                    <span>
                      Lecture article
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canCreateMovement && (
              <button
                type="button"
                onClick={() =>
                  openMovement(
                    null,
                  )
                }
                className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-[#aea69c]" />
                <span>
                  Nouveau mouvement
                </span>
              </button>
            )}

            {canCreateEquipment && (
              <button
                type="button"
                onClick={() =>
                  setIsModalOpen(
                    true,
                  )
                }
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors cursor-pointer"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>
                  Nouvel article
                </span>
              </button>
            )}
          </div>
        </div>

        <EquipmentListTable
          equipments={
            equipments
          }
          totalEquipments={
            totalEquipments
          }
          totalPages={
            totalPages
          }
          currentPage={
            currentPage
          }
          limit={
            limit
          }
          searchTerm={
            searchTerm
          }
          onSearchChange={
            setSearchTerm
          }
          onPageChange={
            setPage
          }
          onLimitChange={(
            newLimit,
          ) => {
            setLimit(
              newLimit,
            );
            setPage(1);
          }}
          onSelectEquipment={
            handleSelectEquipment
          }
          onOpenMovement={(
            equip,
          ) =>
            openMovement(
              equip,
            )
          }
          onEditEquipment={(
            equip,
          ) =>
            setEditingEquipment(
              equip,
            )
          }
          onDeleteEquipment={(
            equip,
          ) =>
            setDeletingEquipment(
              equip,
            )
          }
          onEditSerialNumber={(
            sn,
          ) =>
            setEditingSerialNumber(
              sn,
            )
          }
          onDeleteSerialNumber={(
            sn,
          ) =>
            setDeletingSerialNumber(
              sn,
            )
          }
          onViewEquipmentShelves={(
            equip,
          ) =>
            setViewShelvesEquipment(
              equip,
            )
          }
          onLookupById={
            handleLookupById
          }
          isLoading={
            isEquipmentsLoading
          }
          onRefresh={
            refetch
          }
          onOpenCreateModal={() =>
            canCreateEquipment &&
            setIsModalOpen(
              true,
            )
          }
          canCreateMovement={
            canCreateMovement
          }
          canUpdateEquipment={
            canUpdateEquipment
          }
          canDeleteEquipment={
            canDeleteEquipment
          }
          canUpdateSerialNumber={
            canUpdateSerialNumber
          }
          canDeleteSerialNumber={
            canDeleteSerialNumber
          }
        />
      </div>

      <ViewEquipmentShelvesModal
        isOpen={
          Boolean(
            viewShelvesEquipment,
          )
        }
        equipment={
          viewShelvesEquipment
        }
        onClose={() =>
          setViewShelvesEquipment(
            null,
          )
        }
      />

      <CreateEquipmentModal
        isOpen={
          isModalOpen &&
          canCreateEquipment
        }
        onClose={() =>
          setIsModalOpen(
            false,
          )
        }
        onSuccess={() =>
          refetch()
        }
      />

      <EquipmentDetailModal
        equipment={
          selectedEquipment
        }
        isOpen={
          isDetailModalOpen
        }
        onClose={() => {
          setIsDetailModalOpen(
            false,
          );

          setSelectedEquipment(
            null,
          );
        }}
        onOpenMovement={
          canCreateMovement
            ? (equip) =>
              openMovement(
                equip,
              )
            : undefined
        }
        onRefresh={
          refetch
        }
        isLoading={
          isLookingUp
        }
      />

      <EditEquipmentModal
        isOpen={
          Boolean(
            editingEquipment,
          )
        }
        onClose={() =>
          setEditingEquipment(
            null,
          )
        }
        equipment={
          editingEquipment
        }
        onUpdate={async (
          id,
          values,
        ) => {
          await updateEquipment({
            id,
            input: values,
          });

          refetch();
        }}
        isUpdating={
          isUpdating
        }
      />

      <DeleteEquipmentModal
        isOpen={
          Boolean(
            deletingEquipment,
          )
        }
        onClose={() =>
          setDeletingEquipment(
            null,
          )
        }
        equipment={
          deletingEquipment
        }
        onDelete={async (
          id,
        ) => {
          await deleteEquipment(
            id,
          );

          refetch();
        }}
        isDeleting={
          isDeleting
        }
      />

      <EditSerialNumberModal
        isOpen={
          Boolean(
            editingSerialNumber,
          )
        }
        onClose={() =>
          setEditingSerialNumber(
            null,
          )
        }
        serialNumber={
          editingSerialNumber
        }
        onUpdate={async (
          id,
          values,
        ) => {
          await updateSerialNumber({
            id,
            input: values,
          });

          refetch();
        }}
        isUpdating={
          isUpdatingSerialNumber
        }
      />

      <DeleteSerialNumberModal
        isOpen={
          Boolean(
            deletingSerialNumber,
          )
        }
        onClose={() =>
          setDeletingSerialNumber(
            null,
          )
        }
        serialNumber={
          deletingSerialNumber
        }
        onDelete={async (
          id,
        ) => {
          await deleteSerialNumber(
            id,
          );

          refetch();
        }}
        isDeleting={
          isDeletingSerialNumber
        }
      />

      <CreateMovementModal
        isOpen={
          isMovementModalOpen &&
          canCreateMovement
        }
        onClose={() => {
          setIsMovementModalOpen(
            false,
          );

          setMovementEquipment(
            null,
          );
        }}
        equipment={
          movementEquipment
        }
        equipmentsList={
          equipments
        }
        onSuccess={() => {
          refetch();

          if (
            selectedEquipment
          ) {
            getEquipmentById(
              selectedEquipment.equipmentId,
            )
              .then(
                (
                  updated,
                ) =>
                  setSelectedEquipment(
                    updated,
                  ),
              )
              .catch(
                () => { },
              );
          }
        }}
      />
    </main>
  );
}
