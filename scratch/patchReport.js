const fs = require('fs');
const file = 'frontend/src/app/inventory/[id]/report/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace('useParams,', 'useParams,\n  useRouter,');
c = c.replace('RefreshCw,', 'RefreshCw,\n  Trash2,');
c = c.replace('useInventoryReport,', 'useDeleteInventory,\n  useInventoryReport,');

const hookInsert = `  const launch =
    useLaunchInventory();
  const finalize =
    useFinalizeInventory();
  const deleteMutation =
    useDeleteInventory();
  const router = useRouter();`;

c = c.replace(/  const launch =[\s\S]*?useFinalizeInventory\(\);/, hookInsert);

const buttonInsert = `            {canFinalize && (
              <button
                type="button"
                onClick={() => {
                  void finalize.mutateAsync(
                    inventoryId,
                  );
                }}
                disabled={
                  finalize.isPending
                }
                className="inline-flex items-center gap-2 rounded bg-[#d8a868] px-3 py-2 text-xs font-semibold text-[#1e1a17] disabled:opacity-40"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                Finaliser
              </button>
            )}

            {permissions.canDeleteInventory && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Voulez-vous vraiment supprimer cet inventaire ?')) {
                    await deleteMutation.mutateAsync(inventoryId);
                    router.push('/inventory');
                  }
                }}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-2 rounded bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Supprimer
              </button>
            )}`;

c = c.replace(/            \{canFinalize && \([\s\S]*?Finaliser\n              <\/button>\n            \)\}/, buttonInsert);

fs.writeFileSync(file, c);
console.log('Patched report page');
