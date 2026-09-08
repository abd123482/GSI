'use client';

import React, { useState } from 'react';
import { Equipment, SerialNumber } from '@/types/equipment';
import { getEquipmentVisualTheme } from './equipment-icons';
import {
  Search,
  RefreshCw,
  Copy,
  Check,
  Database,
  Hash,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  Table as TableIcon,
  Sparkles,
  Layers,
  Eye,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Barcode,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Cpu,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentListTableProps {
  equipments: Equipment[];
  totalEquipments: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onSelectEquipment: (equipment: Equipment) => void;
  onEditEquipment?: (equipment: Equipment) => void;
  onDeleteEquipment?: (equipment: Equipment) => void;
  onEditSerialNumber?: (serialNumber: SerialNumber, equipment: Equipment) => void;
  onDeleteSerialNumber?: (serialNumber: SerialNumber, equipment: Equipment) => void;
  onLookupById?: (id: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  onOpenCreateModal: () => void;
  canCreateMovement: boolean;
  canUpdateEquipment?: boolean;
  canDeleteEquipment?: boolean;
  canUpdateSerialNumber?: boolean;
  canDeleteSerialNumber?: boolean;
}

export function EquipmentListTable({
  equipments,
  totalEquipments,
  totalPages,
  currentPage,
  limit,
  searchTerm,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onSelectEquipment,
  onEditEquipment,
  onDeleteEquipment,
  onEditSerialNumber,
  onDeleteSerialNumber,
  onLookupById,
  isLoading,
  onRefresh,
  onOpenCreateModal,
  canCreateMovement,
  canUpdateEquipment = true,
  canDeleteEquipment = true,
  canUpdateSerialNumber = true,
  canDeleteSerialNumber = true,
}: EquipmentListTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedSn, setCopiedSn] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [idLookupInput, setIdLookupInput] = useState('');
  const [expandedEquipmentIds, setExpandedEquipmentIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (equipmentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedEquipmentIds((prev) => ({
      ...prev,
      [equipmentId]: !prev[equipmentId],
    }));
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    toast.success('GUID copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopySerial = (e: React.MouseEvent, snCode: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snCode);
    setCopiedSn(snCode);
    toast.success(`Numéro de série ${snCode} copié !`);
    setTimeout(() => setCopiedSn(null), 2000);
  };

  const handleLookupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idLookupInput.trim()) return;
    if (onLookupById) {
      onLookupById(idLookupInput.trim());
    }
  };

  // Calculate indexing ranges
  const startItem = totalEquipments === 0 ? 0 : (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, totalEquipments);

  // Pagination buttons logic
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return Array.from(new Set(pages));
  };

  return (
    <div className="w-full bg-white border border-[#e5e3df] rounded-xl shadow-xs overflow-hidden text-left space-y-0">
      {/* Table Toolbar & Search by Name */}
      <div className="p-4 border-b border-[#e5e3df] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-[#fafaf9]">
        {/* Search by Name input */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#787671]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom d'équipement (GET /equipment/search)..."
              className="w-full h-9 pl-9 pr-8 bg-white text-xs border border-[#c8c4be] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#787671] hover:text-[#1a1a1a] cursor-pointer"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Quick UUID Lookup Input */}
        <form
          onSubmit={handleLookupSubmit}
          className="flex items-center gap-1.5 w-full sm:w-auto max-w-sm"
        >
          <div className="relative flex-1">
            <Database className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#787671]" />
            <input
              type="text"
              value={idLookupInput}
              onChange={(e) => setIdLookupInput(e.target.value)}
              placeholder="Inspecter par UUID..."
              className="w-full h-9 pl-8 pr-2 bg-white text-xs font-mono border border-[#e5e3df] rounded-lg outline-none focus:border-[#5645d4] focus:ring-1 focus:ring-[#5645d4]"
            />
          </div>
          <button
            type="submit"
            disabled={!idLookupInput.trim() || isLoading}
            className="h-9 px-3 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
            title="Consulter l'équipement par UUID"
          >
            <span>Ouvrir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        {/* View Mode & Page Limit & Refresh Controls */}
        <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto justify-between lg:justify-end">
          {/* View Mode Toggle: Notion Segmented Tab */}
          <div className="inline-flex items-center bg-[#f0eeec] p-0.5 rounded-lg border border-[#e5e3df]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-[#1a1a1a] shadow-xs'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
              title="Vue Liste / Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-[#1a1a1a] shadow-xs'
                  : 'text-[#787671] hover:text-[#1a1a1a]'
              }`}
              title="Vue Galerie / Cartes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Galerie</span>
            </button>
          </div>

          {/* Page size limit selector */}
          <div className="flex items-center gap-1.5 text-xs text-[#5d5b54]">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-white border border-[#c8c4be] rounded-md text-xs font-medium text-[#1a1a1a] outline-none focus:border-[#5645d4]"
            >
              <option value={5}>5 par page</option>
              <option value={10}>10 par page</option>
              <option value={20}>20 par page</option>
              <option value={50}>50 par page</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 bg-white hover:bg-[#ede9e4] border border-[#c8c4be] rounded-md text-xs font-medium text-[#1a1a1a] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Rafraîchir les données SQL Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#5645d4]' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        /* TABLE VIEW WITH EXPANDABLE CHILD SERIAL NUMBERS */
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e5e3df] bg-[#fafaf9] text-[#787671] font-semibold">
                <th className="py-2.5 px-3 w-10 text-center"></th>
                <th className="py-2.5 px-3 w-16 text-center">INDEX</th>
                <th className="py-2.5 px-4">ÉQUIPEMENT</th>
                <th className="py-2.5 px-4 text-center">QUANTITÉ</th>
                <th className="py-2.5 px-4 text-center">TRAÇABILITÉ S/N</th>
                <th className="py-2.5 px-4">EMPLACEMENT(S)</th>
                <th className="py-2.5 px-4">GUID SQL SERVER</th>
                <th className="py-2.5 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e3df]">
              {isLoading && equipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#787671]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#5645d4]" />
                      <span>Chargement des équipements depuis SQL Server...</span>
                    </div>
                  </td>
                </tr>
              ) : equipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#787671]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Archive className="w-7 h-7 text-[#a4a097]" />
                      <p className="font-medium text-[#1a1a1a]">Aucun équipement trouvé</p>
                      <p className="text-xs max-w-sm">
                        {searchTerm
                          ? `Aucun résultat pour la recherche "${searchTerm}".`
                          : 'Aucun équipement n’est enregistré dans la table dbo.Equipment.'}
                      </p>
                      {canCreateMovement && (
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="mt-2 px-3.5 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        >
                          Créer une première entrée
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                equipments.map((equipment, idx) => {
                  const globalIndex = (currentPage - 1) * limit + idx + 1;
                  const formattedIndex = String(globalIndex).padStart(2, '0');
                  const visualTheme = getEquipmentVisualTheme(equipment.equipmentName, idx);
                  const IconComp = visualTheme.icon;
                  const isExpanded = !!expandedEquipmentIds[equipment.equipmentId];
                  const serials = equipment.serialNumbers ?? [];

                  return (
                    <React.Fragment key={equipment.equipmentId}>
                      <tr
                        onClick={() => onSelectEquipment(equipment)}
                        className="hover:bg-[#fafaf9] transition-colors group cursor-pointer"
                      >
                        {/* 0. Expand Chevron for Child Serial Numbers */}
                        <td className="py-3 px-3 text-center" onClick={(e) => toggleExpand(equipment.equipmentId, e)}>
                          {equipment.hasSerialNumber && serials.length > 0 ? (
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-[#ede9e4] text-[#787671] hover:text-[#1a1a1a] transition-colors cursor-pointer"
                              title={isExpanded ? 'Replier les numéros de série' : 'Déplier les numéros de série'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-[#5645d4]" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4 h-4 inline-block text-[#a4a097]">•</span>
                          )}
                        </td>

                        {/* 1. Global Index */}
                        <td className="py-3 px-3 text-center font-mono text-xs font-semibold text-[#787671]">
                          <span className="inline-block px-2 py-0.5 rounded bg-[#f0eeec] border border-[#e5e3df]">
                            #{formattedIndex}
                          </span>
                        </td>

                        {/* 2. Beautiful Icon + Equipment Name */}
                        <td className="py-3 px-4 font-medium text-[#1a1a1a]">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                              title={visualTheme.label}
                            >
                              <IconComp className="w-4.5 h-4.5" />
                            </div>

                            <div className="min-w-0">
                              <p className="font-semibold text-sm text-[#1a1a1a] truncate max-w-xs group-hover:text-[#5645d4] transition-colors">
                                {equipment.equipmentName ?? 'Équipement sans nom'}
                              </p>
                              <div className="text-[11px] text-[#787671] flex items-center gap-1.5 flex-wrap">
                                <span>Min alert : {equipment.minequipmentQuantity}</span>
                                {equipment.equipmentQuantity <= equipment.minequipmentQuantity && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2] text-[10px] font-semibold">
                                    <AlertTriangle className="w-3 h-3" />
                                    Stock bas
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 3. Quantity Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                              equipment.equipmentQuantity > 0
                                ? 'bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]'
                                : 'bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2]'
                            }`}
                          >
                            <Hash className="w-3 h-3" />
                            {equipment.equipmentQuantity} {equipment.equipmentQuantity > 1 ? 'unités' : 'unité'}
                          </span>
                        </td>

                        {/* 4. Serial Numbers Child Count Badge */}
                        <td className="py-3 px-4 text-center">
                          {equipment.hasSerialNumber ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(equipment.equipmentId, e)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#e6e0f5] hover:bg-[#d6b6f6] border border-[#d6b6f6] text-xs font-semibold text-[#7b3ff2] transition-colors cursor-pointer"
                              title="Cliquer pour afficher les numéros de série"
                            >
                              <Barcode className="w-3.5 h-3.5" />
                              <span>{serials.length} S/N</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#787671] italic">Non sérialisé</span>
                          )}
                        </td>

                        {/* 5. Shelf Locations */}
                        <td className="py-3 px-4">
                          {equipment.equipmentShelfs && equipment.equipmentShelfs.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {equipment.equipmentShelfs.map((es) => (
                                <span
                                  key={es.equipmentShelfId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#f0eeec] border border-[#e5e3df] text-[11px] font-medium text-[#37352f]"
                                >
                                  <Layers className="w-3 h-3 text-[#5645d4]" />
                                  <span>{es.shelf?.shelfName ?? 'Étagère'}</span>
                                  <span className="font-mono text-[10px] text-[#787671]">
                                    ({es.equipmentQuantity})
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#787671] italic">
                              <MapPin className="w-3 h-3 text-[#a4a097]" />
                              <span>Non assigné</span>
                            </span>
                          )}
                        </td>

                        {/* 6. GUID SQL Server */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px] text-[#5d5b54]">
                            <span className="truncate max-w-[150px]">{equipment.equipmentId}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(e, equipment.equipmentId)}
                              className="p-1 text-[#a4a097] hover:text-[#1a1a1a] rounded hover:bg-[#ede9e4] transition-colors cursor-pointer"
                              title="Copier le GUID"
                            >
                              {copiedId === equipment.equipmentId ? (
                                <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 7. Action CTA */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onSelectEquipment(equipment)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#ede9e4] border border-[#e5e3df] text-xs font-medium text-[#37352f] transition-colors cursor-pointer"
                              title="Consulter la fiche"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#5645d4]" />
                              <span>Fiche</span>
                            </button>

                            {onEditEquipment && canUpdateEquipment && (
                              <button
                                type="button"
                                onClick={() => onEditEquipment(equipment)}
                                className="p-1 rounded-md bg-white hover:bg-[#ede9e4] border border-[#e5e3df] text-[#5d5b54] hover:text-[#5645d4] transition-colors cursor-pointer"
                                title="Modifier l’équipement"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteEquipment && canDeleteEquipment && (
                              <button
                                type="button"
                                onClick={() => onDeleteEquipment(equipment)}
                                className="p-1 rounded-md bg-white hover:bg-[#ffe8d4] border border-[#e5e3df] text-[#5d5b54] hover:text-[#e03131] transition-colors cursor-pointer"
                                title="Supprimer l’équipement"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* EXPANDABLE SUB-ROW FOR CHILD SERIAL NUMBERS */}
                      {equipment.hasSerialNumber && isExpanded && (
                        <tr className="bg-[#fafaf9]/80 border-b border-[#e5e3df]">
                          <td colSpan={8} className="py-3 px-8">
                            <div className="p-3 bg-white border border-[#e5e3df] rounded-lg space-y-2.5 shadow-2xs">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Barcode className="w-4 h-4 text-[#5645d4]" />
                                  <span className="text-xs font-semibold text-[#1a1a1a]">
                                    Numéros de série enfants ({serials.length})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {onEditEquipment && canUpdateEquipment && (
                                    <button
                                      type="button"
                                      onClick={() => onEditEquipment(equipment)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium text-[#793400] bg-[#ffe8d4] hover:bg-[#fed2b2] transition-colors cursor-pointer"
                                      title="Supprimer tous les numéros et convertir en comptage standard"
                                    >
                                      <Sparkles className="w-3 h-3 text-[#dd5b00]" />
                                      <span>Convertir en équipement standard</span>
                                    </button>
                                  )}
                                  <span className="text-[11px] text-[#787671] hidden md:inline">
                                    Unités physiques uniques dans SQL Server (dbo.SerialNumber)
                                  </span>
                                </div>
                              </div>

                              {serials.length === 0 ? (
                                <p className="text-xs text-[#787671] italic py-1">
                                  Aucun numéro de série rattaché à cet équipement.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                                  {serials.map((sn, sIdx) => (
                                    <div
                                      key={sn.serialNumberId}
                                      className="flex items-center justify-between gap-1.5 p-2 bg-[#f6f5f4] border border-[#e5e3df] rounded-md font-mono text-[11px]"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[#a4a097] text-[10px]">
                                          #{String(sIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span className="font-semibold text-[#1a1a1a] truncate">
                                          {sn.serialNumberCode ?? 'S/N inconnu'}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-0.5 shrink-0">
                                        <span
                                          className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${
                                            sn.serialNumberStatus === 'AVAILABLE'
                                              ? 'bg-[#d9f3e1] text-[#1aae39]'
                                              : 'bg-[#ffe8d4] text-[#dd5b00]'
                                          }`}
                                        >
                                          {sn.serialNumberStatus ?? 'DISPO'}
                                        </span>
                                        {sn.serialNumberCode && (
                                          <button
                                            type="button"
                                            onClick={(e) => handleCopySerial(e, sn.serialNumberCode!)}
                                            className="p-1 hover:text-[#1a1a1a] rounded transition-colors cursor-pointer"
                                            title="Copier le numéro de série"
                                          >
                                            {copiedSn === sn.serialNumberCode ? (
                                              <Check className="w-3 h-3 text-[#1aae39]" />
                                            ) : (
                                              <Copy className="w-3 h-3 text-[#787671]" />
                                            )}
                                          </button>
                                        )}
                                        {onEditSerialNumber && canUpdateSerialNumber && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEditSerialNumber(sn, equipment);
                                            }}
                                            className="p-1 hover:text-[#5645d4] rounded transition-colors cursor-pointer"
                                            title="Modifier le code ou le statut"
                                          >
                                            <Pencil className="w-3 h-3 text-[#787671] hover:text-[#5645d4]" />
                                          </button>
                                        )}
                                        {onDeleteSerialNumber && canDeleteSerialNumber && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteSerialNumber(sn, equipment);
                                            }}
                                            className="p-1 hover:text-[#e03131] rounded transition-colors cursor-pointer"
                                            title="Supprimer ce numéro de série"
                                          >
                                            <Trash2 className="w-3 h-3 text-[#787671] hover:text-[#e03131]" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* GALLERY / GRID VIEW */
        <div className="p-5 bg-[#fafaf9]">
          {isLoading && equipments.length === 0 ? (
            <div className="py-14 text-center text-[#787671] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#5645d4]" />
              <p className="text-sm font-medium">Chargement des cartes équipements...</p>
            </div>
          ) : equipments.length === 0 ? (
            <div className="py-14 text-center text-[#787671] flex flex-col items-center justify-center gap-2">
              <Archive className="w-8 h-8 text-[#a4a097]" />
              <p className="text-sm font-medium text-[#1a1a1a]">Aucun équipement disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {equipments.map((equipment, idx) => {
                const globalIndex = (currentPage - 1) * limit + idx + 1;
                const formattedIndex = String(globalIndex).padStart(2, '0');
                const visualTheme = getEquipmentVisualTheme(equipment.equipmentName, idx);
                const IconComp = visualTheme.icon;
                const serials = equipment.serialNumbers ?? [];
                const isExpanded = !!expandedEquipmentIds[equipment.equipmentId];

                return (
                  <div
                    key={equipment.equipmentId}
                    onClick={() => onSelectEquipment(equipment)}
                    className="bg-white border border-[#e5e3df] hover:border-[#5645d4] rounded-xl p-5 shadow-xs hover:shadow-md transition-all text-left space-y-4 relative group cursor-pointer"
                  >
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-11 h-11 rounded-xl ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shadow-2xs group-hover:scale-105 transition-transform`}
                        >
                          <IconComp className="w-5 h-5" />
                        </div>

                        <div>
                          <span className="font-mono text-[10px] font-semibold text-[#5645d4] bg-[#f0eeec] px-1.5 py-0.5 rounded">
                            #{formattedIndex}
                          </span>
                          <h3 className="font-semibold text-sm text-[#1a1a1a] truncate max-w-[180px] group-hover:text-[#5645d4] transition-colors">
                            {equipment.equipmentName ?? 'Équipement sans nom'}
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          equipment.equipmentQuantity > 0
                            ? 'bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]'
                            : 'bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2]'
                        }`}
                      >
                        <Hash className="w-3 h-3" />
                        {equipment.equipmentQuantity} unités
                      </span>
                    </div>

                    {/* Child Serial Numbers Badge with Toggle Drawer */}
                    {equipment.hasSerialNumber && (
                      <div className="p-2.5 bg-[#fafaf9] border border-[#ede9e4] rounded-lg space-y-2">
                        <div
                          className="flex items-center justify-between text-xs font-semibold text-[#7b3ff2] cursor-pointer"
                          onClick={(e) => toggleExpand(equipment.equipmentId, e)}
                        >
                          <div className="flex items-center gap-1.5">
                            <Barcode className="w-3.5 h-3.5" />
                            <span>{serials.length} numéros de série enregistrés</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 pt-1 border-t border-[#ede9e4]">
                            {serials.map((sn, sIdx) => (
                              <div
                                key={sn.serialNumberId}
                                className="flex items-center justify-between text-[11px] font-mono text-[#5d5b54] p-1.5 bg-white rounded border border-[#e5e3df]"
                              >
                                <span className="truncate">{sn.serialNumberCode}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] px-1 rounded bg-[#d9f3e1] text-[#1aae39] font-bold">
                                    {sn.serialNumberStatus ?? 'DISPO'}
                                  </span>
                                  {onEditSerialNumber && canUpdateSerialNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditSerialNumber(sn, equipment);
                                      }}
                                      className="p-0.5 hover:text-[#5645d4] transition-colors"
                                      title="Modifier ce numéro"
                                    >
                                      <Pencil className="w-3 h-3 text-[#787671] hover:text-[#5645d4]" />
                                    </button>
                                  )}
                                  {onDeleteSerialNumber && canDeleteSerialNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSerialNumber(sn, equipment);
                                      }}
                                      className="p-0.5 hover:text-[#e03131] transition-colors"
                                      title="Supprimer ce numéro"
                                    >
                                      <Trash2 className="w-3 h-3 text-[#787671] hover:text-[#e03131]" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="bg-[#fafaf9] border border-[#ede9e4] rounded-lg p-2 flex items-center justify-between text-[11px] font-mono text-[#5d5b54]">
                      <span className="truncate max-w-[140px]">{equipment.equipmentId}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(e, equipment.equipmentId)}
                          className="p-1 hover:text-[#1a1a1a] hover:bg-white rounded transition-colors cursor-pointer"
                          title="Copier le GUID"
                        >
                          {copiedId === equipment.equipmentId ? (
                            <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectEquipment(equipment)}
                          className="p-1 hover:text-[#5645d4] hover:bg-white rounded transition-colors cursor-pointer"
                          title="Consulter la fiche"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#5645d4]" />
                        </button>
                        {onEditEquipment && canUpdateEquipment && (
                          <button
                            type="button"
                            onClick={() => onEditEquipment(equipment)}
                            className="p-1 hover:text-[#5645d4] hover:bg-white rounded transition-colors cursor-pointer"
                            title="Modifier l’équipement"
                          >
                            <Pencil className="w-3.5 h-3.5 text-[#787671] hover:text-[#5645d4]" />
                          </button>
                        )}
                        {onDeleteEquipment && canDeleteEquipment && (
                          <button
                            type="button"
                            onClick={() => onDeleteEquipment(equipment)}
                            className="p-1 hover:text-[#e03131] hover:bg-white rounded transition-colors cursor-pointer"
                            title="Supprimer l’équipement"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-[#787671] hover:text-[#e03131]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      <div className="p-4 border-t border-[#e5e3df] bg-[#fafaf9] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5d5b54]">
        <div>
          <span>
            Affichage de <strong className="text-[#1a1a1a] font-semibold">{startItem}</strong> à{' '}
            <strong className="text-[#1a1a1a] font-semibold">{endItem}</strong> sur{' '}
            <strong className="text-[#1a1a1a] font-semibold">{totalEquipments}</strong> équipements
          </span>
        </div>

        {/* Pagination Navigation Controls */}
        <div className="flex items-center gap-1.5">
          {/* First Page */}
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white hover:bg-[#ede9e4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Première page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1 || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white hover:bg-[#ede9e4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Page précédente"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Dynamic Page Buttons */}
          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum) => {
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={`page-btn-${pageNum}`}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[28px] h-7 px-2 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#5645d4] text-white shadow-xs'
                      : 'bg-white hover:bg-[#ede9e4] text-[#1a1a1a] border border-[#e5e3df]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white hover:bg-[#ede9e4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Page suivante"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage >= totalPages || isLoading}
            className="p-1.5 rounded-md border border-[#e5e3df] bg-white hover:bg-[#ede9e4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Dernière page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
