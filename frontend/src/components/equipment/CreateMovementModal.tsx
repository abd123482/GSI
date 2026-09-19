'use client';

import { getErrorMessage } from '@/lib/error-message';

import { useState, useMemo } from 'react';
import { Equipment } from '@/types/equipment';
import { MovementType } from '@/types/movement';
import { useShelves } from '@/hooks/use-shelves';
import { useEquipments } from '@/hooks/use-equipments';
import {
  X,
  ArrowRightLeft,
  ArrowDownRight,
  ArrowUpRight,
  Barcode,
  Sparkles,
  Loader2,
  AlertCircle,
  Package,
  Check,
  Search,
} from 'lucide-react';

interface CreateMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  equipmentsList?: Equipment[];
  onSelectEquipment?: (equipment: Equipment) => void;
  onSuccess?: () => void;
}

function initialMovementSelection(equipment: Equipment | null) {
  const firstShelf = equipment?.equipmentShelfs?.find((allocation) => allocation.equipmentQuantity > 0);
  const firstSerial = equipment?.hasSerialNumber ? equipment.serialNumbers?.[0] : undefined;

  return {
    sourceShelfId: firstSerial?.shelfId ?? firstShelf?.shelfId ?? '',
    quantity: firstSerial ? 1 : firstShelf?.equipmentQuantity ?? Math.max(1, equipment?.equipmentQuantity ?? 1),
    serialNumberId: firstSerial?.serialNumberId ?? '',
  };
}

export function CreateMovementModal(props: CreateMovementModalProps) {
  if (!props.isOpen) return null;

  return (
    <CreateMovementModalContent
      key={props.equipment?.equipmentId ?? 'select-equipment'}
      {...props}
    />
  );
}

