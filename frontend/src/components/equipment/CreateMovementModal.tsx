"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  Search,
  Trash2,
  X,
} from "lucide-react";

import type {
  Equipment,
  SerialNumber,
} from "@/types/equipment";
import type { MovementType } from "@/types/movement";

import { useEquipments } from "@/hooks/use-equipments";
import { useCreateMovement } from "@/hooks/use-movements";
import { useSerialNumbers } from "@/hooks/use-serial-numbers";
import { useShelves } from "@/hooks/use-shelves";

import { getErrorMessage } from "@/lib/error-message";
import {
  buildMovementPayload,
  createMovementDraft,
  type MovementDraft,
} from "@/lib/movement-draft";

interface CreateMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: Equipment | null;
  equipmentsList?: Equipment[];
  onSelectEquipment?: (
    equipment: Equipment,
  ) => void;
  onSuccess?: () => void;
}

type ShelfOption = {
  shelfId: string;
  shelfName: string | null;
};

const inputClass =
  "w-full h-9 px-2.5 bg-[#26221f] text-white border border-[#57504a] rounded-lg text-xs outline-none focus:border-emerald-400 disabled:opacity-50";

export function CreateMovementModal(
  props: CreateMovementModalProps,
) {
  return props.isOpen ? (
    <MovementComposer {...props} />
  ) : null;
}

