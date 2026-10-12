const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

// Replace where clause
code = code.replace(
  /Inventory_User:\s*\{\s*some:\s*\{\s*userId:\s*filterUserId,\s*\},\s*\}/g,
  `controllers: {
              some: {
                userId: filterUserId,
              },
            }`
);

// Replace include inside getInventories findMany
code = code.replace(
  /Inventory_User:\s*\{\s*include:\s*\{\s*User:\s*\{[\s\S]*?orderBy:\s*\{\s*sequence:\s*'asc'\s*\},\s*\},/g,
  `controllers: {
              include: {
                user: {
                  select: {
                    userId: true,
                    userName: true,
                    userEmail: true,
                  },
                },
              },
              orderBy: { round: 'asc' },
            },`
);

// Replace workUnits and investigationIssues in getInventories findMany
code = code.replace(
  /workUnits:\s*\{\s*select:\s*\{[\s\S]*?orderBy:\s*\{\s*unitOrder:\s*'asc'\s*\},\s*\},/g,
  `units: {
              select: {
                unitId: true,
                status: true,
                equipmentId: true,
                shelfId: true,
                reconciliationStatus: true,
                acceptedCountId: true,
                reconciledAt: true,
              },
            },`
);

code = code.replace(
  /investigationIssues:\s*true/g,
  `issues: true`
);

// Map the output of getInventories before returning
code = code.replace(
  /return\s*\{\s*inventories,\s*totalInventories,/g,
  `return {
      inventories: inventories.map((inv: any) => ({
        ...inv,
        Inventory_User: inv.controllers?.map((c: any) => ({
          inventoryId: inv.inventoryId,
          userId: c.userId,
          sequence: c.round,
          responsibility:
            c.round === 1
              ? 'PRIMARY_COUNTER_1'
              : c.round === 2
                ? 'PRIMARY_COUNTER_2'
                : 'FINAL_CONTROLLER',
          User: c.user,
        })),
        workUnits: inv.units,
        _count: {
          investigationIssues: inv._count?.issues ?? 0,
        },
      })),
      totalInventories,`
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched inventory.service.ts');
