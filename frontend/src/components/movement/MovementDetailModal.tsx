'use client';

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpFromLine,
  Barcode,
  CalendarClock,
  Package,
  UserRound,
  X,
} from 'lucide-react';

import type {
  Movement,
} from '@/types/movement';

interface MovementDetailModalProps {
  movement:
    | Movement
    | null;
  isOpen: boolean;
  onClose: () => void;
}

function movementType(
  movement: Movement,
): 'IN' | 'OUT' | 'TRANSFER' {
  const status =
    movement.mouvementStatus
      ?.toUpperCase();

  if (
    status === 'IN' ||
    status === 'ENTRY' ||
    status === 'ENTRÉE'
  ) {
    return 'IN';
  }

  if (
    status === 'OUT' ||
    status === 'EXIT' ||
    status === 'SORTIE'
  ) {
    return 'OUT';
  }

  return 'TRANSFER';
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

function shelfName(
  shelf:
    | {
        shelfName:
          string | null;
      }
    | null
    | undefined,
  externalText: string,
) {
  return (
    shelf?.shelfName ??
    externalText
  );
}

export function MovementDetailModal({
  movement,
  isOpen,
  onClose,
}: MovementDetailModalProps) {
  if (
    !isOpen ||
    !movement
  ) {
    return null;
  }

  const type =
    movementType(
      movement,
    );

  const Icon =
    type === 'IN'
      ? ArrowDownToLine
      : type === 'OUT'
        ? ArrowUpFromLine
        : ArrowRightLeft;

  const typeText =
    type === 'IN'
      ? 'ENTRÉE'
      : type === 'OUT'
        ? 'SORTIE'
        : 'TRANSFERT';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#26221f] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded border border-[#3f3a36] bg-[#383330]">
              <Icon className="h-4 w-4" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">
                  Mouvement {typeText}
                </h2>

                {movement.origin ===
                  'INVENTORY_ADJUSTMENT' && (
                  <span className="rounded border border-violet-400/30 bg-violet-950/25 px-2 py-0.5 text-[9px] font-semibold text-violet-200">
                    AJUSTEMENT INVENTAIRE
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-[10px] text-white/45">
                Aucun UUID/GUID n’est affiché.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-white/60 hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoCard
              icon={CalendarClock}
              label="Date"
              value={formatDate(
                movement.createdAt,
              )}
            />

            <InfoCard
              icon={Package}
              label="Quantité totale"
              value={`${movement.mouvementQuantity ?? 0} unité(s)`}
            />

            <InfoCard
              icon={ArrowRightLeft}
              label="Type"
              value={typeText}
            />

            <InfoCard
              icon={UserRound}
              label="Créé par"
              value={
                movement.createdByUser
                  ?.userName ??
                movement.createdByUser
                  ?.userEmail ??
                '—'
              }
            />
          </div>

          <section className="rounded-lg border border-[#3f3a36] bg-[#2b2622] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[#8c827a]">
              Trajet commun
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <RouteBox
                label="Source"
                value={shelfName(
                  movement.sourceShelf,
                  'Extérieur',
                )}
              />

              <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-[#5c544d] sm:rotate-0" />

              <RouteBox
                label="Destination"
                value={shelfName(
                  movement.destinationShelf,
                  'Extérieur',
                )}
              />
            </div>
          </section>

          {movement.reason && (
            <section className="rounded-lg border border-violet-400/20 bg-violet-950/15 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/70">
                Motif
              </p>

              <p className="mt-2 text-xs text-violet-100">
                {movement.reason}
              </p>
            </section>
          )}

          <section className="overflow-hidden rounded-lg border border-[#3f3a36]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold">
                  Lignes du mouvement
                </h3>

                <p className="mt-0.5 text-[10px] text-white/40">
                  Articles et numéros de série concernés.
                </p>
              </div>

              <span className="font-mono text-xs text-[#aea69c]">
                {movement.items
                  ?.length ?? 0}
              </span>
            </div>

            <div className="divide-y divide-[#3f3a36]">
              {(movement.items ??
                []).map(
                (
                  item,
                  index,
                ) => (
                  <div
                    key={
                      item.mouvementEquipmentId ??
                      `${index}-${item.equipmentId}`
                    }
                    className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)_100px] sm:items-center"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded border border-[#3f3a36] bg-[#383330] font-mono text-[10px] text-[#aea69c]">
                      {String(
                        index + 1,
                      ).padStart(
                        2,
                        '0',
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        {item.equipment
                          ?.equipmentName ??
                          'Article'}
                      </p>

                      <p className="mt-1 text-[9px] text-white/35">
                        {item.equipmentTypeSnapshot ===
                        'SERIALIZED'
                          ? 'Sérialisé'
                          : item.equipmentTypeSnapshot ===
                              'STANDARD'
                            ? 'Standard'
                            : item.serialNumberId
                              ? 'Sérialisé'
                              : 'Standard'}
                      </p>
                    </div>

                    <div className="min-w-0">
                      {item.serialNumberId ? (
                        <p className="flex items-center gap-1.5 truncate font-mono text-xs text-[#c9c0ad]">
                          <Barcode className="h-3.5 w-3.5 shrink-0" />
                          {item.serialNumber
                            ?.serialNumberCode ??
                            'Numéro de série'}
                        </p>
                      ) : (
                        <span className="text-xs text-[#6f665f]">
                          Article quantitatif
                        </span>
                      )}
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="inline-flex rounded border border-[#3f3a36] bg-[#383330] px-2 py-1 font-mono text-xs font-semibold">
                        {
                          item.mouvementQuantity
                        }{' '}
                        u.
                      </span>
                    </div>
                  </div>
                ),
              )}

              {!movement.items
                ?.length && (
                <div className="px-4 py-8 text-center text-xs text-[#8c827a]">
                  Aucune ligne enregistrée.
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#3f3a36] bg-[#26221f] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-semibold text-[#2b2622]"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon:
    typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-[#3f3a36] bg-[#2b2622] p-3">
      <div className="flex items-center gap-2 text-[#8c827a]">
        <Icon className="h-3.5 w-3.5" />

        <span className="text-[10px] uppercase tracking-wider">
          {label}
        </span>
      </div>

      <p className="mt-2 break-words text-xs font-medium">
        {value}
      </p>
    </div>
  );
}

function RouteBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 flex-1 rounded border border-[#3f3a36] bg-[#383330]/55 p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#8c827a]">
        {label}
      </p>

      <p className="mt-1 truncate text-xs font-medium">
        {value}
      </p>
    </div>
  );
}
