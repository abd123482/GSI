'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  Camera,
  QrCode,
  Sparkles,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useInventoryTask, useSubmitTask } from '@/hooks/use-inventory';
import { toast } from 'sonner';
import { BrowserMultiFormatReader } from '@zxing/browser';

// Sound effect feedback helper
function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880; // A5 tone
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function InventoryTaskPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const taskId = params?.taskId as string;
  const router = useRouter();

  const { data: attempt, isLoading } = useInventoryTask(taskId);
  const { mutateAsync: submitTask } = useSubmitTask();

  // Mode detection
  const isByEquipment = attempt?.unit?.inventory?.typeInventory === 'ByEquipment';
  const isByShelf = attempt?.unit?.inventory?.typeInventory === 'ByShelf';
  const scopeDetails = attempt?.scopeDetails;

  // Global Notes & Observations
  const [notes, setNotes] = useState<string>('');

  // -------------------------------------------------------------
  // STATE FOR "PAR ARTICLE" (ByEquipment)
  // -------------------------------------------------------------
  const [selectedShelfId, setSelectedShelfId] = useState<string>('');
  const [shelfCounts, setShelfCounts] = useState<{ [shelfId: string]: number }>({});
  const [countedSns, setCountedSns] = useState<
    Array<{ serialNumberId?: string; code: string; shelfId?: string; isNew?: boolean }>
  >([]);
  const [scanInput, setScanInput] = useState<string>('');
  const [snFilterTab, setSnFilterTab] = useState<'ALL' | 'UNCOUNTED' | 'COUNTED'>('ALL');
  const [snListSearch, setSnListSearch] = useState<string>('');
  const [snReferenceSearch, setSnReferenceSearch] = useState<string>('');
  const [isSnReferenceExpanded, setIsSnReferenceExpanded] = useState<boolean>(false);

  // -------------------------------------------------------------
  // STATE FOR "PAR EMPLACEMENT" (ByShelf)
  // -------------------------------------------------------------
  // Extra equipments added manually by the user to this shelf
  const [addedShelfEquipments, setAddedShelfEquipments] = useState<any[]>([]);
  // Non-serialized counts per equipment: { [equipmentId: string]: number }
  const [shelfArticleCounts, setShelfArticleCounts] = useState<{ [equipmentId: string]: number }>({});
  // Serialized counts per equipment: { [equipmentId: string]: Array<{ serialNumberId?: string; code: string; isNew?: boolean }> }
  const [shelfArticleSns, setShelfArticleSns] = useState<{
    [equipmentId: string]: Array<{ serialNumberId?: string; code: string; isNew?: boolean }>;
  }>({});
  // Per-article scan text input
  const [shelfScanInputs, setShelfScanInputs] = useState<{ [equipmentId: string]: string }>({});
  // Search filter for articles in the current shelf
  const [shelfArticleSearch, setShelfArticleSearch] = useState<string>('');
  // Modal to add an article from catalog to this shelf
  const [isAddArticleModalOpen, setIsAddArticleModalOpen] = useState<boolean>(false);
  const [catalogSearch, setCatalogSearch] = useState<string>('');

  // -------------------------------------------------------------
  // CAMERA SCANNER STATE (QR & Barcode)
  // -------------------------------------------------------------
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState<boolean>(false);
  const [cameraTargetEquipmentId, setCameraTargetEquipmentId] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Verification: At least 2 distinct participants
  const participants = attempt?.unit?.inventory?.Inventory_User || [];
  const uniqueParticipantsCount = new Set(participants.map((p: any) => p.userId)).size;
  const isMultiUserValid = uniqueParticipantsCount >= 2;

  // -------------------------------------------------------------
  // RESOLVED CURRENT ENTITIES
  // -------------------------------------------------------------
  // ByEquipment: Current Equipment
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
              shelfName: es.shelf?.shelfName ?? 'Emplacement non défini',
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

  // ByShelf: Current Shelf
  const currentShelf = useMemo(() => {
    if (isByShelf) {
      const fromScope = scopeDetails?.shelves?.find(
        (s: any) => s.shelfId === attempt?.unit?.shelfId
      );
      if (fromScope) return fromScope;

      if (attempt?.unit?.shelf) {
        const sh = attempt.unit.shelf;
        return {
          shelfId: sh.shelfId,
          shelfName: sh.shelfName || 'Étagère',
          equipments: (sh.equipmentShelfs || []).map((es: any) => ({
            equipmentId: es.equipmentId ?? '',
            equipmentName: es.equipment?.equipmentName ?? 'Équipement inconnu',
            hasSerialNumber: es.equipment?.hasSerialNumber ?? false,
            quantity: es.equipmentQuantity ?? 0,
            serialNumbers: (es.equipment?.serialNumbers || []).map((sn: any) => ({
              serialNumberId: sn.serialNumberId,
              serialNumberCode: sn.serialNumberCode ?? '',
              serialNumberStatus: sn.serialNumberStatus ?? '',
              shelfId: sn.shelfId,
              shelfName: sh.shelfName,
            })),
          })),
          serialNumbers: (sh.serialNumbers || []).map((sn: any) => ({
            serialNumberId: sn.serialNumberId,
            serialNumberCode: sn.serialNumberCode ?? '',
            serialNumberStatus: sn.serialNumberStatus ?? '',
            equipmentId: sn.equipmentId,
            equipmentName: sn.equipment?.equipmentName ?? null,
          })),
        };
      }
    }
    return null;
  }, [isByShelf, attempt, scopeDetails]);

  // Combined articles list on this shelf (initial expected + user added)
  const allShelfEquipments = useMemo(() => {
    if (!isByShelf) return [];
    const baseList = currentShelf?.equipments || [];
    const existingIds = new Set(baseList.map((e: any) => e.equipmentId));
    const extra = addedShelfEquipments.filter((e) => !existingIds.has(e.equipmentId));
    return [...baseList, ...extra];
  }, [isByShelf, currentShelf, addedShelfEquipments]);

  // Filtered shelf equipments for search
  const filteredShelfEquipments = useMemo(() => {
    if (!shelfArticleSearch.trim()) return allShelfEquipments;
    const term = shelfArticleSearch.trim().toLowerCase();
    return allShelfEquipments.filter((e: any) =>
      (e.equipmentName || '').toLowerCase().includes(term)
    );
  }, [allShelfEquipments, shelfArticleSearch]);

  // Available catalog equipments not yet in this shelf
  const availableCatalogEquipments = useMemo(() => {
    const presentIds = new Set(allShelfEquipments.map((e: any) => e.equipmentId));
    const all = scopeDetails?.allEquipments || [];
    return all.filter((eq: any) => {
      if (presentIds.has(eq.equipmentId)) return false;
      if (!catalogSearch.trim()) return true;
      return eq.equipmentName?.toLowerCase().includes(catalogSearch.trim().toLowerCase());
    });
  }, [allShelfEquipments, scopeDetails, catalogSearch]);

  // ByEquipment Helpers
  const hasSerialNumber = currentEquipment?.hasSerialNumber ?? false;
  const equipmentShelves = useMemo(() => currentEquipment?.shelves || [], [currentEquipment]);
  const allEquipmentSns = useMemo(() => currentEquipment?.serialNumbers || [], [currentEquipment]);

  const filteredReferenceSns = useMemo(() => {
    if (!snReferenceSearch.trim()) return allEquipmentSns;
    const term = snReferenceSearch.trim().toLowerCase();
    return allEquipmentSns.filter(
      (sn: any) =>
        sn.serialNumberCode?.toLowerCase().includes(term) ||
        sn.shelfName?.toLowerCase().includes(term)
    );
  }, [allEquipmentSns, snReferenceSearch]);

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

  const selectedShelfObj = useMemo(() => {
    return equipmentShelves.find((s: any) => s.shelfId === selectedShelfId);
  }, [equipmentShelves, selectedShelfId]);

  const expectedSnsForSelectedShelf = useMemo(() => {
    if (!selectedShelfId) return allEquipmentSns;
    return allEquipmentSns.filter((s: any) => s.shelfId === selectedShelfId);
  }, [allEquipmentSns, selectedShelfId]);

  const countedSnsForSelectedShelf = useMemo(() => {
    if (!selectedShelfId) return countedSns;
    return countedSns.filter((s) => s.shelfId === selectedShelfId);
  }, [countedSns, selectedShelfId]);

  const filteredChecklistSns = useMemo(() => {
    const search = snListSearch.trim().toLowerCase();
    const countedCodes = new Set(countedSns.map((s) => s.code.toLowerCase()));
    return expectedSnsForSelectedShelf.filter((sn: any) => {
      if (search && !sn.serialNumberCode?.toLowerCase().includes(search)) return false;
      const isCounted = countedCodes.has(sn.serialNumberCode?.toLowerCase());
      if (snFilterTab === 'COUNTED') return isCounted;
      if (snFilterTab === 'UNCOUNTED') return !isCounted;
      return true;
    });
  }, [expectedSnsForSelectedShelf, snListSearch, snFilterTab, countedSns]);

  const totalNonSnCounted = useMemo(() => {
    return Object.values(shelfCounts).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [shelfCounts]);

  // -------------------------------------------------------------
  // RESTORE SAVED DRAFTS / ORDERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!attempt?.orders || attempt.orders.length === 0) {
      if (isByEquipment && !selectedShelfId && equipmentShelves.length > 0) {
        setSelectedShelfId(equipmentShelves[0].shelfId);
      }
      return;
    }

    if (attempt.orders[0]?.notes) {
      setNotes(attempt.orders[0].notes);
    }

    if (isByEquipment) {
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
        if (restored.length > 0) setCountedSns(restored);
      } else {
        const restoredCounts: { [shelfId: string]: number } = {};
        attempt.orders.forEach((o: any) => {
          if (o.shelfId) restoredCounts[o.shelfId] = o.quantityCalculated ?? 0;
        });
        setShelfCounts(restoredCounts);
      }
      if (attempt.orders[0]?.shelfId) {
        setSelectedShelfId(attempt.orders[0].shelfId);
      }
    } else if (isByShelf) {
      // Restore ByShelf orders: map per equipment
      const restoredCounts: { [equipmentId: string]: number } = {};
      const restoredSns: {
        [equipmentId: string]: Array<{ serialNumberId?: string; code: string; isNew?: boolean }>;
      } = {};
      const extraEquipmentsMap = new Map<string, any>();

      attempt.orders.forEach((o: any) => {
        const eqId = o.equipmentId;
        if (!eqId) return;

        if (o.serialNumberId || o.unknownItemEvidence) {
          if (!restoredSns[eqId]) restoredSns[eqId] = [];
          const code =
            o.serialNumber?.serialNumberCode ||
            o.unknownItemEvidence ||
            'S/N ' + (o.serialNumberId?.slice(0, 8) || 'inconnu');
          restoredSns[eqId].push({
            serialNumberId: o.serialNumberId || undefined,
            code,
            isNew: !o.serialNumberId && !!o.unknownItemEvidence,
          });
        } else {
          restoredCounts[eqId] = (restoredCounts[eqId] || 0) + (o.quantityCalculated ?? 0);
        }

        // Check if equipment was not in currentShelf.equipments
        const isAlreadyPresent = currentShelf?.equipments?.some((e: any) => e.equipmentId === eqId);
        if (!isAlreadyPresent && o.equipment) {
          extraEquipmentsMap.set(eqId, {
            equipmentId: eqId,
            equipmentName: o.equipment.equipmentName || 'Équipement',
            hasSerialNumber: o.equipment.hasSerialNumber || !!o.serialNumberId,
            quantity: 0,
            serialNumbers: [],
          });
        }
      });

      setShelfArticleCounts(restoredCounts);
      setShelfArticleSns(restoredSns);
      if (extraEquipmentsMap.size > 0) {
        setAddedShelfEquipments(Array.from(extraEquipmentsMap.values()));
      }
    }
  }, [
    attempt?.attemptId,
    attempt?.orders,
    isByEquipment,
    isByShelf,
    hasSerialNumber,
    allEquipmentSns,
    equipmentShelves,
    currentShelf,
  ]);

  // -------------------------------------------------------------
  // HANDLERS FOR BY-SHELF (PAR EMPLACEMENT)
  // -------------------------------------------------------------
  const handleUpdateShelfArticleCount = (equipmentId: string, val: number) => {
    setShelfArticleCounts((prev) => ({
      ...prev,
      [equipmentId]: Math.max(0, val),
    }));
  };

  const handleAddShelfArticleSn = (equipmentId: string, rawCode?: string) => {
    const inputVal = (rawCode || shelfScanInputs[equipmentId] || '').trim();
    if (!inputVal) return;

    const codes = inputVal.split(/[\r\n,;\s]+/).filter(Boolean);
    if (codes.length === 0) return;

    const targetEq = allShelfEquipments.find((e: any) => e.equipmentId === equipmentId);
    const expectedSns = targetEq?.serialNumbers || [];

    let added = 0;
    let duplicates = 0;

    setShelfArticleSns((prev) => {
      const currentList = prev[equipmentId] || [];
      const existingSet = new Set(currentList.map((s) => s.code.toLowerCase()));
      const nextList = [...currentList];

      for (const c of codes) {
        if (existingSet.has(c.toLowerCase())) {
          duplicates++;
          continue;
        }

        const match = expectedSns.find(
          (s: any) => s.serialNumberCode?.toLowerCase() === c.toLowerCase()
        );

        nextList.push({
          serialNumberId: match?.serialNumberId,
          code: match?.serialNumberCode || c,
          isNew: !match,
        });

        existingSet.add(c.toLowerCase());
        added++;
      }

      return {
        ...prev,
        [equipmentId]: nextList,
      };
    });

    setShelfScanInputs((prev) => ({ ...prev, [equipmentId]: '' }));

    if (added > 0) {
      playBeep();
      toast.success(`${added} numéro(s) de série ajouté(s)`);
    }
    if (duplicates > 0) {
      toast.info(`${duplicates} N° de série déjà présent(s) pour cet article`);
    }
  };

  const handleToggleShelfArticleSn = (equipmentId: string, sn: any) => {
    const code = sn.serialNumberCode || sn.code;
    setShelfArticleSns((prev) => {
      const list = prev[equipmentId] || [];
      const idx = list.findIndex(
        (s) =>
          (sn.serialNumberId && s.serialNumberId === sn.serialNumberId) ||
          s.code.toLowerCase() === code.toLowerCase()
      );

      if (idx >= 0) {
        const nextList = [...list];
        nextList.splice(idx, 1);
        return { ...prev, [equipmentId]: nextList };
      } else {
        playBeep();
        return {
          ...prev,
          [equipmentId]: [
            ...list,
            {
              serialNumberId: sn.serialNumberId,
              code,
              isNew: false,
            },
          ],
        };
      }
    });
  };

  const handleRemoveShelfArticleSn = (equipmentId: string, code: string) => {
    setShelfArticleSns((prev) => ({
      ...prev,
      [equipmentId]: (prev[equipmentId] || []).filter((s) => s.code !== code),
    }));
  };

  const handleBatchCheckAllForShelfArticle = (equipmentId: string) => {
    const targetEq = allShelfEquipments.find((e: any) => e.equipmentId === equipmentId);
    const expectedSns = targetEq?.serialNumbers || [];
    if (expectedSns.length === 0) return;

    setShelfArticleSns((prev) => {
      const currentList = prev[equipmentId] || [];
      const existingSet = new Set(currentList.map((s) => s.code.toLowerCase()));
      const nextList = [...currentList];

      for (const sn of expectedSns) {
        if (!existingSet.has(sn.serialNumberCode.toLowerCase())) {
          nextList.push({
            serialNumberId: sn.serialNumberId,
            code: sn.serialNumberCode,
            isNew: false,
          });
          existingSet.add(sn.serialNumberCode.toLowerCase());
        }
      }

      return {
        ...prev,
        [equipmentId]: nextList,
      };
    });

    playBeep();
    toast.success(`Tous les N° de série attendus pour "${targetEq?.equipmentName}" ont été validés`);
  };

  const handleClearShelfArticleSns = (equipmentId: string) => {
    setShelfArticleSns((prev) => ({ ...prev, [equipmentId]: [] }));
    toast.info('Comptage réinitialisé pour cet article');
  };

  const handleAddEquipmentFromCatalog = (equipment: any) => {
    setAddedShelfEquipments((prev) => [...prev, { ...equipment, quantity: 0, serialNumbers: [] }]);
    setIsAddArticleModalOpen(false);
    toast.success(`Article "${equipment.equipmentName}" ajouté à l'emplacement !`);
  };

  // -------------------------------------------------------------
  // CAMERA SCANNER (QR & BARCODE) IMPLEMENTATION
  // -------------------------------------------------------------
  const startCameraScanner = async (targetEquipmentId?: string) => {
    setCameraTargetEquipmentId(targetEquipmentId || null);
    setIsCameraScannerOpen(true);
    setIsCameraActive(true);

    try {
      const codeReader = new BrowserMultiFormatReader();
      codeReaderRef.current = codeReader;

      // Small delay to ensure video element is mounted
      setTimeout(async () => {
        if (!videoRef.current) return;
        try {
          await codeReader.decodeFromVideoDevice(
            undefined, // Default/environment camera
            videoRef.current,
            (result, err) => {
              if (result) {
                const text = result.getText();
                if (text) {
                  playBeep();
                  if (targetEquipmentId) {
                    handleAddShelfArticleSn(targetEquipmentId, text);
                  } else if (isByEquipment) {
                    handleAddSerialNumber(text);
                  }
                  toast.success(`Code scanné: ${text}`);
                }
              }
            }
          );
        } catch (scanErr: any) {
          toast.error("Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur.");
          setIsCameraActive(false);
        }
      }, 300);
    } catch (e: any) {
      toast.error('Erreur lors du démarrage du scanner caméra');
      setIsCameraActive(false);
    }
  };

  const stopCameraScanner = () => {
    if (codeReaderRef.current) {
      try {
        // Stop decoding and release camera stream
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

  // Cleanup camera scanner on unmount
  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, []);

  // -------------------------------------------------------------
  // HANDLERS FOR BY-EQUIPMENT (PAR ARTICLE)
  // -------------------------------------------------------------
  const handleUpdateCurrentShelfCount = (val: number) => {
    if (!selectedShelfId) return;
    setShelfCounts((prev) => ({
      ...prev,
      [selectedShelfId]: Math.max(0, val),
    }));
  };

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
      playBeep();
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
        playBeep();
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

    playBeep();
    toast.success(`Tous les N° de série attendus sur cet emplacement ont été validés`);
  };

  const handleClearCountedForShelf = () => {
    if (selectedShelfId) {
      setCountedSns((prev) => prev.filter((s) => s.shelfId !== selectedShelfId));
      toast.info(`Comptage réinitialisé pour cet emplacement`);
    } else {
      setCountedSns([]);
      toast.info(`Tous les numéros de série ont été retirés`);
    }
  };

  // -------------------------------------------------------------
  // BUILD SUBMISSION PAYLOAD
  // -------------------------------------------------------------
  const buildPayload = (isDraft: boolean) => {
    const isValidUuid = (val?: string | null) =>
      !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

    let observations: any[] = [];

    if (isByShelf) {
      // INVENTORY BY LOCATION (PAR EMPLACEMENT):
      // Observation per article in this shelf
      const targetShelfId =
        (isValidUuid(currentShelf?.shelfId) ? currentShelf.shelfId : null) ||
        (isValidUuid(attempt?.unit?.shelfId) ? attempt.unit.shelfId : undefined);

      for (const eq of allShelfEquipments) {
        if (eq.hasSerialNumber) {
          const sns = shelfArticleSns[eq.equipmentId] || [];
          if (sns.length === 0) {
            observations.push({
              equipmentId: eq.equipmentId,
              shelfId: targetShelfId,
              quantityCalculated: 0,
              notes: notes.trim() || undefined,
            });
          } else {
            for (const sn of sns) {
              observations.push({
                equipmentId: eq.equipmentId,
                shelfId: targetShelfId,
                serialNumberId: isValidUuid(sn.serialNumberId) ? sn.serialNumberId : undefined,
                unknownItemEvidence: sn.isNew ? sn.code : undefined,
                quantityCalculated: 1,
                notes: sn.isNew
                  ? `S/N scanné non répertorié sur ${currentShelf?.shelfName || 'étagère'}: ${sn.code}`
                  : (notes.trim() || undefined),
              });
            }
          }
        } else {
          const qty = Number(shelfArticleCounts[eq.equipmentId]) || 0;
          observations.push({
            equipmentId: eq.equipmentId,
            shelfId: targetShelfId,
            quantityCalculated: qty,
            notes: notes.trim() || undefined,
          });
        }
      }
    } else {
      // INVENTORY BY EQUIPMENT (PAR ARTICLE):
      const fallbackShelfId =
        (isValidUuid(selectedShelfId) ? selectedShelfId : null) ||
        (isValidUuid(equipmentShelves[0]?.shelfId) ? equipmentShelves[0].shelfId : null) ||
        (isValidUuid(attempt?.unit?.shelfId) ? attempt.unit.shelfId : undefined);

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
        const entries = Object.entries(shelfCounts).filter(
          ([shId, qty]) => isValidUuid(shId) && Number(qty) >= 0
        );
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

  if (!attempt) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col items-center justify-center p-6 space-y-4">
        <div className="p-6 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] max-w-md text-center space-y-3 shadow-lg">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-sm font-semibold text-[#f7f5f0]">Tâche introuvable ou déjà complétée</h2>
          <p className="text-xs text-[#aea69c] leading-relaxed">
            Cette tâche de comptage n'est pas accessible ou a déjà été soumise.
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-1.5 text-xs bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] font-semibold px-3 py-1.5 rounded-[3px] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voir mes tâches disponibles</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Common Header Titles
  const targetShelfName = currentShelf?.shelfName || attempt?.unit?.shelf?.shelfName || 'Étagère';
  const targetEquipmentName =
    currentEquipment?.equipmentName ||
    attempt?.unit?.equipment?.equipmentName ||
    attempt?.unit?.shelf?.shelfName ||
    'Article';

  // Stats for ByShelf
  const totalShelfArticles = allShelfEquipments.length;
  const totalPhysicalUnitsCounted = allShelfEquipments.reduce((sum: number, eq: any) => {
    if (eq.hasSerialNumber) {
      return sum + (shelfArticleSns[eq.equipmentId]?.length || 0);
    }
    return sum + (shelfArticleCounts[eq.equipmentId] || 0);
  }, 0);
  const totalTheoreticalUnits = allShelfEquipments.reduce(
    (sum: number, eq: any) => sum + (eq.quantity || 0),
    0
  );

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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#aea69c] border border-[#3f3a36]">
                  {attempt?.unit?.inventory?.title || 'Inventaire'}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                  {isByShelf ? 'Mode : Par Emplacement (Rayon)' : 'Mode : Par Article'}
                </span>
                {isByShelf ? (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]">
                    {totalShelfArticles} article(s) à inventorier
                  </span>
                ) : (
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      hasSerialNumber
                        ? 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                        : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                    }`}
                  >
                    {hasSerialNumber ? 'Avec N° de série' : 'Sans N° de série'}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                {isByShelf ? (
                  <>
                    Comptage d'Emplacement : <span className="font-semibold">{targetShelfName}</span>
                  </>
                ) : (
                  <>
                    Tâche de comptage : <span className="font-semibold">{targetEquipmentName}</span>
                  </>
                )}
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
                Conformément à la politique SomePharm en double aveugle, au moins deux personnes distinctes
                doivent être assignées avant de pouvoir enregistrer ou soumettre des observations.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 1: INVENTAIRE PAR EMPLACEMENT (ByShelf)                              */}
        {/* ========================================================================= */}
        {isByShelf ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Main Content: Shelf Articles List & Inputs */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Target Shelf Identification Banner */}
              <section className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2a2522] space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3f3a36]">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-[4px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#aea69c]">
                          Emplacement Cible
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40 font-semibold">
                          Actif
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-[#f7f5f0]">{targetShelfName}</h2>
                      <p className="text-[11px] font-mono text-[#aea69c]">
                        ID: {currentShelf?.shelfId || attempt?.unit?.shelfId}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="px-3 py-1.5 rounded-[3px] bg-[#26221f] border border-[#3f3a36] text-right">
                      <span className="text-[10px] text-[#aea69c] block font-mono">ARTICLES SUR L'ÉTAGÈRE</span>
                      <span className="text-sm font-semibold text-[#f7f5f0] font-mono">
                        {totalShelfArticles} article(s)
                      </span>
                    </div>
                    <div className="px-3 py-1.5 rounded-[3px] bg-[#26221f] border border-[#3f3a36] text-right">
                      <span className="text-[10px] text-[#aea69c] block font-mono">UNITÉS PHYSIQUES</span>
                      <span className="text-sm font-semibold text-[#10b981] font-mono">
                        {totalPhysicalUnitsCounted} / {totalTheoreticalUnits} attendues
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] text-xs text-[#aea69c] flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#10b981] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Vous inventoriez l'emplacement <strong>"{targetShelfName}"</strong>. Pour chaque article
                    présent sur cet emplacement, saisissez la quantité physique observée. Pour les articles
                    sérialisés, scannez ou cochez chaque numéro de série observé.
                  </p>
                </div>
              </section>

              {/* Shelf Articles Toolbar & Search */}
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

              {/* List of Articles in this Shelf */}
              <div className="space-y-4">
                {filteredShelfEquipments.length === 0 ? (
                  <div className="p-8 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] text-center space-y-3">
                    <Package className="w-8 h-8 text-[#aea69c] mx-auto opacity-50" />
                    <p className="text-sm text-[#aea69c]">
                      {allShelfEquipments.length === 0
                        ? "Aucun article répertorié initialement sur cet emplacement."
                        : "Aucun article ne correspond à votre recherche."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddArticleModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ajouter un article présent physiquement</span>
                    </button>
                  </div>
                ) : (
                  filteredShelfEquipments.map((eq: any) => {
                    const isSerialized = eq.hasSerialNumber;
                    const expectedQty = eq.quantity || 0;
                    const countedQty = isSerialized
                      ? (shelfArticleSns[eq.equipmentId] || []).length
                      : (shelfArticleCounts[eq.equipmentId] ?? 0);
                    const delta = countedQty - expectedQty;
                    const expectedSns = eq.serialNumbers || [];
                    const currentSns = shelfArticleSns[eq.equipmentId] || [];
                    const currentScanInput = shelfScanInputs[eq.equipmentId] || '';

                    return (
                      <div
                        key={`shelf-eq-${eq.equipmentId}`}
                        className="rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] overflow-hidden transition-all shadow-xs"
                      >
                        {/* Article Header */}
                        <div className="p-4 bg-[#26221f] border-b border-[#383330] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start sm:items-center gap-3">
                            <div
                              className={`p-2 rounded-[3px] shrink-0 border ${
                                isSerialized
                                  ? 'bg-purple-950/40 text-purple-300 border-purple-800/50'
                                  : 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                              }`}
                            >
                              {isSerialized ? <Barcode className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm font-semibold text-[#f7f5f0]">{eq.equipmentName}</h3>
                                <span
                                  className={`text-[10px] font-mono px-2 py-0.2 rounded border font-medium ${
                                    isSerialized
                                      ? 'bg-purple-950/40 text-purple-300 border-purple-800/40'
                                      : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                                  }`}
                                >
                                  {isSerialized ? 'Sérialisé (N° de série)' : 'Quantitatif'}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-[#aea69c]">
                                Réf: {eq.equipmentId.slice(0, 8)}...
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap self-end sm:self-center">
                            <div className="px-2.5 py-1 rounded bg-[#1f1b18] border border-[#3f3a36] text-right">
                              <span className="text-[9px] text-[#aea69c] block font-mono">ATTENDU</span>
                              <span className="text-xs font-mono font-semibold text-[#f7f5f0]">
                                {expectedQty}
                              </span>
                            </div>
                            <div className="px-2.5 py-1 rounded bg-[#1f1b18] border border-[#3f3a36] text-right">
                              <span className="text-[9px] text-[#aea69c] block font-mono">COMPTÉ</span>
                              <span
                                className={`text-xs font-mono font-semibold ${
                                  countedQty > 0 ? 'text-[#10b981]' : 'text-[#f7f5f0]'
                                }`}
                              >
                                {countedQty}
                              </span>
                            </div>
                            <div
                              className={`px-2.5 py-1 rounded border text-[11px] font-mono font-semibold ${
                                delta === 0
                                  ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                                  : delta > 0
                                  ? 'bg-blue-950/40 text-blue-300 border-blue-800/40'
                                  : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
                              }`}
                            >
                              {delta === 0 ? '✓ Conforme' : delta > 0 ? `+${delta} Surplus` : `${delta} Déficit`}
                            </div>
                          </div>
                        </div>

                        {/* Article Body: Conditional Input Form */}
                        <div className="p-4 space-y-4">
                          {!isSerialized ? (
                            /* NON-SERIALIZED ARTICLE: QUANTITATIVE NUMERIC INPUT */
                            <div className="space-y-2 p-3 bg-[#1f1b18] border border-[#383330] rounded-[3px]">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-[#10b981]" />
                                  Quantité Observée sur "{targetShelfName}"
                                </label>
                                <span className="text-[10px] font-mono text-[#aea69c]">
                                  {expectedQty} unité(s) attendue(s)
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!isMultiUserValid}
                                  onClick={() =>
                                    handleUpdateShelfArticleCount(
                                      eq.equipmentId,
                                      Math.max(0, (shelfArticleCounts[eq.equipmentId] || 0) - 1)
                                    )
                                  }
                                  className="w-10 h-10 rounded-[3px] bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] font-mono text-base font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={!isMultiUserValid}
                                  value={shelfArticleCounts[eq.equipmentId] ?? ''}
                                  placeholder={String(expectedQty)}
                                  onChange={(e) =>
                                    handleUpdateShelfArticleCount(
                                      eq.equipmentId,
                                      Math.max(0, parseInt(e.target.value, 10) || 0)
                                    )
                                  }
                                  className="flex-1 h-10 bg-[#2f2a26] border border-[#3f3a36] rounded-[3px] px-3 text-base font-mono focus:outline-none focus:border-[#10b981] transition-colors text-[#f7f5f0] text-center"
                                />
                                <button
                                  type="button"
                                  disabled={!isMultiUserValid}
                                  onClick={() =>
                                    handleUpdateShelfArticleCount(
                                      eq.equipmentId,
                                      (shelfArticleCounts[eq.equipmentId] || 0) + 1
                                    )
                                  }
                                  className="w-10 h-10 rounded-[3px] bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] font-mono text-base font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
                                >
                                  +
                                </button>
                                {expectedQty > 0 && (
                                  <button
                                    type="button"
                                    disabled={!isMultiUserValid}
                                    onClick={() =>
                                      handleUpdateShelfArticleCount(eq.equipmentId, expectedQty)
                                    }
                                    className="h-10 px-3 bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] text-xs font-mono rounded-[3px] transition-colors cursor-pointer shrink-0"
                                    title="Copier la quantité théorique attendue"
                                  >
                                    = {expectedQty} (Conforme)
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* SERIALIZED ARTICLE: SCANNER & SERIAL NUMBERS CHECKLIST */
                            <div className="space-y-3.5 p-3.5 bg-[#1f1b18] border border-[#383330] rounded-[3px]">
                              {/* Serial Notice */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-[#2a2522] border border-[#383330] rounded-[3px]">
                                <span className="text-xs font-mono text-purple-200 flex items-center gap-1.5">
                                  <Barcode className="w-4 h-4 text-purple-400" />
                                  Traçabilité unitaire par N° de série :
                                </span>
                                <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]">
                                  Validés : <strong className="text-[#10b981]">{currentSns.length}</strong> / {expectedSns.length}
                                </span>
                              </div>

                              {/* Barcode & QR Scanner Bar */}
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1">
                                  <Barcode className="w-3.5 h-3.5 text-[#10b981]" />
                                  SCANNER OU SAISIR LE NUMÉRO DE SÉRIE
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    disabled={!isMultiUserValid}
                                    placeholder="Scanner ou taper le S/N puis Entrée..."
                                    value={currentScanInput}
                                    onChange={(e) =>
                                      setShelfScanInputs((prev) => ({
                                        ...prev,
                                        [eq.equipmentId]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddShelfArticleSn(eq.equipmentId);
                                      }
                                    }}
                                    className="flex-1 h-9 px-3 text-xs bg-[#2f2a26] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] placeholder:text-[#6a625b] font-mono focus:outline-none focus:border-[#10b981] disabled:opacity-50"
                                  />
                                  <button
                                    type="button"
                                    disabled={!isMultiUserValid || !currentScanInput.trim()}
                                    onClick={() => handleAddShelfArticleSn(eq.equipmentId)}
                                    className="px-3 h-9 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] font-semibold text-xs rounded-[3px] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1 shrink-0"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Ajouter
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!isMultiUserValid}
                                    onClick={() => startCameraScanner(eq.equipmentId)}
                                    className="px-3 h-9 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-mono rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                                    title="Scanner avec la caméra du smartphone"
                                  >
                                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="hidden sm:inline">Caméra</span>
                                  </button>
                                </div>
                              </div>

                              {/* Action Buttons for Serial Numbers */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#383330]">
                                <div className="flex items-center gap-2">
                                  {expectedSns.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={!isMultiUserValid}
                                      onClick={() => handleBatchCheckAllForShelfArticle(eq.equipmentId)}
                                      className="text-[11px] font-mono px-2.5 py-1 rounded-[2px] bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> Cocher tous les attendus ({expectedSns.length})
                                    </button>
                                  )}
                                  {currentSns.length > 0 && (
                                    <button
                                      type="button"
                                      disabled={!isMultiUserValid}
                                      onClick={() => handleClearShelfArticleSns(eq.equipmentId)}
                                      className="text-[11px] font-mono px-2 py-1 rounded-[2px] bg-[#383330] hover:bg-red-900/30 text-red-400 border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" /> Réinitialiser
                                    </button>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-[#aea69c]">
                                  {expectedSns.length} S/N attendus
                                </span>
                              </div>

                              {/* Checklist of Expected Serial Numbers on this shelf */}
                              {expectedSns.length > 0 && (
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-mono text-[#aea69c] uppercase block">
                                    Numéros de série attendus sur cet emplacement (Cliquer pour valider) :
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[#26221f] border border-[#3f3a36] rounded-[3px]">
                                    {expectedSns.map((sn: any) => {
                                      const isCounted = currentSns.some(
                                        (c) =>
                                          (sn.serialNumberId && c.serialNumberId === sn.serialNumberId) ||
                                          c.code.toLowerCase() === sn.serialNumberCode?.toLowerCase()
                                      );

                                      return (
                                        <button
                                          key={`sh-sn-${sn.serialNumberId || sn.serialNumberCode}`}
                                          type="button"
                                          disabled={!isMultiUserValid}
                                          onClick={() => handleToggleShelfArticleSn(eq.equipmentId, sn)}
                                          className={`text-[11px] font-mono px-2 py-0.8 rounded-[2px] border transition-all cursor-pointer flex items-center gap-1.5 ${
                                            isCounted
                                              ? 'bg-[#10b981]/25 border-[#10b981] text-[#f7f5f0] font-medium'
                                              : 'bg-[#1f1b18] border-[#3f3a36] text-[#aea69c] hover:border-[#aea69c] hover:text-[#f7f5f0]'
                                          }`}
                                        >
                                          <span className={isCounted ? 'text-[#10b981] font-bold' : 'text-[#5c544d]'}>
                                            {isCounted ? '✓' : '○'}
                                          </span>
                                          <span>{sn.serialNumberCode}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Counted Serial Numbers Tag Cloud */}
                              {currentSns.length > 0 && (
                                <div className="space-y-1 pt-2 border-t border-[#383330]">
                                  <div className="flex items-center justify-between text-[10px] text-[#aea69c]">
                                    <span className="font-mono uppercase flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-[#10b981]" />
                                      Valeurs saisies ({currentSns.length}) :
                                    </span>
                                    <span>Cliquer sur la croix pour retirer</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                    {currentSns.map((sn) => (
                                      <span
                                        key={`counted-sn-${eq.equipmentId}-${sn.code}`}
                                        className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] flex items-center gap-1.5 ${
                                          sn.isNew
                                            ? 'bg-amber-950/40 border border-amber-600/50 text-amber-200'
                                            : 'bg-[#10b981]/20 border border-[#10b981]/40 text-[#f7f5f0]'
                                        }`}
                                      >
                                        <span>{sn.code}</span>
                                        {sn.isNew && (
                                          <span className="text-[9px] text-amber-400 font-sans">(Nouveau)</span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveShelfArticleSn(eq.equipmentId, sn.code)}
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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Sidebar: Shelf Summary, Actions & Notes */}
            <div className="space-y-4">
              {/* Emplacement Executive Summary */}
              <div className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
                  <h3 className="text-xs font-semibold text-[#f7f5f0] uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-[#10b981]" />
                    Résumé Emplacement
                  </h3>
                  <span className="text-[10px] font-mono text-[#aea69c]">{targetShelfName}</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-[#383330]/50">
                    <span className="text-[#aea69c]">Articles inventoriés</span>
                    <span className="font-mono font-semibold text-[#f7f5f0]">{totalShelfArticles}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-[#383330]/50">
                    <span className="text-[#aea69c]">Total unités physiques</span>
                    <span className="font-mono font-bold text-[#10b981]">{totalPhysicalUnitsCounted}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-[#aea69c]">Stock théorique total</span>
                    <span className="font-mono text-[#aea69c]">{totalTheoreticalUnits}</span>
                  </div>
                </div>
              </div>

              {/* Actions Panel */}
              <div className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
                <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Actions</h3>
                <button
                  type="button"
                  disabled={!isMultiUserValid}
                  onClick={async () => {
                    try {
                      await submitTask({ taskId, data: buildPayload(true) });
                      toast.success('Brouillon sauvegardé avec succès');
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
                      toast.success('Comptage de l’emplacement soumis avec succès');
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

              {/* Notes & Observations Field */}
              <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-2">
                <label className="text-[10px] font-mono text-[#aea69c] uppercase block">
                  NOTES & OBSERVATIONS SUR CET EMPLACEMENT
                </label>
                <textarea
                  rows={3}
                  disabled={!isMultiUserValid}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Rayon propre, étiquettes conformes, 1 article sans emballage..."
                  className="w-full bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] p-2.5 text-xs text-[#f7f5f0] placeholder:text-[#6a625b] focus:outline-none focus:border-[#10b981] disabled:opacity-50 font-mono resize-none"
                />
              </div>

              {/* Participants Panel */}
              <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Participants</h3>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isMultiUserValid
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {uniqueParticipantsCount} / 2 min
                  </span>
                </div>
                <div className="space-y-1.5">
                  {participants.map((p: any) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between text-xs py-1 border-b border-[#383330] last:border-none"
                    >
                      <span
                        className="text-[#f7f5f0] truncate max-w-[140px]"
                        title={p.User?.userName || p.User?.userEmail || p.userId}
                      >
                        {p.User?.userName || p.User?.userEmail || p.userId.slice(0, 8)}
                      </span>
                      <span className="text-[10px] font-mono text-[#aea69c]">
                        {p.sequence === 0 ? 'Contrôleur (Comptage)' : '3ème Contrôleur (Arbitrage)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* VIEW 2: INVENTAIRE PAR ARTICLE (ByEquipment)                              */
          /* ========================================================================= */
          <>
            {/* Reference View: Equipment & Shelves */}
            <section className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2a2522] space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3f3a36]">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-[4px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                    <Boxes className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#aea69c]">
                        Article inventorié
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                        Cible active
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-[#f7f5f0]">{targetEquipmentName}</h2>
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
                    <span
                      className={`text-xs font-semibold font-mono flex items-center justify-end gap-1 ${
                        hasSerialNumber ? 'text-[#10b981]' : 'text-amber-400'
                      }`}
                    >
                      {hasSerialNumber ? <Barcode className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                      {hasSerialNumber ? 'Avec N° de série' : 'Sans N° de série'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Shelves Breakdown */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#aea69c] uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#10b981]" />
                    Emplacements où se trouve cet article :
                  </span>
                  <span className="text-[11px] text-[#aea69c] font-mono">
                    {equipmentShelves.length} emplacement(s) répertorié(s)
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
                    Aucun emplacement spécifique défini.
                  </div>
                )}
              </div>
            </section>

            {/* ByEquipment Observation Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="md:col-span-2 space-y-6">
                <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
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
                      {/* Target Article Notice */}
                      <div className="space-y-2 pb-3 border-b border-[#383330]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono text-[#aea69c]">
                          <span>Élément cible :</span>
                          <span className="text-[#f7f5f0] font-semibold text-sm">{targetEquipmentName}</span>
                        </div>
                      </div>

                      {/* Shelf Selector Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                          EMPLACEMENT OBSERVÉ
                        </label>
                        <select
                          disabled={!isMultiUserValid}
                          value={selectedShelfId}
                          onChange={(e) => setSelectedShelfId(e.target.value)}
                          className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[3px] px-3 text-xs focus:outline-none focus:border-[#aea69c] transition-colors text-[#f7f5f0] disabled:opacity-50 font-mono"
                        >
                          <option value="">-- Sélectionner l'emplacement observé --</option>
                          {equipmentShelves.length > 0 && (
                            <optgroup label="Emplacements de cet article">
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

                      {/* Non-Serialized Input */}
                      {!hasSerialNumber ? (
                        <div className="space-y-2 p-3.5 bg-[#2a2522] border border-[#3f3a36] rounded-[3px]">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1.5">
                              <Package className="w-3.5 h-3.5 text-[#10b981]" />
                              QUANTITÉ OBSERVÉE (COMPTÉE PHYSIQUEMENT)
                            </label>
                            {selectedShelfObj && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#383330] text-[#aea69c] border border-[#3f3a36]">
                                {selectedShelfObj.quantity} attendus sur cet emplacement
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
                              >
                                = {selectedShelfObj.quantity} (Conforme)
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Serialized Input */
                        <div className="space-y-4 p-4 bg-[#2a2522] border border-[#3f3a36] rounded-[3px]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px]">
                            <span className="text-xs font-mono text-[#f7f5f0] flex items-center gap-1.5">
                              <Barcode className="w-4 h-4 text-[#10b981]" />
                              Saisie unitaire des N° de série :
                            </span>
                            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#383330] text-[#f7f5f0] border border-[#3f3a36]">
                              Comptés ici : <strong className="text-[#10b981]">{countedSnsForSelectedShelf.length}</strong> / {expectedSnsForSelectedShelf.length}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              disabled={!isMultiUserValid}
                              placeholder="Scanner ou taper le S/N puis Entrée..."
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
                            <button
                              type="button"
                              disabled={!isMultiUserValid}
                              onClick={() => startCameraScanner()}
                              className="px-3 h-9 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-mono rounded-[3px] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                            >
                              <Camera className="w-3.5 h-3.5 text-purple-400" />
                              <span>Caméra</span>
                            </button>
                          </div>

                          {/* Fast Action Buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#383330]">
                            <button
                              type="button"
                              disabled={!isMultiUserValid || expectedSnsForSelectedShelf.length === 0}
                              onClick={handleBatchCheckAllForShelf}
                              className="text-[11px] font-mono px-2.5 py-1 rounded-[2px] bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Cocher tous les attendus sur cet emplacement ({expectedSnsForSelectedShelf.length})
                            </button>
                            {countedSnsForSelectedShelf.length > 0 && (
                              <button
                                type="button"
                                disabled={!isMultiUserValid}
                                onClick={handleClearCountedForShelf}
                                className="text-[11px] font-mono px-2 py-1 rounded-[2px] bg-[#383330] hover:bg-red-900/30 text-red-400 border border-[#3f3a36] transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Réinitialiser
                              </button>
                            )}
                          </div>

                          {/* Checklist */}
                          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2.5 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px]">
                            {filteredChecklistSns.map((sn: any) => {
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
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Notes Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono text-[#aea69c] uppercase">
                          NOTES & OBSERVATIONS (OPTIONNEL)
                        </label>
                        <input
                          type="text"
                          disabled={!isMultiUserValid}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Ex: Emballage intact, 2 pièces déplacées..."
                          className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[3px] px-3 text-xs focus:outline-none focus:border-[#aea69c] transition-colors text-[#f7f5f0] disabled:opacity-50"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* ByEquipment Sidebar */}
              <div className="space-y-4">
                <div className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-4">
                  <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Actions</h3>
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

                <div className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Participants</h3>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isMultiUserValid
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-red-950 text-red-300 border border-red-800'
                      }`}
                    >
                      {uniqueParticipantsCount} / 2 min
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {participants.map((p: any) => (
                      <div
                        key={p.userId}
                        className="flex items-center justify-between text-xs py-1 border-b border-[#383330] last:border-none"
                      >
                        <span className="text-[#f7f5f0] truncate max-w-[140px]">
                          {p.User?.userName || p.User?.userEmail || p.userId.slice(0, 8)}
                        </span>
                        <span className="text-[10px] font-mono text-[#aea69c]">
                          {p.sequence === 0 ? 'Contrôleur (Comptage)' : '3ème Contrôleur (Arbitrage)'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================================================================= */}
        {/* MODAL: ADD ARTICLE TO CURRENT SHELF (Catalog Picker)                     */}
        {/* ========================================================================= */}
        {isAddArticleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
            <div className="bg-[#2f2a26] border border-[#3f3a36] rounded-[4px] max-w-lg w-full p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#3f3a36]">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-[#10b981]" />
                  <h3 className="text-base font-semibold text-[#f7f5f0]">
                    Ajouter un article sur "{targetShelfName}"
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddArticleModalOpen(false)}
                  className="p-1 rounded text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#383330] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-[#aea69c]" />
                <input
                  type="text"
                  placeholder="Rechercher par nom d'article dans le catalogue..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 text-xs bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] placeholder:text-[#6a625b] font-mono focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {availableCatalogEquipments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#aea69c]">
                    Aucun article disponible à ajouter.
                  </div>
                ) : (
                  availableCatalogEquipments.map((eq: any) => (
                    <div
                      key={`cat-${eq.equipmentId}`}
                      className="p-2.5 rounded-[3px] border border-[#3f3a36] bg-[#26221f] hover:border-[#aea69c] flex items-center justify-between gap-2 transition-colors"
                    >
                      <div>
                        <span className="text-xs font-medium text-[#f7f5f0] block">
                          {eq.equipmentName}
                        </span>
                        <span className="text-[10px] font-mono text-[#aea69c] flex items-center gap-1.5">
                          {eq.hasSerialNumber ? (
                            <span className="text-purple-400">● Sérialisé (N° de série)</span>
                          ) : (
                            <span className="text-[#10b981]">● Quantitatif</span>
                          )}
                          <span>Stock global : {eq.equipmentQuantity ?? 0}</span>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddEquipmentFromCatalog(eq)}
                        className="px-3 py-1 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] text-xs font-semibold rounded-[2px] transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-[#3f3a36] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsAddArticleModalOpen(false)}
                  className="px-4 py-2 bg-[#383330] hover:bg-[#3f3a36] text-xs text-[#f7f5f0] rounded-[3px] cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CAMERA QR / BARCODE SCANNER                                        */}
        {/* ========================================================================= */}
        {isCameraScannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
            <div className="bg-[#26221f] border border-[#3f3a36] rounded-[6px] max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
              {/* Header */}
              <div className="p-4 bg-[#1f1b18] border-b border-[#3f3a36] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-5 h-5 text-[#10b981]" />
                  <div>
                    <h3 className="text-sm font-semibold text-[#f7f5f0]">Scanner QR & Code-barres</h3>
                    <p className="text-[10px] font-mono text-[#aea69c]">Caméra active en continu</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="p-1.5 rounded text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#383330] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Viewfinder Viewport */}
              <div className="relative aspect-square w-full bg-black flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Guide overlay viewport frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-[#10b981] rounded-lg relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-[#10b981] -mt-1 -ml-1" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-[#10b981] -mt-1 -mr-1" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-[#10b981] -mb-1 -ml-1" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-[#10b981] -mb-1 -mr-1" />
                    <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500/80 animate-pulse" />
                  </div>
                </div>

                {!isCameraActive && (
                  <div className="absolute inset-0 bg-[#1f1b18] flex flex-col items-center justify-center p-6 text-center space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-[#10b981]" />
                    <span className="text-xs text-[#aea69c]">Initialisation de la caméra...</span>
                  </div>
                )}
              </div>

              {/* Footer notice */}
              <div className="p-4 bg-[#1f1b18] border-t border-[#3f3a36] flex items-center justify-between">
                <span className="text-xs text-[#aea69c] font-mono">
                  Pointez vers le code pour l'ajouter automatiquement
                </span>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="px-4 py-2 bg-[#f7f5f0] text-[#2b2622] font-semibold text-xs rounded-[3px] hover:bg-[#dad2c1] cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
