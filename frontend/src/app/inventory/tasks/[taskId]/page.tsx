'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  Search,
  ChevronDown,
  ChevronUp,
  Hash,
  MapPin,
  Barcode,
  Boxes,
  Check,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useInventoryTask, useSubmitTask } from '@/hooks/use-inventory';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function InventoryTaskPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const taskId = params?.taskId as string;
  const router = useRouter();

  const { data: attempt, isLoading } = useInventoryTask(taskId);
  const { mutateAsync: submitTask } = useSubmitTask();

  // Selected shelf for observation
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Non-serialized shelf counts mapping: { [shelfId: string]: number }
  const [shelfCounts, setShelfCounts] = useState<{ [shelfId: string]: number }>({});

  // Serial Number counting states
  const [countedSns, setCountedSns] = useState<
    Array<{ serialNumberId?: string; code: string; shelfId?: string; isNew?: boolean }>
  >([]);
  const [scanInput, setScanInput] = useState<string>('');
  const [snFilterTab, setSnFilterTab] = useState<'ALL' | 'UNCOUNTED' | 'COUNTED'>('ALL');
  const [snListSearch, setSnListSearch] = useState<string>('');
  const [snReferenceSearch, setSnReferenceSearch] = useState<string>('');
  const [isSnReferenceExpanded, setIsSnReferenceExpanded] = useState<boolean>(false);

  const participants = attempt?.unit?.inventory?.Inventory_User || [];
  const uniqueParticipantsCount = new Set(participants.map((p: any) => p.userId)).size;
  const isMultiUserValid = uniqueParticipantsCount >= 2;

  const scopeDetails = attempt?.scopeDetails;
  const isByEquipment = attempt?.unit?.inventory?.typeInventory === 'ByEquipment';
  const isByShelf = attempt?.unit?.inventory?.typeInventory === 'ByShelf';

  // Resolved Current Equipment with guaranteed shelves & serialNumbers mapping
  const currentEquipment = useMemo(() => {
    if (isByEquipment) {
      const fromScope = scopeDetails?.equipments?.find(
        (e: any) => e.equipmentId === attempt?.unit?.equipmentId
      );
      if (fromScope) return fromScope;

      if (attempt?.unit?.equipment) {
        const eq = attempt.unit.equipment;
        return {
          ...eq,
          shelves:
            eq.shelves ||
            eq.equipmentShelfs?.map((es: any) => ({
              shelfId: es.shelfId ?? '',
              shelfName: es.shelf?.shelfName ?? 'Étagère non définie',
              quantity: es.equipmentQuantity ?? 0,
            })) ||
            [],
          serialNumbers:
            eq.serialNumbers?.map((sn: any) => ({
              serialNumberId: sn.serialNumberId,
              serialNumberCode: sn.serialNumberCode ?? '',
              serialNumberStatus: sn.serialNumberStatus ?? '',
              shelfId: sn.shelfId,
              shelfName: sn.shelf?.shelfName ?? null,
            })) || [],
        };
      }
    }
    return null;
  }, [isByEquipment, attempt, scopeDetails]);

  const hasSerialNumber = currentEquipment?.hasSerialNumber ?? false;

  // Equipment shelves list with theoretical quantities
  const equipmentShelves = useMemo(() => {
    return currentEquipment?.shelves || [];
  }, [currentEquipment]);

  // All expected serial numbers for this equipment
  const allEquipmentSns = useMemo(() => {
    return currentEquipment?.serialNumbers || [];
  }, [currentEquipment]);

  // Filtered reference serial numbers for top display
  const filteredReferenceSns = useMemo(() => {
    if (!snReferenceSearch.trim()) return allEquipmentSns;
    const term = snReferenceSearch.trim().toLowerCase();
    return allEquipmentSns.filter(
      (sn: any) =>
        sn.serialNumberCode?.toLowerCase().includes(term) ||
        sn.shelfName?.toLowerCase().includes(term)
    );
  }, [allEquipmentSns, snReferenceSearch]);

  // Other shelves across inventory scope
  const otherWarehouseShelves = useMemo(() => {
    const assignedIds = new Set(equipmentShelves.map((s: any) => s.shelfId));
    const list: Array<{ shelfId: string; shelfName: string }> = [];

    for (const eq of scopeDetails?.equipments || []) {
      for (const sh of eq.shelves || []) {
        if (sh.shelfId && !assignedIds.has(sh.shelfId)) {
          assignedIds.add(sh.shelfId);
          list.push({ shelfId: sh.shelfId, shelfName: sh.shelfName });
        }
      }
    }
    return list;
  }, [equipmentShelves, scopeDetails]);

  // Current selected shelf details
  const selectedShelfObj = useMemo(() => {
    return equipmentShelves.find((s: any) => s.shelfId === selectedShelfId);
  }, [equipmentShelves, selectedShelfId]);

  // Serial numbers on current selected shelf
  const expectedSnsForSelectedShelf = useMemo(() => {
    if (!selectedShelfId) return allEquipmentSns;
    return allEquipmentSns.filter((s: any) => s.shelfId === selectedShelfId);
  }, [allEquipmentSns, selectedShelfId]);

  const countedSnsForSelectedShelf = useMemo(() => {
    if (!selectedShelfId) return countedSns;
    return countedSns.filter((s) => s.shelfId === selectedShelfId);
  }, [countedSns, selectedShelfId]);

  // Filtered serial numbers for checklist
  const filteredChecklistSns = useMemo(() => {
    const search = snListSearch.trim().toLowerCase();
    const countedCodes = new Set(countedSns.map((s) => s.code.toLowerCase()));

    return expectedSnsForSelectedShelf.filter((sn: any) => {
      if (search && !sn.serialNumberCode?.toLowerCase().includes(search)) {
        return false;
      }
      const isCounted = countedCodes.has(sn.serialNumberCode?.toLowerCase());

      if (snFilterTab === 'COUNTED') return isCounted;
      if (snFilterTab === 'UNCOUNTED') return !isCounted;
      return true;
    });
  }, [expectedSnsForSelectedShelf, snListSearch, snFilterTab, countedSns]);

  // Total physically counted for non-serialized items
  const totalNonSnCounted = useMemo(() => {
    return Object.values(shelfCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [shelfCounts]);

  // Restore state from existing orders (e.g. draft) or default to first shelf
  useEffect(() => {
    if (attempt?.orders && attempt.orders.length > 0) {
      if (hasSerialNumber) {
        const restored = attempt.orders
          .filter((o: any) => (o.quantityCalculated ?? 0) > 0)
          .map((o: any) => {
            const found = allEquipmentSns.find((s: any) => s.serialNumberId === o.serialNumberId);
            return {
              serialNumberId: o.serialNumberId || undefined,
              code:
                o.serialNumber?.serialNumberCode ||
                found?.serialNumberCode ||
                o.unknownItemEvidence ||
                'S/N ' + (o.serialNumberId?.slice(0, 8) || 'inconnu'),
              shelfId: o.shelfId || undefined,
              isNew: !o.serialNumberId && !!o.unknownItemEvidence,
            };
          });
        if (restored.length > 0) {
          setCountedSns(restored);
        }
      } else {
        const restoredCounts: { [shelfId: string]: number } = {};
        attempt.orders.forEach((o: any) => {
          if (o.shelfId) {
            restoredCounts[o.shelfId] = o.quantityCalculated ?? 0;
          }
        });
        setShelfCounts(restoredCounts);
      }

      if (attempt.orders[0]?.shelfId) {
        setSelectedShelfId(attempt.orders[0].shelfId);
      }
      if (attempt.orders[0]?.notes) {
        setNotes(attempt.orders[0].notes);
      }
    } else {
      // Default to first shelf of equipment
      if (!selectedShelfId && equipmentShelves.length > 0) {
        setSelectedShelfId(equipmentShelves[0].shelfId);
      }
    }
  }, [attempt?.attemptId, attempt?.orders, hasSerialNumber, allEquipmentSns, equipmentShelves]);

  // Handlers for Non-Serialized shelf count
  const handleUpdateCurrentShelfCount = (val: number) => {
    if (!selectedShelfId) return;
    setShelfCounts((prev) => ({
      ...prev,
      [selectedShelfId]: Math.max(0, val),
    }));
  };

  // Handlers for Serial Number counting
  const handleAddSerialNumber = (rawCode?: string) => {
    const code = (rawCode || scanInput).trim();
    if (!code) return;

    const codes = code.split(/[\r\n,;\s]+/).filter(Boolean);
    if (codes.length === 0) return;

    let added = 0;
    let duplicates = 0;

    setCountedSns((prev) => {
      const next = [...prev];
      const existing = new Set(next.map((s) => s.code.toLowerCase()));

      for (const c of codes) {
        if (existing.has(c.toLowerCase())) {
          duplicates++;
          continue;
        }

        const match = allEquipmentSns.find(
          (s: any) => s.serialNumberCode?.toLowerCase() === c.toLowerCase()
        );

        next.push({
          serialNumberId: match?.serialNumberId,
          code: match?.serialNumberCode || c,
          shelfId: selectedShelfId || match?.shelfId || undefined,
          isNew: !match,
        });

        existing.add(c.toLowerCase());
        added++;
      }

      return next;
    });

    setScanInput('');

    if (added > 0) {
      toast.success(`${added} valeur(s) de N° de série ajoutée(s)`);
    }
    if (duplicates > 0) {
      toast.info(`${duplicates} N° de série déjà scanné(s)`);
    }
  };

  const handleToggleCounted = (sn: any) => {
    setCountedSns((prev) => {
      const code = sn.serialNumberCode || sn.code;
      const idx = prev.findIndex(
        (s) =>
          (sn.serialNumberId && s.serialNumberId === sn.serialNumberId) ||
          s.code.toLowerCase() === code.toLowerCase()
      );

      if (idx >= 0) {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      } else {
        return [
          ...prev,
          {
            serialNumberId: sn.serialNumberId,
            code,
            shelfId: selectedShelfId || sn.shelfId || undefined,
            isNew: false,
          },
        ];
      }
    });
  };

  const handleRemoveCounted = (code: string) => {
    setCountedSns((prev) => prev.filter((s) => s.code !== code));
  };

  const handleBatchCheckAllForShelf = () => {
    if (expectedSnsForSelectedShelf.length === 0) return;

    setCountedSns((prev) => {
      const next = [...prev];
      const existing = new Set(next.map((s) => s.code.toLowerCase()));

      for (const sn of expectedSnsForSelectedShelf) {
        if (!existing.has(sn.serialNumberCode.toLowerCase())) {
          next.push({
            serialNumberId: sn.serialNumberId,
            code: sn.serialNumberCode,
            shelfId: selectedShelfId || sn.shelfId || undefined,
            isNew: false,
          });
          existing.add(sn.serialNumberCode.toLowerCase());
        }
      }
      return next;
    });

    toast.success(`Tous les N° de série attendus sur cette étagère ont été validés`);
  };

  const handleClearCountedForShelf = () => {
    if (selectedShelfId) {
      setCountedSns((prev) => prev.filter((s) => s.shelfId !== selectedShelfId));
      toast.info(`Comptage réinitialisé pour cette étagère`);
    } else {
      setCountedSns([]);
      toast.info(`Tous les numéros de série ont été retirés`);
    }
  };

  // Build submission payload
  const buildPayload = (isDraft: boolean) => {
    const isValidUuid = (val?: string | null) =>
      !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    const fallbackShelfId =
      (isValidUuid(selectedShelfId) ? selectedShelfId : null) ||
      (isValidUuid(equipmentShelves[0]?.shelfId) ? equipmentShelves[0].shelfId : null) ||
      (isValidUuid(attempt?.unit?.shelfId) ? attempt.unit.shelfId : undefined);

    let observations: any[] = [];

    if (hasSerialNumber) {
      if (countedSns.length === 0) {
        observations = [
          {
            equipmentId: currentEquipment?.equipmentId || attempt?.unit?.equipmentId,
            shelfId: fallbackShelfId,
            quantityCalculated: 0,
            notes: notes.trim() || undefined,
          },
        ];
      } else {
        observations = countedSns.map((sn) => ({
          equipmentId: currentEquipment?.equipmentId || attempt?.unit?.equipmentId,
          shelfId: (isValidUuid(sn.shelfId) ? sn.shelfId : null) || fallbackShelfId,
          serialNumberId: isValidUuid(sn.serialNumberId) ? sn.serialNumberId : undefined,
          unknownItemEvidence: sn.isNew ? sn.code : undefined,
          quantityCalculated: 1,
          notes: sn.isNew
            ? `S/N scanné non répertorié: ${sn.code}`
            : (notes.trim() || undefined),
        }));
      }
    } else {
      // Non-serialized: send observations per shelf
      const entries = Object.entries(shelfCounts).filter(([shId, qty]) => isValidUuid(shId) && Number(qty) >= 0);
      if (entries.length > 0) {
        observations = entries.map(([shelfId, qty]) => ({
          equipmentId: currentEquipment?.equipmentId || attempt?.unit?.equipmentId,
          shelfId: shelfId,
          quantityCalculated: Number(qty) || 0,
          notes: notes.trim() || undefined,
        }));
      } else {
        observations = [
          {
            equipmentId: currentEquipment?.equipmentId || attempt?.unit?.equipmentId,
            shelfId: fallbackShelfId,
            quantityCalculated: Number(shelfCounts[selectedShelfId]) || 0,
            notes: notes.trim() || undefined,
          },
        ];
      }
    }

    return {
      observations,
      isDraft,
    };
  };

  if (!isLoaded || !isSignedIn || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  const targetEquipmentName =
    currentEquipment?.equipmentName ||
    attempt?.unit?.equipment?.equipmentName ||
    attempt?.unit?.shelf?.shelfName ||
    'Équipement';

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col pb-12">
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link
            href="/inventory/tasks"
            className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#aea69c] border border-[#3f3a36]">
                  {attempt?.unit?.inventory?.title || 'Inventaire'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#10b981] border border-[#10b981]/30">
                  {isByEquipment ? 'Par Équipement' : 'Par Étagère'}
                </span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                  hasSerialNumber
                    ? 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                    : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                }`}>
                  {hasSerialNumber ? 'Avec N° de série' : 'Sans N° de série'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                Tâche de comptage : <span className="font-semibold">{targetEquipmentName}</span>
              </h1>
            </div>
            <div className="text-[10px] font-mono px-2.5 py-1 bg-[#383330] border border-[#3f3a36] text-[#aea69c] rounded-[3px] self-start sm:self-auto">
              ID Tâche: {taskId.slice(0, 8)}...
            </div>
          </div>
        </div>

        {/* Two-Participant Requirement Warning */}
        {!isMultiUserValid && (
          <div className="bg-red-950/40 border border-red-800/60 p-4 rounded-[4px] text-sm text-red-200 flex items-start gap-3 shadow-sm">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-red-300">
                Inventaire non conforme : au moins 2 participants distincts requis
              </p>
              <p className="text-xs text-red-300/80">
                Cet inventaire ne comporte actuellement qu'un seul participant ({uniqueParticipantsCount}/2).
                Conformément à la politique d'inventaire SomePharm en double aveugle, au moins deux personnes distinctes doivent être assignées avant de pouvoir enregistrer ou soumettre des observations.
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: REFERENCE VIEW (FIRST IT DISPLAYS EQUIPMENT THEN THE SHELFS WITH THEIR COUNT) */}
        {isByEquipment && (
          <section className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2a2522] space-y-4 shadow-sm">
            {/* 1. Equipment Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3f3a36]">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-[4px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#aea69c]">
                      Équipement inventorié
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                      Cible active
                    </span>
                  </div>
                  <h2 className="text-lg font-semibold text-[#f7f5f0]">
                    {targetEquipmentName}
                  </h2>
                  <p className="text-[11px] font-mono text-[#aea69c]">
                    ID: {currentEquipment?.equipmentId || attempt?.unit?.equipmentId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-[3px] bg-[#26221f] border border-[#3f3a36] text-right">
                  <span className="text-[10px] text-[#aea69c] block font-mono">STOCK THÉORIQUE ATTENDU</span>
                  <span className="text-sm font-semibold text-[#f7f5f0] font-mono">
                    {currentEquipment?.totalQuantity ?? currentEquipment?.equipmentQuantity ?? 0} unités
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-[3px] bg-[#26221f] border border-[#3f3a36] text-right">
                  <span className="text-[10px] text-[#aea69c] block font-mono">TRAÇABILITÉ</span>
                  <span className={`text-xs font-semibold font-mono flex items-center justify-end gap-1 ${
                    hasSerialNumber ? 'text-[#10b981]' : 'text-amber-400'
                  }`}>
                    {hasSerialNumber ? <Barcode className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                    {hasSerialNumber ? 'Avec N° de série' : 'Sans N° de série'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Shelves breakdown with counts (و SHELFS لي راهو فيهم بالعدد) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#aea69c] uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#10b981]" />
                  Étagères où se trouve cet équipement (avec quantité attendue) :
                </span>
                <span className="text-[11px] text-[#aea69c] font-mono">
                  {equipmentShelves.length} étagère(s) répertoriée(s)
                </span>
              </div>

              {equipmentShelves.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {equipmentShelves.map((sh: any) => {
                    const isSelected = selectedShelfId === sh.shelfId;
                    const countedOnThisShelf = hasSerialNumber
                      ? countedSns.filter((s) => s.shelfId === sh.shelfId).length
                      : (shelfCounts[sh.shelfId] ?? 0);

                    return (
                      <button
                        key={`ref-shelf-${sh.shelfId}`}
                        type="button"
                        onClick={() => setSelectedShelfId(sh.shelfId)}
                        className={`text-left p-3 rounded-[3px] border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-[#10b981] bg-[#10b981]/15 text-[#f7f5f0] ring-1 ring-[#10b981]/50'
                            : 'border-[#3f3a36] bg-[#26221f] hover:border-[#aea69c] text-[#aea69c]'
                        }`}
                      >
                        <div>
                          <span className="text-xs font-semibold text-[#f7f5f0] block flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#10b981]" />
                            {sh.shelfName}
                          </span>
                          <span className="text-[10px] text-[#aea69c] font-mono">
                            {isSelected ? '✓ Sélectionnée pour saisie' : 'Cliquer pour observer'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-[#383330] text-[#f7f5f0] border border-[#3f3a36] block">
                            {sh.quantity} attendus
                          </span>
                          <span className="text-[10px] font-mono text-[#10b981] block mt-0.5">
                            {countedOnThisShelf} compté(s)
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 bg-[#26221f] border border-[#3f3a36] rounded-[3px] text-xs text-[#aea69c]">
                  Aucune étagère spécifique définie.
                </div>
              )}
            </div>

            {/* 3. Reference Serial Numbers Badges (if serialized) */}
            {hasSerialNumber && allEquipmentSns.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#3f3a36]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-medium text-[#aea69c] uppercase tracking-wider flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#10b981]" />
                    Numéros de série répertoriés ({allEquipmentSns.length}) :
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="relative w-48">
                      <Search className="absolute left-2 top-2 w-3 h-3 text-[#aea69c]" />
                      <input
                        type="text"
                        placeholder="Rechercher S/N..."
                        value={snReferenceSearch}
                        onChange={(e) => setSnReferenceSearch(e.target.value)}
                        className="w-full h-7 pl-7 pr-2 text-[11px] bg-[#1f1b18] border border-[#3f3a36] rounded-[2px] text-[#f7f5f0] placeholder:text-[#5c544d] font-mono focus:outline-none focus:border-[#aea69c]"
                      />
                    </div>
                    {allEquipmentSns.length > 10 && (
                      <button
                        type="button"
                        onClick={() => setIsSnReferenceExpanded((prev) => !prev)}
                        className="text-[11px] text-[#10b981] hover:underline flex items-center gap-1 cursor-pointer font-mono"
                      >
                        {isSnReferenceExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" /> Réduire
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" /> Voir tous ({allEquipmentSns.length})
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {(isSnReferenceExpanded ? filteredReferenceSns : filteredReferenceSns.slice(0, 10)).map(
                    (sn: any) => {
                      const isCounted = countedSns.some(
                        (c) =>
                          (sn.serialNumberId && c.serialNumberId === sn.serialNumberId) ||
                          c.code.toLowerCase() === sn.serialNumberCode?.toLowerCase()
                      );

                      return (
                        <div
                          key={`ref-sn-${sn.serialNumberId || sn.serialNumberCode}`}
                          className={`text-[11px] font-mono px-2 py-1 rounded-[2px] border flex items-center gap-2 shadow-xs transition-colors ${
                            isCounted
                              ? 'bg-[#10b981]/20 border-[#10b981] text-[#f7f5f0]'
                              : 'bg-[#1f1b18] border-[#3f3a36] text-[#aea69c]'
                          }`}
                        >
                          <span className={isCounted ? 'text-[#10b981] font-bold' : 'text-[#f7f5f0]'}>
                            {sn.serialNumberCode}
                          </span>
                          {sn.shelfName && (
                            <span className="text-[9px] px-1 py-0.2 bg-[#383330] rounded text-[#10b981]">
                              {sn.shelfName}
                            </span>
                          )}
                          <span className="text-[9px] text-[#5c544d]">
                            {isCounted ? 'COMPTÉ ✓' : sn.serialNumberStatus || 'AVAILABLE'}
                          </span>
                        </div>
                      );
                    }
                  )}
                  {!isSnReferenceExpanded && filteredReferenceSns.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setIsSnReferenceExpanded(true)}
                      className="text-[10px] font-mono px-2 py-1 rounded-[2px] bg-[#383330] text-[#10b981] hover:bg-[#3f3a36] transition-colors cursor-pointer"
                    >
                      + {filteredReferenceSns.length - 10} autres...
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 2: OBSERVATION ENTRY FORM (EXACT SCREENSHOT LAYOUT WITH CONDITIONAL INPUT) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          {/* Observation Main Form */}
          <div className="md:col-span-2 space-y-6">
            <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
              
              {/* Form Title */}
              <div className="flex justify-between items-center pb-2 border-b border-[#3f3a36]">
                <h2 className="text-sm font-semibold text-[#f7f5f0] flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#10b981]" />
                  Enregistrer une Observation Physique
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#aea69c]">
                  Comptage Indépendant
                </span>
              </div>

              <div className="space-y-4">
                <div className="p-4 border border-[#3f3a36] rounded-[3px] bg-[#26221f] space-y-4">
                  
                  {/* Target Element & Serial Number Notice */}
                  <div className="space-y-2 pb-3 border-b border-[#383330]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono text-[#aea69c]">
                      <span>Élément cible :</span>
                      <span className="text-[#f7f5f0] font-semibold text-sm">{targetEquipmentName}</span>
                    </div>

                    {/* Notice specifying if equipment has serial numbers (اذا عندو سيريال نمبرز اكتبلو بلي فيه سيريال نمبرز) */}
                    {hasSerialNumber ? (
                      <div className="p-2.5 rounded-[3px] bg-purple-950/30 border border-purple-800/40 text-xs text-purple-200 flex items-start gap-2">
                        <Barcode className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-purple-300 block">
                            Cet équipement comporte des numéros de série (Traçabilité unitaire)
                          </span>
                          <p className="text-[11px] text-purple-200/80">
                            Au lieu de saisir manuellement une quantité, vous entrez directement la valeur de chaque numéro de série observé (scanné ou coché).
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-[3px] bg-[#383330]/50 border border-[#3f3a36] text-xs text-[#aea69c] flex items-start gap-2">
                        <Package className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-[#f7f5f0] block">
                            Cet équipement ne comporte pas de numéro de série
                          </span>
                          <p className="text-[11px]">
                            Comptage quantitatif : saisissez le nombre total d'unités physiques comptées sur l'étagère.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shelf Selector Dropdown */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                      ÉTAGÈRE OBSERVÉE (EMPLACEMENT)
                    </label>
                    <select
                      disabled={!isMultiUserValid}
                      value={selectedShelfId}
                      onChange={(e) => setSelectedShelfId(e.target.value)}
                      className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[3px] px-3 text-xs focus:outline-none focus:border-[#aea69c] transition-colors text-[#f7f5f0] disabled:opacity-50 font-mono"
                    >
                      <option value="">-- Sélectionner l'étagère observée --</option>
                      {equipmentShelves.length > 0 && (
                        <optgroup label="Étagères de cet équipement">
                          {equipmentShelves.map((sh: any) => (
                            <option key={`opt-eq-${sh.shelfId}`} value={sh.shelfId}>
                              {sh.shelfName} ({sh.quantity} unités attendues)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherWarehouseShelves.length > 0 && (
                        <optgroup label="Autres emplacements du magasin">
                          {otherWarehouseShelves.map((sh: any) => (
                            <option key={`opt-oth-${sh.shelfId}`} value={sh.shelfId}>
                              {sh.shelfName}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* CONDITIONAL OBSERVATION INPUT:
                      - IF NOT IN SERIAL NUMBER: Enter numerical quantity
                      - IF HAS SERIAL NUMBER: Enter serial number values directly (باش في عوض ما يكتب الكمية يدخل القيمة مباشرة)
                  */}
                  {!hasSerialNumber ? (
                    <div className="space-y-2 p-3.5 bg-[#2a2522] border border-[#3f3a36] rounded-[3px]">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-[#10b981]" />
                          QUANTITÉ OBSERVÉE (COMPTÉE PHYSIQUEMENT)
                        </label>
                        {selectedShelfObj && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#aea69c] border border-[#3f3a36]">
                            {selectedShelfObj.quantity} attendus sur cette étagère
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          disabled={!isMultiUserValid || !selectedShelfId}
                          value={shelfCounts[selectedShelfId] ?? ''}
                          placeholder={selectedShelfObj ? String(selectedShelfObj.quantity) : '0'}
                          onChange={(e) =>
                            handleUpdateCurrentShelfCount(
                              Math.max(0, parseInt(e.target.value, 10) || 0)
                            )
                          }
                          className="flex-1 h-10 bg-[#383330] border border-[#3f3a36] rounded-[3px] px-3 text-base font-mono focus:outline-none focus:border-[#10b981] transition-colors text-[#f7f5f0] disabled:opacity-50"
                        />
                        {selectedShelfObj && (
                          <button
                            type="button"
                            disabled={!isMultiUserValid}
                            onClick={() => handleUpdateCurrentShelfCount(selectedShelfObj.quantity)}
                            className="h-10 px-3 bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] text-xs font-mono rounded-[3px] transition-colors cursor-pointer shrink-0"
                            title="Copier la quantité théorique attendue"
                          >
                            = {selectedShelfObj.quantity} (Conforme)
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-[#aea69c]">
                        Saisissez le nombre total d'unités physiques comptées sur cet emplacement.
                        {totalNonSnCounted > 0 && (
                          <strong className="text-[#10b981] ml-1">
                            (Total toutes étagères confondues : {totalNonSnCounted} unités)
                          </strong>
                        )}
                      </p>
                    </div>
                  ) : (
                    /* IF HAS SERIAL NUMBER: ENTER VALUES DIRECTLY (يدخل القيمة مباشرة) */
                    <div className="space-y-4 p-4 bg-[#2a2522] border border-[#3f3a36] rounded-[3px]">
                      
                      {/* Live Counter & Shelf Status */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px]">
                        <span className="text-xs font-mono text-[#f7f5f0] flex items-center gap-1.5">
                          <Barcode className="w-4 h-4 text-[#10b981]" />
                          Saisie unitaire des N° de série :
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]">
                            Comptés ici : <strong className="text-[#10b981]">{countedSnsForSelectedShelf.length}</strong> / {expectedSnsForSelectedShelf.length}
                          </span>
                          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                            Total équipement : {countedSns.length} / {allEquipmentSns.length}
                          </span>
                        </div>
                      </div>

                      {/* Barcode scanner & direct value entry input */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1">
                          <Barcode className="w-3.5 h-3.5 text-[#10b981]" />
                          VALEUR DU NUMÉRO DE SÉRIE (SCANNER OU SAISIR DIRECTEMENT)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            disabled={!isMultiUserValid}
                            placeholder="Scanner le code-barres ou taper la valeur (ex: SN-...) puis Entrée..."
                            value={scanInput}
                            onChange={(e) => setScanInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSerialNumber();
                              }
                            }}
                            className="flex-1 h-9 px-3 text-xs bg-[#383330] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] placeholder:text-[#6a625b] font-mono focus:outline-none focus:border-[#10b981] disabled:opacity-50"
                          />
                          <button
                            type="button"
                            disabled={!isMultiUserValid || !scanInput.trim()}
                            onClick={() => handleAddSerialNumber()}
                            className="px-4 h-9 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] font-semibold text-xs rounded-[3px] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" /> Ajouter
                          </button>
                        </div>
                      </div>

                      {/* Fast Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#383330]">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!isMultiUserValid || expectedSnsForSelectedShelf.length === 0}
                            onClick={handleBatchCheckAllForShelf}
                            className="text-[11px] font-mono px-2.5 py-1 rounded-[2px] bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Cocher tous les attendus sur cette étagère ({expectedSnsForSelectedShelf.length})
                          </button>
                          {countedSnsForSelectedShelf.length > 0 && (
                            <button
                              type="button"
                              disabled={!isMultiUserValid}
                              onClick={handleClearCountedForShelf}
                              className="text-[11px] font-mono px-2 py-1 rounded-[2px] bg-[#383330] hover:bg-red-900/30 text-red-400 border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Réinitialiser cette étagère
                            </button>
                          )}
                        </div>

                        <span className="text-[10px] font-mono text-[#aea69c]">
                          {allEquipmentSns.length} S/N théoriques au total
                        </span>
                      </div>

                      {/* Interactive checklist of serial numbers for direct value selection */}
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSnFilterTab('ALL')}
                              className={`text-[10px] font-mono px-2 py-1 rounded-[2px] border transition-colors cursor-pointer ${
                                snFilterTab === 'ALL'
                                  ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                                  : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                              }`}
                            >
                              Tous ({expectedSnsForSelectedShelf.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSnFilterTab('UNCOUNTED')}
                              className={`text-[10px] font-mono px-2 py-1 rounded-[2px] border transition-colors cursor-pointer ${
                                snFilterTab === 'UNCOUNTED'
                                  ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                                  : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                              }`}
                            >
                              Non comptés ({expectedSnsForSelectedShelf.length - countedSnsForSelectedShelf.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSnFilterTab('COUNTED')}
                              className={`text-[10px] font-mono px-2 py-1 rounded-[2px] border transition-colors cursor-pointer ${
                                snFilterTab === 'COUNTED'
                                  ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                                  : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                              }`}
                            >
                              Comptés ({countedSnsForSelectedShelf.length})
                            </button>
                          </div>

                          <div className="relative w-full sm:w-44">
                            <Search className="absolute left-2 top-2 w-3 h-3 text-[#aea69c]" />
                            <input
                              type="text"
                              placeholder="Filtrer S/N..."
                              value={snListSearch}
                              onChange={(e) => setSnListSearch(e.target.value)}
                              className="w-full h-7 pl-7 pr-2 text-[11px] bg-[#1f1b18] border border-[#3f3a36] rounded-[2px] text-[#f7f5f0] placeholder:text-[#6a625b] font-mono focus:outline-none focus:border-[#aea69c]"
                            />
                          </div>
                        </div>

                        {/* Serial number clickable chips */}
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2.5 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px]">
                          {filteredChecklistSns.length > 0 ? (
                            filteredChecklistSns.map((sn: any) => {
                              const isCounted = countedSns.some(
                                (c) =>
                                  (sn.serialNumberId && c.serialNumberId === sn.serialNumberId) ||
                                  c.code.toLowerCase() === sn.serialNumberCode?.toLowerCase()
                              );

                              return (
                                <button
                                  key={`sn-check-${sn.serialNumberId || sn.serialNumberCode}`}
                                  type="button"
                                  disabled={!isMultiUserValid}
                                  onClick={() => handleToggleCounted(sn)}
                                  className={`text-[11px] font-mono px-2.5 py-1 rounded-[2px] border transition-all cursor-pointer flex items-center gap-2 ${
                                    isCounted
                                      ? 'bg-[#10b981]/25 border-[#10b981] text-[#f7f5f0] font-medium shadow-xs'
                                      : 'bg-[#2a2522] border-[#3f3a36] text-[#aea69c] hover:border-[#aea69c] hover:text-[#f7f5f0]'
                                  }`}
                                >
                                  <span className={isCounted ? 'text-[#10b981] font-bold' : 'text-[#5c544d]'}>
                                    {isCounted ? '✓' : '○'}
                                  </span>
                                  <span>{sn.serialNumberCode}</span>
                                  {sn.shelfName && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-[#383330] text-[#aea69c]">
                                      {sn.shelfName}
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <div className="w-full py-4 text-center text-xs text-[#aea69c]">
                              Aucun numéro de série ne correspond aux filtres.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Counted Tags Drawer */}
                      {countedSns.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-[#383330]">
                          <div className="flex items-center justify-between text-[11px] text-[#aea69c]">
                            <span className="font-mono uppercase flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                              Valeurs de N° de série saisies ({countedSns.length}) :
                            </span>
                            <span className="text-[10px]">Cliquer sur la croix pour retirer</span>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
                            {countedSns.map((sn) => (
                              <span
                                key={`counted-sn-${sn.code}`}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 ${
                                  sn.isNew
                                    ? 'bg-amber-950/40 border border-amber-600/50 text-amber-200'
                                    : 'bg-[#10b981]/20 border border-[#10b981]/40 text-[#f7f5f0]'
                                }`}
                              >
                                <span>{sn.code}</span>
                                {sn.isNew && (
                                  <span className="text-[9px] text-amber-400 font-sans">(Non répertorié)</span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCounted(sn.code)}
                                  className="text-[#aea69c] hover:text-red-400 cursor-pointer ml-0.5"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes & Observations */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                      NOTES & OBSERVATIONS (OPTIONNEL)
                    </label>
                    <input
                      type="text"
                      disabled={!isMultiUserValid}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ex: Emballage intact, 2 pièces déplacées vers le haut..."
                      className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[3px] px-3 text-xs focus:outline-none focus:border-[#aea69c] transition-colors text-[#f7f5f0] disabled:opacity-50"
                    />
                  </div>

                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar: Actions & Participants */}
          <div className="space-y-4">
            
            {/* Actions Panel */}
            <div className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-4">
              <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">
                Actions
              </h3>
              <button
                type="button"
                disabled={!isMultiUserValid}
                onClick={async () => {
                  try {
                    await submitTask({ taskId, data: buildPayload(true) });
                    toast.success('Brouillon sauvegardé');
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || 'Erreur lors de la sauvegarde');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#383330] hover:bg-[#3f3a36] disabled:opacity-40 disabled:cursor-not-allowed text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-[#aea69c]" />
                Sauvegarder Brouillon
              </button>
              <button
                type="button"
                disabled={!isMultiUserValid}
                onClick={async () => {
                  try {
                    await submitTask({ taskId, data: buildPayload(false) });
                    toast.success('Compte soumis avec succès');
                    router.push('/inventory/tasks');
                  } catch (e: any) {
                    toast.error(e?.response?.data?.message || 'Erreur lors de la soumission');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 bg-[#f7f5f0] hover:bg-[#dad2c1] disabled:opacity-40 disabled:cursor-not-allowed text-[#2b2622] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Soumettre le compte
              </button>
            </div>

            {/* Participants Panel */}
            <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Participants</h3>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  isMultiUserValid
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-red-950 text-red-300 border border-red-800'
                }`}>
                  {uniqueParticipantsCount} / 2 min
                </span>
              </div>
              <div className="space-y-1.5">
                {participants.map((p: any) => (
                  <div key={p.userId} className="flex items-center justify-between text-xs py-1 border-b border-[#383330] last:border-none">
                    <span className="text-[#f7f5f0] truncate max-w-[140px]" title={p.User?.userName || p.User?.userEmail || p.userId}>
                      {p.User?.userName || p.User?.userEmail || p.userId.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-mono text-[#aea69c]">
                      {p.responsibility === 'COUNT' ? 'Compteur' : 'Adjudicateur'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  );
}
