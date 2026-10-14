'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  GitBranch,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';

import {
  useCancelInventory,
  useDeleteInventory,
  useFinalizeInventory,
  useInventoryProgress,
  useInventoryReport,
  useInventoryRounds,
  useLaunchInventory,
} from '@/hooks/use-inventory';

import { usePermissions } from '@/hooks/use-permissions';

import type {
  InventoryComparisonStatus,
  InventoryReportCell,
} from '@/types/inventory';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('fr-DZ', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'CONVERGED':
      return 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300';
    case 'RECOUNT_REQUIRED':
      return 'border-orange-500/40 bg-orange-950/30 text-orange-300';
    case 'IN_PROGRESS':
      return 'border-sky-500/40 bg-sky-950/30 text-sky-300';
    case 'DRAFT':
      return 'border-slate-500/40 bg-slate-950/30 text-slate-300';
    case 'FINALIZED':
      return 'border-emerald-400 bg-emerald-500 text-[#18181b] font-bold';
    case 'CANCELLED':
      return 'border-rose-500/40 bg-rose-950/30 text-rose-300';
    default:
      return 'border-slate-500/40 bg-slate-950/30 text-slate-300';
  }
}

function reconcileClass(value: string) {
  if (value === 'CONVERGED' || value === 'PRIMARY_MATCH' || value === 'THIRD_RESOLVED') {
    return 'border-emerald-400/25 bg-emerald-950/20 text-emerald-200';
  }
  if (value === 'RECOUNT_REQUIRED' || value === 'THIRD_REQUIRED') {
    return 'border-amber-400/25 bg-amber-950/20 text-amber-200';
  }
  return 'border-slate-400/25 bg-slate-950/20 text-slate-300';
}

function comparisonClass(status: InventoryComparisonStatus) {
  switch (status) {
    case 'CONFORME':
      return 'border-emerald-400/25 bg-emerald-950/20 text-emerald-200';
    case 'MANQUE':
      return 'border-rose-400/25 bg-rose-950/20 text-rose-200';
    case 'SURPLUS':
      return 'border-amber-400/25 bg-amber-950/20 text-amber-200';
    case 'MAUVAISE_POSITION':
    case 'MAUVAIS_ARTICLE':
      return 'border-violet-400/25 bg-violet-950/20 text-violet-200';
    case 'PENDING':
      return 'border-slate-400/25 bg-slate-950/20 text-slate-300';
    default:
      return 'border-sky-400/25 bg-sky-950/20 text-sky-200';
  }
}

function resultText(cell: InventoryReportCell | null, kind: string) {
  if (!cell) return '—';
  if (kind === 'SERIALIZED') {
    return cell.serialNumberCode ?? 'Série observée';
  }
  return `${cell.quantity}`;
}

