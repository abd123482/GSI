const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../backend/src/inventory/inventory.service.ts');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);

lines.forEach((line, index) => {
  if (line.includes('getInventoryProgress') || line.includes('getInventoryReport') || line.includes('launchInventory') || line.includes('deleteInventory')) {
    console.log(`Line ${index + 1}: ${line}`);
  }
});
