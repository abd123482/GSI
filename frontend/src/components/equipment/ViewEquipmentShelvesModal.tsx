'use client';

import {
  useState,
} from 'react';
import {
  useQuery,
} from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  Copy,
  Hash,
  Layers,
  Package,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  toast,
} from 'sonner';

import type {
  Equipment,
  EquipmentWithShelvesResponse,
} from '@/types/equipment';
import {
  EquipmentService,
} from '@/services/equipment.service';
import {
  useApi,
} from '@/hooks/use-api';
import {
  usePermissions,
} from '@/hooks/use-permissions';

interface ViewEquipmentShelvesModalProps {
  isOpen: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}

export function ViewEquipmentShelvesModal({
  isOpen,
  equipment,
  onClose,
}: ViewEquipmentShelvesModalProps) {
  const api = useApi();
  const {
    permissions,
  } = usePermissions();

  const [
    copied,
    setCopied,
  ] =
    useState<string | null>(
      null,
    );

  const query =
    useQuery<EquipmentWithShelvesResponse>({
      queryKey: [
        'equipment-shelves',
        equipment?.equipmentId,
      ],

      queryFn: () =>
        EquipmentService.getEquipmentShelves(
          api,
          equipment!.equipmentId,
          permissions,
        ),

      enabled:
        isOpen &&
        Boolean(
          equipment?.equipmentId,
        ),

      staleTime: 10_000,
    });

  if (
    !isOpen ||
    !equipment
  ) {
    return null;
  }

  const data =
    query.data ??
    (equipment as EquipmentWithShelvesResponse);

  const allocations =
    data.equipmentShelfs ?? [];

  const totalStock =
    data.equipmentQuantity ??
    0;

  const totalAllocated =
    data.totalAllocated ??
    allocations.reduce(
      (sum, allocation) =>
        sum +
        Number(
          allocation.equipmentQuantity ||
          0,
        ),
      0,
    );

  const unallocated =
    data.unallocatedQuantity ??
    Math.max(
      0,
      totalStock -
      totalAllocated,
    );

  const shelvesCount =
    data.shelvesCount ??
    allocations.length;

  async function copyShelf(
    shelfId: string,
  ) {
    await navigator.clipboard.writeText(
      shelfId,
    );

    setCopied(shelfId);
    toast.success('GUID emplacement copié');

    setTimeout(
      () =>
        setCopied(null),
      1500,
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">
              Emplacements associés
            </h2>

            <p className="mt-0.5 text-[10px] text-white/50">
              {equipment.equipmentName ??
                equipment.equipmentId}
            </p>
          </div>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() =>
                query.refetch()
              }
              className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <RefreshCw
                className={`h-4 w-4 ${query.isFetching
                    ? 'animate-spin'
                    : ''
                  }`}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric
              label="Global"
              value={totalStock}
              icon={
                <Package className="h-3.5 w-3.5" />
              }
            />
            <Metric
              label="Alloué"
              value={totalAllocated}
              icon={
                <Check className="h-3.5 w-3.5" />
              }
            />
            <Metric
              label="Non alloué"
              value={unallocated}
              warning={
                unallocated > 0
              }
              icon={
                <AlertTriangle className="h-3.5 w-3.5" />
              }
            />
            <Metric
              label="Emplacements"
              value={shelvesCount}
              icon={
                <Layers className="h-3.5 w-3.5" />
              }
            />
          </div>

          <p className="text-[10px] leading-relaxed text-white/45">
            Pour un article sérialisé, la quantité globale correspond au nombre
            d’identités série enregistrées. La répartition physique est suivie
            par les allocations/emplacements et les mouvements.
          </p>

          {query.isLoading ? (
            <div className="py-8 text-center text-xs text-white/45">
              Chargement...
            </div>
          ) : allocations.length ? (
            <div className="overflow-hidden rounded-lg border border-[#3f3a36]">
              <div className="grid grid-cols-[minmax(0,1fr)_90px] border-b border-[#3f3a36] bg-[#2b2622] px-4 py-2 text-[10px] uppercase text-white/45">
                <span>
                  Emplacement
                </span>
                <span className="text-right">
                  Quantité
                </span>
              </div>

              <div className="divide-y divide-[#3f3a36]">
                {allocations.map(
                  (allocation) => (
                    <div
                      key={
                        allocation.equipmentShelfId
                      }
                      className="grid grid-cols-[minmax(0,1fr)_90px] items-center px-4 py-3 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {allocation.shelf?.shelfName ??
                            allocation.shelfId}
                        </p>

                        <div className="mt-1 flex items-center gap-1">
                          <span className="truncate font-mono text-[9px] text-white/35">
                            {allocation.shelfId}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              copyShelf(
                                allocation.shelfId,
                              )
                            }
                            className="text-white/45 hover:text-white"
                          >
                            {copied ===
                              allocation.shelfId ? (
                              <Check className="h-3 w-3 text-emerald-300" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <span className="text-right font-mono font-semibold">
                        {allocation.equipmentQuantity}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#3f3a36] py-8 text-center text-xs text-white/45">
              Aucun emplacement actuellement alloué.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  warning = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${warning
          ? 'border-amber-400/30 bg-amber-400/10'
          : 'border-[#3f3a36] bg-[#2b2622]/65'
        }`}
    >
      <div className="flex items-center gap-1.5 text-[10px] text-white/45">
        {icon}
        {label}
      </div>

      <div className="mt-2 flex items-center gap-1 font-mono text-lg font-semibold">
        <Hash className="h-3 w-3 text-white/35" />
        {value}
      </div>
    </div>
  );
}
