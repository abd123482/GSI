const fs = require('fs');
const file = 'src/inventory/inventory.service.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('let expectedEquipments: Array<{')) {
  // Add expectedEquipments declaration
  content = content.replace(
    '  let expectedShelves: Array<{',
    '  let expectedEquipments: Array<{\n    equipmentId: string;\n    equipmentName: string;\n    hasSerialNumber: boolean;\n    quantity: number;\n  }> = [];\n\n  let expectedShelves: Array<{'
  );

  // Add expectedEquipments generation inside ByShelf logic
  const byShelfLogic = `} else if (attempt.unit.shelfId) {
    const shelf =
      await this.prisma.shelf.findUnique({
        where: {
          shelfId:
            attempt.unit.shelfId,
        },
        select: {
          shelfName: true,
        },
      });

    scopeLabel =
      shelf?.shelfName ??
      'Emplacement inconnu';

    const allocations = await this.prisma.equipmentShelfs.findMany({
      where: { shelfId: attempt.unit.shelfId, equipmentQuantity: { gt: 0 } },
      include: { equipment: { select: { equipmentName: true, hasSerialNumber: true } } }
    });

    const eqMap = new Map<string, { equipmentId: string; equipmentName: string; hasSerialNumber: boolean; quantity: number }>();
    
    for (const alloc of allocations) {
      if (alloc.equipmentId && alloc.equipment) {
        eqMap.set(alloc.equipmentId, {
          equipmentId: alloc.equipmentId,
          equipmentName: alloc.equipment.equipmentName,
          hasSerialNumber: alloc.equipment.hasSerialNumber,
          quantity: alloc.equipmentQuantity,
        });
      }
    }

    const serialCounts = await this.prisma.serialNumber.groupBy({
      by: ['equipmentId'],
      where: { shelfId: attempt.unit.shelfId, equipmentId: { not: null } },
      _count: { _all: true },
    });

    const missingEqIds = serialCounts.map(g => g.equipmentId).filter((id) => Boolean(id) && !eqMap.has(id));
    let missingEqMap = new Map<string, { name: string, hasSerial: boolean }>();
    if (missingEqIds.length > 0) {
      const missingEqs = await this.prisma.equipment.findMany({
        where: { equipmentId: { in: missingEqIds } },
        select: { equipmentId: true, equipmentName: true, hasSerialNumber: true },
      });
      for (const eq of missingEqs) {
        missingEqMap.set(eq.equipmentId, { name: eq.equipmentName, hasSerial: eq.hasSerialNumber });
      }
    }

    for (const group of serialCounts) {
      if (!group.equipmentId) continue;
      const count = group._count._all;
      const existing = eqMap.get(group.equipmentId);
      if (existing) {
         if (count > 0 && existing.quantity === 0) {
           existing.quantity = count;
         }
      } else {
        const info = missingEqMap.get(group.equipmentId);
        if (info) {
          eqMap.set(group.equipmentId, {
            equipmentId: group.equipmentId,
            equipmentName: info.name,
            hasSerialNumber: info.hasSerial,
            quantity: count,
          });
        }
      }
    }
    
    expectedEquipments = Array.from(eqMap.values());
  }`;
  
  content = content.replace(/\} else if \(attempt\.unit\.shelfId\) \{[\s\S]*?'Emplacement inconnu';\n  \}/, byShelfLogic);

  // Return expectedEquipments
  content = content.replace(
    '    expectedShelves,\n  };\n}',
    '    expectedShelves,\n    expectedEquipments,\n  };\n}'
  );

  fs.writeFileSync(file, content);
  console.log('Backend patched successfully.');
} else {
  console.log('Already patched.');
}
