const fs = require('fs');

function replaceInFile(file, regex, replacement) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
}

replaceInFile('frontend/src/types/movement.ts', /mouvementStatus:\s*MovementType;/g, 'mouvementStatus: boolean;');
replaceInFile('frontend/src/types/dashboard.ts', /mouvementStatus:\s*string;/g, 'mouvementStatus: boolean;');

const typeFunc = `function movementType(movement: any): 'IN' | 'OUT' | 'TRANSFER' {
  return movement.mouvementStatus ? 'OUT' : 'IN';
}`;

replaceInFile('frontend/src/components/movement/MovementListTable.tsx', /function movementType\([\s\S]*?return 'TRANSFER';\s*\}/, typeFunc);
replaceInFile('frontend/src/components/movement/MovementDetailModal.tsx', /function movementType\([\s\S]*?return 'TRANSFER';\s*\}/, typeFunc);
replaceInFile('frontend/src/components/equipment/EquipmentDetailModal.tsx', /function movementType\([\s\S]*?return 'TRANSFER';\s*\}/, typeFunc);

replaceInFile('frontend/src/components/dashboard/DashboardTables.tsx', /const typeUpper = m\.mouvementStatus\.toUpperCase\(\);/g, "const typeUpper = m.mouvementStatus ? 'OUT' : 'IN';");
replaceInFile('frontend/src/components/dashboard/DashboardTables.tsx', /\{m\.mouvementStatus\}/g, "{m.mouvementStatus ? 'OUT' : 'IN'}");
