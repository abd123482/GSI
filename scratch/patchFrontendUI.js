const fs = require('fs');
const file = 'frontend/src/app/inventory/page.tsx';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/{inventory\.status ===\s*'DRAFT' &&\s*permissions\.canDeleteInventory && \(/, '{permissions.canDeleteInventory && (');
fs.writeFileSync(file, c);
console.log('Patched frontend UI');
