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
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Barcode,
  AlertTriangle,
  MapPin,
  Pencil,
  Trash2,
  Plus,
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
  onOpenMovement?: (equipment: Equipment) => void;
  onEditEquipment?: (equipment: Equipment) => void;
  onDeleteEquipment?: (equipment: Equipment) => void;
  onEditSerialNumber?: (serialNumber: SerialNumber, equipment: Equipment) => void;
  onDeleteSerialNumber?: (serialNumber: SerialNumber, equipment: Equipment) => void;
  onViewEquipmentShelves?: (equipment: Equipment) => void;
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
  onOpenMovement,
  onEditEquipment,
  onDeleteEquipment,
  onEditSerialNumber,
  onDeleteSerialNumber,
  onViewEquipmentShelves,
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
    toast.success('Identifiant copié dans le presse-papier !');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopySerial = (e: React.MouseEvent, snCode: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snCode);
    setCopiedSn(snCode);
    toast.success('Numéro de série copié !');
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
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return Array.from(new Set(pages));
  };

  return (
    <div className="w-full bg-[#383330] border border-[#3f3a36] rounded-[4px] shadow-xs overflow-hidden text-left space-y-0">
      {/* Table Toolbar & Search by Name */}
      <div className="p-3 border-b border-[#3f3a36] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 bg-[#383330]">
        {/* Search by Name input */}
        <div className="flex items-center gap-2 w-full lg:w-auto flex-1 max-w-lg">
          <div className="relative w-full">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#aea69c]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom d'équipement..."
              className="w-full h-8 pl-8 pr-7 bg-[#2b2622] text-xs font-mono text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-colors"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#aea69c] hover:text-[#f7f5f0] cursor-pointer"
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
            <Database className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#aea69c]" />
            <input
              type="text"
              value={idLookupInput}
              onChange={(e) => setIdLookupInput(e.target.value)}
              placeholder="Inspecter par UUID..."
              className="w-full h-8 pl-8 pr-2 bg-[#2b2622] text-xs font-mono text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#f7f5f0] placeholder:text-[#aea69c] transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!idLookupInput.trim() || isLoading}
            className="h-8 px-2.5 bg-[#2b2622] hover:bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1"
            title="Consulter l'équipement par UUID"
          >
            <span>Ouvrir</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        {/* View Mode & Page Limit & Refresh Controls */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto justify-between lg:justify-end">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center bg-[#2b2622] p-0.5 rounded-[3px] border border-[#3f3a36]">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-2 py-1 rounded-[2px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] shadow-xs'
                  : 'text-[#aea69c] hover:text-[#f7f5f0]'
              }`}
              title="Vue Liste / Table"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`px-2 py-1 rounded-[2px] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] shadow-xs'
                  : 'text-[#aea69c] hover:text-[#f7f5f0]'
              }`}
              title="Vue Galerie / Cartes"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Galerie</span>
            </button>
          </div>

          {/* Page size limit selector */}
          <div className="flex items-center gap-1.5 text-xs text-[#c9c0ad]">
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 px-2 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] text-xs font-mono text-[#f7f5f0] outline-none focus:border-[#f7f5f0] cursor-pointer"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 px-2.5 bg-[#2b2622] hover:bg-[#383330] text-[#c9c0ad] hover:text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            title="Rafraîchir les données SQL Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#f7f5f0]' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'table' ? (
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[11px] font-mono text-[#aea69c] tracking-wider uppercase">
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
            <tbody className="divide-y divide-[#3f3a36] text-xs text-[#f7f5f0]">
              {isLoading && equipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#aea69c]">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-[#f7f5f0]" />
                      <span className="text-xs font-mono">Chargement des équipements depuis SQL Server...</span>
                    </div>
                  </td>
                </tr>
              ) : equipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#aea69c]">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#aea69c]">
                        <Archive className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-sm text-[#f7f5f0]">Aucun équipement trouvé</p>
                        <p className="text-xs text-[#c9c0ad] max-w-sm">
                          {searchTerm
                            ? `Aucun résultat pour la recherche "${searchTerm}".`
                            : 'Aucun équipement n’est enregistré dans la table dbo.Equipment.'}
                        </p>
                      </div>
                      {canCreateMovement && (
                        <button
                          type="button"
                          onClick={onOpenCreateModal}
                          className="mt-1 px-3.5 py-1.5 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] rounded-[3px] text-xs font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Créer une première entrée</span>
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
                        className="hover:bg-[#2b2622]/50 transition-colors group cursor-pointer"
                      >
                        {/* 0. Expand Chevron for Child Serial Numbers */}
                        <td className="py-3 px-3 text-center" onClick={(e) => toggleExpand(equipment.equipmentId, e)}>
                          {equipment.hasSerialNumber && serials.length > 0 ? (
                            <button
                              type="button"
                              className="p-1 rounded-[2px] hover:bg-[#2b2622] text-[#aea69c] hover:text-[#f7f5f0] transition-colors cursor-pointer"
                              title={isExpanded ? 'Replier les numéros de série' : 'Déplier les numéros de série'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-[#f7f5f0]" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-3.5 h-3.5 inline-block text-[#3f3a36]">•</span>
                          )}
                        </td>

                        {/* 1. Global Index */}
                        <td className="py-3 px-3 text-center font-mono text-xs text-[#aea69c]">
                          <span className="inline-block px-1.5 py-0.5 rounded-[2px] bg-[#2b2622] border border-[#3f3a36] text-[#dad2c1] text-[10px]">
                            #{formattedIndex}
                          </span>
                        </td>

                        {/* 2. Icon + Equipment Name */}
                        <td className="py-3 px-4 font-medium text-[#f7f5f0]">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-[3px] ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shrink-0`}
                              title={visualTheme.label}
                            >
                              <IconComp className="w-3.5 h-3.5" />
                            </div>

                            <div className="min-w-0">
                              <p className="font-medium text-xs text-[#f7f5f0] truncate max-w-xs group-hover:text-white transition-colors">
                                {equipment.equipmentName ?? 'Équipement sans nom'}
                              </p>
                              <div className="text-[11px] font-mono text-[#aea69c] flex items-center gap-1.5 flex-wrap">
                                <span>Min alert : {equipment.minequipmentQuantity}</span>
                                {equipment.equipmentQuantity <= equipment.minequipmentQuantity && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-[2px] bg-[#2d2212] text-[#f59e0b] border border-[#453316] text-[10px] font-mono">
                                    <AlertTriangle className="w-2.5 h-2.5" />
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
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                              equipment.equipmentQuantity > 0
                                ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                                : 'bg-[#2d1616] text-[#ef4444] border-[#451e1e]'
                            }`}
                          >
                            <Hash className="w-3 h-3" />
                            <span>
                              {equipment.equipmentQuantity} {equipment.equipmentQuantity > 1 ? 'unités' : 'unité'}
                            </span>
                          </span>
                        </td>

                        {/* 4. Serial Numbers Child Count Badge */}
                        <td className="py-3 px-4 text-center">
                          {equipment.hasSerialNumber ? (
                            <button
                              type="button"
                              onClick={(e) => toggleExpand(equipment.equipmentId, e)}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[10px] font-mono text-[#dad2c1] transition-colors cursor-pointer"
                              title="Cliquer pour afficher les numéros de série"
                            >
                              <Barcode className="w-3 h-3 text-[#aea69c]" />
                              <span>{serials.length} S/N</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-[#aea69c]">Non sérialisé</span>
                          )}
                        </td>

                        {/* 5. Shelf Locations */}
                        <td className="py-3 px-4">
                          {!equipment.hasSerialNumber ? (
                            <div className="space-y-1">
                              {equipment.equipmentShelfs && equipment.equipmentShelfs.length > 0 ? (
                                <div className="flex flex-wrap gap-1 items-center">
                                  {equipment.equipmentShelfs.map((es) => (
                                    <button
                                      key={es.equipmentShelfId || es.shelfId}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewEquipmentShelves?.(equipment);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[10px] font-mono text-[#dad2c1] transition-colors cursor-pointer"
                                      title="Cliquer pour voir les détails de cette étagère"
                                    >
                                      <Layers className="w-3 h-3 text-[#aea69c]" />
                                      <span>{es.shelf?.shelfName ?? 'Étagère'}</span>
                                      <span className="text-[#aea69c]">
                                        ({es.equipmentQuantity})
                                      </span>
                                    </button>
                                  ))}
                                  {onViewEquipmentShelves && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewEquipmentShelves(equipment);
                                      }}
                                      className="inline-flex items-center gap-1 px-1 py-0.5 rounded-[2px] text-[10px] font-mono text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer"
                                      title="Consulter toutes les étagères de cet équipement"
                                    >
                                      <Eye className="w-2.5 h-2.5" />
                                      <span>({equipment.equipmentShelfs.length})</span>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#aea69c]">
                                    <MapPin className="w-3 h-3 text-[#aea69c]" />
                                    <span>Non assigné</span>
                                  </span>
                                  {onViewEquipmentShelves && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewEquipmentShelves(equipment);
                                      }}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[#dad2c1] transition-colors cursor-pointer"
                                      title="Voir les détails d'attribution aux étagères"
                                    >
                                      <Layers className="w-2.5 h-2.5 text-[#aea69c]" />
                                      <span>Étagères</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-mono text-[#aea69c]">
                                {serials.filter((s) => s.shelfId).length}/{serials.length} en rayons
                              </span>
                              {onViewEquipmentShelves && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewEquipmentShelves(equipment);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[#dad2c1] transition-colors cursor-pointer"
                                  title="Voir la répartition des numéros de série par étagère"
                                >
                                  <Layers className="w-2.5 h-2.5 text-[#aea69c]" />
                                  <span>Voir étagères</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 6. GUID SQL Server */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs text-[#aea69c]">
                            <span className="truncate max-w-[140px]">{equipment.equipmentId}</span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(e, equipment.equipmentId)}
                              className="p-1 text-[#aea69c] hover:text-[#f7f5f0] rounded-[2px] hover:bg-[#2b2622] transition-colors cursor-pointer"
                              title="Copier le GUID"
                            >
                              {copiedId === equipment.equipmentId ? (
                                <Check className="w-3.5 h-3.5 text-[#10b981]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 7. Action CTA */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onSelectEquipment(equipment)}
                              className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer"
                              title="Consulter la fiche"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {onOpenMovement && (
                              <button
                                type="button"
                                onClick={() => onOpenMovement(equipment)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-[2px] bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[11px] font-mono text-[#dad2c1] transition-colors cursor-pointer"
                                title="Créer un mouvement de stock pour cet équipement"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-[#aea69c]" />
                                <span>Mouvement</span>
                              </button>
                            )}

                            {onViewEquipmentShelves && (
                              <button
                                type="button"
                                onClick={() => onViewEquipmentShelves(equipment)}
                                className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer"
                                title="Voir toutes les étagères de cet équipement"
                              >
                                <Layers className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onEditEquipment && canUpdateEquipment && (
                              <button
                                type="button"
                                onClick={() => onEditEquipment(equipment)}
                                className="p-1.5 rounded-[2px] text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#2b2622] transition-colors cursor-pointer"
                                title="Modifier l’équipement"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteEquipment && canDeleteEquipment && (
                              <button
                                type="button"
                                onClick={() => onDeleteEquipment(equipment)}
                                className="p-1.5 rounded-[2px] text-[#ef4444] hover:bg-[#2d1616] transition-colors cursor-pointer"
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
                        <tr className="bg-[#2b2622]/90 border-b border-[#3f3a36]">
                          <td colSpan={8} className="py-3 px-6">
                            <div className="p-3 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] space-y-2.5">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <Barcode className="w-4 h-4 text-[#dad2c1]" />
                                  <span className="text-xs font-mono font-medium text-[#f7f5f0]">
                                    Numéros de série enfants ({serials.length})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {onEditEquipment && canUpdateEquipment && (
                                    <button
                                      type="button"
                                      onClick={() => onEditEquipment(equipment)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] text-[10px] font-mono text-[#f59e0b] bg-[#2d2212] border border-[#453316] hover:bg-[#3d2e18] transition-colors cursor-pointer"
                                      title="Supprimer tous les numéros et convertir en comptage standard"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-[#f59e0b]" />
                                      <span>Convertir en standard</span>
                                    </button>
                                  )}
                                  <span className="text-[11px] font-mono text-[#aea69c] hidden md:inline">
                                    dbo.SerialNumber
                                  </span>
                                </div>
                              </div>

                              {serials.length === 0 ? (
                                <p className="text-xs font-mono text-[#aea69c] py-1">
                                  Aucun numéro de série rattaché à cet équipement.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
                                  {serials.map((sn, sIdx) => (
                                    <div
                                      key={sn.serialNumberId}
                                      className="flex items-center justify-between gap-1.5 p-2 bg-[#383330] border border-[#3f3a36] rounded-[2px] font-mono text-[11px]"
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[#aea69c] text-[10px]">
                                          #{String(sIdx + 1).padStart(2, '0')}
                                        </span>
                                        <span className="font-semibold text-[#f7f5f0] truncate">
                                          {sn.serialNumberCode ?? 'S/N inconnu'}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Shelf Badge */}
                                        {sn.shelf?.shelfName ? (
                                          <span
                                            className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono bg-[#2b2622] text-[#dad2c1] border border-[#3f3a36] flex items-center gap-1"
                                            title={`Rayon : ${sn.shelf.shelfName}`}
                                          >
                                            <Layers className="w-2.5 h-2.5 text-[#aea69c]" />
                                            <span className="truncate max-w-[70px]">{sn.shelf.shelfName}</span>
                                          </span>
                                        ) : (
                                          <span
                                            className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono text-[#aea69c] bg-[#2b2622] border border-[#3f3a36] flex items-center gap-0.5"
                                            title="Non assigné à une étagère"
                                          >
                                            <span>Non assigné</span>
                                          </span>
                                        )}

                                        <span
                                          className={`px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono font-semibold uppercase ${
                                            sn.serialNumberStatus === 'AVAILABLE'
                                              ? 'bg-[#162b22] text-[#10b981] border border-[#1e3d30]'
                                              : 'bg-[#2d2212] text-[#f59e0b] border border-[#453316]'
                                          }`}
                                        >
                                          {sn.serialNumberStatus ?? 'DISPO'}
                                        </span>
                                        {sn.serialNumberCode && (
                                          <button
                                            type="button"
                                            onClick={(e) => handleCopySerial(e, sn.serialNumberCode!)}
                                            className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                                            title="Copier le numéro de série"
                                          >
                                            {copiedSn === sn.serialNumberCode ? (
                                              <Check className="w-3 h-3 text-[#10b981]" />
                                            ) : (
                                              <Copy className="w-3 h-3 text-[#aea69c]" />
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
                                            className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                                            title="Modifier le code ou le statut"
                                          >
                                            <Pencil className="w-3 h-3 text-[#aea69c] hover:text-[#f7f5f0]" />
                                          </button>
                                        )}
                                        {onDeleteSerialNumber && canDeleteSerialNumber && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteSerialNumber(sn, equipment);
                                            }}
                                            className="p-1 text-[#ef4444] hover:bg-[#2d1616] rounded-[2px] transition-colors cursor-pointer"
                                            title="Supprimer ce numéro de série"
                                          >
                                            <Trash2 className="w-3 h-3" />
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
        <div className="p-4 bg-[#2b2622]">
          {isLoading && equipments.length === 0 ? (
            <div className="py-14 text-center text-[#aea69c] flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-[#f7f5f0]" />
              <p className="text-xs font-mono">Chargement des cartes équipements...</p>
            </div>
          ) : equipments.length === 0 ? (
            <div className="py-14 text-center text-[#aea69c] flex flex-col items-center justify-center gap-2">
              <Archive className="w-8 h-8 text-[#aea69c]" />
              <p className="text-sm font-medium text-[#f7f5f0]">Aucun équipement disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                    className="bg-[#383330] border border-[#3f3a36] hover:border-[#4d4742] rounded-[4px] p-4 shadow-xs transition-all text-left space-y-3 relative group cursor-pointer"
                  >
                    {/* Top Header Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-[3px] ${visualTheme.bg} border ${visualTheme.border} flex items-center justify-center ${visualTheme.text} shrink-0`}
                        >
                          <IconComp className="w-4.5 h-4.5" />
                        </div>

                        <div>
                          <span className="font-mono text-[10px] text-[#dad2c1] bg-[#2b2622] border border-[#3f3a36] px-1.5 py-0.5 rounded-[2px]">
                            #{formattedIndex}
                          </span>
                          <h3 className="font-medium text-xs text-[#f7f5f0] truncate max-w-[160px] group-hover:text-white transition-colors mt-0.5">
                            {equipment.equipmentName ?? 'Équipement sans nom'}
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] font-mono text-[10px] border ${
                          equipment.equipmentQuantity > 0
                            ? 'bg-[#162b22] text-[#10b981] border-[#1e3d30]'
                            : 'bg-[#2d1616] text-[#ef4444] border-[#451e1e]'
                        }`}
                      >
                        <Hash className="w-3 h-3" />
                        <span>{equipment.equipmentQuantity} u.</span>
                      </span>
                    </div>

                    {/* Child Serial Numbers Badge with Toggle Drawer */}
                    {equipment.hasSerialNumber && (
                      <div className="p-2 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] space-y-2">
                        <div
                          className="flex items-center justify-between text-xs font-mono text-[#dad2c1] cursor-pointer"
                          onClick={(e) => toggleExpand(equipment.equipmentId, e)}
                        >
                          <div className="flex items-center gap-1.5">
                            <Barcode className="w-3.5 h-3.5 text-[#aea69c]" />
                            <span>{serials.length} numéros de série</span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>

                        {isExpanded && (
                          <div className="space-y-1 max-h-32 overflow-y-auto pr-1 pt-1 border-t border-[#3f3a36]">
                            {serials.map((sn) => (
                              <div
                                key={sn.serialNumberId}
                                className="flex items-center justify-between text-[11px] font-mono text-[#aea69c] p-1.5 bg-[#383330] rounded-[2px] border border-[#3f3a36]"
                              >
                                <span className="truncate text-[#f7f5f0]">{sn.serialNumberCode}</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] px-1 rounded-[2px] bg-[#162b22] text-[#10b981] border border-[#1e3d30] font-mono font-bold">
                                    {sn.serialNumberStatus ?? 'DISPO'}
                                  </span>
                                  {onEditSerialNumber && canUpdateSerialNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onEditSerialNumber(sn, equipment);
                                      }}
                                      className="p-0.5 hover:text-[#f7f5f0] transition-colors"
                                      title="Modifier ce numéro"
                                    >
                                      <Pencil className="w-3 h-3 text-[#aea69c] hover:text-[#f7f5f0]" />
                                    </button>
                                  )}
                                  {onDeleteSerialNumber && canDeleteSerialNumber && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteSerialNumber(sn, equipment);
                                      }}
                                      className="p-0.5 text-[#ef4444] hover:bg-[#2d1616] rounded-[2px] transition-colors"
                                      title="Supprimer ce numéro"
                                    >
                                      <Trash2 className="w-3 h-3" />
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
                    <div className="bg-[#2b2622] border border-[#3f3a36] rounded-[3px] p-2 flex items-center justify-between text-[11px] font-mono text-[#aea69c]">
                      <span className="truncate max-w-[130px]">{equipment.equipmentId}</span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyId(e, equipment.equipmentId)}
                          className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                          title="Copier le GUID"
                        >
                          {copiedId === equipment.equipmentId ? (
                            <Check className="w-3.5 h-3.5 text-[#10b981]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectEquipment(equipment)}
                          className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                          title="Consulter la fiche"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onOpenMovement && (
                          <button
                            type="button"
                            onClick={() => onOpenMovement(equipment)}
                            className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                            title="Créer un mouvement"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onViewEquipmentShelves && (
                          <button
                            type="button"
                            onClick={() => onViewEquipmentShelves(equipment)}
                            className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                            title="Voir les étagères associées"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onEditEquipment && canUpdateEquipment && (
                          <button
                            type="button"
                            onClick={() => onEditEquipment(equipment)}
                            className="p-1 hover:text-[#f7f5f0] rounded-[2px] transition-colors cursor-pointer"
                            title="Modifier l’équipement"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDeleteEquipment && canDeleteEquipment && (
                          <button
                            type="button"
                            onClick={() => onDeleteEquipment(equipment)}
                            className="p-1 text-[#ef4444] hover:bg-[#2d1616] rounded-[2px] transition-colors cursor-pointer"
                            title="Supprimer l’équipement"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      {totalPages > 1 && (
        <div className="px-4 py-2.5 bg-[#2b2622] border-t border-[#3f3a36] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#aea69c] font-mono">
          <div>
            Page <span className="text-[#f7f5f0]">{currentPage}</span> /{' '}
            <span className="text-[#f7f5f0]">{totalPages}</span> ({totalEquipments} équipements)
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Première page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Page précédente"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Dynamic Page Buttons */}
            <div className="flex items-center gap-1 px-1">
              {getPageNumbers().map((pageNum) => {
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={`page-btn-${pageNum}`}
                    type="button"
                    onClick={() => onPageChange(pageNum)}
                    className={`w-6 h-6 rounded-[2px] text-xs font-mono transition-colors cursor-pointer flex items-center justify-center ${
                      isActive
                        ? 'bg-[#f7f5f0] text-[#2b2622] font-semibold'
                        : 'bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] border border-[#3f3a36]'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Page suivante"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={currentPage >= totalPages || isLoading}
              className="p-1 rounded-[2px] border border-[#3f3a36] bg-[#383330] hover:bg-[#3f3a36] text-[#c9c0ad] hover:text-[#f7f5f0] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Dernière page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
