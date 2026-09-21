'use client';

import {
  useEffect,
  useState,
} from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Hash,
  Layers,
  Loader2,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';
import {
  toast,
} from 'sonner';

import type {
  Shelf,
} from '@/types/shelf';
import {
  useShelfEquipment,
  useShelfSerialNumbers,
} from '@/hooks/use-shelves';

interface ShelfDetailModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenUpdate?: (
    shelf: Shelf,
  ) => void;
  onOpenDelete?: (
    shelf: Shelf,
  ) => void;
  canUpdateShelf?: boolean;
  canDeleteShelf?: boolean;
  isLoading?: boolean;
}

export function ShelfDetailModal({
  shelf,
  isOpen,
  onClose,
  onRefresh,
  onOpenUpdate,
  onOpenDelete,
  canUpdateShelf = true,
  canDeleteShelf = true,
  isLoading = false,
}: ShelfDetailModalProps) {
  const [
    equipmentPage,
    setEquipmentPage,
  ] = useState(1);

  const [
    serialPage,
    setSerialPage,
  ] = useState(1);

  const [
    copied,
    setCopied,
  ] = useState(false);

  useEffect(() => {
    setEquipmentPage(1);
    setSerialPage(1);
  }, [
    shelf?.shelfId,
    isOpen,
  ]);

  const equipmentQuery =
    useShelfEquipment(
      shelf?.shelfId,
      equipmentPage,
      20,
      isOpen,
    );

  const serialQuery =
    useShelfSerialNumbers(
      shelf?.shelfId,
      serialPage,
      20,
      isOpen,
    );

  if (
    !isOpen ||
    !shelf
  ) {
    return null;
  }

  async function copyId() {
    await navigator.clipboard.writeText(
      shelf!.shelfId,
    );

    setCopied(true);
    toast.success('GUID copié');

    setTimeout(
      () =>
        setCopied(false),
      1500,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">
              {shelf.shelfName ??
                'Emplacement sans nom'}
            </h2>

            <p className="mt-0.5 text-[10px] text-white/45">
              Quantité physique en lecture seule
            </p>
          </div>

          <div className="flex gap-1">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <Loader2
                  className={`h-4 w-4 ${isLoading
                      ? 'animate-spin'
                      : ''
                    }`}
                />
              </button>
            )}

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoBox
              label="Quantité actuelle"
              value={`${shelf.shelfQuantity} u.`}
              icon={
                <Hash className="h-3.5 w-3.5" />
              }
            />

            <InfoBox
              label="Stock"
              value={
                shelf.stock?.stockName ??
                shelf.stockId ??
                'Aucun'
              }
              icon={
                <Warehouse className="h-3.5 w-3.5" />
              }
            />

            <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                GUID
              </p>

              <div className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-[10px]">
                  {shelf.shelfId}
                </span>

                <button
                  type="button"
                  onClick={copyId}
                  className="text-white/50 hover:text-white"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <section className="overflow-hidden rounded-lg border border-[#3f3a36]">
            <div className="border-b border-[#3f3a36] bg-[#2b2622] px-4 py-3">
              <h3 className="text-xs font-semibold">
                Articles présents
              </h3>
            </div>

            {equipmentQuery.isLoading ? (
              <Loading />
            ) : (
              <>
                <div className="divide-y divide-[#3f3a36]">
                  {(equipmentQuery.data?.allocations ?? []).map(
                    (allocation) => (
                      <div
                        key={
                          allocation.equipmentShelfId
                        }
                        className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {allocation.equipment?.equipmentName ??
                              allocation.equipmentId ??
                              'Article'}
                          </p>

                          <p className="mt-0.5 text-[9px] text-white/40">
                            {allocation.equipment?.hasSerialNumber
                              ? 'Sérialisé'
                              : 'Standard'}
                          </p>
                        </div>

                        <span className="font-mono font-semibold">
                          {allocation.equipmentQuantity} u.
                        </span>
                      </div>
                    ),
                  )}

                  {!equipmentQuery.data?.allocations?.length && (
                    <Empty text="Aucun article sur cet emplacement." />
                  )}
                </div>

                <Pager
                  page={equipmentQuery.data?.currentPage ?? equipmentPage}
                  totalPages={equipmentQuery.data?.totalPages ?? 1}
                  onPage={setEquipmentPage}
                />
              </>
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-[#3f3a36]">
            <div className="border-b border-[#3f3a36] bg-[#2b2622] px-4 py-3">
              <h3 className="text-xs font-semibold">
                Numéros de série physiquement présents
              </h3>
            </div>

            {serialQuery.isLoading ? (
              <Loading />
            ) : (
              <>
                <div className="divide-y divide-[#3f3a36]">
                  {(serialQuery.data?.serialNumbers ?? []).map(
                    (serial) => (
                      <div
                        key={
                          serial.serialNumberId
                        }
                        className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono font-medium">
                            {serial.serialNumberCode ??
                              serial.serialNumberId}
                          </p>

                          <p className="mt-0.5 truncate text-[9px] text-white/40">
                            {serial.equipment?.equipmentName ??
                              serial.equipmentId ??
                              'Article'}
                          </p>
                        </div>

                        <span className="text-[10px] text-white/50">
                          {serial.serialNumberStatus ?? '—'}
                        </span>
                      </div>
                    ),
                  )}

                  {!serialQuery.data?.serialNumbers?.length && (
                    <Empty text="Aucun numéro de série présent." />
                  )}
                </div>

                <Pager
                  page={serialQuery.data?.currentPage ?? serialPage}
                  totalPages={serialQuery.data?.totalPages ?? 1}
                  onPage={setSerialPage}
                />
              </>
            )}
          </section>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-[#3f3a36] bg-[#2b2622] px-5 py-3">
          {onOpenUpdate && (
            <button
              type="button"
              disabled={!canUpdateShelf}
              onClick={() =>
                onOpenUpdate(
                  shelf,
                )
              }
              className="inline-flex items-center gap-1.5 rounded border border-[#3f3a36] px-3 py-2 text-xs disabled:opacity-40"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Modifier
            </button>
          )}

          {onOpenDelete && (
            <button
              type="button"
              disabled={!canDeleteShelf}
              onClick={() =>
                onOpenDelete(
                  shelf,
                )
              }
              className="inline-flex items-center gap-1.5 rounded border border-rose-500/30 px-3 py-2 text-xs text-rose-300 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Supprimer
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-medium text-[#2b2622]"
          >
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}

function InfoBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate text-xs font-medium">
        {value}
      </p>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-xs text-white/45">
      <Loader2 className="h-4 w-4 animate-spin" />
      Chargement...
    </div>
  );
}

function Empty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="px-4 py-6 text-center text-xs text-white/40">
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
  return (
    <div className="flex items-center justify-end gap-2 border-t border-[#3f3a36] bg-[#2b2622]/50 px-4 py-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() =>
          onPage(
            Math.max(
              1,
              page - 1,
            ),
          )
        }
        className="rounded border border-[#3f3a36] p-1.5 disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <span className="font-mono text-[10px] text-white/45">
        {page} /{' '}
        {Math.max(
          totalPages,
          1,
        )}
      </span>

      <button
        type="button"
        disabled={
          page >= totalPages
        }
        onClick={() =>
          onPage(
            Math.min(
              totalPages,
              page + 1,
            ),
          )
        }
        className="rounded border border-[#3f3a36] p-1.5 disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
