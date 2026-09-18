'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Barcode,
  Layers,
  Search,
  Check,
  X,
  RotateCcw,
  Sparkles,
  MapPin,
  Boxes,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Package,
} from 'lucide-react';
import { useAdjudicationUnit, useAdjudicate } from '@/hooks/use-inventory';
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';

export default function AdjudicatePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const unitId = params?.unitId as string;
  const router = useRouter();

  const { data: unit, isLoading } = useAdjudicationUnit(unitId);
  const { mutateAsync: adjudicate, isPending: isSubmitting } = useAdjudicate();

  // Selection states
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [selectedSnMap, setSelectedSnMap] = useState<
    Map<string, { serialNumberId?: string; code: string; shelfId?: string; shelfName?: string }>
  >(new Map());
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [shelfFilter, setShelfFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'SELECTED' | 'UNSELECTED' | 'AGREEMENT' | 'CONFLICT'
  >('ALL');
  const [scanInput, setScanInput] = useState('');
  const [isReferenceExpanded, setIsReferenceExpanded] = useState(false);

  const equipment = unit?.equipment;
  const hasSerialNumber = equipment?.hasSerialNumber ?? false;

  // Equipment shelves list
  const equipmentShelves = useMemo(() => {
    return equipment?.shelves || [];
  }, [equipment]);

  // All theoretical registered serial numbers for this equipment
  const allEquipmentSns = useMemo(() => {
    return equipment?.serialNumbers || [];
  }, [equipment]);

  // Extract initial 2 conflicting counters (sequence 0)
  const initialAttempts = useMemo(() => {
    return (unit?.attempts || [])
      .filter((a: any) => a.purpose === 'INITIAL' || a.sequence === 0)
      .slice(0, 2);
  }, [unit?.attempts]);

  const counter1 = initialAttempts[0];
  const counter2 = initialAttempts[1];

  // Serial numbers counted by Counter 1
  const c1SnDetails = useMemo(() => {
    if (!counter1?.orders) return { codes: new Set<string>(), count: 0, items: [] as any[] };
    const codes = new Set<string>();
    const items: any[] = [];
    counter1.orders.forEach((o: any) => {
      const code = o.serialNumber?.serialNumberCode || o.unknownItemEvidence;
      if (code) {
        codes.add(code.toLowerCase());
        items.push({
          code,
          serialNumberId: o.serialNumberId,
          shelfId: o.shelfId,
          shelfName: o.shelf?.shelfName,
        });
      }
    });
    return { codes, count: items.length, items };
  }, [counter1]);

  // Serial numbers counted by Counter 2
  const c2SnDetails = useMemo(() => {
    if (!counter2?.orders) return { codes: new Set<string>(), count: 0, items: [] as any[] };
    const codes = new Set<string>();
    const items: any[] = [];
    counter2.orders.forEach((o: any) => {
      const code = o.serialNumber?.serialNumberCode || o.unknownItemEvidence;
      if (code) {
        codes.add(code.toLowerCase());
        items.push({
          code,
          serialNumberId: o.serialNumberId,
          shelfId: o.shelfId,
          shelfName: o.shelf?.shelfName,
        });
      }
    });
    return { codes, count: items.length, items };
  }, [counter2]);

  // Quantities reported by initial counters
  const c1Total = useMemo(() => {
    return (
      counter1?.orders?.reduce(
        (sum: number, o: any) => sum + (o.quantityCalculated ?? 0),
        0
      ) ?? 0
    );
  }, [counter1]);

  const c2Total = useMemo(() => {
    return (
      counter2?.orders?.reduce(
        (sum: number, o: any) => sum + (o.quantityCalculated ?? 0),
        0
      ) ?? 0
    );
  }, [counter2]);

  // Agreement and conflict analysis
  const agreementSns = useMemo(() => {
    return allEquipmentSns.filter((sn: any) => {
      const codeLower = sn.serialNumberCode?.toLowerCase();
      return c1SnDetails.codes.has(codeLower) && c2SnDetails.codes.has(codeLower);
    });
  }, [allEquipmentSns, c1SnDetails, c2SnDetails]);

  const conflictSns = useMemo(() => {
    return allEquipmentSns.filter((sn: any) => {
      const codeLower = sn.serialNumberCode?.toLowerCase();
      const inC1 = c1SnDetails.codes.has(codeLower);
      const inC2 = c2SnDetails.codes.has(codeLower);
      return (inC1 && !inC2) || (!inC1 && inC2);
    });
  }, [allEquipmentSns, c1SnDetails, c2SnDetails]);

  // Set default shelf when unit loads
  useEffect(() => {
    if (!selectedShelfId) {
      if (equipmentShelves.length > 0) {
        setSelectedShelfId(equipmentShelves[0].shelfId);
      } else if (unit?.shelfId) {
        setSelectedShelfId(unit.shelfId);
      } else if (counter1?.orders?.[0]?.shelfId) {
        setSelectedShelfId(counter1.orders[0].shelfId);
      }
    }
  }, [equipmentShelves, unit?.shelfId, counter1, selectedShelfId]);

  // Keep numerical quantity synchronized with selected serial numbers
  useEffect(() => {
    if (hasSerialNumber) {
      setQuantity(selectedSnMap.size);
    }
  }, [hasSerialNumber, selectedSnMap]);

  // Handlers for Serial Number toggles
  const handleToggleSn = (sn: any) => {
    const code = sn.serialNumberCode || sn.code;
    const key = code.toLowerCase();

    setSelectedSnMap((prev) => {
      const next = new Map(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, {
          serialNumberId: sn.serialNumberId,
          code,
          shelfId: sn.shelfId || selectedShelfId,
          shelfName: sn.shelfName,
        });
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Map<string, any>();
    allEquipmentSns.forEach((sn: any) => {
      next.set(sn.serialNumberCode.toLowerCase(), {
        serialNumberId: sn.serialNumberId,
        code: sn.serialNumberCode,
        shelfId: sn.shelfId || selectedShelfId,
        shelfName: sn.shelfName,
      });
    });
    setSelectedSnMap(next);
    toast.success(`Tous les ${allEquipmentSns.length} N° de série ont été retenus`);
  };

  const handleClearAll = () => {
    setSelectedSnMap(new Map());
    toast.info('Sélection réinitialisée');
  };

  const handleAdoptCounter = (counterNum: 1 | 2) => {
    const details = counterNum === 1 ? c1SnDetails : c2SnDetails;
    const targetAttempt = counterNum === 1 ? counter1 : counter2;
    const targetName =
      targetAttempt?.assignedUser?.userName ||
      targetAttempt?.assignedUser?.userEmail ||
      `Compteur ${counterNum}`;

    if (hasSerialNumber) {
      const next = new Map<string, any>();
      // Find matching items from allEquipmentSns or fallback
      allEquipmentSns.forEach((sn: any) => {
        if (details.codes.has(sn.serialNumberCode?.toLowerCase())) {
          next.set(sn.serialNumberCode.toLowerCase(), {
            serialNumberId: sn.serialNumberId,
            code: sn.serialNumberCode,
            shelfId: sn.shelfId || selectedShelfId,
            shelfName: sn.shelfName,
          });
        }
      });
      setSelectedSnMap(next);
      setNotes(`Comptage validé d'après les vérifications du ${targetName}.`);
      toast.success(`Comptage du ${targetName} adopté (${next.size} N° de série)`);
    } else {
      const total = counterNum === 1 ? c1Total : c2Total;
      setQuantity(total);
      setNotes(`Quantité retenue d'après le constat du ${targetName} (${total} pcs).`);
      toast.success(`Quantité (${total} pcs) du ${targetName} adoptée`);
    }

    if (targetAttempt?.orders?.[0]?.shelfId) {
      setSelectedShelfId(targetAttempt.orders[0].shelfId);
    }
  };

  const handleAdoptAgreement = () => {
    const next = new Map<string, any>();
    agreementSns.forEach((sn: any) => {
      next.set(sn.serialNumberCode.toLowerCase(), {
        serialNumberId: sn.serialNumberId,
        code: sn.serialNumberCode,
        shelfId: sn.shelfId || selectedShelfId,
        shelfName: sn.shelfName,
      });
    });
    setSelectedSnMap(next);
    setNotes("Comptage d'accord commun validé (éléments confirmés par les deux compteurs).");
    toast.success(`${next.size} N° de série en accord commun retenus`);
  };

  const handleScanOrAdd = () => {
    const raw = scanInput.trim();
    if (!raw) return;

    const codes = raw.split(/[\r\n,;\s]+/).filter(Boolean);
    let added = 0;

    setSelectedSnMap((prev) => {
      const next = new Map(prev);
      codes.forEach((c) => {
        const key = c.toLowerCase();
        const match = allEquipmentSns.find(
          (s: any) => s.serialNumberCode?.toLowerCase() === key
        );
        next.set(key, {
          serialNumberId: match?.serialNumberId,
          code: match?.serialNumberCode || c,
          shelfId: match?.shelfId || selectedShelfId,
          shelfName: match?.shelfName,
        });
        added++;
      });
      return next;
    });

    setScanInput('');
    if (added > 0) {
      toast.success(`${added} N° de série ajouté(s) à la sélection`);
    }
  };

  // Filtered serial numbers for checklist display
  const filteredChecklistSns = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();

    return allEquipmentSns.filter((sn: any) => {
      const code = sn.serialNumberCode || '';
      const codeLower = code.toLowerCase();

      // Search filter
      if (
        search &&
        !codeLower.includes(search) &&
        !sn.shelfName?.toLowerCase().includes(search)
      ) {
        return false;
      }

      // Shelf filter
      if (shelfFilter !== 'ALL' && sn.shelfId !== shelfFilter) {
        return false;
      }

      const isSelected = selectedSnMap.has(codeLower);
      const inC1 = c1SnDetails.codes.has(codeLower);
      const inC2 = c2SnDetails.codes.has(codeLower);

      if (statusFilter === 'SELECTED') return isSelected;
      if (statusFilter === 'UNSELECTED') return !isSelected;
      if (statusFilter === 'AGREEMENT') return inC1 && inC2;
      if (statusFilter === 'CONFLICT') return (inC1 && !inC2) || (!inC1 && inC2);

      return true;
    });
  }, [
    allEquipmentSns,
    searchQuery,
    shelfFilter,
    statusFilter,
    selectedSnMap,
    c1SnDetails,
    c2SnDetails,
  ]);

  // Submit final adjudication
  const handleValidateAdjudication = async () => {
    if (!notes.trim()) {
      return toast.error('Veuillez renseigner une justification pour clore la divergence.');
    }

    try {
      const selectedSnArray = Array.from(selectedSnMap.values());
      const serialNumberIds = hasSerialNumber
        ? selectedSnArray
            .map((s) => s.serialNumberId)
            .filter((id): id is string => !!id)
        : undefined;

      const observations = hasSerialNumber
        ? selectedSnArray.map((sn) => ({
            serialNumberId: sn.serialNumberId,
            serialNumberCode: sn.code,
            shelfId: sn.shelfId || selectedShelfId || unit?.shelfId,
            quantityCalculated: 1,
            notes: notes.trim(),
          }))
        : undefined;

      await adjudicate({
        inventoryId: unit.inventoryId,
        unitId,
        data: {
          quantity: hasSerialNumber ? selectedSnMap.size : quantity,
          notes: notes.trim(),
          shelfId: selectedShelfId || unit?.shelfId,
          serialNumberIds,
          observations,
        },
      });

      toast.success('Divergence arbitrée avec succès ! Stock final mis à jour.');
      router.push(`/inventory/${unit.inventoryId}/report`);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message || "Erreur lors de la validation de l'arbitrage"
      );
    }
  };

  if (!isLoaded || !isSignedIn || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col items-center justify-center p-6">
        <div className="p-6 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] max-w-md text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-sm font-semibold text-[#f7f5f0]">Unité introuvable</h2>
          <p className="text-xs text-[#aea69c]">
            Cette unité de travail n'existe pas ou a déjà été arbitrée.
          </p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 text-xs bg-[#f7f5f0] text-[#2b2622] font-semibold px-3 py-1.5 rounded-[3px]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour aux inventaires</span>
          </Link>
        </div>
      </div>
    );
  }

  const targetName =
    equipment?.equipmentName || unit?.equipment?.equipmentName || unit?.unitId;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col pb-16">
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link
            href={unit.inventoryId ? `/inventory/${unit.inventoryId}/report` : '/inventory'}
            className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                  Arbitrage & Contrôle Final
                </h1>
                {hasSerialNumber ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-purple-950/60 border border-purple-800/60 text-purple-300 flex items-center gap-1">
                    <Barcode className="w-3 h-3" />
                    N° DE SÉRIE OBLIGATOIRE
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#383330] text-[#aea69c] flex items-center gap-1">
                    <Boxes className="w-3 h-3" />
                    COMPTAGE NUMÉRIQUE
                  </span>
                )}
              </div>
              <p className="text-xs text-[#c9c0ad] mt-0.5">
                Résolution de la divergence sur{' '}
                <span className="font-medium text-[#f7f5f0]">{targetName}</span>
                {equipment?.equipmentCode && (
                  <span className="font-mono text-[#8c827a] ml-1.5">
                    ({equipment.equipmentCode})
                  </span>
                )}
              </p>
            </div>
            <div className="text-[10px] font-mono px-2.5 py-1 bg-red-950/50 border border-red-900/50 text-red-300 rounded-[2px] flex items-center gap-1.5 self-start sm:self-center">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Divergence Séquence 0</span>
            </div>
          </div>
        </div>

        {/* Counters Comparison Cards (Compteur 1 vs Compteur 2) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono tracking-wider text-[#aea69c] uppercase flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-[#10b981]" />
              Rapports des deux compteurs initiaux
            </h2>
            <span className="text-[11px] text-[#8c827a]">
              Écart constaté :{' '}
              <span className="font-mono font-semibold text-amber-400">
                {Math.abs(c1Total - c2Total)} pcs
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Counter 1 Card */}
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/70" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-blue-400 font-semibold uppercase">
                    1er Compteur
                  </span>
                  <h3 className="text-sm font-medium text-[#f7f5f0]">
                    {counter1?.assignedUser?.userName ||
                      counter1?.assignedUser?.userEmail ||
                      'Compteur 1'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdoptCounter(1)}
                  className="text-[10px] font-mono px-2 py-1 bg-blue-950/50 border border-blue-800/60 hover:bg-blue-900/50 text-blue-300 rounded-[2px] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Retenir tous les éléments trouvés par ce compteur"
                >
                  <UserCheck className="w-3 h-3" />
                  Adopter ce comptage
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">QUANTITÉ CONSTATÉE</p>
                  <p className="text-lg font-semibold text-[#f7f5f0]">{c1Total} pcs</p>
                </div>
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">N° DE SÉRIE SCANNÉS</p>
                  <p className="text-lg font-semibold text-blue-400">
                    {hasSerialNumber ? `${c1SnDetails.count} S/N` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono text-[#8c827a] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#aea69c]" />
                  <span>
                    {counter1?.orders?.[0]?.shelf?.shelfName ||
                      unit.shelf?.shelfName ||
                      'Étagère non définie'}
                  </span>
                </p>
                <p className="text-xs text-[#c9c0ad] italic bg-[#26221f]/50 p-2 rounded-[2px] border border-[#383330]/50">
                  "{counter1?.orders?.[0]?.notes || 'Aucune observation saisie'}"
                </p>
              </div>
            </div>

            {/* Counter 2 Card */}
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-3 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500/70" />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 font-semibold uppercase">
                    2ème Compteur
                  </span>
                  <h3 className="text-sm font-medium text-[#f7f5f0]">
                    {counter2?.assignedUser?.userName ||
                      counter2?.assignedUser?.userEmail ||
                      'Compteur 2'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdoptCounter(2)}
                  className="text-[10px] font-mono px-2 py-1 bg-amber-950/50 border border-amber-800/60 hover:bg-amber-900/50 text-amber-300 rounded-[2px] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Retenir tous les éléments trouvés par ce compteur"
                >
                  <UserCheck className="w-3 h-3" />
                  Adopter ce comptage
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">QUANTITÉ CONSTATÉE</p>
                  <p className="text-lg font-semibold text-[#f7f5f0]">{c2Total} pcs</p>
                </div>
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">N° DE SÉRIE SCANNÉS</p>
                  <p className="text-lg font-semibold text-amber-400">
                    {hasSerialNumber ? `${c2SnDetails.count} S/N` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] font-mono text-[#8c827a] flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#aea69c]" />
                  <span>
                    {counter2?.orders?.[0]?.shelf?.shelfName ||
                      unit.shelf?.shelfName ||
                      'Étagère non définie'}
                  </span>
                </p>
                <p className="text-xs text-[#c9c0ad] italic bg-[#26221f]/50 p-2 rounded-[2px] border border-[#383330]/50">
                  "{counter2?.orders?.[0]?.notes || 'Aucune observation saisie'}"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SERIAL NUMBERS ADJUDICATION SECTION */}
        {hasSerialNumber ? (
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            {/* Header with counts and diagnostic stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#383330]">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Barcode className="w-4 h-4 text-[#10b981]" />
                  <h2 className="text-sm font-semibold text-[#f7f5f0]">
                    Tous les N° de série répertoriés ({allEquipmentSns.length})
                  </h2>
                </div>
                <p className="text-xs text-[#aea69c]">
                  Cochez les numéros de série physiquement confirmés. Chaque coche ajoute 1
                  pièce au stock final.
                </p>
              </div>

              {/* Real-time selection badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <div className="px-3 py-1.5 rounded-[3px] bg-[#10b981]/15 border border-[#10b981]/40 flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#10b981] uppercase font-bold">
                    Quantité Retenue :
                  </span>
                  <span className="text-base font-mono font-bold text-[#10b981]">
                    {selectedSnMap.size} pcs
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Diagnostic Insights */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-[#26221f] border border-[#383330] rounded-[2px] space-y-0.5">
                <span className="text-[9px] font-mono text-[#8c827a] uppercase">Total Référencé</span>
                <p className="text-sm font-semibold text-[#f7f5f0]">
                  {allEquipmentSns.length} S/N
                </p>
              </div>
              <div className="p-2.5 bg-[#26221f] border border-emerald-900/40 rounded-[2px] space-y-0.5">
                <span className="text-[9px] font-mono text-emerald-400 uppercase">
                  Accord C1 + C2
                </span>
                <p className="text-sm font-semibold text-emerald-300">
                  {agreementSns.length} S/N
                </p>
              </div>
              <div className="p-2.5 bg-[#26221f] border border-amber-900/40 rounded-[2px] space-y-0.5">
                <span className="text-[9px] font-mono text-amber-400 uppercase">En Désaccord</span>
                <p className="text-sm font-semibold text-amber-300">
                  {conflictSns.length} S/N
                </p>
              </div>
              <div className="p-2.5 bg-[#26221f] border border-[#383330] rounded-[2px] space-y-0.5">
                <span className="text-[9px] font-mono text-[#aea69c] uppercase">Actuellement Retenus</span>
                <p className="text-sm font-semibold text-[#10b981]">
                  {selectedSnMap.size} S/N
                </p>
              </div>
            </div>

            {/* Fast Barcode Scanner / Manual Entry */}
            <div className="bg-[#26221f] p-3 rounded-[3px] border border-[#383330] space-y-2">
              <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1.5">
                <Barcode className="w-3.5 h-3.5 text-[#10b981]" />
                <span>Scanner / Saisie directe de N° de série</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScanOrAdd();
                    }
                  }}
                  placeholder="Scannez ou collez un ou plusieurs codes (ex: SN-...)"
                  className="flex-1 h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[2px] px-3 text-xs font-mono text-[#f7f5f0] focus:outline-none focus:border-[#10b981]"
                />
                <button
                  type="button"
                  onClick={handleScanOrAdd}
                  className="px-3 h-9 bg-[#383330] hover:bg-[#453f3a] text-xs text-[#f7f5f0] font-medium rounded-[2px] border border-[#3f3a36] transition-colors cursor-pointer"
                >
                  Ajouter
                </button>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-mono text-[#8c827a] mr-1 uppercase">Actions rapides :</span>
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] bg-[#383330] hover:bg-[#423c37] text-[#f7f5f0] border border-[#3f3a36] rounded-[2px] transition-colors cursor-pointer"
              >
                Tout cocher ({allEquipmentSns.length})
              </button>
              <button
                type="button"
                onClick={() => handleAdoptCounter(1)}
                className="px-2.5 py-1 text-[11px] bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-800/50 rounded-[2px] transition-colors cursor-pointer"
              >
                Retenir Compteur 1 ({c1SnDetails.count})
              </button>
              <button
                type="button"
                onClick={() => handleAdoptCounter(2)}
                className="px-2.5 py-1 text-[11px] bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 rounded-[2px] transition-colors cursor-pointer"
              >
                Retenir Compteur 2 ({c2SnDetails.count})
              </button>
              {agreementSns.length > 0 && (
                <button
                  type="button"
                  onClick={handleAdoptAgreement}
                  className="px-2.5 py-1 text-[11px] bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50 rounded-[2px] transition-colors cursor-pointer"
                >
                  Accord commun uniquement ({agreementSns.length})
                </button>
              )}
              {selectedSnMap.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="px-2.5 py-1 text-[11px] bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/50 rounded-[2px] transition-colors cursor-pointer ml-auto"
                >
                  Tout désélectionner
                </button>
              )}
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2">
              <div className="flex flex-wrap items-center gap-1 bg-[#26221f] p-1 rounded-[3px] border border-[#383330]">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                    statusFilter === 'ALL'
                      ? 'bg-[#383330] text-[#f7f5f0] font-semibold'
                      : 'text-[#8c827a] hover:text-[#aea69c]'
                  }`}
                >
                  Tous ({allEquipmentSns.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SELECTED')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                    statusFilter === 'SELECTED'
                      ? 'bg-[#10b981] text-[#1f1b18] font-bold'
                      : 'text-[#8c827a] hover:text-[#aea69c]'
                  }`}
                >
                  Retenus ({selectedSnMap.size})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('UNSELECTED')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                    statusFilter === 'UNSELECTED'
                      ? 'bg-[#383330] text-[#f7f5f0] font-semibold'
                      : 'text-[#8c827a] hover:text-[#aea69c]'
                  }`}
                >
                  Non retenus ({allEquipmentSns.length - selectedSnMap.size})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('CONFLICT')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors ${
                    statusFilter === 'CONFLICT'
                      ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                      : 'text-amber-400/70 hover:text-amber-300'
                  }`}
                >
                  Désaccord ({conflictSns.length})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {equipmentShelves.length > 1 && (
                  <select
                    value={shelfFilter}
                    onChange={(e) => setShelfFilter(e.target.value)}
                    className="h-8 bg-[#26221f] border border-[#383330] rounded-[2px] px-2 text-xs text-[#aea69c] focus:outline-none"
                  >
                    <option value="ALL">Toutes les étagères</option>
                    {equipmentShelves.map((s: any) => (
                      <option key={s.shelfId} value={s.shelfId}>
                        {s.shelfName} ({s.quantity} pcs)
                      </option>
                    ))}
                  </select>
                )}
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8c827a]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer N° de série..."
                    className="w-full h-8 pl-8 pr-3 bg-[#26221f] border border-[#383330] rounded-[2px] text-xs text-[#f7f5f0] focus:outline-none focus:border-[#10b981]"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8c827a] hover:text-[#f7f5f0]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="border border-[#383330] rounded-[3px] bg-[#26221f] max-h-96 overflow-y-auto p-2">
              {filteredChecklistSns.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#8c827a] space-y-1">
                  <p>Aucun numéro de série ne correspond aux filtres actuels.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShelfFilter('ALL');
                      setStatusFilter('ALL');
                    }}
                    className="text-xs text-[#10b981] hover:underline"
                  >
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {filteredChecklistSns.map((sn: any) => {
                    const code = sn.serialNumberCode;
                    const codeLower = code.toLowerCase();
                    const isSelected = selectedSnMap.has(codeLower);
                    const inC1 = c1SnDetails.codes.has(codeLower);
                    const inC2 = c2SnDetails.codes.has(codeLower);

                    return (
                      <div
                        key={sn.serialNumberId || code}
                        onClick={() => handleToggleSn(sn)}
                        className={`p-2.5 rounded-[3px] border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-[#10b981]/10 border-[#10b981]/60 text-[#f7f5f0]'
                            : 'bg-[#2b2622] border-[#383330] hover:border-[#453f3a] text-[#c9c0ad]'
                        }`}
                      >
                        {/* Custom Checkbox */}
                        <div
                          className={`w-4 h-4 mt-0.5 rounded-[2px] border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[#10b981] border-[#10b981] text-[#1f1b18]'
                              : 'border-[#453f3a] bg-[#26221f]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-xs font-medium text-[#f7f5f0] truncate">
                              {code}
                            </span>
                            {sn.shelfName && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#383330] text-[#8c827a] shrink-0">
                                {sn.shelfName}
                              </span>
                            )}
                          </div>

                          {/* Badge showing who saw this serial number */}
                          <div className="flex items-center gap-1 text-[9px] font-mono">
                            {inC1 && inC2 ? (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Accord C1+C2
                              </span>
                            ) : inC1 ? (
                              <span className="px-1.5 py-0.2 rounded bg-blue-950/60 border border-blue-800/60 text-blue-300">
                                Vu par Compteur 1
                              </span>
                            ) : inC2 ? (
                              <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300">
                                Vu par Compteur 2
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-[#383330] text-[#8c827a]">
                                Non observé en S0
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : (
          /* NON-SERIALIZED EQUIPMENT SECTION */
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <div className="space-y-1 pb-3 border-b border-[#383330]">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Boxes className="w-4 h-4 text-[#10b981]" />
                Comptage par Quantité Numérique
              </h2>
              <p className="text-xs text-[#aea69c]">
                Cet équipement ne comporte pas de numéro de série. Ajustez directement la quantité retenue.
              </p>
            </div>

            {equipmentShelves.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-[#aea69c] uppercase">
                  Étagères et stock théorique :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {equipmentShelves.map((sh: any) => (
                    <div
                      key={sh.shelfId}
                      className="p-3 bg-[#26221f] border border-[#383330] rounded-[2px] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#10b981]" />
                        <span className="text-xs text-[#f7f5f0]">{sh.shelfName}</span>
                      </div>
                      <span className="text-xs font-mono text-[#aea69c]">
                        Théorique : {sh.quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* FINAL DECISION & VALIDATION SECTION */}
        <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2b2622]">
          <div className="space-y-1">
            <h2 className="text-sm font-medium flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#10b981]" />
              Décision finale d'arbitrage
            </h2>
            <p className="text-xs text-[#c9c0ad]">
              En validant, vous fixez la valeur définitive du stock pour cette unité.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Shelf Selection */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                Étagère d'affectation
              </label>
              <select
                value={selectedShelfId}
                onChange={(e) => setSelectedShelfId(e.target.value)}
                className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-3 text-xs text-[#f7f5f0] focus:outline-none"
              >
                {equipmentShelves.map((s: any) => (
                  <option key={s.shelfId} value={s.shelfId}>
                    {s.shelfName}
                  </option>
                ))}
                {equipmentShelves.length === 0 && (
                  <option value={unit.shelfId || ''}>
                    {unit.shelf?.shelfName || 'Étagère par défaut'}
                  </option>
                )}
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                  Quantité Retenue
                </label>
                {hasSerialNumber && (
                  <span className="text-[9px] font-mono text-[#10b981]">
                    Synchronisé avec les S/N
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                disabled={hasSerialNumber}
                className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-3 text-sm font-mono font-medium focus:outline-none text-[#f7f5f0] disabled:opacity-80 disabled:cursor-not-allowed"
              />
            </div>

            {/* Obligatory Justification */}
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                Justification (Obligatoire)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Vérification physique sur site effectuée..."
                className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-3 text-xs focus:outline-none text-[#f7f5f0]"
              />
            </div>
          </div>

          {/* Quick Justification Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono text-[#8c827a] mr-1 uppercase">
              Modèles de justification :
            </span>
            {[
              'Vérification physique approfondie sur site effectuée.',
              'Comptage direct en rayon validé par le 3ème contrôleur.',
              'Erreur de saisie initiale corrigée après recomptage.',
              "Adoption de l'accord commun des deux compteurs.",
            ].map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setNotes(tmpl)}
                className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#26221f] hover:bg-[#383330] border border-[#383330] text-[#aea69c] transition-colors cursor-pointer"
              >
                {tmpl.slice(0, 30)}...
              </button>
            ))}
          </div>

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-3 border-t border-[#3f3a36]">
            <span className="text-xs text-[#aea69c]">
              Total final à inscrire au stock :{' '}
              <span className="font-mono font-bold text-[#10b981] text-sm">
                {quantity} pièce(s)
              </span>
            </span>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleValidateAdjudication}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validation en cours...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Valider l'adjudication définitive</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
