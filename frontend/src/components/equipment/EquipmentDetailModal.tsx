'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Barcode,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Hash,
  Layers,
  Loader2,
  Package,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import type { Equipment } from '@/types/equipment';
import type { Movement } from '@/types/movement';
import { useMovements } from '@/hooks/use-movements';
import { useSerialNumbers } from '@/hooks/use-serial-numbers';
import { getEquipmentVisualTheme } from './equipment-icons';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenMovement?: (equipment: Equipment) => void;
  isLoading?: boolean;
}

function movementLabel(movement: Movement) {
  const status = movement.mouvementStatus?.toUpperCase();

  if (status === 'IN' || status === 'ENTRY' || status === 'ENTRÉE') {
    return {
      text: 'ENTRÉE',
      icon: ArrowDownToLine,
    };
  }

  if (status === 'OUT' || status === 'EXIT' || status === 'SORTIE') {
    return {
      text: 'SORTIE',
      icon: ArrowUpFromLine,
    };
  }

  return {
    text: 'TRANSFERT',
    icon: ArrowRightLeft,
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('fr-DZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function EquipmentDetailModal({
  equipment,
  isOpen,
  onClose,
  onOpenMovement,
  onRefresh,
  isLoading = false,
}: EquipmentDetailModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);
  const [serialSearch, setSerialSearch] = useState('');
  const [serialPage, setSerialPage] = useState(1);
  const [movementPage, setMovementPage] = useState(1);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [isOpen, onClose]);

  useEffect(() => {
    setSerialPage(1);
    setMovementPage(1);
    setSerialSearch('');
  }, [equipment?.equipmentId, isOpen]);

  const serialized = Boolean(equipment?.hasSerialNumber);

  const serialQuery = useSerialNumbers(
    {
      page: serialPage,
      limit: 20,
      equipmentId: equipment?.equipmentId,
      serialNumberCode: serialSearch.trim() || undefined,
    },
    isOpen && serialized && Boolean(equipment?.equipmentId),
  );

  const movementQuery = useMovements(
    {
      page: movementPage,
      limit: 20,
      equipmentId: equipment?.equipmentId,
    },
    isOpen && Boolean(equipment?.equipmentId),
  );

  const serialCount =
    equipment?._count?.serialNumbers ??
    (serialized ? equipment?.equipmentQuantity ?? 0 : 0);

  const allocations = equipment?.equipmentShelfs ?? [];

  const allocatedQuantity = useMemo(
    () =>
      allocations.reduce(
        (sum, allocation) =>
          sum + Number(allocation.equipmentQuantity || 0),
        0,
      ),
    [allocations],
  );

  if (!isOpen || !equipment) return null;

  const theme = getEquipmentVisualTheme(equipment.equipmentName);
  const Icon = theme.icon;

  const copyEquipmentId = async () => {
    await navigator.clipboard.writeText(equipment.equipmentId);
    setCopiedId(true);
    toast.success('Identifiant copié');
    setTimeout(() => setCopiedId(false), 1500);
  };

  const copySerial = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedSn(code);
    setTimeout(() => setCopiedSn(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[#3f3a36] bg-[#26221f] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#3f3a36] bg-[#2b2622]">
              <Icon className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">
                {equipment.equipmentName ?? 'Article sans nom'}
              </h2>
              <p className="mt-0.5 text-[10px] text-white/50">
                {serialized ? 'Article sérialisé' : 'Article standard'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="rounded p-2 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
              >
                <Loader2
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
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

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Quantité globale"
              value={String(equipment.equipmentQuantity)}
              icon={<Package className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Minimum"
              value={String(equipment.minequipmentQuantity)}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
            />
            <Stat
              label="Emplacements"
              value={String(equipment._count?.equipmentShelfs ?? allocations.length)}
              icon={<Layers className="h-3.5 w-3.5" />}
            />
            <Stat
              label={serialized ? 'Numéros de série' : 'Alloué'}
              value={String(serialized ? serialCount : allocatedQuantity)}
              icon={
                serialized ? (
                  <Barcode className="h-3.5 w-3.5" />
                ) : (
                  <Hash className="h-3.5 w-3.5" />
                )
              }
            />
          </div>

          <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  GUID
                </p>
                <p className="mt-1 truncate font-mono text-[11px]">
                  {equipment.equipmentId}
                </p>
              </div>

              <button
                type="button"
                onClick={copyEquipmentId}
                className="rounded border border-[#3f3a36] bg-[#383330] p-2 text-white/60 hover:text-white"
              >
                {copiedId ? (
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          <section className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/55">
            <div className="border-b border-[#3f3a36] px-4 py-3">
              <h3 className="text-xs font-semibold">Emplacements actuels</h3>
            </div>

            {allocations.length ? (
              <div className="divide-y divide-[#3f3a36]">
                {allocations.map((allocation) => (
                  <div
                    key={allocation.equipmentShelfId}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {allocation.shelf?.shelfName ?? allocation.shelfId}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-white/40">
                        {allocation.shelfId}
                      </p>
                    </div>

                    <span className="rounded border border-[#3f3a36] bg-[#383330] px-2 py-1 font-mono">
                      {allocation.equipmentQuantity} u.
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-xs text-white/45">
                Aucun stock physique actuellement affecté à un emplacement.
              </div>
            )}
          </section>

          {serialized && (
            <section className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/55">
              <div className="flex flex-col gap-3 border-b border-[#3f3a36] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xs font-semibold">
                    Numéros de série
                  </h3>
                  <p className="mt-0.5 text-[10px] text-white/45">
                    Chargement paginé à la demande.
                  </p>
                </div>

                <div className="relative sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-white/40" />
                  <input
                    value={serialSearch}
                    onChange={(event) => {
                      setSerialSearch(event.target.value);
                      setSerialPage(1);
                    }}
                    placeholder="Rechercher un S/N..."
                    className="h-8 w-full rounded border border-[#3f3a36] bg-[#1f1b18] pl-8 pr-2 text-xs outline-none focus:border-white/40"
                  />
                </div>
              </div>

              {serialQuery.isLoading ? (
                <LoadingRow text="Chargement des numéros de série..." />
              ) : (
                <>
                  <div className="divide-y divide-[#3f3a36]">
                    {(serialQuery.data?.serialNumbers ?? []).map((serial) => (
                      <div
                        key={serial.serialNumberId}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono font-medium">
                            {serial.serialNumberCode ?? serial.serialNumberId}
                          </p>
                          <p className="mt-0.5 truncate text-[9px] text-white/40">
                            {serial.serialNumberStatus ?? '—'}
                          </p>
                        </div>

                        <div className="truncate text-white/60">
                          {serial.shelf?.shelfName ??
                            (serial.shelfId ? serial.shelfId : 'Non affecté')}
                        </div>

                        {serial.serialNumberCode && (
                          <button
                            type="button"
                            onClick={() => copySerial(serial.serialNumberCode!)}
                            className="rounded p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                          >
                            {copiedSn === serial.serialNumberCode ? (
                              <Check className="h-3 w-3 text-emerald-300" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}

                    {!serialQuery.data?.serialNumbers?.length && (
                      <div className="px-4 py-6 text-center text-xs text-white/45">
                        Aucun numéro de série.
                      </div>
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
          )}

          <section className="rounded-xl border border-[#3f3a36] bg-[#2b2622]/55">
            <div className="flex items-center justify-between border-b border-[#3f3a36] px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold">Historique des mouvements</h3>
                <p className="mt-0.5 text-[10px] text-white/45">
                  Documents contenant cet article.
                </p>
              </div>

              {onOpenMovement && (
                <button
                  type="button"
                  onClick={() => onOpenMovement(equipment)}
                  className="inline-flex items-center gap-1.5 rounded bg-emerald-400 px-3 py-1.5 text-[11px] font-semibold text-[#1f1c19]"
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  Nouveau
                </button>
              )}
            </div>

            {movementQuery.isLoading ? (
              <LoadingRow text="Chargement des mouvements..." />
            ) : (
              <>
                <div className="divide-y divide-[#3f3a36]">
                  {(movementQuery.data?.movements ?? []).map((movement) => {
                    const descriptor = movementLabel(movement);
                    const MovementIcon = descriptor.icon;
                    const line = movement.items?.find(
                      (item) =>
                        item.equipmentId.toLowerCase() ===
                        equipment.equipmentId.toLowerCase(),
                    );
                    const quantity =
                      line?.mouvementQuantity ??
                      movement.mouvementQuantity ??
                      0;

                    return (
                      <div
                        key={movement.mouvementId}
                        className="grid grid-cols-[100px_minmax(0,1fr)_80px] items-center gap-3 px-4 py-3 text-xs"
                      >
                        <span className="inline-flex items-center gap-1 text-white/70">
                          <MovementIcon className="h-3.5 w-3.5" />
                          {descriptor.text}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-white/75">
                            {(movement.sourceShelf?.shelfName ??
                              movement.sourceShelfId ??
                              'Extérieur') +
                              ' → ' +
                              (movement.destinationShelf?.shelfName ??
                                movement.destinationShelfId ??
                                'Extérieur')}
                          </p>
                          <p className="mt-0.5 text-[9px] text-white/35">
                            {formatDate(movement.createdAt)}
                          </p>
                        </div>

                        <span className="text-right font-mono font-semibold">
                          {quantity} u.
                        </span>
                      </div>
                    );
                  })}

                  {!movementQuery.data?.movements?.length && (
                    <div className="px-4 py-6 text-center text-xs text-white/45">
                      Aucun mouvement enregistré.
                    </div>
                  )}
                </div>

                <Pager
                  page={movementQuery.data?.currentPage ?? movementPage}
                  totalPages={movementQuery.data?.totalPages ?? 1}
                  onPage={setMovementPage}
                />
              </>
            )}
          </section>
        </div>

        <footer className="flex items-center justify-end border-t border-[#3f3a36] bg-[#26221f] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#3f3a36] bg-[#383330] px-4 py-2 text-xs hover:bg-[#453f3a]"
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
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}

function LoadingRow({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-4 py-6 text-xs text-white/45">
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
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-[#3f3a36] px-4 py-2">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        className="rounded border border-[#3f3a36] p-1.5 disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      <span className="font-mono text-[10px] text-white/45">
        {page} / {Math.max(totalPages, 1)}
      </span>

      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        className="rounded border border-[#3f3a36] p-1.5 disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
