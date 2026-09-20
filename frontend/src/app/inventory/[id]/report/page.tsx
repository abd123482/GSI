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
  AlertTriangle,
  Scale,
  CheckCircle2,
  Package,
  Info,
  Clock,
  Users,
  Search,
  FileText,
  Layers,
  ShieldCheck,
  Check,
  TrendingUp,
  TrendingDown,
  HelpCircle,
  MapPin,
  Barcode,
  X,
  Trash2,
  Split,
  Eye,
} from 'lucide-react';
import {
  useInventoryReport,
  useInventoryProgress,
  useInventoryComparison,
  useInventoryIssues,
  useResolveIssue,
  useFinalizeInventory,
  useDeleteInventory,
} from '@/hooks/use-inventory';
import { useShelves } from '@/hooks/use-shelves';
import { usePermissions } from '@/hooks/use-permissions';
import { toast } from 'sonner';

export default function FinalReportPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const params = useParams();
  const inventoryId = params?.id as string;
  const router = useRouter();

  const { data: reportData, isLoading: isReportLoading } = useInventoryReport(inventoryId);
  const { data: progressData, isLoading: isProgressLoading } = useInventoryProgress(inventoryId);
  const { data: comparisonData, isLoading: isComparisonLoading, error: comparisonError } = useInventoryComparison(inventoryId);
  const { data: issuesData, isLoading: isIssuesLoading } = useInventoryIssues(inventoryId);
  const { mutateAsync: finalize, isPending: isFinalizing } = useFinalizeInventory();
  const { mutateAsync: resolveIssue, isPending: isResolving } = useResolveIssue();
  const { shelves } = useShelves({ limit: 100 });
  const { hasPermission, isAdmin } = usePermissions();

  const [activeTab, setActiveTab] = useState<'summary' | 'comparison' | 'baseline' | 'issues'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Issue Resolution Modal State
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [resolutionType, setResolutionType] = useState<'FOUND_IN_ANOTHER_LOCATION' | 'MOVED_WITHOUT_RECORDED_MOVEMENT' | 'LOST'>('FOUND_IN_ANOTHER_LOCATION');
  const [resolutionShelfId, setResolutionShelfId] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canDeleteInventory = hasPermission('inventory.delete');
  const { mutateAsync: deleteInventory, isPending: isDeleting } = useDeleteInventory();

  const inventory = reportData?.inventory || progressData;
  const summary = reportData?.summary;
  const physicalTruth = reportData?.physicalTruth;
  const baselineLaunch = reportData?.baselineLaunch;
  const issues = issuesData || reportData?.investigationIssues || [];

  const isFinalized = inventory?.status === 'FINALIZED';
  const isCompleted = inventory?.status === 'COMPLETED' || (inventory?.status === 'THIRD_COUNT_REQUIRED' && progressData?.controllers?.finalController?.isFinished);

  const handleOpenResolveModal = (issue: any) => {
    setSelectedIssue(issue);
    setResolutionType('FOUND_IN_ANOTHER_LOCATION');
    setResolutionShelfId('');
    setResolutionNotes('');
  };

  const handleCloseResolveModal = () => {
    setSelectedIssue(null);
    setResolutionNotes('');
    setResolutionShelfId('');
  };

  const handleSubmitResolution = async () => {
    if (!selectedIssue) return;
    if (resolutionType === 'FOUND_IN_ANOTHER_LOCATION' && !resolutionShelfId) {
      toast.error("Veuillez sélectionner l'emplacement où l'élément a été retrouvé.");
      return;
    }

    try {
      await resolveIssue({
        inventoryId,
        issueId: selectedIssue.issueId,
        data: {
          resolutionType,
          resolutionShelfId: resolutionType === 'FOUND_IN_ANOTHER_LOCATION' ? resolutionShelfId : undefined,
          notes: resolutionNotes.trim() || undefined,
        },
      });
      toast.success("Enquête résolue avec succès et ajustement audité appliqué.");
      handleCloseResolveModal();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Erreur lors de la résolution de l'enquête");
    }
  };

  if (!isLoaded || !isSignedIn || isReportLoading || isProgressLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2b2622]">
        <Loader2 className="w-5 h-5 animate-spin text-[#aea69c]" />
      </div>
    );
  }

  const controllers = progressData?.controllers;
  const c1 = controllers?.controller1;
  const c2 = controllers?.controller2;
  const c3 = controllers?.finalController;

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
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-normal tracking-tight text-[#f7f5f0]">
                  Rapport : <strong className="font-semibold">{inventory?.title || 'Sans titre'}</strong>
                </h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-[2px] border font-medium ${
                  isFinalized 
                    ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30' 
                    : inventory?.status === 'THIRD_COUNT_REQUIRED'
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-[#383330] text-[#c9c0ad] border-[#3f3a36]'
                }`}>
                  {isFinalized ? 'CLÔTURÉ ET VALIDÉ' : inventory?.status === 'THIRD_COUNT_REQUIRED' ? 'ARBITRAGE REQUIS (ÉCART)' : inventory?.status}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#1f1b18] text-[#aea69c] border border-[#3f3a36]">
                  {inventory?.typeInventory === 'ByShelf' ? 'Par Emplacement' : 'Par Article'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                  Architecture V2
                </span>
                {inventory?.finalResultSource && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-[2px] bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 font-semibold">
                    {inventory.finalResultSource === 'PRIMARY_DOUBLE_COUNT_MATCH'
                      ? 'Source : Double comptage conforme'
                      : 'Source : Arbitrage 3ème contrôleur'}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#c9c0ad] mt-1">
                Workflow à trois contrôleurs avec comptage en flux tendu, recomptage exhaustif et enquêtes de stock.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {(isAdmin || canDeleteInventory) && (
                <button
                  type="button"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-[3px] flex items-center gap-2 cursor-pointer transition-colors"
                  title="Supprimer définitivement cet inventaire"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              )}
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

        {/* Visual Pipeline : Les 3 Contrôleurs */}
        <section className="p-5 rounded-[4px] border border-[#3f3a36] bg-[#2a2522] space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
            <h2 className="text-xs font-semibold text-[#f7f5f0] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#10b981]" />
              Pipeline de Comptage (Architecture V2)
            </h2>
            <span className="text-[11px] font-mono text-[#aea69c]">
              Total : {progressData?.totalUnits || 0} unité(s) de travail
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Contrôleur 1 */}
            <div className={`p-3.5 rounded-[3px] border ${
              c1?.isFinished
                ? 'border-[#10b981]/40 bg-[#10b981]/5'
                : 'border-[#3f3a36] bg-[#26221f]'
            } space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#f7f5f0]">1er Contrôleur</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  c1?.isFinished
                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30'
                    : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                }`}>
                  {c1?.isFinished ? 'Terminé' : 'En cours'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#aea69c] truncate">
                {c1?.user?.userName || 'Utilisateur 1'}
              </p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] text-[#aea69c]">Unités validées :</span>
                <span className="text-xs font-mono font-bold text-[#f7f5f0]">
                  {c1?.completedUnits ?? 0} / {progressData?.totalUnits ?? 0}
                </span>
              </div>
              <div className="w-full h-1 bg-[#1f1b18] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#10b981] transition-all"
                  style={{ width: `${progressData?.totalUnits ? ((c1?.completedUnits || 0) / progressData.totalUnits) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Contrôleur 2 */}
            <div className={`p-3.5 rounded-[3px] border ${
              c2?.isFinished
                ? 'border-[#10b981]/40 bg-[#10b981]/5'
                : 'border-[#3f3a36] bg-[#26221f]'
            } space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#f7f5f0]">2ème Contrôleur (Flux tendu)</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  c2?.isFinished
                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30'
                    : 'bg-[#383330] text-[#aea69c] border-[#3f3a36]'
                }`}>
                  {c2?.isFinished ? 'Terminé' : 'En cours'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#aea69c] truncate">
                {c2?.user?.userName || 'Utilisateur 2'}
              </p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] text-[#aea69c]">Unités validées :</span>
                <span className="text-xs font-mono font-bold text-[#f7f5f0]">
                  {c2?.completedUnits ?? 0} / {progressData?.totalUnits ?? 0}
                </span>
              </div>
              <div className="w-full h-1 bg-[#1f1b18] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#10b981] transition-all"
                  style={{ width: `${progressData?.totalUnits ? ((c2?.completedUnits || 0) / progressData.totalUnits) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Contrôleur Final */}
            <div className={`p-3.5 rounded-[3px] border ${
              c3?.isActive
                ? c3?.isFinished
                  ? 'border-[#10b981]/40 bg-[#10b981]/5'
                  : 'border-red-500/40 bg-red-950/15'
                : 'border-[#3f3a36] bg-[#26221f] opacity-60'
            } space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#f7f5f0]">Contrôleur Final (Arbitrage)</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                  c3?.isActive
                    ? c3?.isFinished
                      ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30'
                      : 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-[#383330] text-[#8c827a] border-[#3f3a36]'
                }`}>
                  {c3?.isActive ? (c3?.isFinished ? 'Terminé (Fait foi)' : 'Recomptage actif (Écart)') : 'Non requis (Conforme)'}
                </span>
              </div>
              <p className="text-xs font-mono text-[#aea69c] truncate">
                {c3?.user?.userName || 'Utilisateur 3'}
              </p>
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] text-[#aea69c]">Recomptage exhaustif :</span>
                <span className="text-xs font-mono font-bold text-[#f7f5f0]">
                  {c3?.completedUnits ?? 0} / {progressData?.totalUnits ?? 0}
                </span>
              </div>
              <div className="w-full h-1 bg-[#1f1b18] rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${c3?.isFinished ? 'bg-[#10b981]' : 'bg-red-500'}`}
                  style={{ width: `${progressData?.totalUnits ? ((c3?.completedUnits || 0) / progressData.totalUnits) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Executive KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">Conformes</span>
            <span className="text-xl font-bold text-[#10b981] font-mono block">
              {summary?.compliantCount ?? 0}
            </span>
            <span className="text-[10px] text-[#10b981]/80">Articles 100% alignés</span>
          </div>

          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">Quantité manquante</span>
            <span className={`text-xl font-bold font-mono block ${
              (summary?.shortageCount ?? 0) > 0 ? 'text-red-400' : 'text-[#f7f5f0]'
            }`}>
              {summary?.shortageCount ?? 0}
            </span>
            <span className={`text-[10px] ${
              (summary?.shortageCount ?? 0) > 0 ? 'text-red-400/80 font-medium' : 'text-[#aea69c]'
            }`}>
              Déficits observés
            </span>
          </div>

          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">Quantité excédentaire</span>
            <span className={`text-xl font-bold font-mono block ${
              (summary?.excessCount ?? 0) > 0 ? 'text-red-400' : 'text-[#f7f5f0]'
            }`}>
              {summary?.excessCount ?? 0}
            </span>
            <span className={`text-[10px] ${
              (summary?.excessCount ?? 0) > 0 ? 'text-red-400/80 font-medium' : 'text-[#aea69c]'
            }`}>
              Surplus observés
            </span>
          </div>

          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">S/N déplacés</span>
            <span className={`text-xl font-bold font-mono block ${
              (summary?.relocatedSerialsCount ?? 0) > 0 ? 'text-red-400' : 'text-[#f7f5f0]'
            }`}>
              {summary?.relocatedSerialsCount ?? 0}
            </span>
            <span className={`text-[10px] ${
              (summary?.relocatedSerialsCount ?? 0) > 0 ? 'text-red-400/80 font-medium' : 'text-[#aea69c]'
            }`}>
              Autre emplacement
            </span>
          </div>

          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">S/N manquants</span>
            <span className={`text-xl font-bold font-mono block ${
              (summary?.missingSerialsCount ?? 0) > 0 ? 'text-red-400' : 'text-[#f7f5f0]'
            }`}>
              {summary?.missingSerialsCount ?? 0}
            </span>
            <span className={`text-[10px] ${
              (summary?.missingSerialsCount ?? 0) > 0 ? 'text-red-400/80 font-medium' : 'text-[#aea69c]'
            }`}>
              Non retrouvés
            </span>
          </div>

          <div className="p-3 rounded-[3px] bg-[#2f2a26] border border-[#3f3a36] space-y-1">
            <span className="text-[10px] font-mono uppercase text-[#aea69c] block">Enquêtes ouvertes</span>
            <span className={`text-xl font-bold font-mono block ${
              (summary?.unexplainedCount ?? 0) > 0 ? 'text-red-400' : 'text-[#f7f5f0]'
            }`}>
              {summary?.unexplainedCount ?? 0}
            </span>
            <span className={`text-[10px] ${
              (summary?.unexplainedCount ?? 0) > 0 ? 'text-red-400/80 font-medium' : 'text-[#aea69c]'
            }`}>
              À investiguer
            </span>
          </div>
        </div>

        {/* Layout: Main Tabs & Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {/* Tabs Header */}
            <div className="flex items-center gap-1 border-b border-[#3f3a36] pb-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                  activeTab === 'summary'
                    ? 'border-[#10b981] text-[#f7f5f0] bg-[#383330]'
                    : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                }`}
              >
                <FileText className={`w-3.5 h-3.5 ${activeTab === 'summary' ? 'text-[#10b981]' : 'text-[#aea69c]'}`} />
                <span>Vérité Physique Finale</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('comparison')}
                className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                  activeTab === 'comparison'
                    ? 'border-[#10b981] text-[#f7f5f0] bg-[#383330]'
                    : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                }`}
              >
                <Split className={`w-3.5 h-3.5 ${activeTab === 'comparison' ? 'text-[#10b981]' : 'text-[#aea69c]'}`} />
                <span>Comparaison C1 / C2 / Arbitrage</span>
                {inventory?.thirdCountRequired ? (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-red-500/15 text-red-400 border border-red-500/30">
                    Écart
                  </span>
                ) : (
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                    Conforme
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('baseline')}
                className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                  activeTab === 'baseline'
                    ? 'border-[#10b981] text-[#f7f5f0] bg-[#383330]'
                    : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                }`}
              >
                <Scale className={`w-3.5 h-3.5 ${activeTab === 'baseline' ? 'text-[#10b981]' : 'text-[#aea69c]'}`} />
                <span>Écart vs Baseline</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('issues')}
                className={`px-3 py-2 text-xs font-medium rounded-t-[3px] transition-colors cursor-pointer flex items-center gap-2 border-b-2 ${
                  activeTab === 'issues'
                    ? 'border-[#10b981] text-[#f7f5f0] bg-[#383330]'
                    : 'border-transparent text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#322d29]'
                }`}
              >
                <HelpCircle className={`w-3.5 h-3.5 ${activeTab === 'issues' ? 'text-[#10b981]' : 'text-[#aea69c]'}`} />
                <span>Enquêtes de Stock</span>
                {issues.length > 0 && (
                  <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold ${
                    issues.some((i: any) => i.status !== 'RESOLVED')
                      ? 'bg-red-500/15 text-red-400 border-red-500/30'
                      : 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30'
                  }`}>
                    {issues.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Vérité Physique Finale */}
            {activeTab === 'summary' && (
              <section className="space-y-4">
                <div className="p-3 bg-[#26221f] rounded-[3px] border border-[#3f3a36] flex items-center justify-between text-xs">
                  <span className="text-[#aea69c]">
                    Résultat physique retenu : <strong className="text-[#f7f5f0]">{inventory?.finalResultSource || 'En attente de clôture'}</strong>
                  </span>
                  <span className="text-[11px] font-mono text-[#10b981]">
                    {physicalTruth?.quantities?.length || 0} lignes de stock figées
                  </span>
                </div>

                <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                  <table className="w-full text-left border-collapse bg-[#2f2a26]">
                    <thead>
                      <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                        <th className="px-3.5 py-3 font-medium">Article ID</th>
                        <th className="px-3.5 py-3 font-medium">Emplacement ID</th>
                        <th className="px-3 py-3 font-medium text-center">Quantité Physique Retenue</th>
                        <th className="px-3.5 py-3 font-medium text-right">Phase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3f3a36] text-xs font-mono">
                      {(physicalTruth?.quantities || []).map((q: any, idx: number) => (
                        <tr key={idx} className="hover:bg-[#383330] transition-colors">
                          <td className="px-3.5 py-3 text-[#f7f5f0] font-sans">
                            {q.equipmentId}
                          </td>
                          <td className="px-3.5 py-3 text-[#c9c0ad]">
                            {q.shelfId}
                          </td>
                          <td className="px-3 py-3 text-center font-bold text-[#10b981]">
                            {q.quantity} pcs
                          </td>
                          <td className="px-3.5 py-3 text-right text-[10px] text-[#aea69c]">
                            {q.phase}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Serials Table */}
                {physicalTruth?.serials && physicalTruth.serials.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-xs font-medium text-[#aea69c] uppercase font-mono">
                      Numéros de série physiques recensés ({physicalTruth.serials.length}) :
                    </h3>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded bg-[#26221f] border border-[#3f3a36] max-h-48 overflow-y-auto">
                      {physicalTruth.serials.map((sn: any) => (
                        <span
                          key={sn.snapshotId || sn.serialNumberCode}
                          className="px-2 py-1 rounded bg-[#383330] text-[11px] font-mono border border-[#4d4641] text-[#f7f5f0] flex items-center gap-1.5"
                        >
                          <Barcode className="w-3 h-3 text-[#10b981]" />
                          <span>{sn.serialNumberCode}</span>
                          <span className="text-[9px] text-[#aea69c]">({sn.shelfId?.slice(0, 8)})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* TAB: Comparaison C1 / C2 / Arbitrage */}
            {activeTab === 'comparison' && (
              <section className="space-y-6">
                <div className="p-3.5 bg-[#26221f] rounded-[3px] border border-[#3f3a36] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-[#aea69c]">Statut de concordance : </span>
                    {inventory?.thirdCountRequired ? (
                      <strong className="text-red-400 font-semibold">
                        Écart détecté entre 1er et 2ème Contrôleur (Arbitrage requis)
                      </strong>
                    ) : (
                      <strong className="text-[#10b981] font-semibold">
                        Parfaite concordance C1 et C2 (100% Validé)
                      </strong>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-[#aea69c]">
                    Source retenue : <span className="text-[#f7f5f0]">{inventory?.finalResultSource || 'En attente'}</span>
                  </div>
                </div>

                {isComparisonLoading ? (
                  <div className="p-8 text-center bg-[#2f2a26] border border-[#3f3a36] rounded-[4px]">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#aea69c]" />
                    <p className="text-xs text-[#aea69c] mt-2">Chargement des enregistrements détaillés...</p>
                  </div>
                ) : comparisonError ? (
                  <div className="p-8 border border-red-500/30 rounded-[4px] bg-red-950/20 text-center space-y-2">
                    <AlertTriangle className="w-6 h-6 text-red-400 mx-auto" />
                    <p className="text-xs text-red-300">
                      Erreur lors du chargement de la comparaison : {((comparisonError as any)?.response?.data?.message || (comparisonError as any)?.message || 'Erreur de connexion')}
                    </p>
                  </div>
                ) : !comparisonData?.units || comparisonData.units.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26] text-center space-y-2">
                    <Info className="w-6 h-6 text-[#aea69c] mx-auto" />
                    <p className="text-xs text-[#aea69c]">Aucune unité de travail enregistrée pour cette comparaison.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {comparisonData.units.map((unit: any, uIdx: number) => {
                      // Build consolidated items from c1Orders, c2Orders, c3Orders
                      const c1Orders = unit.c1Orders || [];
                      const c2Orders = unit.c2Orders || [];
                      const c3Orders = unit.c3Orders || [];

                      // Aggregate per equipment:
                      // Map equipmentId -> { equipmentName, hasSerialNumber, c1Qty, c2Qty, c3Qty, c1Sns: [], c2Sns: [], c3Sns: [] }
                      const eqMap = new Map<string, any>();

                      const processOrders = (orders: any[], role: 'c1' | 'c2' | 'c3') => {
                        for (const o of orders) {
                          const eqId = o.equipmentId || o.equipment?.equipmentId || 'UNKNOWN';
                          const eqName = o.equipment?.equipmentName || (unit.equipment?.equipmentId === eqId ? unit.equipment?.equipmentName : eqId);
                          const hasSn = o.equipment?.hasSerialNumber ?? (!!o.scannedSerialCode || !!o.serialNumber);

                          if (!eqMap.has(eqId)) {
                            eqMap.set(eqId, {
                              equipmentId: eqId,
                              equipmentName: eqName,
                              hasSerialNumber: hasSn,
                              c1Qty: 0,
                              c2Qty: 0,
                              c3Qty: 0,
                              c1Sns: [] as string[],
                              c2Sns: [] as string[],
                              c3Sns: [] as string[],
                            });
                          }

                          const entry = eqMap.get(eqId);
                          const snCode = o.scannedSerialCode || o.serialNumber?.serialNumberCode;

                          if (role === 'c1') {
                            if (snCode) {
                              if (!entry.c1Sns.includes(snCode)) entry.c1Sns.push(snCode);
                            } else {
                              entry.c1Qty += Number(o.countedQuantity ?? o.quantityCalculated ?? 0);
                            }
                          } else if (role === 'c2') {
                            if (snCode) {
                              if (!entry.c2Sns.includes(snCode)) entry.c2Sns.push(snCode);
                            } else {
                              entry.c2Qty += Number(o.countedQuantity ?? o.quantityCalculated ?? 0);
                            }
                          } else if (role === 'c3') {
                            if (snCode) {
                              if (!entry.c3Sns.includes(snCode)) entry.c3Sns.push(snCode);
                            } else {
                              entry.c3Qty += Number(o.countedQuantity ?? o.quantityCalculated ?? 0);
                            }
                          }
                        }
                      };

                      processOrders(c1Orders, 'c1');
                      processOrders(c2Orders, 'c2');
                      processOrders(c3Orders, 'c3');

                      const items = Array.from(eqMap.values());
                      const shelfFromHook = shelves?.find((s: any) => s.shelfId === unit.shelfId);
                      const unitTitle = unit.shelf?.shelfName || shelfFromHook?.shelfName || unit.equipment?.equipmentName || `Unité #${uIdx + 1}`;

                      return (
                        <div key={unit.unitId} className="rounded-[4px] border border-[#3f3a36] bg-[#2a2522] overflow-hidden space-y-3 p-4">
                          <div className="flex items-center justify-between pb-2 border-b border-[#383330]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#f7f5f0]">
                                {unitTitle}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1f1b18] text-[#aea69c] border border-[#3f3a36]">
                                Ordre #{unit.unitOrder + 1}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-[#aea69c]">
                              {items.length} article(s) contrôlé(s)
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-[3px] border border-[#383330]">
                            <table className="w-full text-left border-collapse bg-[#26221f]">
                              <thead>
                                <tr className="border-b border-[#383330] bg-[#1f1b18] text-[10px] font-mono text-[#aea69c] uppercase">
                                  <th className="px-3 py-2.5">Article</th>
                                  <th className="px-3 py-2.5 text-center">1er Contrôleur (C1)</th>
                                  <th className="px-3 py-2.5 text-center">2ème Contrôleur (C2)</th>
                                  <th className="px-3 py-2.5 text-center">Écart C1 vs C2</th>
                                  <th className="px-3 py-2.5 text-center bg-[#1f1b18] text-[#f7f5f0]">
                                    Arbitre Final (C3)
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#383330] text-xs font-mono">
                                {items.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-xs text-[#aea69c]">
                                      Aucun article enregistré pour cette unité de travail.
                                    </td>
                                  </tr>
                                ) : (
                                  items.map((it: any) => {
                                  const c1Val = it.hasSerialNumber ? it.c1Sns.length : it.c1Qty;
                                  const c2Val = it.hasSerialNumber ? it.c2Sns.length : it.c2Qty;
                                  const c3Val = it.hasSerialNumber ? it.c3Sns.length : it.c3Qty;
                                  
                                  // Discrepancy check:
                                  let hasDiff = false;
                                  if (!it.hasSerialNumber) {
                                    hasDiff = c1Val !== c2Val;
                                  } else {
                                    const c1Set = new Set(it.c1Sns.map((s: string) => s.toLowerCase()));
                                    const c2Set = new Set(it.c2Sns.map((s: string) => s.toLowerCase()));
                                    if (c1Set.size !== c2Set.size) {
                                      hasDiff = true;
                                    } else {
                                      for (const s of c1Set) {
                                        if (!c2Set.has(s)) {
                                          hasDiff = true;
                                          break;
                                        }
                                      }
                                    }
                                  }

                                  const delta = c1Val - c2Val;

                                  return (
                                    <tr key={it.equipmentId} className="hover:bg-[#2f2a26] transition-colors">
                                      <td className="px-3 py-3 font-sans">
                                        <div className="font-medium text-[#f7f5f0]">{it.equipmentName}</div>
                                        <div className="text-[10px] text-[#aea69c] font-mono flex items-center gap-1.5 mt-0.5">
                                          {it.hasSerialNumber ? (
                                            <span className="text-[#c9c0ad]">● Sérialisé</span>
                                          ) : (
                                            <span className="text-[#10b981]">● Quantitatif</span>
                                          )}
                                          <span>ID: {it.equipmentId.slice(0, 8)}...</span>
                                        </div>

                                        {/* Details of Serial Numbers if Serialized */}
                                        {it.hasSerialNumber && (it.c1Sns.length > 0 || it.c2Sns.length > 0 || it.c3Sns.length > 0) && (
                                          <div className="mt-2 text-[10px] space-y-1">
                                            {it.c1Sns.length > 0 && (
                                              <div className="flex items-center gap-1 flex-wrap">
                                                <span className="text-[#aea69c]">S/N C1:</span>
                                                {it.c1Sns.map((sn: string) => (
                                                  <span key={`c1-${sn}`} className="px-1 py-0.2 bg-[#383330] rounded border border-[#4d4641] text-[#f7f5f0]">
                                                    {sn}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            {it.c2Sns.length > 0 && (
                                              <div className="flex items-center gap-1 flex-wrap">
                                                <span className="text-[#aea69c]">S/N C2:</span>
                                                {it.c2Sns.map((sn: string) => {
                                                  const inC1 = it.c1Sns.some((s: string) => s.toLowerCase() === sn.toLowerCase());
                                                  return (
                                                    <span
                                                      key={`c2-${sn}`}
                                                      className={`px-1 py-0.2 rounded border ${
                                                        inC1
                                                          ? 'bg-[#383330] border-[#4d4641] text-[#f7f5f0]'
                                                          : 'bg-red-500/20 border-red-500/40 text-red-400 font-bold'
                                                      }`}
                                                    >
                                                      {sn}
                                                    </span>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            {c3Orders.length > 0 && it.c3Sns.length > 0 && (
                                              <div className="flex items-center gap-1 flex-wrap">
                                                <span className="text-[#10b981]">S/N C3:</span>
                                                {it.c3Sns.map((sn: string) => (
                                                  <span key={`c3-${sn}`} className="px-1 py-0.2 bg-[#10b981]/15 rounded border border-[#10b981]/30 text-[#10b981]">
                                                    {sn}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </td>

                                      {/* C1 Count */}
                                      <td className="px-3 py-3 text-center">
                                        <span className="text-sm font-bold text-[#f7f5f0]">
                                          {c1Val}
                                        </span>
                                        <span className="text-[10px] text-[#aea69c] block font-sans">
                                          {it.hasSerialNumber ? 'S/N' : 'pcs'}
                                        </span>
                                      </td>

                                      {/* C2 Count */}
                                      <td className="px-3 py-3 text-center">
                                        <span className="text-sm font-bold text-[#f7f5f0]">
                                          {c2Val}
                                        </span>
                                        <span className="text-[10px] text-[#aea69c] block font-sans">
                                          {it.hasSerialNumber ? 'S/N' : 'pcs'}
                                        </span>
                                      </td>

                                      {/* Écart C1 vs C2 */}
                                      <td className="px-3 py-3 text-center">
                                        {hasDiff ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-red-500/15 text-red-400 border border-red-500/30 text-xs font-bold">
                                            <AlertTriangle className="w-3 h-3 text-red-400" />
                                            {delta !== 0 ? (delta > 0 ? `+${delta}` : delta) : 'Différence S/N'}
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[2px] bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30 text-xs font-bold">
                                            <Check className="w-3 h-3" />
                                            Identique
                                          </span>
                                        )}
                                      </td>

                                      {/* C3 Arbitrage */}
                                      <td className="px-3 py-3 text-center bg-[#1f1b18]">
                                        {c3Orders.length > 0 ? (
                                          <div>
                                            <span className="text-sm font-bold text-[#10b981]">
                                              {c3Val}
                                            </span>
                                            <span className="text-[10px] text-[#aea69c] block font-sans">
                                              {it.hasSerialNumber ? 'S/N retenus' : 'pcs retenues'}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-[#8c827a] italic">
                                            Non requis
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
            {activeTab === 'baseline' && (
              <section className="space-y-4">
                <div className="p-3 bg-[#26221f] rounded-[3px] border border-[#3f3a36] text-xs text-[#aea69c]">
                  Comparaison du stock physique finalisé avec l'instantané capturé au lancement de l'inventaire.
                </div>

                <div className="overflow-x-auto rounded-[4px] border border-[#3f3a36]">
                  <table className="w-full text-left border-collapse bg-[#2f2a26]">
                    <thead>
                      <tr className="border-b border-[#3f3a36] bg-[#2b2622] text-[10px] font-mono text-[#aea69c] uppercase tracking-wider">
                        <th className="px-3.5 py-3 font-medium">Article ID</th>
                        <th className="px-3.5 py-3 font-medium">Emplacement</th>
                        <th className="px-3 py-3 font-medium text-center">Quantité Initiale</th>
                        <th className="px-3 py-3 font-medium text-center">Quantité Finale</th>
                        <th className="px-3 py-3 font-medium text-center">Écart</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3f3a36] text-xs font-mono">
                      {(baselineLaunch?.quantities || []).map((b: any, idx: number) => {
                        const matchFinal = (physicalTruth?.quantities || []).find(
                          (f: any) => f.equipmentId === b.equipmentId && f.shelfId === b.shelfId
                        );
                        const finalQty = matchFinal ? matchFinal.quantity : 0;
                        const delta = finalQty - b.quantity;

                        return (
                          <tr key={idx} className="hover:bg-[#383330] transition-colors">
                            <td className="px-3.5 py-3 text-[#f7f5f0]">{b.equipmentId}</td>
                            <td className="px-3.5 py-3 text-[#c9c0ad]">{b.shelfId}</td>
                            <td className="px-3 py-3 text-center text-[#aea69c]">{b.quantity} pcs</td>
                            <td className="px-3 py-3 text-center font-bold text-[#f7f5f0]">{finalQty} pcs</td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-[2px] font-bold text-xs ${
                                delta === 0
                                  ? 'text-[#10b981]'
                                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
                              }`}>
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* TAB 3: Enquêtes de Stock Manquant */}
            {activeTab === 'issues' && (
              <section className="space-y-4">
                <div className="p-3 bg-[#26221f] rounded-[3px] border border-[#3f3a36] text-xs text-[#c9c0ad] leading-relaxed">
                  Règle V2 : Les écarts inexpliqués génèrent une enquête obligatoire. Un article manquant n'est jamais automatiquement déclaré perdu sans investigation. L'administrateur peut le déclarer retrouvé dans un autre emplacement, déplacé sans bon de mouvement, ou confirmer la perte.
                </div>

                {issues.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#3f3a36] rounded-[4px] bg-[#2f2a26] text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[#10b981] mx-auto" />
                    <p className="text-sm text-[#f7f5f0] font-medium">Aucun dossier d'enquête en cours</p>
                    <p className="text-xs text-[#aea69c]">Tous les éléments inventoriés sont justifiés ou conformes.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {issues.map((issue: any) => {
                      const isResolved = issue.status === 'RESOLVED';
                      return (
                        <div
                          key={issue.issueId}
                          className={`p-4 rounded-[4px] border ${
                            isResolved
                              ? 'border-[#3f3a36] bg-[#2a2522]'
                              : 'border-red-500/30 bg-red-950/10 hover:border-red-500/50'
                          } space-y-3 transition-colors`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
                                  {issue.issueType === 'MISSING_SERIAL' ? 'Numéro de Série Manquant' : 'Quantité Manquante'}
                                </span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-medium ${
                                  isResolved
                                    ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40'
                                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}>
                                  {isResolved ? 'RÉSOLU' : 'ENQUÊTE OUVERTE'}
                                </span>
                              </div>
                              <h4 className="text-sm font-semibold text-[#f7f5f0] mt-1">
                                {issue.equipment?.equipmentName || issue.equipmentId}
                                {issue.serialNumber?.serialNumberCode && (
                                  <span className="font-mono text-[#10b981] ml-2">
                                    [S/N: {issue.serialNumber.serialNumberCode}]
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-[#aea69c] mt-0.5">
                                Emplacement attendu : <strong>{issue.expectedShelf?.shelfName || issue.expectedShelfId || 'Non défini'}</strong> • Écart : <strong className="text-red-400">{issue.delta} pcs</strong>
                              </p>
                            </div>

                            {!isResolved && hasPermission('inventory.finalize') && (
                              <button
                                type="button"
                                onClick={() => handleOpenResolveModal(issue)}
                                className="px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer shrink-0"
                              >
                                Résoudre l'enquête
                              </button>
                            )}
                          </div>

                          {isResolved && (
                            <div className="p-2.5 rounded bg-[#1f1b18] border border-[#3f3a36] text-xs font-mono space-y-1 text-[#aea69c]">
                              <div className="flex items-center gap-2">
                                <span className="text-[#10b981] font-semibold">Résolution : {issue.resolutionType}</span>
                                {issue.resolutionShelf?.shelfName && (
                                  <span>→ Emplacement : <strong className="text-[#f7f5f0]">{issue.resolutionShelf.shelfName}</strong></span>
                                )}
                              </div>
                              {issue.resolutionNotes && (
                                <p className="text-[11px] text-[#c9c0ad] italic">Notes : "{issue.resolutionNotes}"</p>
                              )}
                              <p className="text-[10px] text-[#6e645c]">
                                Résolu par {issue.resolvedByUser?.userName || 'Admin'} le {issue.resolvedAt ? new Date(issue.resolvedAt).toLocaleString() : ''}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Sidebar: Clôture & Actions */}
          <div className="space-y-4">
            <div className={`p-5 border rounded-[4px] space-y-3 ${
              isFinalized 
                ? 'border-[#10b981]/30 bg-[#10b981]/5' 
                : isCompleted
                ? 'border-[#10b981]/40 bg-[#10b981]/10'
                : 'border-[#3f3a36] bg-[#2f2a26]'
            }`}>
              <h3 className="text-sm font-semibold flex items-center gap-2 text-[#f7f5f0]">
                {isFinalized ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                ) : (
                  <Clock className="w-4 h-4 text-[#aea69c]" />
                )}
                {isFinalized ? 'Inventaire Clôturé' : isCompleted ? 'Prêt pour Clôture' : 'Comptages en cours'}
              </h3>

              <p className="text-xs text-[#c9c0ad] leading-relaxed">
                {isFinalized
                  ? 'Toutes les écritures réelles et les instantanés de clôture ont été figés en base de données de manière irréversible.'
                  : isCompleted
                  ? 'Tous les comptages requis ont été effectués. Vous pouvez maintenant finaliser l\'inventaire et générer les enquêtes.'
                  : 'Le pipeline de comptage est en cours. Les contrôleurs doivent terminer leurs unités de travail avant finalisation.'}
              </p>

              {!isFinalized && isCompleted && (
                <button
                  type="button"
                  disabled={isFinalizing}
                  onClick={async () => {
                    try {
                      await finalize(inventoryId);
                      toast.success("Inventaire clôturé et snapshot finalisé !");
                      router.refresh();
                    } catch (e: any) {
                      toast.error(e?.response?.data?.message || "Erreur lors de la clôture");
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] text-xs font-semibold rounded-[3px] transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isFinalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />}
                  <span>Clôturer et figer l'inventaire</span>
                </button>
              )}
            </div>

            {/* Quick Audit Info Box */}
            <div className="p-4 border border-[#3f3a36] bg-[#2f2a26] rounded-[4px] space-y-2 text-xs">
              <h3 className="text-[10px] font-mono text-[#aea69c] uppercase">Traçabilité & Horodatage</h3>
              <div className="flex justify-between py-1 border-b border-[#383330]/50 font-mono">
                <span className="text-[#aea69c]">ID Inventaire</span>
                <span className="text-[#f7f5f0]">{inventoryId.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#383330]/50 font-mono">
                <span className="text-[#aea69c]">Lancé le</span>
                <span className="text-[#f7f5f0]">
                  {inventory?.launchedAt ? new Date(inventory.launchedAt).toLocaleDateString() : 'Non lancé'}
                </span>
              </div>
              <div className="flex justify-between py-1 font-mono">
                <span className="text-[#aea69c]">Finalisé le</span>
                <span className="text-[#10b981]">
                  {inventory?.finalizedAt ? new Date(inventory.finalizedAt).toLocaleDateString() : 'En cours'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal: Résolution d'enquête de stock */}
        {selectedIssue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-[#2f2a26] border border-[#3f3a36] rounded-[4px] max-w-md w-full p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#3f3a36]">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#10b981]" />
                  <h3 className="text-sm font-semibold text-[#f7f5f0]">
                    Résoudre l'Enquête de Stock
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleCloseResolveModal}
                  className="p-1 rounded text-[#aea69c] hover:text-[#f7f5f0] hover:bg-[#383330] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#1f1b18] rounded border border-[#3f3a36] space-y-1">
                  <p className="font-semibold text-[#f7f5f0]">
                    {selectedIssue.equipment?.equipmentName || selectedIssue.equipmentId}
                  </p>
                  {selectedIssue.serialNumber?.serialNumberCode && (
                    <p className="font-mono text-[#10b981]">S/N : {selectedIssue.serialNumber.serialNumberCode}</p>
                  )}
                  <p className="text-[#aea69c]">Écart constaté : {selectedIssue.delta} unité(s)</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#aea69c]">Issue de l'enquête :</label>
                  <select
                    value={resolutionType}
                    onChange={(e: any) => setResolutionType(e.target.value)}
                    className="w-full h-9 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] px-3 text-xs text-[#f7f5f0] focus:outline-none focus:border-[#10b981]"
                  >
                    <option value="FOUND_IN_ANOTHER_LOCATION">Trouvé dans un autre emplacement</option>
                    <option value="MOVED_WITHOUT_RECORDED_MOVEMENT">Déplacé sans mouvement enregistré</option>
                    <option value="LOST">Confirmé perdu (Régularisation de stock)</option>
                  </select>
                </div>

                {resolutionType === 'FOUND_IN_ANOTHER_LOCATION' && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[#aea69c]">Emplacement réel où l'article a été retrouvé :</label>
                    <select
                      value={resolutionShelfId}
                      onChange={(e) => setResolutionShelfId(e.target.value)}
                      className="w-full h-9 bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] px-3 text-xs text-[#f7f5f0] focus:outline-none focus:border-[#10b981]"
                    >
                      <option value="">-- Sélectionner l'emplacement --</option>
                      {shelves.map((sh) => (
                        <option key={sh.shelfId} value={sh.shelfId}>
                          {sh.shelfName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#aea69c]">Notes d'explication et justification :</label>
                  <textarea
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Ex: Retrouvé derrière l'armoire B, bon de transfert non saisi le 14/02..."
                    className="w-full bg-[#1f1b18] border border-[#3f3a36] rounded-[3px] p-2.5 text-xs text-[#f7f5f0] placeholder:text-[#6e645c] focus:outline-none focus:border-[#10b981] font-mono resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#3f3a36]">
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={handleCloseResolveModal}
                  className="px-3 py-1.5 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] text-xs text-[#aea69c] hover:text-[#f7f5f0] cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isResolving}
                  onClick={handleSubmitResolution}
                  className="px-4 py-1.5 bg-[#10b981] hover:bg-[#059669] text-[#1f1b18] text-xs font-semibold rounded-[3px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isResolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Enregistrer la résolution</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[#383330] border border-[#3f3a36] rounded-[4px] p-6 shadow-2xl space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[3px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-sm font-medium text-[#f7f5f0]">
                    Supprimer cet inventaire ?
                  </h2>
                  <p className="text-xs text-[#c9c0ad] leading-relaxed">
                    Êtes-vous sûr de vouloir supprimer définitivement{' '}
                    <strong className="text-[#f7f5f0]">"{inventory?.title || 'Sans titre'}"</strong> ? 
                    Cette action supprimera tous les comptages, tâches, réconciliations et instantanés associés.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#3f3a36]">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="px-3 py-1.5 rounded-[3px] border border-[#3f3a36] bg-[#2b2622] hover:bg-[#3f3a36] text-[#f7f5f0] text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={async () => {
                    try {
                      await deleteInventory(inventoryId);
                      toast.success('Inventaire supprimé avec succès');
                      router.push('/inventory');
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

      </div>
    </main>
  );
}
