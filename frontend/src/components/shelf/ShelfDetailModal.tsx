'use client';

import { useState } from 'react';
import { Shelf } from '@/types/shelf';
import { getShelfVisualTheme } from './shelf-icons';
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
  RefreshCw,
  Edit3,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

interface ShelfDetailModalProps {
  shelf: Shelf | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenUpdate?: (shelf: Shelf) => void;
  onOpenDelete?: (shelf: Shelf) => void;
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
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  if (!isOpen || !shelf) return null;

  const visualTheme = getShelfVisualTheme(shelf.shelfName);
  const IconComp = visualTheme.icon;

  const handleCopyId = () => {
    navigator.clipboard.writeText(shelf.shelfId);
    setCopiedId(true);
    toast.success('UUID SQL Server copié dans le presse-papier !');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(shelf, null, 2));
    setCopiedJson(true);
    toast.success('Tuple JSON copié dans le presse-papier !');
    setTimeout(() => setCopiedJson(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      {/* Notion Document Card (12px rounded, hairline border, shadow elevation) */}
      <div
        className="w-full max-w-xl bg-white border border-[#e5e3df] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shelf-detail-title"
      >
        {/* Notion Cover Banner (Pastel Tint Header) */}
        <div className={`h-24 ${visualTheme.bg} border-b ${visualTheme.border} relative flex items-end px-6 pb-0`}>
          {/* Top Bar Actions */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-md bg-white/80 hover:bg-white text-[#37352f] transition-colors cursor-pointer border border-[#e5e3df]"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md bg-white/80 hover:bg-white text-[#37352f] transition-colors cursor-pointer border border-[#e5e3df]"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Overlapping Notion Icon Tile */}
          <div
            className={`w-14 h-14 rounded-xl ${visualTheme.bg} border-2 border-white shadow-md flex items-center justify-center ${visualTheme.text} translate-y-5`}
          >
            <IconComp className="w-7 h-7" />
          </div>
        </div>

        {/* Modal Body */}
        <div className="pt-8 px-6 pb-6 space-y-6">
          {/* Title & Type Badge */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                id="shelf-detail-title"
                className="text-2xl font-semibold text-[#1a1a1a] tracking-tight"
              >
                {shelf.shelfName ?? 'Étagère sans nom'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tuple Actif
              </span>
            </div>
            <p className="text-xs text-[#5d5b54] flex items-center gap-2">
              <span>{visualTheme.label}</span>
              <span>•</span>
              <span className="font-mono text-[#5645d4]">dbo.Shelf</span>
            </p>
          </div>

          {/* Notion Page Property Table */}
          <div className="border border-[#e5e3df] rounded-lg divide-y divide-[#ede9e4] text-xs bg-[#fafaf9]">
            {/* Property: UUID */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-36 shrink-0">
                <Database className="w-3.5 h-3.5 text-[#5645d4]" />
                <span className="font-medium">shelfId (GUID)</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#1a1a1a] min-w-0">
                <span className="truncate">{shelf.shelfId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 hover:bg-[#ede9e4] text-[#787671] hover:text-[#1a1a1a] rounded transition-colors cursor-pointer shrink-0"
                  title="Copier l'UUID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-[#1aae39]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Property: shelfName */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-36 shrink-0">
                <Layers className="w-3.5 h-3.5 text-[#7b3ff2]" />
                <span className="font-medium">Nom de l'étagère</span>
              </div>
              <div className="text-sm font-semibold text-[#1a1a1a] text-right">
                {shelf.shelfName ?? 'Non défini'}
              </div>
            </div>

            {/* Property: shelfQuantity */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-36 shrink-0">
                <Hash className="w-3.5 h-3.5 text-[#dd5b00]" />
                <span className="font-medium">Capacité / Stock</span>
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    shelf.shelfQuantity > 0
                      ? 'bg-[#d9f3e1] text-[#1aae39] border border-[#a3e5b3]'
                      : 'bg-[#ffe8d4] text-[#dd5b00] border border-[#fed2b2]'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {shelf.shelfQuantity} {shelf.shelfQuantity > 1 ? 'unités enregistrées' : 'unité enregistrée'}
                </span>
              </div>
            </div>

            {/* Property: Physical Location */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#787671] w-36 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-[#0075de]" />
                <span className="font-medium">Emplacement dépôt</span>
              </div>
              <div className="text-xs text-[#1a1a1a] font-medium">
                Zone Principale • Somépharm Workspace
              </div>
            </div>
          </div>

          {/* Raw JSON Tuple Toggle (Notion Code Block) */}
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
                <pre>{JSON.stringify(shelf, null, 2)}</pre>
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
                  <span>Copier</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer (Notion button styles) */}
          <div className="pt-3 border-t border-[#ede9e4] flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-transparent hover:bg-[#f0eeec] text-[#1a1a1a] border border-[#c8c4be] text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-[#5645d4]" />
              <span>Copier GUID</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Update Button (PATCH /shelves/:id) */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenUpdate) onOpenUpdate(shelf);
                }}
                disabled={!canUpdateShelf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#eef5fc] text-[#0075de] border border-[#b2d7f7] text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={canUpdateShelf ? "Modifier cette étagère (shelf.update)" : "Permission 'shelf.update' manquante"}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>

              {/* Delete Button (DELETE /shelves/:id) */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenDelete) onOpenDelete(shelf);
                }}
                disabled={!canDeleteShelf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-[#fde0ec] text-[#e03131] border border-[#f5b8d0] text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={canDeleteShelf ? "Supprimer cette étagère (shelf.delete)" : "Permission 'shelf.delete' manquante"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4.5 py-2 bg-[#5645d4] hover:bg-[#4534b3] text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
