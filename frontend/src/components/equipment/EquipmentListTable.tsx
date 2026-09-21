'use client';

import {
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Hash,
  Layers,
  Package,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  toast,
} from 'sonner';

import type {
  Equipment,
  SerialNumber,
} from '@/types/equipment';

interface EquipmentListTableProps {
  equipments: Equipment[];
  totalEquipments: number;
  totalPages: number;
  currentPage: number;
  limit: number;

  searchTerm: string;
  onSearchChange: (
    search: string,
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

  onOpenMovement?: (
    equipment: Equipment,
  ) => void;

  onEditEquipment?: (
    equipment: Equipment,
  ) => void;

  onDeleteEquipment?: (
    equipment: Equipment,
  ) => void;

  /**
   * Kept for compatibility with EquipmentPage.
   * Serial editing now belongs in the lazy-loaded Equipment detail UI.
   */
  onEditSerialNumber?: (
    serialNumber: SerialNumber,
    equipment: Equipment,
  ) => void;

  onDeleteSerialNumber?: (
    serialNumber: SerialNumber,
    equipment: Equipment,
  ) => void;

  onViewEquipmentShelves?: (
    equipment: Equipment,
  ) => void;

  onLookupById?: (
    id: string,
  ) => void;

  isLoading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;

  canCreateMovement: boolean;
  canUpdateEquipment?: boolean;
  canDeleteEquipment?: boolean;
  canUpdateSerialNumber?: boolean;
  canDeleteSerialNumber?: boolean;
}

export function EquipmentListTable({
  equipments,
  totalEquipments,
  totalPages,
  currentPage,
  limit,

  searchTerm,
  onSearchChange,

  onPageChange,
  onLimitChange,

  onSelectEquipment,
  onOpenMovement,
  onEditEquipment,
  onDeleteEquipment,
  onViewEquipmentShelves,
  onLookupById,

  isLoading,
  onRefresh,
  onOpenCreateModal,

  canCreateMovement,
  canUpdateEquipment = true,
  canDeleteEquipment = true,
}: EquipmentListTableProps) {
  const [
    copiedId,
    setCopiedId,
  ] = useState<string | null>(
    null,
  );

  const [
    idLookupInput,
    setIdLookupInput,
  ] = useState('');

  function copyId(
    event: React.MouseEvent,
    id: string,
  ) {
    event.stopPropagation();

    navigator.clipboard.writeText(
      id,
    );

    setCopiedId(id);

    toast.success(
      'Identifiant copié',
    );

    setTimeout(
      () =>
        setCopiedId(null),
      1500,
    );
  }

  function submitLookup(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const id =
      idLookupInput.trim();

    if (
      id &&
      onLookupById
    ) {
      onLookupById(id);
    }
  }

  const start =
    totalEquipments === 0
      ? 0
      : (currentPage - 1) *
      limit +
      1;

  const end =
    Math.min(
      currentPage * limit,
      totalEquipments,
    );

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] p-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#8c827a]" />

          <input
            type="search"
            value={searchTerm}
            onChange={(
              event,
            ) =>
              onSearchChange(
                event.target.value,
              )
            }
            placeholder="Rechercher un article..."
            className="h-9 w-full rounded-[3px] border border-[#3f3a36] bg-[#2b2622] pl-9 pr-3 text-xs text-[#f7f5f0] outline-none placeholder:text-[#6f665f] focus:border-[#aea69c]"
          />
        </div>

        {onLookupById && (
          <form
            onSubmit={
              submitLookup
            }
            className="flex min-w-0 flex-1 gap-2 lg:max-w-md"
          >
            <input
              value={
                idLookupInput
              }
              onChange={(
                event,
              ) =>
                setIdLookupInput(
                  event.target.value,
                )
              }
              placeholder="GUID article..."
              className="h-9 min-w-0 flex-1 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] px-3 font-mono text-xs text-[#f7f5f0] outline-none placeholder:text-[#6f665f] focus:border-[#aea69c]"
            />

            <button
              type="submit"
              className="h-9 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-3 text-xs text-[#c9c0ad] hover:text-[#f7f5f0]"
            >
              GUID
            </button>
          </form>
        )}

