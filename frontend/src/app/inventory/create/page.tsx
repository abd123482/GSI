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
  CheckCircle2
} from 'lucide-react';
import { useState } from 'react';
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'users'
  });
  const { mutateAsync: createInventory } = useCreateInventory();
  const { equipments } = useEquipments({ page: 1, limit: 100 }); // Temporary basic fetch
  const { shelves } = useShelves({ limit: 100 });

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
            <div className="flex gap-4">
              <div className="w-1/2 max-h-48 overflow-y-auto border border-[#3f3a36] bg-[#2b2622] rounded-[3px] p-2 space-y-1">
                {inventoryType === 'ByEquipment' ? (
                  equipments.length > 0 ? (
                    equipments.map(eq => (
                      <div 
                        key={eq.equipmentId} 
                        className="flex items-center justify-between hover:bg-[#383330] p-1.5 rounded transition-colors group"
                        onMouseEnter={() => setHoveredEqId(eq.equipmentId)}
                      >
                        <label className="flex items-center gap-2 text-sm cursor-pointer text-[#f7f5f0] flex-1">
                          <input type="checkbox" value={eq.equipmentId} {...register('equipmentIds')} className="accent-[#aea69c]" />
                          <span>{eq.equipmentName || eq.equipmentId}</span>
                        </label>
                        {eq.hasSerialNumber && eq.serialNumbers && eq.serialNumbers.length > 0 && (
                          <div className="relative flex items-center justify-center">
                            <div className="w-5 h-5 rounded-full bg-[#3f3a36] text-[#aea69c] flex items-center justify-center text-[10px]">
                              {eq.serialNumbers.length}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[#aea69c] p-2">Aucun équipement disponible.</div>
                  )
                ) : (
                  shelves.length > 0 ? (
                    shelves.map(shelf => (
                      <label key={shelf.shelfId} className="flex items-center gap-2 text-sm hover:bg-[#383330] p-1.5 rounded cursor-pointer transition-colors text-[#f7f5f0]">
                        <input type="checkbox" value={shelf.shelfId} {...register('shelfIds')} className="accent-[#aea69c]" />
                        <span>{shelf.shelfName}</span>
                      </label>
                    ))
                  ) : (
                    <div className="text-xs text-[#aea69c] p-2">Aucune étagère disponible.</div>
                  )
                )}
              </div>

              {/* Right Panel for SN Display */}
              {inventoryType === 'ByEquipment' && (
                <div className="w-1/2 max-h-48 border border-[#3f3a36] bg-[#2b2622] rounded-[3px] p-3 flex flex-col">
                  {hoveredEqId ? (() => {
                    const eq = equipments.find(e => e.equipmentId === hoveredEqId);
                    if (eq?.hasSerialNumber && eq.serialNumbers && eq.serialNumbers.length > 0) {
                      return (
                        <>
                          <div className="text-[11px] font-semibold text-[#f7f5f0] mb-2 truncate" title={eq.equipmentName || eq.equipmentId}>
                            SN: {eq.equipmentName}
                          </div>
                          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                            {eq.serialNumbers.map(sn => (
                              <div key={sn.serialNumberId} className="text-[11px] text-[#aea69c] bg-[#1f1b18] border border-[#3f3a36] px-2 py-1 rounded shadow-sm">
                                {sn.serialNumberCode || sn.serialNumberId}
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    }
                    return <div className="text-xs text-[#5c544d] m-auto text-center px-4">Aucun numéro de série pour cet équipement</div>;
                  })() : (
                    <div className="text-xs text-[#5c544d] m-auto text-center px-4">Survolez un équipement pour voir ses numéros de série</div>
                  )}
                </div>
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
            
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                     <label className="text-xs font-medium text-[#aea69c]">Utilisateur</label>
                     <Controller
                       control={control}
                       name={`users.${index}.userId`}
                       render={({ field: { value, onChange }, fieldState: { error } }) => (
                         <UserAutocomplete 
                           value={value} 
                           onChange={onChange} 
                           error={error?.message}
                         />
                       )}
                     />
                  </div>
                  <div className="flex-1 space-y-1.5">
                     <label className="text-xs font-medium text-[#aea69c]">Rôle</label>
                     <select {...register(`users.${index}.responsibility`)} className="w-full h-9 bg-[#2b2622] border border-[#3f3a36] rounded-[3px] px-3 text-sm focus:outline-none">
                       <option value="COUNT">Compteur</option>
                       <option value="ADJUDICATE">Adjudicateur</option>
                     </select>
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
