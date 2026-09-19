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
  ClipboardList,
  Zap,
  Search,
  FileText,
  Layers,
  ShieldCheck,
  Check,
  TrendingUp,
  TrendingDown,
  Send,
  BellRing,
} from 'lucide-react';
import {
  usePreviewAdjustments,
  useFinalizeInventory,
  useAssignThirdUser,
  useAssignThirdUserAll,
  useAutoCompleteCounts,
  useNotifyPendingController,
  useNotifyAllPendingControllers,
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
  const { mutateAsync: autoComplete, isPending: isAutoCompleting } = useAutoCompleteCounts();
  const { mutateAsync: notifyPendingUnit } = useNotifyPendingController();
  const { mutateAsync: notifyAllPending, isPending: isNotifyingAll } = useNotifyAllPendingControllers();
  const { users: allUsers } = useAdminUsers({ initialLimit: 100 });

  const [notifyingUnitId, setNotifyingUnitId] = useState<string | null>(null);

  // UI Tabs & Filters
  const [activeTab, setActiveTab] = useState<'all' | 'adjustments' | 'discrepancies'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CONFORME' | 'ECART' | 'PENDING'>('ALL');

  // Local selection state for assigning 3rd users
  const [selectedThirdUsers, setSelectedThirdUsers] = useState<Record<string, string>>({});

  const handleNotifyUnit = async (unitId: string) => {
    try {
      setNotifyingUnitId(unitId);
      const res = await notifyPendingUnit({ inventoryId, unitId });
      toast.success(res?.message || 'Notification envoyée avec succès au contrôleur en attente');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erreur lors de l’envoi de la notification');
    } finally {
      setNotifyingUnitId(null);
    }
  };

  const handleNotifyAllPending = async () => {
    try {
      const res = await notifyAllPending(inventoryId);
      toast.success(res?.message || 'Notifications envoyées aux contrôleurs en attente selon l’ordre');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erreur lors de l’envoi des notifications');
    }
  };
  const [globalThirdUserId, setGlobalThirdUserId] = useState<string>('');
  const [assigningUnitId, setAssigningUnitId] = useState<string | null>(null);

  const adjustments = data?.adjustments || [];
  const itemsReport = data?.itemsReport || [];
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

  // Filter items in the full inventory report table
  const filteredItems = itemsReport.filter((item: any) => {
    const matchesSearch =
      (item.equipmentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.shelfName || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'CONFORME') return item.resultStatus === 'CONFORME';
    if (statusFilter === 'ECART') return item.resultStatus === 'SURPLUS' || item.resultStatus === 'DEFICIT';
    if (statusFilter === 'PENDING') return !item.isResolved;
    return true;
  });

  if (!isLoaded || !isSignedIn || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  const completionPercentage = stats?.totalUnits
    ? Math.round(((stats.resolvedUnits ?? 0) / stats.totalUnits) * 100)
    : 0;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-[#f7f5f0] flex flex-col">
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[#3f3a36]">
          <Link href="/inventory" className="p-2 -ml-2 rounded-md hover:bg-[#383330] text-[#aea69c] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 flex justify-between items-center flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                  Rapport d'Inventaire : <strong className="font-semibold">{inventory?.title || 'Sans titre'}</strong>
                </h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] border font-medium ${
                  isFinalized 
                    ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' 
                    : 'bg-[#383330] text-amber-400 border-[#3f3a36]'
                }`}>
                  {isFinalized ? 'CLÔTURÉ' : 'EN COURS'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#1f1b18] text-[#aea69c] border border-[#3f3a36]">
                  {inventory?.typeInventory === 'ByShelf' ? 'Par Emplacement' : 'Par Article'}
                </span>
              </div>
              <p className="text-xs text-[#c9c0ad] mt-1">
                Rapport complet exhaustif des comptages physiques, conformité des stocks et validation des ajustements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 text-xs font-medium text-[#c9c0ad] bg-[#383330] hover:bg-[#3f3a36] border border-[#3f3a36] rounded-[3px] flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Exporter / Imprimer le Rapport
              </button>
            </div>
          </div>
        </div>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Couverture & Progression */}
          <div className="p-4 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#aea69c]">Couverture Globale</span>
              <Layers className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#f7f5f0] font-mono">
                {stats?.resolvedUnits ?? 0} <span className="text-xs font-normal text-[#aea69c]">/ {stats?.totalUnits ?? 0}</span>
              </span>
              <span className={`text-xs font-mono font-medium ${completionPercentage === 100 ? 'text-[#10b981]' : 'text-amber-400'}`}>
                ({completionPercentage}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-[#1f1b18] rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${completionPercentage === 100 ? 'bg-[#10b981]' : 'bg-amber-400'}`}
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-[#aea69c]">
              {stats?.pendingUnits && stats.pendingUnits > 0
                ? `${stats.pendingUnits} unité(s) en attente de comptage`
                : 'Toutes les unités sont inventoriées'}
            </p>
          </div>

          {/* Card 2: Conformité des Stocks */}
          <div className="p-4 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#aea69c]">Stock Conforme</span>
              <ShieldCheck className="w-4 h-4 text-[#10b981]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#10b981] font-mono">
                {stats?.conformeUnits ?? 0}
              </span>
              <span className="text-xs font-mono text-[#aea69c]">
                sur {itemsReport.length} articles
              </span>
            </div>
            <p className="text-[11px] text-[#aea69c]">
              Quantités physiques 100% identiques au stock théorique (0 écart).
            </p>
          </div>

          {/* Card 3: Écarts Détectés */}
          <div className="p-4 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#aea69c]">Écarts Détectés</span>
              <Scale className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-400 font-mono">
                {adjustments.length}
              </span>
              <span className="text-xs font-mono text-[#aea69c]">
                ajustement(s)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-emerald-400 inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> {stats?.surplusUnits ?? 0} surplus
              </span>
              <span className="text-[#aea69c]">•</span>
              <span className="text-red-400 inline-flex items-center gap-0.5">
                <TrendingDown className="w-3 h-3" /> {stats?.deficitUnits ?? 0} déficit
              </span>
            </div>
          </div>

          {/* Card 4: Quantités Physiques */}
          <div className="p-4 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#aea69c]">Volume Physique</span>
              <Package className="w-4 h-4 text-[#aea69c]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-[#f7f5f0] font-mono">
                {stats?.totalCountedQty ?? 0}
              </span>
              <span className="text-xs font-mono text-[#aea69c]">
                / {stats?.totalExpectedQty ?? 0} pcs attendues
              </span>
            </div>
            <p className="text-[11px] text-[#aea69c]">
              Total des articles comptés et vérifiés par les équipes.
            </p>
          </div>
        </div>

        {/* Section 1: Divergences / Obligation du 3ème Utilisateur (if any) */}
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
                              className="h-8 flex-1 text-xs bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] px-2 text-[#f7f5f0] focus:outline-none focus:border-amber-400"
                            >
                              <option value="">-- Sélectionner l'arbitre --</option>
                              {availableThirdUsers.map((u) => (
                                <option key={u.userId} value={u.userId}>
                                  {u.userName || u.userEmail} ({u.role?.roleName || 'Utilisateur'})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={assigningUnitId === disc.unitId || !selectedThirdUsers[disc.unitId]}
                              onClick={() => handleAssignSingle(disc.unitId)}
                              className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-[#2b2622] font-semibold rounded-[3px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                            >
                              {assigningUnitId === disc.unitId ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Valider'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-xs pt-1">
                          <div className="flex items-center gap-1.5 text-amber-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Arbitre : <strong>{disc.thirdUser?.userName}</strong></span>
                          </div>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            disc.thirdUser?.status === 'SUBMITTED' 
                              ? 'bg-[#10b981]/20 text-[#10b981]' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {disc.thirdUser?.status === 'SUBMITTED' 
                              ? `Compté: ${disc.thirdUser?.submittedQuantity} pcs` 
                              : 'En attente'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Main Content & Sidebar Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-[#3f3a36] pb-1 gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                    activeTab === 'all'
                      ? 'border-[#10b981] text-[#f7f5f0] bg-[#383330]'
                      : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Rapport Exhaustif ({itemsReport.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('adjustments')}
                  className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                    activeTab === 'adjustments'
                      ? 'border-blue-400 text-[#f7f5f0] bg-[#383330]'
                      : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5 text-blue-400" />
                  <span>Ajustements de Stock ({adjustments.length})</span>
                </button>
              </div>

              {/* Status summary pill */}
              <span className="text-xs font-mono text-[#aea69c]">
                {stats?.resolvedUnits ?? 0} sur {stats?.totalUnits ?? 0} unités validées
              </span>
            </div>

            {/* TAB 1: RAPPORT COMPLET DES ARTICLES */}
            {activeTab === 'all' && (
              <section className="space-y-3">
                {/* Search & Status Filter Bar */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 p-3 rounded-[4px] bg-[#2f2a26] border border-[#3f3a36]">
                  <div className="flex items-center gap-2.5 w-full md:w-auto flex-1">
                    <div className="relative w-full sm:w-72">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#aea69c]" />
                      <input
                        type="text"
                        placeholder="Filtrer par article ou emplacement..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-8 pl-8 pr-3 text-xs bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] text-[#f7f5f0] placeholder:text-[#8a8075] focus:outline-none focus:border-[#10b981]"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ALL')}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors cursor-pointer ${
                          statusFilter === 'ALL'
                            ? 'bg-[#10b981] text-[#1f1b18] font-bold'
                            : 'bg-[#1f1b18] text-[#aea69c] border border-[#3f3a36] hover:text-[#f7f5f0]'
                        }`}
                      >
                        Tous ({itemsReport.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('CONFORME')}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors cursor-pointer ${
                          statusFilter === 'CONFORME'
                            ? 'bg-[#10b981] text-[#1f1b18] font-bold'
                            : 'bg-[#1f1b18] text-[#10b981] border border-[#3f3a36] hover:bg-[#10b981]/10'
                        }`}
                      >
                        Conformes ({stats?.conformeUnits ?? 0})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('ECART')}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors cursor-pointer ${
                          statusFilter === 'ECART'
                            ? 'bg-blue-500 text-white font-bold'
                            : 'bg-[#1f1b18] text-blue-400 border border-[#3f3a36] hover:bg-blue-500/10'
                        }`}
                      >
                        Écarts ({adjustments.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('PENDING')}
                        className={`px-2.5 py-1 text-[11px] font-mono rounded-[2px] transition-colors cursor-pointer ${
                          statusFilter === 'PENDING'
                            ? 'bg-amber-500 text-[#1f1b18] font-bold'
                            : 'bg-[#1f1b18] text-amber-400 border border-[#3f3a36] hover:bg-amber-500/10'
                        }`}
                      >
                        En cours ({stats?.pendingUnits ?? 0})
                      </button>
                    </div>
                  </div>

                  {stats?.pendingUnits && stats.pendingUnits > 0 && !isFinalized && (
                    <button
                      type="button"
                      disabled={isNotifyingAll}
                      onClick={handleNotifyAllPending}
                      className="h-8 px-3 text-xs bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#10b981]/40 font-mono rounded-[3px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Envoyer des notifications aux contrôleurs en attente selon l'ordre de passage"
                    >
                      {isNotifyingAll ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <BellRing className="w-3.5 h-3.5" />
                      )}
                      <span>Notifier les contrôleurs en attente ({stats.pendingUnits})</span>
                    </button>
                  )}
                </div>

                {/* Comprehensive Results Table */}
                {filteredItems.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26] text-center space-y-2">
                    <p className="text-xs text-[#aea69c]">Aucun article ne correspond à votre filtre.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                    <table className="w-full text-left border-collapse bg-[#2f2a26]">
                      <thead>
                        <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                          <th className="px-3.5 py-3 font-medium">Article</th>
                          <th className="px-3.5 py-3 font-medium">Emplacement</th>
                          <th className="px-3 py-3 font-medium text-center">Stock Initial</th>
                          <th className="px-3 py-3 font-medium text-center">1er Compteur</th>
                          <th className="px-3 py-3 font-medium text-center">2ème Compteur</th>
                          <th className="px-3 py-3 font-medium text-center">Comptage Final</th>
                          <th className="px-3 py-3 font-medium text-center">Écart</th>
                          <th className="px-3.5 py-3 font-medium text-right">Statut / Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#3f3a36] text-xs font-mono">
                        {filteredItems.map((item: any, idx: number) => {
                          const isConforme = item.resultStatus === 'CONFORME';
                          const isSurplus = item.resultStatus === 'SURPLUS';
                          const isDeficit = item.resultStatus === 'DEFICIT';
                          const isPending = !item.isResolved;

                          return (
                            <tr key={idx} className="hover:bg-[#383330] transition-colors">
                              <td className="px-3.5 py-3 font-sans">
                                <p className="font-medium text-[#f7f5f0]">{item.equipmentName}</p>
                                <span className="text-[10px] text-[#aea69c] font-mono">{item.equipmentId?.slice(0, 8)}</span>
                              </td>
                              <td className="px-3.5 py-3 text-[#c9c0ad]">
                                {item.shelfName}
                              </td>
                              <td className="px-3 py-3 text-center text-[#aea69c]">
                                {item.expectedQty} pcs
                              </td>
                              <td className="px-3 py-3 text-center">
                                {item.counter1?.quantity !== null ? (
                                  <span className="text-[#f7f5f0] font-semibold">{item.counter1.quantity} pcs</span>
                                ) : (
                                  <span className="text-[#8a8075] italic text-[11px]">{item.counter1?.status}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {item.counter2?.quantity !== null ? (
                                  <span className="text-[#f7f5f0] font-semibold">{item.counter2.quantity} pcs</span>
                                ) : (
                                  <span className="text-[#8a8075] italic text-[11px]">{item.counter2?.status}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center font-bold">
                                {item.countedQty !== null ? (
                                  <span className="text-[#f7f5f0] text-sm">{item.countedQty} pcs</span>
                                ) : (
                                  <span className="text-amber-400 italic text-[11px]">En cours</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {item.delta !== null ? (
                                  <span className={`px-2 py-0.5 rounded-[2px] font-bold text-xs ${
                                    isConforme
                                      ? 'text-[#10b981]'
                                      : isSurplus
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                        : 'bg-red-500/15 text-red-400 border border-red-500/30'
                                  }`}>
                                    {item.delta > 0 ? `+${item.delta}` : item.delta}
                                  </span>
                                ) : (
                                  <span className="text-[#8a8075]">-</span>
                                )}
                              </td>
                              <td className="px-3.5 py-3 text-right">
                                {isPending ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        <Clock className="w-3 h-3 text-amber-400" />
                                        <span>{item.pendingController?.userName || 'En attente'}</span>
                                      </span>
                                      {item.unitId && item.pendingController?.userId && !isFinalized && (
                                        <button
                                          type="button"
                                          disabled={notifyingUnitId === item.unitId}
                                          onClick={() => handleNotifyUnit(item.unitId)}
                                          className="px-2 py-0.8 rounded bg-[#383330] hover:bg-[#3f3a36] text-[#10b981] border border-[#3f3a36] text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                                          title={`Envoyer une notification à ${item.pendingController.userName} (${item.pendingController.stepLabel})`}
                                        >
                                          {notifyingUnitId === item.unitId ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Send className="w-2.5 h-2.5" />
                                          )}
                                          <span>Notifier</span>
                                        </button>
                                      )}
                                    </div>
                                    {item.pendingController && (
                                      <span className="text-[9px] font-mono text-[#aea69c]">
                                        Ordre : {item.pendingController.stepLabel}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                                      isConforme
                                        ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                                        : isSurplus
                                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                        : isDeficit
                                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    }`}
                                  >
                                    {isConforme && <Check className="w-3 h-3" />}
                                    {isConforme ? 'Conforme' : isSurplus ? 'Surplus' : 'Déficit'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: AJUSTEMENTS DE STOCK */}
            {activeTab === 'adjustments' && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-[#f7f5f0]">Ajustements de Stock Retenus</h2>
                  <span className="text-xs font-mono text-[#aea69c]">{adjustments.length} écart(s) détecté(s)</span>
                </div>

                {adjustments.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26] text-center space-y-4">
                    {discrepancyUnits.length > 0 ? (
                      <>
                        <Info className="w-6 h-6 text-amber-400 mx-auto" />
                        <p className="text-xs text-[#aea69c]">
                          Les ajustements seront calculés dès que les <strong className="text-[#f7f5f0]">{discrepancyUnits.length} divergences</strong> ci-dessus auront été arbitrées par les 3èmes contrôleurs.
                        </p>
                      </>
                    ) : isReadyToFinalize ? (
                      <>
                        <CheckCircle2 className="w-8 h-8 text-[#10b981] mx-auto" />
                        <p className="text-sm text-[#f7f5f0] font-medium">
                          Tous les comptages correspondent exactement au stock actuel !
                        </p>
                        <p className="text-xs text-[#aea69c]">
                          Aucune modification de stock n'est requise. Vous pouvez finaliser cet inventaire en toute sécurité.
                        </p>
                      </>
                    ) : (
                      <div className="py-4 px-2 space-y-4 max-w-lg mx-auto">
                        <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-400">
                          <Clock className="w-5 h-5" />
                        </div>

                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-[#f7f5f0]">
                            Comptages physiques en cours sur le terrain
                          </h3>
                          <p className="text-xs text-[#aea69c] leading-relaxed">
                            Cette section attend la saisie des comptages par les contrôleurs assignés. Les résultats s'afficheront dès validation.
                          </p>
                        </div>

                        {/* Progress bar */}
                        <div className="bg-[#26221f] p-3 rounded-[3px] border border-[#3f3a36] text-left space-y-2">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-[#aea69c]">Progression des unités :</span>
                            <span className="text-[#f7f5f0] font-semibold">
                              {stats?.resolvedUnits ?? 0} / {stats?.totalUnits ?? 0} validées
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1f1b18] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-400 transition-all duration-300"
                              style={{
                                width: `${completionPercentage}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                          <Link
                            href="/inventory/tasks"
                            className="w-full sm:w-auto px-4 py-2 text-xs font-medium bg-[#383330] hover:bg-[#3f3a36] text-[#f7f5f0] border border-[#3f3a36] rounded-[3px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                            <span>Voir / Effectuer les comptages</span>
                          </Link>

                          <button
                            type="button"
                            disabled={isAutoCompleting}
                            onClick={async () => {
                              try {
                                await autoComplete(inventoryId);
                                toast.success('Comptages validés instantanément avec le stock théorique !');
                              } catch (e: any) {
                                toast.error(e?.response?.data?.message || 'Erreur lors de la validation rapide');
                              }
                            }}
                            className="w-full sm:w-auto px-4 py-2 text-xs font-medium bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-[3px] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isAutoCompleting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Validation en cours...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                <span>Valider instantanément (Stock théorique)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                    <table className="w-full text-left border-collapse bg-[#2f2a26]">
                      <thead>
                        <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                          <th className="px-4 py-3 font-medium">Article</th>
                          <th className="px-4 py-3 font-medium">Emplacement</th>
                          <th className="px-4 py-3 font-medium">Ancien Stock</th>
                          <th className="px-4 py-3 font-medium text-center">Comptage Final</th>
                          <th className="px-4 py-3 font-medium text-center">Écart</th>
                          <th className="px-4 py-3 font-medium">Impact Stock</th>
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
                                {adj.delta > 0 ? `+${adj.delta}` : adj.delta} pcs
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs italic text-[#c9c0ad]">
                              {adj.delta > 0 ? 'Entrée de régularisation (+)' : 'Sortie de régularisation (-)'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar: Clôture & Validation Strict Enforcement */}
          <div className="space-y-6">
            <div className={`p-5 border rounded-[4px] space-y-4 ${
              isFinalized 
                ? 'border-[#10b981]/30 bg-[#10b981]/5' 
                : isReadyToFinalize
                  ? 'border-[#10b981]/40 bg-[#10b981]/10'
                  : 'border-red-900/50 bg-red-950/20'
            }`}>
              <h3 className={`text-sm font-semibold flex items-center gap-2 ${
                isFinalized || isReadyToFinalize ? 'text-[#10b981]' : 'text-red-300'
              }`}>
                {isFinalized ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                ) : isReadyToFinalize ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                ) : (
                  <AlertOctagon className="w-4 h-4 text-red-400" />
                )}
                {isFinalized 
                  ? 'Inventaire Clôturé et Validé' 
                  : isReadyToFinalize
                    ? "Prêt pour la Clôture Finale"
                    : "Clôture Verrouillée"}
              </h3>

              {isFinalized ? (
                <div className="space-y-2 text-xs text-[#c9c0ad] leading-relaxed">
                  <p>
                    Cet inventaire a été officiellement clôturé. Toutes les quantités réelles en base de données ont été mises à jour.
                  </p>
                  {inventory?.finalizedAt && (
                    <p className="text-[11px] font-mono text-[#10b981]">
                      Validé le : {new Date(inventory.finalizedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-xs text-[#c9c0ad] leading-relaxed">
                    La clôture de cet inventaire appliquera de manière irréversible ces ajustements sur les quantités de stock réelles en base de données.
                  </p>

                  {/* Strict blocking warning if units remain uncounted */}
                  {!isReadyToFinalize && (
                    <div className="p-3 rounded bg-[#2b2622] border border-amber-900/60 text-xs text-amber-300 space-y-1.5">
                      <div className="flex items-start gap-2 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                        <span>Comptage incomplet ({stats?.pendingUnits ?? 0} unités restantes)</span>
                      </div>
                      <p className="text-[11px] text-amber-200/80 leading-relaxed pl-6">
                        L'administrateur ne peut pas clôturer cet inventaire tant que toutes les unités n'ont pas été complètement comptées et résolues.
                      </p>
                    </div>
                  )}

                  {isReadyToFinalize && (
                    <div className="p-3 rounded bg-[#10b981]/15 border border-[#10b981]/30 text-xs text-[#10b981] flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Toutes les {stats?.totalUnits ?? 0} unités ont été vérifiées et sont conformes !</span>
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
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-[3px] transition-colors ${
                      isReadyToFinalize && !isFinalizing
                        ? 'bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] shadow-sm cursor-pointer'
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
                        <span>Appliquer et Finaliser l'Inventaire</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            
            {/* Live Statistics Card */}
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-2.5">
              <h3 className="text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">Statistiques de Contrôle</h3>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Total articles / unités</span>
                <span className="font-semibold text-[#f7f5f0]">{stats?.totalUnits ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Unités validées / résolues</span>
                <span className="font-semibold text-[#10b981]">{stats?.resolvedUnits ?? 0}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#c9c0ad]">Articles conformes (sans écart)</span>
                <span className="font-semibold text-[#10b981]">{stats?.conformeUnits ?? 0}</span>
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
              <div className="flex justify-between items-center text-xs pt-2 border-t border-[#3f3a36]">
                <span className="text-[#c9c0ad]">Ajustements de stock nécessaires</span>
                <span className="font-semibold text-blue-400">{adjustments.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
