const fs = require('fs');
const path = require('path');
const files = [
  'equipmentMovement.spec.ts',
  'equipmentMovement.transaction.unit.spec.ts',
  'equipmentMovement.unit.spec.ts'
];
files.forEach(f => {
  const filepath = path.join('backend/src/movements', f);
  let c = fs.readFileSync(filepath, 'utf8');
  c = c.replace(/new EquipmentMovementService\(\s*(prisma(?:\s*as\s*any)?)\s*\)/g, 'new EquipmentMovementService($1, {} as any)');
  c = c.replace(/sourceShelfId:\s*[^,\}]+,?\s*/g, '');
  c = c.replace(/destinationShelfId:\s*[^,\}]+,?\s*/g, '');
  c = c.replace(/shelfName:\s*'Main Shelf',\n\s*shelfQuantity:\s*100,\n\s*stockId:\s*'11111111-1111-4111-8111-111111111111',/g, 'shelfName: "Main Shelf", shelfQuantity: 100, stockId: "11111111-1111-4111-8111-111111111111", shelfStatusId: "ACTIVE",');
  fs.writeFileSync(filepath, c);
});
