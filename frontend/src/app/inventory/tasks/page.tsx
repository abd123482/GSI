'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  PlayCircle,
} from 'lucide-react';

import {
  useMyTasks,
} from '@/hooks/use-inventory';

function purposeLabel(
  purpose: string,
) {
  if (purpose === 'PRIMARY_1') {
    return 'Contrôleur 1';
  }

  if (purpose === 'PRIMARY_2') {
    return 'Contrôleur 2';
  }

  return 'Contrôleur 3';
}

export default function MyInventoryTasksPage() {
  const tasksQuery =
    useMyTasks();

  const tasks =
    tasksQuery.data ?? [];

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-[#2b2622] text-white">
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3 border-b border-[#3f3a36] pb-4">
          <Link
            href="/inventory"
            className="rounded border border-[#3f3a36] p-2 text-[#aea69c] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div>
            <h1 className="text-xl font-semibold">
              Mes tâches d’inventaire
            </h1>

            <p className="mt-1 text-xs text-[#aea69c]">
              C3 apparaît uniquement sur les unités où C1 et C2 diffèrent.
            </p>
          </div>
        </div>

        {tasksQuery.isLoading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-xs text-[#aea69c]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement des tâches...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center rounded border border-dashed border-[#4a4540] bg-[#2f2a26] p-6 text-center">
            <ClipboardList className="h-7 w-7 text-[#8c827a]" />

            <p className="mt-3 text-sm font-medium">
              Aucune tâche disponible
            </p>

            <p className="mt-1 text-xs text-[#8c827a]">
              Les prochaines unités apparaîtront lorsqu’elles seront débloquées.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tasks.map(
              (task) => (
                <article
                  key={task.attemptId}
                  className="rounded-lg border border-[#3f3a36] bg-[#2f2a26] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span
                        className={`rounded border px-2 py-1 text-[10px] font-semibold ${
                          task.purpose === 'FINAL_RECOUNT'
                            ? 'border-violet-400/30 bg-violet-950/20 text-violet-200'
                            : 'border-sky-400/25 bg-sky-950/20 text-sky-200'
                        }`}
                      >
                        {purposeLabel(task.purpose)}
                      </span>

                      <h2 className="mt-3 text-sm font-semibold">
                        {task.unit.inventory.title}
                      </h2>

                      <p className="mt-1 text-xs text-[#aea69c]">
                        Unité #{task.unit.unitOrder + 1}
                      </p>
                    </div>

                    <span className="rounded border border-[#3f3a36] bg-[#383330] px-2 py-1 text-[10px] text-[#c9c0ad]">
                      {task.status}
                    </span>
                  </div>

                  {task.purpose === 'FINAL_RECOUNT' && (
                    <p className="mt-3 rounded border border-violet-400/20 bg-violet-950/10 p-2.5 text-[10px] text-violet-100">
                      C1 et C2 ont produit des résultats différents sur cette unité. Votre comptage C3 devient le résultat accepté.
                    </p>
                  )}

                  <Link
                    href={`/inventory/tasks/${task.attemptId}`}
                    className="mt-4 inline-flex items-center gap-1.5 rounded bg-[#f7f5f0] px-3 py-2 text-xs font-semibold text-[#2b2622]"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    Ouvrir la tâche
                  </Link>
                </article>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
