'use client';

import { useState } from 'react';
import { useAuth, SignInButton } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ClipboardList,
  Loader2,
  Plus,
  PlayCircle,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useInventories, useLaunchInventory, useDeleteInventory } from '@/hooks/use-inventory';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';

export default function InventoryPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const { hasPermission, isAdmin, canDeleteInventory, isLoading: isPermissionsLoading } = usePermissions();
  
  const { data, isLoading } = useInventories();
  const { mutateAsync: launchInventory } = useLaunchInventory();
  const { mutateAsync: deleteInventory, isPending: isDeleting } = useDeleteInventory();
  const [inventoryToDelete, setInventoryToDelete] = useState<any | null>(null);

  const inventoriesList = data?.inventories || [];

  if (!isLoaded || isLoading || isPermissionsLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2b2622] text-[#f7f5f0]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#aea69c]">
          <Loader2 className="w-4 h-4 animate-spin text-[#f7f5f0]" />
          <span>Chargement des inventaires...</span>
        </div>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-[#2b2622] text-[#f7f5f0]">
        <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-8 shadow-xl text-center space-y-4">
          <div className="w-10 h-10 rounded-[3px] bg-[#2b2622] border border-[#3f3a36] flex items-center justify-center text-[#f7f5f0] mx-auto">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-medium text-[#f7f5f0]">Connexion requise</h1>
            <p className="text-xs text-[#c9c0ad]">
              Veuillez vous connecter pour gérer les inventaires.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <SignInButton mode="modal">
              <button
                type="button"
                className="flex-1 px-4 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                Se connecter
              </button>
            </SignInButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#3f3a36]">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#aea69c] mb-1 font-mono">
              <Link href="/" className="hover:text-[#f7f5f0] transition-colors">
                somepharm
              </Link>
              <span>/</span>
              <span className="text-[#f7f5f0]">inventory</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-normal tracking-tight text-[#f7f5f0]">
                Inventaires & Réconciliations
              </h1>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-[2px] bg-[#383330] text-[#dad2c1] border border-[#3f3a36]">
                dbo.Inventory
              </span>
            </div>
            <p className="text-xs text-[#c9c0ad]">
              Workflow d'inventaire complet avec comptage en double aveugle et adjudication.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/inventory/tasks"
              className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
            >
              <PlayCircle className="w-3.5 h-3.5 text-[#aea69c]" />
              <span>Mes Tâches</span>
            </Link>

            {hasPermission('inventory.create') && (
              <Link
                href="/inventory/create"
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvel Inventaire</span>
              </Link>
            )}
          </div>
        </div>

        {/* Empty State / List */}
        {inventoriesList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26]">
            <ClipboardList className="w-8 h-8 text-[#5c544d] mb-3" />
            <p className="text-sm text-[#aea69c]">Aucun inventaire trouvé.</p>
            <Link href="/inventory/create" className="mt-4 text-xs font-medium text-[#f7f5f0] underline underline-offset-2 hover:text-[#dad2c1]">
              Créer votre premier inventaire
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
             {inventoriesList.map((inv: any) => (
                <div key={inv.inventoryId} className="p-4 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] flex flex-col justify-between hover:border-[#aea69c] transition-colors">
                   <div className="space-y-2">
                      <div className="flex justify-between items-start">
                         <h3 className="font-medium text-[#f7f5f0]">{inv.title}</h3>
                         <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#383330] text-[#aea69c] border border-[#3f3a36]">{inv.status}</span>
                      </div>
                      <p className="text-xs text-[#c9c0ad]">Type: {inv.typeInventory}</p>
                   </div>
                   
                   <div className="mt-4 pt-4 border-t border-[#3f3a36] flex items-center justify-between gap-2">
                      <div>
                        {(isAdmin || canDeleteInventory) && (
                          <button
                            type="button"
                            onClick={() => setInventoryToDelete(inv)}
                            className="p-1.5 rounded-[3px] text-[#aea69c] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                            title="Supprimer l'inventaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {inv.status === 'DRAFT' && (
                           <button 
                             onClick={async () => {
                               try {
                                 await launchInventory(inv.inventoryId);
                                 toast.success('Inventaire lancé!');
                               } catch (e) {
                                 toast.error('Erreur lancement');
                               }
                             }}
                             className="text-xs bg-[#f7f5f0] text-[#2b2622] px-3 py-1.5 rounded-[3px] font-medium hover:bg-[#dad2c1] transition-colors cursor-pointer"
                           >
                             Lancer
                           </button>
                        )}
                        {inv.status === 'IN_PROGRESS' && (
                           <Link href={`/inventory/${inv.inventoryId}/report`} className="text-xs border border-[#3f3a36] text-[#c9c0ad] px-3 py-1.5 rounded-[3px] font-medium hover:text-[#f7f5f0] hover:bg-[#383330] transition-colors">
                             Voir l'avancement
                           </Link>
                        )}
                        {inv.status === 'FINALIZED' && (
                           <Link href={`/inventory/${inv.inventoryId}/report`} className="text-xs border border-[#3f3a36] text-[#10b981] px-3 py-1.5 rounded-[3px] font-medium hover:bg-[#383330] transition-colors">
                             Rapport final
                           </Link>
                        )}
                      </div>
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {inventoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-[3px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-[#f7f5f0]">
                  Supprimer l'inventaire ?
                </h2>
                <p className="text-xs text-[#c9c0ad] leading-relaxed">
                  Êtes-vous sûr de vouloir supprimer définitivement{' '}
                  <strong className="text-[#f7f5f0]">
                    "{inventoryToDelete.title || 'Inventaire sans titre'}"
                  </strong>{' '}
                  ? Cette action est irréversible et supprimera tous les comptages, tâches et réconciliations liés.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#3f3a36]">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setInventoryToDelete(null)}
                className="px-3 py-1.5 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] hover:bg-[#3f3a36] text-[#f7f5f0] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  try {
                    await deleteInventory(inventoryToDelete.inventoryId);
                    toast.success('Inventaire supprimé avec succès');
                    setInventoryToDelete(null);
                  } catch (err: any) {
                    toast.error(err?.response?.data?.message || 'Erreur lors de la suppression');
                  }
                }}
                className="px-3 py-1.5 rounded-[3px] bg-red-600 hover:bg-red-700 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Suppression en cours...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer définitivement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
