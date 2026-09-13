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
  const { createMovement, isCreatingMovement } = useEquipments();
  const initialSelection = initialMovementSelection(initialEquipment);

  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(initialEquipment);
  const [movementType, setMovementType] = useState<MovementType>('TRANSFER');
  const [sourceShelfId, setSourceShelfId] = useState(initialSelection.sourceShelfId);
  const [destinationShelfId, setDestinationShelfId] = useState<string>('');
  const [quantity, setQuantity] = useState(initialSelection.quantity);
  const [selectedSerialNumberId, setSelectedSerialNumberId] = useState(initialSelection.serialNumberId);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSelectEquipment = (equipment: Equipment) => {
    const selection = initialMovementSelection(equipment);
    setSelectedEquipment(equipment);
    setMovementType('TRANSFER');
    setSourceShelfId(selection.sourceShelfId);
    setDestinationShelfId('');
    setQuantity(selection.quantity);
    setSelectedSerialNumberId(selection.serialNumberId);
    setServerError(null);
    onSelectEquipment?.(equipment);
  };

  // When a serial number is picked, sync source shelf
  const handleSelectSerialNumber = (snId: string) => {
    setSelectedSerialNumberId(snId);
    setQuantity(1);
    const sn = selectedEquipment?.serialNumbers?.find((s) => s.serialNumberId === snId);
    if (sn?.shelfId) {
      setSourceShelfId(sn.shelfId);
      if (movementType === 'IN') {
        // If it already has a shelf, switch to TRANSFER or OUT
        setMovementType('TRANSFER');
      }
    } else {
      setSourceShelfId('');
      // If it has no shelf, default movement is IN
      setMovementType('IN');
    }
  };

  // Max available quantity based on source shelf
  const maxAvailableQuantity = useMemo(() => {
    if (!selectedEquipment) return 1;
    if (selectedEquipment.hasSerialNumber) return 1;

    if (movementType === 'IN') {
      return 99999; // New external stock coming in
    }

    if (sourceShelfId && selectedEquipment.equipmentShelfs) {
      const alloc = selectedEquipment.equipmentShelfs.find((es) => es.shelfId === sourceShelfId);
      return alloc?.equipmentQuantity ?? selectedEquipment.equipmentQuantity;
    }

    return selectedEquipment.equipmentQuantity > 0 ? selectedEquipment.equipmentQuantity : 1;
  }, [selectedEquipment, sourceShelfId, movementType]);

  // Set all quantity button handler
  const handleSetAllQuantity = () => {
    setQuantity(maxAvailableQuantity);
  };

  // Switch movement type
  const handleTypeChange = (type: MovementType) => {
    setMovementType(type);
    setServerError(null);

    if (type === 'IN') {
      setSourceShelfId(''); // Source is NULL
      // Pick first shelf for destination
      if (shelves.length > 0 && !destinationShelfId) {
        setDestinationShelfId(shelves[0].shelfId);
      }
    } else if (type === 'OUT') {
      setDestinationShelfId(''); // Destination is NULL
      // Pick source shelf
      if (selectedEquipment?.equipmentShelfs?.length && !sourceShelfId) {
        setSourceShelfId(selectedEquipment.equipmentShelfs[0].shelfId);
      }
    } else if (type === 'TRANSFER') {
      if (shelves.length > 0) {
        if (!sourceShelfId && selectedEquipment?.equipmentShelfs?.length) {
          setSourceShelfId(selectedEquipment.equipmentShelfs[0].shelfId);
        }
        // Destination shouldn't be equal to source
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
      setServerError('Veuillez sélectionner un équipement.');
      return;
    }

    // Validation checks
    if (movementType === 'TRANSFER') {
      if (!sourceShelfId) {
        setServerError('Veuillez choisir l’étagère source.');
        return;
      }
      if (!destinationShelfId) {
        setServerError('Veuillez choisir l’étagère de destination.');
        return;
      }
      if (sourceShelfId === destinationShelfId) {
        setServerError('L’étagère source et l’étagère de destination ne peuvent pas être identiques.');
        return;
      }
    } else if (movementType === 'IN') {
      if (!destinationShelfId) {
        setServerError('Veuillez spécifier l’étagère de destination pour l’entrée en stock.');
        return;
      }
    } else if (movementType === 'OUT') {
      if (!sourceShelfId) {
        setServerError('Veuillez spécifier l’étagère source de prélèvement pour la sortie.');
        return;
      }
    }

    if (quantity <= 0) {
      setServerError('La quantité doit être supérieure à zéro.');
      return;
    }

    if (movementType !== 'IN' && !selectedEquipment.hasSerialNumber && quantity > maxAvailableQuantity) {
      setServerError(
        `Quantité demandée (${quantity}) supérieure au stock disponible sur cette étagère (${maxAvailableQuantity}).`,
      );
      return;
    }

    setServerError(null);

    try {
      await createMovement({
        equipmentId: selectedEquipment.equipmentId,
        serialNumberId: selectedEquipment.hasSerialNumber ? selectedSerialNumberId || undefined : undefined,
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

  // Shelf names helpers
  const sourceShelfName = shelves.find((s) => s.shelfId === sourceShelfId)?.shelfName;
  const destShelfName = shelves.find((s) => s.shelfId === destinationShelfId)?.shelfName;
  const currentTotal = selectedEquipment?.equipmentQuantity ?? 0;

  // Dynamic projected quantity calculation
  let projectedTotal = currentTotal;
  if (movementType === 'IN') {
    projectedTotal = currentTotal + quantity;
  } else if (movementType === 'OUT') {
    projectedTotal = Math.max(0, currentTotal - quantity);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#6b7b97] border border-[#8191ad] text-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 my-8 text-left"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#455268] flex items-center justify-between bg-[#53627c]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1e2b48] border border-white/20 flex items-center justify-center text-[#38bdf8]">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 id="movement-modal-title" className="text-sm font-semibold text-white">
                Créer un Mouvement de Stock
              </h2>
              <p className="text-[11px] text-white/70">
                Audit, traçabilité et mise à jour dynamique dans SQL Server (dbo.Mouvement)
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
              Équipement concerné <span className="text-rose-300">*</span>
            </label>
            {initialEquipment ? (
              <div className="p-3 bg-[#586680]/60 border border-[#8191ad] rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4 text-white" />
                  <div>
                    <span className="font-semibold text-white">
                      {initialEquipment.equipmentName ?? 'Sans nom'}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-white/70">
                      <span>Stock actuel : {initialEquipment.equipmentQuantity} unités</span>
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
                className="w-full h-9 px-3 bg-[#4f5d75] text-white border border-[#8191ad] rounded-lg outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20"
              >
                <option value="" disabled className="bg-[#4f5d75] text-white">
                  -- Choisissez un équipement --
                </option>
                {equipmentsList.map((eq) => (
                  <option key={eq.equipmentId} value={eq.equipmentId} className="bg-[#4f5d75] text-white">
                    {eq.equipmentName} ({eq.equipmentQuantity} en stock) {eq.hasSerialNumber ? '• Sérialisé' : ''}
                  </option>
                ))}
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
                    ? 'bg-[#1e2b48] border-white/40 text-white ring-2 ring-white/20'
                    : 'bg-[#586680]/50 border-[#8191ad]/60 hover:bg-[#586680]/80 text-white/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ArrowRightLeft className={`w-3.5 h-3.5 ${movementType === 'TRANSFER' ? 'text-[#38bdf8]' : 'text-white/70'}`} />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-[#38bdf8] border border-[#38bdf8]/40">
                    ⇄ TRANSFER
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-xs text-white">Transfert Rayons</div>
                  <div className="text-[10px] text-white/70 leading-tight">Étagère A → Étagère B</div>
                </div>
              </button>

              {/* Entry / IN */}
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  movementType === 'IN'
                    ? 'bg-[#1e2b48] border-emerald-400 text-white ring-2 ring-emerald-400/40'
                    : 'bg-[#586680]/50 border-[#8191ad]/60 hover:bg-[#586680]/80 text-white/80'
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
                  <div className="text-[10px] text-white/70 leading-tight">NULL (Externe) → Étagère</div>
                </div>
              </button>

              {/* Exit / OUT */}
              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  movementType === 'OUT'
                    ? 'bg-[#1e2b48] border-amber-400 text-white ring-2 ring-amber-400/40'
                    : 'bg-[#586680]/50 border-[#8191ad]/60 hover:bg-[#586680]/80 text-white/80'
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
                  <div className="text-[10px] text-white/70 leading-tight">Étagère → NULL (Consommé)</div>
                </div>
              </button>
            </div>
          </div>

          {/* 3. Serial Number Selector (If Serialized Equipment) */}
          {selectedEquipment?.hasSerialNumber && (
            <div className="space-y-1.5 p-3 bg-[#586680]/60 border border-[#8191ad] rounded-lg">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-white flex items-center gap-1.5">
                  <Barcode className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Numéro de Série Unitaire</span>
                  <span className="text-rose-300">*</span>
                </label>
                <span className="text-[10px] text-white/70">
                  Quantité fixée à 1 unité par numéro de série
                </span>
              </div>

              {selectedEquipment.serialNumbers?.length ? (
                <select
                  value={selectedSerialNumberId}
                  onChange={(e) => handleSelectSerialNumber(e.target.value)}
                  className="w-full h-9 px-3 bg-[#4f5d75] font-mono text-xs text-white border border-[#8191ad] rounded-lg outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20"
                >
                  <option value="" disabled className="bg-[#4f5d75] text-white">
                    -- Choisissez un numéro de série --
                  </option>
                  {selectedEquipment.serialNumbers.map((sn) => (
                    <option key={sn.serialNumberId} value={sn.serialNumberId} className="bg-[#4f5d75] text-white">
                      {sn.serialNumberCode} — ({sn.shelf?.shelfName ? `Étagère: ${sn.shelf.shelfName}` : 'Non assigné'})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-amber-200 italic">
                  Aucun numéro de série disponible pour cet équipement.
                </p>
              )}
            </div>
          )}

          {/* 4. Source & Destination Shelves Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Source Shelf */}
            <div className="space-y-1">
              <label className="block font-semibold text-white">
                Étagère Source
              </label>
              {movementType === 'IN' ? (
                <div className="h-9 px-3 bg-black/25 border border-white/20 rounded-lg flex items-center text-white/60 text-[11px] font-mono">
                  NULL (Création / Entrée externe)
                </div>
              ) : (
                <select
                  value={sourceShelfId}
                  onChange={(e) => setSourceShelfId(e.target.value)}
                  disabled={selectedEquipment?.hasSerialNumber}
                  className="w-full h-9 px-3 bg-[#4f5d75] text-white text-xs border border-[#8191ad] rounded-lg outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="" className="bg-[#4f5d75] text-white">-- Choisir étagère source --</option>
                  {shelves.map((sh) => {
                    const alloc = selectedEquipment?.equipmentShelfs?.find(
                      (es) => es.shelfId === sh.shelfId,
                    );
                    return (
                      <option key={sh.shelfId} value={sh.shelfId} className="bg-[#4f5d75] text-white">
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
                Étagère Destination
              </label>
              {movementType === 'OUT' ? (
                <div className="h-9 px-3 bg-black/25 border border-white/20 rounded-lg flex items-center text-amber-200 text-[11px] font-mono">
                  NULL (Sortie / Sans valeur / Papiers)
                </div>
              ) : (
                <select
                  value={destinationShelfId}
                  onChange={(e) => setDestinationShelfId(e.target.value)}
                  className="w-full h-9 px-3 bg-[#4f5d75] text-white text-xs border border-[#8191ad] rounded-lg outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20"
                >
                  <option value="" className="bg-[#4f5d75] text-white">-- Choisir étagère cible --</option>
                  {shelves
                    .filter((sh) => sh.shelfId !== sourceShelfId)
                    .map((sh) => (
                      <option key={sh.shelfId} value={sh.shelfId} className="bg-[#4f5d75] text-white">
                        {sh.shelfName}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>

          {/* 5. Quantity Controls (All Quantity vs Partial Quantity) */}
          {!selectedEquipment?.hasSerialNumber && (
            <div className="space-y-1.5 p-3 bg-[#586680]/60 border border-[#8191ad] rounded-lg">
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
                  className="flex-1 h-9 px-3 bg-[#4f5d75] text-white font-mono text-xs border border-[#8191ad] rounded-lg outline-none focus:bg-[#435167] focus:border-white focus:ring-2 focus:ring-white/20"
                />

                {movementType !== 'IN' && (
                  <button
                    type="button"
                    onClick={handleSetAllQuantity}
                    className="h-9 px-3 bg-[#1e2b48] hover:bg-[#152037] text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors cursor-pointer shrink-0"
                    title="Déplacer l'intégralité du stock disponible"
                  >
                    Toute la quantité ({maxAvailableQuantity})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 6. Live Impact & Calculation Summary Box */}
          <div className="p-3 bg-[#586680]/70 border border-[#8191ad] rounded-lg space-y-1.5 text-white">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Simulation de calcul de stock</span>
              </span>
              <span className="font-mono text-[11px] font-bold text-white bg-black/30 px-2 py-0.5 rounded border border-white/20">
                Statut: {movementType} ({movementType === 'IN' ? `+${quantity}` : movementType === 'OUT' ? `-${quantity}` : `⇄ ${quantity}`})
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
                      : 'text-[#38bdf8]'
                  }`}
                >
                  {movementType === 'IN' ? `+${quantity}` : movementType === 'OUT' ? `-${quantity}` : '0 (Transfert)'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-white/70">Nouveau stock global</div>
                <div className="font-mono font-bold text-xs text-white">{projectedTotal}</div>
              </div>
            </div>

            <div className="text-[11px] text-white/80 pt-1">
              Trajet: <strong className="text-white">{movementType === 'IN' ? 'NULL (Extérieur)' : sourceShelfName ?? 'Étagère Source'}</strong>
              {' ➔ '}
              <strong className="text-white">{movementType === 'OUT' ? 'NULL (Décharge/Consommé)' : destShelfName ?? 'Étagère Cible'}</strong>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-[#8191ad]/50 flex items-center justify-end gap-2">
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
              className="inline-flex items-center justify-center gap-2 px-4.5 py-2 bg-[#1e2b48] hover:bg-[#152037] text-white text-xs font-medium rounded-lg border border-[#2e3e63] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
