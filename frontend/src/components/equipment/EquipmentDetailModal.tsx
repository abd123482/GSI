'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Barcode,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';

import type {
  Equipment,
  SerialNumber,
} from '@/types/equipment';

import type {
  Movement,
} from '@/types/movement';

import {
  useMovements,
} from '@/hooks/use-movements';

import {
  useCreateSerialNumber,
  useSerialNumbers,
} from '@/hooks/use-serial-numbers';

import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/hooks/use-api';
import { EquipmentService } from '@/services/equipment.service';
import { MovementService } from '@/services/movement.service';

import {
  usePermissions,
} from '@/hooks/use-permissions';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onEditSerialNumber?: (
    serial: SerialNumber,
  ) => void;
  isLoading?: boolean;
}

function movementLabel(
  movement: Movement,
) {
  if (!movement.mouvementStatus) {
    return {
      text: 'ENTRÉE',
      icon:
        ArrowDownToLine,
    };
  }

  return {
    text: 'SORTIE',
    icon:
      ArrowUpFromLine,
  };
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'fr-DZ',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

export function EquipmentDetailModal({
  equipment,
  isOpen,
  onClose,
  onRefresh,
  onEditSerialNumber,
  isLoading = false,
}: EquipmentDetailModalProps) {
  const [
    serialPage,
    setSerialPage,
  ] = useState(1);

  const [
    movementPage,
    setMovementPage,
  ] = useState(1);

  const [
    serialSearch,
    setSerialSearch,
  ] = useState('');

  const [
    newSerialCode,
    setNewSerialCode,
  ] = useState('');

  const {
    permissions,
    canCreateSerialNumber,
    canUpdateSerialNumber,
  } = usePermissions();

  const createSerial =
    useCreateSerialNumber();

  useEffect(() => {
    setSerialPage(1);
    setMovementPage(1);
    setSerialSearch('');
    setNewSerialCode('');
  }, [
    equipment?.equipmentId,
    isOpen,
  ]);

  const serialized =
    Boolean(
      equipment
        ?.hasSerialNumber,
    );

  const serialQuery =
    useSerialNumbers(
      {
        page: serialPage,
        limit: 20,
        equipmentId:
          equipment
            ?.equipmentId,
        serialNumberCode:
          serialSearch.trim() ||
          undefined,
      },
      isOpen &&
        serialized &&
        Boolean(
          equipment
            ?.equipmentId,
        ),
    );

  const movementQuery =
    useMovements(
      {
        page:
          movementPage,
        limit: 20,
        equipmentId:
          equipment
            ?.equipmentId,
      },
      isOpen &&
        Boolean(
          equipment
            ?.equipmentId,
        ),
    );

  const api = useApi();

  const allocationQuery = useQuery({
    queryKey: ['equipment-allocations', equipment?.equipmentId],
    queryFn: () => EquipmentService.getEquipmentShelves(api, equipment!.equipmentId, permissions),
    enabled: isOpen && Boolean(equipment?.equipmentId),
    staleTime: 10_000,
  });

  const allSerialsQuery = useQuery({
    queryKey: ['equipment-all-serials', equipment?.equipmentId],
    queryFn: () => MovementService.getAllEquipmentSerials(api, equipment!.equipmentId, permissions),
    enabled: isOpen && serialized && Boolean(equipment?.equipmentId),
    staleTime: 60_000,
  });

  if (
    !isOpen ||
    !equipment
  ) {
    return null;
  }

  async function addSerial() {
    const code =
      newSerialCode.trim();

    if (
      !code ||
      !equipment
    ) {
      return;
    }

    await createSerial.mutateAsync({
      serialNumberCode:
        code,
      equipmentId:
        equipment.equipmentId,
      serialNumberStatus:
        'AVAILABLE',
    });

    setNewSerialCode('');

    await serialQuery.refetch();
    onRefresh?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#26221f] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">
              {equipment.equipmentName ??
                'Article sans nom'}
            </h2>

            <p className="mt-0.5 text-[10px] text-white/45">
              {serialized
                ? 'Article sérialisé'
                : 'Article standard'}
              {' • '}
              {
                equipment.equipmentStatus
              }
            </p>
          </div>

          <div className="flex gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={
                  onRefresh
                }
                disabled={
                  isLoading
                }
                className="rounded p-2 text-white/60 hover:bg-white/10"
              >
                <Loader2
                  className={`h-4 w-4 ${
                    isLoading
                      ? 'animate-spin'
                      : ''
                  }`}
                />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded p-2 text-white/60 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Stat
              label="Quantité physique"
              value={String(
                equipment.equipmentQuantity,
              )}
              icon={
                <Package className="h-3.5 w-3.5" />
              }
            />

            <Stat
              label="Minimum"
              value={String(
                equipment.minequipmentQuantity,
              )}
            />

            <Stat
              label="Mode"
              value={
                serialized
                  ? 'Sérialisé'
                  : 'Standard'
              }
              icon={
                <Barcode className="h-3.5 w-3.5" />
              }
            />

            <Stat
              label="Statut"
              value={
                equipment.equipmentStatus ? 'Actif' : 'Inactif'
              }
            />
          </div>

          <section className="overflow-hidden rounded-xl border border-[#3f3f46] bg-[#18181b]/55">
            <div className="border-b border-[#3f3f46] px-4 py-3">
              <h3 className="text-xs font-semibold">Répartition par emplacement</h3>
              <p className="mt-0.5 text-[10px] text-white/45">
                Où se trouve actuellement cet article.
              </p>
            </div>
            
            {allocationQuery.isLoading || (serialized && allSerialsQuery.isLoading) ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
            ) : (
              <div className="divide-y divide-[#3f3f46]">
                {(allocationQuery.data?.equipmentShelfs ?? []).map((alloc) => (
                  <div key={alloc.equipmentShelfId} className="px-4 py-3 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white/80">{alloc.shelf?.shelfName ?? 'Emplacement inconnu'}</span>
                      <span className="font-mono">{alloc.equipmentQuantity} u.</span>
                    </div>
                    {serialized && allSerialsQuery.data && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {allSerialsQuery.data
                          .filter(s => s.shelfId === alloc.shelfId)
                          .map(s => (
                            <span key={s.serialNumberId} className="rounded bg-[#1f1b18] px-1.5 py-0.5 font-mono text-[10px] text-white/60 border border-[#3f3f46]">
                              {s.serialNumberCode}
                            </span>
                          ))}
                        {allSerialsQuery.data.filter(s => s.shelfId === alloc.shelfId).length === 0 && (
                          <span className="text-[10px] text-white/30 italic">Aucun numéro de série alloué ici</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!allocationQuery.data?.equipmentShelfs?.length && (
                  <div className="px-4 py-6 text-center text-xs text-white/45">Aucun emplacement alloué.</div>
                )}
              </div>
            )}
          </section>

          {serialized && (
            <section className="overflow-hidden rounded-xl border border-[#3f3f46] bg-[#18181b]/55">
              <div className="space-y-3 border-b border-[#3f3f46] px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-semibold">
                      Numéros de série
                    </h3>

                    <p className="mt-0.5 text-[10px] text-white/45">
                      Le code est immuable après création. Seul le statut peut être modifié.
                    </p>
                  </div>

                  <div className="relative sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />

                    <input
                      value={
                        serialSearch
                      }
                      onChange={(
                        event,
                      ) => {
                        setSerialSearch(
                          event.target
                            .value,
                        );
                        setSerialPage(
                          1,
                        );
                      }}
                      placeholder="Rechercher un S/N..."
                      className="h-8 w-full rounded border border-[#3f3f46] bg-[#1f1b18] pl-8 pr-2 text-xs"
                    />
                  </div>
                </div>

                {canCreateSerialNumber && (
                  <div className="flex gap-2">
                    <input
                      value={
                        newSerialCode
                      }
                      onChange={(
                        event,
                      ) =>
                        setNewSerialCode(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Saisir manuellement le nouveau code série"
                      className="h-9 min-w-0 flex-1 rounded border border-[#3f3f46] bg-[#1f1b18] px-3 font-mono text-xs"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        void addSerial();
                      }}
                      disabled={
                        !newSerialCode.trim() ||
                        createSerial.isPending
                      }
                      className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-3 text-xs font-semibold text-[#18181b] disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter
                    </button>
                  </div>
                )}
              </div>

              {serialQuery.isLoading ? (
                <LoadingRow text="Chargement des numéros de série..." />
              ) : (
                <>
                  <div className="divide-y divide-[#3f3f46]">
                    {(serialQuery.data
                      ?.serialNumbers ??
                      []).map(
                      (serial) => (
                        <div
                          key={
                            serial.serialNumberId
                          }
                          className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono font-semibold">
                              {
                                serial.serialNumberCode
                              }
                            </p>

                            <p className="mt-0.5 text-[9px] text-white/40">
                              {
                                serial.serialNumberStatus
                              }
                            </p>
                          </div>

                          {canUpdateSerialNumber &&
                            onEditSerialNumber && (
                              <button
                                type="button"
                                onClick={() =>
                                  onEditSerialNumber(
                                    serial,
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded border border-[#4a4540] px-2.5 py-1.5 text-[10px] text-[#d4d4d8] hover:text-white"
                              >
                                <Pencil className="h-3 w-3" />
                                Statut
                              </button>
                            )}
                        </div>
                      ),
                    )}

                    {!serialQuery.data
                      ?.serialNumbers
                      ?.length && (
                      <div className="px-4 py-8 text-center text-xs text-white/45">
                        Aucun numéro de série.
                      </div>
                    )}
                  </div>

                  <Pager
                    page={
                      serialQuery.data
                        ?.currentPage ??
                      serialPage
                    }
                    totalPages={
                      serialQuery.data
                        ?.totalPages ??
                      1
                    }
                    onPage={
                      setSerialPage
                    }
                  />
                </>
              )}
            </section>
          )}

          <section className="overflow-hidden rounded-xl border border-[#3f3f46] bg-[#18181b]/55">
            <div className="border-b border-[#3f3f46] px-4 py-3">
              <h3 className="text-xs font-semibold">
                Historique des mouvements
              </h3>

              <p className="mt-0.5 text-[10px] text-white/45">
                Consultation uniquement. Aucun mouvement ne se crée depuis la fiche article.
              </p>
            </div>

            {movementQuery.isLoading ? (
              <LoadingRow text="Chargement des mouvements..." />
            ) : (
              <>
                <div className="divide-y divide-[#3f3f46]">
                  {(movementQuery.data
                    ?.movements ??
                    []).map(
                    (movement) => {
                      const descriptor =
                        movementLabel(
                          movement,
                        );

                      const Icon =
                        descriptor.icon;

                      const line =
                        movement.items?.find(
                          (item) =>
                            item.equipmentId
                              .toLowerCase() ===
                            equipment.equipmentId
                              .toLowerCase(),
                        );

                      const quantity =
                        line?.equipmentQuantity ?? 0;

                      return (
                        <div
                          key={
                            movement.mouvementId
                          }
                          className="grid grid-cols-[100px_minmax(0,1fr)_70px] items-center gap-3 px-4 py-3 text-xs"
                        >
                          <span className="inline-flex items-center gap-1 text-white/70">
                            <Icon className="h-3.5 w-3.5" />
                            {
                              descriptor.text
                            }
                          </span>

                          <div className="min-w-0">
                            <p className="truncate text-white/75">
                              {line?.sourceShelf
                                ?.shelfName ??
                                'Extérieur'}
                              {' → '}
                              {line?.destinationShelf
                                ?.shelfName ??
                                'Extérieur'}
                            </p>

                            <p className="mt-0.5 text-[9px] text-white/35">
                              Date d'effet: {formatDate(
                                movement.happenedAt,
                              )} • Créé le: {formatDate(
                                movement.createdAt,
                              )}
                            </p>
                          </div>

                          <span className="text-right font-mono font-semibold">
                            {
                              quantity
                            }{' '}
                            u.
                          </span>
                        </div>
                      );
                    },
                  )}

                  {!movementQuery.data
                    ?.movements
                    ?.length && (
                    <div className="px-4 py-8 text-center text-xs text-white/45">
                      Aucun mouvement enregistré.
                    </div>
                  )}
                </div>

                <Pager
                  page={
                    movementQuery.data
                      ?.currentPage ??
                    movementPage
                  }
                  totalPages={
                    movementQuery.data
                      ?.totalPages ??
                    1
                  }
                  onPage={
                    setMovementPage
                  }
                />
              </>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#3f3f46] bg-[#26221f] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b]"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/65 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </div>

      <p className="mt-2 text-sm font-semibold">
        {value}
      </p>
    </div>
  );
}

function LoadingRow({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-7 text-xs text-white/45">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (
    page: number,
  ) => void;
}) {
  if (
    totalPages <= 1
  ) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-2 border-t border-[#3f3f46] px-4 py-2">
      <button
        type="button"
        disabled={
          page <= 1
        }
        onClick={() =>
          onPage(
            page - 1,
          )
        }
        className="rounded border border-[#3f3f46] px-2 py-1 text-[10px] disabled:opacity-30"
      >
        Préc.
      </button>

      <span className="text-[10px] text-white/45">
        {page} /{' '}
        {totalPages}
      </span>

      <button
        type="button"
        disabled={
          page >= totalPages
        }
        onClick={() =>
          onPage(
            page + 1,
          )
        }
        className="rounded border border-[#3f3f46] px-2 py-1 text-[10px] disabled:opacity-30"
      >
        Suiv.
      </button>
    </div>
  );
}
