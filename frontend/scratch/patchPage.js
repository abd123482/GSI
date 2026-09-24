const fs = require('fs');
let c = fs.readFileSync('src/app/inventory/tasks/[taskId]/page.tsx', 'utf-8');

// Fix expectedShelves
c = c.replace(
  /const expectedShelves = useMemo\(\(\) => \{[\s\S]*?\}, \[task\?\.expectedShelves, allocations\.data\?\.equipmentShelfs\]\);/g,
  `const expectedShelves = useMemo(() => {
    const fromStandard = task?.expected?.standardItems.map((i: any) => ({ shelfId: i.shelfId, shelfName: i.shelfName, quantity: i.expectedQuantity })) || [];
    const fromSerialized = task?.expected?.serializedItems.map((i: any) => ({ shelfId: i.expectedShelfId ?? '', shelfName: i.expectedShelfName ?? '', quantity: 1 })).filter((i: any) => i.shelfId) || [];
    const combined = [...fromStandard, ...fromSerialized];
    if (combined.length > 0) {
      const map = new Map();
      for (const item of combined) {
        if (!map.has(item.shelfId)) {
          map.set(item.shelfId, { ...item });
        } else {
          map.get(item.shelfId).quantity += item.quantity;
        }
      }
      return Array.from(map.values());
    }
    return (
      allocations.data?.equipmentShelfs?.map((a: any) => ({
        shelfId: a.shelfId,
        shelfName: a.shelf?.shelfName ?? 'Emplacement',
        quantity: a.equipmentQuantity,
      })) ?? []
    );
  }, [task?.expected, allocations.data?.equipmentShelfs]);`
);

// Fix task.isSerialized
c = c.replace(/task\.isSerialized/g, 'task?.scope?.isSerialized');

// Fix task.scopeLabel
c = c.replace(/task\.scopeLabel/g, 'task?.scope?.label');

// Fix implicit anys in expectedShelves.map((allocation) =>
c = c.replace(/expectedShelves\.map\(\(allocation\) =>/g, 'expectedShelves.map((allocation: any) =>');
c = c.replace(/expectedShelves\.map\(\(a\) =>/g, 'expectedShelves.map((a: any) =>');
c = c.replace(/expectedShelves\.find\(\(a\) =>/g, 'expectedShelves.find((a: any) =>');

// Add error handling
if (!c.includes('if (taskQuery.isError || !task)')) {
  c = c.replace(
    /if \(taskQuery\.isLoading \|\| !task\) \{[\s\S]*?return \([\s\S]*?<\/main>\s*\);\s*\}/,
    `if (taskQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#2b2622] text-white">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }
  if (taskQuery.isError || !task) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#2b2622] text-white space-y-4">
        <p className="text-rose-400">Erreur lors du chargement de la tâche ou accès refusé.</p>
        <Link href="/inventory/tasks" className="text-sm underline">Retour aux tâches</Link>
      </main>
    );
  }`
  );
}

fs.writeFileSync('src/app/inventory/tasks/[taskId]/page.tsx', c);
