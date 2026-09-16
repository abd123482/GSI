'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Equipment, EquipmentWithShelvesResponse } from '@/types/equipment';
import { EquipmentService } from '@/services/equipment.service';
import { useApi } from '@/hooks/use-api';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Layers,
  X,
  Copy,
  Check,
  Package,
  AlertTriangle,
  Info,
  RefreshCw,
  Barcode,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';

interface ViewEquipmentShelvesModalProps {
  isOpen: boolean;
  equipment: Equipment | null;
  onClose: () => void;
}

export const ViewEquipmentShelvesModal: React.FC<ViewEquipmentShelvesModalProps> = ({
  isOpen,
  equipment,
  onClose,
}) => {
  const api = useApi();
  const { permissions } = usePermissions();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: remoteData, isLoading, refetch } = useQuery<EquipmentWithShelvesResponse>({
    queryKey: ['equipment-shelves', equipment?.equipmentId],
    queryFn: () =>
      EquipmentService.getEquipmentShelves(
        api,
        equipment!.equipmentId,
        permissions,
      ),
    enabled: isOpen && !!equipment?.equipmentId,
    staleTime: 10 * 1000,
  });

  const data = remoteData ?? (equipment as EquipmentWithShelvesResponse | null);

  if (!isOpen || !equipment) return null;

  const handleCopy = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`${label} copié dans le presse-papier !`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalStock = data?.equipmentQuantity ?? equipment.equipmentQuantity ?? 0;
  const isSerialized = data?.hasSerialNumber ?? equipment.hasSerialNumber;

  const tuples = data?.equipmentShelfs ?? equipment.equipmentShelfs ?? [];
  const serials = data?.serialNumbers ?? equipment.serialNumbers ?? [];

  // Calculate metrics
  const totalAllocated = isSerialized
    ? serials.filter((s) => s.shelfId !== null).length
    : tuples.reduce((sum, t) => sum + (t.equipmentQuantity || 0), 0);

  const unallocated = Math.max(0, totalStock - totalAllocated);
  const distinctShelvesCount = isSerialized
    ? new Set(serials.map((s) => s.shelfId).filter(Boolean)).size
    : tuples.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-[#383330] text-white rounded-xl shadow-2xl border border-[#3f3a36] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3f3a36] bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#2b2622] border border-white/20 flex items-center justify-center text-[#f7f5f0] shrink-0 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Étagères associées
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/30 border border-white/20 text-white/90">
                  {isSerialized ? 'Sérialisé' : 'Standard'}
                </span>
              </div>
              <p className="text-xs text-white/70 truncate max-w-md">
                {equipment.equipmentName ?? 'Équipement sans nom'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Actualiser les étagères"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Informational Callout */}
          <div className="p-3.5 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg text-xs text-white flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[#f7f5f0] shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-white mb-0.5">
                Architecture de stockage multi-étagères
              </p>
              Cet équipement peut être réparti sur plusieurs étagères. Chaque emplacement et quantité est stocké sous forme de tuple dans la table SQL <code className="font-mono bg-black/30 px-1 py-0.5 rounded text-[11px] text-emerald-300">EquipmentShelfs</code>. L&apos;ajout ou le transfert d&apos;unités est géré par les mouvements de stock.
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg">
              <span className="text-[11px] font-medium text-white/70 flex items-center gap-1 mb-1">
                <Package className="w-3.5 h-3.5 text-white" />
                Stock Total
              </span>
              <p className="text-lg font-bold text-white">
                {totalStock} <span className="text-xs font-normal text-white/70">unités</span>
              </p>
            </div>

            <div className="p-3 bg-[#2b2622]/70 border border-emerald-400/40 rounded-lg">
              <span className="text-[11px] font-medium text-emerald-300 flex items-center gap-1 mb-1">
                <Check className="w-3.5 h-3.5" />
                Alloué en Rayons
              </span>
              <p className="text-lg font-bold text-emerald-300">
                {totalAllocated} <span className="text-xs font-normal text-emerald-300/80">unités</span>
              </p>
            </div>

            <div className={`p-3 rounded-lg border ${
              unallocated > 0
                ? 'bg-amber-950/40 border-amber-400/40'
                : 'bg-[#2b2622]/60 border border-[#3f3a36]'
            }`}>
              <span className={`text-[11px] font-medium flex items-center gap-1 mb-1 ${
                unallocated > 0 ? 'text-amber-300' : 'text-white/70'
              }`}>
                <AlertTriangle className="w-3.5 h-3.5" />
                Non Alloué
              </span>
              <p className={`text-lg font-bold ${
                unallocated > 0 ? 'text-amber-300' : 'text-white'
              }`}>
                {unallocated} <span className="text-xs font-normal">unités</span>
              </p>
            </div>

            <div className="p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg">
              <span className="text-[11px] font-medium text-white/70 flex items-center gap-1 mb-1">
                <Layers className="w-3.5 h-3.5 text-white" />
                Étagères
              </span>
              <p className="text-lg font-bold text-white">
                {distinctShelvesCount} <span className="text-xs font-normal text-white/70">rayons</span>
              </p>
            </div>
          </div>

          {/* Shelves Breakdown Table / List */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Emplacements par Étagère
              </h3>
              <span className="text-[11px] text-white/70">
                {tuples.length} tuple{tuples.length > 1 ? 's' : ''} dans EquipmentShelfs
              </span>
            </div>

            {tuples.length > 0 ? (
              <div className="border border-[#3f3a36] rounded-lg overflow-hidden divide-y divide-[#8191ad]/50 bg-[#2b2622]/60">
                <div className="bg-[#2b2622] px-4 py-2 text-[11px] font-semibold text-white/90 grid grid-cols-12 gap-2">
                  <span className="col-span-5">Étagère</span>
                  <span className="col-span-3 text-center">Quantité Allouée</span>
                  <span className="col-span-4 text-right">Part du Stock</span>
                </div>

                {tuples.map((t) => {
                  const shelfName = t.shelf?.shelfName ?? 'Étagère inconnue';
                  const qty = t.equipmentQuantity || 0;
                  const percent = totalStock > 0 ? Math.round((qty / totalStock) * 100) : 0;
                  return (
                    <div
                      key={t.equipmentShelfId || t.shelfId}
                      className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-white/10 transition-colors"
                    >
                      <div className="col-span-5 min-w-0">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-[#f7f5f0] shrink-0" />
                          <span className="font-semibold text-xs text-white truncate">
                            {shelfName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-white/60 truncate max-w-[140px]">
                            {t.shelfId}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopy(e, t.shelfId, "ID d'étagère")}
                            className="text-white/60 hover:text-white transition-colors cursor-pointer"
                            title="Copier le GUID de l'étagère"
                          >
                            {copiedId === t.shelfId ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="col-span-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2b2622] text-emerald-300 border border-emerald-400/40 text-xs font-semibold">
                          <Hash className="w-3 h-3" />
                          {qty} {qty > 1 ? 'unités' : 'unité'}
                        </span>
                      </div>

                      <div className="col-span-4">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-black/30 h-2 rounded-full overflow-hidden shrink-0">
                            <div
                              className="bg-[#38bdf8] h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, percent)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-white/80 w-9 text-right font-mono">
                            {percent}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 border border-dashed border-[#3f3a36] rounded-lg bg-[#2b2622]/40 px-4">
                <Layers className="w-8 h-8 text-white/50 mx-auto mb-2" />
                <p className="text-xs font-semibold text-white mb-1">
                  Aucun tuple dans EquipmentShelfs
                </p>
                <p className="text-[11px] text-white/70 max-w-sm mx-auto">
                  Cet équipement n&apos;a pas encore d&apos;unités réparties dans des étagères. Enregistrez un mouvement d&apos;entrée ou de transfert pour assigner des étagères.
                </p>
              </div>
            )}
          </div>

          {/* Child Serial Numbers Breakdown (If Serialized) */}
          {isSerialized && (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Numéros de Série & Étagères Associées
                </h3>
                <span className="text-[11px] text-white/70">
                  {serials.length} numéro{serials.length > 1 ? 's' : ''} de série
                </span>
              </div>

              {serials.length > 0 ? (
                <div className="max-h-52 overflow-y-auto border border-[#3f3a36] rounded-lg divide-y divide-[#8191ad]/50 bg-[#2b2622]/60">
                  {serials.map((sn) => (
                    <div
                      key={sn.serialNumberId}
                      className="px-4 py-2 text-xs flex items-center justify-between hover:bg-white/10"
                    >
                      <div className="flex items-center gap-2">
                        <Barcode className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="font-mono font-medium text-white">
                          {sn.serialNumberCode ?? 'S/N sans code'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sn.shelf ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#2b2622] border border-white/20 text-[11px] font-medium text-white">
                            <Layers className="w-3 h-3 text-[#f7f5f0]" />
                            {sn.shelf.shelfName}
                          </span>
                        ) : (
                          <span className="text-[11px] text-white/60 italic">
                            Non assigné
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/70 italic">
                  Aucun numéro de série enregistré pour cet équipement.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#3f3a36] bg-[#2b2622]">
          <div className="text-[11px] text-white/70 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-white/80" />
            <span>Consultation en lecture seule</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
