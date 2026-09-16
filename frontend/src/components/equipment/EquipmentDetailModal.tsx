'use client';

import { useState, useMemo } from 'react';
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
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Movements query with TanStack Query (caching, auto state management, eliminates render loops)
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

  if (!isOpen || !equipment) return null;

  const visualTheme = getEquipmentVisualTheme(equipment.equipmentName);
  const IconComp = visualTheme.icon;
  const serials = equipment.serialNumbers ?? [];

  const handleCopyId = () => {
    navigator.clipboard.writeText(equipment.equipmentId);
    setCopiedId(true);
    toast.success('Identifiant GUID copié !');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(equipment, null, 2));
    setCopiedJson(true);
    toast.success('Données JSON copiées !');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopySerial = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSn(code);
    toast.success(`Numéro de série ${code} copié !`);
    setTimeout(() => setCopiedSn(null), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-3xl bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-detail-title"
      >
        {/* Cover Banner */}
        <div className="h-24 w-full bg-[#2b2622] border-b border-[#3f3a36] relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-white/80 hover:text-white p-1.5 rounded-md hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6 -mt-10 relative">
          {/* Top Profile Tile */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div
                className="w-20 h-20 rounded-2xl bg-[#2b2622] border-2 border-white shadow-md flex items-center justify-center text-[#f7f5f0]"
              >
                <IconComp className="w-10 h-10" />
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#2b2622] text-white border border-[#3f3a36]">
                    dbo.Equipment
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-200 border border-emerald-400/40">
                    SQL Server Actif
                  </span>
                </div>
                <h1
                  id="equipment-detail-title"
                  className="text-xl md:text-2xl font-bold tracking-tight text-white"
                >
                  {equipment.equipmentName ?? 'Équipement sans nom'}
                </h1>
              </div>
            </div>
          </div>

          {/* Properties Table (#6b7b97 Theme) */}
          <div className="bg-[#2b2622]/60 border border-[#3f3a36] rounded-xl divide-y divide-[#455268] text-xs text-white">
            {/* Property: GUID */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-40 shrink-0">
                <Database className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Identifiant GUID</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-white min-w-0">
                <span className="truncate max-w-sm sm:max-w-md">{equipment.equipmentId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 text-white/80 hover:text-white rounded hover:bg-white/20 transition-colors cursor-pointer"
                  title="Copier le GUID"
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
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-40 shrink-0">
                <Hash className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Quantité en stock</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    equipment.equipmentQuantity > 0
                      ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-400/40'
                      : 'bg-amber-950/40 text-amber-200 border border-amber-400/40'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {equipment.equipmentQuantity} unités
                </span>
                {equipment.equipmentQuantity <= equipment.minequipmentQuantity && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/50 text-amber-200 border border-amber-400/50 text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    Seuil d&apos;alerte atteint ({equipment.minequipmentQuantity})
                  </span>
                )}
              </div>
            </div>

            {/* Property: Traçabilité / Mode */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-40 shrink-0">
                <Barcode className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Mode de traçabilité</span>
              </div>
              <div>
                {equipment.hasSerialNumber ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#2b2622] text-white font-semibold text-xs border border-[#3f3a36]">
                    <Barcode className="w-3 h-3" />
                    Sérialisé ({serials.length} numéros de série)
                  </span>
                ) : (
                  <span className="text-white/80">Stock quantitatif simple (non sérialisé)</span>
                )}
              </div>
            </div>

            {/* Property: Shelf Locations */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-40 shrink-0">
                <Layers className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Emplacements / Étagères</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {equipment.equipmentShelfs && equipment.equipmentShelfs.length > 0 ? (
                  equipment.equipmentShelfs.map((es) => (
                    <span
                      key={es.equipmentShelfId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#2b2622] border border-[#3f3a36] text-xs font-medium text-white"
                    >
                      <Layers className="w-3.5 h-3.5 text-white" />
                      <span>{es.shelf?.shelfName ?? 'Étagère'}</span>
                      <span className="font-mono text-[10px] font-bold text-white/90">
                        ({es.equipmentQuantity} u.)
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-white/70 italic">Non assigné à une étagère</span>
                )}
              </div>
            </div>
          </div>

          {/* Child Serial Numbers Detailed Section */}
          {equipment.hasSerialNumber && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-semibold text-white">
                    Numéros de série enfants ({serials.length})
                  </h3>
                </div>
                <span className="text-[11px] text-white/70">
                  Chaque numéro est unique et stocké dans dbo.SerialNumber
                </span>
              </div>

              {serials.length === 0 ? (
                <div className="p-4 bg-[#2b2622]/30 border border-[#3f3a36] rounded-lg text-center text-xs text-white/80 italic">
                  Aucun numéro de série enregistré pour cet équipement.
                </div>
              ) : (
                <div className="border border-[#3f3a36] rounded-lg overflow-hidden max-h-60 overflow-y-auto bg-[#2b2622]/60">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#2b2622] text-white font-semibold border-b border-[#3f3a36] sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3">CODE DE SÉRIE</th>
                        <th className="py-2 px-3 text-center">STATUT</th>
                        <th className="py-2 px-3">ÉTAGÈRE ASSIGNÉE</th>
                        <th className="py-2 px-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#455268]">
                      {serials.map((sn, sIdx) => (
                        <tr key={sn.serialNumberId} className="hover:bg-white/10 transition-colors">
                          <td className="py-2 px-3 text-center font-mono text-white/70">
                            #{String(sIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-white">
                            {sn.serialNumberCode ?? 'S/N inconnu'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                sn.serialNumberStatus === 'AVAILABLE'
                                  ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-400/40'
                                  : 'bg-amber-950/40 text-amber-200 border border-amber-400/40'
                              }`}
                            >
                              {sn.serialNumberStatus ?? 'DISPO'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-white/90">
                            {sn.shelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium text-white">
                                <Layers className="w-3 h-3 text-white" />
                                <span>{sn.shelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="text-white/60 italic">Non assigné</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {sn.serialNumberCode && (
                              <button
                                type="button"
                                onClick={() => handleCopySerial(sn.serialNumberCode!)}
                                className="p-1 hover:text-white rounded transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] text-white/90"
                              >
                                {copiedSn === sn.serialNumberCode ? (
                                  <Check className="w-3 h-3 text-emerald-300" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>Copier</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Movement Audit & Quantity Calculation Ledger */}
          <div className="space-y-3.5 pt-2 border-t border-[#3f3a36]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-white" />
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Audit & Calcul de Quantité par Mouvement
                  </h3>
                  <p className="text-[11px] text-white/70">
                    Formule dynamique : Stock actuel = Stock Initial + Entrées (IN) - Sorties (OUT)
                  </p>
                </div>
              </div>

              {onOpenMovement && (
                <button
                  type="button"
                  onClick={() => onOpenMovement(equipment)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2b2622] hover:bg-[#3f3a36] text-white text-xs font-medium rounded-lg border border-[#4d4742] shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nouveau mouvement</span>
                </button>
              )}
            </div>

            {/* Dynamic Calculation 4-Tiles Cards */}
            {auditSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Initial Stock */}
                <div className="p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-xl text-left space-y-1 text-white">
                  <div className="flex items-center justify-between text-white/80">
                    <span className="text-[10px] font-medium uppercase tracking-wider">Stock Initial</span>
                    <Package className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="font-mono text-base font-bold text-white">
                    {auditSummary.initialQuantity}
                  </div>
                  <div className="text-[10px] text-white/70">Origine / Base</div>
                </div>

                {/* Total IN */}
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-left space-y-1 text-emerald-200">
                  <div className="flex items-center justify-between text-emerald-300">
                    <span className="text-[10px] font-medium uppercase tracking-wider">Entrées (+ IN)</span>
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-mono text-base font-bold text-emerald-300">
                    +{auditSummary.totalIn}
                  </div>
                  <div className="text-[10px] text-emerald-200/80">Total arrivages</div>
                </div>

                {/* Total OUT */}
                <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl text-left space-y-1 text-amber-200">
                  <div className="flex items-center justify-between text-amber-300">
                    <span className="text-[10px] font-medium uppercase tracking-wider">Sorties (- OUT)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-mono text-base font-bold text-amber-300">
                    -{auditSummary.totalOut}
                  </div>
                  <div className="text-[10px] text-amber-200/80">Consommé / Sorties</div>
                </div>

                {/* Current Total */}
                <div className="p-3 bg-[#2b2622] border border-[#3f3a36] rounded-xl text-left space-y-1 text-white">
                  <div className="flex items-center justify-between text-white/80">
                    <span className="text-[10px] font-medium uppercase tracking-wider">Stock Actuel</span>
                    <Hash className="w-3.5 h-3.5" />
                  </div>
                  <div className="font-mono text-base font-bold text-white">
                    {auditSummary.currentQuantity}
                  </div>
                  <div className="text-[10px] text-white/70">En temps réel</div>
                </div>
              </div>
            )}

            {/* Chronological Movements Ledger */}
            {isLoadingMovements ? (
              <div className="p-6 bg-[#2b2622]/30 border border-[#3f3a36] rounded-lg text-center text-xs text-white/80 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Chargement de l&apos;historique des mouvements...</span>
              </div>
            ) : movements.length === 0 ? (
              <div className="p-4 bg-[#2b2622]/30 border border-[#3f3a36] rounded-lg text-center text-xs text-white/80 space-y-1">
                <p className="italic">Aucun mouvement individuel enregistré pour cet équipement.</p>
                {onOpenMovement && (
                  <button
                    type="button"
                    onClick={() => onOpenMovement(equipment)}
                    className="text-white hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Créer le premier mouvement</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="border border-[#3f3a36] rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-[#2b2622]/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#2b2622] text-white font-semibold border-b border-[#3f3a36] sticky top-0">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">#</th>
                      <th className="py-2 px-3 text-center">STATUT</th>
                      <th className="py-2 px-3">SOURCE</th>
                      <th className="py-2 px-3">DESTINATION</th>
                      <th className="py-2 px-3">NUMÉRO DE SÉRIE</th>
                      <th className="py-2 px-3 text-center">QUANTITÉ</th>
                      <th className="py-2 px-3 text-right">SOLDE CUMULÉ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#455268]">
                    {auditSummary?.ledger.map((entry, idx) => {
                      const m = entry.movement;
                      const isEntry = entry.type === 'IN';
                      const isExit = entry.type === 'OUT';

                      return (
                        <tr key={m.mouvementId} className="hover:bg-white/10 transition-colors">
                          <td className="py-2 px-3 text-center font-mono text-white/70">
                            #{String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                isEntry
                                  ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-400/40'
                                  : isExit
                                  ? 'bg-amber-950/40 text-amber-200 border border-amber-400/40'
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
                          <td className="py-2 px-3 text-white/90">
                            {m.sourceShelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium text-white">
                                <Layers className="w-3 h-3 text-white" />
                                <span>{m.sourceShelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-white/80 bg-[#2b2622] border border-[#3f3a36] px-1.5 py-0.5 rounded">
                                NULL (Création)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-white/90">
                            {m.destinationShelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium text-white">
                                <Layers className="w-3 h-3 text-white" />
                                <span>{m.destinationShelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="font-mono text-[10px] text-amber-200 bg-amber-950/40 border border-amber-400/40 px-1.5 py-0.5 rounded">
                                NULL (Décharge)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-white/90">
                            {m.serialNumber?.serialNumberCode ? (
                              <span className="inline-flex items-center gap-1 text-white font-semibold">
                                <Barcode className="w-3 h-3" />
                                <span>{m.serialNumber.serialNumberCode}</span>
                              </span>
                            ) : (
                              <span className="text-white/50 italic">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            <span
                              className={
                                isEntry
                                  ? 'text-emerald-300'
                                  : isExit
                                  ? 'text-amber-300'
                                  : 'text-white'
                              }
                            >
                              {entry.delta > 0 ? `+${entry.delta}` : entry.delta < 0 ? `${entry.delta}` : `${m.mouvementQuantity ?? 1}`}
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

          {/* Raw JSON Tuple Toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-white hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showRawJson ? 'Masquer le JSON brut' : 'Afficher le tuple SQL Server en JSON'}</span>
            </button>

            {showRawJson && (
              <div className="relative bg-[#2b2622] border border-[#3f3a36] text-[#f6f5f4] rounded-lg p-3 font-mono text-[11px] overflow-x-auto shadow-inner">
                <pre>{JSON.stringify(equipment, null, 2)}</pre>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedJson ? (
                    <Check className="w-3 h-3 text-emerald-300" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copier JSON</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#3f3a36] flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-white" />
              <span>Copier GUID</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2 bg-[#2b2622] hover:bg-[#3f3a36] text-white border border-[#4d4742] text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Fermer la fiche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
