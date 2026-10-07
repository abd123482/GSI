"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Barcode,
  Loader2,
  Package,
  Plus,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

import { useApi } from "@/hooks/use-api";

import { usePermissions } from "@/hooks/use-permissions";

import { useCreateMovement } from "@/hooks/use-movements";

import { MovementService } from "@/services/movement.service";

import { getErrorMessage } from "@/lib/error-message";

import type { Equipment, SerialNumber } from "@/types/equipment";

import type { MovementDraftLine, MovementType, CreateMovementItemInput } from "@/types/movement";

interface CreateMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function clientId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CreateMovementModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateMovementModalProps) {
  const api = useApi();

  const { permissions, canCreateMovement } = usePermissions();

  const createMovement = useCreateMovement();

  const [movementType, setMovementType] = useState<MovementType>("IN");

  const [happenedAt, setHappenedAt] = useState("");

  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");

  const [selectedSerialId, setSelectedSerialId] = useState("");

  const [quantity, setQuantity] = useState(1);

  const [sourceShelfId, setSourceShelfId] = useState("");

  const [destinationShelfId, setDestinationShelfId] = useState("");

  const [newSerialCode, setNewSerialCode] = useState("");

  const [serialEntryMode, setSerialEntryMode] = useState<"NEW" | "EXISTING">("NEW");

  const [lines, setLines] = useState<MovementDraftLine[]>([]);

  const [error, setError] = useState<string | null>(null);

  const equipmentQuery = useQuery({
    queryKey: ["movement-create", "active-equipments"],

    queryFn: () => MovementService.getAllActiveEquipments(api),

    enabled: isOpen,

    staleTime: 30_000,
  });

  const shelfQuery = useQuery({
    queryKey: ["movement-create", "active-shelves"],

    queryFn: () => MovementService.getAllActiveShelves(api),

    enabled: isOpen,

    staleTime: 30_000,
  });

  const selectedEquipment = useMemo(
    () =>
      (equipmentQuery.data ?? []).find(
        (equipment) => equipment.equipmentId === selectedEquipmentId,
      ) ?? null,
    [equipmentQuery.data, selectedEquipmentId],
  );

  const allocationsQuery = useQuery({
    queryKey: ["movement-create", "allocations", selectedEquipmentId],

    queryFn: () =>
      MovementService.getEquipmentAllocations(
        api,
        selectedEquipmentId,
        permissions,
      ),

    enabled: isOpen && Boolean(selectedEquipmentId),

    staleTime: 10_000,
  });

  const serialsQuery = useQuery({
    queryKey: ["movement-create", "serials", selectedEquipmentId],

    queryFn: () =>
      MovementService.getAllEquipmentSerials(
        api,
        selectedEquipmentId,
        permissions,
      ),

    enabled: isOpen && Boolean(selectedEquipment?.hasSerialNumber),

    staleTime: 10_000,
  });

  const allocations = allocationsQuery.data?.equipmentShelfs ?? [];

  const activeShelves = shelfQuery.data ?? [];

  const serials = serialsQuery.data ?? [];

  const selectedSerial = useMemo(
    () =>
      serials.find((serial) => serial.serialNumberId === selectedSerialId) ??
      null,
    [serials, selectedSerialId],
  );

  const allocatedShelfIds = useMemo(
    () =>
      new Set(
        allocations
          .filter((allocation) => allocation.equipmentQuantity > 0)
          .map((allocation) => allocation.shelfId),
      ),
    [allocations],
  );

  const sourceCandidates = useMemo(() => {
    if (
      movementType === "IN" ||
      !selectedEquipment ||
      selectedEquipment.hasSerialNumber
    ) {
      return [];
    }

    return allocations.filter(
      (allocation) => allocation.equipmentQuantity >= quantity,
    );
  }, [allocations, movementType, quantity, selectedEquipment, sourceShelfId]);

