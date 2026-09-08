'use client';

import { useState } from 'react';
import { Equipment, SerialNumber } from '@/types/equipment';
import { getEquipmentVisualTheme } from './equipment-icons';
import {
  X,
  Copy,
  Check,
  Database,
  Hash,
  Layers,
  Calendar,
  ShieldCheck,
  Code,
  Sparkles,
  ExternalLink,
  MapPin,
  Barcode,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function EquipmentDetailModal({
  equipment,
  isOpen,
  onClose,
  onRefresh,
  isLoading = false,
}: EquipmentDetailModalProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

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
        className="w-full max-w-3xl bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="equipment-detail-title"
      >
        {/* Cover Banner (Notion Pastel Header) */}
        <div className={`h-24 w-full ${visualTheme.bg} border-b ${visualTheme.border} relative`}>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 text-[#37352f]/70 hover:text-[#1a1a1a] p-1.5 rounded-md hover:bg-white/50 transition-colors cursor-pointer"
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
                className={`w-20 h-20 rounded-2xl ${visualTheme.bg} border-2 border-white shadow-md flex items-center justify-center ${visualTheme.text}`}
              >
                <IconComp className="w-10 h-10" />
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-[#f0eeec] text-[#5d5b54]">
                    dbo.Equipment
                  </span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]">
                    SQL Server Actif
                  </span>
                </div>
                <h1
                  id="equipment-detail-title"
                  className="text-xl md:text-2xl font-bold tracking-tight text-[#1a1a1a]"
                >
                  {equipment.equipmentName ?? 'Équipement sans nom'}
                </h1>
              </div>
            </div>
          </div>

          {/* Properties Table (Notion Database Page Style) */}
          <div className="bg-[#fafaf9] border border-[#e5e3df] rounded-xl divide-y divide-[#ede9e4] text-xs">
            {/* Property: GUID */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-40 shrink-0">
                <Database className="w-3.5 h-3.5 text-[#5645d4]" />
                <span className="font-medium">Identifiant GUID</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#1a1a1a] min-w-0">
                <span className="truncate max-w-sm sm:max-w-md">{equipment.equipmentId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 text-[#787671] hover:text-[#1a1a1a] rounded hover:bg-[#ede9e4] transition-colors cursor-pointer"
                  title="Copier le GUID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Property: Quantity & Stock Level */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-40 shrink-0">
                <Hash className="w-3.5 h-3.5 text-[#dd5b00]" />
                <span className="font-medium">Quantité en stock</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    equipment.equipmentQuantity > 0
                      ? 'bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]'
                      : 'bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2]'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {equipment.equipmentQuantity} unités
                </span>
                {equipment.equipmentQuantity <= equipment.minequipmentQuantity && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2] text-[10px] font-bold">
                    <AlertTriangle className="w-3 h-3" />
                    Seuil d'alerte atteint ({equipment.minequipmentQuantity})
                  </span>
                )}
              </div>
            </div>

            {/* Property: Traçabilité / Mode */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-40 shrink-0">
                <Barcode className="w-3.5 h-3.5 text-[#7b3ff2]" />
                <span className="font-medium">Mode de traçabilité</span>
              </div>
              <div>
                {equipment.hasSerialNumber ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#e6e0f5] text-[#7b3ff2] font-semibold text-xs border border-[#d6b6f6]">
                    <Barcode className="w-3 h-3" />
                    Sérialisé ({serials.length} numéros de série)
                  </span>
                ) : (
                  <span className="text-[#5d5b54]">Stock quantitatif simple (non sérialisé)</span>
                )}
              </div>
            </div>

            {/* Property: Shelf Locations */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-40 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#0075de]" />
                <span className="font-medium">Emplacements / Étagères</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {equipment.equipmentShelfs && equipment.equipmentShelfs.length > 0 ? (
                  equipment.equipmentShelfs.map((es) => (
                    <span
                      key={es.equipmentShelfId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-[#e5e3df] text-xs font-medium text-[#1a1a1a]"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#5645d4]" />
                      <span>{es.shelf?.shelfName ?? 'Étagère'}</span>
                      <span className="font-mono text-[10px] font-bold text-[#5645d4]">
                        ({es.equipmentQuantity} u.)
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-[#787671] italic">Non assigné à une étagère</span>
                )}
              </div>
            </div>
          </div>

          {/* Child Serial Numbers Detailed Section */}
          {equipment.hasSerialNumber && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#5645d4]" />
                  <h3 className="text-sm font-semibold text-[#1a1a1a]">
                    Numéros de série enfants ({serials.length})
                  </h3>
                </div>
                <span className="text-[11px] text-[#787671]">
                  Chaque numéro est unique et stocké dans dbo.SerialNumber
                </span>
              </div>

              {serials.length === 0 ? (
                <div className="p-4 bg-[#fafaf9] border border-[#e5e3df] rounded-lg text-center text-xs text-[#787671] italic">
                  Aucun numéro de série enregistré pour cet équipement.
                </div>
              ) : (
                <div className="border border-[#e5e3df] rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#fafaf9] text-[#787671] font-semibold border-b border-[#e5e3df] sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-12 text-center">#</th>
                        <th className="py-2 px-3">CODE DE SÉRIE</th>
                        <th className="py-2 px-3 text-center">STATUT</th>
                        <th className="py-2 px-3">ÉTAGÈRE ASSIGNÉE</th>
                        <th className="py-2 px-3 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e3df]">
                      {serials.map((sn, sIdx) => (
                        <tr key={sn.serialNumberId} className="hover:bg-[#fafaf9]">
                          <td className="py-2 px-3 text-center font-mono text-[#a4a097]">
                            #{String(sIdx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold text-[#1a1a1a]">
                            {sn.serialNumberCode ?? 'S/N inconnu'}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                sn.serialNumberStatus === 'AVAILABLE'
                                  ? 'bg-[#d9f3e1] text-[#1aae39]'
                                  : 'bg-[#ffe8d4] text-[#dd5b00]'
                              }`}
                            >
                              {sn.serialNumberStatus ?? 'DISPO'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#5d5b54]">
                            {sn.shelf?.shelfName ? (
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Layers className="w-3 h-3 text-[#5645d4]" />
                                <span>{sn.shelf.shelfName}</span>
                              </span>
                            ) : (
                              <span className="text-[#a4a097] italic">Non assigné</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {sn.serialNumberCode && (
                              <button
                                type="button"
                                onClick={() => handleCopySerial(sn.serialNumberCode!)}
                                className="p-1 hover:text-[#1a1a1a] rounded transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] text-[#5645d4]"
                              >
                                {copiedSn === sn.serialNumberCode ? (
                                  <Check className="w-3 h-3 text-[#1aae39]" />
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

          {/* Raw JSON Tuple Toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-[#5645d4] hover:underline flex items-center gap-1 font-medium cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showRawJson ? 'Masquer le JSON brut' : 'Afficher le tuple SQL Server en JSON'}</span>
            </button>

            {showRawJson && (
              <div className="relative bg-[#1a1a1a] text-[#f6f5f4] rounded-lg p-3 font-mono text-[11px] overflow-x-auto shadow-inner">
                <pre>{JSON.stringify(equipment, null, 2)}</pre>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="absolute top-2 right-2 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  {copiedJson ? (
                    <Check className="w-3 h-3 text-[#1aae39]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>Copier JSON</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#ede9e4] flex items-center justify-between">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#5645d4]" />
              <span>Copier GUID</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4.5 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Fermer la fiche
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
