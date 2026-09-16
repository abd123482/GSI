'use client';

import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInventorySchema } from '@/schemas/inventory.schema';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useCreateInventory } from '@/hooks/use-inventory';
import { useEquipments } from '@/hooks/use-equipments';
import { toast } from 'sonner';

type CreateInventoryForm = z.infer<typeof createInventorySchema>;

export default function CreateInventoryPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm<CreateInventoryForm>({
    resolver: zodResolver(createInventorySchema),
    defaultValues: {
      typeInventory: 'ByEquipment',
      users: [{ userId: '', responsibility: 'COUNT' }],
      equipmentIds: [],
      shelfIds: [],
    }
  });

  const inventoryType = watch('typeInventory');
  const { mutateAsync: createInventory } = useCreateInventory();
  const { equipments } = useEquipments({ page: 1, limit: 100 }); // Temporary basic fetch

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
                <option value="ByEquipment">Par Équipement</option>
                <option value="ByShelf">Par Étagère (Emplacement)</option>
              </select>
            </div>
          </section>

          {/* Section 2: Portée */}
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <h2 className="text-sm font-medium text-[#f7f5f0]">2. Portée de l'inventaire</h2>
            <p className="text-xs text-[#c9c0ad]">
              Sélectionnez les {inventoryType === 'ByEquipment' ? 'équipements' : 'étagères'} à inclure.
            </p>
            <div className="max-h-48 overflow-y-auto border border-[#3f3a36] bg-[#2b2622] rounded-[3px] p-2 space-y-1">
              {inventoryType === 'ByEquipment' ? (
                equipments.map(eq => (
                  <label key={eq.equipmentId} className="flex items-center gap-2 text-sm hover:bg-[#383330] p-1.5 rounded cursor-pointer">
                    <input type="checkbox" value={eq.equipmentId} {...register('equipmentIds')} className="accent-[#aea69c]" />
                    <span>{eq.equipmentName || eq.equipmentId}</span>
                  </label>
                ))
              ) : (
                <div className="text-xs text-[#aea69c] p-2">Sélection d'étagères (À connecter)</div>
              )}
            </div>
            {(errors.equipmentIds || errors.shelfIds) && (
              <p className="text-[10px] text-red-400">Veuillez sélectionner au moins un élément.</p>
            )}
          </section>

          {/* Section 3: Participants */}
          <section className="space-y-4 p-5 rounded-[4px] border border-[#3f3a36] bg-[#2f2a26]">
            <h2 className="text-sm font-medium text-[#f7f5f0]">3. Participants & Escalade</h2>
            <p className="text-xs text-[#c9c0ad]">
              Définissez les utilisateurs qui effectueront le comptage et l'adjudication finale.
            </p>
            
            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1.5">
                   <label className="text-xs font-medium text-[#aea69c]">Utilisateur ID</label>
                   <input {...register('users.0.userId')} placeholder="Saisir ID utilisateur Clerk..." className="w-full h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-3 text-sm focus:outline-none" />
                </div>
                <div className="flex-1 space-y-1.5">
                   <label className="text-xs font-medium text-[#aea69c]">Rôle</label>
                   <select {...register('users.0.responsibility')} className="w-full h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-3 text-sm focus:outline-none">
                     <option value="COUNT">Compteur</option>
                     <option value="ADJUDICATE">Adjudicateur</option>
                   </select>
                </div>
              </div>
              <button type="button" className="text-[10px] font-medium text-[#f7f5f0] underline hover:text-[#dad2c1]">
                + Ajouter un participant (Interface en dev)
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] text-xs font-medium rounded-[3px] shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
