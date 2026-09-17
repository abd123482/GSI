'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { ClipboardList, Loader2, PlayCircle, ArrowLeft, Package, Layers, MapPin } from 'lucide-react';
import { useMyTasks } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';

export default function MyTasksPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, authUser, isLoading: isUserLoading } = usePermissions();
  const currentUserId = user?.userId || authUser?.userId;
  
  const { data: tasks, isLoading: isTasksLoading } = useMyTasks(currentUserId);

  if (!isLoaded || isUserLoading || isTasksLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>Chargement de vos tâches...</span>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <span className="text-sm">Connectez-vous pour voir vos tâches.</span>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3f3a36]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
              <Link href="/inventory" className="hover:text-[#f7f5f0] transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                Retour aux inventaires
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
              Mes Tâches d'Inventaire
            </h1>
            <p className="text-xs text-[#c9c0ad]">
              Liste des comptages et adjudications qui vous sont assignés avec leurs équipements et étagères.
            </p>
          </div>
        </div>

        {!tasks || tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26]">
            <ClipboardList className="w-8 h-8 text-[#5c544d] mb-3" />
            <p className="text-sm text-[#aea69c]">Aucune tâche en attente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task: any) => {
              const isByEquipment = task.unit?.inventory?.typeInventory === 'ByEquipment';
              const equipment = task.unit?.equipment;
              const shelf = task.unit?.shelf;
              const eqShelves = equipment?.equipmentShelfs || [];

              return (
                <div
                  key={task.attemptId}
                  className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] flex flex-col justify-between hover:border-[#aea69c] transition-colors space-y-4"
                >
                  <div className="space-y-3">
                    {/* Card Header: Inventory Title + Badges */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-semibold text-sm text-[#f7f5f0]">
                          {task.unit?.inventory?.title || 'Inventaire sans titre'}
                        </h3>
                        <span className="text-[10px] font-mono text-[#aea69c]">
                          {isByEquipment ? 'Mode: Par Équipement' : 'Mode: Par Étagère'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#383330] text-[#aea69c] border border-[#3f3a36]">
                          {task.purpose === 'INITIAL' ? 'COMPTAGE' : 'ADJUDICATION'}
                        </span>
                      </div>
                    </div>

                    {/* Equipment / Target Section */}
                    {isByEquipment && equipment && (
                      <div className="p-3 bg-[#26221f] rounded-[3px] border border-[#3f3a36] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                            <span className="text-xs font-medium text-[#f7f5f0] line-clamp-1">
                              {equipment.equipmentName}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#aea69c] shrink-0">
                            Total: <strong className="text-[#f7f5f0]">{equipment.equipmentQuantity}</strong>
                          </span>
                        </div>

                        {/* Shelves List for this Equipment */}
                        <div className="space-y-1 pt-1 border-t border-[#3f3a36]/60">
                          <span className="text-[10px] font-mono text-[#aea69c] uppercase flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#10b981]" />
                            Étagères attribuées ({eqShelves.length}) :
                          </span>
                          {eqShelves.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {eqShelves.map((es: any) => (
                                <span
                                  key={es.equipmentShelfId || es.shelfId}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#383330] border border-[#3f3a36] text-[#f7f5f0] flex items-center gap-1"
                                >
                                  <span>{es.shelf?.shelfName || 'Étagère'}</span>
                                  <span className="text-[#10b981]">({es.equipmentQuantity} pcs)</span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-[#8c827a] italic">
                              Stock global non encore réparti sur étagère spécifique.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ByShelf Target Section */}
                    {!isByEquipment && shelf && (
                      <div className="p-3 bg-[#26221f] rounded-[3px] border border-[#3f3a36] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                            <span className="text-xs font-medium text-[#f7f5f0]">
                              Étagère : {shelf.shelfName}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#aea69c]">
                            Capacité : {shelf.shelfQuantity ?? 'N/A'}
                          </span>
                        </div>

                        {shelf.equipmentShelfs && shelf.equipmentShelfs.length > 0 && (
                          <div className="space-y-1 pt-1 border-t border-[#3f3a36]/60">
                            <span className="text-[10px] font-mono text-[#aea69c] uppercase">
                              Matériels sur cette étagère ({shelf.equipmentShelfs.length}) :
                            </span>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {shelf.equipmentShelfs.map((es: any) => (
                                <span
                                  key={es.equipmentShelfId || es.equipmentId}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#383330] border border-[#3f3a36] text-[#f7f5f0]"
                                >
                                  {es.equipment?.equipmentName} ({es.equipmentQuantity} pcs)
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-[#aea69c] pt-1">
                      <span>Statut: <strong className="text-[#f7f5f0]">{task.status}</strong></span>
                      <span className="font-mono text-[10px]">Séquence: {task.sequence}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#3f3a36] flex justify-end gap-2">
                    <Link
                      href={task.purpose === 'ADJUDICATION' ? `/inventory/adjudicate/${task.unitId}` : `/inventory/tasks/${task.attemptId}`}
                      className="inline-flex items-center gap-2 text-xs bg-[#f7f5f0] text-[#2b2622] px-3.5 py-1.5 rounded-[3px] font-medium transition-colors hover:bg-[#dad2c1] shadow-xs cursor-pointer"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      Exécuter
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
