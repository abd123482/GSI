const fs = require('fs');
['src/hooks/use-movements.ts', 'src/hooks/use-serial-numbers.ts'].forEach(f => {
  let c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('useAuthQueryContext')) {
    c = c.replace(/import \{ useApi \} from '\.\/use-api';/, "import { useApi } from './use-api';\nimport { useAuthQueryContext } from './use-auth-query-context';");
    fs.writeFileSync(f, c);
  }
});

let d = fs.readFileSync('src/hooks/use-dashboard.ts', 'utf-8');
d = d.replace(/enabled: authReady,\s*enabled: authReady && Boolean\(userId\),/g, 'enabled: authReady && Boolean(userId),');
fs.writeFileSync('src/hooks/use-dashboard.ts', d);
