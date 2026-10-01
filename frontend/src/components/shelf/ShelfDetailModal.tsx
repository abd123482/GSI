'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Hash,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Warehouse,
  X,
} from 'lucide-react';

import type { Shelf } from '@/types/shelf';
import type { SerialNumber } from '@/types/equipment';
import { useShelfContents } from '@/hooks/use-shelves';

interface ShelfDetailModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ShelfDetailModal({ shelf, isOpen, onClose, onRefresh, isLoading = false }: ShelfDetailModalProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpanded(new Set());
  }, [shelf?.shelfId, isOpen]);

  const contentsQuery = useShelfContents(shelf?.shelfId, isOpen);

  const serialsByEquipment = useMemo(() => {
    const map = new Map<string, SerialNumber[]>();
    for (const serial of contentsQuery.data?.serialNumbers ?? []) {
      if (!serial.equipmentId) continue;
      const list = map.get(serial.equipmentId) ?? [];
      list.push(serial);
      map.set(serial.equipmentId, list);
    }
    return map;
  }, [contentsQuery.data]);

  if (!isOpen || !shelf) return null;

  const allocations = contentsQuery.data?.allocations ?? [];
  const busy = isLoading || contentsQuery.isFetching;

  function toggle(equipmentId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(equipmentId)) next.delete(equipmentId);
      else next.add(equipmentId);
      return next;
    });
  }

  async function refresh() {
    await contentsQuery.refetch();
    onRefresh?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#3f3a36] bg-[#383330] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{shelf.shelfName ?? 'Emplacement sans nom'}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/45"><Warehouse className="h-3 w-3" />{shelf.stock?.stockName ?? 'Stock'}</p>
          </div>
          <div className="flex gap-1">
            <button type="button" onClick={refresh} disabled={busy} className="rounded p-2 text-white/60 hover:bg-white/10 disabled:opacity-40" title="Actualiser"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={onClose} className="rounded p-2 text-white/60 hover:bg-white/10"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <InfoBox label="Quantité actuelle" value={`${shelf.shelfQuantity} u.`} icon={<Hash className="h-3.5 w-3.5" />} />
            <InfoBox label="Stock" value={shelf.stock?.stockName ?? 'Stock'} icon={<Warehouse className="h-3.5 w-3.5" />} />
            <InfoBox label="Statut stock" value={shelf.stock?.status !== false ? 'ACTIVE' : 'INACTIVE'} icon={<Layers className="h-3.5 w-3.5" />} />
          </div>

          <section className="overflow-hidden rounded-lg border border-[#3f3a36]">
            <div className="flex items-center justify-between border-b border-[#3f3a36] bg-[#2b2622] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold"><Boxes className="h-3.5 w-3.5" />Articles présents</h3>
              <span className="text-[10px] text-white/45">{allocations.length} article{allocations.length > 1 ? 's' : ''}</span>
            </div>

            {contentsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/45"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
            ) : contentsQuery.isError ? (
              <div className="m-4 rounded-lg border border-rose-500/30 bg-rose-950/25 p-4 text-xs text-rose-200">Impossible de charger le contenu de cet emplacement.</div>
            ) : allocations.length === 0 ? (
              <div className="m-4 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[#4b4540] bg-[#2b2622]/45 p-6 text-center text-sm text-[#c9c0ad]">Aucun article dans cet emplacement.</div>
            ) : (
              <div className="divide-y divide-[#3f3a36]">
                {allocations.map((allocation) => {
                  const equipment = allocation.equipment;
                  const serialized = Boolean(equipment?.hasSerialNumber);
                  const serials = serialsByEquipment.get(allocation.equipmentId) ?? [];
                  const open = expanded.has(allocation.equipmentId);

                  return (
                    <div key={allocation.equipmentShelfId} className="bg-[#383330]">
                      <button
                        type="button"
                        onClick={() => serialized && toggle(allocation.equipmentId)}
                        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${serialized ? 'cursor-pointer hover:bg-[#2f2a26]' : 'cursor-default'}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-[#48423d] bg-[#2b2622]"><Package className="h-4 w-4 text-[#dad2c1]" /></div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{equipment?.equipmentName ?? 'Article'}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-white/45">
                              <span>{serialized ? 'Sérialisé' : 'Standard'}</span><span>•</span><span>{equipment?.equipmentStatus ?? 'ACTIVE'}</span>
                              {serialized && <><span>•</span><span>{serials.length} série{serials.length > 1 ? 's' : ''}</span></>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded border border-[#45403c] bg-[#2b2622] px-2 py-1 font-mono text-[11px]">{allocation.equipmentQuantity} u.</span>
                          {serialized && (open ? <ChevronDown className="h-4 w-4 text-[#aea69c]" /> : <ChevronRight className="h-4 w-4 text-[#aea69c]" />)}
                        </div>
                      </button>

                      {serialized && open && (
                        <div className="border-t border-[#3f3a36] bg-[#2b2622]/55 px-4 py-3">
                          {serials.length === 0 ? (
                            <p className="text-[11px] text-[#aea69c]">Aucun numéro de série n’est actuellement alloué à cet article dans cet emplacement.</p>
                          ) : (
                            <div className="ml-5 space-y-1.5 border-l border-[#4a4540] pl-4">
                              {serials.map((serial) => (
                                <div key={serial.serialNumberId} className="rounded border border-[#403b37] bg-[#383330]/60 px-3 py-2">
                                  <p className="truncate font-mono text-[11px] font-semibold text-[#f7f5f0]">{serial.serialNumberCode ?? 'Série'}</p>
                                  <p className="mt-0.5 text-[9px] text-[#aea69c]">{serial.serialNumberStatus ?? '—'}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#3f3a36] bg-[#2b2622] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded bg-[#f7f5f0] px-4 py-2 text-xs font-medium text-[#2b2622]">Fermer</button>
        </footer>
      </div>
    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#3f3a36] bg-[#2b2622]/65 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">{icon}{label}</div>
      <p className="mt-2 truncate text-xs font-medium">{value}</p>
    </div>
  );
}