  const serialCandidates = useMemo(() => {
    if (!selectedEquipment?.hasSerialNumber) {
      return [];
    }

    if (movementType === "IN") {
      return serials.filter((serial) => serial.shelfId === null);
    }

    return serials.filter((serial) => Boolean(serial.shelfId));
  }, [movementType, selectedEquipment, serials, sourceShelfId]);

  const destinationCandidates = useMemo(() => {
    if (movementType === "OUT") {
      return [];
    }

    if (movementType === "IN") {
      return activeShelves;
    }

    return activeShelves.filter(
      (shelf) =>
        shelf.shelfId !== sourceShelfId &&
        !allocatedShelfIds.has(shelf.shelfId),
    );
  }, [activeShelves, allocatedShelfIds, movementType, sourceShelfId]);

  const routeDestinationAllowedForCurrentEquipment =
    movementType !== "TRANSFER" ||
    !destinationShelfId ||
    destinationShelfId !== sourceShelfId;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMovementType("IN");
    setSelectedEquipmentId("");
    setSelectedSerialId("");
    setQuantity(1);
    setSourceShelfId("");
    setDestinationShelfId("");
    setNewSerialCode("");
    setSerialEntryMode("NEW");
    setLines([]);
    setError(null);
  }, [isOpen]);

  useEffect(() => {
    setSelectedSerialId("");
    setQuantity(1);
    setNewSerialCode("");

    setSourceShelfId("");
    setDestinationShelfId("");
  }, [selectedEquipmentId]);

  useEffect(() => {
    if (movementType === "IN" || !selectedEquipment?.hasSerialNumber) {
      return;
    }

    setSourceShelfId(selectedSerial?.shelfId ?? "");
  }, [movementType, selectedEquipment, selectedSerial]);

  useEffect(() => {
    if (selectedEquipment?.hasSerialNumber || movementType === "IN") {
      return;
    }

    if (
      sourceShelfId &&
      !sourceCandidates.some(
        (allocation) => allocation.shelfId === sourceShelfId,
      )
    ) {
      setSourceShelfId("");
    }
  }, [
    movementType,
    quantity,

    selectedEquipment,
    sourceCandidates,
    sourceShelfId,
  ]);

  useEffect(() => {
    if (movementType !== "TRANSFER") {
      return;
    }

    if (
      destinationShelfId &&
      !destinationCandidates.some(
        (shelf) => shelf.shelfId === destinationShelfId,
      )
    ) {
      setDestinationShelfId("");
    }
  }, [destinationCandidates, destinationShelfId, movementType]);

  if (!isOpen) {
    return null;
  }

  const busy = createMovement.isPending;

  const currentSourceAllocation = allocations.find(
    (allocation) => allocation.shelfId === sourceShelfId,
  );

  const sourceName =
    currentSourceAllocation?.shelf?.shelfName ??
    activeShelves.find((shelf) => shelf.shelfId === sourceShelfId)?.shelfName ??
    "";

  const destinationName =
    activeShelves.find((shelf) => shelf.shelfId === destinationShelfId)
      ?.shelfName ?? "";

  function changeType(type: MovementType) {
    if (busy) {
      return;
    }

    setMovementType(type);
    setSelectedEquipmentId("");
    setSelectedSerialId("");
    setQuantity(1);
    setSourceShelfId("");
    setDestinationShelfId("");
    setLines([]);
    setError(null);
  }

  function addLine() {
    setError(null);
    const sourceName =
      movementType === "IN"
        ? "EXTÉRIEUR"
        : ((shelfQuery.data ?? []).find((s: any) => s.shelfId === sourceShelfId)
            ?.shelfName ?? "Inconnu");
    const destinationName =
      movementType === "OUT"
        ? "EXTÉRIEUR"
        : ((shelfQuery.data ?? []).find(
            (s: any) => s.shelfId === destinationShelfId,
          )?.shelfName ?? "Inconnu");

    if (!selectedEquipment) {
      setError("Sélectionnez un article.");
      return;
    }

    if (selectedEquipment.equipmentStatus === false) {
      setError("Un article INACTIVE ne peut pas être déplacé.");
      return;
    }

    const serialized = selectedEquipment.hasSerialNumber;

    const lineQuantity = serialized ? 1 : Number(quantity);

    if (!Number.isInteger(lineQuantity) || lineQuantity <= 0) {
      setError("La quantité doit être un entier strictement positif.");
      return;
    }

    if (movementType !== "IN" && !sourceShelfId) {
      setError("Sélectionnez une source contenant cet article.");
      return;
    }

    if (movementType !== "OUT" && !destinationShelfId) {
      setError("Sélectionnez un emplacement destination ACTIVE.");
      return;
    }

    if (
      movementType === "TRANSFER" &&
      !routeDestinationAllowedForCurrentEquipment
    ) {
      setError(
        "La destination sélectionnée est déjà allouée à cet article. Choisissez un autre emplacement.",
      );
      return;
    }

    if (serialized) {
      if (movementType === "IN" && serialEntryMode === "NEW") {
        if (!newSerialCode.trim()) {
          setError("Saisissez un nouveau code de série.");
          return;
        }

        if (lines.some((line) => line.serialNumberCode?.toLowerCase() === newSerialCode.trim().toLowerCase())) {
          setError("Ce code de série est déjà ajouté au mouvement.");
          return;
        }
      } else {
        if (!selectedSerial) {
          setError("Sélectionnez un numéro de série.");
          return;
        }

        if (movementType === "IN" && selectedSerial.shelfId !== null) {
          setError(
            "Pour une entrée, le numéro de série doit être hors emplacement.",
          );
          return;
        }

        if (movementType !== "IN" && selectedSerial.shelfId !== sourceShelfId) {
          setError(
            "Ce numéro de série n’est pas présent dans la source du mouvement.",
          );
          return;
        }

        if (
          lines.some(
            (line) => line.serialNumberId === selectedSerial.serialNumberId,
          )
        ) {
          setError("Ce numéro de série est déjà ajouté au mouvement.");
          return;
        }
      }
    } else {
      // Removed the restriction that prevents a standard article from appearing multiple times.

      if (movementType !== "IN") {
        const allocation = allocations.find(
          (item) => item.shelfId === sourceShelfId,
        );

        if (!allocation || allocation.equipmentQuantity < lineQuantity) {
          setError(
            "La source sélectionnée ne contient pas une quantité suffisante.",
          );
          return;
        }
      }
    }

    if (lines.length >= 100) {
      setError("Un mouvement ne peut pas dépasser 100 lignes.");
      return;
    }

    setLines((current) => [
      ...current,
      {
        sourceName: movementType === "IN" ? "EXTÉRIEUR" : sourceName,
        destinationName: movementType === "OUT" ? "EXTÉRIEUR" : destinationName,
        sourceShelfId: movementType === "IN" ? null : sourceShelfId,
        destinationShelfId: movementType === "OUT" ? null : destinationShelfId,
        clientId: clientId(),
        equipmentId: selectedEquipment.equipmentId,
        equipmentName: selectedEquipment.equipmentName ?? "Article",
        hasSerialNumber: serialized,
        serialNumberId: serialEntryMode === "NEW" && movementType === "IN" ? null : (selectedSerial?.serialNumberId ?? null),
        serialNumberCode: serialEntryMode === "NEW" && movementType === "IN" ? newSerialCode.trim() : (selectedSerial?.serialNumberCode ?? null),
        movementQuantity: lineQuantity,
      },
    ]);

    setSelectedEquipmentId("");
    setSelectedSerialId("");
    setNewSerialCode("");
    setQuantity(1);
  }

  function removeLine(id: string) {
    setLines((current) => {
      const next = current.filter((line) => line.clientId !== id);

      if (next.length === 0) {
        setSourceShelfId("");
        setDestinationShelfId("");
      }

      return next;
    });
  }

  async function submit() {
    setError(null);

    if (!canCreateMovement) {
      setError("Permission 'movement.create' requise.");
      return;
    }

    let payloadItems: CreateMovementItemInput[] = lines.map((line) => ({
      equipmentId: line.equipmentId,
      serialNumberId: line.serialNumberId,
      serialNumberCode: line.serialNumberId ? undefined : (line.serialNumberCode ?? undefined),
      movementQuantity: line.movementQuantity,
      sourceShelfId: movementType === "IN" ? null : line.sourceShelfId,
      destinationShelfId:
        movementType === "OUT" ? null : line.destinationShelfId,
    }));

    if (payloadItems.length === 0) {
      if (selectedEquipment) {
        if (!selectedEquipment.equipmentStatus) {
          setError("Un article INACTIVE ne peut pas être déplacé.");
          return;
        }

        const serialized = selectedEquipment.hasSerialNumber;
        const lineQuantity = serialized ? 1 : Number(quantity);

        if (!Number.isInteger(lineQuantity) || lineQuantity <= 0) {
          setError("La quantité doit être un entier strictement positif.");
          return;
        }

        if (movementType !== "IN" && !sourceShelfId) {
          setError("Sélectionnez une source contenant cet article.");
          return;
        }

        if (movementType !== "OUT" && !destinationShelfId) {
          setError("Sélectionnez un emplacement destination ACTIVE.");
          return;
        }

        if (
          movementType === "TRANSFER" &&
          !routeDestinationAllowedForCurrentEquipment
        ) {
          setError(
            "La destination sélectionnée est déjà allouée à cet article. Choisissez un autre emplacement.",
          );
          return;
        }

        if (serialized) {
          if (movementType === "IN" && serialEntryMode === "NEW") {
            if (!newSerialCode.trim()) {
              setError("Saisissez un nouveau code de série.");
              return;
            }
          } else {
            if (!selectedSerial) {
              setError("Sélectionnez un numéro de série.");
              return;
            }
            if (movementType === "IN" && selectedSerial.shelfId !== null) {
              setError(
                "Pour une entrée, le numéro de série doit être hors emplacement.",
              );
              return;
            }
            if (
              movementType !== "IN" &&
              selectedSerial.shelfId !== sourceShelfId
            ) {
              setError(
                "Ce numéro de série n’est pas présent dans la source du mouvement.",
              );
              return;
            }
          }
        } else {
          if (movementType !== "IN") {
            const allocation = allocations.find(
              (item) => item.shelfId === sourceShelfId,
            );
            if (!allocation || allocation.equipmentQuantity < lineQuantity) {
              setError(
                "La source sélectionnée ne contient pas une quantité suffisante.",
              );
              return;
            }
          }
        }

        payloadItems = [
          {
            equipmentId: selectedEquipment.equipmentId,
            serialNumberId: serialEntryMode === "NEW" && movementType === "IN" ? null : (selectedSerial?.serialNumberId ?? null),
            serialNumberCode: serialEntryMode === "NEW" && movementType === "IN" ? newSerialCode.trim() : undefined,
            movementQuantity: lineQuantity,
            sourceShelfId: movementType === "IN" ? null : sourceShelfId,
            destinationShelfId:
              movementType === "OUT" ? null : destinationShelfId,
          },
        ];
      } else {
        setError(
          'Ajoutez au moins une ligne en utilisant le bouton "+ Ajouter la ligne", ou remplissez le formulaire.',
        );
        document.querySelector(".overflow-y-auto")?.scrollTo(0, 0);
        return;
      }
    }

    if (happenedAt && new Date(happenedAt) > new Date()) {
      setError("La date du mouvement ne peut pas être dans le futur.");
      document.querySelector(".overflow-y-auto")?.scrollTo(0, 0);
      return;
    }

    try {
      await createMovement.mutateAsync({
        movementType,
        happenedAt: happenedAt ? new Date(happenedAt).toISOString() : undefined,
        items: payloadItems,
      });

      onSuccess?.();
      onClose();
    } catch (cause: unknown) {
      setError(getErrorMessage(cause, "Le mouvement a été refusé."));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="my-8 flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#3f3f46] bg-[#27272a] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[#3f3f46] bg-[#26221f] px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Nouveau mouvement</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded p-2 text-white/60 hover:bg-white/10 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {error && (
            <div className="flex gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <TypeButton
              active={movementType === "IN"}
              icon={ArrowDownToLine}
              title="Entrée"
              onClick={() => changeType("IN")}
              disabled={busy}
            />

            <TypeButton
              active={movementType === "OUT"}
              icon={ArrowUpFromLine}
              title="Sortie"
              onClick={() => changeType("OUT")}
              disabled={busy}
            />

            <TypeButton
              active={movementType === "TRANSFER"}
              icon={ArrowRightLeft}
              title="Transfert"
              onClick={() => changeType("TRANSFER")}
              disabled={busy}
            />
          </div>

          <label className="block space-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Date et Heure du mouvement (optionnel)
            </span>
            <input
              type="datetime-local"
              value={happenedAt}
              onChange={(e) => setHappenedAt(e.target.value)}
              disabled={busy}
              max={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
              className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-xs text-white outline-none focus:border-[#52525b]"
            />
          </label>

          <section className="space-y-4 rounded-xl border border-[#3f3f46] bg-[#18181b]/55 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold">Ajouter une ligne</h3>
              </div>

              {false && (
                <span className="rounded border border-sky-400/20 bg-sky-950/20 px-2 py-1 text-[10px] text-sky-200">
                  Trajet verrouillé
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Article ACTIVE
                </span>

                <select
                  value={selectedEquipmentId}
                  onChange={(event) =>
                    setSelectedEquipmentId(event.target.value)
                  }
                  disabled={busy || equipmentQuery.isLoading}
                  className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-xs"
                >
                  <option value="">Sélectionnez un article</option>

                  {(equipmentQuery.data ?? []).map((equipment) => (
                    <option
                      key={equipment.equipmentId}
                      value={equipment.equipmentId}
                    >
                      {equipment.equipmentName ?? "Article"} —{" "}
                      {equipment.hasSerialNumber ? "Sérialisé" : "Standard"}
                    </option>
                  ))}
                </select>

                {selectedEquipment && allocations.length > 0 && (
                  <div className="mt-2 text-[10px] text-[#a1a1aa]">
                    <span className="font-semibold text-white/70">
                      Stock actuel :{" "}
                    </span>
                    {allocations
                      .map(
                        (a) => `${a.shelf?.shelfName} (${a.equipmentQuantity})`,
                      )
                      .join(" • ")}
                  </div>
                )}
              </label>

              {selectedEquipment && !selectedEquipment.hasSerialNumber && (
                <label className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                    Quantité
                  </span>

                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(Math.max(1, Number(event.target.value) || 1))
                    }
                    disabled={busy}
                    className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 font-mono text-xs"
                  />
                </label>
              )}
            </div>

            {selectedEquipment?.hasSerialNumber && (
              <label className="block space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                    Numéro de série
                  </span>
                  
                  {movementType === "IN" && (
                    <div className="flex bg-[#1f1b18] border border-[#3f3f46] rounded text-[10px] overflow-hidden">
                      <button
                        type="button"
                        className={`px-3 py-1 transition ${serialEntryMode === "NEW" ? "bg-[#453e3a] text-white font-semibold" : "text-white/40 hover:text-white/70"}`}
                        onClick={() => {
                          setSerialEntryMode("NEW");
                          setSelectedSerialId("");
                        }}
                      >
                        Nouveau
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 transition ${serialEntryMode === "EXISTING" ? "bg-[#453e3a] text-white font-semibold" : "text-white/40 hover:text-white/70"}`}
                        onClick={() => {
                          setSerialEntryMode("EXISTING");
                          setNewSerialCode("");
                        }}
                      >
                        Existant (Retour)
                      </button>
                    </div>
                  )}
                </div>

                {movementType === "IN" && serialEntryMode === "NEW" ? (
                  <input
                    type="text"
                    value={newSerialCode}
                    onChange={(event) => setNewSerialCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addLine();
                      }
                    }}
                    disabled={busy}
                    placeholder="Saisir un nouveau code (puis Entrée)..."
                    className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                  />
                ) : (
                  <>
                    <select
                      value={selectedSerialId}
                      onChange={(event) => setSelectedSerialId(event.target.value)}
                      disabled={busy || serialsQuery.isLoading}
                      className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 font-mono text-xs focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Sélectionnez un numéro de série existant</option>

                      {serialCandidates.map((serial) => (
                        <option
                          key={serial.serialNumberId}
                          value={serial.serialNumberId}
                        >
                          {serial.serialNumberCode}
                          {serial.shelf?.shelfName
                            ? ` — ${serial.shelf.shelfName}`
                            : movementType === "IN"
                              ? " — Hors emplacement"
                              : ""}
                        </option>
                      ))}
                    </select>

                    {!serialsQuery.isLoading && serialCandidates.length === 0 && (
                      <p className="text-[10px] text-amber-200">
                        Aucun numéro de série éligible pour ce type de mouvement et
                        ce trajet.
                      </p>
                    )}
                  </>
                )}
              </label>
            )}

            {movementType !== "IN" && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Source
                </span>

                {selectedEquipment?.hasSerialNumber ? (
                  <div className="flex h-10 items-center rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-xs">
                    {sourceName || "Sélectionnez d’abord un numéro de série"}
                  </div>
                ) : (
                  <select
                    value={sourceShelfId}
                    onChange={(event) => setSourceShelfId(event.target.value)}
                    disabled={
                      busy || !selectedEquipment || allocationsQuery.isLoading
                    }
                    className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-xs"
                  >
                    <option value="">
                      Sélectionnez une source avec quantité suffisante
                    </option>

                    {sourceCandidates.map((allocation) => (
                      <option
                        key={allocation.equipmentShelfId}
                        value={allocation.shelfId}
                      >
                        {allocation.shelf?.shelfName ?? "Emplacement"} —
                        disponible: {allocation.equipmentQuantity}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            )}

            {movementType !== "OUT" && (
              <label className="block space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  Destination ACTIVE
                </span>

                {false ? (
                  <div
                    className={`flex h-10 items-center rounded border px-3 text-xs ${
                      routeDestinationAllowedForCurrentEquipment
                        ? "border-[#3f3f46] bg-[#1f1b18]"
                        : "border-rose-400/40 bg-rose-950/20 text-rose-200"
                    }`}
                  >
                    {destinationName || "Destination du trajet"}
                  </div>
                ) : (
                  <select
                    value={destinationShelfId}
                    onChange={(event) =>
                      setDestinationShelfId(event.target.value)
                    }
                    disabled={
                      busy ||
                      !selectedEquipment ||
                      (movementType === "TRANSFER" && !sourceShelfId)
                    }
                    className="h-10 w-full rounded border border-[#3f3f46] bg-[#1f1b18] px-3 text-xs"
                  >
                    <option value="">Sélectionnez une destination</option>

                    {destinationCandidates.map((shelf) => (
                      <option key={shelf.shelfId} value={shelf.shelfId}>
                        {shelf.shelfName ?? "Emplacement"} —{" "}
                        {shelf.stock?.stockName ?? "Stock"}
                      </option>
                    ))}
                  </select>
                )}

                {movementType === "TRANSFER" && selectedEquipment && !false && (
                  <p className="text-[10px] text-white/40">
                    Les emplacements déjà alloués à cet article, ainsi que la
                    source actuelle, sont exclus des destinations.
                  </p>
                )}

                {false &&
                  movementType === "TRANSFER" &&
                  !routeDestinationAllowedForCurrentEquipment && (
                    <p className="text-[10px] text-rose-200">
                      Cet article possède déjà une allocation dans la
                      destination commune et ne peut pas être ajouté à ce
                      transfert.
                    </p>
                  )}
              </label>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addLine}
                disabled={
                  busy ||
                  !selectedEquipment ||
                  !routeDestinationAllowedForCurrentEquipment
                }
                className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter la ligne
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#3f3f46]">
            <div className="flex items-center justify-between border-b border-[#3f3f46] bg-[#18181b] px-4 py-3">
              <div>
                <h3 className="text-xs font-semibold">Lignes préparées</h3>

                <p className="mt-0.5 text-[10px] text-white/40">
                  {movementType === "IN"
                    ? `Extérieur → ${destinationName || "destination"}`
                    : movementType === "OUT"
                      ? `${sourceName || "source"} → Extérieur`
                      : `${sourceName || "source"} → ${destinationName || "destination"}`}
                </p>
              </div>

              <span className="font-mono text-xs text-white/55">
                {lines.length} / 100
              </span>
            </div>

            {lines.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-white/45">
                Aucune ligne ajoutée.
              </div>
            ) : (
              <div className="divide-y divide-[#3f3f46]">
                {lines.map((line, index) => (
                  <div
                    key={line.clientId}
                    className="grid grid-cols-[36px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.5fr)_80px_36px] items-center gap-3 px-4 py-3 text-xs"
                  >
                    <span className="font-mono text-[10px] text-white/40">
                      {String(index + 1).padStart(2, "0")}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {line.equipmentName}
                      </p>

                      <p className="mt-0.5 text-[9px] text-white/40">
                        {line.hasSerialNumber ? "Sérialisé" : "Standard"}
                      </p>
                    </div>

                    <div className="min-w-0">
                      {line.serialNumberCode ? (
                        <span className="flex items-center gap-1 truncate font-mono text-[10px] text-[#d4d4d8]">
                          <Barcode className="h-3 w-3 shrink-0" />
                          {line.serialNumberCode}
                        </span>
                      ) : (
                        <span className="text-[10px] text-white/35">
                          Quantitatif
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-mono text-[9px] text-white/50">
                        {movementType === "IN"
                          ? `Extérieur → ${line.destinationName || "destination"}`
                          : movementType === "OUT"
                            ? `${line.sourceName || "source"} → Extérieur`
                            : `${line.sourceName || "source"} → ${line.destinationName || "destination"}`}
                      </p>
                    </div>

                    <span className="text-right font-mono font-semibold">
                      {line.movementQuantity} u.
                    </span>

                    <button
                      type="button"
                      onClick={() => removeLine(line.clientId)}
                      disabled={busy}
                      className="rounded p-2 text-rose-300 hover:bg-rose-950/20 disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-950/10 p-3 text-[11px] text-amber-100">
            <Warehouse className="mt-0.5 h-4 w-4 shrink-0" />

            <p>
              Les stocks INACTIVE ne sont jamais proposés. Si un article ou une
              unité est en inventaire actif, le backend refuse le mouvement pour
              éviter les conditions de course.
            </p>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[#3f3f46] bg-[#26221f] px-5 py-3">
          <div className="text-[10px] font-medium text-amber-200/80">
            {lines.length === 0 &&
              !selectedEquipment &&
              "Vous devez sélectionner un article ou ajouter une ligne avant de pouvoir enregistrer."}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-[#3f3f46] px-4 py-2 text-xs"
            >
              Annuler
            </button>

            <button
              type="button"
              onClick={() => {
                void submit();
              }}
              disabled={
                busy ||
                !canCreateMovement ||
                (lines.length === 0 && !selectedEquipment)
              }
              className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#18181b] disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Enregistrer le mouvement
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function TypeButton({
  active,
  icon: Icon,
  title,
  onClick,
  disabled,
}: {
  active: boolean;
  icon: typeof ArrowDownToLine | typeof ArrowUpFromLine | typeof ArrowRightLeft;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border p-3 text-left transition ${
        active
          ? "border-[#f4f4f5] bg-[#fafafa] text-[#18181b]"
          : "border-[#3f3f46] bg-[#18181b] text-white hover:border-[#6b625b]"
      } disabled:opacity-40`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold">{title}</span>
      </div>

      <p
        className={`mt-1 text-[10px] ${
          active ? "text-[#5b534d]" : "text-white/40"
        }`}
      ></p>
    </button>
  );
}
