'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Equipment } from '@/types/equipment';
import { Movement } from '@/types/movement';
import { MovementService } from '@/services/movement.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import { getEquipmentVisualTheme } from './equipment-icons';
import {
  X,
  Copy,
  Check,
  Database,
  Hash,
  Layers,
  Code,
  Barcode,
  AlertTriangle,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  Plus,
  Loader2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenMovement?: (equipment: Equipment) => void;
  isLoading?: boolean;
}

export function EquipmentDetailModal({
  equipment,
  isOpen,
  onClose,
  onOpenMovement,
}: EquipmentDetailModalProps) {
  const api = useApi();
  const { permissions } = usePermissions();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);
  const [snSearch, setSnSearch] = useState('');

  // ESC key listener to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Movements query with TanStack Query
  const { data: movements = [], isLoading: isLoadingMovements } = useQuery<Movement[]>({
    queryKey: ['equipment-movements', equipment?.equipmentId],
    queryFn: () =>
      MovementService.getMovementsByEquipmentId(
        api,
        equipment!.equipmentId,
        { page: 1, limit: 100 },
        permissions,
      ),
    enabled: isOpen && !!equipment?.equipmentId,
    staleTime: 10 * 1000,
  });

  // Dynamic audit calculation: Initial Quantity + Total IN - Total OUT = Current Quantity
  const auditSummary = useMemo(() => {
    if (!equipment) return null;
    return MovementService.calculateMovementAudit(movements, equipment.equipmentQuantity);
  }, [movements, equipment]);

  const serials = useMemo(() => equipment?.serialNumbers ?? [], [equipment]);

  const filteredSerials = useMemo(() => {
    if (!snSearch.trim()) return serials;
    const term = snSearch.toLowerCase().trim();
    return serials.filter(
      (s) =>
        (s.serialNumberCode || '').toLowerCase().includes(term) ||
        (s.shelf?.shelfName || '').toLowerCase().includes(term) ||
        (s.serialNumberStatus || '').toLowerCase().includes(term)
    );
  }, [serials, snSearch]);

  if (!isOpen || !equipment) return null;

  const visualTheme = getEquipmentVisualTheme(equipment.equipmentName);
  const IconComp = visualTheme.icon;
  const displayQty = equipment.hasSerialNumber
    ? (equipment.serialNumbers?.length ?? equipment.equipmentQuantity)
    : equipment.equipmentQuantity;

  const handleCopyId = () => {
    navigator.clipboard.writeText(equipment.equipmentId);
    setCopiedId(true);
    toast.success('Identifiant copié !');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopySerial = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSn(code);
    toast.success(`Numéro de série copié : ${code}`);
    setTimeout(() => setCopiedSn(null), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* FIXED / STICKY HEADER WITH CLOSE BUTTON PROMINENTLY IN TOP-LEFT */}
        <div className="shrink-0 px-5 py-3.5 bg-[#26221f] border-b border-[#3f3a36] flex items-center justify-between gap-3 shadow-xs">
          {/* Top Left: Close Button + Article Identity */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Top-Left Close Button requested by user */}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#383330] hover:bg-[#453f3a] text-white border border-[#4d4742] hover:border-[#6a625b] rounded-lg text-xs font-medium transition-all cursor-pointer shadow-xs group shrink-0"
              aria-label="Fermer la page"
              title="Fermer cette fiche (Échap)"
            >
              <X className="w-4 h-4 text-white/90 group-hover:text-white transition-transform group-hover:scale-110" />
              <span className="font-semibold">Fermer</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-white/60 bg-black/40 rounded border border-white/10">
                Échap
              </kbd>
            </button>

            <div className="h-5 w-px bg-[#3f3a36] shrink-0" />

            {/* Article icon & Title */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0] shrink-0">
                <IconComp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1
                  id="equipment-detail-title"
                  className="text-sm sm:text-base font-semibold text-white truncate max-w-xs sm:max-w-md"
                >
                  {equipment.equipmentName ?? 'Article sans nom'}
                </h1>
                <div className="text-[11px] text-white/70">
                  {equipment.hasSerialNumber ? 'Article avec numéros de série' : 'Article standard'}
                </div>
              </div>
            </div>
          </div>

          {/* Top Right: Status Badge & Secondary Close Button */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              En stock
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              aria-label="Fermer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE MODAL CONTENT */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar bg-[#383330]">
          {/* Properties Table */}
          <div className="bg-[#2b2622]/80 border border-[#3f3a36] rounded-xl divide-y divide-[#3f3a36] text-xs text-white shadow-xs">
            {/* Property: GUID */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/80 w-44 shrink-0">
                <Database className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="font-medium">Identifiant</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-white min-w-0">
                <span className="truncate max-w-sm sm:max-w-md select-all bg-[#1f1b18] px-2 py-1 rounded border border-[#3f3a36]">
                  {equipment.equipmentId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1.5 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors cursor-pointer shrink-0"
                  title="Copier l'identifiant"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Property: Quantity & Stock Level */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/80 w-44 shrink-0">
                <Hash className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="font-medium">Quantité en stock</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    displayQty > 0
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-500/50 shadow-xs'
                      : 'bg-amber-950/50 text-amber-300 border border-amber-500/50 shadow-xs'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {displayQty} unités
                </span>
                {equipment.minequipmentQuantity !== undefined &&
                  displayQty <= equipment.minequipmentQuantity && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-200 border border-amber-400/50 text-[10px] font-bold">
                      <AlertTriangle className="w-3 h-3" />
                      Seuil d&apos;alerte ({equipment.minequipmentQuantity})
                    </span>
                  )}
              </div>
            </div>

            {/* Property: Traçabilité / Mode */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/80 w-44 shrink-0">
                <Barcode className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="font-medium">Mode de traçabilité</span>
              </div>
              <div>
                {equipment.hasSerialNumber ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1f1b18] text-white font-semibold text-xs border border-[#3f3a36]">
                    <Barcode className="w-3.5 h-3.5 text-purple-400" />
                    <span>Sérialisé ({serials.length} numéros de série)</span>
                  </span>
                ) : (
                  <span className="text-white/80 font-medium">Stock quantitatif standard (sans numéro de série)</span>
                )}
              </div>
            </div>

            {/* Property: Emplacements */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/80 w-44 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#10b981]" />
                <span className="font-medium">Emplacements</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                {equipment.equipmentShelfs && equipment.equipmentShelfs.length > 0 ? (
                  equipment.equipmentShelfs.map((es) => (
                    <span
                      key={es.equipmentShelfId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#1f1b18] border border-[#3f3a36] text-xs font-medium text-white"
                    >
                      <Layers className="w-3 h-3 text-[#10b981]" />
                      <span>{es.shelf?.shelfName ?? 'Emplacement'}</span>
                      <span className="font-mono text-[11px] font-bold text-emerald-400">
                        ({es.equipmentQuantity} u.)
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-white/60 italic">Non assigné à un emplacement</span>
                )}
              </div>
            </div>
          </div>

          {/* Child Serial Numbers Detailed Section */}
          {equipment.hasSerialNumber && (
            <div className="space-y-3 p-4 bg-[#2b2622]/60 border border-[#3f3a36] rounded-xl shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-purple-950/40 border border-purple-800/40 text-purple-300">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Numéros de série ({serials.length})
                    </h3>
                  </div>
                </div>

                {/* Quick search input */}
                {serials.length > 0 && (
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
                    <input
                      type="text"
                      value={snSearch}
                      onChange={(e) => setSnSearch(e.target.value)}
                      placeholder="Filtrer S/N ou emplacement..."
                      className="w-full h-8 pl-8 pr-3 bg-[#1f1b18] border border-[#3f3a36] rounded-md text-xs text-white placeholder-white/40 focus:border-[#10b981] focus:outline-none font-mono"
                    />
                    {snSearch && (
                      <button
                        type="button"
                        onClick={() => setSnSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {serials.length === 0 ? (
                <div className="p-6 bg-[#1f1b18] border border-[#3f3a36] rounded-lg text-center text-xs text-white/70 italic">
                  Aucun numéro de série enregistré pour cet article.
                </div>
              ) : (
                <div className="border border-[#3f3a36] rounded-lg overflow-hidden max-h-72 overflow-y-auto bg-[#1f1b18] custom-scrollbar">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#26221f] text-white font-semibold border-b border-[#3f3a36] sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center text-[10px] font-mono text-white/70">#</th>
                        <th className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-white/70">Code de série</th>
                        <th className="py-2.5 px-3 text-center text-[10px] font-mono uppercase tracking-wider text-white/70">Statut</th>
                        <th className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-white/70">Emplacement assigné</th>
                        <th className="py-2.5 px-3 text-right text-[10px] font-mono uppercase tracking-wider text-white/70">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#332e2a]">
                      {filteredSerials.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-white/60">
                            Aucun numéro de série ne correspond à votre recherche.
                          </td>
                        </tr>
                      ) : (
                        filteredSerials.map((sn, sIdx) => (
                          <tr key={sn.serialNumberId} className="hover:bg-white/5 transition-colors group">
                            <td className="py-2 px-3 text-center font-mono text-[11px] text-white/50">
                              #{String(sIdx + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2 px-3 font-mono font-medium text-white text-[11px]">
                              <span className="select-all">{sn.serialNumberCode ?? 'S/N inconnu'}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                                  sn.serialNumberStatus === 'AVAILABLE'
                                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-600/40'
                                    : 'bg-amber-950/60 text-amber-300 border border-amber-600/40'
                                }`}
                              >
                                {sn.serialNumberStatus ?? 'DISPO'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-white/80">
                              {sn.shelf?.shelfName ? (
                                <span className="inline-flex items-center gap-1.5 font-medium text-white text-[11px]">
                                  <Layers className="w-3 h-3 text-[#10b981]" />
                                  <span>{sn.shelf.shelfName}</span>
                                </span>
                              ) : (
                                <span className="text-white/40 text-[11px] italic">Non assigné</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right">
                              {sn.serialNumberCode && (
                                <button
                                  type="button"
                                  onClick={() => handleCopySerial(sn.serialNumberCode!)}
                                  className="p-1 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] text-white/70"
                                  title="Copier le numéro"
                                >
                                  {copiedSn === sn.serialNumberCode ? (
                                    <Check className="w-3 h-3 text-emerald-300" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                  <span className="hidden sm:inline">Copier</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Movement Audit & Quantity Calculation Ledger */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-[#2b2622] border border-[#3f3a36] text-[#10b981]">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Audit & Calcul de Quantité par Mouvement
                  </h3>
                  <p className="text-[11px] text-white/60">
                    Formule dynamique : Stock actuel = Stock Initial + Entrées (IN) - Sorties (OUT)
                  </p>
                </div>
              </div>

              {onOpenMovement && (
                <button
                  type="button"
                  onClick={() => onOpenMovement(equipment)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2b2622] hover:bg-[#383330] text-white text-xs font-medium rounded-lg border border-[#4d4742] shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Nouveau mouvement</span>
                </button>
              )}
            </div>

            {/* Dynamic Calculation 4-Tiles Cards */}
            {auditSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Initial Stock */}
                <div className="p-3.5 bg-[#2b2622] border border-[#3f3a36] rounded-xl text-left space-y-1">
                  <div className="flex items-center justify-between text-white/70">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider">Stock Initial</span>
                    <Package className="w-3.5 h-3.5 text-white/60" />
                  </div>
                  <div className="font-mono text-lg font-bold text-white">
                    {auditSummary.initialQuantity}
                  </div>
                  <div className="text-[10px] text-white/50">Origine / Base</div>
                </div>

                {/* Total IN */}
                <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-left space-y-1 text-emerald-200">
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider">Entrées (+ IN)</span>
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-300">
                    +{auditSummary.totalIn}
                  </div>
                  <div className="text-[10px] text-emerald-200/70">Total arrivages</div>
                </div>

                {/* Total OUT */}
                <div className="p-3.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-left space-y-1 text-amber-200">
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider">Sorties (- OUT)</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="font-mono text-lg font-bold text-amber-300">
                    -{auditSummary.totalOut}
                  </div>
                  <div className="text-[10px] text-amber-200/70">Consommé / Sorties</div>
                </div>

                {/* Current Total */}
                <div className="p-3.5 bg-[#2b2622] border border-emerald-500/50 rounded-xl text-left space-y-1 shadow-xs">
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="text-[10px] font-mono font-medium uppercase tracking-wider">Stock Actuel</span>
                    <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="font-mono text-lg font-bold text-emerald-300">
                    {auditSummary.currentQuantity}
                  </div>
                  <div className="text-[10px] text-emerald-400/80">En temps réel</div>
                </div>
              </div>
            )}

            {/* Chronological Movements Ledger */}
            {isLoadingMovements ? (
              <div className="p-8 bg-[#2b2622]/40 border border-[#3f3a36] rounded-xl text-center text-xs text-white/70 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#10b981]" />
                <span>Chargement de l&apos;historique des mouvements...</span>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-5 bg-[#2b2622]/40 border border-[#3f3a36] rounded-xl text-center text-xs text-white/70 space-y-2">
                <p className="italic">Aucun mouvement individuel enregistré pour cet article.</p>
                {onOpenMovement && (
                  <button
                    type="button"
                    onClick={() => onOpenMovement(equipment)}
                    className="text-[#10b981] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Créer le premier mouvement</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-[#3f3a36] rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-[#1f1b18] custom-scrollbar shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#26221f] text-white font-semibold border-b border-[#3f3a36] sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center text-[10px] font-mono text-white/70">#</th>
                      <th className="py-2.5 px-3 text-center text-[10px] font-mono uppercase tracking-wider text-white/70">Type</th>
                      <th className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-white/70">Source</th>
                      <th className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-white/70">Destination</th>
                      <th className="py-2.5 px-3 text-[10px] font-mono uppercase tracking-wider text-white/70">Numéro de série</th>
                      <th className="py-2.5 px-3 text-center text-[10px] font-mono uppercase tracking-wider text-white/70">Quantité</th>
                      <th className="py-2.5 px-3 text-right text-[10px] font-mono uppercase tracking-wider text-white/70">Solde cumulé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#332e2a]">
                    {auditSummary?.ledger.map((entry, idx) => {
                      const m = entry.movement;
                      const isEntry = entry.type === 'IN';
                      const isExit = entry.type === 'OUT';

                      return (
                        <tr key={m.mouvementId} className="hover:bg-white/5 transition-colors">
                          <td className="py-2 px-3 text-center font-mono text-white/50 text-[11px]">
                            #{String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                isEntry
                                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                                  : isExit
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                                  : 'bg-[#2b2622] text-white border border-[#3f3a36]'
                              }`}
                            >
                              {isEntry ? (
                                <>
                                  <ArrowDownRight className="w-2.5 h-2.5" />
                                  <span>+ IN</span>
                                </>
                              ) : isExit ? (
                                <>
                                  <ArrowUpRight className="w-2.5 h-2.5" />
                                  <span>- OUT</span>
                                </>
                              ) : (
                                <>
                                  <ArrowRightLeft className="w-2.5 h-2.5" />
                                  <span>TRANSFER</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-white/80">
                            {m.sourceShelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium text-white">
                                <Layers className="w-3 h-3 text-[#10b981]" />
                                <span>{m.sourceShelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-white/60 bg-[#2b2622] border border-[#3f3a36] px-1.5 py-0.5 rounded">
                                INITIAL (Entrée)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-white/80">
                            {m.destinationShelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium text-white">
                                <Layers className="w-3 h-3 text-[#10b981]" />
                                <span>{m.destinationShelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-amber-300 bg-amber-950/40 border border-amber-400/40 px-1.5 py-0.5 rounded">
                                SORTIE (Décharge)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-white/90">
                            {m.serialNumber?.serialNumberCode ? (
                              <span className="inline-flex items-center gap-1 text-white font-medium">
                                <Barcode className="w-3 h-3 text-purple-400" />
                                <span>{m.serialNumber.serialNumberCode}</span>
                              </span>
                            ) : (
                              <span className="text-white/40 italic">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            <span
                              className={
                                isEntry
                                  ? 'text-emerald-400'
                                  : isExit
                                  ? 'text-amber-400'
                                  : 'text-white'
                              }
                            >
                              {entry.delta > 0
                                ? `+${entry.delta}`
                                : entry.delta < 0
                                ? `${entry.delta}`
                                : `${m.mouvementQuantity ?? 1}`}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            {entry.runningBalance} u.
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* FIXED MODAL FOOTER */}
        <div className="shrink-0 px-5 py-3.5 bg-[#26221f] border-t border-[#3f3a36] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#383330] hover:bg-[#453f3a] text-white border border-[#4d4742] text-xs font-medium rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Copy className="w-3.5 h-3.5 text-white/80" />
            <span>Copier l'identifiant</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Fermer la fiche</span>
          </button>
        </div>
      </div>
    </div>
  );
}
