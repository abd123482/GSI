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
  ShieldCheck,
  Code,
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
      {/* Document Card (#6b7b97 Slate Blue Theme) */}
      <div
        className="w-full max-w-xl bg-[#6b7b97] border border-[#8191ad] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shelf-detail-title"
      >
        {/* Cover Banner */}
        <div className="h-24 bg-[#53627c] border-b border-[#455268] relative flex items-end px-6 pb-0">
          {/* Top Bar Actions */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/30"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer border border-white/30"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Overlapping Icon Tile */}
          <div
            className="w-14 h-14 rounded-xl bg-[#1e2b48] border-2 border-white/80 shadow-md flex items-center justify-center text-[#38bdf8] translate-y-5"
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
                className="text-2xl font-semibold text-white tracking-tight"
              >
                {shelf.shelfName ?? 'Étagère sans nom'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-200 border border-emerald-400/40">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tuple Actif
              </span>
            </div>
            <p className="text-xs text-white/80 flex items-center gap-2">
              <span>{visualTheme.label}</span>
              <span>•</span>
              <span className="font-mono text-white font-semibold">dbo.Shelf</span>
            </p>
          </div>

          {/* Property Table */}
          <div className="border border-[#8191ad] rounded-lg divide-y divide-[#5a6f98] text-xs bg-[#586680]/70">
            {/* Property: UUID */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-36 shrink-0">
                <Database className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">shelfId (GUID)</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-white min-w-0">
                <span className="truncate">{shelf.shelfId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-1 hover:bg-white/20 text-white/80 hover:text-white rounded transition-colors cursor-pointer shrink-0"
                  title="Copier l'UUID"
                >
                  {copiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Property: shelfName */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-36 shrink-0">
                <Layers className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Nom de l&apos;étagère</span>
              </div>
              <div className="text-sm font-semibold text-white text-right">
                {shelf.shelfName ?? 'Non défini'}
              </div>
            </div>

            {/* Property: shelfQuantity */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-36 shrink-0">
                <Hash className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Capacité / Stock</span>
              </div>
              <div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    shelf.shelfQuantity > 0
                      ? 'bg-emerald-950/40 text-emerald-200 border border-emerald-400/40'
                      : 'bg-amber-950/40 text-amber-200 border border-amber-400/40'
                  }`}
                >
                  <Hash className="w-3 h-3" />
                  {shelf.shelfQuantity} {shelf.shelfQuantity > 1 ? 'unités enregistrées' : 'unité enregistrée'}
                </span>
              </div>
            </div>

            {/* Property: Physical Location */}
            <div className="p-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-white/85 w-36 shrink-0">
                <MapPin className="w-3.5 h-3.5 text-white" />
                <span className="font-medium">Emplacement dépôt</span>
              </div>
              <div className="text-xs text-white font-medium">
                Zone Principale • Somépharm Workspace
              </div>
            </div>
          </div>

          {/* Raw JSON Tuple Toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-white hover:text-white/80 flex items-center gap-1 font-medium cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showRawJson ? 'Masquer le JSON brut' : 'Afficher le tuple SQL Server en JSON'}</span>
            </button>

            {showRawJson && (
              <div className="relative bg-[#1e2b48] border border-[#3e4f73] text-[#f6f5f4] rounded-lg p-3 font-mono text-[11px] overflow-x-auto shadow-inner">
                <pre>{JSON.stringify(shelf, null, 2)}</pre>
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
                  <span>Copier</span>
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-[#8191ad] flex flex-wrap items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-white" />
              <span>Copier GUID</span>
            </button>

            <div className="flex items-center gap-2">
              {/* Update Button */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenUpdate) onOpenUpdate(shelf);
                }}
                disabled={!canUpdateShelf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/30 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={canUpdateShelf ? "Modifier cette étagère (shelf.update)" : "Permission 'shelf.update' manquante"}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Modifier</span>
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={() => {
                  if (onOpenDelete) onOpenDelete(shelf);
                }}
                disabled={!canDeleteShelf}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600/90 hover:bg-red-600 text-white border border-red-400/40 text-xs font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title={canDeleteShelf ? "Supprimer cette étagère (shelf.delete)" : "Permission 'shelf.delete' manquante"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Supprimer</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4.5 py-2 bg-[#1e2b48] hover:bg-[#152037] text-white text-xs font-medium rounded-lg border border-[#2e3e63] shadow-xs transition-colors cursor-pointer"
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
