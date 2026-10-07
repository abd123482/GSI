'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Barcode,
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  RefreshCw,
  Warehouse,
  X,
} from 'lucide-react';

import type { Shelf } from '@/types/shelf';
import { useShelfSerialNumbers } from '@/hooks/use-shelves';

interface ShelfDetailModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ShelfDetailModal({ shelf, isOpen, onClose, onRefresh, isLoading = false }: ShelfDetailModalProps) {
  const [page, setPage] = useState(1);
  const limit = 20;

  const serialsQuery = useShelfSerialNumbers(shelf?.shelfId, page, limit, isOpen);

  if (!isOpen || !shelf) return null;

  const busy = isLoading || serialsQuery.isFetching;
  const serials = serialsQuery.data?.serialNumbers ?? [];
  const totalPages = serialsQuery.data?.totalPages ?? 1;

  async function refresh() {
    await serialsQuery.refetch();
    onRefresh?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-5 py-4">
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
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <InfoBox label="Stock parent" value={shelf.stock?.stockName ?? 'Inconnu'} icon={<Warehouse className="h-3.5 w-3.5" />} />
            <InfoBox label="Statut de l'emplacement" value={shelf.status !== false ? 'Actif' : 'Inactif'} icon={<Layers className="h-3.5 w-3.5" />} />
          </div>

          <section className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#18181b]">
            <div className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-4 py-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold"><Barcode className="h-3.5 w-3.5" />Équipements présents</h3>
              <span className="text-[10px] text-white/45">{serialsQuery.data?.totalSerialNumbers ?? 0} numéros de série</span>
            </div>

            {serialsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-white/45"><Loader2 className="h-4 w-4 animate-spin" />Chargement...</div>
            ) : serialsQuery.isError ? (
              <div className="m-4 rounded-lg border border-rose-500/30 bg-rose-950/25 p-4 text-xs text-rose-200">Impossible de charger le contenu de cet emplacement.</div>
            ) : serials.length === 0 ? (
              <div className="m-4 flex min-h-32 items-center justify-center rounded-lg border border-dashed border-[#4b4540] bg-[#18181b]/45 p-6 text-center text-sm text-[#d4d4d8]">Aucun équipement dans cet emplacement.</div>
            ) : (
              <div>
                <div className="divide-y divide-[#3f3f46]">
                  {Array.from(
                    serials.reduce((acc, serial) => {
                      const eqId = serial.equipment?.equipmentId ?? 'unknown';
                      if (!acc.has(eqId)) {
                        acc.set(eqId, { equipmentName: serial.equipment?.equipmentName ?? 'Article inconnu', serials: [] });
                      }
                      acc.get(eqId)!.serials.push(serial);
                      return acc;
                    }, new Map<string, { equipmentName: string; serials: typeof serials }>()).values()
                  ).map((eq, i) => (
                    <div key={i} className="group relative flex items-center justify-between gap-3 bg-[#27272a] px-4 py-3 hover:bg-[#3f3f46]/50">
                      <div>
                        <p className="text-xs font-semibold text-[#fafafa]">{eq.equipmentName}</p>
                        <p className="text-[10px] text-white/45">{eq.serials.length} numéro(s) de série</p>
                      </div>
                      
                      {/* Hover Tooltip */}
                      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden -translate-x-1/2 w-64 rounded-md border border-[#3f3f46] bg-[#18181b] p-3 shadow-xl group-hover:block">
                        <p className="mb-2 text-[10px] font-semibold text-white/45 uppercase tracking-wider">Numéros de série</p>
                        <div className="flex flex-wrap gap-1.5">
                          {eq.serials.map(s => (
                            <span key={s.serialNumberId} className="rounded bg-[#27272a] px-1.5 py-0.5 font-mono text-[10px] text-white">
                              {s.serialNumberCode ?? 'Série'}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-[#3f3f46] p-3 text-xs">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded border border-[#3f3f46] p-1.5 text-[#a1a1aa] disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-[#a1a1aa]">Page {page} sur {totalPages}</span>
                    <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="rounded border border-[#3f3f46] p-1.5 text-[#a1a1aa] disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <footer className="flex justify-end border-t border-[#3f3f46] bg-[#18181b] px-5 py-3">
          <button type="button" onClick={onClose} className="rounded bg-[#fafafa] px-4 py-2 text-xs font-medium text-[#18181b]">Fermer</button>
        </footer>
      </div>
    </div>
  );
}

function InfoBox({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#3f3f46] bg-[#18181b]/65 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40">{icon}{label}</div>
      <p className="mt-2 truncate text-xs font-medium">{value}</p>
    </div>
  );
}
