'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Scale,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAdjudicationUnit, useAdjudicate } from '@/hooks/use-inventory';
import { useState } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export default function AdjudicatePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const unitId = params?.unitId as string;
  const router = useRouter();

  const { data: unit, isLoading } = useAdjudicationUnit(unitId);
  const { mutateAsync: adjudicate } = useAdjudicate();
  
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');

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
          <Link href="/inventory" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                Adjudication de Conflit
              </h1>
              <p className="text-xs text-[#c9c0ad]">
                Résoudre la divergence de comptage pour {unit?.equipment?.equipmentName || unit?.unitId}
              </p>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 bg-red-950/50 border border-red-900/50 text-red-300 rounded-[2px] flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              Désaccord détecté
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {unit?.attempts?.filter((a: any) => a.purpose === 'INITIAL').map((attempt: any, idx: number) => {
             const qty = attempt.orders.reduce((sum: number, o: any) => sum + (o.quantityCalculated || 0), 0);
             const shelf = attempt.orders[0]?.shelf?.shelfName || unit.shelf?.shelfName || 'Étagère non définie';
             const notes = attempt.orders[0]?.notes || 'Aucune observation';
             return (
            <div key={idx} className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-[#f7f5f0]">
                  Compteur : <span className="font-semibold text-[#10b981]">{attempt.assignedUser?.userName || attempt.assignedUser?.userEmail || attempt.assignedUserId}</span>
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#383330] text-[#aea69c]">Séquence {attempt.sequence}</span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-[#5c544d]">QUANTITÉ TROUVÉE</p>
                <p className="text-xl font-medium text-[#f7f5f0]">{qty} pcs</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono text-[#5c544d]">EMPLACEMENT</p>
                <p className="text-sm text-[#dad2c1]">{shelf}</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-[#3f3a36]">
                <p className="text-[10px] font-mono text-[#5c544d]">NOTES DU COMPTEUR</p>
                <p className="text-xs text-[#c9c0ad] italic">"{notes}"</p>
              </div>
            </div>
             );
          })}
        </div>

        <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2b2622]">
           <h2 className="text-sm font-medium flex items-center gap-2">
             <Scale className="w-4 h-4 text-[#10b981]" />
             Décision finale
           </h2>
           <p className="text-xs text-[#c9c0ad]">
             En tant qu'adjudicateur, saisissez la quantité correcte à appliquer au stock.
           </p>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#aea69c]">QUANTITÉ RETENUE</label>
                <input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 0)} className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-3 text-sm focus:outline-none text-[#f7f5f0]" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-[#aea69c]">JUSTIFICATION OBLIGATOIRE</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: Vérification physique effectuée..." className="w-full h-9 bg-[#383330] border border-[#3f3a36] rounded-[2px] px-3 text-sm focus:outline-none text-[#f7f5f0]" />
              </div>
           </div>

           <div className="flex justify-end pt-2">
              <button 
                onClick={async () => {
                   if (!notes) return toast.error('Justification requise');
                   try {
                     await adjudicate({ inventoryId: unit.inventoryId, unitId, data: { quantity, notes } });
                     toast.success('Divergence arbitrée avec succès !');
                     router.push(`/inventory/${unit.inventoryId}/report`);
                   } catch (e: any) {
                     toast.error(e?.response?.data?.message || 'Erreur lors de l\'adjudication');
                   }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valider l'adjudication
              </button>
           </div>
        </section>
      </div>
    </main>
  );
}
