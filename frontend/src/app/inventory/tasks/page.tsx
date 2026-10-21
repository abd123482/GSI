'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  PlayCircle,
} from 'lucide-react';

import {
  useMyTasks,
} from '@/hooks/use-inventory';

function purposeLabel(sequence?: number) {
  return `Contrôleur ${(sequence ?? 0) + 1}`;
}

function taskStatusBadge(status: string) {
  switch (status) {
    case 'WAITING_PREVIOUS':
      return {
        label: 'En attente du contrôleur précédent',
        className: 'border-amber-500/40 bg-amber-950/20 text-amber-300',
      };
    case 'AVAILABLE':
      return {
        label: 'Disponible',
        className: 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300',
      };
    case 'SUBMITTED':
      return {
        label: 'Terminée',
        className: 'border-slate-500/40 bg-slate-950/20 text-slate-300',
      };
    default:
      return {
        label: status,
        className: 'border-[#3f3f46] bg-[#27272a] text-[#d4d4d8]',
      };
  }
}

export default function MyInventoryTasksPage() {
  const tasksQuery =
    useMyTasks();

  const tasks =
    tasksQuery.data ?? [];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#18181b] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 border-b border-[#3f3f46] pb-4">
          <Link
            href="/inventory"
            className="rounded border border-[#3f3f46] p-2 text-[#a1a1aa] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <h1 className="text-xl font-semibold">
              Mes tâches d’inventaire
            </h1>

            <p className="mt-1 text-xs text-[#a1a1aa]">
              Comptage synchronisé unité par unité : chaque contrôleur est notifié dès que le contrôleur précédent termine l&apos;unité.
            </p>
          </div>
        </div>

        {tasksQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-xs text-[#a1a1aa]">
            <Loader2 className="h-4 w-4 animate-spin text-[#d8a868]" />
            Chargement des tâches...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded border border-dashed border-[#4a4540] bg-[#27272a] p-6 text-center">
            <ClipboardList className="h-7 w-7 text-[#71717a]" />

            <p className="mt-3 text-sm font-medium">
              Aucune tâche disponible
            </p>

            <p className="mt-1 text-xs text-[#71717a]">
              Les tâches apparaîtront lorsque les inventaires seront lancés et synchronisés unité par unité.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tasks.map((task) => {
              const badge = taskStatusBadge(task.status);
              const isWaiting = task.status === 'WAITING_PREVIOUS';
              const isSubmitted = task.status === 'SUBMITTED';

              return (
                <article
                  key={task.attemptId}
                  className="rounded-lg border border-[#3f3f46] bg-[#27272a] p-4 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded border border-sky-400/25 bg-sky-950/20 px-2 py-1 text-[10px] font-semibold text-sky-200">
                        {purposeLabel(task.sequence)}
                      </span>

                      <h2 className="mt-3 text-sm font-semibold">
                        {task.unit.inventory.title}
                      </h2>

                      <p className="mt-1 text-xs text-[#a1a1aa]">
                        Unité #{task.unit.unitOrder + 1}
                      </p>
                    </div>

                    <span className={`rounded border px-2 py-1 text-[10px] font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    {isWaiting ? (
                      <div className="flex items-center gap-1.5 rounded border border-amber-500/20 bg-amber-950/10 px-3 py-2 text-xs text-amber-300/80">
                        <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>En attente du comptage du contrôleur précédent sur cette unité</span>
                      </div>
                    ) : isSubmitted ? (
                      <div className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Comptage soumis</span>
                      </div>
                    ) : (
                      <Link
                        href={`/inventory/tasks/${task.attemptId}`}
                        className="inline-flex items-center gap-1.5 rounded bg-[#fafafa] px-3 py-2 text-xs font-semibold text-[#18181b] hover:bg-white"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Ouvrir la tâche
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
