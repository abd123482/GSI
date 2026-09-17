'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  FileCheck2,
  Download,
  AlertOctagon,
  AlertTriangle,
  Scale,
  CheckCircle2,
  Package,
  Info,
  UserPlus,
  Clock,
  Users,
} from 'lucide-react';
import {
  usePreviewAdjustments,
  useFinalizeInventory,
  useAssignThirdUser,
  useAssignThirdUserAll,
} from '@/hooks/use-inventory';
import { useAdminUsers } from '@/hooks/use-admin-users';
import { toast } from 'sonner';

export default function FinalReportPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const inventoryId = params?.id as string;
  const router = useRouter();

  const { data, isLoading } = usePreviewAdjustments(inventoryId);
  const { mutateAsync: finalize, isPending: isFinalizing } = useFinalizeInventory();
  const { mutateAsync: assignThirdUser, isPending: isAssigningOne } = useAssignThirdUser();
  const { mutateAsync: assignThirdUserAll, isPending: isAssigningAll } = useAssignThirdUserAll();
  const { users: allUsers, isUsersLoading } = useAdminUsers({ initialLimit: 100 });

  // Local selection state for assigning 3rd users
  const [selectedThirdUsers, setSelectedThirdUsers] = useState<Record<string, string>>({});
  const [globalThirdUserId, setGlobalThirdUserId] = useState<string>('');
  const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null);

  const adjustments = data?.adjustments || [];
  const discrepancyUnits = data?.discrepancyUnits || [];
  const stats = data?.stats;
  const inventory = data?.inventory;
  const isReadyToFinalize = data?.isReadyToFinalize;
  const blockingReason = data?.blockingReason;
  const isFinalized = inventory?.status === 'FINALIZED';

  const unassignedDiscrepancies = discrepancyUnits.filter((d: any) => d.needsThirdUser);
  const pendingCountDiscrepancies = discrepancyUnits.filter(
    (d: any) => d.thirdUser && d.thirdUser.status !== 'SUBMITTED' && d.status !== 'RESOLVED'
  );

  const handleAssignSingle = async (unitId: string) => {
    const thirdUserId = selectedThirdUsers[unitId];
    if (!thirdUserId) {
      toast.error('Veuillez sélectionner un 3ème utilisateur.');
      return;
    }

    try {
      setAssigningUnitId(unitId);
      await assignThirdUser({
        inventoryId,
        unitId,
        thirdUserId,
      });
      toast.success('3ème contrôleur désigné avec succès ! Une notification lui a été envoyée.');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erreur lors de l'assignation du 3ème utilisateur");
    } finally {
      setAssigningUnitId(null);
    }
  };

  const handleAssignAll = async () => {
    if (!globalThirdUserId) {
      toast.error('Veuillez sélectionner un 3ème utilisateur pour le lot.');
      return;
    }

    try {
      await assignThirdUserAll({
        inventoryId,
        thirdUserId: globalThirdUserId,
      });
      toast.success('3ème contrôleur désigné pour toutes les divergences !');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erreur lors de l'assignation globale");
    }
  };

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
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link href="/inventory" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex justify-between items-center flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                  Rapport d'Inventaire : {inventory?.title || 'Sans titre'}
                </h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] border ${
                  isFinalized 
                    ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30' 
                    : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                }`}>
                  {inventory?.status || 'IN_PROGRESS'}
                </span>
              </div>
              <p className="text-xs text-[#c9c0ad]">
                Aperçu des comptages, arbitrage par 3ème utilisateur et validation des ajustements de stock.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-medium text-[#c9c0ad] bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] rounded-[3px] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exporter / Imprimer
              </button>
            </div>
          </div>
        </div>

        {/* Section 1: Divergences / Obligation du 3ème Utilisateur */}
        {discrepancyUnits.length > 0 && (
          <section className="p-5 rounded-[4px] border border-amber-900/50 bg-amber-950/20 space-y-4 animate-in fade-in duration-150">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[3px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-amber-300">
                  {discrepancyUnits.length} divergence{discrepancyUnits.length > 1 ? 's' : ''} constatée{discrepancyUnits.length > 1 ? 's' : ''} entre les compteurs
                </h2>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  Règle d'audit : Les deux compteurs initiaux ont saisi des quantités différentes. Le créateur de l'inventaire doit <strong>obligatoirement désigner un 3ème utilisateur indépendant</strong> pour effectuer le comptage de départage.
                </p>
              </div>
            </div>

            {/* Quick Batch Assignment Bar */}
            {unassignedDiscrepancies.length > 1 && (
              <div className="p-3 bg-[#26221f] rounded-[3px] border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-medium text-[#f7f5f0]">
                    Action groupée ({unassignedDiscrepancies.length} conflits non assignés) :
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={globalThirdUserId}
                    onChange={(e) => setGlobalThirdUserId(e.target.value)}
                    className="h-8 text-xs bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] px-2.5 text-[#f7f5f0] focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Choisir un 3ème utilisateur pour tous --</option>
                    {allUsers.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.userName || u.userEmail} ({u.role?.roleName || 'Utilisateur'})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!globalThirdUserId || isAssigningAll}
                    onClick={handleAssignAll}
                    className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-[#2b2622] font-semibold rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                  >
                    {isAssigningAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                    <span>Assigner à toutes les divergences</span>
                  </button>
                </div>
              </div>
            )}

            {/* Grid of Discrepancy Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {discrepancyUnits.map((disc: any) => {
                // Filter potential 3rd users to exclude the 2 initial counters
                const availableThirdUsers = allUsers.filter(
                  (u) => !disc.initialCounterIds?.includes(u.userId)
                );

                return (
                  <div 
                    key={disc.unitId} 
                    className={`p-3.5 rounded-[3px] bg-[#26221f] border flex flex-col justify-between space-y-3 transition-colors ${
                      disc.needsThirdUser ? 'border-amber-900/60 hover:border-amber-500/50' : 'border-[#3f3a36]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#f7f5f0] flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-[#10b981]" />
                          {disc.equipmentName}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950/60 border border-red-900/60 text-red-300">
                          Écart constaté
                        </span>
                      </div>

                      {/* Display Initial Counts */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#3f3a36]/60">
                        {disc.counts?.map((cnt: any, idx: number) => (
                          <div key={idx} className="p-2 bg-[#1f1b18] rounded border border-[#3f3a36]/50">
                            <p className="text-[10px] text-[#aea69c] font-mono truncate">{cnt.userName}</p>
                            <p className="text-sm font-bold text-[#f7f5f0]">{cnt.quantity} <span className="text-[10px] font-normal text-[#aea69c]">pcs</span></p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 3rd User Enforcement Action or Status */}
                    <div className="pt-2 border-t border-[#3f3a36] space-y-2">
                      {disc.needsThirdUser ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
                            <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                            <span>Désigner un 3ème utilisateur obligatoire :</span>
                          </div>
                          <div className="flex gap-1.5">
                            <select
                              value={selectedThirdUsers[disc.unitId] || ''}
                              onChange={(e) =>
                                setSelectedThirdUsers((prev) => ({
                                  ...prev,
                                  [disc.unitId]: e.target.value,
                                }))
                              }
                              className="flex-1 h-8 text-xs bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] px-2 text-[#f7f5f0] focus:outline-none focus:border-amber-400"
                            >
                              <option value="">-- Choisir un contrôleur tiers --</option>
                              {availableThirdUsers.map((u) => (
                                <option key={u.userId} value={u.userId}>
                                  {u.userName || u.userEmail}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={!selectedThirdUsers[disc.unitId] || assigningUnitId === disc.unitId}
                              onClick={() => handleAssignSingle(disc.unitId)}
                              className="px-2.5 h-8 text-xs bg-[#f7f5f0] hover:bg-[#dad2c1] text-[#2b2622] font-medium rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              {assigningUnitId === disc.unitId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              <span>Désigner</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-2 rounded bg-[#1f1b18] border border-[#3f3a36] flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <div className="truncate">
                                <p className="text-[10px] text-[#aea69c]">3ème contrôleur désigné :</p>
                                <p className="text-xs font-semibold text-[#f7f5f0] truncate">
                                  {disc.thirdUser?.userName}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 shrink-0">
                              {disc.thirdUser?.status === 'SUBMITTED' ? 'Compté' : 'En attente'}
                            </span>
                          </div>

                          <div className="flex justify-end">
                            <Link
                              href={`/inventory/adjudicate/${disc.unitId}`}
                              className="inline-flex items-center gap-1.5 text-xs bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] px-3 py-1.5 rounded-[3px] font-medium transition-colors cursor-pointer"
                            >
                              <Scale className="w-3.5 h-3.5 text-amber-400" />
                              <span>Comptage de départage</span>
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Section 2: Ajustements Proposés */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-[#f7f5f0]">Ajustements de Stock Proposés</h2>
                <span className="text-xs font-mono text-[#aea69c]">{adjustments.length} ajustement{adjustments.length > 1 ? 's' : ''}</span>
              </div>

              {adjustments.length === 0 ? (
                <div className="p-8 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26] text-center space-y-2">
                  {discrepancyUnits.length > 0 ? (
                    <>
                      <Info className="w-6 h-6 text-amber-400 mx-auto" />
                      <p className="text-xs text-[#aea69c]">
                        Les ajustements seront calculés dès que les <strong className="text-[#f7f5f0]">{discrepancyUnits.length} divergences</strong> ci-dessus auront été arbitrées par les 3èmes contrôleurs.
                      </p>
                    </>
                  ) : isReadyToFinalize ? (
                    <>
                      <CheckCircle2 className="w-6 h-6 text-[#10b981] mx-auto" />
                      <p className="text-xs text-[#f7f5f0] font-medium">
                        Tous les comptages correspondent exactement au stock actuel !
                      </p>
                      <p className="text-[11px] text-[#aea69c]">
                        Aucune modification de stock n'est requise. Vous pouvez finaliser cet inventaire en toute sécurité.
                      </p>
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-[#aea69c] mx-auto" />
                      <p className="text-xs text-[#aea69c]">
                        Comptages en cours. Les résultats s'afficheront au fur et à mesure.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                  <table className="w-full text-left border-collapse bg-[#2f2a26]">
                    <thead>
                      <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Équipement</th>
                        <th className="px-4 py-3 font-medium">Emplacement</th>
                        <th className="px-4 py-3 font-medium">Ancien Stock</th>
                        <th className="px-4 py-3 font-medium text-center">Comptage Final</th>
                        <th className="px-4 py-3 font-medium text-center">Écart</th>
                        <th className="px-4 py-3 font-medium">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3f3a36]">
                      {adjustments.map((adj: any, i: number) => (
                        <tr key={i} className="hover:bg-[#383330] transition-colors">
                          <td className="px-4 py-3 text-sm">
                            <p className="font-medium text-[#f7f5f0]">{adj.equipmentName || adj.equipmentId}</p>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-[#c9c0ad]">{adj.shelfName || adj.shelfId}</td>
                          <td className="px-4 py-3 text-sm font-mono text-[#aea69c]">{adj.expectedQty} pcs</td>
                          <td className="px-4 py-3 text-sm font-mono text-center font-bold text-[#f7f5f0]">
                            {adj.countedQty} pcs
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-center">
                            <span className={`px-2 py-0.5 rounded-[2px] font-bold text-xs ${
                              adj.delta > 0 
                                ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30' 
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}>
                              {adj.delta > 0 ? `+${adj.delta}` : adj.delta}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs italic text-[#c9c0ad]">Ajustement inventaire</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className={`p-5 border rounded-[4px] space-y-4 ${
              isFinalized 
                ? 'border-[#10b981]/30 bg-[#10b981]/5' 
                : 'border-red-900/50 bg-red-950/20'
            }`}>
              <h3 className={`text-sm font-medium flex items-center gap-2 ${
                isFinalized ? 'text-[#10b981]' : 'text-red-300'
              }`}>
                {isFinalized ? <CheckCircle2 className="w-4 h-4" /> : <AlertOctagon className="w-4 h-4" />}
                {isFinalized ? 'Inventaire Clôturé' : "Clôture de l'Inventaire"}
              </h3>

              {isFinalized ? (
                <p className="text-xs text-[#c9c0ad] leading-relaxed">
                  Cet inventaire a été clôturé et ses ajustements ont été définitivement appliqués aux stocks.
                </p>
              ) : (
                <>
                  <p className="text-xs text-red-200/80 leading-relaxed">
                    La clôture de cet inventaire appliquera de manière irréversible ces ajustements sur les quantités de stock réelles en base de données.
                  </p>

                  {!isReadyToFinalize && blockingReason && (
                    <div className="p-2.5 rounded bg-[#2b2622] border border-amber-900/60 text-[11px] text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" />
                      <span>{blockingReason}</span>
                    </div>
                  )}

                  <button 
                    type="button"
                    disabled={!isReadyToFinalize || isFinalizing}
                    onClick={async () => {
                       try {
                         await finalize(inventoryId);
                         toast.success('Inventaire clôturé et stocks ajustés avec succès !');
                         router.push('/inventory');
                       } catch (e: any) {
                         toast.error(e?.response?.data?.message || 'Erreur lors de la finalisation');
                       }
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-[3px] transition-colors cursor-pointer ${
                      isReadyToFinalize && !isFinalizing
                        ? 'bg-red-900/90 hover:bg-red-800 text-red-50 shadow-xs'
                        : 'bg-[#383330] text-[#aea69c] border border-[#3f3a36] cursor-not-allowed opacity-60'
                    }`}
                  >
                    {isFinalizing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Clôture en cours...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck2 className="w-4 h-4" />
                        <span>Appliquer et Finaliser</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            
            {/* Dynamic Statistics Card */}
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-2.5">
              <h3 className="text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">Statistiques en direct</h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Total équipements / unités</span>
                <span className="font-semibold text-[#f7f5f0]">{stats?.totalUnits ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Unités validées / résolues</span>
                <span className="font-semibold text-[#10b981]">{stats?.resolvedUnits ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Divergences à assigner (3ème user)</span>
                <span className={`font-semibold ${unassignedDiscrepancies.length > 0 ? 'text-amber-400 font-bold' : 'text-[#c9c0ad]'}`}>
                  {unassignedDiscrepancies.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Comptages 3 en attente</span>
                <span className={`font-semibold ${pendingCountDiscrepancies.length > 0 ? 'text-amber-300' : 'text-[#c9c0ad]'}`}>
                  {pendingCountDiscrepancies.length}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#3f3a36]">
                <span className="text-[#c9c0ad]">Ajustements de stock</span>
                <span className="font-semibold text-blue-400">{adjustments.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
