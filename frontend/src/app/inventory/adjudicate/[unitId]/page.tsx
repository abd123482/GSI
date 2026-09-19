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
  UserCheck,
  Package,
  Plus,
  Trash2,
  Camera,
  QrCode,
  Info,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { useAdjudicationUnit, useAdjudicate } from '@/hooks/use-inventory';
import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Sound effect feedback helper
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext blocked
  }
}

export default function AdjudicatePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const unitId = params?.unitId as string;
  const router = useRouter();

  const { data: unit, isLoading } = useAdjudicationUnit(unitId);
  const { mutateAsync: adjudicate, isPending: isSubmitting } = useAdjudicate();

  // Mode detection
  const isByShelf =
    unit?.inventory?.typeInventory === 'ByShelf' ||
    (!!unit?.shelfId && !unit?.equipmentId);
  const isByEquipment = !isByShelf;

  const equipment = unit?.equipment;
  const shelf = unit?.shelf;
  const allCatalogEquipments = unit?.allEquipments || [];

  // General state
  const [notes, setNotes] = useState('');

  // --------------------------------------------------------------------------
  // BY-SHELF STATE & DATA
  // --------------------------------------------------------------------------
  // Added extra articles to this shelf by arbitrator
  const [addedShelfEquipments, setAddedShelfEquipments] = useState<any[]>([]);
  // Recount non-serialized counts per equipment: { [equipmentId: string]: number }
  const [shelfArticleCounts, setShelfArticleCounts] = useState<{ [equipmentId: string]: number }>({});
  // Recount serialized counts per equipment: { [equipmentId: string]: Array<{ serialNumberId?: string; code: string; isNew?: boolean }> }
  const [shelfArticleSns, setShelfArticleSns] = useState<{
    [equipmentId: string]: Array<{ serialNumberId?: string; code: string; isNew?: boolean }>;
  }>({});
  // Per-article scan text input
  const [shelfScanInputs, setShelfScanInputs] = useState<{ [equipmentId: string]: string }>({});
  // Filter search for articles in shelf
  const [shelfArticleSearch, setShelfArticleSearch] = useState('');
  // Add article modal state
  const [isAddArticleModalOpen, setIsAddArticleModalOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // --------------------------------------------------------------------------
  // BY-EQUIPMENT STATE & DATA
  // --------------------------------------------------------------------------
  const hasEquipmentSerialNumber = equipment?.hasSerialNumber ?? false;
  const equipmentShelves = useMemo(() => equipment?.shelves || [], [equipment]);
  const allEquipmentSns = useMemo(() => equipment?.serialNumbers || [], [equipment]);

  const [selectedSnMap, setSelectedSnMap] = useState<
    Map<string, { serialNumberId?: string; code: string; shelfId?: string; shelfName?: string }>
  >(new Map());
  const [nonSnShelfCounts, setNonSnShelfCounts] = useState<{ [shelfId: string]: number }>({});
  const [singleQuantity, setSingleQuantity] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [shelfFilter, setShelfFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'SELECTED' | 'UNSELECTED' | 'AGREEMENT' | 'CONFLICT'
  >('ALL');
  const [scanInput, setScanInput] = useState('');

  // --------------------------------------------------------------------------
  // CAMERA SCANNER STATE
  // --------------------------------------------------------------------------
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [cameraTargetEquipmentId, setCameraTargetEquipmentId] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // --------------------------------------------------------------------------
  // INITIAL COUNTERS (SEQUENCE 0)
  // --------------------------------------------------------------------------
  const initialAttempts = useMemo(() => {
    return (unit?.attempts || [])
      .filter((a: any) => a.purpose === 'INITIAL' || a.sequence === 0)
      .slice(0, 2);
  }, [unit?.attempts]);

  const counter1 = initialAttempts[0];
  const counter2 = initialAttempts[1];

  const c1Total = useMemo(() => {
    return counter1?.orders?.reduce((sum: number, o: any) => sum + (o.quantityCalculated ?? 0), 0) ?? 0;
  }, [counter1]);

  const c2Total = useMemo(() => {
    return counter2?.orders?.reduce((sum: number, o: any) => sum + (o.quantityCalculated ?? 0), 0) ?? 0;
  }, [counter2]);

  // Breakdown of Counter 1 and Counter 2 per article for ByShelf
  const c1ArticleBreakdown = useMemo(() => {
    const map: { [eqId: string]: { quantity: number; snCodes: Set<string>; notes?: string } } = {};
    (counter1?.orders || []).forEach((o: any) => {
      const eqId = o.equipmentId || o.equipment?.equipmentId || 'unknown';
      if (!map[eqId]) map[eqId] = { quantity: 0, snCodes: new Set() };
      map[eqId].quantity += o.quantityCalculated ?? 1;
      const code = o.serialNumber?.serialNumberCode || o.unknownItemEvidence;
      if (code) map[eqId].snCodes.add(code.toLowerCase());
      if (o.notes) map[eqId].notes = o.notes;
    });
    return map;
  }, [counter1]);

  const c2ArticleBreakdown = useMemo(() => {
    const map: { [eqId: string]: { quantity: number; snCodes: Set<string>; notes?: string } } = {};
    (counter2?.orders || []).forEach((o: any) => {
      const eqId = o.equipmentId || o.equipment?.equipmentId || 'unknown';
      if (!map[eqId]) map[eqId] = { quantity: 0, snCodes: new Set() };
      map[eqId].quantity += o.quantityCalculated ?? 1;
      const code = o.serialNumber?.serialNumberCode || o.unknownItemEvidence;
      if (code) map[eqId].snCodes.add(code.toLowerCase());
      if (o.notes) map[eqId].notes = o.notes;
    });
    return map;
  }, [counter2]);

  // Serial numbers counted by C1 / C2 for ByEquipment
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

  // Counter breakdowns per shelf for ByEquipment
  const c1ShelfCounts = useMemo(() => {
    if (!counter1?.orders) return {};
    const map: { [shelfId: string]: number } = {};
    counter1.orders.forEach((o: any) => {
      const shId = o.shelfId || 'default';
      map[shId] = (map[shId] || 0) + (o.quantityCalculated ?? 1);
    });
    return map;
  }, [counter1]);

  const c2ShelfCounts = useMemo(() => {
    if (!counter2?.orders) return {};
    const map: { [shelfId: string]: number } = {};
    counter2.orders.forEach((o: any) => {
      const shId = o.shelfId || 'default';
      map[shId] = (map[shId] || 0) + (o.quantityCalculated ?? 1);
    });
    return map;
  }, [counter2]);

  // Combined list of equipments on shelf (original + added)
  const allShelfEquipments = useMemo(() => {
    const orig = shelf?.equipments || [];
    const addedFiltered = addedShelfEquipments.filter(
      (ae) => !orig.some((oe: any) => oe.equipmentId === ae.equipmentId)
    );
    return [...orig, ...addedFiltered];
  }, [shelf?.equipments, addedShelfEquipments]);

  // Filtered shelf equipments for ByShelf view
  const filteredShelfEquipments = useMemo(() => {
    if (!shelfArticleSearch.trim()) return allShelfEquipments;
    const q = shelfArticleSearch.trim().toLowerCase();
    return allShelfEquipments.filter(
      (eq) =>
        eq.equipmentName.toLowerCase().includes(q) ||
        (eq.equipmentId && eq.equipmentId.toLowerCase().includes(q))
    );
  }, [allShelfEquipments, shelfArticleSearch]);

  // Total theoretical units on this shelf
  const totalTheoreticalUnits = useMemo(() => {
    if (!shelf?.equipments) return 0;
    return shelf.equipments.reduce((sum: number, eq: any) => sum + (Number(eq.theoreticalQuantity) || 0), 0);
  }, [shelf?.equipments]);

  // Agreement and conflict for ByEquipment
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

  const isAlreadyResolved =
    unit?.status === 'RESOLVED' || unit?.discrepancyState === 'RESOLVED';

  const resolvedInfo = useMemo(() => {
    if (!unit?.discrepancyAfterData) return null;
    try {
      return typeof unit.discrepancyAfterData === 'string'
        ? JSON.parse(unit.discrepancyAfterData)
        : unit.discrepancyAfterData;
    } catch {
      return null;
    }
  }, [unit?.discrepancyAfterData]);

  // --------------------------------------------------------------------------
  // INITIALIZE / RESTORE RECOUNT STATE
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!unit) return;

    // Check if there is an existing adjudication attempt
    const adjAttempt = unit.attempts?.find(
      (a: any) => a.purpose === 'ADJUDICATION_FINAL' || (a.sequence > 0 && a.status === 'SUBMITTED')
    );

    if (adjAttempt && adjAttempt.orders?.length > 0) {
      if (isByShelf) {
        const counts: { [eqId: string]: number } = {};
        const snMap: { [eqId: string]: any[] } = {};

        adjAttempt.orders.forEach((o: any) => {
          const eqId = o.equipmentId;
          if (!eqId) return;
          if (o.serialNumberId || o.serialNumber?.serialNumberCode) {
            if (!snMap[eqId]) snMap[eqId] = [];
            const code = o.serialNumber?.serialNumberCode || o.unknownItemEvidence || 'SN';
            snMap[eqId].push({ serialNumberId: o.serialNumberId, code });
          } else {
            counts[eqId] = (counts[eqId] || 0) + (o.quantityCalculated ?? 0);
          }
        });

        setShelfArticleCounts(counts);
        setShelfArticleSns(snMap);
      } else {
        // ByEquipment
        if (hasEquipmentSerialNumber) {
          const next = new Map<string, any>();
          adjAttempt.orders.forEach((o: any) => {
            const code =
              o.serialNumber?.serialNumberCode ||
              o.unknownItemEvidence ||
              allEquipmentSns.find((s: any) => s.serialNumberId === o.serialNumberId)?.serialNumberCode;
            if (code) {
              next.set(code.toLowerCase(), {
                serialNumberId: o.serialNumberId,
                code,
                shelfId: o.shelfId,
                shelfName: o.shelf?.shelfName,
              });
            }
          });
          setSelectedSnMap(next);
        } else {
          const counts: { [shelfId: string]: number } = {};
          adjAttempt.orders.forEach((o: any) => {
            if (o.shelfId) counts[o.shelfId] = o.quantityCalculated ?? 0;
          });
          setNonSnShelfCounts(counts);
          if (adjAttempt.orders[0]?.quantityCalculated !== undefined) {
            setSingleQuantity(adjAttempt.orders[0].quantityCalculated);
          }
        }
      }

      if (adjAttempt.orders[0]?.notes) {
        setNotes(adjAttempt.orders[0].notes);
      } else if (resolvedInfo?.notes) {
        setNotes(resolvedInfo.notes);
      }
    } else {
      // Default initial states: start with 0 counts to encourage true recount
      if (isByShelf && allShelfEquipments.length > 0) {
        // Initial state is 0 for clean recount
        const initialCounts: { [eqId: string]: number } = {};
        allShelfEquipments.forEach((eq) => {
          if (!eq.hasSerialNumber) {
            initialCounts[eq.equipmentId] = 0;
          }
        });
        setShelfArticleCounts(initialCounts);
      }
    }
  }, [unit, isByShelf, allShelfEquipments.length, hasEquipmentSerialNumber, allEquipmentSns, resolvedInfo]);

  // --------------------------------------------------------------------------
  // TOTAL RECOUNT QUANTITY CALCULATION
  // --------------------------------------------------------------------------
  const totalFinalQuantity = useMemo(() => {
    if (isByShelf) {
      let sum = 0;
      allShelfEquipments.forEach((eq) => {
        if (eq.hasSerialNumber) {
          sum += (shelfArticleSns[eq.equipmentId] || []).length;
        } else {
          sum += Number(shelfArticleCounts[eq.equipmentId] || 0);
        }
      });
      return sum;
    } else {
      if (hasEquipmentSerialNumber) {
        return selectedSnMap.size;
      }
      if (equipmentShelves.length > 0) {
        return Object.values(nonSnShelfCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
      }
      return singleQuantity;
    }
  }, [
    isByShelf,
    allShelfEquipments,
    shelfArticleCounts,
    shelfArticleSns,
    hasEquipmentSerialNumber,
    selectedSnMap,
    equipmentShelves,
    nonSnShelfCounts,
    singleQuantity,
  ]);

  // --------------------------------------------------------------------------
  // CAMERA SCANNER HANDLER
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isCameraScannerOpen || !videoRef.current) return;

    const reader = new BrowserMultiFormatReader();
    codeReaderRef.current = reader;
    setIsCameraActive(true);

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          const scannedCode = result.getText().trim();
          if (scannedCode) {
            playBeep();
            if (isByShelf && cameraTargetEquipmentId) {
              handleAppendScannedSnToShelfArticle(cameraTargetEquipmentId, scannedCode);
            } else if (isByEquipment) {
              handleAppendScannedSnToEquipment(scannedCode);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Camera scanner error:', err);
        toast.error("Impossible d'accéder à la caméra. Vérifiez les autorisations.");
        setIsCameraActive(false);
      });

    return () => {
      try {
        (reader as any).reset?.();
      } catch {}
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    };
  }, [isCameraScannerOpen, cameraTargetEquipmentId]);

  const handleOpenScanner = (equipmentId?: string) => {
    setCameraTargetEquipmentId(equipmentId || null);
    setIsCameraScannerOpen(true);
  };

  const handleCloseScanner = () => {
    if (codeReaderRef.current) {
      try {
        (codeReaderRef.current as any).reset?.();
      } catch {}
      codeReaderRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraScannerOpen(false);
    setCameraTargetEquipmentId(null);
  };

  // --------------------------------------------------------------------------
  // RECOUNT RESET / REFRESH ACTIONS ("خلي المسؤول الاخير يعاود يحسب كلش قاع")
  // --------------------------------------------------------------------------
  const handleResetAllToZero = () => {
    if (isByShelf) {
      const resetCounts: { [eqId: string]: number } = {};
      allShelfEquipments.forEach((eq) => {
        resetCounts[eq.equipmentId] = 0;
      });
      setShelfArticleCounts(resetCounts);
      setShelfArticleSns({});
    } else {
      setSelectedSnMap(new Map());
      const resetShelfCounts: { [shelfId: string]: number } = {};
      equipmentShelves.forEach((sh: any) => {
        resetShelfCounts[sh.shelfId] = 0;
      });
      setNonSnShelfCounts(resetShelfCounts);
      setSingleQuantity(0);
    }
    setNotes('Recomptage physique intégral à zéro effectué par le responsable final.');
    toast.success('Recomptage remis à zéro ! Vous pouvez recompter chaque élément sur le terrain.');
  };

  const handleLoadTheoreticalAll = () => {
    if (isByShelf) {
      const theoCounts: { [eqId: string]: number } = {};
      const theoSns: { [eqId: string]: any[] } = {};

      allShelfEquipments.forEach((eq) => {
        if (eq.hasSerialNumber) {
          theoSns[eq.equipmentId] = (eq.serialNumbers || []).map((sn: any) => ({
            serialNumberId: sn.serialNumberId,
            code: sn.serialNumberCode,
          }));
        } else {
          theoCounts[eq.equipmentId] = Number(eq.theoreticalQuantity) || 0;
        }
      });
      setShelfArticleCounts(theoCounts);
      setShelfArticleSns(theoSns);
      toast.success('Quantités théoriques chargées dans le recomptage.');
    } else {
      if (hasEquipmentSerialNumber) {
        const next = new Map<string, any>();
        allEquipmentSns.forEach((sn: any) => {
          next.set(sn.serialNumberCode.toLowerCase(), {
            serialNumberId: sn.serialNumberId,
            code: sn.serialNumberCode,
            shelfId: sn.shelfId,
            shelfName: sn.shelfName,
          });
        });
        setSelectedSnMap(next);
      } else {
        const counts: { [shelfId: string]: number } = {};
        equipmentShelves.forEach((sh: any) => {
          counts[sh.shelfId] = Number(sh.quantity) || 0;
        });
        setNonSnShelfCounts(counts);
        setSingleQuantity(totalTheoreticalUnits);
      }
      toast.success('Stock théorique chargé comme base de recomptage.');
    }
  };

  const handleAdoptCounterAll = (counterNum: 1 | 2) => {
    const targetAttempt = counterNum === 1 ? counter1 : counter2;
    const targetName =
      targetAttempt?.assignedUser?.userName ||
      targetAttempt?.assignedUser?.userEmail ||
      `Compteur ${counterNum}`;

    if (isByShelf) {
      const breakdown = counterNum === 1 ? c1ArticleBreakdown : c2ArticleBreakdown;
      const nextCounts: { [eqId: string]: number } = {};
      const nextSns: { [eqId: string]: any[] } = {};

      allShelfEquipments.forEach((eq) => {
        const cData = breakdown[eq.equipmentId];
        if (eq.hasSerialNumber) {
          if (cData?.snCodes) {
            const list: any[] = [];
            cData.snCodes.forEach((codeLower) => {
              const registered = eq.serialNumbers?.find(
                (s: any) => s.serialNumberCode?.toLowerCase() === codeLower
              );
              list.push({
                serialNumberId: registered?.serialNumberId,
                code: registered?.serialNumberCode || codeLower,
              });
            });
            nextSns[eq.equipmentId] = list;
          } else {
            nextSns[eq.equipmentId] = [];
          }
        } else {
          nextCounts[eq.equipmentId] = cData?.quantity ?? 0;
        }
      });

      setShelfArticleCounts(nextCounts);
      setShelfArticleSns(nextSns);
      setNotes(`Comptage du ${targetName} vérifié et retenu après analyse.`);
      toast.success(`Données du ${targetName} appliquées (${counterNum === 1 ? c1Total : c2Total} pcs).`);
    } else {
      // ByEquipment
      if (hasEquipmentSerialNumber) {
        const details = counterNum === 1 ? c1SnDetails : c2SnDetails;
        const next = new Map<string, any>();
        allEquipmentSns.forEach((sn: any) => {
          if (details.codes.has(sn.serialNumberCode?.toLowerCase())) {
            next.set(sn.serialNumberCode.toLowerCase(), {
              serialNumberId: sn.serialNumberId,
              code: sn.serialNumberCode,
              shelfId: sn.shelfId,
              shelfName: sn.shelfName,
            });
          }
        });
        setSelectedSnMap(next);
      } else {
        const shelfCounts = counterNum === 1 ? c1ShelfCounts : c2ShelfCounts;
        const nextShelfCounts: { [shelfId: string]: number } = {};
        equipmentShelves.forEach((sh: any) => {
          nextShelfCounts[sh.shelfId] = shelfCounts[sh.shelfId] ?? 0;
        });
        setNonSnShelfCounts(nextShelfCounts);
        setSingleQuantity(counterNum === 1 ? c1Total : c2Total);
      }
      setNotes(`Comptage validé d'après les constatations du ${targetName}.`);
      toast.success(`Comptage du ${targetName} adopté (${counterNum === 1 ? c1Total : c2Total} pcs).`);
    }
  };

  // --------------------------------------------------------------------------
  // BY-SHELF ARTICLE SPECIFIC HANDLERS
  // --------------------------------------------------------------------------
  const handleUpdateArticleCount = (equipmentId: string, value: number) => {
    setShelfArticleCounts((prev) => ({
      ...prev,
      [equipmentId]: Math.max(0, value),
    }));
  };

  const handleToggleArticleSn = (equipmentId: string, sn: any) => {
    const code = sn.serialNumberCode || sn.code;
    const key = code.toLowerCase();

    setShelfArticleSns((prev) => {
      const current = prev[equipmentId] || [];
      const exists = current.some((s) => s.code.toLowerCase() === key);
      let updated;
      if (exists) {
        updated = current.filter((s) => s.code.toLowerCase() !== key);
      } else {
        updated = [
          ...current,
          {
            serialNumberId: sn.serialNumberId,
            code,
          },
        ];
      }
      return {
        ...prev,
        [equipmentId]: updated,
      };
    });
  };

  const handleAppendScannedSnToShelfArticle = (equipmentId: string, code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    const key = cleanCode.toLowerCase();

    setShelfArticleSns((prev) => {
      const current = prev[equipmentId] || [];
      if (current.some((s) => s.code.toLowerCase() === key)) {
        toast.info(`N° de série "${cleanCode}" déjà présent.`);
        return prev;
      }
      // Check if registered
      const targetEq = allShelfEquipments.find((e) => e.equipmentId === equipmentId);
      const matched = targetEq?.serialNumbers?.find(
        (s: any) => s.serialNumberCode?.toLowerCase() === key
      );

      toast.success(`N° de série "${cleanCode}" ajouté.`);
      return {
        ...prev,
        [equipmentId]: [
          ...current,
          {
            serialNumberId: matched?.serialNumberId,
            code: matched?.serialNumberCode || cleanCode,
            isNew: !matched,
          },
        ],
      };
    });
  };

  const handleRemoveArticleSn = (equipmentId: string, code: string) => {
    setShelfArticleSns((prev) => ({
      ...prev,
      [equipmentId]: (prev[equipmentId] || []).filter(
        (s) => s.code.toLowerCase() !== code.toLowerCase()
      ),
    }));
  };

  const handleCheckAllArticleSns = (eq: any) => {
    const allSns = (eq.serialNumbers || []).map((s: any) => ({
      serialNumberId: s.serialNumberId,
      code: s.serialNumberCode,
    }));
    setShelfArticleSns((prev) => ({
      ...prev,
      [eq.equipmentId]: allSns,
    }));
    toast.success(`Tous les ${allSns.length} numéros de série cochés pour ${eq.equipmentName}`);
  };

  const handleUncheckAllArticleSns = (equipmentId: string) => {
    setShelfArticleSns((prev) => ({
      ...prev,
      [equipmentId]: [],
    }));
  };

  // ByEquipment Scanner handler
  const handleAppendScannedSnToEquipment = (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    const key = cleanCode.toLowerCase();

    setSelectedSnMap((prev) => {
      if (prev.has(key)) {
        toast.info(`Code "${cleanCode}" déjà sélectionné`);
        return prev;
      }
      const match = allEquipmentSns.find((s: any) => s.serialNumberCode?.toLowerCase() === key);
      const next = new Map(prev);
      next.set(key, {
        serialNumberId: match?.serialNumberId,
        code: match?.serialNumberCode || cleanCode,
        shelfId: match?.shelfId,
        shelfName: match?.shelfName,
      });
      toast.success(`Code "${cleanCode}" ajouté`);
      return next;
    });
  };

  // Add Article to Shelf from Catalog
  const handleAddEquipmentToShelf = (item: any) => {
    if (allShelfEquipments.some((e) => e.equipmentId === item.equipmentId)) {
      toast.info(`"${item.equipmentName}" est déjà sur cette étagère.`);
      return;
    }
    setAddedShelfEquipments((prev) => [
      ...prev,
      {
        equipmentId: item.equipmentId,
        equipmentName: item.equipmentName,
        hasSerialNumber: item.hasSerialNumber,
        theoreticalQuantity: 0,
        serialNumbers: [],
      },
    ]);
    if (!item.hasSerialNumber) {
      setShelfArticleCounts((prev) => ({ ...prev, [item.equipmentId]: 0 }));
    } else {
      setShelfArticleSns((prev) => ({ ...prev, [item.equipmentId]: [] }));
    }
    setIsAddArticleModalOpen(false);
    toast.success(`"${item.equipmentName}" ajouté à la fiche de recomptage.`);
  };

  // --------------------------------------------------------------------------
  // SUBMISSION HANDLER
  // --------------------------------------------------------------------------
  const handleValidateAdjudication = async () => {
    const finalNotes = notes.trim() || 'Recomptage physique validé par le responsable final.';

    try {
      let observations: any[] = [];
      let serialNumberIds: string[] | undefined = undefined;

      if (isByShelf) {
        // Collect observations for each shelf article
        allShelfEquipments.forEach((eq) => {
          if (eq.hasSerialNumber) {
            const snList = shelfArticleSns[eq.equipmentId] || [];
            snList.forEach((sn) => {
              observations.push({
                equipmentId: eq.equipmentId,
                shelfId: unit.shelfId,
                serialNumberId: sn.serialNumberId,
                serialNumberCode: sn.code,
                quantityCalculated: 1,
              });
            });
          } else {
            const count = Number(shelfArticleCounts[eq.equipmentId] || 0);
            observations.push({
              equipmentId: eq.equipmentId,
              shelfId: unit.shelfId,
              quantityCalculated: count,
            });
          }
        });
      } else {
        // ByEquipment
        if (hasEquipmentSerialNumber) {
          const selectedSnArray = Array.from(selectedSnMap.values());
          serialNumberIds = selectedSnArray
            .map((s) => s.serialNumberId)
            .filter((id): id is string => !!id);

          observations = selectedSnArray.map((sn) => ({
            equipmentId: unit.equipmentId,
            serialNumberId: sn.serialNumberId,
            serialNumberCode: sn.code,
            shelfId: sn.shelfId || equipmentShelves[0]?.shelfId || unit?.shelfId,
            quantityCalculated: 1,
          }));
        } else if (equipmentShelves.length > 0) {
          observations = Object.entries(nonSnShelfCounts)
            .filter(([_, qty]) => Number(qty) >= 0)
            .map(([shId, qty]) => ({
              equipmentId: unit.equipmentId,
              shelfId: shId,
              quantityCalculated: Number(qty) || 0,
            }));
        } else {
          observations = [
            {
              equipmentId: unit.equipmentId,
              shelfId: unit?.shelfId,
              quantityCalculated: singleQuantity,
              notes: finalNotes,
            },
          ];
        }
      }

      await adjudicate({
        inventoryId: unit.inventoryId,
        unitId,
        data: {
          quantity: totalFinalQuantity,
          notes: finalNotes,
          shelfId: unit?.shelfId || equipmentShelves[0]?.shelfId,
          equipmentId: unit?.equipmentId,
          serialNumberIds,
          observations,
        },
      });

      toast.success('Recomptage physique validé et divergence définitivement arbitrée !');
      router.push(`/inventory/${unit.inventoryId}/report`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erreur lors de la validation de l'arbitrage");
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

  const targetEntityTitle = isByShelf
    ? shelf?.shelfName || 'Étagère Cible'
    : equipment?.equipmentName || unit?.equipment?.equipmentName || unit?.unitId;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col pb-20">
      <div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ================================================================= */}
        {/* HEADER & SCOPE BANNER                                             */}
        {/* ================================================================= */}
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
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-bold">
                  {isByShelf ? 'PAR EMPLACEMENT (RAYON)' : 'PAR ARTICLE'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-amber-950/60 border border-amber-800/60 text-amber-300 flex items-center gap-1">
                  <Scale className="w-3 h-3" />
                  RESPONSABLE FINAL / 3ÈME CONTRÔLEUR
                </span>
              </div>
              <p className="text-xs text-[#c9c0ad] mt-0.5">
                Résolution de la divergence sur{' '}
                <span className="font-semibold text-[#f7f5f0]">{targetEntityTitle}</span>
                {isByShelf && (
                  <span className="font-mono text-[#8c827a] ml-1.5">
                    ({allShelfEquipments.length} article(s) sur cette étagère)
                  </span>
                )}
              </p>
            </div>
            <div className="text-[10px] font-mono px-2.5 py-1 bg-red-950/50 border border-red-900/50 text-red-300 rounded-[2px] flex items-center gap-1.5 self-start sm:self-center">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{isAlreadyResolved ? 'Divergence Résolue' : 'Divergence Séquence 0'}</span>
            </div>
          </div>
        </div>

        {/* Resolved Banner */}
        {isAlreadyResolved && (
          <div className="p-4 rounded-[4px] bg-emerald-950/40 border border-emerald-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-emerald-300">
                    Cette divergence a déjà été arbitrée et validée
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/60">
                    STATUT : RÉSOLU
                  </span>
                </div>
                <p className="text-xs text-emerald-200/90 leading-relaxed">
                  Quantité définitive retenue :{' '}
                  <strong className="font-mono text-white text-sm">
                    {resolvedInfo?.resolvedQuantity ?? totalFinalQuantity} pièce(s)
                  </strong>
                  {resolvedInfo?.adjudicatedAt && (
                    <span className="text-[11px] text-emerald-300/80 ml-2">
                      le {new Date(resolvedInfo.adjudicatedAt).toLocaleString('fr-FR')}
                    </span>
                  )}
                </p>
                {resolvedInfo?.notes && (
                  <p className="text-xs text-emerald-300/80 italic">
                    Justification enregistrée : "{resolvedInfo.notes}"
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/inventory/${unit.inventoryId}/report`}
                className="px-3 py-1.5 bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-100 text-xs font-medium rounded-[2px] border border-emerald-600/60 transition-colors inline-flex items-center gap-1.5"
              >
                <span>Consulter le rapport</span>
              </Link>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* INITIAL COUNTERS COMPARISON CARD (RAPPORT DES DEUX COMPTEURS)     */}
        {/* ================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-[#aea69c] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[#10b981]" />
              Rapports des deux compteurs initiaux (Séquence 0)
            </span>
            <span className="text-xs font-mono text-amber-400 font-bold bg-amber-950/40 border border-amber-800/50 px-2.5 py-0.5 rounded-[2px]">
              Écart constaté : {Math.abs(c1Total - c2Total)} pcs
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
                    {counter1?.assignedUser?.userName || counter1?.assignedUser?.userEmail || 'Compteur 1'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdoptCounterAll(1)}
                  className="text-[10px] font-mono px-2 py-1 bg-blue-950/50 border border-blue-800/60 hover:bg-blue-900/50 text-blue-300 rounded-[2px] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copier les données de ce compteur comme base"
                >
                  <UserCheck className="w-3 h-3" />
                  Copier ce comptage
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">QUANTITÉ TOTALE</p>
                  <p className="text-lg font-semibold text-[#f7f5f0] font-mono">{c1Total} pcs</p>
                </div>
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">N° DE SÉRIE SCANNÉS</p>
                  <p className="text-lg font-semibold text-blue-400 font-mono">
                    {c1SnDetails.count > 0 ? `${c1SnDetails.count} S/N` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-[#383330]">
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
                    {counter2?.assignedUser?.userName || counter2?.assignedUser?.userEmail || 'Compteur 2'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdoptCounterAll(2)}
                  className="text-[10px] font-mono px-2 py-1 bg-amber-950/50 border border-amber-800/60 hover:bg-amber-900/50 text-amber-300 rounded-[2px] flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copier les données de ce compteur comme base"
                >
                  <UserCheck className="w-3 h-3" />
                  Copier ce comptage
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">QUANTITÉ TOTALE</p>
                  <p className="text-lg font-semibold text-[#f7f5f0] font-mono">{c2Total} pcs</p>
                </div>
                <div className="space-y-0.5 bg-[#26221f] p-2.5 rounded-[2px] border border-[#383330]">
                  <p className="text-[9px] font-mono text-[#8c827a] uppercase">N° DE SÉRIE SCANNÉS</p>
                  <p className="text-lg font-semibold text-amber-400 font-mono">
                    {c2SnDetails.count > 0 ? `${c2SnDetails.count} S/N` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-1 border-t border-[#383330]">
                <p className="text-xs text-[#c9c0ad] italic bg-[#26221f]/50 p-2 rounded-[2px] border border-[#383330]/50">
                  "{counter2?.orders?.[0]?.notes || 'Aucune observation saisie'}"
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================= */}
        {/* RECOUNT WORKBENCH TOOLBAR ("خلي المسؤول الاخير يعاود يحسب كلش قاع")  */}
        {/* ================================================================= */}
        <section className="p-5 rounded-[4px] border border-[#10b981]/40 bg-[#2a2522] space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#10b981]" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3f3a36]">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#10b981]" />
                <h2 className="text-base font-bold text-[#f7f5f0]">
                  Recomptage Physique Complet (Nouveau comptage terrain de A à Z)
                </h2>
              </div>
              <p className="text-xs text-[#aea69c] mt-0.5">
                En tant que responsable final / arbitre, recomptez chaque article sur le terrain pour trancher définitivement la divergence.
              </p>
            </div>

            {/* Real-time total recount indicator */}
            <div className="px-3.5 py-2 rounded-[3px] bg-[#10b981]/15 border border-[#10b981]/50 text-right">
              <span className="text-[10px] text-[#10b981] block font-mono font-bold uppercase">
                TOTAL PHYSIQUE RECOMPTÉ
              </span>
              <span className="text-xl font-bold text-[#10b981] font-mono">
                {totalFinalQuantity} pcs
              </span>
            </div>
          </div>

          {/* Quick Setup Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono text-[#8c827a] uppercase mr-1">
              Actions de recomptage :
            </span>

            {/* ZERO RESET: Crucial button for "يعاود يحسب كلش قاع" */}
            <button
              type="button"
              onClick={handleResetAllToZero}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/60 text-xs font-mono rounded-[2px] transition-colors cursor-pointer font-semibold"
              title="Remettre tous les comptes à zéro pour recompter entièrement à blanc"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red-400" />
              <span>Recompter tout à zéro (Remise à zéro)</span>
            </button>

            <button
              type="button"
              onClick={handleLoadTheoreticalAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#383330] hover:bg-[#453f3a] text-[#f7f5f0] border border-[#3f3a36] text-xs font-mono rounded-[2px] transition-colors cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Charger les théoriques</span>
            </button>

            <button
              type="button"
              onClick={() => handleAdoptCounterAll(1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-950/30 hover:bg-blue-900/40 text-blue-300 border border-blue-800/40 text-xs font-mono rounded-[2px] transition-colors cursor-pointer"
            >
              <span>Copier C1 ({c1Total} pcs)</span>
            </button>

            <button
              type="button"
              onClick={() => handleAdoptCounterAll(2)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 border border-amber-800/40 text-xs font-mono rounded-[2px] transition-colors cursor-pointer"
            >
              <span>Copier C2 ({c2Total} pcs)</span>
            </button>
          </div>
        </section>

        {/* ================================================================= */}
        {/* VIEW 1: BY-SHELF RECOUNT (MODE PAR EMPLACEMENT)                    */}
        {/* ================================================================= */}
        {isByShelf && (
          <section className="space-y-4">
            {/* Shelf Toolbar & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#aea69c]" />
                <input
                  type="text"
                  placeholder="Filtrer les articles de cette étagère..."
                  value={shelfArticleSearch}
                  onChange={(e) => setShelfArticleSearch(e.target.value)}
                  className="w-full h-9 pl-8 pr-3 text-xs bg-[#2f2a26] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] placeholder:text-[#6a625b] font-mono focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddArticleModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] text-xs font-mono rounded-[3px] transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un article trouvé sur cet emplacement</span>
                </button>
              </div>
            </div>

            {/* Articles List on Shelf */}
            <div className="space-y-4">
              {filteredShelfEquipments.length === 0 ? (
                <div className="p-8 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] text-center space-y-3">
                  <Package className="w-8 h-8 text-[#aea69c] mx-auto opacity-50" />
                  <p className="text-sm text-[#aea69c]">
                    Aucun article ne correspond à votre recherche sur cet emplacement.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddArticleModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#383330] text-[#10b981] text-xs font-mono rounded-[3px] border border-[#3f3a36]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter un article</span>
                  </button>
                </div>
              ) : (
                filteredShelfEquipments.map((eq: any) => {
                  const eqId = eq.equipmentId;
                  const hasSn = eq.hasSerialNumber;
                  const c1Info = c1ArticleBreakdown[eqId] || { quantity: 0, snCodes: new Set() };
                  const c2Info = c2ArticleBreakdown[eqId] || { quantity: 0, snCodes: new Set() };
                  const currentQty = Number(shelfArticleCounts[eqId] || 0);
                  const currentSns = shelfArticleSns[eqId] || [];
                  const scanVal = shelfScanInputs[eqId] || '';

                  return (
                    <div
                      key={eqId}
                      className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3 shadow-sm hover:border-[#4f4842] transition-colors"
                    >
                      {/* Article Header & Counters Comparison */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#383330]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#f7f5f0]">
                              {eq.equipmentName}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                                hasSn
                                  ? 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                                  : 'bg-[#26221f] text-[#aea69c] border-[#383330]'
                              }`}
                            >
                              {hasSn ? 'Sérialisé (N° de série)' : 'Non sérialisé (Quantitatif)'}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-[#8c827a]">
                            ID: {eqId.slice(0, 13)}... | Stock attendu sur rayon :{' '}
                            <strong className="text-[#f7f5f0]">{eq.theoreticalQuantity} pcs</strong>
                          </p>
                        </div>

                        {/* Comparative Badge: C1 vs C2 for this specific article */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="px-2.5 py-1 bg-[#26221f] border border-blue-900/40 rounded-[2px] text-right font-mono">
                            <span className="text-[9px] text-blue-400 block uppercase">1er Compteur</span>
                            <span className="text-xs font-semibold text-[#f7f5f0]">
                              {c1Info.quantity} pcs
                            </span>
                          </div>
                          <div className="px-2.5 py-1 bg-[#26221f] border border-amber-900/40 rounded-[2px] text-right font-mono">
                            <span className="text-[9px] text-amber-400 block uppercase">2ème Compteur</span>
                            <span className="text-xs font-semibold text-[#f7f5f0]">
                              {c2Info.quantity} pcs
                            </span>
                          </div>
                          <div className="px-2.5 py-1 bg-[#26221f] border border-[#383330] rounded-[2px] text-right font-mono">
                            <span className="text-[9px] text-[#8c827a] block uppercase">Écart</span>
                            <span
                              className={`text-xs font-semibold ${
                                c1Info.quantity !== c2Info.quantity ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {Math.abs(c1Info.quantity - c2Info.quantity)} pcs
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* NON-SERIALIZED: STEPPER & DIRECT INPUT */}
                      {!hasSn ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[#aea69c]">Quantité Recomptée :</span>
                            <div className="flex items-center border border-[#3f3a36] rounded-[3px] overflow-hidden bg-[#26221f]">
                              <button
                                type="button"
                                onClick={() => handleUpdateArticleCount(eqId, currentQty - 1)}
                                className="px-2.5 py-1 text-xs hover:bg-[#383330] text-[#aea69c] transition-colors"
                              >
                                - 1
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={currentQty}
                                onChange={(e) =>
                                  handleUpdateArticleCount(eqId, parseInt(e.target.value) || 0)
                                }
                                className="w-16 h-8 text-center bg-transparent text-sm font-mono text-[#10b981] font-bold focus:outline-none border-x border-[#3f3a36]"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateArticleCount(eqId, currentQty + 1)}
                                className="px-2.5 py-1 text-xs hover:bg-[#383330] text-[#aea69c] transition-colors"
                              >
                                + 1
                              </button>
                            </div>
                          </div>

                          {/* Quick fill buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateArticleCount(eqId, c1Info.quantity)}
                              className="px-2 py-1 text-[11px] font-mono rounded-[2px] bg-blue-950/40 text-blue-300 border border-blue-800/40 hover:bg-blue-900/50 transition-colors"
                            >
                              = Copier C1 ({c1Info.quantity})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateArticleCount(eqId, c2Info.quantity)}
                              className="px-2 py-1 text-[11px] font-mono rounded-[2px] bg-amber-950/40 text-amber-300 border border-amber-800/40 hover:bg-amber-900/50 transition-colors"
                            >
                              = Copier C2 ({c2Info.quantity})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateArticleCount(eqId, eq.theoreticalQuantity)}
                              className="px-2 py-1 text-[11px] font-mono rounded-[2px] bg-[#383330] text-[#aea69c] hover:text-[#f7f5f0] border border-[#3f3a36] transition-colors"
                            >
                              = Théorique ({eq.theoreticalQuantity})
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* SERIALIZED: CAMERA SCAN, INPUT, CHECKLIST */
                        <div className="space-y-3 pt-1">
                          {/* Scan Bar & Camera Trigger */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <div className="relative flex-1">
                              <Barcode className="absolute left-2.5 top-2.5 w-4 h-4 text-[#aea69c]" />
                              <input
                                type="text"
                                placeholder="Saisir ou scanner le N° de série (Entrée pour valider)..."
                                value={scanVal}
                                onChange={(e) =>
                                  setShelfScanInputs((prev) => ({ ...prev, [eqId]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAppendScannedSnToShelfArticle(eqId, scanVal);
                                    setShelfScanInputs((prev) => ({ ...prev, [eqId]: '' }));
                                  }
                                }}
                                className="w-full h-9 pl-9 pr-3 text-xs bg-[#26221f] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] font-mono focus:outline-none focus:border-[#10b981]"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                handleAppendScannedSnToShelfArticle(eqId, scanVal);
                                setShelfScanInputs((prev) => ({ ...prev, [eqId]: '' }));
                              }}
                              className="px-3 h-9 bg-[#383330] hover:bg-[#453f3a] text-xs font-mono text-[#f7f5f0] rounded-[2px] border border-[#3f3a36] transition-colors cursor-pointer"
                            >
                              Ajouter
                            </button>

                            {/* Camera Scan Button */}
                            <button
                              type="button"
                              onClick={() => handleOpenScanner(eqId)}
                              className="px-3 h-9 bg-[#10b981]/20 hover:bg-[#10b981]/30 text-[#10b981] border border-[#10b981]/40 text-xs font-mono rounded-[2px] flex items-center gap-1.5 transition-colors cursor-pointer"
                              title="Scanner avec la caméra du smartphone"
                            >
                              <Camera className="w-4 h-4" />
                              <span className="hidden sm:inline">Caméra QR / Code-barres</span>
                            </button>
                          </div>

                          {/* Checklist of Expected Serial Numbers on this shelf */}
                          {(eq.serialNumbers || []).length > 0 && (
                            <div className="bg-[#26221f] p-3 rounded-[3px] border border-[#383330] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono uppercase text-[#aea69c]">
                                  Checklist des numéros de série répertoriés ({eq.serialNumbers.length}) :
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCheckAllArticleSns(eq)}
                                    className="text-[10px] font-mono text-[#10b981] hover:underline"
                                  >
                                    Tout cocher
                                  </button>
                                  <span className="text-[#3f3a36]">|</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUncheckAllArticleSns(eqId)}
                                    className="text-[10px] font-mono text-[#8c827a] hover:underline"
                                  >
                                    Tout décocher
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                                {eq.serialNumbers.map((sn: any) => {
                                  const code = sn.serialNumberCode;
                                  const codeLower = code.toLowerCase();
                                  const isChecked = currentSns.some((s) => s.code.toLowerCase() === codeLower);
                                  const inC1 = c1Info.snCodes.has(codeLower);
                                  const inC2 = c2Info.snCodes.has(codeLower);

                                  return (
                                    <label
                                      key={sn.serialNumberId || code}
                                      className={`p-2 rounded-[2px] border text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                        isChecked
                                          ? 'border-[#10b981] bg-[#10b981]/10 text-[#f7f5f0]'
                                          : 'border-[#383330] bg-[#2b2622] text-[#aea69c] hover:border-[#4f4842]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => handleToggleArticleSn(eqId, sn)}
                                          className="rounded border-[#3f3a36] text-[#10b981] focus:ring-0"
                                        />
                                        <span className="truncate">{code}</span>
                                      </div>

                                      {/* Tags showing who saw it */}
                                      <div className="shrink-0 text-[8px] font-mono">
                                        {inC1 && inC2 ? (
                                          <span className="px-1 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                                            C1+C2
                                          </span>
                                        ) : inC1 ? (
                                          <span className="px-1 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/60">
                                            Vu C1
                                          </span>
                                        ) : inC2 ? (
                                          <span className="px-1 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                                            Vu C2
                                          </span>
                                        ) : (
                                          <span className="px-1 py-0.5 rounded bg-[#383330] text-[#8c827a]">
                                            Non vu
                                          </span>
                                        )}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Scanned S/N Chips List */}
                          <div className="flex items-center justify-between text-xs font-mono pt-1">
                            <span className="text-[#aea69c]">
                              Numéros de série retenus :{' '}
                              <strong className="text-[#10b981]">{currentSns.length} S/N</strong>
                            </span>
                          </div>
                          {currentSns.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 p-2 bg-[#26221f] rounded-[2px] border border-[#383330] max-h-32 overflow-y-auto">
                              {currentSns.map((s) => (
                                <span
                                  key={s.code}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#383330] border border-[#3f3a36] text-[11px] font-mono text-[#f7f5f0]"
                                >
                                  <span>{s.code}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveArticleSn(eqId, s.code)}
                                    className="hover:text-red-400 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ================================================================= */}
        {/* VIEW 2: BY-EQUIPMENT RECOUNT (MODE PAR ARTICLE)                    */}
        {/* ================================================================= */}
        {isByEquipment && (
          <section className="space-y-4">
            {/* Shelves Cards for this Equipment */}
            <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
              <span className="text-xs font-mono uppercase text-[#aea69c] block">
                Répartition attendue par emplacement :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {equipmentShelves.map((sh: any) => {
                  const currentVal = nonSnShelfCounts[sh.shelfId] ?? 0;
                  const c1Sh = c1ShelfCounts[sh.shelfId] ?? 0;
                  const c2Sh = c2ShelfCounts[sh.shelfId] ?? 0;

                  return (
                    <div
                      key={sh.shelfId}
                      className="p-3 bg-[#26221f] border border-[#383330] rounded-[3px] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#10b981]" />
                          <span className="text-xs font-semibold text-[#f7f5f0]">
                            {sh.shelfName}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[#8c827a]">
                          Attendu : {sh.quantity} pcs
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-blue-400">C1: {c1Sh}</span>
                        <span>|</span>
                        <span className="text-amber-400">C2: {c2Sh}</span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-mono text-[#aea69c] uppercase">
                          Quantité Recomptée
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={currentVal}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setNonSnShelfCounts((prev) => ({
                              ...prev,
                              [sh.shelfId]: val,
                            }));
                          }}
                          className="w-full h-8 bg-[#2b2622] border border-[#3f3a36] rounded-[2px] px-2.5 text-xs font-mono text-[#10b981] font-bold focus:outline-none focus:border-[#10b981]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Serial Numbers if serialized */}
            {hasEquipmentSerialNumber && (
              <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
                  <h3 className="text-xs font-mono uppercase text-[#aea69c] flex items-center gap-1.5">
                    <Barcode className="w-4 h-4 text-[#10b981]" />
                    Numéros de série ({allEquipmentSns.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleOpenScanner()}
                    className="px-2.5 py-1 bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 text-xs font-mono rounded flex items-center gap-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Caméra Scanner</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                  {allEquipmentSns.map((sn: any) => {
                    const code = sn.serialNumberCode;
                    const codeLower = code.toLowerCase();
                    const isChecked = selectedSnMap.has(codeLower);
                    const inC1 = c1SnDetails.codes.has(codeLower);
                    const inC2 = c2SnDetails.codes.has(codeLower);

                    return (
                      <label
                        key={sn.serialNumberId}
                        className={`p-2 rounded border text-xs font-mono flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'border-[#10b981] bg-[#10b981]/15 text-[#f7f5f0]'
                            : 'border-[#383330] bg-[#26221f] text-[#aea69c]'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedSnMap((prev) => {
                                const next = new Map(prev);
                                if (next.has(codeLower)) next.delete(codeLower);
                                else
                                  next.set(codeLower, {
                                    serialNumberId: sn.serialNumberId,
                                    code,
                                    shelfId: sn.shelfId,
                                    shelfName: sn.shelfName,
                                  });
                                return next;
                              });
                            }}
                            className="rounded border-[#3f3a36] text-[#10b981]"
                          />
                          <span className="truncate">{code}</span>
                        </div>
                        <span className="text-[8px]">
                          {inC1 && inC2 ? 'C1+C2' : inC1 ? 'C1' : inC2 ? 'C2' : 'Non vu'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* SECTION: FINAL DECISION & SUBMISSION                              */}
        {/* ================================================================= */}
        <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2a2522] shadow-sm">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-[#f7f5f0]">
              <Scale className="w-4 h-4 text-[#10b981]" />
              Décision finale d'arbitrage & Clôture de la divergence
            </h2>
            <p className="text-xs text-[#c9c0ad]">
              En validant, vous fixez la valeur définitive du stock d'après votre recomptage physique intégral.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Total Quantity Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                Total Final Retenu (Pièces Physiques)
              </label>
              <input
                type="number"
                min="0"
                value={totalFinalQuantity}
                disabled
                className="w-full h-9 bg-[#26221f] border border-[#3f3a36] rounded-[2px] px-3 text-base font-mono font-bold text-[#10b981] focus:outline-none"
              />
              <span className="text-[10px] font-mono text-[#8c827a] block">
                Calculé automatiquement d'après les articles recomptés ci-dessus.
              </span>
            </div>

            {/* Optional Justification */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                Justification / Remarques (Optionnel)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Facultatif : Observations éventuelles sur le recomptage..."
                className="w-full h-9 bg-[#26221f] border border-[#3f3a36] rounded-[2px] px-3 text-xs focus:outline-none text-[#f7f5f0] focus:border-[#10b981]"
              />
            </div>
          </div>

          {/* Quick Justification Templates */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-mono text-[#8c827a] mr-1 uppercase">
              Modèles de justification :
            </span>
            {[
              'Recomptage physique intégral sur site effectué par le 3ème contrôleur.',
              'Vérification physique en rayon effectuée : quantité définitive validée.',
              'Adoption du comptage C1 après vérification contradictoire sur place.',
              'Adoption du comptage C2 après vérification contradictoire sur place.',
            ].map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setNotes(tmpl)}
                className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#26221f] hover:bg-[#383330] border border-[#383330] text-[#aea69c] transition-colors cursor-pointer"
              >
                {tmpl.slice(0, 32)}...
              </button>
            ))}
          </div>

          {/* Submit Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-[#3f3a36]">
            <span className="text-xs text-[#aea69c]">
              Total définitif à inscrire au stock :{' '}
              <strong className="font-mono font-bold text-[#10b981] text-base">
                {totalFinalQuantity} pièce(s)
              </strong>
            </span>

            <button
              type="button"
              disabled={isSubmitting || unit?.inventory?.status === 'COMPLETED'}
              onClick={handleValidateAdjudication}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : isAlreadyResolved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Mettre à jour le recomptage</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Valider le Recomptage & Adjuger définitivement</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* ================================================================= */}
      {/* MODAL: ADD ARTICLE TO SHELF FROM CATALOG                          */}
      {/* ================================================================= */}
      {isAddArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#2a2522] border border-[#3f3a36] rounded-[4px] max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#10b981]" />
                <h3 className="text-sm font-semibold text-[#f7f5f0]">
                  Ajouter un article présent sur cet emplacement
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddArticleModalOpen(false)}
                className="text-[#aea69c] hover:text-[#f7f5f0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#aea69c]">
              Sélectionnez un article du catalogue SomePharm trouvé physiquement sur ce rayon pour l'intégrer au recomptage.
            </p>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#aea69c]" />
              <input
                type="text"
                placeholder="Rechercher par nom d'article..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="w-full h-9 pl-8 pr-3 text-xs bg-[#26221f] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] font-mono focus:outline-none focus:border-[#10b981]"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {allCatalogEquipments
                .filter(
                  (item: any) =>
                    !catalogSearch.trim() ||
                    item.equipmentName.toLowerCase().includes(catalogSearch.toLowerCase())
                )
                .slice(0, 50)
                .map((item: any) => (
                  <div
                    key={item.equipmentId}
                    className="p-2.5 rounded-[2px] border border-[#383330] bg-[#26221f] hover:border-[#10b981]/50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-[#f7f5f0] block">
                        {item.equipmentName}
                      </span>
                      <span className="text-[10px] font-mono text-[#8c827a]">
                        {item.hasSerialNumber ? 'Sérialisé' : 'Quantitatif'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddEquipmentToShelf(item)}
                      className="px-2.5 py-1 bg-[#383330] hover:bg-[#10b981] hover:text-[#2b2622] text-[#10b981] font-mono text-[11px] rounded transition-colors"
                    >
                      Ajouter
                    </button>
                  </div>
                ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-[#383330]">
              <button
                type="button"
                onClick={() => setIsAddArticleModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#aea69c] hover:text-[#f7f5f0]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODAL: LIVE CAMERA QR / BARCODE SCANNER                           */}
      {/* ================================================================= */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#2a2522] border border-[#3f3a36] rounded-[4px] max-w-md w-full p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#10b981]" />
                <h3 className="text-sm font-semibold text-[#f7f5f0]">
                  Scanner Caméra (QR / Code-barres)
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="text-[#aea69c] hover:text-[#f7f5f0]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#aea69c]">
              Pointez la caméra vers le code-barres ou QR code du numéro de série. La détection émet un bip et ajoute directement le code.
            </p>

            <div className="relative aspect-video bg-black rounded-[3px] overflow-hidden border border-[#3f3a36] flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <div className="absolute inset-0 border-2 border-[#10b981]/60 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-28 border border-dashed border-[#10b981] animate-pulse" />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[10px] font-mono text-[#10b981] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                Viseur actif
              </span>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="px-4 py-1.5 bg-[#383330] hover:bg-[#453f3a] text-xs font-mono text-[#f7f5f0] rounded-[2px]"
              >
                Terminer le scan
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
