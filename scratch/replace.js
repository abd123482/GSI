const fs = require('fs');
let content = fs.readFileSync('backend/src/dashboard/dashboard.service.ts', 'utf8');
content = content.replace(/for \(const group of movementsByType\) \{[\s\S]*?otherCount \+= count;\s*\}/, 
`for (const group of movementsByType) {
      const isOut = group.mouvementStatus;
      const count = group._count.mouvementId || 0;
      if (isOut) outCount += count;
      else inCount += count;
    }`);
fs.writeFileSync('backend/src/dashboard/dashboard.service.ts', content);
