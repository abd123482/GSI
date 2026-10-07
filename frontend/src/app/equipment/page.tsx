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
  ShieldAlert,
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

import dynamic from 'next/dynamic';

import {
  EquipmentListTable,
} from '@/components/equipment/EquipmentListTable';

const CreateEquipmentModal = dynamic(() => import('@/components/equipment/CreateEquipmentModal').then(m => m.CreateEquipmentModal));
const EquipmentDetailModal = dynamic(() => import('@/components/equipment/EquipmentDetailModal').then(m => m.EquipmentDetailModal));
const EditEquipmentModal = dynamic(() => import('@/components/equipment/EditEquipmentModal').then(m => m.EditEquipmentModal));
const DeleteEquipmentModal = dynamic(() => import('@/components/equipment/DeleteEquipmentModal').then(m => m.DeleteEquipmentModal));
const EditSerialNumberModal = dynamic(() => import('@/components/equipment/EditSerialNumberModal').then(m => m.EditSerialNumberModal));

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
    canReadEquipment,
    isLoading: permissionsLoading,
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

  if (!isLoaded || permissionsLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-[#fafafa]">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-[#3f3f46] bg-[#27272a] p-8 text-center">
          <Cpu className="mx-auto h-8 w-8" />

          <h1 className="text-base font-semibold">
            Connexion requise
          </h1>

          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]"
            >
              Se connecter
            </button>
          </SignInButton>
        </div>
      </main>
    );
  }

  if (!canReadEquipment) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-[#18181b] p-6 text-[#fafafa]">
        <div className="w-full max-w-lg rounded border border-amber-500/25 bg-[#27272a] p-7 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-amber-400" />
          <h1 className="mt-3 text-sm font-semibold">Accès non autorisé</h1>
          <p className="mt-2 text-xs text-[#a1a1aa]">La permission equipment.read est requise.</p>
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
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-[#fafafa]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[#3f3f46] pb-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-1 flex items-center gap-2 font-mono text-xs text-[#a1a1aa]">
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
              className="inline-flex items-center justify-center gap-2 rounded bg-[#fafafa] px-3.5 py-2 text-xs font-semibold text-[#18181b]"
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