function CreateMovementModalContent({
  isOpen,
  onClose,
  equipment: initialEquipment,
  equipmentsList = [],
  onSelectEquipment,
  onSuccess,
}: CreateMovementModalProps) {
  const { shelves, isLoading: isShelvesLoading } = useShelves({ limit: 100 });
  const {
    createMovement,
    createBatchMovements,
    isCreatingMovement,
    isCreatingBatchMovements,
  } = useEquipments();
  const initialSelection = initialMovementSelection(initialEquipment);

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(initialEquipment);
  const [movementType, setMovementType] = useState<MovementType>('TRANSFER');
  const [sourceShelfId, setSourceShelfId] = useState(initialSelection.sourceShelfId);
  const [destinationShelfId, setDestinationShelfId] = useState<string>('');
  const [quantity, setQuantity] = useState(initialSelection.quantity);
  const [serverError, setServerError] = useState<string | null>(null);

  // Serial numbers assignment state
  const allSerials = useMemo(() => selectedEquipment?.serialNumbers ?? [], [selectedEquipment]);
  const [selectedSerialIds, setSelectedSerialIds] = useState<Set<string>>(() => {
    if (initialSelection.serialNumberId) return new Set([initialSelection.serialNumberId]);
    return new Set();
  });
  const [serialDestinations, setSerialDestinations] = useState<Record<string, string>>({});
  const [serialSearch, setSerialSearch] = useState('');
  const [sourceShelfFilter, setSourceShelfFilter] = useState('ALL');

  const handleSelectEquipment = (equipment: Equipment) => {
    const selection = initialMovementSelection(equipment);
    setSelectedEquipment(equipment);
    setMovementType('TRANSFER');
    setSourceShelfId(selection.sourceShelfId);
    setDestinationShelfId('');
    setQuantity(selection.quantity);
    setSelectedSerialIds(selection.serialNumberId ? new Set([selection.serialNumberId]) : new Set());
    setSerialDestinations({});
    setSerialSearch('');
    setSourceShelfFilter('ALL');
    setServerError(null);
    onSelectEquipment?.(equipment);
  };

  // Unique source shelves from serial numbers
  const uniqueSourceShelves = useMemo(() => {
    const map = new Map<string, string>();
    allSerials.forEach((s) => {
      if (s.shelfId && s.shelf?.shelfName) {
        map.set(s.shelfId, s.shelf.shelfName);
      }
    });
    return Array.from(map.entries()).map(([shelfId, shelfName]) => ({ shelfId, shelfName }));
  }, [allSerials]);

  // Filtered serial numbers
  const filteredSerials = useMemo(() => {
    return allSerials.filter((sn) => {
      const matchSearch = !serialSearch || (sn.serialNumberCode ?? '').toLowerCase().includes(serialSearch.toLowerCase());
      const matchSource =
        sourceShelfFilter === 'ALL'
          ? true
          : sourceShelfFilter === 'UNASSIGNED'
          ? !sn.shelfId
          : sn.shelfId === sourceShelfFilter;
      return matchSearch && matchSource;
    });
  }, [allSerials, serialSearch, sourceShelfFilter]);

  const handleToggleSerial = (id: string) => {
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (!serialDestinations[id] && destinationShelfId) {
          setSerialDestinations((d) => ({ ...d, [id]: destinationShelfId }));
        }
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedSerialIds((prev) => {
      const next = new Set(prev);
      filteredSerials.forEach((sn) => {
        next.add(sn.serialNumberId);
        if (!serialDestinations[sn.serialNumberId] && destinationShelfId) {
          setSerialDestinations((d) => ({ ...d, [sn.serialNumberId]: destinationShelfId }));
        }
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedSerialIds(new Set());
  };

  const handleApplyGlobalDestination = (targetShelfId: string) => {
    setDestinationShelfId(targetShelfId);
    if (!targetShelfId) return;
    setSerialDestinations((prev) => {
      const next = { ...prev };
      selectedSerialIds.forEach((id) => {
        next[id] = targetShelfId;
      });
      return next;
    });
  };

  const handleChangeSerialDest = (snId: string, shelfId: string) => {
    setSerialDestinations((prev) => ({
      ...prev,
      [snId]: shelfId,
    }));
    setSelectedSerialIds((prev) => new Set(prev).add(snId));
  };

  // Max available quantity based on source shelf (for standard non-serialized)
  const maxAvailableQuantity = useMemo(() => {
    if (!selectedEquipment) return 1;
    if (selectedEquipment.hasSerialNumber) return selectedEquipment.serialNumbers?.length || 1;

    if (movementType === 'IN') {
      return 99999;
    }

    if (sourceShelfId && selectedEquipment.equipmentShelfs) {
      const alloc = selectedEquipment.equipmentShelfs.find((es) => es.shelfId === sourceShelfId);
      return alloc?.equipmentQuantity ?? selectedEquipment.equipmentQuantity;
    }

    return selectedEquipment.equipmentQuantity > 0 ? selectedEquipment.equipmentQuantity : 1;
  }, [selectedEquipment, sourceShelfId, movementType]);

  const handleSetAllQuantity = () => {
    setQuantity(maxAvailableQuantity);
  };

  // Switch movement type
  const handleTypeChange = (type: MovementType) => {
    setMovementType(type);
    setServerError(null);

    if (type === 'IN') {
      setSourceShelfId('');
      if (shelves.length > 0 && !destinationShelfId) {
        setDestinationShelfId(shelves[0].shelfId);
      }
    } else if (type === 'OUT') {
      setDestinationShelfId('');
      if (selectedEquipment?.equipmentShelfs?.length && !sourceShelfId) {
        setSourceShelfId(selectedEquipment.equipmentShelfs[0].shelfId);
      }
    } else if (type === 'TRANSFER') {
      if (shelves.length > 0) {
        if (!sourceShelfId && selectedEquipment?.equipmentShelfs?.length) {
          setSourceShelfId(selectedEquipment.equipmentShelfs[0].shelfId);
        }
        const otherShelf = shelves.find((s) => s.shelfId !== sourceShelfId);
        if (otherShelf) {
          setDestinationShelfId(otherShelf.shelfId);
        }
      }
    }
  };

  // Submit movement to backend
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment) {
      setServerError('Veuillez sélectionner un article.');
      return;
    }

    // 1. Serialized Equipment multi-unit assignment submission
    if (selectedEquipment.hasSerialNumber) {
      if (selectedSerialIds.size === 0) {
        setServerError('Veuillez sélectionner au moins un numéro de série à déplacer.');
        return;
      }

      const movementItems: import('@/types/movement').CreateEquipmentMovementInput[] = [];

      for (const snId of selectedSerialIds) {
        const sn = allSerials.find((s) => s.serialNumberId === snId);
        const assignedDest = movementType === 'OUT' ? undefined : (serialDestinations[snId] || destinationShelfId || undefined);
        const srcShelf = movementType === 'IN' ? undefined : (sn?.shelfId || sourceShelfId || undefined);

        if (movementType === 'TRANSFER') {
          if (!assignedDest) {
            setServerError(`Veuillez choisir un emplacement cible pour le numéro ${sn?.serialNumberCode || snId}.`);
            return;
          }
          if (srcShelf && assignedDest === srcShelf) {
            setServerError(`Le numéro ${sn?.serialNumberCode} est déjà sur l’emplacement cible sélectionné.`);
            return;
          }
        } else if (movementType === 'IN') {
          if (!assignedDest) {
            setServerError('Veuillez spécifier l’emplacement de destination pour l’entrée en stock.');
            return;
          }
        } else if (movementType === 'OUT') {
          if (!srcShelf) {
            setServerError(`Le numéro ${sn?.serialNumberCode} n’a pas d’emplacement source pour effectuer une sortie.`);
            return;
          }
        }

        movementItems.push({
          equipmentId: selectedEquipment.equipmentId,
          serialNumberId: snId,
          sourceShelfId: srcShelf,
          destinationShelfId: assignedDest,
          movementQuantity: 1,
          movementType: !srcShelf ? 'IN' : !assignedDest ? 'OUT' : 'TRANSFER',
        });
      }

      setServerError(null);

      try {
        if (movementItems.length === 1) {
          await createMovement(movementItems[0]);
        } else {
          await createBatchMovements(movementItems);
        }
        onSuccess?.();
        onClose();
      } catch (err: unknown) {
        setServerError(getErrorMessage(err, 'Erreur lors de l’enregistrement des mouvements.'));
      }
      return;
    }

    // 2. Standard (Non-serialized) equipment submission
    if (movementType === 'TRANSFER') {
      if (!sourceShelfId) {
        setServerError('Veuillez choisir l’emplacement source.');
        return;
      }
      if (!destinationShelfId) {
        setServerError('Veuillez choisir l’emplacement de destination.');
        return;
      }
      if (sourceShelfId === destinationShelfId) {
        setServerError('L’emplacement source et l’emplacement de destination ne peuvent pas être identiques.');
        return;
      }
    } else if (movementType === 'IN') {
      if (!destinationShelfId) {
        setServerError('Veuillez spécifier l’emplacement de destination pour l’entrée en stock.');
        return;
      }
    } else if (movementType === 'OUT') {
      if (!sourceShelfId) {
        setServerError('Veuillez spécifier l’emplacement source de prélèvement pour la sortie.');
        return;
      }
    }

    if (quantity <= 0) {
      setServerError('La quantité doit être supérieure à zéro.');
      return;
    }

    if (movementType !== 'IN' && quantity > maxAvailableQuantity) {
      setServerError(
        `Quantité demandée (${quantity}) supérieure au stock disponible sur cet emplacement (${maxAvailableQuantity}).`,
      );
      return;
    }

    setServerError(null);

    try {
      await createMovement({
        equipmentId: selectedEquipment.equipmentId,
        sourceShelfId: movementType === 'IN' ? undefined : sourceShelfId || undefined,
        destinationShelfId: movementType === 'OUT' ? undefined : destinationShelfId || undefined,
        movementQuantity: Number(quantity),
        movementType,
      });

      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setServerError(getErrorMessage(err, 'Erreur lors de l’enregistrement du mouvement.'));
    }
  };
  if (!isOpen) return null;

  // Active quantity calculation
  const activeQuantity = selectedEquipment?.hasSerialNumber ? selectedSerialIds.size : quantity;

  // Shelf names helpers
  const sourceShelfName = shelves.find((s) => s.shelfId === sourceShelfId)?.shelfName;
  const destShelfName = shelves.find((s) => s.shelfId === destinationShelfId)?.shelfName;
  const currentTotal = selectedEquipment
    ? (selectedEquipment.hasSerialNumber ? (selectedEquipment.serialNumbers?.length ?? selectedEquipment.equipmentQuantity) : selectedEquipment.equipmentQuantity)
    : 0;

  // Dynamic projected quantity calculation
  let projectedTotal = currentTotal;
  if (movementType === 'IN') {
    projectedTotal = currentTotal + activeQuantity;
  } else if (movementType === 'OUT') {
    projectedTotal = Math.max(0, currentTotal - activeQuantity);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-[#383330] border border-[#3f3a36] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3f3a36] flex items-center justify-between bg-[#2b2622]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2b2622] border border-white/20 flex items-center justify-center text-[#f7f5f0]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 id="movement-modal-title" className="text-sm font-semibold text-white">
                Créer un Mouvement de Stock
              </h2>
              <p className="text-[11px] text-white/70">
                Enregistrement et suivi des mouvements de stock
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {serverError && (
            <div className="p-3 bg-rose-950/50 border border-rose-500/50 text-rose-200 rounded-lg flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{serverError}</span>
            </div>
          )}

          {/* 1. Equipment Selection (if multiple) */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-white">
              Article concerné <span className="text-rose-300">*</span>
            </label>
            {initialEquipment ? (
              <div className="p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-white" />
                  <div>
                    <span className="font-semibold text-white">
                      {initialEquipment.equipmentName ?? 'Sans nom'}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-white/70">
                      <span>Stock actuel : {initialEquipment.hasSerialNumber ? (initialEquipment.serialNumbers?.length ?? initialEquipment.equipmentQuantity) : initialEquipment.equipmentQuantity} unités</span>
                      <span>•</span>
                      <span>{initialEquipment.hasSerialNumber ? 'Sérialisé (S/N)' : 'Standard'}</span>
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] bg-black/30 border border-white/20 px-2 py-0.5 rounded text-white/90">
                  {initialEquipment.equipmentId.slice(0, 8)}...
                </span>
              </div>
            ) : (
              <select
                value={selectedEquipment?.equipmentId ?? ''}
                onChange={(e) => {
                  const eq = equipmentsList.find((item) => item.equipmentId === e.target.value);
                  if (eq) {
                    handleSelectEquipment(eq);
                  }
                }}
                className="w-full h-9 px-3 bg-[#2b2622] text-white border border-[#3f3a36] rounded-lg outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
              >
                <option value="" disabled className="bg-[#2b2622] text-white">
                  -- Choisissez un article --
                </option>
                {equipmentsList.map((eq) => {
                  const qty = eq.hasSerialNumber ? (eq.serialNumbers?.length ?? eq.equipmentQuantity) : eq.equipmentQuantity;
                  return (
                    <option key={eq.equipmentId} value={eq.equipmentId} className="bg-[#2b2622] text-white">
                      {eq.equipmentName} ({qty} en stock) {eq.hasSerialNumber ? '• Sérialisé' : ''}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* 2. Movement Type Radio Tiles */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-white">
              Type & Direction du Mouvement <span className="text-rose-300">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {/* Transfer */}
              <button
                type="button"
                onClick={() => handleTypeChange('TRANSFER')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  movementType === 'TRANSFER'
                    ? 'bg-[#2b2622] border-white/40 text-white ring-2 ring-white/20'
                    : 'bg-[#2b2622]/50 border-[#3f3a36]/60 hover:bg-[#2b2622]/80 text-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowRightLeft className={`w-3.5 h-3.5 ${movementType === 'TRANSFER' ? 'text-[#f7f5f0]' : 'text-white/70'}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-[#f7f5f0] border border-[#38bdf8]/40">
                    ⇄ TRANSFER
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-white">Transfert Emplacements</div>
                  <div className="text-[10px] text-white/70 leading-tight">D'un emplacement à un autre</div>
                </div>
              </button>

              {/* Entry / IN */}
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  movementType === 'IN'
                    ? 'bg-[#2b2622] border-emerald-400 text-white ring-2 ring-emerald-400/40'
                    : 'bg-[#2b2622]/50 border-[#3f3a36]/60 hover:bg-[#2b2622]/80 text-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowDownRight className={`w-3.5 h-3.5 ${movementType === 'IN' ? 'text-emerald-400' : 'text-white/70'}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-emerald-300 border border-emerald-400/40">
                    + IN
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-white">Entrée en Stock</div>
                  <div className="text-[10px] text-white/70 leading-tight">Arrivage externe → Emplacement</div>
                </div>
              </button>

              {/* Exit / OUT */}
              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  movementType === 'OUT'
                    ? 'bg-[#2b2622] border-amber-400 text-white ring-2 ring-amber-400/40'
                    : 'bg-[#2b2622]/50 border-[#3f3a36]/60 hover:bg-[#2b2622]/80 text-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowUpRight className={`w-3.5 h-3.5 ${movementType === 'OUT' ? 'text-amber-300' : 'text-white/70'}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-400/40">
                    - OUT
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-white">Sortie Définitive</div>
                  <div className="text-[10px] text-white/70 leading-tight">Emplacement → Sortie du stock</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. SERIAL NUMBER ASSIGNMENT TABLE (If Serialized Equipment) */}
          {selectedEquipment?.hasSerialNumber ? (
            <div className="space-y-3 p-3.5 bg-[#2b2622]/80 border border-[#3f3a36] rounded-xl text-white">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-emerald-300" />
                  <span className="font-semibold text-xs text-white">
                    Assignation des Numéros de Série ({selectedSerialIds.size} / {allSerials.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="text-[11px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Tout sélectionner
                  </button>
                  <span className="text-white/40">•</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Désélectionner
                  </button>
                </div>
              </div>

              {/* Quick Global Destination Helper */}
              {movementType !== 'OUT' && (
                <div className="p-2.5 bg-[#1f1b18] border border-[#3f3a36] rounded-lg flex items-center justify-between gap-2 flex-wrap text-xs">
                  <span className="text-[11px] text-white/80">
                    Définir un emplacement cible commun :
                  </span>
                  <select
                    value={destinationShelfId}
                    onChange={(e) => handleApplyGlobalDestination(e.target.value)}
                    className="h-8 px-2.5 bg-[#2b2622] text-xs text-white border border-[#3f3a36] rounded-lg outline-none cursor-pointer focus:border-white"
                  >
                    <option value="">-- Appliquer à tous les sélectionnés --</option>
                    {shelves.map((sh) => (
                      <option key={sh.shelfId} value={sh.shelfId}>
                        {sh.shelfName} ({sh.shelfQuantity ?? 0} en stock)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search & Source Filter Bar */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-white/50" />
                  <input
                    type="text"
                    value={serialSearch}
                    onChange={(e) => setSerialSearch(e.target.value)}
                    placeholder="Filtrer par code S/N..."
                    className="w-full h-7 pl-8 pr-2 bg-[#1f1b18] border border-[#3f3a36] rounded-md text-xs text-white placeholder-white/40 outline-none focus:border-white/50"
                  />
                </div>
                {uniqueSourceShelves.length > 0 && (
                  <select
                    value={sourceShelfFilter}
                    onChange={(e) => setSourceShelfFilter(e.target.value)}
                    className="h-7 px-2 bg-[#1f1b18] text-xs text-white border border-[#3f3a36] rounded-md outline-none cursor-pointer"
                  >
                    <option value="ALL">Tous les emplacements actuels</option>
                    <option value="UNASSIGNED">Non assignés</option>
                    {uniqueSourceShelves.map((sh) => (
                      <option key={sh.shelfId} value={sh.shelfId}>
                        {sh.shelfName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Scrollable list of serial numbers with individual destination selectors ("كل وحدة وين تروح") */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {filteredSerials.length === 0 ? (
                  <div className="p-4 text-center text-xs text-white/60 font-mono">
                    Aucun numéro de série ne correspond aux filtres.
                  </div>
                ) : (
                  filteredSerials.map((sn) => {
                    const isSelected = selectedSerialIds.has(sn.serialNumberId);
                    const assignedDest = serialDestinations[sn.serialNumberId] || destinationShelfId || '';
                    return (
                      <div
                        key={sn.serialNumberId}
                        className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-3 text-xs ${
                          isSelected
                            ? 'bg-[#2b2622] border-white/40 text-white'
                            : 'bg-[#26221f]/70 border-[#3f3a36]/60 text-white/60 hover:bg-[#2b2622]/40'
                        }`}
                      >
                        {/* Checkbox and Code */}
                        <div
                          className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1"
                          onClick={() => handleToggleSerial(sn.serialNumberId)}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSerial(sn.serialNumberId)}
                            className="rounded border-[#3f3a36] text-white cursor-pointer"
                          />
                          <span className="font-mono font-medium text-white text-xs truncate">
                            {sn.serialNumberCode || 'Sans code'}
                          </span>
                        </div>

                        {/* Current Shelf Source */}
                        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-white/70 shrink-0">
                          <span className="text-white/50">Actuel:</span>
                          <span className="font-mono text-white/90">
                            {sn.shelf?.shelfName || 'Non assigné'}
                          </span>
                        </div>

                        {/* Destination Selector ("كل وحدة وين تروح") */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-white/50">Cible:</span>
                          {movementType === 'OUT' ? (
                            <span className="text-[11px] text-amber-300 font-medium px-2 py-0.5 bg-amber-950/40 rounded border border-amber-500/30">
                              Sortie définitive
                            </span>
                          ) : (
                            <select
                              value={assignedDest}
                              onChange={(e) => handleChangeSerialDest(sn.serialNumberId, e.target.value)}
                              disabled={!isSelected}
                              className="h-7 px-2 bg-[#1f1b18] text-xs text-white border border-[#3f3a36] rounded outline-none focus:border-white cursor-pointer disabled:opacity-40"
                            >
                              <option value="">-- Choisir emplacement --</option>
                              {shelves.map((sh) => (
                                <option key={sh.shelfId} value={sh.shelfId}>
                                  {sh.shelfName}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* STANDARD NON-SERIALIZED CONTROLS */
            <>
              {/* Source & Destination Shelves Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Source Shelf */}
                <div className="space-y-1">
                  <label className="block font-semibold text-white">
                    Emplacement Source
                  </label>
                  {movementType === 'IN' ? (
                    <div className="h-9 px-3 bg-black/25 border border-white/20 rounded-lg flex items-center text-white/70 text-xs">
                      Arrivage externe (Fournisseur)
                    </div>
                  ) : (
                    <select
                      value={sourceShelfId}
                      onChange={(e) => setSourceShelfId(e.target.value)}
                      className="w-full h-9 px-3 bg-[#2b2622] text-white text-xs border border-[#3f3a36] rounded-lg outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
                    >
                      <option value="" className="bg-[#2b2622] text-white">-- Choisir emplacement source --</option>
                      {shelves.map((sh) => {
                        const alloc = selectedEquipment?.equipmentShelfs?.find(
                          (es) => es.shelfId === sh.shelfId,
                        );
                        return (
                          <option key={sh.shelfId} value={sh.shelfId} className="bg-[#2b2622] text-white">
                            {sh.shelfName} {alloc ? `(${alloc.equipmentQuantity} en stock)` : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>

                {/* Destination Shelf */}
                <div className="space-y-1">
                  <label className="block font-semibold text-white">
                    Emplacement Destination
                  </label>
                  {movementType === 'OUT' ? (
                    <div className="h-9 px-3 bg-black/25 border border-white/20 rounded-lg flex items-center text-amber-200 text-xs">
                      Sortie définitive (Consommation / Perte)
                    </div>
                  ) : (
                    <select
                      value={destinationShelfId}
                      onChange={(e) => setDestinationShelfId(e.target.value)}
                      className="w-full h-9 px-3 bg-[#2b2622] text-white text-xs border border-[#3f3a36] rounded-lg outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
                    >
                      <option value="" className="bg-[#2b2622] text-white">-- Choisir emplacement cible --</option>
                      {shelves
                        .filter((sh) => sh.shelfId !== sourceShelfId)
                        .map((sh) => (
                          <option key={sh.shelfId} value={sh.shelfId} className="bg-[#2b2622] text-white">
                            {sh.shelfName}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Quantity Controls */}
              <div className="space-y-1.5 p-3 bg-[#2b2622]/60 border border-[#3f3a36] rounded-lg">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-white">
                    Quantité à déplacer <span className="text-rose-300">*</span>
                  </label>
                  {movementType !== 'IN' && (
                    <span className="text-[11px] text-white/70">
                      Disponible sur source : <strong className="text-white">{maxAvailableQuantity}</strong> unité(s)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max={movementType === 'IN' ? 99999 : maxAvailableQuantity}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 h-9 px-3 bg-[#2b2622] text-white font-mono text-xs border border-[#3f3a36] rounded-lg outline-none focus:bg-[#383330] focus:border-white focus:ring-2 focus:ring-white/20"
                  />

                  {movementType !== 'IN' && (
                    <button
                      type="button"
                      onClick={handleSetAllQuantity}
                      className="h-9 px-3 bg-[#2b2622] hover:bg-[#3f3a36] text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors cursor-pointer shrink-0"
                      title="Déplacer l'intégralité du stock disponible"
                    >
                      Toute la quantité ({maxAvailableQuantity})
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 6. Live Impact & Calculation Summary Box */}
          <div className="p-3 bg-[#2b2622]/70 border border-[#3f3a36] rounded-lg space-y-1.5 text-white">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Simulation de calcul de stock</span>
              </span>
              <span className="font-mono text-[11px] font-bold text-white bg-black/30 px-2 py-0.5 rounded border border-white/20">
                Statut: {movementType} ({movementType === 'IN' ? `+${activeQuantity}` : movementType === 'OUT' ? `-${activeQuantity}` : `⇄ ${activeQuantity}`})
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/15 text-center">
              <div>
                <div className="text-[10px] text-white/70">Stock initial/actuel</div>
                <div className="font-mono font-bold text-xs text-white">{currentTotal}</div>
              </div>
              <div>
                <div className="text-[10px] text-white/70">Mouvement ({movementType})</div>
                <div
                  className={`font-mono font-bold text-xs ${
                    movementType === 'IN'
                      ? 'text-emerald-300'
                      : movementType === 'OUT'
                      ? 'text-amber-300'
                      : 'text-[#f7f5f0]'
                  }`}
                >
                  {movementType === 'IN' ? `+${activeQuantity}` : movementType === 'OUT' ? `-${activeQuantity}` : '0 (Transfert)'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/70">Nouveau stock global</div>
                <div className="font-mono font-bold text-xs text-white">{projectedTotal}</div>
              </div>
            </div>

            <div className="text-[11px] text-white/80 pt-1">
              Trajet:{' '}
              {selectedEquipment?.hasSerialNumber ? (
                <strong className="text-white">
                  Assignation unitaire ({selectedSerialIds.size} numéro(s) de série sélectionné(s))
                </strong>
              ) : (
                <>
                  <strong className="text-white">{movementType === 'IN' ? 'Arrivage externe' : sourceShelfName ?? 'Emplacement Source'}</strong>
                  {' ➔ '}
                  <strong className="text-white">{movementType === 'OUT' ? 'Sortie définitive' : destShelfName ?? 'Emplacement Cible'}</strong>
                </>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#3f3a36]/50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isCreatingMovement || isShelvesLoading}
              className="inline-flex items-center justify-center gap-2 px-4.5 py-2 bg-[#2b2622] hover:bg-[#3f3a36] text-white text-xs font-medium rounded-lg border border-[#4d4742] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isCreatingMovement ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmer le mouvement</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
