'use client';

import {
  useState,
} from 'react';
import {
  SignInButton,
  useAuth,
} from '@clerk/nextjs';
import Link from 'next/link';
import {
  Cpu,
  Loader2,
  PackagePlus,
} from 'lucide-react';

import {
  useEquipments,
} from '@/hooks/use-equipments';
import {
  usePermissions,
} from '@/hooks/use-permissions';
import {
  useUpdateSerialNumber,
} from '@/hooks/use-serial-numbers';

import {
  EquipmentListTable,
} from '@/components/equipment/EquipmentListTable';
import {
  CreateEquipmentModal,
} from '@/components/equipment/CreateEquipmentModal';
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

import type {
  Equipment,
  SerialNumber,
} from '@/types/equipment';

export default function EquipmentPage() {
  const {
    isSignedIn,
    isLoaded,
  } = useAuth();

  const {
    canCreateEquipment,
    canUpdateEquipment,
    canDeleteEquipment,
  } = usePermissions();

  const [
    isCreateOpen,
    setIsCreateOpen,
  ] = useState(false);

  const [
    selectedEquipment,
    setSelectedEquipment,
  ] =
    useState<Equipment | null>(
      null,
    );

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
    editingSerial,
    setEditingSerial,
  ] =
    useState<SerialNumber | null>(
      null,
    );

  const {
    equipments,
    totalEquipments,
    totalPages,
    currentPage,
    limit,
    searchTerm,
    equipmentStatus,
    hasSerialNumber,
    setSearchTerm,
    setEquipmentStatus,
    setHasSerialNumber,
    setPage,
    setLimit,
    isLoading,
    isFetching,
    refetch,
    getEquipmentById,
    createEquipment,
    isCreatingEquipment,
    updateEquipment,
    isUpdating,
    deleteEquipment,
    isDeleting,
  } = useEquipments({
    page: 1,
    limit: 10,
  });

  const serialUpdate =
    useUpdateSerialNumber();

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs text-[#aea69c]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-[#f7f5f0]">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-[#3f3a36] bg-[#383330] p-8 text-center">
          <Cpu className="mx-auto h-8 w-8" />

          <h1 className="text-base font-semibold">
            Connexion requise
          </h1>

          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622]"
            >
              Se connecter
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  async function refreshSelected() {
    if (
      !selectedEquipment
    ) {
      return;
    }

    try {
      const updated =
        await getEquipmentById(
          selectedEquipment.equipmentId,
        );

      setSelectedEquipment(
        updated,
      );
    } catch {
      // Keep current modal data if refresh fails.
    }
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#3f3a36] pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#aea69c]">
              <Link
                href="/"
                className="hover:text-white"
              >
                somepharm
              </Link>

              <span>/</span>
              <span className="text-white">
                articles
              </span>
            </div>

            <h1 className="text-2xl font-normal tracking-tight">
              Articles & Numéros de Série
            </h1>

          </div>

          {canCreateEquipment && (
            <button
              type="button"
              onClick={() =>
                setIsCreateOpen(
                  true,
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded bg-[#f7f5f0] px-3.5 py-2 text-xs font-semibold text-[#2b2622]"
            >
              <PackagePlus className="h-3.5 w-3.5" />
              Nouvel article
            </button>
          )}
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
          limit={limit}
          searchTerm={
            searchTerm
          }
          equipmentStatus={
            equipmentStatus
          }
          hasSerialNumber={
            hasSerialNumber
          }
          onSearchChange={
            setSearchTerm
          }
          onEquipmentStatusChange={
            setEquipmentStatus
          }
          onSerialModeChange={
            setHasSerialNumber
          }
          onPageChange={
            setPage
          }
          onLimitChange={(
            value,
          ) => {
            setLimit(value);
            setPage(1);
          }}
          onSelectEquipment={(
            equipment,
          ) =>
            setSelectedEquipment(
              equipment,
            )
          }
          onEditEquipment={
            setEditingEquipment
          }
          onDeleteEquipment={
            setDeletingEquipment
          }
          isLoading={
            isLoading ||
            isFetching
          }
          onRefresh={() => {
            void refetch();
          }}
          onOpenCreateModal={() =>
            setIsCreateOpen(
              true,
            )
          }
          canCreateEquipment={
            canCreateEquipment
          }
          canUpdateEquipment={
            canUpdateEquipment
          }
          canDeleteEquipment={
            canDeleteEquipment
          }
        />
      </div>

      <CreateEquipmentModal
        isOpen={
          isCreateOpen
        }
        onClose={() =>
          setIsCreateOpen(
            false,
          )
        }
        onSuccess={() => {
          void refetch();
        }}
      />

      <EquipmentDetailModal
        equipment={
          selectedEquipment
        }
        isOpen={
          Boolean(
            selectedEquipment,
          )
        }
        onClose={() =>
          setSelectedEquipment(
            null,
          )
        }
        onRefresh={() => {
          void refetch();
          void refreshSelected();
        }}
        onEditSerialNumber={(
          serial,
        ) =>
          setEditingSerial(
            serial,
          )
        }
        isLoading={
          isFetching
        }
      />

      <EditEquipmentModal
        isOpen={
          Boolean(
            editingEquipment,
          )
        }
        equipment={
          editingEquipment
        }
        onClose={() =>
          setEditingEquipment(
            null,
          )
        }
        onUpdate={async (
          id,
          values,
        ) => {
          await updateEquipment({
            id,
            input: values,
          });

          setEditingEquipment(
            null,
          );

          await refetch();
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

          setDeletingEquipment(
            null,
          );

          await refetch();
        }}
        isDeleting={
          isDeleting
        }
      />

      <EditSerialNumberModal
        isOpen={
          Boolean(
            editingSerial,
          )
        }
        serialNumber={
          editingSerial
        }
        onClose={() =>
          setEditingSerial(
            null,
          )
        }
        onUpdate={async (
          id,
          values,
        ) => {
          await serialUpdate.mutateAsync({
            id,
            input: values,
          });

          setEditingSerial(
            null,
          );

          await refreshSelected();
        }}
        isUpdating={
          serialUpdate.isPending
        }
      />
    </main>
  );
}