        <div className="flex items-center gap-2">
          <select
            value={limit}
            onChange={(
              event,
            ) =>
              onLimitChange(
                Number(
                  event.target
                    .value,
                ),
              )
            }
            className="h-9 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] px-2 text-xs text-[#f7f5f0]"
          >
            <option value={10}>
              10
            </option>
            <option value={20}>
              20
            </option>
            <option value={50}>
              50
            </option>
            <option value={100}>
              100
            </option>
          </select>

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#383330] text-[#aea69c] hover:text-[#f7f5f0]"
            title="Actualiser"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-xs text-[#aea69c]">
            Chargement des articles...
          </div>
        ) : equipments.length ===
          0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <Package className="h-7 w-7 text-[#6f665f]" />

            <p className="mt-3 text-sm font-medium text-[#f7f5f0]">
              Aucun article
            </p>

            <p className="mt-1 text-xs text-[#8c827a]">
              {searchTerm
                ? `Aucun résultat pour « ${searchTerm} ».`
                : 'Aucun article n’est enregistré.'}
            </p>

            {!searchTerm && (
              <button
                type="button"
                onClick={
                  onOpenCreateModal
                }
                className="mt-4 rounded-[3px] bg-[#f7f5f0] px-3.5 py-2 text-xs font-medium text-[#2b2622] hover:bg-[#dad2c1]"
              >
                Créer un article
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse">
                <thead className="border-b border-[#3f3a36] bg-[#383330]/60">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#8c827a]">
                    <th className="px-4 py-3 font-medium">
                      Article
                    </th>

                    <th className="px-4 py-3 font-medium">
                      Type
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Quantité
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Séries
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Emplacements
                    </th>

                    <th className="w-52 px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-[#3f3a36]">
                  {equipments.map(
                    (
                      equipment,
                      index,
                    ) => {
                      const serialCount =
                        equipment
                          ._count
                          ?.serialNumbers ??
                        equipment
                          .serialNumbers
                          ?.length ??
                        (equipment.hasSerialNumber
                          ? equipment.equipmentQuantity
                          : 0);

                      const shelfCount =
                        equipment
                          ._count
                          ?.equipmentShelfs ??
                        equipment
                          .equipmentShelfs
                          ?.length ??
                        0;

                      const lowStock =
                        equipment.equipmentQuantity <=
                        equipment.minequipmentQuantity;

                      return (
                        <tr
                          key={
                            equipment.equipmentId
                          }
                          onClick={() =>
                            onSelectEquipment(
                              equipment,
                            )
                          }
                          className="cursor-pointer transition-colors hover:bg-[#383330]/45"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-[#3f3a36] bg-[#383330] font-mono text-[9px] text-[#8c827a]">
                                {String(
                                  (currentPage -
                                    1) *
                                  limit +
                                  index +
                                  1,
                                ).padStart(
                                  2,
                                  '0',
                                )}
                              </span>

                              <div className="min-w-0">
                                <p className="max-w-72 truncate text-xs font-medium text-[#f7f5f0]">
                                  {equipment.equipmentName ??
                                    'Sans nom'}
                                </p>

                                <div className="mt-1 flex items-center gap-1.5">
                                  <span className="max-w-52 truncate font-mono text-[9px] text-[#6f665f]">
                                    {equipment.equipmentId}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(
                                      event,
                                    ) =>
                                      copyId(
                                        event,
                                        equipment.equipmentId,
                                      )
                                    }
                                    className="text-[#6f665f] hover:text-[#f7f5f0]"
                                  >
                                    {copiedId ===
                                      equipment.equipmentId ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span className="rounded-[2px] border border-[#3f3a36] bg-[#383330] px-2 py-1 text-[10px] text-[#c9c0ad]">
                              {equipment.hasSerialNumber
                                ? 'Sérialisé'
                                : 'Standard'}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              {lowStock && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-amber-400"
                                  aria-label="Stock bas"
                                />
                              )}

                              <span className="font-mono text-xs font-semibold text-[#f7f5f0]">
                                {equipment.equipmentQuantity}
                              </span>
                            </div>

                            <p className="mt-0.5 text-[9px] text-[#6f665f]">
                              min. {equipment.minequipmentQuantity}
                            </p>
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs text-[#c9c0ad]">
                            {equipment.hasSerialNumber
                              ? serialCount
                              : '—'}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-xs text-[#c9c0ad]">
                            {shelfCount}
                          </td>

                          <td
                            className="px-4 py-3"
                            onClick={(
                              event,
                            ) =>
                              event.stopPropagation()
                            }
                          >
                            <div className="flex items-center justify-end gap-1">
                              <ActionButton
                                label="Voir"
                                onClick={() =>
                                  onSelectEquipment(
                                    equipment,
                                  )
                                }
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </ActionButton>

                              {onViewEquipmentShelves && (
                                <ActionButton
                                  label="Emplacements"
                                  onClick={() =>
                                    onViewEquipmentShelves(
                                      equipment,
                                    )
                                  }
                                >
                                  <Layers className="h-3.5 w-3.5" />
                                </ActionButton>
                              )}

                              {canCreateMovement &&
                                onOpenMovement && (
                                  <ActionButton
                                    label="Mouvement"
                                    onClick={() =>
                                      onOpenMovement(
                                        equipment,
                                      )
                                    }
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                  </ActionButton>
                                )}

                              {canUpdateEquipment &&
                                onEditEquipment && (
                                  <ActionButton
                                    label="Modifier"
                                    onClick={() =>
                                      onEditEquipment(
                                        equipment,
                                      )
                                    }
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </ActionButton>
                                )}

                              {canDeleteEquipment &&
                                onDeleteEquipment && (
                                  <ActionButton
                                    label="Supprimer"
                                    danger
                                    onClick={() =>
                                      onDeleteEquipment(
                                        equipment,
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </ActionButton>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#3f3a36] md:hidden">
              {equipments.map(
                (equipment) => {
                  const serialCount =
                    equipment
                      ._count
                      ?.serialNumbers ??
                    equipment
                      .serialNumbers
                      ?.length ??
                    (equipment.hasSerialNumber
                      ? equipment.equipmentQuantity
                      : 0);

                  return (
                    <button
                      key={
                        equipment.equipmentId
                      }
                      type="button"
                      onClick={() =>
                        onSelectEquipment(
                          equipment,
                        )
                      }
                      className="block w-full p-4 text-left hover:bg-[#383330]/45"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#f7f5f0]">
                            {equipment.equipmentName ??
                              'Sans nom'}
                          </p>

                          <p className="mt-1 font-mono text-[9px] text-[#6f665f]">
                            {equipment.equipmentId}
                          </p>
                        </div>

                        <span className="font-mono text-sm font-semibold text-[#f7f5f0]">
                          {equipment.equipmentQuantity}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] text-[#8c827a]">
                        <span>
                          {equipment.hasSerialNumber
                            ? `Sérialisé · ${serialCount} série(s)`
                            : 'Standard'}
                        </span>

                        <span>·</span>

                        <span>
                          {equipment._count?.equipmentShelfs ??
                            equipment.equipmentShelfs?.length ??
                            0}{' '}
                          emplacement(s)
                        </span>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 border-t border-[#3f3a36] bg-[#2b2622]/65 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[11px] text-[#8c827a]">
            {start}–{end} sur {totalEquipments}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                currentPage <= 1
              }
              onClick={() =>
                onPageChange(
                  Math.max(
                    1,
                    currentPage - 1,
                  ),
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-2.5 text-xs text-[#c9c0ad] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Précédent
            </button>

            <span className="min-w-16 text-center font-mono text-xs text-[#aea69c]">
              {currentPage} /{' '}
              {Math.max(
                totalPages,
                1,
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
                  Math.min(
                    totalPages,
                    currentPage + 1,
                  ),
                )
              }
              className="inline-flex h-8 items-center gap-1 rounded-[3px] border border-[#3f3a36] bg-[#383330] px-2.5 text-xs text-[#c9c0ad] disabled:opacity-40"
            >
              Suivant
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 text-[10px] text-[#6f665f]">
        <Hash className="h-3 w-3" />
        Les numéros de série ne sont plus chargés dans la liste principale. Ils seront chargés à la demande dans la fiche article.
      </div>
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-[3px] border transition-colors ${danger
          ? 'border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10'
          : 'border-[#3f3a36] bg-[#383330] text-[#aea69c] hover:text-[#f7f5f0]'
        }`}
    >
      {children}
    </button>
  );
}
