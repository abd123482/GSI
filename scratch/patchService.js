const fs = require('fs');
const file = 'backend/src/inventory/inventory.service.ts';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/if \(\s*existing\.status !== 'DRAFT'\s*\) \{[\s\S]*?\}/, '/* Admin can delete any inventory */');

const replaceTx = `return this.prisma.$transaction(async (tx) => {
      const units = await tx.inventoryWorkUnit.findMany({ where: { inventoryId }, select: { unitId: true } });
      const unitIds = units.map(u => u.unitId);
      
      if (unitIds.length > 0) {
        await tx.inventoryWorkUnit.updateMany({
          where: { inventoryId },
          data: { acceptedAttemptId: null }
        });
        
        await tx.inventoryCountAttempt.deleteMany({
          where: { unitId: { in: unitIds } },
        });
        
        await tx.inventoryWorkUnit.deleteMany({
          where: { inventoryId },
        });
      }`;

c = c.replace('return this.prisma.$transaction(async (tx) => {', replaceTx);

fs.writeFileSync(file, c);
console.log('Patched backend service');
