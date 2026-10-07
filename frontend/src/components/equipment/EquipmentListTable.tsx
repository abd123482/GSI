'use client';

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  PackagePlus,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';

import type {
  Equipment,
  EquipmentStatus,
} from '@/types/equipment';

interface EquipmentListTableProps {
  equipments: Equipment[];
  totalEquipments: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  searchTerm: string;
  equipmentStatus?:
  | EquipmentStatus;
  hasSerialNumber?:
  | boolean;

  onSearchChange: (
    value: string,
  ) => void;

  onEquipmentStatusChange: (
    value:
      | EquipmentStatus
      | undefined,
  ) => void;

  onSerialModeChange: (
    value:
      | boolean
      | undefined,
  ) => void;

  onPageChange: (
    page: number,
  ) => void;

  onLimitChange: (
    limit: number,
  ) => void;

  onSelectEquipment: (
    equipment: Equipment,
  ) => void;

  onEditEquipment?: (
    equipment: Equipment,
  ) => void;

  onDeleteEquipment?: (
    equipment: Equipment,
  ) => void;

  isLoading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  canCreateEquipment: boolean;
  canUpdateEquipment?: boolean;
  canDeleteEquipment?: boolean;
}

export function EquipmentListTable({
  equipments,
  totalEquipments,
  totalPages,
  currentPage,
  limit,
  searchTerm,
  equipmentStatus,
  hasSerialNumber,
  onSearchChange,
  onEquipmentStatusChange,
  onSerialModeChange,
  onPageChange,
  onLimitChange,
  onSelectEquipment,
  onEditEquipment,
  onDeleteEquipment,
  isLoading,
  onRefresh,
  onOpenCreateModal,
  canCreateEquipment,
  canUpdateEquipment = true,
  canDeleteEquipment = true,
}: EquipmentListTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#27272a]">
      <div className="flex flex-col gap-3 border-b border-[#3f3f46] p-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full max-w-lg">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a1a1aa]" />

          <input
            value={searchTerm}
            onChange={(event) =>
              onSearchChange(
                event.target.value,
              )
            }
            placeholder="Rechercher par nom d’article..."
            className="h-9 w-full rounded border border-[#3f3f46] bg-[#18181b] pl-9 pr-3 text-xs outline-none placeholder:text-[#a1a1aa]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={
              equipmentStatus === undefined
                ? 'ALL'
                : equipmentStatus
                  ? 'true'
                  : 'false'
            }
            onChange={(event) =>
              onEquipmentStatusChange(
                event.target.value ===
                  'ALL'
                  ? undefined
                  : event.target
                    .value === 'true',
              )
            }
            className="h-9 rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs"
          >
            <option value="ALL">
              Tous les statuts
            </option>
            <option value="true">
              ACTIVE
            </option>
            <option value="false">
              INACTIVE
            </option>
          </select>

          <select
            value={
              hasSerialNumber ===
                undefined
                ? 'ALL'
                : hasSerialNumber
                  ? 'SERIALIZED'
                  : 'STANDARD'
            }
            onChange={(event) =>
              onSerialModeChange(
                event.target.value ===
                  'ALL'
                  ? undefined
                  : event.target
                    .value ===
                  'SERIALIZED',
              )
            }
            className="h-9 rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs"
          >
            <option value="ALL">
              Tous les modes
            </option>
            <option value="STANDARD">
              Standard
            </option>
            <option value="SERIALIZED">
              Sérialisé
            </option>
          </select>

          <select
            value={limit}
            onChange={(event) =>
              onLimitChange(
                Number(
                  event.target.value,
                ),
              )
            }
            className="h-9 rounded border border-[#3f3f46] bg-[#18181b] px-2 text-xs"
          >
            <option value={10}>
              10 / page
            </option>
            <option value={20}>
              20 / page
            </option>
            <option value={50}>
              50 / page
            </option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded border border-[#3f3f46] bg-[#18181b] px-3 text-xs disabled:opacity-40"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading
                  ? 'animate-spin'
                  : ''
                }`}
            />
            Actualiser
          </button>


        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#3f3f46] bg-[#18181b] text-[10px] uppercase tracking-wide text-[#a1a1aa]">
            <tr>
              <th className="px-4 py-3">
                Article
              </th>
              <th className="px-4 py-3">
                Mode
              </th>
              <th className="px-4 py-3">
                Statut
              </th>
              <th className="px-4 py-3 text-center">
                Quantité
              </th>
              <th className="px-4 py-3 text-center">
                Minimum
              </th>
              <th className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#3f3f46]">
            {isLoading &&
              equipments.length ===
              0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-14 text-center text-[#a1a1aa]"
                >
                  Chargement...
                </td>
              </tr>
            ) : equipments.length ===
              0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-14 text-center text-[#a1a1aa]"
                >
                  Aucun article disponible.
                </td>
              </tr>
            ) : (
              equipments.map(
                (equipment) => (
                  <tr
                    key={
                      equipment.equipmentId
                    }
                    className="hover:bg-[#27272a]"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectEquipment(
                            equipment,
                          )
                        }
                        className="max-w-[340px] truncate text-left font-semibold hover:underline"
                      >
                        {equipment.equipmentName ??
                          'Article sans nom'}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded border border-[#4a4540] bg-[#18181b] px-2 py-1 text-[10px]">
                        {equipment.hasSerialNumber
                          ? 'SÉRIALISÉ'
                          : 'STANDARD'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded border px-2 py-1 text-[10px] font-semibold ${equipment.equipmentStatus
                            ? 'border-emerald-400/25 bg-emerald-950/25 text-emerald-300'
                            : 'border-amber-400/25 bg-amber-950/25 text-amber-300'
                          }`}
                      >
                        {
                          equipment.equipmentStatus ? 'ACTIVE' : 'INACTIVE'
                        }
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center font-mono">
                      {
                        equipment.equipmentQuantity
                      }
                    </td>

                    <td className="px-4 py-3 text-center font-mono">
                      {
                        equipment.minequipmentQuantity
                      }
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectEquipment(
                              equipment,
                            )
                          }
                          className="rounded p-2 text-[#a1a1aa] hover:bg-[#18181b] hover:text-white"
                          title="Voir"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {onEditEquipment && (
                          <button
                            type="button"
                            onClick={() =>
                              onEditEquipment(
                                equipment,
                              )
                            }
                            disabled={
                              !canUpdateEquipment
                            }
                            className="rounded p-2 text-[#a1a1aa] hover:bg-[#18181b] hover:text-white disabled:opacity-30"
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {onDeleteEquipment && (
                          <button
                            type="button"
                            onClick={() =>
                              onDeleteEquipment(
                                equipment,
                              )
                            }
                            disabled={
                              !canDeleteEquipment
                            }
                            className="rounded p-2 text-rose-300 hover:bg-rose-950/25 disabled:opacity-30"
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#3f3f46] bg-[#18181b] px-4 py-3">
        <p className="text-[11px] text-[#a1a1aa]">
          {totalEquipments} article
          {totalEquipments > 1
            ? 's'
            : ''}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={
              currentPage <= 1
            }
            onClick={() =>
              onPageChange(
                currentPage - 1,
              )
            }
            className="rounded border border-[#3f3f46] p-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="text-[11px] text-[#a1a1aa]">
            {currentPage} /{' '}
            {Math.max(
              1,
              totalPages,
            )}
          </span>

          <button
            type="button"
            disabled={
              currentPage >=
              totalPages
            }
            onClick={() =>
              onPageChange(
                currentPage + 1,
              )
            }
            className="rounded border border-[#3f3f46] p-2 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
