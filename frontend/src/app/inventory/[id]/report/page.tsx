'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  FileCheck2,
  Download,
  AlertOctagon
} from 'lucide-react';
import { usePreviewAdjustments, useFinalizeInventory } from '@/hooks/use-inventory';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function FinalReportPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const inventoryId = params?.id as string;
  const router = useRouter();

  const { data, isLoading } = usePreviewAdjustments(inventoryId);
  const { mutateAsync: finalize } = useFinalizeInventory();

  const adjustments = data?.adjustments || [];

  if (!isLoaded || !isSignedIn || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link href="/inventory" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                Rapport d'Inventaire
              </h1>
              <p className="text-xs text-[#c9c0ad]">
                Aperçu des ajustements de stock finaux avant clôture.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs font-medium text-[#c9c0ad] bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] rounded-[3px] flex items-center gap-2">
                <Download className="w-3.5 h-3.5" /> Exporter PDF
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-[#f7f5f0]">Ajustements Proposés</h2>
              <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                <table className="w-full text-left border-collapse bg-[#2f2a26]">
                  <thead>
                    <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                      <th className="px-4 py-3 font-medium">Équipement</th>
                      <th className="px-4 py-3 font-medium">Emplacement</th>
                      <th className="px-4 py-3 font-medium">Ancien</th>
                      <th className="px-4 py-3 font-medium text-center">Nouveau</th>
                      <th className="px-4 py-3 font-medium">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3f3a36]">
                    {adjustments.map((adj: any, i: number) => (
                      <tr key={i} className="hover:bg-[#383330] transition-colors">
                        <td className="px-4 py-3 text-sm">
                          <p className="font-medium text-[#f7f5f0]">{adj.equipmentId}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">{adj.shelfId}</td>
                        <td className="px-4 py-3 text-sm line-through text-[#aea69c]">{adj.expectedQty}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className={`px-2 py-1 rounded-[2px] font-medium ${adj.countedQty > adj.expectedQty ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-red-500/10 text-red-400'}`}>
                            {adj.countedQty}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs italic text-[#c9c0ad]">Ajustement automatique</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="p-5 border border-red-900/50 bg-red-950/20 rounded-[4px] space-y-4">
              <h3 className="text-sm font-medium text-red-300 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4" />
                Clôture de l'Inventaire
              </h3>
              <p className="text-xs text-red-200/80">
                La clôture de cet inventaire appliquera de manière irréversible ces ajustements sur la base de données. 
                Des enregistrements dans `InventoryStockAdjustment` seront créés.
              </p>
              <button 
                onClick={async () => {
                   try {
                     await finalize(inventoryId);
                     toast.success('Inventaire finalisé avec succès');
                     router.push('/inventory');
                   } catch (e) {
                     toast.error('Erreur lors de la finalisation');
                   }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-900/80 hover:bg-red-800 text-red-50 text-xs font-medium rounded-[3px] transition-colors"
              >
                <FileCheck2 className="w-4 h-4" />
                Appliquer et Finaliser
              </button>
            </div>
            
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-2">
              <h3 className="text-[10px] font-mono text-[#aea69c] uppercase">Statistiques</h3>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#c9c0ad]">Unités comptées</span>
                <span className="font-medium">142</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#c9c0ad]">Divergences résolues</span>
                <span className="font-medium text-amber-500">12</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#c9c0ad]">Modifications de stock</span>
                <span className="font-medium text-blue-400">{adjustments.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
