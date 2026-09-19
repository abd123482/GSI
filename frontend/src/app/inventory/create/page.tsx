'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { UserAutocomplete } from '@/components/users/UserAutocomplete';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInventorySchema } from '@/schemas/inventory.schema';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Search,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { useCreateInventory } from '@/hooks/use-inventory';
import { useEquipments } from '@/hooks/use-equipments';
import { useShelves } from '@/hooks/use-shelves';
import { toast } from 'sonner';

type CreateInventoryForm = z.infer<typeof createInventorySchema>;

export default function CreateInventoryPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredEqId, setHoveredEqId] = useState<string | null>(null);
  const [scopeSearch, setScopeSearch] = useState('');
  const [itemNamesMap, setItemNamesMap] = useState<Record<string, string>>({});

  const { register, handleSubmit, formState: { errors }, watch, setValue, control } = useForm<CreateInventoryForm>({
    resolver: zodResolver(createInventorySchema),
    defaultValues: {
      typeInventory: 'ByEquipment',
      users: [
        { userId: '', responsibility: 'COUNT' },
        { userId: '', responsibility: 'COUNT' },
      ],
      equipmentIds: [],
      shelfIds: [],
    }
  });

  const inventoryType = watch('typeInventory');
  const selectedEquipmentIds = watch('equipmentIds') || [];
  const selectedShelfIds = watch('shelfIds') || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'users'
  });
  const { mutateAsync: createInventory } = useCreateInventory();

  // Paginated and searchable Equipments (only loaded when active)
  const {
    equipments,
    totalEquipments,
    totalPages: totalEquipmentPages,
    currentPage: currentEquipmentPage,
    setPage: setEquipmentPage,
    limit: equipmentLimit,
    setLimit: setEquipmentLimit,
    isLoading: isEquipmentsLoading,
    isFetching: isEquipmentsFetching,
    setSearchTerm: setEquipmentSearch,
  } = useEquipments({
    page: 1,
    limit: 50,
    enabled: inventoryType === 'ByEquipment',
  });

  // Paginated and searchable Shelves (only loaded when active)
  const {
    shelves,
    totalShelves,
    totalPages: totalShelfPages,
    currentPage: currentShelfPage,
    setPage: setShelfPage,
    limit: shelfLimit,
    setLimit: setShelfLimit,
    isLoading: isShelvesLoading,
    isFetching: isShelvesFetching,
    setSearchTerm: setShelfSearch,
  } = useShelves({
    page: 1,
    limit: 50,
    enabled: inventoryType === 'ByShelf',
  });

  // Active dataset variables depending on inventory type
  const activeTotal = inventoryType === 'ByEquipment' ? totalEquipments : totalShelves;
  const activeTotalPages = inventoryType === 'ByEquipment' ? totalEquipmentPages : totalShelfPages;
  const activePage = inventoryType === 'ByEquipment' ? currentEquipmentPage : currentShelfPage;
  const setActivePage = inventoryType === 'ByEquipment' ? setEquipmentPage : setShelfPage;
  const activeLimit = inventoryType === 'ByEquipment' ? equipmentLimit : shelfLimit;
  const isScopeLoading = inventoryType === 'ByEquipment' ? isEquipmentsLoading : isShelvesLoading;
  const isScopeFetching = inventoryType === 'ByEquipment' ? isEquipmentsFetching : isShelvesFetching;
  const currentSelectedIds = inventoryType === 'ByEquipment' ? selectedEquipmentIds : selectedShelfIds;

  // Only trigger search when scopeSearch actually changes (prevents resetting page on pagination)
  const prevSearchRef = useRef(scopeSearch);
  useEffect(() => {
    if (prevSearchRef.current === scopeSearch) return;
    prevSearchRef.current = scopeSearch;

    const timer = setTimeout(() => {
      const q = scopeSearch.trim();
      if (inventoryType === 'ByEquipment') {
        setEquipmentSearch(q);
      } else {
        setShelfSearch(q);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [scopeSearch, inventoryType, setEquipmentSearch, setShelfSearch]);

  // Reset search and return to page 1 ONLY when switching inventory type
  const prevInventoryTypeRef = useRef(inventoryType);
  useEffect(() => {
    if (prevInventoryTypeRef.current !== inventoryType) {
      prevInventoryTypeRef.current = inventoryType;
      setScopeSearch('');
      prevSearchRef.current = '';
      setEquipmentSearch('');
      setShelfSearch('');
      setEquipmentPage(1);
      setShelfPage(1);
    }
  }, [inventoryType, setEquipmentSearch, setShelfSearch, setEquipmentPage, setShelfPage]);

  // Maintain names cache for selected items so badges display properly across searches & pages
  useEffect(() => {
    if (equipments && equipments.length > 0) {
      setItemNamesMap((prev) => {
        const next = { ...prev };
        for (const eq of equipments) {
          next[eq.equipmentId] = eq.equipmentName || eq.equipmentId;
        }
        return next;
      });
    }
  }, [equipments]);

  useEffect(() => {
    if (shelves && shelves.length > 0) {
      setItemNamesMap((prev) => {
        const next = { ...prev };
        for (const sh of shelves) {
          next[sh.shelfId] = sh.shelfName || sh.shelfId;
        }
        return next;
      });
    }
  }, [shelves]);

  const toggleEquipment = (eqId: string, eqName?: string | null) => {
    const current = selectedEquipmentIds || [];
    if (current.includes(eqId)) {
      setValue('equipmentIds', current.filter((id) => id !== eqId), { shouldValidate: true });
    } else {
      setValue('equipmentIds', [...current, eqId], { shouldValidate: true });
      if (eqName) {
        setItemNamesMap((prev) => ({ ...prev, [eqId]: eqName }));
      }
    }
  };

  const toggleShelf = (shId: string, shName?: string | null) => {
    const current = selectedShelfIds || [];
    if (current.includes(shId)) {
      setValue('shelfIds', current.filter((id) => id !== shId), { shouldValidate: true });
    } else {
      setValue('shelfIds', [...current, shId], { shouldValidate: true });
      if (shName) {
        setItemNamesMap((prev) => ({ ...prev, [shId]: shName }));
      }
    }
  };

  const handleSelectCurrentPage = () => {
    if (inventoryType === 'ByEquipment') {
      const allIds = equipments.map((eq) => eq.equipmentId);
      const combined = Array.from(new Set([...selectedEquipmentIds, ...allIds]));
      setValue('equipmentIds', combined, { shouldValidate: true });
      setItemNamesMap((prev) => {
        const next = { ...prev };
        equipments.forEach((eq) => {
          next[eq.equipmentId] = eq.equipmentName || eq.equipmentId;
        });
        return next;
      });
    } else {
      const allIds = shelves.map((sh) => sh.shelfId);
      const combined = Array.from(new Set([...selectedShelfIds, ...allIds]));
      setValue('shelfIds', combined, { shouldValidate: true });
      setItemNamesMap((prev) => {
        const next = { ...prev };
        shelves.forEach((sh) => {
          next[sh.shelfId] = sh.shelfName || sh.shelfId;
        });
        return next;
      });
    }
  };

  const handleDeselectAll = () => {
    if (inventoryType === 'ByEquipment') {
      setValue('equipmentIds', [], { shouldValidate: true });
    } else {
      setValue('shelfIds', [], { shouldValidate: true });
    }
  };

  const removeItem = (id: string) => {
    if (inventoryType === 'ByEquipment') {
      setValue('equipmentIds', selectedEquipmentIds.filter((x) => x !== id), { shouldValidate: true });
    } else {
      setValue('shelfIds', selectedShelfIds.filter((x) => x !== id), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: CreateInventoryForm) => {
    setIsSubmitting(true);
    try {
      await createInventory(data);
      toast.success('Inventaire créé avec succès en mode Brouillon.');
      router.push('/inventory');
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la création de l\'inventaire.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link href="/inventory" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
              Créer un Inventaire
            </h1>
            <p className="text-xs text-[#c9c0ad]">
              Configuration du type, de la portée et des participants.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Section 1: Informations Générales */}
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <h2 className="text-sm font-medium text-[#f7f5f0]">1. Informations Générales</h2>
            
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#aea69c]">Titre de l'inventaire</label>
              <input
                {...register('title')}
                className="w-full h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-3 text-sm focus:outline-none focus:border-[#aea69c] transition-colors"
                placeholder="Ex: Inventaire Annuel 2026 - Zone A"
              />
              {errors.title && <p className="text-[10px] text-red-400">{errors.title.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#aea69c]">Type d'inventaire</label>
              <select
                {...register('typeInventory')}
                className="w-full h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-3 text-sm focus:outline-none focus:border-[#aea69c] transition-colors"
              >
                <option value="ByEquipment">Par Article</option>
                <option value="ByShelf">Par Emplacement</option>
              </select>
            </div>
          </section>

          {/* Section 2: Portée */}
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-[#f7f5f0]">2. Portée de l'inventaire</h2>
                  <span className="text-[11px] font-mono text-[#10b981] bg-[#162b22] px-2 py-0.5 rounded border border-[#1e3d30]">
                    {activeTotal.toLocaleString()} {inventoryType === 'ByEquipment' ? 'articles disponibles' : 'emplacements disponibles'}
                  </span>
                </div>
                <p className="text-xs text-[#c9c0ad] mt-0.5">
                  Sélectionnez les {inventoryType === 'ByEquipment' ? 'articles' : 'emplacements'} à inclure dans ce cycle d'inventaire.
                </p>
              </div>

              {/* Quick Actions & Counter */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-[#383330] text-[#f7f5f0] border border-[#4d4641] font-medium text-[11px]">
                  {currentSelectedIds.length} sélectionné(s)
                </span>
                <button
                  type="button"
                  onClick={handleSelectCurrentPage}
                  className="px-2.5 py-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[#dad2c1] hover:text-[#f7f5f0] text-[11px] cursor-pointer transition-colors"
                  title="Sélectionner tous les éléments affichés sur la page courante"
                >
                  Sélectionner cette page
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] text-[#aea69c] hover:text-[#f7f5f0] text-[11px] cursor-pointer transition-colors"
                >
                  Désélectionner
                </button>
              </div>
            </div>

            {/* Selected Items Badges (Persistent across all pages & searches) */}
            {currentSelectedIds.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] text-[#aea69c] font-mono">Éléments retenus ({currentSelectedIds.length}) :</div>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[#25201d] rounded border border-[#3f3a36] max-h-24 overflow-y-auto">
                  {currentSelectedIds.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-[#383330] text-[#f7f5f0] border border-[#4d4641] transition-colors"
                    >
                      <span className="truncate max-w-[150px]">{itemNamesMap[id] || id}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(id)}
                        className="text-[#aea69c] hover:text-red-400 transition-colors cursor-pointer"
                        title="Retirer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Instant Server-side Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#aea69c]" />
              <input
                type="text"
                value={scopeSearch}
                onChange={(e) => setScopeSearch(e.target.value)}
                placeholder={
                  inventoryType === 'ByEquipment'
                    ? `Rechercher parmi les ${totalEquipments.toLocaleString()} articles par nom ou code...`
                    : `Rechercher parmi les ${totalShelves.toLocaleString()} emplacements par nom...`
                }
                className="w-full pl-9 pr-9 py-1.5 bg-[#2b2622] text-[#f7f5f0] text-xs border border-[#3f3a36] rounded-[3px] outline-none focus:border-[#aea69c] placeholder:text-[#aea69c] transition-colors font-mono"
              />
              {isScopeFetching && (
                <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#aea69c]" />
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/2 max-h-72 overflow-y-auto border border-[#3f3a36] bg-[#2b2622] rounded-[3px] p-2 space-y-1 relative">
                {isScopeFetching && !isScopeLoading && (
                  <div className="sticky top-0 z-10 flex items-center justify-center gap-1.5 py-1 px-2 mb-1 bg-[#383330]/90 text-[10px] text-[#10b981] font-mono rounded border border-[#1e3d30] backdrop-blur-xs shadow-xs">
                    <Loader2 className="w-3 h-3 animate-spin text-[#10b981]" />
                    <span>Chargement de la page...</span>
                  </div>
                )}
                {isScopeLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs font-mono text-[#aea69c]">
                    <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
                    <span>Chargement des données...</span>
                  </div>
                ) : inventoryType === 'ByEquipment' ? (
                  equipments.length > 0 ? (
                    equipments.map((eq) => {
                      const isSelected = selectedEquipmentIds.includes(eq.equipmentId);
                      return (
                        <div 
                          key={eq.equipmentId} 
                          onClick={() => toggleEquipment(eq.equipmentId, eq.equipmentName)}
                          onMouseEnter={() => setHoveredEqId(eq.equipmentId)}
                          className={`flex items-center justify-between p-1.5 rounded transition-colors group cursor-pointer ${
                            isSelected ? 'bg-[#383330] border border-[#5c544d]' : 'hover:bg-[#322c28] border border-transparent'
                          }`}
                        >
                          <label className="flex items-center gap-2 text-sm cursor-pointer text-[#f7f5f0] flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleEquipment(eq.equipmentId, eq.equipmentName)}
                              className="accent-[#aea69c] cursor-pointer" 
                            />
                            <span className="truncate">{eq.equipmentName || eq.equipmentId}</span>
                          </label>
                          {eq.hasSerialNumber && eq.serialNumbers && eq.serialNumbers.length > 0 && (
                            <div className="relative flex items-center justify-center shrink-0 ml-2">
                              <div className="px-1.5 py-0.5 rounded bg-[#3f3a36] text-[#aea69c] flex items-center justify-center text-[10px] font-mono">
                                {eq.serialNumbers.length} SN
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-[#aea69c] p-6 text-center">
                      {scopeSearch ? `Aucun article ne correspond à "${scopeSearch}"` : 'Aucun article disponible.'}
                    </div>
                  )
                ) : (
                  shelves.length > 0 ? (
                    shelves.map((shelf) => {
                      const isSelected = selectedShelfIds.includes(shelf.shelfId);
                      return (
                        <div
                          key={shelf.shelfId}
                          onClick={() => toggleShelf(shelf.shelfId, shelf.shelfName)}
                          className={`flex items-center gap-2 text-sm p-1.5 rounded cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#383330] border border-[#5c544d]' : 'hover:bg-[#322c28] border border-transparent'
                          } text-[#f7f5f0]`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isSelected}
                            onChange={() => toggleShelf(shelf.shelfId, shelf.shelfName)}
                            className="accent-[#aea69c] cursor-pointer" 
                          />
                          <span className="truncate">{shelf.shelfName}</span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-[#aea69c] p-6 text-center">
                      {scopeSearch ? `Aucun emplacement ne correspond à "${scopeSearch}"` : 'Aucun emplacement disponible.'}
                    </div>
                  )
                )}
              </div>

              {/* Right Panel for SN or Shelf Overview */}
              <div className="w-full sm:w-1/2 max-h-72 border border-[#3f3a36] bg-[#2b2622] rounded-[3px] p-3 flex flex-col">
                {inventoryType === 'ByEquipment' ? (
                  hoveredEqId ? (() => {
                    const eq = equipments.find((e) => e.equipmentId === hoveredEqId);
                    if (eq?.hasSerialNumber && eq.serialNumbers && eq.serialNumbers.length > 0) {
                      return (
                        <>
                          <div className="text-[11px] font-semibold text-[#f7f5f0] mb-2 truncate" title={eq.equipmentName || eq.equipmentId}>
                            SN: {eq.equipmentName}
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {eq.serialNumbers.map((sn) => (
                              <div key={sn.serialNumberId} className="text-[11px] text-[#aea69c] bg-[#1f1b18] border border-[#3f3a36] px-2 py-1 rounded shadow-xs">
                                {sn.serialNumberCode || sn.serialNumberId}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    }
                    return <div className="text-xs text-[#5c544d] m-auto text-center px-4">Aucun numéro de série pour cet article</div>;
                  })() : (
                    <div className="text-xs text-[#5c544d] m-auto text-center px-4">Survolez un article pour voir ses numéros de série</div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center m-auto text-center p-4 space-y-2 text-[#aea69c]">
                    <Layers className="w-8 h-8 text-[#5c544d]" />
                    <div className="text-xs font-medium text-[#f7f5f0]">Inventaire par Emplacement</div>
                    <p className="text-[11px] text-[#8c827a] max-w-[220px]">
                      Tous les articles présents dans les emplacements sélectionnés seront inclus lors du lancement.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pagination Controls Footer */}
            {activeTotalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 rounded bg-[#25201d] border border-[#3f3a36] text-[11px] font-mono text-[#aea69c]">
                <div className="flex items-center gap-2">
                  <span>Page <strong className="text-[#f7f5f0]">{activePage}</strong> / {activeTotalPages.toLocaleString()}</span>
                  <span className="text-[#6e645c]">({activeTotal.toLocaleString()} au total)</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 mr-2 text-[10px]">
                    <span>Afficher :</span>
                    <select
                      value={activeLimit}
                      onChange={(e) => {
                        const newLim = Number(e.target.value);
                        if (inventoryType === 'ByEquipment') {
                          setEquipmentLimit(newLim);
                          setEquipmentPage(1);
                        } else {
                          setShelfLimit(newLim);
                          setShelfPage(1);
                        }
                      }}
                      className="h-6 px-1.5 bg-[#2b2622] border border-[#3f3a36] rounded text-[11px] font-mono text-[#f7f5f0] outline-none cursor-pointer"
                    >
                      <option value={25}>25 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                      <option value={250}>250 / page</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={activePage <= 1 || isScopeLoading}
                    onClick={() => setActivePage(1)}
                    className="p-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#f7f5f0] cursor-pointer"
                    title="Première page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activePage <= 1 || isScopeLoading}
                    onClick={() => setActivePage(Math.max(1, activePage - 1))}
                    className="p-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#f7f5f0] cursor-pointer"
                    title="Page précédente"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activePage >= activeTotalPages || isScopeLoading}
                    onClick={() => setActivePage(Math.min(activeTotalPages, activePage + 1))}
                    className="p-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#f7f5f0] cursor-pointer"
                    title="Page suivante"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={activePage >= activeTotalPages || isScopeLoading}
                    onClick={() => setActivePage(activeTotalPages)}
                    className="p-1 rounded bg-[#2b2622] hover:bg-[#383330] border border-[#3f3a36] disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-[#f7f5f0] cursor-pointer"
                    title="Dernière page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {(errors.equipmentIds || errors.shelfIds) && (
              <p className="text-[10px] text-red-400">Veuillez sélectionner au moins un élément.</p>
            )}
          </section>

          {/* Section 3: Participants */}
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <h2 className="text-sm font-medium text-[#f7f5f0]">3. Contrôleurs d'inventaire</h2>
            <p className="text-xs text-[#c9c0ad]">
              Désignez les contrôleurs. Les deux premiers effectueront le double comptage initial. En cas de divergence, le 3ème contrôleur vérifiera et finalisera l'arbitrage.
            </p>
            
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                     <label className="text-xs font-medium text-[#aea69c]">Utilisateur</label>
                     <Controller
                       control={control}
                       name={`users.${index}.userId`}
                       render={({ field: { value, onChange } }) => (
                         <UserAutocomplete 
                           value={value} 
                           onChange={onChange} 
                           error={errors.users?.[index]?.userId?.message}
                         />
                       )}
                     />
                  </div>
                  <div className="w-52 sm:w-64 space-y-1.5">
                     <label className="text-xs font-medium text-[#aea69c]">Rôle</label>
                     <div className="h-9 bg-[#26221f] border border-[#3f3a36] rounded-[3px] px-3 flex items-center justify-between text-xs font-mono">
                       <span className="text-[#f7f5f0] font-medium">
                         {index === 0
                           ? '1er Contrôleur'
                           : index === 1
                           ? '2ème Contrôleur'
                           : index === 2
                           ? '3ème Contrôleur'
                           : `Contrôleur ${index + 1}`}
                       </span>
                       <span
                         className={`text-[10px] px-1.5 py-0.5 rounded border ${
                           index < 2
                             ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                             : 'bg-amber-950/50 text-amber-300 border-amber-800/50'
                         }`}
                       >
                         {index < 2 ? 'Comptage initial' : 'Vérification en litige'}
                       </span>
                     </div>
                     <input
                       type="hidden"
                       {...register(`users.${index}.responsibility`)}
                       value={index < 2 ? 'COUNT' : 'ADJUDICATE'}
                     />
                  </div>
                  {fields.length > 2 && (
                    <button 
                      type="button" 
                      onClick={() => remove(index)}
                      className="h-9 px-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-[3px] text-xs font-medium transition-colors cursor-pointer"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              ))}
              {errors.users && (
                <p className="text-xs text-red-400 font-medium">
                  {errors.users.message || (errors.users as any)?.root?.message || 'Au moins 2 participants distincts sont obligatoires.'}
                </p>
              )}
              <button 
                type="button" 
                onClick={() => append({ userId: '', responsibility: 'COUNT' })}
                className="text-xs font-medium text-[#f7f5f0] underline hover:text-[#dad2c1] cursor-pointer"
              >
                + Ajouter un participant
              </button>
            </div>
          </section>

          <div className="flex justify-end gap-3 pt-4">
            <Link
              href="/inventory"
              className="px-4 py-2 bg-transparent text-[#c9c0ad] hover:text-[#f7f5f0] text-xs font-medium rounded-[3px] transition-colors"
            >
              Annuler
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>Enregistrer le brouillon</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