export default function InventoryReportPage() {
  const params = useParams();
  const inventoryId = params?.id as string;
  const router = useRouter();

  const permissions = usePermissions();
  const progress = useInventoryProgress(inventoryId);
  const report = useInventoryReport(inventoryId);
  const rounds = useInventoryRounds(inventoryId);

  const launch = useLaunchInventory();
  const finalize = useFinalizeInventory();
  const deleteMutation = useDeleteInventory();
  const cancelMutation = useCancelInventory();

  if (progress.isLoading || report.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#18181b] text-white">
        <div className="flex items-center gap-2 text-xs text-[#a1a1aa]">
          <Loader2 className="h-4 w-4 animate-spin text-[#d8a868]" />
          Chargement du rapport...
        </div>
      </main>
    );
  }

  if (progress.isError || report.isError || !progress.data || !report.data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#18181b] p-6 text-white space-y-4">
        <div className="rounded border border-rose-500/25 bg-rose-950/15 p-6 text-sm text-rose-200">
          Impossible de charger cet inventaire.
        </div>
        <Link href="/inventory" className="text-xs text-[#a1a1aa] underline hover:text-white">
          Retour aux inventaires
        </Link>
      </main>
    );
  }

  const p = progress.data;
  const r = report.data;

  const currentRoundNumber = p.roundNumber ?? 1;
  const canFinalize =
    (p.status === 'CONVERGED' || p.status === 'COMPLETED') &&
    permissions.canFinalizeInventory;
  const canLaunch = p.status === 'DRAFT' && permissions.canLaunchInventory;
  const isFinalized = p.status === 'FINALIZED';

  // Dynamic controllers list
  const controllersList =
    p.controllersList && p.controllersList.length > 0
      ? p.controllersList
      : [
          p.controllers.controller1
            ? {
                controllerId: '1',
                userId: p.controllers.controller1.user?.userId ?? '',
                sequence: 0,
                round: 1,
                user: p.controllers.controller1.user,
                responsibility: 'CONTROLLER_1',
                completedUnits: p.controllers.controller1.completedUnits,
                totalUnits: p.totalUnits,
                isFinished: p.controllers.controller1.isFinished,
              }
            : null,
          p.controllers.controller2
            ? {
                controllerId: '2',
                userId: p.controllers.controller2.user?.userId ?? '',
                sequence: 1,
                round: 2,
                user: p.controllers.controller2.user,
                responsibility: 'CONTROLLER_2',
                completedUnits: p.controllers.controller2.completedUnits,
                totalUnits: p.totalUnits,
                isFinished: p.controllers.controller2.isFinished,
              }
            : null,
          p.controllers.controller3
            ? {
                controllerId: '3',
                userId: p.controllers.controller3.user?.userId ?? '',
                sequence: 2,
                round: 3,
                user: p.controllers.controller3.user,
                responsibility: 'CONTROLLER_3',
                completedUnits: p.controllers.controller3.completedUnits,
                totalUnits: p.totalUnits,
                isFinished: p.controllers.controller3.isFinished,
              }
            : null,
        ].filter(Boolean);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-white">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        {/* Navigation / En-tête */}
        <header className="flex flex-col gap-4 border-b border-[#3f3f46] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/inventory"
              className="rounded border border-[#3f3f46] p-2 text-[#a1a1aa] hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {r.inventory.title}
                </h1>

                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(p.status)}`}>
                  {p.status}
                </span>

                <span className="rounded border border-[#3f3f46] bg-[#27272a] px-2 py-0.5 text-[10px] font-mono text-[#a1a1aa]">
                  Tour {currentRoundNumber}
                </span>

                {isFinalized && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Dernier inventaire validé
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-[#a1a1aa]">
                {controllersList.length} contrôleurs assignés • Accord unanime requis sur chaque unité
              </p>
            </div>
          </div>

          {/* Actions manager */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-1.5 rounded border border-[#3f3f46] bg-[#27272a] px-3 py-2 text-xs text-white hover:border-[#71717a] transition-colors"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Mes tâches
            </Link>

            <button
              type="button"
              onClick={() => {
                void Promise.all([progress.refetch(), report.refetch(), rounds.refetch()]);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-[#3f3f46] bg-[#27272a] px-3 py-2 text-xs text-white hover:border-[#71717a] transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>

            {canLaunch && (
              <button
                type="button"
                onClick={() => void launch.mutateAsync(inventoryId)}
                disabled={launch.isPending}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-[#18181b] hover:bg-emerald-400 disabled:opacity-40 transition-colors"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Lancer ce tour
              </button>
            )}

            {canFinalize && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Confirmez-vous la finalisation de la campagne et l’application des ajustements de stock dans le registre de mouvements ?'
                    )
                  ) {
                    void finalize.mutateAsync(inventoryId);
                  }
                }}
                disabled={finalize.isPending}
                className="inline-flex items-center gap-1.5 rounded bg-[#d8a868] px-3.5 py-2 text-xs font-semibold text-[#18181b] hover:bg-[#e0b57c] disabled:opacity-40 transition-colors"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Finaliser la campagne
              </button>
            )}

            {p.status !== 'FINALIZED' && p.status !== 'CANCELLED' && permissions.canLaunchInventory && (
              <button
                type="button"
                onClick={async () => {
                  const reason = window.prompt("Motif de l'annulation de cet inventaire :");
                  if (reason !== null) {
                    await cancelMutation.mutateAsync({ inventoryId, reason });
                  }
                }}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded border border-rose-500/40 bg-rose-950/20 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-950/40 disabled:opacity-40 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Annuler
              </button>
            )}

            {p.status === 'DRAFT' && permissions.canDeleteInventory && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Voulez-vous vraiment supprimer cet inventaire en brouillon ?')) {
                    await deleteMutation.mutateAsync(inventoryId);
                    router.push('/inventory');
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}
          </div>
        </header>

        {/* Chaîne de recomptage / Historique des tours */}
        {rounds.data && rounds.data.length > 1 && (
          <section className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4">
            <div className="flex items-center gap-2 mb-3">
              <GitBranch className="h-4 w-4 text-[#d8a868]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa]">
                Chaîne des tours de recomptage ({rounds.data.length} tours)
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {rounds.data.map((rnd, idx) => {
                const isSelected = rnd.inventoryId === inventoryId;
                return (
                  <div key={rnd.inventoryId} className="flex items-center gap-2">
                    {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-[#71717a]" />}
                    <Link
                      href={`/inventory/${rnd.inventoryId}/report`}
                      className={`inline-flex items-center gap-2 rounded px-3 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'border border-[#d8a868] bg-[#d8a868]/15 font-semibold text-white'
                          : 'border border-[#3f3f46] bg-[#18181b] text-[#a1a1aa] hover:border-[#71717a] hover:text-white'
                      }`}
                    >
                      <span>Tour {rnd.roundNumber}</span>
                      <span className={`rounded px-1.5 py-0.2 text-[9px] font-medium ${statusBadgeClass(rnd.status)}`}>
                        {rnd.status}
                      </span>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Bannière de recomptage si divergence */}
        {p.status === 'RECOUNT_REQUIRED' && (
          <div className="rounded-lg border border-orange-500/40 bg-orange-950/25 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-orange-200">
                  Divergence constatée au Tour {currentRoundNumber}
                </h3>
                <p className="mt-1 text-xs text-orange-300/80">
                  Les contrôleurs ne sont pas unanimes sur l’intégralité des unités. Un nouveau tour complet a été généré en brouillon pour recomptage indépendant.
                </p>
              </div>
            </div>

            {p.nextChildId && (
              <Link
                href={`/inventory/${p.nextChildId}/report`}
                className="inline-flex items-center gap-1.5 rounded bg-orange-500 px-3.5 py-2 text-xs font-semibold text-[#18181b] hover:bg-orange-400 self-start sm:self-auto shrink-0 transition-colors"
              >
                Ouvrir le Tour {currentRoundNumber + 1}
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}

        {/* Bannière de convergence si unanimité */}
        {p.status === 'CONVERGED' && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/25 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-emerald-200">
                  Convergence unanime atteinte !
                </h3>
                <p className="mt-1 text-xs text-emerald-300/80">
                  Tous les contrôleurs s’accordent rigoureusement sur chaque unité du périmètre. Vous pouvez procéder à la finalisation pour enregistrer les ajustements de stock.
                </p>
              </div>
            </div>

            {canFinalize && (
              <button
                type="button"
                onClick={() => void finalize.mutateAsync(inventoryId)}
                disabled={finalize.isPending}
                className="inline-flex items-center gap-1.5 rounded bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-[#18181b] hover:bg-emerald-400 self-start sm:self-auto shrink-0 transition-colors"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Finaliser maintenant
              </button>
            )}
          </div>
        )}

        {/* Cartes de synthèse */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <SummaryCard label="Unités réconciliées" value={`${p.reconciledUnits}/${p.totalUnits}`} />
          <SummaryCard label="Contrôleurs" value={String(controllersList.length)} />
          <SummaryCard label="Lignes conformes" value={String(r.summary.compliantRows ?? 0)} />
          <SummaryCard label="Écarts position" value={String(r.summary.locationMismatches ?? 0)} />
          <SummaryCard label="Anomalies bloquantes" value={String(r.investigationIssues.filter(i => i.status === 'OPEN').length)} />
          <SummaryCard label="Total anomalies" value={String(r.investigationIssues.length)} />
        </section>

        {/* Cartes d'avancement des N contrôleurs */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-[#d8a868]" />
            Avancement des contrôleurs ({controllersList.length})
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {controllersList.map((ctrl, idx) => (
              <div key={ctrl?.controllerId ?? idx} className="rounded border border-[#3f3f46] bg-[#27272a] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    Contrôleur {idx + 1}
                  </span>
                  {ctrl?.isFinished ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Terminé
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#a1a1aa]">En cours</span>
                  )}
                </div>

                <p className="mt-1 text-xs text-[#d4d4d8] font-medium truncate">
                  {ctrl?.user?.userName || ctrl?.user?.userEmail || 'Sans nom'}
                </p>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-[#a1a1aa]">Unités comptées</span>
                  <span className="font-mono font-semibold">
                    {ctrl?.completedUnits ?? 0} / {p.totalUnits}
                  </span>
                </div>

                <div className="mt-2 w-full bg-[#18181b] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#d8a868] h-full transition-all"
                    style={{
                      width: `${p.totalUnits > 0 ? ((ctrl?.completedUnits ?? 0) / p.totalUnits) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparaison détaillée par unité */}
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              Comparaison détaillée par unité de travail
            </h2>
            <p className="mt-1 text-xs text-[#a1a1aa]">
              Tous les contrôleurs doivent soumettre le même comptage normalisé pour chaque élément.
            </p>
          </div>

          {r.units.length === 0 ? (
            <div className="rounded border border-dashed border-[#3f3f46] bg-[#27272a] p-8 text-center text-xs text-[#71717a]">
              Aucune unité disponible.
            </div>
          ) : (
            r.units.map((unit) => (
              <article
                key={unit.unitId}
                className="overflow-hidden rounded-lg border border-[#3f3f46] bg-[#27272a]"
              >
                <div className="flex flex-col gap-2 border-b border-[#3f3f46] bg-[#27272a]/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-xs font-semibold">
                      Unité #{unit.unitOrder + 1}
                    </h3>
                    <p className="mt-0.5 text-[10px] text-[#a1a1aa]">
                      Statut d&apos;acceptation :{' '}
                      {unit.reconciliationStatus === 'CONVERGED'
                        ? 'Accord unanime confirmé'
                        : unit.reconciliationStatus === 'RECOUNT_REQUIRED'
                          ? 'Divergence constatée'
                          : 'En attente des soumissions'}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded border px-2 py-1 text-[10px] font-semibold ${reconcileClass(
                      unit.reconciliationStatus,
                    )}`}
                  >
                    {unit.reconciliationStatus}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[900px] w-full text-left text-xs">
                    <thead className="border-b border-[#3f3f46] text-[10px] uppercase tracking-wide text-[#71717a] bg-[#18181b]/50">
                      <tr>
                        <th className="px-3 py-2.5">Élément / Emplacement</th>
                        {controllersList.map((c, idx) => (
                          <th key={c?.controllerId ?? idx} className="px-3 py-2.5">
                            Contrôleur {idx + 1}
                          </th>
                        ))}
                        <th className="px-3 py-2.5">Résultat validé</th>
                        <th className="px-3 py-2.5">Statut</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-[#3f3f46]">
                      {unit.rows.map((row) => (
                        <tr key={row.key} className="hover:bg-[#18181b]/30">
                          <td className="px-3 py-3">
                            <p className="font-semibold text-white">
                              {row.serialNumberCode ?? row.equipmentName ?? 'Élément'}
                            </p>
                            <p className="mt-0.5 text-[10px] text-[#a1a1aa]">
                              {row.kind}
                              {row.shelfName ? ` • ${row.shelfName}` : ''}
                            </p>
                          </td>

                          {controllersList.map((_, idx) => {
                            const val =
                              idx === 0
                                ? row.controller1
                                : idx === 1
                                  ? row.controller2
                                  : idx === 2
                                    ? row.controller3
                                    : row.controllerValues?.[String(idx + 1)] ?? null;

                            return (
                              <td key={idx} className="px-3 py-3 text-[#d4d4d8] font-mono">
                                {resultText(val, row.kind)}
                              </td>
                            );
                          })}

                          <td className="px-3 py-3 font-semibold text-white font-mono">
                            {resultText(row.accepted, row.kind)}
                          </td>

                          <td className="px-3 py-3">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-semibold ${comparisonClass(
                                row.controller1VsAccepted?.status ?? 'PENDING',
                              )}`}
                            >
                              {row.controller1VsAccepted?.status ?? 'PENDING'}
                            </span>
                          </td>
                        </tr>
                      ))}

                      {!unit.rows.length && (
                        <tr>
                          <td
                            colSpan={controllersList.length + 3}
                            className="px-3 py-8 text-center text-[#71717a]"
                          >
                            Les résultats de cette unité ne sont pas encore disponibles ou les comptages sont en attente.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Anomalies et Traçabilité */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Écarts et anomalies d&apos;inventaire ({r.investigationIssues.length})
            </h2>

            {r.investigationIssues.length ? (
              <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                {r.investigationIssues.map((issue) => (
                  <div
                    key={issue.issueId}
                    className="rounded border border-[#3f3f46] bg-[#18181b]/60 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-amber-200">{issue.issueType}</span>
                      <span className="rounded bg-[#27272a] px-2 py-0.5 text-[9px] text-[#a1a1aa] font-mono">
                        {issue.status}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-[#d4d4d8]">
                      {issue.equipment?.equipmentName ?? issue.serialNumberCode ?? 'Élément'}
                      {issue.deltaQuantity !== null && issue.deltaQuantity !== undefined
                        ? ` • Écart : ${issue.deltaQuantity > 0 ? '+' : ''}${issue.deltaQuantity}`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#71717a]">
                Aucun écart d’investigation enregistré pour ce tour.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-white">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              Traçabilité & Déroulement
            </h2>

            <div className="mt-3 space-y-2 text-xs text-[#d4d4d8]">
              <p>
                <span className="text-[#a1a1aa]">Création de la campagne :</span>{' '}
                {formatDate(r.inventory.createdAt)}
              </p>
              <p>
                <span className="text-[#a1a1aa]">Lancement du tour :</span>{' '}
                {formatDate(r.inventory.launchedAt)}
              </p>
              <p>
                <span className="text-[#a1a1aa]">Finalisation :</span>{' '}
                {formatDate(r.inventory.finalizedAt)}
              </p>
              <p>
                <span className="text-[#a1a1aa]">Mouvements d’ajustement générés :</span>{' '}
                <span className="font-mono font-semibold">{r.adjustmentMovements.length}</span>
              </p>
              <p>
                <span className="text-[#a1a1aa]">Version de politique appliquée :</span>{' '}
                <span className="font-mono">v{r.inventory.policyVersion ?? 4}</span>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#3f3f46] bg-[#27272a] p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#71717a]">{label}</p>
      <p className="mt-2 font-mono text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