function MovementComposer({
  equipment,
  equipmentsList = [],
  onClose,
  onSuccess,
}: CreateMovementModalProps) {
  const equipmentQuery = useEquipments({
    limit: 100,
  });
  const shelfQuery = useShelves({
    limit: 100,
  });
  const createMovement =
    useCreateMovement();

  const [movementType, setMovementType] =
    useState<MovementType>("IN");
  const [sourceShelfId, setSourceShelfId] =
    useState("");
  const [
    destinationShelfId,
    setDestinationShelfId,
  ] = useState("");

  const [drafts, setDrafts] = useState<
    MovementDraft[]
  >(() =>
    equipment
      ? [createMovementDraft(equipment)]
      : [],
  );

  const [error, setError] =
    useState<string | null>(null);

  const submitting = useRef(false);

  const busy =
    submitting.current ||
    createMovement.isPending;

  /*
   * A route/type change changes which serials are eligible.
   * Clear selected serials so a stale serial location cannot remain selected.
   */
  useEffect(() => {
    setDrafts((previous) =>
      previous.map((draft) =>
        draft.equipment.hasSerialNumber
          ? {
            ...draft,
            serialNumberIds: [],
          }
          : draft,
      ),
    );
  }, [movementType, sourceShelfId]);

  useEffect(() => {
    if (movementType === "IN") {
      setSourceShelfId("");
    }

    if (movementType === "OUT") {
      setDestinationShelfId("");
    }
  }, [movementType]);

  const selectedEquipmentIds =
    useMemo(
      () =>
        new Set(
          drafts.map(
            (draft) =>
              draft.equipment.equipmentId,
          ),
        ),
      [drafts],
    );

  const visibleEquipments =
    useMemo(() => {
      const candidates = [
        ...equipmentsList,
        ...equipmentQuery.equipments,
        ...(equipment ? [equipment] : []),
      ];

      return Array.from(
        new Map(
          candidates.map((item) => [
            item.equipmentId,
            item,
          ]),
        ).values(),
      );
    }, [
      equipmentsList,
      equipmentQuery.equipments,
      equipment,
    ]);

  const shelfOptions =
    useMemo<ShelfOption[]>(() => {
      const candidates: ShelfOption[] = [
        ...shelfQuery.shelves.map(
          (shelf) => ({
            shelfId: shelf.shelfId,
            shelfName: shelf.shelfName,
          }),
        ),

        ...drafts.flatMap((draft) =>
          (
            draft.equipment
              .equipmentShelfs ?? []
          ).map((row) => ({
            shelfId: row.shelfId,
            shelfName:
              row.shelf?.shelfName ??
              row.shelfId,
          })),
        ),
      ];

      return Array.from(
        new Map(
          candidates.map((shelf) => [
            shelf.shelfId,
            shelf,
          ]),
        ).values(),
      );
    }, [shelfQuery.shelves, drafts]);

  const lineCount = drafts.reduce(
    (total, draft) =>
      total +
      (draft.equipment.hasSerialNumber
        ? draft.serialNumberIds.length
        : 1),
    0,
  );

  const totalQuantity =
    drafts.reduce(
      (total, draft) =>
        total +
        (draft.equipment.hasSerialNumber
          ? draft.serialNumberIds.length
          : Number(draft.quantity || 0)),
      0,
    );

  function updateDraft(
    id: string,
    update: Partial<MovementDraft>,
  ) {
    setError(null);

    setDrafts((previous) =>
      previous.map((draft) =>
        draft.id === id
          ? {
            ...draft,
            ...update,
          }
          : draft,
      ),
    );
  }

  function toggleEquipment(
    item: Equipment,
  ) {
    setError(null);

    setDrafts((previous) => {
      const exists = previous.some(
        (draft) =>
          draft.equipment.equipmentId ===
          item.equipmentId,
      );

      if (exists) {
        return previous.filter(
          (draft) =>
            draft.equipment.equipmentId !==
            item.equipmentId,
        );
      }

      return [
        ...previous,
        createMovementDraft(item),
      ];
    });
  }

  async function save(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (submitting.current) return;

    setError(null);

    let payload;

    try {
      payload = buildMovementPayload({
        movementType,
        sourceShelfId:
          sourceShelfId || null,
        destinationShelfId:
          destinationShelfId || null,
        drafts,
      });
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          "Vérifiez les données du mouvement.",
        ),
      );
      return;
    }

    submitting.current = true;

    try {
      await createMovement.mutateAsync(
        payload,
      );

      onSuccess?.();
      onClose();
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          "Impossible d’enregistrer le mouvement.",
        ),
      );
    } finally {
      submitting.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-modal-title"
        className="w-full max-w-6xl h-[92dvh] flex flex-col rounded-xl border border-[#57504a] bg-[#383330] text-white shadow-2xl overflow-hidden"
      >
        <header className="shrink-0 flex items-center justify-between gap-3 p-4 sm:px-6 border-b border-[#57504a] bg-[#2b2622]">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-5 h-5 text-emerald-300" />

            <div>
              <h2
                id="movement-modal-title"
                className="font-semibold"
              >
                Nouveau mouvement
              </h2>

              <p className="text-xs text-white/65 mt-1">
                Un type et un trajet communs
                pour toutes les lignes.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <form
          onSubmit={save}
          className="min-h-0 flex flex-col flex-1"
        >
          <fieldset
            disabled={busy}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <div className="p-4 sm:p-6 space-y-5">
              <MovementRouteSection
                movementType={
                  movementType
                }
                onMovementTypeChange={
                  setMovementType
                }
                sourceShelfId={
                  sourceShelfId
                }
                onSourceShelfChange={
                  setSourceShelfId
                }
                destinationShelfId={
                  destinationShelfId
                }
                onDestinationShelfChange={
                  setDestinationShelfId
                }
                shelves={shelfOptions}
              />

              <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
                <aside className="min-w-0 rounded-xl border border-[#57504a] bg-[#2b2622]/70 p-3 flex flex-col gap-3 max-h-[58vh]">
                  <div>
                    <h3 className="font-semibold text-sm">
                      Articles
                    </h3>
                    <p className="text-xs text-white/55 mt-1">
                      Ajoutez jusqu’à 100
                      lignes dans le même
                      mouvement.
                    </p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-white/45" />

                    <input
                      type="search"
                      value={
                        equipmentQuery.searchTerm
                      }
                      onChange={(event) =>
                        equipmentQuery.setSearchTerm(
                          event.target.value,
                        )
                      }
                      placeholder="Rechercher un article..."
                      className={`${inputClass} pl-9`}
                    />
                  </div>

                  <div className="min-h-0 overflow-y-auto space-y-1.5">
                    {visibleEquipments.map(
                      (item) => {
                        const checked =
                          selectedEquipmentIds.has(
                            item.equipmentId,
                          );

                        return (
                          <button
                            key={
                              item.equipmentId
                            }
                            type="button"
                            onClick={() =>
                              toggleEquipment(
                                item,
                              )
                            }
                            className={`w-full flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors ${checked
                                ? "border-emerald-400/50 bg-emerald-400/10"
                                : "border-[#4b4540] bg-[#302b27] hover:bg-[#3b3530]"
                              }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked
                                  ? "border-emerald-400 bg-emerald-400 text-[#1f1c19]"
                                  : "border-white/30"
                                }`}
                            >
                              {checked && (
                                <Check className="w-3 h-3" />
                              )}
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">
                                {item.equipmentName ??
                                  item.equipmentId}
                              </span>

                              <span className="block mt-0.5 text-[10px] text-white/50">
                                {item.hasSerialNumber
                                  ? "Sérialisé"
                                  : `${item.equipmentQuantity ?? 0} unité(s)`}
                              </span>
                            </span>
                          </button>
                        );
                      },
                    )}
                  </div>
                </aside>

                <section className="min-w-0 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-sm">
                        Lignes du mouvement
                      </h3>

                      <p className="text-xs text-white/55 mt-1">
                        {lineCount} ligne(s) ·{" "}
                        {totalQuantity} unité(s)
                      </p>
                    </div>
                  </div>

                  {!drafts.length ? (
                    <div className="rounded-xl border border-dashed border-[#57504a] bg-[#2b2622]/60 p-8 text-center">
                      <Package className="w-7 h-7 text-white/30 mx-auto" />

                      <p className="text-sm mt-3">
                        Aucun article sélectionné
                      </p>

                      <p className="text-xs text-white/50 mt-1">
                        Sélectionnez un article
                        dans la colonne de gauche.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drafts.map(
                        (draft) => (
                          <MovementDraftCard
                            key={draft.id}
                            draft={draft}
                            movementType={
                              movementType
                            }
                            sourceShelfId={
                              sourceShelfId
                            }
                            onChange={(
                              update,
                            ) =>
                              updateDraft(
                                draft.id,
                                update,
                              )
                            }
                            onRemove={() =>
                              setDrafts(
                                (
                                  previous,
                                ) =>
                                  previous.filter(
                                    (
                                      current,
                                    ) =>
                                      current.id !==
                                      draft.id,
                                  ),
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  )}
                </section>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-400/35 bg-rose-400/10 p-3 text-xs text-rose-100">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </fieldset>

          <footer className="shrink-0 flex items-center justify-between gap-3 border-t border-[#57504a] bg-[#2b2622] px-4 sm:px-6 py-3">
            <div className="text-xs text-white/55">
              {lineCount} ligne(s) ·{" "}
              {totalQuantity} unité(s)
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="h-9 px-4 rounded-lg border border-[#57504a] text-xs hover:bg-white/5 disabled:opacity-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={
                  busy ||
                  !drafts.length ||
                  lineCount === 0
                }
                className="h-9 px-4 rounded-lg bg-emerald-400 text-[#1f1c19] text-xs font-semibold hover:bg-emerald-300 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {busy && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}

                Enregistrer
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}

function MovementRouteSection({
  movementType,
  onMovementTypeChange,
  sourceShelfId,
  onSourceShelfChange,
  destinationShelfId,
  onDestinationShelfChange,
  shelves,
}: {
  movementType: MovementType;
  onMovementTypeChange: (
    type: MovementType,
  ) => void;
  sourceShelfId: string;
  onSourceShelfChange: (
    value: string,
  ) => void;
  destinationShelfId: string;
  onDestinationShelfChange: (
    value: string,
  ) => void;
  shelves: ShelfOption[];
}) {
  return (
    <section className="rounded-xl border border-[#57504a] bg-[#2b2622]/70 p-4">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
        <label className="block flex-1">
          <span className="block text-xs font-semibold mb-1.5">
            Type de mouvement
          </span>

          <select
            value={movementType}
            onChange={(event) =>
              onMovementTypeChange(
                event.target
                  .value as MovementType,
              )
            }
            className={inputClass}
          >
            <option value="IN">
              Entrée
            </option>
            <option value="OUT">
              Sortie
            </option>
            <option value="TRANSFER">
              Transfert
            </option>
          </select>
        </label>

        {movementType !== "IN" && (
          <label className="block flex-1">
            <span className="block text-xs font-semibold mb-1.5">
              Source
            </span>

            <select
              value={sourceShelfId}
              onChange={(event) =>
                onSourceShelfChange(
                  event.target.value,
                )
              }
              className={inputClass}
            >
              <option value="">
                Choisir la source
              </option>

              {shelves.map(
                (shelf) => (
                  <option
                    key={shelf.shelfId}
                    value={shelf.shelfId}
                  >
                    {shelf.shelfName ??
                      shelf.shelfId}
                  </option>
                ),
              )}
            </select>
          </label>
        )}

        {movementType !== "OUT" && (
          <label className="block flex-1">
            <span className="block text-xs font-semibold mb-1.5">
              Destination
            </span>

            <select
              value={
                destinationShelfId
              }
              onChange={(event) =>
                onDestinationShelfChange(
                  event.target.value,
                )
              }
              className={inputClass}
            >
              <option value="">
                Choisir la destination
              </option>

              {shelves.map(
                (shelf) => (
                  <option
                    key={shelf.shelfId}
                    value={shelf.shelfId}
                    disabled={
                      movementType ===
                      "TRANSFER" &&
                      shelf.shelfId ===
                      sourceShelfId
                    }
                  >
                    {shelf.shelfName ??
                      shelf.shelfId}
                  </option>
                ),
              )}
            </select>
          </label>
        )}

        <div className="shrink-0 hidden lg:flex h-9 items-center px-3 rounded-lg border border-[#4b4540] bg-[#302b27] text-xs text-white/65">
          {movementType === "IN" && (
            <>
              <ArrowDownToLine className="w-4 h-4 mr-2 text-emerald-300" />
              Extérieur → Stock
            </>
          )}

          {movementType === "OUT" && (
            <>
              <ArrowUpFromLine className="w-4 h-4 mr-2 text-rose-300" />
              Stock → Extérieur
            </>
          )}

          {movementType ===
            "TRANSFER" && (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2 text-sky-300" />
                Stock → Stock
              </>
            )}
        </div>
      </div>
    </section>
  );
}

function MovementDraftCard({
  draft,
  movementType,
  sourceShelfId,
  onChange,
  onRemove,
}: {
  draft: MovementDraft;
  movementType: MovementType;
  sourceShelfId: string;
  onChange: (
    update: Partial<MovementDraft>,
  ) => void;
  onRemove: () => void;
}) {
  const equipment = draft.equipment;

  const availableOnSource =
    sourceShelfId
      ? (
        equipment.equipmentShelfs ?? []
      )
        .filter(
          (row) =>
            row.shelfId ===
            sourceShelfId,
        )
        .reduce(
          (sum, row) =>
            sum +
            Number(
              row.equipmentQuantity ||
              0,
            ),
          0,
        )
      : 0;

  return (
    <div className="rounded-xl border border-[#57504a] bg-[#2b2622]/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {equipment.equipmentName ??
              equipment.equipmentId}
          </p>

          <p className="text-[10px] text-white/45 mt-1 font-mono truncate">
            {equipment.equipmentId}
          </p>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="p-2 rounded-lg text-white/50 hover:text-rose-300 hover:bg-rose-400/10"
          aria-label="Retirer l’article"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {equipment.hasSerialNumber ? (
        <SerialSelector
          equipment={equipment}
          movementType={movementType}
          sourceShelfId={
            sourceShelfId
          }
          selectedIds={
            draft.serialNumberIds
          }
          onSelectedIdsChange={(
            serialNumberIds,
          ) =>
            onChange({
              serialNumberIds,
            })
          }
        />
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <label>
            <span className="block text-xs font-semibold mb-1.5">
              Quantité
            </span>

            <input
              type="number"
              min={1}
              step={1}
              max={2147483647}
              value={draft.quantity}
              onChange={(event) =>
                onChange({
                  quantity:
                    Number(
                      event.target.value,
                    ) || 0,
                })
              }
              className={inputClass}
            />
          </label>

          {(movementType ===
            "OUT" ||
            movementType ===
            "TRANSFER") && (
              <div className="h-9 flex items-center rounded-lg border border-[#4b4540] bg-[#302b27] px-3 text-xs text-white/60">
                Disponible sur source :{" "}
                <strong className="ml-1 text-white">
                  {sourceShelfId
                    ? availableOnSource
                    : "—"}
                </strong>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

function SerialSelector({
  equipment,
  movementType,
  sourceShelfId,
  selectedIds,
  onSelectedIdsChange,
}: {
  equipment: Equipment;
  movementType: MovementType;
  sourceShelfId: string;
  selectedIds: string[];
  onSelectedIdsChange: (
    ids: string[],
  ) => void;
}) {
  const [page, setPage] =
    useState(1);
  const [search, setSearch] =
    useState("");

  useEffect(() => {
    setPage(1);
  }, [
    equipment.equipmentId,
    sourceShelfId,
    movementType,
    search,
  ]);

  const requiresSource =
    movementType === "OUT" ||
    movementType === "TRANSFER";

  const query = useSerialNumbers(
    {
      page,
      limit: 100,
      equipmentId:
        equipment.equipmentId,
      serialNumberCode:
        search.trim() || undefined,
      shelfId:
        requiresSource &&
          sourceShelfId
          ? sourceShelfId
          : undefined,
    },
    !requiresSource ||
    Boolean(sourceShelfId),
  );

  const rows: SerialNumber[] =
    query.data?.serialNumbers ?? [];

  const eligible =
    movementType === "IN"
      ? rows.filter(
        (serial) =>
          !serial.shelfId,
      )
      : rows;

  function toggle(
    serialNumberId: string,
  ) {
    onSelectedIdsChange(
      selectedIds.includes(
        serialNumberId,
      )
        ? selectedIds.filter(
          (id) =>
            id !== serialNumberId,
        )
        : [
          ...selectedIds,
          serialNumberId,
        ],
    );
  }

  if (
    requiresSource &&
    !sourceShelfId
  ) {
    return (
      <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-100">
        Choisissez d’abord
        l’emplacement source pour
        afficher les numéros de série
        disponibles.
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-white/45" />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Rechercher un numéro de série..."
            className={`${inputClass} pl-9`}
          />
        </div>

        <span className="text-xs text-white/55">
          {selectedIds.length}{" "}
          sélectionné(s)
        </span>
      </div>

      {movementType === "IN" && (
        <p className="text-[10px] text-white/45">
          Seuls les numéros non encore
          affectés à un emplacement sont
          proposés. Utilisez la recherche
          si le numéro n’apparaît pas sur
          la page courante.
        </p>
      )}

      {query.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-white/55">
          <Loader2 className="w-4 h-4 animate-spin" />
          Chargement des numéros de série...
        </div>
      ) : query.isError ? (
        <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-xs text-rose-100">
          Impossible de charger les
          numéros de série.
        </div>
      ) : (
        <div className="max-h-48 overflow-y-auto rounded-lg border border-[#4b4540] divide-y divide-[#4b4540]">
          {eligible.map((serial) => {
            const checked =
              selectedIds.includes(
                serial.serialNumberId,
              );

            return (
              <label
                key={
                  serial.serialNumberId
                }
                className="flex items-center gap-3 p-2.5 bg-[#302b27] hover:bg-[#3b3530] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    toggle(
                      serial.serialNumberId,
                    )
                  }
                  className="accent-emerald-400"
                />

                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium truncate">
                    {serial.serialNumberCode ??
                      serial.serialNumberId}
                  </span>

                  <span className="block text-[10px] text-white/45 mt-0.5 truncate">
                    {serial.shelf?.shelfName ??
                      (serial.shelfId
                        ? serial.shelfId
                        : "Non affecté")}
                  </span>
                </span>
              </label>
            );
          })}

          {!eligible.length && (
            <div className="p-4 text-center text-xs text-white/45">
              Aucun numéro de série
              disponible pour ce trajet.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={
            page <= 1 ||
            query.isFetching
          }
          onClick={() =>
            setPage((current) =>
              Math.max(
                1,
                current - 1,
              ),
            )
          }
          className="h-8 px-2.5 rounded-lg border border-[#4b4540] text-xs disabled:opacity-40 inline-flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Précédent
        </button>

        <span className="text-[10px] font-mono text-white/45">
          {query.data?.currentPage ??
            page}{" "}
          /{" "}
          {query.data?.totalPages ??
            1}
        </span>

        <button
          type="button"
          disabled={
            page >=
            (query.data
              ?.totalPages ?? 1) ||
            query.isFetching
          }
          onClick={() =>
            setPage((current) =>
              Math.min(
                query.data
                  ?.totalPages ?? 1,
                current + 1,
              ),
            )
          }
          className="h-8 px-2.5 rounded-lg border border-[#4b4540] text-xs disabled:opacity-40 inline-flex items-center gap-1"
        >
          Suivant
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
