const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../backend/src/dashboard/dashboard.service.ts');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /workUnits:\s*\{\s*select:\s*\{\s*status:\s*true\s*\},?\s*\}/g,
  `units: {\n            select: { status: true },\n          }`
);

code = code.replace(
  /const totalWorkUnits = inv\.workUnits\.length;/g,
  `const unitsList = inv.units ?? inv.workUnits ?? [];\n      const totalWorkUnits = unitsList.length;`
);

code = code.replace(
  /inv\.workUnits\.filter/g,
  `unitsList.filter`
);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully patched dashboard.service.ts');
