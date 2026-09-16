'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useState } from 'react';
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
  
  const [observations, setObservations] = useState<{ qty: number, notes: string }[]>([]);

  if (!isLoaded || !isSignedIn || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link href="/inventory/tasks" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                Tâche de comptage
              </h1>
              <p className="text-xs text-[#c9c0ad]">
                {attempt?.unit?.equipment?.equipmentName || 'Équipement / Étagère'} — {attempt?.unitId}
              </p>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 bg-[#383330] border border-[#3f3a36] text-[#aea69c] rounded-[2px]">
              Tâche: {taskId}
            </div>
          </div>
        </div>

        {/* Info Banner */}
        <div className="bg-[#383330] border-l-2 border-[#10b981] p-4 rounded-r-[4px] text-sm text-[#f7f5f0]">
          <p>
            Veuillez compter physiquement les quantités de <strong>{attempt?.unit?.equipment?.equipmentName || 'ce matériel'}</strong> présentes. 
            Si l'équipement possède un numéro de série, scannez-le. 
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Form */}
          <div className="md:col-span-2 space-y-6">
            <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
              <div className="flex justify-between items-center">
                 <h2 className="text-sm font-medium text-[#f7f5f0]">Observations</h2>
                 <button className="text-[10px] text-[#10b981] underline hover:text-[#059669]">
                   Scanner QR
                 </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 border border-[#3f3a36] rounded-[3px] bg-[#2b2622] space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-mono text-[#5c544d]">
                    <span>Qté Attendue: {attempt?.unit?.equipment?.equipmentQuantity || '?'}</span>
                    <span>{attempt?.unit?.equipment?.equipmentName || 'Équipement'}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono text-[#aea69c]">ÉTAGÈRE OBSERVÉE</label>
                      <select className="w-full h-8 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-2 text-xs focus:outline-none">
                        <option>{attempt?.unit?.expectedLocation}</option>
                        <option>Autre emplacement...</option>
                      </select>
                    </div>
                    <div className="space-y-1 w-24">
                      <label className="text-[10px] font-mono text-[#aea69c]">QUANTITÉ</label>
                      <input type="number" min="0" defaultValue={1} className="w-full h-8 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-2 text-xs focus:outline-none" />
                    </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-mono text-[#aea69c]">NOTES (Optionnel)</label>
                      <input type="text" placeholder="Observations spécifiques..." className="w-full h-8 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-2 text-xs focus:outline-none" />
                  </div>
                </div>

                <button type="button" className="text-xs font-medium text-[#f7f5f0] border border-dashed border-[#3f3a36] rounded-[3px] w-full py-2 hover:bg-[#383330] transition-colors">
                  + Ajouter une observation
                </button>
              </div>
            </section>

            <section className="space-y-4 p-5 rounded-[4px] border border-red-900/30 bg-red-950/10">
              <h2 className="text-sm font-medium text-red-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Signaler un problème
              </h2>
              <p className="text-xs text-red-300/70">
                Utilisez cette section si vous trouvez un équipement inconnu ou un produit endommagé.
              </p>
              <button className="text-xs font-medium text-red-300 border border-red-900/50 bg-red-950/30 px-3 py-1.5 rounded-[3px] hover:bg-red-900/40 transition-colors">
                Enregistrer une anomalie
              </button>
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26] space-y-4">
              <h3 className="text-xs font-medium text-[#aea69c] uppercase tracking-wider">Actions</h3>
              <button 
                onClick={async () => {
                  try {
                    await submitTask({ taskId, data: { observations, isDraft: true }});
                    toast.success('Brouillon sauvegardé');
                  } catch (e) {
                    toast.error('Erreur lors de la sauvegarde');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] text-xs font-medium rounded-[3px] transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-[#aea69c]" />
                Sauvegarder
              </button>
              <button 
                onClick={async () => {
                  try {
                    await submitTask({ taskId, data: { observations, isDraft: false }});
                    toast.success('Compte soumis avec succès');
                    router.push('/inventory');
                  } catch (e) {
                    toast.error('Erreur lors de la soumission');
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Soumettre le compte
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
