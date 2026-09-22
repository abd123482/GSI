'use client';

import Link from 'next/link';
import {
  useParams,
} from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Loader2,
  PlayCircle,
  RefreshCw,
  Users,
} from 'lucide-react';

import {
  useFinalizeInventory,
  useInventoryProgress,
  useInventoryReport,
  useLaunchInventory,
} from '@/hooks/use-inventory';

import {
  usePermissions,
} from '@/hooks/use-permissions';

import type {
  InventoryComparisonStatus,
  InventoryReportCell,
} from '@/types/inventory';

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'fr-DZ',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    },
  ).format(date);
}

function reconcileClass(
  value: string,
) {
  if (
    value === 'PRIMARY_MATCH'
  ) {
    return 'border-emerald-400/25 bg-emerald-950/20 text-emerald-200';
  }

  if (
    value === 'THIRD_RESOLVED'
  ) {
    return 'border-violet-400/25 bg-violet-950/20 text-violet-200';
  }

  if (
    value === 'THIRD_REQUIRED'
  ) {
    return 'border-amber-400/25 bg-amber-950/20 text-amber-200';
  }

  return 'border-slate-400/25 bg-slate-950/20 text-slate-300';
}

function comparisonClass(
  status: InventoryComparisonStatus,
) {
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

function resultText(
  cell: InventoryReportCell | null,
  kind: string,
) {
  if (!cell) {
    return '—';
  }

  if (
    kind === 'SERIALIZED'
  ) {
    return (
      cell.serialNumberCode ??
      'Série observée'
    );
  }

  return `${cell.quantity}`;
}

export default function InventoryReportPage() {
  const params =
    useParams();

  const inventoryId =
    params?.id as string;

  const permissions =
    usePermissions();

  const progress =
    useInventoryProgress(
      inventoryId,
    );

  const report =
    useInventoryReport(
      inventoryId,
    );

  const launch =
    useLaunchInventory();

  const finalize =
    useFinalizeInventory();

  if (
    progress.isLoading ||
    report.isLoading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
        <div className="flex items-center gap-2 text-xs text-[#aea69c]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement du rapport...
        </div>
      </main>
    );
  }

  if (
    progress.isError ||
    report.isError ||
    !progress.data ||
    !report.data
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] p-6 text-white">
        <div className="rounded border border-rose-500/25 bg-rose-950/15 p-6 text-sm text-rose-200">
          Impossible de charger cet inventaire.
        </div>
      </main>
    );
  }

  const p =
    progress.data;

  const r =
    report.data;

  const canFinalize =
    p.status ===
      'COMPLETED' &&
    permissions.canFinalizeInventory;

  const canLaunch =
    p.status ===
      'DRAFT' &&
    permissions.canLaunchInventory;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-white">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-[#3f3a36] pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/inventory"
              className="rounded border border-[#3f3a36] p-2 text-[#aea69c] hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">
                  {r.inventory.title}
                </h1>

                <span className="rounded border border-[#3f3a36] bg-[#383330] px-2 py-1 text-[10px]">
                  {r.inventory.status}
                </span>
              </div>

              <p className="mt-1 text-xs text-[#aea69c]">
                Rapport unité par unité • C1 / C2 / C3 conditionnel / Résultat accepté
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inventory/tasks"
              className="inline-flex items-center gap-2 rounded border border-[#3f3a36] bg-[#383330] px-3 py-2 text-xs"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Mes tâches
            </Link>

            <button
              type="button"
              onClick={() => {
                void Promise.all([
                  progress.refetch(),
                  report.refetch(),
                ]);
              }}
              className="inline-flex items-center gap-2 rounded border border-[#3f3a36] bg-[#383330] px-3 py-2 text-xs"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Actualiser
            </button>

            {canLaunch && (
              <button
                type="button"
                onClick={() => {
                  void launch.mutateAsync(
                    inventoryId,
                  );
                }}
                disabled={
                  launch.isPending
                }
                className="inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#1e1a17] disabled:opacity-40"
              >
                <PlayCircle className="h-3.5 w-3.5" />
                Lancer
              </button>
            )}

            {canFinalize && (
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Finaliser cet inventaire et appliquer les mouvements d’ajustement ?',
                    )
                  ) {
                    void finalize.mutateAsync(
                      inventoryId,
                    );
                  }
                }}
                disabled={
                  finalize.isPending
                }
                className="inline-flex items-center gap-2 rounded bg-[#f7f5f0] px-3 py-2 text-xs font-semibold text-[#2b2622] disabled:opacity-40"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Finaliser
              </button>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <SummaryCard
            label="Unités"
            value={`${p.reconciledUnits}/${p.totalUnits}`}
          />

          <SummaryCard
            label="C1=C2"
            value={String(
              r.summary
                .primaryMatchUnits,
            )}
          />

          <SummaryCard
            label="C3 requis"
            value={String(
              r.summary
                .thirdRequiredUnits,
            )}
          />

          <SummaryCard
            label="C3 résolu"
            value={String(
              r.summary
                .thirdResolvedUnits,
            )}
          />

          <SummaryCard
            label="Écarts position"
            value={String(
              r.summary
                .locationMismatches,
            )}
          />

          <SummaryCard
            label="Problèmes"
            value={String(
              r.investigationIssues
                .length,
            )}
          />
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ControllerCard
            title="Contrôleur 1 — C1"
            data={
              p.controllers
                .controller1
            }
          />

          <ControllerCard
            title="Contrôleur 2 — C2"
            data={
              p.controllers
                .controller2
            }
          />

          <ControllerCard
            title="Contrôleur 3 — C3"
            data={
              p.controllers
                .controller3
            }
            conditional
          />
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">
              Comparaison détaillée par unité
            </h2>

            <p className="mt-1 text-[10px] text-[#8c827a]">
              Le résultat accepté est C1 lorsque C1=C2, ou C3 lorsqu’un écart a nécessité le troisième contrôleur.
            </p>
          </div>

          {r.units.length ===
          0 ? (
            <div className="rounded border border-dashed border-[#4a4540] bg-[#2f2a26] p-8 text-center text-xs text-[#8c827a]">
              Aucune unité disponible.
            </div>
          ) : (
            r.units.map(
              (unit) => (
                <article
                  key={unit.unitId}
                  className="overflow-hidden rounded-lg border border-[#3f3a36] bg-[#2f2a26]"
                >
                  <div className="flex flex-col gap-2 border-b border-[#3f3a36] bg-[#383330]/45 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-xs font-semibold">
                        Unité #
                        {unit.unitOrder +
                          1}
                      </h3>

                      <p className="mt-0.5 text-[9px] text-[#8c827a]">
                        Résultat accepté :{' '}
                        {unit.acceptedPurpose ===
                        'FINAL_RECOUNT'
                          ? 'C3'
                          : unit.acceptedPurpose ===
                              'PRIMARY_1'
                            ? 'C1'
                            : 'En attente'}
                      </p>
                    </div>

                    <span
                      className={`w-fit rounded border px-2 py-1 text-[10px] font-semibold ${reconcileClass(
                        unit.reconciliationStatus,
                      )}`}
                    >
                      {
                        unit.reconciliationStatus
                      }
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-[1050px] w-full text-left text-xs">
                      <thead className="border-b border-[#3f3a36] text-[9px] uppercase tracking-wide text-[#8c827a]">
                        <tr>
                          <th className="px-3 py-2">
                            Élément
                          </th>
                          <th className="px-3 py-2">
                            C1
                          </th>
                          <th className="px-3 py-2">
                            C2
                          </th>
                          <th className="px-3 py-2">
                            C3
                          </th>
                          <th className="px-3 py-2">
                            Accepté
                          </th>
                          <th className="px-3 py-2">
                            C1 vs final
                          </th>
                          <th className="px-3 py-2">
                            C2 vs final
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-[#3f3a36]">
                        {unit.rows.map(
                          (row) => (
                            <tr
                              key={
                                row.key
                              }
                            >
                              <td className="px-3 py-3">
                                <p className="font-semibold">
                                  {row.serialNumberCode ??
                                    row.equipmentName ??
                                    'Élément'}
                                </p>

                                <p className="mt-0.5 text-[9px] text-[#8c827a]">
                                  {row.kind}
                                  {row.shelfName
                                    ? ` • ${row.shelfName}`
                                    : ''}
                                </p>
                              </td>

                              <ResultCell
                                value={resultText(
                                  row.controller1,
                                  row.kind,
                                )}
                              />

                              <ResultCell
                                value={resultText(
                                  row.controller2,
                                  row.kind,
                                )}
                              />

                              <ResultCell
                                value={
                                  unit.reconciliationStatus ===
                                    'THIRD_REQUIRED' ||
                                  unit.reconciliationStatus ===
                                    'THIRD_RESOLVED'
                                    ? resultText(
                                        row.controller3,
                                        row.kind,
                                      )
                                    : 'Non requis'
                                }
                              />

                              <ResultCell
                                value={resultText(
                                  row.accepted,
                                  row.kind,
                                )}
                                strong
                              />

                              <ComparisonCell
                                status={
                                  row
                                    .controller1VsAccepted
                                    .status
                                }
                                missing={
                                  row
                                    .controller1VsAccepted
                                    .missing
                                }
                                surplus={
                                  row
                                    .controller1VsAccepted
                                    .surplus
                                }
                              />

                              <ComparisonCell
                                status={
                                  row
                                    .controller2VsAccepted
                                    .status
                                }
                                missing={
                                  row
                                    .controller2VsAccepted
                                    .missing
                                }
                                surplus={
                                  row
                                    .controller2VsAccepted
                                    .surplus
                                }
                              />
                            </tr>
                          ),
                        )}

                        {!unit.rows.length && (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-3 py-8 text-center text-[#8c827a]"
                            >
                              Les résultats de cette unité ne sont pas encore disponibles.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </article>
              ),
            )
          )}
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
              Écarts / investigations
            </h2>

            {r.investigationIssues
              .length ? (
              <div className="mt-3 space-y-2">
                {r.investigationIssues.map(
                  (issue) => (
                    <div
                      key={
                        issue.issueId
                      }
                      className="rounded border border-[#3f3a36] bg-[#383330]/40 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold">
                          {
                            issue.issueType
                          }
                        </span>

                        <span className="text-[9px] text-[#aea69c]">
                          {
                            issue.status
                          }
                        </span>
                      </div>

                      <p className="mt-1 text-[10px] text-[#aea69c]">
                        {issue.equipment
                          ?.equipmentName ??
                          issue.serialNumberCode ??
                          'Élément'}
                        {issue.deltaQuantity
                          ? ` • écart ${issue.deltaQuantity}`
                          : ''}
                      </p>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#8c827a]">
                Aucun écart d’investigation enregistré.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-4">
            <h2 className="flex items-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
              Traçabilité
            </h2>

            <div className="mt-3 space-y-2 text-xs text-[#c9c0ad]">
              <p>
                Créé :{' '}
                {formatDate(
                  r.inventory
                    .createdAt,
                )}
              </p>

              <p>
                Lancé :{' '}
                {formatDate(
                  r.inventory
                    .launchedAt,
                )}
              </p>

              <p>
                Finalisé :{' '}
                {formatDate(
                  r.inventory
                    .finalizedAt,
                )}
              </p>

              <p>
                Mouvements d’ajustement :{' '}
                {
                  r.adjustmentMovements
                    .length
                }
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded border border-[#3f3a36] bg-[#2f2a26] p-3">
      <p className="text-[9px] uppercase tracking-wider text-[#8c827a]">
        {label}
      </p>

      <p className="mt-2 font-mono text-lg font-semibold">
        {value}
      </p>
    </div>
  );
}

function ControllerCard({
  title,
  data,
  conditional = false,
}: {
  title: string;
  data: {
    user: {
      userName:
        string | null;
      userEmail:
        string | null;
    } | null;
    completedUnits: number;
    totalUnits?: number;
    requiredUnits?: number;
    isActive?: boolean;
    isFinished: boolean;
  };
  conditional?: boolean;
}) {
  const total =
    conditional
      ? data.requiredUnits ??
        0
      : data.totalUnits ??
        0;

  return (
    <div className="rounded border border-[#3f3a36] bg-[#2f2a26] p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-[#aea69c]" />

        <div>
          <p className="text-xs font-semibold">
            {title}
          </p>

          <p className="mt-0.5 text-[9px] text-[#8c827a]">
            {data.user
              ?.userName ??
              data.user
                ?.userEmail ??
              'Non assigné'}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-[#aea69c]">
          {conditional
            ? 'Unités requises'
            : 'Progression'}
        </span>

        <span className="font-mono font-semibold">
          {
            data.completedUnits
          }
          /
          {total}
        </span>
      </div>

      {conditional &&
        total === 0 && (
          <p className="mt-2 text-[10px] text-emerald-200">
            Aucun C3 requis pour le moment.
          </p>
        )}
    </div>
  );
}

function ResultCell({
  value,
  strong = false,
}: {
  value: string;
  strong?: boolean;
}) {
  return (
    <td
      className={`px-3 py-3 ${
        strong
          ? 'font-semibold text-white'
          : 'text-[#c9c0ad]'
      }`}
    >
      {value}
    </td>
  );
}

function ComparisonCell({
  status,
  missing,
  surplus,
}: {
  status: InventoryComparisonStatus;
  missing: number;
  surplus: number;
}) {
  return (
    <td className="px-3 py-3">
      <span
        className={`inline-flex rounded border px-2 py-1 text-[9px] font-semibold ${comparisonClass(
          status,
        )}`}
      >
        {status}
        {missing > 0
          ? ` -${missing}`
          : surplus > 0
            ? ` +${surplus}`
            : ''}
      </span>
    </td>
  );
}
